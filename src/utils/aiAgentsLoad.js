// (v1.0.1136) โหลดข้อมูลให้ทีม AI ตรวจ — ใช้ร่วมกันระหว่างหน้า /ai/team กับ LAMI ("ทีม AI วันนี้มีงานอะไร")
// เซลส์เห็นเฉพาะลูกค้าของตัวเอง ผู้จัดการ/เจ้าของเห็นทั้งทีม (สิทธิ์เดียวกับ LAMI)
import { listDocs, listAllDocs } from '../core/db.js'
import { companyScopeFilters } from '../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord } from '../core/hierarchy.js'
import { todayBangkok } from './format.js'
import { runAgents } from './aiAgents.js'
import { visibleCustomersForCommands } from './lamiCommandCard.js'

export async function loadAgentBoard(customersPromise = null) {
  const today = todayBangkok()
  const f = companyScopeFilters()
  const vis = await getVisibilityScope().catch(() => null)
  const whole = !!vis && (vis.unrestricted || vis.companyOnly)
  const mine = (name, rec) => whole || (!!vis && scopeIncludesRecord(vis, name, rec))
  const [customers, bookings, drives, quotes, appts, threads, pdis, complaints, leaves] = await Promise.all([
    Promise.resolve(customersPromise || visibleCustomersForCommands()).catch(() => []),
    listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => []),
    listDocs('test_drives', f, 'date', 'desc', 1000).catch(() => []),
    listDocs('quotations', f, 'createdDate', 'desc', 500).catch(() => []),
    listDocs('appointments', f, 'date', 'desc', 300).catch(() => []),
    listDocs('social_threads', [], 'lastAt', 'desc', 300).catch(() => []),
    listDocs('pdi', f, 'startDate', 'desc', 300).catch(() => []),
    listDocs('complaints', f, 'createdAt', 'desc', 300).catch(() => []),
    listDocs('leave_requests', f, 'from', 'desc', 300).catch(() => []),
  ])
  const custs = customers || []
  const myCustIds = new Set(custs.map(c => c.id))
  return runAgents({
    today, customers: custs,
    bookings: bookings.filter(b => !b.deleted && mine(b.salesName, b)),
    drives: drives.filter(t => mine(t.staff, t)),
    quotes: quotes.filter(q => !q.deleted && (whole || myCustIds.has(q.customerId) || mine(q.salesperson || q.staff, q))),
    appts: appts.filter(a => mine(a.salesperson, a)),
    // แชตรวมเห็นได้ทั้งทีมเหมือนหน้าแชต (ใครว่างก็ตอบได้)
    threads,
    pdis, complaints: whole ? complaints : complaints.filter(c => mine(c.assignedTo || c.staff, c)),
    leaves: whole ? leaves : leaves.filter(r => mine(r.staff, r)),
  })
}
