"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useData } from "@/lib/data-context";

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
  const { appOptions } = useData();
  const balance = Math.max(0, totalAmount - alreadyPaidAmount);

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [amount, setAmount] = useState<number>(balance);
  const [error, setError] = useState<string>("");

  const paymentMethods = useMemo(() => {
    return (appOptions || [])
      .filter((opt) => opt.optionType === "payment_method" && opt.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [appOptions]);

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
      <DialogContent className="sm:max-w-md max-h-[95vh] flex flex-col p-0 overflow-hidden border-none sm:border sm:rounded-xl">
        <DialogHeader className="p-6 pb-2 text-left">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Registrar Pagamento
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Cliente: <span className="font-bold text-foreground">{clientName}</span> | Venda <span className="font-mono font-bold">#{saleId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
          {/* Amount Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">
                Total da Venda
              </div>
              <div className="font-bold text-lg tabular-nums">
                {formatCurrency(totalAmount)}
              </div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 ring-1 ring-primary/10">
              <div className="text-[10px] text-primary/70 uppercase font-black tracking-widest mb-1">
                Saldo Restante
              </div>
              <div className="font-black text-2xl text-primary tabular-nums leading-none">
                {formatCurrency(balance)}
              </div>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Form Fields */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="method" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Como o cliente pagou?
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method" className="h-14 text-base font-medium bg-background border-2 focus:ring-primary/20 transition-all">
                  <SelectValue placeholder="Selecione o método..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {paymentMethods.length > 0 ? (
                    paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.label} className="py-3 text-base">
                        {method.label}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Cartão de Crédito" className="py-3 text-base">Cartão de Crédito</SelectItem>
                      <SelectItem value="Cartão de Débito" className="py-3 text-base">Cartão de Débito</SelectItem>
                      <SelectItem value="PIX" className="py-3 text-base">PIX</SelectItem>
                      <SelectItem value="Dinheiro" className="py-3 text-base">Dinheiro</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Valor Recebido agora
              </Label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl font-bold group-focus-within:text-primary transition-colors">
                  R$
                </span>
                <Input
                  id="amount"
                  type="number"
                  min={0.01}
                  max={balance}
                  step={0.01}
                  className="pl-12 h-16 text-2xl font-black tabular-nums border-2 focus-visible:ring-primary/20 bg-background transition-all"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-primary hover:bg-primary/5"
                  onClick={() => setAmount(Number(balance.toFixed(2)))}
                >
                  Total
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-in fade-in zoom-in duration-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="p-6 pt-2 flex flex-col gap-3 bg-muted/5 border-t">
          <Button
            onClick={handleSubmit}
            disabled={
              loading || balance <= 0 || !paymentMethod || amount <= 0
            }
            className="w-full h-16 bg-green-600 hover:bg-green-700 text-white text-lg font-black uppercase tracking-widest shadow-xl shadow-green-600/20 active:scale-[0.98] transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Processando...
              </>
            ) : (
              "Confirmar Recebimento"
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full h-10 text-muted-foreground hover:text-foreground font-bold uppercase text-[10px] tracking-widest"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
