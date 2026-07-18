import { supabase } from './supabase'
import { CLASSES, CLASS_NEXT } from './constants'
import { uid, today, getAcademicYear } from './utils'

// ── Lookup caches (populated once at startup) ─────────────────────
let _classes   = []
let _ayList    = []
let _currentAY = null

export const getClass    = nameOrId => _classes.find(c => c.name === nameOrId || c.id === nameOrId) || null
export const getAY       = labelOrId => _ayList.find(a => a.label === labelOrId || a.id === labelOrId) || null
export const getCurrentAY = () => _currentAY
export const getClasses  = () => _classes
export const getAYList   = () => _ayList

// ── Mappers: DB row (snake_case) → app object (camelCase) ─────────

export function mapStudent(row) {
  const enrollments = row.student_enrollments || []
  const enroll = _currentAY
    ? enrollments.find(e => e.academic_year_id === _currentAY.id) || enrollments[enrollments.length - 1]
    : enrollments[enrollments.length - 1]
  const cls = enroll ? getClass(enroll.class_id) : null
  return {
    id:          row.id,
    admissionNo: row.admission_no    || '',
    rollNo:      enroll?.roll_no     || '',
    name:        row.name            || '',
    dob:         row.dob             || '',
    section:     cls?.name           || '',
    aadhaar:     row.aadhaar         || '',
    fatherName:  row.father_name     || '',
    fatherPhone: row.father_phone    || '',
    motherName:  row.mother_name     || '',
    motherPhone: row.mother_phone    || '',
    address:     row.address         || '',
    enrollDate:  row.enroll_date     || '',
    monthlyFee:  cls?.fee_type === 'monthly' ? String(enroll?.agreed_fee || '') : '',
    annualFee:   cls?.fee_type === 'annual'  ? String(enroll?.agreed_fee || '') : '',
    status:      row.status          || 'Active',
    notes:       row.notes           || '',
    driveLink:   row.drive_folder_id || '',
    _enrollId:   enroll?.id          || null,
    _classId:    enroll?.class_id    || null,
    _ayId:       enroll?.academic_year_id || null,
  }
}

export function mapStaff(row) {
  return {
    id:        row.id,
    name:      row.name              || '',
    phone:     row.phone             || '',
    role:      row.role              || 'Teacher',
    aadhaar:   row.aadhaar           || '',
    joinDate:  row.join_date         || '',
    salary:    String(row.monthly_salary || ''),
    active:    row.is_active !== false,
    notes:     row.notes             || '',
    driveLink: row.drive_folder_id   || '',
  }
}

export function mapFeeRecord(row) {
  return {
    id:            row.id,
    studentId:     row.student_id,
    date:          row.payment_date   || '',
    amount:        Number(row.amount) || 0,
    note:          row.note           || '',
    paymentMode:   row.payment_mode   || 'Cash',
    transactionId: row.transaction_id || '',
    academicYear:  row.academic_year_label || getAcademicYear(row.payment_date || today()),
    receiptNo:     row.receipt_no     || '',
    _enrollId:     row.enrollment_id  || null,
  }
}

export function mapSalaryRecord(row) {
  return {
    id:        row.id,
    teacherId: row.staff_id,
    ym:        row.pay_month   || '',
    paid:      true,
    amount:    Number(row.amount) || 0,
    paidDate:  row.paid_date   || '',
    expenseId: row.expense_id  || null,
  }
}

export function mapExpense(row) {
  return {
    id:           row.id,
    date:         row.expense_date || '',
    category:     row.category     || '',
    amount:       Number(row.amount) || 0,
    note:         row.note          || '',
    linkedSalary: row.linked_salary || false,
  }
}

export function mapEnquiry(row) {
  return {
    id:              row.id,
    childName:       row.child_name       || '',
    childAge:        row.child_age        || '',
    parentName:      row.parent_name      || '',
    phone:           row.phone            || '',
    altPhone:        row.alt_phone        || '',
    address:         row.address          || '',
    enquiryDate:     row.enquiry_date     || '',
    followUpDate:    row.follow_up_date   || '',
    status:          row.status           || 'New',
    notes:           row.notes            || '',
    classInterested: row.class_interested || CLASSES[0],
  }
}

// ── DB operations ─────────────────────────────────────────────────

export const DB = {

  async init() {
    const [{ data: cls }, { data: ays }] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('academic_years').select('*').order('start_date', { ascending: false }),
    ])
    _classes   = cls  || []
    _ayList    = ays  || []
    _currentAY = _ayList.find(a => a.is_current) || _ayList[0] || null
  },

  async loadAll() {
    await DB.init()
    const [
      { data: stuRows }, { data: staffRows }, { data: attRows },
      { data: feeRows }, { data: salRows },   { data: expRows }, { data: enqRows },
    ] = await Promise.all([
      supabase.from('students').select('*, student_enrollments(*)').order('name'),
      supabase.from('staff').select('*').order('name'),
      supabase.from('attendance').select('*'),
      supabase.from('fee_payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('salary_payments').select('*'),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('enquiries').select('*').order('enquiry_date', { ascending: false }),
    ])

    const attendance = {}, staffAttendance = {}
    ;(attRows || []).forEach(a => {
      const key = `${a.date}:${a.entity_id}`
      if (a.entity_type === 'student') attendance[key] = a.status
      else staffAttendance[key] = a.status
    })

    return {
      students:      (stuRows   || []).map(mapStudent),
      teachers:      (staffRows || []).map(mapStaff),
      attendance,
      staffAttendance,
      feeRecords:    (feeRows   || []).map(mapFeeRecord),
      salaryRecords: (salRows   || []).map(mapSalaryRecord),
      expenses:      (expRows   || []).map(mapExpense),
      enquiries:     (enqRows   || []).map(mapEnquiry),
    }
  },

  // ── Students ────────────────────────────────────────────────────
  async saveStudent(s) {
    const ayId = _currentAY?.id
    const cls  = getClass(s.section)
    if (!cls || !ayId) { alert('No active academic year found. Please check Supabase.'); return null }

    const row = {
      name: s.name, dob: s.dob || null, aadhaar: s.aadhaar || null,
      father_name: s.fatherName || null, father_phone: s.fatherPhone || null,
      mother_name: s.motherName || null, mother_phone: s.motherPhone || null,
      address: s.address || null, enroll_date: s.enrollDate || today(),
      status: s.status || 'Active', notes: s.notes || null, drive_folder_id: s.driveLink || null,
    }
    const agreed = cls.fee_type === 'monthly' ? s.monthlyFee : s.annualFee

    if (s.id && s.admissionNo) {
      const { data: updated, error } = await supabase.from('students').update(row).eq('id', s.id).select().single()
      if (error) { console.error(error); return null }
      if (s._enrollId) {
        await supabase.from('student_enrollments')
          .update({ class_id: cls.id, agreed_fee: agreed || 0 })
          .eq('id', s._enrollId)
      }
      return { ...s, ...updated, driveLink: s.driveLink }
    } else {
      const { data: admNo }  = await supabase.rpc('next_admission_no', { p_ay_id: ayId })
      const { data: rollNo } = await supabase.rpc('next_roll_no', { p_ay_id: ayId, p_class_id: cls.id })
      if (!admNo || !rollNo) { alert('Failed to generate student numbers. Check RPC functions.'); return null }

      const { data: newStu, error } = await supabase.from('students')
        .insert({ ...row, admission_no: admNo }).select().single()
      if (error) { console.error(error); return null }

      const { data: enroll } = await supabase.from('student_enrollments')
        .insert({ student_id: newStu.id, academic_year_id: ayId, class_id: cls.id, roll_no: rollNo, agreed_fee: agreed || 0 })
        .select().single()

      return mapStudent({ ...newStu, student_enrollments: enroll ? [enroll] : [] })
    }
  },

  async setStudentStatus(id, status) {
    const { error } = await supabase.from('students').update({ status }).eq('id', id)
    return !error
  },

  async promoteStudents(activeStudents, targetAYLabel) {
    let ay = getAY(targetAYLabel)
    if (!ay) {
      const sy = parseInt(targetAYLabel.split('-')[0], 10)
      const { data: newAY, error } = await supabase.from('academic_years')
        .insert({ label: targetAYLabel, start_date: `${sy}-05-01`, end_date: `${sy+1}-04-30`, is_current: false })
        .select().single()
      if (error || !newAY) { alert(`Could not create academic year ${targetAYLabel}.`); return null }
      _ayList.push(newAY); ay = newAY
    }

    const results = []
    for (const s of activeStudents) {
      const nextName = CLASS_NEXT[s.section]
      if (!nextName) {
        await supabase.from('students').update({ status: 'Graduated' }).eq('id', s.id)
        results.push({ ...s, status: 'Graduated' })
        continue
      }
      const nextCls = getClass(nextName)
      if (!nextCls) continue
      const { data: rollNo } = await supabase.rpc('next_roll_no', { p_ay_id: ay.id, p_class_id: nextCls.id })
      if (!rollNo) continue
      const agreed = nextCls.fee_type === 'monthly' ? s.monthlyFee : s.annualFee
      await supabase.from('student_enrollments').insert({
        student_id: s.id, academic_year_id: ay.id,
        class_id: nextCls.id, roll_no: rollNo, agreed_fee: agreed || 0,
      })
      results.push({ ...s, section: nextName, rollNo, _classId: nextCls.id, _ayId: ay.id })
    }
    return results
  },

  // ── Staff ────────────────────────────────────────────────────────
  async saveStaff(t) {
    const row = {
      name: t.name, phone: t.phone || null, role: t.role || 'Teacher',
      aadhaar: t.aadhaar || null, join_date: t.joinDate || today(),
      monthly_salary: t.salary || null, is_active: t.active !== false,
      notes: t.notes || null, drive_folder_id: t.driveLink || null,
    }
    if (t.id) {
      const { data, error } = await supabase.from('staff').update(row).eq('id', t.id).select().single()
      return error ? null : mapStaff(data)
    } else {
      const { data, error } = await supabase.from('staff').insert(row).select().single()
      return error ? null : mapStaff(data)
    }
  },

  async setStaffActive(id, active) {
    const { error } = await supabase.from('staff').update({ is_active: active }).eq('id', id)
    return !error
  },

  // ── Attendance ───────────────────────────────────────────────────
  async setAttendance(entityType, entityId, date, status) {
    const { error } = await supabase.from('attendance')
      .upsert({ entity_type: entityType, entity_id: entityId, date, status },
               { onConflict: 'entity_type,entity_id,date' })
    return !error
  },

  async markAllAttendance(entityType, ids, date, status) {
    const rows = ids.map(id => ({ entity_type: entityType, entity_id: id, date, status }))
    const { error } = await supabase.from('attendance')
      .upsert(rows, { onConflict: 'entity_type,entity_id,date' })
    return !error
  },

  // ── Fee Payments ─────────────────────────────────────────────────
  async saveFeePayment(payForm, student) {
    const { data, error } = await supabase.from('fee_payments').insert({
      student_id:          student.id,
      enrollment_id:       student._enrollId || null,
      receipt_no:          'RCT' + uid().toUpperCase().slice(0, 8),
      amount:              +payForm.amount,
      payment_date:        payForm.date,
      payment_mode:        payForm.paymentMode,
      transaction_id:      payForm.transactionId || null,
      note:                payForm.note || null,
      academic_year_label: getAcademicYear(payForm.date),
    }).select().single()
    return error ? null : mapFeeRecord(data)
  },

  async deleteFeePayment(id) {
    const { error } = await supabase.from('fee_payments').delete().eq('id', id)
    return !error
  },

  // ── Salary (trigger auto-creates linked expense) ─────────────────
  async markSalaryPaid(staffId, ym, amount) {
    const { data, error } = await supabase.from('salary_payments').insert({
      staff_id: staffId, pay_month: ym, amount: +amount, paid_date: today(),
    }).select().single()
    if (error) { console.error(error); return null }
    const salRec = mapSalaryRecord(data)
    let expense = null
    if (data.expense_id) {
      const { data: expRow } = await supabase.from('expenses').select('*').eq('id', data.expense_id).single()
      if (expRow) expense = mapExpense(expRow)
    }
    return { salRec, expense }
  },

  async markSalaryUnpaid(staffId, ym) {
    const { data } = await supabase.from('salary_payments').select('*')
      .eq('staff_id', staffId).eq('pay_month', ym).single()
    if (!data) return null
    await supabase.from('salary_payments').delete().eq('id', data.id)
    if (data.expense_id) await supabase.from('expenses').delete().eq('id', data.expense_id)
    return { salaryId: data.id, expenseId: data.expense_id }
  },

  // ── Expenses ────────────────────────────────────────────────────
  async saveExpense(e) {
    const { data, error } = await supabase.from('expenses').insert({
      category: e.category, amount: +e.amount,
      expense_date: e.date, note: e.note || null, linked_salary: false,
    }).select().single()
    return error ? null : mapExpense(data)
  },

  async deleteExpense(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    return !error
  },

  // ── Enquiries ────────────────────────────────────────────────────
  async saveEnquiry(e) {
    const row = {
      child_name: e.childName || null, child_age: e.childAge || null,
      parent_name: e.parentName || null, phone: e.phone || null,
      alt_phone: e.altPhone || null, address: e.address || null,
      enquiry_date: e.enquiryDate || today(), follow_up_date: e.followUpDate || null,
      status: e.status || 'New', notes: e.notes || null,
      class_interested: e.classInterested || CLASSES[0],
    }
    if (e.id) {
      const { data, error } = await supabase.from('enquiries').update(row).eq('id', e.id).select().single()
      return error ? null : mapEnquiry(data)
    } else {
      const { data, error } = await supabase.from('enquiries').insert(row).select().single()
      return error ? null : mapEnquiry(data)
    }
  },

  async setEnquiryStatus(id, status) {
    const { data, error } = await supabase.from('enquiries').update({ status }).eq('id', id).select().single()
    return error ? null : mapEnquiry(data)
  },

  async deleteEnquiry(id) {
    const { error } = await supabase.from('enquiries').delete().eq('id', id)
    return !error
  },
}
