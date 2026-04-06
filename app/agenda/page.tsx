"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  listCalendarEvents,
  deleteCalendarEvent,
} from "@/services/googleCalendarAppsScript";
import { useData } from "@/lib/data-context";
import type { Sale, Payment } from "@/types";
import { AppointmentStatus } from "@/types";

import { PageHeader } from "@/components/layout/page-header";
import { CalendarView } from "@/components/features/agenda/calendar-view";
import { AppointmentFormModal } from "@/components/features/agenda/appointment-form-modal";
import { CheckoutModal } from "@/components/modals/checkout-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";

type AppointmentFormValues = {
  clientId: string;
  serviceId: string;
  serviceVariantId: string;
  professionalId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
};

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Array<{ email: string }>;
}

export default function AgendaPage() {
  const {
    clients,
    services,
    professionals,
    isLoading: dataLoading,
    refreshData,
    appointments: internalAppointments,
    sales,
  } = useData();
  
  const [appointments, setAppointments] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const isLoading = dataLoading || isLoadingEvents;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProfessionalId, setFilterProfessionalId] = useState("");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GoogleCalendarEvent | null>(null);
  const [checkoutSale, setCheckoutSale] = useState<Sale | null>(null);
  const [isSearchingSale, setIsSearchingSale] = useState(false);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  /**
   * handleCheckout: Resolves Rule 3 (End-of-day reconciliation).
   * Finds the internal sale linked to a Google Calendar event to open the CheckoutModal.
   */
  const handleCheckout = async (ev: GoogleCalendarEvent) => {
    setIsSearchingSale(true);
    try {
      // Helper to parse description labels
      const parseField = (desc: string | undefined, label: string) => {
        const line = (desc || "").split("\n").find((p) => p.startsWith(label));
        return line ? line.replace(label, "").trim() : "";
      };

      const clientName = parseField(ev.description, "Cliente: ");
      const startTime = new Date(ev.start.dateTime).getTime();

      // 1. Find the internal appointment that matches this Google Event
      const matchedAppt = internalAppointments?.find(a => {
        const aTime = new Date(a.startTime).getTime();
        const aClient = clients.find(c => c.id === a.clientId)?.name;
        // Match by timestamp (within 1 min margin) and client name
        return Math.abs(aTime - startTime) < 60000 && aClient === clientName;
      });

      if (!matchedAppt) {
        toast.error("Vínculo interno não encontrado para este agendamento.");
        return;
      }

      // 2. Find the pending sale linked to this appointment
      const sale = sales?.find(s => s.appointmentId === matchedAppt.id);
      
      if (!sale) {
        toast.error("Nenhuma venda pendente encontrada para este agendamento.");
        return;
      }

      if (sale.status === 'paid') {
        toast.info("Este agendamento já consta como pago.");
        return;
      }

      setCheckoutSale(sale);
    } catch (err) {
      console.error("Error linking sale:", err);
      toast.error("Erro ao carregar dados financeiros do agendamento.");
    } finally {
      setIsSearchingSale(false);
    }
  };

  const fetchEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - currentDate.getDay());
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const professional = professionals.find((p) => p.id === filterProfessionalId);
      const query = professional?.email ? professional.email : undefined;

      const resp = await listCalendarEvents(start.toISOString(), end.toISOString(), query);
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

      const professional = professionals.find((p) => p.id === filterProfessionalId);
      const matchProfessional =
        !filterProfessionalId ||
        (professional &&
          ((ev.attendees || []).some(
            (a) => a.email.toLowerCase() === professional.email?.toLowerCase(),
          ) ||
            desc.includes(`profissional: ${professional.name?.toLowerCase()}`)));

      return matchSearch && matchProfessional;
    });
  }, [appointments, searchQuery, filterProfessionalId, professionals]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSave = async (_: AppointmentFormValues) => {
    // Existing logic...
    await refreshData();
    fetchEvents();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    // Existing logic...
    await deleteCalendarEvent(id);
    fetchEvents();
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <PageHeader title="Agenda" description="Gerencie agendamentos e horários." />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou serviço..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Combobox
                placeholder="Profissional"
                items={professionals.map((p) => ({
                  label: p.name || p.email || "",
                  value: p.id,
                }))}
                value={filterProfessionalId}
                onChange={setFilterProfessionalId}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {currentDate.toLocaleDateString("pt-BR")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(d) => d && setCurrentDate(d)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
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
                onClick={() => {
                  setSelectedEvent(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CalendarView
        currentDate={currentDate}
        events={filteredEvents}
        isLoading={isLoading}
        onEdit={(ev) => {
          setSelectedEvent(ev);
          setIsModalOpen(true);
        }}
        onDelete={(ev) => handleDelete(ev.id)}
        onCheckout={handleCheckout}
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

      {isSearchingSale && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

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
          onSuccess={(isFullyPaid) => {
            refreshData();
            if (isFullyPaid) setCheckoutSale(null);
          }}
        />
      )}
    </div>
  );
}
