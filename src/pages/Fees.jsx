import { useState } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { CLASSES, PAYMENT_MODES, isDaycare } from '../lib/constants'
import { fmt, today, currentYM, monthLabel, academicYearOptions, academicYearMonths, dateToYM, endOfMonth, exportCSV } from '../lib/utils'
import { Badge, Btn, Input, Select, Card, Modal, EmptyState, ProgressBar } from '../components/ui'

function YearGridModal({ student, feeRecords, ay, onClose }) {
  const ayMonths = academicYearMonths(ay)
  const perMonth = (+student.annualFee || 0) / 12
  const payments = feeRecords.filter(r => r.studentId === student.id && r.academicYear === ay)
  const rows = ayMonths.map((ym, idx) => {
    const monthAmt = payments.filter(r => dateToYM(r.date) === ym).reduce((a,r)=>a+(+r.amount||0),0)
    const expectedTillNow = perMonth * (idx + 1)
    const expectedTillPrev = perMonth * idx
    const cumPaid = payments.filter(r => r.date <= endOfMonth(ym)).reduce((a,r)=>a+(+r.amount||0),0)
    const status = cumPaid >= expectedTillNow - 0.5 ? 'paid' : cumPaid > expectedTillPrev + 0.5 ? 'partial' : 'pending'
    return { ym, monthAmt, status }
  })
  const statusColor = { paid: C.success, partial: C.amber, pending: C.danger }
  const statusLabel = { paid: 'Paid', partial: 'Partial', pending: 'Pending' }
  return (
    <Modal title={`${student.name} — ${ay} Fee Grid`} onClose={onClose}>
      <div style={{ fontSize:12, color: C.muted, marginBottom:12 }}>
        Annual fee {fmt(student.annualFee)} / 12 = {fmt(Math.round(perMonth))}/month expected pace
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {rows.map(r => (
          <div key={r.ym} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: C.bg, borderRadius:8 }}>
            <span style={{ fontSize:13, fontWeight:600, width:90 }}>{monthLabel(r.ym)}</span>
            <span style={{ fontSize:12, color: C.muted, flex:1 }}>{r.monthAmt > 0 ? `paid ${fmt(r.monthAmt)} this month` : '—'}</span>
            <Badge color={statusColor[r.status]} bg={statusColor[r.status] + '22'}>{statusLabel[r.status]}</Badge>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default function Fees({ students, feeRecords, setFeeRecords, onOpenReceipt }) {
  const [ay, setAy] = useState(() => { const d=new Date(),y=d.getFullYear(),m=d.getMonth()+1,sy=m>=5?y:y-1; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })
  const [cls, setCls] = useState('All')
  const [monthFilter, setMonthFilter] = useState('All')
  const [payModal, setPayModal] = useState(null)
  const [gridModal, setGridModal] = useState(null)
  const [histModal, setHistModal] = useState(null)
  const [payForm, setPayForm] = useState({ date: today(), amount:'', note:'', paymentMode:'PhonePe', transactionId:'' })

  const active = students.filter(s => s.status === 'Active')
  const classFiltered = cls === 'All' ? active : active.filter(s => s.section === cls)
  const ayOptions = academicYearOptions()
  const ayMonthOptions = academicYearMonths(ay)

  const paymentsForAY = sid => feeRecords.filter(r => r.studentId === sid && r.academicYear === ay)
  const totalPaidAY = sid => paymentsForAY(sid).reduce((a,r) => a + (+r.amount||0), 0)
  const totalPaidMonth = (sid, ym) => feeRecords.filter(r => r.studentId === sid && dateToYM(r.date) === ym).reduce((a,r)=>a+(+r.amount||0),0)
  const studentAgreed = s => isDaycare(s.section) ? (+s.monthlyFee||0) : (+s.annualFee||0)
  const totalExpected = classFiltered.reduce((a,s) => a + (isDaycare(s.section) ? 0 : studentAgreed(s)), 0)
  const totalCollected = classFiltered.reduce((a,s) => a + (isDaycare(s.section) ? 0 : totalPaidAY(s.id)), 0)

  const collectedInMonth = monthFilter === 'All' ? null : classFiltered.reduce((a,s) => a + totalPaidMonth(s.id, monthFilter), 0)
  const paymentsInMonth = monthFilter === 'All' ? [] : feeRecords.filter(r => classFiltered.some(s => s.id === r.studentId) && dateToYM(r.date) === monthFilter)

  const savePayment = async () => {
    if (!payForm.amount || +payForm.amount <= 0) return alert('Enter a valid amount')
    const newRec = await DB.saveFeePayment(payForm, payModal.student)
    if (!newRec) return
    setFeeRecords(prev => [newRec, ...prev])
    setPayModal(null)
    if (onOpenReceipt) onOpenReceipt(newRec, payModal.student)
  }

  const deletePayment = async id => {
    await DB.deleteFeePayment(id)
    setFeeRecords(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal }}>Fee Collection</div>
        <Btn variant="ghost" small onClick={() => {
          const ids = new Set(classFiltered.map(s => s.id))
          const rows = feeRecords.filter(r => ids.has(r.studentId) && r.academicYear === ay && (monthFilter === 'All' || dateToYM(r.date) === monthFilter))
          exportCSV(`fee-payments-${ay}${cls!=='All'?'-'+cls:''}.csv`, rows, [
            { label:'Date', value:'date' }, { label:'Student', value: r => students.find(s=>s.id===r.studentId)?.name||'' },
            { label:'Roll No', value: r => students.find(s=>s.id===r.studentId)?.rollNo||'' },
            { label:'Amount', value:'amount' }, { label:'Mode', value:'paymentMode' },
            { label:'Transaction ID', value:'transactionId' }, { label:'Receipt No', value:'receiptNo' }, { label:'Note', value:'note' },
          ])
        }}>Export CSV</Btn>
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap', marginBottom:10 }}>
        <Select label="Academic Year" value={ay} onChange={e => { setAy(e.target.value); setMonthFilter('All') }}>
          {ayOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select label="Class" value={cls} onChange={e => setCls(e.target.value)}>
          <option value="All">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select label="Month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="All">Whole Year</option>
          {ayMonthOptions.map(y => <option key={y} value={y}>{monthLabel(y)}</option>)}
        </Select>
      </div>

      <div style={{ marginBottom:16 }}>
        {monthFilter === 'All' ? (
          <div style={{ fontSize:13, color: C.muted }}>Annual classes: <b style={{ color: C.success }}>{fmt(totalCollected)}</b> of <b>{fmt(totalExpected)}</b> collected ({ay})</div>
        ) : (
          <Card style={{ padding:'12px 16px' }}>
            <div style={{ fontSize:13, color: C.muted }}>Collected in <b style={{ color: C.text }}>{monthLabel(monthFilter)}</b>: <b style={{ color: C.success }}>{fmt(collectedInMonth)}</b> across {paymentsInMonth.length} payment{paymentsInMonth.length!==1?'s':''}</div>
            {paymentsInMonth.length > 0 && (
              <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                {[...paymentsInMonth].sort((a,b)=>b.date.localeCompare(a.date)).map(r => {
                  const st = students.find(s=>s.id===r.studentId)
                  return (
                    <div key={r.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color: C.muted }}>
                      <span>{st?.name||'Unknown'} · {r.date} · {r.paymentMode}</span>
                      <b style={{ color: C.success }}>{fmt(r.amount)}</b>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      {classFiltered.length === 0 ? <EmptyState msg="No students in this class yet." /> :
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {classFiltered.map(s => {
            const dc = isDaycare(s.section)
            const agreed = studentAgreed(s)
            const paidThisMonth = totalPaidMonth(s.id, currentYM())
            const paidAY = totalPaidAY(s.id)
            const balance = dc ? (agreed - paidThisMonth) : (agreed - paidAY)
            const fullyPaid = !dc && balance <= 0
            return (
              <Card key={s.id} style={{ padding:'14px 18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{s.name}<span style={{ fontSize:12, color: C.muted, fontWeight:400, marginLeft:8 }}>{s.section} · {s.rollNo}</span></div>
                    {dc ? (
                      <div style={{ fontSize:12, color: C.muted, marginTop:2 }}>Monthly fee: <b style={{ color: C.amber }}>{fmt(agreed)}</b> · Paid this month: <b style={{ color: C.success }}>{fmt(paidThisMonth)}</b></div>
                    ) : (
                      <>
                        <div style={{ fontSize:12, color: C.muted, marginTop:2 }}>Annual fee: <b style={{ color: C.amber }}>{fmt(agreed)}</b> · Paid: <b style={{ color: C.success }}>{fmt(paidAY)}</b> · Balance: <b style={{ color: fullyPaid ? C.success : C.danger }}>{fmt(Math.max(0,balance))}</b></div>
                        <ProgressBar value={paidAY} max={agreed} />
                      </>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
                    {!dc && <Btn small variant="ghost" onClick={() => setGridModal({ student: s })}>Year Grid</Btn>}
                    {paymentsForAY(s.id).length > 0 && <Btn small variant="ghost" onClick={() => setHistModal({ student: s })}>History</Btn>}
                    {(dc || !fullyPaid) && <Btn small variant="amber" onClick={() => { setPayForm({ date: today(), amount:'', note:'', paymentMode:'PhonePe', transactionId:'' }); setPayModal({ student: s }) }}>+ Record Payment</Btn>}
                    {!dc && fullyPaid && <Badge color={C.success} bg="#C6EDD9">Fully Paid</Badge>}
                  </div>
                </div>
                {paymentsForAY(s.id).length > 0 && (
                  <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
                    {[...paymentsForAY(s.id)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(r => (
                      <div key={r.id} style={{ display:'flex', alignItems:'center', gap:6, background: C.tealLight, borderRadius:8, padding:'4px 10px', fontSize:12 }}>
                        <span style={{ color: C.teal, fontWeight:600 }}>{fmt(r.amount)}</span>
                        <span style={{ color: C.muted }}>{r.date} · {r.paymentMode}</span>
                        <button onClick={() => onOpenReceipt && onOpenReceipt(r, s)} style={{ background:'none', border:'none', color: C.amber, cursor:'pointer', fontSize:11, fontWeight:700, textDecoration:'underline' }}>Receipt</button>
                        <button onClick={() => deletePayment(r.id)} style={{ background:'none', border:'none', color: C.muted, cursor:'pointer', fontSize:12 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      }

      {payModal && (
        <Modal title={`Record Payment — ${payModal.student.name}`} onClose={() => setPayModal(null)}>
          <div style={{ marginBottom:14, padding:'10px 14px', background: C.amberLight, borderRadius:10, fontSize:13 }}>
            {isDaycare(payModal.student.section)
              ? <>Monthly fee: <b>{fmt(payModal.student.monthlyFee)}</b> · Paid this month: <b style={{color:C.success}}>{fmt(totalPaidMonth(payModal.student.id, currentYM()))}</b></>
              : <>Annual fee: <b>{fmt(payModal.student.annualFee)}</b> · Paid so far: <b style={{color:C.success}}>{fmt(totalPaidAY(payModal.student.id))}</b> · Balance: <b style={{color:C.danger}}>{fmt(Math.max(0,(+payModal.student.annualFee||0)-totalPaidAY(payModal.student.id)))}</b></>
            }
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Input label="Date of Payment" type="date" value={payForm.date} onChange={e => setPayForm(p=>({...p,date:e.target.value}))} />
            <Input label="Amount Received (Rs.) *" type="number" value={payForm.amount} onChange={e => setPayForm(p=>({...p,amount:e.target.value}))} />
            <Select label="Payment Mode" value={payForm.paymentMode} onChange={e => setPayForm(p=>({...p,paymentMode:e.target.value}))}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input label="Transaction ID (optional)" value={payForm.transactionId} onChange={e => setPayForm(p=>({...p,transactionId:e.target.value}))} />
            <Input label="Note (optional)" value={payForm.note} onChange={e => setPayForm(p=>({...p,note:e.target.value}))} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
              <Btn variant="ghost" onClick={() => setPayModal(null)}>Cancel</Btn>
              <Btn onClick={savePayment}>Save & Generate Receipt</Btn>
            </div>
          </div>
        </Modal>
      )}

      {gridModal && <YearGridModal student={gridModal.student} feeRecords={feeRecords} ay={ay} onClose={() => setGridModal(null)} />}

      {histModal && (
        <Modal title={`Payment History — ${histModal.student.name}`} onClose={() => setHistModal(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[...feeRecords].filter(r => r.studentId === histModal.student.id).sort((a,b)=>b.date.localeCompare(a.date)).map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background: C.bg, borderRadius:8, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color: C.success }}>{fmt(r.amount)}</div>
                  <div style={{ fontSize:12, color: C.muted }}>{r.date} · {r.paymentMode} · AY {r.academicYear}{r.note ? ` · ${r.note}` : ''}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <Btn small variant="amber" onClick={() => onOpenReceipt && onOpenReceipt(r, histModal.student)}>Receipt</Btn>
                  <Btn small variant="danger" onClick={() => deletePayment(r.id)}>Delete</Btn>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
