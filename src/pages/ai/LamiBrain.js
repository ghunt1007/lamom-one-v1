/**
 * LAMI Brain — ศูนย์บัญชาการ AI Officer LAMI
 * Route: /ai/lami
 */
import { timeAgo, todayBangkok, toDate, toDateStr, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { askLami, isAiEnabled } from '../../utils/ai.js'
import { listDocs, createDoc, seedDemoData, getSalesData } from '../../core/db.js'
import { heuristicScore } from './LeadScoring.js'
import { companyScopeFilters } from '../../core/companyScope.js'

// (v1.0.341) เดิม status/accuracy ต่อ Skill เป็นตัวเลข hardcode ล้วน ไม่มีระบบวัดความแม่นยำจริงในระบบเลย
// (ต้องมี ground-truth ผลจริงเทียบคำแนะนำ AI ถึงจะวัดได้ — งานสร้างระบบวัดผลใหม่ทั้งหมด ไม่ใช่ scope การแก้
// บัคเดียวนี้) แก้ตาม pattern เดียวกับ IntegrationSettings.js — เปลี่ยนเป็นทางลัดที่ซื่อสัตย์ไปหน้าฟีเจอร์จริง
// ที่มีอยู่แล้วในระบบแทนเลขปลอม
const LAMI_SKILLS = [
  { id: 'lead_scoring',  label: 'Lead Scoring', icon: '🎯', desc: 'วิเคราะห์และให้คะแนน Lead จากข้อมูลจริง', nav: '/ai/lead-scoring' },
  { id: 'price_suggest', label: 'Price Suggest', icon: '💰', desc: 'แนะนำราคาจากยอดขาย/สต็อกจริง', nav: '/ai/pricing' },
  { id: 'follow_up',     label: 'Follow-up', icon: '📞', desc: 'ติดตามลูกค้าที่ต้องโทร/นัดต่อ', nav: '/crm/followup' },
  { id: 'complaint',     label: 'Complaint', icon: '😤', desc: 'บันทึกและจัดการเรื่องร้องเรียนลูกค้า', nav: '/crm/complaints' },
  { id: 'forecast',      label: 'Sales Forecast', icon: '📈', desc: 'พยากรณ์ยอดขายจากข้อมูลขายจริง', nav: '/analytics/forecast' },
  { id: 'inventory',     label: 'Inventory', icon: '📦', desc: 'ดูสต็อกรถและวางแผนสั่งเพิ่ม', nav: '/dms/stock' },
  { id: 'customer_seg',  label: 'Customer Seg', icon: '👥', desc: 'จัดกลุ่มลูกค้าจากข้อมูลจริงเพื่อทำ Campaign', nav: '/crm/segments' },
  { id: 'ev_diag',       label: 'EV Diagnostics', icon: '⚡', desc: 'ช่วยวิเคราะห์ปัญหารถ EV และแนะนำการซ่อม', nav: '/service/ev-diagnostic' },
]

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

// (v1.0.341) เดิม LAMI_INSIGHTS 5 ข้อความ hardcode ตายตัว (มีชื่อลูกค้าสมมติ "วิชัย มีโชค"/"ชัยวัฒน์" ปนอยู่
// ด้วย) ไม่เคยตรวจข้อมูลจริงเลยแม้แต่จุดเดียว — แก้ให้คำนวณจริงจาก Lead/สต็อกรถ/Job Card/ยอดขาย/ร้องเรียนจริง
function computeInsights({ leads, vehicleModels, jobCards, complaintsList, salesRows }) {
  const insights = []
  const now = new Date()
  // d มักเป็น Firestore serverTimestamp() object (เช่น j.createdAt) — new Date(d) ตรงๆ ได้ Invalid Date เงียบๆ
  // (NaN) เทียบกับตัวเลขได้ false เสมอ ใช้ toDate() แทนเพื่อรองรับทั้ง Timestamp/string/Date ให้ถูกต้อง
  const daysSince = d => { const dt = toDate(d); return dt ? Math.floor((now.getTime() - dt.getTime()) / 86400000) : -Infinity }

  const hottest = leads.map(l => ({ ...l, ...heuristicScore(l) })).sort((a, b) => b.score - a.score).find(l => l.score >= 80)
  if (hottest) {
    insights.push({ icon: '🎯', priority: 'high', time: hottest.createdAt || now.toISOString(), nav: '/ai/lead-scoring', action: 'ดู Lead',
      message: `Lead ${hottest.custName || 'ไม่ระบุชื่อ'} มีโอกาสปิดสูง ${hottest.score}% — แนะนำติดต่อโดยเร็ว` })
  }

  let lowStockPick = null
  for (const m of vehicleModels) {
    const stock = m.stock || 0
    if (stock > 2) continue
    const modelKey = `${m.brand || ''} ${m.model || ''}`.toLowerCase().trim()
    const interested = leads.filter(l => {
      if (!l.interestedModel) return false
      const im = String(l.interestedModel).toLowerCase().trim()
      return modelKey.includes(im) || im.includes(String(m.model || '').toLowerCase().trim())
    }).length
    if (interested > 0 && (!lowStockPick || interested > lowStockPick.interested)) lowStockPick = { m, stock, interested }
  }
  if (lowStockPick) {
    insights.push({ icon: '📦', priority: 'high', time: now.toISOString(), nav: '/dms/stock', action: 'ดูสต็อก',
      message: `${lowStockPick.m.brand} ${lowStockPick.m.model} เหลือ ${lowStockPick.stock} คัน — มี Lead สนใจ ${lowStockPick.interested} ราย แนะนำสั่งเพิ่ม` })
  }

  const overdueJobs = jobCards.filter(j => !['done', 'delivered'].includes(j.status) && j.createdAt && daysSince(j.createdAt) > 5)
  if (overdueJobs.length) {
    insights.push({ icon: '🔧', priority: 'medium', time: overdueJobs[0].createdAt, nav: '/service/jobs', action: 'ดู Job Card',
      message: `Job Card ${overdueJobs.length} ใบค้างนาน > 5 วัน — ควรตรวจสอบและแจ้งลูกค้า` })
  }

  const thisMonthStr = now.toISOString().slice(0, 7)
  const lastMonthStr = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7)
  const thisMonthCount = salesRows.filter(s => (s.date || '').startsWith(thisMonthStr)).length
  const lastMonthCount = salesRows.filter(s => (s.date || '').startsWith(lastMonthStr)).length
  if (thisMonthCount > 0 || lastMonthCount > 0) {
    const growthTxt = lastMonthCount > 0
      ? `(${thisMonthCount >= lastMonthCount ? '+' : ''}${Math.round((thisMonthCount - lastMonthCount) / lastMonthCount * 100)}% vs เดือนก่อน)`
      : '(ยังไม่มีข้อมูลเดือนก่อนเพื่อเทียบ)'
    insights.push({ icon: '📈', priority: 'low', time: now.toISOString(), nav: '/analytics/forecast', action: 'ดู Forecast',
      message: `ยอดขายเดือนนี้ (ณ วันนี้): ${thisMonthCount} คัน ${growthTxt}` })
  }

  const urgentComplaints = complaintsList
    .filter(c => ['open', 'investigating', 'escalated'].includes(c.status) && (c.priority === 'critical' || c.priority === 'high'))
    .sort((a, b) => new Date(a.openDate || 0) - new Date(b.openDate || 0))
  if (urgentComplaints.length) {
    const c = urgentComplaints[0]
    insights.push({ icon: '⚠️', priority: 'high', time: c.openDate || now.toISOString(), nav: '/crm/complaints', action: 'ดู Complaint',
      message: `ลูกค้า ${c.custName || 'ไม่ระบุชื่อ'} ร้องเรียนเรื่อง ${c.subject || 'ไม่ระบุ'} — ต้องตอบสนองด่วน${urgentComplaints.length > 1 ? ` (มีทั้งหมด ${urgentComplaints.length} เคส)` : ''}` })
  }

  return insights.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

const GREETING = 'สวัสดีครับ! ผม LAMI ที่ปรึกษา AI ของ LAMOM ONE พร้อมช่วยเหลือด้านการขาย การบริการ และการวิเคราะห์ข้อมูลครับ'

const QUICK_QUESTIONS = [
  'Lead ร้อนวันนี้มีใครบ้าง?',
  'สต็อกรถรุ่นไหนเหลือน้อย?',
  'ยอดขายเดือนนี้เป็นยังไง?',
  'มีลูกค้าต้องติดตามวันนี้ไหม?',
  'Job Card ค้างนานสุดคือรายไหน?',
]

export default async function LamiBrainPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  // (v1.0.341) เดิมปุ่ม action ในแท็บ Insights และการ์ดในแท็บ Skills ไม่มี data-nav/listener ผูกไว้เลย
  // (import navigate ก็ไม่มีด้วยซ้ำ) กดแล้วไม่เกิดอะไรขึ้นจริง — เพิ่ม delegation ครั้งเดียวตรงนี้ (ไม่ใส่ใน
  // renderPage() เพราะถูกเรียกซ้ำหลายรอบ ถ้าผูกที่ container ทุกรอบจะเป็น listener ซ้อนกันเรื่อยๆ)
  container.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) navigate(nav.dataset.nav)
  })

  let chatHistory = []
  let insights = []
  let businessContext = {}
  let activeTab = 'chat'
  let isTyping = false
  let loading = true
  const aiMode = isAiEnabled() ? '🟢 Gemini AI' : '🟡 Demo Mode'

  async function loadChat() {
    try {
      chatHistory = await listDocs('chat_lami_brain', [], 'createdAt', 'asc', 500)
      if (!chatHistory.length) {
        await createDoc('chat_lami_brain', { role:'lami', text: GREETING, time: new Date().toISOString() })
        chatHistory = await listDocs('chat_lami_brain', [], 'createdAt', 'asc', 500)
      }
    } catch (e) { chatHistory = [] }
  }

  async function loadInsights() {
    try {
      const [leadsRaw, vehicleModels, jobCards, complaintsList, salesRows, debts, csat, staff] = await Promise.all([
        listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
        listDocs('vehicle_models', [], 'brand', 'asc', 200).catch(() => []),
        listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
        listDocs('complaints', companyScopeFilters(), 'createdAt', 'desc', 200).catch(() => []),
        getSalesData().catch(() => []),
        listDocs('debts', companyScopeFilters(), 'dueDate', 'asc', 200).catch(() => []),
        listDocs('csat', [], 'createdAt', 'desc', 100).catch(() => []),
        listDocs('staff', companyScopeFilters(), 'createdAt', 'desc', 200).catch(() => []),
      ])
      const leads = leadsRaw.filter(c => !c.deleted && (c.stage === 'lead' || c.stage === 'pp') && c.status !== 'lost')
      insights = computeInsights({ leads, vehicleModels, jobCards: jobCards.filter(j => !j.deleted), complaintsList, salesRows })
      businessContext = buildBusinessContext({ leads, vehicleModels, jobCards, salesRows, debts, csat, staff })
    } catch (e) { insights = [] }
  }

  // (v1.0.428) เดิม askLami(text, chatHistory) ในหน้าแชทของ LAMI Brain เองก็ไม่เคยส่ง context เลยเหมือนกับ
  // AiAssistantChat.js — ใช้ข้อมูลที่ loadInsights() ดึงมาแล้ว (ไม่ต้อง query ซ้ำ) มาแปลงเป็นบริบทให้ askLami()
  function buildBusinessContext({ leads, vehicleModels, jobCards, salesRows, debts, csat, staff }) {
    try {
      const today = todayBangkok()
      const thisMonth = today.slice(0, 7)
      const monthSales = salesRows.filter(s => (s.date || '').startsWith(thisMonth))
      const activeStock = vehicleModels.reduce((sum, m) => sum + (m.stock || 0), 0)
      const hotLeads = leads.filter(c => heuristicScore(c).score >= 80).length
      const openDebts = debts.filter(d => !d.deleted && d.status !== 'paid')
      const overdueAmount = openDebts.reduce((sum, d) => sum + (d.amount || 0), 0)
      const npsScores = csat.filter(c => !c.deleted && typeof c.nps === 'number').map(c => c.nps)
      const avgNps = npsScores.length ? Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length * 10) / 10 : null
      const activeStaff = staff.filter(s => !s.deleted).length
      const todayJobs = jobCards.filter(j => !j.deleted && toDateStr(j.createdAt) === today)
      const doneToday = todayJobs.filter(j => j.status === 'done' || j.status === 'delivered').length
      return {
        'ยอดขายเดือนนี้': `${monthSales.length} คัน มูลค่ารวม ${formatCurrency(monthSales.reduce((s, x) => s + (x.salePrice || 0), 0))}`,
        'รถคงเหลือในสต็อก (รวมทุกรุ่น)': `${activeStock} คัน`,
        'Hot Lead (คะแนน 80 ขึ้นไป)': `${hotLeads} ราย จาก Lead ทั้งหมด ${leads.length} ราย`,
        'ยอดค้างชำระ': openDebts.length ? `${openDebts.length} รายการ รวม ${formatCurrency(overdueAmount)}` : 'ไม่มีรายการค้างชำระ',
        'คะแนนความพึงพอใจลูกค้า (NPS เฉลี่ยล่าสุด)': avgNps !== null ? `${avgNps}/10 จาก ${npsScores.length} รายการ` : 'ยังไม่มีข้อมูลการประเมิน',
        'งานซ่อม/ศูนย์บริการวันนี้': `รับเข้า ${todayJobs.length} งาน (เสร็จ/ส่งมอบแล้ว ${doneToday} งาน)`,
        'พนักงานที่ยังทำงานอยู่': `${activeStaff} คน`,
      }
    } catch (e) { return {} }
  }

  async function loadAll() {
    loading = true
    await Promise.all([loadChat(), loadInsights()])
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const totalInsights = insights.length
    const highPriority = insights.filter(i => i.priority === 'high').length
    // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
    // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
    const todayStr = todayBangkok()
    const chatToday = chatHistory.filter(m => (m.time || '').slice(0, 10) === todayStr).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:1.6rem">🤖</div>
            <div>
              <div class="page-title">LAMI — AI Officer</div>
              <div class="page-subtitle" style="color:var(--success)">● ออนไลน์ · ${aiMode} · ตอบสนองเฉลี่ย &lt; 1 วินาที</div>
            </div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💡 Insights วันนี้', totalInsights, 'primary')}
          ${kpi('🚨 ต้องการดูแล', highPriority, highPriority > 0 ? 'danger' : 'secondary')}
          ${kpi('⚡ Skills พร้อมใช้', LAMI_SKILLS.length, 'success')}
          ${kpi('💬 สนทนาวันนี้', chatToday, 'primary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
          ${['chat', 'insights', 'skills'].map(tab => `<button class="btn btn-xs ${activeTab===tab?'btn-primary':'btn-ghost'} tab-btn" data-tab="${tab}" style="border-radius:var(--radius) var(--radius) 0 0">${tab==='chat'?'💬 สนทนา':tab==='insights'?'💡 Insights':'⚡ Skills'}</button>`).join('')}
        </div>

        ${activeTab === 'chat' ? renderChat() : activeTab === 'insights' ? renderInsights() : renderSkills()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderPage() }))

    if (activeTab === 'chat') {
      document.getElementById('chat-send-btn')?.addEventListener('click', sendMessage)
      document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } })
      container.querySelectorAll('.quick-q').forEach(b => b.addEventListener('click', () => {
        const inp = document.getElementById('chat-input')
        if (inp) { inp.value = b.textContent; inp.focus() }
        sendMessage()
      }))
      // Scroll chat to bottom
      const chatEl = document.getElementById('chat-messages')
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight
    }
  }

  function renderChat() {
    return `
      <div style="display:grid;grid-template-columns:1fr 280px;gap:12px">
        <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:500px">
          <div id="chat-messages" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px">
            ${chatHistory.map(m => renderBubble(m)).join('')}
            ${isTyping ? `<div style="display:flex;justify-content:flex-start"><div style="padding:10px 14px;border-radius:var(--radius) var(--radius) var(--radius) 4px;background:var(--surface-2);font-size:0.85rem"><span style="font-size:0.72rem;font-weight:700;color:var(--primary);display:block;margin-bottom:3px">🤖 LAMI</span><span style="color:var(--text-muted)">⏳ กำลังคิด...</span></div></div>` : ''}
          </div>
          <div style="padding:12px;border-top:1px solid var(--border);display:flex;gap:8px">
            <input class="input" id="chat-input" placeholder="พิมพ์คำถาม หรือสั่งงาน LAMI..." style="flex:1">
            <button class="btn btn-primary" id="chat-send-btn">ส่ง</button>
          </div>
        </div>

        <div>
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px;color:var(--text-muted)">💡 คำถามแนะนำ</div>
          ${QUICK_QUESTIONS.map(q => `<button class="btn btn-secondary quick-q" style="width:100%;text-align:left;margin-bottom:6px;font-size:0.78rem;padding:8px 10px">${q}</button>`).join('')}
        </div>
      </div>
    `
  }

  function renderInsights() {
    const pColors = { high: 'danger', medium: 'warning', low: 'secondary' }
    if (!insights.length) {
      return `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">ไม่มีเรื่องด่วนตอนนี้</div><div class="empty-desc">ไม่พบ Lead ร้อน/สต็อกใกล้หมด/Job Card ค้าง/เรื่องร้องเรียนเร่งด่วนจากข้อมูลจริงในระบบ</div></div>`
    }
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${insights.map(ins => `
          <div class="card" style="padding:14px;border-left:3px solid var(--${pColors[ins.priority]})">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="display:flex;gap:12px;align-items:flex-start">
                <div style="font-size:1.5rem">${ins.icon}</div>
                <div>
                  <div style="font-size:0.87rem;line-height:1.5">${escHtml(ins.message)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${timeAgo(ins.time)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <span class="badge badge-${pColors[ins.priority]}" style="font-size:0.65rem">${ins.priority === 'high' ? '🔴 สูง' : ins.priority === 'medium' ? '🟡 กลาง' : '🟢 ต่ำ'}</span>
                <button class="btn btn-xs btn-secondary" data-nav="${ins.nav}">${ins.action}</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  function renderSkills() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${LAMI_SKILLS.map(s => `
          <div class="card card-lift" data-nav="${s.nav}" style="padding:14px;cursor:pointer">
            <div style="font-size:1.4rem;margin-bottom:8px">${s.icon}</div>
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">${s.label}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">${s.desc}</div>
            <div style="font-size:0.75rem;color:var(--primary);font-weight:600">เปิดใช้งาน →</div>
          </div>
        `).join('')}
      </div>
    `
  }

  async function sendMessage() {
    const inp = document.getElementById('chat-input')
    const text = inp?.value?.trim()
    if (!text || isTyping) return
    inp.value = ''
    try { await createDoc('chat_lami_brain', { role: 'user', text, time: new Date().toISOString() }) } catch (e) {}
    chatHistory.push({ role: 'user', text, time: new Date().toISOString() })
    isTyping = true
    renderPage()
    try {
      const reply = await askLami(text, chatHistory, businessContext)
      try { await createDoc('chat_lami_brain', { role: 'lami', text: reply, time: new Date().toISOString() }) } catch (e) {}
    } catch (err) {
      try { await createDoc('chat_lami_brain', { role: 'lami', text: '⚠️ เกิดข้อผิดพลาด: ' + err.message, time: new Date().toISOString() }) } catch (e) {}
    } finally {
      isTyping = false
      await loadChat()
      if (container.__routerGen === myGen) renderPage()
    }
  }

  await loadAll()
}

function renderBubble(m) {
  const isUser = m.role === 'user'
  return `<div style="display:flex;${isUser ? 'justify-content:flex-end' : 'justify-content:flex-start'}">
    <div style="max-width:72%;padding:10px 14px;border-radius:${isUser ? 'var(--radius) var(--radius) 4px var(--radius)' : 'var(--radius) var(--radius) var(--radius) 4px'};background:${isUser ? 'var(--primary)' : 'var(--surface-2)'};font-size:0.85rem;line-height:1.5;white-space:pre-wrap;word-break:break-word">
      ${!isUser ? '<span style="font-size:0.72rem;font-weight:700;color:var(--primary);display:block;margin-bottom:3px">🤖 LAMI</span>' : ''}
      ${escHtml(m.text)}
      <div style="font-size:0.65rem;opacity:0.6;margin-top:4px;text-align:right">${timeAgo(m.time)}</div>
    </div>
  </div>`
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
