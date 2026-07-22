import { useState, useEffect, useRef, useCallback } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import {
  loadFaceModels, detectSingleFace, matchDescriptor, descriptorFromJSON,
} from '../lib/faceRecognition'

// How long a face must be steadily recognized before we act on it.
// Prevents acting on a single lucky/unlucky frame — the person needs
// to hold still in front of the camera for a moment, which also
// naturally discourages someone just walking past being mis-detected.
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
  const [activeMode, setActiveMode] = useState(null) // mirrors modeRef, for UI highlighting only

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanTimerRef = useRef(null)
  const resultTimerRef = useRef(null)
  const stableMatchRef = useRef({ teacherId: null, count: 0 })
  const busyRef = useRef(false) // guards against double-processing while a check-in/out is in flight
  const modeRef = useRef(null) // 'in' | 'out' — set by the button the person tapped

  // ── Setup: load models, load enrolled profiles, start camera ─────
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

  // ── The scanning loop — only runs while phase === 'ready' AND a
  // mode (in/out) has been selected by a button press ────────────
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

      // Exactly one face — try to match it
      const match = matchDescriptor(detection.descriptor, enrolledProfiles)

      if (match.status === 'no_enrollments') {
        setLiveHint('No teachers enrolled yet. Contact admin.')
        return
      }
      if (match.status === 'no_match') {
        setLiveHint('Face not recognized. If you are enrolled, try adjusting lighting or angle.')
        stableMatchRef.current = { teacherId: null, count: 0 }
        return
      }

      // Matched — require it to stay stable for a few consecutive
      // frames before acting, to avoid acting on a flicker/misread
      if (stableMatchRef.current.teacherId === match.teacherId) {
        stableMatchRef.current.count += 1
      } else {
        stableMatchRef.current = { teacherId: match.teacherId, count: 1 }
      }

      setLiveHint(`Recognizing ${match.teacherName}...`)

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
        showResult({
          type: 'error',
          message: `${teacherName} is already checked in today.`,
          teacherName,
        })
        return
      }
      const row = await DB.checkIn(teacherId, DEVICE_NAME)
      if (!row || row.alreadyExists) {
        showResult({ type: 'error', message: `${teacherName} is already checked in today.`, teacherName })
        return
      }
      showResult({
        type: 'success',
        teacherName,
        action: 'Check In recorded',
        time: formatTime(row.check_in_time),
      })
    } else {
      const row = await DB.checkOut(teacherId)
      if (!row) {
        showResult({
          type: 'error',
          message: `${teacherName} has not checked in today, or has already checked out.`,
          teacherName,
        })
        return
      }
      showResult({
        type: 'success',
        teacherName,
        action: 'Check Out recorded',
        time: formatTime(row.check_out_time),
        workingHours: row.working_hours,
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
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (phase === 'loading') {
    return (
      <FullScreenCenter>
        <div style={{ fontSize: 16, color: C.muted, marginBottom: 16 }}>Starting camera...</div>
        {/* Kept in the DOM (just hidden) so videoRef.current is never null
            when setup() tries to attach the camera stream to it. */}
        <video ref={videoRef} muted playsInline style={{ display: 'none' }} />
      </FullScreenCenter>
    )
  }

  if (phase === 'result' && result) {
    return (
      <FullScreenCenter>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{result.type === 'success' ? '✅' : '⚠️'}</div>
        {result.type === 'success' ? (
          <>
            <div style={{ fontFamily: "'DM Serif Display'", fontSize: 28, color: C.teal, marginBottom: 6 }}>
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
          <div style={{ fontSize: 18, color: C.danger, fontWeight: 600, maxWidth: 360 }}>
            {result.message}
          </div>
        )}
      </FullScreenCenter>
    )
  }

  // phase === 'ready' or 'processing' — show the live camera view
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '32px 24px', textAlign: 'center',
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
          disabled={phase === 'processing'}
          style={bigButtonStyle(C.success, activeMode === 'in')}
        >
          🟢 Check In
        </button>
        <button
          onClick={() => selectMode('out')}
          disabled={phase === 'processing'}
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
    </div>
  )
}

// ── Small helpers ───────────────────────────────────────────────

function FullScreenCenter({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
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
