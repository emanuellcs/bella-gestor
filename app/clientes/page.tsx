"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/lib/data-context"
import { ClientModal } from "@/components/modals/client-modal"
import type { Client } from "@/lib/types"
import { Search, Plus, Mail, Phone, MoreVertical, Edit, Eye, Loader2, AlertCircle, Archive, Download, X, Calendar, MapPin, Clock, Bell, ChevronLeft, ChevronRight } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"

const ITEMS_PER_PAGE = 50

export default function ClientesPage() {
  const router = useRouter()
  const { clients, deactivateClient, updateClient, isLoading, error, refreshData } = useData()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [clientToDeactivate, setClientToDeactivate] = useState<string | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    refreshData()
  }, [])

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      client.phone.includes(searchTerm)
    return matchesSearch
  })

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedClients = filteredClients.slice(startIndex, endIndex)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const isAllSelected = paginatedClients.length > 0 && paginatedClients.every(client => selectedIds.has(client.id))

  const handleSelectAll = () => {
    if (isAllSelected) {
      const newSelected = new Set(selectedIds)
      paginatedClients.forEach(c => newSelected.delete(c.id))
      setSelectedIds(newSelected)
    } else {
      const newSelected = new Set(selectedIds)
      paginatedClients.forEach(c => newSelected.add(c.id))
      setSelectedIds(newSelected)
    }
    setLastSelectedIndex(null)
  }

  const handleSelectOne = (clientId: string, index: number, event: React.MouseEvent) => {
    const newSelected = new Set(selectedIds)
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      for (let i = start; i <= end; i++) {
        newSelected.add(paginatedClients[i].id)
      }
    } else {
      if (newSelected.has(clientId)) {
        newSelected.delete(clientId)
      } else {
        newSelected.add(clientId)
      }
    }
    setSelectedIds(newSelected)
    setLastSelectedIndex(index)
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
  }

  const handleBulkExport = () => {
    const selectedClients = clients.filter(c => selectedIds.has(c.id))
    const exportData = selectedClients.map(client => ({
      Nome: client.name,
      Email: client.email || "—",
      Telefone: client.phone,
      "Data de Nascimento": client.birthDate ? formatDate(client.birthDate) : "—",
      "Data de Cadastro": client.registrationDate ? formatDate(client.registrationDate) : "—",
      "Total Gasto": formatCurrency(client.totalSpent),
      "Local do Serviço": client.serviceLocation || "—",
      "Horário Preferido": client.preferredSchedule || "—",
      "Fonte de Indicação": client.referralSource || "—",
      "Consentimento Marketing": client.marketingConsent ? "Sim" : "Não",
      "Status": client.isClient ? "Comprou" : "Não comprou",
      Observações: client.notes || ""
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")
    XLSX.writeFile(workbook, `clientes_${new Date().toISOString().split('T')[0]}.xlsx`)

    toast({
      title: "Exportação concluída",
      description: `${selectedIds.size} cliente(s) exportado(s) com sucesso.`,
    })
    handleClearSelection()
  }

  const handleBulkDeactivate = async () => {
    setIsDeactivating(true)
    try {
      const promises = Array.from(selectedIds).map(id => deactivateClient(id))
      await Promise.all(promises)
      toast({
        title: "Clientes desativados",
        description: `${selectedIds.size} cliente(s) desativado(s) com sucesso.`,
      })
      handleClearSelection()
      setBulkActionDialogOpen(false)
    } catch (error) {
      toast({
        title: "Erro ao desativar",
        description: "Ocorreu um erro ao desativar os clientes.",
        variant: "destructive",
      })
    } finally {
      setIsDeactivating(false)
    }
  }

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
          description: "O cliente foi desativado e não aparecerá mais na lista.",
        })
        setDeactivateDialogOpen(false)
        setClientToDeactivate(null)
      } else {
        toast({
          title: "Erro ao desativar",
          description: "Não foi possível desativar o cliente.",
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

  const truncateText = (text: string | undefined | null, maxLength: number = 30) => {
    if (!text) return "—"
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
  }

  if (isLoading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando clientes...</p>
        </div>
      </div>
    )
  }

  if (error && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-6 max-w-md">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="font-semibold text-lg">Erro ao carregar clientes</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={() => refreshData()} variant="outline">
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-none p-6 pb-0 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes Ativos</h1>
            <p className="text-muted-foreground">Gerencie sua base de clientes ativos</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push('/clientes/inativos')} variant="outline" size="sm">
              <Archive className="h-4 w-4 mr-2" />
              Ver Inativos
            </Button>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10 h-9"
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md">
              <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
              <Button onClick={handleBulkExport} variant="ghost" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Exportar XLSX
              </Button>
              <Button onClick={() => setBulkActionDialogOpen(true)} variant="ghost" size="sm">
                <Archive className="h-4 w-4 mr-1" />
                Desativar
              </Button>
              <Button onClick={handleClearSelection} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {selectedIds.size === 0 && (
            <div className="text-sm text-muted-foreground flex items-center">
              {filteredClients.length} de {clients.length} clientes
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6 pt-4">
        <Card className="h-full flex flex-col">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Total Gasto</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Indicação</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedClients.map((client, index) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(client.id)}
                          onCheckedChange={(e) => handleSelectOne(client.id, index, e as any)}
                          onClick={(e) => handleSelectOne(client.id, index, e)}
                          aria-label={`Selecionar ${client.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {client.name}
                          {client.marketingConsent && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Bell className="h-3.5 w-3.5 text-green-600" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Consentimento de marketing</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[180px]">{client.email || "—"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{client.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {client.birthDate ? formatDate(client.birthDate) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {client.registrationDate ? formatDate(client.registrationDate) : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(client.totalSpent)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {truncateText(client.serviceLocation, 20)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {truncateText(client.preferredSchedule, 15)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {truncateText(client.referralSource, 20)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={client.isClient ? "default" : "secondary"} 
                          className={client.isClient ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {client.isClient ? "Comprou" : "Não comprou"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {client.notes ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm truncate max-w-[150px] block cursor-help">
                                  {client.notes}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>{client.notes}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(client)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeactivateClick(client.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Archive className="h-4 w-4 mr-2" />
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
          
          {totalPages > 1 && (
            <div className="flex-none flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({filteredClients.length} clientes)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateConfirm} disabled={isDeactivating}>
              {isDeactivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desativando...
                </>
              ) : (
                "Desativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {selectedIds.size} cliente(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar os {selectedIds.size} clientes selecionados? Eles não serão excluídos permanentemente e
              poderão ser reativados a qualquer momento na seção "Clientes Inativos".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeactivate} disabled={isDeactivating}>
              {isDeactivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desativando...
                </>
              ) : (
                "Desativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        client={selectedClient}
      />
    </div>
  )
}
