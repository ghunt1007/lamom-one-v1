/**
 * Market Share Tracker — ส่วนแบ่งตลาดเทียบคู่แข่ง
 * Route: /analytics/market-share
 */
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

// ข้อมูลยอดจดทะเบียน EV รถใหม่ในจังหวัด (ตัวอย่าง)
const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']
const BRANDS_DATA = [
  { brand: 'BYD (เรา)',  color: '#1E88E5', data: [28,32,35,30,38,42], target: [30,32,34,36,38,40] },
  { brand: 'MG',         color: '#43A047', data: [22,20,25,28,24,22], target: null },
  { brand: 'Neta',       color: '#FB8C00', data: [12,14,11,10,13,12], target: null },
  { brand: 'GWM/ORA',   color: '#8E24AA', data: [8, 9, 10,8, 9, 10], target: null },
  { brand: 'AION',       color: '#E53935', data: [6, 5, 7, 8, 7, 6],  target: null },
  { brand: 'Tesla',      color: '#000000', data: [5, 4, 5, 4, 5, 4],  target: null },
  { brand: 'อื่นๆ',      color: '#9E9E9E', data: [19,16,7, 12,4, 4],  target: null },
]

function pct(val, total) { return total > 0 ? (val / total * 100).toFixed(1) : 0 }

export default async function MarketSharePage(container) {
  const myGen = container.__routerGen
  let liveBrandsData = BRANDS_DATA.map(b => ({ ...b, data: [...b.data] }))
  let dataSource = 'demo'
  let selectedMonth = 5 // มิ.ย. (index)

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const byMonth = Array(6).fill(0)
      const now = new Date()
      for (const s of sales) {
        const d = s.bookingDate || s.deliveryDate || ''
        if (!d) continue
        const yr = parseInt(d.slice(0, 4))
        const mo = parseInt(d.slice(5, 7)) - 1
        for (let i = 0; i < 6; i++) {
          const tgt = new Date(now); tgt.setMonth(tgt.getMonth() - (5 - i))
          if (yr === tgt.getFullYear() && mo === tgt.getMonth()) { byMonth[i]++; break }
        }
      }
      if (byMonth.some(v => v > 0)) {
        liveBrandsData = liveBrandsData.map((b, idx) => idx === 0 ? { ...b, data: byMonth } : b)
        dataSource = 'live'
      }
    }
  } catch {}

  function render() {
    const monthData = liveBrandsData.map(b => ({ ...b, units: b.data[selectedMonth] }))
    const total = monthData.reduce((s, b) => s + b.units, 0)
    const ours = monthData[0]
    const ourShare = parseFloat(pct(ours.units, total))
    const ourTarget = ours.target ? ours.target[selectedMonth] : null
    const prevShare = selectedMonth > 0 ? parseFloat(pct(liveBrandsData[0].data[selectedMonth-1], liveBrandsData.reduce((s,b)=>s+b.data[selectedMonth-1],0))) : ourShare

    // cumulative YTD
    const ytdTotal = liveBrandsData[0].data.slice(0, selectedMonth+1).reduce((s,v,i) => {
      return s + liveBrandsData.reduce((ss,b) => ss+b.data[i],0)
    }, 0) / (selectedMonth+1)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Market Share Tracker</div>
            <div class="page-subtitle">ส่วนแบ่งตลาด EV จังหวัดของเรา · เทียบคู่แข่งรายเดือน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ยอดเราจากข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px">
              ${MONTHS.map((m,i) => `<button class="btn btn-xs ${i===selectedMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${m}</button>`).join('')}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📊 ส่วนแบ่งของเรา', ourShare + '%', ourShare > prevShare ? 'var(--success)' : 'var(--danger)',
            ourShare > prevShare ? `▲ ${(ourShare-prevShare).toFixed(1)}% จากเดือนที่แล้ว` : `▼ ${(prevShare-ourShare).toFixed(1)}% จากเดือนที่แล้ว`)}
          ${sc('🚗 ยอดจดทะเบียนเรา', ours.units + ' คัน', 'var(--primary)',
            ourTarget ? (ours.units >= ourTarget ? `✅ เป้า ${ourTarget} คัน` : `❌ เป้า ${ourTarget} คัน (-${ourTarget-ours.units})`) : '')}
          ${sc('🏙 ตลาดรวมเดือนนี้', total + ' คัน', 'var(--text)')}
          ${sc('🏆 อันดับ', '#1 (' + ours.units + ' คัน)', 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <!-- Pie-like bar chart -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 Market Share เดือน ${MONTHS[selectedMonth]}</div>

            <!-- Stacked bar -->
            <div style="height:20px;border-radius:10px;overflow:hidden;display:flex;margin-bottom:14px">
              ${monthData.map(b => `<div style="width:${pct(b.units,total)}%;background:${b.color};transition:width .3s" title="${b.brand}: ${pct(b.units,total)}%"></div>`).join('')}
            </div>

            ${monthData.map(b => `
              <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
                <div style="width:10px;height:10px;border-radius:50%;background:${b.color};flex-shrink:0"></div>
                <div style="flex:1;font-size:0.78rem;font-weight:${b===monthData[0]?'700':'400'}">${b.brand}</div>
                <div style="font-size:0.8rem;font-weight:700;width:50px;text-align:right">${pct(b.units,total)}%</div>
                <div style="font-size:0.7rem;color:var(--text-muted);width:40px;text-align:right">${b.units} คัน</div>
              </div>`).join('')}
          </div>

          <!-- Trend chart (text-based) -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 แนวโน้มส่วนแบ่ง BYD (6 เดือน)</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${liveBrandsData[0].data.map((v, i) => {
                const tot = liveBrandsData.reduce((s,b) => s + b.data[i], 0)
                const sh = parseFloat(pct(v, tot))
                const tgt = liveBrandsData[0].target ? liveBrandsData[0].target[i] : null
                const barW = Math.min(sh * 2, 100)
                return `<div>
                  <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
                    <span style="color:${i===selectedMonth?'var(--primary)':'var(--text-muted)'};font-weight:${i===selectedMonth?'700':'400'}">${MONTHS[i]}</span>
                    <span style="font-weight:700;color:var(--primary)">${sh}% · ${v} คัน${tgt?` (เป้า ${tgt})`:''}
                      ${i>0?`<span style="color:${sh>=parseFloat(pct(liveBrandsData[0].data[i-1],liveBrandsData.reduce((s,b)=>s+b.data[i-1],0)))?'var(--success)':'var(--danger)'}">${sh>=parseFloat(pct(liveBrandsData[0].data[i-1],liveBrandsData.reduce((s,b)=>s+b.data[i-1],0)))?'▲':'▼'}</span>`:''}</span>
                  </div>
                  <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${barW}%;background:${i===selectedMonth?'var(--primary)':'var(--primary)88'};transition:width .3s"></div>
                    ${tgt?`<div style="position:absolute;height:8px;width:1px;background:var(--danger);left:${Math.min(parseFloat(pct(tgt,liveBrandsData.reduce((s,b)=>s+b.data[i],0)))*2,100)}%;top:0" title="เป้า"></div>`:''}
                  </div>
                </div>`
              }).join('')}
            </div>
            <p style="font-size:0.66rem;color:var(--text-muted);margin-top:10px">💡 เส้นแดง = เป้า · YTD เฉลี่ย ~${parseFloat(pct(liveBrandsData[0].data.slice(0,selectedMonth+1).reduce((s,v)=>s+v,0), liveBrandsData.reduce((s,b)=>s+b.data.slice(0,selectedMonth+1).reduce((ss,v)=>ss+v,0),0))).toFixed(1)}%</p>
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selectedMonth = parseInt(b.dataset.i); render() }))
  }

  function sc(l, v, c, sub) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
      ${sub ? `<div style="font-size:0.66rem;color:var(--text-muted)">${sub}</div>` : ''}
    </div>`
  }

  render()
}
