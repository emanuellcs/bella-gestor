"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { parseSupabaseError } from "@/lib/error-handler";
import { Sale, SaleStatus, Payment, PaymentStatus } from "@/types";
import { getSales } from "@/services/finance";

type NewSale = Omit<Sale, "id" | "payments" | "created_at" | "updatedAt" | "clientName" | "totalAmount"> & {
  totalAmount?: number;
};

/**
 * Creates a new sale and its items.
 */
export async function createSaleAction(sale: NewSale) {
  try {
    const supabase = getSupabaseServer();
    const computedTotal =
      sale.totalAmount ?? sale.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert([
        {
          client_id: parseInt(sale.clientId),
          appointment_id: sale.appointmentId ? parseInt(sale.appointmentId) : null,
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
      const itemsPayload = sale.items.map((it) => ({
        sale_id: saleRow.id,
        service_variant_id: parseInt(it.serviceVariantId),
        quantity: it.quantity,
        unit_price: it.unitPrice,
      }));
      await supabase.from("sale_items").insert(itemsPayload);
    }

    revalidatePath("/financeiro");
    return { success: true, data: saleRow };
  } catch (error: any) {
    console.error("Error in createSaleAction:", error);
    return { success: false, error: "Falha ao criar venda." };
  }
}

/**
 * Updates a sale status.
 */
export async function updateSaleStatusAction(id: string, status: SaleStatus, updates?: Partial<Sale>) {
  try {
    const supabase = getSupabaseServer();
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (updates?.notes !== undefined) updateData.notes = updates.notes || null;

    const { data, error } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", parseInt(id))
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/financeiro");
    return { success: true, data };
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
    const supabase = getSupabaseServer();
    const payload: any = {
      sale_id: parseInt(String(payment.saleId), 10),
      amount: Number(payment.amount),
      payment_method:
        payment.status === PaymentStatus.PENDING ? null : (payment.paymentMethod ?? null),
      external_transaction_id: payment.externalTransactionId ?? null,
      payment_link_url: payment.linkUrl ?? null,
      status: payment.status as PaymentStatus,
      paid_at:
        payment.status === PaymentStatus.PAID
          ? payment.paidAt ?? new Date().toISOString()
          : null,
    };

    const { data, error } = await supabase
      .from("payments")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/financeiro");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in createPaymentAction:", error);
    return { success: false, error: "Falha ao registrar pagamento." };
  }
}

/**
 * Updates a payment status.
 */
export async function updatePaymentStatusAction(id: string, status: PaymentStatus) {
  try {
    const supabase = getSupabaseServer();
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

    revalidatePath("/financeiro");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in updatePaymentStatusAction:", error);
    return { success: false, error: "Falha ao atualizar status do pagamento." };
  }
}
