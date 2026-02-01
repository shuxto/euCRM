import { createClient } from '@supabase/supabase-js';

// 1. Load variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Validate them immediately
if (!supabaseUrl || !supabaseKey) {
  throw new Error('MISSING SUPABASE KEYS: Check your .env file');
}

// 3. Create Client with HIGH SECURITY configuration
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // This setting ensures the session dies when the browser/tab is closed
    storage: sessionStorage, 
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});