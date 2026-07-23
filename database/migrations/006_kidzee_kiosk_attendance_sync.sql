-- ================================================================
-- KIDZEE TIRUCHANOOR — Kiosk Auto-Marks Staff Attendance
-- Run this ONCE in Supabase SQL Editor
--
-- Lets a kiosk check-in also mark that teacher "present" in the
-- original `attendance` table (used by Staff Attendance reports and
-- Today's Tasks), so an admin doesn't need to separately mark them
-- present by hand.
--
-- Scoped tightly: kiosk may only write rows where entity_type='staff'
-- and date=today. It still cannot touch student attendance rows, and
-- cannot write to any other date (no rewriting history).
-- ================================================================

CREATE POLICY "kiosk_mark_staff_present" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (is_kiosk_account() AND entity_type = 'staff' AND date = CURRENT_DATE);

CREATE POLICY "kiosk_update_staff_present" ON attendance
  FOR UPDATE TO authenticated
  USING (is_kiosk_account() AND entity_type = 'staff' AND date = CURRENT_DATE)
  WITH CHECK (is_kiosk_account() AND entity_type = 'staff' AND date = CURRENT_DATE);
