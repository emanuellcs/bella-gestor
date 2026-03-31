"use client";

import type React from "react";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { canAccessRoute, defaultRouteForRole } from "@/lib/rbac";

export default function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }

    if (user && !canAccessRoute(user.role, "financeiro")) {
      router.push(defaultRouteForRole(user.role));
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || (user && !canAccessRoute(user.role, "financeiro"))) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
