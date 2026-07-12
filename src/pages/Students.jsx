import { useState, useEffect } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { CLASSES, STUDENT_STATUSES, STUDENT_STATUS_COLOR, isDaycare } from '../lib/constants'
import { fmt, today, currentAcademicYear, academicYearOptions, monthLabel } from '../lib/utils'
import { Badge, Btn, Input, Select, Card, Modal, EmptyState, Pill } from '../components/ui'

const blankStudent = () => ({
  id: null, admissionNo:'', rollNo:'', name:'', dob:'', section:'Playgroup', aadhaar:'',
  fatherName:'', fatherPhone:'', motherName:'', motherPhone:'',
  address:'', enrollDate: today(), monthlyFee:'', annualFee:'', status:'Active', notes:'', driveLink:'',
})

function StudentModal({ modal, onClose, onSubmit }) {
  const [d, setD] = useState(modal.data)
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))
  const dc = isDaycare(d.section)
  return (
    <Modal title={modal.mode === 'add' ? 'Add Student' : 'Edit Student'} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {modal.mode === 'edit' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Input label="Admission No" value={d.admissionNo} readOnly />
            <Input label="Roll No" value={d.rollNo} readOnly />
          </div>
        )}
        {modal.mode === 'add' && (
          <div style={{ fontSize:12, color: C.muted, background: C.tealLight, padding:'8px 12px', borderRadius:8 }}>
            Admission No and Roll No will be generated automatically on save.
          </div>
        )}
        <Input label="Student Name *" value={d.name} onChange={e => set('name', e.target.value)} />
        <Input label="Date of Birth" type="date" value={d.dob} onChange={e => set('dob', e.target.value)} />
        <Select label="Class *" value={d.section} onChange={e => set('section', e.target.value)}>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input label="Enrolment Date" type="date" value={d.enrollDate} onChange={e => set('enrollDate', e.target.value)} />
        {dc
          ? <Input label="Monthly Fee (Rs.) *" type="number" value={d.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} placeholder="Daycare fee" />
          : <Input label="Annual Fee (Rs.) *" type="number" value={d.annualFee} onChange={e => set('annualFee', e.target.value)} placeholder="e.g. 37000 for full year" />
        }
        <Input label="Aadhaar Number" value={d.aadhaar} onChange={e => set('aadhaar', e.target.value.replace(/\D/g,'').slice(0,12))} placeholder="12-digit Aadhaar" />
        <div style={{ background: C.tealLight, borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:12, fontWeight:600, color: C.teal, marginBottom:10 }}>FATHER'S DETAILS</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Input label="Father's Name" value={d.fatherName} onChange={e => set('fatherName', e.target.value)} />
            <Input label="Father's Phone" value={d.fatherPhone} onChange={e => set('fatherPhone', e.target.value)} />
          </div>
        </div>
        <div style={{ background: C.amberLight, borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:12, fontWeight:600, color: C.amber, marginBottom:10 }}>MOTHER'S DETAILS</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Input label="Mother's Name" value={d.motherName} onChange={e => set('motherName', e.target.value)} />
            <Input label="Mother's Phone" value={d.motherPhone} onChange={e => set('motherPhone', e.target.value)} />
          </div>
        </div>
        <Input label="Address" value={d.address} onChange={e => set('address', e.target.value)} />
        <div style={{ background: C.tealLight, borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:12, fontWeight:600, color: C.teal, marginBottom:8 }}>📁 DOCUMENTS (Google Drive)</div>
          <Input label="Google Drive Folder Link" value={d.driveLink || ''} onChange={e => set('driveLink', e.target.value)} placeholder="Paste shared Drive folder URL" />
          <div style={{ fontSize:11, color: C.muted, marginTop:6 }}>Create a folder in Google Drive, upload Aadhaar, birth certificate and photo, paste the share link above.</div>
        </div>
        <Select label="Status" value={d.status || 'Active'} onChange={e => set('status', e.target.value)}>
          {STUDENT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
        </Select>
        <label style={{ fontSize:13, fontWeight:500 }}>Notes
          <textarea value={d.notes} onChange={e => set('notes', e.target.value)} rows={2}
            style={{ display:'block', width:'100%', marginTop:4, padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, resize:'vertical' }} />
        </label>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={() => {
            if (!d.name.trim()) return alert('Student name is required')
            if (dc && !d.monthlyFee) return alert('Monthly fee is required for Daycare')
            if (!dc && !d.annualFee) return alert('Annual fee is required for this class')
            onSubmit(d)
          }}>Save</Btn>
        </div>
      </div>
    </Modal>
  )
}

function StudentsTable({ students, setStudents, convertEnquiry, onConvertDone }) {
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Active')

  useEffect(() => {
    if (convertEnquiry) {
      const pre = blankStudent()
      pre.fatherName = convertEnquiry.parentName || ''
      pre.fatherPhone = convertEnquiry.phone || ''
      pre.motherPhone = convertEnquiry.altPhone || ''
      pre.address = convertEnquiry.address || ''
      pre.section = convertEnquiry.classInterested || 'Playgroup'
      pre.name = convertEnquiry.childName || ''
      setModal({ mode:'add', data: pre })
      onConvertDone && onConvertDone()
    }
  }, [convertEnquiry])

  const filtered = students.filter(s =>
    (statusFilter === 'All' || s.status === statusFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
     s.fatherName?.toLowerCase().includes(search.toLowerCase()) ||
     s.motherName?.toLowerCase().includes(search.toLowerCase()) ||
     s.rollNo?.toLowerCase().includes(search.toLowerCase()) ||
     s.admissionNo?.toLowerCase().includes(search.toLowerCase()))
  )

  const submit = async data => {
    const result = await DB.saveStudent(data)
    if (!result) return
    if (modal.mode === 'add') setStudents(prev => [...prev, result])
    else setStudents(prev => prev.map(s => s.id === result.id ? result : s))
    setModal(null)
  }

  const setStatus = async (id, status) => {
    await DB.setStudentStatus(id, status)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontFamily:"'DM Serif Display'", fontSize:22, color: C.teal }}>Students</div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="ghost" small onClick={async () => {
            const { exportCSV } = await import('../lib/utils')
            exportCSV('students.csv', students, [
              { label:'Admission No', value:'admissionNo' }, { label:'Roll No', value:'rollNo' },
              { label:'Name', value:'name' }, { label:'DOB', value:'dob' }, { label:'Class', value:'section' },
              { label:'Aadhaar', value:'aadhaar' }, { label:'Father Name', value:'fatherName' },
              { label:'Father Phone', value:'fatherPhone' }, { label:'Mother Name', value:'motherName' },
              { label:'Mother Phone', value:'motherPhone' }, { label:'Address', value:'address' },
              { label:'Enrolment Date', value:'enrollDate' }, { label:'Monthly Fee', value:'monthlyFee' },
              { label:'Annual Fee', value:'annualFee' }, { label:'Status', value:'status' }, { label:'Drive Link', value:'driveLink' },
            ])
          }}>Export CSV</Btn>
          <Btn onClick={() => setModal({ mode:'add', data: blankStudent() })}>+ Add Student</Btn>
        </div>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, parent, roll no..."
          style={{ flex:1, minWidth:180, padding:'8px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, outline:'none' }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <Pill active={statusFilter==='Active'} onClick={() => setStatusFilter('Active')}>Active</Pill>
          {STUDENT_STATUSES.filter(s=>s!=='Active').map(s => (
            <Pill key={s} active={statusFilter===s} onClick={() => setStatusFilter(s)}>{s}</Pill>
          ))}
          <Pill active={statusFilter==='All'} onClick={() => setStatusFilter('All')}>All</Pill>
        </div>
      </div>
      {filtered.length === 0 ? <EmptyState msg="No students found." /> :
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(s => (
            <Card key={s.id} style={{ padding:'14px 18px', opacity: s.status !== 'Active' ? 0.75 : 1, borderLeft:`4px solid ${STUDENT_STATUS_COLOR[s.status] || C.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>
                    {s.name} {s.status !== 'Active' && <Badge color={STUDENT_STATUS_COLOR[s.status]}>{s.status}</Badge>}
                  </div>
                  <div style={{ fontSize:12, color: C.muted }}>Roll: <b>{s.rollNo}</b> &nbsp;·&nbsp; Admission: <b>{s.admissionNo}</b></div>
                  <div style={{ fontSize:12, color: C.muted, marginTop:2 }}>
                    {s.fatherName && <span>Father: {s.fatherName}{s.fatherPhone ? ` · ${s.fatherPhone}` : ''}</span>}
                    {s.fatherName && s.motherName && <span> &nbsp;|&nbsp; </span>}
                    {s.motherName && <span>Mother: {s.motherName}{s.motherPhone ? ` · ${s.motherPhone}` : ''}</span>}
                  </div>
                  <div style={{ fontSize:12, color: C.muted, marginTop:2 }}>Class: {s.section}{s.aadhaar ? ` · Aadhaar: ${s.aadhaar}` : ''}</div>
                  <div style={{ fontSize:13, fontWeight:700, color: C.amber, marginTop:4 }}>
                    {isDaycare(s.section) ? `${fmt(s.monthlyFee)}/mo` : `${fmt(s.annualFee)}/year`}
                  </div>
                  {s.driveLink && (
                    <a href={s.driveLink} target="_blank" rel="noreferrer"
                      style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:6, fontSize:12, fontWeight:600, color: C.teal, textDecoration:'none', background: C.tealLight, padding:'3px 10px', borderRadius:8 }}>
                      📁 View Documents
                    </a>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'flex-end' }}>
                  <Btn small variant="ghost" onClick={() => setModal({ mode:'edit', data: { ...s } })}>Edit</Btn>
                  <select value={s.status} onChange={e => setStatus(s.id, e.target.value)}
                    style={{ padding:'5px 10px', borderRadius:8, border:`1.5px solid ${STUDENT_STATUS_COLOR[s.status] || C.border}`, fontSize:12, fontWeight:600, color: STUDENT_STATUS_COLOR[s.status] || C.muted, background:'#fff', cursor:'pointer' }}>
                    {STUDENT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }
      {modal && <StudentModal modal={modal} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  )
}

const CLASS_NEXT = { Daycare:'Playgroup', Playgroup:'Nursery', Nursery:'Jr KG', 'Jr KG':'Sr KG', 'Sr KG':null }

function ClassPromotion({ students, setStudents }) {
  const [show, setShow] = useState(false)
  const [preview, setPreview] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const defaultAY = (() => { const cur = currentAcademicYear(); const sy = parseInt(cur.split('-')[0],10)+1; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })()
  const [targetAY, setTargetAY] = useState(defaultAY)
  const ayChoices = Array.from({length:4},(_,i)=>{ const cur=currentAcademicYear(); const sy=parseInt(cur.split('-')[0],10)+i; return `${sy}-${String((sy+1)%100).padStart(2,'0')}` })

  const buildPreview = () => {
    setPreview(students.filter(s=>s.status==='Active').map(s => ({ ...s, nextClass: CLASS_NEXT[s.section] })))
    setConfirming(false); setDone(false)
  }

  const runPromotion = async () => {
    const results = await DB.promoteStudents(students.filter(s=>s.status==='Active'), targetAY)
    if (!results) return
    setStudents(prev => prev.map(s => results.find(x=>x.id===s.id) || s))
    setDone(true); setPreview(null); setConfirming(false)
  }

  return (
    <div style={{ marginTop:24 }}>
      <Btn variant="purple" onClick={() => { setShow(!show); setPreview(null); setDone(false); setConfirming(false) }}>
        Year-End Class Promotion
      </Btn>
      {show && (
        <Card style={{ padding:18, marginTop:12, border:`1.5px solid ${C.purple}` }}>
          <div style={{ fontWeight:700, color: C.purple, fontSize:14, marginBottom:6 }}>Year-End Class Promotion</div>
          <div style={{ fontSize:13, color: C.muted, marginBottom:14 }}>
            Promotes all active students to their next class with new roll numbers for the selected academic year. Sr KG graduates are marked inactive.
          </div>
          <div style={{ marginBottom:14, maxWidth:260 }}>
            <Select label="Target Academic Year" value={targetAY} onChange={e => { setTargetAY(e.target.value); setPreview(null); setConfirming(false) }}>
              {ayChoices.map(ay => <option key={ay} value={ay}>{ay}</option>)}
            </Select>
          </div>
          {done && <div style={{ color: C.success, fontWeight:600, marginBottom:12, padding:'10px 14px', background:'#EAF7F0', borderRadius:8 }}>Promotion complete into AY {targetAY}!</div>}
          {!confirming && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Btn variant="ghost" onClick={buildPreview}>Preview Changes</Btn>
              {preview && <Btn variant="purple" onClick={() => setConfirming(true)}>Promote All →</Btn>}
            </div>
          )}
          {confirming && (
            <div style={{ background: C.amberLight, border:`1.5px solid ${C.amber}`, borderRadius:10, padding:'14px 16px', marginTop:8 }}>
              <div style={{ fontWeight:700, color: C.amber, marginBottom:8 }}>Are you sure?</div>
              <div style={{ fontSize:13, marginBottom:12 }}>This will move all {students.filter(s=>s.status==='Active').length} active students to their next class for AY {targetAY}.</div>
              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="purple" onClick={runPromotion}>Yes, Promote All</Btn>
                <Btn variant="ghost" onClick={() => setConfirming(false)}>Cancel</Btn>
              </div>
            </div>
          )}
          {preview && !confirming && (
            <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:6 }}>
              {preview.map(s => (
                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, padding:'6px 10px', background: C.bg, borderRadius:8 }}>
                  <span style={{ fontWeight:500 }}>{s.name}</span>
                  <span style={{ color: s.nextClass ? C.teal : C.amber, fontWeight:600 }}>
                    {s.section} → {s.nextClass || 'Graduate (inactive)'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default function StudentsPage({ students, setStudents, convertEnquiry, onConvertDone }) {
  return (
    <>
      <StudentsTable students={students} setStudents={setStudents} convertEnquiry={convertEnquiry} onConvertDone={onConvertDone} />
      <ClassPromotion students={students} setStudents={setStudents} />
    </>
  )
}
