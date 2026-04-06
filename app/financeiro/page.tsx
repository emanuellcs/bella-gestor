"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import type { Sale } from "@/types";
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

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// icons
import {
  Search,
  RefreshCw,
  CreditCard,
} from "lucide-react";

// Form types
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
  const {
    sales,
    refreshData: refreshAll,
  } = useData();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SaleStatus>("");
  const [dateRange] = useState<DateRange>({});

  // Pagination
  const [page] = useState(1);
  const [pageSize] = useState(10);

  // Sections (sales | payments)
  const [activeTab, setActiveTab] = useState<"sales" | "payments">("sales");

  const [posCheckoutSale, setPosCheckoutSale] = useState<Sale | null>(null);

  function paidAmount(s: Sale) {
    return (s.payments || [])
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((acc, p) => acc + Number(p.amount), 0);
  }

  const filteredSales = useMemo(() => {
    let list = (sales || []).filter((s) => withinRange(s.created_at, dateRange));
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.clientName?.toLowerCase().includes(q) ||
          String(s.id).includes(q) ||
          (s.items || []).some((it) => it.serviceVariantName?.toLowerCase().includes(q)),
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

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <PageHeader title="Financeiro" description="Controle de vendas, pagamentos e fluxo de caixa." />

      <Tabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "sales" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Recentes</CardTitle>
              <Button size="sm" onClick={() => refreshAll()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, ID ou serviço..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                  <Select
                    value={statusFilter || "all"}
                    onValueChange={(v) => setStatusFilter(v === "all" ? "" : v as SaleStatus)}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
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

              <div className="rounded-md border">
                <ul className="divide-y">
                  {pagedSales.map((s) => {
                    const paid = paidAmount(s);
                    const due = Number(s.totalAmount) - paid;
                    return (
                      <li key={s.id} className="p-4 hover:bg-muted/30 transition">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">#{s.id}</span>
                              <Badge variant={s.status === "paid" ? "default" : s.status === "cancelled" ? "destructive" : "outline"}>
                                {s.status.toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium">{s.clientName}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(s.created_at).toLocaleString("pt-BR")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total: {currency(Number(s.totalAmount))} • Pago: {currency(paid)} • Saldo: {currency(due)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPosCheckoutSale(s)} disabled={due <= 0 || s.status === SaleStatus.CANCELLED}>
                              <CreditCard className="h-4 w-4 mr-2" /> Checkout Rápido (POS)
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {posCheckoutSale && (
        <CheckoutModal
          isOpen={!!posCheckoutSale}
          onClose={() => setPosCheckoutSale(null)}
          saleId={Number(posCheckoutSale.id)}
          clientName={posCheckoutSale.clientName || "Cliente"}
          totalAmount={Number(posCheckoutSale.totalAmount)}
          alreadyPaidAmount={paidAmount(posCheckoutSale)}
          onSuccess={(isFullyPaid) => {
            refreshAll();
            if (isFullyPaid) setPosCheckoutSale(null);
          }}
        />
      )}
    </div>
  );
}

function Tabs({ active, onChange }: { active: "sales" | "payments"; onChange: (v: "sales" | "payments") => void }) {
  return (
    <div className="flex border-b">
      <button onClick={() => onChange("sales")} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${active === "sales" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
        Vendas
      </button>
      <button onClick={() => onChange("payments")} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${active === "payments" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
        Pagamentos
      </button>
    </div>
  );
}
