"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { processManualPaymentAction } from "@/actions/finance";
import { useToast } from "@/hooks/use-toast";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: number;
  clientName: string;
  totalAmount: number;
  alreadyPaidAmount: number;
  onSuccess: (isFullyPaid: boolean) => void;
}

/**
 * CheckoutModal: Simplified physical POS payment registration.
 * Focuses on extreme simplicity: Method, Amount, Confirm.
 */
export function CheckoutModal({
  isOpen,
  onClose,
  saleId,
  clientName,
  totalAmount,
  alreadyPaidAmount,
  onSuccess,
}: CheckoutModalProps) {
  const { toast } = useToast();
  const balance = Math.max(0, totalAmount - alreadyPaidAmount);

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [amount, setAmount] = useState<number>(balance);
  const [error, setError] = useState<string>("");

  // Update suggested payment amount whenever balance changes
  useEffect(() => {
    setAmount(Number(balance.toFixed(2)));
  }, [balance]);

  async function handleSubmit() {
    if (!paymentMethod) {
      setError("Selecione um método de pagamento.");
      return;
    }
    if (amount <= 0) {
      setError("O valor deve ser maior que zero.");
      return;
    }
    if (amount > Number((balance + 0.01).toFixed(2))) {
      setError(
        `O valor não pode exceder o saldo restante (${formatCurrency(balance)}).`,
      );
      return;
    }

    try {
      setError("");
      setLoading(true);

      const data = await processManualPaymentAction(
        saleId,
        paymentMethod,
        amount,
      );

      if (!data.success) {
        throw new Error(data.error || "Falha ao processar pagamento.");
      }

      onSuccess(data.isFullyPaid as boolean);

      if (data.isFullyPaid) {
        toast({
          title: "Venda Finalizada!",
          description: `Total de ${formatCurrency(totalAmount)} recebido com sucesso.`,
        });
        onClose();
      } else {
        const remaining = balance - amount;
        toast({
          title: "Pagamento Parcial",
          description: `Recebido ${formatCurrency(amount)}. Restam ${formatCurrency(remaining)}.`,
        });
        setPaymentMethod("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Registrar Pagamento
          </DialogTitle>
          <DialogDescription>
            Cliente:{" "}
            <span className="font-semibold text-foreground">{clientName}</span>{" "}
            | Venda: #{saleId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase font-medium">
                Total
              </div>
              <div className="font-semibold text-lg">
                {formatCurrency(totalAmount)}
              </div>
            </div>
            <div className="rounded-md border p-3 bg-primary/5 border-primary/20">
              <div className="text-xs text-primary/70 uppercase font-medium">
                Saldo Restante
              </div>
              <div className="font-bold text-xl text-primary">
                {formatCurrency(balance)}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="method">Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method" className="h-12 text-base">
                  <SelectValue placeholder="Como o cliente pagou?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cartão de Crédito">
                    Cartão de Crédito (Maquininha)
                  </SelectItem>
                  <SelectItem value="Cartão de Débito">
                    Cartão de Débito (Maquininha)
                  </SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor Recebido (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-muted-foreground text-lg">
                  R$
                </span>
                <Input
                  id="amount"
                  type="number"
                  min={0.01}
                  max={balance}
                  step={0.01}
                  className="pl-10 h-12 text-lg font-semibold"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={
                loading || balance <= 0 || !paymentMethod || amount <= 0
              }
              className="bg-green-600 hover:bg-green-700 text-white h-14 text-lg font-bold w-full shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Confirmando...
                </>
              ) : (
                "CONFIRMAR PAGAMENTO"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
