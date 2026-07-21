/**
 * Quotation Compare — เปรียบเทียบใบเสนอราคาให้ลูกค้า
 * Route: /crm/quote-compare
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getVehicles } from '../../data/vehicleDatabase.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PROMO_DISCOUNT = 0.04 // โปรเดือนนี้ (ส่วนลดตัวอย่างสำหรับคำนวณ ไม่ใช่ราคาจริงจากผู้ผลิต)

export default async function QuotationComparePage(container) {
  const myGen = container.__routerGen

  const ALL = getVehicles() // แหล่งข้อมูลจริง — แคตตาล็อกรถ (Firestore-backed) จาก vehicleDatabase.js
  const byPriceAsc = [...ALL].sort((a, b) => (a.price || 0) - (b.price || 0))
  let selected = byPriceAsc.slice(0, 2).map(v => v.id)
  let downPct = 20
  let term = 60
  const FLAT_RATE = 2.69

  function monthly(principal) {
    const interest = principal * (FLAT_RATE / 100) * (term / 12)
    return Math.round((principal + interest) / term)
  }

  function vehicleLabel(v) {
    return `${v.brand} ${v.model} ${v.variant}`.trim()
  }

  function batteryKwh(v) {
    const n = parseFloat(v.battery)
    return isNaN(n) ? 0 : n
  }

  function renderPage() {
    const chosen = selected.map(id => ALL.find(v => v.id === id)).filter(Boolean)
    const availableToAdd = ALL.filter(v => !selected.includes(v.id))
    const brands = [...new Set(availableToAdd.map(v => v.brand))].sort()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚖️ Quotation Compare</div>
            <div class="page-subtitle">เปรียบเทียบรุ่นรถจากแคตตาล็อกจริง + ค่างวด ให้ลูกค้าตัดสินใจ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="send-btn" ${chosen.length < 2 ? 'disabled' : ''}>📤 ส่งให้ลูกค้า</button>
          </div>
        </div>

        <!-- Select models -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🚗 เลือกรุ่นเปรียบเทียบ (2-4 รุ่น)</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:${chosen.length ? '10px' : '0'}">
            ${chosen.map(v => `<span class="badge badge-primary" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;font-size:0.78rem">
              ${escHtml(vehicleLabel(v))}
              <button class="remove-veh-btn" data-id="${v.id}" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:700;padding:0;line-height:1">✕</button>
            </span>`).join('')}
          </div>
          ${selected.length < 4 ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select class="input" id="add-veh-select" style="max-width:360px">
              <option value="">${availableToAdd.length ? '-- เลือกรุ่นเพื่อเพิ่ม --' : 'ไม่มีรุ่นเหลือให้เพิ่ม'}</option>
              ${brands.map(b => `<optgroup label="${escHtml(b)}">
                ${availableToAdd.filter(v => v.brand === b).map(v => `<option value="${v.id}">${escHtml(v.model)} ${escHtml(v.variant)} — ${formatCurrency(v.price)}</option>`).join('')}
              </optgroup>`).join('')}
            </select>
            <button class="btn btn-sm btn-secondary" id="add-veh-btn">➕ เพิ่ม</button>
          </div>` : `<div style="font-size:0.75rem;color:var(--text-muted)">เปรียบเทียบได้สูงสุด 4 รุ่น — เอาออกก่อนเพื่อเพิ่มรุ่นใหม่</div>`}
        </div>

        <!-- Finance settings -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <label class="input-label">เงินดาวน์: <strong style="color:var(--primary)">${downPct}%</strong></label>
            <input type="range" id="down-slider" min="0" max="50" step="5" value="${downPct}" style="width:100%;accent-color:var(--primary)">
          </div>
          <div style="display:flex;gap:4px">
            <span style="font-size:0.75rem;color:var(--text-muted);align-self:center">ผ่อน:</span>
            ${[48, 60, 72, 84].map(t => `<button class="btn btn-xs ${term === t ? 'btn-primary' : 'btn-secondary'} term-btn" data-t="${t}">${t} งวด</button>`).join('')}
          </div>
        </div>

        <!-- Compare table -->
        ${chosen.length < 2 ? '<div class="card" style="padding:30px;text-align:center;color:var(--text-muted)">เลือกอย่างน้อย 2 รุ่น</div>' : `
          <div class="card" style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:${120 + chosen.length * 150}px">
              <thead>
                <tr style="border-bottom:2px solid var(--border)">
                  <th style="padding:10px 14px;text-align:left;font-size:0.73rem;color:var(--text-muted)">รายการ</th>
                  ${chosen.map(v => `<th style="padding:10px;text-align:center;font-size:0.84rem;font-weight:700">${escHtml(vehicleLabel(v))}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${specRow('💰 ราคาปกติ', chosen.map(v => formatCurrency(v.price)))}
                ${specRow('🎁 ราคาโปรเดือนนี้', chosen.map(v => `<span style="color:var(--success);font-weight:700">${formatCurrency(Math.round(v.price * (1 - PROMO_DISCOUNT)))}</span>`), true)}
                ${specRow('⛽ ประเภทเชื้อเพลิง', chosen.map(v => v.fuel || '-'))}
                ${specRow('🔋 แบตเตอรี่', chosen.map(v => v.battery || '—'), false, chosen.map(v => batteryKwh(v)), 'max')}
                ${specRow('🛣 ระยะวิ่ง (EV)', chosen.map(v => v.range ? v.range + ' km' : '—'), false, chosen.map(v => v.range || 0), 'max')}
                ${specRow('⚡ กำลังเครื่องยนต์/มอเตอร์', chosen.map(v => v.power ? v.power + ' แรงม้า' : '—'), false, chosen.map(v => v.power || 0), 'max')}
                ${specRow('💺 ที่นั่ง', chosen.map(v => (v.seats || '-') + ' ที่นั่ง'))}
                ${specRow('🛡 การรับประกัน', chosen.map(v => v.warranty || '—'))}
                ${specRow('💵 เงินดาวน์ ' + downPct + '%', chosen.map(v => formatCurrency(Math.round(v.price * (1 - PROMO_DISCOUNT) * downPct / 100))))}
                ${specRow('📅 ค่างวด ' + term + ' เดือน', chosen.map(v => `<strong style="color:var(--primary)">${formatCurrency(monthly(Math.round(v.price * (1 - PROMO_DISCOUNT) * (1 - downPct / 100))))}</strong>/ด.`), true)}
              </tbody>
            </table>
          </div>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 ช่องไฮไลต์เขียว = ดีที่สุดในแถวนั้น · ดอกเบี้ย flat ${FLAT_RATE}% · ราคาโปรเป็นตัวอย่างส่วนลดสำหรับคำนวณ (หักแล้ว ${PROMO_DISCOUNT * 100}%) — ยืนยันราคาโปรจริงกับฝ่ายขายก่อนเสนอลูกค้า</p>
        `}
      </div>
    `

    document.getElementById('add-veh-btn')?.addEventListener('click', () => {
      const sel = document.getElementById('add-veh-select')
      const id = sel?.value
      if (!id) return
      if (selected.length >= 4) { showToast('เปรียบเทียบได้สูงสุด 4 รุ่น', 'warning'); return }
      selected.push(id)
      renderPage()
    })
    container.querySelectorAll('.remove-veh-btn').forEach(b => b.addEventListener('click', () => {
      if (selected.length <= 2) { showToast('ต้องเลือกอย่างน้อย 2 รุ่น', 'warning'); return }
      selected = selected.filter(id => id !== b.dataset.id)
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
      const nonZero = raw.filter(v => v > 0)
      if (nonZero.length) {
        const target = best === 'max' ? Math.max(...raw) : Math.min(...raw.filter(v => v > 0))
        bestIdx = raw.indexOf(target)
      }
    }
    return `<tr style="border-bottom:1px solid var(--border)${highlight ? ';background:var(--surface-2)' : ''}">
      <td style="padding:9px 14px;font-size:0.78rem;color:var(--text-muted)">${label}</td>
      ${values.map((v, i) => `<td style="padding:9px 10px;text-align:center;font-size:0.82rem${i === bestIdx ? ';background:var(--success)18' : ''}">${v}${i === bestIdx ? ' 🏆' : ''}</td>`).join('')}
    </tr>`
  }

  renderPage()
}
