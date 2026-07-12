import { useState, useEffect } from 'react'
import { C } from '../lib/styles'
import { CLASSES } from '../lib/constants'
import { fmt, today, currentYM, dateToYM, monthLabel } from '../lib/utils'
import { Btn, Card, Select, EmptyState } from '../components/ui'

export default function TodaysTasks({ students, teachers, feeRecords, salaryRecords, enquiries, attendance, onNavigate }) {
  const [dismissed, setDismissed] = useState({})
  const [notice, setNotice] = useState({ show: false, cls: 'All', msg: '' })
  const [noticeLinks, setNoticeLinks] = useState([])
  const todayStr = today()
  const storageKey = `tasks-dismissed-${todayStr}`

  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) setDismissed(JSON.parse(s)) } catch {}
  }, [])

  const dismiss = id => {
    const updated = { ...dismissed, [id]: true }
    setDismissed(updated)
    try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
  }

  const ay = (() => { const d=new Date(),y=d.getFullYear(),m=d.getMonth()+1,sy=m>=5?y:y-1; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })()
  const ym = currentYM()
  const activeStudents = students.filter(s => s.status === 'Active')

  const feeReminders = activeStudents.map(s => {
    let balance = 0
    if (s.section === 'Daycare') {
      const paid = feeRecords.filter(r => r.studentId === s.id && dateToYM(r.date) === ym).reduce((a,r)=>a+(+r.amount||0),0)
      balance = paid > 0 ? Math.max(0, (+s.monthlyFee||0) - paid) : 0
    } else {
      const paid = feeRecords.filter(r => r.studentId === s.id && r.academicYear === ay).reduce((a,r)=>a+(+r.amount||0),0)
      balance = Math.max(0, (+s.annualFee||0) - paid)
    }
    if (balance < 1) return null
    const ph = (s.fatherPhone || s.motherPhone || '').replace(/\D/g,'')
    const msg = `Dear Parent, a fee balance of ${fmt(balance)} is pending for ${s.name} (${s.rollNo}) at Kidzee Tiruchanoor. Kindly clear at your earliest convenience. Thank you!`
    return { id:`fee-${s.id}`, label:s.name, sub:`${s.section} · Balance ${fmt(balance)}`, href: ph ? `https://wa.me/91${ph}?text=${encodeURIComponent(msg)}` : null, actionLabel:'Send WhatsApp' }
  }).filter(Boolean)

  const enqFollowUps = (enquiries||[]).filter(e => e.followUpDate && e.followUpDate <= todayStr && e.status !== 'Admitted' && e.status !== 'Not Interested')
    .map(e => ({ id:`enq-${e.id}`, label:e.parentName, sub:`${e.childName||''} · ${e.phone}${e.followUpDate < todayStr?' · overdue':' · due today'}`, href: e.phone ? `tel:${e.phone}` : null, actionLabel:'Call', linkTab:'enquiries' }))

  const birthdaysToday = activeStudents.filter(s => { if (!s.dob) return false; const d=new Date(s.dob),n=new Date(); return d.getMonth()===n.getMonth()&&d.getDate()===n.getDate() })
    .map(s => { const ph=(s.fatherPhone||s.motherPhone||'').replace(/\D/g,''); const msg=`Dear Parent, wishing ${s.name} a very Happy Birthday! 🎂 - Kidzee Tiruchanoor`; return { id:`bday-${s.id}`, label:s.name, sub:s.section, href: ph?`https://wa.me/91${ph}?text=${encodeURIComponent(msg)}`:null, actionLabel:'Send Wishes' } })

  const unmarkedStudents = activeStudents.filter(s => !attendance[`${todayStr}:${s.id}`])

  const salaryDue = teachers.filter(t => t.active && !salaryRecords.find(r => r.teacherId === t.id && r.ym === ym && r.paid))
    .map(t => ({ id:`sal-${t.id}`, label:t.name, sub:`${t.role} · ${fmt(t.salary)}`, href:null, actionLabel:null, linkTab:'teachers' }))

  const taskGroups = [
    { id:'fee', icon:'💰', color:C.danger, title:`${feeReminders.length} fee reminder${feeReminders.length!==1?'s':''} to send`, count:feeReminders.length, items:feeReminders },
    { id:'enq', icon:'📞', color:C.amber, title:`${enqFollowUps.length} enquiry follow-up${enqFollowUps.length!==1?'s':''}`, count:enqFollowUps.length, items:enqFollowUps },
    { id:'bday', icon:'🎂', color:C.purple, title:`${birthdaysToday.length} birthday${birthdaysToday.length!==1?'s':''} today`, count:birthdaysToday.length, items:birthdaysToday },
    { id:'attendance', icon:'📅', color:C.teal, title:`${unmarkedStudents.length} student${unmarkedStudents.length!==1?'s':''} not yet marked`, count:unmarkedStudents.length, items:[], linkTab:'attendance', linkLabel:'Go to Attendance' },
    { id:'salary', icon:'💼', color:C.purple, title:`Salary pending for ${salaryDue.length} staff`, count:salaryDue.length, items:salaryDue },
  ].filter(g => g.count > 0)

  const sendNotice = () => {
    if (!notice.msg.trim()) return
    const targets = notice.cls === 'All' ? activeStudents : activeStudents.filter(s => s.section === notice.cls)
    const phones = [...new Set(targets.flatMap(s => [s.fatherPhone, s.motherPhone].filter(Boolean)))]
    if (phones.length === 0) return alert('No phone numbers on file for the selected class.')
    const label = notice.cls === 'All' ? 'All Classes' : notice.cls
    const msg = `[Kidzee Tiruchanoor — ${label}] ${notice.msg}`
    setNoticeLinks(phones.map(ph => ({ ph, url:`https://wa.me/91${ph.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}` })))
  }

  const allDone = taskGroups.every(g => dismissed[g.id] || (g.items.length > 0 && g.items.every(i => dismissed[i.id])))

  return (
    <div>
      <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal, marginBottom:4 }}>Good morning! 👋</div>
      <div style={{ fontSize:13, color: C.muted, marginBottom:20 }}>{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</div>

      {allDone && taskGroups.length > 0 && (
        <Card style={{ padding:20, marginBottom:16, background:'#EAF7F0', border:`1.5px solid ${C.success}` }}>
          <div style={{ fontSize:15, fontWeight:700, color: C.success }}>All done for today! ✅</div>
          <div style={{ fontSize:13, color: C.muted, marginTop:4 }}>Kidzee is all caught up.</div>
        </Card>
      )}
      {taskGroups.length === 0 && (
        <Card style={{ padding:24, textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ fontWeight:700, color: C.success, fontSize:15 }}>Nothing pending today!</div>
        </Card>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {taskGroups.map(g => {
          const groupDone = dismissed[g.id] || (g.items.length > 0 && g.items.every(i => dismissed[i.id]))
          return (
            <Card key={g.id} style={{ padding:0, overflow:'hidden', opacity: groupDone ? 0.5 : 1, transition:'opacity .2s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background: groupDone ? C.hover : g.color+'12', borderBottom: g.items.length>0 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>{g.icon}</span>
                  <span style={{ fontWeight:700, fontSize:14, color: groupDone ? C.muted : g.color, textDecoration: groupDone ? 'line-through' : 'none' }}>{g.title}</span>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {g.linkTab && <Btn small variant="ghost" onClick={() => onNavigate(g.linkTab)}>{g.linkLabel||'Open'}</Btn>}
                  {!groupDone && <Btn small variant="ghost" onClick={() => dismiss(g.id)}>Mark Done</Btn>}
                </div>
              </div>
              {!dismissed[g.id] && g.items.length > 0 && g.items.map(item => {
                const itemDone = dismissed[item.id]
                return (
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:`1px solid ${C.border}`, opacity: itemDone?0.45:1, background: itemDone?C.hover:C.card }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, textDecoration: itemDone?'line-through':'none' }}>{item.label}</div>
                      <div style={{ fontSize:11, color: C.muted }}>{item.sub}</div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {item.href && !itemDone && (
                        <a href={item.href} target="_blank" rel="noreferrer"
                          style={{ padding:'5px 12px', borderRadius:8, background: C.amber, color:'#fff', fontWeight:600, fontSize:12, textDecoration:'none' }}>
                          {item.actionLabel}
                        </a>
                      )}
                      {item.linkTab && !itemDone && <Btn small variant="ghost" onClick={() => onNavigate(item.linkTab)}>Open</Btn>}
                      {!itemDone && <Btn small variant="ghost" onClick={() => dismiss(item.id)}>✓</Btn>}
                    </div>
                  </div>
                )
              })}
            </Card>
          )
        })}

        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background: C.tealLight, borderBottom: notice.show ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18 }}>📢</span>
              <span style={{ fontWeight:700, fontSize:14, color: C.teal }}>Send class notice</span>
            </div>
            <Btn small variant="ghost" onClick={() => { setNotice(p=>({...p,show:!p.show})); setNoticeLinks([]) }}>{notice.show ? 'Hide' : 'Compose'}</Btn>
          </div>
          {notice.show && (
            <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
              <Select label="Class" value={notice.cls} onChange={e => { setNotice(p=>({...p,cls:e.target.value})); setNoticeLinks([]) }}>
                <option value="All">All Classes</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <label style={{ fontSize:13, fontWeight:500 }}>Message
                <textarea value={notice.msg} onChange={e => { setNotice(p=>({...p,msg:e.target.value})); setNoticeLinks([]) }} rows={3}
                  placeholder="e.g. No lunch tomorrow, please send snacks..."
                  style={{ display:'block', width:'100%', marginTop:4, padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, resize:'vertical' }} />
              </label>
              <Btn variant="primary" onClick={sendNotice}>Generate WhatsApp Links</Btn>
              {noticeLinks.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontSize:12, fontWeight:600, color: C.teal }}>{noticeLinks.length} link{noticeLinks.length!==1?'s':''} ready — tap each to open WhatsApp:</div>
                  {noticeLinks.map((l,i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px', background:'#E7F9EF', borderRadius:10, border:`1.5px solid ${C.success}`, textDecoration:'none' }}>
                      <span style={{ fontSize:13, fontWeight:600, color: C.text }}>{l.ph}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'#25D366' }}>Open WhatsApp →</span>
                    </a>
                  ))}
                  <Btn variant="ghost" small onClick={() => { setNoticeLinks([]); setNotice(p=>({...p,msg:''})) }}>Clear & Compose New</Btn>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
