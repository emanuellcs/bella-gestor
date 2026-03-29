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
      .select(
        `
        *,
        clients (full_name),
        appointment_services (
          *,
          service_variants (
            variant_name,
            services (name)
          )
        )
      `,
      )
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((apt: any): Appointment => {
      const client = Array.isArray(apt.clients) ? apt.clients[0] : apt.clients;

      return {
        id: apt.id.toString(),
        clientId: apt.client_id.toString(),
        clientName: client?.full_name || "",
        professionalId: apt.professional_id,
        serviceVariants: (apt.appointment_services || []).map((as: any) => {
          const variant = Array.isArray(as.service_variants)
            ? as.service_variants[0]
            : as.service_variants;
          const service = Array.isArray(variant?.services)
            ? variant?.services[0]
            : variant?.services;

          return {
            serviceVariantId: as.service_variant_id.toString(),
            serviceVariantName: `${service?.name || ""} - ${variant?.variant_name || ""}`,
            quantity: as.quantity,
          };
        }),
        startTime: apt.start_time,
        endTime: apt.end_time,
        status: apt.status,
        notes: apt.notes || "",
        totalPrice: 0,
        created_at: apt.created_at,
      };
    });
  } catch (error) {
    console.error("Error in getAppointments:", error);
    throw error;
  }
}

/**
 * Fetches appointments within a date range.
 */
export async function getAppointmentsByDateRange(
  startDate: string,
  endDate: string,
): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
        *,
        clients (full_name, phone, email),
        appointment_services (
          *,
          service_variants (
            variant_name,
            services (name)
          )
        )
      `,
      )
      .gte("start_time", startDate)
      .lte("start_time", endDate)
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((apt: any): Appointment => {
      const client = Array.isArray(apt.clients) ? apt.clients[0] : apt.clients;

      return {
        id: apt.id.toString(),
        clientId: apt.client_id.toString(),
        clientName: client?.full_name || "Cliente desconhecido",
        professionalId: apt.professional_id,
        serviceVariants: (apt.appointment_services || []).map((as: any) => {
          const variant = Array.isArray(as.service_variants)
            ? as.service_variants[0]
            : as.service_variants;
          const service = Array.isArray(variant?.services)
            ? variant?.services[0]
            : variant?.services;

          return {
            serviceVariantId: as.service_variant_id.toString(),
            serviceVariantName: `${service?.name || ""} - ${variant?.variant_name || ""}`,
            quantity: as.quantity,
          };
        }),
        startTime: apt.start_time,
        endTime: apt.end_time,
        status: apt.status,
        notes: apt.notes || "",
        totalPrice: 0,
        created_at: apt.created_at,
      };
    });
  } catch (error) {
    console.error("Error in getAppointmentsByDateRange:", error);
    throw error;
  }
}
