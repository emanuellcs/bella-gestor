"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";
import { Professional } from "@/types";

export async function createProfessionalAction(
  professional: Omit<Professional, "id" | "created_at">,
) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("professionals")
      .insert([
        {
          full_name: professional.name,
          email: professional.email,
          function_title: professional.functionTitle,
          role: professional.role,
          commission_pct: professional.commissionPct,
        },
      ])
      .select("*")
      .single();

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/profissionais");
    return {
      success: true,
      data: {
        id: data.user_id,
        name: data.full_name,
        email: data.email,
        functionTitle: data.function_title,
        role: data.role,
        commissionPct: data.commission_pct,
        created_at: data.created_at,
      } as Professional,
    };
  } catch (error: any) {
    console.error("Error in createProfessionalAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateProfessionalAction(
  id: string,
  professional: Partial<Professional>,
) {
  try {
    const supabase = getSupabaseAdmin();
    const payload: any = {};
    if (professional.name !== undefined) payload.full_name = professional.name;
    if (professional.email !== undefined) payload.email = professional.email;
    if (professional.functionTitle !== undefined)
      payload.function_title = professional.functionTitle;
    if (professional.role !== undefined) payload.role = professional.role;
    if (professional.commissionPct !== undefined)
      payload.commission_pct = professional.commissionPct;

    const { data, error } = await supabase
      .from("professionals")
      .update(payload)
      .eq("user_id", id)
      .select("*")
      .single();

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/profissionais");
    return {
      success: true,
      data: {
        id: data.user_id,
        name: data.full_name,
        email: data.email,
        functionTitle: data.function_title,
        role: data.role,
        commissionPct: data.commission_pct,
        created_at: data.created_at,
      } as Professional,
    };
  } catch (error: any) {
    console.error("Error in updateProfessionalAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteProfessionalAction(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("professionals")
      .delete()
      .eq("user_id", id);

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/profissionais");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteProfessionalAction:", error);
    return { success: false, error: error.message };
  }
}
