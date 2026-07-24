-- ================================================================
-- KIDZEE TIRUCHANOOR — Kiosk Attendance Sync (RPC approach)
-- Run this ONCE in Supabase SQL Editor
--
-- Replaces the direct-write RLS policies from the previous migration
-- with a SECURITY DEFINER function — the same pattern already used
-- by next_admission_no, next_roll_no, and the salary->expense
-- trigger. Instead of granting the kiosk broad write access to
-- `attendance` and relying on policy composition to restrict it
-- correctly, the kiosk gets permission to call exactly ONE function
-- that does exactly ONE thing: mark a given teacher present, for
-- today only. The function itself enforces that only the kiosk
-- account may call it meaningfully.
-- ================================================================

-- Remove the previous direct-write policies — no longer needed,
-- this function-based approach replaces them.
DROP POLICY IF EXISTS "kiosk_mark_staff_present" ON attendance;
DROP POLICY IF EXISTS "kiosk_update_staff_present" ON attendance;

CREATE OR REPLACE FUNCTION mark_staff_present_from_kiosk(p_teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only the kiosk account may meaningfully use this function. Any
  -- other caller gets a clean rejection rather than silently doing
  -- nothing or affecting the wrong data.
  IF NOT is_kiosk_account() THEN
    RAISE EXCEPTION 'Only the kiosk account may call mark_staff_present_from_kiosk';
  END IF;

  INSERT INTO attendance (entity_type, entity_id, date, status)
  VALUES ('staff', p_teacher_id, CURRENT_DATE, 'present')
  ON CONFLICT (entity_type, entity_id, date)
  DO UPDATE SET status = 'present';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_staff_present_from_kiosk(UUID) TO authenticated;
