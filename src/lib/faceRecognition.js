// ════════════════════════════════════════════════════════════════
// FACE RECOGNITION MODULE
// Thin wrapper around @vladmandic/face-api for this app's specific
// needs: load models once, extract a descriptor from a video frame,
// match a descriptor against enrolled teachers.
//
// Nothing in this file touches the DOM directly except reading from
// a provided <video> or <canvas> element — no UI here, that's built
// on top of these functions in later phases.
// ════════════════════════════════════════════════════════════════

import * as faceapi from '@vladmandic/face-api'

// Distance threshold for a match. face-api uses Euclidean distance
// between descriptors — LOWER means MORE similar. 0.6 is the widely
// used default for face_recognition_model and works well for a small,
// known population (a handful of teachers) under kiosk conditions
// (deliberate, close, front-facing). We can tune this after real-world
// testing in Phase 4 if false accepts/rejects show up.
export const MATCH_THRESHOLD = 0.6

const MODEL_URL = '/models'
let modelsLoaded = false

// ── Model loading ──────────────────────────────────────────────
// Must be called once before any detection/extraction happens.
// Safe to call multiple times — it no-ops after the first success.
export async function loadFaceModels() {
  if (modelsLoaded) return
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

export function areModelsLoaded() {
  return modelsLoaded
}

// ── Detection + descriptor extraction ──────────────────────────
// Runs against a live <video> element (kiosk camera preview) or a
// static <img>/<canvas> (used during enrollment capture).
// Returns an array of detections, each with a 128-length descriptor
// (Float32Array) plus the bounding box, so callers can tell whether
// zero, one, or multiple faces were found.
export async function detectAllFaces(mediaElement) {
  await loadFaceModels()
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
  const results = await faceapi
    .detectAllFaces(mediaElement, options)
    .withFaceLandmarks()
    .withFaceDescriptors()
  return results // [{ detection, landmarks, descriptor }, ...]
}

// Convenience: detect exactly one face, distinguishing the
// "none found" / "more than one found" / "exactly one found" cases,
// since the kiosk needs different messaging for each.
export async function detectSingleFace(mediaElement) {
  const results = await detectAllFaces(mediaElement)
  if (results.length === 0) return { status: 'none' }
  if (results.length > 1) return { status: 'multiple', count: results.length }
  return { status: 'ok', descriptor: results[0].descriptor, box: results[0].detection.box }
}

// ── Descriptor <-> storage format conversion ────────────────────
// face-api works with Float32Array; Postgres JSONB needs a plain
// array. These two functions are the only place that conversion
// happens, so both enrollment (save) and kiosk (load+match) stay
// consistent.
export function descriptorToJSON(descriptor) {
  return Array.from(descriptor)
}

export function descriptorFromJSON(json) {
  return new Float32Array(json)
}

// ── Matching ─────────────────────────────────────────────────────
// `enrolledProfiles` is an array of { teacherId, teacherName, descriptor }
// where descriptor is already a Float32Array (via descriptorFromJSON).
// A teacher may have multiple enrolled samples (3-5); we compare
// against all of them and take that teacher's best (lowest-distance)
// match, then pick the best across all teachers.
export function matchDescriptor(liveDescriptor, enrolledProfiles) {
  if (enrolledProfiles.length === 0) return { status: 'no_enrollments' }

  let best = null
  for (const profile of enrolledProfiles) {
    const distance = faceapi.euclideanDistance(liveDescriptor, profile.descriptor)
    if (!best || distance < best.distance) {
      best = { teacherId: profile.teacherId, teacherName: profile.teacherName, distance }
    }
  }

  if (best.distance <= MATCH_THRESHOLD) {
    return { status: 'matched', teacherId: best.teacherId, teacherName: best.teacherName, confidence: 1 - best.distance }
  }
  return { status: 'no_match', closestDistance: best.distance }
}
