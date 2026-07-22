-- ================================================================
-- KIDZEE TIRUCHANOOR — Kiosk Teacher Names View
-- Run this ONCE in Supabase SQL Editor
--
-- WHY THIS IS NEEDED:
-- The kiosk account is deliberately blocked from reading the `staff`
-- table (Phase 1 lockdown — it must never see salary, phone, Aadhaar,
-- etc). But the kiosk DOES need to greet a recognized teacher by name
-- on the welcome/success screen. Embedding a join through `staff`
-- doesn't work — Postgres enforces RLS on the joined table too, so
-- the join silently returns null instead of the name.
--
-- THE FIX: a narrow view exposing ONLY id + name, nothing else from
-- staff. Views in Postgres run with the VIEW OWNER's privileges by
-- default (not the querying role's) unless explicitly marked
-- security_invoker — so this view can bypass staff's RLS just for
-- these two harmless columns, while every other column stays fully
-- protected exactly as before.
-- ================================================================

CREATE OR REPLACE VIEW kiosk_staff_names AS
SELECT id, name FROM staff;

-- Explicitly NOT setting security_invoker=true — we want this view to
-- run as its owner (bypassing staff's restrictive RLS for just these
-- two columns), not as the querying kiosk role.

GRANT SELECT ON kiosk_staff_names TO authenticated;

-- No RLS needed on the view itself — it contains no sensitive data,
-- any authenticated user (including kiosk) seeing id+name is fine.
