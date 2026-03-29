import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Sale, Payment } from "@/types";
import {
  supabaseSaleToSale,
  supabasePaymentToPayment,
} from "@/lib/utils/mapping";

/**
 * Fetches sales within a date range (default last 6 months).
 */
export async function getSales(
  startDate?: string,
  endDate?: string,
): Promise<Sale[]> {
  try {
    let query = supabase
      .from("sales")
      .select(
        `
        *,
        client:clients (full_name),
        professional:professionals!sales_professional_id_fkey (full_name),
        items:sale_items (
          *,
          professional:professionals (full_name),
          variant:service_variants (
            variant_name,
            service:services (name)
          )
        ),
        payments (*)
      `,
      )
      .order("created_at", { ascending: false });

    if (startDate) {
      query = query.gte("created_at", startDate);
    } else {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      query = query.gte("created_at", sixMonthsAgo.toISOString());
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((s: any) => supabaseSaleToSale(s));
  } catch (error) {
    console.error("Error in getSales:", error);
    throw error;
  }
}

/**
 * Fetches payments within a date range.
 */
export async function getPayments(
  startDate?: string,
  endDate?: string,
): Promise<Payment[]> {
  try {
    let query = supabase
      .from("payments")
      .select(
        `
        *,
        professional:professionals (full_name),
        sale:sales (
          client_id,
          client:clients (full_name),
          items:sale_items (
            service_variant_id,
            variant:service_variants (
              variant_name,
              service:services (name)
            )
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, error } = await query;

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((p: any) => supabasePaymentToPayment(p));
  } catch (error) {
    console.error("Error in getPayments:", error);
    throw error;
  }
}
