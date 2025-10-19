import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Client, SupabaseClient } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function supabaseClientToClient(supabaseClient: SupabaseClient): Client {
  return {
    id: supabaseClient.id.toString(),
    name: supabaseClient.full_name,
    email: supabaseClient.email || '',
    phone: supabaseClient.phone,
    birthDate: supabaseClient.birth_date || undefined,
    serviceLocation: supabaseClient.service_location || undefined,
    preferredSchedule: supabaseClient.preferred_schedule || undefined,
    referralSource: supabaseClient.referral_source || undefined,
    marketingConsent: supabaseClient.marketing_consent,
    isClient: supabaseClient.is_client,
    registrationDate: supabaseClient.created_at,
    lastVisit: supabaseClient.updated_at || undefined,
    status: supabaseClient.is_active ? 'active' : 'inactive',
    totalSpent: 0,
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
  if (client.referralSource !== undefined) data.referral_source = client.referralSource || null
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

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
