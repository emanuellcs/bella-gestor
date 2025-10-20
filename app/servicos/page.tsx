"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, MoreVertical, DollarSign, Clock } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useData } from "@/lib/data-context"
import { ServiceModal } from "@/components/modals/service-modal"
import type { Service } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

export default function ConfiguracoesPage() {
    const { services, serviceVariants, deleteService, isLoading } = useData()
    const [serviceModalOpen, setServiceModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<"create" | "edit">("create")
    const [selectedService, setSelectedService] = useState<Service | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [serviceToDelete, setServiceToDelete] = useState<string | null>(null)

    const handleEdit = (service: Service) => {
        setSelectedService(service)
        setModalMode("edit")
        setServiceModalOpen(true)
    }

    const handleDeleteClick = (serviceId: string) => {
        setServiceToDelete(serviceId)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (serviceToDelete) {
            await deleteService(serviceToDelete)
            setDeleteDialogOpen(false)
            setServiceToDelete(null)
        }
    }

    const handleNewService = () => {
        setSelectedService(null)
        setModalMode("create")
        setServiceModalOpen(true)
    }

    // Função para obter variantes ativas de um serviço
    const getServiceVariants = (serviceId: string) => {
        return serviceVariants.filter((v) => v.serviceId === serviceId && v.active)
    }

    // Função para calcular range de preços de um serviço
    const getPriceRange = (serviceId: string) => {
        const variants = getServiceVariants(serviceId)
        if (variants.length === 0) return "Sem variantes"

        const prices = variants.map((v) => v.price)
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)

        if (minPrice === maxPrice) {
            return formatCurrency(minPrice)
        }
        return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`
    }

    // Função para calcular range de duração de um serviço
    const getDurationRange = (serviceId: string) => {
        const variants = getServiceVariants(serviceId)
        if (variants.length === 0) return "N/A"

        const durations = variants.map((v) => v.duration)
        const minDuration = Math.min(...durations)
        const maxDuration = Math.max(...durations)

        if (minDuration === maxDuration) {
            return `${minDuration} min`
        }
        return `${minDuration}-${maxDuration} min`
    }

    return (
        <div className="container mx-auto py-8 px-4 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Serviços</h1>
                    <p className="text-muted-foreground">Gerencie os serviços oferecidos</p>
                </div>
                <Button onClick={handleNewService} size="default">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Serviço
                </Button>
            </div>

            {/* Services List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full text-center py-8">
                        <p className="text-muted-foreground">Carregando serviços...</p>
                    </div>
                ) : services.length > 0 ? (
                    services.map((service) => {
                        const variants = getServiceVariants(service.id)
                        return (
                            <Card key={service.id} className="hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-lg mb-1">{service.name}</CardTitle>
                                            {service.category && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {service.category}
                                                </Badge>
                                            )}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(service)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDeleteClick(service.id)}
                                                    className="text-destructive"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {service.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {service.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>{getDurationRange(service.id)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 font-semibold text-primary">
                                            <DollarSign className="h-4 w-4" />
                                            <span>{getPriceRange(service.id)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                                        <span>{variants.length} variante{variants.length !== 1 ? 's' : ''}</span>
                                        <Badge variant={service.active ? "default" : "secondary"} className="text-xs">
                                            {service.active ? "Ativo" : "Inativo"}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <div className="col-span-full">
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground mb-4">Nenhum serviço cadastrado</p>
                                <Button onClick={handleNewService} variant="outline">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Adicionar Primeiro Serviço
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Service Modal */}
            <ServiceModal
                open={serviceModalOpen}
                onOpenChange={setServiceModalOpen}
                mode={modalMode}
                service={selectedService}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita e todas
                            as variantes relacionadas também serão removidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
