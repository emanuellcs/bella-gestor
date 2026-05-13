import type { SupabaseClient } from "@supabase/supabase-js";

import {
  chooseBestLegacyAppointment,
  parseCalendarDescription,
  type AppointmentReconciliationRepository,
  type CalendarCheckoutEvent,
  type CompleteAppointmentInput,
  type CompletionDraft,
  type ParsedCalendarDescription,
  type ReconciliationAppointment,
} from "@/lib/domain/appointment-reconciliation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { supabaseSaleToSale } from "@/lib/utils/mapping";
import { AppointmentStatus, SaleStatus, type Sale } from "@/types";

const APPOINTMENT_SELECT = `
  *,
  clients (full_name, phone),
  professional:professionals (full_name, email),
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
      is_active,
      services (name, deleted_at)
    )
  )
`;

const SALE_SELECT = `
  *,
  client:clients(full_name),
  professional:professionals!sales_professional_id_fkey(full_name),
  items:sale_items(
    *,
    professional:professionals(full_name),
    variant:service_variants(variant_name, service:services(name))
  ),
  payments(*)
`;

interface AppointmentRow {
  id: number;
  client_id: number;
  professional_id: string;
  google_event_id?: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes?: string | null;
  clients?: { full_name?: string | null; phone?: string | null } | null;
  professional?: { full_name?: string | null; email?: string | null } | null;
  appointment_services?: Array<{
    quantity?: number | null;
    service_variant_id: number;
    deleted_at?: string | null;
  }>;
}

interface ClientRow {
  id: number;
  full_name?: string | null;
  phone?: string | null;
}

interface ProfessionalRow {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

interface ServiceVariantRow {
  id: number;
  variant_name: string;
  price: number | string;
  is_active?: boolean | null;
  deleted_at?: string | null;
}

interface ServiceRow {
  id: number;
  name: string;
  service_variants?: ServiceVariantRow[];
}

function normalizeText(value: string | undefined | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value: string | undefined | null) {
  return (value || "").replace(/\D/g, "");
}

function like(value: string) {
  return `%${value.replace(/[%_]/g, "")}%`;
}

function mapAppointment(row: AppointmentRow): ReconciliationAppointment {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    clientName: row.clients?.full_name || undefined,
    clientPhone: row.clients?.phone || undefined,
    professionalId: row.professional_id,
    professionalName: row.professional?.full_name || undefined,
    professionalEmail: row.professional?.email || undefined,
    googleEventId: row.google_event_id || undefined,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    notes: row.notes || undefined,
    serviceVariants: (row.appointment_services || [])
      .filter((item) => !item.deleted_at)
      .map((item) => ({
        serviceVariantId: String(item.service_variant_id),
        quantity: item.quantity || 1,
      })),
  };
}

function saleFromRow(row: unknown): Sale {
  return supabaseSaleToSale(row as Parameters<typeof supabaseSaleToSale>[0]);
}

export class SupabaseAppointmentReconciliationRepository
  implements AppointmentReconciliationRepository
{
  constructor(private readonly supabase: SupabaseClient = getSupabaseAdmin()) {}

  async findAppointmentByGoogleEventId(googleEventId: string) {
    const { data, error } = await this.supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("google_event_id", googleEventId)
      .is("deleted_at", null)
      .limit(1);

    if (error) throw error;
    const row = (data as unknown as AppointmentRow[] | null)?.[0];
    return row ? mapAppointment(row) : null;
  }

  async findAppointmentsAround(startTime: string, windowMs: number) {
    const start = new Date(new Date(startTime).getTime() - windowMs);
    const end = new Date(new Date(startTime).getTime() + windowMs);

    const { data, error } = await this.supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .is("deleted_at", null)
      .order("start_time", { ascending: true });

    if (error) throw error;
    return ((data as unknown as AppointmentRow[] | null) || []).map(
      mapAppointment,
    );
  }

  async findBestAppointmentForEvent(event: CalendarCheckoutEvent) {
    const linked = await this.findAppointmentByGoogleEventId(event.id);
    if (linked) return linked;

    const parsed = parseCalendarDescription(event.description);
    const candidates = await this.findAppointmentsAround(
      new Date(event.start.dateTime).toISOString(),
      60_000,
    );
    return chooseBestLegacyAppointment(candidates, event, parsed);
  }

  async linkGoogleEvent(appointmentId: string, googleEventId: string) {
    const { error } = await this.supabase
      .from("appointments")
      .update({
        google_event_id: googleEventId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(appointmentId))
      .is("deleted_at", null);

    if (error) throw error;
  }

  async findActiveSaleByAppointmentId(appointmentId: string) {
    const { data, error } = await this.supabase
      .from("sales")
      .select(SALE_SELECT)
      .eq("appointment_id", Number(appointmentId))
      .is("deleted_at", null)
      .neq("status", SaleStatus.CANCELLED)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    const row = (data as unknown[] | null)?.[0];
    return row ? saleFromRow(row) : null;
  }

  async ensureSaleForAppointment(appointmentId: string, googleEventId?: string) {
    const { data, error } = await this.supabase.rpc(
      "repair_appointment_financials",
      {
        p_appointment_id: Number(appointmentId),
        p_google_event_id: googleEventId || null,
      },
    );

    if (error) {
      if (error.message?.includes("service details")) return null;
      if (error.message?.includes("detalhes do serviço")) return null;
      throw error;
    }

    const row = data as unknown;
    return row ? saleFromRow(row) : null;
  }

  async resolveCompletionDraft(
    parsed: ParsedCalendarDescription,
    event: CalendarCheckoutEvent,
    appointment?: ReconciliationAppointment,
  ): Promise<CompletionDraft> {
    const clientId = appointment?.clientId || (await this.resolveClient(parsed));
    const professionalId =
      appointment?.professionalId ||
      (await this.resolveProfessional(parsed, event));
    const variant = await this.resolveServiceVariant(parsed);

    return {
      appointmentId: appointment?.id,
      clientId,
      professionalId,
      serviceVariantId: variant?.id,
      unitPrice: parsed.price ?? variant?.price,
      quantity: 1,
      notes: parsed.notes ?? appointment?.notes,
      startTime: appointment?.startTime || event.start.dateTime,
      endTime: appointment?.endTime || event.end.dateTime,
      status: appointment?.status || AppointmentStatus.SCHEDULED,
    };
  }

  async completeAppointmentWithFinancials(input: CompleteAppointmentInput) {
    const serviceVariants = [
      {
        service_variant_id: Number(input.serviceVariantId),
        quantity: input.quantity || 1,
        unit_price: input.unitPrice,
      },
    ];

    if (input.appointmentId) {
      const { data, error } = await this.supabase.rpc(
        "repair_appointment_financials",
        {
          p_appointment_id: Number(input.appointmentId),
          p_client_id: Number(input.clientId),
          p_professional_id: input.professionalId,
          p_start_time: input.startTime,
          p_end_time: input.endTime,
          p_notes: input.notes || null,
          p_google_event_id: input.googleEventId,
          p_service_variants: serviceVariants,
        },
      );

      if (error) throw error;
      return saleFromRow(data);
    }

    const { data: appointment, error } = await this.supabase.rpc(
      "create_appointment_with_sale",
      {
        p_client_id: Number(input.clientId),
        p_professional_id: input.professionalId,
        p_start_time: input.startTime,
        p_end_time: input.endTime,
        p_notes: input.notes || null,
        p_google_event_id: input.googleEventId,
        p_service_variants: serviceVariants,
      },
    );

    if (error) throw error;
    const appointmentId = String(
      (appointment as { id?: number | string } | null)?.id || "",
    );
    const sale = await this.findActiveSaleByAppointmentId(appointmentId);
    if (!sale) throw new Error("Venda criada não encontrada para checkout.");
    return sale;
  }

  async syncAppointmentFieldsForCalendarEvent(
    event: CalendarCheckoutEvent,
    fields: {
      clientId?: string;
      professionalId?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
      status?: AppointmentStatus;
    },
  ) {
    const appointment = await this.findBestAppointmentForEvent(event);
    if (!appointment) return null;

    const payload: Record<string, unknown> = {
      google_event_id: event.id,
      updated_at: new Date().toISOString(),
    };

    if (fields.clientId) payload.client_id = Number(fields.clientId);
    if (fields.professionalId) payload.professional_id = fields.professionalId;
    if (fields.startTime) payload.start_time = fields.startTime;
    if (fields.endTime) payload.end_time = fields.endTime;
    if (fields.notes !== undefined) payload.notes = fields.notes || null;
    if (fields.status) payload.status = fields.status;

    const { error } = await this.supabase
      .from("appointments")
      .update(payload)
      .eq("id", Number(appointment.id))
      .is("deleted_at", null);

    if (error) throw error;
    return appointment.id;
  }

  private async resolveClient(parsed: ParsedCalendarDescription) {
    const { clientName, phone } = parsed;
    if (!clientName && !phone) return undefined;

    let query = this.supabase
      .from("clients")
      .select("id, full_name, phone")
      .is("deleted_at", null)
      .limit(25);

    if (clientName) {
      query = query.ilike("full_name", like(clientName));
    } else if (phone) {
      query = query.ilike("phone", like(phone));
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data as unknown as ClientRow[] | null) || [])
      .map((row) => ({
        row,
        score:
          (clientName &&
          normalizeText(row.full_name) === normalizeText(clientName)
            ? 4
            : 0) +
          (phone && onlyDigits(row.phone) === onlyDigits(phone) ? 4 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    return rows[0]?.score ? String(rows[0].row.id) : undefined;
  }

  private async resolveProfessional(
    parsed: ParsedCalendarDescription,
    event: CalendarCheckoutEvent,
  ) {
    const attendeeEmails = (event.attendees || [])
      .map((attendee) => normalizeText(attendee.email))
      .filter(Boolean);
    const text = normalizeText(parsed.professionalText);

    if (!attendeeEmails.length && !text) return undefined;

    const { data, error } = await this.supabase
      .from("professionals")
      .select("user_id, full_name, email")
      .is("deleted_at", null)
      .limit(100);

    if (error) throw error;

    const ranked = ((data as unknown as ProfessionalRow[] | null) || [])
      .map((row) => {
        const email = normalizeText(row.email);
        const name = normalizeText(row.full_name);
        return {
          row,
          score:
            (email && attendeeEmails.includes(email) ? 4 : 0) +
            (text && name && text.includes(name) ? 3 : 0) +
            (text && email && text.includes(email) ? 3 : 0),
        };
      })
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.score ? ranked[0].row.user_id : undefined;
  }

  private async resolveServiceVariant(parsed: ParsedCalendarDescription) {
    if (!parsed.serviceName && !parsed.variantName) return undefined;

    const { data, error } = await this.supabase
      .from("services")
      .select("id, name, service_variants(id, variant_name, price, is_active, deleted_at)")
      .is("deleted_at", null)
      .eq("is_active", true)
      .limit(100);

    if (error) throw error;

    const services = (data as unknown as ServiceRow[] | null) || [];
    const serviceMatches = parsed.serviceName
      ? services.filter(
          (service) =>
            normalizeText(service.name) === normalizeText(parsed.serviceName),
        )
      : services;

    const variants = serviceMatches.flatMap((service) =>
      (service.service_variants || []).filter(
        (variant) => variant.is_active !== false && !variant.deleted_at,
      ),
    );

    const matchingVariants = parsed.variantName
      ? variants.filter(
          (variant) =>
            normalizeText(variant.variant_name) ===
            normalizeText(parsed.variantName),
        )
      : variants;

    if (matchingVariants.length !== 1) return undefined;

    const variant = matchingVariants[0];
    return {
      id: String(variant.id),
      price:
        typeof variant.price === "string"
          ? Number(variant.price)
          : variant.price,
    };
  }
}
