import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../lib/styles'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background: C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:380 }}>

        {/* Logo / header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🌟</div>
          <div style={{ fontFamily:"'DM Serif Display'", fontSize:28, color: C.teal, marginBottom:4 }}>
            Kidzee Tiruchanoor
          </div>
          <div style={{ fontSize:14, color: C.muted }}>School Management System</div>
        </div>

        {/* Card */}
        <div style={{ background: C.card, borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(0,0,0,.08)', border:`1px solid ${C.border}` }}>
          <div style={{ fontFamily:"'DM Serif Display'", fontSize:20, color: C.teal, marginBottom:24 }}>Sign In</div>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13, fontWeight:500, color: C.text }}>
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your@email.com"
                style={{ padding:'10px 14px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, outline:'none', background:'#fff', color: C.text }}
              />
            </label>

            <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13, fontWeight:500, color: C.text }}>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ padding:'10px 14px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, outline:'none', background:'#fff', color: C.text }}
              />
            </label>

            {error && (
              <div style={{ padding:'10px 14px', background:'#fef2f2', border:`1px solid ${C.danger}`, borderRadius:8, fontSize:13, color: C.danger }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop:4, padding:'11px 0', borderRadius:8, border:'none', background: loading ? C.muted : C.teal, color:'#fff', fontWeight:700, fontSize:15, cursor: loading ? 'not-allowed' : 'pointer', transition:'background .15s', fontFamily:'inherit' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:12, color: C.muted }}>
          Access restricted to authorised staff only.
        </div>
      </div>
    </div>
  )
}
