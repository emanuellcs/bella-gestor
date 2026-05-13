import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSaleAction,
  processManualPaymentAction,
  updateSaleStatusAction,
} from "@/actions/finance";
import { PaymentStatus, SaleStatus } from "@/types";
import { dbFactories } from "@/test/factories";
import {
  createSupabaseMock,
  tableRows,
  type MockSupabaseClient,
} from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn<() => MockSupabaseClient>(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

function seedFinanceDb() {
  return createSupabaseMock({
    mode: "admin",
    tables: {
      app_settings: [dbFactories.appSetting({ value: "65" })],
      clients: [dbFactories.client()],
      professionals: [dbFactories.professional({ commission_pct: 55 })],
      services: [dbFactories.service()],
      service_variants: [dbFactories.serviceVariant({ commission_pct: 40 })],
      appointments: [dbFactories.appointment()],
      sales: [],
      sale_items: [],
      payments: [],
    },
  });
}

describe("finance actions", () => {
  let supabase: MockSupabaseClient;

  beforeEach(() => {
    supabase = seedFinanceDb();
    mocks.getSupabaseAdmin.mockReturnValue(supabase);
  });

  it("creates sale items using service-variant commission before other fallbacks", async () => {
    const result = await createSaleAction({
      clientId: "10",
      appointmentId: "100",
      status: SaleStatus.PENDING,
      items: [
        {
          serviceVariantId: "55",
          professionalId: "prof-1",
          quantity: 2,
          unitPrice: 100,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(tableRows(supabase, "sales")[0]).toMatchObject({
      client_id: 10,
      appointment_id: 100,
      total_amount: 200,
      professional_id: "prof-1",
    });
    expect(tableRows(supabase, "sale_items")[0]).toMatchObject({
      commission_pct: 40,
      commission_amount: 80,
      quantity: 2,
      unit_price: 100,
    });
  });

  it("keeps a sale pending after a partial manual payment", async () => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        sales: [dbFactories.sale({ total_amount: 120 })],
        payments: [],
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);

    const result = await processManualPaymentAction(900, "PIX", 50, "prof-1");

    expect(result).toEqual({ success: true, isFullyPaid: false });
    expect(tableRows(supabase, "sales")[0]).toMatchObject({
      status: SaleStatus.PENDING,
    });
    expect(tableRows(supabase, "payments")[0]).toMatchObject({
      amount: 50,
      status: PaymentStatus.PAID,
      professional_id: "prof-1",
    });
  });

  it("marks the sale and linked appointment paid/completed after full payment", async () => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        appointments: [dbFactories.appointment()],
        sales: [dbFactories.sale({ total_amount: 120 })],
        payments: [],
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);

    const result = await processManualPaymentAction(900, "PIX", 120, "prof-1");

    expect(result).toEqual({ success: true, isFullyPaid: true });
    expect(tableRows(supabase, "sales")[0]).toMatchObject({
      status: SaleStatus.PAID,
    });
    expect(tableRows(supabase, "appointments")[0]).toMatchObject({
      status: "completed",
    });
  });

  it("cancels related payments when a sale is cancelled", async () => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        clients: [dbFactories.client()],
        professionals: [dbFactories.professional()],
        services: [dbFactories.service()],
        service_variants: [dbFactories.serviceVariant()],
        sales: [dbFactories.sale()],
        sale_items: [dbFactories.saleItem()],
        payments: [dbFactories.payment({ status: PaymentStatus.PENDING })],
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);

    const result = await updateSaleStatusAction("900", SaleStatus.CANCELLED);

    expect(result.success).toBe(true);
    expect(tableRows(supabase, "payments")[0]).toMatchObject({
      status: PaymentStatus.CANCELLED,
    });
  });
});
