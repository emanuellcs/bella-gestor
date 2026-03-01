import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AppRole } from "@/types";
import { jwtVerify } from "jose";

const COOKIE = "pro_access";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return new NextResponse(null, { status: 401 });
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!));
    if (payload.role !== "Professional") return new NextResponse(null, { status: 403 });
  } catch {
    return new NextResponse(null, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("professionals")
    .select("user_id,role,email,full_name,function_title")
    .eq("role", AppRole.PROFESSIONAL)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // normaliza para o tipo Professional da app
  const out = (data ?? []).map((r: any) => ({
    id: r.user_id,
    email: r.email ?? undefined,
    fullName: r.full_name ?? undefined,
    functionTitle: r.function_title ?? undefined,
    role: r.role,
  }));
  return NextResponse.json(out);
}
