/**
 * EV Adoption Analytics — วิเคราะห์แนวโน้ม EV ในตลาด vs ยอดขายเรา
 * Route: /analytics/ev-adoption
 */
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHLY = [
  { month:'ม.ค.', market:4200, lamom:10, evShare:38, topModel:'BYD Atto 3' },
  { month:'ก.พ.', market:4800, lamom:13, evShare:41, topModel:'BYD Atto 3' },
  { month:'มี.ค.', market:5100, lamom:14, evShare:43, topModel:'BYD Seal AWD' },
  { month:'เม.ย.', market:5600, lamom:17, evShare:46, topModel:'BYD Atto 3' },
  { month:'พ.ค.', market:5200, lamom:16, evShare:44, topModel:'BYD Dolphin' },
  { month:'มิ.ย.', market:5800, lamom:15, evShare:47, topModel:'BYD Atto 3' },
]

const MODEL_SHARE = [
  { model:'BYD Atto 3',   sold:35, color:'#1565c0' },
  { model:'BYD Seal AWD', sold:16, color:'#212121' },
  { model:'BYD Dolphin',  sold:20, color:'#e91e63' },
  { model:'BYD Han',      sold:8,  color:'#1b5e20' },
  { model:'MG ZS EV',     sold:6,  color:'#c62828' },
]

const CUSTOMER_TYPES = [
  { type:'ลูกค้าใหม่ (EV เป็นครั้งแรก)', pct:62, color:'var(--primary)' },
  { type:'อัพเกรดจาก ICE',               pct:28, color:'var(--success)' },
  { type:'เปลี่ยนยี่ห้อ EV',             pct:10, color:'var(--warning)' },
]

export default async function EvAdoptionPage(container) {
  const myGen = container.__routerGen
  let liveMonthly = [...MONTHLY].map(m => ({ ...m }))
  let liveModelShare = [...MODEL_SHARE].map(m => ({ ...m }))
  let dataSource = 'demo'
  let selMonth = 'มิ.ย.'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const now = new Date()
      const byMonth = Array(6).fill(0)
      const byModel = {}
      for (const s of sales) {
        const d = s.bookingDate || s.deliveryDate || ''
        if (!d) continue
        const yr = parseInt(d.slice(0,4)), mo = parseInt(d.slice(5,7))-1
        for (let i = 0; i < 6; i++) {
          const tgt = new Date(now); tgt.setMonth(tgt.getMonth()-(5-i))
          if (yr === tgt.getFullYear() && mo === tgt.getMonth()) { byMonth[i]++; break }
        }
        const model = s.model || s.vehicleModel || ''
        if (model) byModel[model] = (byModel[model] || 0) + 1
      }
      if (byMonth.some(v => v > 0)) {
        liveMonthly = liveMonthly.map((m, i) => ({ ...m, lamom: byMonth[i] || m.lamom }))
        dataSource = 'live'
      }
      const modelEntries = Object.entries(byModel)
      if (modelEntries.length >= 2) {
        liveModelShare = modelEntries.map(([model, sold], i) => ({
          model, sold, color: MODEL_SHARE[i]?.color || '#888888',
        }))
      }
    }
  } catch {}

  function barH(val, max, color) {
    const pct = Math.round(val/max*100)
    return '<div style="height:'+ Math.max(pct*0.6,4)+'px;background:'+color+';border-radius:3px 3px 0 0;transition:height .3s;min-width:8px"></div>'
  }

  function modelBar(m, total) {
    const pct = Math.round(m.sold/total*100)
    return '<div style="margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">' +
        '<span style="display:flex;align-items:center;gap:6px">' +
          '<div style="width:10px;height:10px;border-radius:50%;background:'+m.color+';flex-shrink:0"></div>' +
          m.model +
        '</span>' +
        '<span style="color:var(--text-muted)">' + m.sold + ' คัน (' + pct + '%)</span>' +
      '</div>' +
      '<div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:'+pct+'%;background:'+m.color+';border-radius:4px;transition:width .4s"></div>' +
      '</div>' +
    '</div>'
  }

  function custBar(c) {
    return '<div style="margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">' +
        '<span>' + c.type + '</span>' +
        '<span style="color:'+c.color+';font-weight:700">' + c.pct + '%</span>' +
      '</div>' +
      '<div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:'+c.pct+'%;background:'+c.color+';border-radius:4px;transition:width .4s"></div>' +
      '</div>' +
    '</div>'
  }

  function render() {
    const cur   = liveMonthly.find(m=>m.month===selMonth)||liveMonthly[liveMonthly.length-1]
    const prev  = liveMonthly[liveMonthly.indexOf(cur)-1]
    const totalSold = liveModelShare.reduce((s,m)=>s+m.sold,0)
    const maxMkt    = Math.max(...liveMonthly.map(m=>m.market))
    const lamomSharePct = ((cur.lamom/cur.market)*100).toFixed(2)
    const mktGrowth = prev ? Math.round((cur.market-prev.market)/prev.market*100) : 0
    const mktGrowthColor = mktGrowth>=0?'var(--success)':'var(--danger)'

    const monthBars = liveMonthly.map(m=>{
      const isSel = m.month===selMonth
      return '<div class="month-ev-bar" data-month="'+m.month+'" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px 2px;border-radius:4px;background:'+(isSel?'var(--surface-2)':'transparent')+'">' +
        '<div style="font-size:0.6rem;color:'+(isSel?'var(--primary)':'var(--text-muted)')+';font-weight:'+(isSel?'700':'400')+'">' + m.month + '</div>' +
        '<div style="display:flex;flex-direction:column;justify-content:flex-end;height:70px;gap:0;align-items:center;width:28px">' +
          barH(m.market, maxMkt, 'var(--surface-2)') +
          '<div style="height:2px;width:100%;background:var(--border)"></div>' +
          '<div style="font-size:0.58rem;color:var(--text-muted);margin-top:1px">' + (m.market/1000).toFixed(1) + 'k</div>' +
        '</div>' +
      '</div>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔋 EV Adoption Analytics</div>
            <div class="page-subtitle">แนวโน้ม EV ในตลาด vs ยอดขาย LAMOM${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ยอดเราจากข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="report-btn">📊 ดาวน์โหลด Report</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🏭 ตลาด EV รวม', cur.market.toLocaleString()+' คัน', 'var(--primary)')}
          ${sc('📈 EV Market Share', cur.evShare+'% ของตลาด', 'var(--success)')}
          ${sc('🚗 ยอดขาย LAMOM', cur.lamom+' คัน', 'var(--warning)')}
          ${sc('🏆 Market Share', lamomSharePct+'%', 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:4px">📊 ตลาด EV รายเดือน
              <span style="font-size:0.68rem;font-weight:400;color:${mktGrowthColor};margin-left:6px">${mktGrowth>=0?'+':''}${mktGrowth}% vs เดือนก่อน</span>
            </div>
            <div style="display:flex;gap:4px;align-items:flex-end;padding:8px 0">
              ${monthBars}
            </div>
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">🚗 ยอดขายแยกตามรุ่น (YTD)</div>
            ${liveModelShare.map(m=>modelBar(m,totalSold)).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">👥 ประเภทลูกค้า EV</div>
            ${CUSTOMER_TYPES.map(c=>custBar(c)).join('')}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">📋 ข้อมูล EV เดือน ${selMonth}</div>
            <table style="width:100%;font-size:0.76rem;border-collapse:collapse">
              ${[
                ['🏭 ตลาด EV รวม', cur.market.toLocaleString()+' คัน'],
                ['📈 EV % ของตลาดรถทั้งหมด', cur.evShare+'%'],
                ['🚗 ยอดขาย LAMOM', cur.lamom+' คัน'],
                ['🏆 Market Share ของเรา', lamomSharePct+'%'],
                ['⭐ รุ่นขายดี', cur.topModel],
              ].map(([k,v])=>'<tr style="border-bottom:1px solid var(--border-subtle)"><td style="padding:6px 8px;color:var(--text-muted)">'+k+'</td><td style="padding:6px 8px;font-weight:700;text-align:right">'+v+'</td></tr>').join('')}
            </table>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.month-ev-bar').forEach(b=>b.addEventListener('click',()=>{selMonth=b.dataset.month;render()}))
    document.getElementById('report-btn')?.addEventListener('click',()=>openReportModal())
  }

  function openReportModal() {
    openModal({
      title: '📊 EV Adoption Report',
      size: 'md',
      body: `
        <div style="font-size:0.82rem">
          <div style="font-weight:700;margin-bottom:8px">ยอดขายรายเดือน</div>
          <table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-bottom:16px">
            <thead>
              <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                <th style="padding:7px 9px;text-align:left">เดือน</th>
                <th style="padding:7px 9px;text-align:right">ตลาด EV</th>
                <th style="padding:7px 9px;text-align:right">LAMOM</th>
                <th style="padding:7px 9px;text-align:right">Share%</th>
                <th style="padding:7px 9px;text-align:right">EV%</th>
                <th style="padding:7px 9px">รุ่นขายดี</th>
              </tr>
            </thead>
            <tbody>
              ${liveMonthly.map(m => {
                const share = (m.lamom / m.market * 100).toFixed(2)
                return `<tr style="border-bottom:1px solid var(--border-subtle)">
                  <td style="padding:6px 9px;font-weight:700">${m.month}</td>
                  <td style="padding:6px 9px;text-align:right">${m.market.toLocaleString()}</td>
                  <td style="padding:6px 9px;text-align:right;color:var(--primary);font-weight:700">${m.lamom}</td>
                  <td style="padding:6px 9px;text-align:right">${share}%</td>
                  <td style="padding:6px 9px;text-align:right;color:var(--success)">${m.evShare}%</td>
                  <td style="padding:6px 9px;color:var(--text-muted)">${m.topModel}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
          <div style="font-weight:700;margin-bottom:6px">Market Share ตามรุ่น</div>
          ${liveModelShare.map(m => `<div style="display:flex;justify-content:space-between;font-size:0.74rem;padding:4px 0;border-bottom:1px solid var(--border-subtle)">
            <span style="display:flex;align-items:center;gap:5px">
              <span style="width:8px;height:8px;border-radius:50%;background:${m.color};display:inline-block;flex-shrink:0"></span>
              ${m.model}
            </span>
            <span style="font-weight:700">${m.sold} คัน</span>
          </div>`).join('')}
        </div>
      `,
      footer: `
        <span style="font-size:0.72rem;color:var(--text-muted)">ข้อมูล ${liveMonthly.length} เดือนล่าสุด</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
          <button class="btn btn-primary btn-sm" id="ev-export-btn">📥 Export Excel</button>
        </div>
      `
    })
    document.getElementById('ev-export-btn')?.addEventListener('click', () => {
      exportToExcel(
        liveMonthly.map(m => ({
          'เดือน': m.month,
          'ตลาด EV (คัน)': m.market,
          'ยอดขาย LAMOM (คัน)': m.lamom,
          'Market Share %': parseFloat((m.lamom / m.market * 100).toFixed(2)),
          'EV Share ตลาด %': m.evShare,
          'รุ่นขายดี': m.topModel,
        })),
        'EV_Adoption_Report.xlsx',
        'EV Adoption'
      )
      showToast('📊 Export EV Adoption Report แล้ว', 'success')
      document.querySelector('.modal-overlay')?.remove()
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
