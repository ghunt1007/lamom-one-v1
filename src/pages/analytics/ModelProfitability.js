/**
 * Model Profitability — รุ่นไหนทำกำไรสูงสุด
 * Route: /analytics/model-profit
 */
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'
import { exportToExcel, exportToCSV } from '../../utils/importExport.js'
import { saleCost, costEstimateNote } from '../../utils/saleCost.js'
import { escHtml } from '../../utils/escape.js'

// (v1.0.1310) เดิมเป็นรุ่น BYD/MG สมมติ 6 รุ่น (ยอดขาย/ราคา/ต้นทุน/F&I แต่งขึ้น) และเอาข้อมูลจริงไปทับเฉพาะชื่อที่ตรงกัน
// รุ่นที่ขายจริง (เช่น Deepal) จึงไม่เคยขึ้น — ตอนนี้สร้างจากใบจองที่ขายแล้วจริงล้วน
function calcRow(m) {
  const vehicleGross = m.avgPrice - m.avgCost
  const totalGross = vehicleGross + m.finance
  const grossPct = m.avgPrice > 0 ? Math.round(totalGross / m.avgPrice * 100) : 0
  const totalRevenue = m.sold * m.avgPrice
  const totalProfit = m.sold * totalGross
  return { ...m, vehicleGross, totalGross, grossPct, totalRevenue, totalProfit }
}

export function modelsFromSales(sales = []) {
  const byCar = {}
  for (const s of sales) {
    if (!s || !s.delivered || !(Number(s.salePrice) > 0)) continue
    const key = s.model || s.vehicleModel || 'ไม่ระบุ'
    if (!byCar[key]) byCar[key] = { model: key, brand: s.brand || '', sold: 0, rev: 0, cost: 0, fin: 0 }
    const m = byCar[key]
    m.sold++
    m.rev += Number(s.salePrice) || 0
    m.cost += saleCost(s)
    m.fin += Number(s.comFinance || s.finance) || 0
  }
  return Object.values(byCar).map(m => ({
    model: m.model, brand: m.brand, sold: m.sold,
    avgPrice: Math.round(m.rev / m.sold), avgCost: Math.round(m.cost / m.sold), finance: Math.round(m.fin / m.sold),
  }))
}

export default async function ModelProfitabilityPage(container) {
  const myGen = container.__routerGen
  let liveModels = []
  let soldRows = []
  let dataSource = 'demo'
  let sortBy = 'totalProfit'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    soldRows = sales.filter(s => s.delivered && Number(s.salePrice) > 0)
    liveModels = modelsFromSales(sales)
    if (liveModels.length) dataSource = 'live'
  } catch {}

  function bar(pct, color) {
    return '<div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden;margin-top:3px">' +
      '<div style="height:100%;width:'+Math.min(pct,100)+'%;background:'+color+';border-radius:4px;transition:width .4s"></div>' +
    '</div>'
  }

  function modelRow(r, maxProfit) {
    const color = r.grossPct>=15?'var(--success)':r.grossPct>=10?'var(--warning)':'var(--danger)'
    const barW = maxProfit > 0 ? Math.max(0, Math.round(r.totalProfit/maxProfit*100)) : 0
    return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
      '<td style="padding:10px 10px">' +
        '<div style="font-weight:700;font-size:0.8rem">'+escHtml(r.model)+'</div>' +
        '<div style="font-size:0.66rem;color:var(--text-muted)">'+escHtml(r.brand)+'</div>' +
      '</td>' +
      '<td style="padding:10px 10px;text-align:right;font-size:0.76rem">'+r.sold+'</td>' +
      '<td style="padding:10px 10px;text-align:right;font-size:0.76rem">฿'+Math.round(r.vehicleGross/1000)+'k</td>' +
      '<td style="padding:10px 10px;text-align:right;font-size:0.76rem;color:var(--primary)">'+(r.finance ? '+฿'+Math.round(r.finance/1000)+'k' : '-')+'</td>' +
      '<td style="padding:10px 10px;text-align:right;font-size:0.78rem;font-weight:700;color:'+color+'">'+r.grossPct+'%</td>' +
      '<td style="padding:10px 10px;min-width:140px">' +
        '<div style="font-size:0.74rem;font-weight:700;color:var(--success)">฿'+Math.round(r.totalProfit/1000)+'k</div>' +
        bar(barW,'var(--success)') +
      '</td>' +
    '</tr>'
  }

  function render() {
    const rows = liveModels.map(calcRow)
    rows.sort((a,b)=> sortBy==='grossPct' ? b.grossPct-a.grossPct : sortBy==='sold' ? b.sold-a.sold : b.totalProfit-a.totalProfit)
    const maxProfit = Math.max(0, ...rows.map(r=>r.totalProfit))
    const totalProfit = rows.reduce((s,r)=>s+r.totalProfit,0)
    const totalRev = rows.reduce((s,r)=>s+r.totalRevenue,0)
    const totalSold = rows.reduce((s,r)=>s+r.sold,0)
    const avgMargin = rows.length ? Math.round(rows.reduce((s,r)=>s+r.grossPct,0)/rows.length) : 0
    const topModel = rows[0] || { model: '-' }

    const sortBtns = [['totalProfit','💰 กำไรรวม'],['grossPct','📊 Margin %'],['sold','🚗 ยอดขาย']].map(([k,l])=>'<button class="btn btn-sm '+(sortBy===k?'btn-primary':'btn-secondary')+' sort-btn" data-k="'+k+'">'+l+'</button>').join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Model Profitability</div>
            <div class="page-subtitle">กำไรและ Margin แยกตามรุ่น · ${liveModels.length} รุ่น${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ยอดขาย/ต้นทุนจริง</span> <span style="color:var(--text-muted);font-size:0.68rem">(นับเฉพาะคันที่ขายแล้ว)</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 ส่งออก</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:14px">
          ${sc('💰 กำไรรวม', totalSold ? '฿'+Math.round(totalProfit/1000000*10)/10+'M' : '-', 'var(--success)')}
          ${sc('📈 Revenue รวม', totalSold ? '฿'+Math.round(totalRev/1000000*10)/10+'M' : '-', 'var(--primary)')}
          ${sc('📊 Avg Gross Margin', totalSold ? avgMargin+'%' : '-', avgMargin>=12?'var(--success)':'var(--warning)')}
          ${sc('🏆 รุ่นกำไรสูงสุด', escHtml(topModel.model.split(' ').slice(0,2).join(' ')), 'var(--warning)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${sortBtns}</div>

        <div class="card" style="padding:0;overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead>
              <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">รุ่น</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--text-muted)">ขาย</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--text-muted)">Gross/คัน</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--primary)">+คอมไฟแนนซ์/คัน</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--text-muted)">กำไร%</th>
                <th style="padding:10px 10px;font-weight:600;color:var(--text-muted)">กำไรรวม</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map(r=>modelRow(r,maxProfit)).join('') : '<tr><td colspan="6" style="padding:16px;text-align:center;color:var(--text-muted)">ยังไม่มีรถที่ขายแล้วพร้อมราคาขาย</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--border);background:var(--surface-2)">
                <td style="padding:10px 10px;font-weight:700">รวมทั้งหมด</td>
                <td style="padding:10px 10px;text-align:right;font-weight:700">${totalSold}</td>
                <td colspan="3"></td>
                <td style="padding:10px 10px;font-weight:700;color:var(--success)">฿${Math.round(totalProfit/1000000*10)/10}M</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ${costEstimateNote(soldRows)}
      </div>`

    container.querySelectorAll('.sort-btn').forEach(b=>b.addEventListener('click',()=>{sortBy=b.dataset.k;render()}))
    document.getElementById('export-btn')?.addEventListener('click',()=>openExportModal())
  }

  function openExportModal() {
    const rows = liveModels.map(calcRow).sort((a, b) => b.totalProfit - a.totalProfit)
    const exportData = rows.map(r => ({
      'รุ่นรถ': r.model,
      'Brand': r.brand,
      'ขายได้ (คัน)': r.sold,
      'ราคาขายเฉลี่ย (บาท)': r.avgPrice,
      'กำไรยานยนต์ (บาท)': r.vehicleGross,
      'คอมไฟแนนซ์เฉลี่ย/คัน (บาท)': r.finance,
      'Margin %': r.grossPct,
      'กำไรรวม (บาท)': r.totalProfit,
    }))
    openModal({
      title: '📤 Export กำไรรายรุ่น',
      size: 'md',
      body: `
        <div style="font-size:0.82rem">
          <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:10px">Preview ก่อน Export — ${rows.length} รุ่น</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.74rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                  <th style="padding:7px 8px;text-align:left">รุ่นรถ</th>
                  <th style="padding:7px 8px;text-align:right">ขาย</th>
                  <th style="padding:7px 8px;text-align:right">กำไร/คัน</th>
                  <th style="padding:7px 8px;text-align:right">กำไร</th>
                  <th style="padding:7px 8px;text-align:right">กำไรรวม</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => {
                  const c = r.grossPct>=15?'var(--success)':r.grossPct>=10?'var(--warning)':'var(--danger)'
                  return `<tr style="border-bottom:1px solid var(--border-subtle)">
                    <td style="padding:6px 8px">
                      <div style="font-weight:700">${escHtml(r.model)}</div>
                      <div style="font-size:0.66rem;color:var(--text-muted)">${escHtml(r.brand)}</div>
                    </td>
                    <td style="padding:6px 8px;text-align:right">${r.sold}</td>
                    <td style="padding:6px 8px;text-align:right">฿${Math.round(r.totalGross/1000)}k</td>
                    <td style="padding:6px 8px;text-align:right;color:${c};font-weight:700">${r.grossPct}%</td>
                    <td style="padding:6px 8px;text-align:right;color:var(--success);font-weight:700">฿${Math.round(r.totalProfit/1000)}k</td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `,
      footer: `
        <span style="font-size:0.72rem;color:var(--text-muted)">${rows.length} รุ่น · ${rows.reduce((s,r)=>s+r.sold,0)} คัน</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
          <button class="btn btn-secondary btn-sm" id="mp-csv-btn">📋 CSV</button>
          <button class="btn btn-primary btn-sm" id="mp-excel-btn">📥 Excel</button>
        </div>
      `
    })
    document.getElementById('mp-excel-btn')?.addEventListener('click', () => {
      exportToExcel(exportData, 'Model_Profitability.xlsx', 'Profitability')
      showToast('📥 Export Excel กำไรรายรุ่น แล้ว', 'success')
      document.querySelector('.modal-overlay')?.remove()
    })
    document.getElementById('mp-csv-btn')?.addEventListener('click', () => {
      exportToCSV(exportData, 'Model_Profitability.csv')
      showToast('📋 Export CSV กำไรรายรุ่น แล้ว', 'success')
      document.querySelector('.modal-overlay')?.remove()
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
