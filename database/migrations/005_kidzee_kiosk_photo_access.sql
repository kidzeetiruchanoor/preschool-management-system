-- ================================================================
-- KIDZEE TIRUCHANOOR — Kiosk Staff Photo Access
-- Run this ONCE in Supabase SQL Editor
--
-- Same reasoning as kidzee_kiosk_names_view.sql: the kiosk is
-- deliberately blocked from the `documents` table (could contain
-- Aadhaar, PAN, certificates — nothing the kiosk should ever see).
-- This grants access to ONLY the "photo" document type for staff,
-- via a narrow view (documents metadata) + a narrow storage policy
-- (the actual file bytes) — nothing else in `documents` or Storage
-- becomes visible to the kiosk.
-- ================================================================

-- ── 1. Narrow view: only staff photo document metadata ────────────
CREATE OR REPLACE VIEW kiosk_staff_photos AS
SELECT entity_id AS teacher_id, storage_path, uploaded_at
FROM documents
WHERE entity_type = 'staff' AND doc_type = 'photo';

-- Runs as the view owner (bypasses documents' restrictive RLS for
-- just this narrow, pre-filtered slice), same pattern as the names view.
GRANT SELECT ON kiosk_staff_photos TO authenticated;


-- ── 2. Narrow storage policy: only staff photo files ───────────────
-- Storage has its own separate RLS layer on storage.objects, which
-- the view above does NOT bypass (views only affect Postgres table
-- RLS, not Storage's). Without this, createSignedUrl() would still
-- fail for the kiosk even with the view in place.
--
-- Scoped tightly via the upload path convention from DocumentUpload.jsx:
--   staff/<staff_id>/photo_<timestamp>.<ext>
-- The regex below matches ONLY that pattern — not aadhaar_, pan_,
-- degree_certificate_, or any student document path.

CREATE POLICY "kiosk_read_staff_photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    is_kiosk_account()
    AND bucket_id = 'kidzee-documents'
    AND name ~ '^staff/[^/]+/photo_'
  );
