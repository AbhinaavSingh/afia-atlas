import { createClient } from '@supabase/supabase-js'

// In test mode (Playwright e2e) always run in demo mode, even when real
// credentials exist in .env.local for local development against production.
const isTestMode = import.meta.env.MODE === 'test'

const supabaseUrl = isTestMode
  ? undefined
  : (import.meta.env.VITE_SUPABASE_URL as string | undefined)
const supabaseAnonKey = isTestMode
  ? undefined
  : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const functionsUrl = supabaseUrl
  ? `${supabaseUrl}/functions/v1`
  : undefined

export const approvedStorageUrl = supabaseUrl
  ? `${supabaseUrl}/storage/v1/object/public/approved-memories`
  : undefined
