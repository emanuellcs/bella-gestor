import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Sale, Payment } from "@/types";

/**
 * Fetches sales within the last 6 months.
 */
export async function getSales(): Promise<Sale[]> {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data, error } = await supabase
      .from("sales")
      .select(`
        *,
        clients (full_name),
        sale_items (
          *,
          service_variants (
            variant_name,
            services (name)
          )
        ),
        payments (*)
      `)
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((s: any) => ({
      id: s.id.toString(),
      clientId: s.client_id.toString(),
      clientName: s.clients?.full_name || "",
      appointmentId: s.appointment_id ? s.appointment_id.toString() : undefined,
      items: (s.sale_items || []).map((it: any) => ({
        id: it.id.toString(),
        serviceVariantId: it.service_variant_id.toString(),
        serviceName: it.service_variants?.services?.name || "",
        serviceVariantName: it.service_variants?.variant_name || "",
        quantity: it.quantity,
        unitPrice: parseFloat(it.unit_price),
        subtotal: parseFloat(it.subtotal),
      })),
      totalAmount: parseFloat(s.total_amount),
      status: s.status,
      notes: s.notes || "",
      payments: (s.payments || []).map((p: any) => ({
        id: p.id.toString(),
        saleId: p.sale_id.toString(),
        amount: parseFloat(p.amount),
        paymentMethod: p.payment_method || undefined,
        externalTransactionId: p.external_transaction_id || undefined,
        linkUrl: p.payment_link_url || undefined,
        status: p.status,
        paidAt: p.paid_at || undefined,
        created_at: p.created_at,
        updatedAt: p.updated_at || undefined,
      })),
      created_at: s.created_at,
      updatedAt: s.updated_at || undefined,
    }));
  } catch (error) {
    console.error("Error in getSales:", error);
    throw error;
  }
}

/**
 * Fetches payments within a date range.
 */
export async function getPayments(startDate?: string, endDate?: string): Promise<Payment[]> {
  try {
    let query = supabase
      .from("payments")
      .select(`
        *,
        sales (
          client_id,
          clients (full_name),
          sale_items (
            service_variant_id,
            service_variants (
              variant_name,
              services (name)
            )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, error } = await query;

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((p: any) => {
      const sale: any = p.sales;
      const variant = sale?.sale_items?.[0]?.service_variants;
      const serviceName = variant?.services?.name;
      const clientName = sale?.clients?.full_name;

      return {
        id: p.id.toString(),
        saleId: p.sale_id.toString(),
        clientName: clientName || "",
        serviceName: serviceName || "",
        serviceVariantName: variant?.variant_name || "",
        amount: parseFloat(p.amount),
        paymentMethod: p.payment_method || undefined,
        externalTransactionId: p.external_transaction_id || undefined,
        linkUrl: p.payment_link_url || undefined,
        status: p.status,
        paidAt: p.paid_at || undefined,
        created_at: p.created_at,
        updatedAt: p.updated_at || undefined,
      };
    });
  } catch (error) {
    console.error("Error in getPayments:", error);
    throw error;
  }
}
