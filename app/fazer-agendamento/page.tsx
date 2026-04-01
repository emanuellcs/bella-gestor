"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  createCalendarEvent,
  listCalendarEvents,
} from "@/services/googleCalendarAppsScript";
import type { Professional, Appointment } from "@/types";
import { AppointmentStatus } from "@/types";
import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  CalendarPlus,
  CalendarSearch,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import { formatBrazilianPhone, unformatPhone } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CalendarView } from "@/components/features/agenda/calendar-view";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";

// ─── Reusable Combobox ────────────────────────────────────────────────────────
function CustomCombobox({
  placeholder,
  items,
  value,
  onChange,
  emptyText = "Nenhum item encontrado",
  disabled,
}: {
  placeholder: string;
  items: { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (v: string) => void;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-10"
          disabled={disabled}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList className="max-h-60 overflow-auto overscroll-contain">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((it, i) => (
                <CommandItem
                  key={`${it.value}-${i}`}
                  value={[it.label, it.hint].filter(Boolean).join(" ")}
                  onSelect={() => {
                    onChange(it.value);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{it.label}</span>
                  {value === it.value ? <Check className="h-4 w-4" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AppointmentFormData {
  clientId: string;
  serviceId: string;
  serviceVariantId: string;
  professionalId: string;
  startTime: string;
  endTime: string;
  notes: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: Array<{ email: string }>;
  htmlLink?: string;
}

export default function CreateAppointmentPage() {
  const { toast } = useToast();
  const {
    clients: allClients,
    services: allServices,
    professionals,
    refreshData,
    addAppointment,
    isLoading: isDataLoading,
  } = useData();

  const clients = useMemo(
    () =>
      (allClients || []).filter(
        (c) =>
          c.status === "active" || (c as { is_active?: boolean }).is_active,
      ),
    [allClients],
  );

  const services = useMemo(
    () =>
      (allServices || []).filter(
        (s) => s.active || (s as { is_active?: boolean }).is_active,
      ),
    [allServices],
  );

  // ── Create appointment state ──────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialFormState: AppointmentFormData = {
    clientId: "",
    serviceId: "",
    serviceVariantId: "",
    professionalId: "",
    startTime: "",
    endTime: "",
    notes: "",
  };
  const [formData, setFormData] =
    useState<AppointmentFormData>(initialFormState);

  // ── View appointments state ───────────────────────────────────────────────
  const [viewChoiceOpen, setViewChoiceOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "own">("all");
  const [filterProfId, setFilterProfId] = useState("");
  const [viewEvents, setViewEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (allClients.length === 0 && !isDataLoading) {
      void refreshData();
    }
  }, [refreshData, allClients.length, isDataLoading]);

  // ── Fetch events ──────────────────────────────────────────────────────────
  const fetchEvents = useCallback(
    async (mode: "all" | "own", professionalId: string, date: Date) => {
      setLoadingEvents(true);
      try {
        const start = new Date(date);
        start.setDate(start.getDate() - date.getDay());
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        // For "own" mode, pass the professional's email as a search query
        const professional = professionals.find((p) => p.id === professionalId);
        const query =
          mode === "own" && professional?.email
            ? professional.email
            : undefined;

        const result = await listCalendarEvents(
          start.toISOString(),
          end.toISOString(),
          query,
        );

        if (!result.success) {
          toast({
            variant: "destructive",
            title: "Erro ao carregar agenda",
            description:
              result.error || "Não foi possível buscar os agendamentos.",
          });
          setViewEvents([]);
          return;
        }

        let events: CalendarEvent[] = result.events || [];

        // Client-side filter: check attendees array AND professional name in description
        if (mode === "own" && professional?.email) {
          const profEmail = professional.email.toLowerCase();
          const profName = (professional.name || "").toLowerCase();

          events = events.filter((ev) => {
            const inAttendees = (ev.attendees || []).some(
              (a) => a.email.toLowerCase() === profEmail,
            );
            const inDescription = (ev.description || "")
              .toLowerCase()
              .includes(`profissional: ${profName}`);
            return inAttendees || inDescription;
          });
        }

        setViewEvents(events);
      } finally {
        setLoadingEvents(false);
      }
    },
    [professionals, toast],
  );

  useEffect(() => {
    if (!viewOpen) return;
    if (viewMode === "own" && !filterProfId) {
      setViewEvents([]);
      return;
    }
    void fetchEvents(viewMode, filterProfId, currentDate);
  }, [viewOpen, viewMode, filterProfId, currentDate, fetchEvents]);

  // ── Filtered events for display ───────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return viewEvents;

    return viewEvents.filter((ev) => {
      const desc = (ev.description || "").toLowerCase();
      const summary = (ev.summary || "").toLowerCase();
      return summary.includes(q) || desc.includes(q);
    });
  }, [viewEvents, searchQuery]);

  // ── Choice dialog handlers ────────────────────────────────────────────────
  function handleChooseAll() {
    setViewChoiceOpen(false);
    setViewMode("all");
    setFilterProfId("");
    setViewOpen(true);
  }

  function handleChooseOwn() {
    setViewChoiceOpen(false);
    setViewMode("own");
    setFilterProfId("");
    setViewOpen(true);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function professionalDisplay(p: Professional) {
    const name = p.name ?? (p as { fullName?: string }).fullName;
    return name && p.functionTitle
      ? `${name} (${p.functionTitle})`
      : (p.email ?? "Sem e-mail");
  }

  // ── Create appointment ────────────────────────────────────────────────────
  const selectedService = useMemo(
    () => services.find((s) => s.id === formData.serviceId),
    [services, formData.serviceId],
  );

  const availableVariants = useMemo(
    () =>
      (selectedService?.variants || []).map((v) => ({
        value: v.id,
        label: `${v.variantName} (${v.duration} min) - R$${v.price.toFixed(2)}`,
      })),
    [selectedService],
  );

  const clientItems = useMemo(
    () =>
      (clients || []).map((c) => {
        const phoneLabel = c.phone ? formatBrazilianPhone(c.phone) : "";
        return {
          value: c.id,
          label: c.name ? `${c.name} - ${phoneLabel}` : `(Sem nome)`,
          hint: c.phone ? unformatPhone(c.phone) : "",
        };
      }),
    [clients],
  );

  const serviceItems = useMemo(
    () => (services || []).map((s) => ({ value: s.id, label: s.name })),
    [services],
  );

  const professionalItems = useMemo(
    () =>
      professionals.map((p) => ({
        value: p.id,
        label: professionalDisplay(p),
      })),
    [professionals],
  );

  async function onSave() {
    if (
      !formData.clientId ||
      !formData.serviceId ||
      !formData.serviceVariantId ||
      !formData.professionalId ||
      !formData.startTime ||
      !formData.endTime
    ) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos antes de salvar.",
      });
      return;
    }

    const c = clients.find((x) => x.id === formData.clientId);
    const s = services.find((x) => x.id === formData.serviceId);
    const sv = selectedService?.variants?.find(
      (x) => x.id === formData.serviceVariantId,
    );
    const prof = professionals.find((x) => x.id === formData.professionalId);

    if (!c || !s || !sv) {
      toast({ variant: "destructive", title: "Dados inválidos" });
      return;
    }

    const profLine = prof ? `\nProfissional: ${professionalDisplay(prof)}` : "";
    setSaving(true);

    try {
      const googlePayload = {
        summary: `${c.name} - ${s.name} (${sv.variantName})`,
        description: `Cliente: ${c.name}\nTelefone: ${c.phone}\nServiço: ${s.name}\nTipo: ${sv.variantName}${profLine}${
          formData.notes ? `\nObservações: ${formData.notes}` : ""
        }`,
        location: "Spaço Bellas",
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        attendees: [
          ...(c.email ? [{ email: c.email }] : []),
          ...(prof?.email ? [{ email: prof.email }] : []),
        ],
      };

      const googleRes = await createCalendarEvent(googlePayload);
      if (!googleRes?.success)
        throw new Error(
          googleRes?.error || "Erro ao criar agendamento no Google",
        );

      const supabasePayload: Omit<Appointment, "id" | "created_at"> = {
        clientId: formData.clientId,
        professionalId: formData.professionalId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: formData.endTime
          ? new Date(formData.endTime).toISOString()
          : new Date(
              new Date(formData.startTime).getTime() +
                (sv.duration || 30) * 60000,
            ).toISOString(),
        status: AppointmentStatus.SCHEDULED,
        notes: formData.notes,
        serviceVariants: [
          { serviceVariantId: formData.serviceVariantId, quantity: 1 },
        ],
        totalPrice: sv.price,
      };

      const supabaseRes = await addAppointment(supabasePayload);
      if (!supabaseRes)
        throw new Error("Erro ao registrar agendamento no banco de dados.");

      toast({
        title: "Agendamento criado!",
        description: `${c.name} agendado para ${new Date(formData.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      });
      setFormOpen(false);
      setFormData(initialFormState);
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Ocorreu um erro ao salvar o agendamento.";
      toast({
        variant: "destructive",
        title: "Falha ao criar",
        description: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  }

  if (isDataLoading && allClients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Carregando dados...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-6 bg-gradient-to-b from-background to-muted/20">
      <div className="text-center space-y-4 max-w-2xl px-4">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-primary">
          Agendamentos
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground">
          Crie um novo agendamento ou visualize os agendamentos existentes no
          Spaço Bellas.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md px-4">
        <Button
          size="lg"
          onClick={() => setFormOpen(true)}
          className="w-full sm:flex-1 h-16 text-lg font-semibold shadow-xl hover:scale-105 transition-transform"
        >
          <CalendarPlus className="mr-3 h-6 w-6" />
          Novo Agendamento
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={() => setViewChoiceOpen(true)}
          className="w-full sm:flex-1 h-16 text-lg font-semibold shadow-md hover:bg-muted transition-colors"
        >
          <CalendarSearch className="mr-3 h-6 w-6" />
          Ver Agenda
        </Button>
      </div>

      {/* Choice Dialog */}
      <Dialog open={viewChoiceOpen} onOpenChange={setViewChoiceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Visualizar agendamentos</DialogTitle>
            <DialogDescription>
              Escolha quais agendamentos você deseja ver.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <button
              type="button"
              onClick={handleChooseAll}
              className="flex items-center gap-3 rounded-md border p-4 text-left hover:bg-muted transition"
            >
              <Users className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <div className="font-medium">Todos os agendamentos</div>
                <div className="text-sm text-muted-foreground">
                  Visualizar a agenda completa
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={handleChooseOwn}
              className="flex items-center gap-3 rounded-md border p-4 text-left hover:bg-muted transition"
            >
              <User className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <div className="font-medium">Meus agendamentos</div>
                <div className="text-sm text-muted-foreground">
                  Filtrar por profissional
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full View Dialog */}
      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setViewEvents([]);
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {viewMode === "all"
                ? "Todos os Agendamentos"
                : "Meus Agendamentos"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4 pr-1">
            {/* Calendar Controls (similar to /agenda) */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar agendamentos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {viewMode === "own" && (
                    <CustomCombobox
                      placeholder="Profissional..."
                      items={professionalItems}
                      value={filterProfId}
                      onChange={setFilterProfId}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
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
                      className="h-10 px-4"
                      onClick={() => setCurrentDate(new Date())}
                    >
                      Hoje
                    </Button>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                        >
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
                      className="h-10 w-10"
                      onClick={() => {
                        const d = new Date(currentDate);
                        d.setDate(d.getDate() + 7);
                        setCurrentDate(d);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 text-center text-lg font-semibold uppercase">
                  {currentDate.toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </CardContent>
            </Card>

            {viewMode === "own" && !filterProfId ? (
              <p className="text-center text-muted-foreground py-10 text-sm">
                Selecione um profissional acima para ver os agendamentos.
              </p>
            ) : (
              <CalendarView
                currentDate={currentDate}
                events={filteredEvents}
                isLoading={loadingEvents}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para sincronizar com o Google Calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Cliente</label>
                <CustomCombobox
                  placeholder="Selecione o cliente"
                  items={clientItems}
                  value={formData.clientId}
                  onChange={(v) => setFormData((p) => ({ ...p, clientId: v }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Serviço</label>
                <CustomCombobox
                  placeholder="Selecione o serviço"
                  items={serviceItems}
                  value={formData.serviceId}
                  onChange={(v) =>
                    setFormData((p) => ({
                      ...p,
                      serviceId: v,
                      serviceVariantId: "",
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tipo de Serviço</label>
                <CustomCombobox
                  placeholder="Selecione o tipo"
                  items={availableVariants}
                  value={formData.serviceVariantId}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, serviceVariantId: v }))
                  }
                  disabled={
                    !formData.serviceId || availableVariants.length === 0
                  }
                  emptyText={
                    formData.serviceId
                      ? "Nenhum tipo encontrado"
                      : "Selecione um serviço primeiro"
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Profissional</label>
                <CustomCombobox
                  placeholder="Selecione a profissional"
                  items={professionalItems}
                  value={formData.professionalId}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, professionalId: v }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Data/Hora Início</label>
                <Input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, startTime: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Data/Hora Término</label>
                <Input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, endTime: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Observações</label>
              <Input
                value={formData.notes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Notas internas (opcional)"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Agendamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
