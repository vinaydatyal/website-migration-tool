import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
}) : null;

export const verifyAuth = async (req, res, next) => {
  // Allow bypassing auth in local dev if no Supabase URL/Key is set
  if (!supabase) {
    console.warn('WARNING: Supabase credentials not set, bypassing auth check.');
    return next();
  }

  let token = req.query.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization token' });
  }

  try {
    // Validate token using Supabase Auth directly (supports both HS256 and ECC keys natively)
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw error || new Error('User not found');
    }
    
    req.user = { sub: user.id }; // Normalize to match the decoded JWT format expected downstream
    next();
  } catch (error) {
    console.error('Auth Verification Error:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
