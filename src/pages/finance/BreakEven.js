import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { confirmDialog } from '../../utils/modal.js'

const STORAGE_KEY = 'lamom-breakeven'

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

export default function BreakEvenPage(container) {
  const myGen = container.__routerGen
  const saved = loadState()
  let fixedCost    = saved.fixedCost    ?? 1200000
  let grossPerCar  = saved.grossPerCar  ?? 45000
  let serviceMonth = saved.serviceMonth ?? 250000
  let actualSales  = saved.actualSales  ?? 28
  let scenarios    = saved.scenarios    || []

  function calc() {
    const contrib = Math.max(0, fixedCost - serviceMonth)
    const beUnits = grossPerCar > 0 ? Math.ceil(contrib / grossPerCar) : 0
    const profitNow = actualSales * grossPerCar + serviceMonth - fixedCost
    const pct = beUnits > 0 ? Math.min(100, Math.round(actualSales / beUnits * 100)) : 100
    const mos = actualSales > 0 ? Math.round((actualSales - beUnits) / actualSales * 100) : 0
    return { beUnits, profitNow, pct, mos, passed: actualSales >= beUnits }
  }

  function saveScenario() {
    const name = `สถานการณ์ ${scenarios.length + 1} (${new Date().toLocaleDateString('th-TH',{month:'short',day:'numeric'})})`
    const { beUnits, profitNow } = calc()
    scenarios.push({ name, fixedCost, grossPerCar, serviceMonth, actualSales, beUnits, profitNow, id: Date.now() })
    if (scenarios.length > 4) scenarios = scenarios.slice(-4)
    saveState({ fixedCost, grossPerCar, serviceMonth, actualSales, scenarios })
    showToast(`💾 บันทึก "${name}" แล้ว`, 'success')
    render()
  }

  function render() {
    const { beUnits, profitNow, pct, mos, passed } = calc()
    const annualProfit = profitNow * 12
    const annualRevProj = (actualSales * 12) * grossPerCar

    // Sensitivity rows ±10% and ±20% costs
    const sensRows = [-20,-10,0,10,20].map(p => {
      const fc = Math.round(fixedCost * (1 + p/100))
      const contrib = Math.max(0, fc - serviceMonth)
      const be = grossPerCar > 0 ? Math.ceil(contrib / grossPerCar) : 0
      const profit = actualSales * grossPerCar + serviceMonth - fc
      return { p, be, profit, ok: actualSales >= be }
    })

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚖️ Break-even Calculator</div>
            <div class="page-subtitle">คำนวณจุดคุ้มทุน — ต้องขายกี่คัน/เดือนถึงเท่าทุน</div>
          </div>
          <div class="page-actions" style="gap:6px">
            <button class="btn btn-secondary btn-sm" id="save-scenario">📌 บันทึกสถานการณ์</button>
            <button class="btn btn-primary btn-sm" id="save-btn">💾 บันทึกค่า</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:320px 1fr;gap:14px">
          <!-- Sliders -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="card" style="padding:16px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">⚙️ สมมติฐาน (ต่อเดือน)</div>
              ${sl('fixed','ค่าใช้จ่ายคงที่',fixedCost,300000,3000000,50000,formatCurrency(fixedCost))}
              ${sl('gross','กำไรขั้นต้น/คัน',grossPerCar,10000,150000,5000,formatCurrency(grossPerCar))}
              ${sl('service','กำไรบริการ/เดือน',serviceMonth,0,1000000,25000,formatCurrency(serviceMonth))}
              ${sl('actual','ยอดขายจริงเดือนนี้',actualSales,0,100,1,actualSales+' คัน')}
            </div>

            <!-- Annual projection -->
            <div class="card" style="padding:14px;border-left:3px solid var(--accent)">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📅 ประมาณการรายปี</div>
              <div style="font-size:0.8rem;display:flex;flex-direction:column;gap:5px">
                <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">คาดยอดขาย/ปี</span><strong>${actualSales*12} คัน</strong></div>
                <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">กำไรขั้นต้น/ปี</span><strong style="color:var(--accent)">${formatCurrency(annualRevProj)}</strong></div>
                <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:5px"><span style="color:var(--text-muted)">กำไรสุทธิ/ปี</span><strong style="color:${annualProfit>=0?'var(--success)':'var(--danger)'}">${profitNow>=0?'+':''}${formatCurrency(annualProfit)}</strong></div>
              </div>
            </div>
          </div>

          <!-- Results column -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Big result -->
            <div class="card" style="padding:22px;text-align:center;border:2px solid ${passed?'var(--success)':'var(--warning)'}">
              <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">🎯 จุดคุ้มทุน</div>
              <div style="font-size:3rem;font-weight:900;color:var(--primary);line-height:1">${beUnits}</div>
              <div style="font-size:1rem;color:var(--text-muted);margin-bottom:8px">คัน/เดือน</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">ค่าใช้จ่ายคงที่สุทธิ ${formatCurrency(Math.max(0,fixedCost-serviceMonth))} ÷ กำไร/คัน ${formatCurrency(grossPerCar)}</div>
            </div>

            <!-- Progress + KPIs -->
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;font-size:0.76rem;margin-bottom:6px">
                <span style="color:var(--text-muted)">ความคืบหน้าสู่จุดคุ้มทุน</span>
                <strong style="color:${passed?'var(--success)':'var(--warning)'}">${actualSales}/${beUnits} คัน (${pct}%)</strong>
              </div>
              <div style="height:14px;background:var(--surface-2);border-radius:7px;overflow:hidden;margin-bottom:12px">
                <div style="height:100%;width:${pct}%;background:${passed?'var(--success)':'var(--warning)'};transition:width .3s;border-radius:7px"></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                <div style="text-align:center;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                  <div style="font-size:0.68rem;color:var(--text-muted)">กำไร/ขาดทุน</div>
                  <div style="font-size:1.05rem;font-weight:900;color:${profitNow>=0?'var(--success)':'var(--danger)'}">${profitNow>=0?'+':''}${formatCurrency(profitNow)}</div>
                </div>
                <div style="text-align:center;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                  <div style="font-size:0.68rem;color:var(--text-muted)">Margin of Safety</div>
                  <div style="font-size:1.05rem;font-weight:900;color:${mos>=0?'var(--primary)':'var(--danger)'}">${mos}%</div>
                </div>
                <div style="text-align:center;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                  <div style="font-size:0.68rem;color:var(--text-muted)">เกิน BE</div>
                  <div style="font-size:1.05rem;font-weight:900;color:${passed?'var(--success)':'var(--warning)'}">${actualSales-beUnits} คัน</div>
                </div>
              </div>
            </div>

            <!-- Sensitivity table -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📉 Sensitivity — ถ้าค่าใช้จ่ายเปลี่ยน</div>
              <div class="table-wrap">
                <table style="font-size:0.76rem">
                  <thead><tr>
                    <th>เปลี่ยนแปลง</th><th>ค่าใช้จ่าย</th><th>BE (คัน)</th><th>กำไร/ขาดทุน</th><th></th>
                  </tr></thead>
                  <tbody>
                    ${sensRows.map(r => `
                      <tr style="${r.p===0?'font-weight:700;background:var(--surface-2)':''}">
                        <td style="color:${r.p>0?'var(--danger)':r.p<0?'var(--success)':'var(--text-muted)'}">${r.p===0?'ปัจจุบัน':r.p>0?'+'+r.p+'%':r.p+'%'}</td>
                        <td>${formatCurrency(r.p===0?fixedCost:Math.round(fixedCost*(1+r.p/100)))}</td>
                        <td style="font-weight:700;color:var(--primary)">${r.be}</td>
                        <td style="color:${r.profit>=0?'var(--success)':'var(--danger)'}">${r.profit>=0?'+':''}${formatCurrency(r.profit)}</td>
                        <td>${r.ok?'✅':'⚠️'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Saved scenarios -->
            ${scenarios.length ? `
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted)">📌 สถานการณ์ที่บันทึกไว้</div>
                <button class="btn btn-xs btn-danger" id="clear-scenarios">ล้าง</button>
              </div>
              <div class="table-wrap">
                <table style="font-size:0.74rem">
                  <thead><tr><th>ชื่อ</th><th>BE (คัน)</th><th>ยอดขาย</th><th>กำไร</th></tr></thead>
                  <tbody>
                    ${scenarios.map(s => `<tr>
                      <td>${s.name}</td>
                      <td style="font-weight:700;color:var(--primary)">${s.beUnits}</td>
                      <td>${s.actualSales}</td>
                      <td style="color:${s.profitNow>=0?'var(--success)':'var(--danger)'}">${s.profitNow>=0?'+':''}${formatCurrency(s.profitNow)}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>` : ''}
          </div>
        </div>

        <div class="card" style="margin-top:12px;padding:12px 14px;font-size:0.78rem;background:var(--surface-2)">
          ${passed
            ? `✅ <strong>ผ่านจุดคุ้มทุนแล้ว</strong> — เกินมา ${actualSales - beUnits} คัน กำไรส่วนเพิ่ม ${formatCurrency((actualSales-beUnits)*grossPerCar)} · Margin of Safety ${mos}%`
            : `⚠️ <strong>ยังไม่ถึงจุดคุ้มทุน</strong> — ต้องขายอีก <strong style="color:var(--danger)">${beUnits - actualSales} คัน</strong> หรือลดค่าใช้จ่ายคงที่ลง ${formatCurrency((beUnits - actualSales) * grossPerCar)}`
          }
        </div>
      </div>
    `

    bindSl('fixed',   v => fixedCost    = v)
    bindSl('gross',   v => grossPerCar  = v)
    bindSl('service', v => serviceMonth = v)
    bindSl('actual',  v => actualSales  = v)

    document.getElementById('save-btn')?.addEventListener('click', () => {
      saveState({ fixedCost, grossPerCar, serviceMonth, actualSales, scenarios })
      showToast(`✅ บันทึกค่าแล้ว · จุดคุ้มทุน ${beUnits} คัน/เดือน`, 'success')
    })
    document.getElementById('save-scenario')?.addEventListener('click', saveScenario)
    document.getElementById('clear-scenarios')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title:'🗑 ล้างสถานการณ์', message:'ลบสถานการณ์ที่บันทึกทั้งหมด?', confirmText:'ล้าง', danger:true })
      if (!ok) return
      scenarios = []
      saveState({ fixedCost, grossPerCar, serviceMonth, actualSales, scenarios })
      if (container.__routerGen !== myGen) return
      render()
    })
  }

  function sl(id, label, value, min, max, step, display) {
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <label style="font-size:0.76rem;color:var(--text-muted)">${label}</label>
        <strong style="font-size:0.76rem;color:var(--primary)" id="be-${id}-lbl">${display}</strong>
      </div>
      <input type="range" id="be-${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="width:100%;accent-color:var(--primary)">
    </div>`
  }

  const FMT = { fixed:v=>formatCurrency(v), gross:v=>formatCurrency(v), service:v=>formatCurrency(v), actual:v=>v+' คัน' }
  function bindSl(id, setter) {
    document.getElementById(`be-${id}`)?.addEventListener('input', e => {
      const v = parseInt(e.target.value)
      setter(v)
      const lbl = document.getElementById(`be-${id}-lbl`)
      if (lbl) lbl.textContent = FMT[id](v)
      updateResults()
    })
  }

  function updateResults() {
    const { beUnits, profitNow, pct, mos, passed } = calc()
    // Re-render is cheapest; full re-render on slider move
    render()
  }

  render()
}
