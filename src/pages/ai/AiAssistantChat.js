import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, softDelete, seedDemoData, getSalesData } from '../../core/db.js'
import { confirmDialog } from '../../utils/modal.js'
import { askLami, isAiEnabled } from '../../utils/ai.js'
import { formatCurrency, todayBangkok, toDateStr } from '../../utils/format.js'
import { heuristicScore } from './LeadScoring.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { normName, getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import { buildMyDay, myDayDigest } from '../../utils/myDay.js'
import { followupWindowFilters, quietDays } from '../../utils/customerFollowups.js'
import { catalogContext, dealValue } from '../../utils/salesAi.js'
import { businessFacts, stockFacts, testDriveFacts } from '../../utils/bizFacts.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { formatAiText } from '../../utils/aiFormat.js'
import { pageLinksFor } from '../../utils/aiPageLinks.js'
import { customerActionsFor } from '../../utils/aiActions.js'
import { navigate } from '../../core/router.js'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const CATEGORIES = [
  { label:'☀️ วันนี้ทำอะไรก่อน', q:'วันนี้ฉันควรทำอะไรก่อน? จัดลำดับให้หน่อย พร้อมเหตุผลสั้นๆ' },
  { label:'🎯 ช่วยปิดการขาย', q:'จากงานของฉันวันนี้ ลูกค้าคนไหนมีโอกาสปิดการขายสูงสุด และควรพูดอะไรกับเขา?' },
  { label:'🚗 เทียบรุ่นรถ', q:'Deepal S05 กับ S07 ต่างกันยังไง เหมาะกับลูกค้าแบบไหน?' },
  { label:'🏆 ผลงานทีม', q:'เดือนนี้ใครจอง/ส่งมอบได้มากสุด เทียบกับเดือนก่อนเป็นยังไง และ Lead จากช่องทางไหนปิดได้ดีที่สุด?' },
  { label:'🚙 นัดลองขับ', q:'สัปดาห์นี้มีนัดทดลองขับกี่นัด ใครบ้าง ควรเตรียมอะไร และที่ผ่านมาลองขับแล้วจองกี่เปอร์เซ็นต์?' },
  { label:'💔 ทำไมเสียดีล', q:'ช่วง 3 เดือนที่ผ่านมาเราเสียดีลเพราะอะไรมากที่สุด และควรแก้อะไรเป็นอันดับแรก?' },
  { label:'📊 ยอดขาย', q:'ยอดขายเดือนนี้เท่าไหร่?' },
  { label:'📦 สต็อก', q:'สต็อกรถเหลือกี่คัน?' },
  { label:'🔥 Hot Lead', q:'มี Hot Lead ไหม?' },
  { label:'💳 ค้างชำระ', q:'ใครค้างชำระบ้าง?' },
  { label:'⭐ CSAT', q:'CSAT เป็นยังไง?' },
  { label:'🔧 ช่าง', q:'ศูนย์บริการวันนี้เป็นยังไง?' },
  { label:'💰 กำไร', q:'กำไรเดือนนี้เท่าไหร่?' },
  { label:'👥 HR', q:'ข้อมูลพนักงานวันนี้?' },
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
  return new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})
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
  let chatCustomers = [] // ลูกค้าที่ผู้ใช้คนนี้มีสิทธิ์เห็น — ใช้ทำปุ่มโทร/นัดลองขับใต้คำตอบ (ไม่ส่งให้ AI)

  // (v1.0.428) หน้านี้มีปุ่มคำถามสำเร็จรูปตรงกับหัวข้อธุรกิจจริง (ยอดขาย/สต็อก/Hot Lead/ค้างชำระ/CSAT/ช่าง/
  // กำไร/HR) แต่เดิม askLami(text, history) ไม่เคยส่ง context เลย — Gemini จึงต้องเดา/กุตัวเลขทุกครั้งที่ตอบ
  // คำถามพวกนี้ ดึงสถิติจริงจากคอลเลกชันที่เกี่ยวข้องมาแนบเป็น context แทน (พลาดได้ ไม่ throw — แชทยังใช้ได้
  // ต่อแม้บาง query ล้มเหลว แค่บริบทจุดนั้นจะหายไป ไม่ใช่ทั้งหน้าพัง)
  async function loadBusinessContext() {
    try {
      const today = todayBangkok()
      const thisMonth = today.slice(0, 7)
      const [sales, vehicles, customers, debts, csat, staff, jobs, followups, bookings, testDrives] = await Promise.all([
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
        ...stockFacts(vehicles),
        ...testDriveFacts(testDrives, today),
      }
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
        const d = buildMyDay({ customers, followups, bookings, testDrives }, { today, mine })
        businessContext[`งานของ ${myName} วันนี้`] = myDayDigest(d)
        welcomeStats.todo = d.total
      }
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
        ${!isUser && i === messages.length - 1 && !waiting && Array.isArray(m.next) && m.next.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${m.next.map(q => `<button class="btn btn-secondary btn-xs cat-btn" data-q="${esc(q)}" style="border-radius:999px">💬 ${esc(q)}</button>`).join('')}</div>` : ''}
        ${!isUser && i === messages.length - 1 && !waiting && i > 0 && messages[i - 1]?.role === 'user' ? (() => {
          const acts = customerActionsFor(messages[i - 1].text, chatCustomers)
          const l = pageLinksFor(messages[i - 1].text)
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
      ['🔥', 'Hot Lead', welcomeStats.hot ? `ตอนนี้มี ${welcomeStats.hot} ราย ควรตามใครก่อน` : 'ลูกค้าที่สนใจมากตอนนี้', 'มี Hot Lead กี่ราย และควรตามใครก่อน?'],
    ]
    return `<div style="margin:auto;max-width:640px;width:100%;text-align:center;padding:16px 0">
      <div style="width:64px;height:64px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--success));display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:0 8px 30px color-mix(in srgb, var(--primary) 40%, transparent)">🤖</div>
      <div style="font-size:1.25rem;font-weight:800">สวัสดีค่ะ${name ? ` คุณ${esc(name)}` : ''} วันนี้ให้ LAMI ช่วยอะไรดีคะ</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 16px">LAMI ตอบจากข้อมูลจริงในระบบ ทั้งยอดขาย ลูกค้า งานค้างของคุณ และอื่นๆ</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;text-align:left">
        ${cards.map(([icon, title, sub, q]) => `<button class="card cat-btn" data-q="${esc(q)}" style="padding:14px;cursor:pointer;text-align:left;border:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;color:var(--text)">
          <span style="font-size:1.4rem">${icon}</span><span><b style="font-size:0.88rem">${title}</b><br><span style="font-size:0.74rem;color:var(--text-muted)">${sub}</span></span></button>`).join('')}
      </div>
      <div style="font-size:0.76rem;color:var(--text-3);margin-top:14px;line-height:1.6">⚡ สั่งงานได้ด้วย เช่น พิมพ์ <b>“นัดลองขับ${esc(chatCustomers.find(c => ['lead', 'pp'].includes(c.stage) && !c.isLost && c.firstName)?.firstName || 'สมชาย')}พรุ่งนี้บ่าย 2”</b> แล้วกดปุ่มใต้คำตอบ ระบบเปิดฟอร์มกรอกให้ครบ</div></div>`
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

        <!-- Category chips -->
        <div style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:8px 0;padding-bottom:8px;border-bottom:1px solid var(--border)">
          ${CATEGORIES.map(c => `<button class="btn btn-xs btn-secondary cat-btn" style="flex-shrink:0" data-q="${esc(c.q)}">${c.label}</button>`).join('')}
        </div>

        <!-- Chat messages -->
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:12px 0" id="chat-area">
          ${messages.some(m => m.role === 'user') || waiting ? messages.map((m, i) => msgHtml(m, i)).join('') : welcomeHtml()}
          ${waiting ? typingHtml() : ''}
        </div>

        <!-- Input bar -->
        <div style="padding:10px 0;border-top:1px solid var(--border);display:flex;gap:8px">
          <input class="input" id="chat-input" placeholder="พิมพ์คำถาม เช่น ยอดขายวันนี้ / Hot Lead / กำไรเดือนนี้..." style="flex:1" ${waiting?'disabled':''}>
          ${hasMic ? `<button class="btn btn-secondary" id="mic-btn" ${waiting?'disabled':''} title="พูดคำถาม (ภาษาไทย)" style="flex-shrink:0">🎤</button>` : ''}
          <button class="btn btn-primary" id="send-btn" ${waiting?'disabled':''} style="white-space:nowrap">📤 ส่ง</button>
        </div>
      </div>
    `

    const chatArea = document.getElementById('chat-area')
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight

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
      try {
        // ถามเรื่องรุ่น/ยี่ห้อรถ → แนบราคา/สเปคจริงจาก catalog (รวมคำถามก่อนหน้า 2 ข้อ เผื่อถามต่อ เช่น "แล้วรุ่น max ล่ะ")
        const recent = [text, ...messages.filter(m => m.role === 'user').slice(-3, -1).map(m => m.text)].join(' ')
        let cat = ''
        try { cat = catalogContext(recent, getVehicles()) } catch {}
        const raw = await askLami(text, history, { ...businessContext, ...(cat ? { 'ข้อมูลรถ': cat } : {}), 'รูปแบบท้ายคำตอบ': NEXT_Q_HINT })
        const { text: answer, next } = splitFollowups(raw)
        try { await createDoc('chat_ai_assistant', { role:'ai', text: answer, next, time:now(), uid }) } catch (e) {}
      } catch (err) {
        try { await createDoc('chat_ai_assistant', { role:'ai', text: '⚠️ เกิดข้อผิดพลาด: ' + err.message, time:now(), uid }) } catch (e) {}
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
      try { await navigator.clipboard.writeText(m.text); showToast('📋 คัดลอกแล้ว', 'success') } catch { showToast('คัดลอกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('send-btn')?.addEventListener('click', () => send(document.getElementById('chat-input')?.value || ''))
    document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value) } })
    container.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => send(b.dataset.q)))
    // เปิดหน้าที่เกี่ยวกับคำถาม (เช่น ถามเรื่องลองขับ → ไปหน้านัดทดลองขับ)
    container.querySelectorAll('.chat-go').forEach(b => b.addEventListener('click', () => navigate(b.dataset.path)))
    // ลงมือทำจากแชท: โทร / นัดลองขับ (เดาวันเวลาจากคำถาม) / เปิดข้อมูลลูกค้า
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
