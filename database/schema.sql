-- ================================================================
-- KIDZEE TIRUCHANOOR — PostgreSQL Schema
-- Designed for Supabase (PostgreSQL 15+)
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- ENUMS
-- ================================================================

CREATE TYPE student_status AS ENUM ('Active', 'Graduated', 'Transferred', 'Dropped');
CREATE TYPE staff_role     AS ENUM ('Teacher', 'Assistant Teacher', 'Coordinator', 'Admin', 'Support Staff');
CREATE TYPE fee_type       AS ENUM ('monthly', 'annual');
CREATE TYPE payment_mode   AS ENUM ('PhonePe', 'Google Pay', 'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Cheque');
CREATE TYPE attendance_status AS ENUM ('present', 'absent');
CREATE TYPE entity_type    AS ENUM ('student', 'staff');
CREATE TYPE doc_type       AS ENUM ('aadhaar', 'birth_certificate', 'photo', 'degree_certificate', 'pan', 'other');
CREATE TYPE enquiry_status AS ENUM ('New', 'Follow-up', 'Admitted', 'Not Interested');
CREATE TYPE expense_category AS ENUM ('Rent', 'Electricity', 'Water', 'Stationery', 'Toys & Materials', 'Maintenance', 'Cleaning', 'Events', 'Salary', 'Miscellaneous');

-- ================================================================
-- LOOKUP TABLES
-- ================================================================

CREATE TABLE academic_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL UNIQUE,           -- e.g. '2026-27'
  start_date  DATE NOT NULL,                  -- e.g. 2026-05-01
  end_date    DATE NOT NULL,                  -- e.g. 2027-04-30
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT  chk_ay_dates CHECK (end_date > start_date)
);

-- Only one academic year can be current at a time
CREATE UNIQUE INDEX idx_ay_current ON academic_years (is_current) WHERE is_current = TRUE;

CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,           -- 'Daycare', 'Playgroup', etc.
  code        TEXT NOT NULL UNIQUE,           -- 'DC', 'PG', 'NS', 'JK', 'SK'
  fee_type    fee_type NOT NULL,              -- monthly for Daycare, annual for rest
  sort_order  SMALLINT NOT NULL,              -- for display ordering
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed class data
INSERT INTO classes (name, code, fee_type, sort_order) VALUES
  ('Daycare',   'DC', 'monthly', 1),
  ('Playgroup', 'PG', 'annual',  2),
  ('Nursery',   'NS', 'annual',  3),
  ('Jr KG',     'JK', 'annual',  4),
  ('Sr KG',     'SK', 'annual',  5);

-- ================================================================
-- SEQUENCE COUNTERS
-- Used for generating admission numbers and roll numbers atomically
-- ================================================================

CREATE TABLE admission_counters (
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
  last_seq          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (academic_year_id)
);

CREATE TABLE roll_counters (
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
  class_id          UUID NOT NULL REFERENCES classes(id),
  last_seq          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (academic_year_id, class_id)
);

-- Function: generate next admission number (e.g. KZT260001)
-- Call inside a transaction for safe concurrency
CREATE OR REPLACE FUNCTION next_admission_no(p_academic_year_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seq   INTEGER;
  v_label TEXT;
  v_yy    TEXT;
BEGIN
  INSERT INTO admission_counters (academic_year_id, last_seq)
  VALUES (p_academic_year_id, 1)
  ON CONFLICT (academic_year_id)
  DO UPDATE SET last_seq = admission_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  SELECT label INTO v_label FROM academic_years WHERE id = p_academic_year_id;
  v_yy := SUBSTRING(v_label FROM 3 FOR 2); -- '2026-27' → '26'
  RETURN 'KZT' || v_yy || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function: generate next roll number (e.g. 26PG01)
CREATE OR REPLACE FUNCTION next_roll_no(p_academic_year_id UUID, p_class_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seq   INTEGER;
  v_label TEXT;
  v_code  TEXT;
  v_yy    TEXT;
BEGIN
  INSERT INTO roll_counters (academic_year_id, class_id, last_seq)
  VALUES (p_academic_year_id, p_class_id, 1)
  ON CONFLICT (academic_year_id, class_id)
  DO UPDATE SET last_seq = roll_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  SELECT label INTO v_label FROM academic_years WHERE id = p_academic_year_id;
  SELECT code  INTO v_code  FROM classes WHERE id = p_class_id;
  v_yy := SUBSTRING(v_label FROM 3 FOR 2);
  RETURN v_yy || v_code || LPAD(v_seq::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- STUDENTS
-- ================================================================

CREATE TABLE students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no  TEXT NOT NULL UNIQUE,         -- KZT260001, permanent, never changes
  name          TEXT NOT NULL,
  dob           DATE,
  aadhaar       CHAR(12),
  father_name   TEXT,
  father_phone  TEXT,
  mother_name   TEXT,
  mother_phone  TEXT,
  address       TEXT,
  enroll_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status        student_status NOT NULL DEFAULT 'Active',
  notes         TEXT,
  drive_folder_id TEXT,                       -- Google Drive folder ID for documents
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_aadhaar CHECK (aadhaar IS NULL OR aadhaar ~ '^\d{12}$')
);

-- Tracks which class a student is in for each academic year
-- A student gets a new enrollment row each year (with new roll_no)
-- This is the join table between students and academic years
CREATE TABLE student_enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
  class_id          UUID NOT NULL REFERENCES classes(id),
  roll_no           TEXT NOT NULL,             -- 26PG01, changes every year
  agreed_fee        NUMERIC(10,2) NOT NULL,    -- negotiated fee for this year
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, academic_year_id),       -- one enrollment per student per year
  UNIQUE (roll_no, academic_year_id)           -- roll numbers unique within a year
);

CREATE INDEX idx_enrollments_student    ON student_enrollments(student_id);
CREATE INDEX idx_enrollments_year_class ON student_enrollments(academic_year_id, class_id);

-- ================================================================
-- STAFF
-- ================================================================

CREATE TABLE staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT,
  role            staff_role NOT NULL DEFAULT 'Teacher',
  aadhaar         CHAR(12),
  join_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  monthly_salary  NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  drive_folder_id TEXT,                        -- Google Drive folder ID for documents
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_staff_aadhaar CHECK (aadhaar IS NULL OR aadhaar ~ '^\d{12}$')
);

-- ================================================================
-- ENQUIRIES (CRM pipeline)
-- ================================================================

CREATE TABLE enquiries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name        TEXT,
  child_age         TEXT,
  class_interested  UUID REFERENCES classes(id),
  parent_name       TEXT NOT NULL,
  phone             TEXT NOT NULL,
  alt_phone         TEXT,
  address           TEXT,
  enquiry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  follow_up_date    DATE,
  status            enquiry_status NOT NULL DEFAULT 'New',
  notes             TEXT,
  converted_to      UUID REFERENCES students(id),  -- set when admitted
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enquiries_status      ON enquiries(status);
CREATE INDEX idx_enquiries_follow_up   ON enquiries(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- ================================================================
-- FEE PAYMENTS
-- ================================================================

CREATE TABLE fee_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id   UUID NOT NULL REFERENCES student_enrollments(id) ON DELETE RESTRICT,
  receipt_no      TEXT NOT NULL UNIQUE,       -- RCT-2026-0001
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode    payment_mode NOT NULL DEFAULT 'Cash',
  transaction_id  TEXT,
  notes           TEXT,
  drive_file_id   TEXT,                       -- Google Drive ID of the receipt PDF
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_payments_student    ON fee_payments(student_id);
CREATE INDEX idx_fee_payments_enrollment ON fee_payments(enrollment_id);
CREATE INDEX idx_fee_payments_date       ON fee_payments(payment_date);

-- Function: generate receipt number (e.g. RCT-2026-0001)
CREATE SEQUENCE receipt_seq START 1;
CREATE OR REPLACE FUNCTION next_receipt_no()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RCT-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(NEXTVAL('receipt_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- EXPENSES
-- ================================================================

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        expense_category NOT NULL,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_date     ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ================================================================
-- SALARY PAYMENTS
-- Salary payments auto-create an expense entry via trigger
-- ================================================================

CREATE TABLE salary_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  pay_month   CHAR(7) NOT NULL,              -- 'YYYY-MM' e.g. '2026-07'
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_id  UUID REFERENCES expenses(id),  -- auto-linked expense entry
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, pay_month)               -- one salary payment per staff per month
);

CREATE INDEX idx_salary_staff ON salary_payments(staff_id);
CREATE INDEX idx_salary_month ON salary_payments(pay_month);

-- Trigger: auto-create expense when salary is paid
CREATE OR REPLACE FUNCTION salary_payment_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_expense_id UUID;
  v_staff_name TEXT;
BEGIN
  SELECT name INTO v_staff_name FROM staff WHERE id = NEW.staff_id;

  INSERT INTO expenses (category, amount, expense_date, note)
  VALUES ('Salary', NEW.amount, NEW.paid_date,
          'Salary - ' || v_staff_name || ' (' || NEW.pay_month || ')')
  RETURNING id INTO v_expense_id;

  UPDATE salary_payments SET expense_id = v_expense_id WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_salary_to_expense
AFTER INSERT ON salary_payments
FOR EACH ROW EXECUTE FUNCTION salary_payment_to_expense();

-- Trigger: delete linked expense when salary payment is deleted
CREATE OR REPLACE FUNCTION salary_payment_delete_expense()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.expense_id IS NOT NULL THEN
    DELETE FROM expenses WHERE id = OLD.expense_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_salary_delete_expense
AFTER DELETE ON salary_payments
FOR EACH ROW EXECUTE FUNCTION salary_payment_delete_expense();

-- ================================================================
-- ATTENDANCE
-- Handles both students and staff in one table
-- ================================================================

CREATE TABLE attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  entity_type NOT NULL,
  entity_id    UUID NOT NULL,               -- student_id or staff_id
  date         DATE NOT NULL,
  status       attendance_status NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, date)     -- one record per person per day
);

CREATE INDEX idx_attendance_entity ON attendance(entity_type, entity_id);
CREATE INDEX idx_attendance_date   ON attendance(date);

-- ================================================================
-- DOCUMENTS (Google Drive references)
-- One table for all document types across students and staff
-- ================================================================

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     entity_type NOT NULL,
  entity_id       UUID NOT NULL,             -- student_id or staff_id
  doc_type        doc_type NOT NULL,
  drive_file_id   TEXT NOT NULL,             -- Google Drive file ID
  drive_folder_id TEXT,                      -- Google Drive folder ID
  file_name       TEXT NOT NULL,             -- original filename
  file_size_bytes BIGINT,
  mime_type       TEXT,
  uploaded_by     TEXT,                      -- staff name or 'system'
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, doc_type) -- one of each doc type per person
                                             -- remove UNIQUE if multiple allowed
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);

-- ================================================================
-- UPDATED_AT TRIGGERS (auto-update on every row change)
-- ================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_updated_at
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_enquiries_updated_at
BEFORE UPDATE ON enquiries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS)
-- Enable after confirming your auth setup
-- ================================================================

ALTER TABLE students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years      ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes             ENABLE ROW LEVEL SECURITY;

-- Single school, single authenticated user (Sandya / you)
-- All authenticated users get full access
-- Expand this later if you add role-based access (coordinator vs admin)
CREATE POLICY "Authenticated users have full access" ON students
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON student_enrollments
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON staff
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON enquiries
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON fee_payments
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON salary_payments
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON expenses
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON attendance
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON documents
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON academic_years
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON classes
  FOR ALL USING (auth.role() = 'authenticated');

-- ================================================================
-- USEFUL VIEWS
-- ================================================================

-- Current year active students with their class
CREATE OR REPLACE VIEW v_active_students AS
SELECT
  s.id,
  s.admission_no,
  s.name,
  s.dob,
  s.aadhaar,
  s.father_name,
  s.father_phone,
  s.mother_name,
  s.mother_phone,
  s.address,
  s.status,
  c.name        AS class_name,
  c.code        AS class_code,
  c.fee_type,
  e.roll_no,
  e.agreed_fee,
  e.academic_year_id,
  ay.label      AS academic_year
FROM students s
JOIN student_enrollments e  ON e.student_id = s.id
JOIN classes c              ON c.id = e.class_id
JOIN academic_years ay      ON ay.id = e.academic_year_id
WHERE ay.is_current = TRUE
  AND s.status = 'Active';

-- Fee collection summary per student for current year
CREATE OR REPLACE VIEW v_fee_summary AS
SELECT
  s.id            AS student_id,
  s.admission_no,
  s.name,
  c.name          AS class_name,
  c.fee_type,
  e.roll_no,
  e.agreed_fee,
  ay.label        AS academic_year,
  COALESCE(SUM(fp.amount), 0)             AS total_paid,
  e.agreed_fee - COALESCE(SUM(fp.amount), 0) AS balance,
  COUNT(fp.id)                            AS payment_count,
  MAX(fp.payment_date)                    AS last_payment_date
FROM students s
JOIN student_enrollments e  ON e.student_id = s.id
JOIN classes c              ON c.id = e.class_id
JOIN academic_years ay      ON ay.id = e.academic_year_id
LEFT JOIN fee_payments fp   ON fp.enrollment_id = e.id
WHERE ay.is_current = TRUE
GROUP BY s.id, s.admission_no, s.name, c.name, c.fee_type, e.roll_no, e.agreed_fee, ay.label;

-- Monthly income vs expense summary
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT
  TO_CHAR(payment_date, 'YYYY-MM') AS month,
  SUM(amount)                       AS income
FROM fee_payments
GROUP BY TO_CHAR(payment_date, 'YYYY-MM')

UNION ALL

SELECT
  TO_CHAR(expense_date, 'YYYY-MM') AS month,
  -SUM(amount)                      AS income   -- negative for expenses
FROM expenses
GROUP BY TO_CHAR(expense_date, 'YYYY-MM');

-- ================================================================
-- SEED: Initial academic year (update dates to match your school)
-- ================================================================

INSERT INTO academic_years (label, start_date, end_date, is_current)
VALUES ('2026-27', '2026-05-01', '2027-04-30', TRUE);


-- ================================================================
-- KIDZEE TIRUCHANOOR — Tighten RLS to authenticated users only
-- Run this in Supabase SQL Editor after adding login to the app
-- ================================================================

-- Drop the temporary anon policies created during Phase 1
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students','student_enrollments','staff','enquiries',
    'fee_payments','salary_payments','expenses','attendance',
    'documents','academic_years','classes',
    'admission_counters','roll_counters'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_full_access" ON %I', t);

    -- Create new policy: authenticated users only
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON %I
       FOR ALL TO authenticated
       USING (true) WITH CHECK (true)', t);
  END LOOP;
END;
$$;

-- Grant RPC functions to authenticated role
GRANT EXECUTE ON FUNCTION next_admission_no(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION next_roll_no(UUID, UUID) TO authenticated;

-- Revoke RPC access from anon (no longer needed)
REVOKE EXECUTE ON FUNCTION next_admission_no(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION next_roll_no(UUID, UUID) FROM anon;


-- ================================================================
-- KIDZEE TIRUCHANOOR — Document Management Migration
-- Run this ONCE in Supabase SQL Editor
-- Extends existing `documents` table for Supabase Storage,
-- with a provider column so Google Drive can be added later
-- without any schema changes.
-- ================================================================

-- 1. Extend doc_type enum with transfer_certificate
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'transfer_certificate';

-- 2. Add new columns to the existing documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS storage_path     TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by      UUID REFERENCES auth.users(id);

-- storage_provider values used by the app: 'supabase' | 'google_drive'
-- storage_path = Supabase Storage object path when provider = 'supabase'
--              = Google Drive file ID when provider = 'google_drive' (future)
-- drive_file_id / drive_folder_id columns already exist from original
-- schema and remain unused while provider = 'supabase'

-- 3. RLS on documents table (authenticated users only, matches rest of app)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON documents;
CREATE POLICY "authenticated_full_access" ON documents
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4. Grants (required in addition to RLS — same pattern as rest of schema)
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated;

-- ================================================================
-- STORAGE BUCKET SETUP — must also be done manually in Supabase
-- Dashboard → Storage → New Bucket
--   Name: kidzee-documents
--   Public: OFF (must be private)
-- ================================================================

-- 5. Storage RLS policies (run after creating the bucket above)
-- These restrict all storage access to authenticated users only.

CREATE POLICY "authenticated_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kidzee-documents');

CREATE POLICY "authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kidzee-documents');

CREATE POLICY "authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kidzee-documents');


-- ================================================================
-- KIDZEE TIRUCHANOOR — Schema Patch
-- Run this ONCE in Supabase SQL Editor after your initial schema
-- ================================================================

-- ── 1. Missing columns ─────────────────────────────────────────

ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS child_age       TEXT,
  ADD COLUMN IF NOT EXISTS class_interested TEXT DEFAULT 'Playgroup',
  ADD COLUMN IF NOT EXISTS alt_phone       TEXT,
  ADD COLUMN IF NOT EXISTS notes           TEXT;

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS note                TEXT,
  ADD COLUMN IF NOT EXISTS academic_year_label TEXT;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS linked_salary BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

-- ── 2. Unique constraints (required for UPSERT) ─────────────────

ALTER TABLE attendance
  DROP CONSTRAINT IF EXISTS attendance_entity_date_unique;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_entity_date_unique
  UNIQUE (entity_type, entity_id, date);

ALTER TABLE salary_payments
  DROP CONSTRAINT IF EXISTS salary_staff_month_unique;
ALTER TABLE salary_payments
  ADD CONSTRAINT salary_staff_month_unique
  UNIQUE (staff_id, pay_month);

-- ── 3. next_admission_no ────────────────────────────────────────
-- Called from app when adding a new student.
-- Format: KZT{YY}{0001..9999}   e.g. KZT260001

CREATE OR REPLACE FUNCTION next_admission_no(p_ay_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq   INTEGER;
  v_label TEXT;
  v_yy    TEXT;
BEGIN
  INSERT INTO admission_counters (academic_year_id, last_seq)
  VALUES (p_ay_id, 1)
  ON CONFLICT (academic_year_id)
  DO UPDATE SET last_seq = admission_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  SELECT label INTO v_label FROM academic_years WHERE id = p_ay_id;
  -- label = "2026-27" → chars 3-4 = "26"
  v_yy := SUBSTRING(v_label, 3, 2);
  RETURN 'KZT' || v_yy || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- ── 4. next_roll_no ─────────────────────────────────────────────
-- Format: {YY}{CC}{NN}   e.g. 26NS03

CREATE OR REPLACE FUNCTION next_roll_no(p_ay_id UUID, p_class_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq   INTEGER;
  v_label TEXT;
  v_code  TEXT;
  v_yy    TEXT;
BEGIN
  INSERT INTO roll_counters (academic_year_id, class_id, last_seq)
  VALUES (p_ay_id, p_class_id, 1)
  ON CONFLICT (academic_year_id, class_id)
  DO UPDATE SET last_seq = roll_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  SELECT label INTO v_label FROM academic_years WHERE id = p_ay_id;
  SELECT code  INTO v_code  FROM classes          WHERE id = p_class_id;
  v_yy := SUBSTRING(v_label, 3, 2);
  RETURN v_yy || v_code || LPAD(v_seq::TEXT, 2, '0');
END;
$$;

-- ── 5. Salary → Expense trigger ────────────────────────────────
-- Automatically creates an Expense row whenever a salary payment
-- is inserted, and links it back via expense_id.

CREATE OR REPLACE FUNCTION fn_auto_salary_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exp_id   UUID;
  v_staff_nm TEXT;
BEGIN
  SELECT name INTO v_staff_nm FROM staff WHERE id = NEW.staff_id;

  INSERT INTO expenses (category, amount, expense_date, note, linked_salary)
  VALUES (
    'Salary',
    NEW.amount,
    COALESCE(NEW.paid_date, CURRENT_DATE),
    'Salary - ' || COALESCE(v_staff_nm, 'Staff') || ' (' || NEW.pay_month || ')',
    TRUE
  )
  RETURNING id INTO v_exp_id;

  NEW.expense_id := v_exp_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_salary_expense ON salary_payments;
CREATE TRIGGER trg_salary_expense
BEFORE INSERT ON salary_payments
FOR EACH ROW
WHEN (NEW.expense_id IS NULL)
EXECUTE FUNCTION fn_auto_salary_expense();

-- ── 6. RLS policies ─────────────────────────────────────────────
-- Phase 1: anon key has full access (no user auth yet).
-- Phase 2: replace these with user-scoped policies once
--          Supabase Auth is wired up.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students','student_enrollments','staff','enquiries',
    'fee_payments','salary_payments','expenses','attendance',
    'documents','academic_years','classes',
    'admission_counters','roll_counters'
  ]
  LOOP
    -- Drop any existing policies that block anon access
    EXECUTE format(
      'DROP POLICY IF EXISTS "Authenticated users have full access" ON %I', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "anon_full_access" ON %I', t);
    -- Create permissive anon policy
    EXECUTE format(
      'CREATE POLICY "anon_full_access" ON %I FOR ALL TO anon
       USING (true) WITH CHECK (true)', t);
  END LOOP;
END;
$$;

-- Grant anon role execute rights on the two RPC functions
GRANT EXECUTE ON FUNCTION next_admission_no(UUID) TO anon;
GRANT EXECUTE ON FUNCTION next_roll_no(UUID, UUID) TO anon;

-- ── 7. Seed current academic year if missing ───────────────────
INSERT INTO academic_years (label, start_date, end_date, is_current)
VALUES ('2026-27', '2026-05-01', '2027-04-30', TRUE)
ON CONFLICT (label) DO NOTHING;



