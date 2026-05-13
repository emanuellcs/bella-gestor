import { AppointmentStatus, SaleStatus, type Sale } from "@/types";

export interface CalendarCheckoutEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Array<{ email?: string | null }>;
  htmlLink?: string;
}

export interface ParsedCalendarDescription {
  clientName?: string;
  phone?: string;
  serviceName?: string;
  variantName?: string;
  professionalText?: string;
  notes?: string;
  price?: number;
}

export interface ReconciliationAppointmentService {
  serviceVariantId: string;
  quantity: number;
}

export interface ReconciliationAppointment {
  id: string;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  professionalId: string;
  professionalName?: string;
  professionalEmail?: string;
  googleEventId?: string | null;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  serviceVariants: ReconciliationAppointmentService[];
}

export interface CompletionDraft {
  appointmentId?: string;
  clientId?: string;
  professionalId?: string;
  serviceVariantId?: string;
  unitPrice?: number;
  quantity?: number;
  notes?: string;
  startTime?: string;
  endTime?: string;
  status?: AppointmentStatus;
}

export interface CompleteAppointmentInput {
  appointmentId?: string;
  googleEventId: string;
  clientId: string;
  professionalId: string;
  serviceVariantId: string;
  unitPrice: number;
  quantity?: number;
  notes?: string;
  startTime: string;
  endTime: string;
  status?: AppointmentStatus;
}

export interface AppointmentReconciliationRepository {
  findAppointmentByGoogleEventId(
    googleEventId: string,
  ): Promise<ReconciliationAppointment | null>;
  findAppointmentsAround(
    startTime: string,
    windowMs: number,
  ): Promise<ReconciliationAppointment[]>;
  linkGoogleEvent(appointmentId: string, googleEventId: string): Promise<void>;
  findActiveSaleByAppointmentId(appointmentId: string): Promise<Sale | null>;
  ensureSaleForAppointment(
    appointmentId: string,
    googleEventId?: string,
  ): Promise<Sale | null>;
  resolveCompletionDraft(
    parsed: ParsedCalendarDescription,
    event: CalendarCheckoutEvent,
    appointment?: ReconciliationAppointment,
  ): Promise<CompletionDraft>;
  completeAppointmentWithFinancials(
    input: CompleteAppointmentInput,
  ): Promise<Sale>;
}

export type CheckoutReconciliationResult =
  | {
      status: "ready_for_checkout";
      appointmentId?: string;
      sale: Sale;
      message: string;
    }
  | {
      status: "needs_completion";
      appointmentId?: string;
      parsed: ParsedCalendarDescription;
      defaults: CompletionDraft;
      message: string;
    }
  | {
      status: "not_found";
      parsed: ParsedCalendarDescription;
      defaults: CompletionDraft;
      message: string;
    };

const ONE_MINUTE_MS = 60_000;

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

function parseMoney(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

/**
 * Parses the human-readable Google Calendar description used by the clinic.
 * Legacy events are not guaranteed to contain every line, so every field is
 * optional and downstream code decides whether repair is safe.
 */
export function parseCalendarDescription(
  description?: string,
): ParsedCalendarDescription {
  const lines = (description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const read = (label: string) => {
    const normalizedLabel = normalizeText(label);
    const found = lines.find((line) =>
      normalizeText(line).startsWith(normalizedLabel),
    );
    if (!found) return undefined;
    return found.slice(label.length).trim() || undefined;
  };

  const priceText = read("Valor: ");

  return {
    clientName: read("Cliente: "),
    phone: read("Telefone: "),
    serviceName: read("Serviço: "),
    variantName: read("Tipo: "),
    professionalText: read("Profissional: "),
    notes: read("Observações: "),
    price: priceText ? parseMoney(priceText) : undefined,
  };
}

function appointmentScore(
  appointment: ReconciliationAppointment,
  event: CalendarCheckoutEvent,
  parsed: ParsedCalendarDescription,
) {
  let score = 0;

  const delta = Math.abs(
    new Date(appointment.startTime).getTime() -
      new Date(event.start.dateTime).getTime(),
  );
  if (delta <= ONE_MINUTE_MS) score += 2;

  if (
    parsed.clientName &&
    normalizeText(appointment.clientName) === normalizeText(parsed.clientName)
  ) {
    score += 4;
  }

  if (
    parsed.phone &&
    onlyDigits(appointment.clientPhone) &&
    onlyDigits(appointment.clientPhone) === onlyDigits(parsed.phone)
  ) {
    score += 4;
  }

  const attendeeEmails = (event.attendees || [])
    .map((attendee) => normalizeText(attendee.email))
    .filter(Boolean);
  if (
    appointment.professionalEmail &&
    attendeeEmails.includes(normalizeText(appointment.professionalEmail))
  ) {
    score += 3;
  }

  if (
    parsed.professionalText &&
    (normalizeText(parsed.professionalText).includes(
      normalizeText(appointment.professionalName),
    ) ||
      normalizeText(parsed.professionalText).includes(
        normalizeText(appointment.professionalEmail),
      ))
  ) {
    score += 2;
  }

  return score;
}

export function chooseBestLegacyAppointment(
  candidates: ReconciliationAppointment[],
  event: CalendarCheckoutEvent,
  parsed: ParsedCalendarDescription,
) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const ranked = candidates
    .map((appointment) => ({
      appointment,
      score: appointmentScore(appointment, event, parsed),
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked[0]?.score > 0 && ranked[0].score > (ranked[1]?.score || 0)) {
    return ranked[0].appointment;
  }

  return null;
}

export function isCompletionDraftReady(
  draft: CompletionDraft,
): draft is Required<
  Pick<
    CompletionDraft,
    "clientId" | "professionalId" | "serviceVariantId" | "unitPrice"
  >
> &
  CompletionDraft {
  return Boolean(
    draft.clientId &&
    draft.professionalId &&
    draft.serviceVariantId &&
    draft.unitPrice !== undefined &&
    Number.isFinite(draft.unitPrice) &&
    draft.unitPrice >= 0,
  );
}

function buildCompleteInput(
  event: CalendarCheckoutEvent,
  draft: CompletionDraft,
  appointment?: ReconciliationAppointment,
): CompleteAppointmentInput {
  if (!isCompletionDraftReady(draft)) {
    throw new Error("Dados financeiros incompletos para o agendamento.");
  }

  return {
    appointmentId: appointment?.id || draft.appointmentId,
    googleEventId: event.id,
    clientId: draft.clientId,
    professionalId: draft.professionalId,
    serviceVariantId: draft.serviceVariantId,
    unitPrice: draft.unitPrice,
    quantity: draft.quantity || 1,
    notes: draft.notes ?? appointment?.notes,
    startTime: toIso(
      draft.startTime || appointment?.startTime || event.start.dateTime,
    ),
    endTime: toIso(draft.endTime || appointment?.endTime || event.end.dateTime),
    status: draft.status || appointment?.status || AppointmentStatus.SCHEDULED,
  };
}

function needsCompletion(
  event: CalendarCheckoutEvent,
  parsed: ParsedCalendarDescription,
  defaults: CompletionDraft,
  appointment?: ReconciliationAppointment,
): CheckoutReconciliationResult {
  return {
    status: "needs_completion",
    appointmentId: appointment?.id || defaults.appointmentId,
    parsed,
    defaults: {
      ...defaults,
      appointmentId: appointment?.id || defaults.appointmentId,
      startTime:
        defaults.startTime || appointment?.startTime || event.start.dateTime,
      endTime: defaults.endTime || appointment?.endTime || event.end.dateTime,
      notes: defaults.notes ?? parsed.notes ?? appointment?.notes,
    },
    message:
      "Complete cliente, profissional, serviço e valor antes de finalizar o pagamento.",
  };
}

/**
 * Resolves a Google Calendar event into a checkout-ready sale. If legacy data
 * is incomplete, it repairs only when every financial field can be determined
 * without guessing; otherwise it returns a completion request for the UI.
 */
export async function resolveCalendarEventForCheckout(
  event: CalendarCheckoutEvent,
  repository: AppointmentReconciliationRepository,
): Promise<CheckoutReconciliationResult> {
  const parsed = parseCalendarDescription(event.description);
  let appointment = await repository.findAppointmentByGoogleEventId(event.id);

  if (!appointment) {
    const candidates = await repository.findAppointmentsAround(
      toIso(event.start.dateTime),
      ONE_MINUTE_MS,
    );
    appointment = chooseBestLegacyAppointment(candidates, event, parsed);
    if (appointment) {
      await repository.linkGoogleEvent(appointment.id, event.id);
    }
  }

  if (appointment) {
    const activeSale = await repository.findActiveSaleByAppointmentId(
      appointment.id,
    );
    if (activeSale) {
      return {
        status: "ready_for_checkout",
        appointmentId: appointment.id,
        sale: activeSale,
        message: "Venda encontrada para este agendamento.",
      };
    }

    const saleFromExistingServices = await repository.ensureSaleForAppointment(
      appointment.id,
      event.id,
    );
    if (saleFromExistingServices) {
      return {
        status: "ready_for_checkout",
        appointmentId: appointment.id,
        sale: saleFromExistingServices,
        message: "Venda pendente criada a partir dos serviços do agendamento.",
      };
    }

    const defaults = await repository.resolveCompletionDraft(
      parsed,
      event,
      appointment,
    );
    if (isCompletionDraftReady(defaults)) {
      const sale = await repository.completeAppointmentWithFinancials(
        buildCompleteInput(event, defaults, appointment),
      );
      return {
        status: "ready_for_checkout",
        appointmentId: appointment.id,
        sale,
        message: "Agendamento legado reparado e pronto para pagamento.",
      };
    }

    return needsCompletion(event, parsed, defaults, appointment);
  }

  const defaults = await repository.resolveCompletionDraft(parsed, event);
  if (isCompletionDraftReady(defaults)) {
    const sale = await repository.completeAppointmentWithFinancials(
      buildCompleteInput(event, defaults),
    );
    return {
      status: "ready_for_checkout",
      appointmentId: sale.appointmentId,
      sale,
      message: "Agendamento interno criado e pronto para pagamento.",
    };
  }

  return {
    status: "not_found",
    parsed,
    defaults: {
      ...defaults,
      startTime: defaults.startTime || event.start.dateTime,
      endTime: defaults.endTime || event.end.dateTime,
      notes: defaults.notes ?? parsed.notes,
    },
    message:
      "Não encontrei um vínculo interno confiável. Complete os dados antes do checkout.",
  };
}

/**
 * Completes the missing financial side of a Google-origin appointment after
 * the receptionist has confirmed the required details.
 */
export async function completeCalendarEventForCheckout(
  event: CalendarCheckoutEvent,
  draft: CompletionDraft,
  repository: AppointmentReconciliationRepository,
) {
  const parsed = parseCalendarDescription(event.description);
  let appointment = draft.appointmentId
    ? null
    : await repository.findAppointmentByGoogleEventId(event.id);

  if (!appointment && !draft.appointmentId) {
    const candidates = await repository.findAppointmentsAround(
      toIso(event.start.dateTime),
      ONE_MINUTE_MS,
    );
    appointment = chooseBestLegacyAppointment(candidates, event, parsed);
  }

  const sale = await repository.completeAppointmentWithFinancials(
    buildCompleteInput(event, draft, appointment || undefined),
  );

  return {
    status: "ready_for_checkout" as const,
    appointmentId: sale.appointmentId || appointment?.id || draft.appointmentId,
    sale,
    message: "Agendamento completo e pronto para pagamento.",
  };
}

export function isCancelledSale(sale: Pick<Sale, "status">) {
  return sale.status === SaleStatus.CANCELLED;
}
