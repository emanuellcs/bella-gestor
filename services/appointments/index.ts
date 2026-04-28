import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Appointment } from "@/types";

const SELECT_APPOINTMENTS = `
  *,
  clients (full_name),
  appointment_services (
    id,
    quantity,
    service_variant_id,
    deleted_at,
    service_variants (
      id,
      variant_name,
      price,
      deleted_at,
      duration_minutes,
      services (name, deleted_at)
    )
  ),
  sales (
    id,
    status,
    total_amount,
    deleted_at,
    sale_items (
      quantity,
      unit_price,
      deleted_at
    )
  )
`;

function mapAppointment(apt: any, fallbackClientName = ""): Appointment {
  const client = Array.isArray(apt.clients) ? apt.clients[0] : apt.clients;
  const appointmentServices = (apt.appointment_services || []).filter(
    (as: any) => !as.deleted_at,
  );
  const linkedSales = (apt.sales || []).filter((s: any) => !s.deleted_at);
  const billableSales = linkedSales.filter(
    (s: any) => s.status !== "cancelled",
  );
  const hasSale = billableSales.length > 0;

  const saleTotal = billableSales.reduce((sum: number, sale: any) => {
    const total =
      typeof sale.total_amount === "string"
        ? parseFloat(sale.total_amount)
        : (sale.total_amount ?? 0);

    if (total > 0) return sum + total;

    return (
      sum +
      (sale.sale_items || [])
        .filter((item: any) => !item.deleted_at)
        .reduce((itemSum: number, item: any) => {
          const unitPrice =
            typeof item.unit_price === "string"
              ? parseFloat(item.unit_price)
              : (item.unit_price ?? 0);
          return itemSum + unitPrice * (item.quantity ?? 1);
        }, 0)
    );
  }, 0);

  const projectedPrice = appointmentServices.reduce((sum: number, as: any) => {
    const variant = Array.isArray(as.service_variants)
      ? as.service_variants[0]
      : as.service_variants;
    if (variant?.deleted_at) return sum;

    const price =
      typeof variant?.price === "string"
        ? parseFloat(variant.price)
        : (variant?.price ?? 0);
    return sum + price * (as.quantity ?? 1);
  }, 0);

  return {
    id: apt.id.toString(),
    clientId: apt.client_id.toString(),
    clientName: client?.full_name || fallbackClientName,
    professionalId: apt.professional_id,
    serviceVariants: appointmentServices.map((as: any) => {
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
    totalPrice: saleTotal || projectedPrice,
    hasSale,
    created_at: apt.created_at,
    updatedAt: apt.updated_at || undefined,
  };
}

/**
 * Fetches all appointments.
 */
export async function getAppointments(): Promise<Appointment[]> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select(SELECT_APPOINTMENTS)
      .is("deleted_at", null)
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((apt: any) => mapAppointment(apt));
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
      .select(SELECT_APPOINTMENTS)
      .is("deleted_at", null)
      .gte("start_time", startDate)
      .lte("start_time", endDate)
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(parseSupabaseError(error).description);
    }

    return (data || []).map((apt: any) =>
      mapAppointment(apt, "Cliente desconhecido"),
    );
  } catch (error) {
    console.error("Error in getAppointmentsByDateRange:", error);
    throw error;
  }
}
