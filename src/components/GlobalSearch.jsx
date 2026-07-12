import { useState } from 'react'
import { C } from '../lib/styles'

export default function GlobalSearch({ students, teachers, enquiries, onNavigate }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const term = q.trim().toLowerCase()
  const results = term.length < 2 ? [] : [
    ...students.filter(s =>
      s.name.toLowerCase().includes(term) ||
      s.fatherPhone?.includes(term) || s.motherPhone?.includes(term) ||
      s.fatherName?.toLowerCase().includes(term) || s.motherName?.toLowerCase().includes(term) ||
      s.rollNo?.toLowerCase().includes(term) || s.admissionNo?.toLowerCase().includes(term)
    ).map(s => ({ type:'Student', label: s.name, sub: `${s.section} · ${s.rollNo} · ${s.admissionNo}`, tab:'students' })),
    ...teachers.filter(t =>
      t.name.toLowerCase().includes(term) || t.phone?.includes(term)
    ).map(t => ({ type:'Staff', label: t.name, sub: t.role, tab:'teachers' })),
    ...(enquiries||[]).filter(e =>
      e.childName?.toLowerCase().includes(term) || e.parentName?.toLowerCase().includes(term) ||
      e.phone?.includes(term) || e.altPhone?.includes(term)
    ).map(e => ({ type:'Enquiry', label: e.parentName, sub: `${e.childName || ''} · ${e.phone}`, tab:'enquiries' })),
  ].slice(0, 10)

  return (
    <div style={{ position:'relative', flex:1, maxWidth:320 }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search students, staff, enquiries..."
        style={{ width:'100%', padding:'7px 14px', borderRadius:20, border:`1.5px solid ${C.border}`,
          fontSize:13, outline:'none', background: C.hover }}
      />
      {open && results.length > 0 && (
        <div style={{ position:'absolute', top:'110%', left:0, right:0, background: C.card,
          borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.15)', zIndex:300, overflow:'hidden' }}>
          {results.map((r, i) => (
            <div key={i}
              onMouseDown={() => { onNavigate(r.tab); setQ(''); setOpen(false) }}
              style={{ padding:'10px 16px', cursor:'pointer', borderBottom:`1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.hover}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ fontSize:13, fontWeight:600 }}>{r.label}
                <span style={{ marginLeft:8, fontSize:11, background: C.tealLight, color: C.teal,
                  padding:'1px 7px', borderRadius:10, fontWeight:600 }}>{r.type}</span>
              </div>
              <div style={{ fontSize:11, color: C.muted }}>{r.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
