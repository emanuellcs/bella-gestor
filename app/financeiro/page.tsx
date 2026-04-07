"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import type {
  Sale,
  Service,
  ServiceVariant,
  Professional,
  Payment,
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { PaymentStatus, SaleStatus } from "@/types";
import { useData } from "@/lib/data-context";
import { PageHeader } from "@/components/layout/page-header";
import { CheckoutModal } from "@/components/modals/checkout-modal";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  formatBrazilianPhone,
  formatCurrency,
  formatDate,
  formatDateTime,
  cn,
} from "@/lib/utils";

// shadcn/ui
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// icons
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  CreditCard,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Plus,
  Receipt,
  Filter,
} from "lucide-react";

type DateRange = {
  start?: string; // yyyy-MM-dd
  end?: string; // yyyy-MM-dd
};

function withinRange(iso: string, range: DateRange) {
  if (!range.start && !range.end) return true;
  const d = new Date(iso).getTime();
  if (range.start && d < new Date(range.start + "T00:00:00").getTime())
    return false;
  if (range.end && d > new Date(range.end + "T23:59:59").getTime())
    return false;
  return true;
}

export default function FinanceiroPage() {
  const { toast } = useToast();
  const {
    sales,
    clients,
    services,
    serviceVariants,
    professionals,
    refreshData: refreshAll,
    createSale,
    updateSaleStatus,
    isLoading,
  } = useData();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SaleStatus>("");
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selections
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [posCheckoutSale, setPosCheckoutSale] = useState<Sale | null>(null);

  // Modals
  const [saleDetailsOpen, setSaleDetailsOpen] = useState(false);
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [newSaleLoading, setNewSaleLoading] = useState(false);
  const [newSaleError, setNewSaleError] = useState<string | null>(null);

  // New sale form
  type NewSaleItemForm = {
    rowId: string;
    serviceId: string;
    serviceVariantId: string;
    professionalId: string;
    quantity: number;
    unitPrice: number;
  };
  type NewSaleForm = {
    clientId: string;
    items: NewSaleItemForm[];
    notes?: string;
  };
  const [newSaleForm, setNewSaleForm] = useState<NewSaleForm>({
    clientId: "",
    items: [],
  });

  function addItemRow() {
    setNewSaleForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          rowId: crypto.randomUUID(),
          serviceId: "",
          serviceVariantId: "",
          professionalId: "",
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));
  }

  function removeItemRow(idx: number) {
    setNewSaleForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  }

  function onChangeItem(idx: number, patch: Partial<NewSaleItemForm>) {
    setNewSaleForm((f) => {
      const newItems = f.items.map((it, i) => {
        if (i === idx) {
          const updated = { ...it, ...patch };
          // Reset variant if service changes
          if (
            patch.serviceId !== undefined &&
            patch.serviceId !== it.serviceId
          ) {
            updated.serviceVariantId = "";
            updated.unitPrice = 0;
          }
          return updated;
        }
        return it;
      });
      return { ...f, items: newItems };
    });
  }

  function paidAmount(sale?: Sale | null) {
    if (!sale) return 0;
    return (sale.payments || [])
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }

  function balance(sale?: Sale | null) {
    if (!sale) return 0;
    return Math.max(0, Number(sale.totalAmount) - paidAmount(sale));
  }

  async function submitNewSale() {
    setNewSaleLoading(true);
    setNewSaleError(null);
    try {
      if (!newSaleForm.clientId || newSaleForm.items.length === 0) {
        throw new Error("Selecione o cliente e adicione pelo menos 1 item");
      }

      const invalidItems = newSaleForm.items.some(
        (it) => !it.serviceVariantId || !it.professionalId,
      );
      if (invalidItems) {
        throw new Error(
          "Preencha todos os campos dos itens (Serviço, Tipo e Profissional)",
        );
      }

      const created = await createSale({
        clientId: newSaleForm.clientId,
        items: newSaleForm.items.map((it) => ({
          serviceVariantId: it.serviceVariantId,
          professionalId: it.professionalId,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
        })),
        notes: newSaleForm.notes || undefined,
        status: SaleStatus.PENDING,
      });

      if (!created) throw new Error("Falha ao criar venda");

      setNewSaleOpen(false);
      setNewSaleForm({ clientId: "", items: [] });
      toast({ title: "Sucesso", description: "Venda criada com sucesso." });
      refreshAll();
    } catch (e) {
      setNewSaleError(
        e instanceof Error ? e.message : "Não foi possível criar a venda",
      );
    } finally {
      setNewSaleLoading(false);
    }
  }

  const filteredSales = useMemo(() => {
    let list = (sales || []).filter((s) =>
      withinRange(s.created_at, dateRange),
    );
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.clientName?.toLowerCase().includes(q) ||
          String(s.id).includes(q) ||
          (s.items || []).some(
            (it) =>
              it.serviceVariantName?.toLowerCase().includes(q) ||
              it.serviceName?.toLowerCase().includes(q),
          ),
      );
    }
    return list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [sales, search, statusFilter, dateRange]);

  const pagedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, page, pageSize]);

  const totalPages = Math.ceil(filteredSales.length / pageSize);

  const handleExport = () => {
    const headers = [
      "ID",
      "Data",
      "Cliente",
      "Total",
      "Pago",
      "Saldo",
      "Status",
    ];
    const rows = filteredSales.map((s) => [
      s.id,
      new Date(s.created_at).toLocaleDateString("pt-BR"),
      s.clientName,
      Number(s.totalAmount).toFixed(2),
      paidAmount(s).toFixed(2),
      balance(s).toFixed(2),
      s.status,
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `vendas_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case SaleStatus.PAID:
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 uppercase text-[10px] font-bold tracking-wider">
            Pago
          </Badge>
        );
      case SaleStatus.CANCELLED:
        return (
          <Badge
            variant="secondary"
            className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 uppercase text-[10px] font-bold tracking-wider"
          >
            Cancelado
          </Badge>
        );
      case SaleStatus.PENDING:
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 uppercase text-[10px] font-bold tracking-wider">
            Pendente
          </Badge>
        );
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Financeiro"
        description="Controle de vendas e fluxo de caixa."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refreshAll()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              className="hidden md:flex"
            >
              <Download className="h-4 w-4 mr-2" /> Exportar
            </Button>
            <Button
              onClick={() => {
                addItemRow();
                setNewSaleOpen(true);
              }}
              className="shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" /> Nova Venda
            </Button>
          </div>
        }
      />

      <Card className="p-4 shadow-sm border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou ID..."
              className="pl-9 h-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => {
              setStatusFilter(v === "all" ? "" : (v as SaleStatus));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value={SaleStatus.PENDING}>Pendente</SelectItem>
              <SelectItem value={SaleStatus.PAID}>Pago</SelectItem>
              <SelectItem value={SaleStatus.CANCELLED}>Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 lg:col-span-2">
            <div className="flex items-center gap-2 bg-muted/20 border rounded-md px-3 h-10 flex-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                className="border-none bg-transparent focus-visible:ring-0 px-1 text-sm h-8"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange((p) => ({ ...p, start: e.target.value }));
                  setPage(1);
                }}
              />
              <span className="text-muted-foreground text-xs font-medium">
                até
              </span>
              <Input
                type="date"
                className="border-none bg-transparent focus-visible:ring-0 px-1 text-sm h-8"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange((p) => ({ ...p, end: e.target.value }));
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="shadow-sm border overflow-hidden">
        <CardContent className="p-0 min-h-[400px]">
          {pagedSales.length > 0 ? (
            <>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedSales.map((s) => {
                    const due = balance(s);
                    const isPending = s.status === SaleStatus.PENDING;
                    return (
                      <TableRow key={s.id} className="group">
                        <TableCell className="font-bold">#{s.id}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(s.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.clientName}
                        </TableCell>
                        <TableCell>
                          <div
                            className="text-xs text-muted-foreground max-w-[250px] truncate"
                            title={(s.items || [])
                              .map((it) => it.serviceVariantName)
                              .join(", ")}
                          >
                            {(s.items || [])
                              .map((it) => it.serviceVariantName)
                              .join(", ")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {formatCurrency(Number(s.totalAmount))}
                            </span>
                            {due > 0 && s.status !== SaleStatus.CANCELLED && (
                              <span className="text-[10px] text-amber-600 font-medium tracking-tight">
                                Falta {formatCurrency(due)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(s.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isPending && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setPosCheckoutSale(s)}
                                className="h-8 px-3 bg-primary hover:bg-primary/90 shadow-sm"
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                <span className="text-xs">Checkout</span>
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedSale(s);
                                    setSaleDetailsOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" /> Detalhes da
                                  Venda
                                </DropdownMenuItem>
                                {!isPending &&
                                  due > 0 &&
                                  s.status !== SaleStatus.CANCELLED && (
                                    <DropdownMenuItem
                                      onClick={() => setPosCheckoutSale(s)}
                                    >
                                      <CreditCard className="h-4 w-4 mr-2" />{" "}
                                      Registrar Pagamento
                                    </DropdownMenuItem>
                                  )}
                                <Separator className="my-1" />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Deseja realmente cancelar esta venda?",
                                      )
                                    ) {
                                      updateSaleStatus(
                                        s.id,
                                        SaleStatus.CANCELLED,
                                      );
                                    }
                                  }}
                                  disabled={s.status === SaleStatus.CANCELLED}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Cancelar
                                  Venda
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between p-4 border-t bg-muted/10">
                <p className="text-xs text-muted-foreground font-medium">
                  Mostrando {(page - 1) * pageSize + 1} -{" "}
                  {Math.min(page * pageSize, filteredSales.length)} de{" "}
                  {filteredSales.length} vendas
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-24">
              <Empty>
                <EmptyMedia variant="icon">
                  <Receipt className="size-10" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Nenhuma venda encontrada</EmptyTitle>
                  <EmptyDescription>
                    {search || statusFilter
                      ? "Tente ajustar seus filtros para encontrar o que procura."
                      : "As vendas realizadas aparecerão aqui."}
                  </EmptyDescription>
                </EmptyHeader>
                {!search && !statusFilter && (
                  <EmptyContent>
                    <Button
                      onClick={() => {
                        addItemRow();
                        setNewSaleOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Criar Primeira Venda
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Modal */}
      <Dialog open={saleDetailsOpen} onOpenChange={setSaleDetailsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Venda #{selectedSale?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Cliente
                  </Label>
                  <div className="font-semibold text-sm">
                    {selectedSale.clientName}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Status
                  </Label>
                  <div>{getStatusBadge(selectedSale.status)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Itens do Serviço
                </Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-8">Serviço</TableHead>
                        <TableHead className="h-8 text-center">Qtd</TableHead>
                        <TableHead className="h-8 text-right">Preço</TableHead>
                        <TableHead className="h-8 text-right">
                          Subtotal
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedSale.items || []).map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="py-2">
                            <span className="font-semibold">
                              {it.serviceName}
                            </span>{" "}
                            - {it.serviceVariantName}
                            <div className="text-[9px] text-muted-foreground mt-0.5">
                              Profissional: {it.professionalName || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            {it.quantity}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            {formatCurrency(it.unitPrice)}
                          </TableCell>
                          <TableCell className="py-2 text-right font-medium">
                            {formatCurrency(it.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableRow className="bg-muted/20 font-bold">
                      <TableCell
                        colSpan={3}
                        className="py-2 text-right uppercase tracking-tighter"
                      >
                        Total
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm text-primary">
                        {formatCurrency(selectedSale.totalAmount)}
                      </TableCell>
                    </TableRow>
                  </Table>
                </div>
              </div>

              {selectedSale.payments && selectedSale.payments.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Histórico de Pagamentos
                  </Label>
                  <div className="space-y-2">
                    {selectedSale.payments.map((p: Payment, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg text-xs bg-muted/5 group hover:bg-muted/10 transition-colors"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-foreground">
                            {p.paymentMethod || "N/A"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(p.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] uppercase font-bold px-1.5 py-0",
                              p.status === "paid"
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                : "text-amber-600 border-amber-200 bg-amber-50",
                            )}
                          >
                            {p.status}
                          </Badge>
                          <span className="font-bold text-sm">
                            {formatCurrency(p.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setSaleDetailsOpen(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Sale Modal */}
      <Dialog open={newSaleOpen} onOpenChange={setNewSaleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nova Venda Manual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cliente
              </Label>
              <Combobox
                placeholder="Selecione o cliente..."
                items={(clients || []).map((c) => ({
                  value: c.id,
                  label: c.phone
                    ? `${c.name} - ${formatBrazilianPhone(c.phone)}`
                    : c.name,
                }))}
                value={newSaleForm.clientId}
                onChange={(v) => setNewSaleForm((f) => ({ ...f, clientId: v }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Itens da Venda
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addItemRow}
                  className="h-7 text-xs text-primary hover:bg-primary/5"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {newSaleForm.items.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/5 flex flex-col items-center gap-2">
                    <Receipt className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">
                      Nenhum item adicionado.
                    </p>
                  </div>
                )}
                {newSaleForm.items.map((it, idx) => {
                  const filteredVariants = (serviceVariants || []).filter(
                    (v) => v.serviceId === it.serviceId,
                  );

                  return (
                    <div
                      key={it.rowId}
                      className="p-4 border rounded-xl bg-muted/5 space-y-4 relative group hover:border-primary/20 transition-colors shadow-sm"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                        onClick={() => removeItemRow(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">
                            1. Serviço Base
                          </Label>
                          <Combobox
                            placeholder="Serviço..."
                            items={(services || []).map((s) => ({
                              value: s.id,
                              label: s.name,
                            }))}
                            value={it.serviceId}
                            onChange={(v) =>
                              onChangeItem(idx, { serviceId: v })
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">
                            2. Variação / Tipo
                          </Label>
                          <Combobox
                            placeholder={
                              it.serviceId
                                ? "Selecione o tipo..."
                                : "Selecione um serviço primeiro"
                            }
                            disabled={!it.serviceId}
                            items={filteredVariants.map((v) => ({
                              value: v.id,
                              label: `${v.variantName} (${formatCurrency(v.price)})`,
                            }))}
                            value={it.serviceVariantId}
                            onChange={(v) => {
                              const matched = serviceVariants.find(
                                (vv) => vv.id === v,
                              );
                              onChangeItem(idx, {
                                serviceVariantId: v,
                                unitPrice: matched ? Number(matched.price) : 0,
                              });
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-3 space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">
                            3. Profissional
                          </Label>
                          <Combobox
                            placeholder="Responsável..."
                            items={(professionals || []).map((p) => ({
                              value: p.id,
                              label: p.name,
                            }))}
                            value={it.professionalId}
                            onChange={(v) =>
                              onChangeItem(idx, { professionalId: v })
                            }
                          />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">
                            Qtd.
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={it.quantity}
                            className="h-9 shadow-none bg-background"
                            onChange={(e) =>
                              onChangeItem(idx, {
                                quantity: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Observações (Opcional)
              </Label>
              <Input
                placeholder="Ex: Cliente VIP, desconto especial..."
                value={newSaleForm.notes}
                onChange={(e) =>
                  setNewSaleForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="bg-muted/10 h-10 border-muted"
              />
            </div>

            {newSaleError && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  {newSaleError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          <DialogFooter className="flex-row items-center justify-between gap-4 pt-2">
            <div className="text-left">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                Valor Total
              </div>
              <div className="text-2xl font-black text-primary tracking-tight">
                {formatCurrency(
                  newSaleForm.items.reduce(
                    (acc, it) => acc + it.quantity * it.unitPrice,
                    0,
                  ),
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setNewSaleOpen(false)}
                className="px-6"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitNewSale}
                disabled={newSaleLoading}
                className="px-6 shadow-md"
              >
                {newSaleLoading ? "Salvando..." : "Confirmar Venda"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {posCheckoutSale && (
        <CheckoutModal
          isOpen={!!posCheckoutSale}
          onClose={() => setPosCheckoutSale(null)}
          saleId={Number(posCheckoutSale.id)}
          clientName={posCheckoutSale.clientName || "Cliente"}
          totalAmount={Number(posCheckoutSale.totalAmount)}
          alreadyPaidAmount={paidAmount(posCheckoutSale)}
          onSuccess={() => {
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
