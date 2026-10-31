// ปรับแต่งหน้าภาพรวม (Dashboard) ต่อเครื่อง: เลือกการ์ดที่จะแสดงและลำดับ — เก็บใน localStorage
// ลำดับเริ่มต้นเอา "ตัวเลข → เรื่องด่วน → แนวโน้ม" ขึ้นก่อน ของตกแต่ง/ทางลัดไว้ท้าย
export const DASH_SECTIONS = [
  ['hero', '📊 ตัวเลขหลักของเดือน'],
  ['briefing', '🤖 สรุปจาก LAMI'],
  ['intel', '🚨 เรื่องที่ต้องจัดการ + 🎯 เป้า'],
  ['trend', '📈 กราฟแนวโน้ม + สัดส่วนสถานะ'],
  ['pipeline', '🚗 ใบจองที่ยังไม่จบ (ขั้นไหน)'],
  ['analysis', '🔮 พยากรณ์ · 🏆 รุ่นขายดี · 🥇 เซลส์'],
  ['dlv', '✅ กราฟส่งมอบ + ❌ ถอนจอง'],
  ['funnel', '📶 ลีด → จอง → ส่งมอบ + แหล่งที่มา'],
  ['radar', '🛰 เรดาร์งานค้าง'],
  ['dept', '🏭 ศูนย์บริการ / ไฟแนนซ์'],
  ['main', '⚡ ทางลัด · ลูกค้าล่าสุด · วันนี้ · กิจกรรม'],
]
const KEY = 'lamom_dash_layout'
const KEYS = DASH_SECTIONS.map(([k]) => k)

// คืน { order, hidden } ที่สะอาดเสมอ: คีย์ที่ไม่รู้จักถูกตัด การ์ดใหม่ที่ยังไม่อยู่ใน order ต่อท้ายตามลำดับเริ่มต้น
export function normalizeLayout(raw) {
  const order = (Array.isArray(raw?.order) ? raw.order : []).filter((k, i, a) => KEYS.includes(k) && a.indexOf(k) === i)
  KEYS.forEach(k => { if (!order.includes(k)) order.push(k) })
  const hidden = (Array.isArray(raw?.hidden) ? raw.hidden : []).filter(k => KEYS.includes(k))
  return { order, hidden }
}

export function loadDashLayout(storage = globalThis.localStorage) {
  try { return normalizeLayout(JSON.parse(storage?.getItem(KEY) || 'null')) } catch { return normalizeLayout(null) }
}

export function saveDashLayout(layout, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(normalizeLayout(layout))) } catch { /* เก็บไม่ได้ก็ใช้ค่าเริ่มต้น */ }
}

export function moveSection(layout, key, dir) {
  const order = [...layout.order]
  const i = order.indexOf(key), j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return layout
  ;[order[i], order[j]] = [order[j], order[i]]
  return { ...layout, order }
}

export function applyDashLayout(root, layout) {
  if (!root) return
  root.querySelectorAll(':scope > [data-sec]').forEach(el => {
    const k = el.dataset.sec
    el.style.order = String(layout.order.indexOf(k))
    el.classList.toggle('dash-off', layout.hidden.includes(k))
  })
}
