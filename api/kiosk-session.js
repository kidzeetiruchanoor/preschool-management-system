// Vercel Serverless Function — /api/kiosk-session
//
// Called when a teacher taps "Staff Attendance" on the kiosk welcome
// screen. Logs into Supabase as the dedicated kiosk account using
// credentials that live ONLY in server-side environment variables
// (no VITE_ prefix — never bundled into the browser). Returns just
// the resulting session tokens to the browser, which the kiosk page
// then uses for all subsequent Supabase calls (reading face profiles,
// inserting/updating attendance) — all still governed by the RLS
// policies from Phase 1, which already restrict this account tightly.
//
// The real kiosk password never reaches the browser at any point.

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const kioskEmail = process.env.KIOSK_ACCOUNT_EMAIL
  const kioskPassword = process.env.KIOSK_ACCOUNT_PASSWORD
  // Use the anon key here (not service role) — we're performing a normal
  // password sign-in, exactly like the browser would, just from the server.
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !kioskEmail || !kioskPassword || !supabaseAnonKey) {
    console.error('Missing required env vars for kiosk session')
    return res.status(500).json({ error: 'Kiosk is not configured correctly. Contact admin.' })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: kioskEmail,
    password: kioskPassword,
  })

  if (error) {
    console.error('Kiosk sign-in failed:', error.message)
    return res.status(500).json({ error: 'Could not start attendance session. Contact admin.' })
  }

  // Return only what the browser needs to establish its own Supabase
  // session — the password itself was never sent to or from the browser.
  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
