// lib/rbac.ts
import { AppRole } from "@/types";

// Each entry maps a route segment to the roles that may access it.
// Think of this as "what roles are ALLOWED", not "what roles are blocked".
export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  dashboard: [AppRole.ADMIN, AppRole.SECRETARY],
  agenda: [AppRole.ADMIN, AppRole.SECRETARY, AppRole.PROFESSIONAL],
  clientes: [AppRole.ADMIN, AppRole.SECRETARY, AppRole.PROFESSIONAL],
  financeiro: [AppRole.ADMIN], // Secretary blocked as per requirements
  servicos: [AppRole.ADMIN], // Secretary usually doesn't manage services, but let's re-read requirements
  profissionais: [AppRole.ADMIN],
  relatorios: [AppRole.ADMIN], // Secretary blocked as per requirements
  configuracoes: [AppRole.ADMIN], // Secretary blocked as per requirements
  "fazer-agendamento": [AppRole.ADMIN, AppRole.SECRETARY], // Professional blocked
};

/**
 * Requirements check:
 * Secretary MUST BE BLOCKED FROM: /financeiro, /relatorios, /dashboard, and /configuracoes.
 * Wait, the user said Secretary is blocked from /dashboard too?
 * "Secretary: MUST BE BLOCKED FROM: /financeiro, /relatorios, /dashboard, and /configuracoes."
 * Okay, updating ROUTE_PERMISSIONS.
 *
 * Professional: ALLOWED ONLY: /agenda and viewing client details.
 * MUST BE BLOCKED FROM: /fazer-agendamento, /financeiro, /relatorios, /dashboard, /profissionais, /servicos, /configuracoes.
 */

export const ROUTE_PERMISSIONS_STRICT: Record<string, AppRole[]> = {
  dashboard: [AppRole.ADMIN],
  agenda: [AppRole.ADMIN, AppRole.SECRETARY, AppRole.PROFESSIONAL],
  clientes: [AppRole.ADMIN, AppRole.SECRETARY, AppRole.PROFESSIONAL],
  financeiro: [AppRole.ADMIN],
  servicos: [AppRole.ADMIN, AppRole.SECRETARY], // User didn't explicitly block Secretary from services, but blocking Prof.
  profissionais: [AppRole.ADMIN],
  relatorios: [AppRole.ADMIN],
  configuracoes: [AppRole.ADMIN],
  "fazer-agendamento": [AppRole.ADMIN, AppRole.SECRETARY],
};

/**
 * Returns true if the given role is allowed to visit the route segment.
 * Route segment should be the folder name, e.g. "financeiro", "agenda".
 */
export function canAccessRoute(
  role: AppRole | undefined,
  routeSegment: string,
): boolean {
  if (!role) return false;

  // Normalize route segment (remove leading slash if any)
  const segment = routeSegment.startsWith("/")
    ? routeSegment.substring(1)
    : routeSegment;
  const baseSegment = segment.split("/")[0];

  const allowed = ROUTE_PERMISSIONS_STRICT[baseSegment];
  if (!allowed) return true; // unknown routes are not restricted by default
  return allowed.includes(role);
}

/** Convenience: returns the default landing page for a given role. */
export function defaultRouteForRole(role: AppRole): string {
  if (role === AppRole.PROFESSIONAL) return "/agenda";
  if (role === AppRole.SECRETARY) return "/agenda"; // Since dashboard is blocked
  return "/dashboard";
}
