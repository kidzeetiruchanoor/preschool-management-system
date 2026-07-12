import { useState } from 'react'
import { C } from '../lib/styles'
import { CLASSES, EXPENSE_CATS, ENQUIRY_STATUS_COLOR, isDaycare } from '../lib/constants'
import { fmt, currentYM, monthLabel, academicYearOptions, academicYearMonths, dateToYM, attDateRange, exportCSV } from '../lib/utils'
import { Badge, Pill, Card, Select, Btn, EmptyState, ProgressBar } from '../components/ui'

function FeeReport({ students, feeRecords }) {
  const [ay, setAy] = useState(() => { const d=new Date(),y=d.getFullYear(),m=d.getMonth()+1,sy=m>=5?y:y-1; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })
  const [cls, setCls] = useState('All')
  const active = students.filter(s => s.status === 'Active')
  const filtered = cls === 'All' ? active : active.filter(s => s.section === cls)
  const rows = filtered.map(s => {
    const dc = isDaycare(s.section)
    const payments = dc ? feeRecords.filter(r => r.studentId === s.id) : feeRecords.filter(r => r.studentId === s.id && r.academicYear === ay)
    const paid = payments.reduce((a,r)=>a+(+r.amount||0),0)
    const agreed = dc ? (+s.monthlyFee||0) : (+s.annualFee||0)
    const last = [...payments].sort((a,b)=>b.date.localeCompare(a.date))[0]
    return { ...s, paid, agreed, balance: dc ? 0 : Math.max(0, agreed-paid), lastDate: last?.date||'—', lastMode: last?.paymentMode||'—', dc }
  })
  const totalAgreed = rows.filter(r=>!r.dc).reduce((a,r)=>a+r.agreed,0)
  const totalPaid = rows.reduce((a,r)=>a+r.paid,0)
  const totalBalance = rows.filter(r=>!r.dc).reduce((a,r)=>a+r.balance,0)
  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="Academic Year" value={ay} onChange={e=>setAy(e.target.value)}>{academicYearOptions().map(y=><option key={y} value={y}>{y}</option>)}</Select>
        <Select label="Class" value={cls} onChange={e=>setCls(e.target.value)}><option value="All">All Classes</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select>
        <Btn small variant="ghost" onClick={() => exportCSV(`fee-report-${ay}.csv`, rows, [
          {label:'Name',value:'name'},{label:'Class',value:'section'},{label:'Roll No',value:'rollNo'},
          {label:'Fee Type',value:r=>r.dc?'Monthly':'Annual'},{label:'Agreed',value:'agreed'},
          {label:'Paid',value:'paid'},{label:'Balance',value:'balance'},{label:'Last Payment',value:'lastDate'},{label:'Mode',value:'lastMode'},
        ])}>Export CSV</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:16 }}>
        {[['Total Expected',fmt(totalAgreed),C.teal],['Total Collected',fmt(totalPaid),C.success],['Total Pending',fmt(totalBalance),C.danger],['Collection %',totalAgreed>0?`${Math.round(totalPaid/totalAgreed*100)}%`:'—',C.amber]].map(([l,v,c])=>(
          <Card key={l} style={{padding:'14px 16px'}}><div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>{l}</div><div style={{fontSize:20,fontWeight:700,color:c,fontFamily:"'DM Serif Display'"}}>{v}</div></Card>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {rows.map(r => (
          <Card key={r.id} style={{ padding:'12px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{r.name}<span style={{ fontSize:11, color:C.muted, marginLeft:8 }}>{r.section} · {r.rollNo}</span></div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                  {r.dc ? `Monthly: ${fmt(r.agreed)}` : `Annual: ${fmt(r.agreed)}`} · Paid: <b style={{color:C.success}}>{fmt(r.paid)}</b>
                  {!r.dc && <> · Balance: <b style={{color:r.balance>0?C.danger:C.success}}>{fmt(r.balance)}</b></>}
                </div>
                <div style={{ fontSize:11, color:C.muted }}>Last payment: {r.lastDate} · {r.lastMode}</div>
              </div>
              {!r.dc && <ProgressBar value={r.paid} max={r.agreed} />}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ExpenseReport({ expenses }) {
  const [ay, setAy] = useState(() => { const d=new Date(),y=d.getFullYear(),m=d.getMonth()+1,sy=m>=5?y:y-1; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })
  const ayMonths = academicYearMonths(ay)
  const ayExpenses = expenses.filter(e => ayMonths.includes(dateToYM(e.date)))
  const total = ayExpenses.reduce((a,e)=>a+(+e.amount||0),0)
  const byMonth = ayMonths.map(ym => ({ ym, total: ayExpenses.filter(e=>dateToYM(e.date)===ym).reduce((a,e)=>a+(+e.amount||0),0) }))
  const byCat = EXPENSE_CATS.map(cat => ({ cat, total: ayExpenses.filter(e=>e.category===cat).reduce((a,e)=>a+(+e.amount||0),0) })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total)
  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="Academic Year" value={ay} onChange={e=>setAy(e.target.value)}>{academicYearOptions().map(y=><option key={y} value={y}>{y}</option>)}</Select>
        <Btn small variant="ghost" onClick={() => exportCSV(`expense-report-${ay}.csv`, ayExpenses, [{label:'Date',value:'date'},{label:'Category',value:'category'},{label:'Amount',value:'amount'},{label:'Note',value:'note'}])}>Export CSV</Btn>
      </div>
      <Card style={{padding:16,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,color:C.muted,marginBottom:10}}>TOTAL FOR {ay}: <span style={{color:C.amber}}>{fmt(total)}</span></div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {byCat.map(c=><div key={c.cat} style={{background:C.amberLight,borderRadius:8,padding:'6px 12px'}}><div style={{fontSize:11,color:C.muted}}>{c.cat}</div><div style={{fontSize:14,fontWeight:700,color:C.amber}}>{fmt(c.total)}</div></div>)}
        </div>
      </Card>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {byMonth.filter(m=>m.total>0).map(m=>(
          <Card key={m.ym} style={{padding:'10px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,fontSize:14}}>{monthLabel(m.ym)}</span>
              <span style={{fontWeight:700,color:C.amber}}>{fmt(m.total)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AdmissionReport({ students, enquiries }) {
  const [ay, setAy] = useState(() => { const d=new Date(),y=d.getFullYear(),m=d.getMonth()+1,sy=m>=5?y:y-1; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })
  const ayMonths = academicYearMonths(ay)
  const enrolled = students.filter(s => ayMonths.includes(dateToYM(s.enrollDate||'')))
  const byClass = CLASSES.map(c => ({ cls:c, total: students.filter(s=>s.status==='Active'&&s.section===c).length, newThisAY: enrolled.filter(s=>s.section===c).length }))
  const enqList = enquiries||[]
  const convRate = enqList.length>0 ? Math.round(enqList.filter(e=>e.status==='Admitted').length/enqList.length*100) : 0
  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="Academic Year" value={ay} onChange={e=>setAy(e.target.value)}>{academicYearOptions().map(y=><option key={y} value={y}>{y}</option>)}</Select>
        <Btn small variant="ghost" onClick={() => exportCSV(`admission-report-${ay}.csv`, students, [{label:'Admission No',value:'admissionNo'},{label:'Roll No',value:'rollNo'},{label:'Name',value:'name'},{label:'Class',value:'section'},{label:'Status',value:'status'},{label:'Enrolment Date',value:'enrollDate'},{label:'Father',value:'fatherName'},{label:'Father Phone',value:'fatherPhone'},{label:'Mother',value:'motherName'},{label:'Mother Phone',value:'motherPhone'}])}>Export CSV</Btn>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:16}}>
        {[['Total Students',students.filter(s=>s.status==='Active').length,C.teal],['New This AY',enrolled.length,C.success],['Total Enquiries',enqList.length,C.amber],['Conversion %',`${convRate}%`,C.purple]].map(([l,v,c])=>(
          <Card key={l} style={{padding:'14px 16px'}}><div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:'uppercase',marginBottom:4}}>{l}</div><div style={{fontSize:20,fontWeight:700,color:c,fontFamily:"'DM Serif Display'"}}>{v}</div></Card>
        ))}
      </div>
      <Card style={{padding:16,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,color:C.muted,marginBottom:10}}>STUDENTS BY CLASS</div>
        {byClass.map(c=>(
          <div key={c.cls} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:C.bg,borderRadius:8,marginBottom:6}}>
            <span style={{fontWeight:600,fontSize:14}}>{c.cls}</span>
            <span style={{fontSize:13,color:C.muted}}><b style={{color:C.teal}}>{c.total}</b> active · <b style={{color:C.success}}>{c.newThisAY}</b> new this AY</span>
          </div>
        ))}
      </Card>
      <Card style={{padding:16}}>
        <div style={{fontWeight:700,fontSize:13,color:C.muted,marginBottom:10}}>ENQUIRY FUNNEL</div>
        {['New','Follow-up','Admitted','Not Interested'].map(st=>(
          <div key={st} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:C.bg,borderRadius:8,marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:600}}>{st}</span>
            <Badge color={ENQUIRY_STATUS_COLOR[st]}>{enqList.filter(e=>e.status===st).length}</Badge>
          </div>
        ))}
      </Card>
    </div>
  )
}

function AttendanceReport({ students, attendance }) {
  const [cls, setCls] = useState(CLASSES[0])
  const [selYM, setSelYM] = useState(currentYM())
  const ymOptions = Array.from({length:18},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })
  const clsStudents = students.filter(s=>s.status==='Active'&&s.section===cls)
  const dates = attDateRange(selYM)
  const studentSummary = clsStudents.map(s=>({ ...s, present:dates.filter(d=>attendance[`${d}:${s.id}`]==='present').length, absent:dates.filter(d=>attendance[`${d}:${s.id}`]==='absent').length, marked:dates.filter(d=>attendance[`${d}:${s.id}`]!==undefined).length }))
  const dailySummary = dates.map(d=>({ date:d, present:clsStudents.filter(s=>attendance[`${d}:${s.id}`]==='present').length, total:clsStudents.length, marked:clsStudents.some(s=>attendance[`${d}:${s.id}`]!==undefined) }))
  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="Class" value={cls} onChange={e=>setCls(e.target.value)}>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</Select>
        <Select label="Month" value={selYM} onChange={e=>setSelYM(e.target.value)}>{ymOptions.map(y=><option key={y} value={y}>{monthLabel(y)}</option>)}</Select>
        <Btn small variant="ghost" onClick={() => exportCSV(`attendance-${cls}-${selYM}.csv`, studentSummary, [{label:'Name',value:'name'},{label:'Roll No',value:'rollNo'},{label:'Days Present',value:'present'},{label:'Days Absent',value:'absent'},{label:'Days Marked',value:'marked'},{label:'Total Days',value:()=>dates.length}])}>Export CSV</Btn>
      </div>
      <Card style={{padding:16,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,color:C.muted,marginBottom:10}}>STUDENT SUMMARY — {monthLabel(selYM)}</div>
        {studentSummary.length===0?<EmptyState msg="No active students in this class."/>:studentSummary.map(s=>(
          <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:C.bg,borderRadius:8,marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:600}}>{s.name}</span>
            <span style={{fontSize:12,color:C.muted}}><b style={{color:C.success}}>{s.present}P</b> · <b style={{color:C.danger}}>{s.absent}A</b>{s.marked<dates.length&&<> · <b style={{color:C.muted}}>{dates.length-s.marked} unmarked</b></>}</span>
          </div>
        ))}
      </Card>
      <Card style={{padding:16}}>
        <div style={{fontWeight:700,fontSize:13,color:C.muted,marginBottom:10}}>DAILY SUMMARY</div>
        {dailySummary.filter(d=>d.marked).length===0?<EmptyState msg="No attendance marked for this month yet."/>:dailySummary.filter(d=>d.marked).map(d=>(
          <div key={d.date} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 12px',background:C.bg,borderRadius:8,marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:600}}>{d.date}</span>
            <span style={{fontSize:12,color:C.muted}}><b style={{color:C.success}}>{d.present}</b> / {d.total} present</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

function SalaryReport({ teachers, salaryRecords }) {
  const [ay, setAy] = useState(() => { const d=new Date(),y=d.getFullYear(),m=d.getMonth()+1,sy=m>=5?y:y-1; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })
  const ayMonths = academicYearMonths(ay)
  const rows = teachers.map(t => {
    const payments = salaryRecords.filter(r=>r.teacherId===t.id&&ayMonths.includes(r.ym))
    const totalPaid = payments.filter(r=>r.paid).reduce((a,r)=>a+(+r.amount||0),0)
    return { ...t, payments, totalPaid, expectedAY:(+t.salary||0)*12, monthsPaid:payments.filter(r=>r.paid).length }
  })
  const grandTotal = rows.reduce((a,r)=>a+r.totalPaid,0)
  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="Academic Year" value={ay} onChange={e=>setAy(e.target.value)}>{academicYearOptions().map(y=><option key={y} value={y}>{y}</option>)}</Select>
        <Btn small variant="ghost" onClick={() => exportCSV(`salary-report-${ay}.csv`, salaryRecords.filter(r=>r.paid&&ayMonths.includes(r.ym)),[{label:'Month',value:'ym'},{label:'Teacher',value:r=>teachers.find(t=>t.id===r.teacherId)?.name||''},{label:'Amount',value:'amount'},{label:'Paid Date',value:'paidDate'}])}>Export CSV</Btn>
      </div>
      <Card style={{padding:14,marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:13,color:C.muted,fontWeight:600}}>Total Salary Paid ({ay})</span>
        <span style={{fontSize:20,fontWeight:700,color:C.purple,fontFamily:"'DM Serif Display'"}}>{fmt(grandTotal)}</span>
      </Card>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {rows.map(t=>(
          <Card key={t.id} style={{padding:'14px 16px'}}>
            <div style={{fontWeight:700,fontSize:14}}>{t.name}<span style={{fontSize:12,color:C.muted,fontWeight:400,marginLeft:8}}>{t.role}</span></div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>Salary: <b style={{color:C.amber}}>{fmt(t.salary)}</b> · Paid this AY: <b style={{color:C.success}}>{fmt(t.totalPaid)}</b> · {t.monthsPaid} of {ayMonths.length} months</div>
            <ProgressBar value={t.totalPaid} max={t.expectedAY} />
            {t.payments.filter(p=>p.paid).length>0&&(
              <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
                {t.payments.filter(p=>p.paid).map(p=>(
                  <div key={p.id} style={{background:C.purpleLight,borderRadius:8,padding:'3px 10px',fontSize:12}}>
                    <span style={{color:C.purple,fontWeight:600}}>{monthLabel(p.ym)}</span>
                    <span style={{color:C.muted}}> · {fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

const SUB_TABS = [{id:'fee',label:'Fee'},{id:'expense',label:'Expense'},{id:'admission',label:'Admission'},{id:'attendance',label:'Attendance'},{id:'salary',label:'Salary'}]

export default function Reports({ students, teachers, feeRecords, salaryRecords, expenses, attendance, enquiries }) {
  const [sub, setSub] = useState('fee')
  return (
    <div>
      <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal, marginBottom:16 }}>Reports</div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {SUB_TABS.map(t => <Pill key={t.id} active={sub===t.id} onClick={() => setSub(t.id)}>{t.label}</Pill>)}
      </div>
      {sub === 'fee'        && <FeeReport students={students} feeRecords={feeRecords} />}
      {sub === 'expense'    && <ExpenseReport expenses={expenses} />}
      {sub === 'admission'  && <AdmissionReport students={students} enquiries={enquiries} />}
      {sub === 'attendance' && <AttendanceReport students={students} attendance={attendance} />}
      {sub === 'salary'     && <SalaryReport teachers={teachers} salaryRecords={salaryRecords} />}
    </div>
  )
}
