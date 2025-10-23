"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Search,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Wallet,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
  Loader2,
  AlertCircle,
  Link2,
  FilePlus2,
  ListChecks,
  ChevronsUpDown,
  Check,
} from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

import { useData } from "@/lib/data-context"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Client, Service, ServiceVariant, Sale, Payment } from "@/lib/types"
import { PaymentStatus, SaleStatus } from "@/lib/types"
import * as api from "@/services/api"

type StatusFilter = "all" | "paid" | "pending" | "cancelled"
type EnrichedSale = Sale & { paidAmount: number; balance: number }

function Combobox({
  placeholder,
  items,
  value,
  onChange,
  emptyText = "Nenhum item encontrado",
}: {
  placeholder: string
  items: { value: string; label: string; hint?: string }[]
  value: string
  onChange: (v: string) => void
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const current = items.find(i => i.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          <span className="truncate">{current ? current.label : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Digitar para buscar..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map(it => (
                <CommandItem
                  key={it.value}
                  value={`${it.label} ${it.hint || ""}`}
                  onSelect={() => {
                    onChange(it.value)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{it.label}</span>
                  {value === it.value ? <Check className="h-4 w-4" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ChooseFlowDialog({
  open,
  onOpenChange,
  onExisting,
  onNew,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onExisting: () => void
  onNew: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Como deseja gerar o link?</DialogTitle>
          <DialogDescription>Escolha usar uma venda existente ou criar uma nova antes do checkout.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2" onClick={onExisting}>
            <ListChecks className="h-5 w-5" />
            <div className="text-left">
              <div className="text-sm font-medium">Usar venda existente</div>
              <div className="text-xs text-muted-foreground">Selecione uma venda já cadastrada</div>
            </div>
          </Button>
          <Button className="h-auto py-4 flex flex-col items-start gap-2" onClick={onNew}>
            <FilePlus2 className="h-5 w-5" />
            <div className="text-left">
              <div className="text-sm font-medium">Criar nova venda</div>
              <div className="text-xs text-muted-foreground">Cadastre cliente + serviço</div>
            </div>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewSaleDialog({
  open,
  onOpenChange,
  clients,
  services,
  variants,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  clients: Client[]
  services: Service[]
  variants: ServiceVariant[]
  onCreated: (sale: EnrichedSale) => void
}) {
  const [clientId, setClientId] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState("0")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const serviceVariants = useMemo(() => variants.filter(v => v.serviceId === serviceId), [variants, serviceId])
  const clientsItems = useMemo(() => clients.map(c => ({
    value: c.id,
    label: (c as any).name || (c as any).fullName || c.id,
  })), [clients])
  const serviceItems = useMemo(() => services.map(s => ({ value: s.id, label: s.name })), [services])
  const variantItems = useMemo(() => serviceVariants.map(v => ({
    value: v.id,
    label: `${v.variantName} • ${formatCurrency(v.price)}`,
  })), [serviceVariants])

  function onVariantChange(id: string) {
    setVariantId(id)
    const v = variants.find(vv => vv.id === id)
    if (v) {
      setServiceId(v.serviceId)
      setUnitPrice(String(v.price))
    }
  }

  const total = useMemo(() => {
    const price = Number((unitPrice || "0").replace(",", "."))
    return Math.max(0, (Number.isFinite(price) ? price : 0) * (quantity > 0 ? quantity : 0))
  }, [unitPrice, quantity])

  async function handleCreate() {
    try {
      setSaving(true)
      setError("")
      if (!clientId || !variantId || quantity <= 0) throw new Error("Selecione cliente, variante e quantidade válida")

      const unit = Number((unitPrice || "0").replace(",", "."))
      const created = await api.createSale({
        clientId,
        items: [
          {
            serviceVariantId: variantId,
            quantity,
            unitPrice: unit,
          },
        ],
        totalAmount: unit * quantity,
        status: SaleStatus.PENDING,
        notes,
        payments: [],
        createdAt: new Date().toISOString(),
      } as any)

      const paidAmount = (created.payments || [])
        .filter((p: any) => p.status === PaymentStatus.PAID)
        .reduce((acc: number, p: any) => acc + Number(p.amount), 0)

      const enriched: EnrichedSale = { ...created, paidAmount, balance: Math.max(0, created.totalAmount - paidAmount) }
      onCreated(enriched)
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || "Falha ao criar a venda")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Criar nova venda</DialogTitle>
          <DialogDescription>Defina cliente, serviço e valores antes de gerar o link.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Cliente</label>
              <Combobox placeholder="Selecione o cliente" items={clientsItems} value={clientId} onChange={setClientId} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Serviço</label>
              <Combobox placeholder="Selecione um serviço" items={serviceItems} value={serviceId} onChange={(v) => { setServiceId(v); setVariantId(""); }} />
            </div>
            <div>
              <label className="block text-sm mb-1">Variante</label>
              <Combobox placeholder="Selecione a variante" items={variantItems} value={variantId} onChange={onVariantChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Quantidade</label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Valor unitário (R$)</label>
              <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
            <div className="flex items-end justify-end">
              <div className="text-sm">
                <div className="text-muted-foreground">Total</div>
                <div className="text-lg font-semibold">{formatCurrency(total)}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Observações (opcional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas" />
          </div>

          {!!error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving || !clientId || !variantId || total <= 0}>
            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando…</>) : "Criar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaymentLinkModal({
  open,
  onOpenChange,
  sale,
  clients,
  services,
  variants,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sale: EnrichedSale | null
  clients: Client[]
  services: Service[]
  variants: ServiceVariant[]
  onSuccess: () => void
}) {
  const { createPayment } = useData()

  const [serviceId, setServiceId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [amount, setAmount] = useState("0")
  const [description, setDescription] = useState("")

  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  const [cep, setCep] = useState("")
  const [addrNumber, setAddrNumber] = useState("")
  const [addrComplement, setAddrComplement] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const serviceVariants = useMemo(() => variants.filter(v => v.serviceId === serviceId), [variants, serviceId])
  const serviceItems = useMemo(() => services.map(s => ({ value: s.id, label: s.name })), [services])
  const variantItems = useMemo(() => serviceVariants.map(v => ({
    value: v.id,
    label: `${v.variantName} • ${formatCurrency(v.price)}`,
  })), [serviceVariants])

  useEffect(() => {
    if (!sale) return
    const client = clients.find(c => c.id === sale.clientId)
    const name = (client as any)?.name ?? (client as any)?.fullName ?? ""
    const email = (client as any)?.email ?? ""
    const phone = (client as any)?.phone ?? ""
    setCustomerName(name || "")
    setCustomerEmail(email || "")
    setCustomerPhone(phone?.startsWith("+") ? phone : phone ? `+55${phone.replace(/\D/g, "")}` : "")

    const firstVarId = sale.items?.[0]?.serviceVariantId
    if (firstVarId) {
      const v = variants.find(vv => vv.id === firstVarId)
      if (v) {
        setServiceId(v.serviceId)
        setVariantId(v.id)
        setAmount(String(v.price))
        const svc = services.find(s => s.id === v.serviceId)
        const title = svc ? `${svc.name} — ${v.variantName}` : v.variantName
        setDescription(title)
      }
    } else {
      const base = sale.balance > 0 ? sale.balance : sale.totalAmount
      setAmount(String(base))
      setDescription(`Venda #${sale.id}`)
    }
  }, [sale, clients, services, variants])

  function onVariantChange(id: string) {
    setVariantId(id)
    const v = variants.find(vv => vv.id === id)
    if (v) {
      setServiceId(v.serviceId)
      setAmount(String(v.price))
      const svc = services.find(s => s.id === v.serviceId)
      const title = svc ? `${svc.name} — ${v.variantName}` : v.variantName
      setDescription(title)
    }
  }

  const total = useMemo(() => {
    const unit = Number((amount || "0").replace(",", "."))
    return Math.max(0, (Number.isFinite(unit) ? unit : 0) * (quantity > 0 ? quantity : 0))
  }, [amount, quantity])

  async function handleGenerate() {
    if (!sale) return
    setLoading(true)
    setError("")
    try {
      const priceCents = Math.round((Number((amount || "0").replace(",", ".")) || 0) * 100)
      const items = [{
        quantity: Math.max(1, quantity),
        price: priceCents,
        description: description || `Venda #${sale.id}`,
      }]

      const customer =
        customerName || customerEmail || customerPhone
          ? { name: customerName || undefined, email: customerEmail || undefined, phone_number: customerPhone || undefined }
          : undefined

      const address =
        cep || addrNumber || addrComplement
          ? { cep: cep || undefined, number: addrNumber || undefined, complement: addrComplement || undefined }
          : undefined

      const resp = await fetch("/api/infinitepay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          amount: Number((amount || "0").replace(",", ".")),
          items,
          customer,
          address,
        }),
      })
      const json = await resp.json()
      if (!resp.ok || !json?.url || !json?.order_nsu) {
        throw new Error(json?.error || "Falha ao gerar link de pagamento")
      }

      await createPayment({
        saleId: sale.id,
        amount: Number((amount || "0").replace(",", ".")),
        status: PaymentStatus.PENDING,
        paymentLinkUrl: json.url,
        externalTransactionId: json.order_nsu,
        createdAt: new Date().toISOString(),
      } as Omit<Payment, "id">)

      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || "Erro ao gerar link")
    } finally {
      setLoading(false)
    }
  }

  if (!sale) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar link de pagamento</DialogTitle>
          <DialogDescription>Selecione o serviço, ajuste os dados e gere o checkout.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            <div>Cliente: <span className="text-foreground">{sale.clientName || sale.clientId}</span></div>
            <div>Total: {formatCurrency(sale.totalAmount)} | Pago: {formatCurrency(sale.paidAmount)} | Saldo: {formatCurrency(sale.balance)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Serviço</label>
              <Combobox placeholder="Selecione um serviço" items={serviceItems} value={serviceId} onChange={(v) => { setServiceId(v); setVariantId(""); }} />
            </div>
            <div>
              <label className="block text-sm mb-1">Variante</label>
              <Combobox placeholder="Selecione a variante" items={variantItems} value={variantId} onChange={onVariantChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Quantidade</label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Valor unitário (R$)</label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1">Descrição</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Limpeza de pele — Premium" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Nome do cliente</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">E-mail</label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Telefone (+55...)</label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">CEP</label>
              <Input value={cep} onChange={(e) => setCep(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Número</label>
              <Input value={addrNumber} onChange={(e) => setAddrNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Complemento</label>
              <Input value={addrComplement} onChange={(e) => setAddrComplement(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-lg font-semibold">{formatCurrency(total)}</span>
          </div>

          {!!error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={loading || total <= 0 || !sale}>
            {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</>) : "Gerar link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function FinanceiroPage() {
  const { sales, clients, services, serviceVariants, isLoading, error, createPayment, updateSaleStatus } = useData()

  const [searchQuery, setSearchQuery] = useState("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [chooseOpen, setChooseOpen] = useState(false)
  const [selectSaleOpen, setSelectSaleOpen] = useState(false)
  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string>("")

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<EnrichedSale | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("pix")
  const [submitting, setSubmitting] = useState(false)

  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [saleForLink, setSaleForLink] = useState<EnrichedSale | null>(null)

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [saleToCancel, setSaleToCancel] = useState<EnrichedSale | null>(null)

  const enrichedSales: EnrichedSale[] = useMemo(() => {
    return (sales || []).map((s: Sale) => {
      const paid = (s.payments || [])
        .filter((p: any) => p.status === PaymentStatus.PAID)
        .reduce((acc: number, p: any) => acc + Number(p.amount), 0)
      const balance = Math.max(0, Number(s.totalAmount) - paid)
      return { ...s, paidAmount: paid, balance }
    })
  }, [sales])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const start = startDate ? new Date(startDate) : null
    const endD = endDate ? new Date(endDate + "T23:59:59.999") : null
    return enrichedSales.filter((s) => {
      const matchesText =
        !q ||
        s.clientName?.toLowerCase().includes(q) ||
        s.clientId?.toLowerCase().includes(q) ||
        s.items?.some((it: any) => String(it.serviceVariantId || "").toLowerCase().includes(q))
      const createdAt = new Date(s.createdAt)
      const matchesDate = (!start || createdAt >= start) && (!endD || createdAt <= endD)
      return matchesText && matchesDate
    })
  }, [enrichedSales, searchQuery, startDate, endDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const kpis = useMemo(() => {
    const totalPaid = enrichedSales.reduce((acc, s) => acc + s.paidAmount, 0)
    const totalBalance = enrichedSales.reduce((acc, s) => acc + s.balance, 0)
    const paidCount = enrichedSales.filter((s) => s.status === SaleStatus.PAID).length
    const pendingCount = enrichedSales.filter((s) => s.status === SaleStatus.PENDING).length
    return { totalPaid, totalBalance, paidCount, pendingCount }
  }, [enrichedSales])

  function openPaymentModal(s: EnrichedSale) {
    setSelectedSale(s)
    setPaymentAmount(String(s.balance || 0))
    setPaymentMethod("pix")
    setPaymentModalOpen(true)
  }

  function openLinkModal(s: EnrichedSale) {
    setSaleForLink(s)
    setLinkModalOpen(true)
  }

  function startGenerateLinkFlow() {
    setSelectedSaleId("")
    setChooseOpen(true)
  }

  function handleChooseExisting() {
    setChooseOpen(false)
    setSelectSaleOpen(true)
  }

  function handleChooseNew() {
    setChooseOpen(false)
    setNewSaleOpen(true)
  }

  function confirmSelectSale() {
    const s = enrichedSales.find(es => es.id === selectedSaleId)
    if (!s) return
    setSaleForLink(s)
    setSelectSaleOpen(false)
    setLinkModalOpen(true)
  }

  async function handleSubmitPayment() {
    if (!selectedSale) return
    const amountNum = Number(paymentAmount.replace(",", "."))
    if (!amountNum || amountNum <= 0) return
    setSubmitting(true)
    try {
      await createPayment({
        saleId: selectedSale.id,
        amount: amountNum,
        paymentMethod,
        status: PaymentStatus.PAID,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      } as Omit<Payment, "id">)
      setPaymentModalOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  function triggerCancelSale(sale: EnrichedSale) {
    setSaleToCancel(sale)
    setConfirmCancelOpen(true)
  }

  async function performCancelSale() {
    if (!saleToCancel) return
    await updateSaleStatus(saleToCancel.id, SaleStatus.CANCELLED)
    setConfirmCancelOpen(false)
    setSaleToCancel(null)
  }

  function firstPendingLink(sale: EnrichedSale) {
    return sale.payments?.find((p: any) => p.status === PaymentStatus.PENDING && p.paymentLinkUrl)?.paymentLinkUrl
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Acompanhe receitas, pagamentos e transações</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Receita recebida
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-semibold">{formatCurrency(kpis.totalPaid)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-600" />
              A receber
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-semibold">{formatCurrency(kpis.totalBalance)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Vendas pagas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-semibold">{kpis.paidCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-amber-600" />
              Vendas pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-semibold">{kpis.pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>

              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => {
                setSearchQuery("")
                setStartDate("")
                setEndDate("")
                setCurrentPage(1)
              }}>
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>

              <Button onClick={startGenerateLinkFlow}>
                <Link2 className="h-4 w-4 mr-2" />
                Gerar link de pagamento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transações</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados financeiros...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 flex flex-col items-start gap-3">
              <div>Nenhuma transação encontrada com os filtros atuais</div>
              <Button onClick={startGenerateLinkFlow}>
                <Link2 className="h-4 w-4 mr-2" />
                Gerar link de pagamento
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2">Data</th>
                    <th>Cliente</th>
                    <th>Itens</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Pago</th>
                    <th className="text-right">Saldo</th>
                    <th>Status</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => {
                    const pendingLink = firstPendingLink(s)
                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/50">
                        <td className="py-2">{formatDate(s.createdAt)}</td>
                        <td>{s.clientName || s.clientId}</td>
                        <td>{s.items?.length || 0}</td>
                        <td className="text-right">{formatCurrency(s.totalAmount)}</td>
                        <td className="text-right">{formatCurrency(s.paidAmount)}</td>
                        <td className="text-right">{formatCurrency(s.balance)}</td>
                        <td>
                          <Badge variant={
                            s.status === SaleStatus.PAID ? "default" :
                            s.status === SaleStatus.PENDING ? "secondary" : "destructive"
                          }>
                            {s.status === SaleStatus.PAID ? "Pago" : s.status === SaleStatus.PENDING ? "Pendente" : "Cancelado"}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              <DropdownMenuItem
                                disabled={!pendingLink}
                                onClick={() => pendingLink && window.open(pendingLink, "_blank", "noopener,noreferrer")}
                              >
                                Abrir link de pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!pendingLink}
                                onClick={() => pendingLink && navigator.clipboard.writeText(pendingLink).catch(() => {})}
                              >
                                Copiar link de pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openLinkModal(s)}>
                                Gerar link de pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPaymentModal(s)}>
                                Registrar pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => triggerCancelSale(s)}>
                                Cancelar venda
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-between mt-3 text-sm">
                <div>
                  Página {page} de {totalPages} ({filtered.length} {filtered.length === 1 ? "transação" : "transações"})
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>Informe o valor e o método do pagamento para a venda selecionada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="text-sm text-muted-foreground">
              {selectedSale ? (
                <>
                  <div>Cliente: <span className="text-foreground">{selectedSale.clientName || selectedSale.clientId}</span></div>
                  <div>Total: {formatCurrency(selectedSale.totalAmount)} | Pago: {formatCurrency(selectedSale.paidAmount)} | Saldo: {formatCurrency(selectedSale.balance)}</div>
                </>
              ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Valor</label>
                <Input type="number" step="0.01" min="0" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Método</label>
                <Combobox
                  placeholder="Selecione o método"
                  items={[
                    { value: "pix", label: "PIX" },
                    { value: "credit_card", label: "Cartão" },
                    { value: "cash", label: "Dinheiro" },
                    { value: "debit", label: "Débito" },
                  ]}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitPayment} disabled={submitting || !selectedSale}>
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar venda</DialogTitle>
            <DialogDescription>Tem certeza que deseja cancelar esta venda? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancelOpen(false)}>Voltar</Button>
            <Button className="bg-destructive hover:bg-destructive/90" onClick={performCancelSale}>
              Cancelar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChooseFlowDialog open={chooseOpen} onOpenChange={setChooseOpen} onExisting={handleChooseExisting} onNew={handleChooseNew} />

      <Dialog open={selectSaleOpen} onOpenChange={setSelectSaleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar venda</DialogTitle>
            <DialogDescription>Escolha uma venda para gerar o link de pagamento.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <label className="block text-sm mb-1">Venda</label>
              <Combobox
                placeholder="Selecione uma venda"
                items={enrichedSales.map(s => ({
                  value: s.id,
                  label: `${s.clientName || s.clientId} • ${s.status} • Saldo: ${formatCurrency(s.balance)}`,
                }))}
                value={selectedSaleId}
                onChange={setSelectedSaleId}
              />
            </div>
            <Alert variant="default" className="text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No próximo passo você definirá serviço/variante e poderá editar valores antes de gerar o link.</AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectSaleOpen(false)}>Cancelar</Button>
            <Button onClick={confirmSelectSale} disabled={!selectedSaleId}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewSaleDialog
        open={newSaleOpen}
        onOpenChange={setNewSaleOpen}
        clients={clients || []}
        services={services || []}
        variants={serviceVariants || []}
        onCreated={(created) => {
          setSaleForLink(created)
          setLinkModalOpen(true)
        }}
      />

      <PaymentLinkModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        sale={saleForLink}
        clients={clients || []}
        services={services || []}
        variants={serviceVariants || []}
        onSuccess={() => {}}
      />
    </div>
  )
}
