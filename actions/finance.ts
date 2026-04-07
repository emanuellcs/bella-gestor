"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";
import { Sale, SaleStatus, Payment, PaymentStatus } from "@/types";
import {
  supabaseSaleToSale,
  supabasePaymentToPayment,
} from "@/lib/utils/mapping";

export type NewSale = Omit<
  Sale,
  "id" | "payments" | "created_at" | "updatedAt" | "clientName" | "totalAmount"
> & {
  totalAmount?: number;
};

/**
 * Creates a new sale and its items.
 */
export async function createSaleAction(sale: NewSale) {
  try {
    const supabase = getSupabaseAdmin();

    // Get default commission
    const { data: settingData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "default_commission_pct")
      .single();

    const defaultCommPct = settingData ? parseFloat(settingData.value) : 70;

    const computedTotal =
      sale.totalAmount ??
      sale.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert([
        {
          client_id: parseInt(sale.clientId),
          appointment_id: sale.appointmentId
            ? parseInt(sale.appointmentId)
            : null,
          professional_id: sale.items[0]?.professionalId || null, // Primary professional
          total_amount: computedTotal,
          status: sale.status || "pending",
          notes: sale.notes || null,
        },
      ])
      .select("*")
      .single();

    if (saleErr) {
      return { success: false, error: parseSupabaseError(saleErr).description };
    }

    if (sale.items.length) {
      // Process items with commissions
      const itemsPayload = await Promise.all(
        sale.items.map(async (it) => {
          let commPct = it.commissionPct;

          // 1. Check Service Variant for override
          if (commPct === undefined) {
            const { data: variantData } = await supabase
              .from("service_variants")
              .select("commission_pct")
              .eq("id", parseInt(it.serviceVariantId))
              .single();

            if (variantData?.commission_pct != null) {
              const parsed = parseFloat(String(variantData.commission_pct));
              if (!isNaN(parsed)) commPct = parsed;
            }
          }

          // 2. Check Professional for override
          if (commPct === undefined && it.professionalId) {
            const { data: profData } = await supabase
              .from("professionals")
              .select("commission_pct")
              .eq("user_id", it.professionalId)
              .single();

            if (profData?.commission_pct != null) {
              const parsed = parseFloat(String(profData.commission_pct));
              if (!isNaN(parsed)) commPct = parsed;
            }
          }

          // 3. Fallback to Global Default
          if (commPct === undefined) {
            commPct = defaultCommPct;
          }

          const subtotal = it.quantity * it.unitPrice;
          const commAmount = (subtotal * commPct) / 100;

          return {
            sale_id: saleRow.id,
            service_variant_id: parseInt(it.serviceVariantId),
            quantity: it.quantity,
            unit_price: it.unitPrice,
            professional_id: it.professionalId || null,
            commission_pct: commPct,
            commission_amount: commAmount,
          };
        }),
      );

      const { error: itemsErr } = await supabase
        .from("sale_items")
        .insert(itemsPayload);
      if (itemsErr) {
        return {
          success: false,
          error:
            "Falha ao registrar itens da venda: " +
            parseSupabaseError(itemsErr).description,
        };
      }
    }

    // Re-fetch to get items and joined data
    const { data: finalSale } = await supabase
      .from("sales")
      .select(
        `*, client:clients(full_name), professional:professionals!sales_professional_id_fkey(full_name), items:sale_items(*, professional:professionals(full_name), variant:service_variants(variant_name, service:services(name))), payments(*)`,
      )
      .eq("id", saleRow.id)
      .single();

    revalidatePath("/financeiro");
    revalidatePath("/relatorios");
    return { success: true, data: supabaseSaleToSale(finalSale || saleRow) };
  } catch (error: any) {
    console.error("Error in createSaleAction:", error);
    return { success: false, error: "Falha ao criar venda." };
  }
}

/**
 * Helper to check if a sale is fully paid and update its status.
 * Now also updates related appointments to 'completed'.
 */
async function syncSaleStatus(supabase: any, saleId: number) {
  // Fetch fresh data including payments
  const { data: sale } = await supabase
    .from("sales")
    .select("total_amount, appointment_id, payments(amount, status)")
    .eq("id", saleId)
    .single();

  if (!sale) return;

  // Use lowercase 'paid' to match database enum values
  const totalPaid = (sale.payments || [])
    .filter((p: any) => p.status === "paid")
    .reduce((acc: number, p: any) => acc + Number(p.amount), 0);

  // Consider it paid if totalPaid meets or exceeds total_amount
  const newStatus = totalPaid >= Number(sale.total_amount) ? "paid" : "pending";

  await supabase
    .from("sales")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", saleId);

  // Issue A & B Fix: Sync appointment status
  if (sale.appointment_id && newStatus === "paid") {
    await supabase
      .from("appointments")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sale.appointment_id);
  }
}

/**
 * Updates a sale status.
 */
export async function updateSaleStatusAction(
  id: string,
  status: SaleStatus,
  updates?: Partial<Sale>,
) {
  try {
    const supabase = getSupabaseAdmin();
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (updates?.notes !== undefined) updateData.notes = updates.notes || null;

    const { data, error } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", parseInt(id))
      .select(
        `*, client:clients(full_name), professional:professionals!sales_professional_id_fkey(full_name), items:sale_items(*, professional:professionals(full_name), variant:service_variants(variant_name, service:services(name))), payments(*)`,
      )
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    // If sale is cancelled, cancel/refund all associated payments
    if (status === SaleStatus.CANCELLED) {
      await supabase
        .from("payments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("sale_id", parseInt(id));
    }

    revalidatePath("/financeiro");
    revalidatePath("/relatorios");
    return { success: true, data: supabaseSaleToSale(data) };
  } catch (error: any) {
    console.error("Error in updateSaleStatusAction:", error);
    return { success: false, error: "Falha ao atualizar status da venda." };
  }
}

/**
 * Creates a new payment.
 */
export async function createPaymentAction(payment: Omit<Payment, "id">) {
  try {
    const supabase = getSupabaseAdmin();
    const payload: any = {
      sale_id: parseInt(String(payment.saleId), 10),
      amount: Number(payment.amount),
      payment_method:
        payment.status === PaymentStatus.PENDING
          ? null
          : (payment.paymentMethod ?? null),
      external_transaction_id: payment.externalTransactionId ?? null,
      payment_link_url: payment.linkUrl ?? null,
      status: payment.status as PaymentStatus,
      paid_at:
        payment.status === PaymentStatus.PAID
          ? (payment.paidAt ?? new Date().toISOString())
          : null,
      professional_id: payment.professionalId || null,
    };

    const { data, error } = await supabase
      .from("payments")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    // Update parent sale status if needed
    await syncSaleStatus(supabase, payload.sale_id);

    revalidatePath("/financeiro");
    revalidatePath("/relatorios");
    return { success: true, data: supabasePaymentToPayment(data) };
  } catch (error: any) {
    console.error("Error in createPaymentAction:", error);
    return { success: false, error: "Falha ao registrar pagamento." };
  }
}

/**
 * Updates a payment status.
 */
export async function updatePaymentStatusAction(
  id: string,
  status: PaymentStatus,
) {
  try {
    const supabase = getSupabaseAdmin();
    const patch: any = { status, updated_at: new Date().toISOString() };
    if (status === PaymentStatus.CANCELLED) {
      patch.payment_link_url = null;
    }

    const { data, error } = await supabase
      .from("payments")
      .update(patch)
      .eq("id", parseInt(id))
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    // Update parent sale status if needed
    await syncSaleStatus(supabase, data.sale_id);

    revalidatePath("/financeiro");
    revalidatePath("/relatorios");
    return { success: true, data: supabasePaymentToPayment(data) };
  } catch (error: any) {
    console.error("Error in updatePaymentStatusAction:", error);
    return { success: false, error: "Falha ao atualizar status do pagamento." };
  }
}

/**
 * Updates a sale's generic data (total, notes, status, etc).
 */
export async function updateSaleAction(id: string, updates: Partial<Sale>) {
  try {
    const supabase = getSupabaseAdmin();
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.totalAmount !== undefined)
      payload.total_amount = updates.totalAmount;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.status !== undefined) payload.status = updates.status;

    const { data, error } = await supabase
      .from("sales")
      .update(payload)
      .eq("id", parseInt(id))
      .select(
        `*, client:clients(full_name), professional:professionals!sales_professional_id_fkey(full_name), items:sale_items(*, professional:professionals(full_name), variant:service_variants(variant_name, service:services(name))), payments(*)`,
      )
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/financeiro");
    revalidatePath("/relatorios");
    return { success: true, data: supabaseSaleToSale(data) };
  } catch (error: any) {
    console.error("Error in updateSaleAction:", error);
    return { success: false, error: "Falha ao atualizar venda." };
  }
}

/**
 * Process a manual payment from physical POS (Issue C, D, Fatal Flaw).
 * Resolves Rule 2 (Commission Tracking) by ensuring professional_id is persisted.
 */
export async function processManualPaymentAction(
  saleId: number,
  paymentMethod: string,
  amount: number,
  professionalId?: string,
) {
  try {
    const supabase = getSupabaseAdmin();

    // Rule 2 Fix: Resolve professional_id from the sale if not provided
    // This ensures commission tracking is maintained even if manual payment is registered without explicit prof ID
    let resolvedProfId = professionalId;
    if (!resolvedProfId) {
      const { data: saleRow } = await supabase
        .from("sales")
        .select("professional_id")
        .eq("id", saleId)
        .single();
      resolvedProfId = saleRow?.professional_id;
    }

    // Issue D: Track WHO got paid and WHEN
    const payload: any = {
      sale_id: saleId,
      amount: amount,
      payment_method: paymentMethod,
      status: "paid",
      paid_at: new Date().toISOString(),
      professional_id: resolvedProfId || null,
    };

    const { error } = await supabase.from("payments").insert([payload]);

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    // Fatal Flaw: Sum all successful payments and conditionally update status
    await syncSaleStatus(supabase, saleId);

    // Fetch fresh sale data to determine if fully paid
    const { data: freshSale } = await supabase
      .from("sales")
      .select("status")
      .eq("id", saleId)
      .single();

    revalidatePath("/financeiro");
    revalidatePath("/agenda");
    revalidatePath("/relatorios");

    return {
      success: true,
      isFullyPaid: freshSale?.status === "paid",
    };
  } catch (error: any) {
    console.error("Error in processManualPaymentAction:", error);
    return { success: false, error: "Falha ao processar pagamento." };
  }
}
