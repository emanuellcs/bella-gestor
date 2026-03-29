"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";
import { Service, ServiceVariant } from "@/types";
import { getServiceVariantsByServiceId } from "@/services/services";
import {
  supabaseServiceToService,
  supabaseVariantToVariant,
} from "@/lib/utils/mapping";

/**
 * Creates a new service with optional variants.
 */
export async function createServiceAction(
  service: Omit<Service, "id" | "created_at" | "updatedAt"> & {
    variants?: Omit<
      ServiceVariant,
      "id" | "serviceId" | "created_at" | "updatedAt"
    >[];
  },
) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = {
      name: service.name,
      description: service.description || null,
      category: service.category || null,
      is_active: service.active ?? true,
    };

    const { data, error } = await supabase
      .from("services")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    const createdServiceId = data.id;

    if (service.variants && service.variants.length > 0) {
      const variantsPayload = service.variants.map((variant) => ({
        service_id: createdServiceId,
        variant_name: variant.variantName,
        price: variant.price,
        duration_minutes: variant.duration,
        is_active: variant.active ?? true,
      }));

      const { error: variantsError } = await supabase
        .from("service_variants")
        .insert(variantsPayload);

      if (variantsError) {
        return {
          success: true,
          data: supabaseServiceToService(data),
          warning: `Serviço criado, mas falha ao criar variantes: ${parseSupabaseError(variantsError).description}`,
        };
      }
    }

    revalidatePath("/servicos");
    return { success: true, data: supabaseServiceToService(data) };
  } catch (error: any) {
    console.error("Error in createServiceAction:", error);
    return { success: false, error: "Falha ao criar serviço." };
  }
}

/**
 * Updates an existing service and its variants.
 */
export async function updateServiceAction(
  id: string,
  service: Partial<Service> & { variants?: ServiceVariant[] },
) {
  try {
    const supabase = getSupabaseAdmin();
    const serviceIdNum = parseInt(id);
    const payload: any = {
      ...(service.name !== undefined ? { name: service.name } : {}),
      ...(service.description !== undefined
        ? { description: service.description }
        : {}),
      ...(service.category !== undefined ? { category: service.category } : {}),
      ...(service.active !== undefined ? { is_active: service.active } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", serviceIdNum)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    if (service.variants !== undefined) {
      const existingVariants = await getServiceVariantsByServiceId(id);
      const incomingVariants = service.variants;

      const variantsToCreate = incomingVariants.filter((v) => !v.id);
      const variantsToUpdate = incomingVariants.filter((v) => v.id);
      const variantsToDelete = existingVariants.filter(
        (ev) => !incomingVariants.some((iv) => iv.id === ev.id),
      );

      if (variantsToCreate.length > 0) {
        const createPayload = variantsToCreate.map((variant) => ({
          service_id: serviceIdNum,
          variant_name: variant.variantName,
          price: variant.price,
          duration_minutes: variant.duration,
          is_active: variant.active ?? true,
        }));
        await supabase.from("service_variants").insert(createPayload);
      }

      for (const variant of variantsToUpdate) {
        const updatePayload: any = {
          ...(variant.variantName !== undefined
            ? { variant_name: variant.variantName }
            : {}),
          ...(variant.price !== undefined ? { price: variant.price } : {}),
          ...(variant.duration !== undefined
            ? { duration_minutes: variant.duration }
            : {}),
          ...(variant.active !== undefined
            ? { is_active: variant.active }
            : {}),
          updated_at: new Date().toISOString(),
        };
        await supabase
          .from("service_variants")
          .update(updatePayload)
          .eq("id", parseInt(variant.id));
      }

      if (variantsToDelete.length > 0) {
        const deleteIds = variantsToDelete.map((v) => parseInt(v.id));
        await supabase.from("service_variants").delete().in("id", deleteIds);
      }
    }

    revalidatePath("/servicos");
    return { success: true, data: supabaseServiceToService(data) };
  } catch (error: any) {
    console.error("Error in updateServiceAction:", error);
    return { success: false, error: "Falha ao atualizar serviço." };
  }
}

/**
 * Deletes a service.
 */
export async function deleteServiceAction(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/servicos");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteServiceAction:", error);
    return { success: false, error: "Falha ao excluir serviço." };
  }
}

/**
 * Creates a new service variant.
 */
export async function createServiceVariantAction(
  variant: Omit<ServiceVariant, "id" | "created_at" | "updatedAt">,
) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = {
      service_id: parseInt(variant.serviceId),
      variant_name: variant.variantName,
      price: variant.price,
      duration_minutes: variant.duration,
      is_active: variant.active ?? true,
    };

    const { data, error } = await supabase
      .from("service_variants")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/servicos");
    return { success: true, data: supabaseVariantToVariant(data) };
  } catch (error: any) {
    console.error("Error in createServiceVariantAction:", error);
    return { success: false, error: "Falha ao criar variante de serviço." };
  }
}

/**
 * Updates a service variant.
 */
export async function updateServiceVariantAction(
  id: string,
  variant: Partial<ServiceVariant>,
) {
  try {
    const supabase = getSupabaseAdmin();
    const payload: any = {
      ...(variant.serviceId !== undefined
        ? { service_id: parseInt(variant.serviceId) }
        : {}),
      ...(variant.variantName !== undefined
        ? { variant_name: variant.variantName }
        : {}),
      ...(variant.price !== undefined ? { price: variant.price } : {}),
      ...(variant.duration !== undefined
        ? { duration_minutes: variant.duration }
        : {}),
      ...(variant.active !== undefined ? { is_active: variant.active } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("service_variants")
      .update(payload)
      .eq("id", parseInt(id))
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/servicos");
    return { success: true, data: supabaseVariantToVariant(data) };
  } catch (error: any) {
    console.error("Error in updateServiceVariantAction:", error);
    return { success: false, error: "Falha ao atualizar variante de serviço." };
  }
}

/**
 * Deletes a service variant.
 */
export async function deleteServiceVariantAction(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("service_variants")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/servicos");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteServiceVariantAction:", error);
    return { success: false, error: "Falha ao excluir variante de serviço." };
  }
}
