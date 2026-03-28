/**
 * Supabase Edge Function: /functions/v1/chat
 *
 * Secure proxy for Claude API calls. The ANTHROPIC_API_KEY lives here in the
 * Deno runtime — it is never shipped inside the mobile app bundle.
 *
 * Deploy:
 *   supabase functions deploy chat --no-verify-jwt
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * The function:
 *  1. Validates the caller's Supabase JWT (user must be logged in).
 *  2. Accepts { systemPrompt, messages } in the request body.
 *  3. Streams the Anthropic response back verbatim (SSE).
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_TOKENS = 1024
const MODEL = 'claude-sonnet-4-20250514'

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Authenticate the caller ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Parse and validate request body ─────────────────────────────────────────
  let body: { systemPrompt?: string; messages?: Array<{ role: string; content: string }> }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { systemPrompt, messages } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array is required' }, 400)
  }

  // Sanitise: cap conversation length and message size
  const safeMessages = messages
    .slice(-30) // max 30 turns
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content).slice(0, 4000), // cap each message at 4000 chars
    }))

  // ── Call Anthropic ───────────────────────────────────────────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    console.error('ANTHROPIC_API_KEY secret is not set on this function')
    return json({ error: 'AI service not configured' }, 500)
  }

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: systemPrompt ?? '',
      messages: safeMessages,
    }),
  })

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text()
    console.error('Anthropic error:', errText)
    // Do NOT forward raw Anthropic errors to the client — they may contain key info
    return json({ error: 'AI request failed. Please try again.' }, 502)
  }

  // ── Stream response back to the client ──────────────────────────────────────
  return new Response(anthropicResp.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
