"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, MoreVertical, DollarSign, Clock, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { ServiceModal } from "@/components/modals/service-modal"
import type { Service, ServiceVariant } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { useData } from "@/lib/data-context"

export default function ConfiguracoesPage() {
  const { services, serviceVariants, isLoading, deleteService } = useData()
  const [isDeleting, setIsDeleting] = useState(false)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

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
    if (!serviceToDelete) return
    setIsDeleting(true)
    try {
      const success = await deleteService(serviceToDelete)
      if (success) {
        setDeleteDialogOpen(false)
        setServiceToDelete(null)
      }
    } catch (error: any) {
      console.error('Erro ao deletar serviço:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleNewService = () => {
    setSelectedService(null)
    setModalMode("create")
    setServiceModalOpen(true)
  }

  const getServiceVariantsForService = (serviceId: string): ServiceVariant[] => {
    return serviceVariants.filter((v: ServiceVariant) => v.serviceId === serviceId && v.active)
  }

  const getPriceRange = (serviceId: string): string => {
    const variants = getServiceVariantsForService(serviceId)
    if (variants.length === 0) return "Sem tipos"
    const prices = variants.map((v: ServiceVariant) => v.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    if (minPrice === maxPrice) {
      return formatCurrency(minPrice)
    }
    return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`
  }

  const getDurationRange = (serviceId: string): string => {
    const variants = getServiceVariantsForService(serviceId)
    if (variants.length === 0) return "N/A"
    const durations = variants.map((v: ServiceVariant) => v.duration)
    const minDuration = Math.min(...durations)
    const maxDuration = Math.max(...durations)
    if (minDuration === maxDuration) {
      return `${minDuration} min`
    }
    return `${minDuration}-${maxDuration} min`
  }

  const filteredServices = services.filter((service: Service) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      service.name.toLowerCase().includes(query) ||
      service.category?.toLowerCase().includes(query) ||
      service.description?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Serviços</h1>
          <p className="text-muted-foreground">Gerencie os serviços oferecidos</p>
        </div>
        <Button onClick={handleNewService} size="default">
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar serviços por nome, categoria ou descrição..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando serviços...
        </div>
      ) : filteredServices.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service: Service) => {
            const variants = getServiceVariantsForService(service.id)
            return (
              <Card key={service.id} className="flex flex-col h-full">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{service.name}</CardTitle>
                    {service.category && (
                      <Badge variant="secondary" className="mt-1">
                        {service.category}
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(service)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(service.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {service.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{getDurationRange(service.id)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{getPriceRange(service.id)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      {variants.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              {variants.length} tipo{variants.length !== 1 ? 's' : ''}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">Tipos:</p>
                              {variants.map((variant: ServiceVariant) => (
                                <div key={variant.id} className="text-sm text-muted-foreground flex justify-between items-center">
                                  <span>{variant.variantName}</span>
                                  <span className="font-medium">
                                    {formatCurrency(variant.price)} / {variant.duration} min
                                  </span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sem tipos
                        </span>
                      )}
                      <Badge variant={service.active ? "default" : "secondary"}>
                        {service.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Nenhum serviço encontrado com os critérios de busca" : "Nenhum serviço cadastrado"}
            </p>
            {!searchQuery && (
              <Button onClick={handleNewService} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Serviço
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <ServiceModal
        open={serviceModalOpen}
        onOpenChange={setServiceModalOpen}
        mode={modalMode}
        service={selectedService}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita e todos
              os tipos relacionados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
