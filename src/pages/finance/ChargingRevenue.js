/**
 * EV Charging Revenue — รายได้จากสถานีชาร์จในโชว์รูม
 * Route: /finance/charging-revenue
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

const STATIONS = [
  { id:'CS1', name:'Charger A (150kW)', type:'DC Fast', port:'CCS2', rate:7.50, location:'หน้าโชว์รูม' },
  { id:'CS2', name:'Charger B (50kW)',  type:'DC',      port:'CCS2', rate:6.80, location:'ข้างทางเข้า' },
  { id:'CS3', name:'AC Bay 1 (22kW)',   type:'AC',      port:'Type2', rate:4.50, location:'ลานจอด A' },
  { id:'CS4', name:'AC Bay 2 (22kW)',   type:'AC',      port:'Type2', rate:4.50, location:'ลานจอด B' },
]

const MONTHLY = [
  { month:'ม.ค.', sessions:120, kwh:4200, revenue:31500, cost:10080, profit:21420 },
  { month:'ก.พ.', sessions:135, kwh:4725, revenue:35438, cost:11340, profit:24098 },
  { month:'มี.ค.', sessions:158, kwh:5530, revenue:41475, cost:13272, profit:28203 },
  { month:'เม.ย.', sessions:142, kwh:4970, revenue:37275, cost:11928, profit:25347 },
  { month:'พ.ค.', sessions:178, kwh:6230, revenue:46725, cost:14952, profit:31773 },
  { month:'มิ.ย.', sessions:195, kwh:6825, revenue:51188, cost:16380, profit:34808 },
]

const TODAY_SESSIONS = [
  { time:'08:12', station:'CS1', car:'BYD Atto 3', kwh:32.5, dur:'28 นาที', amount:243.75, status:'done' },
  { time:'09:45', station:'CS3', car:'MG ZS EV',   kwh:18.2, dur:'82 นาที', amount:81.90, status:'done' },
  { time:'10:30', station:'CS2', car:'BYD Seal',   kwh:55.1, dur:'66 นาที', amount:374.68, status:'charging' },
  { time:'11:00', station:'CS4', car:'BYD Dolphin',kwh:12.4, dur:'34 นาที', amount:55.80, status:'charging' },
]

export default async function ChargingRevenuePage(container) {
  let selMonth = 5

  function render() {
    const m = MONTHLY[selMonth]
    const ytdRev    = MONTHLY.slice(0,selMonth+1).reduce((s,x)=>s+x.revenue,0)
    const ytdProfit = MONTHLY.slice(0,selMonth+1).reduce((s,x)=>s+x.profit,0)
    const todayRev  = TODAY_SESSIONS.filter(s=>s.status==='done').reduce((s,x)=>s+x.amount,0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ EV Charging Revenue</div>
            <div class="page-subtitle">รายได้จากสถานีชาร์จ ${STATIONS.length} จุด · YTD ${formatCurrency(ytdRev)}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              ${MONTHS.map((mo,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${mo}</button>`).join('')}
            </div>
            <button class="btn btn-primary" id="report-btn" style="margin-left:8px">📊 รายงาน</button>
          </div>
        </div>

        <!-- Month stats -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
          ${sc('⚡ Sessions', m.sessions, 'var(--primary)')}
          ${sc('🔋 kWh ขาย', m.kwh.toLocaleString(), 'var(--text)')}
          ${sc('💰 รายได้', formatCurrency(m.revenue), 'var(--success)')}
          ${sc('💸 ค่าไฟ (ทุน)', formatCurrency(m.cost), 'var(--danger)')}
          ${sc('📈 กำไร', formatCurrency(m.profit), 'var(--primary)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Trend chart -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 รายได้ vs กำไร (6 เดือน)</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${MONTHLY.map((mo,i) => {
                const maxRev = Math.max(...MONTHLY.map(x=>x.revenue))
                const revW = Math.round(mo.revenue/maxRev*100)
                const profW = Math.round(mo.profit/maxRev*100)
                return `<div>
                  <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:3px">
                    <span style="color:${i===selMonth?'var(--primary)':'var(--text-muted)'};font-weight:${i===selMonth?700:400}">${mo.month}</span>
                    <span style="color:var(--text-muted)">${formatCurrency(mo.revenue)} · กำไร ${formatCurrency(mo.profit)}</span>
                  </div>
                  <div style="position:relative;height:10px;background:var(--surface-2);border-radius:5px;margin-bottom:3px;overflow:hidden">
                    <div style="height:100%;width:${revW}%;background:${i===selMonth?'var(--primary)':'var(--primary)66'};border-radius:5px"></div>
                  </div>
                  <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${profW}%;background:${i===selMonth?'var(--success)':'var(--success)66'};border-radius:3px"></div>
                  </div>
                </div>`
              }).join('')}
            </div>
            <div style="display:flex;gap:12px;margin-top:10px;font-size:0.68rem">
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:6px;background:var(--primary);border-radius:2px"></span>รายได้</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:6px;background:var(--success);border-radius:2px"></span>กำไร</span>
            </div>
          </div>

          <!-- Right col -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Stations -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔌 สถานีชาร์จ</div>
              ${STATIONS.map(s=>`
                <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                  <span style="font-size:1.1rem">${s.type==='DC Fast'?'⚡':'🔌'}</span>
                  <div style="flex:1">
                    <div style="font-weight:600">${s.name}</div>
                    <div style="font-size:0.66rem;color:var(--text-muted)">${s.location} · ${s.port} · ${s.rate} บ/kWh</div>
                  </div>
                  <span style="font-size:0.62rem;background:${TODAY_SESSIONS.some(x=>x.station===s.id&&x.status==='charging')?'var(--success)':'var(--surface-2)'};color:${TODAY_SESSIONS.some(x=>x.station===s.id&&x.status==='charging')?'#fff':'var(--text-muted)'};padding:2px 8px;border-radius:10px">${TODAY_SESSIONS.some(x=>x.station===s.id&&x.status==='charging')?'⚡ ชาร์จอยู่':'ว่าง'}</span>
                </div>`).join('')}
            </div>

            <!-- Today sessions -->
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted)">📋 Session วันนี้</div>
                <div style="font-size:0.8rem;font-weight:700;color:var(--success)">${formatCurrency(todayRev)}</div>
              </div>
              ${TODAY_SESSIONS.map(s=>`
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.74rem">
                  <span style="color:var(--text-muted);font-size:0.68rem;flex-shrink:0">${s.time}</span>
                  <div style="flex:1">
                    <div style="font-weight:600">${s.car}</div>
                    <div style="font-size:0.66rem;color:var(--text-muted)">${s.station} · ${s.kwh}kWh · ${s.dur}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-weight:700;color:var(--primary)">${formatCurrency(s.amount)}</div>
                    <span style="font-size:0.6rem;background:${s.status==='charging'?'var(--success)':'var(--text-muted)'};color:#fff;padding:1px 6px;border-radius:8px">${s.status==='charging'?'⚡':'✅'}</span>
                  </div>
                </div>`).join('')}
            </div>

            <div class="card" style="padding:14px;background:var(--success)11;border:1px solid var(--success)44">
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">📊 YTD Summary</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.78rem">
                <div><div style="color:var(--text-muted);font-size:0.64rem">รายได้รวม</div><div style="font-weight:700;color:var(--success)">${formatCurrency(ytdRev)}</div></div>
                <div><div style="color:var(--text-muted);font-size:0.64rem">กำไรรวม</div><div style="font-weight:700;color:var(--primary)">${formatCurrency(ytdProfit)}</div></div>
                <div><div style="color:var(--text-muted);font-size:0.64rem">Margin</div><div style="font-weight:700">${Math.round(ytdProfit/ytdRev*100)}%</div></div>
                <div><div style="color:var(--text-muted);font-size:0.64rem">Sessions รวม</div><div style="font-weight:700">${MONTHLY.slice(0,selMonth+1).reduce((s,x)=>s+x.sessions,0)}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selMonth=parseInt(b.dataset.i); render() }))
    document.getElementById('report-btn')?.addEventListener('click', () => {
      exportToExcel(
        MONTHLY.map(m => ({
          'เดือน': m.month,
          'จำนวน Session': m.sessions,
          'kWh รวม': m.kwh,
          'รายได้ (บาท)': m.revenue,
          'ต้นทุนไฟฟ้า (บาท)': m.cost,
          'กำไร (บาท)': m.profit,
          'Margin %': Math.round(m.profit / m.revenue * 100),
        })),
        'Charging_Revenue_Report.xlsx',
        'Charging Revenue'
      )
      showToast('📥 Export Charging Revenue Report แล้ว', 'success')
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:12px 14px">
      <div style="font-size:0.7rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
