import { useState, useEffect } from 'react'
import { C } from '../lib/styles'
import { DB, getCurrentAY, getAYList } from '../lib/db'
import { CLASSES } from '../lib/constants'
import { today } from '../lib/utils'
import { Btn, Input, Select, Card, EmptyState, Pill, Badge } from '../components/ui'

const SUB_TABS = [
  { id: 'dashboard',    label: 'Dashboard' },
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

// ── Shared: fetch + group variants by category, with computed available/low-stock ──
function useVariantData(academicYearId) {
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const v = await DB.getInventoryVariants(academicYearId)
      setVariants(v.map(x => ({
        ...x,
        available: x.received_qty - x.issued_qty,
        lowStock: (x.received_qty - x.issued_qty) <= (x.inventory_items?.low_stock_threshold ?? 5),
      })))
    } catch (err) {
      console.error('Inventory load failed:', err)
      setLoadError(err.message || 'Could not load inventory data.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { if (academicYearId) load() }, [academicYearId])

  return { variants, loading, loadError, reload: load }
}

// ── Dashboard ────────────────────────────────────────────────────
function InventoryDashboard() {
  const ay = getCurrentAY()
  const { variants, loading, loadError, reload } = useVariantData(ay?.id)

  if (!ay) return <EmptyState msg="No active academic year configured." />
  if (loading) return <EmptyState msg="Loading inventory..." />
  if (loadError) {
    return (
      <Card style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: C.danger, fontWeight: 600, marginBottom: 10 }}>Could not load inventory data</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{loadError}</div>
        <Btn small onClick={reload}>Try Again</Btn>
      </Card>
    )
  }

  const byCategory = {}
  variants.forEach(v => {
    const cat = v.inventory_items?.inventory_categories?.name || 'Other'
    byCategory[cat] = byCategory[cat] || []
    byCategory[cat].push(v)
  })

  const lowStockItems = variants.filter(v => v.lowStock && v.received_qty > 0)

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Academic Year {ay.label}</div>

      {lowStockItems.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 20, background: '#FEF6E6', border: `1.5px solid ${C.amber}` }}>
          <div style={{ fontWeight: 700, color: C.amber, fontSize: 14, marginBottom: 10 }}>⚠ Low Stock Warnings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lowStockItems.map(v => (
              <div key={v.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span>{v.inventory_items?.inventory_categories?.name} — {v.inventory_items?.name}{v.variant_label !== 'Standard' && ` (${v.variant_label})`}</span>
                <b style={{ color: C.danger }}>{v.available} left</b>
              </div>
            ))}
          </div>
        </Card>
      )}

      {Object.entries(byCategory).map(([catName, catVariants]) => {
        const isBundle = catVariants[0]?.inventory_items?.inventory_categories?.is_bundle
        const totalReceived = catVariants.reduce((a, v) => a + v.received_qty, 0)
        const totalIssued = catVariants.reduce((a, v) => a + v.issued_qty, 0)
        const totalAvailable = totalReceived - totalIssued

        return (
          <Card key={catName} style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.teal, marginBottom: 12 }}>{catName}</div>

            {isBundle ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 10 }}>
                <MiniStat label="Received" value={totalReceived} />
                <MiniStat label="Issued" value={totalIssued} />
                <MiniStat label="Available" value={totalAvailable} color={totalAvailable <= 5 ? C.danger : C.success} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {catVariants.map(v => (
                  <div key={v.id} style={{
                    background: v.lowStock ? '#FEF6E6' : C.bg, border: `1px solid ${v.lowStock ? C.amber : C.border}`,
                    borderRadius: 10, padding: '8px 12px', minWidth: 90,
                  }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{v.variant_label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: v.lowStock ? C.danger : C.text }}>{v.available}</div>
                    {v.lowStock && <div style={{ fontSize: 10, color: C.amber, fontWeight: 600 }}>⚠ Low</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function MiniStat({ label, value, color = C.text }) {
  return (
    <div style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

// ── Current Inventory (table with filters) ─────────────────────────
function CurrentInventory() {
  const ayList = getAYList()
  const [selAyId, setSelAyId] = useState(getCurrentAY()?.id || '')
  const [catFilter, setCatFilter] = useState('All')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const { variants, loading, loadError, reload } = useVariantData(selAyId)

  const categories = [...new Set(variants.map(v => v.inventory_items?.inventory_categories?.name).filter(Boolean))]

  const filtered = variants.filter(v =>
    (catFilter === 'All' || v.inventory_items?.inventory_categories?.name === catFilter) &&
    (!lowStockOnly || v.lowStock)
  )

  if (loading) return <EmptyState msg="Loading inventory..." />
  if (loadError) {
    return (
      <Card style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: C.danger, fontWeight: 600, marginBottom: 10 }}>Could not load inventory data</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{loadError}</div>
        <Btn small onClick={reload}>Try Again</Btn>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <Select label="Academic Year" value={selAyId} onChange={e => setSelAyId(e.target.value)}>
          {ayList.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </Select>
        <Select label="Category" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Pill active={lowStockOnly} onClick={() => setLowStockOnly(!lowStockOnly)}>Low Stock Only</Pill>
      </div>

      {filtered.length === 0 ? <EmptyState msg="No inventory items match this filter." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(v => (
            <Card key={v.id} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {v.inventory_items?.inventory_categories?.name} — {v.inventory_items?.name}
                    {v.variant_label !== 'Standard' && <span style={{ color: C.muted, fontWeight: 400 }}> ({v.variant_label})</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Received: <b>{v.received_qty}</b> · Issued: <b>{v.issued_qty}</b> · Available: <b style={{ color: v.lowStock ? C.danger : C.success }}>{v.available}</b>
                  </div>
                </div>
                {v.lowStock && <Badge color={C.amber}>Low Stock</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stock Receipt (functional in this phase) ───────────────────────
function StockReceipt() {
  const [variants, setVariants] = useState([])
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [header, setHeader] = useState({
    date: today(), supplier: '', invoiceNumber: '', remarks: '',
  })
  const [lineItems, setLineItems] = useState([]) // [{variantId, quantity}]
  const [saving, setSaving] = useState(false)

  const ay = getCurrentAY()

  const load = async () => {
    setLoading(true)
    setLoadError('')
    if (!ay) { setLoading(false); return }
    try {
      const [v, r] = await Promise.all([
        DB.getInventoryVariants(ay.id),
        DB.getStockReceipts(ay.id),
      ])
      setVariants(v)
      setReceipts(r)
    } catch (err) {
      console.error('Inventory load failed:', err)
      setLoadError(err.message || 'Could not load inventory data.')
    } finally {
      // Always runs, whether the calls above succeeded, returned an
      // error, or threw — this is what prevents an infinite spinner.
      setLoading(false)
    }
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

  if (loadError) {
    return (
      <Card style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: C.danger, fontWeight: 600, marginBottom: 10 }}>Could not load inventory data</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{loadError}</div>
        <Btn small onClick={load}>Try Again</Btn>
      </Card>
    )
  }

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
// ── Student Distribution ─────────────────────────────────────────
function StudentDistribution({ students }) {
  const ay = getCurrentAY()
  const { variants, loading, loadError, reload } = useVariantData(ay?.id)

  const [studentId, setStudentId] = useState('')
  const [issueKit, setIssueKit] = useState(false)
  const [uniformSize, setUniformSize] = useState('')
  const [uniformQty, setUniformQty] = useState(2)
  const [shoesSize, setShoesSize] = useState('')
  const [shoesQty, setShoesQty] = useState(1)
  const [issueDate, setIssueDate] = useState(today())
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [issueError, setIssueError] = useState('')
  const [issueSuccess, setIssueSuccess] = useState('')
  const [priorIssuances, setPriorIssuances] = useState([])

  const activeStudents = students.filter(s => s.status === 'Active')
  const student = activeStudents.find(s => s.id === studentId)

  const kitVariant = variants.find(v => v.inventory_items?.inventory_categories?.name === 'Student Kit')
  const uniformVariants = variants.filter(v => v.inventory_items?.inventory_categories?.name === 'Uniform')
  const shoesVariants = variants.filter(v => v.inventory_items?.inventory_categories?.name === 'Shoes')

  useEffect(() => {
    if (!studentId) { setPriorIssuances([]); return }
    DB.getStudentIssuances(studentId).then(setPriorIssuances)
  }, [studentId])

  const alreadyIssuedKit = priorIssuances.some(i =>
    i.student_issuance_items?.some(li => li.inventory_variants?.inventory_items?.inventory_categories?.name === 'Student Kit')
  )

  const resetForm = () => {
    setIssueKit(false); setUniformSize(''); setUniformQty(2)
    setShoesSize(''); setShoesQty(1); setRemarks('')
  }

  const submit = async () => {
    setIssueError(''); setIssueSuccess('')
    if (!student) return setIssueError('Select a student first.')

    const lineItems = []
    if (issueKit && kitVariant) lineItems.push({ variantId: kitVariant.id, quantity: 1 })
    if (uniformSize && +uniformQty > 0) lineItems.push({ variantId: uniformSize, quantity: +uniformQty })
    if (shoesSize && +shoesQty > 0) lineItems.push({ variantId: shoesSize, quantity: +shoesQty })

    if (lineItems.length === 0) return setIssueError('Select at least one item to issue.')

    setSaving(true)
    const result = await DB.issueItemsToStudent(student.id, ay.id, issueDate, remarks, lineItems)
    setSaving(false)

    if (!result.ok) { setIssueError(result.error); return }

    setIssueSuccess(`Items issued to ${student.name}.`)
    resetForm()
    reload()
    DB.getStudentIssuances(studentId).then(setPriorIssuances)
  }

  if (!ay) return <EmptyState msg="No active academic year configured." />
  if (loading) return <EmptyState msg="Loading inventory..." />
  if (loadError) {
    return (
      <Card style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: C.danger, fontWeight: 600, marginBottom: 10 }}>Could not load inventory data</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{loadError}</div>
        <Btn small onClick={reload}>Try Again</Btn>
      </Card>
    )
  }

  return (
    <div>
      <Card style={{ padding: 18 }}>
        <Select label="Select Student" value={studentId} onChange={e => { setStudentId(e.target.value); setIssueError(''); setIssueSuccess('') }} style={{ marginBottom: 14 }}>
          <option value="">Choose a student...</option>
          {activeStudents.map(s => <option key={s.id} value={s.id}>{s.name} · {s.rollNo}</option>)}
        </Select>

        {student && (
          <>
            <div style={{ background: C.tealLight, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: C.muted }}>
              <b style={{ color: C.text }}>{student.name}</b> · Admission No: {student.admissionNo} · Class: {student.section} · AY {ay.label}
            </div>

            {alreadyIssuedKit && (
              <div style={{ fontSize: 12, color: C.amber, marginBottom: 12, fontWeight: 600 }}>
                ⚠ This student has already been issued a Student Kit this academic year.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Student Kit */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Student Kit</div>
                {kitVariant ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={issueKit} onChange={e => setIssueKit(e.target.checked)} disabled={kitVariant.available <= 0} />
                    Issue Student Kit {kitVariant.available <= 0 && <span style={{ color: C.danger }}>(Out of stock)</span>}
                  </label>
                ) : <div style={{ fontSize: 12, color: C.muted }}>No Student Kit configured.</div>}
              </div>

              {/* Uniform */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Uniform</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Select label="Size" value={uniformSize} onChange={e => setUniformSize(e.target.value)}>
                    <option value="">Not issuing</option>
                    {uniformVariants.map(v => (
                      <option key={v.id} value={v.id} disabled={v.available <= 0}>
                        {v.variant_label} {v.available <= 0 ? '(Out of stock)' : `(${v.available} available)`}
                      </option>
                    ))}
                  </Select>
                  <Input label="Quantity" type="number" value={uniformQty} onChange={e => setUniformQty(e.target.value)} style={{ width: 90 }} />
                </div>
              </div>

              {/* Shoes */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Shoes</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Select label="Size" value={shoesSize} onChange={e => setShoesSize(e.target.value)}>
                    <option value="">Not issuing</option>
                    {shoesVariants.map(v => (
                      <option key={v.id} value={v.id} disabled={v.available <= 0}>
                        {v.variant_label} {v.available <= 0 ? '(Out of stock)' : `(${v.available} available)`}
                      </option>
                    ))}
                  </Select>
                  <Input label="Quantity" type="number" value={shoesQty} onChange={e => setShoesQty(e.target.value)} style={{ width: 90 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                <Input label="Issue Date" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                <Input label="Remarks (optional)" value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>

              {issueError && <div style={{ fontSize: 13, color: C.danger, fontWeight: 600 }}>{issueError}</div>}
              {issueSuccess && <div style={{ fontSize: 13, color: C.success, fontWeight: 600 }}>{issueSuccess}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Btn onClick={submit} disabled={saving}>{saving ? 'Issuing...' : 'Issue Items'}</Btn>
              </div>
            </div>
          </>
        )}
      </Card>

      {student && priorIssuances.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: "'DM Serif Display'", fontSize: 16, color: C.teal, marginBottom: 10 }}>Prior Issuances</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {priorIssuances.map(iss => (
              <Card key={iss.id} style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{iss.issue_date}{iss.remarks && ` · ${iss.remarks}`}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(iss.student_issuance_items || []).map(li => (
                    <Badge key={li.id} color={C.teal} bg={C.tealLight}>
                      {li.inventory_variants?.inventory_items?.name}{li.inventory_variants?.variant_label !== 'Standard' && ` (${li.inventory_variants?.variant_label})`} × {li.quantity}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pending Distribution Report ─────────────────────────────────
const REQUIRED_CATEGORIES = ['Student Kit', 'Uniform', 'Shoes']

function PendingDistribution({ students }) {
  const ay = getCurrentAY()
  const [issuances, setIssuances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ay) return
    DB.getAllIssuancesForAY(ay.id).then(data => {
      setIssuances(data)
      setLoading(false)
    })
  }, [ay?.id])

  if (!ay) return <EmptyState msg="No active academic year configured." />
  if (loading) return <EmptyState msg="Loading..." />

  const receivedByStudent = {}
  issuances.forEach(iss => {
    const cats = (iss.student_issuance_items || [])
      .map(li => li.inventory_variants?.inventory_items?.inventory_categories?.name)
      .filter(Boolean)
    receivedByStudent[iss.student_id] = receivedByStudent[iss.student_id] || new Set()
    cats.forEach(c => receivedByStudent[iss.student_id].add(c))
  })

  const activeStudents = students.filter(s => s.status === 'Active')
  const withPending = activeStudents.map(s => {
    const received = receivedByStudent[s.id] || new Set()
    const pending = REQUIRED_CATEGORIES.filter(c => !received.has(c))
    return { ...s, pending }
  }).filter(s => s.pending.length > 0)

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
        {withPending.length} of {activeStudents.length} active students have pending items — AY {ay.label}
      </div>
      {withPending.length === 0 ? <EmptyState msg="Everyone is fully issued. Nothing pending." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {withPending.map(s => (
            <Card key={s.id} style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>· {s.section} · {s.admissionNo}</span></div>
                  {s.fatherPhone && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Parent: {s.fatherPhone}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.pending.map(p => <Badge key={p} color={C.danger} bg="#F8D7D2">{p}</Badge>)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Inventory({ students }) {
  const [sub, setSub] = useState('dashboard')
  return (
    <div>
      <div style={{ fontFamily: "'DM Serif Display'", fontSize: 22, color: C.teal, marginBottom: 16 }}>Inventory</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => <Pill key={t.id} active={sub === t.id} onClick={() => setSub(t.id)}>{t.label}</Pill>)}
      </div>
      {sub === 'dashboard' && <InventoryDashboard />}
      {sub === 'receipt' && <StockReceipt />}
      {sub === 'current' && <CurrentInventory />}
      {sub === 'distribution' && <StudentDistribution students={students} />}
      {sub === 'ledger' && <ComingSoon phase="Phase 6e" />}
      {sub === 'reports' && <PendingDistribution students={students} />}
    </div>
  )
}
