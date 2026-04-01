"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Settings2,
  Percent,
  ListFilter,
  Save,
  Loader2,
  RefreshCw,
  MoreVertical,
  GripVertical,
  ArrowUpDown,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { useData } from "@/lib/data-context";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { MultiBackend } from "react-dnd-multi-backend";
import { HTML5toTouch } from "rdndmb-html5-to-touch";
import { AppOption } from "@/types";

interface EditingOption {
  id?: number;
  option_type: string;
  label: string;
  display_order: number;
}

const ItemTypes = {
  OPTION: "option",
};

interface DraggableRowProps {
  id: number;
  index: number;
  option: AppOption;
  moveRow: (dragIndex: number, hoverIndex: number) => void;
  isReorderMode: boolean;
  onEdit: (opt: AppOption) => void;
  onDelete: (id: number) => void;
}

const DraggableRow = ({
  id,
  index,
  option,
  moveRow,
  isReorderMode,
  onEdit,
  onDelete,
}: DraggableRowProps) => {
  const ref = useRef<HTMLTableRowElement>(null);
  const [{ handlerId }, drop] = useDrop({
    accept: ItemTypes.OPTION,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { id: number; index: number }, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      moveRow(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.OPTION,
    item: () => {
      return { id, index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: isReorderMode,
  });

  const opacity = isDragging ? 0 : 1;
  drag(drop(ref));

  return (
    <TableRow
      ref={ref}
      style={{ opacity }}
      data-handler-id={handlerId}
      className={isReorderMode ? "touch-none" : ""}
    >
      <TableCell className="w-10">
        {isReorderMode ? (
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
        ) : (
          <span className="text-muted-foreground text-xs">
            {option.displayOrder}
          </span>
        )}
      </TableCell>
      <TableCell className="font-medium">{option.label}</TableCell>
      <TableCell>
        <Badge variant={option.isActive ? "default" : "secondary"}>
          {option.isActive ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {!isReorderMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(option)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(option.id)}
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
};

export default function SettingsPage() {
  const {
    appOptions,
    appSettings,
    isLoading,
    upsertAppOption,
    deleteAppOption,
    updateAppOptionsOrder,
    updateAppSetting,
    refreshData,
  } = useData();

  const [activeTab, setActiveTab] = useState("general");
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<EditingOption | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  // Reorder State
  const [reorderType, setReorderType] = useState<string | null>(null);
  const [tempOptions, setTempOptions] = useState<AppOption[]>([]);

  // General Settings State
  const [defaultCommission, setDefaultCommission] = useState("70");

  useEffect(() => {
    if (appSettings.default_commission_pct) {
      setDefaultCommission(appSettings.default_commission_pct);
    }
  }, [appSettings]);

  const optionTypes = [
    { value: "referral_source", label: "Fontes de Indicação" },
    { value: "lead_origin", label: "Origens de Lead" },
    { value: "payment_method", label: "Métodos de Pagamento" },
    { value: "service_category", label: "Categorias de Serviço" },
  ];

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await updateAppSetting("default_commission_pct", defaultCommission);
    } finally {
      setSaving(false);
    }
  };

  const handleUpsertOption = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const option = {
      id: editingOption?.id,
      option_type: formData.get("option_type") as string,
      label: formData.get("label") as string,
      value: formData.get("label") as string, // simplified
      display_order: parseInt(formData.get("display_order") as string) || 0,
      is_active: true,
    };

    try {
      const success = await upsertAppOption(option);
      if (success) {
        setOptionModalOpen(false);
        setEditingOption(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOption = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta opção?")) {
      await deleteAppOption(id);
    }
  };

  const startReordering = (type: string) => {
    const options = (appOptions || [])
      .filter((o) => o.optionType === type)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    setTempOptions(options);
    setReorderType(type);
  };

  const cancelReordering = () => {
    setReorderType(null);
    setTempOptions([]);
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const payload = tempOptions.map((opt, idx) => ({
        id: opt.id,
        display_order: idx + 1,
      }));
      const success = await updateAppOptionsOrder(payload);
      if (success) {
        setReorderType(null);
        setTempOptions([]);
      }
    } finally {
      setSaving(false);
    }
  };

  const moveRow = useCallback((dragIndex: number, hoverIndex: number) => {
    setTempOptions((prevOptions) => {
      const result = [...prevOptions];
      const [removed] = result.splice(dragIndex, 1);
      result.splice(hoverIndex, 0, removed);
      return result;
    });
  }, []);

  const filteredOptions = (type: string) => {
    if (reorderType === type) return tempOptions;
    return (appOptions || [])
      .filter((o) => o.optionType === type)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };

  return (
    <DndProvider backend={MultiBackend} options={HTML5toTouch}>
      <div className="p-6 space-y-6">
        <PageHeader
          title="Configurações"
          description="Ajuste as preferências globais do sistema"
          actions={
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
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="general" className="gap-2">
              <Settings2 className="h-4 w-4" /> Geral
            </TabsTrigger>
            <TabsTrigger value="options" className="gap-2">
              <ListFilter className="h-4 w-4" /> Listas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Financeiro</CardTitle>
                <CardDescription>
                  Configurações padrão para cálculos financeiros
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 max-w-sm">
                  <Label htmlFor="default_commission">
                    Comissão Padrão do Profissional (%)
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="default_commission"
                        type="number"
                        className="pl-9"
                        value={defaultCommission}
                        onChange={(e) => setDefaultCommission(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleSaveGeneral} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Esta porcentagem será usada se não houver uma específica no
                    profissional ou no serviço.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="options" className="space-y-4">
            <div className="grid gap-6">
              {optionTypes.map((type) => (
                <Card key={type.value} className="overflow-hidden">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle>{type.label}</CardTitle>
                      <CardDescription>
                        Opções exibidas nos menus de seleção
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {reorderType === type.value ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelReordering}
                            disabled={saving}
                          >
                            <X className="h-4 w-4 mr-2" /> Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveOrder}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Salvar Ordem
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startReordering(type.value)}
                            disabled={reorderType !== null || isLoading}
                          >
                            <ArrowUpDown className="h-4 w-4 mr-2" /> Reordenar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingOption({
                                option_type: type.value,
                                label: "",
                                display_order: 0,
                              });
                              setOptionModalOpen(true);
                            }}
                            disabled={reorderType !== null}
                          >
                            <Plus className="h-4 w-4 mr-2" /> Adicionar
                          </Button>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">Ordem</TableHead>
                          <TableHead>Rótulo (Label)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOptions(type.value).length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground py-4"
                            >
                              Nenhuma opção cadastrada.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredOptions(type.value).map((opt, index) => (
                            <DraggableRow
                              key={opt.id}
                              id={opt.id}
                              index={index}
                              option={opt}
                              moveRow={moveRow}
                              isReorderMode={reorderType === type.value}
                              onEdit={(o) => {
                                setEditingOption({
                                  id: o.id,
                                  option_type: o.optionType,
                                  label: o.label,
                                  display_order: o.displayOrder,
                                });
                                setOptionModalOpen(true);
                              }}
                              onDelete={handleDeleteOption}
                            />
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Option Modal */}
        <Dialog open={optionModalOpen} onOpenChange={setOptionModalOpen}>
          <DialogContent>
            <form onSubmit={handleUpsertOption}>
              <DialogHeader>
                <DialogTitle>
                  {editingOption?.id ? "Editar Opção" : "Nova Opção"}
                </DialogTitle>
                <DialogDescription>
                  Esta opção aparecerá nos menus de seleção do sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <input
                  type="hidden"
                  name="option_type"
                  value={editingOption?.option_type}
                />
                <div className="grid gap-2">
                  <Label htmlFor="label">Rótulo (Label)</Label>
                  <Input
                    id="label"
                    name="label"
                    defaultValue={editingOption?.label}
                    placeholder="Ex: Instagram, WhatsApp..."
                    required
                  />
                </div>
                {!editingOption?.id && (
                  <div className="grid gap-2">
                    <Label htmlFor="display_order">Ordem de Exibição</Label>
                    <Input
                      id="display_order"
                      name="display_order"
                      type="number"
                      defaultValue={editingOption?.display_order || 0}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOptionModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DndProvider>
  );
}
