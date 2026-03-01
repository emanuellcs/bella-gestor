"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { parseSupabaseError } from "@/lib/error-handler";
import { Appointment } from "@/types";

/**
 * Creates a new appointment.
 */
export async function createAppointmentAction(appointment: Omit<Appointment, "id" | "created_at">) {
  try {
    const supabase = getSupabaseServer();
    const payload = {
      client_id: parseInt(appointment.clientId),
      professional_id: appointment.professionalId,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      status: appointment.status,
      notes: appointment.notes || null,
    };

    const { data, error } = await supabase
      .from("appointments")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/agenda");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in createAppointmentAction:", error);
    return { success: false, error: "Falha ao criar agendamento." };
  }
}

/**
 * Updates an existing appointment.
 */
export async function updateAppointmentAction(id: string, appointment: Partial<Appointment>) {
  try {
    const supabase = getSupabaseServer();
    const payload: any = {
      ...(appointment.clientId !== undefined ? { client_id: parseInt(appointment.clientId) } : {}),
      ...(appointment.professionalId !== undefined ? { professional_id: appointment.professionalId } : {}),
      ...(appointment.startTime !== undefined ? { start_time: appointment.startTime } : {}),
      ...(appointment.endTime !== undefined ? { end_time: appointment.endTime } : {}),
      ...(appointment.status !== undefined ? { status: appointment.status } : {}),
      ...(appointment.notes !== undefined ? { notes: appointment.notes } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", parseInt(id))
      .select("*")
      .single();

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/agenda");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in updateAppointmentAction:", error);
    return { success: false, error: "Falha ao atualizar agendamento." };
  }
}

/**
 * Deletes an appointment.
 */
export async function deleteAppointmentAction(id: string) {
  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase.from("appointments").delete().eq("id", parseInt(id));

    if (error) {
      return { success: false, error: parseSupabaseError(error).description };
    }

    revalidatePath("/agenda");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteAppointmentAction:", error);
    return { success: false, error: "Falha ao excluir agendamento." };
  }
}
