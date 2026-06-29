/**
 * Model Profitability — รุ่นไหนทำกำไรสูงสุด
 * Route: /analytics/model-profit
 */
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'
import { exportToExcel, exportToCSV } from '../../utils/importExport.js'

const MODELS = [
  { model:'BYD Seal AWD', brand:'BYD', sold:16, avgPrice:1899900, avgCost:1540000, accessories:85000, finance:42000, insurance:28000 },
  { model:'BYD Atto 3 Extended', brand:'BYD', sold:22, avgPrice:1199900, avgCost:970000, accessories:64000, finance:38000, insurance:22000 },
  { model:'BYD Han EV', brand:'BYD', sold:8, avgPrice:1899900, avgCost:1580000, accessories:110000, finance:55000, insurance:32000 },
  { model:'BYD Dolphin Boost', brand:'BYD', sold:20, avgPrice:799900, avgCost:640000, accessories:38000, finance:28000, insurance:18000 },
  { model:'MG ZS EV Luxury Plus', brand:'MG', sold:6, avgPrice:999900, avgCost:820000, accessories:45000, finance:32000, insurance:20000 },
  { model:'MG4 EV', brand:'MG', sold:3, avgPrice:859900, avgCost:700000, accessories:30000, finance:25000, insurance:16000 },
]

function calcRow(m) {
  const vehicleGross = m.avgPrice - m.avgCost
  const totalGross = vehicleGross + m.accessories + m.finance + m.insurance
  const grossPct = Math.round(totalGross / m.avgPrice * 100)
  const totalRevenue = m.sold * m.avgPrice
  const totalProfit = m.sold * totalGross
  return { ...m, vehicleGross, totalGross, grossPct, totalRevenue, totalProfit }
}

export default async function ModelProfitabilityPage(container) {
  const myGen = container.__routerGen
  let liveModels = [...MODELS].map(m => ({ ...m }))
  let dataSource = 'demo'
  let sortBy = 'totalProfit'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const byCar = {}
      for (const s of sales) {
        const key = s.model || s.vehicleModel || 'ไม่ระบุ'
        if (!byCar[key]) byCar[key] = { sold: 0, totalRev: 0 }
        byCar[key].sold++
        byCar[key].totalRev += s.salePrice || 0
      }
      liveModels = liveModels.map(m => {
        const data = byCar[m.model]
        if (!data) return m
        return { ...m, sold: data.sold, avgPrice: data.sold > 0 ? Math.round(data.totalRev / data.sold) : m.avgPrice }
      })
      dataSource = 'live'
    }
  } catch {}

  function bar(pct, color) {
    return '<div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden;margin-top:3px">' +
      '<div style="height:100%;width:'+Math.min(pct,100)+'%;background:'+color+';border-radius:4px;transition:width .4s"></div>' +
    '</div>'
  }

  function modelRow(r, maxProfit) {
    const color = r.grossPct>=15?'var(--success)':r.grossPct>=10?'var(--warning)':'var(--danger)'
    const barW = Math.round(r.totalProfit/maxProfit*100)
    return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
      '<td style="padding:10px 10px">' +
        '<div style="font-weight:700;font-size:0.8rem">'+r.model+'</div>' +
        '<div style="font-size:0.66rem;color:var(--text-muted)">'+r.brand+'</div>' +
      '</td>' +
      '<td style="padding:10px 10px;text-align:right;font-size:0.76rem">'+r.sold+'</td>' +
      '<td style="padding:10px 10px;text-align:right;font-size:0.76rem">฿'+Math.round(r.vehicleGross/1000)+'k</td>' +
      '<td style="padding:10px 10px;text-align:right;font-size:0.76rem;color:var(--primary)">+฿'+Math.round((r.accessories+r.finance+r.insurance)/1000)+'k</td>' +
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
    const maxProfit = Math.max(...rows.map(r=>r.totalProfit))
    const totalProfit = rows.reduce((s,r)=>s+r.totalProfit,0)
    const totalRev = rows.reduce((s,r)=>s+r.totalRevenue,0)
    const totalSold = rows.reduce((s,r)=>s+r.sold,0)
    const avgMargin = Math.round(rows.reduce((s,r)=>s+r.grossPct,0)/rows.length)
    const topModel = rows[0]

    const sortBtns = [['totalProfit','💰 กำไรรวม'],['grossPct','📊 Margin %'],['sold','🚗 ยอดขาย']].map(([k,l])=>'<button class="btn btn-sm '+(sortBy===k?'btn-primary':'btn-secondary')+' sort-btn" data-k="'+k+'">'+l+'</button>').join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Model Profitability</div>
            <div class="page-subtitle">กำไรและ Margin แยกตามรุ่น · ${liveModels.length} รุ่น${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('💰 กำไรรวม (YTD)', '฿'+Math.round(totalProfit/1000000*10)/10+'M', 'var(--success)')}
          ${sc('📈 Revenue รวม', '฿'+Math.round(totalRev/1000000*10)/10+'M', 'var(--primary)')}
          ${sc('📊 Avg Gross Margin', avgMargin+'%', avgMargin>=12?'var(--success)':'var(--warning)')}
          ${sc('🏆 รุ่นกำไรสูงสุด', topModel.model.split(' ').slice(0,2).join(' '), 'var(--warning)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${sortBtns}</div>

        <div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead>
              <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">รุ่น</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--text-muted)">ขาย</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--text-muted)">Gross/คัน</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--primary)">+F&I</th>
                <th style="text-align:right;padding:10px 10px;font-weight:600;color:var(--text-muted)">Margin%</th>
                <th style="padding:10px 10px;font-weight:600;color:var(--text-muted)">กำไรรวม</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r=>modelRow(r,maxProfit)).join('')}
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
      'F&I รวม (บาท)': r.accessories + r.finance + r.insurance,
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
                  <th style="padding:7px 8px;text-align:right">Margin</th>
                  <th style="padding:7px 8px;text-align:right">กำไรรวม</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => {
                  const c = r.grossPct>=15?'var(--success)':r.grossPct>=10?'var(--warning)':'var(--danger)'
                  return `<tr style="border-bottom:1px solid var(--border-subtle)">
                    <td style="padding:6px 8px">
                      <div style="font-weight:700">${r.model}</div>
                      <div style="font-size:0.66rem;color:var(--text-muted)">${r.brand}</div>
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
