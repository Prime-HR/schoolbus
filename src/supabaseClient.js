import { createClient } from '@supabase/supabase-js'

// IMPORTANT: Replace these with your actual Supabase project URL and anon key!
// You can find them in your Supabase Dashboard under Settings > API.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
