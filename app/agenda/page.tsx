"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/services/googleCalendarAppsScript";
import { useData } from "@/lib/data-context";
import type { Appointment, Professional } from "@/types";
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
  Plus,
  Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Array<{ email: string }>;
}

function professionalDisplay(p: Professional) {
  const name = p.name ?? (p as { fullName?: string }).fullName;
  return name && p.functionTitle
    ? `${name} (${p.functionTitle})`
    : (p.email ?? "Sem e-mail");
}

export default function AgendaPage() {
  const {
    clients,
    services,
    professionals,
    isLoading: dataLoading,
    refreshData,
    addAppointment,
  } = useData();
  const [appointments, setAppointments] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const isLoading = dataLoading || isLoadingEvents;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("");
  const [filterProfessionalId, setFilterProfessionalId] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] =
    useState<GoogleCalendarEvent | null>(null);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

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
        setAppointments(resp.events || []);
      } else {
        toast.error(resp?.error || "Erro ao carregar agendamentos");
      }
    } catch {
      toast.error("Erro de conexão com o calendário");
    } finally {
      setIsLoadingEvents(false);
    }
  }, [currentDate, filterProfessionalId, professionals]);

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
    appointments,
    searchQuery,
    filterClientId,
    filterServiceId,
    filterProfessionalId,
    clients,
    services,
    professionals,
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
        ? `\nProfissional: ${professional.name} (${professional.functionTitle})`
        : "";

      const googlePayload = {
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
        res = await updateCalendarEvent(selectedEvent.id, googlePayload);
        // For simplicity, we only sync new appointments to Supabase for now as per instructions.
        // In a full implementation, we would also update the Supabase record here.
      } else {
        res = await createCalendarEvent(googlePayload);

        // Supabase Integration (Registers Appointment and Sale)
        if (res?.success) {
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
              },
            ],
            totalPrice: variant?.price || 0,
          };
          if (addAppointment) {
            await addAppointment(supabasePayload);
          }
        }
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
    } catch (e) {
      console.error(e);
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
      <PageHeader
        title="Agenda"
        description="Gerencie seus agendamentos sincronizados com Google Calendar"
      />

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
                label: professionalDisplay(p),
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
              className="h-9 px-3"
              onClick={() => setCurrentDate(new Date())}
            >
              Hoje
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
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
