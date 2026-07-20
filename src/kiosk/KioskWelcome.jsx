import { useState, useEffect } from 'react'
import { C } from '../lib/styles'

export default function KioskWelcome({ connecting, error, onStaffAttendance, onAdminLogin }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56, marginBottom: 8 }}>🌟</div>
      <div style={{ fontFamily: "'DM Serif Display'", fontSize: 34, color: C.teal, marginBottom: 4 }}>
        Kidzee Tiruchanoor
      </div>
      <div style={{ fontSize: 15, color: C.muted, marginBottom: 4 }}>
        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, color: C.text, fontFamily: "'DM Serif Display'", marginBottom: 48 }}>
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 340 }}>
        <button
          onClick={onStaffAttendance}
          disabled={connecting}
          style={{
            padding: '22px 0', borderRadius: 18, border: 'none',
            background: connecting ? C.muted : C.teal, color: '#fff',
            fontSize: 20, fontWeight: 700, cursor: connecting ? 'default' : 'pointer',
            fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(26,95,106,.25)',
          }}
        >
          {connecting ? 'Connecting...' : '📋 Staff Attendance'}
        </button>

        <button
          onClick={onAdminLogin}
          style={{
            padding: '14px 0', borderRadius: 14, border: `1.5px solid ${C.border}`,
            background: 'transparent', color: C.muted,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Admin Login
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 24, padding: '12px 18px', background: '#fef2f2',
          border: `1px solid ${C.danger}`, borderRadius: 10, color: C.danger,
          fontSize: 14, maxWidth: 340,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
