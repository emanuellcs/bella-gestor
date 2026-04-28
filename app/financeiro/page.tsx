"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import type { Sale, Payment } from "@/types";
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
  formatDateTime,
  cn,
} from "@/lib/utils";

// shadcn/ui
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
  Eye,
  Trash2,
  Plus,
  Receipt,
  CalendarRange,
  AlertCircle,
  Loader2,
} from "lucide-react";

type DateRange = {
  start?: string; // yyyy-MM-dd
  end?: string; // yyyy-MM-dd
};

function withinRange(iso: string, range: DateRange) {
  if (!range.start && !range.end) return true;
  const d = new Date(iso).getTime();

  if (range.start) {
    const startVal = new Date(range.start + "T00:00:00").getTime();
    if (d < startVal) return false;
  }

  if (range.end) {
    const endVal = new Date(range.end + "T23:59:59").getTime();
    if (d > endVal) return false;
  }

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
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: "",
    end: "",
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
    <div className="flex flex-col h-screen overflow-hidden bg-muted/5">
      <div className="p-4 md:p-6 space-y-4 flex-none">
        <PageHeader
          title="Financeiro"
          description="Controle de vendas e fluxo de caixa"
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
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-9 shadow-sm"
              >
                <CalendarRange className="h-4 w-4 mr-2" />
                Filtrar
              </Button>

              {showFilters && (
                <div className="flex flex-wrap items-center gap-1 sm:gap-2 animate-in fade-in slide-in-from-right-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      De
                    </Label>
                    <Input
                      type="date"
                      className="h-9 w-24 sm:w-28 md:w-32 text-xs"
                      value={dateRange.start}
                      onChange={(e) => {
                        setDateRange((p) => ({ ...p, start: e.target.value }));
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      Até
                    </Label>
                    <Input
                      type="date"
                      className="h-9 w-24 sm:w-28 md:w-32 text-xs"
                      value={dateRange.end}
                      onChange={(e) => {
                        setDateRange((p) => ({ ...p, end: e.target.value }));
                        setPage(1);
                      }}
                    />
                  </div>
                  {(dateRange.start || dateRange.end) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDateRange({ start: "", end: "" });
                        setPage(1);
                      }}
                      className="h-9 px-2 text-[10px] font-bold uppercase tracking-widest text-destructive hover:bg-destructive/5 min-h-9"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              )}

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
            <div className="relative lg:col-span-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente ou ID..."
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
          </div>
        </Card>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="rounded-xl border shadow-sm bg-card h-full overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            {pagedSales.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
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
                          <TableRow
                            key={s.id}
                            className="group transition-colors hover:bg-muted/50"
                          >
                            <TableCell className="font-mono text-[10px] font-bold">
                              #{s.id}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                              {formatDateTime(s.created_at)}
                            </TableCell>
                            <TableCell className="font-semibold text-sm">
                              {s.clientName}
                            </TableCell>
                            <TableCell>
                              <div
                                className="text-xs text-muted-foreground max-w-[200px] truncate"
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
                                <span className="font-bold text-sm">
                                  {formatCurrency(Number(s.totalAmount))}
                                </span>
                                {due > 0 &&
                                  s.status !== SaleStatus.CANCELLED && (
                                    <span className="text-[10px] text-amber-600 font-bold tracking-tight">
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
                                    <span className="text-xs font-bold uppercase tracking-tighter">
                                      Checkout
                                    </span>
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
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-48"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedSale(s);
                                        setSaleDetailsOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4 mr-2" /> Detalhes
                                      da Venda
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
                                      disabled={
                                        s.status === SaleStatus.CANCELLED
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />{" "}
                                      Cancelar Venda
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
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y h-full overflow-auto">
                  {pagedSales.map((s) => {
                    const due = balance(s);
                    const isPending = s.status === SaleStatus.PENDING;
                    return (
                      <div
                        key={s.id}
                        className="p-4 space-y-4 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-muted rounded">
                              #{s.id}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {formatDateTime(s.created_at)}
                            </span>
                          </div>
                          {getStatusBadge(s.status)}
                        </div>

                        <div>
                          <div className="font-bold text-base text-foreground leading-none">
                            {s.clientName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 line-clamp-1">
                            {(s.items || [])
                              .map((it) => it.serviceVariantName)
                              .join(", ")}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                              Total
                            </span>
                            <span className="font-black text-xl text-primary leading-none">
                              {formatCurrency(Number(s.totalAmount))}
                            </span>
                            {due > 0 && s.status !== SaleStatus.CANCELLED && (
                              <span className="text-[10px] text-amber-600 font-bold tracking-tight mt-1">
                                Resta {formatCurrency(due)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 px-4 font-bold uppercase text-[10px]"
                              onClick={() => {
                                setSelectedSale(s);
                                setSaleDetailsOpen(true);
                              }}
                            >
                              Ver Detalhes
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                {isPending && (
                                  <DropdownMenuItem
                                    onClick={() => setPosCheckoutSale(s)}
                                    className="text-primary font-bold"
                                  >
                                    <CreditCard className="h-4 w-4 mr-2" />{" "}
                                    Finalizar Checkout
                                  </DropdownMenuItem>
                                )}
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
                                  className="text-destructive font-medium"
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
                        </div>

                        {isPending && (
                          <Button
                            className="w-full bg-primary hover:bg-primary/90 h-12 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                            onClick={() => setPosCheckoutSale(s)}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Finalizar Checkout
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-24 px-4 text-center">
                <Empty>
                  <EmptyMedia variant="icon">
                    <Receipt className="size-12 text-muted-foreground/50" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle className="text-xl">
                      Nenhuma venda encontrada
                    </EmptyTitle>
                    <EmptyDescription>
                      {search || statusFilter
                        ? "Tente ajustar seus filtros para encontrar o que procura."
                        : "As vendas realizadas aparecerão aqui para seu controle financeiro."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {!search && !statusFilter && (
                    <EmptyContent>
                      <Button
                        onClick={() => {
                          addItemRow();
                          setNewSaleOpen(true);
                        }}
                        className="mt-4"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Criar Primeira Venda
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t bg-background flex items-center justify-between flex-none">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">
              Página <span className="text-foreground">{page}</span> de{" "}
              <span className="text-foreground">{totalPages}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 px-4 font-bold"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-9 px-4 font-bold"
            >
              Próximo
            </Button>
          </div>
        </div>
      )}

      {/* Sale Details Modal */}
      <Dialog open={saleDetailsOpen} onOpenChange={setSaleDetailsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] flex flex-col p-0 overflow-hidden border-none sm:border sm:rounded-xl">
          <DialogHeader className="p-6 pb-2 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Receipt className="h-5 w-5 text-primary" />
              Venda{" "}
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-muted rounded">
                #{selectedSale?.id}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                    Cliente
                  </Label>
                  <div className="font-bold text-sm">
                    {selectedSale.clientName}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                    Status
                  </Label>
                  <div>{getStatusBadge(selectedSale.status)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                  Itens do Serviço
                </Label>
                <div className="border rounded-xl overflow-x-auto bg-muted/5">
                  <Table className="text-xs min-w-[450px] sm:min-w-0">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-10 font-bold">
                          Serviço
                        </TableHead>
                        <TableHead className="h-10 text-center font-bold w-16">
                          Qtd
                        </TableHead>
                        <TableHead className="h-10 text-right font-bold w-24">
                          Preço
                        </TableHead>
                        <TableHead className="h-10 text-right font-bold w-24">
                          Subtotal
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedSale.items || []).map((it, idx) => (
                        <TableRow key={idx} className="hover:bg-transparent">
                          <TableCell className="py-3">
                            <div className="font-bold text-foreground">
                              {it.serviceName}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {it.serviceVariantName} •{" "}
                              {it.professionalName || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-center font-medium">
                            {it.quantity}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums">
                            {formatCurrency(it.unitPrice)}
                          </TableCell>
                          <TableCell className="py-3 text-right font-bold tabular-nums">
                            {formatCurrency(it.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableRow className="bg-primary/5 font-black border-t-2">
                      <TableCell
                        colSpan={3}
                        className="py-4 text-right uppercase tracking-widest text-[10px]"
                      >
                        Total Geral
                      </TableCell>
                      <TableCell className="py-4 text-right text-base text-primary tabular-nums">
                        {formatCurrency(selectedSale.totalAmount)}
                      </TableCell>
                    </TableRow>
                  </Table>
                </div>
              </div>

              {selectedSale.payments && selectedSale.payments.length > 0 && (
                <div className="space-y-3 pt-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                    Histórico de Pagamentos
                  </Label>
                  <div className="space-y-2">
                    {selectedSale.payments.map((p: Payment, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 border-2 border-dashed rounded-xl text-xs bg-card hover:bg-muted/5 transition-colors"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-foreground text-sm">
                            {p.paymentMethod || "N/A"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                            {formatDateTime(p.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] uppercase font-black px-2 py-0.5 tracking-widest",
                              p.status === "paid"
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                : "text-amber-600 border-amber-200 bg-amber-50",
                            )}
                          >
                            {p.status}
                          </Badge>
                          <span className="font-black text-sm tabular-nums">
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
          <div className="p-6 border-t bg-muted/5">
            <Button
              onClick={() => setSaleDetailsOpen(false)}
              variant="outline"
              className="w-full font-bold uppercase text-xs tracking-widest h-12"
            >
              Fechar Detalhes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Sale Modal */}
      <Dialog open={newSaleOpen} onOpenChange={setNewSaleOpen}>
        <DialogContent className="sm:max-w-lg max-h-[95vh] flex flex-col p-0 overflow-hidden border-none sm:border sm:rounded-xl">
          <DialogHeader className="p-6 pb-2 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Plus className="h-5 w-5 text-primary" />
              Nova Venda Manual
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
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

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Itens da Venda
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addItemRow}
                  className="h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 border border-primary/20 rounded-full px-3"
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>

              <div className="space-y-4">
                {newSaleForm.items.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/5 flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted/10 flex items-center justify-center">
                      <Receipt className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Nenhum item adicionado
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
                      className="p-5 border-2 rounded-2xl bg-card space-y-5 relative group hover:border-primary/20 transition-all shadow-sm"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeItemRow(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            1. Serviço Base
                          </Label>
                          <Combobox
                            placeholder="Buscar serviço..."
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

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            2. Variação / Valor
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
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
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            4. Quantidade
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={it.quantity}
                            className="h-10 text-base font-bold tabular-nums border-2 focus-visible:ring-primary/20"
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

            <div className="space-y-2 px-1">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                Observações
              </Label>
              <Input
                placeholder="Ex: Desconto aplicado, observação especial..."
                value={newSaleForm.notes}
                onChange={(e) =>
                  setNewSaleForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="bg-muted/10 h-12 border-2 focus-visible:ring-primary/20"
              />
            </div>

            {newSaleError && (
              <Alert
                variant="destructive"
                className="animate-in fade-in zoom-in duration-200"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">
                  {newSaleError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="p-6 border-t bg-muted/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                Total da Venda
              </div>
              <div className="text-3xl font-black text-primary tracking-tighter tabular-nums">
                {formatCurrency(
                  newSaleForm.items.reduce(
                    (acc, it) => acc + it.quantity * it.unitPrice,
                    0,
                  ),
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setNewSaleOpen(false)}
                className="flex-1 h-14 font-black uppercase text-[10px] tracking-widest hover:bg-destructive/5 hover:text-destructive transition-colors"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitNewSale}
                disabled={newSaleLoading || newSaleForm.items.length === 0}
                className="flex-[2] h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
              >
                {newSaleLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  "Finalizar Venda"
                )}
              </Button>
            </div>
          </div>
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
