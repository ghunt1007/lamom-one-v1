/**
 * Lead Source Tracker — ติดตามแหล่งที่มา Lead
 * Route: /marketing/lead-sources
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

const SOURCES = [
  { id:'walkin', name:'Walk-in',    icon:'🚶', color:'#6366f1' },
  { id:'line',   name:'LINE OA',   icon:'💚', color:'#06C755' },
  { id:'fb',     name:'Facebook',  icon:'📘', color:'#1877F2' },
  { id:'ig',     name:'Instagram', icon:'📸', color:'#E1306C' },
  { id:'tiktok', name:'TikTok',    icon:'🎵', color:'#010101' },
  { id:'ref',    name:'Referral',  icon:'🤝', color:'#f59e0b' },
  { id:'web',    name:'Website',   icon:'🌐', color:'#64748b' },
  { id:'event',  name:'Event',     icon:'🎪', color:'#ec4899' },
]

const DATA = {
  walkin: [18,22,19,24,28,25],
  line:   [31,35,29,38,42,39],
  fb:     [24,28,22,31,35,30],
  ig:     [12,15,11,18,22,19],
  tiktok: [8, 14,10,21,31,26],
  ref:    [9, 11,10,13,16,14],
  web:    [7, 9, 8, 11,13,11],
  event:  [5, 3, 8, 4, 6, 10],
}

const CONVERSION = {
  walkin: 38, line: 22, fb: 18, ig: 15, tiktok: 12, ref: 45, web: 20, event: 28
}

const COST_PER_LEAD = {
  walkin:0, line:280, fb:420, ig:510, tiktok:350, ref:0, web:380, event:650
}

export default async function LeadSourcesPage(container) {
  let selMonth = 5

  function render() {
    const totals = SOURCES.map(s => ({
      ...s,
      leads: DATA[s.id][selMonth],
      conv:  CONVERSION[s.id],
      cpl:   COST_PER_LEAD[s.id],
      sales: Math.round(DATA[s.id][selMonth] * CONVERSION[s.id] / 100),
    }))
    totals.sort((a,b) => b.leads - a.leads)
    const totalLeads = totals.reduce((s,x) => s+x.leads, 0)
    const totalSales = totals.reduce((s,x) => s+x.sales, 0)
    const bestSrc    = totals[0]
    const topConv    = [...totals].sort((a,b)=>b.conv-a.conv)[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧲 Lead Source Tracker</div>
            <div class="page-subtitle">ติดตามแหล่งที่มา Lead ${SOURCES.length} ช่องทาง · Conversion · Cost Per Lead</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              ${MONTHS.map((m,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${m}</button>`).join('')}
            </div>
            <button class="btn btn-primary" id="export-btn" style="margin-left:8px">📥 Export</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🧲 Leads รวม', totalLeads+' คน', 'var(--primary)')}
          ${sc('🚗 ขายได้', totalSales+' คัน', 'var(--success)')}
          ${sc('🏆 แหล่งดีสุด', bestSrc.icon+' '+bestSrc.name, 'var(--primary)')}
          ${sc('🎯 Conv. สูงสุด', topConv.icon+' '+topConv.conv+'%', 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Leads bar chart -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📊 Leads ต่อช่องทาง (${MONTHS[selMonth]})</div>
            ${totals.map(s => {
              const pct = Math.round(s.leads/totalLeads*100)
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.74rem;margin-bottom:3px">
                  <span>${s.icon} ${s.name}</span>
                  <span style="font-weight:700">${s.leads} leads (${pct}%)</span>
                </div>
                <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${s.color};border-radius:4px"></div>
                </div>
                <div style="display:flex;gap:10px;font-size:0.64rem;color:var(--text-muted);margin-top:2px">
                  <span>Conv. ${s.conv}%</span>
                  <span>Sales ${s.sales} คัน</span>
                  ${s.cpl>0?`<span>CPL ฿${s.cpl}</span>`:'<span style="color:var(--success)">ฟรี</span>'}
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- Right panel -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Monthly trend per top 4 sources -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 Trend 6 เดือน (Top 4)</div>
              ${totals.slice(0,4).map(s => `
                <div style="margin-bottom:8px">
                  <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:3px">${s.icon} ${s.name}</div>
                  <div style="display:flex;align-items:flex-end;gap:3px;height:36px">
                    ${MONTHS.map((m,i) => {
                      const maxVal = Math.max(...DATA[s.id])
                      const h = Math.round(DATA[s.id][i]/maxVal*32)+4
                      return `<div style="flex:1;height:${h}px;background:${i===selMonth?s.color:s.color+'66'};border-radius:2px 2px 0 0" title="${m}: ${DATA[s.id][i]} leads"></div>`
                    }).join('')}
                  </div>
                </div>`).join('')}
            </div>

            <!-- Summary table -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 สรุปทุกช่องทาง</div>
              <table style="width:100%;border-collapse:collapse;font-size:0.72rem">
                <thead><tr style="color:var(--text-muted);border-bottom:1px solid var(--border)">
                  <th style="text-align:left;padding:4px 0">ช่องทาง</th>
                  <th style="text-align:right">Leads</th>
                  <th style="text-align:right">Sales</th>
                  <th style="text-align:right">Conv%</th>
                </tr></thead>
                <tbody>
                  ${totals.map(s=>`<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:5px 0">${s.icon} ${s.name}</td>
                    <td style="text-align:right;font-weight:700">${s.leads}</td>
                    <td style="text-align:right;color:var(--success)">${s.sales}</td>
                    <td style="text-align:right;color:${s.conv>=30?'var(--success)':s.conv>=18?'var(--warning)':'var(--danger)'}">${s.conv}%</td>
                  </tr>`).join('')}
                  <tr style="font-weight:700;color:var(--primary)">
                    <td style="padding:6px 0">รวม</td>
                    <td style="text-align:right">${totalLeads}</td>
                    <td style="text-align:right;color:var(--success)">${totalSales}</td>
                    <td style="text-align:right">${Math.round(totalSales/totalLeads*100)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', ()=>{ selMonth=parseInt(b.dataset.i); render() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        SOURCES.map(s => ({
          'แหล่งที่มา': s.name,
          ...Object.fromEntries(MONTHS.map((m, i) => [`Lead ${m}`, DATA[s.id][i]])),
          'รวม Lead': DATA[s.id].reduce((a, v) => a + v, 0),
          'Conversion %': CONVERSION[s.id] || 0,
          'ต้นทุน/Lead (บาท)': COST_PER_LEAD[s.id] || 0,
        })),
        'Lead_Sources_Report.xlsx',
        'Lead Sources'
      )
      showToast('📥 Export Lead Source Report แล้ว', 'success')
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
