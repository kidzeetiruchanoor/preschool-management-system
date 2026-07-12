import { useState, useEffect } from 'react'
import { DB } from './lib/db'
import { C } from './lib/styles'
import { currentAcademicYear } from './lib/utils'
import GlobalSearch from './components/GlobalSearch'
import ReceiptModal from './components/ReceiptModal'
import TodaysTasks from './pages/TodaysTasks'
import Dashboard from './pages/Dashboard'
import StudentsPage from './pages/Students'
import Enquiries from './pages/Enquiries'
import Attendance from './pages/Attendance'
import Fees from './pages/Fees'
import Teachers from './pages/Teachers'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'

const TABS = [
  { id:'tasks',      label:'Today' },
  { id:'dashboard',  label:'Dashboard' },
  { id:'students',   label:'Students' },
  { id:'enquiries',  label:'Enquiries' },
  { id:'attendance', label:'Attendance' },
  { id:'fees',       label:'Fees' },
  { id:'teachers',   label:'Staff' },
  { id:'expenses',   label:'Expenses' },
  { id:'reports',    label:'Reports' },
]

export default function App() {
  const [tab, setTab] = useState('tasks')
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [attendance, setAttendance] = useState({})
  const [staffAttendance, setStaffAttendance] = useState({})
  const [feeRecords, setFeeRecords] = useState([])
  const [salaryRecords, setSalaryRecords] = useState([])
  const [expenses, setExpenses] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [receiptModal, setReceiptModal] = useState(null)
  const [convertEnquiry, setConvertEnquiry] = useState(null)

  useEffect(() => {
    DB.loadAll().then(data => {
      if (!data) { setLoading(false); return }
      setStudents(data.students)
      setTeachers(data.teachers)
      setAttendance(data.attendance)
      setStaffAttendance(data.staffAttendance)
      setFeeRecords(data.feeRecords)
      setSalaryRecords(data.salaryRecords)
      setExpenses(data.expenses)
      setEnquiries(data.enquiries)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh',
      background: C.bg, fontFamily:"'Plus Jakarta Sans', sans-serif", color: C.muted, fontSize:16 }}>
      Loading Kidzee Tiruchanoor...
    </div>
  )

  const openReceipt = (payment, student) => setReceiptModal({ payment, student })

  return (
    <div style={{ minHeight:'100vh', background: C.bg }}>
      {/* Header */}
      <div className="no-print" style={{ background: C.teal, padding:'10px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontFamily:"'DM Serif Display'", color:'#fff', fontSize:18, letterSpacing:.2, whiteSpace:'nowrap' }}>
          Kidzee Tiruchanoor
        </div>
        <GlobalSearch students={students} teachers={teachers} enquiries={enquiries} onNavigate={setTab} />
        <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', whiteSpace:'nowrap' }}>
          {new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })} · AY {currentAcademicYear()}
        </div>
      </div>

      {/* Nav */}
      <div className="no-print" style={{ background:'#fff', borderBottom:`1px solid ${C.border}`, overflowX:'auto', whiteSpace:'nowrap', padding:'0 8px' }}>
        <div style={{ display:'inline-flex' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'12px 14px', border:'none', background:'none', cursor:'pointer',
              fontSize:13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? C.teal : C.muted,
              borderBottom: tab === t.id ? `2.5px solid ${C.teal}` : '2.5px solid transparent',
              transition:'all .15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:'24px 20px', maxWidth:700, margin:'0 auto' }}>
        {tab === 'tasks'      && <TodaysTasks students={students} teachers={teachers} feeRecords={feeRecords} salaryRecords={salaryRecords} enquiries={enquiries} attendance={attendance} onNavigate={setTab} onOpenReceipt={openReceipt} />}
        {tab === 'dashboard'  && <Dashboard students={students} teachers={teachers} feeRecords={feeRecords} expenses={expenses} enquiries={enquiries} onOpenReceipt={openReceipt} onGoToEnquiries={() => setTab('enquiries')} />}
        {tab === 'students'   && <StudentsPage students={students} setStudents={setStudents} convertEnquiry={convertEnquiry} onConvertDone={() => setConvertEnquiry(null)} />}
        {tab === 'enquiries'  && <Enquiries enquiries={enquiries} setEnquiries={setEnquiries} onConvertToAdmission={enq => { setConvertEnquiry(enq); setTab('students') }} />}
        {tab === 'attendance' && <Attendance students={students} attendance={attendance} setAttendance={setAttendance} teachers={teachers} staffAttendance={staffAttendance} setStaffAttendance={setStaffAttendance} />}
        {tab === 'fees'       && <Fees students={students} feeRecords={feeRecords} setFeeRecords={setFeeRecords} onOpenReceipt={openReceipt} />}
        {tab === 'teachers'   && <Teachers teachers={teachers} setTeachers={setTeachers} salaryRecords={salaryRecords} setSalaryRecords={setSalaryRecords} expenses={expenses} setExpenses={setExpenses} />}
        {tab === 'expenses'   && <Expenses expenses={expenses} setExpenses={setExpenses} />}
        {tab === 'reports'    && <Reports students={students} teachers={teachers} feeRecords={feeRecords} salaryRecords={salaryRecords} expenses={expenses} attendance={attendance} enquiries={enquiries} />}
      </div>

      {receiptModal && <ReceiptModal payment={receiptModal.payment} student={receiptModal.student} onClose={() => setReceiptModal(null)} />}
    </div>
  )
}
