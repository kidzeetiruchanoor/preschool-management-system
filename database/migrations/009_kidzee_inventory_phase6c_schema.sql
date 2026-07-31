-- ================================================================
-- KIDZEE TIRUCHANOOR — Inventory Module (Phase 6c: Student Distribution)
-- Run this ONCE in Supabase SQL Editor
-- ================================================================

-- ── Student Issuances (header + line items) ────────────────────────
CREATE TABLE student_issuances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by        UUID REFERENCES auth.users(id),
  remarks          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_issuance_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_id  UUID NOT NULL REFERENCES student_issuances(id) ON DELETE CASCADE,
  variant_id   UUID NOT NULL REFERENCES inventory_variants(id),
  quantity     INT  NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_student_issuances_student ON student_issuances(student_id);
CREATE INDEX idx_issuance_items_issuance ON student_issuance_items(issuance_id);

-- ================================================================
-- RPC: issue items to a student — atomic, all-or-nothing.
-- If ANY line item doesn't have enough stock, the whole function
-- raises an exception and Postgres rolls back everything (nothing
-- partially issued), exactly per the spec's requirement.
-- ================================================================
CREATE OR REPLACE FUNCTION issue_items_to_student(
  p_student_id UUID,
  p_academic_year_id UUID,
  p_issue_date DATE,
  p_remarks TEXT,
  p_line_items JSONB  -- [{variant_id, quantity}, ...]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_issuance_id UUID;
  v_line JSONB;
  v_variant_id UUID;
  v_qty INT;
  v_available INT;
  v_item_name TEXT;
  v_variant_label TEXT;
  v_new_balance INT;
BEGIN
  -- First pass: verify every line has enough stock BEFORE changing
  -- anything. This is what guarantees "if any item is unavailable,
  -- show an error and do not issue anything" — we check everything
  -- up front rather than deducting as we go and having to undo.
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_variant_id := (v_line->>'variant_id')::UUID;
    v_qty := (v_line->>'quantity')::INT;

    SELECT (received_qty - issued_qty), iv.variant_label, ii.name
      INTO v_available, v_variant_label, v_item_name
      FROM inventory_variants iv
      JOIN inventory_items ii ON ii.id = iv.item_id
      WHERE iv.id = v_variant_id;

    IF v_available IS NULL THEN
      RAISE EXCEPTION 'Item not found: %', v_variant_id;
    END IF;

    IF v_available < v_qty THEN
      RAISE EXCEPTION 'Not enough stock for % (%): % available, % requested',
        v_item_name, v_variant_label, v_available, v_qty;
    END IF;
  END LOOP;

  -- All checks passed — now actually create the issuance and deduct stock.
  INSERT INTO student_issuances (student_id, academic_year_id, issue_date, remarks, issued_by)
  VALUES (p_student_id, p_academic_year_id, p_issue_date, p_remarks, auth.uid())
  RETURNING id INTO v_issuance_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_variant_id := (v_line->>'variant_id')::UUID;
    v_qty := (v_line->>'quantity')::INT;

    INSERT INTO student_issuance_items (issuance_id, variant_id, quantity)
    VALUES (v_issuance_id, v_variant_id, v_qty);

    UPDATE inventory_variants
    SET issued_qty = issued_qty + v_qty, updated_at = NOW()
    WHERE id = v_variant_id
    RETURNING received_qty - issued_qty INTO v_new_balance;

    INSERT INTO stock_ledger (txn_type, reference_id, variant_id, quantity_change, balance_after, performed_by, notes)
    VALUES ('issuance', v_issuance_id, v_variant_id, -v_qty, v_new_balance, auth.uid(), p_remarks);
  END LOOP;

  RETURN v_issuance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION issue_items_to_student(UUID, UUID, DATE, TEXT, JSONB) TO authenticated;

-- ================================================================
-- RLS — same pattern as the rest of the inventory module
-- ================================================================
ALTER TABLE student_issuances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_issuance_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON student_issuances
  FOR ALL TO authenticated
  USING (NOT is_kiosk_account()) WITH CHECK (NOT is_kiosk_account());

CREATE POLICY "authenticated_full_access" ON student_issuance_items
  FOR ALL TO authenticated
  USING (NOT is_kiosk_account()) WITH CHECK (NOT is_kiosk_account());

GRANT SELECT, INSERT, UPDATE, DELETE ON student_issuances, student_issuance_items TO authenticated;
