/**
 * Insurance Compare — เปรียบเทียบเบี้ยประกัน
 * Route: /insurance/compare
 *
 * เดิมหน้านี้มี INSURERS + QUOTE_MATRIX hardcoded (รายชื่อบริษัทประกันแยกจาก master data จริง
 * และตัวเลขเบี้ยผูกกับรุ่นรถปลอมที่ไม่มีในแคตตาล็อกจริง) แก้ให้:
 *  - รายชื่อบริษัทประกัน ดึงจาก getInsurers() (master data จริง — เหมือน Insurance.js ใช้)
 *  - รุ่นรถ ดึงจาก getVehicles() (แคตตาล็อกจริง — เหมือน QuotationCompare/QuotationBuilder ใช้)
 *  - อัตราเบี้ย/ค่าคอม/ความคุ้มครองต่อบริษัท เก็บใน Firestore 'insurance_rate_cards' — ตั้งค่าได้จริง
 *    ในหน้านี้ (CRUD จริง) ถ้ายังไม่ตั้งค่า จะไม่เดาตัวเลข แต่แจ้งให้ตั้งค่าก่อน (เหมือน BankPartners.js)
 *  - เบี้ยที่คำนวณ = ราคารถจริง × อัตราที่ตั้งค่าไว้ → เป็น "เบี้ยประมาณการ" ไม่ใช่ใบเสนอราคาจริงจากบริษัทประกัน
 *  - ปุ่ม "เสนอลูกค้า" สร้างบันทึกจริงใน 'insurance_proposals' เพื่อติดตามว่าเสนออะไรให้ใครไปแล้ว
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'
import { getInsurers } from '../../data/masterData.js'
import { getVehicles } from '../../data/vehicleDatabase.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default async function InsuranceComparePage(container) {
  const myGen = container.__routerGen

  const INSURERS = getInsurers()                       // ← master data จริง (Firestore-backed)
  const VEHICLES = getVehicles()                        // ← แคตตาล็อกจริง (Firestore-backed)
  const byPriceAsc = [...VEHICLES].sort((a, b) => (a.price || 0) - (b.price || 0))

  let rateCards = []
  let selectedVehicleId = byPriceAsc[0]?.id || ''
  let loading = true

  async function loadData() {
    loading = true
    try { rateCards = await listDocs('insurance_rate_cards', [], 'insurer', 'asc', 100) } catch { rateCards = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function cardFor(name) { return rateCards.find(r => r.insurer === name) || null }

  function estimateFor(name, vehicle) {
    const rc = cardFor(name)
    if (!rc || !rc.ratePct || !vehicle) return null
    const premium = Math.round(vehicle.price * (rc.ratePct / 100))
    const commAmt = Math.round(premium * (rc.commissionPct || 0) / 100)
    return { premium, commAmt }
  }

  function vehicleLabel(v) { return v ? `${v.brand} ${v.model} ${v.variant}`.trim() : '-' }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const vehicle = VEHICLES.find(v => v.id === selectedVehicleId) || byPriceAsc[0]
    const rows = INSURERS.map(name => ({ name, rc: cardFor(name), est: estimateFor(name, vehicle) }))
    const configured = rows.filter(r => r.est).sort((a, b) => a.est.premium - b.est.premium)
    const cheapest = configured[0] || null
    const bestComm = configured.length ? [...configured].sort((a, b) => b.est.commAmt - a.est.commAmt)[0] : null
    const brands = [...new Set(VEHICLES.map(v => v.brand))].sort()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚖️ Insurance Compare</div>
            <div class="page-subtitle">เปรียบเทียบเบี้ยประกันชั้น 1 — ${INSURERS.length} บริษัท (${configured.length} บริษัทตั้งค่าอัตราแล้ว)</div>
          </div>
        </div>

        <!-- Vehicle picker -->
        <div class="card" style="padding:12px 14px;margin-bottom:16px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🚗 เลือกรถที่ต้องการทำประกัน</div>
          <select class="input" id="veh-select" style="max-width:420px">
            ${brands.map(b => `<optgroup label="${escHtml(b)}">
              ${VEHICLES.filter(v => v.brand === b).map(v => `<option value="${v.id}" ${v.id === selectedVehicleId ? 'selected' : ''}>${escHtml(v.model)} ${escHtml(v.variant)} — ${formatCurrency(v.price)}</option>`).join('')}
            </optgroup>`).join('')}
          </select>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('💰 ถูกที่สุด', cheapest ? cheapest.name.replace('ประกันภัย', '') : '—', 'success')}
          ${kpi('💵 เบี้ยต่ำสุด', cheapest ? formatCurrency(cheapest.est.premium) : '—', 'primary')}
          ${kpi('🏆 คอมสูงสุด', bestComm ? bestComm.name.replace('ประกันภัย', '') + ' (' + formatCurrency(bestComm.est.commAmt) + ')' : '—', 'warning')}
        </div>

        <!-- Compare cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:14px">
          ${rows.map(r => {
            const isCheapest = cheapest && r.name === cheapest.name
            if (!r.rc || !r.est) {
              return `<div class="card" style="padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
                <div>
                  <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px">🏢 ${escHtml(r.name)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">ยังไม่ได้ตั้งค่าอัตราเบี้ยประกันสำหรับบริษัทนี้</div>
                </div>
                <button class="btn btn-xs btn-secondary rc-edit-btn" data-name="${escHtml(r.name)}" style="width:100%">⚙️ ตั้งค่าอัตรา</button>
              </div>`
            }
            const cov = r.rc
            return `<div class="card" style="padding:14px;border:2px solid ${isCheapest ? 'var(--success)' : 'transparent'}">
              ${isCheapest ? '<div style="font-size:0.62rem;font-weight:700;color:var(--success);margin-bottom:6px">👑 ถูกที่สุด</div>' : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="font-weight:700;font-size:0.85rem">🏢 ${escHtml(r.name)}</div>
                <button class="btn btn-xs btn-ghost rc-edit-btn" data-name="${escHtml(r.name)}" title="ตั้งค่าอัตรา">⚙️</button>
              </div>
              <div style="font-size:1.3rem;font-weight:900;color:var(--primary);margin-bottom:2px">${formatCurrency(r.est.premium)}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:10px">ต่อปี (ประมาณการจากอัตรา ${cov.ratePct}%) · คอม ${cov.commissionPct || 0}% = ${formatCurrency(r.est.commAmt)}</div>
              <div style="display:flex;flex-direction:column;gap:3px;font-size:0.7rem;margin-bottom:10px">
                ${covRow('🔧 ซ่อม', cov.repair || '-', cov.repair === 'ซ่อมศูนย์')}
                ${covRow('🌊 น้ำท่วม', cov.flood ? 'คุ้มครอง' : 'ไม่คุ้มครอง', !!cov.flood)}
                ${covRow('🔋 แบต EV', cov.evBattery ? 'คุ้มครอง' : 'ไม่คุ้มครอง', !!cov.evBattery)}
                ${covRow('🚨 ช่วยฉุกเฉิน', cov.roadside || '-', cov.roadside === '24 ชม.')}
                ${covRow('💸 ค่าเสียหายส่วนแรก', !cov.deduct ? 'ไม่มี' : formatCurrency(cov.deduct), !cov.deduct)}
              </div>
              <button class="btn btn-xs btn-primary propose-btn" data-name="${escHtml(r.name)}" style="width:100%">📄 เสนอลูกค้า</button>
            </div>`
          }).join('')}
        </div>

        <p style="font-size:0.7rem;color:var(--text-muted);padding-left:4px">💡 เบี้ยเป็น "ประมาณการ" คำนวณจากราคารถจริง × อัตราที่พนักงานตั้งค่าไว้ต่อบริษัท — ไม่ใช่ใบเสนอราคาจริงจากบริษัทประกัน กรุณายืนยันเบี้ยจริงกับบริษัทประกันก่อนปิดการขาย</p>
      </div>
    `

    document.getElementById('veh-select')?.addEventListener('change', e => { selectedVehicleId = e.target.value; renderPage() })
    container.querySelectorAll('.rc-edit-btn').forEach(b => b.addEventListener('click', () => openRateCardModal(b.dataset.name, cardFor(b.dataset.name))))
    container.querySelectorAll('.propose-btn').forEach(b => b.addEventListener('click', () => {
      const name = b.dataset.name
      const est = estimateFor(name, vehicle)
      if (!est) return
      openModal({
        title: '📄 เสนอประกันให้ลูกค้า',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="font-size:0.82rem">🏢 <strong>${escHtml(name)}</strong> — ${escHtml(vehicleLabel(vehicle))}<br>เบี้ยประมาณการ <strong style="color:var(--primary)">${formatCurrency(est.premium)}</strong>/ปี</div>
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="ins-customer"></div>
          <div class="input-group"><label class="input-label">ส่งทาง</label>
            <select class="input" id="ins-channel"><option>LINE</option><option>อีเมล</option><option>พิมพ์เอกสาร</option></select>
          </div>
        </div>`,
        confirmText: '📤 ส่งใบเสนอ',
        async onConfirm() {
          const custName = document.getElementById('ins-customer')?.value?.trim()
          const channel = document.getElementById('ins-channel')?.value || 'LINE'
          if (!custName) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
          try {
            await createDoc('insurance_proposals', {
              insurer: name, vehicleId: vehicle.id, vehicleLabel: vehicleLabel(vehicle),
              premium: est.premium, custName, channel, status: 'sent', sentAt: new Date().toISOString(),
            })
            showToast(`📤 ส่งใบเสนอประกัน ${name} ให้ ${custName} แล้ว`, 'success')
          } catch {
            showToast('❗ บันทึกใบเสนอไม่สำเร็จ', 'error')
            return false
          }
        }
      })
    }))
  }

  function openRateCardModal(name, existing) {
    const { el, close } = openModal({
      title: (existing ? '⚙️ แก้ไขอัตรา' : '⚙️ ตั้งค่าอัตรา') + ' — ' + name,
      size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">อัตราเบี้ย (% ของราคารถ) *</label><input class="input" type="number" step="0.01" id="rc-rate" value="${existing?.ratePct ?? ''}"></div>
          <div class="input-group"><label class="input-label">ค่าคอมมิชชั่น (%)</label><input class="input" type="number" step="0.1" id="rc-comm" value="${existing?.commissionPct ?? ''}"></div>
        </div>
        <div class="input-group"><label class="input-label">ประเภทการซ่อม</label>
          <select class="input" id="rc-repair">
            <option ${existing?.repair === 'ซ่อมศูนย์' ? 'selected' : ''}>ซ่อมศูนย์</option>
            <option ${existing?.repair === 'ซ่อมอู่' ? 'selected' : ''}>ซ่อมอู่</option>
          </select>
        </div>
        <div class="grid-2">
          <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem"><input type="checkbox" id="rc-flood" ${existing?.flood ? 'checked' : ''}> คุ้มครองน้ำท่วม</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem"><input type="checkbox" id="rc-ev" ${existing?.evBattery ? 'checked' : ''}> คุ้มครองแบต EV</label>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ช่วยฉุกเฉิน</label><input class="input" id="rc-roadside" placeholder="เช่น 24 ชม." value="${escHtml(existing?.roadside || '')}"></div>
          <div class="input-group"><label class="input-label">ค่าเสียหายส่วนแรก (บาท)</label><input class="input" type="number" id="rc-deduct" value="${existing?.deduct ?? 0}"></div>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="rc-c">ยกเลิก</button><button class="btn btn-primary" id="rc-s">💾 บันทึก</button>`
    })
    el.querySelector('#rc-c').addEventListener('click', close)
    el.querySelector('#rc-s').addEventListener('click', async () => {
      const ratePct = parseFloat(el.querySelector('#rc-rate').value)
      if (!ratePct || ratePct <= 0) { showToast('❗ กรุณาระบุอัตราเบี้ย', 'error'); return }
      const data = {
        insurer: name,
        ratePct,
        commissionPct: parseFloat(el.querySelector('#rc-comm').value) || 0,
        repair: el.querySelector('#rc-repair').value,
        flood: el.querySelector('#rc-flood').checked,
        evBattery: el.querySelector('#rc-ev').checked,
        roadside: el.querySelector('#rc-roadside').value.trim(),
        deduct: Number(el.querySelector('#rc-deduct').value) || 0,
      }
      try {
        if (existing) await updateDocData('insurance_rate_cards', existing.id, data)
        else await createDoc('insurance_rate_cards', data)
        showToast('✅ บันทึกอัตราแล้ว', 'success')
        close()
        await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function covRow(l, v, good) { return `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">${l}</span><span style="color:var(--${good ? 'success' : 'warning'})">${escHtml(v)}</span></div>` }
