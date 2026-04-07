"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseSupabaseError } from "@/lib/error-handler";
import { Appointment, SaleStatus, AppointmentStatus } from "@/types";
import { supabaseAppointmentToAppointment } from "@/lib/utils/mapping";

/**
 * Creates a new appointment atomically with its sale using an RPC.
 * Resolves Rule 1 (Atomicity) and Rule 2 (Commission Tracking).
 */
export async function createAppointmentAction(
  appointment: Omit<Appointment, "id" | "created_at">,
) {
  try {
    const supabase = getSupabaseAdmin();

    const rpcPayload = {
      p_client_id: parseInt(appointment.clientId),
      p_professional_id: appointment.professionalId,
      p_start_time: appointment.startTime,
      p_end_time: appointment.endTime,
      p_notes: appointment.notes || null,
      p_service_variants:
        appointment.serviceVariants?.map((sv) => ({
          service_variant_id: parseInt(sv.serviceVariantId),
          quantity: sv.quantity,
        })) || [],
    };

    // Rule 1: Use atomic RPC to prevent "ghost appointments"
    const { data, error } = await supabase.rpc(
      "create_appointment_with_sale",
      rpcPayload,
    );

    if (error) {
      return {
        success: false,
        error: parseSupabaseError(error).description,
      };
    }

    revalidatePath("/agenda");
    revalidatePath("/financeiro");

    return {
      success: true,
      data: supabaseAppointmentToAppointment(data),
    };
  } catch (error: unknown) {
    console.error("Error in createAppointmentAction:", error);
    return { success: false, error: "Falha ao criar agendamento." };
  }
}

/**
 * Updates an existing appointment and syncs related sale status.
 * Resolves Rule 3 (End-of-day reconciliation).
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

    // Rule 3 Sync: If appointment is cancelled, cancel the associated sale
    if (appointment.status === AppointmentStatus.CANCELLED) {
      await supabase
        .from("sales")
        .update({
          status: SaleStatus.CANCELLED,
          updated_at: new Date().toISOString(),
        })
        .eq("appointment_id", parseInt(id));
    }

    revalidatePath("/agenda");
    revalidatePath("/financeiro");
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
