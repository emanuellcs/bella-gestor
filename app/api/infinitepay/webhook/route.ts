// app/api/infinitepay/webhook/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEBHOOK_SECRET = process.env.INFINITEPAY_WEBHOOK_SECRET || "";

type WebhookBody = {
  invoice_slug: string;
  amount: number; // CENTS
  paid_amount: number; // CENTS
  installments: number;
  capture_method: "credit_card" | "pix";
  transaction_nsu: string;
  order_nsu: string;
  receipt_url?: string;
  items?: unknown[];
};

async function getSaleAndPaidTotal(
  supabaseAdmin: SupabaseClient,
  saleId: number,
) {
  const { data: sale, error: saleErr } = await supabaseAdmin
    .from("sales")
    .select("id,total_amount,status")
    .eq("id", saleId)
    .is("deleted_at", null)
    .single();
  if (saleErr || !sale) throw new Error("Venda não encontrada");

  const { data: pays, error: paysErr } = await supabaseAdmin
    .from("payments")
    .select("amount,status")
    .eq("sale_id", saleId)
    .is("deleted_at", null);
  if (paysErr) throw new Error("Falha ao consultar pagamentos");

  const totalPaid = (pays || [])
    .filter((p) => p.status === "paid")
    .reduce((acc: number, p) => acc + Number(p.amount), 0);

  return { sale, totalPaid };
}

async function ensureSaleStatus(supabaseAdmin: SupabaseClient, saleId: number) {
  const { sale, totalPaid } = await getSaleAndPaidTotal(supabaseAdmin, saleId);
  const totalAmount = Number(sale.total_amount ?? 0);
  if (totalPaid >= totalAmount && sale.status !== "paid") {
    await supabaseAdmin
      .from("sales")
      .update({ status: "paid" })
      .eq("id", saleId)
      .is("deleted_at", null);
  }
}

export async function POST(req: Request) {
  try {
    // Optional webhook validation via shared secret
    if (WEBHOOK_SECRET) {
      const sig = req.headers.get("x-webhook-secret");
      if (sig !== WEBHOOK_SECRET) {
        return NextResponse.json(
          { ok: false, error: "Assinatura inválida" },
          { status: 200 },
        );
      }
    }

    const payload = (await req.json()) as WebhookBody;
    const supabaseAdmin = getSupabaseAdmin();

    const order_nsu = payload.order_nsu;
    const transaction_nsu = payload.transaction_nsu;
    if (!order_nsu || !transaction_nsu) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "Faltam identificadores" },
        { status: 200 },
      );
    }

    // Convert cents to reais
    const paidAmountReais =
      typeof payload.paid_amount === "number"
        ? payload.paid_amount / 100
        : null;

    // Search for both identifiers for idempotency
    const { data: foundByAny } = await supabaseAdmin
      .from("payments")
      .select("id,sale_id,status,external_transaction_id")
      .in("external_transaction_id", [order_nsu, transaction_nsu])
      .is("deleted_at", null)
      .limit(1);

    const paymentId: number | null = foundByAny?.[0]?.id ?? null;
    let saleId: number | null = foundByAny?.[0]?.sale_id ?? null;

    // Fallback: extract sale_id from sale-<id>-<ts> pattern in order_nsu
    if (!saleId) {
      const m = order_nsu.match(/sale-(\d+)-/);
      if (m) saleId = parseInt(m[1], 10);
    }

    // Idempotency: if paid transaction_nsu already exists, terminate
    if (transaction_nsu) {
      const { data: already } = await supabaseAdmin
        .from("payments")
        .select("id,status,sale_id")
        .eq("external_transaction_id", transaction_nsu)
        .is("deleted_at", null)
        .limit(1);
      if (already?.[0]?.id && already?.[0]?.status === "paid") {
        if (already?.[0]?.sale_id)
          await ensureSaleStatus(supabaseAdmin, already[0].sale_id);
        return NextResponse.json(
          { ok: true, idempotent: true },
          { status: 200 },
        );
      }
    }

    if (paymentId) {
      // Update status from pending to paid and set transaction_nsu as identifier
      await supabaseAdmin
        .from("payments")
        .update({
          status: "paid",
          payment_method: payload.capture_method ?? null,
          external_transaction_id: transaction_nsu, // final NSU
          payment_link_url: payload.receipt_url ?? null,
          paid_at: new Date().toISOString(),
          ...(paidAmountReais != null ? { amount: paidAmountReais } : {}),
        })
        .eq("id", paymentId)
        .is("deleted_at", null);
    } else if (saleId) {
      // Create paid record if no matching pending record exists
      await supabaseAdmin.from("payments").insert([
        {
          sale_id: saleId,
          status: "paid",
          payment_method: payload.capture_method ?? null,
          external_transaction_id: transaction_nsu || order_nsu,
          payment_link_url: payload.receipt_url ?? null,
          paid_at: new Date().toISOString(),
          amount: paidAmountReais ?? 0, // REAIS
        },
      ]);
    } else {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "Sem sale_id" },
        { status: 200 },
      );
    }

    if (saleId) await ensureSaleStatus(supabaseAdmin, saleId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Erro interno" },
      { status: 200 },
    );
  }
}
