"use client";

import { useEffect, useMemo, useState } from "react";

// Backend
import { createCalendarEvent } from "@/services/googleCalendarAppsScript";

// Types and Context
import type { Professional } from "@/types";
import { useData } from "@/lib/data-context";

// UI Components
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
} from "lucide-react";

// Utils and Hooks
import { formatBrazilianPhone, unformatPhone } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast"; // Ensure this hook is configured

interface AppointmentFormData {
  clientId: string;
  serviceId: string;
  serviceVariantId: string;
  professionalId: string;
  startTime: string;
  endTime: string;
  notes: string;
}

/* --- Reusable Combobox --- */
function Combobox({
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

export default function CreateAppointmentPage() {
  const { toast } = useToast();

  // Global data
  const {
    clients: allClients,
    services: allServices,
    professionals,
    refreshData,
  } = useData();

  const clients = useMemo(
    () => (allClients || []).filter((c) => c.status === "active" || (c as { is_active?: boolean }).is_active),
    [allClients],
  );

  const services = useMemo(
    () => (allServices || []).filter((s) => s.active || (s as { is_active?: boolean }).is_active),
    [allServices],
  );

  // Form state
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

  // Load initial data
  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // Memoized form options
  const clientItems = useMemo(
    () =>
      (clients || []).map((c) => {
        const phoneLabel = c.phone ? formatBrazilianPhone(c.phone) : "";
        const phoneDigits = c.phone ? unformatPhone(c.phone) : "";
        return {
          value: c.id,
          label: c.name
            ? `${c.name} - ${phoneLabel}`
            : `(Sem nome)${phoneLabel ? ` - ${phoneLabel}` : ""}`,
          hint: phoneDigits,
        };
      }),
    [clients],
  );

  const serviceItems = useMemo(
    () =>
      (services || []).map((s) => ({
        value: s.id,
        label: s.name || "(Sem nome)",
      })),
    [services],
  );

  const professionalItems = useMemo(
    () =>
      professionals.map((p) => {
        const displayName = p.name ?? (p as { fullName?: string }).fullName;
        return {
          value: p.id,
          label:
            displayName && p.functionTitle
              ? `${displayName} (${p.functionTitle})`
              : (p.email ?? "Sem e-mail"),
        };
      }),
    [professionals],
  );

  // Selected service variant logic
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

  // Helper to display professional's name
  function professionalDisplay(p: Professional) {
    const displayName = p.name ?? (p as { fullName?: string }).fullName;
    return displayName && p.functionTitle
      ? `${displayName} (${p.functionTitle})`
      : (p.email ?? "Sem e-mail");
  }

  // Actions
  function openCreate() {
    setFormData(initialFormState);
    setFormOpen(true);
  }

  async function onSave() {
    // Basic validation
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
        description: "Por favor, preencha todos os campos antes de salvar.",
      });
      return;
    }

    const c = clients.find((x) => x.id === formData.clientId);
    const s = services.find((x) => x.id === formData.serviceId);
    const sv = selectedService?.variants?.find(
      (x) => x.id === formData.serviceVariantId,
    );
    const selectedProfessional = professionals.find(
      (x) => x.id === formData.professionalId,
    );

    if (!c || !s || !sv) {
      toast({
        variant: "destructive",
        title: "Erro nos dados",
        description: "Cliente ou serviço selecionado é inválido.",
      });
      return;
    }

    const professionalLine = selectedProfessional
      ? `\nProfissional: ${professionalDisplay(selectedProfessional)}`
      : "";

    setSaving(true);
    try {
      const payload = {
        summary: `${c.name} - ${s.name} (${sv.variantName})`,
        description: `Cliente: ${c.name}\nTelefone: ${c.phone}\nServiço: ${s.name}\nTipo: ${sv.variantName}${professionalLine}${
          formData.notes ? `\nObservações: ${formData.notes}` : ""
        }`,
        location: "Spaço Bellas",
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        attendees: [
          ...(c.email ? [{ email: c.email }] : []),
          ...(selectedProfessional?.email
            ? [{ email: selectedProfessional.email }]
            : []),
        ],
      };

      const r = await createCalendarEvent(payload);
      if (!r?.success) throw new Error(r?.error || "Erro ao criar agendamento");

      // Success
      toast({
        title: "Agendamento criado!",
        description: `${c.name} agendado para ${new Date(
          formData.startTime,
        ).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}.`,
      });

      setFormOpen(false);
      setFormData(initialFormState);
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Falha ao criar",
        description: "Ocorreu um erro ao tentar salvar no Google Calendar.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Novo Agendamento</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Clique no botão abaixo para abrir o formulário e registrar um novo
          atendimento na agenda.
        </p>
      </div>

      <Button
        size="lg"
        onClick={openCreate}
        className="h-12 px-8 text-base shadow-lg"
      >
        <CalendarPlus className="mr-2 h-5 w-5" />
        Criar Agendamento
      </Button>

      {/* Creation Modal */}
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
                <Combobox
                  placeholder="Selecione o cliente"
                  items={clientItems}
                  value={formData.clientId}
                  onChange={(v) => setFormData((p) => ({ ...p, clientId: v }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Serviço</label>
                <Combobox
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
                <Combobox
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
                <Combobox
                  placeholder="Selecione a profissional"
                  items={professionalItems}
                  value={formData.professionalId}
                  onChange={(v) =>
                    setFormData((p) => ({ ...p, professionalId: v }))
                  }
                  emptyText={
                    professionals.length
                      ? "Nenhuma profissional encontrada"
                      : "Carregando..."
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
