import { useState, useEffect } from 'react'
import { C } from '../lib/styles'
import { DB } from '../lib/db'
import { Badge, Card, EmptyState } from './ui'

const REQUIRED_CATEGORIES = ['Student Kit', 'Uniform', 'Shoes']

// Shows a student's full inventory issuance history — Student Kit,
// Uniform, Shoes, with dates and what was issued. Read-only view;
// actual issuing happens on the Inventory → Distribution page.
export default function StudentInventoryTab({ studentId }) {
  const [issuances, setIssuances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return
    DB.getStudentIssuances(studentId).then(data => {
      setIssuances(data)
      setLoading(false)
    })
  }, [studentId])

  if (loading) return <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Loading inventory history...</div>

  const receivedCategories = new Set(
    issuances.flatMap(iss => (iss.student_issuance_items || [])
      .map(li => li.inventory_variants?.inventory_items?.inventory_categories?.name)
      .filter(Boolean))
  )

  return (
    <div style={{ background: C.tealLight, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.teal, marginBottom: 10 }}>📦 INVENTORY / KIT</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {REQUIRED_CATEGORIES.map(cat => {
          const has = receivedCategories.has(cat)
          return (
            <Badge key={cat} color={has ? C.success : C.danger} bg={has ? '#C6EDD9' : '#F8D7D2'}>
              {cat}: {has ? 'Issued' : 'Pending'}
            </Badge>
          )
        })}
      </div>

      {issuances.length === 0 ? (
        <EmptyState msg="No items issued yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {issuances.map(iss => (
            <Card key={iss.id} style={{ padding: '10px 14px', background: '#fff' }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                {iss.issue_date}{iss.remarks && ` · ${iss.remarks}`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(iss.student_issuance_items || []).map(li => (
                  <Badge key={li.id} color={C.teal} bg={C.tealLight}>
                    {li.inventory_variants?.inventory_items?.name}
                    {li.inventory_variants?.variant_label !== 'Standard' && ` (${li.inventory_variants?.variant_label})`}
                    {' '}× {li.quantity}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
