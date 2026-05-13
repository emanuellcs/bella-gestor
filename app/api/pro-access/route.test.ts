import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/pro-access/route";

vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "test-token";
    }
  },
  jwtVerify: async () => ({ payload: { role: "Professional" } }),
}));

function postRequest(keyword: string) {
  return new NextRequest("http://localhost/api/pro-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword }),
  });
}

describe("professional public access route", () => {
  it("rejects an invalid keyword without setting access", async () => {
    process.env.PROFESSIONAL_ACCESS_KEY = "secret";
    process.env.JWT_SECRET = "test-secret";

    const response = await POST(postRequest("wrong"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Palavra‑chave inválida" });
  });

  it("sets an http-only access cookie for the deployed professional role", async () => {
    process.env.PROFESSIONAL_ACCESS_KEY = "secret";
    process.env.JWT_SECRET = "test-secret";

    const response = await POST(postRequest("secret"));
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain("pro_access=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("rejects missing professional access cookies", async () => {
    process.env.JWT_SECRET = "test-secret";

    const response = await GET(
      new NextRequest("http://localhost/api/pro-access"),
    );

    expect(response.status).toBe(401);
  });
});
