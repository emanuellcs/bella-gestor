"use client"

import { useState } from "react"
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
import { Loader2, AlertCircle } from "lucide-react"
import type { Appointment } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

interface CheckoutModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment: Appointment
    onSuccess: () => void
}

export function CheckoutModal({ open, onOpenChange, appointment, onSuccess }: CheckoutModalProps) {
    const [loading, setLoading] = useState(false)
    const [discount, setDiscount] = useState(0)

    const subtotal = appointment.totalPrice || 0
    const discountAmount = (subtotal * discount) / 100
    const total = subtotal - discountAmount

    const handleGeneratePayment = async () => {
        setLoading(true)

        // Simulação - implementar quando conectar ao Supabase
        setTimeout(() => {
            setLoading(false)
            alert("Funcionalidade em desenvolvimento")
        }, 1000)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Checkout - Pagamento</DialogTitle>
                    <DialogDescription>
                        Gere um link de pagamento para este agendamento.
                    </DialogDescription>
                </DialogHeader>

                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        O módulo de pagamentos ainda não está conectado ao Supabase. Esta funcionalidade será
                        implementada em breve.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    {/* Appointment Details */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Cliente:</span>
                            <span className="font-medium">{appointment.clientName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Data:</span>
                            <span className="font-medium">
                {appointment.startTime
                    ? new Date(appointment.startTime).toLocaleDateString("pt-BR")
                    : "N/A"}
              </span>
                        </div>
                    </div>

                    <Separator />

                    {/* Discount Input */}
                    <div className="space-y-2">
                        <Label htmlFor="discount">Desconto (%)</Label>
                        <Input
                            id="discount"
                            type="number"
                            min="0"
                            max="100"
                            value={discount}
                            onChange={(e) =>
                                setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))
                            }
                            placeholder="0"
                        />
                    </div>

                    {/* Price Summary */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Desconto ({discount}%):</span>
                                <span>- {formatCurrency(discountAmount)}</span>
                            </div>
                        )}
                        <Separator />
                        <div className="flex justify-between text-lg font-semibold">
                            <span>Total:</span>
                            <span className="text-primary">{formatCurrency(total)}</span>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <Button onClick={handleGeneratePayment} className="w-full" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Gerando link...
                            </>
                        ) : (
                            "Gerar Link de Pagamento"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
