-- ================================================================
-- KIDZEE TIRUCHANOOR — Teacher Attendance Kiosk (Phase 1)
-- Database migration: tables, RLS, kiosk account isolation
-- Run this ONCE in Supabase SQL Editor
-- ================================================================

-- ================================================================
-- 1. KIOSK ACCOUNT REGISTRY
-- Maps specific Supabase Auth users to "kiosk" status. Used by RLS
-- policies everywhere else to distinguish the kiosk tablet's login
-- from a real admin login, even though both are "authenticated".
-- ================================================================

CREATE TABLE IF NOT EXISTS kiosk_accounts (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT 'Attendance Kiosk',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function: is the currently-authenticated user a kiosk account?
-- SECURITY DEFINER so it can read kiosk_accounts regardless of the
-- caller's own RLS visibility into that table.
CREATE OR REPLACE FUNCTION is_kiosk_account()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM kiosk_accounts WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_kiosk_account() TO authenticated;

ALTER TABLE kiosk_accounts ENABLE ROW LEVEL SECURITY;

-- Only real admins (non-kiosk authenticated users) can view/manage the
-- kiosk registry itself. The kiosk account has no reason to read this table.
CREATE POLICY "admin_only_kiosk_registry" ON kiosk_accounts
  FOR ALL TO authenticated
  USING (NOT is_kiosk_account())
  WITH CHECK (NOT is_kiosk_account());


-- ================================================================
-- 2. LOCK DOWN EXISTING TABLES FROM THE KIOSK ACCOUNT
-- Every table that currently has "authenticated_full_access" (any
-- logged-in user, full access) must be tightened so the kiosk
-- account — which IS an authenticated user — is excluded.
-- ================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students', 'student_enrollments', 'staff', 'enquiries',
    'fee_payments', 'salary_payments', 'expenses', 'attendance',
    'documents', 'academic_years', 'classes',
    'admission_counters', 'roll_counters'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_full_access" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON %I
       FOR ALL TO authenticated
       USING (NOT is_kiosk_account())
       WITH CHECK (NOT is_kiosk_account())', t);
  END LOOP;
END;
$$;

-- Also tighten the existing document-storage RLS policies from the
-- earlier migration the same way.
DROP POLICY IF EXISTS "authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read"   ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;

CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kidzee-documents' AND NOT is_kiosk_account());

CREATE POLICY "authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kidzee-documents' AND NOT is_kiosk_account());

CREATE POLICY "authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kidzee-documents' AND NOT is_kiosk_account());


-- ================================================================
-- 3. FACE PROFILES — isolated table, admin-managed, kiosk-readable
-- ================================================================

CREATE TABLE IF NOT EXISTS teacher_face_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  descriptor   JSONB NOT NULL,       -- float array (128 or 512 numbers), NOT a raw image
  sample_index SMALLINT NOT NULL DEFAULT 1,  -- which of the 3–5 enrollment samples this is
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_profiles_teacher ON teacher_face_profiles(teacher_id);

ALTER TABLE teacher_face_profiles ENABLE ROW LEVEL SECURITY;

-- Kiosk: read-only (needs descriptors to match against, nothing else)
CREATE POLICY "kiosk_read_face_profiles" ON teacher_face_profiles
  FOR SELECT TO authenticated
  USING (is_kiosk_account());

-- Admin: full management (enroll, re-enroll, delete)
CREATE POLICY "admin_manage_face_profiles" ON teacher_face_profiles
  FOR ALL TO authenticated
  USING (NOT is_kiosk_account())
  WITH CHECK (NOT is_kiosk_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_face_profiles TO authenticated;


-- ================================================================
-- 4. TEACHER ATTENDANCE — one row per teacher per day
-- Check-in creates the row; check-out updates it. The UNIQUE
-- constraint on (teacher_id, attendance_date) is what makes
-- "no duplicate check-in" and "no check-out without check-in"
-- enforceable at the database level, not just app logic.
-- ================================================================

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_time   TIMESTAMPTZ,
  check_out_time  TIMESTAMPTZ,
  device_name     TEXT,
  notes           TEXT,
  working_hours   NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0, 2)
      ELSE NULL
    END
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date ON teacher_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON teacher_attendance(teacher_id);

ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;

-- Kiosk: can INSERT (check-in) and UPDATE (check-out) but not
-- DELETE. Reads are scoped to today only — the kiosk only ever
-- needs "does a row already exist for this teacher today".
CREATE POLICY "kiosk_insert_attendance" ON teacher_attendance
  FOR INSERT TO authenticated
  WITH CHECK (is_kiosk_account());

CREATE POLICY "kiosk_update_attendance" ON teacher_attendance
  FOR UPDATE TO authenticated
  USING (is_kiosk_account() AND attendance_date = CURRENT_DATE)
  WITH CHECK (is_kiosk_account() AND attendance_date = CURRENT_DATE);

CREATE POLICY "kiosk_read_today_attendance" ON teacher_attendance
  FOR SELECT TO authenticated
  USING (is_kiosk_account() AND attendance_date = CURRENT_DATE);

-- Admin: full access for reports, corrections, historical data
CREATE POLICY "admin_manage_attendance" ON teacher_attendance
  FOR ALL TO authenticated
  USING (NOT is_kiosk_account())
  WITH CHECK (NOT is_kiosk_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_attendance TO authenticated;

-- Keep updated_at current on check-out
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_attendance_touch ON teacher_attendance;
CREATE TRIGGER trg_teacher_attendance_touch
BEFORE UPDATE ON teacher_attendance
FOR EACH ROW
EXECUTE FUNCTION fn_touch_updated_at();


-- ================================================================
-- 5. SCHEMA/SEQUENCE GRANTS (same pattern as your original setup —
-- RLS alone is not sufficient, Postgres also needs these)
-- ================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
