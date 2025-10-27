"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useData } from "@/lib/data-context"
import { AppointmentStatus } from "@/lib/types"
import type { Appointment } from "@/lib/types"
import { Loader2, Save, X, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { zonedNowForInput } from "@/lib/utils"

interface AppointmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment?: Appointment | null
    mode: "create" | "edit"
    defaultDate?: string
    defaultTime?: string
}

export function AppointmentModal({
                                     open,
                                     onOpenChange,
                                     appointment,
                                     mode,
                                     defaultDate,
                                     defaultTime,
                                 }: AppointmentModalProps) {
    const { clients, addAppointment, updateAppointment } = useData()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    const [formData, setFormData] = useState({
        clientId: "",
        clientName: "",
        professionalId: "",
        professionalName: "",
        startTime: defaultDate && defaultTime
            ? `${defaultDate}T${defaultTime}`
            : zonedNowForInput(),
        endTime: "",
        status: AppointmentStatus.SCHEDULED,
        notes: "",
    })

    useEffect(() => {
        if (appointment && mode === "edit") {
            setFormData({
                clientId: appointment.clientId || "",
                clientName: appointment.clientName || "",
                professionalId: appointment.professionalId || "",
                professionalName: appointment.professionalName || "",
                startTime: appointment.startTime || "",
                endTime: appointment.endTime || "",
                status: appointment.status || AppointmentStatus.SCHEDULED,
                notes: appointment.notes || "",
            })
        } else if (mode === "create") {
            setFormData({
                clientId: "",
                clientName: "",
                professionalId: "",
                professionalName: "",
                startTime: defaultDate && defaultTime
                    ? `${defaultDate}T${defaultTime}`
                    : zonedNowForInput(),
                endTime: "",
                status: AppointmentStatus.SCHEDULED,
                notes: "",
            })
        }
    }, [appointment, mode, open, defaultDate, defaultTime])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        toast({
            title: "Funcionalidade em desenvolvimento",
            description: "O módulo de agendamentos ainda não está conectado ao Supabase.",
            variant: "destructive",
        })

        // Quando implementar:
        // if (mode === "create") {
        //   await addAppointment(formData)
        // } else if (mode === "edit" && appointment) {
        //   await updateAppointment(appointment.id, formData)
        // }
        // onOpenChange(false)
    }

    const handleClientSelect = (clientId: string) => {
        const client = clients.find((c) => c.id === clientId)
        if (client) {
            setFormData({ ...formData, clientId: client.id, clientName: client.name })
        }
    }

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

                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        O módulo de agendamentos ainda não está conectado ao Supabase. Esta funcionalidade
                        será implementada em breve.
                    </AlertDescription>
                </Alert>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="client">Cliente *</Label>
                        <Select
                            value={formData.clientId}
                            onValueChange={handleClientSelect}
                            disabled={clients.length === 0}
                        >
                            <SelectTrigger id="client">
                                <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map((client) => (
                                    <SelectItem key={client.id} value={client.id}>
                                        {client.name} - {client.phone}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Data e Hora de Início *</Label>
                            <Input
                                id="startTime"
                                type="datetime-local"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="endTime">Data e Hora de Término</Label>
                            <Input
                                id="endTime"
                                type="datetime-local"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({ ...formData, status: value as AppointmentStatus })}
                        >
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={AppointmentStatus.SCHEDULED}>Agendado</SelectItem>
                                <SelectItem value={AppointmentStatus.CONFIRMED}>Confirmado</SelectItem>
                                <SelectItem value={AppointmentStatus.COMPLETED}>Concluído</SelectItem>
                                <SelectItem value={AppointmentStatus.CANCELLED}>Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                                    {mode === "create" ? "Criar Agendamento" : "Salvar Alterações"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
