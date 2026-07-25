import { useState, useEffect } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { fmt, currentYM, monthLabel } from '../lib/utils'
import { Badge, Pill, Card, Select, EmptyState } from './ui'

const LATE_OPTIONS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '09:15', label: '9:15 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
]

// Compares a check_in_time (ISO timestamp) against a "HH:MM" cutoff,
// both interpreted in local time — used only for highlighting late
// arrivals in this view. Not stored anywhere, purely a display filter
// the admin can adjust while looking at the report.
function isLate(checkInIso, cutoffHHMM) {
  if (!checkInIso) return false
  const d = new Date(checkInIso)
  const [h, m] = cutoffHHMM.split(':').map(Number)
  const cutoff = new Date(d)
  cutoff.setHours(h, m, 0, 0)
  return d > cutoff
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Today's Attendance ───────────────────────────────────────────
function TodaysAttendance({ teachers }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [lateCutoff, setLateCutoff] = useState('09:15')

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    DB.getAttendanceForDate(todayStr).then(data => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  const activeStaff = teachers.filter(t => t.active)
  const byTeacherId = Object.fromEntries(rows.map(r => [r.teacher_id, r]))

  const present = activeStaff.filter(t => byTeacherId[t.id]?.check_in_time)
  const notCheckedIn = activeStaff.filter(t => !byTeacherId[t.id]?.check_in_time)
  const lateCount = present.filter(t => isLate(byTeacherId[t.id].check_in_time, lateCutoff)).length

  if (loading) return <EmptyState msg="Loading today's attendance..." />

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Present', present.length, C.success],
          ['Not Checked In', notCheckedIn.length, C.danger],
          ['Late Arrivals', lateCount, C.amber],
        ].map(([l, v, c]) => (
          <Card key={l} style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: "'DM Serif Display'" }}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <Select label="Mark late after" value={lateCutoff} onChange={e => setLateCutoff(e.target.value)}>
          {LATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      {activeStaff.length === 0 ? <EmptyState msg="No active staff." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeStaff.map(t => {
            const row = byTeacherId[t.id]
            const late = row?.check_in_time && isLate(row.check_in_time, lateCutoff)
            return (
              <Card key={t.id} style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>· {t.role}</span></div>
                    {row?.check_in_time ? (
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        In: <b style={{ color: C.success }}>{fmtTime(row.check_in_time)}</b>
                        {row.check_out_time && <> · Out: <b style={{ color: C.text }}>{fmtTime(row.check_out_time)}</b></>}
                        {row.working_hours != null && <> · {row.working_hours}h</>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.danger, marginTop: 2 }}>Not checked in yet</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {late && <Badge color={C.amber}>Late</Badge>}
                    {row?.check_in_time && !row?.check_out_time && <Badge color={C.success}>On Site</Badge>}
                    {row?.check_out_time && <Badge color={C.muted}>Left</Badge>}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Monthly Report ────────────────────────────────────────────────
function MonthlyReport({ teachers }) {
  const [selYM, setSelYM] = useState(currentYM())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [lateCutoff, setLateCutoff] = useState('09:15')
  const ymOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    setLoading(true)
    DB.getAttendanceForMonth(selYM).then(data => {
      setRows(data)
      setLoading(false)
    })
  }, [selYM])

  const activeStaff = teachers.filter(t => t.active)

  const summaries = activeStaff.map(t => {
    const teacherRows = rows.filter(r => r.teacher_id === t.id)
    const daysPresent = teacherRows.filter(r => r.check_in_time).length
    const totalHours = teacherRows.reduce((a, r) => a + (Number(r.working_hours) || 0), 0)
    const avgHours = daysPresent > 0 ? (totalHours / daysPresent).toFixed(1) : '—'
    const lateDays = teacherRows.filter(r => isLate(r.check_in_time, lateCutoff)).length
    return { ...t, daysPresent, totalHours: totalHours.toFixed(1), avgHours, lateDays }
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <Select label="Month" value={selYM} onChange={e => setSelYM(e.target.value)}>
          {ymOptions.map(y => <option key={y} value={y}>{monthLabel(y)}</option>)}
        </Select>
        <Select label="Mark late after" value={lateCutoff} onChange={e => setLateCutoff(e.target.value)}>
          {LATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      {loading ? <EmptyState msg="Loading monthly report..." /> : summaries.length === 0 ? (
        <EmptyState msg="No active staff." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {summaries.map(s => (
            <Card key={s.id} style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>· {s.role}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginTop: 10 }}>
                <MiniStat label="Days Present" value={s.daysPresent} />
                <MiniStat label="Total Hours" value={`${s.totalHours}h`} />
                <MiniStat label="Avg Hours/Day" value={`${s.avgHours}h`} />
                <MiniStat label="Late Days" value={s.lateDays} color={s.lateDays > 0 ? C.amber : C.success} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, color = C.text }) {
  return (
    <div style={{ background: C.bg, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────
export default function TeacherAttendanceReport({ teachers }) {
  const [view, setView] = useState('today')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Pill active={view === 'today'} onClick={() => setView('today')}>Today</Pill>
        <Pill active={view === 'monthly'} onClick={() => setView('monthly')}>Monthly</Pill>
      </div>
      {view === 'today' ? <TodaysAttendance teachers={teachers} /> : <MonthlyReport teachers={teachers} />}
    </div>
  )
}
