import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { saleId, amount, items, customer, address } = body;

    console.log('Gerando link InfinitePay:', { saleId, amount, customer, address });

    // Monta o payload para a InfinitePay
    const payload: any = {
      handle: process.env.INFINITEPAY_HANDLE || 'spacobellas',
      redirect_url: `${process.env.INFINITEPAY_REDIRECT_URL || 'https://www.spacobellas.com.br'}/sucesso`,
      webhook_url: `${process.env.INFINITEPAY_WEBHOOK_URL || 'http://localhost:3000'}/api/infinitepay/webhook`,
      order_nsu: `sale-${saleId}-${Date.now()}`,
      items: items && items.length > 0
        ? items
        : [{
            quantity: 1,
            price: Math.round(amount * 100), // converte R$ para centavos
            description: 'Pagamento de serviço',
          }],
    };

    // Adiciona customer se fornecido
    if (customer && (customer.name || customer.email || customer.phone_number)) {
      payload.customer = {};
      if (customer.name) payload.customer.name = customer.name;
      if (customer.email) payload.customer.email = customer.email;
      if (customer.phone_number) payload.customer.phone_number = customer.phone_number; // já vem formatado
    }

    // Adiciona address se fornecido
    if (address && address.cep && address.number) {
      payload.address = {
        cep: address.cep, // só números
        number: address.number,
      };
      
      // Campos opcionais da API InfinitePay
      if (address.street) payload.address.street = address.street;
      if (address.neighborhood) payload.address.neighborhood = address.neighborhood;
      if (address.complement) payload.address.complement = address.complement;
    }

    console.log('Enviando para InfinitePay:', JSON.stringify(payload, null, 2));

    // Chama a API da InfinitePay
    const response = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro da InfinitePay:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Erro ao criar link de pagamento' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Link criado:', data);

    // Salva o pagamento pendente no banco
    const supabaseAdmin = getSupabaseAdmin();
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert([{
        sale_id: parseInt(String(saleId)),
        amount: amount,
        payment_method: 'Link',
        external_transaction_id: payload.order_nsu,
        payment_link_url: data.url,
        status: 'pending',
        paid_at: null,
      }]);

    if (paymentError) {
      console.error('Erro ao salvar pagamento:', paymentError);
      return NextResponse.json(
        { error: 'Link criado mas falhou ao registrar no banco' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url, order_nsu: payload.order_nsu }, { status: 200 });
  } catch (e: any) {
    console.error('Erro no endpoint:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
