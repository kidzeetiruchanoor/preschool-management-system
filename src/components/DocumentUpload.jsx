import { useState, useRef } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { compressImage } from '../lib/imageCompress'
import { Btn, Select } from './ui'

const STUDENT_DOC_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'photo', label: 'Student Photo' },
  { value: 'transfer_certificate', label: 'Transfer Certificate' },
  { value: 'other', label: 'Other' },
]

const STAFF_DOC_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'degree_certificate', label: 'Certificate' },
  { value: 'pan', label: 'PAN' },
  { value: 'photo', label: 'Staff Photo' },
  { value: 'other', label: 'Other' },
]

export default function DocumentUpload({ entityType, entityId, pathPrefix, onUploaded }) {
  const [docType, setDocType] = useState('aadhaar')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const docTypes = entityType === 'student' ? STUDENT_DOC_TYPES : STAFF_DOC_TYPES

  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const compressed = await compressImage(file)
      const doc = await DB.uploadDocument({
        file: compressed, entityType, entityId, docType, pathPrefix,
      })
      if (!doc) {
        setError('Upload failed. Please try again.')
      } else {
        onUploaded && onUploaded(doc)
      }
    } catch (err) {
      console.error(err)
      setError('Upload failed. Please try again.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ background: C.tealLight, borderRadius:10, padding:'12px 14px' }}>
      <div style={{ fontSize:12, fontWeight:600, color: C.teal, marginBottom:10 }}>📁 UPLOAD DOCUMENT</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
        <Select label="Document Type" value={docType} onChange={e => setDocType(e.target.value)}>
          {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Btn small variant="amber" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading...' : 'Choose File'}
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFile}
          style={{ display:'none' }}
        />
      </div>
      {error && <div style={{ fontSize:12, color: C.danger, marginTop:8 }}>{error}</div>}
      <div style={{ fontSize:11, color: C.muted, marginTop:8 }}>
        Photos are automatically compressed before upload. PDFs are uploaded as-is.
      </div>
    </div>
  )
}
