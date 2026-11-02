/**
 * แนวโน้มยอดขายตามฤดูกาล — วิเคราะห์แนวโน้มตามฤดูกาล / เดือน / ปี
 * Route: /analytics/seasonal
 */
import { getSalesData } from '../../core/db.js'
import { todayBangkok } from '../../utils/format.js'
import { carLabel } from '../../utils/carLabel.js'
import { escHtml } from '../../utils/escape.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// (v1.0.944) เดิมยอดจริงถูก "บวกทับ" ตัวเลขสมมติของปี 2568/2569 (8,9,12... คัน) ทำให้ยอดรวมเกินจริง
// heat map รายรุ่น (BYD/MG) และเดือนขายดี/ขายต่ำ (+45% ฯลฯ) ก็เป็นตัวอย่างทั้งหมด — ตอนนี้คำนวณจากใบจองจริงอย่างเดียว

// ยอดจองต่อเดือน แยกปี (พ.ศ.) และแยกรุ่นต่อปี
export function seasonalData(sales) {
  const years = {}, models = {}
  for (const s of sales) {
    const d = String(s.bookingDate || '')
    if (!/^\d{4}-\d{2}/.test(d)) continue
    const yr = Number(d.slice(0, 4)) + 543, mo = Number(d.slice(5, 7)) - 1
    if (mo < 0 || mo > 11) continue
    ;(years[yr] ||= Array(12).fill(0))[mo]++
    const name = carLabel(s.brand, String(s.model || '').split(/\s+/).slice(0, 2).join(' ')) || 'ไม่ระบุรุ่น'
    const y = (models[yr] ||= {})
    ;(y[name] ||= Array(12).fill(0))[mo]++
  }
  return { years, models }
}

// เดือนไหนขายดี/ขายต่ำกว่าเฉลี่ย: เฉลี่ยของเดือนเดียวกันทุกปี (นับเฉพาะเดือนที่จบแล้ว) เทียบค่าเฉลี่ยรวม
export function monthStrength(years, today = todayBangkok()) {
  const curY = Number(today.slice(0, 4)) + 543, curM = Number(today.slice(5, 7)) - 1
  const sum = Array(12).fill(0), cnt = Array(12).fill(0)
  // เริ่มนับจากเดือนแรกที่มีใบจอง — ก่อนหน้านั้นคือยังไม่ได้ใช้ระบบ ไม่ใช่ขายไม่ได้
  let first = Infinity
  for (const [y, arr] of Object.entries(years)) arr.forEach((v, m) => { if (v > 0) first = Math.min(first, Number(y) * 12 + m) })
  for (const [y, arr] of Object.entries(years)) {
    arr.forEach((v, m) => {
      if (Number(y) * 12 + m < first) return
      if (Number(y) > curY || (Number(y) === curY && m >= curM)) return
      sum[m] += v; cnt[m]++
    })
  }
  const done = cnt.reduce((a, v) => a + v, 0)
  if (done < 6) return null // ข้อมูลน้อยเกินไป สรุปไม่ได้
  const avg = sum.map((v, m) => cnt[m] ? v / cnt[m] : null)
  const known = avg.filter(v => v !== null)
  const mean = known.reduce((a, v) => a + v, 0) / known.length
  if (!mean) return null
  const rows = avg.map((v, m) => v === null ? null : { month: MONTHS[m], avg: v, diff: Math.round((v / mean - 1) * 100), years: cnt[m] }).filter(Boolean)
  return {
    peak: rows.filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3),
    low: rows.filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3),
  }
}

export default async function SeasonalTrendsPage(container) {
  const myGen = container.__routerGen
  let selYear = Number(todayBangkok().slice(0, 4)) + 543
  let sales = []
  try {
    sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
  } catch {}
  const { years: liveYearData, models: modelData } = seasonalData(sales)
  const strength = monthStrength(liveYearData)

  function heatColor(val, max) {
    if(!val) return 'var(--surface-2)'
    const pct = val/max
    if(pct>=0.85) return '#1b5e20'
    if(pct>=0.65) return '#388e3c'
    if(pct>=0.45) return '#f9a825'
    return '#e65100'
  }

  function modelRow(m) {
    const max = Math.max(...m.data)
    return '<div style="margin-bottom:10px">' +
      '<div style="font-size:0.72rem;font-weight:600;margin-bottom:3px;overflow-wrap:anywhere">' + escHtml(m.model) + ' <span style="font-weight:400;color:var(--text-muted)">· ' + m.sum + ' คัน</span></div>' +
      '<div style="display:flex;gap:3px">' +
      m.data.map(v => '<div style="flex:1;min-width:0;height:26px;border-radius:4px;background:' + heatColor(v, max) + ';display:flex;align-items:center;justify-content:center;font-size:0.66rem;font-weight:700;color:' + (v ? '#fff' : 'var(--text-muted)') + '">' + (v || '') + '</div>').join('') +
      '</div></div>'
  }
  const monthHead = '<div style="display:flex;gap:3px;margin-bottom:4px">' +
    MONTHS.map(m => '<div style="flex:1;min-width:0;font-size:0.56rem;color:var(--text-muted);text-align:center;white-space:nowrap;overflow:hidden">' + m + '</div>').join('') + '</div>'

  function render() {
    // เดิมปุ่มเลือกปีมีแค่ [2568, 2569] ตายตัว ปีต่อๆไปจะไม่มีปุ่มให้เลือกเลย แก้ให้สร้างจากปีที่มีข้อมูลจริง
    const availYears = Object.keys(liveYearData).map(Number).sort((a, b) => a - b)
    if (!liveYearData[selYear]) selYear = availYears[availYears.length - 1] || selYear
    const data = liveYearData[selYear] || Array(12).fill(0)
    const maxSales = Math.max(...data.filter(v=>v>0), 0)
    const totalSales = data.reduce((s,v)=>s+v,0)
    const peakIdx = data.indexOf(Math.max(...data))
    const peakMonth = MONTHS[peakIdx]
    const yearBtns = availYears.map(y=>'<button class="btn btn-sm '+(selYear===y?'btn-primary':'btn-secondary')+' year-btn" data-y="'+y+'">'+y+'</button>').join('')

    const barCells = data.map((v,i)=>{
      const pct = maxSales>0?Math.round(v/maxSales*100):0
      const barH = v>0 ? Math.max(pct*0.7,4) : 0
      return '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px">' +
        '<div style="font-size:0.65rem;font-weight:700;color:'+(v===maxSales&&v>0?'var(--success)':'var(--text-muted)')+'">'+( v||'')+'</div>' +
        '<div style="display:flex;align-items:flex-end;height:80px;width:100%">' +
          '<div style="width:100%;background:'+(v>0?heatColor(v,maxSales):'var(--surface-2)')+';height:'+barH+'px;border-radius:3px 3px 0 0;transition:height .3s"></div>' +
        '</div>' +
        '<div style="font-size:0.56rem;color:var(--text-muted);white-space:nowrap">'+MONTHS[i]+'</div>' +
      '</div>'
    }).join('')

    const active = data.filter(v => v > 0)
    const lowVal = active.length ? Math.min(...active) : 0
    const topModels = Object.entries(modelData[selYear] || {}).map(([model, d]) => ({ model, data: d, sum: d.reduce((x, v) => x + v, 0) }))
      .sort((x, y) => y.sum - x.sum).slice(0, 6)
    const strengthRow = (r, good) => '<div style="border-bottom:1px solid var(--border-subtle);padding:8px 0;display:flex;justify-content:space-between;gap:8px">' +
      '<span style="font-weight:700;font-size:0.78rem">' + r.month + ' <span style="font-weight:400;font-size:0.68rem;color:var(--text-muted)">เฉลี่ย ' + (Math.round(r.avg * 10) / 10) + ' คัน · ' + r.years + ' ปี</span></span>' +
      '<span style="color:var(--' + (good ? 'success' : 'danger') + ');font-weight:700;font-size:0.76rem">' + (r.diff > 0 ? '+' : '') + r.diff + '%</span></div>'
    const none = t => '<div style="padding:12px;text-align:center;font-size:0.74rem;color:var(--text-muted)">' + t + '</div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 แนวโน้มยอดขายตามฤดูกาล</div>
            <div class="page-subtitle">จากใบจองจริง (นับตามวันที่จอง ไม่นับที่ถอนจอง)</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px;flex-wrap:wrap">${yearBtns}</div>
          </div>
        </div>

        ${!availYears.length ? '<div class="card" style="padding:28px;text-align:center;color:var(--text-muted);font-size:0.85rem">ยังไม่มีใบจอง</div>' : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px">
          ${sc('📊 ยอดจองรวม ' + selYear, totalSales + ' คัน', 'var(--primary)')}
          ${sc('🔥 เดือนที่จองมากสุด', totalSales ? peakMonth + ' (' + Math.max(...data) + ' คัน)' : '—', 'var(--success)')}
          ${sc('📉 เดือนที่จองน้อยสุด', active.length ? MONTHS[data.indexOf(lowVal)] + ' (' + lowVal + ' คัน)' : '—', 'var(--warning)')}
          ${sc('📈 เฉลี่ย/เดือน', Math.round(totalSales / Math.max(active.length, 1)) + ' คัน', 'var(--text-muted)')}
        </div>

        <div class="card" style="padding:16px;margin-bottom:12px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">📊 ยอดจองรายเดือน ${selYear}</div>
          <div style="display:flex;gap:3px;align-items:flex-end;padding-bottom:4px">
            ${barCells}
          </div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:12px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">🌡️ รุ่นขายดี ${selYear} รายเดือน</div>
          <div>
            ${topModels.length ? monthHead + topModels.map(m => modelRow(m)).join('') : none('ยังไม่มีใบจองปีนี้')}
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center;font-size:0.68rem">
            <span style="color:var(--text-muted)">น้อย</span>
            ${['#e65100','#f9a825','#388e3c','#1b5e20'].map(c=>'<div style="width:20px;height:12px;border-radius:3px;background:'+c+'"></div>').join('')}
            <span style="color:var(--text-muted)">มาก</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:4px">🔥 เดือนที่มักขายดี</div>
            <div style="font-size:0.66rem;color:var(--text-muted);margin-bottom:6px">เทียบค่าเฉลี่ยทุกเดือน (เฉพาะเดือนที่จบแล้ว)</div>
            ${strength ? (strength.peak.length ? strength.peak.map(r => strengthRow(r, true)).join('') : none('ยังไม่เห็นเดือนที่โดดเด่น')) : none('ข้อมูลยังน้อยเกินไป (ต้องมีอย่างน้อย 6 เดือน)')}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:4px">📉 เดือนที่มักขายน้อย</div>
            <div style="font-size:0.66rem;color:var(--text-muted);margin-bottom:6px">เทียบค่าเฉลี่ยทุกเดือน (เฉพาะเดือนที่จบแล้ว)</div>
            ${strength ? (strength.low.length ? strength.low.map(r => strengthRow(r, false)).join('') : none('ยังไม่เห็นเดือนที่ต่ำกว่าปกติ')) : none('ข้อมูลยังน้อยเกินไป (ต้องมีอย่างน้อย 6 เดือน)')}
          </div>
        </div>`}
      </div>`

    container.querySelectorAll('.year-btn').forEach(b=>b.addEventListener('click',()=>{selYear=parseInt(b.dataset.y);render()}))
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.05rem;font-weight:900;color:${c};margin-top:2px;overflow-wrap:anywhere">${v}</div></div>`
  }

  render()
}
