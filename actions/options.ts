"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";

import { supabaseAppOptionToAppOption } from "@/lib/utils/mapping";

export async function getAppOptionsAction() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_options")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) throw new Error(parseSupabaseError(error).description);
    return {
      success: true,
      data: (data || []).map(supabaseAppOptionToAppOption),
    };
  } catch (error: any) {
    console.error("Error in getAppOptionsAction:", error);
    return { success: false, error: error.message };
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
    let result;

    if (option.id) {
      // Update existing
      result = await supabase
        .from("app_options")
        .update(option)
        .eq("id", option.id)
        .select("*")
        .single();
    } else {
      // Insert new - remove id if it's undefined/null to let database generate it
      const { id, ...payload } = option;
      result = await supabase
        .from("app_options")
        .insert([payload])
        .select("*")
        .single();
    }

    const { data, error } = result;

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/configuracoes");
    return { success: true, data: supabaseAppOptionToAppOption(data) };
  } catch (error: any) {
    console.error("Error in upsertAppOptionAction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteAppOptionAction(id: number) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("app_options").delete().eq("id", id);

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteAppOptionAction:", error);
    return { success: false, error: error.message };
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
        .eq("id", opt.id),
    );

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;

    if (firstError) throw new Error(parseSupabaseError(firstError).description);

    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateAppOptionsOrderAction:", error);
    return { success: false, error: error.message };
  }
}

export async function getAppSettingsAction() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("app_settings").select("*");

    if (error) throw new Error(parseSupabaseError(error).description);

    const settings: Record<string, string> = {};
    (data || []).forEach((s) => {
      settings[s.key] = s.value;
    });

    return { success: true, data: settings };
  } catch (error: any) {
    console.error("Error in getAppSettingsAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateAppSettingAction(key: string, value: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("app_settings")
      .upsert([{ key, value, updated_at: new Date().toISOString() }]);

    if (error) throw new Error(parseSupabaseError(error).description);
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateAppSettingAction:", error);
    return { success: false, error: error.message };
  }
}
