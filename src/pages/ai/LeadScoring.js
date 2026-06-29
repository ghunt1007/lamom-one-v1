/**
 * AI Lead Scoring — จัดอันดับ Lead อัตโนมัติ
 * Route: /ai/lead-scoring
 */
import { formatCurrency, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { navigate } from '../../core/router.js'

function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const SCORE_FACTORS = [
  { factor: 'เคย Test Drive', weight: 25 },
  { factor: 'ขอใบเสนอราคา', weight: 20 },
  { factor: 'มาโชว์รูม 2+ ครั้ง', weight: 15 },
  { factor: 'ตอบแชทเร็ว (<1 ชม.)', weight: 10 },
  { factor: 'สอบถามไฟแนนซ์', weight: 15 },
  { factor: 'มีรถเทิร์น', weight: 10 },
  { factor: 'เปิดอ่านอีเมล/LINE', weight: 5 },
]

const DEMO_LEADS = [
  { id: 'L001', name: 'ประพันธ์ มั่งมี', phone: '081-111', model: 'BYD Seal AWD', score: 92, signals: ['เคย Test Drive','ขอใบเสนอราคา','สอบถามไฟแนนซ์','มาโชว์รูม 2+ ครั้ง'], lastActive: addHours(2), staff: 'วิชัย ยอดขาย', value: 1699000 },
  { id: 'L002', name: 'สุภาพร ดีพร้อม', phone: '082-222', model: 'BYD Atto 3', score: 78, signals: ['ขอใบเสนอราคา','มีรถเทิร์น','ตอบแชทเร็ว (<1 ชม.)'], lastActive: addHours(5), staff: 'สุดา มาดี', value: 1099000 },
  { id: 'L003', name: 'อนุชา รักรถ', phone: '083-333', model: 'BYD Dolphin', score: 65, signals: ['เคย Test Drive','เปิดอ่านอีเมล/LINE'], lastActive: addHours(24), staff: 'ธนา เก่ง', value: 899000 },
  { id: 'L004', name: 'กมลา ใจเย็น', phone: '084-444', model: 'MG4 Electric', score: 45, signals: ['เปิดอ่านอีเมล/LINE','ตอบแชทเร็ว (<1 ชม.)'], lastActive: addHours(48), staff: 'วิชัย ยอดขาย', value: 949000 },
  { id: 'L005', name: 'ศักดิ์ชัย รอดู', phone: '085-555', model: 'ยังไม่แน่ใจ', score: 22, signals: ['เปิดอ่านอีเมล/LINE'], lastActive: addHours(120), staff: '—', value: 0 },
]

function tier(score) {
  if (score >= 80) return { label: 'Hot 🔥', color: 'danger', action: 'โทรปิดดีลวันนี้!' }
  if (score >= 60) return { label: 'Warm ☀️', color: 'warning', action: 'นัด Test Drive / ส่งข้อเสนอ' }
  if (score >= 40) return { label: 'Cool 🌤', color: 'primary', action: 'ส่งข้อมูล + ติดตามสัปดาห์นี้' }
  return { label: 'Cold ❄️', color: 'secondary', action: 'ใส่ Nurture campaign' }
}

export default async function LeadScoringPage(container) {
  let leads = DEMO_LEADS.map(l => ({ ...l, signals: [...l.signals] }))

  function renderPage() {
    const sorted = [...leads].sort((a, b) => b.score - a.score)
    const hot = leads.filter(l => l.score >= 80).length
    const pipeline = leads.filter(l => l.score >= 60).reduce((a, l) => a + l.value, 0)
    const avgScore = Math.round(leads.reduce((a, l) => a + l.score, 0) / leads.length)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 AI Lead Scoring</div>
            <div class="page-subtitle">จัดอันดับ Lead อัตโนมัติ — โฟกัสที่คนพร้อมซื้อ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="factors-btn">⚙️ เกณฑ์คะแนน</button>
            <button class="btn btn-primary" id="rescore-btn">🔄 คำนวณใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔥 Hot Leads', hot, hot > 0 ? 'danger' : 'secondary')}
          ${kpi('💰 Pipeline (Warm+)', formatCurrency(pipeline), 'success')}
          ${kpi('📊 คะแนนเฉลี่ย', avgScore, avgScore >= 60 ? 'success' : 'warning')}
          ${kpi('🧲 Leads ทั้งหมด', leads.length, 'primary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${sorted.map((l, i) => {
            const t = tier(l.score)
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${t.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="display:flex;gap:10px;align-items:center">
                  <div style="width:46px;height:46px;border-radius:50%;background:var(--${t.color})22;border:2px solid var(--${t.color});display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.95rem;color:var(--${t.color})">${l.score}</div>
                  <div>
                    <div style="font-weight:700;font-size:0.88rem">${i===0?'👑 ':''}${l.name} <span style="font-size:0.7rem;color:var(--text-muted)">📞 ${l.phone}</span></div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${l.model}${l.value>0?' · '+formatCurrency(l.value):''} · 👤 ${l.staff} · active ${timeAgo(l.lastActive)}</div>
                  </div>
                </div>
                <span class="badge badge-${t.color}" style="font-size:0.65rem">${t.label}</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
                ${l.signals.map(s => `<span style="font-size:0.62rem;background:var(--surface-2);padding:2px 7px;border-radius:10px;color:var(--text-muted)">✓ ${s}</span>`).join('')}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:0.73rem;color:var(--${t.color})">🤖 แนะนำ: <strong>${t.action}</strong></div>
                <button class="btn btn-xs btn-primary action-btn" data-id="${l.id}">📞 ดำเนินการ</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('rescore-btn')?.addEventListener('click', () => {
      leads.forEach(l => { l.score = Math.min(100, Math.max(5, l.score + Math.floor(Math.random() * 11) - 5)) })
      showToast('🔄 คำนวณคะแนนใหม่จากพฤติกรรมล่าสุดแล้ว', 'success'); renderPage()
    })
    document.getElementById('factors-btn')?.addEventListener('click', () => {
      openModal({
        title: '⚙️ เกณฑ์การให้คะแนน',
        size: 'sm',
        body: `<div style="display:flex;flex-direction:column;gap:6px">
          ${SCORE_FACTORS.map(f => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;padding:6px 0;border-bottom:1px solid var(--border)">
              <span>${f.factor}</span>
              <span style="font-weight:700;color:var(--primary)">+${f.weight}</span>
            </div>
          `).join('')}
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">คะแนนเต็ม 100 — ลดลงอัตโนมัติเมื่อ Lead ไม่ active เกิน 7 วัน</p>
        </div>`,
        onConfirm() {}
      })
    })
    container.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', () => {
      const l = leads.find(x => x.id === b.dataset.id)
      if (l) showToast(`📞 เปิด task ติดตาม ${l.name} ให้ ${l.staff !== '—' ? l.staff : 'ทีมขาย'} แล้ว`, 'success')
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
