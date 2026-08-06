/**
 * Commission Rules — ตั้งค่ากติกาคอมมิชชั่น
 * Route: /finance/commission-rules
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, getSalesData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

export const RULE_TYPES = {
  per_unit:  { label: 'ต่อคัน', icon: '🚗' },
  tiered:    { label: 'ขั้นบันได', icon: '📶' },
  percent:   { label: '% ของฐาน', icon: '📊' },
  bonus:     { label: 'โบนัสพิเศษ', icon: '🎁' },
}

// กติกาแบบ percent ต้องระบุว่า "% ของอะไร" ผ่านฟิลด์ base — ใช้ชุดคีย์เดียวกันทั้งไฟล์นี้และ Commission.js
// (ไฟล์ที่จ่ายค่าคอมจริง อ่านกติกาจากที่นี่โดยตรง ไม่มีสูตร % คงที่แยกไว้ต่างหากอีกแล้วตั้งแต่ v1.0.358)
export const PERCENT_BASES = {
  floor:     { label: 'กำไรส่วนเกิน floor price', field: 'overFloor' },
  sale:      { label: 'ยอดขายรถ',                field: 'saleTotal' },
  finance:   { label: 'ยอดจัดไฟแนนซ์',            field: 'financeTotal' },
  insurance: { label: 'ยอดขายประกัน',             field: 'insuranceTotal' },
  accessory: { label: 'ยอดขายอุปกรณ์',            field: 'accessoryTotal' },
}

// key คงที่ใช้อ้างอิง "บทบาท" ของกติกาแต่ละแบบใน calcCommission() — แยกจาก id เอกสารจริงใน Firestore
// (id เดิมแบบ 'CR001' เป็นแค่ label สมมติที่ localStorage เท่านั้น พอย้ายมาใช้ id จริงของ Firestore
// (สุ่มจริง ไม่ใช่ 'CR001' อีกต่อไป) จึงต้องมี key แยกไว้จับคู่ตรรกะการคำนวณ)
// เพิ่ม finance_percent/insurance_percent/accessory_percent (v1.0.358) — ย้ายมาจากอัตราคงที่ที่เคยฝังตรง
// ใน Commission.js (2%/5%/10%) ให้ตั้งค่า/ปรับได้จริงที่นี่จุดเดียวแทน ตามที่แต่ละบริษัทมีสูตรจ่ายต่างกัน
export const BASE_RULES = [
  { key: 'per_unit_base', name: 'คอมพื้นฐานต่อคัน', type: 'per_unit', detail: 'ขายได้ 1 คัน = 5,000 บาท (ทุกรุ่น)', value: 5000, active: true, appliesTo: 'เซลส์ทุกคน' },
  { key: 'tiered_monthly', name: 'ขั้นบันไดรายเดือน', type: 'tiered', detail: '', value: 0, active: true, appliesTo: 'เซลส์ทุกคน',
    tiers: [{ from: 1, to: 3, amt: 5000 }, { from: 4, to: 6, amt: 7000 }, { from: 7, to: 99, amt: 10000 }] },
  { key: 'premium_bonus', name: 'โบนัสรุ่น Premium', type: 'bonus', detail: 'BYD Seal / Han เพิ่มอีก 3,000/คัน', value: 3000, active: true, appliesTo: 'เซลส์ทุกคน' },
  { key: 'floor_percent', name: 'คอมจากกำไรส่วนเกิน', type: 'percent', base: 'floor', detail: 'ขายเกิน floor price ได้ 20% ของส่วนต่าง', value: 20, active: true, appliesTo: 'Senior Sales' },
  { key: 'finance_percent', name: 'คอมไฟแนนซ์', type: 'percent', base: 'finance', detail: '2% ของยอดจัดไฟแนนซ์', value: 2, active: true, appliesTo: 'เซลส์ทุกคน' },
  { key: 'insurance_percent', name: 'คอมประกัน', type: 'percent', base: 'insurance', detail: '5% ของยอดขายประกัน', value: 5, active: false, appliesTo: 'เซลส์ทุกคน' },
  { key: 'accessory_percent', name: 'คอมอุปกรณ์', type: 'percent', base: 'accessory', detail: '10% ของยอดขายอุปกรณ์', value: 10, active: false, appliesTo: 'เซลส์ทุกคน' },
  { key: 'team_bonus', name: 'โบนัสปิดเป้าทีม', type: 'bonus', detail: 'ทีมถึงเป้าเดือน ทุกคนรับเพิ่ม 2,000', value: 2000, active: false, appliesTo: 'ทีมขายทั้งทีม' },
]

const SIM_PRESETS = [
  { units: 3, premium: 1, overFloor: 0 },
  { units: 6, premium: 2, overFloor: 30000 },
  { units: 9, premium: 3, overFloor: 80000 },
]

// เดิมกติกาคอมมิชชั่นทั้งหมด (toggle/แก้ไข/เพิ่ม/reset) เก็บใน localStorage เครื่องเดียวเท่านั้น แม้จะมี
// collection 'commission_rules' ใน Firestore จริงอยู่แล้วก็ใช้แค่ตอน seed ครั้งแรกครั้งเดียว ไม่เคยเขียนกลับเลย
// ทำให้พนักงานการเงินคนละเครื่องเห็นกติกาคอมมิชชั่นไม่ตรงกัน (กติกาที่ใช้จำลอง/อ้างอิงจริงต่างกันไปตามเครื่อง)
// ตอนนี้ทุกกติกาเป็นเอกสารจริงใน Firestore แต่ละใบ อ่าน/เขียนตรงเสมอ ไม่มี localStorage อีกต่อไป
async function seedBaseRules() {
  const created = []
  for (const r of BASE_RULES) {
    const payload = { ...r }
    if (r.tiers) payload.tiers = r.tiers.map(t => ({ ...t })); else delete payload.tiers
    const id = await createDoc('commission_rules', payload)
    created.push({ ...payload, id })
  }
  return created
}

function buildTierDetail(tiers) {
  return tiers.map(t => `คันที่ ${t.from}${t.to >= 99 ? t.from + '+' : '-' + t.to}: ${t.amt.toLocaleString()}`).join(' · ')
}

// เครื่องมือคำนวณกลาง — ใช้ทั้งหน้านี้ (จำลอง/ประมาณยอดจ่ายเดือนนี้) และ Commission.js (จ่ายค่าคอมจริง)
// input: { units, premiumUnits, overFloor, saleTotal, financeTotal, insuranceTotal, accessoryTotal }
// คืนค่า breakdown เป็น [label, amount] คู่ — จำนวนรายการไม่คงที่ ขึ้นกับว่ากติกาไหน active/มีฐานคำนวณ > 0
// บ้าง (แต่ละบริษัทเปิด/ปิดกติกาต่างกันได้จริงผ่านหน้านี้ ไม่ผูกสูตรตายตัวเหมือนก่อน v1.0.358)
export function calcCommission(input, rules) {
  const { units = 0, premiumUnits = 0, overFloor = 0, saleTotal = 0, financeTotal = 0, insuranceTotal = 0, accessoryTotal = 0 } = input || {}
  let total = 0
  const breakdown = []
  const tiered = rules.find(r => r.key === 'tiered_monthly' && r.active && r.tiers)
  if (tiered) {
    let amt = 0
    for (let u = 1; u <= units; u++) {
      const tier = tiered.tiers.find(t => u >= t.from && u <= t.to)
      amt += tier?.amt || 0
    }
    if (units > 0) { total += amt; breakdown.push(['ขั้นบันได (' + units + ' คัน)', amt]) }
  } else {
    const base = rules.find(r => r.key === 'per_unit_base' && r.active)
    if (base && units > 0) {
      const amt = units * (base.value || 5000)
      total += amt; breakdown.push(['พื้นฐาน (' + units + ' คัน)', amt])
    }
  }
  const bonus = rules.find(r => r.key === 'premium_bonus' && r.active)
  if (bonus && premiumUnits > 0) {
    const amt = premiumUnits * (bonus.value || 3000)
    total += amt; breakdown.push(['โบนัส Premium (' + premiumUnits + ' คัน)', amt])
  }
  // กติกา percent ทุกตัว (ไม่จำกัดแค่ floor_percent ตัวเดียวเหมือนก่อน) — วนตามฐานที่ระบุใน PERCENT_BASES
  const baseAmounts = { floor: overFloor, sale: saleTotal, finance: financeTotal, insurance: insuranceTotal, accessory: accessoryTotal }
  rules.filter(r => r.type === 'percent' && r.active).forEach(r => {
    const baseKey = r.base || 'floor' // เอกสารเก่าก่อน v1.0.358 (floor_percent) ยังไม่มีฟิลด์ base — ถือเป็น floor เดิม
    const baseAmt = baseAmounts[baseKey] || 0
    if (baseAmt <= 0) return
    const amt = Math.round(baseAmt * (r.value || 0) / 100)
    if (amt <= 0) return
    total += amt
    breakdown.push([escapeLabel(r.name) + ' (' + (r.value || 0) + '% ' + (PERCENT_BASES[baseKey]?.label || '') + ')', amt])
  })
  return { total, breakdown, breakdownRows: breakdown.map(([label, amount]) => ({ label, amount })) }
}

// ป้องกันชื่อกติกาที่แอดมินตั้งเองมี HTML แปลกๆ หลุดเข้า label ของ breakdown (ใช้ต่อใน printCommissionSlip
// ที่ escape เองอีกชั้นอยู่แล้ว แต่ป้องกันไว้ตั้งแต่ต้นทางดีกว่า)
function escapeLabel(s) { return String(s ?? '').replace(/</g, '‹').replace(/>/g, '›') }

// โหลดกติกาจริงจาก Firestore — seed ค่าเริ่มต้นถ้ายังไม่มีเลย และ "backfill" กติกาใหม่ที่เพิ่มเข้ามาทีหลัง
// (finance/insurance/accessory percent, v1.0.358) ให้บริษัทที่เคย seed กติกาไปแล้วก่อนหน้านี้ด้วย โดยไม่แก้/
// ลบกติกาที่มีอยู่แล้วหรือที่แอดมินปรับเองไปแล้วเลย — เพิ่มเฉพาะ key ที่ยังไม่มีจริงๆเท่านั้น
export async function loadOrSeedRules() {
  let rules = []
  try { rules = await listDocs('commission_rules', [], 'name', 'asc', 100) } catch { rules = [] }
  rules = rules.map(d => ({ ...d, key: d.key || BASE_RULES.find(b => b.name === d.name)?.key }))
  if (!rules.length) return await seedBaseRules()
  const existingKeys = new Set(rules.map(r => r.key).filter(Boolean))
  const missing = BASE_RULES.filter(r => !existingKeys.has(r.key))
  for (const r of missing) {
    try {
      const payload = { ...r }
      if (r.tiers) payload.tiers = r.tiers.map(t => ({ ...t })); else delete payload.tiers
      const id = await createDoc('commission_rules', payload)
      rules.push({ ...payload, id })
    } catch { /* ข้ามกติกาที่บันทึกไม่สำเร็จ — ไม่ให้ทั้งหน้าพังเพราะกติกาเสริมตัวเดียว */ }
  }
  return rules
}

export default async function CommissionRulesPage(container) {
  const myGen = container.__routerGen
  let rules = []
  let sim = { units: 6, premium: 2, overFloor: 30000, financeTotal: 0, insuranceTotal: 0, accessoryTotal: 0 }
  let dataSource = 'demo'
  let thisMonthPaid = 0

  try {
    const [docs, sales] = await Promise.all([
      loadOrSeedRules().catch(() => []),
      getSalesData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    rules = docs
    dataSource = 'live'
    // Estimate total commission paid this month from sales data
    const thisMonth = new Date().toISOString().slice(0, 7)
    const monthSales = sales.filter(s => (s.date || '').startsWith(thisMonth))
    if (monthSales.length) {
      const byPerson = {}
      monthSales.forEach(s => {
        const n = s.salesperson || s.salesName || 'unknown'
        if (!byPerson[n]) byPerson[n] = { units: 0, premiumUnits: 0, overFloor: 0, saleTotal: 0, financeTotal: 0, insuranceTotal: 0, accessoryTotal: 0 }
        const p = byPerson[n]
        p.units++
        const model = (s.model || '').toLowerCase()
        if (model.includes('seal') || model.includes('han') || model.includes('atto')) p.premiumUnits++
        const diff = Math.max(0, (s.salePrice || 0) - (s.floor || s.cost || s.salePrice || 0))
        p.overFloor += diff
        // financeTotal = ยอดจัดไฟแนนซ์ (loan amount, field s.financeAmount) — ไม่ใช่ s.finance ที่จริงๆคือ
        // ค่าคอมไฟแนนซ์จริงที่กรอกต่อใบจอง (comFinance, คนละความหมายกัน) ให้ตรงกับที่ getCommissionData()
        // ใช้ชื่อ "financeTotal" อยู่แล้ว (ผลรวม financeAmount) เพื่อคง % ของยอดจัดไฟแนนซ์แบบเดิม
        p.saleTotal += s.salePrice || 0; p.financeTotal += s.financeAmount || 0
        p.insuranceTotal += s.insurance || 0; p.accessoryTotal += s.accessory || 0
      })
      Object.values(byPerson).forEach(p => { thisMonthPaid += calcCommission(p, rules).total })
    }
  } catch {}

  function renderPage() {
    const activeCount = rules.filter(r => r.active).length
    const result = calcCommission({ units: sim.units, premiumUnits: sim.premium, overFloor: sim.overFloor, financeTotal: sim.financeTotal, insuranceTotal: sim.insuranceTotal, accessoryTotal: sim.accessoryTotal }, rules)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚙️ Commission Rules</div>
            <div class="page-subtitle">ตั้งค่ากติกาคอมมิชชั่น + จำลองการคำนวณ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="reset-btn">↩ Reset</button>
            <button class="btn btn-primary" id="add-rule-btn">+ เพิ่มกติกา</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⚙️ กติกาทั้งหมด', rules.length, 'primary')}
          ${kpi('✅ ใช้งานอยู่', activeCount, 'success')}
          ${kpi('🧮 จำลอง', formatCurrency(result.total), 'warning')}
          ${kpi('💸 เดือนนี้จ่ายไป', thisMonthPaid > 0 ? formatCurrency(thisMonthPaid) : '—', 'accent')}
        </div>

        <div style="display:grid;grid-template-columns:3fr 2fr;gap:14px">
          <!-- Rules list -->
          <div style="display:flex;flex-direction:column;gap:8px">
            ${rules.map(r => {
              const rt = RULE_TYPES[r.type]
              const detail = r.type === 'tiered' && r.tiers ? buildTierDetail(r.tiers) : r.detail
              return `<div class="card" style="padding:12px 14px${r.active ? '' : ';opacity:0.5'}">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:0.85rem">${rt?.icon || '⚙️'} ${escHtml(r.name)}${r.type === 'percent' ? ` <span style="font-size:0.6rem;padding:1px 5px;border-radius:6px;background:var(--surface-2);color:var(--text-muted);font-weight:600">${r.value || 0}% ของ${escHtml(PERCENT_BASES[r.base || 'floor']?.label || '-')}</span>` : ''}</div>
                    <div style="font-size:0.71rem;color:var(--text-muted);margin-top:2px;line-height:1.4">${detail ? escHtml(detail) : '—'}</div>
                    <div style="font-size:0.67rem;color:var(--text-muted);margin-top:2px">👥 ${escHtml(r.appliesTo)}</div>
                  </div>
                  <div style="display:flex;gap:4px;flex-shrink:0;padding-top:2px">
                    <button class="btn btn-xs btn-secondary edit-btn" data-id="${escHtml(r.id)}" title="แก้ไขกติกา">✏️</button>
                    <button class="btn btn-xs ${r.active ? 'btn-success' : 'btn-secondary'} toggle-btn" data-id="${escHtml(r.id)}">${r.active ? '✅' : '⏸'}</button>
                  </div>
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- Simulator -->
          <div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🧮 จำลองคอมมิชชั่น</div>
              <div style="display:grid;gap:10px;margin-bottom:12px">
                <div class="input-group"><label class="input-label">ขายได้ (คัน/เดือน)</label><input class="input" type="number" id="sim-units" min="0" value="${sim.units}"></div>
                <div class="input-group"><label class="input-label">รุ่น Premium (คัน)</label><input class="input" type="number" id="sim-premium" min="0" value="${sim.premium}"></div>
                <div class="input-group"><label class="input-label">เกิน floor รวม (฿)</label><input class="input" type="number" id="sim-over" min="0" value="${sim.overFloor}"></div>
                <div class="input-group"><label class="input-label">ยอดจัดไฟแนนซ์รวม (฿)</label><input class="input" type="number" id="sim-fin" min="0" value="${sim.financeTotal}"></div>
                <div class="input-group"><label class="input-label">ยอดขายประกันรวม (฿)</label><input class="input" type="number" id="sim-ins" min="0" value="${sim.insuranceTotal}"></div>
                <div class="input-group"><label class="input-label">ยอดขายอุปกรณ์รวม (฿)</label><input class="input" type="number" id="sim-acc" min="0" value="${sim.accessoryTotal}"></div>
                <button class="btn btn-primary" id="sim-btn">🧮 คำนวณ</button>
              </div>
              <div style="display:flex;gap:4px;margin-bottom:12px">
                ${SIM_PRESETS.map((p, i) => `<button class="btn btn-xs btn-secondary preset-btn" data-i="${i}">${p.units} คัน</button>`).join('')}
              </div>
              <div style="border-top:1px solid var(--border);padding-top:10px">
                ${result.breakdown.map(([l, v]) => `
                  <div style="display:flex;justify-content:space-between;font-size:0.76rem;padding:4px 0">
                    <span style="color:var(--text-muted)">${escHtml(l)}</span><span>${formatCurrency(v)}</span>
                  </div>`).join('')}
                <div style="display:flex;justify-content:space-between;font-weight:900;font-size:0.95rem;padding-top:8px;border-top:1px solid var(--border);margin-top:6px">
                  <span>รวม</span><span style="color:var(--success)">${formatCurrency(result.total)}</span>
                </div>
              </div>
            </div>
            <!-- Tier reference -->
            ${(() => {
              const t = rules.find(r => r.key === 'tiered_monthly' && r.tiers)
              if (!t) return ''
              return `<div class="card" style="padding:12px 14px">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📶 ตารางขั้นบันได</div>
                ${t.tiers.map(tier => `
                  <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;border-bottom:1px solid var(--border)">
                    <span style="color:var(--text-muted)">คันที่ ${tier.from}${tier.to >= 99 ? '+' : '–' + tier.to}</span>
                    <span style="font-weight:700;color:var(--success)">${formatCurrency(tier.amt)}</span>
                  </div>`).join('')}
              </div>`
            })()}
          </div>
        </div>
      </div>
    `

    // Toggle active/inactive
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', async () => {
      const r = rules.find(x => x.id === b.dataset.id)
      if (!r) return
      const active = !r.active
      try { await updateDocData('commission_rules', r.id, { active }) } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return }
      r.active = active
      renderPage()
    }))

    // Edit rule inline
    container.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => {
      const r = rules.find(x => x.id === b.dataset.id)
      if (!r) return
      const rt = RULE_TYPES[r.type]
      let bodyHtml = `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อกติกา</label><input class="input" id="er-name" value="${escHtml(r.name)}"></div>
        <div class="input-group"><label class="input-label">ใช้กับ</label><input class="input" id="er-applies" value="${escHtml(r.appliesTo)}"></div>`
      if (r.type === 'tiered' && r.tiers) {
        bodyHtml += `<div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-top:4px">📶 ค่าคอมต่อขั้น (บาท)</div>`
        r.tiers.forEach((t, i) => {
          const label = t.to >= 99 ? `คันที่ ${t.from}+` : `คันที่ ${t.from}–${t.to}`
          bodyHtml += `<div class="input-group"><label class="input-label">${label}</label>
            <input class="input" type="number" id="er-tier-${i}" value="${t.amt}" step="500" min="0"></div>`
        })
      } else if (r.type === 'percent') {
        bodyHtml += `<div class="input-group"><label class="input-label">% ของ</label>
          <select class="input" id="er-base">${Object.entries(PERCENT_BASES).map(([k,v]) => `<option value="${k}"${(r.base||'floor')===k?' selected':''}>${v.label}</option>`).join('')}</select></div>` +
          `<div class="input-group"><label class="input-label">เปอร์เซ็นต์ (%)</label>
          <input class="input" type="number" id="er-value" value="${r.value}" step="0.5" min="0" max="100"></div>`
      } else {
        bodyHtml += `<div class="input-group"><label class="input-label">ค่าคอม (บาท/คัน)</label>
          <input class="input" type="number" id="er-value" value="${r.value}" step="500" min="0"></div>`
      }
      bodyHtml += `<div class="input-group"><label class="input-label">รายละเอียด</label>
        <input class="input" id="er-detail" value="${escHtml(r.detail || '')}"></div></div>`

      openModal({
        title: '✏️ แก้ไข: ' + (rt?.icon || '') + ' ' + escHtml(r.name),
        size: 'sm',
        body: bodyHtml,
        async onConfirm() {
          const updated = { name: r.name, appliesTo: r.appliesTo, detail: r.detail, value: r.value, tiers: r.tiers }
          updated.name = document.getElementById('er-name')?.value?.trim() || r.name
          updated.appliesTo = document.getElementById('er-applies')?.value?.trim() || r.appliesTo
          updated.detail = document.getElementById('er-detail')?.value?.trim()
          if (r.type === 'tiered' && r.tiers) {
            updated.tiers = r.tiers.map((t, i) => {
              const v = parseInt(document.getElementById('er-tier-' + i)?.value)
              return !isNaN(v) && v >= 0 ? { ...t, amt: v } : t
            })
          } else {
            const v = parseFloat(document.getElementById('er-value')?.value)
            updated.value = !isNaN(v) && v >= 0 ? v : r.value
            if (r.type === 'percent') updated.base = document.getElementById('er-base')?.value || r.base || 'floor'
          }
          try { await updateDocData('commission_rules', r.id, updated) } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
          Object.assign(r, updated)
          showToast('✅ บันทึกกติกาแล้ว', 'success')
          renderPage()
        }
      })
    }))

    // Simulator calculate
    document.getElementById('sim-btn')?.addEventListener('click', () => {
      sim.units = parseInt(document.getElementById('sim-units')?.value) || 0
      sim.premium = parseInt(document.getElementById('sim-premium')?.value) || 0
      sim.overFloor = parseInt(document.getElementById('sim-over')?.value) || 0
      sim.financeTotal = parseInt(document.getElementById('sim-fin')?.value) || 0
      sim.insuranceTotal = parseInt(document.getElementById('sim-ins')?.value) || 0
      sim.accessoryTotal = parseInt(document.getElementById('sim-acc')?.value) || 0
      renderPage()
    })
    container.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => {
      sim = { financeTotal: 0, insuranceTotal: 0, accessoryTotal: 0, ...SIM_PRESETS[parseInt(b.dataset.i)] }; renderPage()
    }))

    // Add new rule
    document.getElementById('add-rule-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่มกติกาคอมมิชชั่น',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อกติกา *</label><input class="input" id="cr-name" placeholder="เช่น โบนัสรุ่นใหม่"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="cr-type">${Object.entries(RULE_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group" id="cr-base-wrap" style="display:none"><label class="input-label">% ของ</label>
            <select class="input" id="cr-base">${Object.entries(PERCENT_BASES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ค่าคอม (บาท หรือ %)</label><input class="input" type="number" id="cr-value" value="0" min="0"></div>
          <div class="input-group"><label class="input-label">รายละเอียด</label><input class="input" id="cr-detail" placeholder="อธิบายเงื่อนไข..."></div>
          <div class="input-group"><label class="input-label">ใช้กับ</label><input class="input" id="cr-applies" value="เซลส์ทุกคน"></div>
        </div>`,
        async onConfirm() {
          const name = document.getElementById('cr-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
          const type = document.getElementById('cr-type')?.value || 'per_unit'
          const data = {
            name, type,
            detail: document.getElementById('cr-detail')?.value || '',
            value: parseFloat(document.getElementById('cr-value')?.value) || 0,
            active: true,
            appliesTo: document.getElementById('cr-applies')?.value || 'เซลส์ทุกคน',
          }
          if (type === 'percent') data.base = document.getElementById('cr-base')?.value || 'floor'
          let id
          try { id = await createDoc('commission_rules', data) } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
          rules.push({ id, ...data })
          showToast('✅ เพิ่มกติกาแล้ว', 'success')
          renderPage()
        }
      })
      document.getElementById('cr-type')?.addEventListener('change', e => {
        document.getElementById('cr-base-wrap').style.display = e.target.value === 'percent' ? '' : 'none'
      })
    })

    // Reset to default
    document.getElementById('reset-btn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Reset กติกา', message: 'Reset กติกาทั้งหมดกลับค่าเริ่มต้น? (จะลบกติกาที่เพิ่มเองทั้งหมดด้วย)', confirmText: 'Reset', danger: true })
      if (!ok) return
      try {
        await Promise.all(rules.map(r => softDelete('commission_rules', r.id)))
        rules = await seedBaseRules()
      } catch { showToast('Reset ไม่สำเร็จ', 'error'); return }
      showToast('↩ Reset แล้ว', 'warning')
      renderPage()
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
