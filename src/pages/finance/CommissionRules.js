/**
 * Commission Rules — ตั้งค่ากติกาคอมมิชชั่น
 * Route: /finance/commission-rules
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, getSalesData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const LS_KEY = 'lamom_comm_rules'

const RULE_TYPES = {
  per_unit:  { label: 'ต่อคัน', icon: '🚗' },
  tiered:    { label: 'ขั้นบันได', icon: '📶' },
  percent:   { label: '% ของกำไร', icon: '📊' },
  bonus:     { label: 'โบนัสพิเศษ', icon: '🎁' },
}

const BASE_RULES = [
  { id: 'CR001', name: 'คอมพื้นฐานต่อคัน', type: 'per_unit', detail: 'ขายได้ 1 คัน = 5,000 บาท (ทุกรุ่น)', value: 5000, active: true, appliesTo: 'เซลส์ทุกคน' },
  { id: 'CR002', name: 'ขั้นบันไดรายเดือน', type: 'tiered', detail: '', value: 0, active: true, appliesTo: 'เซลส์ทุกคน',
    tiers: [{ from: 1, to: 3, amt: 5000 }, { from: 4, to: 6, amt: 7000 }, { from: 7, to: 99, amt: 10000 }] },
  { id: 'CR003', name: 'โบนัสรุ่น Premium', type: 'bonus', detail: 'BYD Seal / Han เพิ่มอีก 3,000/คัน', value: 3000, active: true, appliesTo: 'เซลส์ทุกคน' },
  { id: 'CR004', name: 'คอมจากกำไรส่วนเกิน', type: 'percent', detail: 'ขายเกิน floor price ได้ 20% ของส่วนต่าง', value: 20, active: true, appliesTo: 'Senior Sales' },
  { id: 'CR005', name: 'โบนัสปิดเป้าทีม', type: 'bonus', detail: 'ทีมถึงเป้าเดือน ทุกคนรับเพิ่ม 2,000', value: 2000, active: false, appliesTo: 'ทีมขายทั้งทีม' },
]

const SIM_PRESETS = [
  { units: 3, premium: 1, overFloor: 0 },
  { units: 6, premium: 2, overFloor: 30000 },
  { units: 9, premium: 3, overFloor: 80000 },
]

function loadSavedRules() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null }
}
function saveRules(r) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(r)) } catch {}
}

function cloneBaseRules() {
  return BASE_RULES.map(r => ({ ...r, tiers: r.tiers ? r.tiers.map(t => ({ ...t })) : undefined }))
}

function buildTierDetail(tiers) {
  return tiers.map(t => `คันที่ ${t.from}${t.to >= 99 ? t.from + '+' : '-' + t.to}: ${t.amt.toLocaleString()}`).join(' · ')
}

function calcCommission(units, premiumUnits, overFloor, rules) {
  let total = 0
  const breakdown = []
  const tiered = rules.find(r => r.id === 'CR002' && r.active && r.tiers)
  if (tiered) {
    let amt = 0
    for (let u = 1; u <= units; u++) {
      const tier = tiered.tiers.find(t => u >= t.from && u <= t.to)
      amt += tier?.amt || 0
    }
    total += amt; breakdown.push(['ขั้นบันได (' + units + ' คัน)', amt])
  } else {
    const base = rules.find(r => r.id === 'CR001' && r.active)
    if (base) {
      const amt = units * (base.value || 5000)
      total += amt; breakdown.push(['พื้นฐาน (' + units + ' คัน)', amt])
    }
  }
  const bonus = rules.find(r => r.id === 'CR003' && r.active)
  if (bonus && premiumUnits > 0) {
    const amt = premiumUnits * (bonus.value || 3000)
    total += amt; breakdown.push(['โบนัส Premium (' + premiumUnits + ' คัน)', amt])
  }
  const pct = rules.find(r => r.id === 'CR004' && r.active)
  if (pct && overFloor > 0) {
    const amt = Math.round(overFloor * (pct.value || 20) / 100)
    total += amt; breakdown.push([(pct.value || 20) + '% ส่วนเกิน floor', amt])
  }
  return { total, breakdown }
}

export default async function CommissionRulesPage(container) {
  const myGen = container.__routerGen
  let rules = loadSavedRules() || cloneBaseRules()
  let sim = { units: 6, premium: 2, overFloor: 30000 }
  let dataSource = 'demo'
  let thisMonthPaid = 0

  try {
    const [docs, sales] = await Promise.all([
      listDocs('commission_rules', [], 'name', 'asc', 100).catch(() => []),
      getSalesData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      if (!loadSavedRules()) {
        const mapped = docs.map((d, i) => ({
          id: d.id || `CR${String(i + 1).padStart(3, '0')}`,
          name: d.name || 'กติกา',
          type: d.type || 'per_unit',
          detail: d.detail || d.description || '',
          value: d.value || 0,
          active: d.active !== undefined ? d.active : true,
          appliesTo: d.appliesTo || 'เซลส์ทุกคน',
          tiers: d.tiers || undefined,
        }))
        rules = [...mapped, ...cloneBaseRules()]
      }
      dataSource = 'live'
    }
    // Estimate total commission paid this month from sales data
    const thisMonth = new Date().toISOString().slice(0, 7)
    const monthSales = sales.filter(s => (s.date || '').startsWith(thisMonth))
    if (monthSales.length) {
      const byPerson = {}
      monthSales.forEach(s => {
        const n = s.salesperson || s.salesName || 'unknown'
        if (!byPerson[n]) byPerson[n] = { units: 0, premiumUnits: 0, overFloor: 0 }
        byPerson[n].units++
        const model = (s.model || '').toLowerCase()
        if (model.includes('seal') || model.includes('han') || model.includes('atto')) byPerson[n].premiumUnits++
        const diff = Math.max(0, (s.salePrice || 0) - (s.floor || s.cost || s.salePrice || 0))
        byPerson[n].overFloor += diff
      })
      Object.values(byPerson).forEach(p => {
        thisMonthPaid += calcCommission(p.units, p.premiumUnits, p.overFloor, rules).total
      })
    }
  } catch {}

  function renderPage() {
    const activeCount = rules.filter(r => r.active).length
    const result = calcCommission(sim.units, sim.premium, sim.overFloor, rules)

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
                    <div style="font-weight:700;font-size:0.85rem">${rt?.icon || '⚙️'} ${escHtml(r.name)}</div>
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
              const t = rules.find(r => r.id === 'CR002' && r.tiers)
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
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', () => {
      const r = rules.find(x => x.id === b.dataset.id)
      if (r) { r.active = !r.active; saveRules(rules); renderPage() }
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
        bodyHtml += `<div class="input-group"><label class="input-label">เปอร์เซ็นต์ (%)</label>
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
        onConfirm() {
          r.name = document.getElementById('er-name')?.value?.trim() || r.name
          r.appliesTo = document.getElementById('er-applies')?.value?.trim() || r.appliesTo
          r.detail = document.getElementById('er-detail')?.value?.trim()
          if (r.type === 'tiered' && r.tiers) {
            r.tiers.forEach((t, i) => {
              const v = parseInt(document.getElementById('er-tier-' + i)?.value)
              if (!isNaN(v) && v >= 0) t.amt = v
            })
          } else {
            const v = parseFloat(document.getElementById('er-value')?.value)
            if (!isNaN(v) && v >= 0) r.value = v
          }
          saveRules(rules)
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
      renderPage()
    })
    container.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => {
      sim = { ...SIM_PRESETS[parseInt(b.dataset.i)] }; renderPage()
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
          <div class="input-group"><label class="input-label">ค่าคอม (บาท หรือ %)</label><input class="input" type="number" id="cr-value" value="0" min="0"></div>
          <div class="input-group"><label class="input-label">รายละเอียด</label><input class="input" id="cr-detail" placeholder="อธิบายเงื่อนไข..."></div>
          <div class="input-group"><label class="input-label">ใช้กับ</label><input class="input" id="cr-applies" value="เซลส์ทุกคน"></div>
        </div>`,
        onConfirm() {
          const name = document.getElementById('cr-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
          rules.push({
            id: `CR${String(rules.length + 1).padStart(3, '0')}`,
            name,
            type: document.getElementById('cr-type')?.value || 'per_unit',
            detail: document.getElementById('cr-detail')?.value || '',
            value: parseFloat(document.getElementById('cr-value')?.value) || 0,
            active: true,
            appliesTo: document.getElementById('cr-applies')?.value || 'เซลส์ทุกคน',
          })
          saveRules(rules)
          showToast('✅ เพิ่มกติกาแล้ว', 'success')
          renderPage()
        }
      })
    })

    // Reset to default
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      if (!confirm('Reset กติกาทั้งหมดกลับค่าเริ่มต้น?')) return
      rules = cloneBaseRules()
      saveRules(rules)
      showToast('↩ Reset แล้ว', 'warning')
      renderPage()
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
