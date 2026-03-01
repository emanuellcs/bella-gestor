import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Creates or retrieves a server-side Supabase client with SERVICE_ROLE privileges.
 * This client bypasses Row Level Security (RLS) and should NEVER be exposed to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";

  adminClient = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (u, opts: any = {}) => fetch(u, { ...opts, cache: "no-store" }),
    },
  });

  return adminClient;
}
