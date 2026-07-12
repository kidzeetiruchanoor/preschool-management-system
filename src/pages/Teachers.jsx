import { useState } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { fmt, today, currentYM, monthLabel } from '../lib/utils'
import { Badge, Btn, Input, Select, Card, Modal, EmptyState } from '../components/ui'

const ROLES = ['Teacher','Assistant Teacher','Coordinator','Admin','Support Staff']
const blankTeacher = () => ({ id:null, name:'', phone:'', role:'Teacher', joinDate: today(), salary:'', aadhaar:'', active:true, notes:'', driveLink:'' })

function TeacherForm({ data: init, onSubmit, onClose }) {
  const [d, setD] = useState(init)
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Input label="Name *" value={d.name} onChange={e => set('name', e.target.value)} />
      <Select label="Role" value={d.role} onChange={e => set('role', e.target.value)}>{ROLES.map(r=><option key={r}>{r}</option>)}</Select>
      <Input label="Phone" value={d.phone} onChange={e => set('phone', e.target.value)} />
      <Input label="Join Date" type="date" value={d.joinDate} onChange={e => set('joinDate', e.target.value)} />
      <Input label="Monthly Salary (Rs.)" type="number" value={d.salary} onChange={e => set('salary', e.target.value)} />
      <Input label="Aadhaar Number" value={d.aadhaar} onChange={e => set('aadhaar', e.target.value.replace(/\D/g,'').slice(0,12))} placeholder="12-digit Aadhaar" />
      <div style={{ background: C.tealLight, borderRadius:10, padding:'12px 14px' }}>
        <div style={{ fontSize:12, fontWeight:600, color: C.teal, marginBottom:8 }}>📁 DOCUMENTS (Google Drive)</div>
        <Input label="Google Drive Folder Link" value={d.driveLink||''} onChange={e => set('driveLink', e.target.value)} placeholder="Paste shared Drive folder URL" />
        <div style={{ fontSize:11, color: C.muted, marginTop:6 }}>Upload Aadhaar, degree certificate, PAN, photo and paste the share link.</div>
      </div>
      <label style={{ fontSize:13, fontWeight:500 }}>Notes
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} rows={2}
          style={{ display:'block', width:'100%', marginTop:4, padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, resize:'vertical' }} />
      </label>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => { if (!d.name.trim()) return alert('Name required'); onSubmit(d) }}>Save</Btn>
      </div>
    </div>
  )
}

export default function Teachers({ teachers, setTeachers, salaryRecords, setSalaryRecords, expenses, setExpenses }) {
  const [modal, setModal] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [selYM, setSelYM] = useState(currentYM())
  const ymOptions = Array.from({length:18},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })

  const submit = async data => {
    const result = await DB.saveStaff(data)
    if (!result) return
    if (modal.mode === 'add') setTeachers(prev => [...prev, result])
    else setTeachers(prev => prev.map(t => t.id === result.id ? result : t))
    setModal(null)
  }

  const getPaid = tid => salaryRecords.find(r => r.teacherId === tid && r.ym === selYM && r.paid)

  const confirmPay = async () => {
    const t = payModal.teacher
    const amount = +payAmount
    if (!amount || amount <= 0) return alert('Enter a valid amount')
    const result = await DB.markSalaryPaid(t.id, selYM, amount)
    if (!result) return
    setSalaryRecords(prev => [...prev, result.salRec])
    if (result.expense) setExpenses(prev => [result.expense, ...prev])
    setPayModal(null)
  }

  const markUnpaid = async t => {
    const result = await DB.markSalaryUnpaid(t.id, selYM)
    if (!result) return
    setSalaryRecords(prev => prev.filter(r => r.id !== result.salaryId))
    if (result.expenseId) setExpenses(prev => prev.filter(e => e.id !== result.expenseId))
  }

  const toggle = async id => {
    const t = teachers.find(x => x.id === id)
    if (!t) return
    await DB.setStaffActive(id, !t.active)
    setTeachers(prev => prev.map(x => x.id === id ? { ...x, active: !x.active } : x))
  }

  const active = teachers.filter(t => t.active)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal }}>Teachers & Staff</div>
        <Btn onClick={() => setModal({ mode:'add', data: blankTeacher() })}>+ Add Staff</Btn>
      </div>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:13, fontWeight:600 }}>Salary for:</span>
        <Select label="" value={selYM} onChange={e => setSelYM(e.target.value)}>
          {ymOptions.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
        </Select>
      </div>
      {active.length === 0 ? <EmptyState msg="No staff added yet." /> :
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {active.map(t => {
            const rec = getPaid(t.id)
            return (
              <Card key={t.id} style={{ padding:'12px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>{t.name} <span style={{ fontSize:12, color: C.muted }}>· {t.role}</span></div>
                    <div style={{ fontSize:12, color: C.muted }}>
                      Salary: <b style={{ color: C.amber }}>{fmt(t.salary)}</b>
                      {t.aadhaar && <> · Aadhaar: {t.aadhaar}</>}
                      {rec && <> · Paid: <b style={{ color: C.success }}>{fmt(rec.amount)}</b> on {rec.paidDate} (auto-logged as expense)</>}
                    </div>
                    {t.driveLink && (
                      <a href={t.driveLink} target="_blank" rel="noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:6, fontSize:12, fontWeight:600, color: C.teal, textDecoration:'none', background: C.tealLight, padding:'3px 10px', borderRadius:8 }}>
                        📁 View Documents
                      </a>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <Btn small variant="ghost" onClick={() => setModal({ mode:'edit', data: { ...t } })}>Edit</Btn>
                    {rec
                      ? <><Badge color={C.success} bg="#C6EDD9">Paid</Badge><Btn small variant="ghost" onClick={() => markUnpaid(t)}>Undo</Btn></>
                      : <Btn small variant="amber" onClick={() => { setPayAmount(String(t.salary||'')); setPayModal({ teacher: t }) }}>Mark Paid</Btn>
                    }
                    <Btn small variant={t.active ? 'danger' : 'primary'} onClick={() => toggle(t.id)}>{t.active ? 'Deactivate' : 'Activate'}</Btn>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      }
      {modal && (
        <Modal title={modal.mode === 'add' ? 'Add Staff' : 'Edit Staff'} onClose={() => setModal(null)}>
          <TeacherForm data={modal.data} onSubmit={submit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {payModal && (
        <Modal title={`Mark Salary Paid — ${payModal.teacher.name}`} onClose={() => setPayModal(null)}>
          <div style={{ marginBottom:14, padding:'10px 14px', background: C.amberLight, borderRadius:10, fontSize:13 }}>
            Month: <b>{monthLabel(selYM)}</b> &nbsp;·&nbsp; Standard salary: <b>{fmt(payModal.teacher.salary)}</b>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Input label="Amount Paid (Rs.) *" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={`Default: ${payModal.teacher.salary}`} />
            <div style={{ fontSize:12, color: C.muted }}>This will automatically create a Salary expense entry for {monthLabel(selYM)}.</div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
              <Btn variant="ghost" onClick={() => setPayModal(null)}>Cancel</Btn>
              <Btn onClick={confirmPay}>Confirm Payment</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
