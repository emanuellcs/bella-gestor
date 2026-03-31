// services/api-public.ts
import type { Client, Service, Professional } from "@/types";

export async function getActiveClients(): Promise<Client[]> {
  const r = await fetch("/api/admin/clients/active", {
    credentials: "include",
  });
  if (!r.ok) throw new Error("Falha ao carregar clientes");
  const rows = await r.json();
  // Minimum domain mapping if required
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
  const r = await fetch("/api/admin/services/active", {
    credentials: "include",
  });
  if (!r.ok) throw new Error("Falha ao carregar serviços");
  const rows = await r.json();
  return rows.map((s: any) => ({
    id: String(s.id),
    name: s.name,
    description: s.description ?? undefined,
    category: s.category ?? "",
    active: !!s.is_active,
    created_at: s.created_at,
    variants: (s.service_variants ?? []).map((v: any) => ({
      id: String(v.id),
      serviceId: String(v.service_id),
      variantName: v.variant_name,
      price: Number(v.price),
      duration: v.duration_minutes,
      active: !!v.is_active,
      created_at: v.created_at,
    })),
  })) as Service[];
}

export async function getProfessionals(): Promise<Professional[]> {
  const r = await fetch("/api/admin/professionals/active", {
    credentials: "include",
  });
  if (!r.ok) throw new Error("Falha ao carregar profissionais");
  return (await r.json()) as Professional[];
}

export const getServices = getActiveServices;

// The public scheduling page only deals with active clients,
// but the DataProvider calls getInactiveClients unconditionally.
// Returning an empty array prevents silent failures.
export async function getInactiveClients(): Promise<Client[]> {
  return [];
}

// service variants are embedded inside each service object from
// getActiveServices(), so a flat list isn't needed here.
import type { ServiceVariant, Appointment, Sale, Payment } from "@/types";
export async function getServiceVariants(): Promise<ServiceVariant[]> {
  return [];
}

// The DataProvider also calls these — stub them out.
export async function getAppointments(): Promise<Appointment[]> {
  return [];
}

export async function getSales(): Promise<Sale[]> {
  return [];
}

export async function getPayments(): Promise<Payment[]> {
  return [];
}
