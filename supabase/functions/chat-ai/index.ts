import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- THE BRAIN: YOUR CUSTOM TRAINING INSTRUCTIONS ---
const SYSTEM_PROMPT = `
ROLE: You are an elite CRM Financial Support Assistant. 
You are strictly designed to assist staff with banking, trading, crypto, and client handling.

YOUR KNOWLEDGE BASE:
1. BANKING: Deep knowledge of bank systems, SWIFT/SEPA, wire transfers, and credit card processing.
2. CRYPTO WALLETS: You know about website-based wallets, hardware wallets, and how to set them up safely.
3. ON-RAMPS: You recommend reputable sites for exchanging Fiat (USD/EUR) to Crypto (BTC/USDT) (e.g., MoonPay, Banxa, Kraken, Coinbase).
4. TRANSFERS: You guide users on how to explain Wire Transfers, Crypto Deposits, and Card transactions to clients.
5. KYC (Know Your Customer): You understand verification documents (Passport, Utility Bills, Liveness checks) and why they are needed.
6. TRADING PLATFORMS: You explain how leverage, margin, spreads, and order types (Buy/Sell/Limit) work.
7. CLIENT NEGOTIATION: If the user provides a client quote, you suggest the best professional psychological response or technical solution.
8. EXCHANGE: You understand currency conversion (USD<>EUR) and Crypto conversion (BTC<>USD).

STRICT RULES:
- You DO NOT answer questions about history, feelings, recipes, coding, or general life advice.
- If asked a "stupid" or unrelated question (e.g., "When was WWII?", "Are you happy?"), you MUST reply EXACTLY:
  "I am designed to help you with Trading and CRM operations only."
- Keep answers professional, concise, and focused on closing deals or solving technical payment issues.
`;

interface ChatPart {
  text: string;
}

interface ChatMessage {
  role: string;
  parts: ChatPart[];
}

interface DbMessage {
  role: string;
  content: string;
}

async function callGoogleAI(model: string, version: string, apiKey: string, chatHistory: ChatMessage[]) {
  // Fix model name format
  const cleanModelName = model.replace('models/', '');
  const url = `https://generativelanguage.googleapis.com/${version}/models/${cleanModelName}:generateContent?key=${apiKey}`;
  
  console.log(`Attempting to connect to: ${cleanModelName} (${version})...`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: chatHistory })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch History
    const { data: history } = await supabaseClient
      .from('ai_messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10); // Keep context short but relevant

    // Convert DB History to AI Format
    const chatHistory: ChatMessage[] = history ? history.reverse().map((msg: DbMessage) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    })) : [];

    // --- CRITICAL STEP: INJECT THE "BRAIN" (SYSTEM PROMPT) ---
    // We add this as the very first message so the AI knows who it is.
    chatHistory.unshift({
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }]
    });

    // Add the AI acknowledgment to keep the conversation flow natural
    chatHistory.splice(1, 0, {
        role: 'model',
        parts: [{ text: "Understood. I am ready to assist with Banking, Crypto, and Trading inquiries." }]
    });

    // Ensure the new User message is at the end
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.parts[0].text !== message) {
         chatHistory.push({ role: 'user', parts: [{ text: message }] });
    }

    let reply = "";

    // SMART FALLBACK SYSTEM
    try {
        reply = await callGoogleAI('gemini-2.5-flash', 'v1beta', apiKey, chatHistory);
    } catch (err1) {
        console.warn("Gemini 2.5 Flash failed. Trying fallback...", err1);
        try {
            reply = await callGoogleAI('gemini-2.0-flash', 'v1beta', apiKey, chatHistory);
        } catch (err2) {
            console.warn("Gemini 2.0 Flash failed. Trying generic latest...", err2);
            try {
                 reply = await callGoogleAI('gemini-flash-latest', 'v1beta', apiKey, chatHistory);
            } catch (err3) {
                 console.error("ALL MODELS FAILED.", err3);
                 throw new Error("Could not connect to AI. Please try again later.");
            }
        }
    }

    if (!reply) reply = "I'm connected, but I couldn't generate a response.";

    await supabaseClient.from('ai_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: reply
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Backend Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
});