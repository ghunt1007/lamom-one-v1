/**
 * LAMI Brain — ศูนย์บัญชาการ AI Officer LAMI
 * Route: /ai/lami
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { askLami, AI_ENABLED } from '../../utils/ai.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

const LAMI_SKILLS = [
  { id: 'lead_scoring',  label: 'Lead Scoring', icon: '🎯', desc: 'วิเคราะห์และให้คะแนน Lead ตาม Behavior', status: 'active', accuracy: 87 },
  { id: 'price_suggest', label: 'Price Suggest', icon: '💰', desc: 'แนะนำราคาและส่วนลดที่เหมาะสม', status: 'active', accuracy: 91 },
  { id: 'follow_up',     label: 'Follow-up AI', icon: '📞', desc: 'กำหนดเวลาและช่องทาง Follow-up ที่ดีที่สุด', status: 'active', accuracy: 83 },
  { id: 'complaint',     label: 'Complaint AI', icon: '😤', desc: 'วิเคราะห์ความรุนแรงและแนะนำการจัดการ', status: 'active', accuracy: 89 },
  { id: 'forecast',      label: 'Sales Forecast', icon: '📈', desc: 'พยากรณ์ยอดขายรายสัปดาห์/เดือน', status: 'active', accuracy: 78 },
  { id: 'inventory',     label: 'Inventory Opt', icon: '📦', desc: 'แนะนำการสั่งสต็อกและป้องกันขาดสต็อก', status: 'learning', accuracy: 72 },
  { id: 'customer_seg',  label: 'Customer Seg', icon: '👥', desc: 'จัดกลุ่มลูกค้าและแนะนำ Campaign', status: 'active', accuracy: 85 },
  { id: 'ev_diag',       label: 'EV Diagnostics', icon: '⚡', desc: 'ช่วยวิเคราะห์ Fault Code และแนะนำการซ่อม', status: 'learning', accuracy: 68 },
]

function addMins(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const LAMI_INSIGHTS = [
  { id: 'I001', type: 'lead',      icon: '🎯', priority: 'high',   time: addMins(10), message: 'Lead วิชัย มีโชค มีโอกาสปิดสูง 87% — แนะนำโทรหาภายใน 2 ชั่วโมง', action: 'ดู Lead' },
  { id: 'I002', type: 'stock',     icon: '📦', priority: 'high',   time: addMins(25), message: 'BYD Seal AWD เหลือ 2 คัน — มี Lead สนใจ 5 ราย แนะนำสั่งเพิ่ม 5 คัน', action: 'ดูสต็อก' },
  { id: 'I003', type: 'service',   icon: '🔧', priority: 'medium', time: addMins(40), message: 'Job Card 3 ใบค้างนาน > 5 วัน — ควรตรวจสอบและแจ้งลูกค้า', action: 'ดู Job Card' },
  { id: 'I004', type: 'forecast',  icon: '📈', priority: 'low',    time: addMins(60), message: 'คาดการณ์ยอดขายเดือนนี้: 18 คัน (+12% vs เดือนก่อน)', action: 'ดู Forecast' },
  { id: 'I005', type: 'complaint', icon: '⚠️', priority: 'high',   time: addMins(90), message: 'ลูกค้า ชัยวัฒน์ ร้องเรียนเรื่องงานซ่อม — ต้องตอบสนองภายใน 24 ชม.', action: 'ดู Complaint' },
]

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

  let chatHistory = []
  let activeTab = 'chat'
  let isTyping = false
  let loading = true
  const aiMode = AI_ENABLED ? '🟢 Gemini AI' : '🟡 Demo Mode'

  async function loadData() {
    loading = true
    try {
      chatHistory = await listDocs('chat_lami_brain', [], 'createdAt', 'asc', 500)
      if (!chatHistory.length) {
        await createDoc('chat_lami_brain', { role:'lami', text: GREETING, time: new Date().toISOString() })
        chatHistory = await listDocs('chat_lami_brain', [], 'createdAt', 'asc', 500)
      }
    } catch (e) { chatHistory = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const totalInsights = LAMI_INSIGHTS.length
    const highPriority = LAMI_INSIGHTS.filter(i => i.priority === 'high').length
    const activeSkills = LAMI_SKILLS.filter(s => s.status === 'active').length

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
          ${kpi('⚡ Skills ที่ Active', activeSkills, 'success')}
          ${kpi('📊 ความแม่นยำเฉลี่ย', Math.round(LAMI_SKILLS.filter(s=>s.status==='active').reduce((a,s)=>a+s.accuracy,0)/activeSkills) + '%', 'primary')}
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
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${LAMI_INSIGHTS.map(ins => `
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
                <button class="btn btn-xs btn-secondary">${ins.action}</button>
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
          <div class="card" style="padding:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <div style="font-size:1.4rem">${s.icon}</div>
              <span class="badge badge-${s.status==='active'?'success':'warning'}">${s.status==='active'?'Active':'Learning'}</span>
            </div>
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">${s.label}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">${s.desc}</div>
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
              <span style="color:var(--text-muted)">ความแม่นยำ</span>
              <span style="font-weight:700;color:${s.accuracy>=85?'var(--success)':s.accuracy>=70?'var(--warning)':'var(--danger)'}">${s.accuracy}%</span>
            </div>
            <div style="background:var(--surface-2);border-radius:3px;height:6px">
              <div style="width:${s.accuracy}%;background:${s.accuracy>=85?'var(--success)':s.accuracy>=70?'var(--warning)':'var(--danger)'};height:6px;border-radius:3px"></div>
            </div>
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
      const reply = await askLami(text, chatHistory)
      try { await createDoc('chat_lami_brain', { role: 'lami', text: reply, time: new Date().toISOString() }) } catch (e) {}
    } catch (err) {
      try { await createDoc('chat_lami_brain', { role: 'lami', text: '⚠️ เกิดข้อผิดพลาด: ' + err.message, time: new Date().toISOString() }) } catch (e) {}
    } finally {
      isTyping = false
      await loadData()
    }
  }

  await loadData()
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
