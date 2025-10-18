"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import { ClientModal } from "@/components/modals/client-modal"
import type { Client } from "@/lib/types"
import { Search, Plus, Mail, Phone, MoreVertical, Edit, Trash2, Eye, Loader2, AlertCircle, Archive } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export default function ClientesPage() {
    const router = useRouter()
    const { clients, deactivateClient, isLoading, error, refreshData } = useData()
    const { toast } = useToast()

    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
    const [modalOpen, setModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create")
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
    const [clientToDeactivate, setClientToDeactivate] = useState<string | null>(null)
    const [isDeactivating, setIsDeactivating] = useState(false)

    useEffect(() => {
        refreshData()
    }, [])

    // Filter clients (todos já são ativos, pois getActiveClients)
    const filteredClients = clients.filter((client) => {
        const matchesSearch =
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            client.phone.includes(searchTerm)
        return matchesSearch
    })

    const handleCreate = () => {
        setSelectedClient(null)
        setModalMode("create")
        setModalOpen(true)
    }

    const handleView = (client: Client) => {
        setSelectedClient(client)
        setModalMode("view")
        setModalOpen(true)
    }

    const handleEdit = (client: Client) => {
        setSelectedClient(client)
        setModalMode("edit")
        setModalOpen(true)
    }

    const handleDeactivateClick = (clientId: string) => {
        setClientToDeactivate(clientId)
        setDeactivateDialogOpen(true)
    }

    const handleDeactivateConfirm = async () => {
        if (!clientToDeactivate) return

        setIsDeactivating(true)
        try {
            const success = await deactivateClient(clientToDeactivate)
            if (success) {
                toast({
                    title: "Cliente desativado",
                    description: "O cliente foi desativado e não aparecerá mais na lista. Você pode reativá-lo a qualquer momento.",
                })
                setDeactivateDialogOpen(false)
                setClientToDeactivate(null)
            } else {
                toast({
                    title: "Erro ao desativar",
                    description: "Não foi possível desativar o cliente. Tente novamente.",
                    variant: "destructive",
                })
            }
        } catch (error) {
            toast({
                title: "Erro ao desativar",
                description: "Ocorreu um erro ao desativar o cliente.",
                variant: "destructive",
            })
        } finally {
            setIsDeactivating(false)
        }
    }

    // Loading state
    if (isLoading && clients.length === 0) {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Carregando clientes...</p>
                    </div>
                </div>
            </div>
        )
    }

    // Error state
    if (error && clients.length === 0) {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                        <div>
                            <h3 className="text-lg font-semibold">Erro ao carregar clientes</h3>
                            <p className="text-sm text-muted-foreground mt-2">{error}</p>
                        </div>
                        <Button onClick={() => refreshData()} variant="outline">
                            Tentar novamente
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 px-4 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clientes Ativos</h1>
                    <p className="text-muted-foreground">Gerencie sua base de clientes ativos</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => router.push('/clientes/inativos')}
                        variant="outline"
                        size="default"
                    >
                        <Archive className="mr-2 h-4 w-4" />
                        Ver Inativos
                    </Button>
                    <Button onClick={handleCreate} size="default">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Cliente
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, email ou telefone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
                Mostrando {filteredClients.length} de {clients.length} clientes
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Contato</TableHead>
                                        <TableHead>Data de Cadastro</TableHead>
                                        <TableHead>Total Gasto</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Nenhum cliente encontrado
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredClients.map((client) => (
                                            <TableRow key={client.id} className="hover:bg-muted/50">
                                                <TableCell className="font-medium">{client.name}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Mail className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-muted-foreground">{client.email || "N/A"}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-muted-foreground">{client.phone}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {client.registrationDate
                                                        ? formatDate(client.registrationDate)
                                                        : "N/A"}
                                                </TableCell>
                                                <TableCell>{formatCurrency(client.totalSpent)}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleView(client)}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                Ver Detalhes
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeactivateClick(client.id)}
                                                                className="text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Desativar
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {filteredClients.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredClients.map((client) => (
                        <Card key={client.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-lg">{client.name}</h3>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleView(client)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Ver Detalhes
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDeactivateClick(client.id)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Desativar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">{client.email || "N/A"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">{client.phone}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-muted-foreground">Total gasto:</span>
                                        <span className="font-semibold text-primary">
                      {formatCurrency(client.totalSpent)}
                    </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Client Modal */}
            <ClientModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                mode={modalMode}
                client={selectedClient}
            />

            {/* Deactivate Confirmation Dialog */}
            <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desativar cliente</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja desativar este cliente? Ele não será excluído permanentemente e
                            poderá ser reativado a qualquer momento na seção "Clientes Inativos".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeactivating}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeactivateConfirm}
                            disabled={isDeactivating}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeactivating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Desativando...
                                </>
                            ) : (
                                "Desativar"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
