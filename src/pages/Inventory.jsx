import { useState, useEffect } from 'react'
import { C } from '../lib/styles'
import { DB, getCurrentAY, getAYList } from '../lib/db'
import { today } from '../lib/utils'
import { Btn, Input, Select, Card, EmptyState, Pill, Badge } from '../components/ui'

const SUB_TABS = [
  { id: 'receipt',      label: 'Stock Receipt' },
  { id: 'current',      label: 'Current Inventory' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'ledger',       label: 'Stock Ledger' },
  { id: 'reports',      label: 'Reports' },
]

// Phases not yet built — shown as a clear "coming soon" rather than
// a blank/broken tab, so the full intended menu shape is visible now.
function ComingSoon({ phase }) {
  return <EmptyState msg={`This section is planned for ${phase} — not built yet.`} />
}

// ── Stock Receipt (functional in this phase) ───────────────────────
function StockReceipt() {
  const [variants, setVariants] = useState([])
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [header, setHeader] = useState({
    date: today(), supplier: '', invoiceNumber: '', remarks: '',
  })
  const [lineItems, setLineItems] = useState([]) // [{variantId, quantity}]
  const [saving, setSaving] = useState(false)

  const ay = getCurrentAY()

  const load = async () => {
    if (!ay) { setLoading(false); return }
    const [v, r] = await Promise.all([
      DB.getInventoryVariants(ay.id),
      DB.getStockReceipts(ay.id),
    ])
    setVariants(v)
    setReceipts(r)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const addLine = () => setLineItems(prev => [...prev, { variantId: '', quantity: '' }])
  const updateLine = (idx, key, val) => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [key]: val } : li))
  const removeLine = idx => setLineItems(prev => prev.filter((_, i) => i !== idx))

  const variantLabel = v => {
    const catName = v.inventory_items?.inventory_categories?.name || ''
    const itemName = v.inventory_items?.name || ''
    return v.variant_label === 'Standard' ? `${catName} — ${itemName}` : `${catName} — ${itemName} (${v.variant_label})`
  }

  const submit = async () => {
    const validLines = lineItems.filter(li => li.variantId && +li.quantity > 0)
    if (validLines.length === 0) return alert('Add at least one item with a quantity.')
    if (!ay) return alert('No active academic year found.')

    setSaving(true)
    const receiptId = await DB.createStockReceipt(
      { ...header, academicYearId: ay.id },
      validLines.map(li => ({ variantId: li.variantId, quantity: +li.quantity }))
    )
    setSaving(false)

    if (!receiptId) return alert('Could not save receipt. Please try again.')

    setHeader({ date: today(), supplier: '', invoiceNumber: '', remarks: '' })
    setLineItems([])
    load()
  }

  if (loading) return <EmptyState msg="Loading inventory..." />
  if (!ay) return <EmptyState msg="No active academic year configured." />

  return (
    <div>
      <Card style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.teal, marginBottom: 14 }}>New Stock Receipt</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 14 }}>
          <Input label="Date" type="date" value={header.date} onChange={e => setHeader(p => ({ ...p, date: e.target.value }))} />
          <Input label="Supplier" value={header.supplier} onChange={e => setHeader(p => ({ ...p, supplier: e.target.value }))} placeholder="Kidzee" />
          <Input label="Invoice Number" value={header.invoiceNumber} onChange={e => setHeader(p => ({ ...p, invoiceNumber: e.target.value }))} />
        </div>
        <Input label="Remarks (optional)" value={header.remarks} onChange={e => setHeader(p => ({ ...p, remarks: e.target.value }))} style={{ marginBottom: 14 }} />

        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase' }}>Items Received</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {lineItems.map((li, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Select label="Item" value={li.variantId} onChange={e => updateLine(idx, 'variantId', e.target.value)} style={{ flex: 2, minWidth: 200 }}>
                <option value="">Select item...</option>
                {variants.map(v => <option key={v.id} value={v.id}>{variantLabel(v)}</option>)}
              </Select>
              <Input label="Qty" type="number" value={li.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} style={{ width: 90 }} />
              <Btn small variant="danger" onClick={() => removeLine(idx)}>✕</Btn>
            </div>
          ))}
        </div>
        <Btn small variant="ghost" onClick={addLine}>+ Add Item</Btn>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save Receipt'}</Btn>
        </div>
      </Card>

      <div style={{ fontFamily: "'DM Serif Display'", fontSize: 18, color: C.teal, marginBottom: 12 }}>Recent Receipts</div>
      {receipts.length === 0 ? <EmptyState msg="No stock receipts recorded yet for this academic year." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {receipts.map(r => (
            <Card key={r.id} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.receipt_date} {r.supplier && `· ${r.supplier}`} {r.invoice_number && `· Inv# ${r.invoice_number}`}</div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(r.stock_receipt_items || []).map(item => (
                  <Badge key={item.id} color={C.teal} bg={C.tealLight}>
                    {item.inventory_variants?.inventory_items?.name} {item.inventory_variants?.variant_label !== 'Standard' && `(${item.inventory_variants?.variant_label})`} × {item.quantity}
                  </Badge>
                ))}
              </div>
              {r.remarks && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{r.remarks}</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Root Inventory page ─────────────────────────────────────────────
export default function Inventory() {
  const [sub, setSub] = useState('receipt')
  return (
    <div>
      <div style={{ fontFamily: "'DM Serif Display'", fontSize: 22, color: C.teal, marginBottom: 16 }}>Inventory</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => <Pill key={t.id} active={sub === t.id} onClick={() => setSub(t.id)}>{t.label}</Pill>)}
      </div>
      {sub === 'receipt' && <StockReceipt />}
      {sub === 'current' && <ComingSoon phase="Phase 6b" />}
      {sub === 'distribution' && <ComingSoon phase="Phase 6c" />}
      {sub === 'ledger' && <ComingSoon phase="Phase 6e" />}
      {sub === 'reports' && <ComingSoon phase="Phase 6d/6e" />}
    </div>
  )
}
