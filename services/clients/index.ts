import { supabase } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/supabase/utils";
import { supabaseClientToClient } from "@/lib/utils";
import { parseSupabaseError } from "@/lib/error-handler";
import { Client, SupabaseClient } from "@/types";

/**
 * Fetches the count of clients grouped by referral source.
 * Note: Modern reports calculate this locally from the shared data context.
 */
export async function getReferralSourceCounts(): Promise<{
  [key: string]: number;
}> {
  try {
    const { data: options } = await supabase
      .from("app_options")
      .select("value")
      .eq("option_type", "referral_source");

    const validSources = (options || []).map((o) => o.value);

    const data = await fetchAll<{ referral_source: string | null }>(
      ({ from, to }) =>
        supabase.from("clients").select("referral_source").range(from, to),
    );

    const counts: { [key: string]: number } = {};
    data.forEach((client) => {
      if (client.referral_source) {
        counts[client.referral_source] =
          (counts[client.referral_source] || 0) + 1;
      }
    });
    return counts;
  } catch (error: any) {
    console.error("Error in getReferralSourceCounts:", error);
    throw new Error(parseSupabaseError(error).description);
  }
}

/**
 * Fetches clients with a search term, pagination, and active/inactive filter.
 */
export async function getClients(
  searchTerm: string = "",
  pageNumber: number = 1,
  pageSize: number = 10,
  isActive: boolean = true,
): Promise<Client[]> {
  try {
    const { data, error } = await supabase.rpc("get_clients_with_total_spent", {
      search_term: searchTerm,
      page_number: pageNumber,
      page_size: pageSize,
      filter_is_active: isActive,
    });
    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }
    return (data || []).map(supabaseClientToClient);
  } catch (error) {
    console.error("Error in getClients:", error);
    throw error;
  }
}

/**
 * Fetches all active clients.
 */
export async function getActiveClients(): Promise<Client[]> {
  try {
    const data = await fetchAll<SupabaseClient & { total_spent?: number }>(
      ({ from, to }) =>
        supabase
          .from("clients")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .range(from, to),
    );
    return data.map(supabaseClientToClient);
  } catch (error: any) {
    console.error("Error in getActiveClients:", error);
    throw new Error(parseSupabaseError(error).description);
  }
}

/**
 * Fetches a single client by ID.
 */
export async function getClientById(id: string): Promise<Client | null> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", parseInt(id))
      .single();

    if (error) {
      if ((error as any)?.code === "PGRST116") return null;
      throw new Error(parseSupabaseError(error).description);
    }
    if (!data) return null;
    return supabaseClientToClient(data);
  } catch (error) {
    console.error("Error in getClientById:", error);
    throw error;
  }
}

/**
 * Fetches all inactive clients.
 */
export async function getInactiveClients(): Promise<Client[]> {
  try {
    const data = await fetchAll<SupabaseClient & { total_spent?: number }>(
      ({ from, to }) =>
        supabase
          .from("clients")
          .select("*")
          .eq("is_active", false)
          .order("created_at", { ascending: false })
          .range(from, to),
    );
    return data.map(supabaseClientToClient);
  } catch (error: any) {
    console.error("Error in getInactiveClients:", error);
    throw new Error(parseSupabaseError(error).description);
  }
}

/**
 * Searches clients by name, phone, or email.
 */
export async function searchClients(query: string): Promise<Client[]> {
  try {
    const q = `%${query}%`;
    const data = await fetchAll<SupabaseClient & { total_spent?: number }>(
      ({ from, to }) =>
        supabase
          .from("clients")
          .select("*")
          .or(`full_name.ilike.${q},phone.ilike.${q},email.ilike.${q}`)
          .order("created_at", { ascending: false })
          .range(from, to),
    );
    return data.map(supabaseClientToClient);
  } catch (error: any) {
    console.error("Error in searchClients:", error);
    throw new Error(parseSupabaseError(error).description);
  }
}
