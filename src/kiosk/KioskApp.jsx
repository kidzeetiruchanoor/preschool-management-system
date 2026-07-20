import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../lib/styles'
import KioskWelcome from './KioskWelcome'
import KioskAttendance from './KioskAttendance'

// ── Establish the kiosk's Supabase session ──────────────────────
// Calls the serverless function which holds the real kiosk password
// server-side, gets back short-lived tokens, and applies them to this
// browser's Supabase client. The password itself never touches the
// browser at any point — only the resulting session tokens do.
async function establishKioskSession() {
  const res = await fetch('/api/kiosk-session', { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Could not start attendance session')
  }
  const { access_token, refresh_token } = await res.json()
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw error
}

export default function KioskApp() {
  const [screen, setScreen] = useState('welcome') // welcome | connecting | attendance | error
  const [error, setError] = useState('')

  // On mount, check whether we already have a live kiosk session
  // (e.g. tablet was just rebooted but had one from earlier today —
  // Supabase persists sessions to localStorage by default, so a
  // reboot doesn't necessarily mean re-authenticating from scratch).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // We don't auto-jump into attendance mode just because *some*
      // session exists — it could be a leftover admin session from
      // someone using "Admin Login" on this same device earlier.
      // We only trust it if it's the kiosk account specifically.
      // (Distinguishing that cleanly needs the kiosk_accounts check,
      // which happens naturally the first time a DB call is made —
      // for the welcome screen we simply always start at "welcome"
      // and let the explicit button press establish a fresh, known
      // kiosk session. Simpler and safer than trying to infer intent
      // from whatever session happens to be sitting in localStorage.)
    })
  }, [])

  const handleStaffAttendance = async () => {
    setScreen('connecting')
    setError('')
    try {
      await establishKioskSession()
      setScreen('attendance')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Something went wrong. Please try again.')
      setScreen('error')
    }
  }

  const handleAdminLogin = () => {
    // Admin login reuses the existing, unmodified login flow — this
    // just navigates to the normal app root, outside kiosk mode.
    window.location.href = '/'
  }

  const backToWelcome = () => {
    setScreen('welcome')
  }

  if (screen === 'attendance') {
    return <KioskAttendance onExit={backToWelcome} />
  }

  return (
    <KioskWelcome
      connecting={screen === 'connecting'}
      error={screen === 'error' ? error : ''}
      onStaffAttendance={handleStaffAttendance}
      onAdminLogin={handleAdminLogin}
    />
  )
}
