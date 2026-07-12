import { C } from '../lib/styles'
import { fmt } from '../lib/utils'
import { Btn, Modal, Row } from './ui'

export default function ReceiptModal({ payment, student, onClose }) {
  const phone = (student.fatherPhone || student.motherPhone || '').replace(/\D/g,'')
  const waText = [
    `🧾 *Fee Receipt — Kidzee Tiruchanoor*`, ``,
    `Student: ${student.name}`,
    `Admission No: ${student.admissionNo}`,
    `Class: ${student.section} (${student.rollNo})`, ``,
    `Receipt No: ${payment.receiptNo}`,
    `Date: ${payment.date}`,
    `Mode: ${payment.paymentMode}`,
    payment.transactionId ? `Transaction ID: ${payment.transactionId}` : null,
    payment.note ? `Note: ${payment.note}` : null, ``,
    `*Amount Paid: ${fmt(payment.amount)}*`, ``,
    `Thank you! 🙏`,
  ].filter(l => l !== null).join('\n')

  const waUrl = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(waText)}` : null

  return (
    <Modal title="Fee Receipt" onClose={onClose}>
      <div className="print-area" style={{ border:`2px solid ${C.teal}`, borderRadius:12, padding:24 }}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:24 }}>🌟</div>
          <div style={{ fontFamily:"'DM Serif Display'", fontSize:20, color: C.teal }}>Kidzee Tiruchanoor</div>
          <div style={{ fontSize:11, color: C.muted }}>Fee Payment Receipt</div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color: C.muted, marginBottom:14,
          borderBottom:`1px dashed ${C.border}`, paddingBottom:10 }}>
          <span>Receipt No: <b style={{ color: C.text }}>{payment.receiptNo}</b></span>
          <span>Date: <b style={{ color: C.text }}>{payment.date}</b></span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13, marginBottom:16 }}>
          <Row label="Student Name" value={student.name} />
          <Row label="Admission No" value={student.admissionNo} />
          <Row label="Class" value={`${student.section} (${student.rollNo})`} />
          <Row label="Payment Mode" value={payment.paymentMode} />
          {payment.transactionId && <Row label="Transaction ID" value={payment.transactionId} />}
          {payment.note && <Row label="Note" value={payment.note} />}
        </div>
        <div style={{ background: C.amberLight, borderRadius:10, padding:'14px 16px', textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:11, color: C.muted, textTransform:'uppercase', fontWeight:600 }}>Amount Received</div>
          <div style={{ fontSize:28, fontWeight:700, color: C.amber, fontFamily:"'DM Serif Display'" }}>{fmt(payment.amount)}</div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:30 }}>
          <div style={{ textAlign:'center', fontSize:11, color: C.muted }}>
            <div style={{ borderTop:`1px solid ${C.border}`, width:140, marginBottom:4 }} />
            Authorized Signature
          </div>
        </div>
      </div>
      <div className="no-print" style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16, flexWrap:'wrap' }}>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn onClick={() => window.print()}>Print / Save as PDF</Btn>
        {waUrl
          ? <a href={waUrl} target="_blank" rel="noreferrer"
              style={{ padding:'9px 18px', borderRadius:8, background:'#25D366', color:'#fff',
                fontWeight:600, fontSize:14, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
              WhatsApp Receipt
            </a>
          : <Btn variant="ghost" style={{ opacity:0.5, cursor:'default' }}
              onClick={() => alert('No parent phone number saved for this student.')}>
              WhatsApp Receipt
            </Btn>
        }
      </div>
    </Modal>
  )
}
