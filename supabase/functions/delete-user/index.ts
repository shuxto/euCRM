// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Setup Admin Client
    // We check for BOTH standard names AND your custom "MY_" names to be safe.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('MY_SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('MY_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // 2. Security Check (Manual)
    const authHeader = req.headers.get('Authorization')!
    if (!authHeader) throw new Error('Missing Authorization Header')
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) throw new Error('Invalid Token')
    
    // Only allow Admin/Manager
    const role = caller.user_metadata.role || 'user'
    if (!['admin', 'manager'].includes(role)) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders })
    }

    // 3. Get User ID to Delete
    const { user_id } = await req.json()
    if (!user_id) throw new Error('No User ID provided')

    // 4. DELETE EVERYTHING
    const tables = ['trades', 'transactions', 'trading_accounts', 'crm_lead_notes', 'crm_call_logs', 'crm_notifications', 'crm_users', 'profiles']
    
    for (const table of tables) {
        await supabaseAdmin.from(table).delete().eq('user_id', user_id)
        await supabaseAdmin.from(table).delete().eq('id', user_id)
    }

    // 5. Final Kill (Auth User)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (deleteError) throw deleteError

    return new Response(
      JSON.stringify({ message: "Deleted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})