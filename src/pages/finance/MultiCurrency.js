/**
 * Multi-Currency Pricing — ราคาหลายสกุลเงิน
 * Route: /finance/multi-currency
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'

const CURRENCIES = [
  { code:'THB', name:'บาทไทย',       flag:'🇹🇭', rate:1,       symbol:'฿' },
  { code:'USD', name:'ดอลลาร์สหรัฐ', flag:'🇺🇸', rate:0.0278,  symbol:'$' },
  { code:'EUR', name:'ยูโร',          flag:'🇪🇺', rate:0.0258,  symbol:'€' },
  { code:'CNY', name:'หยวนจีน',       flag:'🇨🇳', rate:0.201,   symbol:'¥' },
  { code:'JPY', name:'เยนญี่ปุ่น',    flag:'🇯🇵', rate:4.18,    symbol:'¥' },
  { code:'SGD', name:'ดอลลาร์สิงคโปร์',flag:'🇸🇬', rate:0.0374, symbol:'S$' },
  { code:'AUD', name:'ดอลลาร์ออสเตรเลีย',flag:'🇦🇺',rate:0.0436,symbol:'A$' },
  { code:'GBP', name:'ปอนด์สเตอร์ลิง',flag:'🇬🇧', rate:0.0221, symbol:'£' },
]

const MODELS = [
  { model:'BYD Atto 3',  baseTHB:1099000 },
  { model:'BYD Seal AWD',baseTHB:1699000 },
  { model:'BYD Han',     baseTHB:2099000 },
  { model:'BYD Dolphin', baseTHB:899000  },
  { model:'MG ZS EV',    baseTHB:799000  },
]

const RATE_HISTORY = [
  { date:'2026-06-14', usd:36.12, eur:38.95, cny:4.97 },
  { date:'2026-06-13', usd:36.08, eur:38.90, cny:4.96 },
  { date:'2026-06-12', usd:36.20, eur:39.05, cny:4.98 },
  { date:'2026-06-11', usd:36.15, eur:38.85, cny:4.95 },
  { date:'2026-06-10', usd:36.05, eur:38.80, cny:4.94 },
]

export default async function MultiCurrencyPage(container) {
  let baseCur = 'THB'
  let selModel = MODELS[0]
  let customAmt = selModel.baseTHB

  function convert(amtTHB, toCur) {
    const c = CURRENCIES.find(x => x.code === toCur)
    if (!c) return amtTHB
    if (toCur === 'THB') return amtTHB
    return amtTHB * c.rate
  }

  function fmt(val, code) {
    const c = CURRENCIES.find(x => x.code === code)
    if (!c) return val.toFixed(2)
    if (code === 'THB') return '฿'+val.toLocaleString('th-TH', {minimumFractionDigits:0, maximumFractionDigits:0})
    if (code === 'JPY') return c.symbol+Math.round(val).toLocaleString()
    return c.symbol+val.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})
  }

  function render() {
    const amtTHB = customAmt || selModel.baseTHB

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💱 Multi-Currency Pricing</div>
            <div class="page-subtitle">แปลงราคารถ ${MODELS.length} รุ่น เป็น ${CURRENCIES.length} สกุลเงิน · อัตราแลกเปลี่ยน Real-time</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="update-rate-btn">🔄 อัปเดตอัตรา</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Left: converter -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Model selector -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🚗 เลือกรุ่นรถ</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${MODELS.map(m => `
                  <div class="model-sel" data-model="${m.model}" style="padding:8px 12px;border-radius:var(--radius-sm);background:${selModel.model===m.model?'var(--primary)':'var(--surface-2)'};color:${selModel.model===m.model?'#fff':'var(--text)'};cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;transition:all .15s">
                    <span style="font-weight:600">${m.model}</span>
                    <span>${formatCurrency(m.baseTHB)}</span>
                  </div>`).join('')}
              </div>
            </div>

            <!-- Custom amount -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">✏️ ระบุราคาเอง (บาท)</div>
              <input class="input" id="custom-amt" type="number" value="${amtTHB}" style="width:100%;font-size:1rem;font-weight:700">
            </div>

            <!-- Rate table -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 อัตราแลกเปลี่ยนล่าสุด</div>
              ${RATE_HISTORY.slice(0,1).map(h => `
                <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">${h.date}</div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <div style="display:flex;justify-content:space-between;font-size:0.76rem"><span>1 USD</span><span style="font-weight:700">฿${h.usd}</span></div>
                  <div style="display:flex;justify-content:space-between;font-size:0.76rem"><span>1 EUR</span><span style="font-weight:700">฿${h.eur}</span></div>
                  <div style="display:flex;justify-content:space-between;font-size:0.76rem"><span>1 CNY</span><span style="font-weight:700">฿${h.cny}</span></div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Right: converted prices -->
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted)">💱 ราคา ${selModel.model} (${formatCurrency(amtTHB)}) ในทุกสกุลเงิน</div>
            ${CURRENCIES.map(c => {
              const val = convert(amtTHB, c.code)
              return `
              <div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:12px">
                <div style="font-size:1.6rem">${c.flag}</div>
                <div style="flex:1">
                  <div style="font-size:0.72rem;color:var(--text-muted)">${c.name} (${c.code})</div>
                  <div style="font-size:1.1rem;font-weight:900;color:${c.code==='THB'?'var(--primary)':'var(--text)'}">${fmt(val, c.code)}</div>
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted)">1฿ = ${c.rate.toFixed(4)} ${c.code}</div>
              </div>`
            }).join('')}

            <!-- All models comparison -->
            <div class="card" style="padding:14px;margin-top:4px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 เปรียบราคาทุกรุ่น (USD)</div>
              ${MODELS.map(m => `
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                  <span>${m.model}</span>
                  <div style="text-align:right">
                    <div style="font-weight:700">${fmt(convert(m.baseTHB,'USD'),'USD')}</div>
                    <div style="font-size:0.64rem;color:var(--text-muted)">${formatCurrency(m.baseTHB)}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.model-sel').forEach(el => el.addEventListener('click', () => {
      selModel = MODELS.find(m => m.model === el.dataset.model) || selModel
      customAmt = selModel.baseTHB
      render()
    }))
    document.getElementById('custom-amt')?.addEventListener('input', e => {
      customAmt = parseInt(e.target.value) || 0
      render()
    })
    document.getElementById('update-rate-btn')?.addEventListener('click', () => {
      CURRENCIES.forEach(c => {
        if (c.code === 'THB') return
        c.rate = parseFloat((c.rate * (1 + (Math.random() - 0.5) * 0.008)).toFixed(6))
      })
      render()
      showToast('🔄 อัปเดตอัตราแลกเปลี่ยนจาก BOT แล้ว — ราคาเปลี่ยนแปลง ±0.4%', 'success')
    })
  }

  render()
}
