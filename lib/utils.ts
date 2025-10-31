import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Client, SupabaseClient } from './types'

export const SAO_TZ = 'America/Sao_Paulo';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function supabaseClientToClient(supabaseClient: SupabaseClient & { total_spent?: number }): Client {
  return {
    id: supabaseClient.id.toString(),
    name: supabaseClient.full_name,
    email: supabaseClient.email || '',
    phone: supabaseClient.phone,
    birthDate: supabaseClient.birth_date || undefined,
    serviceLocation: supabaseClient.service_location || undefined,
    preferredSchedule: supabaseClient.preferred_schedule || undefined,
    referral_source: supabaseClient.referral_source || undefined,
    marketingConsent: supabaseClient.marketing_consent,
    isClient: supabaseClient.is_client,
    registrationDate: supabaseClient.created_at,
    lastVisit: supabaseClient.updated_at || undefined,
    status: supabaseClient.is_active ? 'active' : 'inactive',
    totalSpent: supabaseClient.total_spent || 0,
    notes: supabaseClient.notes || undefined,
    services: supabaseClient.services || undefined,
  }
}

export function clientToSupabaseClient(
  client: Partial<Client>
): Partial<Omit<SupabaseClient, 'id' | 'created_at'>> {
  const data: Partial<Omit<SupabaseClient, 'id' | 'created_at'>> = {}
  
  if (client.name !== undefined) data.full_name = client.name
  if (client.email !== undefined) data.email = client.email || null
  if (client.phone !== undefined) data.phone = client.phone
  if (client.notes !== undefined) data.notes = client.notes || null
  if (client.services !== undefined) data.services = client.services || null
  if (client.status !== undefined) data.is_active = client.status === 'active'
  if (client.birthDate !== undefined) data.birth_date = client.birthDate || null
  if (client.serviceLocation !== undefined) data.service_location = client.serviceLocation || null
  if (client.preferredSchedule !== undefined) data.preferred_schedule = client.preferredSchedule || null
  if (client.referral_source !== undefined) data.referral_source = client.referral_source || null
  if (client.marketingConsent !== undefined) data.marketing_consent = client.marketingConsent
  if (client.isClient !== undefined) data.is_client = client.isClient

  return data
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// utils.ts

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "";

  // 1) Se for Date, apenas formata em pt-BR no fuso de SP
  if (input instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(input);
  }

  // 2) YYYY-MM-DD (date-only do Postgres/Supabase)
  const mDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (mDateOnly) {
    const [, y, mo, d] = mDateOnly;
    return `${d}/${mo}/${y}`;
  }

  // 3) YYYY-MM-DDTHH:mm (datetime-local sem timezone, ex: vindo de input[type="datetime-local"])
  const mLocal = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  const hasExplicitTZ = /Z|[+-]\d{2}:\d{2}$/.test(input);
  if (mLocal && !hasExplicitTZ) {
    const [, y, mo, d] = mLocal;
    // Para formatDate, mostramos apenas a data
    return `${d}/${mo}/${y}`;
  }

  // 4) ISO com timezone (ou qualquer outra coisa): usar Date + fuso de SP
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(input));
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "";

  // 1) Se for Date, formata direto no fuso de SP
  if (input instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(input);
  }

  // 2) YYYY-MM-DD (date-only): manter a data e definir 00:00
  const mDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (mDateOnly) {
    const [, y, mo, d] = mDateOnly;
    return `${d}/${mo}/${y} 00:00`;
  }

  // 3) YYYY-MM-DDTHH:mm (datetime-local sem timezone): tratar como horário local de SP
  const mLocal = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  const hasExplicitTZ = /Z|[+-]\d{2}:\d{2}$/.test(input);
  if (mLocal && !hasExplicitTZ) {
    const [, y, mo, d, hh, mm] = mLocal;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }

  // 4) ISO com timezone: usar Date + fuso de SP
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}


// Para preencher <input type="datetime-local">
export function zonedNowForInput(tz = SAO_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
   .reduce((a: any, p) => (a[p.type] = p.value, a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Formata telefone brasileiro: (11) 99999-9999 ou (11) 9999-9999
export function formatBrazilianPhone(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length === 0) return '';
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

// Remove formatação do telefone e retorna apenas números sem +55
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11); // máximo 11 dígitos (DDD + número)
}

// Formata CEP brasileiro: 00000-000
export function formatCEP(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length === 0) return '';
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}

// Remove formatação do CEP
export function unformatCEP(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

// Formata o telefone no padrão InfinitePay (+5511999887766)
export function formatPhoneForInfinitePay(value: string): string {
  const numbers = unformatPhone(value);
  if (numbers.length < 10) return ''; // inválido
  return `+55${numbers}`; // sempre adiciona +55
}
