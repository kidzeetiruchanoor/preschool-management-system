import { useState } from 'react'
import { supabase } from '../lib/supabase'
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
    />
  )
}
