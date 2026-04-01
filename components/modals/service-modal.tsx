"use client";

import type React from "react";
import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import type { Service, ServiceVariant } from "@/types";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

interface ServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
  mode: "create" | "edit";
}

export function ServiceModal({
  open,
  onOpenChange,
  service,
  mode,
}: ServiceModalProps) {
  const { addService, updateService, serviceVariants, appOptions } = useData();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const categories = useMemo(
    () =>
      (appOptions || []).filter(
        (o) => o.optionType === "service_category" && o.isActive,
      ),
    [appOptions],
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    active: true,
  });
  const [variants, setVariants] = useState<Partial<ServiceVariant>[]>([]);

  useEffect(() => {
    if (open) {
      if (service && mode === "edit") {
        setFormData({
          name: service.name || "",
          description: service.description || "",
          category: service.category || "",
          active: service.active,
        });
        const filteredVariants = serviceVariants.filter(
          (variant) => variant.serviceId === service.id,
        );
        setVariants(filteredVariants || []);
      } else {
        setFormData({
          name: "",
          description: "",
          category: "",
          active: true,
        });
        setVariants([]);
      }
    }
  }, [service, mode, open, serviceVariants]);

  const handleAddVariant = () => {
    setVariants([
      ...variants,
      { variantName: "", price: 0, duration: 0, active: true },
    ]);
  };

  const handleVariantChange = (
    index: number,
    field: keyof ServiceVariant,
    value: string | number | boolean,
  ) => {
    const newVariants = [...variants];
    const variant = newVariants[index];
    if (
      field === "price" ||
      field === "duration" ||
      field === "commissionPct"
    ) {
      const numValue = Number(value);
      variant[field] = Number.isNaN(numValue) ? 0 : numValue;
    } else {
      // @ts-expect-error - value is dynamically handled
      variant[field] = value;
    }
    setVariants(newVariants);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const validateVariants = () => {
    for (const variant of variants) {
      if (!variant.variantName?.trim()) {
        toast({
          title: "Tipo inválido",
          description: "O nome do tipo não pode estar vazio.",
          variant: "destructive",
        });
        return false;
      }
      if (!variant.price || variant.price <= 0) {
        toast({
          title: "Tipo inválido",
          description: `O preço do tipo "${variant.variantName}" deve ser maior que zero.`,
          variant: "destructive",
        });
        return false;
      }
      if (!variant.duration || variant.duration <= 0) {
        toast({
          title: "Tipo inválido",
          description: `A duração do tipo "${variant.variantName}" deve ser maior que zero.`,
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, preencha o nome do serviço.",
        variant: "destructive",
      });
      return;
    }

    if (!validateVariants()) {
      return;
    }

    setIsLoading(true);
    try {
      const serviceData = { ...formData, variants };

      if (mode === "create") {
        const result = await addService(serviceData as unknown as Service);
        if (result) {
          onOpenChange(false);
        }
      } else if (mode === "edit" && service) {
        const result = await updateService(
          service.id,
          serviceData as unknown as Service,
        );
        if (result) {
          onOpenChange(false);
        }
      }
    } catch (error) {
      console.error("Error submitting service:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo Serviço" : "Editar Serviço"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Crie um novo serviço e adicione tipos com preços e durações."
              : "Atualize as informações do serviço e seus tipos."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 p-1">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Serviço *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Massagem Relaxante"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((opt) => (
                    <SelectItem key={opt.id} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descreva o serviço e seus benefícios..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="active" className="font-medium">
                  Serviço Ativo
                </Label>
                <p className="text-sm text-muted-foreground">
                  Serviços ativos aparecem para agendamento
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked })
                }
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Tipos de Serviço</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddVariant}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Tipo
              </Button>
            </div>

            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum tipo adicionado.
              </p>
            ) : (
              <div className="space-y-4">
                {variants.map((variant, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => handleRemoveVariant(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`variantName-${index}`}>
                            Nome do Tipo *
                          </Label>
                          <Input
                            id={`variantName-${index}`}
                            value={variant.variantName}
                            onChange={(e) =>
                              handleVariantChange(
                                index,
                                "variantName",
                                e.target.value,
                              )
                            }
                            placeholder="Ex: 30 minutos"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`price-${index}`}>
                              Preço (R$) *
                            </Label>
                            <Input
                              id={`price-${index}`}
                              type="number"
                              value={variant.price}
                              onChange={(e) =>
                                handleVariantChange(
                                  index,
                                  "price",
                                  e.target.value,
                                )
                              }
                              placeholder="50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`duration-${index}`}>
                              Duração (min) *
                            </Label>
                            <Input
                              id={`duration-${index}`}
                              type="number"
                              value={variant.duration}
                              onChange={(e) =>
                                handleVariantChange(
                                  index,
                                  "duration",
                                  e.target.value,
                                )
                              }
                              placeholder="30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`commission-${index}`}>
                              Comissão (%)
                            </Label>
                            <Input
                              id={`commission-${index}`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={variant.commissionPct || ""}
                              onChange={(e) =>
                                handleVariantChange(
                                  index,
                                  "commissionPct",
                                  e.target.value,
                                )
                              }
                              placeholder="Padrão"
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`variantActive-${index}`}
                            checked={variant.active}
                            onCheckedChange={(checked) =>
                              handleVariantChange(index, "active", checked)
                            }
                          />
                          <Label htmlFor={`variantActive-${index}`}>
                            Tipo Ativo
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {mode === "create" ? "Criar Serviço" : "Salvar Alterações"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
