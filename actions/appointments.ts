"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";
import { Appointment, SaleStatus } from "@/types";
import { supabaseAppointmentToAppointment } from "@/lib/utils/mapping";
import { createSaleAction } from "./finance";

/**
 * Creates a new appointment.
 */
export async function createAppointmentAction(
  appointment: Omit<Appointment, "id" | "created_at">,
) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Create the appointment
    const payload = {
      client_id: parseInt(appointment.clientId),
      professional_id: appointment.professionalId,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes || null,
    };

    const { data: appointmentData, error: appointmentError } = await supabase
      .from("appointments")
      .insert([payload])
      .select(`*, clients(full_name)`)
      .single();

    if (appointmentError) {
      return {
        success: false,
        error: parseSupabaseError(appointmentError).description,
      };
    }

    const appointmentId = appointmentData.id;

    // 2. Create appointment services and calculate total price
    let totalAmount = 0;
    const items: Array<{
      serviceVariantId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      professionalId: string;
    }> = [];

    if (appointment.serviceVariants && appointment.serviceVariants.length > 0) {
      for (const sv of appointment.serviceVariants) {
        // Fetch price for each variant
        const { data: variantData } = await supabase
          .from("service_variants")
          .select("price")
          .eq("id", parseInt(sv.serviceVariantId))
          .single();

        const unitPrice = variantData?.price || 0;
        const subtotal = unitPrice * sv.quantity;
        totalAmount += subtotal;

        items.push({
          serviceVariantId: sv.serviceVariantId,
          quantity: sv.quantity,
          unitPrice: unitPrice,
          subtotal: subtotal,
          professionalId: appointment.professionalId,
        });

        // Insert into appointment_services
        await supabase.from("appointment_services").insert([
          {
            appointment_id: appointmentId,
            service_variant_id: parseInt(sv.serviceVariantId),
            quantity: sv.quantity,
          },
        ]);
      }

      // 3. Create a pending sale automatically
      await createSaleAction({
        clientId: appointment.clientId,
        appointmentId: String(appointmentId),
        items: items,
        totalAmount: totalAmount,
        status: SaleStatus.PENDING,
        notes: `Gerada automaticamente do agendamento #${appointmentId}`,
      });
    }

    revalidatePath("/agenda");
    revalidatePath("/financeiro");

    return {
      success: true,
      data: supabaseAppointmentToAppointment(appointmentData),
    };
  } catch (error: unknown) {
    console.error("Error in createAppointmentAction:", error);
    return { success: false, error: "Falha ao criar agendamento." };
  }
}

/**
 * Updates an existing appointment.
 */
export async function updateAppointmentAction(
  id: string,
  appointment: Partial<Appointment>,
) {
  try {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {
      ...(appointment.clientId !== undefined
        ? { client_id: parseInt(appointment.clientId) }
        : {}),
      ...(appointment.professionalId !== undefined
        ? { professional_id: appointment.professionalId }
        : {}),
      ...(appointment.startTime !== undefined
        ? { start_time: appointment.startTime }
        : {}),
      ...(appointment.endTime !== undefined
        ? { end_time: appointment.endTime }
        : {}),
      ...(appointment.status !== undefined
        ? { status: appointment.status }
        : {}),
      ...(appointment.notes !== undefined ? { notes: appointment.notes } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", parseInt(id))
      .select(`*, clients(full_name)`)
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/agenda");
    return { success: true, data: supabaseAppointmentToAppointment(data) };
  } catch (error: unknown) {
    console.error("Error in updateAppointmentAction:", error);
    return { success: false, error: "Falha ao atualizar agendamento." };
  }
}

/**
 * Deletes an appointment.
 */
export async function deleteAppointmentAction(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", parseInt(id));

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/agenda");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in deleteAppointmentAction:", error);
    return { success: false, error: "Falha ao excluir agendamento." };
  }
}
