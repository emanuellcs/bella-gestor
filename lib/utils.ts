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
        status: supabaseClient.is_active ? 'active' : 'inactive',
        totalSpent: 0, 
        notes: supabaseClient.notes || undefined,
        services: supabaseClient.services || undefined,
    }
}

export function clientToSupabaseClient(
    client: Partial<Client>
): Partial<Omit<SupabaseClient, 'id' | 'created_at' | 'version'>> {
    return {
        full_name: client.name,
        email: client.email || null,
        phone: client.phone || '',
        notes: client.notes || null,
        services: client.services || null,
        is_active: client.status === 'active',
        birth_date: client.birthDate || null,
        service_location: client.serviceLocation || null,
        preferred_schedule: client.preferredSchedule || null,
        referral_source: client.referralSource || null,
        marketing_consent: client.marketingConsent || false,
        is_client: client.isClient || false,
    }
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
