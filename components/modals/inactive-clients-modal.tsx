"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useData } from "@/lib/data-context";
import {
  Search,
  MoreVertical,
  RefreshCw,
  Loader2,
  Trash2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Client } from "@/types";

interface InactiveClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewClient?: (client: Client) => void;
}

export function InactiveClientsModal({
  open,
  onOpenChange,
  onViewClient,
}: InactiveClientsModalProps) {
  const { clients, isLoading, refreshData, reactivateClient, deleteClient } =
    useData();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Individual Actions State
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [clientToReactivate, setClientToReactivate] = useState<string | null>(
    null,
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  // Bulk Actions State
  const [bulkReactivateDialogOpen, setBulkReactivateDialogOpen] =
    useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  const inactiveClients = useMemo(() => {
    return (clients || []).filter((c) => c.status === "inactive");
  }, [clients]);

  const filteredClients = useMemo(() => {
    return inactiveClients.filter((client) => {
      const q = searchTerm.toLowerCase();
      return (
        client.name.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q) ||
        client.phone.includes(q)
      );
    });
  }, [inactiveClients, searchTerm]);

  // Reset selection when modal closes or search changes
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSearchTerm("");
    }
  }, [open]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm]);

  const isAllSelected =
    filteredClients.length > 0 &&
    filteredClients.every((client) => selectedIds.has(client.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set(selectedIds);
      filteredClients.forEach((c) => newSelected.add(c.id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelectOne = (clientId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedIds(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // --- Handlers ---

  const handleReactivateConfirm = async () => {
    if (!clientToReactivate) return;
    setIsProcessing(true);
    const success = await reactivateClient(clientToReactivate);
    setIsProcessing(false);
    if (success) {
      setReactivateDialogOpen(false);
      setClientToReactivate(null);
      handleClearSelection();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete || deleteConfirmationText !== "quero excluir") return;
    setIsProcessing(true);
    const success = await deleteClient(clientToDelete);
    setIsProcessing(false);
    if (success) {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      setDeleteConfirmationText("");
      handleClearSelection();
    }
  };

  const handleBulkReactivate = async () => {
    setIsProcessing(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        reactivateClient(id),
      );
      await Promise.all(promises);
      toast({
        title: "Clientes reativados",
        description: `${selectedIds.size} cliente(s) reativado(s) com sucesso.`,
      });
      handleClearSelection();
      setBulkReactivateDialogOpen(false);
    } catch {
      toast({
        title: "Erro ao reativar",
        description: "Ocorreu um erro ao reativar os clientes.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (deleteConfirmationText !== "quero excluir") return;
    setIsProcessing(true);
    try {
      const promises = Array.from(selectedIds).map((id) => deleteClient(id));
      await Promise.all(promises);
      toast({
        title: "Clientes excluídos",
        description: `${selectedIds.size} cliente(s) excluído(s) com sucesso.`,
      });
      handleClearSelection();
      setBulkDeleteDialogOpen(false);
      setDeleteConfirmationText("");
    } catch {
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir os clientes.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                Clientes Desativados
              </DialogTitle>
              <DialogDescription>
                Gerencie os clientes inativos. Você pode reativá-los ou
                excluí-los permanentemente.
              </DialogDescription>
            </div>
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
          </div>

          <div className="flex items-center gap-4 mt-4 mb-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedIds.size} selecionado(s)
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkReactivateDialogOpen(true)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Reativar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteConfirmationText("");
                    setBulkDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-0">
          {isLoading && inactiveClients.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Nenhum cliente inativo encontrado
              </p>
              {searchTerm && (
                <p className="text-sm text-muted-foreground">
                  Tente limpar a busca
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Desativação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(client.id)}
                        onCheckedChange={() => handleSelectOne(client.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{client.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Total gasto: {formatCurrency(client.totalSpent)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>{client.phone}</span>
                        <span className="text-muted-foreground">
                          {client.email || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.lastVisit ? formatDate(client.lastVisit) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onViewClient && (
                            <DropdownMenuItem
                              onClick={() => onViewClient(client)}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setClientToReactivate(client.id);
                              setReactivateDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" /> Reativar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setClientToDelete(client.id);
                              setDeleteConfirmationText("");
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            permanentemente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>

      {/* Reactivate Single Dialog */}
      <AlertDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Este cliente voltará para a lista de ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivateConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Excluir permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados do cliente serão
              apagados. Para confirmar, digite{" "}
              <strong className="text-foreground">quero excluir</strong> abaixo.
            </AlertDialogDescription>
            <Input
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="quero excluir"
              className="mt-4"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={
                isProcessing || deleteConfirmationText !== "quero excluir"
              }
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Reactivate Dialog */}
      <AlertDialog
        open={bulkReactivateDialogOpen}
        onOpenChange={setBulkReactivateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reativar {selectedIds.size} cliente(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Eles voltarão para a lista de ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkReactivate}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Excluir {selectedIds.size} cliente(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados dos clientes
              selecionados serão apagados. Para confirmar, digite{" "}
              <strong className="text-foreground">quero excluir</strong> abaixo.
            </AlertDialogDescription>
            <Input
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="quero excluir"
              className="mt-4"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={
                isProcessing || deleteConfirmationText !== "quero excluir"
              }
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir Todos"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
