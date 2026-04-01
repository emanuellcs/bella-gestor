"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { AppRole, Professional } from "@/types";
import { Loader2, User, Mail, Briefcase, Percent } from "lucide-react";

interface ProfessionalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit" | "view";
  professional?: Professional | null;
}

export function ProfessionalModal({
  open,
  onOpenChange,
  mode,
  professional,
}: ProfessionalModalProps) {
  const { addProfessional, updateProfessional } = useData();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Professional>>({
    name: "",
    email: "",
    functionTitle: "",
    role: AppRole.PROFESSIONAL,
    commissionPct: 70,
  });

  useEffect(() => {
    if (professional && (mode === "edit" || mode === "view")) {
      setFormData({
        name: professional.name,
        email: professional.email || "",
        functionTitle: professional.functionTitle || "",
        role: professional.role,
        commissionPct: professional.commissionPct ?? 70,
      });
    } else {
      setFormData({
        name: "",
        email: "",
        functionTitle: "",
        role: AppRole.PROFESSIONAL,
        commissionPct: 70,
      });
    }
  }, [professional, mode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    setIsLoading(true);
    try {
      let result;
      if (mode === "create") {
        result = await addProfessional(
          formData as Omit<Professional, "id" | "created_at">,
        );
      } else if (mode === "edit" && professional) {
        result = await updateProfessional(professional.id, formData);
      }

      if (result) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving professional:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Novo Profissional"
              : mode === "edit"
                ? "Editar Profissional"
                : "Detalhes do Profissional"}
          </DialogTitle>
          <DialogDescription>
            {mode === "view"
              ? "Informações do profissional cadastrado."
              : "Preencha os dados abaixo para cadastrar ou atualizar o profissional."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid gap-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Nome Completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Nome do profissional"
                  className="pl-9"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={mode === "view" || isLoading}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@email.com"
                  className="pl-9"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={mode === "view" || isLoading}
                />
              </div>
            </div>

            {/* Function Title */}
            <div className="grid gap-2">
              <Label htmlFor="functionTitle">Cargo / Função</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="functionTitle"
                  placeholder="Ex: Massoterapeuta, Manicure..."
                  className="pl-9"
                  value={formData.functionTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, functionTitle: e.target.value })
                  }
                  disabled={mode === "view" || isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Role */}
              <div className="grid gap-2">
                <Label htmlFor="role">Nível de Acesso</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) =>
                    setFormData({ ...formData, role: v as AppRole })
                  }
                  disabled={mode === "view" || isLoading}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AppRole.PROFESSIONAL}>
                      Profissional
                    </SelectItem>
                    <SelectItem value={AppRole.SECRETARY}>
                      Secretária
                    </SelectItem>
                    <SelectItem value={AppRole.ADMIN}>Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Commission */}
              <div className="grid gap-2">
                <Label htmlFor="commissionPct">Comissão (%)</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="commissionPct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="70"
                    className="pl-9"
                    value={formData.commissionPct}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionPct: parseFloat(e.target.value),
                      })
                    }
                    disabled={mode === "view" || isLoading}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            {mode !== "view" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {mode === "create"
                    ? "Criar Profissional"
                    : "Salvar Alterações"}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
