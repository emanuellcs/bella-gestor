import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Service, ServiceVariant } from "@/types";

/**
 * Fetches all services.
 */
export async function getServices(): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map(
      (s: any): Service => ({
        id: s.id.toString(),
        name: s.name,
        description: s.description || "",
        category: s.category || "",
        active: !!s.is_active,
        created_at: s.created_at,
        updatedAt: s.updated_at || undefined,
      }),
    );
  } catch (error) {
    console.error("Error in getServices:", error);
    throw error;
  }
}

/**
 * Fetches service variants by service ID.
 */
export async function getServiceVariantsByServiceId(
  serviceId: string,
): Promise<ServiceVariant[]> {
  try {
    const { data, error } = await supabase
      .from("service_variants")
      .select("*")
      .eq("service_id", parseInt(serviceId))
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map(
      (v: any): ServiceVariant => ({
        id: v.id.toString(),
        serviceId: v.service_id.toString(),
        variantName: v.variant_name,
        price: parseFloat(v.price),
        duration: v.duration_minutes,
        active: !!v.is_active,
        commissionPct:
          v.commission_pct !== null ? parseFloat(v.commission_pct) : undefined,
        created_at: v.created_at,
        updatedAt: v.updated_at || undefined,
      }),
    );
  } catch (error) {
    console.error(
      `Error in getServiceVariantsByServiceId for service ${serviceId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Fetches all service variants.
 */
export async function getServiceVariants(): Promise<ServiceVariant[]> {
  try {
    const { data, error } = await supabase
      .from("service_variants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map(
      (v: any): ServiceVariant => ({
        id: v.id.toString(),
        serviceId: v.service_id.toString(),
        variantName: v.variant_name,
        price: parseFloat(v.price),
        duration: v.duration_minutes,
        active: !!v.is_active,
        commissionPct:
          v.commission_pct !== null ? parseFloat(v.commission_pct) : undefined,
        created_at: v.created_at,
        updatedAt: v.updated_at || undefined,
      }),
    );
  } catch (error) {
    console.error("Error in getServiceVariants:", error);
    throw error;
  }
}

/**
 * Fetches only active services with their active variants.
 */
export async function getActiveServices(): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select(
        `
        id,
        name,
        description,
        category,
        is_active,
        created_at,
        updated_at,
        service_variants (
          id,
          service_id,
          variant_name,
          price,
          duration_minutes,
          is_active,
          commission_pct,
          created_at,
          updated_at
        )
      `,
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    if (!data) return [];

    const services: Service[] = data.map((s: any) => ({
      id: s.id.toString(),
      name: s.name,
      description: s.description || "",
      category: s.category || "",
      active: !!s.is_active,
      created_at: s.created_at,
      updatedAt: s.updated_at || undefined,
      variants: (s.service_variants || [])
        .map(
          (v: any): ServiceVariant => ({
            id: v.id.toString(),
            serviceId: v.service_id.toString(),
            variantName: v.variant_name,
            price: parseFloat(v.price),
            duration: v.duration_minutes,
            active: !!v.is_active,
            commissionPct:
              v.commission_pct !== null
                ? parseFloat(v.commission_pct)
                : undefined,
            created_at: v.created_at,
            updatedAt: v.updated_at || undefined,
          }),
        )
        .filter((variant: ServiceVariant) => variant.active),
    }));

    return services.filter((s) => s.variants && s.variants.length > 0);
  } catch (error) {
    console.error("Error in getActiveServices:", error);
    throw error;
  }
}
