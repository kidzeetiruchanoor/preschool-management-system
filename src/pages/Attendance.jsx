import { useState } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { CLASSES } from '../lib/constants'
import { today, currentYM, monthLabel, attDateRange } from '../lib/utils'
import { Badge, Btn, Input, Select, Card, EmptyState, Pill } from '../components/ui'

function MonthAttendanceGrid({ ym, getStatus }) {
  const dates = attDateRange(ym)
  const presentCount = dates.filter(d => getStatus(d) === 'present').length
  const absentCount  = dates.filter(d => getStatus(d) === 'absent').length
  const markedCount  = presentCount + absentCount
  return (
    <div>
      <div style={{ display:'flex', gap:14, marginBottom:14, fontSize:13, color: C.muted, flexWrap:'wrap' }}>
        <span>Present: <b style={{ color: C.success }}>{presentCount}</b></span>
        <span>Absent: <b style={{ color: C.danger }}>{absentCount}</b></span>
        <span>Marked: <b>{markedCount}</b> / {dates.length} days</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
        {dates.map(d => {
          const status = getStatus(d)
          const bg = status === 'present' ? '#C6EDD9' : status === 'absent' ? '#F8D7D2' : C.hover
          const color = status === 'present' ? C.success : status === 'absent' ? C.danger : C.muted
          return (
            <div key={d} title={d} style={{ aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, background: bg, color, fontSize:12, fontWeight:700 }}>
              {d.slice(8,10)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MarkStudentAttendance({ students, attendance, setAttendance }) {
  const [selDate, setSelDate] = useState(today())
  const [cls, setCls] = useState(CLASSES[0])
  const active = students.filter(s => s.status === 'Active' && s.section === cls)

  const getStatus = sid => attendance[`${selDate}:${sid}`] || 'absent'

  const toggle = sid => {
    const key = `${selDate}:${sid}`
    const next = attendance[key] === 'present' ? 'absent' : 'present'
    setAttendance(prev => ({ ...prev, [key]: next }))
    DB.setAttendance('student', sid, selDate, next)
  }

  const markAll = status => {
    const updated = { ...attendance }
    active.forEach(s => { updated[`${selDate}:${s.id}`] = status })
    setAttendance(updated)
    DB.markAllAttendance('student', active.map(s => s.id), selDate, status)
  }

  const presentCount = active.filter(s => getStatus(s.id) === 'present').length

  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="Class" value={cls} onChange={e => setCls(e.target.value)}>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input label="Date" type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{ width:'auto' }} />
        <div style={{ fontSize:13, color: C.muted, paddingBottom:8 }}><b style={{ color: C.success }}>{presentCount}</b> / {active.length} present</div>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <Btn small onClick={() => markAll('present')}>Mark All Present</Btn>
        <Btn small variant="ghost" onClick={() => markAll('absent')}>Clear All</Btn>
      </div>
      {active.length === 0 ? <EmptyState msg={`No active students in ${cls}.`} /> :
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {active.map(s => {
            const present = getStatus(s.id) === 'present'
            return (
              <div key={s.id} onClick={() => toggle(s.id)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderRadius:10,
                  border:`1.5px solid ${present ? C.success : C.border}`, background: present ? '#EAF7F0' : C.card,
                  cursor:'pointer', userSelect:'none', transition:'all .12s' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{s.name} <span style={{ fontSize:11, color:C.muted }}>({s.rollNo})</span></div>
                </div>
                <Badge color={present ? C.success : C.muted} bg={present ? '#C6EDD9' : '#F0EDE8'}>{present ? 'Present' : 'Absent'}</Badge>
              </div>
            )
          })}
        </div>
      }
    </div>
  )
}

function StudentAttendanceReport({ students, attendance }) {
  const [mode, setMode] = useState('class')
  const [cls, setCls] = useState(CLASSES[0])
  const [selYM, setSelYM] = useState(currentYM())
  const [selDate, setSelDate] = useState(today())
  const [studentId, setStudentId] = useState('')
  const ymOptions = Array.from({length:18},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const classStudents = students.filter(s => s.status === 'Active' && s.section === cls)
  const selectedStudent = students.find(s => s.id === studentId)

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <Pill active={mode==='class'} onClick={() => setMode('class')}>By Class & Date</Pill>
        <Pill active={mode==='student'} onClick={() => setMode('student')}>By Student & Month</Pill>
      </div>
      {mode === 'class' ? (
        <div>
          <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
            <Select label="Class" value={cls} onChange={e => setCls(e.target.value)}>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select>
            <Input label="Date" type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{ width:'auto' }} />
          </div>
          {classStudents.length === 0 ? <EmptyState msg={`No active students in ${cls}.`} /> :
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {classStudents.map(s => {
                const status = attendance[`${selDate}:${s.id}`]
                const present = status === 'present'
                return (
                  <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:10, background: C.card, border:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:14, fontWeight:600 }}>{s.name} <span style={{ fontSize:11, color:C.muted }}>({s.rollNo})</span></span>
                    {status !== undefined
                      ? <Badge color={present ? C.success : C.danger} bg={present ? '#C6EDD9' : '#F8D7D2'}>{present ? 'Present' : 'Absent'}</Badge>
                      : <Badge color={C.muted}>Not Marked</Badge>}
                  </div>
                )
              })}
            </div>
          }
        </div>
      ) : (
        <div>
          <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
            <Select label="Class" value={cls} onChange={e => { setCls(e.target.value); setStudentId('') }}>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select>
            <Select label="Student" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Select a student</option>
              {classStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.rollNo})</option>)}
            </Select>
            <Select label="Month" value={selYM} onChange={e => setSelYM(e.target.value)}>{ymOptions.map(y=><option key={y} value={y}>{monthLabel(y)}</option>)}</Select>
          </div>
          {!selectedStudent ? <EmptyState msg="Select a student to view their monthly attendance." /> :
            <MonthAttendanceGrid ym={selYM} getStatus={date => attendance[`${date}:${selectedStudent.id}`]} />
          }
        </div>
      )}
    </div>
  )
}

function MarkStaffAttendance({ teachers, staffAttendance, setStaffAttendance }) {
  const [selDate, setSelDate] = useState(today())
  const active = teachers.filter(t => t.active)
  const getStatus = tid => staffAttendance[`${selDate}:${tid}`] || 'absent'
  const toggle = tid => {
    const key = `${selDate}:${tid}`
    const next = staffAttendance[key] === 'present' ? 'absent' : 'present'
    setStaffAttendance(prev => ({ ...prev, [key]: next }))
    DB.setAttendance('staff', tid, selDate, next)
  }
  const markAll = status => {
    const updated = { ...staffAttendance }
    active.forEach(t => { updated[`${selDate}:${t.id}`] = status })
    setStaffAttendance(updated)
    DB.markAllAttendance('staff', active.map(t => t.id), selDate, status)
  }
  const presentCount = active.filter(t => getStatus(t.id) === 'present').length
  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
        <Input label="" type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{ width:'auto' }} />
        <div style={{ fontSize:13, color: C.muted }}><b style={{ color: C.success }}>{presentCount}</b> / {active.length} present</div>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <Btn small onClick={() => markAll('present')}>Mark All Present</Btn>
        <Btn small variant="ghost" onClick={() => markAll('absent')}>Clear All</Btn>
      </div>
      {active.length === 0 ? <EmptyState msg="Add staff first to take attendance." /> :
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {active.map(t => {
            const present = getStatus(t.id) === 'present'
            return (
              <div key={t.id} onClick={() => toggle(t.id)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderRadius:10,
                  border:`1.5px solid ${present ? C.success : C.border}`, background: present ? '#EAF7F0' : C.card, cursor:'pointer', userSelect:'none', transition:'all .12s' }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{t.name} <span style={{ fontSize:11, color:C.muted }}>· {t.role}</span></div>
                <Badge color={present ? C.success : C.muted} bg={present ? '#C6EDD9' : '#F0EDE8'}>{present ? 'Present' : 'Absent'}</Badge>
              </div>
            )
          })}
        </div>
      }
    </div>
  )
}

function StaffAttendanceReport({ teachers, staffAttendance }) {
  const [teacherId, setTeacherId] = useState('')
  const [selYM, setSelYM] = useState(currentYM())
  const ymOptions = Array.from({length:18},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const active = teachers.filter(t => t.active)
  const selected = teachers.find(t => t.id === teacherId)
  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="Staff" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
          <option value="">Select staff</option>
          {active.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select label="Month" value={selYM} onChange={e => setSelYM(e.target.value)}>{ymOptions.map(y=><option key={y} value={y}>{monthLabel(y)}</option>)}</Select>
      </div>
      {!selected ? <EmptyState msg="Select a staff member to view monthly attendance." /> :
        <MonthAttendanceGrid ym={selYM} getStatus={date => staffAttendance[`${date}:${selected.id}`]} />
      }
    </div>
  )
}

export default function Attendance({ students, attendance, setAttendance, teachers, staffAttendance, setStaffAttendance }) {
  const [who, setWho] = useState('students')
  const [view, setView] = useState('mark')
  return (
    <div>
      <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal, marginBottom:16 }}>Attendance</div>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <Pill active={who==='students'} onClick={() => setWho('students')}>Students</Pill>
        <Pill active={who==='staff'} onClick={() => setWho('staff')}>Staff</Pill>
        <span style={{ width:1, background: C.border, margin:'0 4px' }} />
        <Pill active={view==='mark'} onClick={() => setView('mark')}>Mark Attendance</Pill>
        <Pill active={view==='report'} onClick={() => setView('report')}>View Reports</Pill>
      </div>
      {who === 'students' && view === 'mark' && <MarkStudentAttendance students={students} attendance={attendance} setAttendance={setAttendance} />}
      {who === 'students' && view === 'report' && <StudentAttendanceReport students={students} attendance={attendance} />}
      {who === 'staff' && view === 'mark' && <MarkStaffAttendance teachers={teachers} staffAttendance={staffAttendance} setStaffAttendance={setStaffAttendance} />}
      {who === 'staff' && view === 'report' && <StaffAttendanceReport teachers={teachers} staffAttendance={staffAttendance} />}
    </div>
  )
}
