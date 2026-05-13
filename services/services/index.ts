import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Service, ServiceVariant } from "@/types";
import type { SupabaseService, SupabaseServiceVariant } from "@/types/db";
import { supabaseVariantToVariant } from "@/lib/utils/mapping";

type ServiceWithVariants = SupabaseService & {
  service_variants?: SupabaseServiceVariant[];
};

function mapVariant(v: SupabaseServiceVariant): ServiceVariant {
  return supabaseVariantToVariant(v);
}

function mapService(
  service: ServiceWithVariants,
  onlyActiveVariants = false,
): Service {
  const variants = (service.service_variants || [])
    .filter((variant) => !variant.deleted_at)
    .map(mapVariant)
    .filter((variant) => !onlyActiveVariants || variant.active);

  return {
    id: service.id.toString(),
    name: service.name,
    description: service.description || "",
    category: service.category || "",
    active: !!service.is_active,
    created_at: service.created_at,
    updatedAt: service.updated_at || undefined,
    variants,
  };
}

/**
 * Fetches all services.
 */
export async function getServices(): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*, service_variants(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return ((data as ServiceWithVariants[] | null) || []).map((service) =>
      mapService(service),
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
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return ((data as SupabaseServiceVariant[] | null) || []).map(mapVariant);
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
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return ((data as SupabaseServiceVariant[] | null) || []).map(mapVariant);
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
          updated_at,
          deleted_at
        )
      `,
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    if (!data) return [];

    const services = (data as ServiceWithVariants[]).map((service) =>
      mapService(service, true),
    );

    return services.filter((s) => s.variants && s.variants.length > 0);
  } catch (error) {
    console.error("Error in getActiveServices:", error);
    throw error;
  }
}
