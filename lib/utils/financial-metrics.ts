// lib/utils/financial-metrics.ts

import type { Sale, Payment, Appointment, Client } from "@/types";
import { SaleStatus, PaymentStatus } from "@/types";

// ─── Timezone boundary helpers ───────────────────────────────────────────────
export const SAO_PAULO_OFFSET_HOURS = -3; // BRT (UTC-3)

function startOfDayUTC(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function endOfDayUTC(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function todayInSaoPaulo(): string {
  const now = new Date();
  const spNow = new Date(
    now.getTime() + SAO_PAULO_OFFSET_HOURS * 60 * 60 * 1000,
  );
  return spNow.toISOString().slice(0, 10);
}

// ─── Partition helpers ───────────────────────────────────────────────────────

function isAfter(isoTimestamp: string, boundary: Date): boolean {
  return new Date(isoTimestamp) > boundary;
}

function isWithin(
  isoTimestamp: string,
  start: Date,
  end: Date,
): boolean {
  const t = new Date(isoTimestamp).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** A "projectable" appointment: future, scheduled, and NOT yet linked to a sale. */
function isProjectableAppointment(
  apt: Appointment,
  todayEnd: Date,
): boolean {
  return (
    apt.status === "scheduled" &&
    !apt.hasSale &&
    isAfter(apt.startTime, todayEnd)
  );
}

// ─── Result types ────────────────────────────────────────────────────────────

export interface PeriodMetrics {
  // Revenue
  actualRevenue: number;       
  projectedRevenue: number;    
  totalRevenue: number;        

  // Payments
  paidPaymentsCount: number;
  pendingPaymentsCount: number;
  paidPayments: Payment[];
  pendingPayments: Payment[];

  // Appointments
  projectedAppointments: Appointment[];
  projectedAppointmentsValue: number;

  // Sales
  salesCount: number;
  cancelledSalesCount: number;
  cancellationRate: number;

  // Breakdown
  paymentsByMethod: Record<string, number>;
  topServices: { name: string; quantity: number; revenue: number }[];

  // Clients
  newClientsCount: number;
  totalClients: number;
  activeClients: number;
  retentionRate: number;
  referralSourceCounts: Record<string, number>;

  // Commissions & Professional Performance
  professionalBreakdown: Record<
    string,
    { name: string; commission: number; revenue: number; count: number }
  >;
  totalCommissions: number;
  netRevenue: number; 
  netMarginPercentage: number; // (netRevenue / actualRevenue) * 100

  // Averages
  avgTicket: number;
}

export interface DateRangeFilter {
  mode: "past" | "future" | "custom";
  startDate?: string;
  endDate?: string;
}

export function computeFinancialMetrics(
  sales: Sale[],
  payments: Payment[],
  appointments: Appointment[],
  clients: Client[],
  filter: DateRangeFilter,
): PeriodMetrics {
  const today = todayInSaoPaulo();
  const todayEnd = endOfDayUTC(today);
  const todayStart = startOfDayUTC(today);

  let filterSale: (s: Sale) => boolean;
  let filterPaidPayment: (p: Payment) => boolean;
  let filterPendingPayment: (p: Payment) => boolean;
  let filterAppointment: (a: Appointment) => boolean;
  let filterClient: (c: Client) => boolean;

  if (filter.mode === "past") {
    filterSale = (s) => isWithin(s.created_at, new Date(0), todayEnd);
    filterPaidPayment = (p) =>
      p.status === PaymentStatus.PAID &&
      !!p.paidAt &&
      isWithin(p.paidAt, new Date(0), todayEnd);
    filterPendingPayment = () => false;
    filterAppointment = () => false;
    filterClient = (c) => isWithin(c.registrationDate, new Date(0), todayEnd);

  } else if (filter.mode === "future") {
    filterSale = (s) => isAfter(s.created_at, todayEnd);
    filterPaidPayment = () => false;
    filterPendingPayment = (p) =>
      p.status === PaymentStatus.PENDING &&
      isAfter(p.created_at, todayEnd);
    filterAppointment = (a) => isProjectableAppointment(a, todayEnd);
    filterClient = (c) => isAfter(c.registrationDate, todayEnd);

  } else {
    const rangeStart = startOfDayUTC(filter.startDate!);
    const rangeEnd = endOfDayUTC(filter.endDate!);

    filterSale = (s) => isWithin(s.created_at, rangeStart, rangeEnd);
    filterPaidPayment = (p) =>
      p.status === PaymentStatus.PAID &&
      !!p.paidAt &&
      isWithin(p.paidAt, rangeStart, rangeEnd);
    filterPendingPayment = (p) =>
      p.status === PaymentStatus.PENDING &&
      isWithin(p.created_at, rangeStart, rangeEnd);

    const projStart = new Date(Math.max(rangeStart.getTime(), todayStart.getTime()));
    filterAppointment = (a) =>
      isProjectableAppointment(a, todayEnd) &&
      isWithin(a.startTime, projStart, rangeEnd);
    filterClient = (c) => isWithin(c.registrationDate, rangeStart, rangeEnd);
  }

  const filteredSales = sales.filter(filterSale);
  const paidPayments = payments.filter(filterPaidPayment);
  const pendingPayments = payments.filter(filterPendingPayment);
  const projectedAppointments = appointments.filter(filterAppointment);
  const filteredClients = (clients || []).filter(filterClient);

  const actualRevenue = paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const pendingPaymentsValue = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const projectedAppointmentsValue = projectedAppointments.reduce((sum, a) => sum + (Number(a.totalPrice) || 0), 0);

  const projectedRevenue = pendingPaymentsValue + projectedAppointmentsValue;
  const totalRevenue = actualRevenue + projectedRevenue;

  const totalSalesCount = filteredSales.length;
  const cancelledSalesCount = filteredSales.filter((s) => s.status === SaleStatus.CANCELLED).length;
  const cancellationRate = totalSalesCount > 0 ? (cancelledSalesCount / totalSalesCount) * 100 : 0;

  const paymentsByMethod = paidPayments.reduce<Record<string, number>>((acc, p) => {
    const method = p.paymentMethod || "Não informado";
    acc[method] = (acc[method] || 0) + (Number(p.amount) || 0);
    return acc;
  }, {});

  const servicesMap: Record<string, { quantity: number; revenue: number }> = {};
  for (const sale of filteredSales) {
    if (sale.status === SaleStatus.CANCELLED) continue;
    for (const item of sale.items || []) {
      const key = [item.serviceName, item.serviceVariantName].filter(Boolean).join(" — ") || "Serviço s/ nome";
      if (!servicesMap[key]) servicesMap[key] = { quantity: 0, revenue: 0 };
      servicesMap[key].quantity += Number(item.quantity) || 0;
      servicesMap[key].revenue += Number(item.subtotal ?? item.quantity * item.unitPrice) || 0;
    }
  }
  const topServices = Object.entries(servicesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  // Clients
  const totalClientsCount = (clients || []).length;
  const activeClientsCount = (clients || []).filter((c) => c.status === "active").length;
  const isClientCount = (clients || []).filter((c) => c.isClient).length;
  const retentionRate = totalClientsCount > 0 ? (isClientCount / totalClientsCount) * 100 : 0;

  const referralSourceCounts: Record<string, number> = {};
  filteredClients.forEach((c) => {
    if (c.referral_source) {
      referralSourceCounts[c.referral_source] = (referralSourceCounts[c.referral_source] || 0) + 1;
    }
  });

  const professionalBreakdown: Record<string, { name: string; commission: number; revenue: number; count: number }> = {};
  for (const sale of filteredSales) {
    if (sale.status === SaleStatus.CANCELLED) continue;
    for (const item of sale.items || []) {
      const groupId = item.professionalId || item.professionalName || "unknown";
      const name = item.professionalName || "Profissional s/ nome";
      const subtotal = Number(item.subtotal) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      const commAmount = item.commissionAmount ? Number(item.commissionAmount) : (subtotal * (Number(item.commissionPct) || 70)) / 100;

      if (!professionalBreakdown[groupId]) professionalBreakdown[groupId] = { name, commission: 0, revenue: 0, count: 0 };
      professionalBreakdown[groupId].commission += commAmount;
      professionalBreakdown[groupId].revenue += subtotal;
      professionalBreakdown[groupId].count += 1;
    }
  }

  const totalCommissions = Object.values(professionalBreakdown).reduce((sum, c) => sum + c.commission, 0);
  const netRevenue = actualRevenue - totalCommissions;
  const netMarginPercentage = actualRevenue > 0 ? (netRevenue / actualRevenue) * 100 : 0;

  const avgTicket = paidPayments.length > 0 ? actualRevenue / paidPayments.length : 0;

  return {
    actualRevenue,
    projectedRevenue,
    totalRevenue,
    paidPaymentsCount: paidPayments.length,
    pendingPaymentsCount: pendingPayments.length,
    paidPayments,
    pendingPayments,
    projectedAppointments,
    projectedAppointmentsValue,
    salesCount: totalSalesCount,
    cancelledSalesCount,
    cancellationRate,
    paymentsByMethod,
    topServices,
    newClientsCount: filteredClients.length,
    totalClients: totalClientsCount,
    activeClients: activeClientsCount,
    retentionRate,
    referralSourceCounts,
    professionalBreakdown,
    totalCommissions,
    netRevenue,
    netMarginPercentage,
    avgTicket,
  };
}
