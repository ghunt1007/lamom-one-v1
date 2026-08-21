/**
 * เติมข้อมูลบริษัทย้อนหลัง (Company Data Cleanup) — v1.0.470
 * Route: /settings/company-data-cleanup
 *
 * ก่อนเปิดใช้การกรองตามบริษัท (companyScopeFilters()) กับ collection ใดๆ เอกสารเก่าที่ยังไม่มี field
 * companyId ต้องถูกเติมให้ครบก่อน ไม่งั้นพนักงานที่ถูกจำกัดสิทธิ์ตามบริษัท (ไม่ใช่เจ้าของโปรแกรม/แอดมิน/
 * เจ้าของบริษัท/groupWide) จะมองไม่เห็นเอกสารเก่าเหล่านั้นทันทีที่เปิดใช้งานจริง — Firestore where('companyId',
 * 'in',[...]) ไม่ match เอกสารที่ไม่มี field นี้เลย (คนละกรณีกับ owner/admin/groupWide ที่ query ไม่มี where
 * บังคับ เห็นได้ปกติเสมอไม่ว่าจะเติมหรือไม่) หน้านี้เป็นเครื่องมือกลางที่สร้างไว้ใช้ซ้ำได้ทุกเฟสถัดไป ไม่ใช่
 * เฉพาะ 6 collection แรกที่ขึ้นทะเบียนไว้ด้านล่าง — เพิ่ม entry ใหม่ใน COLLECTIONS ได้เรื่อยๆตามที่ขยายเฟส
 *
 * ผูก companyId จาก customers (ที่มี companyId อยู่แล้วจาก Phase 0) ผ่าน 2 ทาง: customerId ตรงๆ (แม่นสุด)
 * หรือเบอร์โทรเทียบ (fallback สำหรับ collection ที่ไม่มี customerId เก็บไว้เลย เช่น greeting_sends/
 * test_drives/appointments) — เอกสารที่ infer ไม่ได้ทั้งคู่จะยังคงว่าง companyId ต่อไป (เจ้าของโปรแกรม/แอดมิน
 * ยังเห็นได้ปกติ แค่พนักงานที่ถูก scope จะไม่เห็นจนกว่าจะแก้เอง)
 */
import { showToast } from '../../core/store.js'
import { listAllDocs, backfillCompanyId } from '../../core/db.js'
import { isProgramOwner } from '../../core/hierarchy.js'

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function normPhone(p) { return String(p || '').replace(/\D/g, '') }

// mode 'customerId' = ผูกผ่าน customerId เท่านั้น (มี FK ตรงจริง)
// mode 'customerId+phone' = ลอง customerId ก่อน ถ้าไม่มี/หาไม่เจอ fallback ไปเบอร์โทร
// mode 'phone' = ไม่มี customerId เก็บไว้เลย ผูกผ่านเบอร์โทรอย่างเดียว
// mode 'staffId' = ผูกผ่าน field staffId เทียบกับ staff.companyId (attendance/payroll_records)
// mode 'docIdAsStaffId' = ตัว document ID เองคือ staffId ตรงๆ (staff_salaries — setDocData(staffId, ...))
// mode 'docIdAsBookingId' = ตัว document ID เองคือ bookingId ตรงๆ เทียบกับ bookings.companyId
// (booking_national_ids — setDocData(bookingId, ...))
const COLLECTIONS = [
  { key: 'comm_logs', label: 'บันทึกการติดต่อลูกค้า (Comm Logs)', mode: 'customerId' },
  { key: 'quotations', label: 'ใบเสนอราคา', mode: 'customerId' },
  { key: 'followups', label: 'ติดตามลูกค้า (Follow-up)', mode: 'customerId+phone' },
  { key: 'greeting_sends', label: 'บันทึกการส่งข้อความอวยพร', mode: 'phone' },
  { key: 'test_drives', label: 'นัดทดลองขับ', mode: 'phone' },
  { key: 'appointments', label: 'นัดหมายเข้าโชว์รูม', mode: 'phone' },
  { key: 'attendance', label: 'บันทึกเวลาเข้า-ออกงาน (Attendance)', mode: 'staffId' },
  { key: 'payroll_records', label: 'สลิปเงินเดือน (Payroll Records)', mode: 'staffId' },
  { key: 'staff_salaries', label: 'ฐานเงินเดือนพนักงาน (Staff Salaries)', mode: 'docIdAsStaffId' },
  { key: 'booking_national_ids', label: 'เลขบัตรประชาชนลูกค้า (Booking National IDs)', mode: 'docIdAsBookingId' },
]

export default async function CompanyDataCleanupPage(container) {
  if (!isProgramOwner()) {
    container.innerHTML = `<div class="page-content"><div class="empty-state" style="padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div><div class="empty-desc">เครื่องมือเติม/ตรวจสอบข้อมูลบริษัทกระทบทุกบริษัทพร้อมกัน เปิดให้เฉพาะเจ้าของโปรแกรมเท่านั้น</div></div></div>`
    return
  }

  const myGen = container.__routerGen
  let counts = {}
  let running = null
  let lastResult = {}
  let loading = true
  let customerLookup = null

  async function buildCustomerLookup() {
    if (customerLookup) return customerLookup
    let customers = []
    try { customers = await listAllDocs('customers', [], 'createdAt', 'desc', 500) } catch { customers = [] }
    const byId = {}, byPhone = {}
    customers.forEach(c => {
      if (!c.companyId) return
      byId[c.id] = c.companyId
      const p = normPhone(c.phone)
      if (p) byPhone[p] = c.companyId
    })
    customerLookup = { byId, byPhone }
    return customerLookup
  }

  let staffLookup = null
  async function buildStaffLookup() {
    if (staffLookup) return staffLookup
    let staffDocs = []
    try { staffDocs = await listAllDocs('staff', [], 'createdAt', 'desc', 500) } catch { staffDocs = [] }
    const byId = {}
    staffDocs.forEach(s => { if (s.companyId) byId[s.id] = s.companyId })
    staffLookup = { byId }
    return staffLookup
  }

  let bookingLookup = null
  async function buildBookingLookup() {
    if (bookingLookup) return bookingLookup
    let bookingDocs = []
    try { bookingDocs = await listAllDocs('bookings', [], 'createdAt', 'desc', 500) } catch { bookingDocs = [] }
    const byId = {}
    bookingDocs.forEach(b => { if (b.companyId) byId[b.id] = b.companyId })
    bookingLookup = { byId }
    return bookingLookup
  }

  function inferFnFor(mode) {
    return async (data, docId) => {
      if (mode === 'staffId') {
        const { byId } = await buildStaffLookup()
        return (data.staffId && byId[data.staffId]) || null
      }
      if (mode === 'docIdAsStaffId') {
        const { byId } = await buildStaffLookup()
        return byId[docId] || null
      }
      if (mode === 'docIdAsBookingId') {
        const { byId } = await buildBookingLookup()
        return byId[docId] || null
      }
      const { byId, byPhone } = await buildCustomerLookup()
      if (data.customerId && byId[data.customerId]) return byId[data.customerId]
      if (mode !== 'customerId') {
        const p = normPhone(data.phone)
        if (p && byPhone[p]) return byPhone[p]
      }
      return null
    }
  }

  async function loadCounts() {
    loading = true
    if (container.__routerGen === myGen) renderPage()
    for (const c of COLLECTIONS) {
      try {
        const docs = await listAllDocs(c.key, [], 'createdAt', 'desc', 500)
        counts[c.key] = { total: docs.length, missing: docs.filter(d => d.companyId == null).length }
      } catch { counts[c.key] = { total: 0, missing: 0 } }
    }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  async function runBackfill(key) {
    const col = COLLECTIONS.find(c => c.key === key)
    if (!col) return
    running = key
    renderPage()
    try {
      const result = await backfillCompanyId(key, inferFnFor(col.mode))
      lastResult[key] = result
      showToast(`${col.label}: เติมแล้ว ${result.migrated} รายการ (ข้าม ${result.skipped} ที่มีอยู่แล้ว, infer ไม่ได้ ${result.unresolved})`, result.unresolved > 0 ? 'warning' : 'success')
    } catch (e) {
      showToast('เกิดข้อผิดพลาด: ' + (e.message || e), 'error')
    }
    running = null
    await loadCounts()
  }

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧹 เติมข้อมูลบริษัทย้อนหลัง</div>
            <div class="page-subtitle">เตรียมข้อมูลก่อนเปิดใช้การกรองตามบริษัทกับ collection ใหม่ — รันครั้งเดียวก่อน deploy แต่ละเฟส (ปลอดภัยรันซ้ำได้)</div>
          </div>
        </div>

        <div class="card" style="padding:12px 14px;margin-bottom:16px;border-left:3px solid var(--warning);font-size:0.8rem">
          ⚠️ ถ้ายังไม่กด "เติมข้อมูล" ให้ครบก่อนเปิดใช้การกรองตามบริษัทของ collection นั้น พนักงานที่ถูกจำกัดสิทธิ์ตามบริษัทจะเห็นรายการเก่าที่ยังไม่มีบริษัทไม่ครบทันที (เห็นเฉพาะรายการใหม่ที่มี companyId แล้ว) — เจ้าของโปรแกรม/แอดมิน/เจ้าของบริษัท/groupWide ยังเห็นครบเหมือนเดิมเสมอไม่ว่าจะเติมหรือไม่
        </div>

        ${loading && !Object.keys(counts).length ? `<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังตรวจสอบข้อมูล...</div></div>` : `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${COLLECTIONS.map(c => {
            const cnt = counts[c.key] || { total: 0, missing: 0 }
            const res = lastResult[c.key]
            const isRunning = running === c.key
            return `
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${esc(c.label)}</div>
                  <div style="font-size:0.74rem;color:var(--text-muted)">ทั้งหมด ${cnt.total} รายการ · ยังไม่มีบริษัท ${cnt.missing} รายการ</div>
                  ${res ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">ล่าสุด: เติมแล้ว ${res.migrated} · infer ไม่ได้ ${res.unresolved}${res.errors.length ? ` · error ${res.errors.length}` : ''}</div>` : ''}
                </div>
                <button class="btn btn-sm ${cnt.missing ? 'btn-primary' : 'btn-secondary'} run-btn" data-k="${c.key}" ${isRunning || running ? 'disabled' : ''}>
                  ${isRunning ? '⏳ กำลังทำงาน...' : cnt.missing ? '🔧 เติมข้อมูล' : '✅ ครบแล้ว'}
                </button>
              </div>
            </div>`
          }).join('')}
        </div>
        `}
      </div>
    `
    container.querySelectorAll('.run-btn').forEach(b => b.addEventListener('click', () => runBackfill(b.dataset.k)))
  }

  renderPage()
  loadCounts()
}
