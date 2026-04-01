"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Search,
  RefreshCw,
  User,
  Mail,
  Percent,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfessionalModal } from "@/components/modals/professional-modal";
import { PageHeader } from "@/components/layout/page-header";
import type { Professional } from "@/types";
import { useData } from "@/lib/data-context";

export default function ProfessionalsPage() {
  const { professionals, isLoading, deleteProfessional, refreshData } =
    useData();
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">(
    "create",
  );
  const [selectedProfessional, setSelectedProfessional] =
    useState<Professional | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [professionalToDelete, setProfessionalToDelete] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleEdit = (professional: Professional) => {
    setSelectedProfessional(professional);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleView = (professional: Professional) => {
    setSelectedProfessional(professional);
    setModalMode("view");
    setModalOpen(true);
  };

  const handleDeleteClick = (professionalId: string) => {
    setProfessionalToDelete(professionalId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!professionalToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteProfessional(professionalToDelete);
      if (success) {
        setDeleteDialogOpen(false);
        setProfessionalToDelete(null);
      }
    } catch (error) {
      console.error("Erro ao deletar profissional:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNewProfessional = () => {
    setSelectedProfessional(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const filteredProfessionals = useMemo(() => {
    return (professionals || []).filter((p: Professional) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.functionTitle?.toLowerCase().includes(query)
      );
    });
  }, [professionals, searchQuery]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Profissionais"
        description="Gerencie a equipe e suas comissões"
        actions={
          <>
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
            <Button onClick={handleNewProfessional} size="default">
              <Plus className="h-4 w-4 mr-2" />
              Novo Profissional
            </Button>
          </>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar profissionais por nome, e-mail ou cargo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {isLoading && (professionals || []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p>Carregando profissionais...</p>
        </div>
      ) : filteredProfessionals.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfessionals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {p.name}
                      </div>
                    </TableCell>
                    <TableCell>{p.functionTitle || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {p.email || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-semibold text-primary">
                        <Percent className="h-3 w-3" />
                        {p.commissionPct ?? 70}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(p)}>
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(p)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(p.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "Nenhum profissional encontrado com os critérios de busca"
                : "Nenhum profissional cadastrado"}
            </p>
            {!searchQuery && (
              <Button onClick={handleNewProfessional} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Profissional
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <ProfessionalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        professional={selectedProfessional}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este profissional? Esta ação não
              pode ser desfeita e pode afetar o histórico de agendamentos e
              vendas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
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
  );
}
