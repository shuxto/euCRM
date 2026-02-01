// 1. USE CLEAN IMPORTS (Matches your new deno.json)
import { serve } from "std/http/server.ts"
import { createClient } from "@supabase/supabase-js"

// 2. SETUP CORS HEADERS (Allows your website to talk to this function)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle the "Pre-flight" check (Browser security check)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 3. Create the Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Get Data
    const { email, password, real_name, role } = await req.json()

    // 5. Create User
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: real_name,
        role: role
      }
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ message: "User created successfully", user: data.user }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    )

  } catch (err: unknown) {
    let errorMessage = 'An unknown error occurred';
    
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    )
  }
})