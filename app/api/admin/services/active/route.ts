import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { jwtVerify } from "jose";
import { SupabaseService, SupabaseServiceVariant } from "@/types/db";

const COOKIE = "pro_access";
const PAGE_SIZE = 1000;

type ServiceWithVariants = SupabaseService & {
  service_variants: SupabaseServiceVariant[];
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return new NextResponse(null, { status: 401 });
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!),
    );
    if (payload.role !== "Professional")
      return new NextResponse(null, { status: 403 });
  } catch {
    return new NextResponse(null, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const allData: ServiceWithVariants[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("services")
      .select("*, service_variants(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data || data.length === 0) break;
    allData.push(...data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return NextResponse.json(allData);
}
