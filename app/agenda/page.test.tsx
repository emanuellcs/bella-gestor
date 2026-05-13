import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AgendaPage from "@/app/agenda/page";
import { PaymentStatus, SaleStatus, type Sale } from "@/types";

const mocks = vi.hoisted(() => ({
  listCalendarEvents: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  resolveAppointmentForCheckoutAction: vi.fn(),
  deleteAppointmentForCalendarEventAction: vi.fn(),
  completeAppointmentForCheckoutAction: vi.fn(),
  syncCalendarAppointmentFieldsAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
  refreshData: vi.fn(),
  updateAppointment: vi.fn(),
}));

vi.mock("@/services/googleCalendarAppsScript", () => ({
  listCalendarEvents: (...args: unknown[]) => mocks.listCalendarEvents(...args),
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: (...args: unknown[]) =>
    mocks.deleteCalendarEvent(...args),
}));

vi.mock("@/actions/appointment-reconciliation", () => ({
  resolveAppointmentForCheckoutAction: (...args: unknown[]) =>
    mocks.resolveAppointmentForCheckoutAction(...args),
  deleteAppointmentForCalendarEventAction: (...args: unknown[]) =>
    mocks.deleteAppointmentForCalendarEventAction(...args),
  completeAppointmentForCheckoutAction: (...args: unknown[]) =>
    mocks.completeAppointmentForCheckoutAction(...args),
  syncCalendarAppointmentFieldsAction: (...args: unknown[]) =>
    mocks.syncCalendarAppointmentFieldsAction(...args),
}));

vi.mock("@/components/ui/combobox", () => ({
  Combobox: ({
    placeholder,
    items,
    value,
    onChange,
    disabled,
  }: {
    placeholder: string;
    items: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label={placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

vi.mock("@/components/features/agenda/calendar-view", () => ({
  CalendarView: ({
    events,
    onCheckout,
    onDelete,
  }: {
    events: Array<{
      id: string;
      summary: string;
      description?: string;
      start: { dateTime: string };
      end: { dateTime: string };
    }>;
    onCheckout?: (event: (typeof events)[number]) => void;
    onDelete?: (event: (typeof events)[number]) => void;
  }) => (
    <div>
      {events.map((event) => (
        <div key={event.id}>
          <span>{event.summary}</span>
          <button type="button" onClick={() => onCheckout?.(event)}>
            Finalizar e Pagar
          </button>
          <button
            type="button"
            aria-label="Ações do agendamento"
            onClick={() => onDelete?.(event)}
          >
            Excluir
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/features/agenda/appointment-form-modal", () => ({
  AppointmentFormModal: ({
    open,
    requireFinancialDetails,
  }: {
    open: boolean;
    requireFinancialDetails?: boolean;
  }) =>
    open ? (
      <div>
        {requireFinancialDetails
          ? "Completar agendamento"
          : "Editar agendamento"}
      </div>
    ) : null,
}));

vi.mock("@/lib/data-context", () => ({
  useData: () => ({
    clients: [
      {
        id: "10",
        name: "Maria Silva",
        phone: "(11) 99999-0000",
        email: "",
        registrationDate: "2026-01-01T00:00:00.000Z",
        totalSpent: 0,
        status: "active",
      },
    ],
    services: [
      {
        id: "20",
        name: "Limpeza",
        category: "Pele",
        active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        variants: [
          {
            id: "55",
            serviceId: "20",
            variantName: "Padrao",
            price: 120,
            duration: 60,
            active: true,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ],
    professionals: [
      {
        id: "prof-1",
        name: "Ana",
        email: "ana@example.com",
        functionTitle: "Esteticista",
        role: "Professional",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    appointments: [],
    sales: [],
    appOptions: [
      {
        id: 1,
        optionType: "payment_method",
        label: "PIX",
        value: "pix",
        isActive: true,
        displayOrder: 1,
      },
    ],
    isLoading: false,
    refreshData: mocks.refreshData,
    addAppointment: vi.fn(),
    updateAppointment: mocks.updateAppointment,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
    message: (...args: unknown[]) => mocks.toastMessage(...args),
  },
}));

function makeGoogleEvent() {
  const start = new Date(Date.now() - 60_000);
  const end = new Date(Date.now() + 60 * 60_000);

  return {
    id: "google-1",
    summary: "Maria Silva - Limpeza",
    description:
      "Cliente: Maria Silva\nTelefone: (11) 99999-0000\nServiço: Limpeza\nTipo: Padrao\nValor: R$ 120,00\nProfissional: Ana",
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    attendees: [{ email: "ana@example.com" }],
  };
}

let googleEvent = makeGoogleEvent();

function sale(): Sale {
  return {
    id: "900",
    clientId: "10",
    clientName: "Maria Silva",
    appointmentId: "100",
    professionalId: "prof-1",
    items: [],
    totalAmount: 120,
    status: SaleStatus.PENDING,
    payments: [
      {
        id: "1",
        saleId: "900",
        amount: 0,
        status: PaymentStatus.PENDING,
        created_at: "2026-05-13T13:00:00.000Z",
      },
    ],
    created_at: "2026-05-13T13:00:00.000Z",
  };
}

describe("AgendaPage reconciliation flows", () => {
  beforeEach(() => {
    googleEvent = makeGoogleEvent();
    mocks.listCalendarEvents.mockResolvedValue({
      success: true,
      events: [googleEvent],
    });
    mocks.deleteCalendarEvent.mockResolvedValue({ success: true });
    mocks.deleteAppointmentForCalendarEventAction.mockResolvedValue({
      success: true,
    });
    mocks.syncCalendarAppointmentFieldsAction.mockResolvedValue({
      success: true,
      appointmentId: "100",
    });
    mocks.completeAppointmentForCheckoutAction.mockResolvedValue({
      success: true,
      status: "ready_for_checkout",
      sale: sale(),
    });
    mocks.refreshData.mockResolvedValue(undefined);
    mocks.updateAppointment.mockResolvedValue({});
  });

  it("opens checkout when reconciliation returns a sale", async () => {
    mocks.resolveAppointmentForCheckoutAction.mockResolvedValue({
      success: true,
      status: "ready_for_checkout",
      sale: sale(),
    });

    render(<AgendaPage />);

    fireEvent.click(await screen.findByText("Finalizar e Pagar"));

    expect(await screen.findByText("Registrar Pagamento")).toBeInTheDocument();
  });

  it("opens the completion prompt when a Google event needs service details", async () => {
    mocks.resolveAppointmentForCheckoutAction.mockResolvedValue({
      success: true,
      status: "needs_completion",
      message: "Complete cliente, profissional, serviço e valor.",
      defaults: {},
      parsed: {},
    });

    render(<AgendaPage />);

    fireEvent.click(await screen.findByText("Finalizar e Pagar"));

    expect(
      await screen.findByText("Completar agendamento"),
    ).toBeInTheDocument();
    expect(mocks.toastMessage).toHaveBeenCalledWith(
      "Complete cliente, profissional, serviço e valor.",
    );
  });

  it("deletes the Google event and then soft-deletes the internal appointment", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.resolveAppointmentForCheckoutAction.mockResolvedValue({
      success: true,
      status: "ready_for_checkout",
      sale: sale(),
    });

    render(<AgendaPage />);

    fireEvent.click(await screen.findByLabelText("Ações do agendamento"));

    await waitFor(() => {
      expect(mocks.deleteCalendarEvent).toHaveBeenCalledWith("google-1");
      expect(
        mocks.deleteAppointmentForCalendarEventAction,
      ).toHaveBeenCalledWith(googleEvent);
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Agendamento removido");
    });
  });
});
