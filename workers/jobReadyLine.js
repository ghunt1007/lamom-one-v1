// (v1.0.1265) แจ้งลูกค้าทาง LINE เมื่องานซ่อม/เช็กระยะ (ใบงาน job_cards) เปลี่ยนเป็น "เสร็จแล้ว" — รถพร้อมรับ
// เปิดสวิตช์ inbox_auto.jobReadyLine ก่อน (ปิดไว้เป็นค่าเริ่มต้น) · ทำงาน 08:00–19:59 น. (cron ทุก 10 นาที)
// เฉพาะใบงานที่แก้ล่าสุดภายใน 3 ชั่วโมง (กันส่งย้อนหลังใบงานเก่าทั้งหมดตอนเพิ่งเปิดสวิตช์)
// จับคู่ลูกค้าด้วย customerId หรือเบอร์โทร → ต้องผูก LINE แล้ว ไม่เลิกรับ/ไม่บล็อก · จด lineReadySent ก่อนส่ง → ส่งครั้งเดียว
export const JOB_READY_FROM = 8
export const JOB_READY_TO = 19
export const JOB_READY_WINDOW_MS = 3 * 3600e3
export const JOB_READY_MAX = 30
const UID = /^U[0-9a-f]{10,40}$/i
const digits = s => String(s || '').replace(/\D/g, '').replace(/^66/, '0')
const first = n => { const w = String(n || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]; return w && !/^ลูกค้า/.test(w) ? w : '' }

export const JOB_READY_FIELDS = ['status', 'custName', 'phone', 'customerId', 'brand', 'model', 'plate', 'jobNo', 'updatedAt', 'lineReadySent', 'deleted']
export const JOB_READY_CUSTOMER_FIELDS = ['firstName', 'phone', 'lineUserId', 'lineOptOut', 'lineBlockedAt', 'deleted']

export function jobReadyText({ name = '', model = '', plate = '' } = {}) {
  const car = [String(model || '').trim(), String(plate || '').trim()].filter(Boolean).join(' ทะเบียน ')
  return `${name ? `สวัสดีครับคุณ${name}` : 'สวัสดีครับ'} รถ${car ? ` ${car}` : 'ของคุณ'} ดำเนินการที่ศูนย์บริการเสร็จเรียบร้อยแล้ว พร้อมให้มารับได้เลยครับ 🚗✨\nสอบถามค่าใช้จ่ายหรือนัดเวลารับรถ ตอบกลับข้อความนี้ได้เลยครับ`
}

/** เลือกใบงานที่ต้องแจ้ง (ฟังก์ชันล้วน) — คืน [{ id, to, text }] */
export function pickJobReady({ jobs = [], customers = [], nowMs = Date.now(), max = JOB_READY_MAX } = {}) {
  const byId = new Map(), byPhone = new Map()
  for (const c of customers) {
    if (!c || c.deleted) continue
    byId.set(c.id, c)
    const p = digits(c.phone)
    if (p.length >= 9 && !byPhone.has(p)) byPhone.set(p, c)
  }
  const out = [], seen = new Set()
  for (const j of jobs) {
    if (!j || j.deleted || !j.id || j.status !== 'done' || j.lineReadySent) continue
    const at = Date.parse(j.updatedAt || '')
    if (!at || nowMs - at > JOB_READY_WINDOW_MS || at - nowMs > 600e3) continue
    const c = (j.customerId && byId.get(j.customerId)) || byPhone.get(digits(j.phone)) || null
    if (!c || !UID.test(c.lineUserId || '') || c.lineOptOut === true || c.lineBlockedAt) continue
    if (seen.has(c.lineUserId) || out.length >= max) continue
    seen.add(c.lineUserId)
    out.push({ id: j.id, to: c.lineUserId, text: jobReadyText({ name: first(c.firstName || j.custName), model: [j.brand, j.model].filter(Boolean).join(' ').trim() || j.model, plate: j.plate }) })
  }
  return out
}

/** deps: { enabled, hour, nowMs, list(col, fields)→rows, pushLine(to,text)→bool, mark(col,id,fields)→bool } */
export async function runJobReady(deps) {
  if (!deps?.enabled || !deps.pushLine) return { sent: 0, skipped: 'off' }
  if (deps.hour < JOB_READY_FROM || deps.hour > JOB_READY_TO) return { sent: 0, skipped: 'hour' }
  const [jobs, customers] = await Promise.all([deps.list('job_cards', JOB_READY_FIELDS), deps.list('customers', JOB_READY_CUSTOMER_FIELDS)])
  let sent = 0, failed = 0
  for (const s of pickJobReady({ jobs: jobs || [], customers: customers || [], nowMs: deps.nowMs })) {
    if (!(await deps.mark('job_cards', s.id, { lineReadySent: { booleanValue: true } }))) continue
    if (await deps.pushLine(s.to, s.text)) sent++
    else failed++
  }
  return { sent, failed }
}
