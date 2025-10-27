"use client"

import { useEffect, useMemo, useState } from "react"
import { Combobox, type ComboItem } from "@/components/ui/combobox";
import type { Sale, Payment } from "@/lib/types"
import type { Client, Service, ServiceVariant } from "@/lib/types";
import { PaymentStatus, SaleStatus } from "@/lib/types"
import * as api from "@/services/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Trash } from "lucide-react";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"

// ícones
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
} from "lucide-react"

// Tipos de formulário
type LinkForm = {
  amount: number
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  addressCep?: string
  addressNumber?: string
  addressComplement?: string
}

type PaymentForm = {
  amount: number
  paymentMethod?: string
  externalTransactionId?: string
  paidAt?: string
}

type DateRange = {
  start?: string // yyyy-MM-dd
  end?: string // yyyy-MM-dd
}

function currency(n: number) {
  return `R$ ${Number(n || 0).toFixed(2)}`
}

function withinRange(iso: string, range: DateRange) {
  if (!range.start && !range.end) return true
  const d = new Date(iso).getTime()
  if (range.start && d < new Date(range.start + "T00:00:00").getTime()) return false
  if (range.end && d > new Date(range.end + "T23:59:59").getTime()) return false
  return true
}

function ClientComboBox({
  value, onChange, options, disabled,
}: { value: string; onChange: (v: string) => void; options: { id: string; name: string }[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-9" disabled={disabled}>
          {selected ? selected.name : "Selecione..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={o.name} onSelect={() => { onChange(o.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", o.id === value ? "opacity-100" : "opacity-0")} />
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function VariantComboBox({
  value, onChange, options, disabled,
}: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-9" disabled={disabled}>
          {selected ? selected.label : "Selecione..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
        <Command>
          <CommandInput placeholder="Buscar serviço/variante..." />
          <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={o.label} onSelect={() => { onChange(o.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", o.id === value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function FinanceiroPage() {
  // Estado base
  const [sales, setSales] = useState<Sale[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | SaleStatus>("")
  const [dateRange, setDateRange] = useState<DateRange>({})

  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Seções (vendas | pagamentos)
  const [activeTab, setActiveTab] = useState<"sales" | "payments">("sales")

  // Seleções
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  // Modais já existentes
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [saleDetailsOpen, setSaleDetailsOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState<null | { sale: Sale; type: "paid" | "cancel" }>(null)

  // Forms
  const [linkForm, setLinkForm] = useState<LinkForm>({ amount: 0 })
  const [payForm, setPayForm] = useState<PaymentForm>({ amount: 0, paidAt: "" })
  const [submitting, setSubmitting] = useState(false)

  // =========================
  // NOVOS ESTADOS E HANDLERS (sem remover nada)
  // =========================
  // Modal global para escolher a venda antes de abrir link/pagamento
  const [selectSaleOpen, setSelectSaleOpen] = useState(false)
  const [selectIntent, setSelectIntent] = useState<"link" | "pay" | null>(null)
  const [selectQuery, setSelectQuery] = useState("")
  // NOVOS ESTADOS (modal de nova venda)
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [newSaleLoading, setNewSaleLoading] = useState(false);
  const [newSaleError, setNewSaleError] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);

  // listas auxiliares
  const [clients, setClients] = useState<Client[]>([]);
  const [variants, setVariants] = useState<ServiceVariant[]>([]);

  // formulário da nova venda
  type NewSaleItemForm = { rowId: string; serviceVariantId: string; quantity: number; unitPrice: number };
  type NewSaleForm = { clientId: string; items: NewSaleItemForm[]; notes?: string };
  const [newSaleForm, setNewSaleForm] = useState<NewSaleForm>({ clientId: "", items: [] });

  // intenção após salvar: continuar em link ou pagamento
  const [continueAfterCreate, setContinueAfterCreate] = useState<null | "link" | "pay">(null);

  useEffect(() => {
    if (!newSaleOpen) return;
    (async () => {
      try {
        const [c, s, v] = await Promise.all([
          api.getActiveClients?.() ?? api.getClients?.(),
          api.getActiveServices?.() ?? api.getServices?.(),
          api.getServiceVariants?.(),
        ]);

        if (c) setClients(c as Client[]);
        if (s) setServices(s as Service[]);
        if (v) setVariants(v as ServiceVariant[]);
      } catch (e) {
        // silencioso: o modal mostra erro apenas no submit
      }
    })();
  }, [newSaleOpen]);

  function addItemRow() {
    setNewSaleForm(f => ({
      ...f,
      items: [
        ...f.items,
        { rowId: crypto.randomUUID(), serviceVariantId: "", quantity: 1, unitPrice: 0 }
      ],
    }));
  }

  function removeItemRow(idx: number) {
    setNewSaleForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  }

  function onChangeItem(idx: number, patch: Partial<NewSaleItemForm>) {
    setNewSaleForm(f => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }

  async function submitNewSale() {
    setNewSaleLoading(true);
    setNewSaleError(null);
    try {
      if (!newSaleForm.clientId || newSaleForm.items.length === 0) {
        throw new Error("Selecione o cliente e adicione pelo menos 1 item");
      }
      // calcula total localmente; o backend também recalcula
      const created = await (api as any).createSale?.({
        clientId: newSaleForm.clientId,
        items: newSaleForm.items.map((it) => ({
          serviceVariantId: it.serviceVariantId,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
        })),
        notes: (newSaleForm as any).notes || undefined,
        status: SaleStatus.PENDING,
      });
      if (!created) throw new Error("Falha ao criar venda");
      await refreshAll();
      setNewSaleOpen(false);
      setSelectedSale(created);

      const due = Math.max(0, Number(created.totalAmount) -
        (created.payments || []).filter((p: any) => p.status === "paid")
          .reduce((a: number, p: any) => a + Number(p.amount || 0), 0));

      if (continueAfterCreate === "link") {
        setLinkForm({ amount: Number(due.toFixed(2)), customerName: created.clientName });
        setLinkOpen(true);
      } else if (continueAfterCreate === "pay") {
        setPayForm({
          amount: Number(due.toFixed(2)),
          paidAt: new Date().toISOString().slice(0, 16),
          paymentMethod: "",
          externalTransactionId: "",
        });
        setPayOpen(true);
      }
    } catch (e: any) {
      setNewSaleError(e?.message || "Não foi possível criar a venda");
    } finally {
      setNewSaleLoading(false);
    }
  }

  function openSelectSale(intent: "link" | "pay") {
    setSelectIntent(intent)
    setSelectSaleOpen(true)
  }

  function handlePickSaleForAction(sale: Sale) {
    setSelectedSale(sale)
    setSelectSaleOpen(false)

    if (selectIntent === "link") {
      const defaultAmount = Number(balance(sale).toFixed(2))
      setLinkForm({
        amount: defaultAmount,
        customerName: sale.clientName,
      })
      setLinkOpen(true)
    }
    if (selectIntent === "pay") {
      const defaultAmount = Number(balance(sale).toFixed(2))
      setPayForm({
        amount: defaultAmount,
        paidAt: new Date().toISOString().slice(0, 16),
        paymentMethod: "",
        externalTransactionId: "",
      })
      setPayOpen(true)
    }
  }
  // =========================

  // Carregar dados
  async function refreshAll() {
    setLoading(true)
    setError(null)
    try {
      const [s, p] = await Promise.all([api.getSales(), api.getPayments()])
      setSales(s || [])
      setPayments(p || [])
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar financeiro")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  // Helpers de valores
  function paidAmount(sale: Sale) {
    return (sale.payments || [])
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }

  function balance(sale: Sale) {
    return Math.max(0, Number(sale.totalAmount) - paidAmount(sale))
  }

  // Filtros memorizados
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase()
    const arr = (sales || []).filter((s) => {
      const inText =
        !q ||
        (s.clientName || "").toLowerCase().includes(q) ||
        String(s.id).includes(q) ||
        (s.items || []).some((it) => (it.serviceVariantName || "").toLowerCase().includes(q))
      const inStatus = !statusFilter || s.status === statusFilter
      const inDate = withinRange((s as any).created_at || (s as any).created_at || new Date().toISOString(), dateRange)
      return inText && inStatus && inDate
    })
    return arr
  }, [sales, search, statusFilter, dateRange])

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase()
    const arr = (payments || []).filter((p) => {
      const inText =
        !q ||
        String(p.id).includes(q) ||
        ((p as any).saleId && String((p as any).saleId).includes(q)) ||
        ((p as any).paymentMethod || "").toLowerCase().includes(q) ||
        ((p as any).externalTransactionId || "").toLowerCase().includes(q)
      const inDate = withinRange((p as any).created_at || (p as any).created_at || new Date().toISOString(), dateRange)
      return inText && inDate
    })
    return arr
  }, [payments, search, dateRange])

  // Paginação por aba
  const pagedSales = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredSales.slice(start, start + pageSize)
  }, [filteredSales, page, pageSize])

  const pagedPayments = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredPayments.slice(start, start + pageSize)
  }, [filteredPayments, page, pageSize])

  // Controles de UI
  function resetFilters() {
    setSearch("")
    setStatusFilter("")
    setDateRange({})
    setPage(1)
  }

  function openChoice(sale: Sale) {
    setSelectedSale(sale)
    setChoiceOpen(true)
  }

  function handleChooseExisting() {
    if (!selectedSale) return
    setChoiceOpen(false)
    const defaultAmount = Number(balance(selectedSale).toFixed(2))
    setLinkForm({
      amount: defaultAmount,
      customerName: selectedSale.clientName,
    })
    setLinkOpen(true)
  }

  function handleCreateNew() {
    setContinueAfterCreate("link"); // ao salvar, já abre o modal de link
    setChoiceOpen(false);
    setNewSaleOpen(true);
  }

  function openRegisterPayment(sale: Sale) {
    setSelectedSale(sale)
    const defaultAmount = Number(balance(sale).toFixed(2))
    setPayForm({
      amount: defaultAmount,
      paidAt: new Date().toISOString().slice(0, 16),
      paymentMethod: "",
      externalTransactionId: "",
    })
    setPayOpen(true)
  }

  function openSaleDetails(sale: Sale) {
    setSelectedSale(sale)
    setSaleDetailsOpen(true)
  }

  function confirmStatus(sale: Sale, type: "paid" | "cancel") {
    setConfirmOpen({ sale, type })
  }

  // Ações com backend
  async function submitGenerateLink() {
    if (!selectedSale) return;
    setSubmitting(true); setError(null);
    try {
      const out = await api.createPaymentLink({
        saleId: (selectedSale as any).id,
        amount: Number(linkForm.amount),
        items: ((selectedSale as any).items || []).map((it: any) => ({
          quantity: it.quantity,
          price: Math.round(Number(it.unitPrice) * 100),
          description: it.serviceVariantName || `Item ${it.serviceVariantId}`,
        })),
        customer: { name: linkForm.customerName, email: linkForm.customerEmail, phone_number: linkForm.customerPhone },
        address: { cep: linkForm.addressCep, number: linkForm.addressNumber, complement: linkForm.addressComplement },
      });
      window.open(out.url, "_blank", "noopener,noreferrer");
      await refreshAll();
      setLinkOpen(false);
    } catch (e:any) {
      setError(e?.message || "Falha ao gerar link");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRegisterPayment() {
    if (!selectedSale) return
    setSubmitting(true)
    setError(null)
    try {
      await api.createPayment({
        saleId: (selectedSale as any).id,
        amount: Number(payForm.amount),
        status: PaymentStatus.PAID,
        paidAt: payForm.paidAt ? new Date(payForm.paidAt).toISOString() : new Date().toISOString(),
        paymentMethod: payForm.paymentMethod || undefined,
        externalTransactionId: payForm.externalTransactionId || undefined,
        // Mantendo compatibilidade com seu backend atual sem remover nada
        // Caso o tipo exija createdAt, o serviço pode preencher server-side
      } as any)
      await refreshAll()
      setPayOpen(false)
    } catch (e: any) {
      setError(e?.message || "Falha ao registrar pagamento")
    } finally {
      setSubmitting(false)
    }
  }

  async function applyConfirm() {
    if (!confirmOpen) return
    setSubmitting(true)
    setError(null)
    try {
      if (confirmOpen.type === "paid") {
        await api.updateSaleStatus((confirmOpen.sale as any).id, SaleStatus.PAID)
      } else {
        await api.updateSaleStatus((confirmOpen.sale as any).id, SaleStatus.CANCELLED)
      }
      await refreshAll()
      setConfirmOpen(null)
    } catch (e: any) {
      setError(e?.message || "Falha ao atualizar status")
    } finally {
      setSubmitting(false)
    }
  }

  // Exportação CSV (cliente)
  function exportCSV() {
    const headers =
      activeTab === "sales"
        ? ["id", "cliente", "status", "total", "pago", "saldo", "criado_em"]
        : ["id", "sale_id", "valor", "status", "metodo", "nsu", "criado_em"]

    const rows =
      activeTab === "sales"
        ? filteredSales.map((s: any) => [
            s.id,
            s.clientName || "",
            s.status,
            Number(s.totalAmount).toFixed(2),
            paidAmount(s).toFixed(2),
            balance(s).toFixed(2),
            (s.created_at || s.created_at || "").toString(),
          ])
        : filteredPayments.map((p: any) => [
            p.id,
            p.saleId || "",
            Number(p.amount).toFixed(2),
            p.status,
            p.paymentMethod || "",
            p.externalTransactionId || "",
            (p.created_at || p.created_at || "").toString(),
          ])

    const csv =
      [headers.join(","), ...rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))].join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = activeTab === "sales" ? "vendas.csv" : "pagamentos.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Quando muda a aba, resetar página
  useEffect(() => {
    setPage(1)
  }, [activeTab, pageSize, filteredSales.length, filteredPayments.length])

  return (
    <div className="space-y-4 p-4">
      {/* Título */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Vendas, pagamentos e links de checkout</p>
      </div>

      {/* Filtros e ações (mobile-first, altamente responsivo) */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          {/* Filtros */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {/* Busca */}
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
                onChange={(e) => setStatusFilter((e.target.value || '') as any)}
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
              value={dateRange.start || ''}
              onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value || undefined }))}
              aria-label="Data inicial"
            />
            <Input
              type="date"
              className="h-10 w-full"
              value={dateRange.end || ''}
              onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value || undefined }))}
              aria-label="Data final"
            />

            {/* Ações rápidas */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 w-full"
                onClick={() => {
                  resetFilters()
                  void refreshAll()
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

          {/* Abas + toolbar */}
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Abas */}
            <div className="inline-flex w-full overflow-hidden rounded-md border md:w-auto">
              {(['sales', 'payments'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'default' : 'ghost'}
                  onClick={() => setActiveTab(tab)}
                  className="h-9 rounded-none px-3 flex-1 md:flex-none"
                >
                  {tab === 'sales' ? 'Vendas' : 'Pagamentos'}
                </Button>
              ))}
            </div>

            {/* Toolbar responsiva */}
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
              {/* Itens por página */}
              <div className="inline-flex items-center gap-2 shrink-0">
                <span className="text-sm text-muted-foreground">
                  <span className="md:hidden whitespace-nowrap">Itens/pág.</span>
                  <span className="hidden md:inline">Itens por página</span>
                </span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Itens por página"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Exportar */}
              <Button
                variant="outline"
                className="h-9 shrink-0"
                onClick={exportCSV}
                aria-label="Exportar CSV"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="md:hidden whitespace-nowrap">Exp. CSV</span>
                <span className="hidden md:inline">Exportar CSV</span>
              </Button>

              {/* CTAs (abrev. no mobile, texto cheio no md+) */}
              <div className="flex flex-1 flex-wrap gap-2 md:flex-none">
                <Button
                  className="h-9 w-full sm:w-auto"
                  onClick={() => { setContinueAfterCreate(null); setNewSaleOpen(true); }}
                  aria-label="Nova venda"
                >
                  <span className="md:inline">Nova venda</span>
                </Button>

                <Button
                  className="h-9 w-full sm:w-auto"
                  variant="outline"
                  onClick={() => openSelectSale('pay')}
                  aria-label="Registrar pagamento"
                >
                  <span className="md:inline">Registrar pagamento</span>
                </Button>

                <Button
                  className="h-9 w-full sm:w-auto"
                  variant="outline"
                  onClick={() => openSelectSale('link')}
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

      {/* Conteúdo principal */}
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
              <div className="text-sm text-muted-foreground p-4">Nenhuma venda encontrada</div>
            ) : (
              <>
                <ul className="divide-y">
                  {pagedSales.map((s: any) => {
                    const paid = paidAmount(s)
                    const due = balance(s)
                    return (
                      <li key={s.id} className="py-3 px-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium truncate">
                                {s.clientName || "Cliente"} — {s.items[0]?.serviceName} {s.items[0]?.serviceVariantName}
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
                              Total: {currency(s.totalAmount)} • Pago: {currency(paid)} • Saldo: {currency(due)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="outline" className="h-9" onClick={() => openSaleDetails(s)}>
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
                                <DropdownMenuItem onClick={() => openRegisterPayment(s)}>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Registrar pagamento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => confirmStatus(s, "paid")}
                                  disabled={s.status === SaleStatus.PAID}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Marcar como pago
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => confirmStatus(s, "cancel")}
                                  disabled={s.status === SaleStatus.CANCELLED}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelar venda
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* Paginação */}
                <div className="flex items-center justify-between py-3">
                  <div className="text-sm text-muted-foreground">
                    {filteredSales.length} registro(s) • Página {page} de {Math.max(1, Math.ceil(filteredSales.length / pageSize))}
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
                        setPage((p) => Math.min(Math.ceil(filteredSales.length / pageSize) || 1, p + 1))
                      }
                      disabled={page >= (Math.ceil(filteredSales.length / pageSize) || 1)}
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
              <div className="text-sm text-muted-foreground p-4">Nenhum pagamento encontrado</div>
            ) : (
              <>
                <ul className="divide-y">
                  {pagedPayments.map((p: any) => (
                    <li key={p.id} className="py-3 px-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">
                              {p.clientName || "Cliente"} — {p.serviceName} {p.serviceVariantName}
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
                                : "Falhou"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Valor: {currency(p.amount)} • Método: {p.paymentMethod || "—"} • NSU:{" "}
                            {p.externalTransactionId || "—"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {p.linkUrl ? (
                            <Button
                              variant="outline"
                              className="h-9"
                              onClick={() => window.open(p.linkUrl as string, "_blank", "noopener,noreferrer")}
                            >
                              <Receipt className="h-4 w-4 mr-2" />
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
                              <DropdownMenuItem onClick={() => setSelectedPayment(p)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Detalhes
                              </DropdownMenuItem>
                              {/* Espaço para futuramente adicionar estorno/cancelamento via backend */}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Paginação */}
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
                        setPage((p) => Math.min(Math.ceil(filteredPayments.length / pageSize) || 1, p + 1))
                      }
                      disabled={page >= (Math.ceil(filteredPayments.length / pageSize) || 1)}
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

      {/* Modal: escolha do fluxo (botões empilhados e neutros) */}
      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Como deseja gerar o link?</DialogTitle>
            <DialogDescription>Escolha usar a venda atual ou criar uma nova antes do checkout.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={handleChooseExisting}
              className="w-full rounded-md border p-4 text-left hover:bg-muted transition"
            >
              <div className="font-medium">Usar venda existente</div>
              <div className="text-sm text-muted-foreground">Gerar o link com base na venda selecionada</div>
            </button>

            <button
              type="button"
              onClick={handleCreateNew}
              className="w-full rounded-md border p-4 text-left hover:bg-muted transition"
            >
              <div className="font-medium">Criar nova venda</div>
              <div className="text-sm text-muted-foreground">Cadastre cliente + serviço antes do link</div>
            </button>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChoiceOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: gerar link (venda existente) */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar link de pagamento</DialogTitle>
            <DialogDescription>Preencha os dados para criar o checkout.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm mb-1">Valor a cobrar (R$)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={linkForm.amount}
                onChange={(e) => setLinkForm((p) => ({ ...p, amount: Number(e.target.value) }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Cliente (opcional)</label>
                <Input
                  placeholder="Nome"
                  value={linkForm.customerName || ""}
                  onChange={(e) => setLinkForm((p) => ({ ...p, customerName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">E-mail (opcional)</label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={linkForm.customerEmail || ""}
                  onChange={(e) => setLinkForm((p) => ({ ...p, customerEmail: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1">Telefone (opcional)</label>
                <Input
                  placeholder="+55 11 99999-9999"
                  value={linkForm.customerPhone || ""}
                  onChange={(e) => setLinkForm((p) => ({ ...p, customerPhone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">CEP</label>
                <Input
                  placeholder="00000-000"
                  value={linkForm.addressCep || ""}
                  onChange={(e) => setLinkForm((p) => ({ ...p, addressCep: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Número</label>
                <Input
                  placeholder="123"
                  value={linkForm.addressNumber || ""}
                  onChange={(e) => setLinkForm((p) => ({ ...p, addressNumber: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Complemento</label>
              <Input
                placeholder="Apto, bloco..."
                value={linkForm.addressComplement || ""}
                onChange={(e) => setLinkForm((p) => ({ ...p, addressComplement: e.target.value }))}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkOpen(false)} disabled={submitting}>
              Fechar
            </Button>
            <Button onClick={submitGenerateLink} disabled={submitting || !linkForm.amount}>
              {submitting ? "Gerando..." : "Gerar link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: registrar pagamento manual */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>Inclua um pagamento manualmente.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm mb-1">Valor pago (R$)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm((p) => ({ ...p, amount: Number(e.target.value) }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Método (opcional)</label>
                <Input
                  placeholder="Pix, Cartão..."
                  value={payForm.paymentMethod || ""}
                  onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Transação/NSU (opcional)</label>
                <Input
                  placeholder="NSU / ID externo"
                  value={payForm.externalTransactionId || ""}
                  onChange={(e) => setPayForm((p) => ({ ...p, externalTransactionId: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Data/hora do pagamento</label>
              <Input
                type="datetime-local"
                value={payForm.paidAt || ""}
                onChange={(e) => setPayForm((p) => ({ ...p, paidAt: e.target.value }))}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={submitting}>
              Fechar
            </Button>
            <Button onClick={submitRegisterPayment} disabled={submitting || !payForm.amount}>
              {submitting ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: confirmação de status */}
      <Dialog open={!!confirmOpen} onOpenChange={() => setConfirmOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar ação</DialogTitle>
            <DialogDescription>
              {confirmOpen?.type === "paid"
                ? "Marcar esta venda como PAGA?"
                : "Cancelar esta venda? Esta ação não pode ser desfeita."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(null)} disabled={submitting}>
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

      {/* Modal: detalhes da venda */}
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
                  <div className="font-medium">{(selectedSale as any).clientName || "—"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">
                    {(selectedSale as any).status === SaleStatus.PAID
                      ? "Pago"
                      : (selectedSale as any).status === SaleStatus.CANCELLED
                      ? "Cancelado"
                      : "Pendente"}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="font-medium">{currency((selectedSale as any).totalAmount)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Saldo</div>
                  <div className="font-medium">{currency(balance(selectedSale as any))}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 font-medium">Itens</div>
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-12 gap-0 px-3 py-2 text-xs text-muted-foreground bg-muted/40">
                    <div className="col-span-6">Serviço/variante</div>
                    <div className="col-span-2 text-right">Qtd.</div>
                    <div className="col-span-2 text-right">Unitário</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                  </div>
                  {((selectedSale as any).items || []).map((it: any, idx: number) => (
                    <div key={`item-${(selectedSale as any).id}-${idx}`} className="grid grid-cols-12 gap-0 px-3 py-2 text-sm">
                      <div className="col-span-6 truncate">{it.serviceName} {it.serviceVariantName}</div>
                      <div className="col-span-2 text-right">{it.quantity}</div>
                      <div className="col-span-2 text-right">{currency(it.unitPrice)}</div>
                      <div className="col-span-2 text-right">{currency(it.quantity * it.unitPrice)}</div>
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
                  {((selectedSale as any).payments || []).map((p: any) => (
                    <div key={p.id} className="grid grid-cols-12 gap-0 px-3 py-2 text-sm">
                      <div className="col-span-3">{new Date((p as any).created_at || (p as any).created_at || "").toLocaleString("pt-BR")}</div>
                      <div className="col-span-2 text-right">{currency(p.amount)}</div>
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
                            : "Falhou"}
                        </Badge>
                      </div>
                      <div className="col-span-2 truncate">{p.paymentMethod || "—"}</div>
                      <div className="col-span-3 truncate">
                        {p.linkUrl ? (
                          <a className="underline" href={p.linkUrl as string} target="_blank" rel="noreferrer">
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

      {/* Modal: detalhes do pagamento (visualização simples) */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do pagamento</DialogTitle>
            <DialogDescription>Informações do registro selecionado</DialogDescription>
          </DialogHeader>

          {selectedPayment ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">ID</div>
                  <div className="font-medium">{(selectedPayment as any).id}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Venda</div>
                  <div className="font-medium">{(selectedPayment as any).saleId || "—"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Valor</div>
                  <div className="font-medium">{currency((selectedPayment as any).amount)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">{(selectedPayment as any).status}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Método</div>
                  <div className="font-medium">{(selectedPayment as any).paymentMethod || "—"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">NSU</div>
                  <div className="font-medium">{(selectedPayment as any).externalTransactionId || "—"}</div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Criado em</div>
                <div className="font-medium">
                  {new Date((selectedPayment as any).created_at || (selectedPayment as any).created_at || "").toLocaleString("pt-BR")}
                </div>
              </div>

              {(selectedPayment as any).linkUrl ? (
                <Button
                  variant="outline"
                  onClick={() => window.open(((selectedPayment as any).linkUrl as string), "_blank", "noopener,noreferrer")}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Abrir link
                </Button>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedPayment(null)}>
              Fechar
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
            <DialogDescription>Escolha a venda para continuar</DialogDescription>
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
                    const q = selectQuery.trim().toLowerCase()
                    if (!q) return true
                    return (
                      (s.clientName || "").toLowerCase().includes(q) ||
                      String((s as any).id).includes(q)
                    )
                  })
                  .map((s) => {
                    const paid = paidAmount(s as any)
                    const due = balance(s as any)
                    return (
                      <li key={(s as any).id}>
                        <button
                          type="button"
                          onClick={() => handlePickSaleForAction(s as any)}
                          className="w-full px-3 py-2 text-left hover:bg-muted transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="truncate">
                              <div className="font-medium truncate">
                                {(s as any).clientName || "Cliente"} — Venda #{(s as any).id}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Total {currency((s as any).totalAmount)} • Pago {currency(paid)} • Saldo {currency(due)}
                              </div>
                            </div>
                            <Badge variant={(s as any).status === SaleStatus.PAID ? "default" : "outline"}>
                              {(s as any).status === SaleStatus.PAID ? "Pago" : "Pendente"}
                            </Badge>
                          </div>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectSaleOpen(false)}>Fechar</Button>
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
            <DialogDescription>Cadastre o cliente e os itens da venda.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Combobox
                placeholder="Cliente"
                items={clients.map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.phone || "",
                }))}
                value={newSaleForm.clientId}
                onChange={(v) => setNewSaleForm((f) => ({ ...f, clientId: v }))}
              />
            </div>

            <Separator />

            {/* Itens */}
            <div className="flex items-center justify-between">
              <Label className="text-base">Itens</Label>
              <Button type="button" variant="outline" className="h-9" onClick={addItemRow}>
                Adicionar item
              </Button>
            </div>

            {newSaleForm.items.length === 0 ? (
              <Alert><AlertDescription>Nenhum item adicionado.</AlertDescription></Alert>
            ) : null}

            <div className="space-y-3">
              {newSaleForm.items.map((it, idx) => {
                const variantItems = variants.map((v) => {
                  const svc = services.find((s) => s.id === v.serviceId);
                  const svcName = svc ? svc.name : "Serviço";
                  return {
                    value: v.id,
                    label: `${svcName} (${v.variantName})`,
                    hint: `R$ ${Number(v.price).toFixed(2)}`,
                  };
                });

                return (
                  <div key={it.rowId} className="grid grid-cols-12 gap-3">
                    {/* Serviço/variante (6) */}
                    <div className="col-span-6 space-y-2">
                      <Label>Serviço/variante</Label>
                      <Combobox
                        placeholder="Serviço/variante"
                        items={variants.map((v) => {
                          const svc = services.find((s) => s.id === v.serviceId);
                          const svcName = svc ? svc.name : "Serviço";
                          return {
                            value: v.id,
                            label: `${svcName} (${v.variantName})`,
                            hint: `R$ ${Number(v.price).toFixed(2)}`,
                          };
                        })}
                        value={it.serviceVariantId}
                        onChange={(vId) => {
                          const vv = variants.find((x) => x.id === vId);
                          onChangeItem(idx, {
                            serviceVariantId: vId,
                            unitPrice: vv ? Number(vv.price) : it.unitPrice,
                          });
                        }}
                      />
                    </div>

                    {/* Quantidade (2) — menor que preço */}
                    <div className="col-span-2 space-y-2">
                      <Label>Qtd.</Label>
                      <Input
                        className="h-9"
                        inputMode="numeric"
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => onChangeItem(idx, { quantity: Number(e.target.value) })}
                      />
                    </div>

                    {/* Preço (4) + lixeira à direita */}
                    <div className="col-span-4 space-y-2">
                      <Label>Unitário (R$)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-9"
                          inputMode="decimal"
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) => onChangeItem(idx, { unitPrice: Number(e.target.value) })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItemRow(idx)}
                          aria-label="Remover item"
                          title="Remover item"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {newSaleError ? (
              <Alert><AlertDescription>{newSaleError}</AlertDescription></Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewSaleOpen(false)} disabled={newSaleLoading}>
              Fechar
            </Button>
            <Button type="button" onClick={submitNewSale} disabled={newSaleLoading}>
              {newSaleLoading ? "Salvando..." : "Salvar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ========================= */}
    </div>
  )
}
