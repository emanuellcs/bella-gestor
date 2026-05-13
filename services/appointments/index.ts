import { supabase } from "@/lib/supabase/client";
import { parseSupabaseError } from "@/lib/error-handler";
import { Appointment } from "@/types";

type MaybeArray<T> = T | T[] | null | undefined;

interface AppointmentClientRow {
  full_name?: string | null;
}

interface AppointmentServiceVariantRow {
  variant_name?: string | null;
  price?: number | string | null;
  deleted_at?: string | null;
  services?: MaybeArray<{ name?: string | null; deleted_at?: string | null }>;
}

interface AppointmentServiceRow {
  quantity?: number | null;
  service_variant_id: number;
  deleted_at?: string | null;
  service_variants?: MaybeArray<AppointmentServiceVariantRow>;
}

interface AppointmentSaleItemRow {
  quantity?: number | null;
  unit_price?: number | string | null;
  deleted_at?: string | null;
}

interface AppointmentSaleRow {
  id: number;
  status: string;
  total_amount?: number | string | null;
  deleted_at?: string | null;
  sale_items?: AppointmentSaleItemRow[];
}

interface AppointmentRow {
  id: number;
  client_id: number;
  professional_id: string;
  google_event_id?: string | null;
  start_time: string;
  end_time: string;
  status: Appointment["status"];
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  clients?: MaybeArray<AppointmentClientRow>;
  appointment_services?: AppointmentServiceRow[];
  sales?: AppointmentSaleRow[];
}

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

function first<T>(value: MaybeArray<T>) {
  return Array.isArray(value) ? value[0] : value;
}

function mapAppointment(
  apt: AppointmentRow,
  fallbackClientName = "",
): Appointment {
  const client = first(apt.clients);
  const appointmentServices = (apt.appointment_services || []).filter(
    (appointmentService) => !appointmentService.deleted_at,
  );
  const linkedSales = (apt.sales || []).filter((sale) => !sale.deleted_at);
  const billableSales = linkedSales.filter(
    (sale) => sale.status !== "cancelled",
  );
  const hasSale = billableSales.length > 0;

  const saleTotal = billableSales.reduce((sum: number, sale) => {
    const total =
      typeof sale.total_amount === "string"
        ? parseFloat(sale.total_amount)
        : (sale.total_amount ?? 0);

    if (total > 0) return sum + total;

    return (
      sum +
      (sale.sale_items || [])
        .filter((item) => !item.deleted_at)
        .reduce((itemSum: number, item) => {
          const unitPrice =
            typeof item.unit_price === "string"
              ? parseFloat(item.unit_price)
              : (item.unit_price ?? 0);
          return itemSum + unitPrice * (item.quantity ?? 1);
        }, 0)
    );
  }, 0);

  const projectedPrice = appointmentServices.reduce(
    (sum, appointmentService) => {
      const variant = first(appointmentService.service_variants);
      if (variant?.deleted_at) return sum;

      const price =
        typeof variant?.price === "string"
          ? parseFloat(variant.price)
          : (variant?.price ?? 0);
      return sum + price * (appointmentService.quantity ?? 1);
    },
    0,
  );

  return {
    id: apt.id.toString(),
    clientId: apt.client_id.toString(),
    clientName: client?.full_name || fallbackClientName,
    professionalId: apt.professional_id,
    serviceVariants: appointmentServices.map((appointmentService) => {
      const variant = first(appointmentService.service_variants);
      const service = first(variant?.services);

      return {
        serviceVariantId: appointmentService.service_variant_id.toString(),
        serviceVariantName: `${service?.name || ""} - ${variant?.variant_name || ""}`,
        quantity: appointmentService.quantity ?? 1,
      };
    }),
    startTime: apt.start_time,
    endTime: apt.end_time,
    status: apt.status,
    notes: apt.notes || "",
    totalPrice: saleTotal || projectedPrice,
    hasSale,
    saleId: billableSales[0]?.id?.toString(),
    googleEventId: apt.google_event_id || undefined,
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

    return ((data as AppointmentRow[] | null) || []).map((apt) =>
      mapAppointment(apt),
    );
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

    return ((data as AppointmentRow[] | null) || []).map((apt) =>
      mapAppointment(apt, "Cliente desconhecido"),
    );
  } catch (error) {
    console.error("Error in getAppointmentsByDateRange:", error);
    throw error;
  }
}
