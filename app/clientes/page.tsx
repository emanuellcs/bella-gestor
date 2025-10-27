"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Separator } from "@/components/ui/separator"
import { useData } from "@/lib/data-context"
import { ClientModal } from "@/components/modals/client-modal"
import type { Client } from "@/lib/types"
import { Search, Plus, Mail, Phone, MoreVertical, Edit, Eye, Loader2, AlertCircle, Archive, Download, X, Calendar, MapPin, Clock, Bell, ChevronLeft, ChevronRight, Users, LayoutGrid, LayoutList, Settings2, Grid3X3 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"

type ViewMode = "table" | "cards"
type GridColumns = 1 | 2 | 3 | 4 | 5

interface VisibleColumns {
  birthDate: boolean
  registrationDate: boolean
  totalSpent: boolean
  serviceLocation: boolean
  preferredSchedule: boolean
  referralSource: boolean
  status: boolean
  notes: boolean
}

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
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [gridColumns, setGridColumns] = useState<GridColumns>(3)
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    birthDate: true,
    registrationDate: true,
    totalSpent: true,
    serviceLocation: true,
    preferredSchedule: true,
    referralSource: true,
    status: true,
    notes: true,
  })

  useEffect(() => {
    refreshData()
  }, [])

  const filteredClients = clients
    .filter((client) => client.status === 'active') // novo filtro
    .filter((client) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        client.name.toLowerCase().includes(q) ||
        (client.email?.toLowerCase().includes(q) ?? false) ||
        client.phone.includes(searchTerm);
      return matchesSearch;
  });

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedClients = filteredClients.slice(startIndex, endIndex)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  const isAllSelected = paginatedClients.length > 0 && paginatedClients.every(client => selectedIds.has(client.id))

  const getGridClass = () => {
    const gridMap = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    }
    return gridMap[gridColumns]
  }

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

  const toggleColumn = (column: keyof VisibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }))
  }

  if (isLoading && clients.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando clientes...</p>
        </div>
      </div>
    )
  }

  if (error && clients.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-2xl font-semibold">Erro ao carregar clientes</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => refreshData()} variant="outline">
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="flex-none space-y-4 p-4 md:p-6 pb-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Clientes Ativos</h1>
              <p className="text-base text-muted-foreground mt-1">
                Gerencie sua base de clientes ativos
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => router.push('/clientes/inativos')} variant="outline" size="default" className="w-full sm:w-auto">
                <Archive className="mr-2 h-4 w-4" />
                Ver Inativos
              </Button>
              <Button onClick={handleCreate} size="default" className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </div>
          </div>

          <Card className="p-4 md:p-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou telefone..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="pl-10 h-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "table" ? "default" : "outline"}
                        size="icon"
                        onClick={() => setViewMode("table")}
                      >
                        <LayoutList className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Visualização em tabela</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "cards" ? "default" : "outline"}
                        size="icon"
                        onClick={() => setViewMode("cards")}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Visualização em cards</TooltipContent>
                  </Tooltip>
                  {viewMode === "cards" ? (
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Grid3X3 className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Colunas da grade</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Colunas da grade</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={gridColumns.toString()} onValueChange={(v) => setGridColumns(Number(v) as GridColumns)}>
                          <DropdownMenuRadioItem value="1">1 coluna</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="2">2 colunas</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="3">3 colunas</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="4">4 colunas</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="5">5 colunas</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Personalizar colunas</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.birthDate}
                          onCheckedChange={() => toggleColumn("birthDate")}
                        >
                          Nascimento
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.registrationDate}
                          onCheckedChange={() => toggleColumn("registrationDate")}
                        >
                          Cadastro
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.totalSpent}
                          onCheckedChange={() => toggleColumn("totalSpent")}
                        >
                          Total Gasto
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.serviceLocation}
                          onCheckedChange={() => toggleColumn("serviceLocation")}
                        >
                          Local
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.preferredSchedule}
                          onCheckedChange={() => toggleColumn("preferredSchedule")}
                        >
                          Horário
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.referralSource}
                          onCheckedChange={() => toggleColumn("referralSource")}
                        >
                          Indicação
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.status}
                          onCheckedChange={() => toggleColumn("status")}
                        >
                          Status
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.notes}
                          onCheckedChange={() => toggleColumn("notes")}
                        >
                          Observações
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {selectedIds.size} selecionado(s)
                    </Badge>
                    <Button onClick={handleClearSelection} variant="ghost" size="sm">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={handleBulkExport} variant="outline" size="sm" className="flex-1 sm:flex-none">
                      <Download className="mr-2 h-4 w-4" />
                      Exportar
                    </Button>
                    <Button onClick={() => setBulkActionDialogOpen(true)} variant="ghost" size="sm" className="flex-1 sm:flex-none text-destructive hover:text-destructive">
                      <Archive className="mr-2 h-4 w-4" />
                      Desativar
                    </Button>
                  </div>
                </div>
              )}

              {selectedIds.size === 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {filteredClients.length === clients.length 
                        ? `${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'} no total`
                        : `${filteredClients.length} de ${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'}`
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-4 md:px-6 pt-4 pb-4">
          <div className="flex-1 rounded-xl border-2 border-primary/20 shadow-lg bg-gradient-to-br from-background to-muted/5 flex flex-col min-h-0">
            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {viewMode === "table" ? (
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b-2 border-primary/10">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Selecionar todos"
                          className="h-5 w-5"
                        />
                      </TableHead>
                      <TableHead className="min-w-[180px] font-semibold">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Nome</TooltipTrigger>
                          <TooltipContent>Nome completo do cliente</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="min-w-[220px] font-semibold">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Contato</TooltipTrigger>
                          <TooltipContent>Email e telefone do cliente</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      {visibleColumns.birthDate && (
                        <TableHead className="min-w-[110px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Nascimento</TooltipTrigger>
                            <TooltipContent>Data de nascimento</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      {visibleColumns.registrationDate && (
                        <TableHead className="min-w-[110px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Cadastro</TooltipTrigger>
                            <TooltipContent>Data de cadastro no sistema</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      {visibleColumns.totalSpent && (
                        <TableHead className="min-w-[120px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Total Gasto</TooltipTrigger>
                            <TooltipContent>Valor total gasto pelo cliente</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      {visibleColumns.serviceLocation && (
                        <TableHead className="min-w-[140px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Local</TooltipTrigger>
                            <TooltipContent>Local preferido para serviço</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      {visibleColumns.preferredSchedule && (
                        <TableHead className="min-w-[120px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Horário</TooltipTrigger>
                            <TooltipContent>Horário preferido</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      {visibleColumns.referralSource && (
                        <TableHead className="min-w-[140px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Indicação</TooltipTrigger>
                            <TooltipContent>Fonte de indicação</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      {visibleColumns.status && (
                        <TableHead className="min-w-[110px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Status</TooltipTrigger>
                            <TooltipContent>Status de compra</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      {visibleColumns.notes && (
                        <TableHead className="min-w-[180px] font-semibold">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">Observações</TooltipTrigger>
                            <TooltipContent>Observações sobre o cliente</TooltipContent>
                          </Tooltip>
                        </TableHead>
                      )}
                      <TableHead className="w-[80px] font-semibold sticky right-0 bg-background/95">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="h-8 w-8 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              {searchTerm
                                ? "Nenhum cliente encontrado com esse critério de busca"
                                : "Nenhum cliente cadastrado ainda"}
                            </p>
                            {!searchTerm && (
                              <Button onClick={handleCreate} variant="outline" size="sm" className="mt-2">
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar primeiro cliente
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedClients.map((client, index) => (
                        <TableRow key={client.id} className="hover:bg-muted/50">
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(client.id)}
                              onCheckedChange={(e) => handleSelectOne(client.id, index, e as any)}
                              onClick={(e) => handleSelectOne(client.id, index, e)}
                              aria-label={`Selecionar ${client.name}`}
                              className="h-5 w-5"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help">
                                  <span>{client.name}</span>
                                  {client.marketingConsent && (
                                    <Bell className="h-4 w-4 text-primary flex-shrink-0" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-semibold">{client.name}</p>
                                {client.marketingConsent && <p className="text-xs">Consentimento de marketing ativo</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {client.email && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 text-sm cursor-help">
                                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <span className="truncate">{client.email}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{client.email}</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-sm cursor-help">
                                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span>{client.phone}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{client.phone}</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          {visibleColumns.birthDate && (
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger className="cursor-help">
                                  {client.birthDate ? formatDate(client.birthDate) : "—"}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {client.birthDate ? `Data de nascimento: ${formatDate(client.birthDate)}` : "Data de nascimento não informada"}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                          {visibleColumns.registrationDate && (
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger className="cursor-help">
                                  {client.registrationDate ? formatDate(client.registrationDate) : "—"}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {client.registrationDate ? `Cadastrado em: ${formatDate(client.registrationDate)}` : "Data não disponível"}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                          {visibleColumns.totalSpent && (
                            <TableCell className="font-semibold">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help">
                                  {formatCurrency(client.totalSpent)}
                                </TooltipTrigger>
                                <TooltipContent>
                                  Total gasto: {formatCurrency(client.totalSpent)}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                          {visibleColumns.serviceLocation && (
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="truncate">{client.serviceLocation || "—"}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {client.serviceLocation || "Local não especificado"}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                          {visibleColumns.preferredSchedule && (
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="truncate">{client.preferredSchedule || "—"}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {client.preferredSchedule || "Horário não especificado"}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                          {visibleColumns.referralSource && (
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger className="cursor-help truncate block">
                                  {client.referralSource || "—"}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {client.referralSource || "Fonte não especificada"}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                          {visibleColumns.status && (
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant={client.isClient ? "default" : "secondary"} className="whitespace-nowrap cursor-help">
                                    {client.isClient ? "Comprou" : "Não comprou"}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {client.isClient ? "Cliente já realizou compras" : "Cliente ainda não realizou compras"}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          )}
                          {visibleColumns.notes && (
                            <TableCell>
                              {client.notes ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="truncate max-w-[160px] cursor-help">{client.notes}</p>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>{client.notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="sticky right-0 bg-background">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                  <span className="sr-only">Abrir menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
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
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Archive className="mr-2 h-4 w-4" />
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
              ) : (
                <div className={`grid gap-4 p-4 ${getGridClass()}`}>
                  {paginatedClients.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {searchTerm
                          ? "Nenhum cliente encontrado com esse critério de busca"
                          : "Nenhum cliente cadastrado ainda"}
                      </p>
                      {!searchTerm && (
                        <Button onClick={handleCreate} variant="outline">
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar primeiro cliente
                        </Button>
                      )}
                    </div>
                  ) : (
                    paginatedClients.map((client, index) => (
                      <Card key={client.id} className="group relative overflow-hidden hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary" />
                        
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={selectedIds.has(client.id)}
                                onCheckedChange={(e) => handleSelectOne(client.id, index, e as any)}
                                onClick={(e) => handleSelectOne(client.id, index, e)}
                                aria-label={`Selecionar ${client.name}`}
                                className="h-5 w-5 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help">
                                      <h3 className="font-semibold text-lg truncate">{client.name}</h3>
                                      {client.marketingConsent && (
                                        <Bell className="h-4 w-4 text-primary flex-shrink-0" />
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-semibold">{client.name}</p>
                                    {client.marketingConsent && <p className="text-xs mt-1">Consentimento de marketing ativo</p>}
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant={client.isClient ? "default" : "secondary"} className="mt-2 cursor-help">
                                      {client.isClient ? "Cliente" : "Lead"}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {client.isClient ? "Já realizou compras" : "Ainda não realizou compras"}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Desativar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <Separator className="my-4" />
                          
                          <div className="space-y-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 cursor-help">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                    <Mail className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm truncate flex-1">{client.email || "—"}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Email</p>
                                <p className="text-xs">{client.email || "Não informado"}</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 cursor-help">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                    <Phone className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm">{client.phone}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Telefone</p>
                                <p className="text-xs">{client.phone}</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 cursor-help">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                    <Calendar className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm">{client.birthDate ? formatDate(client.birthDate) : "—"}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Data de nascimento</p>
                                <p className="text-xs">{client.birthDate ? formatDate(client.birthDate) : "Não informado"}</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 cursor-help">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                    <MapPin className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm truncate flex-1">{client.serviceLocation || "—"}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Local do serviço</p>
                                <p className="text-xs">{client.serviceLocation || "Não especificado"}</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 cursor-help">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                    <Clock className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm truncate flex-1">{client.preferredSchedule || "—"}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Horário preferido</p>
                                <p className="text-xs">{client.preferredSchedule || "Não especificado"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          <Separator className="my-4" />

                          <div className="flex items-center justify-between">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  <p className="text-xs text-muted-foreground mb-1">Total gasto</p>
                                  <p className="text-xl font-bold text-primary">{formatCurrency(client.totalSpent)}</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Total gasto</p>
                                <p className="text-xs">Valor acumulado: {formatCurrency(client.totalSpent)}</p>
                              </TooltipContent>
                            </Tooltip>
                            {client.registrationDate && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-right cursor-help">
                                    <p className="text-xs text-muted-foreground">Cliente desde</p>
                                    <p className="text-sm font-medium">{formatDate(client.registrationDate)}</p>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">Data de cadastro</p>
                                  <p className="text-xs">{formatDate(client.registrationDate)}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex-none border-t bg-background shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:px-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Itens por página:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => setItemsPerPage(Number(value))}
                >
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'})
              </p>
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
          </div>
        )}
      </div>

      <ClientModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        client={selectedClient}
      />

      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar este cliente? Ele não será excluído permanentemente e
              poderá ser reativado a qualquer momento na seção &quot;Clientes Inativos&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateConfirm}
              disabled={isDeactivating}
              className="bg-destructive hover:bg-destructive/90"
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

      <AlertDialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {selectedIds.size} cliente(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar os {selectedIds.size} clientes selecionados? Eles não serão excluídos permanentemente e
              poderão ser reativados a qualquer momento na seção &quot;Clientes Inativos&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeactivate}
              disabled={isDeactivating}
              className="bg-destructive hover:bg-destructive/90"
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
    </TooltipProvider>
  )
}
