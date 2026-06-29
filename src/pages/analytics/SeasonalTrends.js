/**
 * Seasonal Trends Analysis — วิเคราะห์แนวโน้มตามฤดูกาล / เดือน / ปี
 * Route: /analytics/seasonal
 */
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

const YEAR_DATA = {
  2568: [8,9,12,11,10,8,7,9,11,14,16,13],
  2569: [10,13,14,17,16,15,0,0,0,0,0,0],
}

const MODEL_SEASONAL = [
  { model:'BYD Atto 3', data:[3,4,5,4,4,3,2,3,4,5,6,5] },
  { model:'BYD Seal AWD', data:[1,2,2,3,3,3,1,2,2,3,3,2] },
  { model:'BYD Dolphin', data:[2,2,3,2,2,2,2,2,3,4,4,4] },
  { model:'MG ZS EV', data:[2,1,2,2,1,2,2,2,2,2,3,2] },
]

const PEAK_MONTHS = [
  { month:'พ.ย.', reason:'มอเตอร์เอ็กซ์โป ลูกค้าตัดสินใจมาก', uplift:'+45%' },
  { month:'ธ.ค.', reason:'สิ้นปี / โปรโมชั่น / ลูกค้าต้องการหักภาษี', uplift:'+38%' },
  { month:'เม.ย.', reason:'ก่อนสงกรานต์ ขยับเป้าใหม่', uplift:'+22%' },
]

const LOW_MONTHS = [
  { month:'ก.ค.', reason:'หน้าฝน / นักเรียนเปิดเทอม / งบตึง', drop:'-28%' },
  { month:'ก.พ.', reason:'ต้นปี ลูกค้ายังประเมินงบประมาณ', drop:'-18%' },
]

export default async function SeasonalTrendsPage(container) {
  const myGen = container.__routerGen
  let liveYearData = JSON.parse(JSON.stringify(YEAR_DATA))
  let dataSource = 'demo'
  let selYear = 2569

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      for (const s of sales) {
        const d = s.bookingDate || s.deliveryDate || ''
        if (!d) continue
        const yr = parseInt(d.slice(0, 4)) + 543
        const mo = parseInt(d.slice(5, 7)) - 1
        if (!liveYearData[yr]) liveYearData[yr] = Array(12).fill(0)
        liveYearData[yr][mo] = (liveYearData[yr][mo] || 0) + 1
      }
      selYear = new Date().getFullYear() + 543
      dataSource = 'live'
    }
  } catch {}

  function heatColor(val, max) {
    if(!val) return 'var(--surface-2)'
    const pct = val/max
    if(pct>=0.85) return '#1b5e20'
    if(pct>=0.65) return '#388e3c'
    if(pct>=0.45) return '#f9a825'
    return '#e65100'
  }

  function heatCell(val, max, month) {
    const bg = heatColor(val, max)
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">' +
      '<div style="font-size:0.6rem;color:var(--text-muted)">'+month+'</div>' +
      '<div style="width:44px;height:44px;border-radius:6px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:0.76rem;font-weight:700;color:'+(val?'#fff':'var(--text-muted)')+'">'+( val||'-')+'</div>' +
    '</div>'
  }

  function modelRow(m) {
    const max = Math.max(...m.data)
    const cells = m.data.map((v,i)=>heatCell(v,max,MONTHS[i])).join('')
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
      '<div style="width:110px;font-size:0.72rem;font-weight:600;flex-shrink:0">'+m.model+'</div>' +
      '<div style="display:flex;gap:4px">'+cells+'</div>' +
    '</div>'
  }

  function render() {
    const data = liveYearData[selYear]
    const maxSales = Math.max(...data.filter(v=>v>0))
    const totalSales = data.reduce((s,v)=>s+v,0)
    const peakIdx = data.indexOf(Math.max(...data))
    const peakMonth = MONTHS[peakIdx]
    const yearBtns = [2568, 2569].map(y=>'<button class="btn btn-sm '+(selYear===y?'btn-primary':'btn-secondary')+' year-btn" data-y="'+y+'">'+y+'</button>').join('')

    const barCells = data.map((v,i)=>{
      const pct = maxSales>0?Math.round(v/maxSales*100):0
      const barH = v>0 ? Math.max(pct*0.7,4) : 0
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px">' +
        '<div style="font-size:0.65rem;font-weight:700;color:'+(v===maxSales&&v>0?'var(--success)':'var(--text-muted)')+'">'+( v||'')+'</div>' +
        '<div style="display:flex;align-items:flex-end;height:80px">' +
          '<div style="width:30px;background:'+(v>0?heatColor(v,maxSales):'var(--surface-2)')+';height:'+barH+'px;border-radius:3px 3px 0 0;transition:height .3s"></div>' +
        '</div>' +
        '<div style="font-size:0.6rem;color:var(--text-muted)">'+MONTHS[i]+'</div>' +
      '</div>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 Seasonal Trends Analysis</div>
            <div class="page-subtitle">วิเคราะห์แนวโน้มยอดขายตามฤดูกาล${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px">${yearBtns}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('📊 ยอดขายรวม '+selYear, totalSales+' คัน', 'var(--primary)')}
          ${sc('🔥 เดือนพีค', peakMonth+' ('+Math.max(...data)+' คัน)', 'var(--success)')}
          ${sc('📉 เดือนต่ำสุด', MONTHS[data.indexOf(Math.min(...data.filter(v=>v>0)))]+' คัน', 'var(--warning)')}
          ${sc('📈 Avg/เดือน', Math.round(totalSales/Math.max(data.filter(v=>v>0).length,1))+' คัน', 'var(--text-muted)')}
        </div>

        <div class="card" style="padding:16px;margin-bottom:12px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">📊 ยอดขายรายเดือน ${selYear}</div>
          <div style="display:flex;gap:8px;align-items:flex-end;overflow-x:auto;padding-bottom:4px">
            ${barCells}
          </div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:12px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">🌡️ Heat Map รายรุ่น (12 เดือน)</div>
          <div style="overflow-x:auto">
            ${MODEL_SEASONAL.map(m=>modelRow(m)).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center;font-size:0.68rem">
            <span style="color:var(--text-muted)">น้อย</span>
            ${['#e65100','#f9a825','#388e3c','#1b5e20'].map(c=>'<div style="width:20px;height:12px;border-radius:3px;background:'+c+'"></div>').join('')}
            <span style="color:var(--text-muted)">มาก</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px">🔥 เดือนขายดี</div>
            ${PEAK_MONTHS.map(p=>'<div style="border-bottom:1px solid var(--border-subtle);padding:8px 0"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-weight:700;font-size:0.78rem">'+p.month+'</span><span style="color:var(--success);font-weight:700;font-size:0.76rem">'+p.uplift+'</span></div><div style="font-size:0.7rem;color:var(--text-muted)">'+p.reason+'</div></div>').join('')}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px">📉 เดือนยอดขายต่ำ</div>
            ${LOW_MONTHS.map(l=>'<div style="border-bottom:1px solid var(--border-subtle);padding:8px 0"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-weight:700;font-size:0.78rem">'+l.month+'</span><span style="color:var(--danger);font-weight:700;font-size:0.76rem">'+l.drop+'</span></div><div style="font-size:0.7rem;color:var(--text-muted)">'+l.reason+'</div></div>').join('')}
          </div>
        </div>
      </div>`

    container.querySelectorAll('.year-btn').forEach(b=>b.addEventListener('click',()=>{selYear=parseInt(b.dataset.y);render()}))
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
