"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useData } from "@/lib/data-context"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Package,
  Clock,
  Download,
  FileText,
  AlertCircle,
  Target,
  UserCheck,
  ShoppingBag,
  Wallet,
  CreditCard,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Star,
  Percent,
} from "lucide-react"
import type { Client, Appointment, Service, ServiceVariant, Sale, Payment } from "@/lib/types"
import * as XLSX from "xlsx"

interface PeriodData {
  clients: Client[]
  appointments: Appointment[]
  sales: Sale[]
  payments: Payment[]
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: { value: number; positive: boolean }
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{value}</h3>
          {subtitle ? (
            <p className="text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
          ) : null}
          {trend ? (
            <div className="flex items-center gap-1 text-xs sm:text-sm flex-wrap">
              {trend.positive ? (
                <>
                  <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                  <span className="text-green-500 font-medium">{trend.value.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                  <span className="text-red-500 font-medium">{trend.value.toFixed(1)}%</span>
                </>
              )}
              <span className="text-muted-foreground text-xs">vs. mês anterior</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-full bg-primary/10 p-2 sm:p-3 flex-shrink-0">
          <div className="h-4 w-4 sm:h-5 sm:w-5">{icon}</div>
        </div>
      </div>
    </Card>
  )
}

export default function RelatoriosPage() {
  const {
    clients,
    appointments,
    services,
    serviceVariants,
    sales,
    payments,
    isLoading,
    error,
    refreshData,
  } = useData()

  const [periodFilter, setPeriodFilter] = useState<string>("30")

  useEffect(() => {
    // Garante que tudo do contexto esteja preenchido para os cálculos
    void refreshData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getPeriodData(days: number): PeriodData {
    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return {
      clients: (clients || []).filter((c) => new Date(c.registrationDate) >= startDate),
      appointments: (appointments || []).filter((a) => new Date(a.startTime) >= startDate),
      sales: (sales || []).filter((s) => new Date(s.created_at) >= startDate),
      payments: (payments || []).filter((p) => new Date(p.created_at) >= startDate && p.status === "paid"),
    }
  }

  const currentPeriod = useMemo(() => {
    const days = periodFilter === "all" ? 365 * 10 : parseInt(periodFilter, 10)
    return getPeriodData(days)
  }, [periodFilter, clients, appointments, sales, payments])

  const previousPeriod = useMemo(() => {
    if (periodFilter === "all") return null
    const days = parseInt(periodFilter, 10)
    const now = new Date()
    const startDate = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return {
      clients: (clients || []).filter((c) => {
        const d = new Date(c.registrationDate)
        return d >= startDate && d < endDate
      }),
      appointments: (appointments || []).filter((a) => {
        const d = new Date(a.startTime)
        return d >= startDate && d < endDate
      }),
      sales: (sales || []).filter((s) => {
        const d = new Date(s.created_at)
        return d >= startDate && d < endDate
      }),
      payments: (payments || []).filter((p) => {
        const d = new Date(p.created_at)
        return d >= startDate && d < endDate && p.status === "paid"
      }),
    }
  }, [periodFilter, clients, appointments, sales, payments])

  const metrics = useMemo(() => {
    const revenue = currentPeriod.payments.reduce((acc, p) => acc + Number(p.amount), 0)
    const previousRevenue = previousPeriod?.payments.reduce((acc, p) => acc + Number(p.amount), 0) ?? 0
    const revenueChange = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0

    const newClients = currentPeriod.clients.length
    const previousClients = previousPeriod?.clients.length ?? 0
    const clientsChange = previousClients > 0 ? ((newClients - previousClients) / previousClients) * 100 : 0

    const completedAppointments = currentPeriod.appointments.filter((a) => a.status === "completed").length
    const previousCompletedAppointments =
      previousPeriod?.appointments.filter((a) => a.status === "completed").length ?? 0
    const appointmentsChange =
      previousCompletedAppointments > 0 ? ((completedAppointments - previousCompletedAppointments) / previousCompletedAppointments) * 100 : 0

    const totalAppointments = currentPeriod.appointments.length
    const cancelledAppointments = currentPeriod.appointments.filter((a) => a.status === "cancelled").length
    const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0

    const avgTicket = currentPeriod.payments.length > 0 ? revenue / currentPeriod.payments.length : 0
    const previousAvgTicket =
      previousPeriod && previousPeriod.payments.length > 0 ? (previousRevenue / previousPeriod.payments.length) : 0
    const avgTicketChange = previousAvgTicket > 0 ? ((avgTicket - previousAvgTicket) / previousAvgTicket) * 100 : 0

    const servicesSold = currentPeriod.sales.reduce((acc, s) => {
      return acc + (s.items || []).reduce((itemAcc, item) => itemAcc + Number(item.quantity), 0)
    }, 0)
    const previousServicesSold = previousPeriod?.sales.reduce((acc, s) => {
      return acc + (s.items || []).reduce((itemAcc, item) => itemAcc + Number(item.quantity), 0)
    }, 0) ?? 0
    const servicesSoldChange = previousServicesSold > 0 ? ((servicesSold - previousServicesSold) / previousServicesSold) * 100 : 0

    const paymentsByMethod = currentPeriod.payments
      .filter((p) => !!p.paymentMethod)
      .reduce((acc, p) => {
        const method = p.paymentMethod || "Outros"
        acc[method] = (acc[method] || 0) + Number(p.amount)
        return acc
      }, {} as Record<string, number>)

    // Top serviços por receita usando itens de venda (considera subtotal)
    const topServices = currentPeriod.sales.reduce((acc, sale) => {
      (sale.items || []).forEach((item) => {
        const variant = (serviceVariants || []).find((v) => v.id === item.serviceVariantId)
        if (!variant) return
        const service = (services || []).find((s) => s.id === variant.serviceId)
        if (!service) return
        const key = `${service.name} — ${variant.variantName}`
        if (!acc[key]) acc[key] = { quantity: 0, revenue: 0 }
        acc[key].quantity += Number(item.quantity)
        acc[key].revenue += Number(item.subtotal ?? item.quantity * item.unitPrice)
      })
      return acc
    }, {} as Record<string, { quantity: number; revenue: number }>)

    const topServicesArray = Object.entries(topServices)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    const totalClients = (clients || []).length
    const activeClients = (clients || []).filter((c) => c.status === "active").length
    const retentionRate = totalClients > 0 ? ((clients || []).filter((c) => c.isClient).length / totalClients) * 100 : 0

    return {
      revenue,
      revenueChange,
      newClients,
      clientsChange,
      completedAppointments,
      appointmentsChange,
      cancellationRate,
      avgTicket,
      avgTicketChange,
      servicesSold,
      servicesSoldChange,
      paymentsByMethod,
      topServices: topServicesArray,
      retentionRate,
      totalClients,
      activeClients,
    }
  }, [currentPeriod, previousPeriod, clients, services, serviceVariants])

  function getPeriodLabel(): string {
    const labels: Record<string, string> = {
      "7": "últimos 7 dias",
      "30": "últimos 30 dias",
      "90": "últimos 90 dias",
      "365": "último ano",
      "all": "todo o período",
    }
    return labels[periodFilter] ?? "período"
  }

  function exportComprehensive() {
    const wb = XLSX.utils.book_new()

    const summaryData = [
      { "Métrica": "Período", Valor: getPeriodLabel() },
      { "Métrica": "Receita Total", Valor: formatCurrency(metrics.revenue) },
      { "Métrica": "Novos Clientes", Valor: metrics.newClients },
      { "Métrica": "Agendamentos Concluídos", Valor: metrics.completedAppointments },
      { "Métrica": "Taxa de Cancelamento", Valor: `${metrics.cancellationRate.toFixed(1)}%` },
      { "Métrica": "Ticket Médio", Valor: formatCurrency(metrics.avgTicket) },
      { "Métrica": "Serviços Vendidos", Valor: metrics.servicesSold },
      { "Métrica": "Taxa de Retenção", Valor: `${metrics.retentionRate.toFixed(1)}%` },
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo")

    const clientsData = currentPeriod.clients.map((c) => ({
      Nome: c.name,
      Email: c.email,
      Telefone: c.phone,
      "Data de Cadastro": formatDate(c.registrationDate),
      Cliente: c.isClient ? "Sim" : "Não",
      Status: c.status === "active" ? "Ativo" : "Inativo",
    }))
    if (clientsData.length > 0) {
      const wsClients = XLSX.utils.json_to_sheet(clientsData)
      XLSX.utils.book_append_sheet(wb, wsClients, "Novos Clientes")
    }

    const appointmentsData = currentPeriod.appointments.map((a) => ({
      "Data/Hora": formatDate(a.startTime),
      Cliente: (clients || []).find((c) => c.id === a.clientId)?.name,
      Status: a.status,
      Observações: a.notes,
    }))
    if (appointmentsData.length > 0) {
      const wsAppointments = XLSX.utils.json_to_sheet(appointmentsData)
      XLSX.utils.book_append_sheet(wb, wsAppointments, "Agendamentos")
    }

    const servicesData = metrics.topServices.map((s) => ({
      Serviço: s.name,
      "Quantidade Vendida": s.quantity,
      Receita: formatCurrency(s.revenue),
    }))
    if (servicesData.length > 0) {
      const wsServices = XLSX.utils.json_to_sheet(servicesData)
      XLSX.utils.book_append_sheet(wb, wsServices, "Top Serviços")
    }

    const paymentsData = Object.entries(metrics.paymentsByMethod).map(([method, amount]) => ({
      "Método de Pagamento": method,
      Valor: formatCurrency(amount),
      Percentual: `${((amount / Math.max(1, metrics.revenue)) * 100).toFixed(1)}%`,
    }))
    if (paymentsData.length > 0) {
      const wsPayments = XLSX.utils.json_to_sheet(paymentsData)
      XLSX.utils.book_append_sheet(wb, wsPayments, "Métodos de Pagamento")
    }

    XLSX.writeFile(wb, `relatorio-completo-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  if (isLoading && (clients?.length ?? 0) === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Clock className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    )
  }

  if (error && (clients?.length ?? 0) === 0) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="p-6 sm:p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl sm:text-2xl font-semibold">Erro ao carregar dados</h2>
            <p className="text-sm sm:text-base text-muted-foreground">{error}</p>
            <Button onClick={() => void refreshData()} variant="outline" size="sm">
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Análises detalhadas e insights do seu negócio
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-10">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">últimos 7 dias</SelectItem>
              <SelectItem value="30">últimos 30 dias</SelectItem>
              <SelectItem value="90">últimos 90 dias</SelectItem>
              <SelectItem value="365">último ano</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={exportComprehensive} variant="outline" size="default" className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            <span className="sm:inline">Exportar Completo</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <TabsList className="grid grid-cols-4 w-full min-w-max sm:min-w-0 px-3 sm:px-0">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
            <TabsTrigger value="financial" className="text-xs sm:text-sm">Financeiro</TabsTrigger>
            <TabsTrigger value="clients" className="text-xs sm:text-sm">Clientes</TabsTrigger>
            <TabsTrigger value="services" className="text-xs sm:text-sm">Serviços</TabsTrigger>
          </TabsList>
        </div>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Receita Total"
              value={formatCurrency(metrics.revenue)}
              subtitle={`${currentPeriod.payments.length} transações`}
              icon={<DollarSign className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.revenueChange, positive: metrics.revenueChange >= 0 } : undefined}
            />
            <StatCard
              title="Novos Clientes"
              value={metrics.newClients}
              subtitle={`${metrics.activeClients} ativos`}
              icon={<UserCheck className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.clientsChange, positive: metrics.clientsChange >= 0 } : undefined}
            />
            <StatCard
              title="Agendamentos"
              value={metrics.completedAppointments}
              subtitle={`${currentPeriod.appointments.length} no total`}
              icon={<Calendar className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.appointmentsChange, positive: metrics.appointmentsChange >= 0 } : undefined}
            />
            <StatCard
              title="Ticket Médio"
              value={formatCurrency(metrics.avgTicket)}
              subtitle="Por transação"
              icon={<Target className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.avgTicketChange, positive: metrics.avgTicketChange >= 0 } : undefined}
            />
          </div>

          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Performance Geral</h3>
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Taxa de Cancelamentos</span>
                  <Badge
                    variant={
                      metrics.cancellationRate < 10
                        ? "default"
                        : metrics.cancellationRate < 20
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-xs"
                  >
                    {metrics.cancellationRate.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Taxa de Retenção</span>
                  <Badge
                    variant={
                      metrics.retentionRate >= 70
                        ? "default"
                        : metrics.retentionRate >= 50
                        ? "secondary"
                        : "outline"
                    }
                    className="text-xs"
                  >
                    {metrics.retentionRate.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Serviços Vendidos</span>
                  <span className="text-sm sm:text-base font-semibold">{metrics.servicesSold}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Clientes Ativos</span>
                  <span className="text-sm sm:text-base font-semibold">{metrics.activeClients}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Status dos Agendamentos</h3>
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {[
                  { status: "completed", label: "Concluídos", color: "bg-green-500" },
                  { status: "scheduled", label: "Agendados", color: "bg-blue-500" },
                  { status: "confirmed", label: "Confirmados", color: "bg-primary/50" },
                  { status: "cancelled", label: "Cancelados", color: "bg-red-500" },
                ].map(({ status, label, color }) => {
                  const count = currentPeriod.appointments.filter((a) => a.status === status).length
                  const percentage =
                    currentPeriod.appointments.length > 0
                      ? (count / currentPeriod.appointments.length) * 100
                      : 0
                  return (
                    <div key={status} className="space-y-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color} transition-all`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Financeiro */}
        <TabsContent value="financial" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Receita Total"
              value={formatCurrency(metrics.revenue)}
              subtitle={getPeriodLabel()}
              icon={<DollarSign className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.revenueChange, positive: metrics.revenueChange >= 0 } : undefined}
            />
            <StatCard
              title="Ticket Médio"
              value={formatCurrency(metrics.avgTicket)}
              subtitle={`${currentPeriod.payments.length} transações`}
              icon={<Target className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.avgTicketChange, positive: metrics.avgTicketChange >= 0 } : undefined}
            />
            <StatCard
              title="Total de Transações"
              value={currentPeriod.payments.length}
              subtitle="Pagamentos confirmados"
              icon={<ShoppingBag className="h-full w-full text-primary" />}
            />
          </div>

          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Receita por Método de Pagamento</h3>
            {Object.keys(metrics.paymentsByMethod).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Wallet className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado no período</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {Object.entries(metrics.paymentsByMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, amount]) => {
                    const percentage = metrics.revenue > 0 ? (amount / metrics.revenue) * 100 : 0
                    const icon = method.toLowerCase().includes("pix")
                      ? <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      : method.toLowerCase().includes("card") || method.toLowerCase().includes("cart")
                      ? <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      : <PiggyBank className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    return (
                      <div key={method} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                              {icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm sm:text-base truncate">{method}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {percentage.toFixed(1)}% do total
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold text-sm sm:text-lg whitespace-nowrap">
                            {formatCurrency(amount)}
                          </p>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Clientes */}
        <TabsContent value="clients" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total de Clientes"
              value={metrics.totalClients}
              subtitle={`${metrics.activeClients} ativos`}
              icon={<Users className="h-full w-full text-primary" />}
            />
            <StatCard
              title="Novos Clientes"
              value={metrics.newClients}
              subtitle={getPeriodLabel()}
              icon={<UserCheck className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.clientsChange, positive: metrics.clientsChange >= 0 } : undefined}
            />
            <StatCard
              title="Taxa de Retenção"
              value={`${metrics.retentionRate.toFixed(1)}%`}
              subtitle="Realizaram compras"
              icon={<Star className="h-full w-full text-primary" />}
            />
            <StatCard
              title="Conversão"
              value={
                metrics.totalClients > 0
                  ? `${(((clients || []).filter((c) => c.isClient).length / metrics.totalClients) * 100).toFixed(1)}%`
                  : "0%"
              }
              subtitle="Lead para cliente"
              icon={<Percent className="h-full w-full text-primary" />}
            />
          </div>

          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Clientes por Status</h3>
            <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2">
              <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-card gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="rounded-full bg-green-500/10 p-2 sm:p-3 flex-shrink-0">
                    <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">Clientes Ativos</p>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.activeClients}</p>
                  </div>
                </div>
                <Badge variant="default" className="text-xs">
                  {metrics.totalClients > 0 ? ((metrics.activeClients / metrics.totalClients) * 100).toFixed(0) : 0}%
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-card gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="rounded-full bg-gray-500/10 p-2 sm:p-3 flex-shrink-0">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">Clientes Inativos</p>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.totalClients - metrics.activeClients}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {metrics.totalClients > 0
                    ? (((metrics.totalClients - metrics.activeClients) / metrics.totalClients) * 100).toFixed(0)
                    : 0}%
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Crescimento de Base</h3>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border gap-3">
                <span className="text-xs sm:text-sm font-medium">Novos cadastros no período</span>
                <span className="text-base sm:text-lg font-bold">{metrics.newClients}</span>
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border gap-3">
                <span className="text-xs sm:text-sm font-medium">Convertidos em clientes</span>
                <span className="text-base sm:text-lg font-bold">
                  {(currentPeriod.clients || []).filter((c) => c.isClient).length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border gap-3">
                <span className="text-xs sm:text-sm font-medium">Taxa de conversão</span>
                <Badge variant="default" className="text-xs">
                  {metrics.newClients > 0
                    ? (((currentPeriod.clients || []).filter((c) => c.isClient).length / metrics.newClients) * 100).toFixed(1)
                    : 0}
                  %
                </Badge>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Serviços */}
        <TabsContent value="services" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Serviços Vendidos"
              value={metrics.servicesSold}
              subtitle={getPeriodLabel()}
              icon={<Package className="h-full w-full text-primary" />}
              trend={previousPeriod ? { value: metrics.servicesSoldChange, positive: metrics.servicesSoldChange >= 0 } : undefined}
            />
            <StatCard
              title="Top Serviço"
              value={metrics.topServices[0]?.name ?? "—"}
              subtitle={metrics.topServices[0] ? formatCurrency(metrics.topServices[0].revenue) : "Sem dados"}
              icon={<BarChart3 className="h-full w-full text-primary" />}
            />
            <StatCard
              title="Receita Total"
              value={formatCurrency(metrics.revenue)}
              subtitle="Proveniente de pagamentos"
              icon={<TrendingUp className="h-full w-full text-primary" />}
            />
          </div>

          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Top Serviços por Receita</h3>
            {metrics.topServices.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem vendas no período</div>
            ) : (
              <div className="space-y-2">
                {metrics.topServices.map((s) => (
                  <div key={s.name} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.quantity} vendidos</p>
                      </div>
                    </div>
                    <p className="font-semibold">{formatCurrency(s.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
