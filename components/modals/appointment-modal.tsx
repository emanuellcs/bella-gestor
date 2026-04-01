"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { useData } from "@/lib/data-context";
import { AppointmentStatus } from "@/types";
import type { Appointment } from "@/types";
import { Loader2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zonedNowForInput } from "@/lib/utils";

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  mode: "create" | "edit";
  defaultDate?: string;
  defaultTime?: string;
}

export function AppointmentModal({
  open,
  onOpenChange,
  appointment,
  mode,
  defaultDate,
  defaultTime,
}: AppointmentModalProps) {
  const {
    clients,
    services,
    professionals,
    addAppointment,
    updateAppointment,
  } = useData();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );

  const [formData, setFormData] = useState({
    clientId: "",
    clientName: "",
    professionalId: "",
    serviceId: "", // New field for service
    variantId: "", // New field for variant
    startTime:
      defaultDate && defaultTime
        ? `${defaultDate}T${defaultTime}`
        : zonedNowForInput(),
    endTime: "",
    status: AppointmentStatus.SCHEDULED,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (appointment && mode === "edit") {
        // Assuming appointment.serviceVariants holds the main service/variant for simplicity
        const initialServiceVariant =
          appointment.serviceVariants?.[0]?.serviceVariantId;
        const service = services.find((s) =>
          s.variants?.some((v) => v.id === initialServiceVariant),
        );
        const variant = service?.variants?.find(
          (v) => v.id === initialServiceVariant,
        );

        setFormData({
          clientId: appointment.clientId || "",
          clientName: appointment.clientName || "",
          professionalId: appointment.professionalId || "",
          serviceId: service?.id || "",
          variantId: variant?.id || "",
          startTime: appointment.startTime
            ? appointment.startTime.substring(0, 16)
            : "",
          endTime: appointment.endTime
            ? appointment.endTime.substring(0, 16)
            : "",
          status: appointment.status || AppointmentStatus.SCHEDULED,
          notes: appointment.notes || "",
        });
        setSelectedServiceId(service?.id || null);
        setSelectedVariantId(variant?.id || null);
      } else if (mode === "create") {
        setFormData({
          clientId: "",
          clientName: "",
          professionalId: "",
          serviceId: "",
          variantId: "",
          startTime:
            defaultDate && defaultTime
              ? `${defaultDate}T${defaultTime}`
              : zonedNowForInput(),
          endTime: "",
          status: AppointmentStatus.SCHEDULED,
          notes: "",
        });
        setSelectedServiceId(null);
        setSelectedVariantId(null);
      }
    }
  }, [appointment, mode, open, defaultDate, defaultTime, services]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.clientId ||
      !formData.professionalId ||
      !selectedVariantId ||
      !formData.startTime
    ) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const selectedService = services.find((s) => s.id === selectedServiceId);
      const selectedVariant = selectedService?.variants?.find(
        (v) => v.id === selectedVariantId,
      );

      const appointmentPayload: Omit<Appointment, "id" | "created_at"> = {
        clientId: formData.clientId,
        professionalId: formData.professionalId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: formData.endTime
          ? new Date(formData.endTime).toISOString()
          : new Date(
              new Date(formData.startTime).getTime() +
                (selectedVariant?.duration || 30) * 60000,
            ).toISOString(),
        status: formData.status,
        notes: formData.notes,
        serviceVariants: [
          {
            serviceVariantId: selectedVariantId,
            quantity: 1,
          },
        ],
        totalPrice: selectedVariant?.price || 0,
      };

      let result;
      if (mode === "create") {
        result = await addAppointment(appointmentPayload);
      } else if (mode === "edit" && appointment) {
        result = await updateAppointment(appointment.id, appointmentPayload);
      }

      if (result) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar o agendamento.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        clientId: client.id,
        clientName: client.name,
      });
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setSelectedVariantId(null); // Reset variant when service changes
    setFormData((prev) => ({ ...prev, serviceId: serviceId, variantId: "" }));
  };

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    setFormData((prev) => ({ ...prev, variantId: variantId }));
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const availableVariants = selectedService?.variants || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo Agendamento" : "Editar Agendamento"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Crie um novo agendamento para um cliente."
              : "Atualize as informações do agendamento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente *</Label>
              <Combobox
                placeholder="Selecione um cliente"
                items={clients.map((c) => ({
                  value: c.id,
                  label: `${c.name} - ${c.phone}`,
                }))}
                value={formData.clientId}
                onChange={handleClientSelect}
                disabled={clients.length === 0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional">Profissional *</Label>
              <Combobox
                placeholder="Selecione a profissional"
                items={professionals.map((p) => ({
                  value: p.id,
                  label:
                    p.name + (p.functionTitle ? ` (${p.functionTitle})` : ""),
                }))}
                value={formData.professionalId}
                onChange={(val) =>
                  setFormData({ ...formData, professionalId: val })
                }
                disabled={professionals.length === 0}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service">Serviço *</Label>
              <Combobox
                placeholder="Selecione um serviço"
                items={services.map((s) => ({ value: s.id, label: s.name }))}
                value={selectedServiceId || ""}
                onChange={handleServiceSelect}
                disabled={services.length === 0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variant">Tipo de Serviço *</Label>
              <Combobox
                placeholder="Selecione uma tipo"
                items={availableVariants.map((v) => ({
                  value: v.id,
                  label: `${v.variantName} - R$${v.price.toFixed(2)} (${v.duration} min)`,
                }))}
                value={selectedVariantId || ""}
                onChange={handleVariantSelect}
                disabled={!selectedServiceId || availableVariants.length === 0}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Data e Hora de Início *</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">Data e Hora de Término</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as AppointmentStatus })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AppointmentStatus.SCHEDULED}>
                  Agendado
                </SelectItem>
                <SelectItem value={AppointmentStatus.CONFIRMED}>
                  Confirmado
                </SelectItem>
                <SelectItem value={AppointmentStatus.COMPLETED}>
                  Concluído
                </SelectItem>
                <SelectItem value={AppointmentStatus.CANCELLED}>
                  Cancelado
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Adicione observações sobre o agendamento..."
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {mode === "create"
                    ? "Criar Agendamento"
                    : "Salvar Alterações"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
