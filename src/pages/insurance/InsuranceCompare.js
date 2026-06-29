/**
 * Insurance Compare — เปรียบเทียบเบี้ยประกัน
 * Route: /insurance/compare
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const INSURERS = [
  { id: 'viriyah', name: 'วิริยะประกันภัย', logo: '🟦', commission: 18 },
  { id: 'bki', name: 'กรุงเทพประกันภัย', logo: '🟩', commission: 15 },
  { id: 'dhipaya', name: 'ทิพยประกันภัย', logo: '🟨', commission: 17 },
  { id: 'mti', name: 'เมืองไทยประกันภัย', logo: '🟪', commission: 16 },
]

const QUOTE_MATRIX = {
  'BYD Dolphin': { viriyah: 18900, bki: 17500, dhipaya: 19200, mti: 18100 },
  'BYD Atto 3': { viriyah: 22500, bki: 21800, dhipaya: 23000, mti: 22000 },
  'BYD Seal AWD': { viriyah: 32000, bki: 30500, dhipaya: 31800, mti: 31000 },
  'MG ZS EV': { viriyah: 17500, bki: 16900, dhipaya: 18000, mti: 17200 },
  'BYD Han': { viriyah: 42000, bki: 40500, dhipaya: 41500, mti: 41000 },
}

const COVERAGE = {
  viriyah: { repair: 'ซ่อมศูนย์', flood: true, ev_battery: true, roadside: '24 ชม.', deduct: 0 },
  bki:     { repair: 'ซ่อมศูนย์', flood: true, ev_battery: false, roadside: '24 ชม.', deduct: 3000 },
  dhipaya: { repair: 'ซ่อมศูนย์', flood: true, ev_battery: true, roadside: 'เฉพาะกทม.', deduct: 0 },
  mti:     { repair: 'ซ่อมอู่', flood: false, ev_battery: true, roadside: '24 ชม.', deduct: 2000 },
}

export default async function InsuranceComparePage(container) {
  let model = 'BYD Atto 3'

  function renderPage() {
    const quotes = QUOTE_MATRIX[model]
    const sorted = INSURERS.map(i => ({ ...i, premium: quotes[i.id], commAmt: Math.round(quotes[i.id] * i.commission / 100) }))
      .sort((a, b) => a.premium - b.premium)
    const cheapest = sorted[0]
    const bestComm = [...sorted].sort((a, b) => b.commAmt - a.commAmt)[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚖️ Insurance Compare</div>
            <div class="page-subtitle">เปรียบเทียบเบี้ยประกันชั้น 1 — ${INSURERS.length} บริษัท</div>
          </div>
        </div>

        <!-- Model picker -->
        <div style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">
          ${Object.keys(QUOTE_MATRIX).map(m => `<button class="btn btn-xs ${model===m?'btn-primary':'btn-secondary'} model-btn" data-m="${m}">${m}</button>`).join('')}
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('💰 ถูกที่สุด', cheapest.name.replace('ประกันภัย',''), 'success')}
          ${kpi('💵 เบี้ยต่ำสุด', formatCurrency(cheapest.premium), 'primary')}
          ${kpi('🏆 คอมสูงสุด', bestComm.name.replace('ประกันภัย','') + ' (' + formatCurrency(bestComm.commAmt) + ')', 'warning')}
        </div>

        <!-- Compare cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px">
          ${sorted.map((i, idx) => {
            const cov = COVERAGE[i.id]
            return `<div class="card" style="padding:14px;border:2px solid ${idx===0?'var(--success)':'transparent'}">
              ${idx === 0 ? '<div style="font-size:0.62rem;font-weight:700;color:var(--success);margin-bottom:6px">👑 ถูกที่สุด</div>' : ''}
              <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px">${i.logo} ${i.name}</div>
              <div style="font-size:1.3rem;font-weight:900;color:var(--primary);margin-bottom:2px">${formatCurrency(i.premium)}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:10px">ต่อปี · คอม ${i.commission}% = ${formatCurrency(i.commAmt)}</div>
              <div style="display:flex;flex-direction:column;gap:3px;font-size:0.7rem;margin-bottom:10px">
                ${covRow('🔧 ซ่อม', cov.repair, cov.repair === 'ซ่อมศูนย์')}
                ${covRow('🌊 น้ำท่วม', cov.flood ? 'คุ้มครอง' : 'ไม่คุ้มครอง', cov.flood)}
                ${covRow('🔋 แบต EV', cov.ev_battery ? 'คุ้มครอง' : 'ไม่คุ้มครอง', cov.ev_battery)}
                ${covRow('🚨 ช่วยฉุกเฉิน', cov.roadside, cov.roadside === '24 ชม.')}
                ${covRow('💸 ค่าเสียหายส่วนแรก', cov.deduct === 0 ? 'ไม่มี' : formatCurrency(cov.deduct), cov.deduct === 0)}
              </div>
              <button class="btn btn-xs btn-primary select-btn" data-id="${i.id}" style="width:100%">📄 เสนอลูกค้า</button>
            </div>`
          }).join('')}
        </div>

        <p style="font-size:0.7rem;color:var(--text-muted);padding-left:4px">💡 เบี้ยอ้างอิงทุนประกันมาตรฐาน ผู้ขับขี่อายุ 35+ ไม่เคยเคลม — เบี้ยจริงอาจต่างตามโปรไฟล์ลูกค้า</p>
      </div>
    `

    container.querySelectorAll('.model-btn').forEach(b => b.addEventListener('click', () => { model = b.dataset.m; renderPage() }))
    container.querySelectorAll('.select-btn').forEach(b => b.addEventListener('click', () => {
      const i = INSURERS.find(x => x.id === b.dataset.id)
      if (i) openModal({
        title: '📄 เสนอประกันให้ลูกค้า',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="font-size:0.82rem">${i.logo} <strong>${i.name}</strong> — ${model}<br>เบี้ย <strong style="color:var(--primary)">${formatCurrency(QUOTE_MATRIX[model][i.id])}</strong>/ปี</div>
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="ins-customer"></div>
          <div class="input-group"><label class="input-label">ส่งทาง</label>
            <select class="input" id="ins-channel"><option>LINE</option><option>อีเมล</option><option>พิมพ์เอกสาร</option></select>
          </div>
        </div>`,
        confirmText: '📤 ส่งใบเสนอ',
        onConfirm() {
          const name = document.getElementById('ins-customer')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
          showToast(`📤 ส่งใบเสนอประกัน ${i.name} ให้ ${name} แล้ว`, 'success')
        }
      })
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function covRow(l, v, good) { return `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">${l}</span><span style="color:var(--${good?'success':'warning'})">${v}</span></div>` }
