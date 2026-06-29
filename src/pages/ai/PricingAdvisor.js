/**
 * AI Pricing Advisor — ที่ปรึกษาราคา AI
 * Route: /ai/pricing
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const MODELS_DATA = [
  { name: 'BYD Dolphin', msrp: 899000, minPrice: 860000, competitor: 850000, margin: 8, stock: 8, sold30: 12, demand: 'high' },
  { name: 'BYD Atto 3', msrp: 1099000, minPrice: 1050000, competitor: 1080000, margin: 9, stock: 5, sold30: 8, demand: 'medium' },
  { name: 'BYD Seal AWD', msrp: 1699000, minPrice: 1620000, competitor: 1680000, margin: 7, stock: 3, sold30: 6, demand: 'medium' },
  { name: 'MG ZS EV', msrp: 799000, minPrice: 760000, competitor: 780000, margin: 6, stock: 11, sold30: 5, demand: 'low' },
  { name: 'BYD Han', msrp: 2099000, minPrice: 2000000, competitor: 2050000, margin: 10, stock: 2, sold30: 3, demand: 'low' },
]

const DEMAND_COLORS = { high: 'success', medium: 'warning', low: 'secondary' }
const DEMAND_LABELS = { high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' }

function aiRecommendedPrice(m) {
  // Simple pricing logic based on demand and stock
  if (m.demand === 'high' && m.stock < 5) return m.msrp // full price
  if (m.demand === 'low' && m.stock > 8) return m.minPrice + Math.round((m.msrp - m.minPrice) * 0.2)
  if (m.competitor < m.msrp) return Math.min(m.msrp, m.competitor + 5000)
  return m.msrp - Math.round((m.msrp - m.minPrice) * 0.3)
}

export default async function PricingAdvisorPage(container) {
  let customPrices = {}
  let selectedModel = null

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 AI Pricing Advisor</div>
            <div class="page-subtitle">ที่ปรึกษาราคา AI — วิเคราะห์ตลาด + แนะนำราคาเหมาะสม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="apply-all-btn">✅ ใช้ราคา AI ทั้งหมด</button>
          </div>
        </div>

        <!-- AI summary -->
        <div style="padding:14px;background:var(--surface-2);border-radius:var(--radius);border-left:3px solid var(--primary);margin-bottom:16px;font-size:0.83rem">
          🤖 <strong>LAMI วิเคราะห์:</strong> BYD Dolphin ควรขึ้นราคาเพราะ demand สูงและสต็อกน้อย · MG ZS EV ควรลดราคาเพื่อระบายสต็อก · BYD Han มี margin ดีที่สุด ควรรักษาราคา MSRP
        </div>

        <!-- Model pricing cards -->
        <div style="display:flex;flex-direction:column;gap:12px">
          ${MODELS_DATA.map(m => {
            const aiPrice = customPrices[m.name] || aiRecommendedPrice(m)
            const diff = aiPrice - m.msrp
            const marginAmt = aiPrice - (m.msrp * (1 - m.margin/100))
            const marginPct = Math.round(marginAmt / aiPrice * 100)

            return `<div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.93rem">${m.name}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">
                    📦 สต็อก ${m.stock} · ขาย 30 วัน ${m.sold30} คัน ·
                    <span class="badge badge-${DEMAND_COLORS[m.demand]}" style="font-size:0.6rem"> Demand ${DEMAND_LABELS[m.demand]}</span>
                  </div>
                </div>
                <button class="btn btn-xs btn-secondary adj-btn" data-model="${m.name}">⚙️ ปรับเอง</button>
              </div>

              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
                ${priceBox('MSRP', m.msrp, 'secondary')}
                ${priceBox('คู่แข่ง', m.competitor, 'warning')}
                ${priceBox('AI แนะนำ', aiPrice, 'primary')}
                ${priceBox('Margin', marginPct + '%', marginPct >= 8 ? 'success' : 'warning')}
              </div>

              <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem">
                <span>เทียบ MSRP: <strong style="color:var(--${diff>0?'success':diff<0?'warning':'secondary'})">${diff>0?'+':''}${formatCurrency(diff)}</strong></span>
                <span style="color:var(--text-muted)">·</span>
                <span>ต่ำสุด: ${formatCurrency(m.minPrice)}</span>
                ${aiPrice < m.minPrice ? `<span class="badge badge-danger" style="font-size:0.6rem">⚠️ ต่ำกว่า floor</span>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Competitive analysis table -->
        <div class="card" style="overflow:hidden;margin-top:14px">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📊 เปรียบเทียบคู่แข่ง</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">รุ่น</th>
                <th style="padding:8px 10px;text-align:right">MSRP เรา</th>
                <th style="padding:8px 10px;text-align:right">คู่แข่ง</th>
                <th style="padding:8px 10px;text-align:right">ต่าง</th>
                <th style="padding:8px 10px;text-align:right">AI แนะนำ</th>
              </tr>
            </thead>
            <tbody>
              ${MODELS_DATA.map(m => {
                const diff = m.msrp - m.competitor
                const aiP = customPrices[m.name] || aiRecommendedPrice(m)
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px;font-weight:600">${m.name}</td>
                  <td style="padding:8px 10px;text-align:right">${formatCurrency(m.msrp)}</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--text-muted)">${formatCurrency(m.competitor)}</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--${diff>0?'danger':diff<0?'success':'secondary'})">${diff>0?'+':''}${formatCurrency(diff)}</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--primary)">${formatCurrency(aiP)}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.adj-btn').forEach(b => b.addEventListener('click', () => {
      const m = MODELS_DATA.find(x => x.name === b.dataset.model); if (m) openAdjustModal(m)
    }))
    document.getElementById('apply-all-btn')?.addEventListener('click', () => {
      let changed = 0
      MODELS_DATA.forEach(m => {
        const ai = aiRecommendedPrice(m)
        if (customPrices[m.name] !== ai) { customPrices[m.name] = ai; changed++ }
      })
      renderPage()
      showToast(`✅ ใช้ราคา AI แล้ว ${changed} รุ่น — Price List อัปเดตแล้ว`, 'success')
    })
  }

  function openAdjustModal(m) {
    const aiP = customPrices[m.name] || aiRecommendedPrice(m)
    openModal({
      title: `⚙️ ปรับราคา ${m.name}`,
      size: 'sm',
      body: `<div style="display:grid;gap:12px">
        ${row('MSRP', formatCurrency(m.msrp))}
        ${row('ราคาต่ำสุด', formatCurrency(m.minPrice))}
        ${row('ราคาคู่แข่ง', formatCurrency(m.competitor))}
        ${row('AI แนะนำ', formatCurrency(aiP))}
        <div class="input-group"><label class="input-label">ราคาที่ต้องการ (บาท)</label><input class="input" id="adj-price" type="number" value="${aiP}"></div>
      </div>`,
      onConfirm() {
        const val = parseInt(document.getElementById('adj-price')?.value)
        if (val < m.minPrice) { showToast('❗ ต่ำกว่าราคาต่ำสุด', 'error'); return }
        customPrices[m.name] = val
        showToast(`✅ ปรับราคา ${m.name} แล้ว`, 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function priceBox(label, val, color) {
  return `<div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:8px;text-align:center">
    <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">${label}</div>
    <div style="font-size:0.83rem;font-weight:700;color:var(--${color})">${typeof val === 'number' ? val.toLocaleString() : val}</div>
  </div>`
}
function row(l, v) { return `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
