import { createClient } from '@supabase/supabase-js';

// Use environment variables if available, otherwise fallback to the hardcoded public keys
const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
const procEnv = typeof process !== 'undefined' ? (process as any).env : undefined;

const supabaseUrl = metaEnv?.VITE_SUPABASE_URL || 
  procEnv?.VITE_SUPABASE_URL || 
  'https://vmxoxhmfjrafmvwmlaht.supabase.co';

const supabaseAnonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || 
  procEnv?.VITE_SUPABASE_ANON_KEY || 
  'sb_publishable_aJnfYzQhSVsPbHxoVUiMow_wwSNKf7z';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
