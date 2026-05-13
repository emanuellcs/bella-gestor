// services/api-public.ts
import type { Client, Service, Professional, ServiceVariant, Appointment, Sale, Payment } from "@/types";

interface PublicClientRow {
  id: number | string;
  full_name: string;
  email?: string | null;
  phone: string;
  created_at: string;
  is_active: boolean;
}

interface PublicServiceVariantRow {
  id: number | string;
  service_id: number | string;
  variant_name: string;
  price: number | string;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  deleted_at?: string | null;
}

interface PublicServiceRow {
  id: number | string;
  name: string;
  description?: string | null;
  category?: string | null;
  is_active: boolean;
  created_at: string;
  service_variants?: PublicServiceVariantRow[];
}

interface PublicProfessionalRow {
  id: string;
  email?: string;
  fullName?: string;
  functionTitle?: string;
  role: Professional["role"];
}

async function readJsonArray<T>(response: Response): Promise<T[]> {
  const json = (await response.json()) as unknown;
  return Array.isArray(json) ? (json as T[]) : [];
}

export async function getActiveClients(): Promise<Client[]> {
  const r = await fetch("/api/admin/clients/active", {
    credentials: "include",
  });
  if (!r.ok) throw new Error("Falha ao carregar clientes");
  const rows = await readJsonArray<PublicClientRow>(r);
  // Minimum domain mapping if required
  return rows.map((c) => ({
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
  const rows = await readJsonArray<PublicServiceRow>(r);
  return rows.map((s) => ({
    id: String(s.id),
    name: s.name,
    description: s.description ?? undefined,
    category: s.category ?? "",
    active: !!s.is_active,
    created_at: s.created_at,
    variants: (s.service_variants ?? [])
      .filter((v) => !v.deleted_at)
      .map((v) => ({
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
  const rows = await readJsonArray<PublicProfessionalRow>(r);
  return rows.map((row) => ({
    id: row.id,
    name: row.fullName || row.email || "Profissional",
    email: row.email,
    functionTitle: row.functionTitle,
    role: row.role,
    created_at: "",
  }));
}

export const getServices = getActiveServices;

// The public scheduling page only deals with active clients,
// but the DataProvider calls getInactiveClients unconditionally.
// Returning an empty array prevents silent failures.
export async function getInactiveClients(): Promise<Client[]> {
  return [];
}

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
