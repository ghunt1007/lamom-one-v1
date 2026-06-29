/**
 * Price History Log — ประวัติการเปลี่ยนราคา ต่อรุ่น ต่อวัน
 * Route: /dms/price-history
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const MODELS = ['BYD Atto 3','BYD Seal AWD','BYD Han','BYD Dolphin','MG ZS EV']

const DEMO_HISTORY = [
  { id:'PH001', model:'BYD Atto 3', date:'2026-06-01', oldPrice:1129000, newPrice:1099000, change:-30000, reason:'โปรโมชั่น Mid-Year', by:'Manager', approved:true },
  { id:'PH002', model:'BYD Seal AWD', date:'2026-05-15', oldPrice:1749000, newPrice:1699000, change:-50000, reason:'ลดราคาเพื่อแข่ง Tesla Model 3', by:'Director', approved:true },
  { id:'PH003', model:'BYD Han', date:'2026-05-01', oldPrice:2199000, newPrice:2099000, change:-100000, reason:'เปิดตัวรุ่น 2026 ใหม่', by:'Director', approved:true },
  { id:'PH004', model:'BYD Dolphin', date:'2026-04-10', oldPrice:849000, newPrice:899000, change:50000, reason:'ต้นทุนแบตฯ เพิ่ม MY2026', by:'Manager', approved:true },
  { id:'PH005', model:'MG ZS EV', date:'2026-04-01', oldPrice:829000, newPrice:799000, change:-30000, reason:'ยกระดับการแข่งขัน Atto 3', by:'Manager', approved:true },
  { id:'PH006', model:'BYD Atto 3', date:'2026-03-01', oldPrice:1149000, newPrice:1129000, change:-20000, reason:'Q1 Sales Drive', by:'Manager', approved:true },
  { id:'PH007', model:'BYD Seal AWD', date:'2026-02-14', oldPrice:1799000, newPrice:1749000, change:-50000, reason:'Valentine Campaign', by:'Manager', approved:true },
]

export default async function PriceHistoryPage(container) {
  const myGen = container.__routerGen
  let priceHistory = [...DEMO_HISTORY].map(h => ({ ...h }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('price_history', [], 'date', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `PH${String(i+1).padStart(3,'0')}`,
        model: d.model || '',
        date: d.date || '',
        oldPrice: d.oldPrice || 0,
        newPrice: d.newPrice || 0,
        change: d.change !== undefined ? d.change : (d.newPrice - d.oldPrice) || 0,
        reason: d.reason || '',
        by: d.by || d.approvedBy || '',
        approved: d.approved !== undefined ? d.approved : true,
      }))
      priceHistory = [...mapped, ...DEMO_HISTORY]
      dataSource = 'live'
    }
  } catch {}

  let filterModel = 'all'
  let showAddForm = false

  function render() {
    const rows = filterModel === 'all' ? priceHistory : priceHistory.filter(h => h.model === filterModel)
    const selModel = filterModel !== 'all' ? priceHistory.filter(h=>h.model===filterModel) : []
    const currentPrice = selModel.length ? selModel[0].newPrice : null
    const totalChanges = rows.reduce((s,h)=>s+h.change,0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📈 Price History Log</div>
            <div class="page-subtitle">ประวัติการเปลี่ยนราคาต่อรุ่น · Audit Trail · ${priceHistory.length} รายการ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-btn">+ บันทึกราคาใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📋 รายการทั้งหมด', priceHistory.length, 'var(--primary)')}
          ${sc('📉 ลดราคารวม', formatCurrency(Math.abs(priceHistory.filter(h=>h.change<0).reduce((s,h)=>s+h.change,0))), 'var(--success)')}
          ${sc('📈 ขึ้นราคารวม', formatCurrency(priceHistory.filter(h=>h.change>0).reduce((s,h)=>s+h.change,0)), 'var(--danger)')}
          ${sc('🔄 เปลี่ยนแปลงสุทธิ', formatCurrency(totalChanges), totalChanges<=0?'var(--success)':'var(--danger)')}
        </div>

        <!-- Model filter + current price -->
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
          <select class="input" id="model-sel" style="min-width:200px">
            <option value="all">ทุกรุ่น</option>
            ${MODELS.map(m=>`<option value="${m}" ${filterModel===m?'selected':''}>${m}</option>`).join('')}
          </select>
          ${currentPrice ? `<div style="font-size:0.8rem;font-weight:700;color:var(--primary)">ราคาปัจจุบัน: ${formatCurrency(currentPrice)}</div>` : ''}
        </div>

        <!-- Chart for selected model -->
        ${filterModel !== 'all' && selModel.length > 1 ? `
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 แนวโน้มราคา ${filterModel}</div>
          <div style="display:flex;align-items:flex-end;gap:6px;height:80px">
            ${selModel.slice().reverse().map((h,i) => {
              const minP = Math.min(...selModel.map(x=>x.newPrice))
              const maxP = Math.max(...selModel.map(x=>x.newPrice))
              const range = maxP - minP || 1
              const h_pct = Math.round(((h.newPrice - minP) / range) * 60 + 20)
              return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:3px">
                <div style="font-size:0.56rem;color:var(--text-muted)">${(h.newPrice/1000000).toFixed(2)}M</div>
                <div style="width:100%;height:${h_pct}px;background:${h.change<0?'var(--success)':'var(--danger)'};border-radius:4px 4px 0 0"></div>
                <div style="font-size:0.54rem;color:var(--text-muted)">${formatDate(h.date).slice(0,5)}</div>
              </div>`
            }).join('')}
          </div>
        </div>` : ''}

        <!-- History table -->
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:760px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
              <th style="padding:10px 12px;text-align:left">วันที่</th>
              <th>รุ่น</th>
              <th style="text-align:right">ราคาเดิม</th>
              <th style="text-align:right">ราคาใหม่</th>
              <th style="text-align:right">เปลี่ยนแปลง</th>
              <th>เหตุผล</th>
              <th>อนุมัติโดย</th>
            </tr></thead>
            <tbody>
              ${rows.map(h => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.78rem">
                  <td style="padding:9px 12px;color:var(--text-muted)">${formatDate(h.date)}</td>
                  <td style="font-weight:600">${escHtml(h.model)}</td>
                  <td style="text-align:right;color:var(--text-muted)">${formatCurrency(h.oldPrice)}</td>
                  <td style="text-align:right;font-weight:700">${formatCurrency(h.newPrice)}</td>
                  <td style="text-align:right;font-weight:700;color:${h.change<0?'var(--success)':'var(--danger)'}">
                    ${h.change<0?'▼':'▲'} ${formatCurrency(Math.abs(h.change))}
                  </td>
                  <td style="font-size:0.72rem;color:var(--text-muted)">${escHtml(h.reason)}</td>
                  <td style="font-size:0.72rem">${escHtml(h.by)} ${h.approved?'✅':''}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`

    document.getElementById('model-sel')?.addEventListener('change', e => { filterModel = e.target.value; render() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const rows = (filterModel ? priceHistory.filter(h => h.model === filterModel) : priceHistory)
      exportToExcel(
        rows.map(h => ({
          'รุ่นรถ': h.model,
          'วันที่': h.date,
          'ราคาเดิม (บาท)': h.oldPrice,
          'ราคาใหม่ (บาท)': h.newPrice,
          'เปลี่ยนแปลง (บาท)': h.change,
          'เหตุผล': h.reason,
          'ผู้อนุมัติ': h.by,
          'อนุมัติแล้ว': h.approved ? 'ใช่' : 'ไม่',
        })),
        'Price_History.xlsx',
        'Price History'
      )
      showToast('📥 Export Price History แล้ว', 'success')
    })
    document.getElementById('add-btn')?.addEventListener('click', () => openAddModal())
  }

  function openAddModal() {
    openModal({
      title: '+ บันทึกราคาใหม่', size:'sm',
      body: `<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่นรถ</label>
          <select class="input" id="ph-model" style="width:100%;margin-top:4px">
            ${MODELS.map(m=>`<option>${m}</option>`).join('')}
          </select></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคาใหม่ (บาท)</label>
          <input class="input" id="ph-price" type="number" placeholder="1099000" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่มีผล</label>
          <input class="input" id="ph-date" type="date" value="2026-06-14" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เหตุผล</label>
          <input class="input" id="ph-reason" placeholder="โปรโมชั่น / ต้นทุน..." style="width:100%;margin-top:4px"></div>
      </div>`,
      confirmText: '💾 บันทึกราคา',
      onConfirm() {
        const model  = document.getElementById('ph-model')?.value
        const price  = parseInt(document.getElementById('ph-price')?.value)
        const date   = document.getElementById('ph-date')?.value
        const reason = document.getElementById('ph-reason')?.value
        if (!price || !reason) { showToast('กรอกข้อมูลให้ครบ', 'warning'); return false }
        const prev = priceHistory.find(h => h.model === model)
        const oldPrice = prev ? prev.newPrice : price
        priceHistory.unshift({ id:'PH'+Date.now(), model, date, oldPrice, newPrice:price, change:price-oldPrice, reason, by:'Manager', approved:false })
        render(); showToast(`✅ บันทึกราคา ${model} = ${formatCurrency(price)} แล้ว · รอ Director อนุมัติ`, 'success')
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
