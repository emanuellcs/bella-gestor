import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Professional } from "@/types";
import { supabaseProfessionalToProfessional } from "@/lib/utils/mapping";

/**
 * Fetches all professionals.
 */
export async function getProfessionals(): Promise<Professional[]> {
  try {
    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map(supabaseProfessionalToProfessional);
  } catch (error) {
    console.error("Error in getProfessionals:", error);
    throw error;
  }
}
