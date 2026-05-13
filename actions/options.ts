"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";

import { supabaseAppOptionToAppOption } from "@/lib/utils/mapping";
import {
  appOptionInputSchema,
  appSettingSchema,
} from "@/lib/validation/schemas";

export async function getAppOptionsAction() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_options")
      .select("*")
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    if (error) throw new Error(parseSupabaseError(error).description);
    return {
      success: true,
      data: (data || []).map(supabaseAppOptionToAppOption),
    };
  } catch (error: unknown) {
    console.error("Error in getAppOptionsAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha ao listar opções.",
    };
  }
}

export async function upsertAppOptionAction(option: {
  id?: number;
  option_type: string;
  label: string;
  value: string;
  is_active?: boolean;
  display_order?: number;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedOption = appOptionInputSchema.parse(option);
    let result;

    if (parsedOption.id) {
      // Update existing
      result = await supabase
        .from("app_options")
        .update(parsedOption)
        .eq("id", parsedOption.id)
        .is("deleted_at", null)
        .select("*")
        .single();
    } else {
      // Insert new - remove id if it's undefined/null to let database generate it
      result = await supabase
        .from("app_options")
        .insert([
          {
            option_type: parsedOption.option_type,
            label: parsedOption.label,
            value: parsedOption.value,
            is_active: parsedOption.is_active,
            display_order: parsedOption.display_order,
          },
        ])
        .select("*")
        .single();
    }

    const { data, error } = result;

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/configuracoes");
    return { success: true, data: supabaseAppOptionToAppOption(data) };
  } catch (error: unknown) {
    console.error("Error in upsertAppOptionAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha ao salvar opção.",
    };
  }
}

export async function deleteAppOptionAction(id: number) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("app_options")
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in deleteAppOptionAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Falha ao excluir opção.",
    };
  }
}

export async function updateAppOptionsOrderAction(
  options: { id: number; display_order: number }[],
) {
  try {
    const supabase = getSupabaseAdmin();

    // Perform individual updates to avoid "cannot insert a non-DEFAULT value into column 'id'"
    // which happens with upsert on GENERATED ALWAYS AS IDENTITY columns.
    const updates = options.map((opt) =>
      supabase
        .from("app_options")
        .update({ display_order: opt.display_order })
        .eq("id", opt.id)
        .is("deleted_at", null),
    );

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;

    if (firstError) throw new Error(parseSupabaseError(firstError).description);

    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in updateAppOptionsOrderAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Falha ao ordenar opções.",
    };
  }
}

export async function getAppSettingsAction() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .is("deleted_at", null);

    if (error) throw new Error(parseSupabaseError(error).description);

    const settings: Record<string, string> = {};
    (data || []).forEach((s) => {
      settings[s.key] = s.value;
    });

    return { success: true, data: settings };
  } catch (error: unknown) {
    console.error("Error in getAppSettingsAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Falha ao carregar configurações.",
    };
  }
}

export async function updateAppSettingAction(key: string, value: string) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedSetting = appSettingSchema.parse({ key, value });
    const { error } = await supabase.from("app_settings").upsert([
      {
        key: parsedSetting.key,
        value: parsedSetting.value,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in updateAppSettingAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Falha ao salvar configuração.",
    };
  }
}
