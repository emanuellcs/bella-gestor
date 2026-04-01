"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useData } from "@/lib/data-context";
import { ClientList } from "@/components/features/clients/client-list";
import { ClientModal } from "@/components/modals/client-modal";
import { InactiveClientsModal } from "@/components/modals/inactive-clients-modal";
import { PageHeader } from "@/components/layout/page-header";
import { Client } from "@/types";
import {
  Search,
  Plus,
  Download,
  Loader2,
  LayoutList,
  LayoutGrid,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";

export default function ClientesPage() {
  const { clients, isLoading, refreshData, deactivateClient } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [gridColumns] = useState(3);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [inactiveModalOpen, setInactiveModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">(
    "create",
  );
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // AlertDialog State
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [clientToDeactivate, setClientToDeactivate] = useState<string | null>(
    null,
  );

  const [visibleColumns] = useState({
    birthDate: true,
    registrationDate: true,
    totalSpent: true,
    serviceLocation: true,
    preferredSchedule: true,
    referral_source: true,
    status: true,
    notes: true,
  });

  const activeClients = useMemo(() => {
    return clients.filter((c) => c.status === "active");
  }, [clients]);

  const filteredClients = useMemo(() => {
    return activeClients.filter((c) => {
      const q = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    });
  }, [activeClients, searchTerm]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedClients.map((c) => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleExport = () => {
    const dataToExport = activeClients.filter((c) => selectedIds.has(c.id));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, "clientes.xlsx");
    toast.success("Exportação concluída!");
  };

  const onDeactivateConfirm = async () => {
    if (clientToDeactivate) {
      const success = await deactivateClient(clientToDeactivate);
      if (success) {
        setDeactivateDialogOpen(false);
        setClientToDeactivate(null);
      }
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="p-4 md:p-6 space-y-4 flex-none">
          <PageHeader
            title="Clientes"
            description="Gerencie sua base de clientes"
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setInactiveModalOpen(true)}
                  className="hidden md:flex"
                >
                  Ver Clientes Desativados
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setInactiveModalOpen(true)}
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refreshData()}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  onClick={() => {
                    setSelectedClient(null);
                    setModalMode("create");
                    setModalOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Novo Cliente
                </Button>
              </div>
            }
          />

          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("table")}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "cards" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("cards")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="mt-4 p-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium ml-2">
                  {selectedIds.size} selecionados
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" /> Exportar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="flex-1 overflow-auto px-4 md:px-6 pb-4">
          <div className="rounded-xl border shadow-sm bg-card h-full overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              {isLoading && activeClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : (
                <ClientList
                  clients={paginatedClients}
                  viewMode={viewMode}
                  gridColumns={gridColumns}
                  visibleColumns={visibleColumns}
                  selectedIds={selectedIds}
                  onSelectOne={handleSelectOne}
                  isAllSelected={
                    selectedIds.size === paginatedClients.length &&
                    paginatedClients.length > 0
                  }
                  onSelectAll={handleSelectAll}
                  onView={(c) => {
                    setSelectedClient(c);
                    setModalMode("view");
                    setModalOpen(true);
                  }}
                  onEdit={(c) => {
                    setSelectedClient(c);
                    setModalMode("edit");
                    setModalOpen(true);
                  }}
                  onDeactivate={(id) => {
                    setClientToDeactivate(id);
                    setDeactivateDialogOpen(true);
                  }}
                  onCreate={() => setModalOpen(true)}
                />
              )}
            </div>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t bg-background flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Próximo
              </Button>
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

      <InactiveClientsModal
        open={inactiveModalOpen}
        onOpenChange={setInactiveModalOpen}
        onViewClient={(c) => {
          setSelectedClient(c);
          setModalMode("view");
          setModalOpen(true);
        }}
      />

      <AlertDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente será movido para a lista de inativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeactivateConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

import { RefreshCw } from "lucide-react";
