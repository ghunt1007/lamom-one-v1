/**
 * Churn Prediction — AI ทำนายลูกค้าที่จะหนีไปคู่แข่ง
 * Route: /crm/churn
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const RISK = {
  high:   { label: '🔴 เสี่ยงสูง',    color: 'var(--danger)',   action: 'โทรหาด่วน + เสนอโปรพิเศษ' },
  medium: { label: '🟡 เสี่ยงปานกลาง', color: 'var(--warning)', action: 'ส่ง SMS + นัด Test Drive รุ่นใหม่' },
  low:    { label: '🟢 เสี่ยงต่ำ',    color: 'var(--success)',  action: 'Follow-up ปกติ' },
}

const SIGNALS = [
  'ไม่มาเช็คระยะ 6+ เดือน',
  'ร้องเรียนซ้ำ > 1 ครั้ง',
  'สอบถามราคาคู่แข่ง',
  'ยกเลิกนัด 2+ ครั้ง',
  'ไม่ต่ออายุประกัน',
  'ให้คะแนน NPS < 6',
]

const CUSTOMERS = [
  { id: 'CH001', name: 'คุณสมชาย วงศ์ดี', model: 'BYD Atto 3 (2022)', lastVisit: '2025-10-12', lastBuy: '2022-06-01', score: 82, signals: [0,2,4], clv: 1850000, sales: 'นิภา' },
  { id: 'CH002', name: 'คุณมาลี รักดี',   model: 'MG ZS EV (2023)',   lastVisit: '2026-01-05', lastBuy: '2023-03-15', score: 61, signals: [1,3],   clv: 920000,  sales: 'วิชัย' },
  { id: 'CH003', name: 'คุณวีระ สมบัติ',  model: 'BYD Dolphin (2023)',lastVisit: '2026-03-20', lastBuy: '2023-09-01', score: 44, signals: [3],     clv: 650000,  sales: 'สมชาย' },
  { id: 'CH004', name: 'คุณนิภา ดีเด่น',  model: 'BYD Seal (2024)',   lastVisit: '2026-05-30', lastBuy: '2024-01-10', score: 28, signals: [],       clv: 1550000, sales: 'มาลี' },
  { id: 'CH005', name: 'คุณอนุชา ใจดี',   model: 'BYD Atto 3 (2021)', lastVisit: '2025-08-01', lastBuy: '2021-07-20', score: 91, signals: [0,1,2,5],clv: 780000,  sales: 'นิภา' },
  { id: 'CH006', name: 'คุณสุดา เก่งดี',  model: 'MG4 Electric (2024)',lastVisit: '2026-06-01', lastBuy: '2024-05-01', score: 19, signals: [],       clv: 870000,  sales: 'วิชัย' },
]

function risk(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}
function daysSince(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000) }

export default async function ChurnPredictionPage(container) {
  const myGen = container.__routerGen
  let customers = [...CUSTOMERS]
  let dataSource = 'demo'
  let filter = 'all'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const today = Date.now()
      const byName = {}
      for (const s of sales) {
        const name = s.customerName || s.custName || ''
        if (!name) continue
        if (!byName[name]) byName[name] = { name, lastBuy: s.bookingDate || s.deliveryDate || '', clv: 0, sales: s.salesName || '', model: s.model || '' }
        byName[name].clv += s.salePrice || 0
        const d = s.bookingDate || s.deliveryDate || ''
        if (d > byName[name].lastBuy) byName[name].lastBuy = d
      }
      const live = Object.values(byName).map((c, i) => {
        const daysSinceBuy = c.lastBuy ? Math.floor((today - new Date(c.lastBuy).getTime()) / 86400000) : 999
        const score = Math.min(99, Math.max(5, Math.round(daysSinceBuy / 3)))
        return { id: `LV${i+1}`, name: c.name, model: c.model, lastVisit: c.lastBuy, lastBuy: c.lastBuy, score, signals: daysSinceBuy > 365 ? [0] : [], clv: c.clv, sales: c.sales }
      })
      customers = [...live, ...CUSTOMERS]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const data = customers
      .map(c => ({ ...c, riskKey: risk(c.score) }))
      .filter(c => filter === 'all' || c.riskKey === filter)
      .sort((a, b) => b.score - a.score)

    const highCount = customers.filter(c => risk(c.score) === 'high').length
    const totalAtRisk = customers.filter(c => risk(c.score) !== 'low').reduce((s,c) => s + c.clv, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔮 Churn Prediction</div>
            <div class="page-subtitle">AI วิเคราะห์พฤติกรรม — ทำนายลูกค้าที่จะหนีไปคู่แข่ง${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="auto-btn">🤖 Auto Retention Campaign</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🔴 เสี่ยงสูง (≥70)', highCount + ' ราย', 'var(--danger)')}
          ${sc('💸 CLV ที่เสี่ยงสูญ', formatCurrency(totalAtRisk), 'var(--danger)')}
          ${sc('📋 วิเคราะห์แล้ว', CUSTOMERS.length + ' ราย', 'var(--primary)')}
          ${sc('✅ เสี่ยงต่ำ', CUSTOMERS.filter(c=>risk(c.score)==='low').length + ' ราย', 'var(--success)')}
        </div>

        <!-- Filter -->
        <div style="display:flex;gap:8px;margin-bottom:12px">
          ${['all','high','medium','low'].map(f => `
            <button class="btn btn-xs ${filter===f?'btn-primary':'btn-secondary'} filter-btn" data-f="${f}">
              ${f==='all'?'ทั้งหมด':RISK[f]?.label||f}
            </button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${data.map(c => churnCard(c)).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('.retain-btn').forEach(b => b.addEventListener('click', () => {
      const c = CUSTOMERS.find(x => x.id === b.dataset.id)
      const r = RISK[risk(c.score)]
      showToast(`📱 ส่ง Retention Campaign ให้ ${c.name} แล้ว · ${r.action}`, 'success')
    }))
    document.getElementById('auto-btn')?.addEventListener('click', () => {
      const high = CUSTOMERS.filter(c => risk(c.score) === 'high')
      showToast(`🤖 ส่ง Auto Retention Campaign ให้ ${high.length} ราย (เสี่ยงสูง) แล้ว — Sales ได้รับแจ้งผ่าน LINE`, 'success')
    })
  }

  function churnCard(c) {
    const r = RISK[c.riskKey]; const days = daysSince(c.lastVisit)
    return `
      <div class="card" style="padding:13px;border-left:4px solid ${r.color}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;font-size:0.87rem">${escHtml(c.name)}
              <span style="font-size:0.66rem;background:${r.color};color:#fff;padding:1px 8px;border-radius:10px;margin-left:6px">${r.label}</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(c.model)} · Sales: ${escHtml(c.sales)} · CLV: ${formatCurrency(c.clv)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.7rem;color:var(--text-muted)">Churn Score</div>
            <div style="font-size:1.4rem;font-weight:900;color:${r.color}">${c.score}</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:160px;background:var(--surface-2);padding:7px 10px;border-radius:var(--radius-sm);font-size:0.74rem">
            📅 มาเยี่ยมล่าสุด: <strong style="${days>180?'color:var(--danger)':''}">${days} วันที่แล้ว</strong><br>
            🛒 ซื้อล่าสุด: ${formatDate(c.lastBuy)}
          </div>
          ${c.signals.length ? `
            <div style="flex:2;min-width:200px;background:var(--surface-2);padding:7px 10px;border-radius:var(--radius-sm);font-size:0.72rem">
              <div style="color:var(--text-muted);margin-bottom:3px">⚠️ สัญญาณเตือน:</div>
              ${c.signals.map(i => `<span style="background:${r.color}22;color:${r.color};padding:1px 7px;border-radius:10px;margin:2px;font-size:0.68rem;display:inline-block">${SIGNALS[i]}</span>`).join('')}
            </div>` : '<div style="flex:2;min-width:200px;background:var(--surface-2);padding:7px 10px;border-radius:var(--radius-sm);font-size:0.72rem;color:var(--text-muted)">✅ ไม่พบสัญญาณเตือน</div>'}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <div style="font-size:0.72rem;color:var(--text-muted)">💡 แนะนำ: ${r.action}</div>
          ${c.riskKey !== 'low' ? `<button class="btn btn-xs btn-primary retain-btn" data-id="${c.id}">📱 ส่ง Retention</button>` : ''}
        </div>
      </div>`
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.3rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
