// (v1.0.963) ตารางลูกค้า "แบบ Sheet" — คอลัมน์และการแก้ช่องเดียว (ตารางเองใช้ตัวเดียวกับหน้าจองรถ bookingSheetGrid.js)
// แตะช่องแล้วพิมพ์ได้เลย ไม่ต้องเปิดฟอร์ม · แถวใหม่: พิมพ์ชื่อก่อน แล้วบันทึกเป็นลูกค้าทันที
import { shouldAutoPromoteToPP } from '../core/customerInsights.js'
import { toDate, todayBangkok } from './format.js'
import { quietDays } from './customerFollowups.js'

// stage/temp/source: { key: label } จากหน้าลูกค้า · lists: { models, sales, occupations }
export function customerColumns({ stage = {}, temp = {}, source = {} } = {}) {
  const sel = obj => Object.entries(obj).map(([v, l]) => [v, typeof l === 'string' ? l : l.label])
  return [
    { h: 'ชื่อ', f: 'firstName', t: 'text', w: 130 },
    { h: 'นามสกุล', f: 'lastName', t: 'text', w: 130 },
    { h: 'เบอร์โทร', f: 'phone', t: 'text', w: 112 },
    { h: 'LINE', f: 'lineId', t: 'text', w: 110 },
    { h: 'สถานะ', f: 'stage', t: 'sel', w: 130, choices: sel(stage) },
    { h: 'ความสนใจ', f: 'temperature', t: 'sel', w: 100, choices: [['', ''], ...sel(temp)] },
    { h: 'รถที่สนใจ', f: 'interestedModel', t: 'list', opts: 'models', w: 150 },
    { h: 'งบประมาณ', f: 'budget', t: 'num' },
    { h: 'ที่มา', f: 'source', t: 'sel', w: 120, choices: [['', ''], ...sel(source)] },
    { h: 'ผู้ดูแล', f: 'assignedTo', t: 'list', opts: 'sales', w: 120 },
    { h: 'อาชีพ', f: 'occupation', t: 'list', opts: 'occupations', w: 130 },
    { h: 'รายได้/เดือน', f: 'monthlyIncome', t: 'num' },
    { h: 'Email', f: 'email', t: 'text', w: 170 },
    { h: 'หมายเหตุ', f: 'notes', t: 'text', w: 260 },
    { h: 'เพิ่มเมื่อ', f: '_added', t: 'date', ro: true },
    { h: 'เงียบ (วัน)', f: '_quiet', t: 'num', ro: true, w: 84 },
  ]
}

// ช่องที่ตารางคำนวณเอง (อ่านอย่างเดียว) — ใส่ลงแถวก่อนวาด แบบ non-enumerable: {...c} / บันทึกทั้งก้อน จะไม่ติดไปด้วย
const hide = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, configurable: true, writable: true })
export function withGridFields(rows, today = todayBangkok()) {
  for (const c of rows) {
    const d = toDate(c.createdAt)
    hide(c, '_added', d && !isNaN(d) ? new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : '')
    hide(c, '_quiet', !c.isLost && ['lead', 'pp'].includes(c.stage) ? (quietDays(c, today) ?? 0) : 0)
  }
  return rows
}

// แก้ช่องเดียว → patch ที่บันทึกจริง (ทำเหมือนฟอร์มเต็ม: เปลี่ยนสถานะจำวันที่ · ได้เบอร์/LINE ครั้งแรก Lead → Prospect)
export function customerPatch(c, col, value, now = new Date().toISOString()) {
  const patch = { [col.f]: value }
  if (col.f === 'temperature') patch.temperature = value || null
  if (col.f === 'stage' && value !== c?.stage) patch.stageChangedAt = now
  if ((col.f === 'phone' || col.f === 'lineId') && shouldAutoPromoteToPP(c, patch)) {
    patch.stage = 'pp'; patch.stageChangedAt = now
  }
  return patch
}
