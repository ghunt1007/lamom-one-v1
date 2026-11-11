import { recordFacts, isFollowUpQuestion } from '../../utils/recordFacts.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, softDelete, seedDemoData, getSalesData, readDoc } from '../../core/db.js'
import { SALES_TARGETS_COLLECTION, targetFor } from '../../utils/salesTargets.js'
import { confirmDialog } from '../../utils/modal.js'
import { askLami, isAiEnabled, aiErrorText } from '../../utils/ai.js'
import { formatCurrency, todayBangkok, toDateStr } from '../../utils/format.js'
import { heuristicScore } from './LeadScoring.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { normName, getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import { buildMyDay, myDayDigest } from '../../utils/myDay.js'
import { followupWindowFilters, quietDays } from '../../utils/customerFollowups.js'
import { catalogContext, dealValue, modelMatches } from '../../utils/salesAi.js'
import { businessFacts, stockFacts, testDriveFacts } from '../../utils/bizFacts.js'
import { programFacts, programEarnings, myBonusProgress, bookingCountDay } from '../../utils/salesPrograms.js'
import { eventFacts } from '../../utils/marketingEvents.js'
import { computeSalesMetrics, metricsFacts, compareRange } from '../../utils/salesMetrics.js'
import { accountFacts, accountResults } from '../../utils/socialAccounts.js'
import { loadSalesBudget } from '../../utils/salesBudget.js'
import { isManagerRole } from '../../utils/managerRole.js'
import { financeQueue } from '../../utils/financeQueue.js'
import { serviceTodayLines, showroomVisitLine } from '../../utils/apptFacts.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { formatAiText } from '../../utils/aiFormat.js'
import { pageLinksFor } from '../../utils/aiPageLinks.js'
import { customerActionsFor } from '../../utils/aiActions.js'
import { parseLamiCommand, isCommandHelp, commandHelpText, exampleName } from '../../utils/lamiCommands.js'
import { commandIntro, mountCommandCard } from '../../utils/lamiCommandCard.js'
import { isCallListQuestion } from '../../utils/callList.js'
import { navigate } from '../../core/router.js'
import { copyText } from '../../utils/copyText.js'
import { escHtml as esc } from '../../utils/escape.js'
import { isWhereQuestion, findPages, whereAnswer } from '../../utils/whereIs.js'
import { campaignLeads } from '../../utils/campaignLeads.js'
import { NAV } from '../../data/navMenu.js'
import { dmy as fmtDMY, hm as fmtHM } from '../../utils/format.js'

const CATEGORIES = [
  { label:'☀️ วันนี้ทำอะไรก่อน', q:'วันนี้ฉันควรทำอะไรก่อน? จัดลำดับให้หน่อย พร้อมเหตุผลสั้นๆ' },
  { label:'🎯 ช่วยปิดการขาย', q:'จากงานของฉันวันนี้ ลูกค้าคนไหนมีโอกาสปิดการขายสูงสุด และควรพูดอะไรกับเขา?' },
  { label:'📋 ใบจองค้าง', q:'ตอนนี้ใบจองค้างอยู่กี่ใบ แยกตามสถานะ มีคันไหนเลยกำหนดส่งมอบ 7 วันนี้ต้องส่งมอบใครบ้าง สถานะไหนค้างนานผิดปกติ และควรเร่งอะไรก่อน?' },
  { label:'📈 แนวโน้มยอด', q:'ยอดจองและส่งมอบ 6 เดือนล่าสุดเป็นแนวโน้มขึ้นหรือลง ถ้ารักษาจังหวะนี้สิ้นเดือนจะได้กี่ใบ ถึงเป้าแนะนำไหม และควรทำอะไรเพิ่ม?' },
  { label:'🏁 รุ่นขายดี', q:'3 เดือนนี้รุ่นไหนถูกจองมากสุด เทียบกับรถพร้อมขายในสต็อกแล้ว รุ่น/สีไหนควรสั่งเพิ่มหรือเร่งขาย?' },
  { label:'🚗 เทียบรุ่นรถ', q:'Deepal S05 กับ S07 ต่างกันยังไง เหมาะกับลูกค้าแบบไหน?' },
  { label:'🏆 ผลงานทีม', q:'เดือนนี้ใครจอง/ส่งมอบได้มากสุด เทียบกับเดือนก่อนเป็นยังไง Lead จากช่องทางไหนปิดได้ดีที่สุด และใครมีลูกค้าที่ไม่ได้ติดต่อนานควรรีบตาม?' },
  { label:'🚙 นัดลองขับ', q:'สัปดาห์นี้มีนัดทดลองขับกี่นัด ใครบ้าง ควรเตรียมอะไร และที่ผ่านมาลองขับแล้วจองกี่เปอร์เซ็นต์?' },
  { label:'🎁 บอกโปรใครดี', q:'วันนี้ควรโทรบอกโปรลูกค้าคนไหนก่อน เพราะอะไร และร่างข้อความ LINE สั้นๆ ให้คนแรกหน่อย' },
  { label:'🎯 โปรเดือนนี้', q:'เดือนนี้มีแคมเปญ/ส่วนลด/ดอกเบี้ยไฟแนนซ์อะไรใช้ได้บ้าง รุ่นไหนคุ้มสุด ควรเสนอลูกค้าแบบไหน?' },
  { label:'📐 ตัวชี้วัดเดือนนี้', q:'สรุปตัวชี้วัดการขายเดือนนี้ (เป้า, คาดการณ์สิ้นเดือน, GP, AOV, Conversion, CAC) ตัวไหนน่าห่วงที่สุด และควรทำอะไร 3 ข้อ?' },
  { label:'🎪 ออกบูธได้ผลไหม', q:'งานออกบูธ/อีเวนต์ที่ผ่านมาได้ Lead และจองเท่าไร คุ้มงบไหม และงานที่กำลังจะมาควรเตรียมอะไร?' },
  { label:'💬 แชตรอตอบ', q:'ตอนนี้มีลูกค้าทัก LINE OA ที่ยังไม่ได้ตอบกี่ราย ใครบ้าง ควรตอบใครก่อนและตอบว่าอะไร?' },
  { label:'📣 ช่องทางไหนได้ผล', q:'3 เดือนนี้ลูกค้าที่จองรถมาจากช่องทางไหนมากสุด (Facebook/LINE/บูธ/Walk-in ฯลฯ) ช่องทางไหน Lead ปิดเป็นใบจองได้ดีสุด เพจ/บัญชีไหนได้ Lead คุ้มค่าโฆษณาที่สุด และเดือนหน้าควรเน้นช่องทางหรือเพจไหน?' },
  { label:'💔 ทำไมเสียดีล', q:'ช่วง 3 เดือนที่ผ่านมาเราเสียดีลเพราะอะไรมากที่สุด และควรแก้อะไรเป็นอันดับแรก?' },
  { label:'📊 ยอดขาย', q:'ยอดขายเดือนนี้เท่าไหร่?' },
  { label:'📦 สต็อก', q:'สต็อกรถพร้อมขายเหลือกี่คัน แยกรุ่น/สี พอกับยอดจองที่ค้างอยู่ไหม และมีคันไหนค้างสต็อกนานที่ควรเร่งขาย?' },
  { label:'🔥 Hot Lead', q:'มี Hot Lead ไหม?' },
  { label:'💳 ค้างชำระ', q:'ใครค้างชำระบ้าง?' },
  { label:'⭐ CSAT', q:'CSAT เป็นยังไง?' },
  { label:'🔧 ช่าง', q:'ศูนย์บริการวันนี้เป็นยังไง?' },
  { label:'💰 กำไร', q:'กำไรเดือนนี้เท่าไหร่?' },
  { label:'👥 HR', q:'ข้อมูลพนักงานวันนี้?' },
  { label:'🪄 สั่งงานได้อะไรบ้าง', q:'LAMI สั่งอะไรได้บ้าง' },
]

// AI ปิดท้ายคำตอบด้วย "ถามต่อ: ก | ข | ค" → แยกเป็นปุ่มคำถามแนะนำ (ไม่แสดงบรรทัดนั้นในคำตอบ)
export const NEXT_Q_HINT = 'ปิดท้ายคำตอบด้วยบรรทัดใหม่ "ถามต่อ: คำถาม1 | คำถาม2 | คำถาม3" เป็นคำถามสั้นๆ ที่ผู้ใช้น่าจะอยากถามคุณต่อ (เขียนในมุมผู้ใช้ ไม่เกิน 40 ตัวอักษรต่อข้อ)'
export function splitFollowups(answer) {
  const lines = String(answer || '').split('\n')
  const idx = lines.findLastIndex(l => /^\s*[*_]*\s*(?:👉\s*)?ถามต่อ\s*[*_]*\s*[:：]/.test(l))
  if (idx < 0) return { text: String(answer || '').trim(), next: [] }
  const next = lines[idx].replace(/^[^:：]*[:：]/, '').split('|').map(q => q.replace(/[*_"“”]/g, '').trim()).filter(q => q && q.length <= 80).slice(0, 3)
  return { text: lines.filter((_, i) => i !== idx).join('\n').trim(), next }
}

export { formatAiText }

function now() {
  return fmtHM()
}

const GREETING = 'สวัสดีค่ะ! 🤖 ฉัน <strong>LAMI</strong> — ผู้ช่วย AI ของ LAMOM ONE<br>ถามได้ทุกอย่างเรื่องธุรกิจ: ยอดขาย สต็อก Lead กำไร ช่าง HR ประกัน ฯลฯ'

export default async function AiAssistantChatPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let messages = []
  let waiting = false
  let voiceAsked = false // คำถามล่าสุดมาจากไมค์ → อ่านคำตอบให้ฟังเอง
  let welcomeStats = {} // ตัวเลขจริงบนการ์ดต้อนรับ (งานค้างของฉัน / Hot Lead)
  let loading = true
  let businessContext = {}
  let chatBookings = [], chatFollowups = [] // ใบจอง/นัดที่ผู้ใช้คนนี้เห็นได้ — ใช้ตอบเรื่องลูกค้ารายคน (recordFacts)
  let pendingMulti = false // (v1.0.1039) คำสั่งกลุ่ม → ปุ่มทำทั้งหมด
  let pendingCmds = [] // (v1.0.1031) คำสั่งที่ LAMI เข้าใจจากประโยคล่าสุด รอผู้ใช้กด ✅ ทำเลย
  let chatCustomers = [] // ลูกค้าที่ผู้ใช้คนนี้มีสิทธิ์เห็น — ใช้ทำปุ่มโทร/นัดลองขับใต้คำตอบ (ไม่ส่งให้ AI)

  // (v1.0.428) หน้านี้มีปุ่มคำถามสำเร็จรูปตรงกับหัวข้อธุรกิจจริง (ยอดขาย/สต็อก/Hot Lead/ค้างชำระ/CSAT/ช่าง/
  // กำไร/HR) แต่เดิม askLami(text, history) ไม่เคยส่ง context เลย — Gemini จึงต้องเดา/กุตัวเลขทุกครั้งที่ตอบ
  // คำถามพวกนี้ ดึงสถิติจริงจากคอลเลกชันที่เกี่ยวข้องมาแนบเป็น context แทน (พลาดได้ ไม่ throw — แชทยังใช้ได้
  // ต่อแม้บาง query ล้มเหลว แค่บริบทจุดนั้นจะหายไป ไม่ใช่ทั้งหน้าพัง)
  async function loadBusinessContext() {
    try {
      const today = todayBangkok()
      const thisMonth = today.slice(0, 7)
      const [sales, vehicles, customers, debts, csat, staff, jobs, followups, bookings, testDrives, programs, events, budget, threads, socialAccts, showroomAppts, serviceAppts] = await Promise.all([
        getSalesData().catch(() => []),
        listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 500).catch(() => []),
        listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
        listDocs('debts', companyScopeFilters(), 'dueDate', 'asc', 200).catch(() => []),
        listDocs('csat', [], 'createdAt', 'desc', 100).catch(() => []),
        listDocs('staff', companyScopeFilters(), 'createdAt', 'desc', 200).catch(() => []),
        listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
        listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 1000).catch(() => []),
        listDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
        listDocs('test_drives', companyScopeFilters(), 'date', 'desc', 300).catch(() => []),
        listDocs('sales_programs', [], 'dateFrom', 'desc', 300).catch(() => []),
        listDocs('marketing_events', [], 'startDate', 'desc', 100).catch(() => []),
        loadSalesBudget(+today.slice(0, 4)).catch(() => null),
        listDocs('social_threads', [], 'lastAt', 'desc', 200).catch(() => []),
        listDocs('social_channels', [], 'createdAt', 'desc', 300).catch(() => []),
        listDocs('appointments', companyScopeFilters(), 'date', 'desc', 200).catch(() => []),
        listDocs('service_appointments', companyScopeFilters(), 'date', 'desc', 200).catch(() => []),
      ])
      const monthSales = sales.filter(s => (s.date || '').startsWith(thisMonth))
      // totalIncome ต่อใบจอง = กำไรสุทธิจริง (แพทเทิร์นเดียวกับ Margin.js/Commission.js/MarketingROI.js
      // ที่ใช้ field นี้เป็นกำไรอยู่แล้ว) นับเฉพาะที่ส่งมอบแล้วเพราะตัวเลขจะนิ่ง/ครบถ้วนหลังส่งมอบจริงเท่านั้น
      // ปุ่ม "💰 กำไร" มีมาตั้งแต่ v1.0.428 แต่ businessContext ไม่เคยมี key นี้เลย ทำให้ AI ตอบคำถามนี้ไม่ได้
      const monthProfit = monthSales.filter(s => s.delivered).reduce((sum, s) => sum + (s.totalIncome || 0), 0)
      const activeStock = vehicles.filter(v => !v.deleted && !['sold', 'ขายแล้ว', 'ส่งมอบแล้ว'].includes(v.status)).length
      const leads = customers.filter(c => !c.deleted && (c.stage === 'lead' || c.stage === 'pp'))
      const hotLeads = leads.filter(c => heuristicScore(c).score >= 80).length
      const openDebts = debts.filter(d => !d.deleted && d.status !== 'paid')
      const overdueAmount = openDebts.reduce((sum, d) => sum + (d.amount || 0), 0)
      const npsScores = csat.filter(c => !c.deleted && typeof c.nps === 'number').map(c => c.nps)
      const avgNps = npsScores.length ? Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length * 10) / 10 : null
      const activeStaff = staff.filter(s => !s.deleted).length
      const todayJobs = jobs.filter(j => !j.deleted && toDateStr(j.createdAt) === today)
      const doneToday = todayJobs.filter(j => j.status === 'done' || j.status === 'delivered').length
      welcomeStats.hot = hotLeads
      businessContext = {
        'ยอดขายเดือนนี้': `${monthSales.length} คัน มูลค่ารวม ${formatCurrency(monthSales.reduce((s, x) => s + (x.salePrice || 0), 0))}`,
        'กำไรเดือนนี้ (จากรถที่ส่งมอบแล้ว)': `${formatCurrency(monthProfit)} จาก ${monthSales.filter(s => s.delivered).length} คันที่ส่งมอบแล้ว`,
        'รถคงเหลือในสต็อก': `${activeStock} คัน`,
        'Hot Lead (คะแนน 80 ขึ้นไป)': `${hotLeads} ราย จาก Lead ทั้งหมด ${leads.length} ราย`,
        'ยอดค้างชำระ': openDebts.length ? `${openDebts.length} รายการ รวม ${formatCurrency(overdueAmount)}` : 'ไม่มีรายการค้างชำระ',
        'คะแนนความพึงพอใจลูกค้า (NPS เฉลี่ยล่าสุด)': avgNps !== null ? `${avgNps}/10 จาก ${npsScores.length} รายการ` : 'ยังไม่มีข้อมูลการประเมิน',
        'งานซ่อม/ศูนย์บริการวันนี้': `รับเข้า ${todayJobs.length} งาน (เสร็จ/ส่งมอบแล้ว ${doneToday} งาน)`,
        'พนักงานที่ยังทำงานอยู่': `${activeStaff} คน`,
        ...businessFacts({ customers, bookings }, today),
        ...stockFacts(vehicles, today),
        ...testDriveFacts(testDrives, today),
      }
      // (v1.0.970) แคมเปญ/ดอกเบี้ย/มาร์จิ้นที่ใช้ได้วันนี้ (หน้า แคมเปญ & เงื่อนไขขาย) — มาร์จิ้น/ค่าบริหารเฉพาะผู้จัดการ
      const pf = programFacts(programs.filter(p => !p.deleted), { today, isManager: isManagerRole() })
      if (pf.length) businessContext['แคมเปญ/ดอกเบี้ยไฟแนนซ์ที่ใช้ได้วันนี้ (มาร์จิ้น/ค่าบริหาร/รางวัล เป็นข้อมูลภายใน ห้ามบอกลูกค้า)'] = pf.join('\n')
      // (v1.0.977) รางวัลพิเศษที่ได้/ขาดอีกกี่คัน + เป้าส่งมอบของผู้ใช้เดือนนี้ (นับจากใบจองจริง เหมือนหน้าแคมเปญ/ตัวชี้วัด)
      try {
        const me = getState('user')?.displayName || ''
        const isMgr = isManagerRole()
        const earn = programEarnings(programs, bookings, { month: today.slice(0, 7), isManager: isMgr })
        const lines = me ? myBonusProgress(earn, me).map(({ p, row }) => `${p.title}: ${me} ทำได้ ${row.units}${row.target ? `/${row.target}` : ''} คัน · ${row.earned ? `ได้แล้ว ${formatCurrency(row.earned)}` : row.target ? `ขาดอีก ${row.left} คันจะได้ ${formatCurrency(p.amount)}` : 'ยังไม่มียอด'}`) : []
        if (isMgr) {
          earn.bonuses.forEach(({ p, rows, total }) => lines.push(`${p.title}: ได้แล้ว ${rows.filter(r => r.earned).length} คน รวม ${formatCurrency(total)}${rows.filter(r => !r.earned && r.target && r.left <= 1).length ? ` · ขาดอีก 1 คัน: ${rows.filter(r => !r.earned && r.target && r.left <= 1).map(r => r.name).join(', ')}` : ''}`))
          if (earn.margin.units) lines.push(`มาร์จิ้นโชว์รูมเดือนนี้ ${formatCurrency(earn.margin.amount)} จาก ${earn.margin.units} คัน`)
          ;['teamManager', 'salesManager'].forEach(k => { if (earn.mgmt[k].units) lines.push(`ค่าบริหาร${k === 'teamManager' ? 'ผจก.ทีม' : 'ผจก.ฝ่าย'}เดือนนี้ ${formatCurrency(earn.mgmt[k].amount)} จาก ${earn.mgmt[k].units} คัน`) })
        }
        if (me) {
          const tg = targetFor((await readDoc(SALES_TARGETS_COLLECTION, today.slice(0, 7)).catch(() => null))?.targets, me)
          if (tg) {
            const done = bookings.filter(b => normName(b.salesName) === normName(me) && (bookingCountDay(b) || '').slice(0, 7) === today.slice(0, 7)).length
            lines.push(`เป้าส่งมอบของ ${me} เดือนนี้ ${tg} คัน ส่งมอบแล้ว ${done} คัน${done >= tg ? ' (ถึงเป้าแล้ว)' : ` ขาดอีก ${tg - done} คัน`}`)
          }
        }
        if (lines.length) businessContext['รางวัลพิเศษ/เป้าส่งมอบเดือนนี้ (ข้อมูลภายใน ห้ามบอกลูกค้า)'] = lines.join('\n')
      } catch { /* ข้อมูลเสริม */ }
      // (v1.0.975) งานออกบูธ/อีเวนต์ + ผลงาน, ตัวชี้วัดการขายเดือนนี้ (หน้าตัวชี้วัดการขาย), แชตลูกค้าที่รอตอบ
      try {
        const ef = eventFacts(events, { customers, bookings, testDrives }, today)
        if (ef.length) businessContext['งานออกบูธ/อีเวนต์ (หน้าตารางออกบูธ)'] = ef.join('\n')
        const msrc = { bookings, customers, budget, vehicles: getVehicles(), jobCards: jobs, testDrives, socialAccounts: socialAccts, events }
        const cr = compareRange('month', today)
        const mf = metricsFacts(computeSalesMetrics(msrc, { today, period: 'month' }), computeSalesMetrics(msrc, { today, range: cr }), cr.label)
        if (mf.length) businessContext['ตัวชี้วัดการขายเดือนนี้ (หน้าตัวชี้วัดการขาย)'] = mf.join('\n')
        const af = accountFacts(socialAccts, accountResults(customers, today.slice(0, 7)), today.slice(0, 7))
        if (af.length) businessContext['Lead/ค่าโฆษณาต่อบัญชีโซเชียลเดือนนี้ (หน้าช่องทางโซเชียล › บัญชี)'] = af.join('\n')
        // (v1.0.1016) นัดวันนี้ทั้งโชว์รูม (มา/ไม่มา) และศูนย์บริการ — ให้ตอบ "วันนี้ลูกค้าเข้าโชว์รูมกี่คน / ศูนย์มีรถเข้ากี่คัน"
        const sv = showroomVisitLine(showroomAppts, today)
        if (sv) businessContext['นัดเข้าโชว์รูมวันนี้ทั้งทีม (หน้านัดหมายโชว์รูม)'] = sv.replace(/^\s*•\s*/, '')
        const svc = serviceTodayLines(serviceAppts, today, 10)
        if (svc.length) businessContext['นัดเข้าศูนย์บริการวันนี้ (หน้านัดหมาย & เตือนเข้าศูนย์)'] = svc.join('\n')
        // (v1.0.1011) งานรอการเงิน (ยืนยันยอดโอน/คืนเงินจอง) — เฉพาะผู้บริหาร/การเงิน
        if (isManagerRole() || getState('user')?.role === 'finance') {
          const fq = financeQueue(bookings, today)
          if (fq.total) businessContext['งานรอการเงิน (หน้าการเงิน › ยืนยันยอดโอน & คืนเงินจอง)'] = `รอยืนยันยอดโอน ${fq.verify.length} ใบ${fq.oldestDays ? ` (นานสุด ${fq.oldestDays} วัน)` : ''} · รอคืนเงินจอง ${fq.refund.length} ใบ รวม ${formatCurrency(fq.refundAmt)}`
        }
        const waiting = threads.filter(t => !t.deleted && t.lastDirection === 'in')
        if (waiting.length) businessContext['แชตลูกค้า LINE OA ที่รอตอบ (หน้าช่องทางโซเชียล)'] = `${waiting.length} ราย: ${waiting.slice(0, 5).map(t => `${t.name || 'ลูกค้า'} "${String(t.lastText || '').slice(0, 40)}"`).join(' · ')}`
      } catch { /* ข้อมูลเสริม ไม่มีก็ตอบได้ */ }
      // มูลค่าดีลที่กำลังคุย และยอดที่คาดว่าปิดได้ (มูลค่า × โอกาสปิด) — สูตรเดียวกับหน้า Pipeline
      try {
        const vs = getVehicles(), cache = new Map()
        const open = leads.filter(c => !c.isLost)
        const total = open.reduce((s, c) => s + dealValue(c, vs, cache), 0)
        const exp = open.reduce((s, c) => s + dealValue(c, vs, cache) * heuristicScore(c).score / 100, 0)
        businessContext['ดีลที่กำลังคุย (Lead+Prospect)'] = `${open.length} ราย มูลค่ารวม ${formatCurrency(total)} · คาดว่าปิดได้ประมาณ ${formatCurrency(Math.round(exp / 1000) * 1000)} (มูลค่า × โอกาสปิดของแต่ละคน)`
        // ดีลที่น่าปิดที่สุด (เฉพาะลูกค้าที่ผู้ใช้คนนี้มีสิทธิ์เห็น ตามนโยบายเห็นเฉพาะทีมตัวเอง) — ให้ตอบ "ดีลไหนควรปิดก่อน" ได้
        const vis = await getVisibilityScope().catch(() => null)
        const canSee = c => !!vis && (vis.unrestricted || vis.companyOnly || scopeIncludesRecord(vis, c.assignedTo, c))
        chatCustomers = customers.filter(c => !c.deleted && canSee(c))
        chatBookings = bookings.filter(b => !b.deleted && !!vis && (vis.unrestricted || vis.companyOnly || scopeIncludesRecord(vis, b.salesName, b)))
        chatFollowups = followups
        const best = open.filter(canSee).map(c => ({ c, v: dealValue(c, vs, cache), s: heuristicScore(c).score }))
          .sort((a, b) => b.v * b.s - a.v * a.s).slice(0, 6)
        if (best.length) businessContext['ดีลที่น่าปิดที่สุด (มูลค่า × โอกาสปิด)'] = best.map(({ c, v, s }) => {
          const q = quietDays(c, today)
          return `${c.firstName || 'ลูกค้า'} — ${c.interestedModel || 'ยังไม่รู้รุ่น'} · โอกาสปิด ${s}% · ≈${formatCurrency(v)}${q != null ? ` · ไม่ได้คุย ${q} วัน` : ''}${c.assignedTo ? ` · ผู้ดูแล ${c.assignedTo}` : ''}`
        }).join('\n')
      } catch {}
      // งานของผู้ใช้คนนี้วันนี้ (เกณฑ์เดียวกับหน้า "งานของฉันวันนี้") — ให้ LAMI ตอบ "วันนี้ควรทำอะไรก่อน" ได้จากข้อมูลจริง
      const myName = getState('user')?.displayName
      if (myName) {
        const mine = n => normName(n) === normName(myName)
        const d = buildMyDay({ customers, followups, bookings, testDrives, appointments: showroomAppts, lineThreads: threads }, { today, mine })
        businessContext[`งานของ ${myName} วันนี้`] = myDayDigest(d)
        welcomeStats.todo = d.total
      }
      // (v1.0.983) ลูกค้าที่ควรโทรบอกโปร (โปรใกล้หมด/โปรใหม่) — เกณฑ์เดียวกับหน้างานของฉันวันนี้ · เซลส์เห็นเฉพาะลูกค้าของตัวเอง
      try {
        const isMgr = isManagerRole()
        const brandOf = m => modelMatches(m, getVehicles(), 1)[0]?.brand || ''
        const rows = campaignLeads(programs.filter(p => !p.deleted), customers, { today, brandOf, mine: n => isMgr || !myName || normName(n) === normName(myName) })
        if (rows.length) businessContext['ลูกค้าที่ควรโทรบอกโปรวันนี้ (โปรใกล้หมด/โปรใหม่)'] = rows.slice(0, 8).map(r =>
          `${r.name} — ${r.model} · ${r.reason === 'ending' ? (r.left === 0 ? 'โปรหมดวันนี้' : `โปรหมดใน ${r.left} วัน`) : 'โปรใหม่'} · ${r.lines.join(', ')}${isMgr && r.c.assignedTo ? ` · ผู้ดูแล ${r.c.assignedTo}` : ''}`).join('\n') + (rows.length > 8 ? `\n…และอีก ${rows.length - 8} ราย (ดูทั้งหมดที่หน้างานของฉันวันนี้)` : '')
      } catch { /* ข้อมูลเสริม */ }
    } catch (e) { businessContext = {} }
  }

  // chat_ai_assistant เดิมไม่มี field ระบุเจ้าของเลย ทำให้ทุกคนที่เข้าหน้านี้เห็นข้อความของทุกคนรวมกัน
  // (เหมือน guestbook สาธารณะ) — สโคปด้วย uid ของผู้ใช้ปัจจุบันแทน ข้อความเก่าก่อนแก้ที่ไม่มี uid
  // จะไม่ถูกดึงมาแสดงอีก (ไม่ถือเป็น error — แชทเก่าจะเริ่มใหม่ แต่ปลอดภัยกว่าเห็นข้อความคนอื่นปนกัน)
  function currentUid() {
    return getState('user')?.uid || null
  }

  async function loadData() {
    loading = true
    try {
      const uid = currentUid()
      const filters = uid ? [['uid', '==', uid]] : []
      messages = (await listDocs('chat_ai_assistant', filters, 'createdAt', 'asc', 500)).filter(m => !m.deleted)
      if (!messages.length) {
        await createDoc('chat_ai_assistant', { role:'ai', text: GREETING, time: now(), uid })
        messages = (await listDocs('chat_ai_assistant', filters, 'createdAt', 'asc', 500)).filter(m => !m.deleted)
      }
    } catch (e) { messages = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function msgHtml(m, i = -1) {
    const isUser = m.role === 'user'
    // ข้อความจากผู้ใช้เป็น free-text ต้อง escape ก่อน render เสมอ (กัน stored XSS)
    // คำตอบ AI ตอนนี้มาจาก askLami() จริง (Gemini ผ่าน proxy) ไม่ใช่ CANNED hardcode แล้ว — เป็นข้อความ
    // ธรรมดา (ไม่มี <strong>/HTML ที่ตั้งใจ) จึง escape เหมือนกับข้อความผู้ใช้เพื่อกัน XSS จาก AI ตอบ raw HTML
    // กลับมาโดยไม่ตั้งใจ ยกเว้น GREETING ที่ยัง hardcode ไว้ในไฟล์นี้เองเท่านั้น
    const text = isUser ? esc(m.text) : m.text !== GREETING ? formatAiText(m.text) : m.text
    // overflow-x:visible = ยกเว้นจากกฎ "flex ขึ้นบรรทัดใหม่" บนมือถือ (base.css) ให้รูป 🤖 อยู่ข้างข้อความเสมอ
    return `<div style="display:flex;overflow-x:visible;${isUser?'justify-content:flex-end':'align-items:flex-start;gap:8px'}">
      ${!isUser ? `<div style="width:30px;height:30px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>` : ''}
      <div style="min-width:0">
        <div style="max-width:74vw;padding:10px 14px;border-radius:${isUser?'16px 16px 4px 16px':'4px 16px 16px 16px'};background:${isUser?'var(--primary)':'var(--surface-2)'};color:${isUser?'white':'var(--text)'};font-size:0.84rem;line-height:1.65">${text}</div>
        ${!isUser && i === messages.length - 1 && !waiting && m.cmd && pendingCmds.length ? '<div id="chat-cmds" style="margin-top:6px"></div>' : ''}
        ${!isUser && i === messages.length - 1 && !waiting && Array.isArray(m.next) && m.next.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${m.next.map(q => `<button class="btn btn-secondary btn-xs cat-btn" data-q="${esc(q)}" style="border-radius:999px">💬 ${esc(q)}</button>`).join('')}</div>` : ''}
        ${!isUser && !m.cmd && i === messages.length - 1 && !waiting && i > 0 && messages[i - 1]?.role === 'user' ? (() => {
          const acts = customerActionsFor(messages[i - 1].text, chatCustomers)
          const l = Array.isArray(m.links) && m.links.length ? m.links : pageLinksFor(messages[i - 1].text)
          return acts.length || l.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${acts.map(a => `<button class="btn btn-primary btn-xs chat-act" data-kind="${a.kind}" data-id="${esc(a.id)}" data-phone="${esc(a.phone || '')}" style="border-radius:999px">${esc(a.label)}</button>`).join('')}${l.map(x => `<button class="btn btn-secondary btn-xs chat-go" data-path="${esc(x.path)}" style="border-radius:999px">${esc(x.label)} →</button>`).join('')}</div>` : ''
        })() : ''}
        <div style="font-size:0.66rem;color:var(--text-muted);margin-top:3px;${isUser?'text-align:right':''}">${esc(m.time)}${!isUser && m.text !== GREETING && i >= 0 ? ` · <button class="chat-copy" data-i="${i}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.66rem;padding:0">📋 คัดลอก</button> · <button class="chat-speak" data-i="${i}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.66rem;padding:0">🔊 ฟัง</button>` : ''}</div>
      </div>
    </div>`
  }

  // หน้าแรกของแชท (ยังไม่เคยถาม) — การ์ดคำถามแนะนำขนาดใหญ่ กดแล้วถามได้ทันที
  function welcomeHtml() {
    const name = getState('user')?.displayName
    const cards = [
      ['☀️', 'วันนี้ทำอะไรก่อน', welcomeStats.todo ? `คุณมีงานค้าง ${welcomeStats.todo} รายการ ให้ LAMI จัดลำดับ` : 'จัดลำดับงานของคุณจากข้อมูลจริง', CATEGORIES[0].q],
      ['🎯', 'ช่วยปิดการขาย', 'ลูกค้าคนไหนน่าปิดที่สุด พูดอะไรดี', CATEGORIES[1].q],
      ['📊', 'ยอดขายเดือนนี้', 'สรุปยอดและกำไรเดือนนี้', 'สรุปยอดขายและกำไรเดือนนี้ให้หน่อย เทียบกับที่ควรเป็น และควรเร่งอะไร'],
      ['📋', 'ใบจองค้าง', 'ค้างสถานะไหน ควรเร่งอะไรก่อน', CATEGORIES[2].q],
      ['📈', 'เดือนนี้จะถึงเป้าไหม', 'คาดการณ์สิ้นเดือน + แนวโน้ม 6 เดือน', CATEGORIES[3].q],
      ['🔥', 'Hot Lead', welcomeStats.hot ? `ตอนนี้มี ${welcomeStats.hot} ราย ควรตามใครก่อน` : 'ลูกค้าที่สนใจมากตอนนี้', 'มี Hot Lead กี่ราย และควรตามใครก่อน?'],
    ]
    // margin:0 auto (ไม่ใช่ margin:auto) — ในกล่อง flex ที่เลื่อนได้ margin บนแบบ auto ทำให้หัวข้อต้อนรับโดนตัดหายเมื่อจอเตี้ย
    return `<div style="margin:0 auto;max-width:640px;width:100%;text-align:center;padding:16px 0">
      <div style="width:64px;height:64px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--success));display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:0 8px 30px color-mix(in srgb, var(--primary) 40%, transparent)">🤖</div>
      <div style="font-size:1.25rem;font-weight:800">สวัสดีค่ะ${name ? ` คุณ${esc(name)}` : ''} วันนี้ให้ LAMI ช่วยอะไรดีคะ</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 16px">LAMI ตอบจากข้อมูลจริงในระบบ ทั้งยอดขาย ลูกค้า งานค้างของคุณ และอื่นๆ</div>
      <div class="lami-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,46%),1fr));gap:10px;text-align:left">
        ${cards.map(([icon, title, sub, q]) => `<button class="card cat-btn" data-q="${esc(q)}" style="padding:14px;cursor:pointer;text-align:left;border:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;color:var(--text)">
          <span style="font-size:1.4rem">${icon}</span><span style="min-width:0"><b style="font-size:0.88rem">${title}</b><br><span style="font-size:0.74rem;color:var(--text-muted)">${sub}</span></span></button>`).join('')}
      </div>
      <div style="font-size:0.76rem;color:var(--text-3);margin-top:14px;line-height:1.6">⚡ สั่งงานได้ด้วย เช่น พิมพ์ <b>“นัดลองขับ${esc(chatCustomers.find(c => ['lead', 'pp'].includes(c.stage) && !c.isLost && c.firstName)?.firstName || 'สมชาย')}พรุ่งนี้บ่าย 2”</b> แล้วกดปุ่มใต้คำตอบ ระบบเปิดฟอร์มกรอกให้ครบ<br>👤 ถามเรื่องลูกค้ารายคนได้ เช่น <b>“${esc(chatCustomers.find(c => c.firstName)?.firstName || 'สมชาย')}ถึงไหนแล้ว”</b> หรือพิมพ์เลขใบจอง/เบอร์โทร LAMI ตอบจากสถานะจริง</div></div>`
  }

  function typingHtml() {
    return `<div style="display:flex;align-items:flex-start;gap:8px" id="typing-bubble">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1rem">🤖</div>
      <div style="padding:12px 16px;border-radius:4px 16px 16px 16px;background:var(--surface-2)">
        <span style="display:inline-flex;gap:4px">
          <span style="width:7px;height:7px;border-radius:50%;background:var(--text-muted);animation:pulse 1s ease-in-out 0s infinite"></span>
          <span style="width:7px;height:7px;border-radius:50%;background:var(--text-muted);animation:pulse 1s ease-in-out 0.2s infinite"></span>
          <span style="width:7px;height:7px;border-radius:50%;background:var(--text-muted);animation:pulse 1s ease-in-out 0.4s infinite"></span>
        </span>
      </div>
    </div>`
  }

  const hasMic = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <style>@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}</style>
      <div class="page-content animate-slide" style="display:flex;flex-direction:column;height:calc(100vh - 56px - var(--bottom-nav-h, 0px));padding-bottom:0">
        <div class="page-header lami-head" style="padding-bottom:8px;margin-bottom:0">
          <div style="display:flex;align-items:center;gap:10px;overflow-x:visible;min-width:0">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.3rem">🤖</div>
            <div>
              <div class="page-title" style="margin:0">LAMI<span class="hide-sm"> — AI Business Assistant</span><span class="show-sm"> ผู้ช่วย AI</span></div>
              <div style="font-size:0.72rem;color:var(--success);font-weight:600">${isAiEnabled() ? '● พร้อมใช้งาน · ขับเคลื่อนด้วย Gemini AI จริง' : '● Demo Mode · ล็อกอินด้วยบัญชีจริงเพื่อเปิดใช้งาน AI จริง'}</div>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm" id="clear-chat" title="ล้างแชท">🗑<span class="hide-sm"> ล้างแชท</span></button>
          </div>
        </div>

        <!-- Category chips — ตอนยังไม่เริ่มคุย การ์ดต้อนรับมีคำถามชุดเดียวกันอยู่แล้ว จึงโชว์แถบนี้หลังเริ่มคุยเท่านั้น -->
        <div style="${messages.some(m => m.role === 'user') || waiting ? '' : 'display:none !important;'}display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:8px 0;padding-bottom:8px;border-bottom:1px solid var(--border)">
          ${CATEGORIES.map(c => `<button class="btn btn-xs btn-secondary cat-btn" style="flex-shrink:0" data-q="${esc(c.q)}">${c.label}</button>`).join('')}
        </div>

        <!-- Chat messages -->
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:12px 0" id="chat-area">
          ${messages.some(m => m.role === 'user') || waiting ? messages.map((m, i) => msgHtml(m, i)).join('') : welcomeHtml()}
          ${waiting ? typingHtml() : ''}
        </div>

        <!-- Input bar -->
        <div style="padding:10px 0;border-top:1px solid var(--border);display:flex;gap:8px">
          <input class="input" id="chat-input" placeholder="ถาม หรือสั่ง เช่น นัดสมชายพรุ่งนี้ 10 โมง · จด สมชาย ชอบสีขาว" title="ถาม: ยอดขายวันนี้ / Hot Lead · สั่ง: นัดสมชายพรุ่งนี้ 10 โมง / มานี hot / นัดลองขับปิติเสาร์บ่าย 2" style="flex:1" ${waiting?'disabled':''}>
          ${hasMic ? `<button class="btn btn-secondary" id="mic-btn" ${waiting?'disabled':''} title="พูดคำถาม (ภาษาไทย)" style="flex-shrink:0">🎤</button>` : ''}
          <button class="btn btn-primary" id="send-btn" ${waiting?'disabled':''} style="white-space:nowrap">📤 ส่ง</button>
        </div>
      </div>
    `

    const chatArea = document.getElementById('chat-area')
    // หน้าต้อนรับ (ยังไม่เคยถาม) ให้เห็นหัวข้อตั้งแต่บนสุด · มีบทสนทนาแล้วค่อยเลื่อนลงข้อความล่าสุด
    const hasChat = messages.some(m => m.role === 'user') || waiting
    if (chatArea) chatArea.scrollTop = hasChat ? chatArea.scrollHeight : 0

    async function send(q) {
      const text = q.trim()
      if (!text || waiting) return
      document.getElementById('chat-input').value = ''
      waiting = true
      const uid = currentUid()
      try { await createDoc('chat_ai_assistant', { role:'user', text, time:now(), uid }) } catch (e) {}
      messages.push({ role:'user', text, time:now(), uid })
      renderPage()
      // เรียก askLami() จริง (เหมือน pattern เดียวกับ LamiBrain.js) แทน CANNED keyword-match เดิม — ประวัติแชท
      // ต้องแปลง role 'ai' ในไฟล์นี้เป็น 'lami' ตามที่ askLami() คาดหวัง (ไม่กระทบ role ที่เก็บจริงใน Firestore)
      const history = messages.slice(0, -1).map(m => ({ role: m.role === 'ai' ? 'lami' : m.role, text: m.text }))
      // (v1.0.981) "X อยู่ตรงไหน / หาไม่เจอ" → ตอบจากเมนูจริงทันที พร้อมปุ่มเปิดหน้า (ไม่ต้องรอ AI และไม่เดาชื่อหน้าผิด)
      // (v1.0.1035) "วันนี้ควรโทรหาใคร" → รายชื่อจริงพร้อมปุ่มโทร ไม่ต้องรอ AI
      // (v1.0.1039) "นัดลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง" → รายชื่อพร้อมปุ่ม ✅ ทำทั้งหมด
      {
        const card = await import('../../utils/lamiCommandCard.js')
        const bulk = await card.loadBulkCommands(text, Promise.resolve(chatCustomers)).catch(() => null)
        if (bulk) {
          pendingCmds = bulk.cmds; pendingMulti = true
          try { await createDoc('chat_ai_assistant', { role:'ai', text: bulk.intro, cmd: bulk.cmds.length > 0, time:now(), uid }) } catch (e) {}
          waiting = false
          await loadData()
          return
        }
      }
      pendingMulti = false
      // (v1.0.1049) "วันนี้มีอะไรบ้าง / สรุปวันนี้" → สรุปงานวันนี้จากข้อมูลจริงทันที
      {
        const card = await import('../../utils/lamiCommandCard.js')
        const tb = await card.loadTodayBrief(text, Promise.resolve(chatCustomers)).catch(() => null) || await card.loadMonthBrief(text).catch(() => null) || await card.loadStockAnswer(text).catch(() => null) // (v1.0.1051) + ยอดเดือนนี้ (v1.0.1053) + สต็อก
        if (tb) {
          pendingCmds = []
          try { await createDoc('chat_ai_assistant', { role:'ai', text: tb.text + (tb.next.length ? '\n\n💬 ถามต่อได้: ' + tb.next.map(x => `"${x}"`).join(' · ') : ''), time:now(), uid }) } catch (e) {}
          waiting = false
          await loadData()
          return
        }
      }
      // (v1.0.1048) "สมชายถึงไหนแล้ว / สรุปมานี" → สรุปลูกค้าจากข้อมูลจริงทันที พร้อมปุ่มโทร/เปิด
      {
        const card = await import('../../utils/lamiCommandCard.js')
        const br = await card.loadCustomerBrief(text, Promise.resolve(chatCustomers)).catch(() => null)
        if (br) {
          pendingCmds = br.cmds
          try { await createDoc('chat_ai_assistant', { role:'ai', text: br.text, cmd: true, time:now(), uid }) } catch (e) {}
          waiting = false
          await loadData()
          return
        }
      }
      // (v1.0.1046) ถามหาใบจอง "ใครรอไฟแนนซ์ / ใครยังไม่นัดส่งมอบ" → รายการใบจองจริงพร้อมปุ่มเปิด
      {
        const card = await import('../../utils/lamiCommandCard.js')
        const bl = await card.loadBookingListCommands(text, Promise.resolve(chatCustomers)).catch(() => null)
        if (bl) {
          pendingCmds = bl.cmds
          try { await createDoc('chat_ai_assistant', { role:'ai', text: bl.intro, cmd: bl.cmds.length > 0, time:now(), uid }) } catch (e) {}
          waiting = false
          await loadData()
          return
        }
      }
      // (v1.0.1045) ถามหารายชื่อ "ลูกค้า hot มีใครบ้าง" → รายชื่อจริงพร้อมปุ่มโทร
      {
        const card = await import('../../utils/lamiCommandCard.js')
        const lst = await card.loadListCommands(text, Promise.resolve(chatCustomers)).catch(() => null)
        if (lst) {
          pendingCmds = lst.cmds
          try { await createDoc('chat_ai_assistant', { role:'ai', text: lst.intro + (lst.next ? `\n💡 พิมพ์ "${lst.next}" เพื่อนัดทั้งกลุ่มในครั้งเดียว` : ''), cmd: lst.cmds.length > 0, time:now(), uid }) } catch (e) {}
          waiting = false
          await loadData()
          return
        }
      }
      if (isCallListQuestion(text)) {
        const card = await import('../../utils/lamiCommandCard.js')
        const cmds = await card.loadCallListCommands(Promise.resolve(chatCustomers)).catch(() => [])
        pendingCmds = cmds
        try { await createDoc('chat_ai_assistant', { role:'ai', text: card.callListIntro(cmds), cmd: cmds.length > 0, time:now(), uid }) } catch (e) {}
        waiting = false
        await loadData()
        return
      }
      if (isCommandHelp(text)) {
        try { await createDoc('chat_ai_assistant', { role:'ai', text: commandHelpText(exampleName(chatCustomers)), time:now(), uid }) } catch (e) {}
        waiting = false
        await loadData()
        return
      }
      const where = isWhereQuestion(text) ? findPages(text, NAV) : []
      if (where.length) {
        try { await createDoc('chat_ai_assistant', { role:'ai', text: whereAnswer(where), links: where.map(({ label, path }) => ({ label, path })), time:now(), uid }) } catch (e) {}
        waiting = false
        await loadData()
        return
      }
      // (v1.0.1031) พิมพ์สั่งงาน เช่น "นัดสมชายพรุ่งนี้ 10 โมง" / "มานี hot" → การ์ดทำเลยครั้งเดียว ไม่ต้องรอ AI
      const cmds = parseLamiCommand(text, chatCustomers, todayBangkok())
      pendingCmds = cmds
      if (cmds.length) {
        try { await createDoc('chat_ai_assistant', { role:'ai', text: commandIntro(cmds), cmd: true, time:now(), uid }) } catch (e) {}
        waiting = false
        await loadData()
        return
      }
      try {
        // ถามเรื่องรุ่น/ยี่ห้อรถ → แนบราคา/สเปคจริงจาก catalog (รวมคำถามก่อนหน้า 2 ข้อ เผื่อถามต่อ เช่น "แล้วรุ่น max ล่ะ")
        const recent = [text, ...messages.filter(m => m.role === 'user').slice(-3, -1).map(m => m.text)].join(' ')
        let cat = ''
        try { cat = catalogContext(recent, getVehicles()) } catch {}
        // ถามถึงลูกค้า/ใบจองรายคน (ชื่อ เลขใบจอง เบอร์) → แนบสถานะจริงของคนนั้น (ไม่ส่งเบอร์/เลขบัตรให้ AI)
        let rec = {}
        // (v1.0.928) ใช้คำถามก่อนหน้าช่วยหาคน เฉพาะตอนถามต่อเรื่องเดิม ("แล้วส่งมอบเมื่อไหร่" "เขาจองรุ่นไหน")
        // เดิมรวมคำถามเก่าเสมอ → ถามเรื่องใหม่ เช่น "วันนี้ต้องโทรหาใครบ้าง" ก็ยังแนบข้อมูลลูกค้าคนเก่าไปปน
        try {
          const facts = { customers: chatCustomers, bookings: chatBookings, followups: chatFollowups }
          rec = recordFacts(text, facts, todayBangkok())
          if (!Object.keys(rec).length && isFollowUpQuestion(text)) rec = recordFacts(recent, facts, todayBangkok())
        } catch {}
        const raw = await askLami(text, history, { ...businessContext, ...rec, ...(cat ? { 'ข้อมูลรถ': cat } : {}), 'รูปแบบท้ายคำตอบ': NEXT_Q_HINT })
        const { text: answer, next } = splitFollowups(raw)
        try { await createDoc('chat_ai_assistant', { role:'ai', text: answer, next, time:now(), uid }) } catch (e) {}
      } catch (err) {
        // (v1.0.923) AI ตอบไม่ได้ (เน็ตหลุด/โควต้าเต็ม) แต่คำถามเอ่ยถึงลูกค้า/ใบจอง → ยังเห็นข้อมูลจริงจากระบบทันที ไม่ใช่แค่ข้อความ error
        let facts = ''
        try { facts = Object.values(recordFacts(text, { customers: chatCustomers, bookings: chatBookings, followups: chatFollowups }, todayBangkok()))[0] || '' } catch {}
        const fallback = '⚠️ ' + aiErrorText(err) + (facts ? '\n\nข้อมูลจากระบบตอนนี้:\n' + facts : '')
        try { await createDoc('chat_ai_assistant', { role:'ai', text: fallback, time:now(), uid }) } catch (e) {}
      } finally {
        waiting = false
        await loadData()
        // ถามด้วยเสียง → อ่านคำตอบให้ฟังอัตโนมัติ (ขับรถ/มือไม่ว่างก็คุยกับ LAMI ได้)
        if (voiceAsked) {
          voiceAsked = false
          const last = [...messages].reverse().find(m => m.role === 'ai')
          if (last) {
            try {
              const v = await import('../../utils/voice.js')
              v.speak(String(last.text).replace(/[*_#`]/g, ''), { onNoVoice: () => {} })
            } catch {}
          }
        }
      }
    }

    // พูดแทนพิมพ์ (Chrome/Android รองรับภาษาไทย) — พูดจบส่งคำถามให้ทันที
    document.getElementById('mic-btn')?.addEventListener('click', async e => {
      const btn = e.currentTarget
      const { createSTT } = await import('../../utils/voice.js')
      const input = document.getElementById('chat-input')
      const rec = createSTT({
        onInterim: t => { if (input) input.value = t },
        onFinal: t => { if (input) input.value = t; voiceAsked = true; send(t) },
        onEnd: () => { btn.textContent = '🎤'; btn.classList.remove('btn-danger') },
        onError: () => showToast('ไม่ได้ยินเสียง ลองใหม่อีกครั้ง หรืออนุญาตให้ใช้ไมโครโฟน', 'warning'),
      })
      if (!rec) return
      btn.textContent = '🔴'; btn.classList.add('btn-danger')
      try { rec.start() } catch { btn.textContent = '🎤' }
    })
    // 🔊 ฟังคำตอบ (เสียง AI จากคลาวด์ ถ้าไม่ได้ก็ใช้เสียงในเครื่อง) — กดซ้ำเพื่อหยุด
    container.querySelectorAll('.chat-speak').forEach(b => b.addEventListener('click', async () => {
      const m = messages[+b.dataset.i]
      if (!m) return
      const v = await import('../../utils/voice.js')
      if (b.dataset.on) { v.stopSpeaking(); delete b.dataset.on; b.textContent = '🔊 ฟัง'; return }
      container.querySelectorAll('.chat-speak[data-on]').forEach(x => { delete x.dataset.on; x.textContent = '🔊 ฟัง' })
      b.dataset.on = '1'; b.textContent = '⏹ หยุด'
      v.speak(String(m.text).replace(/[*_#`]/g, ''), {
        onEnd: () => { delete b.dataset.on; b.textContent = '🔊 ฟัง' },
        onNoVoice: () => showToast('เครื่องนี้ไม่มีเสียงภาษาไทย', 'warning'),
      })
    }))
    container.querySelectorAll('.chat-copy').forEach(b => b.addEventListener('click', async () => {
      const m = messages[+b.dataset.i]
      if (!m) return
      await copyText(m.text, '📋 คัดลอกแล้ว', 'คัดลอกไม่สำเร็จ')
    }))
    document.getElementById('send-btn')?.addEventListener('click', () => send(document.getElementById('chat-input')?.value || ''))
    document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value) } })
    container.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => send(b.dataset.q)))
    // เปิดหน้าที่เกี่ยวกับคำถาม (เช่น ถามเรื่องลองขับ → ไปหน้านัดทดลองขับ)
    container.querySelectorAll('.chat-go').forEach(b => b.addEventListener('click', () => navigate(b.dataset.path)))
    // ลงมือทำจากแชท: โทร / นัดลองขับ (เดาวันเวลาจากคำถาม) / เปิดข้อมูลลูกค้า
    mountCommandCard(document.getElementById('chat-cmds'), pendingCmds, {
      multi: pendingMulti,
      onDone: async msg => { pendingCmds = []; pendingMulti = false; try { await createDoc('chat_ai_assistant', { role:'ai', text: msg, time:now(), uid: currentUid() }) } catch (e) {} ; await loadData() },
    })
    container.querySelectorAll('.chat-act').forEach(b => b.addEventListener('click', async () => {
      const c = chatCustomers.find(x => x.id === b.dataset.id)
      if (!c) return
      if (b.dataset.kind === 'tel' && b.dataset.phone) { location.href = 'tel:' + b.dataset.phone; return }
      if (b.dataset.kind === 'open') { navigate('/crm/customers?id=' + encodeURIComponent(c.id)); return }
      if (b.dataset.kind === 'td') {
        const q = [...messages].reverse().find(m => m.role === 'user')?.text || ''
        const { openTestDriveForm } = await import('../../utils/testDriveForm.js')
        openTestDriveForm(c, { hint: q })
      }
    }))
    document.getElementById('clear-chat')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ล้างประวัติแชท', message: 'ต้องการล้างประวัติแชททั้งหมดหรือไม่? ไม่สามารถกู้คืนได้', confirmText: 'ล้างแชท', danger: true })
      if (!ok) return
      try {
        for (const m of messages) await softDelete('chat_ai_assistant', m.id)
        await createDoc('chat_ai_assistant', { role:'ai', text:'🗑 ล้างแชทแล้วค่ะ — ถามใหม่ได้เลย!', time:now(), uid: currentUid() })
        waiting = false
        await loadData()
      } catch (e) { showToast('ล้างแชทไม่สำเร็จ', 'error') }
    })
    if (!waiting) document.getElementById('chat-input')?.focus()
  }

  await Promise.all([loadData(), loadBusinessContext()])
  // การ์ดต้อนรับแสดงตัวเลขจริงเมื่อโหลดข้อมูลธุรกิจเสร็จ (ยังไม่เริ่มคุยเท่านั้น ไม่รบกวนแชทที่กำลังพิมพ์)
  if (container.__routerGen === myGen && !waiting && !messages.some(m => m.role === 'user') && (welcomeStats.todo || welcomeStats.hot)) renderPage()
  // เปิดจากช่องค้นหา (Ctrl+K) "ถาม LAMI: ..." → ส่งคำถามให้ทันที แล้วลบ ?q= ออกกันส่งซ้ำตอนรีเฟรช
  const q = new URLSearchParams(window.location.search).get('q')
  if (q && container.__routerGen === myGen) {
    window.history.replaceState({}, '', window.location.pathname)
    const input = document.getElementById('chat-input')
    if (input) { input.value = q; document.getElementById('send-btn')?.click() }
  }
}
