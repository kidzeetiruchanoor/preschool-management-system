export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export const fmt = n => 'Rs. ' + Number(n || 0).toLocaleString('en-IN')

export const monthLabel = ym => {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[+m - 1]} ${y}`
}

export const currentYM = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

export const dateToYM = date => date?.slice(0, 7) || ''

export const endOfMonth = ym => {
  const [y, m] = ym.split('-').map(Number)
  return `${y}-${String(m).padStart(2,'0')}-31`
}

export function getAcademicYear(dateStr) {
  const d = new Date(dateStr || today())
  const y = d.getFullYear(), m = d.getMonth() + 1
  const startYear = m >= 5 ? y : y - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2,'0')}`
}

export function currentAcademicYear() { return getAcademicYear(today()) }

export function academicYearMonths(ay) {
  const startYear = parseInt(ay.split('-')[0], 10)
  const out = []
  for (let i = 0; i < 12; i++) {
    const m = 5 + i
    const y = m > 12 ? startYear + 1 : startYear
    const mm = m > 12 ? m - 12 : m
    out.push(`${y}-${String(mm).padStart(2,'0')}`)
  }
  return out
}

export function academicYearOptions() {
  const cur = currentAcademicYear()
  const startYear = parseInt(cur.split('-')[0], 10)
  const out = []
  for (let i = -2; i <= 1; i++) {
    const sy = startYear + i
    out.push(`${sy}-${String((sy + 1) % 100).padStart(2,'0')}`)
  }
  return out.reverse()
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function attDateRange(ym) {
  const n = daysInMonth(ym)
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2,'0')}`)
}

export function exportCSV(filename, rows, columns) {
  const esc = v => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => esc(c.label)).join(',')
  const lines = rows.map(r =>
    columns.map(c => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(',')
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
