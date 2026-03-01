import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Appointment } from "@/types";

/**
 * Fetches all appointments.
 */
export async function getAppointments(): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((apt: any): Appointment => ({
      id: apt.id.toString(),
      clientId: apt.client_id.toString(),
      clientName: "",
      professionalId: apt.professional_id,
      serviceVariants: [],
      startTime: apt.start_time,
      endTime: apt.end_time,
      status: apt.status,
      notes: apt.notes || "",
      totalPrice: 0,
      created_at: apt.created_at,
    }));
  } catch (error) {
    console.error("Error in getAppointments:", error);
    throw error;
  }
}

/**
 * Fetches appointments within a date range.
 */
export async function getAppointmentsByDateRange(startDate: string, endDate: string): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select(`*, clients!inner(full_name, phone, email)`)
      .gte("start_time", startDate)
      .lte("start_time", endDate)
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((apt: any): Appointment => ({
      id: apt.id.toString(),
      clientId: apt.client_id.toString(),
      clientName: apt.clients?.full_name || "Cliente desconhecido",
      professionalId: apt.professional_id,
      serviceVariants: [],
      startTime: apt.start_time,
      endTime: apt.end_time,
      status: apt.status,
      notes: apt.notes || "",
      totalPrice: 0,
      created_at: apt.created_at,
    }));
  } catch (error) {
    console.error("Error in getAppointmentsByDateRange:", error);
    throw error;
  }
}
