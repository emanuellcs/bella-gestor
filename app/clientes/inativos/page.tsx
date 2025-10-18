"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import type { Client } from "@/lib/types"
import { Search, ArrowLeft, Mail, Phone, MoreVertical, RefreshCw, Loader2, AlertCircle, Eye } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export default function ClientesInativosPage() {
    const router = useRouter()
    const { getInactiveClients, reactivateClient } = useData()
    const { toast } = useToast()

    const [inactiveClients, setInactiveClients] = useState<Client[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false)
    const [clientToReactivate, setClientToReactivate] = useState<string | null>(null)
    const [isReactivating, setIsReactivating] = useState(false)

    // Buscar clientes inativos ao montar
    useEffect(() => {
        loadInactiveClients()
    }, [])

    const loadInactiveClients = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const clients = await getInactiveClients()
            setInactiveClients(clients)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar clientes inativos")
        } finally {
            setIsLoading(false)
        }
    }

    // Filtrar clientes
    const filteredClients = inactiveClients.filter((client) => {
        const matchesSearch =
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            client.phone.includes(searchTerm)
        return matchesSearch
    })

    const handleReactivateClick = (clientId: string) => {
        setClientToReactivate(clientId)
        setReactivateDialogOpen(true)
    }

    const handleReactivateConfirm = async () => {
        if (!clientToReactivate) return

        setIsReactivating(true)
        try {
            const success = await reactivateClient(clientToReactivate)
            if (success) {
                toast({
                    title: "Cliente reativado",
                    description: "O cliente foi reativado com sucesso e voltará a aparecer na lista de clientes ativos.",
                })
                setReactivateDialogOpen(false)
                setClientToReactivate(null)
                // Recarregar lista
                await loadInactiveClients()
            } else {
                toast({
                    title: "Erro ao reativar",
                    description: "Não foi possível reativar o cliente. Tente novamente.",
                    variant: "destructive",
                })
            }
        } catch (error) {
            toast({
                title: "Erro ao reativar",
                description: "Ocorreu um erro ao reativar o cliente.",
                variant: "destructive",
            })
        } finally {
            setIsReactivating(false)
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Carregando clientes inativos...</p>
                    </div>
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                        <div>
                            <h3 className="text-lg font-semibold">Erro ao carregar clientes inativos</h3>
                            <p className="text-sm text-muted-foreground mt-2">{error}</p>
                        </div>
                        <Button onClick={loadInactiveClients} variant="outline">
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
                    <div className="flex items-center gap-2 mb-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push('/clientes')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">Clientes Inativos</h1>
                    </div>
                    <p className="text-muted-foreground ml-10">
                        Clientes que foram desativados e podem ser reativados
                    </p>
                </div>
                <Button onClick={loadInactiveClients} variant="outline" size="default">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Atualizar
                </Button>
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
                {filteredClients.length === 0 ? (
                    "Nenhum cliente inativo encontrado"
                ) : (
                    <>Mostrando {filteredClients.length} de {inactiveClients.length} clientes inativos</>
                )}
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
                                        <TableHead>Data de Desativação</TableHead>
                                        <TableHead>Total Gasto</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                {searchTerm
                                                    ? "Nenhum cliente encontrado com esse critério de busca"
                                                    : "Nenhum cliente inativo no momento"
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredClients.map((client) => (
                                            <TableRow key={client.id} className="hover:bg-muted/50">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{client.name}</span>
                                                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                                                    </div>
                                                </TableCell>
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
                                                    {client.lastVisit
                                                        ? formatDate(client.lastVisit)
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
                                                            <DropdownMenuItem onClick={() => handleReactivateClick(client.id)}>
                                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                                Reativar Cliente
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
                            <p className="text-muted-foreground">
                                {searchTerm
                                    ? "Nenhum cliente encontrado"
                                    : "Nenhum cliente inativo no momento"
                                }
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredClients.map((client) => (
                        <Card key={client.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-lg">{client.name}</h3>
                                        <Badge variant="secondary" className="mt-1 text-xs">
                                            Inativo
                                        </Badge>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleReactivateClick(client.id)}>
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                Reativar Cliente
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

            {/* Reactivate Confirmation Dialog */}
            <AlertDialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reativar cliente</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja reativar este cliente? Ele voltará a aparecer na lista de
                            clientes ativos e poderá ser usado em novos agendamentos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isReactivating}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReactivateConfirm}
                            disabled={isReactivating}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isReactivating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Reativando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Reativar
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
