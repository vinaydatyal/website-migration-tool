import { createClient } from '@supabase/supabase-js';

// Use environment variables if available, otherwise fallback to the hardcoded public keys
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vmxoxhmfjrafmvwmlaht.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aJnfYzQhSVsPbHxoVUiMow_wwSNKf7z';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
