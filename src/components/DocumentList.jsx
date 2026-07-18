import { useState, useEffect } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { Btn } from './ui'

const DOC_TYPE_LABELS = {
  aadhaar: 'Aadhaar',
  birth_certificate: 'Birth Certificate',
  photo: 'Photo',
  transfer_certificate: 'Transfer Certificate',
  degree_certificate: 'Certificate',
  pan: 'PAN',
  other: 'Other',
}

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentList({ entityType, entityId, refreshKey }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    const rows = await DB.getDocuments(entityType, entityId)
    setDocs(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [entityType, entityId, refreshKey])

  const handleView = async doc => {
    setBusyId(doc.id)
    const url = await DB.getDocumentUrl(doc, false)
    setBusyId(null)
    if (url) window.open(url, '_blank')
    else alert('Could not open document. It may have been removed.')
  }

  const handleDownload = async doc => {
    setBusyId(doc.id)
    const url = await DB.getDocumentUrl(doc, true)
    setBusyId(null)
    if (url) window.open(url, '_blank')
    else alert('Could not download document. It may have been removed.')
  }

  const handleDelete = async doc => {
    if (!confirm(`Delete ${DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}? This cannot be undone.`)) return
    setBusyId(doc.id)
    const ok = await DB.deleteDocument(doc)
    setBusyId(null)
    if (ok) setDocs(prev => prev.filter(d => d.id !== doc.id))
    else alert('Could not delete document. Please try again.')
  }

  if (loading) return <div style={{ fontSize:12, color: C.muted, padding:'8px 0' }}>Loading documents...</div>
  if (docs.length === 0) return <div style={{ fontSize:12, color: C.muted, padding:'8px 0' }}>No documents uploaded yet.</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:10 }}>
      {docs.map(doc => (
        <div key={doc.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'8px 12px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600 }}>{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</div>
            <div style={{ fontSize:11, color: C.muted }}>{doc.file_name} · {fmtSize(doc.file_size_bytes)}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <Btn small variant="ghost" onClick={() => handleView(doc)} disabled={busyId === doc.id}>View</Btn>
            <Btn small variant="ghost" onClick={() => handleDownload(doc)} disabled={busyId === doc.id}>Download</Btn>
            <Btn small variant="danger" onClick={() => handleDelete(doc)} disabled={busyId === doc.id}>Delete</Btn>
          </div>
        </div>
      ))}
    </div>
  )
}
