"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  getServices,
  getActiveServices,
  getServiceVariantsByServiceId,
  getServiceVariants,
} from "@/services/services";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
} from "@/actions/services";
import { Service, ServiceVariant } from "@/types";

type ServiceDraft = Omit<Service, "id" | "created_at" | "updatedAt"> & {
  variants?: Omit<
    ServiceVariant,
    "id" | "serviceId" | "created_at" | "updatedAt"
  >[];
};

type ServiceUpdate = Partial<Service> & {
  variants?: Partial<ServiceVariant>[];
};

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Hook to manage services state and operations.
 */
export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshServices = useCallback(async (onlyActive = false) => {
    setIsLoading(true);
    try {
      const data = onlyActive ? await getActiveServices() : await getServices();
      setServices(data);
      setError(null);
    } catch (err: unknown) {
      const msg = messageFromError(err, "Falha ao carregar serviços");
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addService = async (service: ServiceDraft) => {
    const promise = createServiceAction(service);
    toast.promise(promise, {
      loading: "Criando serviço...",
      success: (res) => {
        if (res.success) {
          refreshServices();
          return "Serviço criado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err: unknown) =>
        messageFromError(err, "Erro ao criar serviço."),
    });
    return (await promise).data;
  };

  const updateService = async (id: string, service: ServiceUpdate) => {
    const promise = updateServiceAction(id, service);
    toast.promise(promise, {
      loading: "Atualizando serviço...",
      success: (res) => {
        if (res.success) {
          refreshServices();
          return "Serviço atualizado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err: unknown) =>
        messageFromError(err, "Erro ao atualizar serviço."),
    });
    return (await promise).data;
  };

  const deleteService = async (id: string) => {
    const promise = deleteServiceAction(id);
    toast.promise(promise, {
      loading: "Excluindo serviço...",
      success: (res) => {
        if (res.success) {
          refreshServices();
          return "Serviço excluído com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err: unknown) =>
        messageFromError(err, "Erro ao excluir serviço."),
    });
    return (await promise).success;
  };

  return {
    services,
    isLoading,
    error,
    refreshServices,
    addService,
    updateService,
    deleteService,
    getServiceVariantsByServiceId,
    getServiceVariants,
  };
}
