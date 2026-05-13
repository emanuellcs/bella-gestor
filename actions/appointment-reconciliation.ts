"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  completeCalendarEventForCheckout,
  resolveCalendarEventForCheckout,
  type CalendarCheckoutEvent,
} from "@/lib/domain/appointment-reconciliation";
import { parseSupabaseError } from "@/lib/error-handler";
import { SupabaseAppointmentReconciliationRepository } from "@/lib/supabase/appointment-reconciliation-repository";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AppointmentStatus, SaleStatus } from "@/types";

const calendarEventSchema = z.object({
  id: z.string().min(1, "Evento do Google não informado."),
  summary: z.string().default("Agendamento"),
  description: z.string().optional(),
  start: z.object({
    dateTime: z.string().min(1, "Início do evento não informado."),
  }),
  end: z.object({
    dateTime: z.string().min(1, "Fim do evento não informado."),
  }),
  attendees: z
    .array(z.object({ email: z.string().email().optional().nullable() }))
    .optional(),
  htmlLink: z.string().optional(),
});

const completionSchema = z.object({
  appointmentId: z.string().optional(),
  clientId: z.string().min(1, "Selecione o cliente."),
  professionalId: z.string().min(1, "Selecione a profissional."),
  serviceVariantId: z.string().min(1, "Selecione o tipo de serviço."),
  unitPrice: z.coerce
    .number({ invalid_type_error: "Informe um valor válido." })
    .min(0, "O valor não pode ser negativo."),
  quantity: z.coerce.number().int().positive().default(1),
  notes: z.string().optional(),
  startTime: z.string().min(1, "Início do agendamento não informado."),
  endTime: z.string().min(1, "Fim do agendamento não informado."),
  status: z.nativeEnum(AppointmentStatus).optional(),
});

const syncFieldsSchema = z.object({
  clientId: z.string().optional(),
  professionalId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
});

function validationError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}

function repository() {
  return new SupabaseAppointmentReconciliationRepository();
}

/**
 * Resolves a Google Calendar event into a checkout-ready sale, repairing
 * legacy appointment data only when all required financial details are known.
 */
export async function resolveAppointmentForCheckoutAction(
  eventPayload: CalendarCheckoutEvent,
) {
  try {
    const event = calendarEventSchema.parse(eventPayload);
    const result = await resolveCalendarEventForCheckout(event, repository());

    return {
      success: true as const,
      ...result,
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        status: "error" as const,
        error: validationError(error),
      };
    }

    return {
      success: false as const,
      status: "error" as const,
      error: parseSupabaseError(error).description,
    };
  }
}

/**
 * Completes a Google-origin appointment after the receptionist confirms the
 * missing service and financial details. This is idempotent at the database
 * layer and does not overwrite existing sales or payments.
 */
export async function completeAppointmentForCheckoutAction(
  eventPayload: CalendarCheckoutEvent,
  completionPayload: z.input<typeof completionSchema>,
) {
  try {
    const event = calendarEventSchema.parse(eventPayload);
    const completion = completionSchema.parse(completionPayload);

    const result = await completeCalendarEventForCheckout(
      event,
      completion,
      repository(),
    );

    revalidatePath("/agenda");
    revalidatePath("/financeiro");
    revalidatePath("/relatorios");

    return {
      success: true as const,
      ...result,
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        status: "error" as const,
        error: validationError(error),
      };
    }

    return {
      success: false as const,
      status: "error" as const,
      error: parseSupabaseError(error).description,
    };
  }
}

/**
 * Keeps a linked internal appointment aligned with Google edits even when the
 * event is not financially complete yet. This preserves partial legacy records
 * without forcing a service variant during normal reception edits.
 */
export async function syncCalendarAppointmentFieldsAction(
  eventPayload: CalendarCheckoutEvent,
  fieldsPayload: z.input<typeof syncFieldsSchema>,
) {
  try {
    const event = calendarEventSchema.parse(eventPayload);
    const fields = syncFieldsSchema.parse(fieldsPayload);
    const appointmentId =
      await repository().syncAppointmentFieldsForCalendarEvent(event, fields);

    if (appointmentId) {
      revalidatePath("/agenda");
    }

    return {
      success: true as const,
      appointmentId,
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: validationError(error),
      };
    }

    return {
      success: false as const,
      error: parseSupabaseError(error).description,
    };
  }
}

/**
 * Deletes the internal appointment that corresponds to a Google event, if one
 * exists. Missing financial rows are treated as a legacy-data condition, not a
 * fatal error.
 */
export async function deleteAppointmentForCalendarEventAction(
  eventPayload: CalendarCheckoutEvent,
) {
  try {
    const event = calendarEventSchema.parse(eventPayload);
    const repo = repository();
    const appointment = await repo.findBestAppointmentForEvent(event);

    if (!appointment) {
      return { success: true as const, skipped: true as const };
    }

    const supabase = getSupabaseAdmin();
    const deletedAt = new Date().toISOString();

    const { error: appointmentError } = await supabase
      .from("appointments")
      .update({
        status: AppointmentStatus.CANCELLED,
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq("id", Number(appointment.id))
      .is("deleted_at", null);

    if (appointmentError) {
      return {
        success: false as const,
        error: parseSupabaseError(appointmentError).description,
      };
    }

    const { error: servicesError } = await supabase
      .from("appointment_services")
      .update({ deleted_at: deletedAt })
      .eq("appointment_id", Number(appointment.id))
      .is("deleted_at", null);

    if (servicesError) {
      return {
        success: false as const,
        error: parseSupabaseError(servicesError).description,
      };
    }

    const { error: salesError } = await supabase
      .from("sales")
      .update({
        status: SaleStatus.CANCELLED,
        updated_at: deletedAt,
      })
      .eq("appointment_id", Number(appointment.id))
      .is("deleted_at", null);

    if (salesError) {
      return {
        success: false as const,
        error: parseSupabaseError(salesError).description,
      };
    }

    revalidatePath("/agenda");
    revalidatePath("/financeiro");
    return { success: true as const, appointmentId: appointment.id };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: validationError(error),
      };
    }

    return {
      success: false as const,
      error: parseSupabaseError(error).description,
    };
  }
}

/**
 * Explicit repair helper for legacy appointments that already have service
 * rows but are missing their sale. Existing active sales are reused.
 */
export async function ensureAppointmentSaleAction(appointmentId: string) {
  try {
    const id = z.string().min(1).parse(appointmentId);
    const repo = repository();

    const existing = await repo.findActiveSaleByAppointmentId(id);
    if (existing) {
      return { success: true as const, sale: existing };
    }

    const sale = await repo.ensureSaleForAppointment(id);
    if (!sale) {
      return {
        success: false as const,
        error:
          "Complete os serviços do agendamento antes de criar a venda para checkout.",
      };
    }

    revalidatePath("/agenda");
    revalidatePath("/financeiro");

    return { success: true as const, sale };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: validationError(error),
      };
    }

    return {
      success: false as const,
      error: parseSupabaseError(error).description,
    };
  }
}
