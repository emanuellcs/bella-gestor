import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import { AppRole } from "@/types";
import { canAccessRoute, defaultRouteForRole } from "@/lib/rbac";

const mocks = vi.hoisted(() => ({
  pathname: "/agenda",
  push: vi.fn(),
  logout: vi.fn(),
  role: "Admin",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "User",
      email: "user@example.com",
      role: mocks.role,
    },
    logout: mocks.logout,
  }),
}));

describe("RBAC", () => {
  beforeEach(() => {
    mocks.role = AppRole.ADMIN;
    mocks.pathname = "/agenda";
    mocks.push.mockReset();
    mocks.logout.mockReset();
  });

  it("allows only the deployed role matrix for protected routes", () => {
    expect(canAccessRoute(AppRole.ADMIN, "/financeiro")).toBe(true);
    expect(canAccessRoute(AppRole.SECRETARY, "/financeiro")).toBe(false);
    expect(canAccessRoute(AppRole.PROFESSIONAL, "/financeiro")).toBe(false);
    expect(canAccessRoute(AppRole.PROFESSIONAL, "/agenda")).toBe(true);
    expect(canAccessRoute(AppRole.PROFESSIONAL, "/clientes/10")).toBe(true);
    expect(canAccessRoute(undefined, "/agenda")).toBe(false);
  });

  it("uses agenda as the landing page for secretary and professional users", () => {
    expect(defaultRouteForRole(AppRole.ADMIN)).toBe("/dashboard");
    expect(defaultRouteForRole(AppRole.SECRETARY)).toBe("/agenda");
    expect(defaultRouteForRole(AppRole.PROFESSIONAL)).toBe("/agenda");
  });

  it("hides forbidden navigation entries for professional users", () => {
    mocks.role = AppRole.PROFESSIONAL;

    render(
      <AppShell>
        <div>Conteudo</div>
      </AppShell>,
    );

    expect(screen.getAllByText("Agenda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clientes").length).toBeGreaterThan(0);
    expect(screen.queryByText("Financeiro")).not.toBeInTheDocument();
    expect(screen.queryByText("Relatórios")).not.toBeInTheDocument();
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });
});
