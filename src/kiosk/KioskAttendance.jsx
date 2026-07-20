import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DB } from '../lib/db'
import { C } from '../lib/styles'

// ── PHASE 4a PLACEHOLDER ──────────────────────────────────────────
// This is intentionally minimal — it exists to prove the kiosk
// session actually works end-to-end (auth + a real RLS-governed
// database read) before Phase 4b replaces this with the full
// camera-based check-in/check-out screen.
//
// What it proves if this works correctly:
//   1. The serverless function successfully logged in as the kiosk
//      account and returned valid tokens
//   2. This browser session is now authenticated AS the kiosk account
//   3. That account can read teacher_face_profiles (per Phase 1 RLS)
//   4. That account CANNOT read students (per Phase 1 RLS) — the
//      negative test below is just as important as the positive one
export default function KioskAttendance({ onExit }) {
  const [status, setStatus] = useState('Checking kiosk session...')
  const [profileCount, setProfileCount] = useState(null)
  const [studentsBlocked, setStudentsBlocked] = useState(null)

  useEffect(() => {
    async function runChecks() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('❌ No active session — something went wrong.')
        return
      }
      setStatus(`✓ Logged in as kiosk account (${user.email})`)

      // Positive test: kiosk SHOULD be able to read face profiles
      const profiles = await DB.loadAllFaceProfilesForKiosk()
      setProfileCount(profiles.length)

      // Negative test: kiosk should NOT be able to read students —
      // if this returns rows, the RLS lockdown from Phase 1 isn't
      // actually working and needs to be re-checked before Phase 4b.
      const { data: studentRows, error: studentError } = await supabase
        .from('students').select('id').limit(1)
      setStudentsBlocked(!studentRows || studentRows.length === 0)
    }
    runChecks()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
      <div style={{ fontFamily: "'DM Serif Display'", fontSize: 22, color: C.teal, marginBottom: 20 }}>
        Phase 4a — Session Test
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, maxWidth: 420, textAlign: 'left' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{status}</div>

        {profileCount !== null && (
          <div style={{ fontSize: 14, marginBottom: 12, color: C.success }}>
            ✓ Can read face profiles ({profileCount} enrolled sample{profileCount !== 1 ? 's' : ''} found)
          </div>
        )}

        {studentsBlocked !== null && (
          <div style={{ fontSize: 14, color: studentsBlocked ? C.success : C.danger, fontWeight: 600 }}>
            {studentsBlocked
              ? '✓ Correctly BLOCKED from reading students table'
              : '⚠ WARNING: kiosk can read students — RLS is not locked down correctly!'}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: C.muted, marginTop: 20, maxWidth: 340 }}>
        This test screen will be replaced by the real camera check-in/check-out
        UI in Phase 4b.
      </div>

      <button
        onClick={onExit}
        style={{
          marginTop: 24, padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${C.border}`,
          background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        ← Back to Welcome
      </button>
    </div>
  )
}
