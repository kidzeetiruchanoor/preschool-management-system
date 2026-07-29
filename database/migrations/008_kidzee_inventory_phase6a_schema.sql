-- ================================================================
-- KIDZEE TIRUCHANOOR — Inventory Module (Phase 6a: Schema + Receipt)
-- Run this ONCE in Supabase SQL Editor
--
-- DESIGN: Nothing about "Student Kit", "Uniform", or "Shoes" is
-- hardcoded in code — they are just rows in master tables. Adding a
-- new category (Toys, Stationery, etc.) later is a data insert, not
-- a schema change.
-- ================================================================

CREATE TYPE inventory_txn_type AS ENUM ('receipt', 'issuance', 'adjustment', 'return');

-- ── Master: Categories ────────────────────────────────────────────
CREATE TABLE inventory_categories (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL UNIQUE,
  is_bundle    BOOLEAN NOT NULL DEFAULT FALSE,  -- true for "Student Kit" (issuing it implies all its components)
  has_variants BOOLEAN NOT NULL DEFAULT FALSE,  -- true for "Uniform"/"Shoes" (tracked per size)
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Master: Items within a category ───────────────────────────────
CREATE TABLE inventory_items (
  id                  UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         UUID     NOT NULL REFERENCES inventory_categories(id),
  name                TEXT     NOT NULL,
  default_issue_qty   SMALLINT NOT NULL DEFAULT 1,   -- e.g. Uniform=2, Shoes=1, Kit=1
  low_stock_threshold INT      NOT NULL DEFAULT 5,
  is_active           BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, name)
);

-- ── Master: Bundle components (display-only — e.g. what's inside a Student Kit) ──
CREATE TABLE inventory_bundle_components (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  sort_order     SMALLINT NOT NULL DEFAULT 0
);

-- ── Variants: size-based stock tracking, per academic year ────────
-- Items without real variants (Student Kit) still get exactly one
-- variant row with variant_label = 'Standard', so every item can be
-- treated uniformly in code (always "select a variant, then move stock").
CREATE TABLE inventory_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_label    TEXT NOT NULL DEFAULT 'Standard',
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  received_qty     INT  NOT NULL DEFAULT 0,
  issued_qty       INT  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, variant_label, academic_year_id),
  CHECK (issued_qty <= received_qty)
);

-- ── Stock Receipts (header + line items) ──────────────────────────
CREATE TABLE stock_receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier         TEXT,
  invoice_number   TEXT,
  academic_year_id UUID REFERENCES academic_years(id),
  remarks          TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_receipt_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES inventory_variants(id),
  quantity   INT  NOT NULL CHECK (quantity > 0)
);

-- ── Stock Ledger — append-only audit trail for every movement ─────
CREATE TABLE stock_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_type        inventory_txn_type NOT NULL,
  reference_id    UUID,              -- ties multiple ledger rows to one receipt/issuance
  variant_id      UUID NOT NULL REFERENCES inventory_variants(id),
  quantity_change INT  NOT NULL,     -- positive for receipt, negative for issuance
  balance_after   INT  NOT NULL,
  performed_by    UUID REFERENCES auth.users(id),
  txn_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX idx_stock_ledger_variant ON stock_ledger(variant_id);
CREATE INDEX idx_stock_ledger_reference ON stock_ledger(reference_id);
CREATE INDEX idx_inventory_variants_item ON inventory_variants(item_id);

-- ================================================================
-- SEED DATA — initial categories/items/variants per your spec
-- ================================================================

INSERT INTO inventory_categories (name, is_bundle, has_variants, sort_order) VALUES
  ('Student Kit', TRUE,  FALSE, 1),
  ('Uniform',     FALSE, TRUE,  2),
  ('Shoes',       FALSE, TRUE,  3);

-- Student Kit (bundle, single item, no size variants)
INSERT INTO inventory_items (category_id, name, default_issue_qty, low_stock_threshold)
SELECT id, 'Student Kit', 1, 5 FROM inventory_categories WHERE name = 'Student Kit';

INSERT INTO inventory_bundle_components (item_id, component_name, sort_order)
SELECT id, comp, ord FROM inventory_items,
  (VALUES ('Books',1), ('School Bag',2), ('ID Card',3), ('Parent Pass',4), ('Report Card',5), ('Cap',6)) AS c(comp, ord)
WHERE inventory_items.name = 'Student Kit';

-- Uniform (sized, 2 sets issued per student by default)
INSERT INTO inventory_items (category_id, name, default_issue_qty, low_stock_threshold)
SELECT id, 'Uniform Set', 2, 5 FROM inventory_categories WHERE name = 'Uniform';

-- Shoes (sized, 1 pair issued per student by default)
INSERT INTO inventory_items (category_id, name, default_issue_qty, low_stock_threshold)
SELECT id, 'Shoes', 1, 5 FROM inventory_categories WHERE name = 'Shoes';

-- Seed common size variants for the current academic year (adjust
-- sizes/quantities anytime via the app — this just avoids starting
-- from a completely empty variant list).
DO $$
DECLARE
  v_ay_id UUID;
  v_kit_item UUID;
  v_uniform_item UUID;
  v_shoes_item UUID;
  v_size TEXT;
BEGIN
  SELECT id INTO v_ay_id FROM academic_years WHERE is_current = TRUE LIMIT 1;
  SELECT id INTO v_kit_item FROM inventory_items WHERE name = 'Student Kit';
  SELECT id INTO v_uniform_item FROM inventory_items WHERE name = 'Uniform Set';
  SELECT id INTO v_shoes_item FROM inventory_items WHERE name = 'Shoes';

  INSERT INTO inventory_variants (item_id, variant_label, academic_year_id)
  VALUES (v_kit_item, 'Standard', v_ay_id);

  FOREACH v_size IN ARRAY ARRAY['18','20','22','24','26','28','30']
  LOOP
    INSERT INTO inventory_variants (item_id, variant_label, academic_year_id)
    VALUES (v_uniform_item, 'Size ' || v_size, v_ay_id);
  END LOOP;

  FOREACH v_size IN ARRAY ARRAY['7','8','9','10','11','12','13']
  LOOP
    INSERT INTO inventory_variants (item_id, variant_label, academic_year_id)
    VALUES (v_shoes_item, 'Size ' || v_size, v_ay_id);
  END LOOP;
END;
$$;

-- ================================================================
-- RPC: create a stock receipt with multiple line items atomically
-- ================================================================
CREATE OR REPLACE FUNCTION create_stock_receipt(
  p_receipt_date DATE,
  p_supplier TEXT,
  p_invoice_number TEXT,
  p_academic_year_id UUID,
  p_remarks TEXT,
  p_line_items JSONB  -- [{variant_id, quantity}, ...]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receipt_id UUID;
  v_line JSONB;
  v_variant_id UUID;
  v_qty INT;
  v_new_balance INT;
BEGIN
  INSERT INTO stock_receipts (receipt_date, supplier, invoice_number, academic_year_id, remarks, created_by)
  VALUES (p_receipt_date, p_supplier, p_invoice_number, p_academic_year_id, p_remarks, auth.uid())
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_variant_id := (v_line->>'variant_id')::UUID;
    v_qty := (v_line->>'quantity')::INT;

    INSERT INTO stock_receipt_items (receipt_id, variant_id, quantity)
    VALUES (v_receipt_id, v_variant_id, v_qty);

    UPDATE inventory_variants
    SET received_qty = received_qty + v_qty, updated_at = NOW()
    WHERE id = v_variant_id
    RETURNING received_qty - issued_qty INTO v_new_balance;

    INSERT INTO stock_ledger (txn_type, reference_id, variant_id, quantity_change, balance_after, performed_by, notes)
    VALUES ('receipt', v_receipt_id, v_variant_id, v_qty, v_new_balance, auth.uid(), p_remarks);
  END LOOP;

  RETURN v_receipt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_stock_receipt(DATE, TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated;

-- ================================================================
-- RLS — same pattern as the rest of your schema: authenticated
-- users (i.e. admins, NOT the kiosk) get full access. The kiosk
-- account is never granted anything on these tables at all.
-- ================================================================

ALTER TABLE inventory_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_bundle_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_variants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_receipts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_receipt_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger                ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_categories', 'inventory_items', 'inventory_bundle_components',
    'inventory_variants', 'stock_receipts', 'stock_receipt_items', 'stock_ledger'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON %I
       FOR ALL TO authenticated
       USING (NOT is_kiosk_account()) WITH CHECK (NOT is_kiosk_account())', t);
  END LOOP;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  inventory_categories, inventory_items, inventory_bundle_components,
  inventory_variants, stock_receipts, stock_receipt_items, stock_ledger
  TO authenticated;
