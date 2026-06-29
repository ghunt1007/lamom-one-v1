/**
 * Quotation Compare — เปรียบเทียบใบเสนอราคาให้ลูกค้า
 * Route: /crm/quote-compare
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_MODELS = [
  { name: 'BYD Dolphin', price: 899000, range: 410, battery: 44.9, power: 70, accel: 12.3, seats: 5 },
  { name: 'BYD Atto 3', price: 1099000, range: 480, battery: 60.5, power: 150, accel: 7.3, seats: 5 },
  { name: 'BYD Seal AWD', price: 1699000, range: 520, battery: 82.6, power: 390, accel: 3.8, seats: 5 },
  { name: 'MG4 Electric', price: 949000, range: 425, battery: 51, power: 125, accel: 7.7, seats: 5 },
  { name: 'BYD Han', price: 2099000, range: 521, battery: 85.4, power: 380, accel: 3.9, seats: 5 },
]

const PROMO_DISCOUNT = 0.04 // โปรเดือนนี้

export default async function QuotationComparePage(container) {
  const myGen = container.__routerGen
  let MODELS = DEMO_MODELS.map(m => ({ ...m }))
  let dataSource = 'demo'
  let selected = ['BYD Dolphin', 'BYD Atto 3']
  let downPct = 20
  let term = 60
  const FLAT_RATE = 2.69

  try {
    const docs = await listDocs('vehicles', [], 'price', 'asc', 50).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map(d => ({
        name: d.name || d.model || `${d.brand || ''} ${d.modelName || ''}`.trim(),
        price: d.price || d.sellingPrice || 0,
        range: d.range || d.driveRange || 0,
        battery: d.battery || d.batteryCapacity || 0,
        power: d.power || d.motorPower || 0,
        accel: d.accel || d.acceleration || 0,
        seats: d.seats || 5,
      })).filter(m => m.name && m.price > 0)
      if (mapped.length >= 2) {
        MODELS = [...mapped, ...DEMO_MODELS.filter(dm => !mapped.find(m => m.name === dm.name))]
        dataSource = 'live'
      }
    }
  } catch {}

  function monthly(principal) {
    const interest = principal * (FLAT_RATE / 100) * (term / 12)
    return Math.round((principal + interest) / term)
  }

  function renderPage() {
    const chosen = MODELS.filter(m => selected.includes(m.name))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚖️ Quotation Compare</div>
            <div class="page-subtitle">เปรียบเทียบรุ่นรถ + ค่างวด ให้ลูกค้าตัดสินใจ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="send-btn" ${chosen.length<2?'disabled':''}>📤 ส่งให้ลูกค้า</button>
          </div>
        </div>

        <!-- Select models -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🚗 เลือกรุ่นเปรียบเทียบ (2-4 รุ่น)</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${MODELS.map(m => `<button class="btn btn-xs ${selected.includes(m.name)?'btn-primary':'btn-secondary'} pick-btn" data-m="${escHtml(m.name)}">${selected.includes(m.name)?'✓ ':''}${escHtml(m.name)}</button>`).join('')}
          </div>
        </div>

        <!-- Finance settings -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <label class="input-label">เงินดาวน์: <strong style="color:var(--primary)">${downPct}%</strong></label>
            <input type="range" id="down-slider" min="0" max="50" step="5" value="${downPct}" style="width:100%;accent-color:var(--primary)">
          </div>
          <div style="display:flex;gap:4px">
            <span style="font-size:0.75rem;color:var(--text-muted);align-self:center">ผ่อน:</span>
            ${[48,60,72,84].map(t => `<button class="btn btn-xs ${term===t?'btn-primary':'btn-secondary'} term-btn" data-t="${t}">${t} งวด</button>`).join('')}
          </div>
        </div>

        <!-- Compare table -->
        ${chosen.length < 2 ? '<div class="card" style="padding:30px;text-align:center;color:var(--text-muted)">เลือกอย่างน้อย 2 รุ่น</div>' : `
          <div class="card" style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:${120+chosen.length*150}px">
              <thead>
                <tr style="border-bottom:2px solid var(--border)">
                  <th style="padding:10px 14px;text-align:left;font-size:0.73rem;color:var(--text-muted)">รายการ</th>
                  ${chosen.map(m => `<th style="padding:10px;text-align:center;font-size:0.84rem;font-weight:700">${escHtml(m.name)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${specRow('💰 ราคาปกติ', chosen.map(m => formatCurrency(m.price)))}
                ${specRow('🎁 ราคาโปรเดือนนี้', chosen.map(m => `<span style="color:var(--success);font-weight:700">${formatCurrency(Math.round(m.price*(1-PROMO_DISCOUNT)))}</span>`), true)}
                ${specRow('🔋 แบตเตอรี่', chosen.map(m => m.battery + ' kWh'), false, chosen.map(m=>m.battery), 'max')}
                ${specRow('🛣 ระยะวิ่ง', chosen.map(m => m.range + ' km'), false, chosen.map(m=>m.range), 'max')}
                ${specRow('⚡ กำลังมอเตอร์', chosen.map(m => m.power + ' kW'), false, chosen.map(m=>m.power), 'max')}
                ${specRow('🏁 0-100 km/h', chosen.map(m => m.accel + ' วิ'), false, chosen.map(m=>m.accel), 'min')}
                ${specRow('💵 เงินดาวน์ ' + downPct + '%', chosen.map(m => formatCurrency(Math.round(m.price*(1-PROMO_DISCOUNT)*downPct/100))))}
                ${specRow('📅 ค่างวด ' + term + ' เดือน', chosen.map(m => `<strong style="color:var(--primary)">${formatCurrency(monthly(Math.round(m.price*(1-PROMO_DISCOUNT)*(1-downPct/100))))}</strong>/ด.`), true)}
              </tbody>
            </table>
          </div>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 ช่องไฮไลต์เขียว = ดีที่สุดในแถวนั้น · ดอกเบี้ย flat ${FLAT_RATE}% · ราคาโปรหักแล้ว ${PROMO_DISCOUNT*100}%</p>
        `}
      </div>
    `

    container.querySelectorAll('.pick-btn').forEach(b => b.addEventListener('click', () => {
      const name = b.dataset.m
      if (selected.includes(name)) {
        if (selected.length > 2) selected = selected.filter(x => x !== name)
        else showToast('ต้องเลือกอย่างน้อย 2 รุ่น', 'warning')
      } else {
        if (selected.length < 4) selected.push(name)
        else showToast('เปรียบเทียบได้สูงสุด 4 รุ่น', 'warning')
      }
      renderPage()
    }))
    document.getElementById('down-slider')?.addEventListener('input', e => { downPct = parseInt(e.target.value); renderPage() })
    container.querySelectorAll('.term-btn').forEach(b => b.addEventListener('click', () => { term = parseInt(b.dataset.t); renderPage() }))
    document.getElementById('send-btn')?.addEventListener('click', () => {
      openModal({
        title: '📤 ส่งใบเปรียบเทียบให้ลูกค้า',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="qc-name"></div>
          <div class="input-group"><label class="input-label">ส่งทาง</label><select class="input" id="qc-ch"><option>LINE</option><option>อีเมล</option><option>พิมพ์เอกสาร</option></select></div>
        </div>`,
        confirmText: '📤 ส่ง',
        onConfirm() {
          const name = document.getElementById('qc-name')?.value?.trim()
          if (!name) { showToast('❗ กรอกชื่อลูกค้า', 'error'); return false }
          showToast(`📤 ส่งใบเปรียบเทียบ ${chosen.length} รุ่นให้ ${name} แล้ว`, 'success')
        }
      })
    })
  }

  function specRow(label, values, highlight, raw, best) {
    let bestIdx = -1
    if (raw && best) {
      const target = best === 'max' ? Math.max(...raw) : Math.min(...raw)
      bestIdx = raw.indexOf(target)
    }
    return `<tr style="border-bottom:1px solid var(--border)${highlight?';background:var(--surface-2)':''}">
      <td style="padding:9px 14px;font-size:0.78rem;color:var(--text-muted)">${label}</td>
      ${values.map((v, i) => `<td style="padding:9px 10px;text-align:center;font-size:0.82rem${i===bestIdx?';background:var(--success)18':''}">${v}${i===bestIdx?' 🏆':''}</td>`).join('')}
    </tr>`
  }

  renderPage()
}
