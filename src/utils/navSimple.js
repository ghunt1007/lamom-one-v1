// เมนูแบบเรียบง่าย — แถบซ้ายเดิมมีกว่า 300 เมนู (หลายอันซ้ำกัน เช่น AI 4 หน้า, Test Drive 2 หน้า) ทีมขายใช้จริง
// ไม่ถึง 20 อัน จึงโชว์แค่ "เมนูหลัก" ที่ใช้ทุกวัน + "ใช้บ่อย" ที่ระบบจำเองจากการเปิดจริงของแต่ละเครื่อง
// เมนูอื่นทั้งหมดยังอยู่ครบ กด "เมนูทั้งหมด" หรือพิมพ์ค้นในช่องหาเมนูได้เสมอ (ไม่มีหน้าไหนหายไป)
export const ESSENTIALS = [
  { key: 'sales', group: 'งานขายทุกวัน', groupEn: 'Daily sales', groupZh: '日常销售',
    paths: ['/crm/my-day', '/crm/customers', '/crm/bookings', '/crm/followup', '/crm/testdrive', '/crm/quotation', '/crm/pipeline'] },
  { key: 'cars', group: 'รถและส่งมอบ', groupEn: 'Cars & delivery', groupZh: '车辆与交车',
    paths: ['/dms/stock', '/dms/delivery-calendar', '/crm/predelivery', '/finance/loan-calc'] },
  { key: 'results', group: 'ผลงานและรายงาน', groupEn: 'Results', groupZh: '业绩与报告',
    paths: ['/', '/crm', '/crm/sales-income', '/finance/commission'] },
  { key: 'helper', group: 'ผู้ช่วย', groupEn: 'Assistant', groupZh: '助手',
    paths: ['/ai/ask', '/tasks', '/notifications'] },
  { key: 'setup', group: 'ตั้งค่า', groupEn: 'Settings', groupZh: '设置',
    paths: ['/settings', '/settings/daily-report'] },
]

// ชื่อเมนูหลักที่อ่านง่ายกว่าชื่อเดิมในเมนูเต็ม (เมนูเต็มยังใช้ชื่อเดิม)
export const SIMPLE_LABELS = {
  '/': 'ภาพรวมบริษัท', '/crm': 'ภาพรวมการขาย', '/crm/customers': 'ลูกค้า / Lead', '/crm/followup': 'ติดตามลูกค้า',
  '/crm/testdrive': 'ทดลองขับ', '/crm/pipeline': 'Pipeline ดีล', '/dms/delivery-calendar': 'ปฏิทินส่งมอบ',
  '/finance/loan-calc': 'คำนวณค่างวด', '/finance/commission': 'ค่าคอมมิชชั่น', '/ai/ask': 'ถาม LAMI (AI)',
  '/tasks': 'งานที่ต้องทำ', '/notifications': 'การแจ้งเตือน', '/settings/daily-report': 'รายงานส่ง LINE',
}

export const MODE_KEY = 'lamom_nav_mode'
export const VISITS_KEY = 'lamom_nav_visits'

export function readNavMode(ls = globalThis.localStorage) {
  try { return ls?.getItem(MODE_KEY) === 'all' ? 'all' : 'simple' } catch { return 'simple' }
}
export function writeNavMode(mode, ls = globalThis.localStorage) {
  try { ls?.setItem(MODE_KEY, mode === 'all' ? 'all' : 'simple') } catch {}
}

export function readVisits(ls = globalThis.localStorage) {
  try { const v = JSON.parse(ls?.getItem(VISITS_KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}
// นับการเปิดแต่ละหน้า — เก็บไม่เกิน 60 หน้าล่าสุดที่นับมากสุด กัน localStorage โตไม่หยุด
export function recordVisit(path, ls = globalThis.localStorage) {
  if (!path || path === '/login') return
  const v = readVisits(ls)
  v[path] = (v[path] || 0) + 1
  const keep = Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, 60)
  try { ls?.setItem(VISITS_KEY, JSON.stringify(Object.fromEntries(keep))) } catch {}
}

// nav = กลุ่มเมนูเต็มที่กรองสิทธิ์แล้ว [{group, items:[{path,...}]}]
// คืนกลุ่มเมนูหลัก (เฉพาะเมนูที่ผู้ใช้มีสิทธิ์) + กลุ่ม "ใช้บ่อย" จากหน้าที่เปิดบ่อยแต่ไม่อยู่ในเมนูหลัก
export function buildSimpleNav(nav, visits = {}, { maxFrequent = 5, minVisits = 2 } = {}) {
  const byPath = new Map()
  nav.forEach(g => g.items.forEach(i => { if (!byPath.has(i.path)) byPath.set(i.path, i) }))
  const essentialPaths = new Set(ESSENTIALS.flatMap(e => e.paths))
  const withLabel = i => (SIMPLE_LABELS[i.path] ? { ...i, label: SIMPLE_LABELS[i.path], fullLabel: i.label } : i)
  const groups = ESSENTIALS
    .map(e => ({ group: e.group, groupEn: e.groupEn, groupZh: e.groupZh, key: e.key, items: e.paths.filter(p => byPath.has(p)).map(p => withLabel(byPath.get(p))) }))
    .filter(g => g.items.length)
  const frequent = Object.entries(visits)
    .filter(([p, n]) => n >= minVisits && byPath.has(p) && !essentialPaths.has(p))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFrequent)
    .map(([p]) => byPath.get(p))
  if (frequent.length) groups.unshift({ group: '⭐ ใช้บ่อย', groupEn: '⭐ Frequent', groupZh: '⭐ 常用', key: 'frequent', items: frequent })
  return groups
}

export function countItems(nav) {
  return new Set(nav.flatMap(g => g.items.map(i => i.path))).size
}
