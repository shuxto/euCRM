// supabase/functions/update-user/index.ts

import { serve } from "std/http/server.ts"
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Define the shape of our expected input
interface UpdatePayload {
  target_id: string;
  updates: {
    full_name?: string;
    password?: string;
    role?: string;
    avatar_url?: string; // <--- NEW: Added this
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Verify Caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !caller) throw new Error('Unauthorized: Invalid Token')
    
    const { data: callerData } = await supabaseAdmin
      .from('crm_users')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    // 2. Get Updates (Typed) -- MOVED UP to support Self-Service check
    const { target_id, updates } = await req.json() as UpdatePayload

    const effectiveRole = callerData?.role || caller.user_metadata.role
    const isSelfUpdate = caller.id === target_id; // <--- NEW: Check if updating own profile

    // MODIFIED PERMISSION CHECK: Allow Admins/Managers OR Self-Update
    if (!['admin', 'manager'].includes(effectiveRole) && !isSelfUpdate) {
        throw new Error('Permission denied: You can only edit your own profile.')
    }

    // 3. Prepare Updates (Using Record instead of 'any' to satisfy linter)
    const authUpdates: Record<string, unknown> = {}
    const metaUpdates: Record<string, unknown> = {}

    // FIX 1: Typo removed (ZVupdates -> updates)
    if (updates.password && updates.password.length >= 6) {
        authUpdates.password = updates.password;
    }

    if (updates.full_name) {
        // We need to cast the existing metadata safely or build a new object
        authUpdates.user_metadata = { full_name: updates.full_name }; 
        // Note: Ideally merge with existing, but for this specific flow we usually overwrite or just add
        metaUpdates.real_name = updates.full_name;
    }
    
    // MODIFIED ROLE CHECK: Only Admins/Managers can change roles
    if (updates.role && ['admin', 'manager'].includes(effectiveRole)) {
        // Merge role into metadata if needed, or just set it
        const currentMeta = (authUpdates.user_metadata as Record<string, unknown>) || {};
        authUpdates.user_metadata = { ...currentMeta, role: updates.role };
        metaUpdates.role = updates.role;
    }

    // --- NEW: HANDLE AVATAR ---
    if (updates.avatar_url) {
        // Save to Metadata (optional, but good for auth session)
        const currentMeta = (authUpdates.user_metadata as Record<string, unknown>) || {};
        authUpdates.user_metadata = { ...currentMeta, avatar_url: updates.avatar_url };
        
        // Save to Public Table (Critical for UI)
        metaUpdates.avatar_url = updates.avatar_url;
    }

    // 4. Update Auth User
    if (Object.keys(authUpdates).length > 0) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target_id, authUpdates)
        if (updateError) throw updateError
    }

    // 5. Update Public Tables
    if (Object.keys(metaUpdates).length > 0) {
        await supabaseAdmin.from('crm_users').update(metaUpdates).eq('id', target_id)
        await supabaseAdmin.from('profiles').update(metaUpdates).eq('id', target_id)
    }

    return new Response(
        JSON.stringify({ message: "User updated successfully" }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (err: unknown) {
    // FIX 2: Handle unknown type error safely
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    
    return new Response(
        JSON.stringify({ error: errorMessage }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})