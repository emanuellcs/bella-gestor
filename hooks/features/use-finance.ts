"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { 
  getSales, 
  getPayments 
} from "@/services/finance";
import { 
  createSaleAction, 
  updateSaleStatusAction, 
  createPaymentAction, 
  updatePaymentStatusAction 
} from "@/actions/finance";
import { Sale, SaleStatus, Payment, PaymentStatus } from "@/types";

/**
 * Hook to manage finance state and operations.
 */
export function useFinance() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFinance = useCallback(async () => {
    setIsLoading(true);
    try {
      const [salesData, paymentsData] = await Promise.all([
        getSales(),
        getPayments()
      ]);
      setSales(salesData);
      setPayments(paymentsData);
      setError(null);
    } catch (err: any) {
      const msg = err.message || "Falha ao carregar dados financeiros";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addSale = async (sale: any) => {
    const promise = createSaleAction(sale);
    toast.promise(promise, {
      loading: "Registrando venda...",
      success: (res) => {
        if (res.success) {
          refreshFinance();
          return "Venda registrada com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao registrar venda.",
    });
    return (await promise).data;
  };

  const updateSaleStatus = async (id: string, status: SaleStatus, updates?: Partial<Sale>) => {
    const promise = updateSaleStatusAction(id, status, updates);
    toast.promise(promise, {
      loading: "Atualizando status da venda...",
      success: (res) => {
        if (res.success) {
          refreshFinance();
          return "Status atualizado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao atualizar status.",
    });
    return (await promise).data;
  };

  const addPayment = async (payment: Omit<Payment, "id">) => {
    const promise = createPaymentAction(payment);
    toast.promise(promise, {
      loading: "Registrando pagamento...",
      success: (res) => {
        if (res.success) {
          refreshFinance();
          return "Pagamento registrado com sucesso!";
        }
        throw new Error(res.error);
      },
      error: (err) => err.message || "Erro ao registrar pagamento.",
    });
    return (await promise).data;
  };

  return {
    sales,
    payments,
    isLoading,
    error,
    refreshFinance,
    addSale,
    updateSaleStatus,
    addPayment,
  };
}
