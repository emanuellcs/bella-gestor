"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";
import { Professional } from "@/types";
import type { SupabaseProfessional } from "@/types/db";
import { professionalInputSchema } from "@/lib/validation/schemas";

export async function createProfessionalAction(
  professional: Omit<Professional, "id" | "created_at">,
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedProfessional = professionalInputSchema.parse(professional);
    const { data, error } = await supabase
      .from("professionals")
      .insert([
        {
          full_name: parsedProfessional.name ?? professional.name,
          email: parsedProfessional.email ?? professional.email,
          function_title:
            parsedProfessional.functionTitle ?? professional.functionTitle,
          role: parsedProfessional.role ?? professional.role,
          commission_pct:
            parsedProfessional.commissionPct ?? professional.commissionPct,
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
  } catch (error: unknown) {
    console.error("Error in createProfessionalAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Falha ao criar profissional.",
    };
  }
}

export async function updateProfessionalAction(
  id: string,
  professional: Partial<Professional>,
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedProfessional = professionalInputSchema.parse(professional);
    const payload: Partial<SupabaseProfessional> = {};
    if (parsedProfessional.name !== undefined)
      payload.full_name = parsedProfessional.name;
    if (parsedProfessional.email !== undefined)
      payload.email = parsedProfessional.email;
    if (parsedProfessional.functionTitle !== undefined)
      payload.function_title = parsedProfessional.functionTitle;
    if (parsedProfessional.role !== undefined)
      payload.role = parsedProfessional.role;
    if (parsedProfessional.commissionPct !== undefined)
      payload.commission_pct = parsedProfessional.commissionPct;

    const { data, error } = await supabase
      .from("professionals")
      .update(payload)
      .eq("user_id", id)
      .is("deleted_at", null)
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
  } catch (error: unknown) {
    console.error("Error in updateProfessionalAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Falha ao atualizar profissional.",
    };
  }
}

export async function deleteProfessionalAction(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("professionals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", id)
      .is("deleted_at", null);

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/profissionais");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in deleteProfessionalAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Falha ao excluir profissional.",
    };
  }
}
