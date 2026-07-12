import { useState } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { EXPENSE_CATS } from '../lib/constants'
import { fmt, today, currentYM, monthLabel, exportCSV } from '../lib/utils'
import { Badge, Btn, Input, Select, Card, Modal, EmptyState } from '../components/ui'

export default function Expenses({ expenses, setExpenses }) {
  const [selYM, setSelYM] = useState(currentYM())
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ date: today(), category:'Rent', amount:'', note:'' })
  const ymOptions = Array.from({length:18},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })

  const filtered = expenses.filter(e => e.date?.startsWith(selYM))
  const total = filtered.reduce((a,e) => a + (+e.amount||0), 0)
  const byCat = EXPENSE_CATS.map(cat => ({ cat, total: filtered.filter(e=>e.category===cat).reduce((a,e)=>a+(+e.amount||0),0) })).filter(c=>c.total>0)

  const addExpense = async () => {
    if (!form.amount) return alert('Amount required')
    const saved = await DB.saveExpense(form)
    if (!saved) return
    setExpenses(prev => [saved, ...prev])
    setForm({ date: today(), category:'Rent', amount:'', note:'' })
    setModal(false)
  }

  const del = async e => {
    if (e.linkedSalary) return alert('This expense is auto-generated from a salary payment. Undo the salary payment in the Staff tab to remove it.')
    await DB.deleteExpense(e.id)
    setExpenses(prev => prev.filter(x => x.id !== e.id))
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal }}>Expenses</div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="ghost" small onClick={() => exportCSV(`expenses-${selYM}.csv`, filtered, [
            { label:'Date', value:'date' }, { label:'Category', value:'category' },
            { label:'Amount', value:'amount' }, { label:'Note', value:'note' },
          ])}>Export CSV</Btn>
          <Btn onClick={() => setModal(true)}>+ Add Expense</Btn>
        </div>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
        <Select label="" value={selYM} onChange={e => setSelYM(e.target.value)}>
          {ymOptions.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
        </Select>
        <div style={{ fontSize:14, color: C.muted }}>Total: <b style={{ color: C.amber }}>{fmt(total)}</b></div>
      </div>
      {byCat.length > 0 && (
        <Card style={{ padding:16, marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:12, marginBottom:10, color: C.muted, letterSpacing:.4 }}>SUMMARY</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {byCat.map(c => (
              <div key={c.cat} style={{ background: C.amberLight, borderRadius:8, padding:'6px 12px' }}>
                <div style={{ fontSize:11, color: C.muted }}>{c.cat}</div>
                <div style={{ fontSize:14, fontWeight:700, color: C.amber }}>{fmt(c.total)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {filtered.length === 0 ? <EmptyState msg="No expenses recorded for this month." /> :
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[...filtered].sort((a,b)=>b.date.localeCompare(a.date)).map(e => (
            <Card key={e.id} style={{ padding:'10px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{e.category} {e.linkedSalary && <Badge color={C.purple}>Auto</Badge>}</div>
                  <div style={{ fontSize:12, color: C.muted }}>{e.date}{e.note ? ` · ${e.note}` : ''}</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontWeight:700, color: C.amber }}>{fmt(e.amount)}</span>
                  <Btn small variant="danger" onClick={() => del(e)}>✕</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }
      {modal && (
        <Modal title="Add Expense" onClose={() => setModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} />
            <Select label="Category" value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
              {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
            </Select>
            <Input label="Amount (Rs.) *" type="number" value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))} />
            <Input label="Note (optional)" value={form.note} onChange={e => setForm(p=>({...p,note:e.target.value}))} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn onClick={addExpense}>Save</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
