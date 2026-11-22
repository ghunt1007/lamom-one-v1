/**
 * Quotation Compare — เปรียบเทียบใบเสนอราคาให้ลูกค้า
 * Route: /crm/quote-compare
 */
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { sendEmail } from '../../utils/comms.js'
import { printDocument, docHeader, docFooter, esc } from '../../utils/print.js'
import { escHtml as __escA } from '../../utils/escape.js'
import { escHtml } from '../../utils/escape.js'
import { copyText } from '../../utils/copyText.js'


export default async function QuotationComparePage(container) {
  const myGen = container.__routerGen

  const ALL = getVehicles() // แหล่งข้อมูลจริง — แคตตาล็อกรถ (Firestore-backed) จาก vehicleDatabase.js
  const byPriceAsc = [...ALL].sort((a, b) => (a.price || 0) - (b.price || 0))
  let selected = byPriceAsc.slice(0, 2).map(v => v.id)
  let downPct = 20
  let term = 60
  // (v1.0.1276) เดิมหักส่วนลดสมมติ 4% ทุกรุ่น ("ราคาโปรเดือนนี้") แล้วส่งตัวเลขนั้นให้ลูกค้าทางอีเมล/พิมพ์ ทั้งที่ไม่ใช่โปรจริง
  // ตอนนี้เซลส์ใส่ส่วนลดจริงเอง (บาท ค่าเริ่ม 0) และแก้ดอกเบี้ยได้ — จำค่าที่ใช้ล่าสุดไว้ในเครื่อง
  const ls = (k, d) => { try { const v = parseFloat(localStorage.getItem(k)); return Number.isFinite(v) ? v : d } catch { return d } }
  let discount = 0
  let FLAT_RATE = ls('qc_rate', 2.69)
  const net = v => Math.max(0, (v.price || 0) - discount)

  function monthly(principal) {
    const interest = principal * (FLAT_RATE / 100) * (term / 12)
    return Math.round((principal + interest) / term)
  }

  function compareText(chosen, name) {
    return [`ใบเปรียบเทียบรุ่นรถสำหรับคุณ${name}`,
      ...chosen.map(v => `🚗 ${vehicleLabel(v)}\n   ราคา ${formatCurrency(net(v))}${discount > 0 ? ` (หักส่วนลด ${formatCurrency(discount)})` : ''}\n   ดาวน์ ${downPct}% ${formatCurrency(Math.round(net(v) * downPct / 100))} · ผ่อน ${term} งวด ประมาณ ${formatCurrency(monthly(Math.round(net(v) * (1 - downPct / 100))))}/เดือน`),
      `(ค่างวดเป็นการประมาณ ดอกเบี้ย ${FLAT_RATE}% ต่อปี ยืนยันกับไฟแนนซ์อีกครั้ง)`].join('\n')
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
                ${availableToAdd.filter(v => v.brand === b).map(v => `<option value="${__escA(v.id)}">${escHtml(v.model)} ${escHtml(v.variant)} — ${formatCurrency(v.price)}</option>`).join('')}
              </optgroup>`).join('')}
            </select>
            <button class="btn btn-sm btn-secondary" id="add-veh-btn">➕ เพิ่ม</button>
          </div>` : `<div style="font-size:0.75rem;color:var(--text-muted)">เปรียบเทียบได้สูงสุด 4 รุ่น — เอาออกก่อนเพื่อเพิ่มรุ่นใหม่</div>`}
        </div>

        <!-- Finance settings -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <label class="input-label">เงินดาวน์: <strong style="color:var(--primary)">${downPct}%</strong></label>
            <input type="range" id="down-slider" min="0" max="50" step="5" value="${__escA(downPct)}" style="width:100%;accent-color:var(--primary)">
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <span style="font-size:0.75rem;color:var(--text-muted);align-self:center">ผ่อน:</span>
            ${[48, 60, 72, 84].map(t => `<button class="btn btn-xs ${term === t ? 'btn-primary' : 'btn-secondary'} term-btn" data-t="${t}">${t} งวด</button>`).join('')}
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-muted)">ส่วนลด (บาท)
            <input class="input" id="qc-disc" type="number" min="0" step="1000" inputmode="numeric" value="${discount || ''}" placeholder="0" style="width:110px"></label>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-muted)">ดอกเบี้ย flat %
            <input class="input" id="qc-rate" type="number" min="0" max="15" step="0.01" inputmode="decimal" value="${FLAT_RATE}" style="width:80px"></label>
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
                ${discount > 0 ? specRow(`🎁 ราคาหลังส่วนลด ${formatCurrency(discount)}`, chosen.map(v => `<span style="color:var(--success);font-weight:700">${formatCurrency(net(v))}</span>`), true) : ''}
                ${specRow('⛽ ประเภทเชื้อเพลิง', chosen.map(v => v.fuel || '-'))}
                ${specRow('🔋 แบตเตอรี่', chosen.map(v => v.battery || '—'), false, chosen.map(v => batteryKwh(v)), 'max')}
                ${specRow('🛣 ระยะวิ่ง (EV)', chosen.map(v => v.range ? v.range + ' km' : '—'), false, chosen.map(v => v.range || 0), 'max')}
                ${specRow('⚡ กำลังเครื่องยนต์/มอเตอร์', chosen.map(v => v.power ? v.power + ' แรงม้า' : '—'), false, chosen.map(v => v.power || 0), 'max')}
                ${specRow('💺 ที่นั่ง', chosen.map(v => (v.seats || '-') + ' ที่นั่ง'))}
                ${specRow('🛡 การรับประกัน', chosen.map(v => v.warranty || '—'))}
                ${specRow('💵 เงินดาวน์ ' + downPct + '%', chosen.map(v => formatCurrency(Math.round(net(v) * downPct / 100))))}
                ${specRow('📅 ค่างวด ' + term + ' เดือน', chosen.map(v => `<strong style="color:var(--primary)">${formatCurrency(monthly(Math.round(net(v) * (1 - downPct / 100))))}</strong>/ด.`), true)}
              </tbody>
            </table>
          </div>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 ช่องไฮไลต์เขียว = ดีที่สุดในแถวนั้น · ดอกเบี้ย flat ${FLAT_RATE}% · ค่างวดเป็นการประมาณ ยืนยันดอกเบี้ยจริงกับไฟแนนซ์ก่อนเสนอลูกค้า</p>
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
    document.getElementById('qc-disc')?.addEventListener('change', e => { discount = Math.max(0, parseFloat(e.target.value) || 0); renderPage() })
    document.getElementById('qc-rate')?.addEventListener('change', e => { const r = parseFloat(e.target.value); if (Number.isFinite(r) && r >= 0 && r <= 15) { FLAT_RATE = r; try { localStorage.setItem('qc_rate', String(r)) } catch {} } renderPage() })
    document.getElementById('send-btn')?.addEventListener('click', () => {
      // (v1.0.xxx) เดิมไม่อ่านช่องทางที่เลือกเลย แค่ toast สำเร็จหลอกๆทุกครั้ง — ตอนนี้อ่านช่องทางจริง:
      // "พิมพ์เอกสาร" เปิดหน้าต่างพิมพ์จริงผ่าน printDocument() (utils/print.js), "อีเมล" ส่งจริงผ่าน
      // sendEmail() (utils/comms.js) เมื่อกรอกอีเมลผู้รับ, "LINE" (v1.0.1276) คัดลอกข้อความไปวางในแชตลูกค้า
      openModal({
        title: '📤 ส่งใบเปรียบเทียบให้ลูกค้า',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="qc-name"></div>
          <div class="input-group"><label class="input-label">ส่งทาง</label><select class="input" id="qc-ch"><option value="line">LINE (คัดลอกข้อความไปวาง)</option><option value="email">อีเมล</option><option value="print">พิมพ์เอกสาร</option></select></div>
          <div class="input-group" id="qc-email-group"><label class="input-label">อีเมลผู้รับ (สำหรับส่งทางอีเมล)</label><input class="input" id="qc-email" placeholder="name@email.com"></div>
        </div>`,
        confirmText: '📤 ส่ง',
        async onConfirm() {
          const name = document.getElementById('qc-name')?.value?.trim()
          if (!name) { showToast('❗ กรอกชื่อลูกค้า', 'error'); return false }
          const ch = document.getElementById('qc-ch')?.value || 'line'
          const email = document.getElementById('qc-email')?.value?.trim() || ''
          if (ch === 'print') {
            const html = docHeader('ใบเปรียบเทียบรุ่นรถ', '', todayBangkok()) +
              `<p>ลูกค้า: ${esc(name)}</p>` +
              `<table style="width:100%;border-collapse:collapse;margin-top:10px">
                <tr>${chosen.map(v => `<th style="border:1px solid #ccc;padding:6px;text-align:left">${esc(v.brand || '')} ${esc(v.model || '')}</th>`).join('')}</tr>
                <tr>${chosen.map(v => `<td style="border:1px solid #ccc;padding:6px">${formatCurrency(net(v))} (ดาวน์ ${downPct}% / ${term} เดือน: ${formatCurrency(monthly(Math.round(net(v) * (1 - downPct / 100))))}/ด.)</td>`).join('')}</tr>
              </table>` + docFooter()
            printDocument(html, { title: 'ใบเปรียบเทียบรุ่นรถ ' + name })
            showToast(`🖨️ เปิดหน้าต่างพิมพ์ใบเปรียบเทียบ ${chosen.length} รุ่นสำหรับ ${name} แล้ว`, 'success')
            return
          }
          if (ch === 'email') {
            if (!email) { showToast('❗ กรุณากรอกอีเมลผู้รับ', 'error'); return false }
            const bodyText = compareText(chosen, name)
            try {
              await sendEmail([email], 'ใบเปรียบเทียบรุ่นรถสำหรับคุณ ' + name, bodyText)
              showToast(`✅ ส่งอีเมลใบเปรียบเทียบให้ ${name} แล้ว`, 'success')
            } catch (e) { showToast('❌ ส่งอีเมลไม่สำเร็จ: ' + e.message, 'error'); return false }
            return
          }
          // LINE — คัดลอกข้อความไปวางในแชต LINE ของลูกค้า (แตะเดียว)
          await copyText(compareText(chosen, name), '📋 คัดลอกข้อความแล้ว — เปิดแชต LINE ของลูกค้าแล้ววางได้เลย')
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
