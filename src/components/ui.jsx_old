import { C } from '../lib/styles'

export const Badge = ({ color = C.teal, bg, children }) => (
  <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600,
    color, background: bg || color + '18', letterSpacing:.4, whiteSpace:'nowrap' }}>{children}</span>
)

export const Pill = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{ padding:'6px 14px', borderRadius:20, border:'none', fontWeight:600,
    fontSize:13, cursor:'pointer', background: active ? C.teal : C.hover, color: active ? '#fff' : C.muted,
    transition:'all .15s' }}>{children}</button>
)

export const Btn = ({ onClick, children, variant = 'primary', small, style: sx = {} }) => (
  <button onClick={onClick} style={{
    padding: small ? '5px 12px' : '9px 18px', borderRadius:8, border:'none', fontWeight:600,
    fontSize: small ? 12 : 14, cursor:'pointer', transition:'opacity .15s',
    background: variant==='primary' ? C.teal : variant==='amber' ? C.amber : variant==='danger' ? C.danger : variant==='purple' ? C.purple : C.hover,
    color: variant==='ghost' ? C.muted : '#fff', ...sx,
  }}>{children}</button>
)

export const Input = ({ label, ...props }) => (
  <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:13, fontWeight:500, color: C.text, width:'100%' }}>
    {label}
    <input {...props} style={{ padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`,
      fontSize:14, color: C.text, background: props.readOnly ? C.hover : '#fff',
      outline:'none', width:'100%', ...props.style }} />
  </label>
)

export const Select = ({ label, children, ...props }) => (
  <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:13, fontWeight:500, color: C.text }}>
    {label}
    <select {...props} style={{ padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`,
      fontSize:14, color: C.text, background:'#fff', outline:'none' }}>{children}</select>
  </label>
)

export const Card = ({ children, style: sx = {} }) => (
  <div style={{ background: C.card, borderRadius:14, border:`1px solid ${C.border}`,
    boxShadow:'0 1px 4px rgba(0,0,0,.06)', ...sx }}>{children}</div>
)

export const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:200,
    display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
    <div style={{ background: C.card, borderRadius:16, padding:24, width:'100%',
      maxWidth: wide ? 640 : 500, maxHeight:'90vh', overflowY:'auto',
      boxShadow:'0 8px 40px rgba(0,0,0,.18)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <span style={{ fontFamily:"'DM Serif Display'", fontSize:20, color: C.teal }}>{title}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color: C.muted, cursor:'pointer' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
)

export const EmptyState = ({ msg }) => (
  <div style={{ textAlign:'center', padding:'40px 24px', color: C.muted, fontSize:14 }}>{msg}</div>
)

export const ProgressBar = ({ value, max }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = pct >= 100 ? C.success : pct >= 50 ? C.amber : C.danger
  return (
    <div style={{ background: C.border, borderRadius:4, height:6, overflow:'hidden', marginTop:6 }}>
      <div style={{ width:`${pct}%`, height:'100%', background: color, borderRadius:4, transition:'width .3s' }} />
    </div>
  )
}

export const Row = ({ label, value }) => (
  <div style={{ display:'flex', justifyContent:'space-between' }}>
    <span style={{ color: C.muted }}>{label}</span>
    <span style={{ fontWeight:600 }}>{value}</span>
  </div>
)
