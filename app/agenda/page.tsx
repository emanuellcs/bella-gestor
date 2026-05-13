"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/services/googleCalendarAppsScript";
import {
  completeAppointmentForCheckoutAction,
  deleteAppointmentForCalendarEventAction,
  resolveAppointmentForCheckoutAction,
  syncCalendarAppointmentFieldsAction,
} from "@/actions/appointment-reconciliation";
import { useData } from "@/lib/data-context";
import type { Appointment, Sale, Payment } from "@/types";
import { AppointmentStatus } from "@/types";

import { PageHeader } from "@/components/layout/page-header";
import { CalendarView } from "@/components/features/agenda/calendar-view";
import { AppointmentFormModal } from "@/components/features/agenda/appointment-form-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar as CalendarIcon,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";
import { CheckoutModal } from "@/components/modals/checkout-modal";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Array<{ email: string }>;
  internalStatus?: AppointmentStatus; // Injected for Rule 3 logic
  htmlLink?: string;
}

export default function AgendaPage() {
  const {
    clients,
    services,
    professionals,
    appointments: internalAppointments,
    isLoading: dataLoading,
    refreshData,
    addAppointment,
    updateAppointment,
  } = useData();

  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>(
    [],
  );
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isResolvingCheckout, setIsResolvingCheckout] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [checkoutSale, setCheckoutSale] = useState<Sale | null>(null);
  const [pendingCheckoutEvent, setPendingCheckoutEvent] =
    useState<GoogleCalendarEvent | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] =
    useState<GoogleCalendarEvent | null>(null);

  // Filters (Restored from main)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("");
  const [filterProfessionalId, setFilterProfessionalId] = useState("");

  const fetchEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - currentDate.getDay());
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const professional = professionals.find(
        (p) => p.id === filterProfessionalId,
      );
      const query = professional?.email ? professional.email : undefined;

      const resp = await listCalendarEvents(
        start.toISOString(),
        end.toISOString(),
        query,
      );
      if (resp?.success) {
        // Map Google events to internal status (Rule 3 Alignment)
        const events: GoogleCalendarEvent[] = (resp.events || []).map(
          (ev: GoogleCalendarEvent) => {
            const startTime = new Date(ev.start.dateTime).getTime();
            const matchedAppt = internalAppointments?.find((a) => {
              if (a.googleEventId && a.googleEventId === ev.id) return true;
              const aTime = new Date(a.startTime).getTime();
              return Math.abs(aTime - startTime) < 60000; // Match within 1 minute
            });
            return {
              ...ev,
              internalStatus: matchedAppt?.status,
            };
          },
        );
        setCalendarEvents(events);
      } else {
        toast.error(resp?.error || "Erro ao carregar agendamentos");
      }
    } catch {
      toast.error("Erro de conexão com o calendário");
    } finally {
      setIsLoadingEvents(false);
    }
  }, [currentDate, filterProfessionalId, professionals, internalAppointments]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return calendarEvents.filter((ev) => {
      const desc = (ev.description || "").toLowerCase();
      const summary = (ev.summary || "").toLowerCase();

      const matchSearch = !q || summary.includes(q) || desc.includes(q);

      const clientName = clients
        .find((c) => c.id === filterClientId)
        ?.name?.toLowerCase();
      const matchClient =
        !filterClientId || desc.includes(`cliente: ${clientName}`);

      const serviceName = services
        .find((s) => s.id === filterServiceId)
        ?.name?.toLowerCase();
      const matchService =
        !filterServiceId || desc.includes(`serviço: ${serviceName}`);

      const professional = professionals.find(
        (p) => p.id === filterProfessionalId,
      );
      const matchProfessional =
        !filterProfessionalId ||
        (professional &&
          ((ev.attendees || []).some(
            (a) => a.email.toLowerCase() === professional.email?.toLowerCase(),
          ) ||
            desc.includes(
              `profissional: ${professional.name?.toLowerCase()}`,
            )));

      return matchSearch && matchClient && matchService && matchProfessional;
    });
  }, [
    calendarEvents,
    searchQuery,
    filterClientId,
    filterServiceId,
    filterProfessionalId,
    clients,
    services,
    professionals,
  ]);

  const handleCheckout = async (ev: GoogleCalendarEvent) => {
    setIsResolvingCheckout(true);
    try {
      const result = await resolveAppointmentForCheckoutAction(ev);

      if (!result.success) {
        toast.error(result.error || "Falha ao preparar checkout.");
        return;
      }

      if (result.status === "ready_for_checkout") {
        setCheckoutSale(result.sale as Sale);
        return;
      }

      setPendingCheckoutEvent(ev);
      setSelectedEvent(ev);
      setIsModalOpen(true);
      toast.message(result.message);
    } finally {
      setIsResolvingCheckout(false);
    }
  };

  const handleSave = async (values: {
    clientId: string;
    serviceId: string;
    serviceVariantId: string;
    professionalId: string;
    notes?: string;
    startTime: string;
    endTime: string;
    customPrice: number;
    status?: AppointmentStatus;
  }) => {
    try {
      const client = clients.find((c) => c.id === values.clientId);
      const service = services.find((s) => s.id === values.serviceId);
      const variant = service?.variants?.find(
        (v) => v.id === values.serviceVariantId,
      );
      const professional = professionals.find(
        (p) => p.id === values.professionalId,
      );

      const customPrice = Number(values.customPrice ?? variant?.price ?? 0);
      const professionalLine = professional
        ? `\nProfissional: ${professional.name} (${professional.functionTitle})`
        : "";

      const hasStructuredData = Boolean(client && service && variant);
      const structuredDescription = hasStructuredData
        ? `Cliente: ${client?.name}\nTelefone: ${client?.phone}\nServiço: ${service?.name}\nTipo: ${variant?.variantName}\nValor: R$ ${customPrice.toFixed(2)}${professionalLine}${
            values.notes ? `\nObservações: ${values.notes}` : ""
          }`
        : values.notes || selectedEvent?.description || "";

      const googlePayload = {
        summary: hasStructuredData
          ? `${client?.name} - ${service?.name} (${variant?.variantName})`
          : selectedEvent?.summary || "Agendamento",
        description: structuredDescription,
        location: hasStructuredData
          ? "Spaço Bellas"
          : selectedEvent?.description
            ? undefined
            : "Spaço Bellas",
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString(),
        ...(hasStructuredData
          ? {
              attendees: [
                ...(client?.email ? [{ email: client.email }] : []),
                ...(professional?.email ? [{ email: professional.email }] : []),
              ],
            }
          : {}),
      };

      let res;
      if (selectedEvent) {
        res = await updateCalendarEvent(selectedEvent.id, googlePayload);
      } else {
        // Atomic Sync: DB First, then Google
        const supabasePayload: Omit<Appointment, "id" | "created_at"> = {
          clientId: values.clientId,
          professionalId: values.professionalId,
          startTime: new Date(values.startTime).toISOString(),
          endTime: new Date(values.endTime).toISOString(),
          status: AppointmentStatus.SCHEDULED,
          notes: values.notes,
          serviceVariants: [
            {
              serviceVariantId: values.serviceVariantId,
              quantity: 1,
              unitPrice: customPrice,
            },
          ],
          totalPrice: customPrice,
        };

        const supabaseRes = await addAppointment(supabasePayload);
        if (supabaseRes) {
          // Close modal immediately after successful DB save (independent operation)
          setIsModalOpen(false);
          toast.success("Agendamento criado!");
          // Attempt Google Calendar sync (non-blocking)
          res = await createCalendarEvent(googlePayload);
          if (!res?.success) {
            toast.error(res?.error || "Erro ao sincronizar com Google Agenda");
          } else if (res.eventId || res.event?.id) {
            await updateAppointment(supabaseRes.id, {
              googleEventId: res.eventId || res.event?.id,
            });
          }
        } else {
          throw new Error("Falha ao salvar no banco de dados.");
        }
      }

      if (res?.success) {
        if (selectedEvent) {
          const syncedEvent: GoogleCalendarEvent = {
            ...selectedEvent,
            summary: googlePayload.summary,
            description: googlePayload.description,
            start: { dateTime: googlePayload.startTime },
            end: { dateTime: googlePayload.endTime },
            attendees:
              "attendees" in googlePayload
                ? googlePayload.attendees
                : selectedEvent.attendees,
          };

          const syncRes = await syncCalendarAppointmentFieldsAction(
            syncedEvent,
            {
              clientId: values.clientId || undefined,
              professionalId: values.professionalId || undefined,
              startTime: googlePayload.startTime,
              endTime: googlePayload.endTime,
              notes: values.notes || undefined,
              status: values.status,
            },
          );

          if (!syncRes.success) {
            toast.error(syncRes.error || "Falha ao atualizar vínculo interno.");
            return;
          }

          const hasFinancialDetails = Boolean(
            values.clientId &&
            values.professionalId &&
            values.serviceVariantId &&
            Number.isFinite(customPrice),
          );

          if (hasFinancialDetails) {
            const completeRes = await completeAppointmentForCheckoutAction(
              syncedEvent,
              {
                appointmentId: syncRes.appointmentId || undefined,
                clientId: values.clientId,
                professionalId: values.professionalId,
                serviceVariantId: values.serviceVariantId,
                unitPrice: customPrice,
                quantity: 1,
                notes: values.notes || undefined,
                startTime: googlePayload.startTime,
                endTime: googlePayload.endTime,
                status: values.status,
              },
            );

            if (!completeRes.success) {
              toast.error(
                completeRes.error || "Falha ao completar dados financeiros.",
              );
              return;
            }

            if (pendingCheckoutEvent?.id === selectedEvent.id) {
              setCheckoutSale(completeRes.sale as Sale);
            }
          }

          // Edit mode: only show success toast for Google Calendar result
          toast.success("Agendamento atualizado!");
          setPendingCheckoutEvent(null);
          setIsModalOpen(false);
        }
        refreshData();
        fetchEvents();
      } else if (selectedEvent) {
        // Edit mode: Google Calendar sync failed
        toast.error(res?.error || "Erro ao atualizar no Google Agenda");
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha ao salvar agendamento");
    }
  };

  const handleDelete = async (target: string | GoogleCalendarEvent) => {
    const event =
      typeof target === "string"
        ? selectedEvent?.id === target
          ? selectedEvent
          : calendarEvents.find((item) => item.id === target)
        : target;
    const id = typeof target === "string" ? target : target.id;

    if (
      !confirm(
        "Tem certeza que deseja remover este agendamento do Google Agenda?",
      )
    )
      return;
    try {
      const res = await deleteCalendarEvent(id);
      if (res?.success) {
        if (event) {
          const internalRes =
            await deleteAppointmentForCalendarEventAction(event);
          if (!internalRes.success) {
            toast.error(
              internalRes.error ||
                "Evento removido do Google, mas falhou ao atualizar o vínculo interno.",
            );
            return;
          }
        }
        toast.success("Agendamento removido");
        refreshData();
        fetchEvents();
      } else {
        toast.error(res?.error || "Erro ao excluir");
      }
    } catch {
      toast.error("Falha ao excluir");
    }
  };

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Agenda"
        description="Gerencie agendamentos sincronizados com Google Calendar"
      />

      {/* Rich Filter Bar (Restored from main) */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar agendamentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Combobox
              placeholder="Filtrar Cliente"
              items={clients.map((c) => ({ value: c.id, label: c.name }))}
              value={filterClientId}
              onChange={setFilterClientId}
            />
            <Combobox
              placeholder="Filtrar Serviço"
              items={services.map((s) => ({ value: s.id, label: s.name }))}
              value={filterServiceId}
              onChange={setFilterServiceId}
            />
            <Combobox
              placeholder="Filtrar Profissional"
              items={professionals.map((p) => ({
                value: p.id,
                label: p.name || p.email || "Profissional",
              }))}
              value={filterProfessionalId}
              onChange={setFilterProfessionalId}
            />
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setFilterClientId("");
                setFilterServiceId("");
                setFilterProfessionalId("");
              }}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() - 7);
              setCurrentDate(d);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={(date) => date && setCurrentDate(date)}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() + 7);
              setCurrentDate(d);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchEvents()}
            disabled={isLoadingEvents}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoadingEvents ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <div className="text-lg font-semibold uppercase">
          {currentDate.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </div>
        <Button
          onClick={() => {
            setSelectedEvent(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
        </Button>
      </div>

      <CalendarView
        currentDate={currentDate}
        events={filteredEvents}
        isLoading={isLoadingEvents || dataLoading || isResolvingCheckout}
        onEdit={(ev) => {
          setSelectedEvent(ev);
          setIsModalOpen(true);
        }}
        onDelete={(ev) => handleDelete(ev)}
        onCheckout={handleCheckout}
      />

      <AppointmentFormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setPendingCheckoutEvent(null);
        }}
        selectedEvent={selectedEvent}
        onSave={handleSave}
        onDelete={(id) => handleDelete(id)}
        clients={clients}
        services={services}
        professionals={professionals}
        requireFinancialDetails={!!pendingCheckoutEvent}
      />

      {checkoutSale && (
        <CheckoutModal
          isOpen={!!checkoutSale}
          onClose={() => setCheckoutSale(null)}
          saleId={Number(checkoutSale.id)}
          clientName={checkoutSale.clientName || "Cliente"}
          totalAmount={Number(checkoutSale.totalAmount)}
          alreadyPaidAmount={(checkoutSale.payments || [])
            .filter((p: Payment) => p.status === "paid")
            .reduce((acc: number, p: Payment) => acc + Number(p.amount), 0)}
          onSuccess={() => {
            refreshData();
            setCheckoutSale(null);
          }}
        />
      )}
    </div>
  );
}
