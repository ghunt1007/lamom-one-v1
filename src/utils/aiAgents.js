// (v1.0.1132) ทีม AI ประจำแผนก — แต่ละ "เจ้าหน้าที่ AI" ไล่ตรวจงานของแผนกตัวเองจากข้อมูลจริงทุกครั้งที่เปิดหน้า
// แล้วสรุปว่า "วันนี้ต้องทำอะไร" พร้อมปุ่มไปหน้านั้นทันที — ไม่ต้องถามเอง ไม่ต้องรอ AI (คิดจากข้อมูลในเครื่อง ไม่ใช้โควตา AI)
// ใช้ตรรกะเดียวกับที่ LAMI ตอบคำถาม (opsQuestions.js) ผลจึงตรงกันทุกที่
import {
  staleProspectAnswer, noQuoteAnswer, noTestDriveAnswer, lineWaitingAnswer, noPhoneAnswer, dupAnswer,
  pdiAnswer, plateAnswer, deliveryAnswer, incomeMissingAnswer, complaintAnswer, leaveAnswer, apptDayAnswer,
} from './opsQuestions.js'

// แต่ละงาน: run(data) → { n, text } (n = จำนวนที่ต้องทำ, 0 = เรียบร้อย) · go = หน้าที่กดไปทำ · level: urgent | todo
export const AGENTS = [
  {
    id: 'sam', emoji: '🚗', name: 'SAM', dept: 'ฝ่ายขาย', role: 'ตามลูกค้า ปิดการขาย',
    tasks: [
      { key: 'silent', label: 'ลูกค้าเงียบเกิน 7 วัน', level: 'urgent', go: '/crm/customers?fu=quiet', run: d => staleProspectAnswer(d.customers, { today: d.today, min: 7, silent: true }) },
      { key: 'hotNoTd', label: 'ลูกค้า HOT ที่ยังไม่ได้ทดลองขับ', level: 'todo', go: '/crm/testdrive', run: d => noTestDriveAnswer(d.customers, d.drives, { temp: 'hot' }) },
      { key: 'noQuote', label: 'ลูกค้าที่ยังไม่มีใบเสนอราคา', level: 'todo', go: '/crm/quotation', run: d => noQuoteAnswer(d.customers, d.quotes) },
      { key: 'appts', label: 'นัดลูกค้าวันนี้', level: 'todo', go: '/calendar', run: d => apptDayAnswer(d.appts, d.drives, { today: d.today, day: 'today' }) },
    ],
  },
  {
    id: 'mika', emoji: '📣', name: 'MIKA', dept: 'ฝ่ายการตลาด', role: 'แชต ลีด และข้อมูลลูกค้า',
    tasks: [
      { key: 'chat', label: 'แชตลูกค้ารอตอบ', level: 'urgent', go: '/marketing/channels?f=reply', run: d => lineWaitingAnswer(d.threads, d.customers) },
      { key: 'human', label: 'ลูกค้าขอคุยกับพนักงาน (AI ส่งต่อ)', level: 'urgent', go: '/marketing/channels?f=reply', run: d => needsHumanAnswer(d.threads) },
      { key: 'noPhone', label: 'ลูกค้าที่ยังไม่มีเบอร์โทร', level: 'todo', go: '/crm/customers', run: d => noPhoneAnswer(d.customers) },
      { key: 'dup', label: 'รายชื่อลูกค้าซ้ำ', level: 'todo', go: '/crm/customers', run: d => dupAnswer(d.customers) },
    ],
  },
  {
    id: 'aria', emoji: '🗂️', name: 'ARIA', dept: 'ธุรการ & ส่งมอบ', role: 'เอกสาร ส่งมอบ ทะเบียน',
    tasks: [
      { key: 'delivery', label: 'นัดส่งมอบ 7 วันข้างหน้า', level: 'todo', go: '/dms/delivery-calendar', run: d => deliveryAnswer(d.bookings, { today: d.today, day: 'week' }) },
      { key: 'pdi', label: 'รถที่ยังไม่ผ่าน PDI', level: 'urgent', go: '/crm/predelivery', run: d => pdiAnswer(d.pdis, { today: d.today }) },
      { key: 'plate', label: 'ส่งมอบแล้วแต่ยังไม่ได้ทะเบียน', level: 'todo', go: '/dms/delivery', run: d => plateAnswer(d.bookings, { today: d.today }) },
    ],
  },
  {
    id: 'finn', emoji: '💰', name: 'FINN', dept: 'การเงิน', role: 'รายได้ ค่าคอม ไฟแนนซ์',
    tasks: [
      { key: 'income', label: 'ส่งมอบแล้วแต่ยังไม่กรอกรายได้', level: 'urgent', go: '/crm/bookings', run: d => incomeMissingAnswer(d.bookings, { today: d.today }) },
    ],
  },
  {
    id: 'serv', emoji: '🔧', name: 'SERV', dept: 'บริการหลังการขาย', role: 'ร้องเรียน และดูแลหลังส่งมอบ',
    tasks: [
      { key: 'complaint', label: 'เรื่องร้องเรียนที่ยังไม่ปิด', level: 'urgent', go: '/crm/complaints', run: d => complaintAnswer(d.complaints, { today: d.today }) },
    ],
  },
  {
    id: 'hera', emoji: '👤', name: 'HERA', dept: 'บุคคล', role: 'การลา และกำลังคน',
    tasks: [
      { key: 'leave', label: 'คนลาวันนี้', level: 'todo', go: '/hr/leave', run: d => leaveAnswer(d.leaves, { today: d.today, day: 'today' }) },
    ],
  },
]

const alive = rows => (rows || []).filter(r => r && !r.deleted)
export function needsHumanAnswer(threads = []) {
  const list = alive(threads).filter(t => t.needsHuman && !t.aiPaused)
  if (!list.length) return { n: 0, text: '🙋 ไม่มีลูกค้ารอพนักงาน' }
  return { n: list.length, text: [`🙋 ลูกค้าขอคุยกับพนักงาน ${list.length} แชต`, ...list.slice(0, 8).map(t => `• ${t.name || 'ลูกค้า'}${t.channelName ? ' · ' + t.channelName : ''}${t.lastText ? ': "' + String(t.lastText).slice(0, 40) + '"' : ''}`)].join('\n') }
}

// ตัดบรรทัดแรก (หัวข้อ) ออก เหลือรายการ — หน้าจอโชว์หัวข้อของงานเอง
export function bodyLines(text = '') {
  return String(text).split('\n').slice(1).filter(l => l.trim())
}

/**
 * ให้ทุก agent ทำงาน — คืน [{ ...agent, results:[{key,label,level,go,n,lines}], open, urgent }]
 * งานที่ข้อมูลไม่พอ (เกิด error) ข้ามไปเงียบๆ ไม่ให้ทั้งกระดานพัง
 */
export function runAgents(data) {
  return AGENTS.map(a => {
    const results = []
    for (const t of a.tasks) {
      let r
      try { r = t.run(data) } catch { r = null }
      if (!r) continue
      results.push({ key: t.key, label: t.label, level: t.level, go: t.go, n: Number(r.n) || 0, lines: bodyLines(r.text), text: r.text })
    }
    const open = results.filter(r => r.n > 0)
    return { id: a.id, emoji: a.emoji, name: a.name, dept: a.dept, role: a.role, results, open: open.length, urgent: open.filter(r => r.level === 'urgent').reduce((s, r) => s + r.n, 0) }
  })
}

// สรุปสั้นสำหรับหัวกระดาน/LINE
export function agentsSummary(board) {
  const open = board.flatMap(a => a.results.filter(r => r.n > 0).map(r => ({ a, r })))
  if (!open.length) return '✅ ทีม AI ตรวจครบทุกแผนกแล้ว วันนี้ไม่มีงานค้าง'
  const urgent = open.filter(x => x.r.level === 'urgent')
  return [`🤖 ทีม AI ตรวจแล้ว: มีงาน ${open.length} เรื่อง${urgent.length ? ` (ด่วน ${urgent.length})` : ''}`,
    ...open.sort((x, y) => (x.r.level === 'urgent' ? 0 : 1) - (y.r.level === 'urgent' ? 0 : 1)).slice(0, 8).map(({ a, r }) => `${r.level === 'urgent' ? '🔴' : '🟡'} ${a.emoji} ${a.dept}: ${r.label} ${r.n}`)].join('\n')
}
