-- ================================================================
-- KIDZEE TIRUCHANOOR — RLS Correction (Allow-list redesign)
-- Run this ONCE in Supabase SQL Editor
--
-- WHAT WAS WRONG:
-- Every table had a leftover "anon_full_access" policy (USING true)
-- from before Supabase Auth login existed. RLS policies are additive
-- (OR'd together), so even though "authenticated_full_access" was
-- correctly updated to exclude the kiosk account, the leftover
-- "anon_full_access" policy still let ANY authenticated user through
-- — including the kiosk — because policies stack, they don't override
-- each other.
--
-- THE FIX (two parts):
-- 1. Remove every leftover anon_full_access policy — dead weight
--    from before login existed, no longer needed or safe to keep.
-- 2. Redesign as an allow-list: the kiosk role gets access ONLY on
--    the 2 tables it needs (already correctly scoped from Phase 1).
--    Every other table simply has no kiosk-matching policy at all,
--    which means Postgres denies by default — nothing to remember to
--    "exclude" table-by-table going forward. Safer for any new table
--    added later, since the default is now deny, not allow.
-- ================================================================

-- ── Part 1: remove every leftover anon_full_access policy ────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students', 'student_enrollments', 'staff', 'enquiries',
    'fee_payments', 'salary_payments', 'expenses', 'attendance',
    'documents', 'academic_years', 'classes',
    'admission_counters', 'roll_counters',
    'teacher_face_profiles', 'teacher_attendance', 'kiosk_accounts'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_full_access" ON %I', t);
  END LOOP;
END;
$$;

-- Same cleanup on storage.objects (documents feature)
DROP POLICY IF EXISTS "anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "anon_read"   ON storage.objects;
DROP POLICY IF EXISTS "anon_delete" ON storage.objects;


-- ── Part 2: simplify authenticated_full_access back to unrestricted ──
-- Now that anon_full_access is gone and the kiosk is handled purely
-- by NOT having any policy for it on these tables, the
-- "NOT is_kiosk_account()" clause on every other table becomes
-- redundant (the kiosk was never going to match a policy meant for
-- "authenticated" if we don't also explicitly write one for it) —
-- BUT we keep it anyway as defense-in-depth. Belt and suspenders:
-- even if a future policy is accidentally added without thinking
-- about the kiosk, this clause still blocks it explicitly on the
-- tables we know matter most.
--
-- (No changes needed here — the authenticated_full_access policies
-- from Phase 1 are already correctly written. This section is just
-- confirming no further action is needed on them.)


-- ── Verification query — run after the above to confirm ───────────
-- Should return exactly ONE policy per table now (authenticated_full_access
-- or admin_manage_* / kiosk_* for the two new tables), not two.

SELECT tablename, policyname, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
