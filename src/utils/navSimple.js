// เมนูแบบเรียบง่าย — แถบซ้ายเดิมมีกว่า 300 เมนู (หลายอันซ้ำกัน เช่น AI 4 หน้า, Test Drive 2 หน้า) ทีมขายใช้จริง
// ไม่ถึง 20 อัน จึงโชว์แค่ "เมนูหลัก" ที่ใช้ทุกวัน + "ใช้บ่อย" ที่ระบบจำเองจากการเปิดจริงของแต่ละเครื่อง
// เมนูอื่นทั้งหมดยังอยู่ครบ กด "เมนูทั้งหมด" หรือพิมพ์ค้นในช่องหาเมนูได้เสมอ (ไม่มีหน้าไหนหายไป)
export const ESSENTIALS = [
  { key: 'sales', group: 'งานขายทุกวัน', groupEn: 'Daily sales', groupZh: '日常销售',
    paths: ['/crm/my-day', '/crm/programs', '/calendar', '/crm/customers', '/marketing/channels', '/crm/bookings', '/crm/followup', '/crm/testdrive', '/crm/quotation', '/marketing/events', '/crm/pipeline'] },
  { key: 'cars', group: 'รถและส่งมอบ', groupEn: 'Cars & delivery', groupZh: '车辆与交车',
    paths: ['/dms/stock', '/dms/delivery-calendar', '/crm/predelivery', '/finance/loan-calc'] },
  { key: 'results', group: 'ผลงานและรายงาน', groupEn: 'Results', groupZh: '业绩与报告',
    paths: ['/', '/crm', '/crm/sales-income', '/analytics/sales-metrics', '/finance/commission'] },
  { key: 'helper', group: 'ผู้ช่วย', groupEn: 'Assistant', groupZh: '助手',
    paths: ['/ai/team', '/ai/ask', '/tasks', '/notifications'] },
  { key: 'setup', group: 'ตั้งค่า', groupEn: 'Settings', groupZh: '设置',
    paths: ['/settings', '/settings/daily-report'] },
]

// (v1.0.1131) เมนูหลักตามตำแหน่ง — แต่ละฝ่ายเห็นงานของตัวเองก่อน (เมนูอื่นยังอยู่ครบใน "ดูเมนูทั้งหมด")
const G = (key, group, groupEn, paths) => ({ key, group, groupEn, groupZh: groupEn, paths })
const RESULTS_MGR = G('results', 'ผลงานและรายงาน', 'Results', ['/', '/crm', '/crm/warroom', '/crm/sales-income', '/analytics/sales-metrics', '/finance/commission', '/finance/margin'])
export const ROLE_ESSENTIALS = {
  manager: [ESSENTIALS[0], ESSENTIALS[1], RESULTS_MGR, ESSENTIALS[3], ESSENTIALS[4]],
  owner: [
    G('boss', 'ภาพรวมเจ้าของ', 'Owner overview', ['/', '/crm', '/crm/warroom', '/finance/pl', '/finance/margin', '/analytics/sales-metrics', '/finance/commission', '/dms/stock']),
    ESSENTIALS[0], ESSENTIALS[3],
    G('setup', 'ตั้งค่า', 'Settings', ['/settings', '/settings/daily-report', '/settings/page-usage', '/settings/backup']),
  ],
  admin: [
    G('office', 'งานธุรการ', 'Back office', ['/crm/bookings', '/crm/customers', '/dms/delivery-calendar', '/dms/delivery', '/finance/application', '/finance/tracker', '/finance/invoice', '/documents/library', '/calendar']),
    G('people', 'บุคคล & เบิกจ่าย', 'People & expenses', ['/hr/leave', '/hr/attendance', '/hr/expense', '/finance/payroll']),
    G('cars', 'รถและส่งมอบ', 'Cars & delivery', ['/dms/stock', '/dms/receiving', '/crm/predelivery']),
    ESSENTIALS[3], ESSENTIALS[4],
  ],
  service: [
    G('service', 'งานศูนย์บริการ', 'Service', ['/service', '/service/appointment', '/service/jobs', '/service/parts', '/service/history', '/service/reminders', '/service/warranty', '/crm/customers', '/calendar']),
    ESSENTIALS[3], ESSENTIALS[4],
  ],
  finance: [
    G('money', 'การเงิน', 'Finance', ['/finance', '/finance/invoice', '/finance/application', '/finance/tracker', '/finance/commission', '/finance/cashflow', '/finance/pl', '/finance/tax', '/crm/bookings']),
    ESSENTIALS[3], ESSENTIALS[4],
  ],
  marketing: [
    G('mkt', 'การตลาด', 'Marketing', ['/marketing/channels', '/marketing/events', '/crm/programs', '/marketing/campaigns', '/marketing/content', '/marketing/roi', '/marketing/social-analytics', '/crm/customers', '/calendar']),
    ESSENTIALS[3], ESSENTIALS[4],
  ],
}
ROLE_ESSENTIALS.hr = [G('people', 'บุคคล', 'HR', ['/hr', '/hr/leave', '/hr/attendance', '/hr/shift', '/hr/kpi', '/hr/expense', '/finance/payroll', '/hr/recruitment', '/calendar']), ESSENTIALS[3], ESSENTIALS[4]]
export function essentialsFor(role) { return ROLE_ESSENTIALS[role] || ESSENTIALS }

// ชื่อเมนูหลักที่อ่านง่ายกว่าชื่อเดิมในเมนูเต็ม (เมนูเต็มยังใช้ชื่อเดิม)
export const SIMPLE_LABELS = {
  '/': 'ภาพรวมบริษัท', '/crm': 'ภาพรวมการขาย', '/crm/customers': 'ลูกค้า / Lead', '/crm/followup': 'ติดตามลูกค้า',
  '/crm/testdrive': 'ทดลองขับ', '/crm/pipeline': 'Pipeline ดีล', '/dms/delivery-calendar': 'ปฏิทินส่งมอบ',
  '/finance/loan-calc': 'คำนวณค่างวด', '/finance/commission': 'ค่าคอมมิชชั่น', '/ai/ask': 'ถาม LAMI (AI)',
  '/tasks': 'งานที่ต้องทำ', '/calendar': 'ปฏิทินงาน', '/crm/programs': 'โปร ดอกเบี้ย & เงินพิเศษ', '/marketing/events': 'ออกบูธ & อีเวนต์', '/marketing/channels': 'แชต & โพสต์โซเชียล', '/analytics/sales-metrics': 'ตัวชี้วัดการขาย', '/notifications': 'การแจ้งเตือน', '/settings/daily-report': 'รายงานส่ง LINE',
  '/crm/warroom': 'ห้องบัญชาการขาย', '/finance/pl': 'กำไร-ขาดทุน', '/finance/margin': 'กำไร & เป้าหมาย', '/settings/page-usage': 'ซ่อนเมนูที่ไม่ใช้', '/ai/team': 'ทีม AI ทำงานให้', '/settings/backup': 'สำรองข้อมูล',
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
export function buildSimpleNav(nav, visits = {}, { maxFrequent = 5, minVisits = 2, role = '' } = {}) {
  const ESS = essentialsFor(role)
  const byPath = new Map()
  nav.forEach(g => g.items.forEach(i => { if (!byPath.has(i.path)) byPath.set(i.path, i) }))
  const essentialPaths = new Set(ESS.flatMap(e => e.paths))
  const withLabel = i => (SIMPLE_LABELS[i.path] ? { ...i, label: SIMPLE_LABELS[i.path], fullLabel: i.label } : i)
  const groups = ESS
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
