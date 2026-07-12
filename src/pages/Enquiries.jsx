import { useState } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { CLASSES, ENQUIRY_STATUSES, ENQUIRY_STATUS_COLOR } from '../lib/constants'
import { today } from '../lib/utils'
import { Badge, Btn, Input, Select, Card, Modal, EmptyState, Pill } from '../components/ui'

const blankEnquiry = () => ({
  id: null, childName:'', childAge:'', classInterested: CLASSES[0],
  parentName:'', phone:'', altPhone:'', address:'',
  enquiryDate: today(), followUpDate:'', status:'New', notes:'',
})

function EnquiryModal({ modal, onClose, onSubmit }) {
  const [d, setD] = useState(modal.data)
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  return (
    <Modal title={modal.mode === 'add' ? 'New Enquiry' : 'Edit Enquiry'} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
          <Input label="Child's Name" value={d.childName} onChange={e => set('childName', e.target.value)} />
          <Input label="Age" value={d.childAge} onChange={e => set('childAge', e.target.value)} placeholder="e.g. 3" />
        </div>
        <Select label="Class Interested In" value={d.classInterested} onChange={e => set('classInterested', e.target.value)}>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input label="Parent Name *" value={d.parentName} onChange={e => set('parentName', e.target.value)} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Input label="Phone *" value={d.phone} onChange={e => set('phone', e.target.value)} />
          <Input label="Alternate Phone" value={d.altPhone} onChange={e => set('altPhone', e.target.value)} />
        </div>
        <Input label="Address" value={d.address} onChange={e => set('address', e.target.value)} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Input label="Enquiry Date" type="date" value={d.enquiryDate} onChange={e => set('enquiryDate', e.target.value)} />
          <Input label="Follow-up Date" type="date" value={d.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
        </div>
        <Select label="Status" value={d.status} onChange={e => set('status', e.target.value)}>
          {ENQUIRY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <label style={{ fontSize:13, fontWeight:500 }}>Notes
          <textarea value={d.notes} onChange={e => set('notes', e.target.value)} rows={3}
            placeholder="What did they ask? Any concerns?"
            style={{ display:'block', width:'100%', marginTop:4, padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, resize:'vertical' }} />
        </label>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => {
            if (!d.parentName.trim()) return alert('Parent name is required')
            if (!d.phone.trim()) return alert('Phone number is required')
            onSubmit(d)
          }}>Save</Btn>
        </div>
      </div>
    </Modal>
  )
}

export default function Enquiries({ enquiries, setEnquiries, onConvertToAdmission }) {
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const todayStr = today()

  const submit = async data => {
    const result = await DB.saveEnquiry(data)
    if (!result) return
    if (modal.mode === 'add') setEnquiries(prev => [result, ...prev])
    else setEnquiries(prev => prev.map(e => e.id === result.id ? result : e))
    setModal(null)
  }

  const setStatus = async (id, status) => {
    const result = await DB.setEnquiryStatus(id, status)
    if (result) setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  const del = async id => {
    await DB.deleteEnquiry(id)
    setEnquiries(prev => prev.filter(e => e.id !== id))
  }

  const overdueEnq = enquiries.filter(e => e.followUpDate && e.followUpDate < todayStr && e.status !== 'Admitted' && e.status !== 'Not Interested')
  const dueTodayEnq = enquiries.filter(e => e.followUpDate === todayStr && e.status !== 'Admitted' && e.status !== 'Not Interested')

  const filtered = enquiries.filter(e =>
    (statusFilter === 'All' || e.status === statusFilter) &&
    (e.childName.toLowerCase().includes(search.toLowerCase()) ||
     e.parentName?.toLowerCase().includes(search.toLowerCase()) ||
     e.phone?.includes(search))
  ).sort((a,b) => {
    if (a.followUpDate && b.followUpDate) return a.followUpDate.localeCompare(b.followUpDate)
    if (a.followUpDate) return -1
    if (b.followUpDate) return 1
    return b.enquiryDate.localeCompare(a.enquiryDate)
  })

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal }}>Enquiries</div>
        <Btn onClick={() => setModal({ mode:'add', data: blankEnquiry() })}>+ New Enquiry</Btn>
      </div>
      {(overdueEnq.length > 0 || dueTodayEnq.length > 0) && (
        <Card style={{ padding:'12px 16px', marginBottom:16, background: C.amberLight, border:`1px solid ${C.amber}` }}>
          <div style={{ fontSize:13, fontWeight:700, color: C.amber }}>
            {overdueEnq.length > 0 && `${overdueEnq.length} follow-up${overdueEnq.length>1?'s':''} overdue`}
            {overdueEnq.length > 0 && dueTodayEnq.length > 0 && ' · '}
            {dueTodayEnq.length > 0 && `${dueTodayEnq.length} due today`}
          </div>
        </Card>
      )}
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search child, parent, or phone..."
          style={{ flex:1, minWidth:180, padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, outline:'none' }} />
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <Pill active={statusFilter==='All'} onClick={() => setStatusFilter('All')}>All</Pill>
        {ENQUIRY_STATUSES.map(s => <Pill key={s} active={statusFilter===s} onClick={() => setStatusFilter(s)}>{s}</Pill>)}
      </div>
      {filtered.length === 0 ? <EmptyState msg="No enquiries yet. Add the first walk-in or phone enquiry!" /> :
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(e => {
            const isOverdue = e.followUpDate && e.followUpDate < todayStr && e.status !== 'Admitted' && e.status !== 'Not Interested'
            return (
              <Card key={e.id} style={{ padding:'14px 18px', border: isOverdue ? `1.5px solid ${C.danger}` : undefined }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>
                      {e.childName || '(child name not given)'}
                      {e.childAge && <span style={{ fontSize:12, color: C.muted, fontWeight:400 }}> · age {e.childAge}</span>}
                      <span style={{ marginLeft:8 }}><Badge color={ENQUIRY_STATUS_COLOR[e.status]}>{e.status}</Badge></span>
                    </div>
                    <div style={{ fontSize:12, color: C.muted }}>Interested in: {e.classInterested}</div>
                    <div style={{ fontSize:12, color: C.muted, marginTop:2 }}>
                      Parent: <b>{e.parentName}</b>
                      {e.phone && <> · <a href={`tel:${e.phone}`} style={{ color: C.teal }}>{e.phone}</a></>}
                      {e.altPhone && <> / {e.altPhone}</>}
                    </div>
                    {e.address && <div style={{ fontSize:12, color: C.muted, marginTop:2 }}>{e.address}</div>}
                    <div style={{ fontSize:12, color: C.muted, marginTop:4 }}>
                      Enquired: {e.enquiryDate}
                      {e.followUpDate && <span style={{ marginLeft:8, color: isOverdue ? C.danger : C.text, fontWeight: isOverdue ? 700 : 400 }}>
                        · Follow-up: {e.followUpDate}{isOverdue ? ' (overdue)' : ''}
                      </span>}
                    </div>
                    {e.notes && <div style={{ fontSize:12, color: C.muted, marginTop:4, fontStyle:'italic' }}>{e.notes}</div>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'flex-end' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      {e.status === 'Admitted' && <Btn small variant="primary" onClick={() => onConvertToAdmission && onConvertToAdmission(e)}>Add to Students</Btn>}
                      <Btn small variant="ghost" onClick={() => setModal({ mode:'edit', data: { ...e } })}>Edit</Btn>
                      <Btn small variant="danger" onClick={() => del(e.id)}>Delete</Btn>
                    </div>
                    <select value={e.status} onChange={ev => setStatus(e.id, ev.target.value)}
                      style={{ padding:'5px 8px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:600, color: ENQUIRY_STATUS_COLOR[e.status], background:'#fff', cursor:'pointer' }}>
                      {ENQUIRY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      }
      {modal && <EnquiryModal modal={modal} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  )
}
