// app/api/infinitepay/checkout/route.ts
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const HANDLE = process.env.INFINITEPAY_HANDLE || "spacobellas"
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
const REDIRECT_URL = process.env.INFINITEPAY_REDIRECT_URL || `${BASE_URL}/financeiro/retorno`
const WEBHOOK_URL = process.env.INFINITEPAY_WEBHOOK_URL || `${BASE_URL}/api/infinitepay/webhook`

type CheckoutItem = { quantity: number; price: number; description: string }
type CheckoutBody = {
  saleId: string | number
  amount: number // REAIS (interno do app)
  items?: CheckoutItem[] // price em CENTAVOS (API InfinitePay)
  customer?: { name?: string; email?: string; phone_number?: string }
  address?: { cep?: string; number?: string; complement?: string }
  order_nsu?: string
}

async function getSaleBalance(supabaseAdmin: any, saleIdNum: number) {
  const { data: sale, error: saleErr } = await supabaseAdmin
    .from("sales")
    .select("id,total_amount,status")
    .eq("id", saleIdNum)
    .single()
  if (saleErr || !sale) throw new Error("Venda não encontrada")

  const { data: pays, error: paysErr } = await supabaseAdmin
    .from("payments")
    .select("amount,status")
    .eq("sale_id", saleIdNum)
  if (paysErr) throw new Error("Falha ao consultar pagamentos")

  const paid = (pays || [])
    .filter((p: any) => p.status === "paid")
    .reduce((acc: number, p: any) => acc + Number(p.amount), 0)
  const balance = Math.max(0, Number(sale.total_amount) - paid)
  return { sale, paid, balance }
}

export async function POST(req: Request) {
  try {
    if (!HANDLE) throw new Error("INFINITEPAY_HANDLE ausente")

    const body = (await req.json()) as CheckoutBody
    const supabaseAdmin = getSupabaseAdmin()

    const saleIdNum = parseInt(String(body.saleId), 10)
    const { balance } = await getSaleBalance(supabaseAdmin, saleIdNum)

    const amountReais = Number(body.amount || 0) // REAIS
    if (!amountReais || amountReais <= 0) throw new Error("Valor inválido")
    if (amountReais > balance) throw new Error("Valor excede o saldo da venda")

    const order_nsu = body.order_nsu || `sale-${saleIdNum}-${Date.now()}`

    // Gera items em CENTAVOS conforme exigido pela InfinitePay
    const items = (body.items && body.items.length
      ? body.items
      : [{ quantity: 1, price: Math.round(amountReais * 100), description: `Venda #${saleIdNum}` }])
      .map(it => ({
        quantity: Math.max(1, Number(it.quantity || 1)),
        price: Math.round(Number(it.price)), // CENTAVOS
        description: it.description || `Venda #${saleIdNum}`,
      }))

    const payload = {
      handle: HANDLE,
      redirect_url: REDIRECT_URL,
      webhook_url: WEBHOOK_URL,
      order_nsu,
      items, // CENTAVOS
      ...(body.customer ? { customer: body.customer } : {}),
      ...(body.address ? { address: body.address } : {}),
    }

    const resp = await fetch("https://api.infinitepay.io/invoices/public/checkout/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await resp.json()
    if (!resp.ok || !json?.url) {
      return NextResponse.json({ error: json?.message || "Falha ao criar link" }, { status: 400 })
    }

    // Registra pending no servidor (REAS) e guarda order_nsu
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert([{
        sale_id: saleIdNum,
        amount: amountReais,                 // REAIS
        status: "pending",
        payment_method: null,
        external_transaction_id: order_nsu,  // order_nsu
        payment_link_url: json.url,
      }])
      .select("*")
      .single()

    if (payErr) {
      return NextResponse.json({ error: payErr.message || "Falha ao registrar pagamento" }, { status: 400 })
    }

    return NextResponse.json({ url: json.url, order_nsu, payment }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 400 })
  }
}
