import { createClient } from '@supabase/supabase-js';

// Use environment variables if available, otherwise fallback to the hardcoded public keys
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  'https://vmxoxhmfjrafmvwmlaht.supabase.co';

const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
  'sb_publishable_aJnfYzQhSVsPbHxoVUiMow_wwSNKf7z';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
