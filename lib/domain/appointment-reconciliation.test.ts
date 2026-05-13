import { describe, expect, it } from "vitest";

import {
  completeCalendarEventForCheckout,
  parseCalendarDescription,
  resolveCalendarEventForCheckout,
  type AppointmentReconciliationRepository,
  type CalendarCheckoutEvent,
  type CompleteAppointmentInput,
  type CompletionDraft,
  type ParsedCalendarDescription,
  type ReconciliationAppointment,
} from "@/lib/domain/appointment-reconciliation";
import { AppointmentStatus, SaleStatus, type Sale } from "@/types";

const event: CalendarCheckoutEvent = {
  id: "google-1",
  summary: "Maria - Limpeza",
  description:
    "Cliente: Maria Silva\nTelefone: (11) 99999-0000\nServiço: Limpeza\nTipo: Padrao\nValor: R$ 120,00\nProfissional: Ana",
  start: { dateTime: "2026-05-13T13:00:00.000Z" },
  end: { dateTime: "2026-05-13T14:00:00.000Z" },
  attendees: [{ email: "ana@example.com" }],
};

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "900",
    clientId: "10",
    clientName: "Maria Silva",
    appointmentId: "100",
    professionalId: "prof-1",
    professionalName: "Ana",
    items: [],
    totalAmount: 120,
    status: SaleStatus.PENDING,
    payments: [],
    created_at: "2026-05-13T13:00:00.000Z",
    ...overrides,
  };
}

function appointment(
  overrides: Partial<ReconciliationAppointment> = {},
): ReconciliationAppointment {
  return {
    id: "100",
    clientId: "10",
    clientName: "Maria Silva",
    clientPhone: "(11) 99999-0000",
    professionalId: "prof-1",
    professionalName: "Ana",
    professionalEmail: "ana@example.com",
    startTime: "2026-05-13T13:00:00.000Z",
    endTime: "2026-05-13T14:00:00.000Z",
    status: AppointmentStatus.SCHEDULED,
    serviceVariants: [],
    ...overrides,
  };
}

class FakeRepository implements AppointmentReconciliationRepository {
  linkedAppointment: ReconciliationAppointment | null = null;
  fallbackAppointments: ReconciliationAppointment[] = [];
  activeSale: Sale | null = null;
  ensuredSale: Sale | null = null;
  completionDraft: CompletionDraft = {};
  completedInputs: CompleteAppointmentInput[] = [];
  linkedIds: Array<{ appointmentId: string; googleEventId: string }> = [];

  async findAppointmentByGoogleEventId() {
    return this.linkedAppointment;
  }

  async findAppointmentsAround() {
    return this.fallbackAppointments;
  }

  async linkGoogleEvent(appointmentId: string, googleEventId: string) {
    this.linkedIds.push({ appointmentId, googleEventId });
  }

  async findActiveSaleByAppointmentId() {
    return this.activeSale;
  }

  async ensureSaleForAppointment() {
    return this.ensuredSale;
  }

  async resolveCompletionDraft(
    parsed: ParsedCalendarDescription,
  ): Promise<CompletionDraft> {
    return {
      notes: parsed.notes,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      ...this.completionDraft,
    };
  }

  async completeAppointmentWithFinancials(input: CompleteAppointmentInput) {
    this.completedInputs.push(input);
    this.activeSale = sale({ appointmentId: input.appointmentId || "101" });
    return this.activeSale;
  }
}

describe("appointment reconciliation", () => {
  it("parses structured Google descriptions without requiring every field", () => {
    expect(parseCalendarDescription("Cliente: Maria\nValor: R$ 99,50")).toEqual(
      {
        clientName: "Maria",
        phone: undefined,
        serviceName: undefined,
        variantName: undefined,
        professionalText: undefined,
        notes: undefined,
        price: 99.5,
      },
    );
  });

  it("repairs a Google-origin appointment with no sale when all details resolve", async () => {
    const repo = new FakeRepository();
    repo.fallbackAppointments = [appointment()];
    repo.completionDraft = {
      clientId: "10",
      professionalId: "prof-1",
      serviceVariantId: "55",
      unitPrice: 120,
    };

    const result = await resolveCalendarEventForCheckout(event, repo);

    expect(result.status).toBe("ready_for_checkout");
    expect(repo.linkedIds).toEqual([
      { appointmentId: "100", googleEventId: "google-1" },
    ]);
    expect(repo.completedInputs).toHaveLength(1);
    expect(repo.completedInputs[0]).toMatchObject({
      appointmentId: "100",
      clientId: "10",
      serviceVariantId: "55",
      unitPrice: 120,
    });
  });

  it("creates a pending sale from existing appointment services before asking for completion", async () => {
    const repo = new FakeRepository();
    repo.linkedAppointment = appointment({
      googleEventId: "google-1",
      serviceVariants: [{ serviceVariantId: "55", quantity: 1 }],
    });
    repo.ensuredSale = sale();

    const result = await resolveCalendarEventForCheckout(event, repo);

    expect(result.status).toBe("ready_for_checkout");
    expect(repo.completedInputs).toHaveLength(0);
    expect(result).toMatchObject({ sale: { id: "900" } });
  });

  it("returns needs_completion and performs no writes when service data is missing", async () => {
    const repo = new FakeRepository();
    repo.linkedAppointment = appointment({ googleEventId: "google-1" });
    repo.completionDraft = {
      clientId: "10",
      professionalId: "prof-1",
      unitPrice: 120,
    };

    const result = await resolveCalendarEventForCheckout(event, repo);

    expect(result.status).toBe("needs_completion");
    expect(repo.completedInputs).toHaveLength(0);
    expect(result).toMatchObject({
      defaults: {
        clientId: "10",
        professionalId: "prof-1",
        unitPrice: 120,
      },
    });
  });

  it("is idempotent from the domain boundary once a repaired sale exists", async () => {
    const repo = new FakeRepository();
    repo.linkedAppointment = appointment({ googleEventId: "google-1" });
    repo.completionDraft = {
      clientId: "10",
      professionalId: "prof-1",
      serviceVariantId: "55",
      unitPrice: 120,
    };

    await resolveCalendarEventForCheckout(event, repo);
    await resolveCalendarEventForCheckout(event, repo);

    expect(repo.completedInputs).toHaveLength(1);
  });

  it("completes receptionist-confirmed details for checkout", async () => {
    const repo = new FakeRepository();
    repo.fallbackAppointments = [appointment()];

    const result = await completeCalendarEventForCheckout(
      event,
      {
        clientId: "10",
        professionalId: "prof-1",
        serviceVariantId: "55",
        unitPrice: 120,
      },
      repo,
    );

    expect(result.status).toBe("ready_for_checkout");
    expect(repo.completedInputs[0]).toMatchObject({
      appointmentId: "100",
      googleEventId: "google-1",
    });
  });
});
