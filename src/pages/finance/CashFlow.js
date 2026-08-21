import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { getSalesData, listDocs, createDoc, softDelete, readDoc, setDocData } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'

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

// (v1.0.319) เดิมรายการปลอมด้านล่างนี้ (DEMO_FLOWS) ถูกผสมเข้ากับข้อมูลจริงถาวรทุกครั้งที่มีข้อมูลจริง
// (เก็บแค่ vehicle_sale/cogs ไว้เป็นของจริง แต่เงินเดือน/ค่าเช่า/การตลาด/ค่าซ่อม/ประกัน/อะไหล่/ค่าน้ำ-ไฟ
// ยังเป็นของปลอมเดือน มิ.ย.2025 ตายตัวเสมอ ไม่มีทางตัดออก) ทำให้ Net Cash Flow/ยอดคงเหลือผิดจากความจริง
// แก้ให้ใช้แค่ตอนยังไม่มีข้อมูลจริงเลย (dataSource==='demo' อย่างเดียว) — รายการอื่นๆนอกจากขายรถใช้การ
// บันทึกมือผ่านปุ่ม "➕ บันทึกรายการ" ที่ตอนนี้เขียนลง Firestore จริงแล้ว (เดิมแค่ push เข้า array
// ในหน่วยความจำ หายหมดทันทีที่รีเฟรชหน้า) ใช้ collection ชื่อ cash_flow ที่มี Firestore Rules
// (isFinance()||isManager() อ่าน, isFinance() เขียน) เตรียมไว้อยู่แล้วแต่ยังไม่มีหน้าไหนใช้จริงมาก่อน
const CASH_FLOW_MANAGE_ROLES = ['owner', 'admin', 'manager', 'finance']

// Demo weekly data (ใช้แสดงตัวอย่างเฉพาะตอนยังไม่มีข้อมูลจริงเลยเท่านั้น)
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
  const myRole = getState('role') || getState('user')?.role || 'staff'
  const canManage = CASH_FLOW_MANAGE_ROLES.includes(myRole)
  let flows = DEMO_FLOWS.map(f => ({ ...f }))
  let showType = 'all'
  let dataSource = 'demo'

  // เดิม startBalance ผูกค่าคงที่ 850000 ตายตัวในโค้ด ไม่มีทางแก้ในหน้า UI เลย ทั้งที่บวกเข้าไปใน KPI
  // "ยอดคงเหลือ" หลักตรงๆทุกครั้ง — แก้ให้แก้ไขได้จริงและบันทึกลง Firestore (finance_settings/cash_flow)
  // ผ่าน setDocData (upsert ด้วย id คงที่ — ตั้งค่าระดับระบบ ไม่ใช่รายการที่ต้องมี id สุ่ม)
  let startBalance = 850000

  async function loadStartBalance() {
    try {
      const doc = await readDoc('finance_settings', 'cash_flow')
      if (doc && typeof doc.startBalance === 'number') startBalance = doc.startBalance
    } catch (e) {}
  }

  async function loadData() {
    const liveFlows = []
    try {
      const sales = await getSalesData()
      sales.forEach(s => {
        if (!s.date || !(s.salePrice > 0)) return
        const d = s.date.slice(0, 10)
        const label = ((s.brand || '') + ' ' + (s.model || '')).trim()
        liveFlows.push({ id: 'CF-' + s.id, date: d, type: 'income', cat: 'vehicle_sale',
          desc: 'ขาย ' + label + (s.salesName ? ' — ' + s.salesName : ''), amount: s.salePrice, _live: true })
        // (v1.0.347) เดิมประมาณต้นทุนที่ 82% ของราคาขายเสมอ ทั้งที่ getSalesData() มี field cost จริงต่อ
        // ใบจองอยู่แล้ว (ใช้จริงแล้วใน VatReport.js v1.0.320) ใช้ค่าประมาณเฉพาะใบจองที่ยังไม่มีต้นทุนจริง
        // กรอกไว้เท่านั้น (cost falsy/0)
        liveFlows.push({ id: 'CF-C-' + s.id, date: d, type: 'expense', cat: 'cogs',
          desc: 'ต้นทุน ' + label, amount: s.cost || Math.round(s.salePrice * 0.82), _live: true })
      })
    } catch {}

    let manualFlows = []
    try {
      const docs = await listDocs('cash_flow', companyScopeFilters(), 'date', 'desc', 500)
      manualFlows = docs.filter(d => !d.deleted).map(d => ({ ...d, _manual: true }))
    } catch {} // permission-denied ได้ถ้า role ไม่ใช่ finance/manager ขึ้นไป — ไม่ใช่ error จริง

    if (container.__routerGen !== myGen) return
    if (liveFlows.length || manualFlows.length) {
      flows = [...liveFlows, ...manualFlows]
      dataSource = 'live'
    } else {
      flows = DEMO_FLOWS.map(f => ({ ...f }))
      dataSource = 'demo'
    }
  }
  await loadStartBalance()
  await loadData()

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
              ${dataSource === 'live' ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">Demo (ยังไม่มีข้อมูลจริง)</span>'}
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="cf-export">📥 Export</button>
            ${canManage ? `<button class="btn btn-secondary" id="edit-balance-btn">✏️ ยอดยกมา</button>` : ''}
            ${canManage ? `<button class="btn btn-primary" id="new-flow-btn">➕ บันทึกรายการ</button>` : ''}
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
          <div class="table-wrap"><table class="table">
            <thead><tr><th>วันที่</th><th>ประเภท</th><th>รายการ</th><th class="text-right">รายรับ</th><th class="text-right">รายจ่าย</th><th class="text-right">ยอดคงเหลือ</th>${canManage ? '<th></th>' : ''}</tr></thead>
            <tbody>
              <tr style="background:var(--surface-2)">
                <td colspan="5" style="font-size:0.8rem;color:var(--text-muted)">ยอดยกมา</td>
                <td class="text-right" style="font-weight:700">${formatCurrency(startBalance)}</td>
                ${canManage ? '<td></td>' : ''}
              </tr>
              ${filtered.map(f => {
                const allCats = { ...CATEGORIES.income, ...CATEGORIES.expense }
                const cat = allCats[f.cat]
                const isIncome = f.type === 'income'
                return `<tr>
                  <td style="font-size:0.8rem;white-space:nowrap">${escHtml(f.date)}</td>
                  <td><span class="badge badge-${cat?.color||'secondary'}" style="font-size:0.68rem">${cat?.label||escHtml(f.cat)}</span></td>
                  <td style="font-size:0.83rem">${escHtml(f.desc)}${f._manual ? '' : (f._live ? ' <span style="color:var(--text-muted);font-size:0.68rem">(ใบจอง)</span>' : ' <span style="color:var(--text-muted);font-size:0.68rem">(demo)</span>')}</td>
                  <td class="text-right" style="color:var(--success)">${isIncome ? formatCurrency(f.amount) : ''}</td>
                  <td class="text-right" style="color:var(--danger)">${!isIncome ? formatCurrency(f.amount) : ''}</td>
                  <td class="text-right" style="font-weight:700;color:var(--${f.balance>=0?'success':'danger'})">${formatCurrency(f.balance)}</td>
                  ${canManage ? `<td class="text-right">${f._manual ? `<button class="btn btn-xs btn-danger cf-del-btn" data-id="${f.id}">🗑</button>` : ''}</td>` : ''}
                </tr>`
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-2);font-weight:700">
                <td colspan="3">รวม</td>
                <td class="text-right" style="color:var(--success)">${formatCurrency(s.income)}</td>
                <td class="text-right" style="color:var(--danger)">${formatCurrency(s.expense)}</td>
                <td class="text-right" style="color:var(--${s.balance>=0?'success':'danger'})">${formatCurrency(s.balance)}</td>
                ${canManage ? '<td></td>' : ''}
              </tr>
            </tfoot>
          </table></div>
        </div>
      </div>
    `

    document.querySelectorAll('.cf-type-btn').forEach(b => b.addEventListener('click', () => { showType = b.dataset.t; renderPage() }))
    document.getElementById('cf-export')?.addEventListener('click', () => {
      exportToExcel(running.map(f => ({ วันที่:f.date, ประเภท:f.type==='income'?'รายรับ':'รายจ่าย', หมวด:({...CATEGORIES.income,...CATEGORIES.expense})[f.cat]?.label||f.cat, รายการ:f.desc, จำนวน:f.amount, คงเหลือ:f.balance })), 'CashFlow')
    })
    document.getElementById('new-flow-btn')?.addEventListener('click', openFlowForm)
    document.getElementById('edit-balance-btn')?.addEventListener('click', openBalanceForm)
    // เดิมปุ่มลบรายการมือกดแล้วลบทันที ไม่มี confirmDialog เลย ต่างจากปุ่มลบส่วนใหญ่ในระบบ (เช่น
    // VendorManagement.js) ที่มี confirmDialog ก่อนลบเสมอ
    document.querySelectorAll('.cf-del-btn').forEach(b => b.addEventListener('click', async () => {
      const f = flows.find(x => x.id === b.dataset.id)
      const ok = await confirmDialog({ title: '🗑 ลบรายการ', message: `ลบรายการ "${escHtml(f?.desc || '')}" (${formatCurrency(f?.amount || 0)}) ออกจากระบบ?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('cash_flow', b.dataset.id)
        showToast('🗑 ลบรายการแล้ว', 'success')
        await loadData(); renderPage()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  // เดิม startBalance เป็นค่าคงที่ในโค้ด ไม่มีทางแก้ในหน้า UI — เพิ่มฟอร์มแก้ไข+บันทึกจริงลง Firestore
  function openBalanceForm() {
    const { el, close } = openModal({
      title: '✏️ แก้ไขยอดยกมา (Starting Balance)', size: 'sm',
      body: `<div class="input-group"><label class="input-label">ยอดยกมา (บาท)</label>
        <input class="input" type="number" id="cf-start-balance" value="${startBalance}"></div>`,
      footer: `<button class="btn btn-secondary" id="cfb-c">ยกเลิก</button><button class="btn btn-primary" id="cfb-s">💾 บันทึก</button>`
    })
    el.querySelector('#cfb-c').addEventListener('click', close)
    el.querySelector('#cfb-s').addEventListener('click', async () => {
      const val = +el.querySelector('#cf-start-balance').value
      if (isNaN(val)) { showToast('❗ กรุณากรอกตัวเลข', 'error'); return }
      try {
        await setDocData('finance_settings', 'cash_flow', { startBalance: val })
        startBalance = val
        showToast('💾 บันทึกยอดยกมาแล้ว', 'success')
        close(); renderPage()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openFlowForm() {
    // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
    // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
    const today = todayBangkok()
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
    el.querySelector('#cfs').addEventListener('click', async () => {
      const desc = el.querySelector('#cf-desc').value.trim()
      const amount = +el.querySelector('#cf-amount').value
      if (!desc || !amount) { showToast('❗ กรุณากรอกรายละเอียดและจำนวนเงิน', 'error'); return }
      try {
        await createDoc('cash_flow', {
          date: el.querySelector('#cf-date').value,
          type: el.querySelector('#cf-type-sel').value,
          cat: el.querySelector('#cf-cat-sel').value,
          desc, amount,
          companyId: myEffectiveCompanyId(),
        })
        showToast('💾 บันทึกรายการแล้ว', 'success'); close()
        await loadData(); renderPage()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
