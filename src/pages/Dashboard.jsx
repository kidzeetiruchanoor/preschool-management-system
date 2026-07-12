import { useState } from 'react'
import { C } from '../lib/styles'
import { fmt, monthLabel, currentYM, currentAcademicYear, academicYearMonths, dateToYM, today } from '../lib/utils'
import { isDaycare } from '../lib/constants'
import { Card, Select, Btn } from '../components/ui'

export default function Dashboard({ students, teachers, feeRecords, expenses, enquiries, onOpenReceipt, onGoToEnquiries }) {
  const ay = currentAcademicYear()
  const ayMonths = academicYearMonths(ay)
  const ym = currentYM()
  const [expMonth, setExpMonth] = useState(ym)
  const activeStudents = students.filter(s => s.status === 'Active')

  let expectedAY = 0, collectedAY = 0
  activeStudents.forEach(s => {
    if (isDaycare(s.section)) {
      const payments = feeRecords.filter(r => r.studentId === s.id && ayMonths.includes(dateToYM(r.date)))
      const paid = payments.reduce((a,r) => a + (+r.amount||0), 0)
      collectedAY += paid
      const monthsWithPay = new Set(payments.map(r => dateToYM(r.date)))
      expectedAY += monthsWithPay.size * (+s.monthlyFee || 0)
    } else {
      expectedAY += (+s.annualFee || 0)
      collectedAY += feeRecords.filter(r => r.studentId === s.id && r.academicYear === ay).reduce((a,r) => a + (+r.amount||0), 0)
    }
  })
  const pendingAY = Math.max(0, expectedAY - collectedAY)
  const collectionPct = expectedAY > 0 ? Math.round((collectedAY / expectedAY) * 100) : 0
  const monthIncome = feeRecords.filter(r => dateToYM(r.date) === expMonth).reduce((a,r) => a + (+r.amount||0), 0)
  const monthExpense = expenses.filter(e => e.date?.startsWith(expMonth)).reduce((a,e) => a + (+e.amount||0), 0)

  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const trend = trendMonths.map(tym => ({
    ym: tym,
    income: feeRecords.filter(r => dateToYM(r.date) === tym).reduce((a,r)=>a+(+r.amount||0),0),
    expense: expenses.filter(e => e.date?.startsWith(tym)).reduce((a,e)=>a+(+e.amount||0),0),
  }))
  const trendMax = Math.max(1, ...trend.map(t => Math.max(t.income, t.expense)))

  const pendingStudents = activeStudents.map(s => {
    let paidThis = 0, expectedThis = 0
    if (isDaycare(s.section)) {
      paidThis = feeRecords.filter(r => r.studentId === s.id && dateToYM(r.date) === ym).reduce((a,r)=>a+(+r.amount||0),0)
      expectedThis = paidThis > 0 ? +s.monthlyFee : 0
    } else {
      const perMonth = (+s.annualFee || 0) / 12
      const paidAY = feeRecords.filter(r => r.studentId === s.id && r.academicYear === ay).reduce((a,r)=>a+(+r.amount||0),0)
      expectedThis = perMonth * (ayMonths.indexOf(ym) + 1)
      paidThis = paidAY
    }
    return { ...s, balance: expectedThis - paidThis }
  }).filter(s => s.balance > 0.5).sort((a,b)=>b.balance-a.balance)

  const upcomingBdays = activeStudents.map(s => {
    if (!s.dob) return null
    const dob = new Date(s.dob), now = new Date()
    let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
    if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(now.getFullYear()+1)
    const days = Math.round((next - now) / 86400000)
    return days <= 30 ? { ...s, days } : null
  }).filter(Boolean).sort((a,b)=>a.days-b.days)

  const recentPayments = [...feeRecords].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6)
    .map(r => ({ ...r, student: students.find(s=>s.id===r.studentId) }))

  const todayStr = today()
  const enqList = enquiries || []
  const overdueEnq = enqList.filter(e => e.followUpDate && e.followUpDate < todayStr && e.status !== 'Admitted' && e.status !== 'Not Interested')
  const dueTodayEnq = enqList.filter(e => e.followUpDate === todayStr && e.status !== 'Admitted' && e.status !== 'Not Interested')
  const bdayToday = upcomingBdays.filter(s => s.days === 0)
  const actionCount = overdueEnq.length + dueTodayEnq.length + bdayToday.length

  const ymOptions = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  const StatCard = ({ label, value, sub, color = C.teal }) => (
    <Card style={{ padding:'18px 20px' }}>
      <div style={{ fontSize:11, fontWeight:600, color: C.muted, letterSpacing:.5, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:700, color, fontFamily:"'DM Serif Display'" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color: C.muted, marginTop:3 }}>{sub}</div>}
    </Card>
  )

  return (
    <div>
      <div style={{ fontFamily:"'DM Serif Display'", fontSize:26, color: C.teal, marginBottom:2 }}>Kidzee Tiruchanoor</div>
      <div style={{ fontSize:13, color: C.muted, marginBottom:20 }}>Academic Year {ay}</div>

      {actionCount > 0 && (
        <Card style={{ padding:18, marginBottom:20, background: C.amberLight, border:`1.5px solid ${C.amber}` }}>
          <div style={{ fontWeight:700, color: C.amber, marginBottom:10, fontSize:14 }}>Today's Action Items</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {overdueEnq.map(e => (
              <div key={e.id} style={{ fontSize:13, display:'flex', justifyContent:'space-between' }}>
                <span>Overdue follow-up: <b>{e.parentName}</b> ({e.childName || 'enquiry'})</span>
                {e.phone && <a href={`tel:${e.phone}`} style={{ color: C.teal, fontWeight:600 }}>Call</a>}
              </div>
            ))}
            {dueTodayEnq.map(e => (
              <div key={e.id} style={{ fontSize:13, display:'flex', justifyContent:'space-between' }}>
                <span>Follow-up due today: <b>{e.parentName}</b> ({e.childName || 'enquiry'})</span>
                {e.phone && <a href={`tel:${e.phone}`} style={{ color: C.teal, fontWeight:600 }}>Call</a>}
              </div>
            ))}
            {bdayToday.map(s => (
              <div key={s.id} style={{ fontSize:13 }}>🎂 It's <b>{s.name}</b>'s birthday today!</div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:12, marginBottom:20 }}>
        <StatCard label="Students" value={activeStudents.length} sub="active enrolments" />
        <StatCard label="Teachers" value={teachers.filter(t=>t.active).length} sub="on staff" />
        <StatCard label="Expected (AY)" value={fmt(expectedAY)} sub={ay} />
        <StatCard label="Collected (AY)" value={fmt(collectedAY)} color={C.success} />
        <StatCard label="Pending (AY)" value={fmt(pendingAY)} color={pendingAY>0?C.danger:C.success} />
        <StatCard label="Collection %" value={`${collectionPct}%`} color={C.amber} />
      </div>

      <Card style={{ padding:18, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <div style={{ fontWeight:700, fontSize:14, color: C.teal }}>Monthly Summary</div>
          <Select label="" value={expMonth} onChange={e=>setExpMonth(e.target.value)}>
            {ymOptions.map(y => <option key={y} value={y}>{monthLabel(y)}</option>)}
          </Select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12 }}>
          {[['Income',monthIncome,C.success],['Expenses',monthExpense,C.danger],['Profit',monthIncome-monthExpense,(monthIncome-monthExpense)>=0?C.teal:C.danger]].map(([l,v,col])=>(
            <div key={l}>
              <div style={{ fontSize:11, color: C.muted, textTransform:'uppercase', fontWeight:600 }}>{l}</div>
              <div style={{ fontSize:19, fontWeight:700, color: col }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding:18, marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:14, color: C.teal, marginBottom:14 }}>Last 6 Months — Income vs Expense</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:120 }}>
          {trend.map(t => (
            <div key={t.ym} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:90 }}>
                <div title={`Income ${fmt(t.income)}`} style={{ width:10, borderRadius:'3px 3px 0 0', background: C.success, height:`${Math.max(2,(t.income/trendMax)*90)}px` }} />
                <div title={`Expense ${fmt(t.expense)}`} style={{ width:10, borderRadius:'3px 3px 0 0', background: C.danger, height:`${Math.max(2,(t.expense/trendMax)*90)}px` }} />
              </div>
              <div style={{ fontSize:10, color: C.muted }}>{monthLabel(t.ym).split(' ')[0]}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:14, marginTop:10, fontSize:11, color: C.muted }}>
          <span><span style={{ display:'inline-block', width:8, height:8, background: C.success, borderRadius:2, marginRight:4 }} />Income</span>
          <span><span style={{ display:'inline-block', width:8, height:8, background: C.danger, borderRadius:2, marginRight:4 }} />Expense</span>
        </div>
      </Card>

      {pendingStudents.length > 0 && (
        <Card style={{ padding:18, marginBottom:20 }}>
          <div style={{ fontWeight:700, color: C.danger, marginBottom:12, fontSize:14 }}>Pending Students ({monthLabel(ym)})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pendingStudents.slice(0,8).map(s => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: C.bg, borderRadius:8 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{s.name} <span style={{ color:C.muted, fontWeight:400 }}>({s.rollNo})</span></span>
                <span style={{ fontSize:13, fontWeight:700, color: C.danger }}>{fmt(s.balance)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {upcomingBdays.length > 0 && (
        <Card style={{ padding:18, marginBottom:20 }}>
          <div style={{ fontWeight:700, color: C.purple, marginBottom:12, fontSize:14 }}>Upcoming Birthdays</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {upcomingBdays.slice(0,6).map(s => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: C.purpleLight, borderRadius:8 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{s.name}</span>
                <span style={{ fontSize:12, color: C.purple, fontWeight:600 }}>{s.days===0?'Today!':`in ${s.days}d`}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recentPayments.length > 0 && (
        <Card style={{ padding:18 }}>
          <div style={{ fontWeight:700, color: C.teal, marginBottom:12, fontSize:14 }}>Recent Payments</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {recentPayments.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: C.bg, borderRadius:8, flexWrap:'wrap', gap:6 }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:600 }}>{r.student?.name || 'Unknown'}</span>
                  <span style={{ fontSize:11, color: C.muted, marginLeft:8 }}>{r.date} · {r.paymentMode}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:13, fontWeight:700, color: C.success }}>{fmt(r.amount)}</span>
                  {r.student && <Btn small variant="ghost" onClick={() => onOpenReceipt && onOpenReceipt(r, r.student)}>Receipt</Btn>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
