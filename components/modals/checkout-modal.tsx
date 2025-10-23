"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, ExternalLink, Copy } from "lucide-react"
import type { Appointment } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment
  onSuccess: () => void
}

export function CheckoutModal({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: CheckoutModalProps) {
  const [loading, setLoading] = useState(false)
  const [discount, setDiscount] = useState<number>(0) // percentual (0–100)
  const [additional, setAdditional] = useState<number>(0) // acréscimos/serviços extras
  const [error, setError] = useState<string>("")
  const [checkoutUrl, setCheckoutUrl] = useState<string>("")

  const subtotal = Number(appointment.totalPrice || 0)
  const discountAmount = useMemo(() => Math.max(0, subtotal * (discount / 100)), [subtotal, discount])
  const total = useMemo(() => Math.max(0, subtotal - discountAmount + (Number.isFinite(additional) ? additional : 0)), [subtotal, discountAmount, additional])

  async function handleGenerate() {
    try {
      setError("")
      setLoading(true)

      // Dados opcionais do comprador se disponíveis no Appointment (ajuste conforme seu modelo)
      // Exemplo: extraia do appointment.client se existir, mantendo compatibilidade
      const customer = undefined as
        | { name?: string; email?: string; phone_number?: string }
        | undefined

      // Itens: se não houver detalhamento, envia um item único com o total (servidor converte para centavos)
      const resp = await fetch("/api/infinitepay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // para rastrear no retorno, use o próprio id do compromisso dentro do order_nsu do lado server
          saleId: `appointment-${appointment.id}`,
          amount: total,
          items: [
            {
              quantity: 1,
              price: Math.round(total * 100),
              description: `Agendamento #${appointment.id}`,
            },
          ],
          customer,
          // address: {...} // opcional
        }),
      })

      const json = await resp.json()
      if (!resp.ok || !json?.url) {
        throw new Error(json?.error || "Falha ao gerar link de pagamento")
      }

      setCheckoutUrl(json.url)
      onSuccess()
    } catch (e: any) {
      setError(e?.message || "Erro inesperado ao gerar o link")
    } finally {
      setLoading(false)
    }
  }

  function resetAndClose() {
    setDiscount(0)
    setAdditional(0)
    setError("")
    setCheckoutUrl("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Checkout do agendamento</DialogTitle>
          <DialogDescription>Gere o link de pagamento para o cliente finalizar a cobrança.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo de valores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Subtotal</Label>
              <div className="text-base">{formatCurrency(subtotal)}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Desconto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value || 0))}
              />
              <div className="text-xs text-muted-foreground">− {formatCurrency(discountAmount)}</div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Acréscimos</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={additional}
                onChange={(e) => setAdditional(Number(e.target.value || 0))}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total a cobrar</span>
            <span className="text-lg font-semibold">{formatCurrency(total)}</span>
          </div>

          {!!error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={loading || total <= 0}>
              {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</>) : "Gerar link InfinitePay"}
            </Button>
          </div>

          {/* Link gerado */}
          {checkoutUrl && (
            <div className="space-y-2">
              <Separator />
              <div className="text-sm font-medium">Link gerado</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input readOnly value={checkoutUrl} />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
                    className="whitespace-nowrap"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(checkoutUrl).catch(() => {})}
                    className="whitespace-nowrap"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                </div>
              </div>
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Ao finalizar o pagamento, o cliente será redirecionado para a URL configurada e você poderá confirmar via webhook ou verificação manual, conforme sua integração. 
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
