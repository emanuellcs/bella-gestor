// app/api/infinitepay/webhook/route.ts
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const WEBHOOK_SECRET = process.env.INFINITEPAY_WEBHOOK_SECRET || ""

type WebhookBody = {
  invoice_slug: string
  amount: number           // CENTAVOS
  paid_amount: number      // CENTAVOS
  installments: number
  capture_method: "credit_card" | "pix"
  transaction_nsu: string
  order_nsu: string
  receipt_url?: string
  items?: any[]
}

async function getSaleAndPaidTotal(supabaseAdmin: any, saleId: number) {
  const { data: sale, error: saleErr } = await supabaseAdmin
    .from("sales")
    .select("id,total_amount,status")
    .eq("id", saleId)
    .single()
  if (saleErr || !sale) throw new Error("Venda não encontrada")

  const { data: pays, error: paysErr } = await supabaseAdmin
    .from("payments")
    .select("amount,status")
    .eq("sale_id", saleId)
  if (paysErr) throw new Error("Falha ao consultar pagamentos")

  const totalPaid = (pays || [])
    .filter((p: any) => p.status === "paid")
    .reduce((acc: number, p: any) => acc + Number(p.amount), 0)

  return { sale, totalPaid }
}

async function ensureSaleStatus(supabaseAdmin: any, saleId: number) {
  const { sale, totalPaid } = await getSaleAndPaidTotal(supabaseAdmin, saleId)
  const totalAmount = Number(sale.total_amount ?? 0)
  if (totalPaid >= totalAmount && sale.status !== "paid") {
    await supabaseAdmin.from("sales").update({ status: "paid" }).eq("id", saleId)
  }
}

export async function POST(req: Request) {
  try {
    // Validação opcional do webhook por segredo compartilhado
    if (WEBHOOK_SECRET) {
      const sig = req.headers.get("x-webhook-secret")
      if (sig !== WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false, error: "Assinatura inválida" }, { status: 200 })
      }
    }

    const payload = (await req.json()) as WebhookBody
    const supabaseAdmin = getSupabaseAdmin()

    const order_nsu = payload.order_nsu
    const transaction_nsu = payload.transaction_nsu
    if (!order_nsu || !transaction_nsu) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Faltam identificadores" }, { status: 200 })
    }

    // Converte centavos -> reais
    const paidAmountReais = typeof payload.paid_amount === "number" ? payload.paid_amount / 100 : null

    // Procura por ambos os identificadores para idempotência
    const { data: foundByAny } = await supabaseAdmin
      .from("payments")
      .select("id,sale_id,status,external_transaction_id")
      .in("external_transaction_id", [order_nsu, transaction_nsu])
      .limit(1)

    let paymentId: number | null = foundByAny?.[0]?.id ?? null
    let saleId: number | null = foundByAny?.[0]?.sale_id ?? null

    // Fallback: extrai sale_id do padrão sale-<id>-<ts> no order_nsu
    if (!saleId) {
      const m = order_nsu.match(/sale-(\d+)-/)
      if (m) saleId = parseInt(m[1], 10)
    }

    // Idempotência: se já existir registro com transaction_nsu e status paid, finalizar
    if (transaction_nsu) {
      const { data: already } = await supabaseAdmin
        .from("payments")
        .select("id,status,sale_id")
        .eq("external_transaction_id", transaction_nsu)
        .limit(1)
      if (already?.[0]?.id && already?.[0]?.status === "paid") {
        if (already?.[0]?.sale_id) await ensureSaleStatus(supabaseAdmin, already[0].sale_id)
        return NextResponse.json({ ok: true, idempotent: true }, { status: 200 })
      }
    }

    if (paymentId) {
      // Atualiza pending -> paid e substitui o identificador por transaction_nsu
      await supabaseAdmin
        .from("payments")
        .update({
          status: "paid",
          payment_method: payload.capture_method ?? null,
          external_transaction_id: transaction_nsu, // fixa no NSU final
          payment_link_url: payload.receipt_url ?? null,
          paid_at: new Date().toISOString(),
          ...(paidAmountReais != null ? { amount: paidAmountReais } : {}),
        })
        .eq("id", paymentId)
    } else if (saleId) {
      // Cria pago se não houver pending correspondente
      await supabaseAdmin
        .from("payments")
        .insert([{
          sale_id: saleId,
          status: "paid",
          payment_method: payload.capture_method ?? null,
          external_transaction_id: transaction_nsu || order_nsu,
          payment_link_url: payload.receipt_url ?? null,
          paid_at: new Date().toISOString(),
          amount: paidAmountReais ?? 0, // REAIS
        }])
    } else {
      return NextResponse.json({ ok: true, skipped: true, reason: "Sem sale_id" }, { status: 200 })
    }

    if (saleId) await ensureSaleStatus(supabaseAdmin, saleId)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro interno" }, { status: 200 })
  }
}
