"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { 
  getAppointments, 
  getAppointmentsByDateRange 
} from "@/services/appointments";
import { 
  createAppointmentAction, 
  updateAppointmentAction, 
  deleteAppointmentAction 
} from "@/actions/appointments";
import { Appointment } from "@/types";

/**
 * Hook to manage appointments state and operations.
 */
export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAppointments = useCallback(async (startDate?: string, endDate?: string) => {
    setIsLoading(true);
    try {
      const data = (startDate && endDate) 
        ? await getAppointmentsByDateRange(startDate, endDate)
        : await getAppointments();
      setAppointments(data);
      setError(null);
    } catch (err: any) {
      const msg = err.message || "Falha ao carregar agendamentos";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addAppointment = async (appointment: Omit<Appointment, "id" | "created_at">) => {
    const promise = createAppointmentAction(appointment);
    toast.promise(promise, {
      loading: "Criando agendamento...",
      success: (res) => {
        if (res.success) {
          // Typically we refresh the specific range in the agenda, but we'll trigger a refresh here
          return "Agendamento criado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao criar agendamento.",
    });
    return (await promise).data;
  };

  const updateAppointment = async (id: string, appointment: Partial<Appointment>) => {
    const promise = updateAppointmentAction(id, appointment);
    toast.promise(promise, {
      loading: "Atualizando agendamento...",
      success: (res) => {
        if (res.success) {
          return "Agendamento atualizado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao atualizar agendamento.",
    });
    return (await promise).data;
  };

  const deleteAppointment = async (id: string) => {
    const promise = deleteAppointmentAction(id);
    toast.promise(promise, {
      loading: "Excluindo agendamento...",
      success: (res) => {
        if (res.success) {
          return "Agendamento excluído com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao excluir agendamento.",
    });
    return (await promise).success;
  };

  return {
    appointments,
    isLoading,
    error,
    refreshAppointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  };
}
