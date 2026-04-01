"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import type { Sale, Payment } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { PaymentStatus, SaleStatus } from "@/types";
import { useData } from "@/lib/data-context";
import { PageHeader } from "@/components/layout/page-header";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { zonedNowForInput } from "@/lib/utils";
import {
  formatBrazilianPhone,
  formatCEP,
  formatPhoneForInfinitePay,
  unformatCEP,
} from "@/lib/utils";
import * as XLSX from "xlsx";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

// icons
import {
  Search,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Link as LinkIcon,
  CreditCard,
  CheckCircle2,
  XCircle,
  Receipt,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
} from "lucide-react";

// Form types
type LinkForm = {
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  addressCep?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressNeighborhood?: string;
  addressComplement?: string;
};

type PaymentForm = {
  amount: number;
  paymentMethod?: string;
  externalTransactionId?: string;
  paidAt?: string;
  professionalId?: string;
};

type DateRange = {
  start?: string; // yyyy-MM-dd
  end?: string; // yyyy-MM-dd
};

function currency(n: number) {
  return `R$ ${Number(n || 0).toFixed(2)}`;
}

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
    payments,
    clients,
    services,
    serviceVariants: variants,
    professionals,
    isLoading: loading,
    refreshData: refreshAll,
    createSale,
    createPayment,
    updateSaleStatus,
    cancelPayment,
    appOptions,
  } = useData();

  const paymentMethods = useMemo(
    () =>
      (appOptions || []).filter(
        (o) => o.optionType === "payment_method" && o.isActive,
      ),
    [appOptions],
  );

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SaleStatus>("");
  const [dateRange, setDateRange] = useState<DateRange>({});

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sections (sales | payments)
  const [activeTab, setActiveTab] = useState<"sales" | "payments">("sales");

  // Selections
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Existing modals
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [saleDetailsOpen, setSaleDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | {
    sale: Sale;
    type: "paid" | "cancel";
  }>(null);
  const [confirmPaymentCancelOpen, setConfirmPaymentCancelOpen] =
    useState<Payment | null>(null);

  // Forms
  const [linkForm, setLinkForm] = useState<LinkForm>({ amount: 0 });
  const [payForm, setPayForm] = useState<PaymentForm>({
    amount: 0,
    paidAt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Global modal to select a sale before opening link/payment
  const [selectSaleOpen, setSelectSaleOpen] = useState(false);
  const [selectIntent, setSelectIntent] = useState<"link" | "pay" | null>(null);
  const [selectQuery, setSelectQuery] = useState("");
  // New states (new sale modal)
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [newSaleLoading, setNewSaleLoading] = useState(false);
  const [newSaleError, setNewSaleError] = useState<string | null>(null);

  // New sale form
  type NewSaleItemForm = {
    rowId: string;
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

  // Intent after saving: continue with link or payment
  const [continueAfterCreate, setContinueAfterCreate] = useState<
    null | "link" | "pay"
  >(null);

  function addItemRow() {
    setNewSaleForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          rowId: crypto.randomUUID(),
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
    setNewSaleForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }

  // Value helpers
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
      // Calculate total locally; backend also recalculates
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
      setSelectedSale(created);

      const due = balance(created);

      if (continueAfterCreate === "link") {
        setLinkForm({
          amount: Number(due.toFixed(2)),
          customerName: created.clientName,
        });
        setLinkOpen(true);
      } else if (continueAfterCreate === "pay") {
        setPayForm({
          amount: Number(due.toFixed(2)),
          paidAt: zonedNowForInput(),
          paymentMethod: "",
          externalTransactionId: "",
        });
        setPayOpen(true);
      }
    } catch (e) {
      setNewSaleError(
        e instanceof Error ? e.message : "Não foi possível criar a venda",
      );
    } finally {
      setNewSaleLoading(false);
    }
  }

  function openSelectSale(intent: "link" | "pay") {
    setSelectIntent(intent);
    setSelectSaleOpen(true);
  }

  function handlePickSaleForAction(sale: Sale) {
    setSelectedSale(sale);
    setSelectSaleOpen(false);

    if (selectIntent === "link") {
      const defaultAmount = Number(balance(sale).toFixed(2));
      setLinkForm({
        amount: defaultAmount,
        customerName: sale.clientName,
      });
      setLinkOpen(true);
    }
    if (selectIntent === "pay") {
      const defaultAmount = Number(balance(sale).toFixed(2));
      setPayForm({
        amount: defaultAmount,
        paidAt: zonedNowForInput(),
        paymentMethod: "",
        externalTransactionId: "",
        professionalId: sale.professionalId,
      });
      setPayOpen(true);
    }
  }

  // Memoized filters
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = (sales || []).filter((s) => {
      const inText =
        !q ||
        (s.clientName || "").toLowerCase().includes(q) ||
        String(s.id).includes(q) ||
        (s.items || []).some((it) =>
          (it.serviceVariantName || "").toLowerCase().includes(q),
        );
      const inStatus = !statusFilter || s.status === statusFilter;
      const inDate = withinRange(
        s.created_at || new Date().toISOString(),
        dateRange,
      );
      return inText && inStatus && inDate;
    });
    return arr;
  }, [sales, search, statusFilter, dateRange]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = (payments || []).filter((p) => {
      const inText =
        !q ||
        String(p.id).includes(q) ||
        (p.saleId && String(p.saleId).includes(q)) ||
        (p.paymentMethod || "").toLowerCase().includes(q) ||
        (p.externalTransactionId || "").toLowerCase().includes(q);
      const inDate = withinRange(
        p.created_at || new Date().toISOString(),
        dateRange,
      );
      return inText && inDate;
    });
    return arr;
  }, [payments, search, dateRange]);

  // Pagination by tab
  const pagedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, page, pageSize]);

  const pagedPayments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, page, pageSize]);

  // UI Controls
  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    setDateRange({});
    setPage(1);
  }

  function openChoice(sale: Sale) {
    setSelectedSale(sale);
    setChoiceOpen(true);
  }

  function handleChooseExisting() {
    if (!selectedSale) return;
    setChoiceOpen(false);
    const defaultAmount = Number(balance(selectedSale).toFixed(2));
    setLinkForm({
      amount: defaultAmount,
      customerName: selectedSale.clientName,
    });
    setLinkOpen(true);
  }

  function handleCreateNew() {
    setContinueAfterCreate("link"); // Open link modal upon saving
    setChoiceOpen(false);
    setNewSaleOpen(true);
  }

  function openRegisterPayment(sale: Sale) {
    setSelectedSale(sale);
    const defaultAmount = Number(balance(sale).toFixed(2));
    setPayForm({
      amount: defaultAmount,
      paidAt: zonedNowForInput(),
      paymentMethod: "",
      externalTransactionId: "",
      professionalId: sale.professionalId,
    });
    setPayOpen(true);
  }

  function openSaleDetails(sale: Sale) {
    setSelectedSale(sale);
    setSaleDetailsOpen(true);
  }

  function confirmStatus(sale: Sale, type: "paid" | "cancel") {
    setConfirmOpen({ sale, type });
  }

  // Backend actions
  async function submitGenerateLink() {
    if (!selectedSale) return;
    setSubmitting(true);
    setError(null);

    try {
      const resp = await fetch("/api/infinitepay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: selectedSale.id,
          amount: Number(linkForm.amount),
          items: (selectedSale.items || []).map((it) => {
            const variant = variants.find((v) => v.id === it.serviceVariantId);
            const service = services.find((s) => s.id === variant?.serviceId);
            return {
              quantity: it.quantity,
              price: Math.round(Number(it.unitPrice) * 100), // cents
              description: `${service?.name || "Serviço"} - ${variant?.variantName || "Tipo"}`,
            };
          }),
          customer: {
            name: linkForm.customerName || undefined,
            email: linkForm.customerEmail || undefined,
            phone_number: linkForm.customerPhone
              ? formatPhoneForInfinitePay(linkForm.customerPhone)
              : undefined,
          },
          address:
            linkForm.addressCep && linkForm.addressNumber
              ? {
                  cep: unformatCEP(linkForm.addressCep),
                  street: linkForm.addressStreet || undefined,
                  number: linkForm.addressNumber,
                  neighborhood: linkForm.addressNeighborhood || undefined,
                  complement: linkForm.addressComplement || undefined,
                }
              : undefined,
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json?.url) {
        throw new Error(json?.error || "Falha ao gerar link de pagamento");
      }

      window.open(json.url, "_blank", "noopener,noreferrer");
      await refreshAll();
      setLinkOpen(false);

      toast({
        title: "Sucesso!",
        description: "Link de pagamento gerado com sucesso!",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao gerar link";
      setError(msg);
      toast({
        title: "Erro",
        description: msg + ". Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRegisterPayment() {
    if (!selectedSale) return;
    setSubmitting(true);
    setError(null);
    try {
      const paymentStatus =
        payForm.paymentMethod === "Link"
          ? PaymentStatus.PENDING
          : PaymentStatus.PAID;

      await createPayment({
        saleId: selectedSale.id,
        amount: Number(payForm.amount),
        status: paymentStatus,
        paidAt: payForm.paidAt
          ? new Date(payForm.paidAt).toISOString()
          : new Date().toISOString(),
        paymentMethod: payForm.paymentMethod || undefined,
        externalTransactionId: payForm.externalTransactionId || undefined,
        professionalId: payForm.professionalId || undefined,
      });
      setPayOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao registrar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  async function applyConfirm() {
    if (!confirmOpen) return;
    setSubmitting(true);
    setError(null);
    try {
      if (confirmOpen.type === "paid") {
        await updateSaleStatus(confirmOpen.sale.id, SaleStatus.PAID);
      } else {
        await updateSaleStatus(confirmOpen.sale.id, SaleStatus.CANCELLED);
      }
      setConfirmOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar status");
    } finally {
      setSubmitting(false);
    }
  }

  function confirmCancelPayment(payment: Payment) {
    setConfirmPaymentCancelOpen(payment);
  }

  async function applyCancelPayment() {
    if (!confirmPaymentCancelOpen) return;
    setSubmitting(true);
    setError(null);

    try {
      if (
        confirmPaymentCancelOpen.paymentMethod === "Link" &&
        confirmPaymentCancelOpen.externalTransactionId
      ) {
        // Use external API to cancel on InfinitePay first
        await fetch("/api/infinitepay/cancel-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalId: confirmPaymentCancelOpen.externalTransactionId,
          }),
        });
      }

      await cancelPayment(confirmPaymentCancelOpen.id);
      setConfirmPaymentCancelOpen(null);
      toast({
        title: "Sucesso!",
        description: "Pagamento cancelado com sucesso!",
      });
    } catch (e) {
      console.error("Erro ao cancelar pagamento:", e);
      const msg =
        e instanceof Error ? e.message : "Falha ao cancelar pagamento";
      setError(msg);
      toast({
        title: "Erro",
        description: msg + ". Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // XLSX Export
  function exportXLSX() {
    const headers =
      activeTab === "sales"
        ? ["ID", "Cliente", "Status", "Total", "Pago", "Saldo", "Criado Em"]
        : [
            "ID",
            "ID da Venda",
            "Valor",
            "Status",
            "Método",
            "NSU",
            "Criado Em",
          ];

    const data =
      activeTab === "sales"
        ? filteredSales.map((s) => [
            s.id,
            s.clientName || "",
            s.status,
            Number(s.totalAmount).toFixed(2),
            paidAmount(s).toFixed(2),
            balance(s).toFixed(2),
            new Date(s.created_at || "").toLocaleString("pt-BR"),
          ])
        : filteredPayments.map((p) => [
            p.id,
            p.saleId || "",
            Number(p.amount).toFixed(2),
            p.status,
            p.paymentMethod || "",
            p.externalTransactionId || "",
            new Date(p.created_at || "").toLocaleString("pt-BR"),
          ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      activeTab === "sales" ? "Vendas" : "Pagamentos",
    );
    XLSX.writeFile(
      wb,
      activeTab === "sales" ? "vendas.xlsx" : "pagamentos.xlsx",
    );
  }

  // Reset page on tab change
  useEffect(() => {
    setPage(1);
  }, [activeTab, pageSize, filteredSales.length, filteredPayments.length]);

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Financeiro"
        description="Vendas, pagamentos e links de checkout"
      />

      {/* Filters and actions (mobile-first, responsive) */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-10 w-full pl-9"
                placeholder="Buscar por cliente, item, ID da venda, método, NSU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar"
              />
            </div>

            {/* Status */}
            <div>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter((e.target.value || "") as SaleStatus | "")
                }
                aria-label="Status"
              >
                <option value="">Todos os status</option>
                <option value={SaleStatus.PENDING}>Pendente</option>
                <option value={SaleStatus.PAID}>Pago</option>
                <option value={SaleStatus.CANCELLED}>Cancelado</option>
              </select>
            </div>

            {/* Datas */}
            <Input
              type="date"
              className="h-10 w-full"
              value={dateRange.start || ""}
              onChange={(e) =>
                setDateRange((p) => ({
                  ...p,
                  start: e.target.value || undefined,
                }))
              }
              aria-label="Data inicial"
            />
            <Input
              type="date"
              className="h-10 w-full"
              value={dateRange.end || ""}
              onChange={(e) =>
                setDateRange((p) => ({
                  ...p,
                  end: e.target.value || undefined,
                }))
              }
              aria-label="Data final"
            />

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 w-full"
                onClick={() => {
                  resetFilters();
                  void refreshAll();
                }}
                aria-label="Limpar filtros"
              >
                <Filter className="mr-2 h-4 w-4" />
                <span className="md:hidden whitespace-nowrap">Limpar</span>
                <span className="hidden md:inline">Limpar</span>
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full"
                onClick={() => void refreshAll()}
                aria-label="Atualizar"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span className="md:hidden whitespace-nowrap">Atualiz.</span>
                <span className="hidden md:inline">Atualizar</span>
              </Button>
            </div>
          </div>

          {/* Tabs + toolbar */}
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Tabs */}
            <div className="inline-flex w-full overflow-hidden rounded-md border md:w-auto">
              {(["sales", "payments"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  onClick={() => setActiveTab(tab)}
                  className="h-9 rounded-none px-3 flex-1 md:flex-none"
                >
                  {tab === "sales" ? "Vendas" : "Pagamentos"}
                </Button>
              ))}
            </div>

            {/* Responsive toolbar */}
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
              {/* Items per page */}
              <div className="inline-flex items-center gap-2 shrink-0">
                <span className="text-sm text-muted-foreground">
                  <span className="md:hidden whitespace-nowrap">
                    Itens/pág.
                  </span>
                  <span className="hidden md:inline">Itens por página</span>
                </span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Itens por página"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Export */}
              <Button
                variant="outline"
                className="h-9 shrink-0"
                onClick={exportXLSX}
                aria-label="Exportar"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="md:hidden whitespace-nowrap">Exportar</span>
                <span className="hidden md:inline">Exportar</span>
              </Button>

              {/* CTAs (abrev. no mobile, texto cheio no md+) */}
              <div className="flex flex-1 flex-wrap gap-2 md:flex-none">
                <Button
                  className="h-9 w-full sm:w-auto"
                  onClick={() => {
                    setContinueAfterCreate(null);
                    setNewSaleOpen(true);
                  }}
                  aria-label="Nova venda"
                >
                  <span className="md:inline">Nova venda</span>
                </Button>

                <Button
                  className="h-9 w-full sm:w-auto"
                  variant="outline"
                  onClick={() => openSelectSale("pay")}
                  aria-label="Registrar pagamento"
                >
                  <span className="md:inline">Registrar pagamento</span>
                </Button>

                <Button
                  className="h-9 w-full sm:w-auto"
                  variant="outline"
                  onClick={() => openSelectSale("link")}
                  aria-label="Gerar pagamento"
                >
                  <span className="md:inline">Gerar pagamento</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Main content */}
      {activeTab === "sales" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Carregando informações...
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4">
                Nenhuma venda encontrada
              </div>
            ) : (
              <>
                <ul className="divide-y">
                  {pagedSales.map((s) => {
                    const paid = paidAmount(s);
                    const due = balance(s);
                    return (
                      <li key={s.id} className="py-3 px-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium truncate">
                                {s.clientName || "Cliente"} —{" "}
                                {s.items[0]?.serviceName}{" "}
                                {s.items[0]?.serviceVariantName}
                              </div>
                              <Badge
                                variant={
                                  s.status === SaleStatus.PAID
                                    ? "default"
                                    : s.status === SaleStatus.CANCELLED
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {s.status === SaleStatus.PAID
                                  ? "Pago"
                                  : s.status === SaleStatus.CANCELLED
                                    ? "Cancelado"
                                    : "Pendente"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total: {currency(s.totalAmount)} • Pago:{" "}
                              {currency(paid)} • Saldo: {currency(due)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="h-9"
                              onClick={() => openSaleDetails(s)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Detalhes
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-9">
                                  <MoreHorizontal className="h-4 w-4 mr-2" />
                                  Ações
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => openChoice(s)}>
                                  <LinkIcon className="h-4 w-4 mr-2" />
                                  Gerar link de pagamento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openRegisterPayment(s)}
                                  disabled={
                                    due <= 0 ||
                                    s.status === SaleStatus.CANCELLED
                                  }
                                >
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Registrar pagamento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => confirmStatus(s, "paid")}
                                  disabled={
                                    s.status === SaleStatus.PAID ||
                                    s.status === SaleStatus.CANCELLED
                                  }
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Marcar como pago
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => confirmStatus(s, "cancel")}
                                  disabled={s.status === SaleStatus.CANCELLED}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {paid > 0
                                    ? "Estornar venda"
                                    : "Cancelar venda"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Pagination */}
                <div className="flex items-center justify-between py-3">
                  <div className="text-sm text-muted-foreground">
                    {filteredSales.length} registro(s) • Página {page} de{" "}
                    {Math.max(1, Math.ceil(filteredSales.length / pageSize))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setPage((p) =>
                          Math.min(
                            Math.ceil(filteredSales.length / pageSize) || 1,
                            p + 1,
                          ),
                        )
                      }
                      disabled={
                        page >=
                        (Math.ceil(filteredSales.length / pageSize) || 1)
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Carregando informações...
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4">
                Nenhum pagamento encontrado
              </div>
            ) : (
              <>
                <ul className="divide-y">
                  {pagedPayments.map((p) => (
                    <li key={p.id} className="py-3 px-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">
                              {p.clientName || "Cliente"} — {p.serviceName}{" "}
                              {p.serviceVariantName}
                            </div>
                            <Badge
                              variant={
                                p.status === PaymentStatus.PAID
                                  ? "default"
                                  : p.status === PaymentStatus.PENDING
                                    ? "outline"
                                    : "secondary"
                              }
                            >
                              {p.status === PaymentStatus.PAID
                                ? "Pago"
                                : p.status === PaymentStatus.PENDING
                                  ? "Pendente"
                                  : p.status === PaymentStatus.REFUNDED
                                    ? "Estornado"
                                    : p.status === PaymentStatus.FAILED
                                      ? "Falhou"
                                      : p.status === PaymentStatus.CANCELLED
                                        ? "Cancelado"
                                        : p.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Valor: {currency(p.amount)} • Método:{" "}
                            {p.paymentMethod || "—"} • NSU:{" "}
                            {p.externalTransactionId || "—"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {p.linkUrl && p.status === PaymentStatus.PENDING ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  p.linkUrl as string,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              Ver link
                            </Button>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="h-9">
                                <MoreHorizontal className="h-4 w-4 mr-2" />
                                Ações
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem
                                onClick={() => setSelectedPayment(p)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={
                                  !(
                                    p.status === PaymentStatus.PENDING &&
                                    p.paymentMethod === "Link"
                                  )
                                }
                                onClick={() => confirmCancelPayment(p)}
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelar pagamento
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Pagination */}
                <div className="flex items-center justify-between py-3">
                  <div className="text-sm text-muted-foreground">
                    {filteredPayments.length} registro(s) • Página {page} de{" "}
                    {Math.max(1, Math.ceil(filteredPayments.length / pageSize))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setPage((p) =>
                          Math.min(
                            Math.ceil(filteredPayments.length / pageSize) || 1,
                            p + 1,
                          ),
                        )
                      }
                      disabled={
                        page >=
                        (Math.ceil(filteredPayments.length / pageSize) || 1)
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: flow selection (stacked neutral buttons) */}
      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Como deseja gerar o link?</DialogTitle>
            <DialogDescription>
              Escolha usar a venda atual ou criar uma nova antes do checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={handleChooseExisting}
              className="w-full rounded-md border p-4 text-left hover:bg-muted transition"
            >
              <div className="font-medium">Usar venda existente</div>
              <div className="text-sm text-muted-foreground">
                Gerar link com base na venda selecionada
              </div>
            </button>

            <button
              type="button"
              onClick={handleCreateNew}
              className="w-full rounded-md border p-4 text-left hover:bg-muted transition"
            >
              <div className="font-medium">Criar nova venda</div>
              <div className="text-sm text-muted-foreground">
                Cadastre cliente + serviço antes do link
              </div>
            </button>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChoiceOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Generate link (existing sale) */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar link de pagamento</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar o checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Valor */}
            <div>
              <Label htmlFor="amount" className="mb-2">
                Valor a cobrar (R$)
              </Label>
              <Input
                id="amount"
                type="text"
                placeholder="150"
                value={linkForm.amount}
                onChange={(e) => {
                  const formatted = e.target.value.replace(/[^\d.,]/g, "");
                  setLinkForm((p) => ({
                    ...p,
                    amount: Number(formatted.replace(",", ".")) || 0,
                  }));
                }}
              />
            </div>

            {/* Client and Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName" className="mb-2">
                  Cliente (opcional)
                </Label>
                <Input
                  id="customerName"
                  type="text"
                  placeholder="Emanuel Lázaro"
                  value={linkForm.customerName || ""}
                  onChange={(e) =>
                    setLinkForm((p) => ({ ...p, customerName: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="customerEmail" className="mb-2">
                  E-mail (opcional)
                </Label>
                <Input
                  id="customerEmail"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={linkForm.customerEmail || ""}
                  onChange={(e) =>
                    setLinkForm((p) => ({
                      ...p,
                      customerEmail: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Phone, ZIP, and Number */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="customerPhone" className="mb-2">
                  Telefone (opcional)
                </Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  value={linkForm.customerPhone || ""}
                  onChange={(e) => {
                    const formatted = formatBrazilianPhone(e.target.value);
                    setLinkForm((p) => ({ ...p, customerPhone: formatted }));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="addressCep" className="mb-2">
                  CEP
                </Label>
                <Input
                  id="addressCep"
                  type="text"
                  placeholder="00000-000"
                  maxLength={9}
                  value={linkForm.addressCep || ""}
                  onChange={(e) => {
                    const formatted = formatCEP(e.target.value);
                    setLinkForm((p) => ({ ...p, addressCep: formatted }));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="addressNumber" className="mb-2">
                  Número
                </Label>
                <Input
                  id="addressNumber"
                  type="text"
                  placeholder="123"
                  value={linkForm.addressNumber || ""}
                  onChange={(e) =>
                    setLinkForm((p) => ({
                      ...p,
                      addressNumber: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Rua e Bairro (NOVA LINHA) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addressStreet" className="mb-2">
                  Rua (opcional)
                </Label>
                <Input
                  id="addressStreet"
                  type="text"
                  placeholder="Rua, avenida, logradouro..."
                  value={linkForm.addressStreet || ""}
                  onChange={(e) =>
                    setLinkForm((p) => ({
                      ...p,
                      addressStreet: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="addressNeighborhood" className="mb-2">
                  Bairro (opcional)
                </Label>
                <Input
                  id="addressNeighborhood"
                  type="text"
                  placeholder="Morro Grande"
                  value={linkForm.addressNeighborhood || ""}
                  onChange={(e) =>
                    setLinkForm((p) => ({
                      ...p,
                      addressNeighborhood: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Complemento */}
            <div>
              <Label htmlFor="addressComplement" className="mb-2">
                Complemento
              </Label>
              <Input
                id="addressComplement"
                type="text"
                placeholder="Apto, bloco..."
                value={linkForm.addressComplement || ""}
                onChange={(e) =>
                  setLinkForm((p) => ({
                    ...p,
                    addressComplement: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkOpen(false)}
              disabled={submitting}
            >
              Fechar
            </Button>
            <Button onClick={submitGenerateLink} disabled={submitting}>
              {submitting ? "Gerando..." : "Gerar link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Manual payment registration */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Inclua um pagamento manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm mb-1">Valor pago (R$)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payForm.amount}
                onChange={(e) =>
                  setPayForm((p) => ({ ...p, amount: Number(e.target.value) }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Método (opcional)</label>
                <Select
                  value={payForm.paymentMethod || "NA"}
                  onValueChange={(v) =>
                    setPayForm((p) => ({
                      ...p,
                      paymentMethod: v === "NA" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o método de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NA">N/A</SelectItem>
                    {paymentMethods.map((opt) => (
                      <SelectItem key={opt.id} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm mb-1">
                  Transação/NSU (opcional)
                </label>
                <Input
                  placeholder="NSU / ID externo"
                  value={payForm.externalTransactionId || ""}
                  onChange={(e) =>
                    setPayForm((p) => ({
                      ...p,
                      externalTransactionId: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">
                Profissional (opcional)
              </label>
              <Combobox
                placeholder="Selecione o profissional"
                items={(professionals || []).map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                value={payForm.professionalId || ""}
                onChange={(v) =>
                  setPayForm((p) => ({ ...p, professionalId: v }))
                }
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                Data/hora do pagamento
              </label>
              <Input
                type="datetime-local"
                value={payForm.paidAt || ""}
                onChange={(e) =>
                  setPayForm((p) => ({ ...p, paidAt: e.target.value }))
                }
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPayOpen(false)}
              disabled={submitting}
            >
              Fechar
            </Button>
            <Button
              onClick={submitRegisterPayment}
              disabled={submitting || !payForm.amount}
            >
              {submitting ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: status confirmation */}
      <Dialog open={!!confirmOpen} onOpenChange={() => setConfirmOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar ação</DialogTitle>
            <DialogDescription>
              {confirmOpen?.type === "paid"
                ? "Marcar esta venda como PAGA?"
                : paidAmount(confirmOpen?.sale as Sale) > 0
                  ? "Estornar esta venda? Todos os pagamentos realizados serão marcados como estornados e o valor será deduzido da receita."
                  : "Cancelar esta venda? Esta ação não pode ser desfeita."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(null)}
              disabled={submitting}
            >
              Fechar
            </Button>
            <Button
              variant={confirmOpen?.type === "paid" ? "default" : "destructive"}
              onClick={applyConfirm}
              disabled={submitting}
            >
              {submitting ? "Aplicando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Sale details */}
      <Dialog open={saleDetailsOpen} onOpenChange={setSaleDetailsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da venda</DialogTitle>
            <DialogDescription>Itens e pagamentos vinculados</DialogDescription>
          </DialogHeader>

          {selectedSale ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Cliente</div>
                  <div className="font-medium">
                    {selectedSale.clientName || "—"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">
                    {selectedSale.status === SaleStatus.PAID
                      ? "Pago"
                      : selectedSale.status === SaleStatus.CANCELLED
                        ? "Cancelado"
                        : "Pendente"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="font-medium">
                    {currency(selectedSale.totalAmount)}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Saldo</div>
                  <div className="font-medium">
                    {currency(balance(selectedSale))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 font-medium">Itens</div>
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-12 gap-0 px-3 py-2 text-xs text-muted-foreground bg-muted/40">
                    <div className="col-span-4">Serviço/tipo</div>
                    <div className="col-span-3">Profissional</div>
                    <div className="col-span-1 text-right">Qtd.</div>
                    <div className="col-span-2 text-right">Unitário</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                  </div>
                  {(selectedSale.items || []).map((it, idx) => (
                    <div
                      key={`item-${selectedSale.id}-${idx}`}
                      className="grid grid-cols-12 gap-0 px-3 py-2 text-sm items-center"
                    >
                      <div className="col-span-4 truncate">
                        {it.serviceName} {it.serviceVariantName}
                      </div>
                      <div className="col-span-3 truncate text-muted-foreground">
                        {it.professionalName || "—"}
                      </div>
                      <div className="col-span-1 text-right">{it.quantity}</div>
                      <div className="col-span-2 text-right">
                        {currency(it.unitPrice)}
                      </div>
                      <div className="col-span-2 text-right font-medium">
                        {currency(it.quantity * it.unitPrice)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 font-medium">Pagamentos</div>
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-12 gap-0 px-3 py-2 text-xs text-muted-foreground bg-muted/40">
                    <div className="col-span-3">Criado em</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Método</div>
                    <div className="col-span-3">NSU / Link</div>
                  </div>
                  {(selectedSale.payments || []).map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-12 gap-0 px-3 py-2 text-sm"
                    >
                      <div className="col-span-3">
                        {new Date(p.created_at || "").toLocaleString("pt-BR")}
                      </div>
                      <div className="col-span-2 text-right">
                        {currency(p.amount)}
                      </div>
                      <div className="col-span-2">
                        <Badge
                          variant={
                            p.status === PaymentStatus.PAID
                              ? "default"
                              : p.status === PaymentStatus.PENDING
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {p.status === PaymentStatus.PAID
                            ? "Pago"
                            : p.status === PaymentStatus.PENDING
                              ? "Pendente"
                              : p.status === PaymentStatus.REFUNDED
                                ? "Estornado"
                                : p.status === PaymentStatus.FAILED
                                  ? "Falhou"
                                  : p.status === PaymentStatus.CANCELLED
                                    ? "Cancelado"
                                    : p.status}
                        </Badge>
                      </div>
                      <div className="col-span-2 truncate">
                        {p.paymentMethod || "—"}
                      </div>
                      <div className="col-span-3 truncate">
                        {p.linkUrl ? (
                          <a
                            className="underline"
                            href={p.linkUrl as string}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir link
                          </a>
                        ) : (
                          p.externalTransactionId || "—"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaleDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: payment details (simple view) */}
      <Dialog
        open={!!selectedPayment}
        onOpenChange={() => setSelectedPayment(null)}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do pagamento</DialogTitle>
            <DialogDescription>
              Informações do registro selecionado
            </DialogDescription>
          </DialogHeader>

          {selectedPayment ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">ID Pagamento</div>
                  <div className="font-medium">{selectedPayment.id}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Venda ID</div>
                  <div className="font-medium">
                    {selectedPayment.saleId || "—"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Valor</div>
                  <div className="font-medium text-primary font-bold">
                    {currency(selectedPayment.amount)}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">
                    {selectedPayment.status}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Método</div>
                  <div className="font-medium">
                    {selectedPayment.paymentMethod || "—"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">NSU / Ref</div>
                  <div className="font-medium">
                    {selectedPayment.externalTransactionId || "—"}
                  </div>
                </div>
              </div>

              {/* Joined Sale Info */}
              {(() => {
                const parentSale = sales.find(
                  (s) => s.id === selectedPayment.saleId,
                );
                if (!parentSale) return null;

                // Unique professionals in this sale
                const profs = new Set(
                  (parentSale.items || [])
                    .map((it) => {
                      const p = professionals.find(
                        (p) => p.id === it.professionalId,
                      );
                      return p ? p.name : null;
                    })
                    .filter(Boolean),
                );

                return (
                  <div className="space-y-3">
                    <Separator />
                    <div>
                      <div className="font-semibold mb-1">
                        Informações da Venda
                      </div>
                      <div className="text-muted-foreground">
                        Cliente:{" "}
                        <span className="text-foreground font-medium">
                          {parentSale.clientName}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Profissional(is):{" "}
                        <span className="text-foreground font-medium">
                          {Array.from(profs).join(", ") ||
                            parentSale.professionalName ||
                            "—"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Serviços na Venda
                      </div>
                      <div className="rounded-md border divide-y overflow-hidden">
                        {(parentSale.items || []).map((it, idx) => (
                          <div
                            key={idx}
                            className="p-2 flex justify-between bg-muted/10"
                          >
                            <div>
                              <div className="font-medium">
                                {it.serviceName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {it.serviceVariantName} x{it.quantity}
                              </div>
                            </div>
                            <div className="text-right font-medium">
                              {currency(it.subtotal)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Data do Pagamento</div>
                <div className="font-medium">
                  {new Date(
                    selectedPayment.paidAt || selectedPayment.created_at || "",
                  ).toLocaleString("pt-BR")}
                </div>
              </div>

              {selectedPayment.linkUrl ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      selectedPayment.linkUrl as string,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Visualizar Link de Pagamento
                </Button>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedPayment(null)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: payment cancellation confirmation */}
      <Dialog
        open={!!confirmPaymentCancelOpen}
        onOpenChange={() => setConfirmPaymentCancelOpen(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar cancelamento</DialogTitle>
            <DialogDescription>
              Cancelar este pagamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmPaymentCancelOpen(null)}
              disabled={submitting}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={applyCancelPayment}
              disabled={submitting}
            >
              {submitting ? "Cancelando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================
          NOVO MODAL: Selecionar venda
         ========================= */}
      <Dialog open={selectSaleOpen} onOpenChange={setSelectSaleOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Selecionar venda</DialogTitle>
            <DialogDescription>
              Escolha a venda para continuar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Buscar por cliente ou ID..."
              value={selectQuery}
              onChange={(e) => setSelectQuery(e.target.value)}
            />

            <div className="max-h-80 overflow-auto rounded-md border">
              <ul className="divide-y">
                {filteredSales
                  .filter((s) => s.status !== SaleStatus.CANCELLED)
                  .filter((s) => {
                    const q = selectQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (s.clientName || "").toLowerCase().includes(q) ||
                      String(s.id).includes(q)
                    );
                  })
                  .map((s) => {
                    const paid = paidAmount(s);
                    const due = balance(s);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => handlePickSaleForAction(s)}
                          className="w-full px-3 py-2 text-left hover:bg-muted transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="truncate">
                              <div className="font-medium truncate">
                                {s.clientName}
                                {s.items?.[0]
                                  ? ` — ${s.items[0].serviceName} (${s.items[0].serviceVariantName})`
                                  : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Total {currency(s.totalAmount)} • Pago{" "}
                                {currency(paid)} • Saldo {currency(due)}
                              </div>
                            </div>
                            <Badge
                              variant={
                                s.status === SaleStatus.PAID
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {s.status === SaleStatus.PAID
                                ? "Pago"
                                : "Pendente"}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectSaleOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================
        NOVO MODAL: Nova venda
        ======================== */}
      <Dialog open={newSaleOpen} onOpenChange={setNewSaleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova venda</DialogTitle>
            <DialogDescription>
              Cadastre o cliente e os itens da venda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Client */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Combobox
                placeholder="Cliente"
                items={(clients || []).map((c) => {
                  const phoneLabel = c.phone
                    ? formatBrazilianPhone(c.phone)
                    : "";
                  return {
                    value: c.id,
                    label: c.phone ? `${c.name} - ${phoneLabel}` : c.name,
                  };
                })}
                value={newSaleForm.clientId}
                onChange={(v) => setNewSaleForm((f) => ({ ...f, clientId: v }))}
              />
            </div>

            <Separator />

            {/* Itens */}
            <div className="flex items-center justify-between">
              <Label className="text-base">Itens</Label>
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={addItemRow}
              >
                Adicionar item
              </Button>
            </div>

            {newSaleForm.items.length === 0 ? (
              <Alert>
                <AlertDescription>Nenhum item adicionado.</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3">
              {newSaleForm.items.map((it, idx) => {
                const variantItems = (variants || []).map((v) => {
                  const svc = (services || []).find(
                    (s) => s.id === v.serviceId,
                  );
                  const svcName = svc ? svc.name : "Serviço";
                  return {
                    value: v.id,
                    label: `${svcName} (${v.variantName})`,
                    hint: `R$ ${Number(v.price).toFixed(2)}`,
                  };
                });

                const professionalItems = (professionals || []).map((p) => ({
                  value: p.id,
                  label: p.name,
                }));

                return (
                  <div
                    key={it.rowId}
                    className="space-y-3 p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="grid grid-cols-12 gap-3">
                      {/* Service/type (11) */}
                      <div className="col-span-11 space-y-2">
                        <Label>Serviço/tipo</Label>
                        <Combobox
                          placeholder="Serviço/tipo"
                          items={variantItems}
                          value={it.serviceVariantId}
                          onChange={(v) => {
                            const matched = variants.find((vv) => vv.id === v);
                            onChangeItem(idx, {
                              serviceVariantId: v,
                              unitPrice: matched ? Number(matched.price) : 0,
                            });
                          }}
                        />
                      </div>

                      {/* Remove (1) */}
                      <div className="col-span-1 flex items-end pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-9 w-9"
                          onClick={() => removeItemRow(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      {/* Professional (6) */}
                      <div className="col-span-6 space-y-2">
                        <Label>Profissional</Label>
                        <Combobox
                          placeholder="Profissional"
                          items={professionalItems}
                          value={it.professionalId}
                          onChange={(v) =>
                            onChangeItem(idx, { professionalId: v })
                          }
                        />
                      </div>

                      {/* Quantity (2) */}
                      <div className="col-span-2 space-y-2">
                        <Label>Qtd.</Label>
                        <Input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) =>
                            onChangeItem(idx, {
                              quantity: Number(e.target.value),
                            })
                          }
                        />
                      </div>

                      {/* Unit Price (4) */}
                      <div className="col-span-4 space-y-2">
                        <Label>Preço</Label>
                        <Input
                          type="number"
                          value={it.unitPrice}
                          onChange={(e) =>
                            onChangeItem(idx, {
                              unitPrice: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {newSaleError ? (
              <Alert variant="destructive">
                <AlertDescription>{newSaleError}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="hidden sm:block">
              <div className="text-xs text-muted-foreground">
                Total estimado
              </div>
              <div className="text-lg font-bold">
                {currency(
                  newSaleForm.items.reduce(
                    (acc, it) => acc + it.quantity * it.unitPrice,
                    0,
                  ),
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setNewSaleOpen(false)}
                disabled={newSaleLoading}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={submitNewSale}
                disabled={newSaleLoading || newSaleForm.items.length === 0}
              >
                {newSaleLoading ? "Salvando..." : "Salvar venda"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
