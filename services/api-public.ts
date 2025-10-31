// services/api-public.ts
import type { Client, Service, Professional } from "@/lib/types";

export async function getActiveClients(): Promise<Client[]> {
  const r = await fetch("/api/admin/clients/active", { credentials: "include" });
  if (!r.ok) throw new Error("Falha ao carregar clientes");
  const rows = await r.json();
  // mapeamento mínimo para o domínio, se necessário
  return rows.map((c: any) => ({
    id: String(c.id),
    name: c.full_name,
    email: c.email ?? undefined,
    phone: c.phone,
    registrationDate: c.created_at,
    status: c.is_active ? "active" : "inactive",
    totalSpent: 0,
  })) as Client[];
}

export async function getActiveServices(): Promise<Service[]> {
  const r = await fetch("/api/admin/services/active", { credentials: "include" });
  if (!r.ok) throw new Error("Falha ao carregar serviços");
  const rows = await r.json();
  return rows.map((s: any) => ({
    id: String(s.id),
    name: s.name,
    description: s.description ?? undefined,
    category: s.category ?? "",
    active: !!s.is_active,
    createdAt: s.created_at,
    variants: (s.service_variants ?? []).map((v: any) => ({
      id: String(v.id),
      serviceId: String(v.service_id),
      variantName: v.variant_name,
      price: Number(v.price),
      duration: v.duration_minutes,
      active: !!v.is_active,
      createdAt: v.created_at,
    })),
  })) as Service[];
}

export async function getProfessionals(): Promise<Professional[]> {
  const r = await fetch("/api/admin/professionals/active", { credentials: "include" });
  if (!r.ok) throw new Error("Falha ao carregar profissionais");
  return (await r.json()) as Professional[];
}
