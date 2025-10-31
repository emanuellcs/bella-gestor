import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "pro_access";
const enc = new TextEncoder();

function ok() {
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return new NextResponse(null, { status: 401 });
  try {
    const { payload } = await jwtVerify(token, enc.encode(process.env.JWT_SECRET!));
    if (payload.role !== "Professional") return new NextResponse(null, { status: 403 });
    return ok();
  } catch {
    return new NextResponse(null, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const keyword = (body?.keyword ?? "").toString();
  if (keyword !== process.env.PROFESSIONAL_ACCESS_KEY) {
    return NextResponse.json({ error: "Palavra‑chave inválida" }, { status: 401 });
  }
  const token = await new SignJWT({ role: "Professional" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(enc.encode(process.env.JWT_SECRET!));
  const res = ok();
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
