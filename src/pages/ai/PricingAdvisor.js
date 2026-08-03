/**
 * AI Pricing Advisor — ที่ปรึกษาราคา AI
 * Route: /ai/pricing
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, getSalesData } from '../../core/db.js'

const DEMAND_COLORS = { high: 'success', medium: 'warning', low: 'secondary' }
const DEMAND_LABELS = { high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' }

// (v1.0.327) เดิมทั้งหน้านี้ใช้ MODELS_DATA 5 รุ่นปลอมตายตัว (msrp/minPrice/competitor/margin/stock/sold30/
// demand ล้วน hardcode) และปุ่ม "✅ ใช้ราคา AI ทั้งหมด" แค่เปลี่ยนตัวแปร customPrices ในหน่วยความจำ ไม่แตะ
// Price List จริงเลย (ทั้งที่ toast บอกว่า "Price List อัปเดตแล้ว") แก้ให้ใช้รุ่นรถจริงจาก vehicle_models
// (collection เดียวกับที่หน้า Price List ใช้จริง) สต็อก/ยอดขาย 30 วันคำนวณจากข้อมูลจริง (getSalesData)
// ราคาคู่แข่งไม่มีแหล่งข้อมูลจริงในระบบนี้เลย (ไม่มี API เชื่อมราคาคู่แข่งภายนอก) จึงเปลี่ยนเป็นให้พนักงาน
// กรอกเองแล้วบันทึกจริง (competitorPrice บน vehicle_models) แทนเลขปลอมที่ AI แต่งขึ้นมาเอง — Margin
// คำนวณจากต้นทุนจริงเฉลี่ยของการขายจริงที่จับคู่ได้ ถ้ายังไม่มีข้อมูลขายจริงของรุ่นนั้นจะโชว์ "-" ไม่ใช่เลข
// ปลอม ปุ่ม "ใช้ราคา AI ทั้งหมด" เขียนจริงลง vehicle_models.promotionPrice ทุกรุ่น (updateDocData จริง)

function matchSales(sales, m) {
  const mb = (m.brand || '').toLowerCase().trim()
  const mm = (m.model || '').toLowerCase().trim()
  return sales.filter(s => {
    const sb = (s.brand || '').toLowerCase()
    const sm = ((s.model || '') + ' ' + (s.brand || '')).toLowerCase()
    return (!mb || sb.includes(mb)) && (!mm || sm.includes(mm))
  })
}

// heuristic ความต้องการซื้อ — สัดส่วนขาย 30 วันเทียบสต็อกที่มี (ไม่มีสูตรมาตรฐานสากล กำหนดขึ้นเองแบบสมเหตุสมผล)
function demandLevel(sold30, stock) {
  const ratio = sold30 / Math.max(stock, 1)
  if (ratio >= 0.5) return 'high'
  if (ratio >= 0.15) return 'medium'
  return 'low'
}

function aiRecommendedPrice(m) {
  const base = m.promotionPrice || m.basePrice
  if (m.demand === 'high' && m.stock < 5) return m.basePrice // สต็อกน้อย+ขายดี ควรขายราคาปกติเต็ม ไม่ลด
  if (m.demand === 'low' && m.stock > 8) return Math.round(m.basePrice * 0.94) // สต็อกล้น+ขายช้า ลดราคาระบายสต็อก
  if (m.competitorPrice && m.competitorPrice < m.basePrice) return Math.min(m.basePrice, m.competitorPrice + 5000)
  return base
}

export default async function PricingAdvisorPage(container) {
  const myGen = container.__routerGen
  let models = []
  let loading = true

  async function loadData() {
    loading = true
    let vModels = [], sales = []
    try { vModels = await listDocs('vehicle_models', [], 'basePrice', 'asc', 200) } catch {}
    try { sales = await getSalesData() } catch {}
    if (container.__routerGen !== myGen) return
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    models = vModels.filter(m => !m.deleted).map(m => {
      const matched = matchSales(sales, m)
      const sold30 = matched.filter(s => s.date && new Date(s.date) >= cutoff).length
      const withCost = matched.filter(s => s.salePrice > 0 && s.cost > 0)
      const marginPct = withCost.length ? Math.round(withCost.reduce((a, s) => a + (s.salePrice - s.cost) / s.salePrice * 100, 0) / withCost.length) : null
      return { ...m, sold30, marginPct, demand: demandLevel(sold30, m.stock || 0) }
    })
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 AI Pricing Advisor</div>
            <div class="page-subtitle">ที่ปรึกษาราคา AI — วิเคราะห์จากยอดขาย/สต็อกจริงในระบบ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="apply-all-btn" ${models.length ? '' : 'disabled'}>✅ ใช้ราคา AI ทั้งหมด</button>
          </div>
        </div>

        ${!models.length ? `<div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-title">ยังไม่มีรุ่นรถใน Price List</div><div class="empty-desc">เพิ่มรุ่นรถได้ที่หน้า Price List ก่อน</div></div>` : `
        <!-- Model pricing cards -->
        <div style="display:flex;flex-direction:column;gap:12px">
          ${models.map(m => {
            const aiPrice = aiRecommendedPrice(m)
            const diff = aiPrice - m.basePrice
            return `<div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.93rem">${m.brand} ${m.model}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">
                    📦 สต็อก ${m.stock || 0} · ขาย 30 วัน ${m.sold30} คัน ·
                    <span class="badge badge-${DEMAND_COLORS[m.demand]}" style="font-size:0.6rem"> Demand ${DEMAND_LABELS[m.demand]}</span>
                  </div>
                </div>
                <button class="btn btn-xs btn-secondary adj-btn" data-id="${m.id}">⚙️ ปรับเอง</button>
              </div>

              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
                ${priceBox('ราคาปกติ', m.basePrice, 'secondary')}
                ${priceBox('คู่แข่ง', m.competitorPrice || '— ไม่ทราบ', 'warning')}
                ${priceBox('AI แนะนำ', aiPrice, 'primary')}
                ${priceBox('Margin จริง', m.marginPct != null ? m.marginPct + '%' : '— ยังไม่มีข้อมูลขาย', m.marginPct >= 8 ? 'success' : 'warning')}
              </div>

              <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;flex-wrap:wrap">
                <span>เทียบราคาปกติ: <strong style="color:var(--${diff>0?'success':diff<0?'warning':'secondary'})">${diff>0?'+':''}${formatCurrency(diff)}</strong></span>
                ${!m.competitorPrice ? `<span class="badge badge-secondary" style="font-size:0.6rem">⚠️ ยังไม่มีราคาคู่แข่ง กดปรับเองเพื่อกรอก</span>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
        `}
      </div>
    `

    container.querySelectorAll('.adj-btn').forEach(b => b.addEventListener('click', () => {
      const m = models.find(x => x.id === b.dataset.id); if (m) openAdjustModal(m)
    }))
    document.getElementById('apply-all-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('apply-all-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      let changed = 0, failed = 0
      for (const m of models) {
        const ai = aiRecommendedPrice(m)
        if (ai === m.basePrice ? !!m.promotionPrice : ai !== m.promotionPrice) {
          try {
            await updateDocData('vehicle_models', m.id, { promotionPrice: ai === m.basePrice ? null : ai })
            changed++
          } catch { failed++ }
        }
      }
      await loadData()
      showToast(failed ? `⚠️ ใช้ราคา AI แล้ว ${changed} รุ่น — พลาด ${failed} รุ่น` : `✅ ใช้ราคา AI แล้ว ${changed} รุ่น — บันทึกลง Price List จริง`, failed ? 'error' : 'success')
    })
  }

  function openAdjustModal(m) {
    const aiP = aiRecommendedPrice(m)
    openModal({
      title: `⚙️ ปรับราคา ${m.brand} ${m.model}`,
      size: 'sm',
      body: `<div style="display:grid;gap:12px">
        ${row('ราคาปกติ', formatCurrency(m.basePrice))}
        ${row('AI แนะนำ', formatCurrency(aiP))}
        <div class="input-group"><label class="input-label">ราคาคู่แข่ง (บาท) — กรอกเองจากที่สำรวจ</label><input class="input" id="adj-comp" type="number" value="${m.competitorPrice || ''}"></div>
        <div class="input-group"><label class="input-label">ราคาที่ต้องการตั้ง (บาท, 0 = ใช้ราคาปกติ)</label><input class="input" id="adj-price" type="number" value="${aiP === m.basePrice ? 0 : aiP}"></div>
      </div>`,
      async onConfirm() {
        const compVal = +document.getElementById('adj-comp')?.value || 0
        const priceVal = +document.getElementById('adj-price')?.value || 0
        try {
          await updateDocData('vehicle_models', m.id, {
            competitorPrice: compVal > 0 ? compVal : null,
            promotionPrice: priceVal > 0 && priceVal !== m.basePrice ? priceVal : null,
          })
          showToast(`✅ ปรับราคา ${m.brand} ${m.model} แล้ว`, 'success')
          await loadData()
        } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
      }
    })
  }

  await loadData()
}

function priceBox(label, val, color) {
  return `<div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:8px;text-align:center">
    <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">${label}</div>
    <div style="font-size:0.83rem;font-weight:700;color:var(--${color})">${typeof val === 'number' ? val.toLocaleString() : val}</div>
  </div>`
}
function row(l, v) { return `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
