"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/data-context";
import { formatCurrency } from "@/lib/utils";
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
} from "lucide-react";
import type { Client, Appointment, Sale, Payment } from "@/types";
import { SaleStatus } from "@/types";
import * as XLSX from "xlsx";

interface PeriodData {
  clients: Client[];
  appointments: Appointment[];
  sales: Sale[];
  payments: Payment[];
}

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
    services,
    serviceVariants,
    sales,
    payments,
    professionals,
    isLoading,
    refreshData,
  } = useData();

  const [periodFilter, setPeriodFilter] = useState<string>("30");

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const getPeriodData = useCallback(
    (days: number): PeriodData => {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      return {
        clients: (clients || []).filter(
          (c) => new Date(c.registrationDate) >= startDate,
        ),
        appointments: (appointments || []).filter(
          (a) => new Date(a.startTime) >= startDate,
        ),
        sales: (sales || []).filter((s) => new Date(s.created_at) >= startDate),
        payments: (payments || []).filter(
          (p) => new Date(p.created_at) >= startDate && p.status === "paid",
        ),
      };
    },
    [clients, appointments, sales, payments],
  );

  const currentPeriod = useMemo(() => {
    const days = periodFilter === "all" ? 365 * 10 : parseInt(periodFilter, 10);
    return getPeriodData(days);
  }, [periodFilter, getPeriodData]);

  const previousPeriod = useMemo(() => {
    if (periodFilter === "all") return null;
    const days = parseInt(periodFilter, 10);
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return {
      clients: (clients || []).filter((c) => {
        const d = new Date(c.registrationDate);
        return d >= startDate && d < endDate;
      }),
      appointments: (appointments || []).filter((a) => {
        const d = new Date(a.startTime);
        return d >= startDate && d < endDate;
      }),
      sales: (sales || []).filter((s) => {
        const d = new Date(s.created_at);
        return d >= startDate && d < endDate;
      }),
      payments: (payments || []).filter((p) => {
        const d = new Date(p.created_at);
        return d >= startDate && d < endDate && p.status === "paid";
      }),
    };
  }, [periodFilter, clients, appointments, sales, payments]);

  const metrics = useMemo(() => {
    // Referral Source Counts
    const refSourceCounts: Record<string, number> = {};
    (clients || []).forEach((c) => {
      if (c.referral_source) {
        refSourceCounts[c.referral_source] =
          (refSourceCounts[c.referral_source] || 0) + 1;
      }
    });

    const revenue = (currentPeriod?.payments || []).reduce(
      (acc, p) => acc + (Number(p.amount) || 0),
      0,
    );
    const previousRevenue =
      (previousPeriod?.payments || []).reduce(
        (acc, p) => acc + (Number(p.amount) || 0),
        0,
      ) ?? 0;
    const revenueChange =
      previousRevenue > 0
        ? ((revenue - previousRevenue) / previousRevenue) * 100
        : 0;

    const newClients = (currentPeriod?.clients || []).length;
    const previousClients = (previousPeriod?.clients || []).length ?? 0;
    const clientsChange =
      previousClients > 0
        ? ((newClients - previousClients) / previousClients) * 100
        : 0;

    const completedAppointments = (currentPeriod?.appointments || []).filter(
      (a) => a.status === "completed",
    ).length;
    const previousCompletedAppointments =
      (previousPeriod?.appointments || []).filter(
        (a) => a.status === "completed",
      ).length ?? 0;
    const appointmentsChange =
      previousCompletedAppointments > 0
        ? ((completedAppointments - previousCompletedAppointments) /
            previousCompletedAppointments) *
          100
        : 0;

    const totalSales = (currentPeriod?.sales || []).length;
    const cancelledSales = (currentPeriod?.sales || []).filter(
      (s) => s.status === SaleStatus.CANCELLED,
    ).length;

    const cancellationRate = totalSales
      ? (cancelledSales / totalSales) * 100
      : 0;

    const avgTicket =
      (currentPeriod?.payments || []).length > 0
        ? revenue / (currentPeriod?.payments || []).length
        : 0;
    const previousAvgTicket =
      previousPeriod && (previousPeriod?.payments || []).length > 0
        ? previousRevenue / (previousPeriod?.payments || []).length
        : 0;
    const avgTicketChange =
      previousAvgTicket > 0
        ? ((avgTicket - previousAvgTicket) / previousAvgTicket) * 100
        : 0;

    const servicesSold = (currentPeriod?.sales || []).reduce((acc, s) => {
      return (
        acc +
        (s.items || []).reduce(
          (itemAcc, item) => itemAcc + (Number(item.quantity) || 0),
          0,
        )
      );
    }, 0);
    const previousServicesSold =
      (previousPeriod?.sales || []).reduce((acc, s) => {
        return (
          acc +
          (s.items || []).reduce(
            (itemAcc, item) => itemAcc + (Number(item.quantity) || 0),
            0,
          )
        );
      }, 0) ?? 0;
    const servicesSoldChange =
      previousServicesSold > 0
        ? ((servicesSold - previousServicesSold) / previousServicesSold) * 100
        : 0;

    const paymentsByMethod = (currentPeriod?.payments || [])
      .filter((p) => !!p.paymentMethod)
      .reduce(
        (acc, p) => {
          const method = p.paymentMethod || "Outros";
          acc[method] = (acc[method] || 0) + (Number(p.amount) || 0);
          return acc;
        },
        {} as Record<string, number>,
      );

    // Top services by revenue using sale items
    const topServices = (currentPeriod?.sales || []).reduce(
      (acc, sale) => {
        (sale.items || []).forEach((item) => {
          let name = "";
          if (item.serviceName) {
            name =
              item.serviceName +
              (item.serviceVariantName ? ` — ${item.serviceVariantName}` : "");
          } else {
            // Fallback to global lists if item names are missing
            const variant = (serviceVariants || []).find(
              (v) => v.id === item.serviceVariantId,
            );
            if (!variant) return;
            const service = (services || []).find(
              (s) => s.id === variant.serviceId,
            );
            if (!service) return;
            name = `${service.name} — ${variant.variantName}`;
          }

          if (!acc[name]) acc[name] = { quantity: 0, revenue: 0 };
          acc[name].quantity += Number(item.quantity) || 0;
          acc[name].revenue +=
            Number(item.subtotal ?? item.quantity * item.unitPrice) || 0;
        });
        return acc;
      },
      {} as Record<string, { quantity: number; revenue: number }>,
    );

    const topServicesArray = Object.entries(topServices)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Commissions breakdown
    const professionalCommissions = (currentPeriod?.sales || []).reduce(
      (acc, sale) => {
        if (sale.status === SaleStatus.CANCELLED) return acc;

        (sale.items || []).forEach((item) => {
          // Use professionalId from item as priority, then fallback
          let profId = item.professionalId;

          // Fallback: If still no profId, try professionalId directly on sale
          if (!profId && sale.professionalId) {
            profId = sale.professionalId;
          }

          // Fallback: Try parent appointment
          if (!profId && sale.appointmentId) {
            const apt = (appointments || []).find(
              (a) => a.id === sale.appointmentId,
            );
            if (apt) {
              profId = apt.professionalId;
            }
          }

          // We need an ID to group by, but we can also group by name if ID is missing
          const groupingId = profId || item.professionalName || "unknown";

          const prof = profId
            ? (professionals || []).find((p) => p.id === profId)
            : null;

          let commAmount = item.commissionAmount
            ? Number(item.commissionAmount)
            : 0;

          // Fallback: Estimate if amount is missing
          if (!commAmount) {
            const subtotal =
              Number(item.subtotal) ||
              (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

            // Try to find professional's default commission
            const commPct = item.commissionPct ?? prof?.commissionPct ?? 70;
            commAmount = (subtotal * commPct) / 100;
          }

          const profName = prof
            ? prof.name
            : item.professionalName || "Profissional s/ nome";

          if (!acc[groupingId]) {
            acc[groupingId] = { name: profName, amount: 0, count: 0 };
          }
          acc[groupingId].amount += commAmount;
          acc[groupingId].count += 1;
        });
        return acc;
      },
      {} as Record<string, { name: string; amount: number; count: number }>,
    );

    const totalProfessionalCommission = Object.values(
      professionalCommissions,
    ).reduce((acc, curr) => acc + curr.amount, 0);

    const companyNetRevenue = revenue - totalProfessionalCommission;

    const totalClients = (clients || []).length;
    const activeClients = (clients || []).filter(
      (c) => c.status === "active",
    ).length;
    const retentionRate =
      totalClients > 0
        ? ((clients || []).filter((c) => c.isClient).length / totalClients) *
          100
        : 0;

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
      referral_sourceCounts: refSourceCounts,
      professionalCommissions,
      totalProfessionalCommission,
      companyNetRevenue,
    };
  }, [
    currentPeriod,
    previousPeriod,
    clients,
    appointments,
    services,
    serviceVariants,
    professionals,
  ]);

  function getPeriodLabel(): string {
    const labels: Record<string, string> = {
      "7": "últimos 7 dias",
      "30": "últimos 30 dias",
      "90": "últimos 90 dias",
      "365": "último ano",
    };
    return labels[periodFilter] || "período selecionado";
  }

  const exportComprehensive = () => {
    const data = [
      ["Relatório Gerencial - Bella Gestor"],
      ["Período:", getPeriodLabel()],
      ["Data de Geração:", new Date().toLocaleString("pt-BR")],
      [],
      ["Visão Geral"],
      ["Receita Bruta", formatCurrency(metrics.revenue)],
      ["Receita Líquida (Empresa)", formatCurrency(metrics.companyNetRevenue)],
      ["Total Comissões", formatCurrency(metrics.totalProfessionalCommission)],
      ["Novos Clientes", metrics.newClients],
      ["Ticket Médio", formatCurrency(metrics.avgTicket)],
      ["Taxa de Cancelamento", `${metrics.cancellationRate.toFixed(1)}%`],
      [],
      ["Comissões por Profissional"],
      ["Profissional", "Valor", "Serviços"],
      ...Object.values(metrics.professionalCommissions).map((p) => [
        p.name,
        p.amount,
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
    XLSX.writeFile(wb, `relatorio_bella_${periodFilter}dias.xlsx`);
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
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[160px] sm:w-[180px] bg-card shadow-sm">
              <Calendar className="h-4 w-4 mr-2 text-primary" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={exportComprehensive}
            variant="outline"
            className="shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Tudo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <TabsList className="grid grid-cols-5 w-full min-w-max sm:min-w-0 px-3 sm:px-0 bg-transparent gap-2 h-auto">
            <TabsTrigger
              value="overview"
              className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
            >
              Visão Geral
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
              title="Receita Bruta"
              value={formatCurrency(metrics.revenue)}
              subtitle={`Total no(s) ${getPeriodLabel()}`}
              icon={<DollarSign className="h-full w-full" />}
              trend={{
                value: metrics.revenueChange,
                isPositive: metrics.revenueChange >= 0,
              }}
            />
            <StatCard
              title="Novos Clientes"
              value={metrics.newClients.toString()}
              subtitle={`Captados no(s) ${getPeriodLabel()}`}
              icon={<Users className="h-full w-full" />}
              trend={{
                value: metrics.clientsChange,
                isPositive: metrics.clientsChange >= 0,
              }}
            />
            <StatCard
              title="Ticket Médio"
              value={formatCurrency(metrics.avgTicket)}
              subtitle="Valor médio por venda"
              icon={<ShoppingBag className="h-full w-full" />}
              trend={{
                value: metrics.avgTicketChange,
                isPositive: metrics.avgTicketChange >= 0,
              }}
            />
            <StatCard
              title="Agendamentos Concluídos"
              value={metrics.completedAppointments.toString()}
              subtitle="Executados com sucesso"
              icon={<Calendar className="h-full w-full" />}
              trend={{
                value: metrics.appointmentsChange,
                isPositive: metrics.appointmentsChange >= 0,
              }}
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
                            width: `${metrics.revenue > 0 ? (s.revenue / metrics.revenue) * 100 : 0}%`,
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
                  <p className="text-2xl font-bold">{metrics.totalClients}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">
                    Clientes Ativos
                  </p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {metrics.activeClients}
                  </p>
                </div>
                <div className="col-span-2 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-xs text-primary mb-1 uppercase font-bold tracking-wider">
                    Taxa de Retenção
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {metrics.retentionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Porcentagem de clientes que já converteram
                  </p>
                </div>
              </div>
            </Card>
          </div>
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
                      Conversão de Leads
                    </span>
                    <span className="font-bold text-emerald-600">
                      {metrics.retentionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${metrics.retentionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            <StatCard
              title="Receita Líquida (Empresa)"
              value={formatCurrency(metrics.companyNetRevenue)}
              subtitle="Após descontar comissões"
              icon={<PiggyBank className="h-full w-full" />}
            />
            <StatCard
              title="Total Comissões (Profissionais)"
              value={formatCurrency(metrics.totalProfessionalCommission)}
              subtitle="Valor total a pagar"
              icon={<Users className="h-full w-full" />}
            />
          </div>

          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4">
              Breakdown por Profissional
            </h3>
            {Object.keys(metrics.professionalCommissions).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mb-2 opacity-20" />
                <p>Nenhuma comissão registrada no período.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(metrics.professionalCommissions)
                  .sort(([, a], [, b]) => b.amount - a.amount)
                  .map(([id, data]) => {
                    const percentageOfTotalComms =
                      metrics.totalProfessionalCommission > 0
                        ? (data.amount / metrics.totalProfessionalCommission) *
                          100
                        : 0;

                    return (
                      <div key={id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{data.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {data.count} serviço(s) realizado(s)
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {formatCurrency(data.amount)}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {percentageOfTotalComms.toFixed(1)}% das comissões
                            </p>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
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
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2 text-base sm:text-lg">
              <Star className="h-5 w-5 text-primary" />
              Fontes de Novos Clientes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(metrics.referral_sourceCounts).length === 0 ? (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  Sem dados de indicação.
                </p>
              ) : (
                Object.entries(metrics.referral_sourceCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const percentage = (count / metrics.totalClients) * 100;
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
                            <span>RELEVÂNCIA</span>
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
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2 text-base sm:text-lg">
              <Package className="h-5 w-5 text-primary" />
              Ranking Detalhado de Serviços
            </h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left border-collapse text-sm sm:text-base">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-3 sm:p-4 font-bold">Serviço</th>
                    <th className="p-3 sm:p-4 font-bold text-center">Vendas</th>
                    <th className="p-3 sm:p-4 font-bold text-right">
                      Faturamento
                    </th>
                    <th className="p-3 sm:p-4 font-bold text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {metrics.topServices.map((s, idx) => {
                    const share =
                      metrics.revenue > 0
                        ? (s.revenue / metrics.revenue) * 100
                        : 0;
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3 sm:p-4 font-medium">{s.name}</td>
                        <td className="p-3 sm:p-4 text-center">
                          <Badge variant="outline">{s.quantity}</Badge>
                        </td>
                        <td className="p-3 sm:p-4 text-right font-bold">
                          {formatCurrency(s.revenue)}
                        </td>
                        <td className="p-3 sm:p-4 text-right">
                          <span className="text-xs font-bold text-primary">
                            {share.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
