/**
 * Loan Calculator — คำนวณค่างวดไฟแนนซ์
 * Route: /finance/loan-calc
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const MODELS = {
  'BYD Dolphin': 899000,
  'BYD Atto 3': 1099000,
  'BYD Atto 3 Pro': 1299000,
  'BYD Seal AWD': 1699000,
  'MG ZS EV': 799000,
  'MG4 Electric': 949000,
  'BYD Han': 2099000,
}

const BANKS = [
  { name: 'กรุงศรี ออโต้', rates: { 48: 2.59, 60: 2.79, 72: 2.99, 84: 3.19 } },
  { name: 'ธนชาต DRIVE', rates: { 48: 2.49, 60: 2.69, 72: 2.89, 84: 3.09 } },
  { name: 'SCB ลีสซิ่ง', rates: { 48: 2.69, 60: 2.85, 72: 3.05, 84: 3.25 } },
  { name: 'เกียรตินาคิน', rates: { 48: 2.55, 60: 2.75, 72: 2.95, 84: 3.15 } },
]

function monthly(principal, flatRate, months) {
  const years = months / 12
  const interest = principal * (flatRate / 100) * years
  return Math.round((principal + interest) / months)
}

export default async function LoanCalculatorPage(container) {
  const myGen = container.__routerGen
  let model = 'BYD Atto 3'
  let customPrice = null
  let downPct = 20
  let term = 60
  let banks = BANKS.map(b => ({ ...b, rates: { ...b.rates } }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('finance_banks', [], 'name', 'asc', 50).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map(d => ({
        name: d.name || d.bankName || 'ธนาคาร',
        rates: d.rates || { 48: d.rate48||2.99, 60: d.rate60||3.19, 72: d.rate72||3.39, 84: d.rate84||3.59 },
      }))
      banks = [...mapped, ...BANKS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const price = customPrice ?? MODELS[model]
    const downAmt = Math.round(price * downPct / 100)
    const principal = price - downAmt
    const results = banks.map(b => ({
      ...b, rate: b.rates[term], pay: monthly(principal, b.rates[term], term),
      totalInterest: monthly(principal, b.rates[term], term) * term - principal
    })).sort((a, b) => a.pay - b.pay)
    const best = results[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧮 Loan Calculator</div>
            <div class="page-subtitle">คำนวณค่างวด — เทียบ ${banks.length} ไฟแนนซ์${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="send-btn">📤 ส่งให้ลูกค้า</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:14px">
          <!-- Inputs -->
          <div class="card" style="padding:16px;height:fit-content">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⚙️ เงื่อนไข</div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">รุ่นรถ</label>
              <select class="input" id="lc-model">${Object.keys(MODELS).map(m => `<option ${model===m?'selected':''}>${m}</option>`).join('')}</select>
            </div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">ราคารถ (แก้ได้)</label>
              <input class="input" type="number" id="lc-price" value="${price}">
            </div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">เงินดาวน์: <strong style="color:var(--primary)">${downPct}%</strong> = ${formatCurrency(downAmt)}</label>
              <input type="range" id="lc-down" min="0" max="50" step="5" value="${downPct}" style="width:100%;accent-color:var(--primary)">
            </div>
            <div class="input-group" style="margin-bottom:14px">
              <label class="input-label">ระยะผ่อน</label>
              <div style="display:flex;gap:4px">
                ${[48,60,72,84].map(t => `<button class="btn btn-xs ${term===t?'btn-primary':'btn-secondary'} term-btn" data-t="${t}" style="flex:1">${t} งวด</button>`).join('')}
              </div>
            </div>
            <div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);font-size:0.78rem">
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">ราคารถ</span><strong>${formatCurrency(price)}</strong></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">เงินดาวน์</span><strong>−${formatCurrency(downAmt)}</strong></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid var(--border)"><span style="color:var(--text-muted)">ยอดจัด</span><strong style="color:var(--primary)">${formatCurrency(principal)}</strong></div>
            </div>
          </div>

          <!-- Results -->
          <div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${results.map((r, i) => `
                <div class="card" style="padding:14px;border:2px solid ${i===0?'var(--success)':'transparent'}">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-weight:700;font-size:0.87rem">${i===0?'👑 ':''}${escHtml(r.name)}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">ดอกเบี้ย flat ${r.rate}% · ${term} งวด · ดอกเบี้ยรวม ${formatCurrency(r.totalInterest)}</div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:1.25rem;font-weight:900;color:var(--${i===0?'success':'primary'})">${formatCurrency(r.pay)}</div>
                      <div style="font-size:0.63rem;color:var(--text-muted)">ต่อเดือน</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            <p style="font-size:0.7rem;color:var(--text-muted);margin-top:10px;padding-left:4px">💡 ${escHtml(best?.name)} ถูกสุดที่ ${formatCurrency(best?.pay)}/เดือน — อัตราจริงขึ้นกับเครดิตลูกค้า ใช้เป็นตัวเลขเบื้องต้นเท่านั้น</p>
          </div>
        </div>
      </div>
    `

    document.getElementById('lc-model')?.addEventListener('change', e => { model = e.target.value; customPrice = null; renderPage() })
    document.getElementById('lc-price')?.addEventListener('change', e => { customPrice = parseInt(e.target.value) || MODELS[model]; renderPage() })
    document.getElementById('lc-down')?.addEventListener('input', e => { downPct = parseInt(e.target.value); renderPage() })
    container.querySelectorAll('.term-btn').forEach(b => b.addEventListener('click', () => { term = parseInt(b.dataset.t); renderPage() }))
    document.getElementById('send-btn')?.addEventListener('click', () => {
      const price = customPrice ?? MODELS[model]
      const principal = Math.round(price * (1 - downPct / 100))
      const bestBank = banks.slice().sort((a, b) => (a.rates[term] || 99) - (b.rates[term] || 99))[0]
      const rate = bestBank?.rates[term] || 3
      const pay = monthly(principal, rate, term)
      const summary = `${model} | ดาวน์ ${downPct}% (${formatCurrency(price * downPct / 100)}) | ${term} งวด | ฿${pay.toLocaleString()}/เดือน | ${bestBank?.name} ${rate}% Flat`
      navigator.clipboard?.writeText(summary)
        .then(() => showToast(`📤 Copy สรุปค่างวดแล้ว — วางใน LINE ได้เลย`, 'success'))
        .catch(() => showToast(`📤 ส่งตารางค่างวด ${model} ดาวน์ ${downPct}% ${term} งวด ฿${pay.toLocaleString()}/เดือน ทาง LINE แล้ว`, 'success'))
    })
  }

  renderPage()
}
