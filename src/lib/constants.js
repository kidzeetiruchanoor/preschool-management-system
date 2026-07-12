import { C } from './styles'

export const CLASSES = ['Daycare', 'Playgroup', 'Nursery', 'Jr KG', 'Sr KG']
export const CLASS_CODE = { Daycare: 'DC', Playgroup: 'PG', Nursery: 'NS', 'Jr KG': 'JK', 'Sr KG': 'SK' }
export const CLASS_NEXT = { Daycare: 'Playgroup', Playgroup: 'Nursery', Nursery: 'Jr KG', 'Jr KG': 'Sr KG', 'Sr KG': null }
export const isDaycare = section => section === 'Daycare'

export const PAYMENT_MODES = ['PhonePe', 'Google Pay', 'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Cheque']

export const STUDENT_STATUSES = ['Active', 'Graduated', 'Transferred', 'Dropped']
export const STUDENT_STATUS_COLOR = {
  Active: C.success, Graduated: C.teal, Transferred: C.amber, Dropped: C.danger,
}

export const ENQUIRY_STATUSES = ['New', 'Follow-up', 'Admitted', 'Not Interested']
export const ENQUIRY_STATUS_COLOR = {
  New: C.teal, 'Follow-up': C.amber, Admitted: C.success, 'Not Interested': C.muted,
}

export const EXPENSE_CATS = [
  'Rent', 'Electricity', 'Water', 'Stationery', 'Toys & Materials',
  'Maintenance', 'Cleaning', 'Events', 'Salary', 'Miscellaneous',
]
