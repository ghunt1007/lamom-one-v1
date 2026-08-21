import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, softDelete, seedDemoData, getSalesData } from '../../core/db.js'
import { confirmDialog } from '../../utils/modal.js'
import { askLami, isAiEnabled } from '../../utils/ai.js'
import { formatCurrency, todayBangkok, toDateStr } from '../../utils/format.js'
import { heuristicScore } from './LeadScoring.js'
import { companyScopeFilters } from '../../core/companyScope.js'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const CATEGORIES = [
  { label:'📊 ยอดขาย', q:'ยอดขายเดือนนี้เท่าไหร่?' },
  { label:'📦 สต็อก', q:'สต็อกรถเหลือกี่คัน?' },
  { label:'🔥 Hot Lead', q:'มี Hot Lead ไหม?' },
  { label:'💳 ค้างชำระ', q:'ใครค้างชำระบ้าง?' },
  { label:'⭐ CSAT', q:'CSAT เป็นยังไง?' },
  { label:'🔧 ช่าง', q:'ศูนย์บริการวันนี้เป็นยังไง?' },
  { label:'💰 กำไร', q:'กำไรเดือนนี้เท่าไหร่?' },
  { label:'👥 HR', q:'ข้อมูลพนักงานวันนี้?' },
]

function now() {
  return new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})
}

const GREETING = 'สวัสดีค่ะ! 🤖 ฉัน <strong>LAMI</strong> — ผู้ช่วย AI ของ LAMOM ONE<br>ถามได้ทุกอย่างเรื่องธุรกิจ: ยอดขาย สต็อก Lead กำไร ช่าง HR ประกัน ฯลฯ'

export default async function AiAssistantChatPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let messages = []
  let waiting = false
  let loading = true
  let businessContext = {}

  // (v1.0.428) หน้านี้มีปุ่มคำถามสำเร็จรูปตรงกับหัวข้อธุรกิจจริง (ยอดขาย/สต็อก/Hot Lead/ค้างชำระ/CSAT/ช่าง/
  // กำไร/HR) แต่เดิม askLami(text, history) ไม่เคยส่ง context เลย — Gemini จึงต้องเดา/กุตัวเลขทุกครั้งที่ตอบ
  // คำถามพวกนี้ ดึงสถิติจริงจากคอลเลกชันที่เกี่ยวข้องมาแนบเป็น context แทน (พลาดได้ ไม่ throw — แชทยังใช้ได้
  // ต่อแม้บาง query ล้มเหลว แค่บริบทจุดนั้นจะหายไป ไม่ใช่ทั้งหน้าพัง)
  async function loadBusinessContext() {
    try {
      const today = todayBangkok()
      const thisMonth = today.slice(0, 7)
      const [sales, vehicles, customers, debts, csat, staff, jobs] = await Promise.all([
        getSalesData().catch(() => []),
        listDocs('vehicles', [], 'arrivedAt', 'desc', 500).catch(() => []),
        listDocs('customers', [], 'createdAt', 'desc', 500).catch(() => []),
        listDocs('debts', companyScopeFilters(), 'dueDate', 'asc', 200).catch(() => []),
        listDocs('csat', [], 'createdAt', 'desc', 100).catch(() => []),
        listDocs('staff', companyScopeFilters(), 'createdAt', 'desc', 200).catch(() => []),
        listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
      ])
      const monthSales = sales.filter(s => (s.date || '').startsWith(thisMonth))
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
      businessContext = {
        'ยอดขายเดือนนี้': `${monthSales.length} คัน มูลค่ารวม ${formatCurrency(monthSales.reduce((s, x) => s + (x.salePrice || 0), 0))}`,
        'รถคงเหลือในสต็อก': `${activeStock} คัน`,
        'Hot Lead (คะแนน 80 ขึ้นไป)': `${hotLeads} ราย จาก Lead ทั้งหมด ${leads.length} ราย`,
        'ยอดค้างชำระ': openDebts.length ? `${openDebts.length} รายการ รวม ${formatCurrency(overdueAmount)}` : 'ไม่มีรายการค้างชำระ',
        'คะแนนความพึงพอใจลูกค้า (NPS เฉลี่ยล่าสุด)': avgNps !== null ? `${avgNps}/10 จาก ${npsScores.length} รายการ` : 'ยังไม่มีข้อมูลการประเมิน',
        'งานซ่อม/ศูนย์บริการวันนี้': `รับเข้า ${todayJobs.length} งาน (เสร็จ/ส่งมอบแล้ว ${doneToday} งาน)`,
        'พนักงานที่ยังทำงานอยู่': `${activeStaff} คน`,
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

  function msgHtml(m) {
    const isUser = m.role === 'user'
    // ข้อความจากผู้ใช้เป็น free-text ต้อง escape ก่อน render เสมอ (กัน stored XSS)
    // คำตอบ AI ตอนนี้มาจาก askLami() จริง (Gemini ผ่าน proxy) ไม่ใช่ CANNED hardcode แล้ว — เป็นข้อความ
    // ธรรมดา (ไม่มี <strong>/HTML ที่ตั้งใจ) จึง escape เหมือนกับข้อความผู้ใช้เพื่อกัน XSS จาก AI ตอบ raw HTML
    // กลับมาโดยไม่ตั้งใจ ยกเว้น GREETING ที่ยัง hardcode ไว้ในไฟล์นี้เองเท่านั้น
    const text = (isUser || m.text !== GREETING) ? esc(m.text) : m.text
    return `<div style="display:flex;${isUser?'justify-content:flex-end':'align-items:flex-start;gap:8px'}">
      ${!isUser ? `<div style="width:30px;height:30px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>` : ''}
      <div>
        <div style="max-width:74vw;padding:10px 14px;border-radius:${isUser?'16px 16px 4px 16px':'4px 16px 16px 16px'};background:${isUser?'var(--primary)':'var(--surface-2)'};color:${isUser?'white':'var(--text)'};font-size:0.84rem;line-height:1.65">${text}</div>
        <div style="font-size:0.66rem;color:var(--text-muted);margin-top:3px;${isUser?'text-align:right':''}">${esc(m.time)}</div>
      </div>
    </div>`
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

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <style>@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}</style>
      <div class="page-content animate-slide" style="display:flex;flex-direction:column;height:calc(100vh - 56px);padding-bottom:0">
        <div class="page-header" style="padding-bottom:8px;margin-bottom:0">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.3rem">🤖</div>
            <div>
              <div class="page-title" style="margin:0">LAMI — AI Business Assistant</div>
              <div style="font-size:0.72rem;color:var(--success);font-weight:600">${isAiEnabled() ? '● พร้อมใช้งาน · ขับเคลื่อนด้วย Gemini AI จริง' : '● Demo Mode · ล็อกอินด้วยบัญชีจริงเพื่อเปิดใช้งาน AI จริง'}</div>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm" id="clear-chat">🗑 ล้างแชท</button>
          </div>
        </div>

        <!-- Category chips -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;padding-bottom:8px;border-bottom:1px solid var(--border)">
          ${CATEGORIES.map(c => `<button class="btn btn-xs btn-secondary cat-btn" data-q="${c.q}">${c.label}</button>`).join('')}
        </div>

        <!-- Chat messages -->
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:12px 0" id="chat-area">
          ${messages.map(msgHtml).join('')}
          ${waiting ? typingHtml() : ''}
        </div>

        <!-- Input bar -->
        <div style="padding:10px 0;border-top:1px solid var(--border);display:flex;gap:8px">
          <input class="input" id="chat-input" placeholder="พิมพ์คำถาม เช่น ยอดขายวันนี้ / Hot Lead / กำไรเดือนนี้..." style="flex:1" ${waiting?'disabled':''}>
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
        const answer = await askLami(text, history, businessContext)
        try { await createDoc('chat_ai_assistant', { role:'ai', text: answer, time:now(), uid }) } catch (e) {}
      } catch (err) {
        try { await createDoc('chat_ai_assistant', { role:'ai', text: '⚠️ เกิดข้อผิดพลาด: ' + err.message, time:now(), uid }) } catch (e) {}
      } finally {
        waiting = false
        await loadData()
      }
    }

    document.getElementById('send-btn')?.addEventListener('click', () => send(document.getElementById('chat-input')?.value || ''))
    document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value) } })
    container.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => send(b.dataset.q)))
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
}
