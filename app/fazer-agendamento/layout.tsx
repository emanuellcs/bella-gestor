// app/fazer-agendamento/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { DataProvider } from "@/lib/data-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function PublicAgendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, logout } = useAuth();
  const [checking, setChecking] = useState(true);
  const [granted, setGranted] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If logged in via dashboard, log out to avoid session conflicts,
    // then proceed to check the keyword cookie.
    if (isAuthenticated) {
      logout().then(() => {
        checkKeywordAccess();
      });
      return;
    }

    checkKeywordAccess();

    function checkKeywordAccess() {
      // Attempts to check for existing cookie for non-logged in users
      fetch("/api/pro-access", { method: "GET", credentials: "include" })
        .then((r) => (r.ok ? setGranted(true) : setGranted(false)))
        .catch(() => setGranted(false))
        .finally(() => setChecking(false));
    }
  }, [isAuthenticated, logout]);

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const resp = await fetch("/api/pro-access", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    if (resp.ok) {
      setGranted(true);
    } else {
      const j = await resp.json().catch(() => ({}));
      setError(j?.error ?? "Palavra‑chave inválida");
    }
  }

  if (checking) return null;

  if (!granted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <form onSubmit={handleEnter} className="w-full max-w-sm space-y-3">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold">Acesso de Profissionais</h1>
            <p className="text-sm text-muted-foreground">
              Informe a palavra‑chave
            </p>
          </div>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Palavra‑chave"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    );
  }

  // 'public' mode: DataProvider bypasses login and uses the public API (server-side service role)
  return (
    <div className="min-h-screen">
      <DataProvider mode="public" skip={!granted}>
        {children}
      </DataProvider>
    </div>
  );
}
