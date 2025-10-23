// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
  adminClient = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (u, opts: any = {}) => fetch(u, { ...opts, cache: "no-store" }) },
  })
  return adminClient
}
