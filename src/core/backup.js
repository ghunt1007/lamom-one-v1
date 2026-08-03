// Backup & Restore engine — export/import ข้อมูลจริงทุก collection เป็นไฟล์ JSON เดียว ดาวน์โหลดเก็บไว้เอง
// (v1.0.316) เดิม src/pages/settings/BackupRestore.js ไม่ได้แตะข้อมูลจริงเลยแม้แต่จุดเดียว — กด "Backup"/
// "กู้คืน" แค่บันทึก log ว่า "สำเร็จ" พร้อมขนาดไฟล์ปลอมที่ hardcode ไว้ (เจ้าของอาจเข้าใจผิดว่าข้อมูลมี
// backup จริงอยู่ ทั้งที่ไม่มีเลย) แก้ให้ backup/restore ข้อมูลจริงทุก collection ที่มีอยู่จริงในระบบ
//
// Scope ที่ตกลงกับเจ้าของแล้ว: export/import เป็นไฟล์ JSON ดาวน์โหลดเก็บไว้เอง (เก็บเพื่อดู/กู้คืนด้วยมือ)
// ไม่ใช่ automated cloud disaster-recovery เต็มรูปแบบ (นั่นต้องใช้ Firebase native export → GCS ซึ่งต้อง
// ตั้งค่าผ่าน Firebase Console/gcloud เองแยกจากโค้ดนี้ — ดูหมายเหตุใน BackupRestore.js)
//
// ทำไมไม่ reuse listAllDocs() ที่มีอยู่แล้ว: listAllDocs ต้อง orderBy field ที่กำหนด (ปกติ createdAt) —
// เอกสารที่ "ไม่มี field นั้นเลย" จะถูก Firestore orderBy ตัดออกจากผลลัพธ์ไปเงียบๆโดย Firestore เอง (บั๊ก
// คลาสเดียวกับที่เคยพบใน getSalesData ก่อนแก้เป็น listAllDocs ตอน v1.0.293) สำหรับ backup ต้องได้
// "ทุกเอกสารจริงๆไม่มีข้อยกเว้น" จึงเขียนฟังก์ชันแยกที่ paginate ด้วย documentId() แทน (ทุกเอกสารมี ID
// เสมอ ไม่มีทางถูกตัดออกไปเงียบๆแบบนั้น)
import { db } from './firebase.js'
import {
  collection, doc, getDocs, query, orderBy, limit, startAfter, documentId, setDoc, serverTimestamp,
} from 'firebase/firestore'

// collection ที่ไม่ควร backup/restore:
// - audit_log: ห้ามแก้ไข/ลบตาม Firestore Rules อยู่แล้ว (allow update, delete: if false) เป็น log ต่อเนื่อง
//   ไม่ใช่ state ทางธุรกิจ — restore จะ fail ทุกเอกสารที่มีอยู่แล้วเปล่าๆ
// - error_log: แค่ diagnostic log ไม่ใช่ข้อมูลธุรกิจ
// - system_backups: คือ log ของฟีเจอร์นี้เอง สำรอง/กู้คืนตัวเองจะพันกันไปมาไม่มีประโยชน์
// - security_sessions: session ชั่วคราว restore แล้วไม่มีความหมาย
export const BACKUP_EXCLUDED_COLLECTIONS = ['audit_log', 'error_log', 'system_backups', 'security_sessions']

// รายชื่อ collection ทั้งหมดที่มีอยู่จริงในแอป ณ v1.0.316 — สำรวจจริงจากทุกจุดที่เรียก listDocs/watchDocs/
// createDoc/updateDocData/setDocData/softDelete/listAllDocs ทั่ว src/ ทั้งโปรเจกต์ (ไม่ใช่เดา/พิมพ์มือ)
// ⚠️ ถ้าเพิ่ม collection ใหม่ในอนาคต ต้องมาเพิ่มชื่อในลิสต์นี้ด้วย ไม่งั้น backup จะไม่ครอบคลุม collection นั้น
export const ALL_COLLECTIONS = [
  'accessories', 'action_plans', 'ai_officer_chats', 'announcements_hr', 'api_keys', 'appointments',
  'assets', 'attendance', 'auto_receipts', 'auto_send_rules', 'b2b_corporate_partners', 'b2b_partners',
  'bank_partner_info', 'bank_transactions', 'billing_runs', 'body_repair_jobs', 'bonus_pool_staff',
  'booking_national_ids', 'bookings', 'branches', 'broadcasts', 'budget_planning', 'calendar_events',
  'call_logs', 'car_photos', 'carbon_credits', 'cashier_payments', 'cashier_pending_bills',
  'charging_sessions', 'charging_stations', 'chat_ai_assistant', 'chat_lami_brain', 'chat_templates',
  'chat_training_bot', 'checklists', 'comm_logs', 'comm_messages', 'commission_rules', 'commissions',
  'companies', 'company_profile', 'complaints', 'compliance_audits', 'compliance_checklist',
  'compliance_events', 'consignments', 'content_calendar', 'content_history', 'contracts',
  'corporate_quotes', 'courtesy_car_jobs', 'csat', 'custom_fields', 'custom_order_docs', 'custom_orders',
  'custom_reports', 'customer_areas', 'customer_feedback', 'customer_notes', 'customer_reviews',
  'customers', 'daily_missions', 'deals', 'debt_settlements', 'debts', 'demo_fleet', 'deposits',
  'digital_showroom', 'disciplinary_records', 'doc_files', 'document_templates', 'documents',
  'employee_evaluations', 'energy_readings', 'escalation_rules', 'ev_battery_vehicles',
  'ev_charging_stations', 'ev_diagnostic_scans', 'ev_trip_charging_points', 'event_visitors',
  'exchange_rates', 'expense_approvals', 'expense_claims', 'expense_receipts', 'feedback_responses',
  'finance_applications', 'finance_banks', 'finance_rate_sheets', 'finance_tracker',
  'financial_closings', 'financial_goals', 'five_s_areas', 'fleet_accounts', 'fleet_alerts',
  'fleet_deals', 'fleet_quotes', 'fleet_vehicles', 'floor_plan', 'followups', 'forms',
  'gamification_challenges', 'gamification_events', 'gamification_rewards', 'gov_bids', 'gov_docs',
  'greeting_sends', 'holidays', 'homologations', 'installment_plans', 'insurance_claims',
  'insurance_policies', 'insurance_proposals', 'insurance_rate_cards', 'insurance_renewals',
  'invoices', 'job_cards', 'kb_articles', 'keys', 'landing_pages', 'lead_gen_campaigns',
  'leasing_contracts', 'leave_requests', 'legal_references', 'licenses', 'line_oa_auto_replies',
  'line_oa_broadcasts', 'loaner_cars', 'loaner_loans', 'maintenance_equipment', 'maintenance_schedules',
  'marketing_budgets', 'marketing_campaigns', 'marketing_events', 'marketing_reviews', 'master_data',
  'meeting_minutes', 'model_configs', 'model_year_changeovers', 'monthly_close_items', 'mood_responses',
  'ncb_policies', 'notes', 'notifications', 'offboarding_staff', 'onboarding_staff', 'org_companies',
  'overtime_records', 'parts_rma', 'partner_commissions', 'parts', 'parts_inventory', 'parts_orders',
  'payment_transactions', 'payroll_records', 'pdi', 'pdpa_consents', 'pdpa_dsr_requests',
  'performance_reviews', 'performance_scorecards', 'petty_cash', 'plate_tracking', 'policy_renewals',
  'price_history', 'price_negotiations', 'product_knowledge', 'promotions', 'purchase_orders',
  'quality_audits', 'quality_incidents', 'quick_lane_jobs', 'quiz_results', 'quotations',
  'recall_campaign_vehicles', 'recall_campaigns', 'recall_tracker_vehicles', 'recruitment_applicants',
  'recruitment_jobs', 'referrals', 'referrers', 'refund_requests', 'repair_estimates',
  'reschedule_appointments', 'reservations', 'reward_redemptions', 'roadside_cases', 'roles',
  'salary_scale_staff', 'sales_budgets', 'security_policies', 'service_appointments',
  'service_bay_queue', 'service_bays', 'service_history_records', 'service_packages',
  'service_parts_inventory', 'service_reminders', 'shift_schedules', 'signage_screens',
  'signage_slides', 'skill_definitions', 'sms_campaigns', 'sms_otp_settings', 'social_posts',
  'sop_documents', 'special_editions', 'staff', 'staff_certifications', 'staff_documents',
  'staff_grievances', 'staff_loans', 'staff_points', 'staff_profile_salaries', 'staff_profiles',
  'staff_salaries', 'staff_skills', 'stock', 'stock_audit', 'stock_orders', 'succession_plans',
  'supplier_pos', 'suppliers', 'surveyor_appointments', 'system_integrations', 'tasks', 'tax_filings',
  'team_meetings', 'team_targets', 'tech_kpi_bonus_approvals', 'technician_schedule',
  'test_drive_certs', 'test_drive_records', 'test_drives', 'trade_ins', 'training_courses',
  'used_cars', 'user_settings', 'users', 'utm_links', 'vat_invoices', 'vehicle_catalog_additions',
  'vehicle_catalog_deletions', 'vehicle_catalog_overrides', 'vehicle_inspections', 'vehicle_models',
  'vehicle_orders', 'vehicle_receiving', 'vehicle_reservations', 'vehicle_transfers',
  'vehicle_warranties', 'vehicles', 'vendors', 'voice_notes', 'waiting_lounge_queue', 'walk_ins',
  'warranty_claims', 'warranty_expiry_vehicles', 'warranty_service_claims', 'wash_queue', 'webhooks',
  'welfare_items', 'whitelabel_settings', 'winback_targets', 'withholding_tax_certs',
].filter(c => !BACKUP_EXCLUDED_COLLECTIONS.includes(c)).sort()

// ดึงเอกสาร "ทั้งหมดจริง" ของ collection เดียว โดย paginate ด้วย documentId() (ไม่ใช่ field ทางธุรกิจ) —
// ใช้ได้กับทุก collection ไม่ว่าจะมี field อะไรอยู่หรือไม่ก็ตาม
async function exportCollectionFull(colName) {
  const all = []
  let cursor = null
  for (let i = 0; i < 200; i++) { // เพดานกันวนลูปไม่จบ (200×500 = 100,000 เอกสารต่อ collection)
    const constraints = cursor
      ? [orderBy(documentId()), startAfter(cursor), limit(500)]
      : [orderBy(documentId()), limit(500)]
    const snap = await getDocs(query(collection(db, colName), ...constraints))
    if (snap.empty) break
    snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }))
    if (snap.docs.length < 500) break
    cursor = snap.docs[snap.docs.length - 1].id
  }
  return all
}

// สร้าง backup จริง — วนทุก collection ที่เลือก ดึงข้อมูลจริงทั้งหมด แล้วคืนเป็น object เดียว
// onProgress({ current, total, colName }) เรียกก่อนเริ่มดึงแต่ละ collection ให้ UI แสดงสถานะสดได้
export async function exportAllData(collections = ALL_COLLECTIONS, onProgress) {
  const data = {}
  let totalDocs = 0
  const skipped = []
  for (let i = 0; i < collections.length; i++) {
    const colName = collections[i]
    onProgress?.({ current: i + 1, total: collections.length, colName })
    try {
      const docs = await exportCollectionFull(colName)
      if (docs.length) { data[colName] = docs; totalDocs += docs.length }
    } catch (e) {
      // อ่านไม่ได้ (เช่นไม่มีสิทธิ์ตาม Firestore Rules) — ข้ามไปเก็บ collection อื่นต่อ ไม่ให้ backup
      // ทั้งหมดพังเพราะจุดเดียว แต่ต้องรายงานให้ผู้ใช้เห็นว่าจุดไหนพลาดบ้าง
      skipped.push({ colName, message: e.message || String(e) })
    }
  }
  return {
    exportedAt: new Date().toISOString(),
    collections: Object.keys(data).length,
    totalDocs,
    skipped,
    data,
  }
}

export function downloadBackupFile(backupObj, filename) {
  const blob = new Blob([JSON.stringify(backupObj)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
  return blob.size
}

// สรุปเนื้อหาไฟล์ backup ก่อนกู้คืนจริง (ไว้แสดง preview ให้ผู้ใช้ตรวจสอบก่อนกดยืนยัน)
export function summarizeBackupData(backupObj) {
  const collections = Object.keys(backupObj?.data || {})
  return {
    exportedAt: backupObj?.exportedAt || null,
    collections: collections.map(name => ({ name, count: (backupObj.data[name] || []).length })).sort((a, b) => b.count - a.count),
    totalDocs: collections.reduce((sum, name) => sum + (backupObj.data[name] || []).length, 0),
  }
}

// กู้คืนข้อมูลจากไฟล์ backup — เขียนทับด้วย merge:true (ปลอดภัยกว่า overwrite เต็ม เพราะไม่ลบ field ที่
// เพิ่มเข้ามาใหม่หลังจาก backup ถูกสร้าง) ทำงานแบบ resilient — เอกสาร/collection ไหนพลาด (เช่นไม่มีสิทธิ์
// เขียนตาม Firestore Rules ของ collection นั้น หรือ collection ห้ามแก้ไข) จะข้ามแล้วรายงาน ไม่ทำให้การ
// กู้คืนที่เหลือหยุดกลางทาง
export async function restoreFromBackupData(backupObj, onProgress) {
  const collections = Object.keys(backupObj?.data || {})
  let restored = 0, failed = 0
  const errors = []
  for (let ci = 0; ci < collections.length; ci++) {
    const colName = collections[ci]
    const docs = backupObj.data[colName] || []
    for (let di = 0; di < docs.length; di++) {
      onProgress?.({ colIndex: ci + 1, colTotal: collections.length, colName, docIndex: di + 1, docTotal: docs.length })
      const { id, ...fields } = docs[di]
      try {
        await setDoc(doc(db, colName, id), { ...fields, updatedAt: serverTimestamp() }, { merge: true })
        restored++
      } catch (e) {
        failed++
        if (errors.length < 50) errors.push({ colName, id, message: e.message || String(e) }) // เก็บตัวอย่าง Error ไว้แค่ 50 รายการแรก กันล้นหน่วยความจำถ้าพลาดจำนวนมาก
      }
    }
  }
  return { restored, failed, errors }
}
