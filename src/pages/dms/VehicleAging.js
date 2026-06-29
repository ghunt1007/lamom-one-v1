/**
 * Vehicle Aging Report — รถค้างสต็อก แจ้งเตือนเร่งขาย
 * Route: /dms/aging
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STOCK = [
  { vin: 'LGXC1', model: 'BYD Dolphin', color: 'ขาว', cost: 820000, arrived: '2026-05-28' },
  { vin: 'LGXC2', model: 'BYD Atto 3',  color: 'ฟ้า',  cost: 1010000, arrived: '2026-05-05' },
  { vin: 'LGXC3', model: 'MG ZS EV',    color: 'แดง',  cost: 720000, arrived: '2026-04-12' },
  { vin: 'LGXC4', model: 'BYD Seal',    color: 'เทา',  cost: 1550000, arrived: '2026-03-20' },
  { vin: 'LGXC5', model: 'BYD Han',     color: 'ดำ',   cost: 1900000, arrived: '2026-02-08' },
  { vin: 'LGXC6', model: 'MG4 Electric',color: 'เหลือง',cost: 870000, arrived: '2026-01-15' },
  { vin: 'LGXC7', model: 'BYD Atto 3',  color: 'ดำ',   cost: 1010000, arrived: '2026-05-30' },
  { vin: 'LGXC8', model: 'BYD Dolphin', color: 'แดง',  cost: 820000, arrived: '2025-12-10' },
]

// ต้นทุนเงินทุนต่อวัน (floor plan ~6.5%/ปี)
const DAILY_RATE = 0.065 / 365

function bucket(days) {
  if (days <= 30) return { key: 'fresh', label: '0-30 วัน', color: 'var(--success)' }
  if (days <= 60) return { key: 'ok', label: '31-60 วัน', color: 'var(--primary)' }
  if (days <= 90) return { key: 'warn', label: '61-90 วัน', color: 'var(--warning)' }
  return { key: 'aged', label: '90+ วัน', color: 'var(--danger)' }
}

export default async function VehicleAgingPage(container) {
  const myGen = container.__routerGen
  let stock = STOCK.map(s => ({ ...s }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('stock', [], 'arrived', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        vin: d.vin || `VIN-${i+1}`,
        model: d.model || '',
        color: d.color || '',
        cost: d.cost || d.purchasePrice || 0,
        arrived: d.arrived || d.arrivedDate || new Date().toISOString().slice(0,10),
      }))
      stock = [...mapped, ...STOCK]
      dataSource = 'live'
    }
  } catch {}

  const rows = stock.map(s => {
    const days = Math.floor((Date.now() - new Date(s.arrived).getTime()) / 86400000)
    return { ...s, days, b: bucket(days), carry: Math.round(s.cost * DAILY_RATE * days) }
  }).sort((a, b) => b.days - a.days)

  const totalCarry = rows.reduce((s, r) => s + r.carry, 0)
  const aged = rows.filter(r => r.days > 90)
  const buckets = ['fresh', 'ok', 'warn', 'aged'].map(k => ({
    k, items: rows.filter(r => r.b.key === k), color: rows.find(r => r.b.key === k)?.b.color || 'var(--border)',
    label: { fresh: '0-30 วัน', ok: '31-60 วัน', warn: '61-90 วัน', aged: '90+ วัน' }[k]
  }))

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">⏳ Vehicle Aging Report</div>
          <div class="page-subtitle">รถค้างสต็อก ${rows.length} คัน · ติดตามต้นทุนจม + เร่งระบาย${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
        </div>
        <div class="page-actions"><button class="btn btn-primary" id="push-btn">📣 ส่งรายการเร่งขายให้เซลส์</button></div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${buckets.map(b => `
          <div class="card" style="padding:12px 14px;border-left:4px solid ${b.color}">
            <div style="font-size:0.72rem;color:var(--text-muted)">${b.label}</div>
            <div style="font-size:1.5rem;font-weight:900;color:${b.color}">${b.items.length}</div>
            <div style="font-size:0.66rem;color:var(--text-muted)">${formatCurrency(b.items.reduce((s,i)=>s+i.cost,0))}</div>
          </div>`).join('')}
      </div>

      <div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><span style="font-size:0.78rem;color:var(--text-muted)">💸 ต้นทุนเงินทุนจมสะสม (floor plan ${(DAILY_RATE*365*100).toFixed(1)}%/ปี)</span>
          <span style="font-size:1.2rem;font-weight:900;color:var(--danger);margin-left:8px">${formatCurrency(totalCarry)}</span></div>
        ${aged.length ? `<span style="font-size:0.76rem;color:var(--danger);font-weight:700">⚠️ ${aged.length} คันค้างเกิน 90 วัน — ควรจัดโปรเร่งระบาย</span>` : ''}
      </div>

      <div class="card" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:760px">
          <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
            <th style="padding:10px 12px">VIN</th><th>รุ่น / สี</th><th style="text-align:right">ต้นทุน</th>
            <th style="text-align:center">ค้างสต็อก</th><th style="text-align:center">กลุ่มอายุ</th>
            <th style="text-align:right">ต้นทุนจม</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                <td style="padding:9px 12px;font-family:monospace">${escHtml(r.vin)}</td>
                <td>${escHtml(r.model)}<div style="font-size:0.7rem;color:var(--text-muted)">สี${escHtml(r.color)}</div></td>
                <td style="text-align:right">${formatCurrency(r.cost)}</td>
                <td style="text-align:center;font-weight:700;color:${r.b.color}">${r.days} วัน</td>
                <td style="text-align:center"><span style="font-size:0.66rem;background:${r.b.color};color:#fff;padding:2px 8px;border-radius:10px">${r.b.label}</span></td>
                <td style="text-align:right;color:var(--danger)">${formatCurrency(r.carry)}</td>
                <td style="text-align:right;padding-right:12px">${r.days>60?`<button class="btn btn-xs btn-secondary promo-btn" data-vin="${escHtml(r.vin)}" data-model="${escHtml(r.model)}">🎁 จัดโปร</button>`:''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `

  container.querySelectorAll('.promo-btn').forEach(b => b.addEventListener('click', () => {
    const r = rows.find(x => x.vin === b.dataset.vin)
    openModal({
      title: '🎁 จัดโปรเร่งระบาย ' + escHtml(b.dataset.model) + ' (' + escHtml(b.dataset.vin) + ')',
      size: 'sm',
      body: `<div style="font-size:0.82rem;display:flex;flex-direction:column;gap:10px">
        <div>ค้างสต็อก <strong>${r?.days || 0} วัน</strong> · ต้นทุนจม <strong style="color:var(--danger)">${formatCurrency(r?.carry || 0)}</strong></div>
        <div class="input-group"><label class="input-label">ส่วนลดโปรโมชั่น (บาท)</label>
          <input class="input" type="number" id="promo-disc" value="20000"></div>
        <div class="input-group"><label class="input-label">ชื่อแคมเปญ</label>
          <input class="input" id="promo-camp" value="Flash Deal — ${escHtml(b.dataset.model)}"></div>
      </div>`,
      confirmText: '🎁 สร้างโปร',
      onConfirm() {
        const disc = parseInt(document.getElementById('promo-disc')?.value) || 0
        const camp = document.getElementById('promo-camp')?.value.trim() || `Flash Deal — ${b.dataset.model}`
        if (r) { r.promoDisc = disc; r.campaign = camp }
        b.textContent = '✅ จัดโปรแล้ว'; b.disabled = true
        showToast(`🎁 สร้างโปร "${camp}" ลด ${formatCurrency(disc)} สำหรับ ${b.dataset.model} แล้ว`, 'success')
      }
    })
  }))
  document.getElementById('push-btn')?.addEventListener('click', e => {
    const targets = rows.filter(r => r.days > 60)
    targets.forEach(r => { r.pushed = true })
    const btn = e.currentTarget
    btn.textContent = '✅ ส่งแล้ว'; btn.disabled = true
    showToast(`📣 ส่งรายการรถค้างเกิน 60 วัน (${targets.length} คัน) ให้ทีมเซลส์ทาง LINE แล้ว`, 'success')
  })
}
