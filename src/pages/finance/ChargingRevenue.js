/**
 * EV Charging Revenue — รายได้จากสถานีชาร์จในโชว์รูม
 * Route: /finance/charging-revenue
 * ข้อมูลจริงจาก collection ร่วม `charging_sessions` (ดูสคีมาใน core/seed/finance.js)
 * — หน้านี้แสดงเฉพาะ session ที่ลูกค้าจ่ายเงิน (useType==='public') เป็นมุมมองรายได้
 * ส่วนต้นทุนไฟฟ้ารวมทุกประเภทการใช้งานอยู่ที่หน้า Charging Cost (/finance/charging-cost)
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const RATE_PEAK = 5.8
const RATE_OFFPEAK = 2.6

const STATIONS = [
  { id: 'CS1', name: 'Charger A (150kW)', type: 'DC Fast', port: 'CCS2', rate: 7.50, location: 'หน้าโชว์รูม' },
  { id: 'CS2', name: 'Charger B (50kW)', type: 'DC', port: 'CCS2', rate: 6.80, location: 'ข้างทางเข้า' },
  { id: 'CS3', name: 'AC Bay 1 (22kW)', type: 'AC', port: 'Type2', rate: 4.50, location: 'ลานจอด A' },
  { id: 'CS4', name: 'AC Bay 2 (22kW)', type: 'AC', port: 'Type2', rate: 4.50, location: 'ลานจอด B' },
]

function last6Months() {
  const arr = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    arr.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: MONTH_LABELS[d.getMonth()] })
  }
  return arr
}

function touPeriodFor(hour) {
  return (hour >= 9 && hour < 22) ? 'peak' : 'offpeak'
}

export default async function ChargingRevenuePage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let sessions = []
  let selMonth = 5
  let loading = true

  async function loadData() {
    loading = true
    if (container.__routerGen === myGen) renderLoading()
    try { sessions = await listDocs('charging_sessions', [], 'date', 'desc', 1000) } catch (e) { sessions = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function renderLoading() {
    container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
  }

  function render() {
    const months = last6Months()
    const publicSessions = sessions.filter(s => s.useType === 'public')
    const MONTHLY = months.map(m => {
      const rows = publicSessions.filter(s => (s.date || '').slice(0, 7) === m.key)
      const kwh = Math.round(rows.reduce((s, x) => s + (x.kwh || 0), 0) * 10) / 10
      const revenue = Math.round(rows.reduce((s, x) => s + (x.revenue || 0), 0))
      const cost = Math.round(rows.reduce((s, x) => s + (x.cost || 0), 0))
      return { month: m.label, key: m.key, sessions: rows.length, kwh, revenue, cost, profit: revenue - cost }
    })

    const todayStr = new Date().toISOString().slice(0, 10)
    const TODAY_SESSIONS = publicSessions.filter(s => s.date === todayStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''))

    const m = MONTHLY[selMonth]
    const ytdRev    = MONTHLY.slice(0, selMonth + 1).reduce((s, x) => s + x.revenue, 0)
    const ytdProfit = MONTHLY.slice(0, selMonth + 1).reduce((s, x) => s + x.profit, 0)
    const todayRev  = TODAY_SESSIONS.filter(s => s.status === 'done').reduce((s, x) => s + (x.revenue || 0), 0)
    const maxRev = Math.max(1, ...MONTHLY.map(x => x.revenue))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ EV Charging Revenue</div>
            <div class="page-subtitle">รายได้จากสถานีชาร์จ ${STATIONS.length} จุด · YTD ${formatCurrency(ytdRev)}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              ${MONTHLY.map((mo, i) => `<button class="btn btn-xs ${i === selMonth ? 'btn-primary' : 'btn-secondary'} mo-btn" data-i="${i}">${mo.month}</button>`).join('')}
            </div>
            <button class="btn btn-secondary" id="add-session-btn" style="margin-left:8px">+ บันทึก Session</button>
            <button class="btn btn-primary" id="report-btn">📊 รายงาน</button>
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
              ${MONTHLY.map((mo, i) => {
                const revW = Math.round(mo.revenue / maxRev * 100)
                const profW = Math.round(mo.profit / maxRev * 100)
                return `<div>
                  <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:3px">
                    <span style="color:${i === selMonth ? 'var(--primary)' : 'var(--text-muted)'};font-weight:${i === selMonth ? 700 : 400}">${mo.month}</span>
                    <span style="color:var(--text-muted)">${formatCurrency(mo.revenue)} · กำไร ${formatCurrency(mo.profit)}</span>
                  </div>
                  <div style="position:relative;height:10px;background:var(--surface-2);border-radius:5px;margin-bottom:3px;overflow:hidden">
                    <div style="height:100%;width:${revW}%;background:${i === selMonth ? 'var(--primary)' : 'var(--primary)66'};border-radius:5px"></div>
                  </div>
                  <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${profW}%;background:${i === selMonth ? 'var(--success)' : 'var(--success)66'};border-radius:3px"></div>
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
              ${STATIONS.map(s => `
                <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                  <span style="font-size:1.1rem">${s.type === 'DC Fast' ? '⚡' : '🔌'}</span>
                  <div style="flex:1">
                    <div style="font-weight:600">${s.name}</div>
                    <div style="font-size:0.66rem;color:var(--text-muted)">${s.location} · ${s.port} · ${s.rate} บ/kWh</div>
                  </div>
                  <span style="font-size:0.62rem;background:${TODAY_SESSIONS.some(x => x.stationId === s.id && x.status === 'charging') ? 'var(--success)' : 'var(--surface-2)'};color:${TODAY_SESSIONS.some(x => x.stationId === s.id && x.status === 'charging') ? '#fff' : 'var(--text-muted)'};padding:2px 8px;border-radius:10px">${TODAY_SESSIONS.some(x => x.stationId === s.id && x.status === 'charging') ? '⚡ ชาร์จอยู่' : 'ว่าง'}</span>
                </div>`).join('')}
            </div>

            <!-- Today sessions -->
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted)">📋 Session วันนี้</div>
                <div style="font-size:0.8rem;font-weight:700;color:var(--success)">${formatCurrency(todayRev)}</div>
              </div>
              ${TODAY_SESSIONS.map(s => `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.74rem">
                  <span style="color:var(--text-muted);font-size:0.68rem;flex-shrink:0">${s.time || ''}</span>
                  <div style="flex:1">
                    <div style="font-weight:600">${s.vehicle || ''}</div>
                    <div style="font-size:0.66rem;color:var(--text-muted)">${s.stationId} · ${s.kwh}kWh · ${s.durationMin} นาที</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-weight:700;color:var(--primary)">${formatCurrency(s.revenue)}</div>
                    <span style="font-size:0.6rem;background:${s.status === 'charging' ? 'var(--success)' : 'var(--text-muted)'};color:#fff;padding:1px 6px;border-radius:8px">${s.status === 'charging' ? '⚡' : '✅'}</span>
                  </div>
                </div>`).join('')}
              ${!TODAY_SESSIONS.length ? '<div style="text-align:center;padding:10px;color:var(--text-muted);font-size:0.72rem">ยังไม่มี session วันนี้</div>' : ''}
            </div>

            <div class="card" style="padding:14px;background:var(--success)11;border:1px solid var(--success)44">
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">📊 YTD Summary</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.78rem">
                <div><div style="color:var(--text-muted);font-size:0.64rem">รายได้รวม</div><div style="font-weight:700;color:var(--success)">${formatCurrency(ytdRev)}</div></div>
                <div><div style="color:var(--text-muted);font-size:0.64rem">กำไรรวม</div><div style="font-weight:700;color:var(--primary)">${formatCurrency(ytdProfit)}</div></div>
                <div><div style="color:var(--text-muted);font-size:0.64rem">Margin</div><div style="font-weight:700">${ytdRev ? Math.round(ytdProfit / ytdRev * 100) : 0}%</div></div>
                <div><div style="color:var(--text-muted);font-size:0.64rem">Sessions รวม</div><div style="font-weight:700">${MONTHLY.slice(0, selMonth + 1).reduce((s, x) => s + x.sessions, 0)}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selMonth = parseInt(b.dataset.i); render() }))
    document.getElementById('add-session-btn')?.addEventListener('click', openAddSessionForm)
    document.getElementById('report-btn')?.addEventListener('click', () => {
      exportToExcel(
        MONTHLY.map(mo => ({
          'เดือน': mo.month,
          'จำนวน Session': mo.sessions,
          'kWh รวม': mo.kwh,
          'รายได้ (บาท)': mo.revenue,
          'ต้นทุนไฟฟ้า (บาท)': mo.cost,
          'กำไร (บาท)': mo.profit,
          'Margin %': mo.revenue ? Math.round(mo.profit / mo.revenue * 100) : 0,
        })),
        'Charging_Revenue_Report.xlsx',
        'Charging Revenue'
      )
      showToast('📥 Export Charging Revenue Report แล้ว', 'success')
    })
  }

  function openAddSessionForm() {
    const now = new Date()
    const nowTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    openModal({
      title: '+ บันทึก Charging Session',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">สถานี *</label>
            <select class="input" id="cs-station">${STATIONS.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">รถ/ทะเบียน *</label><input class="input" id="cs-vehicle" placeholder="เช่น BYD Atto 3"></div>
          <div class="input-group"><label class="input-label">ประเภทการใช้งาน</label>
            <select class="input" id="cs-usetype">
              <option value="public">ลูกค้าจ่ายเงิน (Public)</option>
              <option value="test_drive">รถ Demo / Test Drive</option>
              <option value="free_customer">ชาร์จฟรีให้ลูกค้า</option>
              <option value="company_car">รถบริษัท (รับ-ส่ง)</option>
              <option value="delivery_prep">เตรียมรถส่งมอบ</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">kWh *</label><input type="number" step="0.1" class="input" id="cs-kwh" placeholder="0"></div>
          <div class="input-group"><label class="input-label">ระยะเวลา (นาที)</label><input type="number" class="input" id="cs-duration" placeholder="30"></div>
          <div class="input-group"><label class="input-label">วันที่</label><input type="date" class="input" id="cs-date" value="${now.toISOString().slice(0, 10)}"></div>
          <div class="input-group"><label class="input-label">เวลา</label><input type="time" class="input" id="cs-time" value="${nowTime}"></div>
          <div class="input-group"><label class="input-label">สถานะ</label>
            <select class="input" id="cs-status"><option value="done">✅ เสร็จแล้ว</option><option value="charging">⚡ กำลังชาร์จ</option></select>
          </div>
        </div>
      `,
      async onConfirm() {
        const stationId = document.getElementById('cs-station')?.value
        const station = STATIONS.find(s => s.id === stationId) || STATIONS[0]
        const vehicle = document.getElementById('cs-vehicle')?.value?.trim()
        const useType = document.getElementById('cs-usetype')?.value || 'public'
        const kwh = +document.getElementById('cs-kwh')?.value || 0
        const durationMin = +document.getElementById('cs-duration')?.value || 0
        const date = document.getElementById('cs-date')?.value || now.toISOString().slice(0, 10)
        const time = document.getElementById('cs-time')?.value || nowTime
        const status = document.getElementById('cs-status')?.value || 'done'
        if (!vehicle) { showToast('❗ กรุณากรอกรถ/ทะเบียน', 'error'); return false }
        if (kwh <= 0) { showToast('❗ กรุณากรอกจำนวน kWh', 'error'); return false }
        const hour = +(time.split(':')[0] || 0)
        const touPeriod = touPeriodFor(hour)
        const rate = useType === 'public' ? station.rate : 0
        const revenue = useType === 'public' ? Math.round(kwh * rate) : 0
        const cost = Math.round(kwh * (touPeriod === 'peak' ? RATE_PEAK : RATE_OFFPEAK))
        try {
          await createDoc('charging_sessions', {
            date, time, stationId: station.id, stationName: station.name,
            vehicle, kwh, durationMin, touPeriod, useType, rate, revenue, cost, status,
          })
          showToast('⚡ บันทึก Session แล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:12px 14px">
      <div style="font-size:0.7rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
