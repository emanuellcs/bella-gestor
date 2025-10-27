import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { PaymentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { externalTransactionId } = await req.json();
    const supabaseAdmin = getSupabaseAdmin();

    if (!externalTransactionId) {
      return NextResponse.json({ error: "externalTransactionId is required" }, { status: 400 });
    }

    // Invalidate the InfinitePay link (if applicable)
    // NOTE: InfinitePay API does not have a direct "cancel link" endpoint.
    // The best approach is to update the payment status in our system to "cancelled".
    // If a refund is needed, it would typically be a separate process.

    // Update payment status in Supabase
    const { data, error } = await supabaseAdmin
      .from("payments")
      .update({
        status: "cancelled",
        payment_link_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("external_transaction_id", externalTransactionId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to cancel payment in Supabase" }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "Payment not found or already cancelled" }, { status: 404 });
    }

    return NextResponse.json({ message: "Payment cancelled successfully", payment: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}