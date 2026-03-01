import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Professional, AppRole } from "@/types";

/**
 * Fetches all professionals (users with role 'Professional').
 */
export async function getProfessionals(): Promise<Professional[]> {
  try {
    const { data, error } = await supabase
      .from("professionals")
      .select("user_id, role, email, full_name, function_title")
      .eq("role", AppRole.PROFESSIONAL)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    if (!data) return [];

    return (data as any[]).map((r) => ({
      id: r.user_id as string,
      email: r.email ?? undefined,
      fullName: r.full_name ?? undefined,
      functionTitle: r.function_title ?? undefined,
      role: r.role as AppRole,
    }));
  } catch (error) {
    console.error("Error in getProfessionals:", error);
    throw error;
  }
}
