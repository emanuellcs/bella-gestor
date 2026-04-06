import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AppRole } from "@/types";
import { jwtVerify } from "jose";
import { SupabaseProfessional } from "@/types/db";

const COOKIE = "pro_access";
const PAGE_SIZE = 1000;

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
  const allData: SupabaseProfessional[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .eq("role", AppRole.PROFESSIONAL)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data || data.length === 0) break;
    allData.push(...data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const out = allData.map((r) => ({
    id: r.user_id,
    email: r.email ?? undefined,
    fullName: r.full_name ?? undefined,
    functionTitle: r.function_title ?? undefined,
    role: r.role as AppRole,
  }));
  return NextResponse.json(out);
}
