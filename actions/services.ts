"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";
import { Service, ServiceVariant } from "@/types";
import type { SupabaseService, SupabaseServiceVariant } from "@/types/db";
import { getServiceVariantsByServiceId } from "@/services/services";
import {
  supabaseServiceToService,
  supabaseVariantToVariant,
} from "@/lib/utils/mapping";
import {
  serviceInputSchema,
  serviceVariantInputSchema,
} from "@/lib/validation/schemas";

/**
 * Creates a new service with optional variants.
 */
export async function createServiceAction(
  service: Omit<Service, "id" | "created_at" | "updatedAt" | "variants"> & {
    variants?: Omit<
      ServiceVariant,
      "id" | "serviceId" | "created_at" | "updatedAt"
    >[];
  },
) {
  try {
    const supabase = getSupabaseAdmin();
    const parsedService = serviceInputSchema.parse(service);
    const payload = {
      name: parsedService.name ?? service.name,
      description: parsedService.description || null,
      category: parsedService.category || null,
      is_active: parsedService.active ?? true,
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

    if (parsedService.variants && parsedService.variants.length > 0) {
      const variantsPayload = parsedService.variants.map((variant) => ({
        service_id: createdServiceId,
        variant_name: variant.variantName ?? "",
        price: variant.price ?? 0,
        duration_minutes: variant.duration ?? 0,
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
  } catch (error: unknown) {
    console.error("Error in createServiceAction:", error);
    return { success: false, error: "Falha ao criar serviço." };
  }
}

/**
 * Updates an existing service and its variants.
 */
export async function updateServiceAction(
  id: string,
  service: Partial<Service> & { variants?: Partial<ServiceVariant>[] },
) {
  try {
    const supabase = getSupabaseAdmin();
    const serviceIdNum = parseInt(id);
    const parsedService = serviceInputSchema.parse(service);
    const payload: Partial<SupabaseService> = {
      ...(parsedService.name !== undefined ? { name: parsedService.name } : {}),
      ...(parsedService.description !== undefined
        ? { description: parsedService.description }
        : {}),
      ...(parsedService.category !== undefined
        ? { category: parsedService.category }
        : {}),
      ...(parsedService.active !== undefined
        ? { is_active: parsedService.active }
        : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", serviceIdNum)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    if (parsedService.variants !== undefined) {
      const existingVariants = await getServiceVariantsByServiceId(id);
      const incomingVariants = parsedService.variants;

      const variantsToCreate = incomingVariants.filter((v) => !v.id);
      const variantsToUpdate = incomingVariants.filter((v) => v.id);
      const variantsToDelete = existingVariants.filter(
        (ev) => !incomingVariants.some((iv) => iv.id === ev.id),
      );

      if (variantsToCreate.length > 0) {
        const createPayload = variantsToCreate.map((variant) => ({
          service_id: serviceIdNum,
          variant_name: variant.variantName ?? "",
          price: variant.price ?? 0,
          duration_minutes: variant.duration ?? 0,
          is_active: variant.active ?? true,
        }));
        await supabase.from("service_variants").insert(createPayload);
      }

      for (const variant of variantsToUpdate) {
        if (!variant.id) continue;
        const updatePayload: Partial<SupabaseServiceVariant> = {
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
          .eq("id", parseInt(variant.id))
          .is("deleted_at", null);
      }

      if (variantsToDelete.length > 0) {
        const deleteIds = variantsToDelete.map((v) => parseInt(v.id));
        await supabase
          .from("service_variants")
          .update({
            is_active: false,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in("id", deleteIds)
          .is("deleted_at", null);
      }
    }

    revalidatePath("/servicos");
    return { success: true, data: supabaseServiceToService(data) };
  } catch (error: unknown) {
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
    const deletedAt = new Date().toISOString();

    const { error: variantsError } = await supabase
      .from("service_variants")
      .update({
        is_active: false,
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq("service_id", parseInt(id))
      .is("deleted_at", null);

    if (variantsError) {
      return {
        success: false,
        error: parseSupabaseError(variantsError).description,
      };
    }

    const { error } = await supabase
      .from("services")
      .update({
        is_active: false,
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq("id", parseInt(id))
      .is("deleted_at", null);

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/servicos");
    return { success: true };
  } catch (error: unknown) {
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
    const parsedVariant = serviceVariantInputSchema.parse(variant);
    const payload = {
      service_id: parseInt(parsedVariant.serviceId ?? variant.serviceId),
      variant_name: parsedVariant.variantName ?? variant.variantName,
      price: parsedVariant.price ?? variant.price,
      duration_minutes: parsedVariant.duration ?? variant.duration,
      is_active: parsedVariant.active ?? true,
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
  } catch (error: unknown) {
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
    const parsedVariant = serviceVariantInputSchema.parse(variant);
    const payload: Partial<SupabaseServiceVariant> = {
      ...(parsedVariant.serviceId !== undefined
        ? { service_id: parseInt(parsedVariant.serviceId) }
        : {}),
      ...(parsedVariant.variantName !== undefined
        ? { variant_name: parsedVariant.variantName }
        : {}),
      ...(parsedVariant.price !== undefined ? { price: parsedVariant.price } : {}),
      ...(parsedVariant.duration !== undefined
        ? { duration_minutes: parsedVariant.duration }
        : {}),
      ...(parsedVariant.active !== undefined
        ? { is_active: parsedVariant.active }
        : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("service_variants")
      .update(payload)
      .eq("id", parseInt(id))
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/servicos");
    return { success: true, data: supabaseVariantToVariant(data) };
  } catch (error: unknown) {
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
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parseInt(id))
      .is("deleted_at", null);

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/servicos");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in deleteServiceVariantAction:", error);
    return { success: false, error: "Falha ao excluir variante de serviço." };
  }
}
