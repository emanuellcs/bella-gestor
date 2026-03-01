"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { 
  getActiveClients, 
  getInactiveClients, 
  searchClients, 
  getClients 
} from "@/services/clients";
import { 
  createClientAction, 
  updateClientAction, 
  deactivateClientAction, 
  reactivateClientAction 
} from "@/actions/clients";
import { Client } from "@/types";

/**
 * Hook to manage clients state and operations.
 */
export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshClients = useCallback(async (isActive = true) => {
    setIsLoading(true);
    try {
      const data = isActive ? await getActiveClients() : await getInactiveClients();
      setClients(data);
      setError(null);
    } catch (err: any) {
      const msg = err.message || "Falha ao carregar clientes";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addClient = async (client: Omit<Client, "id" | "registrationDate" | "status">) => {
    const promise = createClientAction(client);
    toast.promise(promise, {
      loading: "Criando cliente...",
      success: (res) => {
        if (res.success) {
          refreshClients();
          return "Cliente criado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao criar cliente.",
    });
    return (await promise).data;
  };

  const updateClient = async (id: string, client: Partial<Client>) => {
    const promise = updateClientAction(id, client);
    toast.promise(promise, {
      loading: "Atualizando cliente...",
      success: (res) => {
        if (res.success) {
          refreshClients();
          return "Cliente atualizado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao atualizar cliente.",
    });
    return (await promise).data;
  };

  const deactivateClient = async (id: string) => {
    const promise = deactivateClientAction(id);
    toast.promise(promise, {
      loading: "Desativando cliente...",
      success: (res) => {
        if (res.success) {
          refreshClients();
          return "Cliente desativado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao desativar cliente.",
    });
    return (await promise).success;
  };

  return {
    clients,
    isLoading,
    error,
    refreshClients,
    addClient,
    updateClient,
    deactivateClient,
    searchClients,
    getClients,
  };
}
