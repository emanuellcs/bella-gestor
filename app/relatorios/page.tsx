"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/utils";
import {
  computeFinancialMetrics,
  todayInSaoPaulo,
  type DateRangeFilter,
  type PeriodMetrics,
} from "@/lib/utils/financial-metrics";
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Package,
  Download,
  AlertCircle,
  ShoppingBag,
  Wallet,
  CreditCard,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Star,
  RefreshCw,
  Clock,
  CalendarRange,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <Card className="p-4 sm:p-6 overflow-hidden relative group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
            {value}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div
              className={`flex items-center text-xs mt-1 font-medium ${trend.isPositive ? "text-emerald-600" : "text-rose-600"}`}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              )}
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <div className="h-5 w-5 sm:h-6 sm:w-6 text-primary">{icon}</div>
        </div>
      </div>
    </Card>
  );
}

export default function RelatoriosPage() {
  const {
    clients,
    appointments,
    sales,
    payments,
    isLoading,
    refreshData,
  } = useData();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterMode, setFilterMode] = useState<"past" | "future" | "custom">("past");
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(todayInSaoPaulo);

  // Derived filter object consumed by computeFinancialMetrics
  const activeFilter = useMemo<DateRangeFilter>(() => {
    if (filterMode === "past") return { mode: "past" };
    if (filterMode === "future") return { mode: "future" };
    return { mode: "custom", startDate: customStart, endDate: customEnd };
  }, [filterMode, customStart, customEnd]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const metrics = useMemo<PeriodMetrics>(
    () =>
      computeFinancialMetrics(
        sales || [],
        payments || [],
        appointments || [],
        clients || [],
        activeFilter,
      ),
    [sales, payments, appointments, clients, activeFilter],
  );

  function getPeriodLabel(): string {
    if (filterMode === "past") return "histórico (até hoje)";
    if (filterMode === "future") return "projeção (após hoje)";
    return `${customStart} até ${customEnd}`;
  }

  const exportComprehensive = () => {
    const data = [
      ["Relatório Gerencial - Bella Gestor"],
      ["Período:", getPeriodLabel()],
      ["Data de Geração:", new Date().toLocaleString("pt-BR")],
      [],
      ["Visão Geral"],
      ["Receita Realizada", formatCurrency(metrics.actualRevenue)],
      ["Saldo a Receber (Vendas Pendentes)", formatCurrency(metrics.pendingSalesValue)],
      ["Receita Projetada (Agendamentos)", formatCurrency(metrics.projectedAppointmentsValue)],
      ["Receita Total (Realizada + Projeções)", formatCurrency(metrics.totalRevenue)],
      ["Receita Líquida (Empresa)", formatCurrency(metrics.netRevenue)],
      ["Margem Líquida", `${metrics.netMarginPercentage.toFixed(1)}%`],
      ["Total Comissões", formatCurrency(metrics.totalCommissions)],
      ["Ticket Médio", formatCurrency(metrics.avgTicket)],
      ["Taxa de Cancelamento", `${metrics.cancellationRate.toFixed(1)}%`],
      [],
      ["Agendamentos Projetados"],
      ["Total", metrics.projectedAppointments.length],
      ["Valor estimado", formatCurrency(metrics.projectedAppointmentsValue)],
      [],
      ["Performance por Profissional"],
      ["Profissional", "Faturamento", "Comissão", "Serviços"],
      ...Object.values(metrics.professionalBreakdown).map((p) => [
        p.name,
        p.revenue,
        p.commission,
        p.count,
      ]),
      [],
      ["Serviços Mais Vendidos"],
      ["Serviço", "Quantidade", "Receita"],
      ...metrics.topServices.map((s) => [s.name, s.quantity, s.revenue]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Geral");
    XLSX.writeFile(wb, `relatorio_bella_${filterMode}.xlsx`);
  };

  if (isLoading && (!sales || sales.length === 0)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Processando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Relatórios
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Acompanhe o desempenho do seu negócio em tempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode selector */}
          <div className="inline-flex overflow-hidden rounded-lg border text-sm bg-card shadow-sm">
            {(["past", "future", "custom"] as const).map((mode) => {
              const labels = {
                past: "Histórico",
                future: "Projeção",
                custom: "Personalizado",
              };
              const icons = {
                past: <Clock className="h-3.5 w-3.5 mr-1.5" />,
                future: <TrendingUp className="h-3.5 w-3.5 mr-1.5" />,
                custom: <CalendarRange className="h-3.5 w-3.5 mr-1.5" />,
              };
              return (
                <Button
                  key={mode}
                  variant={filterMode === mode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilterMode(mode)}
                  className="rounded-none h-9 px-3"
                >
                  {icons[mode]}
                  {labels[mode]}
                </Button>
              );
            })}
          </div>

          {/* Custom date pickers — only visible in custom mode */}
          {filterMode === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  De
                </Label>
                <Input
                  type="date"
                  className="h-9 w-36 text-sm"
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  Até
                </Label>
                <Input
                  type="date"
                  className="h-9 w-36 text-sm"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          <Button
            onClick={exportComprehensive}
            variant="outline"
            className="shadow-sm h-9"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <TabsList className="grid grid-cols-6 w-full min-w-max sm:min-w-0 px-3 sm:px-0 bg-transparent gap-2 h-auto">
            <TabsTrigger
              value="overview"
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
            >
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="projection"
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
            >
              Projeção
            </TabsTrigger>
            <TabsTrigger
              value="financial"
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
            >
              Financeiro
            </TabsTrigger>
            <TabsTrigger
              value="commissions"
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
            >
              Comissões
            </TabsTrigger>
            <TabsTrigger
              value="clients"
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
            >
              Clientes
            </TabsTrigger>
            <TabsTrigger
              value="services"
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
            >
              Serviços
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={filterMode === "past" ? "Receita Realizada" : "Receita Total"}
              value={formatCurrency(
                filterMode === "past" ? metrics.actualRevenue : metrics.totalRevenue,
              )}
              subtitle={getPeriodLabel()}
              icon={<DollarSign className="h-full w-full" />}
            />
            <StatCard
              title="Receita Líquida"
              value={formatCurrency(
                filterMode === "past" ? metrics.netRevenue : metrics.projectedNetRevenue
              )}
              subtitle={
                filterMode === "past" 
                  ? `Margem: ${metrics.netMarginPercentage.toFixed(1)}%`
                  : `Margem Projetada: ${metrics.projectedNetMarginPercentage.toFixed(1)}%`
              }
              icon={<PiggyBank className="h-full w-full" />}
            />
            {filterMode === "past" ? (
              <StatCard
                title="Ticket Médio"
                value={formatCurrency(metrics.avgTicket)}
                subtitle="Por pagamento realizado"
                icon={<ShoppingBag className="h-full w-full" />}
              />
            ) : (
              <StatCard
                title="Ticket Médio Proj."
                value={formatCurrency(metrics.projectedAvgTicket)}
                subtitle="Vendas Pend. + Agendamentos"
                icon={<ShoppingBag className="h-full w-full" />}
              />
            )}
            <StatCard
              title={filterMode === "future" ? "Agendamentos" : "Vendas"}
              value={
                filterMode === "future"
                  ? metrics.projectedAppointments.length.toString()
                  : metrics.salesCount.toString()
              }
              subtitle={
                filterMode === "future"
                  ? formatCurrency(metrics.projectedAppointmentsValue)
                  : `${metrics.cancelledSalesCount} canceladas`
              }
              icon={<Calendar className="h-full w-full" />}
            />
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Serviços Top Performance
                </h3>
                <Badge variant="outline">Por Receita</Badge>
              </div>
              <div className="space-y-5">
                {metrics.topServices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum dado de serviço disponível.
                  </p>
                ) : (
                  metrics.topServices.slice(0, 5).map((s, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-center text-sm sm:text-base">
                        <span className="font-medium truncate flex-1 pr-2">
                          {s.name}
                        </span>
                        <span className="font-bold">
                          {formatCurrency(s.revenue)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${metrics?.actualRevenue > 0 ? (s.revenue / metrics.actualRevenue) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {s.quantity} vendas realizadas
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Métricas de Retenção
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">
                    Total de Clientes
                  </p>
                  <p className="text-2xl font-bold">{metrics?.totalClients ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">
                    Clientes Ativos
                  </p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {metrics?.activeClients ?? 0}
                  </p>
                </div>
                <div className="col-span-2 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-xs text-primary mb-1 uppercase font-bold tracking-wider">
                    Taxa de Retenção
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {metrics?.retentionRate?.toFixed(1) ?? "0.0"}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Porcentagem de clientes que já converteram
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projection" className="space-y-4 sm:space-y-6">
          {filterMode === "past" ? (
            <Card className="p-8 flex flex-col items-center gap-3 text-center">
              <TrendingUp className="h-10 w-10 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">
                Mude para o modo &quot;Projeção&quot; ou &quot;Personalizado&quot; para ver dados futuros.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFilterMode("future")}
              >
                Ver Projeção
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Accounts Receivable from Pending Sales */}
              <Card className="p-4 sm:p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-base sm:text-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Vendas Pendentes (A Receber)
                  <Badge variant="outline">
                    {(sales || []).filter(s => s.status === "pending").length}
                  </Badge>
                </h3>
                {metrics.pendingSalesValue === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma venda pendente com saldo em aberto.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border overflow-hidden">
                    {(sales || [])
                      .filter((s) => s.status === "pending")
                      .map((s) => {
                        const total = Number(s.totalAmount) || 0;
                        const paid = (s.payments || []).reduce((pSum, p) => {
                          return p.status === "paid" ? pSum + (Number(p.amount) || 0) : pSum;
                        }, 0);
                        const balance = Math.max(0, total - paid);
                        
                        if (balance === 0) return null;

                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between px-4 py-3 text-sm"
                          >
                            <div>
                              <p className="font-medium">
                                {s.clientName || "Cliente"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {s.items?.map(i => i.serviceName).join(", ") || "Serviço"} • 
                                Criada em {new Date(s.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(balance)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                de {formatCurrency(total)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                )}
              </Card>

              {/* Projected appointments */}
              <Card className="p-4 sm:p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  Agendamentos sem Venda Vinculada
                  <Badge variant="outline">
                    {metrics.projectedAppointments.length}
                  </Badge>
                </h3>
                {metrics.projectedAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum agendamento futuro sem venda vinculada no período.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border overflow-hidden">
                    {metrics.projectedAppointments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{a.clientName || "Cliente"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.startTime).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                            {" • "}
                            {a.serviceVariants.map((sv) => sv.serviceVariantName).join(", ")}
                          </p>
                        </div>
                        <span className="font-bold">
                          {formatCurrency(a.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6 space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Agendamentos Projetados</span>
                    <span>{formatCurrency(metrics.projectedAppointmentsValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo de Vendas Pendentes (A Receber)</span>
                    <span>{formatCurrency(metrics.pendingSalesValue)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t">
                    <span>Total Projetado no Período</span>
                    <span className="text-primary">
                      {formatCurrency(metrics.projectedRevenue)}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="financial" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Receita por Método de Pagamento
              </h3>
              <div className="space-y-4">
                {Object.entries(metrics.paymentsByMethod).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pagamento registrado.
                  </p>
                ) : (
                  Object.entries(metrics.paymentsByMethod).map(
                    ([method, amount]) => (
                      <div
                        key={method}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-background border flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{method}</span>
                        </div>
                        <span className="font-bold">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ),
                  )
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Saúde das Vendas
              </h3>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Taxa de Cancelamento
                    </span>
                    <span className="font-bold text-rose-600">
                      {metrics.cancellationRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${metrics.cancellationRate}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Ticket Médio
                    </span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(metrics.avgTicket)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(metrics.avgTicket / 500) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Receita Realizada (Bruta)"
              value={formatCurrency(metrics.actualRevenue)}
              subtitle="Total de pagamentos pagos"
              icon={<DollarSign className="h-full w-full" />}
            />
            <StatCard
              title="Total Comissões Pagas"
              value={formatCurrency(metrics.totalCommissions)}
              subtitle="Referente a vendas pagas"
              icon={<Users className="h-full w-full" />}
            />
            <StatCard
              title="Comissões a Pagar (Proj.)"
              value={formatCurrency(metrics.projectedCommissions)}
              subtitle="Vendas Pendentes + Agendados"
              icon={<TrendingUp className="h-full w-full" />}
            />
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                Comissões Realizadas (Pagos)
              </h3>
              {Object.keys(metrics.professionalBreakdown).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mb-2 opacity-20" />
                  <p>Nenhuma comissão paga no período.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(metrics.professionalBreakdown)
                    .sort(([, a], [, b]) => b.commission - a.commission)
                    .map(([id, data]) => {
                      const percentageOfTotalComms =
                        metrics.totalCommissions > 0
                          ? (data.commission / metrics.totalCommissions) * 100
                          : 0;

                      return (
                        <div key={id} className="space-y-2 p-3 rounded-lg border bg-muted/5">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-base">{data.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {data.count} serviço(s) • {percentageOfTotalComms.toFixed(1)}% do pool
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Ganhos</p>
                              <p className="font-bold text-emerald-600">
                                {formatCurrency(data.commission)}
                              </p>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${percentageOfTotalComms}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Comissões Projetadas (A Pagar)
              </h3>
              {Object.keys(metrics.projectedProfessionalBreakdown).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mb-2 opacity-20" />
                  <p>Nenhuma comissão projetada no período.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(metrics.projectedProfessionalBreakdown)
                    .sort(([, a], [, b]) => b.commission - a.commission)
                    .map(([id, data]) => {
                      const percentageOfTotalComms =
                        metrics.projectedCommissions > 0
                          ? (data.commission / metrics.projectedCommissions) * 100
                          : 0;

                      return (
                        <div key={id} className="space-y-2 p-3 rounded-lg border bg-muted/5">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-base">{data.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {data.count} serviço(s) • {percentageOfTotalComms.toFixed(1)}% do pool proj.
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">A Receber</p>
                              <p className="font-bold text-primary">
                                {formatCurrency(data.commission)}
                              </p>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${percentageOfTotalComms}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2 text-base sm:text-lg">
              <Star className="h-5 w-5 text-primary" />
              Fontes de Novos Clientes no Período
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(metrics.referralSourceCounts).length === 0 ? (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  Sem novos clientes com indicação no período.
                </p>
              ) : (
                Object.entries(metrics.referralSourceCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const percentage = metrics.newClientsCount > 0 
                      ? (count / metrics.newClientsCount) * 100
                      : 0;
                    return (
                      <div
                        key={source}
                        className="p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-bold text-muted-foreground uppercase tracking-tight">
                            {source}
                          </span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span>RELEVÂNCIA NO PERÍODO</span>
                            <span>{percentage.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4 sm:space-y-6">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold mb-6 flex items-center gap-2 text-base sm:text-lg">
                <Package className="h-5 w-5 text-emerald-600" />
                Serviços Top Performance (Histórico)
              </h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="p-3 font-bold">Serviço</th>
                      <th className="p-3 font-bold text-center">Vendas</th>
                      <th className="p-3 font-bold text-right">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {metrics.topServices.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-muted-foreground">
                          Nenhum serviço realizado no período.
                        </td>
                      </tr>
                    ) : (
                      metrics.topServices.map((s, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{s.name}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">{s.quantity}</Badge>
                          </td>
                          <td className="p-3 text-right font-bold">
                            {formatCurrency(s.revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold mb-6 flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Serviços Projetados (Agendados)
              </h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="p-3 font-bold">Serviço</th>
                      <th className="p-3 font-bold text-center">Qtd</th>
                      <th className="p-3 font-bold text-right">Valor Est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {metrics.projectedTopServices.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-muted-foreground">
                          Nenhum serviço projetado no período.
                        </td>
                      </tr>
                    ) : (
                      metrics.projectedTopServices.map((s, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{s.name}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">{s.quantity}</Badge>
                          </td>
                          <td className="p-3 text-right font-bold">
                            {formatCurrency(s.revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
