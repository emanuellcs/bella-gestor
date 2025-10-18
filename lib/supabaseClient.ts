import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Client {
    id: number
    full_name: string
    phone: string
    email: string | null
    services: string | null
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at?: string
    version?: number
    user_id?: string
    idempotency_key?: string
}