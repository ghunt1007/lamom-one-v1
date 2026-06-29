import { formatCurrency } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CATEGORIES = {
  income: {
    vehicle_sale: { label: '🚗 ขายรถ', color: 'success' },
    service:      { label: '🔧 ค่าซ่อม', color: 'success' },
    parts:        { label: '🔩 อะไหล่', color: 'success' },
    insurance:    { label: '🛡 ประกัน', color: 'success' },
    finance_comm: { label: '💳 Commission ไฟแนนซ์', color: 'success' },
    other_income: { label: '💰 รายได้อื่น', color: 'success' },
  },
  expense: {
    cogs:         { label: '📦 ต้นทุนรถ (COGS)', color: 'danger' },
    salary:       { label: '👤 เงินเดือน', color: 'danger' },
    rent:         { label: '🏢 ค่าเช่า', color: 'danger' },
    marketing:    { label: '📣 การตลาด', color: 'danger' },
    parts_purch:  { label: '🔩 ซื้ออะไหล่', color: 'danger' },
    utilities:    { label: '💡 สาธารณูปโภค', color: 'danger' },
    other_exp:    { label: '📋 อื่นๆ', color: 'danger' },
  },
}

// Demo weekly data
const DEMO_FLOWS = [
  // Week 1 June 2025
  { id:'CF001', date:'2025-06-02', type:'income', cat:'vehicle_sale', desc:'ขาย BYD Seal AWD — สมศักดิ์', amount:1299000 },
  { id:'CF002', date:'2025-06-02', type:'expense', cat:'cogs', desc:'ต้นทุน BYD Seal AWD', amount:1100000 },
  { id:'CF003', date:'2025-06-03', type:'income', cat:'service', desc:'ค่าซ่อม Job#002-2025', amount:4500 },
  { id:'CF004', date:'2025-06-04', type:'expense', cat:'salary', desc:'เงินเดือนพนักงาน มิ.ย.', amount:89250 },
  { id:'CF005', date:'2025-06-05', type:'income', cat:'finance_comm', desc:'Commission KBank Fleet', amount:26000 },
  { id:'CF006', date:'2025-06-06', type:'expense', cat:'rent', desc:'ค่าเช่าโชว์รูม มิ.ย.', amount:68000 },
  // Week 2
  { id:'CF007', date:'2025-06-09', type:'income', cat:'vehicle_sale', desc:'ขาย MG4 X — วิชาญ ขาย', amount:1199000 },
  { id:'CF008', date:'2025-06-09', type:'expense', cat:'cogs', desc:'ต้นทุน MG4 X', amount:1040000 },
  { id:'CF009', date:'2025-06-10', type:'income', cat:'insurance', desc:'Commission ประกัน AXA', amount:12000 },
  { id:'CF010', date:'2025-06-10', type:'expense', cat:'marketing', desc:'Boost TikTok', amount:15000 },
  { id:'CF011', date:'2025-06-11', type:'income', cat:'parts', desc:'ขายอะไหล่ปลีก', amount:8500 },
  { id:'CF012', date:'2025-06-12', type:'expense', cat:'utilities', desc:'ค่าไฟ+น้ำ', amount:22000 },
]

export default async function CashFlowPage(container) {
  const myGen = container.__routerGen
  let flows = DEMO_FLOWS.map(f => ({ ...f }))
  let viewMode = 'daily'
  let showType = 'all'
  let dataSource = 'demo'

  const startBalance = 850000

  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return

    const liveFlows = []
    sales.forEach(s => {
      if (!s.date || !(s.salePrice > 0)) return
      const d = s.date.slice(0, 10)
      const label = ((s.brand || '') + ' ' + (s.model || '')).trim()
      liveFlows.push({ id: 'CF-' + s.id, date: d, type: 'income', cat: 'vehicle_sale',
        desc: 'ขาย ' + label + (s.salesName ? ' — ' + s.salesName : ''), amount: s.salePrice, _live: true })
      liveFlows.push({ id: 'CF-C-' + s.id, date: d, type: 'expense', cat: 'cogs',
        desc: 'ต้นทุน ' + label, amount: Math.round(s.salePrice * 0.82), _live: true })
    })

    if (liveFlows.length) {
      const fixedExpenses = DEMO_FLOWS.filter(f => !['vehicle_sale', 'cogs'].includes(f.cat))
      flows = [...liveFlows, ...fixedExpenses]
      dataSource = 'live'
    }
  } catch {}

  function getFiltered() {
    if (showType === 'all') return flows
    return flows.filter(f => f.type === showType)
  }

  function calcRunning(sorted) {
    let bal = startBalance
    return sorted.map(f => {
      if (f.type === 'income') bal += f.amount
      else bal -= f.amount
      return { ...f, balance: bal }
    })
  }

  function getSummary() {
    const income = flows.filter(f => f.type === 'income').reduce((a, f) => a + f.amount, 0)
    const expense = flows.filter(f => f.type === 'expense').reduce((a, f) => a + f.amount, 0)
    return { income, expense, net: income - expense, balance: startBalance + income - expense }
  }

  function renderPage() {
    const s = getSummary()
    const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date))
    const running = calcRunning(sorted)
    const filtered = showType === 'all' ? running : running.filter(f => f.type === showType)
    const maxAmt = Math.max(...flows.map(f => f.amount))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💸 Cash Flow</div>
            <div class="page-subtitle">กระแสเงินสดรายวัน
              ${dataSource === 'live' ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริงจากใบจอง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">Demo</span>'}
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="cf-export">📥 Export</button>
            <button class="btn btn-primary" id="new-flow-btn">➕ บันทึกรายการ</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('💰 รายรับรวม', formatCurrency(s.income), 'success')}
          ${kpi('💸 รายจ่ายรวม', formatCurrency(s.expense), 'danger')}
          ${kpi('📊 Net Cash Flow', formatCurrency(s.net), s.net >= 0 ? 'success' : 'danger')}
          ${kpi('🏦 ยอดคงเหลือ', formatCurrency(s.balance), 'primary')}
        </div>

        <!-- Cash Flow Chart (waterfall-style) -->
        <div class="card" style="padding:20px;margin-bottom:16px">
          <div style="font-weight:700;margin-bottom:14px">📊 Cash Flow Chart</div>
          <div style="display:flex;align-items:flex-end;gap:3px;height:140px;border-bottom:1px solid var(--border);padding-bottom:8px;overflow-x:auto">
            ${flows.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(f => {
              const h = Math.max(4, Math.round(f.amount / maxAmt * 120))
              const isIncome = f.type === 'income'
              return `<div style="flex:1;min-width:24px;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="font-size:0.55rem;color:var(--text-muted)">${(f.amount/1000).toFixed(0)}k</div>
                <div style="width:100%;height:${h}px;background:${isIncome?'var(--success)':'var(--danger)'};border-radius:3px 3px 0 0;opacity:0.8" title="${escHtml(f.desc)}: ${formatCurrency(f.amount)}"></div>
              </div>`
            }).join('')}
          </div>
          <div style="display:flex;gap:12px;margin-top:8px;font-size:0.75rem">
            <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--success);border-radius:2px;display:inline-block"></span>รายรับ</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--danger);border-radius:2px;display:inline-block"></span>รายจ่าย</span>
          </div>
        </div>

        <!-- Category Breakdown -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card" style="padding:16px">
            <div style="font-weight:700;color:var(--success);margin-bottom:12px">💰 รายรับตามประเภท</div>
            ${Object.entries(CATEGORIES.income).map(([k, v]) => {
              const total = flows.filter(f => f.type === 'income' && f.cat === k).reduce((a, f) => a + f.amount, 0)
              if (!total) return ''
              const pct = Math.round(total / s.income * 100)
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                  <span>${v.label}</span><span>${formatCurrency(total)} (${pct}%)</span>
                </div>
                <div style="background:var(--surface-3);height:5px;border-radius:99px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:var(--success);border-radius:99px"></div>
                </div>
              </div>`
            }).join('')}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-weight:700;color:var(--danger);margin-bottom:12px">💸 รายจ่ายตามประเภท</div>
            ${Object.entries(CATEGORIES.expense).map(([k, v]) => {
              const total = flows.filter(f => f.type === 'expense' && f.cat === k).reduce((a, f) => a + f.amount, 0)
              if (!total) return ''
              const pct = Math.round(total / s.expense * 100)
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                  <span>${v.label}</span><span>${formatCurrency(total)} (${pct}%)</span>
                </div>
                <div style="background:var(--surface-3);height:5px;border-radius:99px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:var(--danger);border-radius:99px"></div>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Transaction Table -->
        <div style="display:flex;gap:6px;margin-bottom:12px">
          ${['all','income','expense'].map(t => `<button class="btn btn-sm ${showType===t?'btn-primary':'btn-secondary'} cf-type-btn" data-t="${t}">${{all:'ทั้งหมด',income:'💰 รายรับ',expense:'💸 รายจ่าย'}[t]}</button>`).join('')}
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>วันที่</th><th>ประเภท</th><th>รายการ</th><th class="text-right">รายรับ</th><th class="text-right">รายจ่าย</th><th class="text-right">ยอดคงเหลือ</th></tr></thead>
            <tbody>
              <tr style="background:var(--surface-2)">
                <td colspan="5" style="font-size:0.8rem;color:var(--text-muted)">ยอดยกมา</td>
                <td class="text-right" style="font-weight:700">${formatCurrency(startBalance)}</td>
              </tr>
              ${filtered.map(f => {
                const allCats = { ...CATEGORIES.income, ...CATEGORIES.expense }
                const cat = allCats[f.cat]
                const isIncome = f.type === 'income'
                return `<tr>
                  <td style="font-size:0.8rem;white-space:nowrap">${escHtml(f.date)}</td>
                  <td><span class="badge badge-${cat?.color||'secondary'}" style="font-size:0.68rem">${cat?.label||escHtml(f.cat)}</span></td>
                  <td style="font-size:0.83rem">${escHtml(f.desc)}</td>
                  <td class="text-right" style="color:var(--success)">${isIncome ? formatCurrency(f.amount) : ''}</td>
                  <td class="text-right" style="color:var(--danger)">${!isIncome ? formatCurrency(f.amount) : ''}</td>
                  <td class="text-right" style="font-weight:700;color:var(--${f.balance>=0?'success':'danger'})">${formatCurrency(f.balance)}</td>
                </tr>`
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-2);font-weight:700">
                <td colspan="3">รวม</td>
                <td class="text-right" style="color:var(--success)">${formatCurrency(s.income)}</td>
                <td class="text-right" style="color:var(--danger)">${formatCurrency(s.expense)}</td>
                <td class="text-right" style="color:var(--${s.balance>=0?'success':'danger'})">${formatCurrency(s.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `

    document.querySelectorAll('.cf-type-btn').forEach(b => b.addEventListener('click', () => { showType = b.dataset.t; renderPage() }))
    document.getElementById('cf-export')?.addEventListener('click', () => {
      exportToExcel(running.map(f => ({ วันที่:f.date, ประเภท:f.type==='income'?'รายรับ':'รายจ่าย', หมวด:({...CATEGORIES.income,...CATEGORIES.expense})[f.cat]?.label||f.cat, รายการ:f.desc, จำนวน:f.amount, คงเหลือ:f.balance })), 'CashFlow')
    })
    document.getElementById('new-flow-btn')?.addEventListener('click', openFlowForm)
  }

  function openFlowForm() {
    const today = new Date().toISOString().slice(0,10)
    const { el, close } = openModal({
      title: '➕ บันทึกรายการเงิน', size:'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="cf-type-sel" onchange="document.getElementById('cf-cat-sel').innerHTML=this.value==='income'?'${Object.entries(CATEGORIES.income).map(([k,v])=>`<option value=\\"${k}\\">${v.label}</option>`).join('')}':'${Object.entries(CATEGORIES.expense).map(([k,v])=>`<option value=\\"${k}\\">${v.label}</option>`).join('')}'">
              <option value="income">💰 รายรับ</option>
              <option value="expense">💸 รายจ่าย</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="cf-date" value="${today}"></div>
        </div>
        <div class="input-group"><label class="input-label">หมวด</label>
          <select class="input" id="cf-cat-sel">
            ${Object.entries(CATEGORIES.income).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group"><label class="input-label">รายละเอียด *</label><input class="input" id="cf-desc" placeholder="ระบุรายละเอียด"></div>
        <div class="input-group"><label class="input-label">จำนวนเงิน (บาท) *</label><input class="input" type="number" id="cf-amount" placeholder="0"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="cfc">ยกเลิก</button><button class="btn btn-primary" id="cfs">💾 บันทึก</button>`
    })
    el.querySelector('#cfc').addEventListener('click', close)
    el.querySelector('#cfs').addEventListener('click', () => {
      const desc = el.querySelector('#cf-desc').value.trim()
      const amount = +el.querySelector('#cf-amount').value
      if (!desc || !amount) return
      flows.push({
        id: 'CF' + Date.now(),
        date: el.querySelector('#cf-date').value,
        type: el.querySelector('#cf-type-sel').value,
        cat: el.querySelector('#cf-cat-sel').value,
        desc, amount
      })
      showToast('💾 บันทึกรายการแล้ว', 'success'); close(); renderPage()
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
