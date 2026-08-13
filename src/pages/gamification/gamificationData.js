/**
 * Gamification — shared real-data helpers
 * ใช้ร่วมกันโดย GamificationDashboard.js / Badges.js / DailyMissions.js / Leaderboard.js
 * เพื่อไม่ให้ต้อง query/คำนวณ badge-unlock ซ้ำในหลายไฟล์
 *
 * แต้ม/สถิติทั้งหมดที่นี่มาจากข้อมูลจริง (bookings/customers/tasks/comm_logs/gamification_events/staff_points)
 * ที่ core/db.js เขียนให้อัตโนมัติผ่าน awardGamePoints() — ไม่มีของ mock/hardcode
 */
import { listDocs, getSalesData } from '../../core/db.js'
import { getState } from '../../core/store.js'
import { todayBangkok, toDateStr } from '../../utils/format.js'

export const BADGE_CATEGORIES = {
  sales:    { label: 'การขาย', color: 'primary' },
  service:  { label: 'บริการ', color: 'warning' },
  kpi:      { label: 'KPI', color: 'success' },
  team:     { label: 'ทีมงาน', color: 'secondary' },
  special:  { label: 'พิเศษ', color: 'danger' },
}

export const BADGE_RARITY = {
  common:   { label: 'Common', color: '#94a3b8', star: '⭐' },
  rare:     { label: 'Rare', color: '#3b82f6', star: '💙' },
  epic:     { label: 'Epic', color: '#8b5cf6', star: '💜' },
  legendary:{ label: 'Legendary', color: '#f59e0b', star: '🌟' },
}

// check(ctx) === null ➜ ยังไม่มีข้อมูลจริงมาผูกได้แบบน่าเชื่อถือ (เช่น B004 ต้องจับคู่ model ที่พนักงานพิมพ์เอง
// ตอนจองกับ fuel type ในฐานข้อมูลรถ — เสี่ยงจับคู่ผิดถ้าใช้ fuzzy match, B006 CSAT ไม่มี field ผูกกับพนักงาน
// คนที่ดูแลลูกค้ารายนั้นเลยในตอนนี้, B008 "KPI 100%" ไม่มีนิยามกลางที่ใช้จริงอยู่แล้วในระบบ ต้องถามเจ้าของ
// ระบบก่อนว่าวัดจากอะไร, B012 เป็นรางวัลเปรียบเทียบทั้งบริษัทที่ควรให้ผู้บริหารตัดสิน ไม่ใช่สูตรอัตโนมัติ)
// ปล่อยล็อคไว้ตรงๆ ไม่ปลอมเลข — ดีกว่าเดาสูตรเองแล้วให้เครดิตผิดคน
export const ALL_BADGES = [
  { id: 'B001', name: 'First Sale', icon: '🎯', cat: 'sales', rarity: 'common', desc: 'ปิดดีลได้เป็นครั้งแรก', requirement: 'ส่งมอบรถอย่างน้อย 1 คัน', points: 50, check: ctx => ctx.delivered >= 1 },
  { id: 'B002', name: 'Sales Rookie', icon: '🚀', cat: 'sales', rarity: 'common', desc: 'ขายรถได้ 5 คัน', requirement: 'ส่งมอบรถ 5 คันสะสม', points: 100, check: ctx => ctx.delivered >= 5 },
  { id: 'B003', name: 'Sales Pro', icon: '⭐', cat: 'sales', rarity: 'rare', desc: 'ขายรถได้ 20 คัน', requirement: 'ส่งมอบรถ 20 คันสะสม', points: 300, check: ctx => ctx.delivered >= 20 },
  { id: 'B004', name: 'EV Expert', icon: '⚡', cat: 'sales', rarity: 'epic', desc: 'ขาย EV ได้ 50 คัน', requirement: 'EV 50 คัน', points: 800, check: null },
  // "requirement" (สิ่งที่โชว์ให้ผู้ใช้เห็นจริงเป็นเงื่อนไข) คือ "ปิด 3 ดีลใน 1 สัปดาห์" — ยึดตามนี้เป็นสูตรจริง
  // (desc เดิม "ปิดดีลภายใน 3 วัน" ขัดกันเอง เป็นปัญหาข้อความเดิมของ badge นี้ ไม่ใช่สิ่งที่ต้องแก้ในรอบนี้)
  { id: 'B005', name: 'Speed Closer', icon: '⚡', cat: 'sales', rarity: 'rare', desc: 'ปิดดีลภายใน 3 วัน', requirement: 'ปิด 3 ดีลใน 1 สัปดาห์', points: 250, check: ctx => hasThreeWithinDays(ctx.deliveryDates, 7) },
  { id: 'B006', name: 'Customer Whisperer', icon: '💬', cat: 'service', rarity: 'epic', desc: 'ได้ CSAT 5 ดาวติดต่อ 10 ครั้ง', requirement: 'CSAT 5★ × 10', points: 500, check: null },
  { id: 'B007', name: 'Problem Solver', icon: '🔧', cat: 'service', rarity: 'common', desc: 'บันทึกการติดต่อดูแลลูกค้า 10 ครั้ง', requirement: 'Comm Log 10 ครั้ง', points: 150, check: ctx => ctx.commLogs >= 10 },
  { id: 'B008', name: 'KPI Champion', icon: '🏆', cat: 'kpi', rarity: 'epic', desc: 'ทำ KPI ได้ 100% 3 เดือนติดกัน', requirement: 'KPI 100% × 3 months', points: 600, check: null },
  { id: 'B009', name: 'Team Player', icon: '🤝', cat: 'team', rarity: 'common', desc: 'ทำงาน (Task) สำเร็จ 5 งาน', requirement: 'Task เสร็จ 5 งาน', points: 80, check: ctx => ctx.tasksDone >= 5 },
  { id: 'B010', name: 'Legendary Seller', icon: '👑', cat: 'sales', rarity: 'legendary', desc: 'ขายรถได้ 100 คัน — สุดยอดเซลส์', requirement: 'ส่งมอบรถ 100 คันสะสม', points: 5000, check: ctx => ctx.delivered >= 100 },
  // นับ "ขาดงาน" จาก attendance.status==='absent' ของพนักงานคนนี้เองใน 6 เดือนล่าสุด + ต้องมีข้อมูลจริงครบ
  // ทุกเดือนใน 6 เดือนนั้น (กันเคสพนักงานใหม่/ยังไม่มีประวัติเลยได้ badge นี้ไปฟรีๆแบบ vacuously true)
  { id: 'B011', name: 'Perfect Attendance', icon: '📅', cat: 'kpi', rarity: 'rare', desc: 'ไม่ขาดงาน 6 เดือน', requirement: 'Attendance 100% × 6 months', points: 400, check: ctx => ctx.attendanceMonthsCovered >= 6 && ctx.attendanceAbsences === 0 },
  { id: 'B012', name: 'Top Revenue Q1', icon: '💰', cat: 'special', rarity: 'legendary', desc: 'รายได้สูงสุดประจำไตรมาส 1', requirement: 'Special Achievement', points: 2000, check: null },
]

// มีรายการวันที่ (YYYY-MM-DD) ที่ "3 รายการขึ้นไปตกอยู่ในหน้าต่างกว้าง windowDays วันติดต่อกัน" หรือไม่
export function hasThreeWithinDays(dates, windowDays) {
  const sorted = (dates || []).filter(Boolean).map(d => new Date(d).getTime()).filter(t => !isNaN(t)).sort((a, b) => a - b)
  const windowMs = windowDays * 86400000
  for (let i = 0; i + 2 < sorted.length; i++) {
    if (sorted[i + 2] - sorted[i] <= windowMs) return true
  }
  return false
}

export function getCurrentUser() {
  const user = getState('user') || {}
  return {
    uid: user.uid || '',
    name: user.displayName || user.email || 'ผู้ใช้',
  }
}

// รวมสถิติจริงของ "ฉัน" (ผู้ใช้ที่ล็อกอินอยู่) จากทุก collection ที่เกี่ยวข้อง — ใช้คำนวณ badge unlock
export async function getMyStatsContext() {
  const { uid, name } = getCurrentUser()
  let bookings = [], tasks = [], commLogs = [], attendance = []
  try { bookings = await getSalesData() } catch {}
  try { tasks = await listDocs('tasks', [], 'dueDate', 'desc', 500) } catch {}
  try { commLogs = await listDocs('comm_logs', [], 'createdAt', 'desc', 500) } catch {}
  try { attendance = await listDocs('attendance', [], 'date', 'desc', 500) } catch {}
  const myDelivered = bookings.filter(b => b.delivered && b.salesName === name)
  const delivered = myDelivered.length
  const tasksDone = tasks.filter(t => t.status === 'done' && (t.assignedTo === name || !t.assignedTo)).length
  const commLogsCount = commLogs.filter(c => c.createdBy === uid || c.createdBy === name).length
  const deliveryDates = myDelivered.map(b => b.date).filter(Boolean)

  // 6 เดือนล่าสุด (รวมเดือนนี้) ตามเวลาไทยจริง — ใช้เช็ค badge "ไม่ขาดงาน 6 เดือน"
  const sixMonthsBack = new Set()
  const [ty, tm] = todayBangkok().split('-').map(Number)
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1))
    sixMonthsBack.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const myAttendance = attendance.filter(a => a.staffName === name && sixMonthsBack.has((a.date || '').slice(0, 7)))
  const monthsWithRecords = new Set(myAttendance.map(a => (a.date || '').slice(0, 7)))
  const attendanceAbsences = myAttendance.filter(a => a.status === 'absent').length

  return { delivered, tasksDone, commLogs: commLogsCount, deliveryDates, attendanceMonthsCovered: monthsWithRecords.size, attendanceAbsences }
}

// คืนรายการ badge พร้อม unlocked:boolean จริงตามสถิติของผู้ใช้ปัจจุบัน
export async function computeMyBadges() {
  const ctx = await getMyStatsContext()
  return ALL_BADGES.map(b => ({ ...b, unlocked: typeof b.check === 'function' ? !!b.check(ctx) : false }))
}

// แต้มรวมจริงของผู้ใช้ปัจจุบัน จาก staff_points ledger (สะสมโดย awardGamePoints ใน core/db.js)
export async function getMyTotalPoints() {
  const { name } = getCurrentUser()
  try {
    const rows = await listDocs('staff_points', [], 'points', 'desc', 200)
    const mine = rows.find(s => s.name === name)
    return mine ? (mine.points || 0) : 0
  } catch { return 0 }
}

// กระดานแต้มจริงทั้งบริษัท: รวม staff_points (แต้มรวม) + gamification_events (แต้มเดือนนี้) + ยอดขายจริงเป็นข้อมูลสนับสนุน
export async function getRealLeaderboard() {
  const [staffPoints, events, sales] = await Promise.all([
    listDocs('staff_points', [], 'points', 'desc', 200).catch(() => []),
    listDocs('gamification_events', [], 'createdAt', 'desc', 3000).catch(() => []),
    getSalesData().catch(() => []),
  ])
  const nowMonth = todayBangkok().slice(0, 7)
  const nowYear = todayBangkok().slice(0, 4)
  const monthByName = {}
  const yearByName = {}
  events.forEach(e => {
    const ed = toDateStr(e.createdAt)
    if (ed.slice(0, 7) === nowMonth) monthByName[e.userName] = (monthByName[e.userName] || 0) + (e.points || 0)
    if (ed.slice(0, 4) === nowYear) yearByName[e.userName] = (yearByName[e.userName] || 0) + (e.points || 0)
  })
  const salesByName = {}
  sales.filter(s => s.delivered && s.salesName).forEach(s => {
    if (!salesByName[s.salesName]) salesByName[s.salesName] = { carsSold: 0, revenue: 0 }
    salesByName[s.salesName].carsSold++
    salesByName[s.salesName].revenue += s.totalIncome || 0
  })
  return staffPoints
    .map(s => ({
      id: s.id,
      name: s.name,
      points: s.points || 0,
      monthPoints: monthByName[s.name] || 0,
      yearPoints: yearByName[s.name] || 0,
      salesUnits: (salesByName[s.name] || {}).carsSold || 0,
      revenue: (salesByName[s.name] || {}).revenue || 0,
    }))
    .sort((a, b) => b.points - a.points)
}
