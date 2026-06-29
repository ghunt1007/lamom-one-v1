import { formatDate } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { openModal } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_STAFF = [
  { id:'S001', name:'วิชาญ มีโชค', dept:'sales', shift:'08:00-17:00', photo:null },
  { id:'S002', name:'อรนุช สายใจ', dept:'sales', shift:'08:00-17:00', photo:null },
  { id:'S003', name:'ธีรยุทธ เก่งกาจ', dept:'service', shift:'07:30-16:30', photo:null },
  { id:'S004', name:'พิมพ์ใจ ตั้งมั่น', dept:'service', shift:'07:30-16:30', photo:null },
  { id:'S005', name:'นภา จิตดี', dept:'admin', shift:'08:30-17:30', photo:null },
]

function todayStr() { return new Date().toISOString().slice(0, 10) }
function nowStr() { return new Date().toTimeString().slice(0, 5) }

function generateDemoAttendance() {
  const records = {}
  const today = new Date()
  for (let d = 0; d < 30; d++) {
    const dt = new Date(today); dt.setDate(today.getDate() - d)
    if (dt.getDay() === 0 || dt.getDay() === 6) continue // skip weekends
    const dateStr = dt.toISOString().slice(0, 10)
    records[dateStr] = DEMO_STAFF.map(s => {
      const late = Math.random() < 0.1
      const absent = Math.random() < 0.05
      const [hIn, mIn] = s.shift.split('-')[0].split(':').map(Number)
      const inH = late ? hIn + (Math.random() < 0.5 ? 1 : 0) : hIn
      const inM = absent ? 0 : Math.floor(Math.random() * 15) + (late ? 20 : 0)
      const [hOut, mOut] = s.shift.split('-')[1].split(':').map(Number)
      return {
        staffId: s.id, staffName: s.name, date: dateStr,
        checkIn: absent ? null : `${String(inH).padStart(2,'0')}:${String(inM).padStart(2,'0')}`,
        checkOut: absent ? null : `${String(hOut + (Math.random() < 0.3 ? 1 : 0)).padStart(2,'0')}:${String(Math.floor(Math.random()*30)).padStart(2,'0')}`,
        status: absent ? 'absent' : (late || inH > hIn || inM > 15) ? 'late' : 'present',
        lat: 13.7563 + (Math.random() - 0.5) * 0.01,
        lng: 100.5018 + (Math.random() - 0.5) * 0.01,
        note: ''
      }
    })
  }
  return records
}

const ATTENDANCE_KEY = 'lamom-attendance'

export default async function AttendancePage(container) {
  const myGen = container.__routerGen
  let activeStaff = DEMO_STAFF.map(s => ({ ...s }))

  try {
    const staffList = await listDocs('staff', [], 'name', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (staffList.length >= 2) {
      activeStaff = staffList.map(s => ({
        id: s.id || s.staffId || ('LS' + Math.random().toString(36).slice(2, 6)),
        name: s.name || s.staffName || '',
        dept: s.department || s.dept || 'ทั่วไป',
        position: s.position || s.role || '',
        shift: s.shift || '08:30-17:30',
        _live: true,
      })).filter(s => s.name)
    }
  } catch {}

  let attendanceDb; try { attendanceDb = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '{}') } catch { attendanceDb = {} }
  if (Object.keys(attendanceDb).length < 5) {
    attendanceDb = generateDemoAttendance()
    try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendanceDb)) } catch {}
  }

  let viewDate = todayStr()
  let viewMonth = todayStr().slice(0, 7)
  let tab = 'today' // today | monthly | report

  function getTodayRecords() {
    return attendanceDb[viewDate] || activeStaff.map(s => ({
      staffId: s.id, staffName: s.name, date: viewDate,
      checkIn: null, checkOut: null, status: 'pending', lat: null, lng: null, note: ''
    }))
  }

  function getMonthRecords() {
    return Object.entries(attendanceDb)
      .filter(([d]) => d.startsWith(viewMonth))
      .sort(([a], [b]) => b.localeCompare(a))
  }

  function getStats(records) {
    const flat = records.flat ? records : records.flatMap(([, arr]) => arr)
    return {
      present: flat.filter(r => r.status === 'present').length,
      late: flat.filter(r => r.status === 'late').length,
      absent: flat.filter(r => r.status === 'absent').length,
      pending: flat.filter(r => r.status === 'pending').length,
    }
  }

  function checkIn(staffId) {
    if (!attendanceDb[viewDate]) attendanceDb[viewDate] = []
    let rec = attendanceDb[viewDate].find(r => r.staffId === staffId)
    const staff = activeStaff.find(s => s.id === staffId) || { name: 'พนักงาน', shift: '08:30-17:30' }
    if (!rec) {
      rec = { staffId, staffName: staff.name, date: viewDate, checkIn: null, checkOut: null, status: 'pending', note: '' }
      attendanceDb[viewDate].push(rec)
    }
    if (rec.checkIn) return showToast('ลงเวลาเข้าแล้ว', 'warning')
    rec.checkIn = nowStr()
    const [hShift, mShift] = (staff.shift || '08:30-17:30').split('-')[0].split(':').map(Number)
    const [hIn, mIn] = rec.checkIn.split(':').map(Number)
    const lateMinutes = (hIn * 60 + mIn) - (hShift * 60 + mShift)
    rec.status = lateMinutes > 15 ? 'late' : 'present'
    rec.lat = 13.7563 + (Math.random() - 0.5) * 0.002
    rec.lng = 100.5018 + (Math.random() - 0.5) * 0.002
    try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendanceDb)) } catch {}
    showToast(`✅ ${staff.name} เข้างาน ${rec.checkIn} ${lateMinutes > 15 ? '⚠️ สาย ' + lateMinutes + ' นาที' : ''}`, rec.status === 'late' ? 'warning' : 'success')
    renderPage()
  }

  function checkOut(staffId) {
    const rec = attendanceDb[viewDate]?.find(r => r.staffId === staffId)
    if (!rec || !rec.checkIn) return showToast('ยังไม่ได้ลงเวลาเข้า', 'warning')
    if (rec.checkOut) return showToast('ลงเวลาออกแล้ว', 'warning')
    rec.checkOut = nowStr()
    try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendanceDb)) } catch {}
    showToast(`👋 ${rec.staffName} ออกงาน ${rec.checkOut}`, 'success')
    renderPage()
  }

  function renderPage() {
    const todayRecs = getTodayRecords()
    const todayStats = getStats(todayRecs)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🕐 Attendance</div>
            <div class="page-subtitle">ลงเวลาเข้า-ออกงาน${activeStaff.some(s => s._live) ? ' <span style="color:var(--success);font-size:0.75rem">● พนักงานจากระบบจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="att-export">📥 Export</button>
          </div>
        </div>

        <!-- KPI Today -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('✅ มาทำงาน', todayStats.present, 'success')}
          ${kpi('⏰ มาสาย', todayStats.late, 'warning')}
          ${kpi('❌ ขาดงาน', todayStats.absent, 'danger')}
          ${kpi('⏳ รอบันทึก', todayStats.pending, 'secondary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <button class="btn btn-sm ${tab==='today'?'btn-primary':'btn-secondary'} tab-btn" data-t="today">📅 วันนี้</button>
          <button class="btn btn-sm ${tab==='monthly'?'btn-primary':'btn-secondary'} tab-btn" data-t="monthly">📆 รายเดือน</button>
          <button class="btn btn-sm ${tab==='report'?'btn-primary':'btn-secondary'} tab-btn" data-t="report">📊 รายงาน</button>
        </div>

        ${tab === 'today' ? renderToday(todayRecs) : tab === 'monthly' ? renderMonthly() : renderReport()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.querySelectorAll('.checkin-btn').forEach(btn => btn.addEventListener('click', () => checkIn(btn.dataset.id)))
    document.querySelectorAll('.checkout-btn').forEach(btn => btn.addEventListener('click', () => checkOut(btn.dataset.id)))
    document.getElementById('att-export')?.addEventListener('click', () => {
      const rows = Object.entries(attendanceDb).filter(([d]) => d.startsWith(viewMonth)).flatMap(([, recs]) => recs)
      exportToExcel(rows.map(r => ({ วันที่:r.date, พนักงาน:r.staffName, เข้า:r.checkIn||'-', ออก:r.checkOut||'-', สถานะ:r.status })), 'Attendance')
    })
    document.getElementById('view-month')?.addEventListener('change', e => { viewMonth = e.target.value; renderPage() })
    document.getElementById('view-date')?.addEventListener('change', e => { viewDate = e.target.value; renderPage() })
  }

  function renderToday(recs) {
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:0.85rem;color:var(--text-muted)">วันที่:</span>
        <input type="date" class="input" id="view-date" value="${viewDate}" style="width:160px">
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${recs.map(r => {
          const s = activeStaff.find(x => x.id === r.staffId)
          const statusColor = { present:'success', late:'warning', absent:'danger', pending:'secondary' }[r.status]
          const statusLabel = { present:'มาทำงาน', late:'มาสาย', absent:'ขาดงาน', pending:'รอบันทึก' }[r.status]
          return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md)">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${escHtml(r.staffName.charAt(0))}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.88rem">${escHtml(r.staffName)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(s?.shift||'')} · ${escHtml(s?.dept||'')}</div>
            </div>
            <div style="text-align:center;min-width:70px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--success)">${r.checkIn||'--:--'}</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">เข้างาน</div>
            </div>
            <div style="text-align:center;min-width:70px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--warning)">${r.checkOut||'--:--'}</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">ออกงาน</div>
            </div>
            <span class="badge badge-${statusColor}">${statusLabel}</span>
            ${r.lat ? `<span style="font-size:0.7rem;color:var(--primary)">📍 GPS</span>` : ''}
            <div style="display:flex;gap:4px">
              ${!r.checkIn ? `<button class="btn btn-xs btn-success checkin-btn" data-id="${r.staffId}">เข้างาน</button>` : ''}
              ${r.checkIn && !r.checkOut ? `<button class="btn btn-xs btn-warning checkout-btn" data-id="${r.staffId}">ออกงาน</button>` : ''}
            </div>
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderMonthly() {
    const monthRecs = getMonthRecords()
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:0.85rem;color:var(--text-muted)">เดือน:</span>
        <input type="month" class="input" id="view-month" value="${viewMonth}" style="width:160px">
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>วันที่</th>${activeStaff.map(s=>`<th style="text-align:center;font-size:0.78rem">${escHtml(s.name.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>
            ${monthRecs.map(([date, recs]) => `
              <tr>
                <td style="font-size:0.8rem;white-space:nowrap">${date}</td>
                ${activeStaff.map(s => {
                  const r = recs.find(x => x.staffId === s.id)
                  if (!r) return '<td style="text-align:center">-</td>'
                  const emoji = { present:'✅', late:'⏰', absent:'❌', pending:'⏳' }[r.status]
                  return `<td style="text-align:center;font-size:0.88rem" title="${r.checkIn||''}-${r.checkOut||''}">${emoji}</td>`
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderReport() {
    const monthRecs = Object.values(attendanceDb).filter((_, i, a) => true).flat()
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        ${activeStaff.map(s => {
          const recs = monthRecs.filter(r => r.staffId === s.id)
          const present = recs.filter(r => r.status === 'present').length
          const late = recs.filter(r => r.status === 'late').length
          const absent = recs.filter(r => r.status === 'absent').length
          const total = present + late + absent || 1
          const rate = Math.round((present + late) / total * 100)
          return `<div class="card" style="padding:16px">
            <div style="font-weight:700;margin-bottom:4px">${escHtml(s.name)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px">${escHtml(s.dept)} · ${escHtml(s.shift)}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;margin-bottom:10px">
              <div><div style="font-size:1.1rem;font-weight:700;color:var(--success)">${present}</div><div style="font-size:0.68rem;color:var(--text-muted)">ปกติ</div></div>
              <div><div style="font-size:1.1rem;font-weight:700;color:var(--warning)">${late}</div><div style="font-size:0.68rem;color:var(--text-muted)">สาย</div></div>
              <div><div style="font-size:1.1rem;font-weight:700;color:var(--danger)">${absent}</div><div style="font-size:0.68rem;color:var(--text-muted)">ขาด</div></div>
            </div>
            <div style="margin-bottom:4px;display:flex;justify-content:space-between;font-size:0.75rem"><span>อัตราการมาทำงาน</span><span>${rate}%</span></div>
            <div style="height:6px;background:var(--surface-3);border-radius:99px"><div style="height:100%;width:${rate}%;background:${rate>=90?'var(--success)':rate>=75?'var(--warning)':'var(--danger)'};border-radius:99px"></div></div>
          </div>`
        }).join('')}
      </div>
    `
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
