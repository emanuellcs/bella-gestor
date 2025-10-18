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
import { Switch } from "@/components/ui/switch"
import { useData } from "@/lib/data-context"
import type { Service } from "@/lib/types"
import { Loader2, Save, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ServiceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    service?: Service | null
    mode: "create" | "edit"
}

export function ServiceModal({ open, onOpenChange, service, mode }: ServiceModalProps) {
    const { addService, updateService } = useData()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        category: "",
        active: true,
    })

    useEffect(() => {
        if (service && mode === "edit") {
            setFormData({
                name: service.name || "",
                description: service.description || "",
                category: service.category || "",
                active: service.active,
            })
        } else if (mode === "create") {
            setFormData({
                name: "",
                description: "",
                category: "",
                active: true,
            })
        }
    }, [service, mode, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name.trim()) {
            toast({
                title: "Nome obrigatório",
                description: "Por favor, preencha o nome do serviço.",
                variant: "destructive",
            })
            return
        }

        setIsLoading(true)
        try {
            if (mode === "create") {
                const result = await addService(formData)
                if (result) {
                    toast({
                        title: "Serviço criado",
                        description: "O serviço foi criado com sucesso. Agora você pode adicionar variantes.",
                    })
                    onOpenChange(false)
                } else {
                    toast({
                        title: "Erro ao criar serviço",
                        description: "Não foi possível criar o serviço.",
                        variant: "destructive",
                    })
                }
            } else if (mode === "edit" && service) {
                const result = await updateService(service.id, formData)
                if (result) {
                    toast({
                        title: "Serviço atualizado",
                        description: "As informações do serviço foram atualizadas.",
                    })
                    onOpenChange(false)
                } else {
                    toast({
                        title: "Erro ao atualizar serviço",
                        description: "Não foi possível atualizar o serviço.",
                        variant: "destructive",
                    })
                }
            }
        } catch (error) {
            console.error("Error submitting service:", error)
            toast({
                title: "Erro",
                description: "Ocorreu um erro ao processar a solicitação.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{mode === "create" ? "Novo Serviço" : "Editar Serviço"}</DialogTitle>
                    <DialogDescription>
                        {mode === "create"
                            ? "Crie um novo serviço. Após criar, você poderá adicionar variantes com preços e durações diferentes."
                            : "Atualize as informações do serviço."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome do Serviço *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Massagem Relaxante"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                        <Input
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            placeholder="Ex: Massoterapia, Estética Facial"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Descreva o serviço e seus benefícios..."
                            rows={3}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                        <div className="space-y-0.5">
                            <Label htmlFor="active" className="font-medium">
                                Serviço Ativo
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Serviços ativos aparecem para agendamento
                            </p>
                        </div>
                        <Switch
                            id="active"
                            checked={formData.active}
                            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
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
                                    {mode === "create" ? "Criar Serviço" : "Salvar Alterações"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
