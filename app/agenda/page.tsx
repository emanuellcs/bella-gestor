"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/services/googleCalendarAppsScript";
import { useClients } from "@/hooks/features/use-clients";
import { useServices } from "@/hooks/features/use-services";
import { useData } from "@/lib/data-context"; // Still needed for professionals until refactored

import { CalendarView } from "@/components/features/agenda/calendar-view";
import { AppointmentFormModal } from "@/components/features/agenda/appointment-form-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

export default function AgendaPage() {
  const { clients, refreshClients } = useClients();
  const { services, refreshServices } = useServices();
  const { professionals } = useData();
  const [appointments, setAppointments] = useState<GoogleCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] =
    useState<GoogleCalendarEvent | null>(null);

  useEffect(() => {
    refreshClients();
    refreshServices(true); // only active
  }, [refreshClients, refreshServices]);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - currentDate.getDay());
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const resp = await listCalendarEvents(
        start.toISOString(),
        end.toISOString(),
      );
      if (resp?.success) {
        setAppointments(resp.events || []);
      } else {
        toast.error(resp?.error || "Erro ao carregar agendamentos");
      }
    } catch {
      toast.error("Erro de conexão com o calendário");
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return appointments.filter((ev) => {
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

      return matchSearch && matchClient && matchService;
    });
  }, [
    appointments,
    searchQuery,
    filterClientId,
    filterServiceId,
    clients,
    services,
  ]);

  const handleSave = async (values: {
    clientId: string;
    serviceId: string;
    serviceVariantId: string;
    professionalId: string;
    notes?: string;
    startTime: string;
    endTime: string;
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

      const professionalLine = professional
        ? `\nProfissional: ${professional.fullName} (${professional.functionTitle})`
        : "";

      const payload = {
        summary: `${client?.name} - ${service?.name} (${variant?.variantName})`,
        description: `Cliente: ${client?.name}\nTelefone: ${client?.phone}\nServiço: ${service?.name}\nTipo: ${variant?.variantName}${professionalLine}${
          values.notes ? `\nObservações: ${values.notes}` : ""
        }`,
        location: "Spaço Bellas",
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString(),
        attendees: [
          ...(client?.email ? [{ email: client.email }] : []),
          ...(professional?.email ? [{ email: professional.email }] : []),
        ],
      };

      let res;
      if (selectedEvent) {
        res = await updateCalendarEvent(selectedEvent.id, payload);
      } else {
        res = await createCalendarEvent(payload);
      }

      if (res?.success) {
        toast.success(
          selectedEvent ? "Agendamento atualizado!" : "Agendamento criado!",
        );
        setIsModalOpen(false);
        fetchEvents();
      } else {
        toast.error(res?.error || "Erro ao salvar no Google Agenda");
      }
    } catch {
      toast.error("Falha ao salvar agendamento");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;
    try {
      const res = await deleteCalendarEvent(id);
      if (res?.success) {
        toast.success("Agendamento excluído");
        setIsModalOpen(false);
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus agendamentos sincronizados com Google Calendar
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setFilterClientId("");
                setFilterServiceId("");
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
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
              className="h-9"
              onClick={() => setCurrentDate(new Date())}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="md:hidden text-lg font-semibold truncate">
            {currentDate
              .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
              .toUpperCase()}
          </div>
        </div>

        <div className="hidden md:block text-lg font-semibold">
          {currentDate
            .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
            .toUpperCase()}
        </div>

        <Button
          className="w-full md:w-auto"
          onClick={() => {
            setSelectedEvent(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      <CalendarView
        currentDate={currentDate}
        events={filteredEvents}
        isLoading={isLoading}
        onEdit={(ev) => {
          setSelectedEvent(ev);
          setIsModalOpen(true);
        }}
        onDelete={(ev) => handleDelete(ev.id)}
      />

      <AppointmentFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        selectedEvent={selectedEvent}
        onSave={handleSave}
        onDelete={handleDelete}
        clients={clients}
        services={services}
        professionals={professionals}
      />
    </div>
  );
}
