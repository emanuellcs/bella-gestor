"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { AppointmentStatus, Client, Service, Professional } from "@/types";
import { Loader2, Trash2 } from "lucide-react";

const appointmentSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente"),
  serviceId: z.string().min(1, "Selecione um serviço"),
  serviceVariantId: z.string().min(1, "Selecione um tipo de serviço"),
  professionalId: z.string().min(1, "Selecione uma profissional"),
  startTime: z.string().min(1, "Data de início é obrigatória"),
  endTime: z.string().min(1, "Data de término é obrigatória"),
  status: z.nativeEnum(AppointmentStatus),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface GoogleCalendarEvent {
  id: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

interface AppointmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEvent?: GoogleCalendarEvent | null;
  onSave: (data: AppointmentFormValues) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  clients: Client[];
  services: Service[];
  professionals: Professional[];
}

export function AppointmentFormModal({
  open,
  onOpenChange,
  selectedEvent,
  onSave,
  onDelete,
  clients,
  services,
  professionals,
}: AppointmentFormModalProps) {
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientId: "",
      serviceId: "",
      serviceVariantId: "",
      professionalId: "",
      startTime: "",
      endTime: "",
      status: AppointmentStatus.SCHEDULED,
      notes: "",
    },
  });

  const selectedServiceId = form.watch("serviceId");
  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId),
    [services, selectedServiceId],
  );

  const availableVariants = useMemo(
    () => selectedService?.variants || [],
    [selectedService],
  );

  // Parse Google Event to Form
  useEffect(() => {
    if (open) {
      if (selectedEvent) {
        // Parsing logic from the original page
        const desc = selectedEvent.description || "";
        const parseField = (label: string) => {
          const line = desc
            .split("\n")
            .find((p: string) => p.startsWith(label));
          return line ? line.replace(label, "").trim() : "";
        };

        const clientName = parseField("Cliente: ");
        const serviceName = parseField("Serviço: ");
        const professionalText = parseField("Profissional: ");
        const notes = parseField("Observações: ");

        const client = clients.find((c) => c.name === clientName);
        const service = services.find((s) => s.name === serviceName);
        const professional = professionals.find(
          (p) =>
            (p.name &&
              p.functionTitle &&
              `${p.name} (${p.functionTitle})` === professionalText) ||
            p.email === professionalText,
        );

        const toLocal = (iso: string) => {
          const d = new Date(iso);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate(),
          ).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes(),
          ).padStart(2, "0")}`;
        };

        form.reset({
          clientId: client?.id || "",
          serviceId: service?.id || "",
          serviceVariantId: "", // We might not be able to precisely map variant ID from text easily without exact name match
          professionalId: professional?.id || "",
          startTime: toLocal(selectedEvent.start.dateTime),
          endTime: toLocal(selectedEvent.end.dateTime),
          status: AppointmentStatus.SCHEDULED,
          notes,
        });
      } else {
        form.reset({
          clientId: "",
          serviceId: "",
          serviceVariantId: "",
          professionalId: "",
          startTime: "",
          endTime: "",
          status: AppointmentStatus.SCHEDULED,
          notes: "",
        });
      }
    }
  }, [open, selectedEvent, clients, services, professionals, form]);

  const onSubmit = async (values: AppointmentFormValues) => {
    await onSave(values);
  };

  const clientItems = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.name ? `${c.name} - ${c.phone}` : `(Sem nome) - ${c.phone}`,
      })),
    [clients],
  );

  const serviceItems = useMemo(
    () => services.map((s) => ({ value: s.id, label: s.name })),
    [services],
  );

  const professionalItems = useMemo(
    () =>
      professionals.map((p) => ({
        value: p.id,
        label:
          p.name && p.functionTitle
            ? `${p.name} (${p.functionTitle})`
            : p.email || "Profissional",
      })),
    [professionals],
  );

  const variantItems = useMemo(
    () =>
      availableVariants.map((v) => ({
        value: v.id,
        label: `${v.variantName} (${v.duration} min) - R$${v.price.toFixed(2)}`,
      })),
    [availableVariants],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {selectedEvent ? "Editar agendamento" : "Novo agendamento"}
          </DialogTitle>
          <DialogDescription>
            {selectedEvent
              ? "Atualize os dados do agendamento"
              : "Preencha os dados para criar um agendamento"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Cliente</FormLabel>
                    <Combobox
                      placeholder="Selecione o cliente"
                      items={clientItems}
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="professionalId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Profissional</FormLabel>
                    <Combobox
                      placeholder="Selecione a profissional"
                      items={professionalItems}
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Serviço</FormLabel>
                    <Combobox
                      placeholder="Selecione o serviço"
                      items={serviceItems}
                      value={field.value}
                      onChange={(val) => {
                        field.onChange(val);
                        form.setValue("serviceVariantId", "");
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceVariantId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Tipo de Serviço</FormLabel>
                    <Combobox
                      placeholder="Selecione o tipo"
                      items={variantItems}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={!selectedServiceId || variantItems.length === 0}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Término</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas internas..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              {selectedEvent && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto"
                  onClick={() => onDelete(selectedEvent.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedEvent ? "Salvar alterações" : "Criar agendamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
