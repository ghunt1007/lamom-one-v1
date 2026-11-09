/**
 * Floor Plan Finance — สินเชื่อสต็อกรถ (Stocking Loan)
 * Route: /dms/floorplan
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, setDocData, seedDemoData } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { escHtml } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'
import { addDaysBangkok as addDays } from '../../utils/format.js'
import { carOf } from '../../utils/carLabel.js'

// (v1.0.951) เดิมวงเงิน ฿50 ล้าน @ 6.5% เป็นตัวเลขตายตัวในโค้ด (ไม่ใช่วงเงินจริงของบริษัท) ตอนนี้ตั้งเองได้
// เก็บใน floor_plan/settings-<companyId> (kind:'settings', drawDate '9999-12-31' ให้ติดอันดับแรกของ query เสมอ)
// ยังไม่ตั้ง = วงเงิน 0 (ไม่จำกัดตอนเบิก) ดอกเบี้ยเริ่มต้น 6.5%
let FP_RATE = 6.5 // % ต่อปี
let CREDIT_LINE = 0
export function splitFloorPlanDocs(docs) {
  const cfg = docs.find(d => d.kind === 'settings') || null
  return { cfg, units: docs.filter(d => d.kind !== 'settings') }
}

function daysHeld(u) { return Math.round((new Date() - new Date(u.drawDate)) / 86400000) }
function interestAccrued(u) { return Math.round(u.principal * (FP_RATE / 100) * daysHeld(u) / 365) }

export default async function FloorPlanFinancePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let units = []
  let cfg = null
  let loading = true

  async function loadData() {
    loading = true
    let docs = []
    try { docs = await listDocs('floor_plan', companyScopeFilters(), 'drawDate', 'desc', 200) } catch (e) { docs = [] }
    const split = splitFloorPlanDocs(docs)
    units = split.units
    cfg = split.cfg
    CREDIT_LINE = Number(cfg?.creditLine) || 0
    FP_RATE = cfg && Number(cfg.rate) >= 0 && cfg.rate !== '' ? Number(cfg.rate) : 6.5
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const active = units.filter(u => u.status === 'active')
    const outstanding = active.reduce((a, u) => a + u.principal, 0)
    const totalInterest = active.reduce((a, u) => a + interestAccrued(u), 0)
    const available = CREDIT_LINE ? CREDIT_LINE - outstanding : Infinity
    const utilization = CREDIT_LINE ? Math.round(outstanding / CREDIT_LINE * 100) : 0
    const aging = active.filter(u => daysHeld(u) > 120)
    const dailyInterest = Math.round(active.reduce((a, u) => a + u.principal * (FP_RATE/100) / 365, 0))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Floor Plan Finance</div>
            <div class="page-subtitle">สินเชื่อสต็อกรถ — ${CREDIT_LINE ? `วงเงิน ${formatCurrency(CREDIT_LINE)}` : 'ยังไม่ได้ตั้งวงเงิน'} @ ${FP_RATE}%/ปี${cfg ? '' : ' (ค่าเริ่มต้น)'}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="fp-cfg-btn">⚙️ ตั้งวงเงิน/ดอกเบี้ย</button>
            <button class="btn btn-primary" id="draw-btn">+ เบิกวงเงิน (รถเข้าใหม่)</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 ยอดเบิกคงค้าง', formatCurrency(outstanding), 'warning')}
          ${kpi('📊 ใช้วงเงิน', CREDIT_LINE ? utilization + '%' : '—', utilization >= 80 ? 'danger' : utilization >= 60 ? 'warning' : 'success')}
          ${kpi('💸 ดอกเบี้ยสะสม', formatCurrency(totalInterest), 'danger')}
          ${kpi('🔥 ดอกเบี้ย/วัน', formatCurrency(dailyInterest), 'secondary')}
        </div>

        <!-- Credit line bar -->
        ${CREDIT_LINE ? `<div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:4px">
            <span style="color:var(--text-muted)">วงเงินคงเหลือ ${formatCurrency(available)}</span>
            <span>${formatCurrency(outstanding)} / ${formatCurrency(CREDIT_LINE)}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:4px;height:12px">
            <div style="width:${Math.min(utilization, 100)}%;background:var(--${utilization>=80?'danger':utilization>=60?'warning':'primary'});height:12px;border-radius:4px"></div>
          </div>
        </div>` : ''}

        ${aging.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🔥 <strong>รถค้างเกิน 120 วัน (ดอกเบี้ยกินกำไร):</strong> ${aging.map(u => `${escHtml(u.model)} (${daysHeld(u)} วัน — ดอกแล้ว ${formatCurrency(interestAccrued(u))})`).join(' · ')} — เร่งขาย/ลดราคา!
          </div>
        ` : ''}

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">รถ</th>
                <th style="padding:8px 10px;text-align:right">เงินต้น</th>
                <th style="padding:8px 10px;text-align:right">ถือมา (วัน)</th>
                <th style="padding:8px 10px;text-align:right">ดอกเบี้ยสะสม</th>
                <th style="padding:8px 10px;text-align:right">ดอก/วัน</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${units.map(u => {
                const days = daysHeld(u)
                const interest = interestAccrued(u)
                const perDay = Math.round(u.principal * (FP_RATE/100) / 365)
                const isAging = days > 120 && u.status === 'active'
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${u.status==='paid'?';opacity:0.5':''}${isAging?';background:var(--danger)08':''}">
                  <td style="padding:8px 14px">
                    <div style="font-weight:600">${escHtml(u.model)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">VIN ${escHtml(u.vin)} · เบิก ${formatDate(u.drawDate)}</div>
                  </td>
                  <td style="padding:8px 10px;text-align:right">${formatCurrency(u.principal)}</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--${days>120?'danger':days>90?'warning':'text-muted'})">${days}${isAging?' 🔥':''}</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--danger)">${u.status==='active'?formatCurrency(interest):'—'}</td>
                  <td style="padding:8px 10px;text-align:right;font-size:0.72rem;color:var(--text-muted)">${u.status==='active'?formatCurrency(perDay):'—'}</td>
                  <td style="padding:8px 14px;text-align:right">
                    ${u.status === 'active' ? `<button class="btn btn-xs btn-success payoff-btn" data-id="${u.id}">💵 ขายแล้ว — ปิดยอด</button>` : '<span class="badge badge-success" style="font-size:0.6rem">✅ ปิดแล้ว</span>'}
                  </td>
                </tr>`
              }).join('')}
              ${!units.length ? `<tr><td colspan="6" class="tbl-empty" style="text-align:center;padding:28px;color:var(--text-muted)">ยังไม่มีรถที่เบิกวงเงิน — กด "+ เบิกวงเงิน" ตอนรถเข้าสต็อก</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 ขายรถแล้วต้องปิดยอด Floor Plan ภายใน 3 วันทำการ — ดอกเบี้ยคิดรายวันจนกว่าจะปิด</p>
      </div>
    `

    container.querySelectorAll('.payoff-btn').forEach(b => b.addEventListener('click', () => {
      const u = units.find(x => x.id === b.dataset.id)
      if (u) openModal({
        title: '💵 ปิดยอด Floor Plan',
        size: 'sm',
        body: `<div style="font-size:0.82rem;line-height:1.8">
          <div style="display:flex;justify-content:space-between"><span>${escHtml(u.model)}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">เงินต้น</span><strong>${formatCurrency(u.principal)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">ดอกเบี้ย ${daysHeld(u)} วัน</span><strong style="color:var(--danger)">${formatCurrency(interestAccrued(u))}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:6px"><span>ยอดปิดรวม</span><strong style="color:var(--primary)">${formatCurrency(u.principal + interestAccrued(u))}</strong></div>
        </div>`,
        confirmText: '💵 โอนปิดยอด',
        async onConfirm() {
          try {
            await updateDocData('floor_plan', u.id, { status: 'paid', sold: true })
            showToast(`✅ ปิดยอด ${formatCurrency(u.principal + interestAccrued(u))} แล้ว — วงเงินคืนกลับ`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    document.getElementById('fp-cfg-btn')?.addEventListener('click', () => {
      openModal({
        title: '⚙️ วงเงินสินเชื่อสต็อก',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">วงเงินรวม (บาท)</label><input class="input" type="number" inputmode="numeric" id="fp-cfg-line" value="${CREDIT_LINE || ''}" placeholder="เช่น 50000000"></div>
          <div class="input-group"><label class="input-label">ดอกเบี้ย (% ต่อปี)</label><input class="input" type="number" inputmode="decimal" step="0.01" id="fp-cfg-rate" value="${FP_RATE}"></div>
        </div>`,
        confirmText: '💾 บันทึก',
        async onConfirm() {
          const creditLine = parseInt(document.getElementById('fp-cfg-line')?.value) || 0
          const rate = parseFloat(document.getElementById('fp-cfg-rate')?.value)
          if (!(rate >= 0 && rate < 50)) { showToast('❗ ดอกเบี้ยไม่ถูกต้อง', 'error'); return false }
          const companyId = myEffectiveCompanyId()
          try {
            await setDocData('floor_plan', cfg?.id || `settings-${companyId || 'none'}`, { kind: 'settings', status: 'settings', drawDate: '9999-12-31', creditLine, rate, companyId: cfg?.companyId ?? companyId })
            showToast('✅ บันทึกวงเงินแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        }
      })
    })
    document.getElementById('draw-btn')?.addEventListener('click', async () => {
      // (v1.0.519) เดิมฟอร์มนี้กรอกรุ่นรถเป็น free text เอง และ hardcode vin:'...ใหม่' เสมอ (ไม่เคยผูกกับรถจริง
      // ใน 'vehicles' เลยตั้งแต่แรก แม้ schema ของ floor_plan จะมี field vin อยู่แล้วก็ตาม) แก้ให้ต้องเลือกรถจริง
      // จากสต็อกเหมือนแพทเทิร์นเดียวกับ PDI.js แล้วเก็บ vehicleId+vin จริง พร้อม auto-stamp floorPlanCutDate
      // กลับไปที่ vehicle doc นั้นตอนเบิกสำเร็จ (ไทม์ไลน์รถในหน้าสต็อกจะเห็นวันตัดฟอร์แพลนจริง)
      let stockVehicles = []
      try { stockVehicles = (await listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 300)).filter(v => !v.deleted) } catch (e) { stockVehicles = [] }
      openModal({
        title: '+ เบิกวงเงิน (รถเข้าสต็อกใหม่)',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">เลือกรถจากสต็อกจริง *</label>
            <select class="input" id="fp-vehicle">
              <option value="">— เลือกรถ —</option>
              ${stockVehicles.map(v => `<option value="${escHtml(v.id)}">${escHtml(carOf(v, true))} · VIN ${escHtml((v.vin||'').slice(-6)||'-')}</option>`).join('')}
            </select>
            <span class="input-error" id="fp-vehicle-e"></span>
          </div>
          <div class="input-group"><label class="input-label">ราคาทุน (บาท)</label><input class="input" type="number" inputmode="numeric" id="fp-amount"></div>
          ${CREDIT_LINE ? `<div style="font-size:0.72rem;color:var(--text-muted)">วงเงินคงเหลือ: <strong>${formatCurrency(available)}</strong></div>` : ''}
        </div>`,
        async onConfirm() {
          const vehicleId = document.getElementById('fp-vehicle')?.value
          const vehicle = stockVehicles.find(v => v.id === vehicleId)
          const amount = parseInt(document.getElementById('fp-amount')?.value) || 0
          if (!vehicle) { document.getElementById('fp-vehicle-e').textContent = 'กรุณาเลือกรถจากสต็อก'; return false }
          if (amount <= 0) { showToast('❗ กรอกข้อมูลให้ครบ', 'error'); return false }
          if (amount > available) { showToast('❗ เกินวงเงินคงเหลือ', 'error'); return false }
          try {
            const drawDate = addDays(0)
            await createDoc('floor_plan', {
              vehicleId: vehicle.id, model: `${vehicle.brand||''} ${vehicle.model||''}`.trim(), vin: vehicle.vin || '',
              principal:amount, drawDate, status:'active', sold:false, companyId: myEffectiveCompanyId(),
            })
            try { await updateDocData('vehicles', vehicle.id, { floorPlanCutDate: drawDate }) } catch (e) { /* ไม่กระทบยอดเบิกที่บันทึกไปแล้ว */ }
            showToast(`✅ เบิก ${formatCurrency(amount)} แล้ว — ดอกเบี้ยเริ่มเดินวันนี้`, 'warning')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
      // เลือกรถแล้วเติมราคาทุนให้เลย (ยังแก้เองได้)
      document.getElementById('fp-vehicle')?.addEventListener('change', e => {
        const v = stockVehicles.find(x => x.id === e.target.value)
        const amt = document.getElementById('fp-amount')
        const cost = Number(v?.cost || v?.purchasePrice) || 0
        if (amt && cost && !amt.value) amt.value = cost
      })
    })
  }

  await loadData()
}

