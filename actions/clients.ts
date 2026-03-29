"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { clientToSupabaseClient, supabaseClientToClient } from "@/lib/utils";
import { parseSupabaseError } from "@/lib/error-handler";
import { Client } from "@/types";

/**
 * Creates a new client.
 */
export async function createClientAction(
  client: Omit<Client, "id" | "registrationDate" | "status" | "totalSpent">,
) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = clientToSupabaseClient(client);

    const { data, error } = await supabase
      .from("clients")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/clientes");
    return { success: true, data: supabaseClientToClient(data) };
  } catch (error: any) {
    console.error("Error in createClientAction:", error);
    return { success: false, error: "Falha ao criar cliente." };
  }
}

/**
 * Updates an existing client.
 */
export async function updateClientAction(id: string, client: Partial<Client>) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = clientToSupabaseClient(client);

    const { data, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", parseInt(id))
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/clientes");
    return { success: true, data: supabaseClientToClient(data) };
  } catch (error: any) {
    console.error("Error in updateClientAction:", error);
    return { success: false, error: "Falha ao atualizar cliente." };
  }
}

/**
 * Deactivates a client.
 */
export async function deactivateClientAction(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("clients")
      .update({ is_active: false })
      .eq("id", parseInt(id));

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/clientes");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deactivateClientAction:", error);
    return { success: false, error: "Falha ao desativar cliente." };
  }
}

/**
 * Reactivates a client.
 */
export async function reactivateClientAction(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("clients")
      .update({ is_active: true })
      .eq("id", parseInt(id));

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/clientes");
    return { success: true };
  } catch (error: any) {
    console.error("Error in reactivateClientAction:", error);
    return { success: false, error: "Falha ao reativar cliente." };
  }
}
