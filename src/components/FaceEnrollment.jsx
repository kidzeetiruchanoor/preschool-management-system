import { useState, useEffect, useRef } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { loadFaceModels, detectSingleFace, descriptorToJSON } from '../lib/faceRecognition'
import { Btn } from './ui'

const SAMPLES_NEEDED = 5

export default function FaceEnrollment({ teacherId }) {
  const [existingCount, setExistingCount] = useState(null) // null = still checking
  const [mode, setMode] = useState('idle') // idle | capturing | done
  const [captured, setCaptured] = useState(0)
  const [liveStatus, setLiveStatus] = useState('')
  const [canCapture, setCanCapture] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const pollRef = useRef(null)
  const pendingDescriptorRef = useRef(null)

  // Check existing enrollment status on mount
  const refreshStatus = async () => {
    const profiles = await DB.getFaceProfiles(teacherId)
    setExistingCount(profiles.length)
  }
  useEffect(() => { refreshStatus() }, [teacherId])

  const stopCamera = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  useEffect(() => () => stopCamera(), []) // cleanup if component unmounts mid-capture

  const startCapture = async () => {
    setError('')
    setCaptured(0)
    setMode('capturing')
    setBusy(true)
    try {
      await loadFaceModels()
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setBusy(false)

      pollRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        const result = await detectSingleFace(videoRef.current)
        if (result.status === 'ok') {
          setLiveStatus('Face detected — ready to capture')
          setCanCapture(true)
          pendingDescriptorRef.current = result.descriptor
        } else if (result.status === 'multiple') {
          setLiveStatus('Multiple faces detected — only one person, please')
          setCanCapture(false)
          pendingDescriptorRef.current = null
        } else {
          setLiveStatus('Position your face in the camera')
          setCanCapture(false)
          pendingDescriptorRef.current = null
        }
      }, 400)
    } catch (err) {
      console.error(err)
      setError('Could not access camera. Please check permissions.')
      setMode('idle')
      setBusy(false)
    }
  }

  const captureSample = async () => {
    if (!pendingDescriptorRef.current) return
    setBusy(true)
    const nextIndex = captured + 1
    const saved = await DB.addFaceProfile(teacherId, descriptorToJSON(pendingDescriptorRef.current), nextIndex)
    setBusy(false)
    if (!saved) { setError('Failed to save sample. Please try again.'); return }

    const newCount = captured + 1
    setCaptured(newCount)
    setCanCapture(false)
    pendingDescriptorRef.current = null

    if (newCount >= SAMPLES_NEEDED) {
      stopCamera()
      setMode('done')
      refreshStatus()
    } else {
      setLiveStatus('Great — move slightly and capture the next sample')
    }
  }

  const cancelCapture = () => {
    stopCamera()
    setMode('idle')
    setCaptured(0)
  }

  const startReEnroll = async () => {
    setBusy(true)
    await DB.deleteAllFaceProfiles(teacherId)
    setBusy(false)
    startCapture()
  }

  const deleteEnrollment = async () => {
    if (!confirm('Remove this teacher\'s face enrollment? They will need to re-enroll before using the attendance kiosk.')) return
    setBusy(true)
    await DB.deleteAllFaceProfiles(teacherId)
    setBusy(false)
    refreshStatus()
  }

  // ── Render: still checking existing status ──────────────────────
  if (existingCount === null) {
    return <div style={{ fontSize:12, color: C.muted, padding:'8px 0' }}>Checking enrollment status...</div>
  }

  // ── Render: capturing ────────────────────────────────────────────
  if (mode === 'capturing') {
    return (
      <div style={{ background: C.tealLight, borderRadius:10, padding:'14px' }}>
        <div style={{ fontSize:12, fontWeight:600, color: C.teal, marginBottom:10 }}>
          📷 FACE ENROLLMENT — Sample {Math.min(captured + 1, SAMPLES_NEEDED)} of {SAMPLES_NEEDED}
        </div>
        <video ref={videoRef} muted playsInline
          style={{ width:'100%', maxWidth:320, borderRadius:10, background:'#000', display:'block', margin:'0 auto' }} />
        <div style={{ display:'flex', gap:6, justifyContent:'center', margin:'10px 0' }}>
          {Array.from({ length: SAMPLES_NEEDED }).map((_, i) => (
            <div key={i} style={{ width:10, height:10, borderRadius:'50%',
              background: i < captured ? C.success : C.border }} />
          ))}
        </div>
        <div style={{ textAlign:'center', fontSize:13, color: canCapture ? C.success : C.muted, fontWeight:600, marginBottom:10 }}>
          {liveStatus}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          <Btn onClick={captureSample} disabled={!canCapture || busy}>
            {busy ? 'Saving...' : 'Capture Sample'}
          </Btn>
          <Btn variant="ghost" onClick={cancelCapture} disabled={busy}>Cancel</Btn>
        </div>
        {error && <div style={{ fontSize:12, color: C.danger, marginTop:8, textAlign:'center' }}>{error}</div>}
      </div>
    )
  }

  // ── Render: just finished ────────────────────────────────────────
  if (mode === 'done') {
    return (
      <div style={{ background:'#EAF7F0', border:`1.5px solid ${C.success}`, borderRadius:10, padding:'14px', textAlign:'center' }}>
        <div style={{ fontWeight:700, color: C.success, fontSize:14 }}>Enrollment complete!</div>
        <div style={{ fontSize:12, color: C.muted, marginTop:4 }}>{SAMPLES_NEEDED} samples saved. Ready for kiosk check-in.</div>
        <Btn small variant="ghost" onClick={() => setMode('idle')} style={{ marginTop:10 }}>Close</Btn>
      </div>
    )
  }

  // ── Render: idle — not yet enrolled ───────────────────────────────
  if (existingCount === 0) {
    return (
      <div style={{ background: C.tealLight, borderRadius:10, padding:'12px 14px' }}>
        <div style={{ fontSize:12, fontWeight:600, color: C.teal, marginBottom:8 }}>📷 FACE ENROLLMENT</div>
        <div style={{ fontSize:12, color: C.muted, marginBottom:10 }}>
          Not enrolled yet. Enroll this teacher's face to enable kiosk check-in/check-out.
        </div>
        <Btn small variant="amber" onClick={startCapture} disabled={busy}>Enroll Face</Btn>
        {error && <div style={{ fontSize:12, color: C.danger, marginTop:8 }}>{error}</div>}
      </div>
    )
  }

  // ── Render: idle — already enrolled ───────────────────────────────
  return (
    <div style={{ background: C.tealLight, borderRadius:10, padding:'12px 14px' }}>
      <div style={{ fontSize:12, fontWeight:600, color: C.teal, marginBottom:8 }}>📷 FACE ENROLLMENT</div>
      <div style={{ fontSize:12, color: C.success, fontWeight:600, marginBottom:10 }}>
        ✓ Enrolled ({existingCount} samples saved)
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Btn small variant="ghost" onClick={startReEnroll} disabled={busy}>Re-enroll</Btn>
        <Btn small variant="danger" onClick={deleteEnrollment} disabled={busy}>Remove Enrollment</Btn>
      </div>
      {error && <div style={{ fontSize:12, color: C.danger, marginTop:8 }}>{error}</div>}
    </div>
  )
}
