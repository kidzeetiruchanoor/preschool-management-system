import { useState, useEffect, useRef, useCallback } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import {
  loadFaceModels, detectSingleFace, matchDescriptor, descriptorFromJSON,
} from '../lib/faceRecognition'

// How long a face must be steadily recognized before we act on it.
const STABLE_FRAMES_REQUIRED = 5
const SCAN_INTERVAL_MS = 350

// How long the result screen (success or error) stays up before
// automatically returning to the ready-to-scan state.
const RESULT_DISPLAY_MS = 3000

const DEVICE_NAME = 'Entrance Tablet'

export default function KioskAttendance({ onExit }) {
  const [phase, setPhase] = useState('loading') // loading | ready | processing | result
  const [liveHint, setLiveHint] = useState('')
  const [result, setResult] = useState(null) // { type: 'success'|'error', ... }
  const [enrolledProfiles, setEnrolledProfiles] = useState([])
  const [activeMode, setActiveMode] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanTimerRef = useRef(null)
  const resultTimerRef = useRef(null)
  const stableMatchRef = useRef({ teacherId: null, count: 0 })
  const busyRef = useRef(false)
  const modeRef = useRef(null)

  // ── Setup: load models, load enrolled profiles, start camera ─────
  // The <video> element is now rendered ONCE, unconditionally, for the
  // entire lifetime of this component (see render below) — it never
  // gets unmounted/remounted between phases. That means videoRef.current
  // is stable and this effect only needs to attach the stream a single
  // time, no re-attachment logic needed elsewhere.
  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        await loadFaceModels()
      } catch (err) {
        console.error('Model loading failed:', err)
        throw new Error('Could not load face recognition models. Check /models files.')
      }

      let raw
      try {
        raw = await DB.loadAllFaceProfilesForKiosk()
      } catch (err) {
        console.error('Loading enrolled profiles failed:', err)
        throw new Error('Could not load enrolled teachers. Check kiosk session/RLS.')
      }

      const converted = raw.map(p => ({
        teacherId: p.teacherId,
        teacherName: p.teacherName,
        descriptor: descriptorFromJSON(p.descriptor),
      }))
      if (cancelled) return
      setEnrolledProfiles(converted)

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      } catch (err) {
        console.error('Camera access failed:', err)
        throw new Error(`Could not access camera (${err.name}). Check browser permissions.`)
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      setPhase('ready')
    }

    setup().catch(err => {
      console.error(err)
      setResult({ type: 'error', message: err.message || 'Something went wrong. Please contact admin.' })
      setPhase('result')
    })

    return () => {
      cancelled = true
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopEverything = () => {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current)
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  // ── The scanning loop ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return

    scanTimerRef.current = setInterval(async () => {
      if (!modeRef.current || busyRef.current) return
      if (!videoRef.current || videoRef.current.readyState < 2) return

      const detection = await detectSingleFace(videoRef.current)

      if (detection.status === 'none') {
        setLiveHint('Position your face in front of the camera')
        stableMatchRef.current = { teacherId: null, count: 0 }
        return
      }
      if (detection.status === 'multiple') {
        setLiveHint('Please make sure only one person is in front of the camera')
        stableMatchRef.current = { teacherId: null, count: 0 }
        return
      }

      const match = matchDescriptor(detection.descriptor, enrolledProfiles)

      if (match.status === 'no_enrollments') {
        setLiveHint('No teachers enrolled yet. Contact admin.')
        return
      }
      if (match.status === 'no_match') {
        console.log(`Face detected but not matched. Closest distance: ${match.closestDistance.toFixed(3)} (threshold: ${0.6})`)
        setLiveHint('Face not recognized. If you are enrolled, try adjusting lighting or angle.')
        stableMatchRef.current = { teacherId: null, count: 0 }
        return
      }

      if (stableMatchRef.current.teacherId === match.teacherId) {
        stableMatchRef.current.count += 1
      } else {
        stableMatchRef.current = { teacherId: match.teacherId, count: 1 }
      }

      setLiveHint(`Recognizing ${match.teacherName}...`)
      console.log(`Matched ${match.teacherName} — confidence ${(match.confidence * 100).toFixed(1)}%`)

      if (stableMatchRef.current.count >= STABLE_FRAMES_REQUIRED) {
        busyRef.current = true
        await handleRecognized(match.teacherId, match.teacherName)
        busyRef.current = false
      }
    }, SCAN_INTERVAL_MS)

    return () => clearInterval(scanTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, enrolledProfiles])

  // ── Acting on a confirmed, stable match ───────────────────────────
  const handleRecognized = useCallback(async (teacherId, teacherName) => {
    setPhase('processing')
    const mode = modeRef.current

    if (mode === 'in') {
      const existing = await DB.getTodayAttendance(teacherId)
      if (existing && existing.check_in_time) {
        showResult({ type: 'error', message: `${teacherName} is already checked in today.`, teacherName })
        return
      }
      const row = await DB.checkIn(teacherId, DEVICE_NAME)
      if (!row || row.alreadyExists) {
        showResult({ type: 'error', message: `${teacherName} is already checked in today.`, teacherName })
        return
      }
      const photoUrl = await DB.getKioskStaffPhotoUrl(teacherId).catch(() => null)
      showResult({ type: 'success', teacherName, photoUrl, action: 'Check In recorded', time: formatTime(row.check_in_time) })
    } else {
      const row = await DB.checkOut(teacherId)
      if (!row) {
        showResult({ type: 'error', message: `${teacherName} has not checked in today, or has already checked out.`, teacherName })
        return
      }
      const photoUrl = await DB.getKioskStaffPhotoUrl(teacherId).catch(() => null)
      showResult({
        type: 'success', teacherName, photoUrl, action: 'Check Out recorded',
        time: formatTime(row.check_out_time), workingHours: row.working_hours,
      })
    }
  }, [])

  const showResult = (r) => {
    setResult(r)
    setPhase('result')
    stableMatchRef.current = { teacherId: null, count: 0 }
    modeRef.current = null
    setActiveMode(null)
    resultTimerRef.current = setTimeout(() => {
      setResult(null)
      setPhase('ready')
      setLiveHint('')
    }, RESULT_DISPLAY_MS)
  }

  const selectMode = (mode) => {
    modeRef.current = mode
    setActiveMode(mode)
    setLiveHint('Look at the camera')
  }

  const handleExit = () => {
    stopEverything()
    onExit()
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER — single persistent layout. The <video> element is always
  // in the DOM from first render onward; loading/result states are
  // shown as overlays on top of it, never by unmounting it. This is
  // what fixes the "black video" bug — there is exactly one <video>
  // node for the component's whole lifetime, so the stream attached
  // in the effect above is always the one actually on screen.
  // ═══════════════════════════════════════════════════════════════

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '32px 24px', textAlign: 'center', position: 'relative',
    }}>
      <div style={{ fontFamily: "'DM Serif Display'", fontSize: 22, color: C.teal, marginBottom: 4 }}>
        Kidzee Tiruchanoor
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Staff Attendance</div>

      <video ref={videoRef} muted playsInline
        style={{ width: '100%', maxWidth: 420, borderRadius: 18, background: '#000', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }} />

      <div style={{
        marginTop: 16, minHeight: 24, fontSize: 15, fontWeight: 600,
        color: phase === 'processing' ? C.amber : C.muted,
      }}>
        {phase === 'processing' ? 'Recording attendance...' : (activeMode ? liveHint : 'Choose Check In or Check Out to begin')}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 24, width: '100%', maxWidth: 420 }}>
        <button
          onClick={() => selectMode('in')}
          disabled={phase !== 'ready'}
          style={bigButtonStyle(C.success, activeMode === 'in')}
        >
          🟢 Check In
        </button>
        <button
          onClick={() => selectMode('out')}
          disabled={phase !== 'ready'}
          style={bigButtonStyle(C.danger, activeMode === 'out')}
        >
          🔴 Check Out
        </button>
      </div>

      <button
        onClick={handleExit}
        style={{
          marginTop: 32, padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${C.border}`,
          background: 'transparent', color: C.muted, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        ← Back to Welcome
      </button>

      {/* ── Overlays ── */}
      {phase === 'loading' && (
        <Overlay>
          <div style={{ fontSize: 16, color: C.muted }}>Starting camera...</div>
        </Overlay>
      )}

      {phase === 'result' && result && (
        <Overlay>
          {result.type === 'success' ? (
            <>
              <Avatar photoUrl={result.photoUrl} name={result.teacherName} />
              <div style={{ fontFamily: "'DM Serif Display'", fontSize: 28, color: C.teal, marginBottom: 6, marginTop: 16 }}>
                Welcome, {result.teacherName}!
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.success, marginBottom: 4 }}>
                {result.action}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'DM Serif Display'" }}>
                {result.time}
              </div>
              {result.workingHours != null && (
                <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
                  Working hours today: {result.workingHours}h
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontSize: 18, color: C.danger, fontWeight: 600, maxWidth: 360 }}>
                {result.message}
              </div>
            </>
          )}
        </Overlay>
      )}
    </div>
  )
}

// ── Small helpers ───────────────────────────────────────────────

function Avatar({ photoUrl, name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  const size = 96
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: `3px solid ${C.teal}`, boxShadow: '0 4px 14px rgba(0,0,0,.15)',
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: C.tealLight,
      border: `3px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 36, fontWeight: 700, color: C.teal, fontFamily: "'DM Serif Display'",
    }}>
      {initial}
    </div>
  )
}

function Overlay({ children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(253,248,242,0.97)', zIndex: 50,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      {children}
    </div>
  )
}

function bigButtonStyle(color, active) {
  return {
    flex: 1, padding: '20px 0', borderRadius: 16, border: active ? `3px solid ${color}` : '3px solid transparent',
    background: color, color: '#fff', fontSize: 18, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 14px ${color}40`,
    opacity: 1, transition: 'transform .1s',
    transform: active ? 'scale(1.03)' : 'scale(1)',
  }
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
