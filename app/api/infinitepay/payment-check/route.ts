// app/api/infinitepay/payment-check/route.ts
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const HANDLE = process.env.INFINITEPAY_HANDLE || "spacobellas"

type CheckBody = {
  order_nsu: string
  transaction_nsu: string
  slug: string
}

async function ensureSaleStatus(supabaseAdmin: any, saleId: number) {
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("id,total_amount,status")
    .eq("id", saleId)
    .single()
  if (!sale) return
  const { data: pays } = await supabaseAdmin
    .from("payments")
    .select("amount,status")
    .eq("sale_id", saleId)
  const totalPaid = (pays || [])
    .filter((p: any) => p.status === "paid")
    .reduce((acc: number, p: any) => acc + Number(p.amount), 0)
  if (totalPaid >= Number(sale.total_amount ?? 0) && sale.status !== "paid") {
    await supabaseAdmin.from("sales").update({ status: "paid" }).eq("id", saleId)
  }
}

export async function POST(req: Request) {
  try {
    if (!HANDLE) return NextResponse.json({ ok: false, error: "INFINITEPAY_HANDLE ausente" }, { status: 400 })

    const { order_nsu, transaction_nsu } = (await req.json()) as CheckBody
    const supabaseAdmin = getSupabaseAdmin()

    // Procura por ambos identificadores
    const { data: foundByAny } = await supabaseAdmin
      .from("payments")
      .select("id,sale_id,status")
      .in("external_transaction_id", [order_nsu, transaction_nsu])
      .limit(1)

    let paymentId: number | null = foundByAny?.[0]?.id ?? null
    let saleId: number | null = foundByAny?.[0]?.sale_id ?? null
    if (!saleId) {
      const m = order_nsu.match(/sale-(\d+)-/)
      if (m) saleId = parseInt(m[1], 10)
    }

    if (paymentId) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "paid",
          external_transaction_id: transaction_nsu || order_nsu,
          paid_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
    } else if (saleId) {
      await supabaseAdmin
        .from("payments")
        .insert([{
          sale_id: saleId,
          status: "paid",
          payment_method: 'Link',
          external_transaction_id: transaction_nsu || order_nsu,
          paid_at: new Date().toISOString(),
          amount: 0, // sem valor confirmado aqui; webhook atualiza quando chegar
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
