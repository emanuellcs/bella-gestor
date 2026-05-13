import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as cancelPayment } from "@/app/api/infinitepay/cancel-payment/route";
import { POST as createCheckout } from "@/app/api/infinitepay/checkout/route";
import { POST as paymentCheck } from "@/app/api/infinitepay/payment-check/route";
import { POST as webhook } from "@/app/api/infinitepay/webhook/route";
import { PaymentStatus, SaleStatus } from "@/types";
import { dbFactories } from "@/test/factories";
import { infinitePayCheckoutSuccessHandler } from "@/test/msw-handlers";
import { server } from "@/test/setup";
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

function jsonRequest(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("InfinitePay API routes", () => {
  let supabase: MockSupabaseClient;

  beforeEach(() => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        sales: [dbFactories.sale({ total_amount: 120 })],
        payments: [],
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);
  });

  it("creates an InfinitePay link and stores the pending payment without live network", async () => {
    server.use(infinitePayCheckoutSuccessHandler);

    const response = await createCheckout(
      jsonRequest({ saleId: 900, amount: 120, items: [] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      url: "https://pay.infinitepay.io/test",
    });
    expect(tableRows(supabase, "payments")[0]).toMatchObject({
      sale_id: 900,
      amount: 120,
      payment_method: "Link",
      status: PaymentStatus.PENDING,
    });
  });

  it("marks a pending payment paid from webhook and updates the sale status", async () => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        sales: [dbFactories.sale({ total_amount: 120 })],
        payments: [
          dbFactories.payment({
            amount: 0,
            status: PaymentStatus.PENDING,
            external_transaction_id: "sale-900-1",
          }),
        ],
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);

    const response = await webhook(
      jsonRequest({
        invoice_slug: "invoice-1",
        amount: 12000,
        paid_amount: 12000,
        installments: 1,
        capture_method: "pix",
        transaction_nsu: "txn-paid",
        order_nsu: "sale-900-1",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(tableRows(supabase, "payments")[0]).toMatchObject({
      amount: 120,
      status: PaymentStatus.PAID,
      external_transaction_id: "txn-paid",
    });
    expect(tableRows(supabase, "sales")[0]).toMatchObject({
      status: SaleStatus.PAID,
    });
  });

  it("skips malformed webhook payloads without throwing", async () => {
    const response = await webhook(jsonRequest({ order_nsu: "" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      skipped: true,
      reason: "Faltam identificadores",
    });
  });

  it("uses payment-check as an idempotent paid confirmation", async () => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        sales: [dbFactories.sale({ total_amount: 120 })],
        payments: [
          dbFactories.payment({
            status: PaymentStatus.PENDING,
            external_transaction_id: "sale-900-1",
          }),
        ],
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);

    const response = await paymentCheck(
      jsonRequest({
        order_nsu: "sale-900-1",
        transaction_nsu: "txn-paid",
        slug: "invoice-1",
      }),
    );

    expect(response.status).toBe(200);
    expect(tableRows(supabase, "payments")[0]).toMatchObject({
      status: PaymentStatus.PAID,
      external_transaction_id: "txn-paid",
    });
  });

  it("cancels a local payment link by external transaction id", async () => {
    supabase = createSupabaseMock({
      mode: "admin",
      tables: {
        payments: [
          dbFactories.payment({
            external_transaction_id: "sale-900-1",
            payment_link_url: "https://pay.infinitepay.io/test",
          }),
        ],
      },
    });
    mocks.getSupabaseAdmin.mockReturnValue(supabase);

    const response = await cancelPayment(
      jsonRequest({ externalTransactionId: "sale-900-1" }),
    );

    expect(response.status).toBe(200);
    expect(tableRows(supabase, "payments")[0]).toMatchObject({
      status: PaymentStatus.CANCELLED,
      payment_link_url: null,
    });
  });
});
