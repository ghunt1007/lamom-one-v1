import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function nowStr() { return new Date().toTimeString().slice(0, 5) }

export default async function AttendancePage(container) {
  const myGen = container.__routerGen
  let activeStaff = []

  try {
    const staffList = await listDocs('staff', [], 'name', 'asc', 200)
    if (container.__routerGen !== myGen) return
    activeStaff = staffList.map(s => ({
      id: s.id,
      name: s.name || s.staffName || '',
      dept: s.department || s.dept || 'ทั่วไป',
      position: s.position || s.role || '',
      shift: s.shift || '08:30-17:30',
    })).filter(s => s.name)
  } catch { activeStaff = [] }

  // attendanceDb: { [date]: [{ id, staffId, staffName, date, checkIn, checkOut, status, note }] } — สร้างจากข้อมูลจริงใน Firestore เท่านั้น ไม่มีข้อมูลสุ่ม/ปลอมปนอีกต่อไป
  let attendanceDb = {}
  try {
    const rows = await listDocs('attendance', [], 'date', 'desc', 1000)
    if (container.__routerGen !== myGen) return
    rows.forEach(r => { (attendanceDb[r.date] ||= []).push(r) })
  } catch { attendanceDb = {} }

  let viewDate = todayStr()
  let viewMonth = todayStr().slice(0, 7)
  let tab = 'today' // today | monthly | report

  function getTodayRecords() {
    return attendanceDb[viewDate] || activeStaff.map(s => ({
      staffId: s.id, staffName: s.name, date: viewDate,
      checkIn: null, checkOut: null, status: 'pending', note: ''
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

  async function checkIn(staffId) {
    if (!attendanceDb[viewDate]) attendanceDb[viewDate] = []
    let rec = attendanceDb[viewDate].find(r => r.staffId === staffId)
    const staff = activeStaff.find(s => s.id === staffId)
    if (!staff) return
    if (rec?.checkIn) return showToast('ลงเวลาเข้าแล้ว', 'warning')

    const checkInTime = nowStr()
    const [hShift, mShift] = (staff.shift || '08:30-17:30').split('-')[0].split(':').map(Number)
    const [hIn, mIn] = checkInTime.split(':').map(Number)
    const lateMinutes = (hIn * 60 + mIn) - (hShift * 60 + mShift)
    const status = lateMinutes > 15 ? 'late' : 'present'

    try {
      if (rec) {
        await updateDocData('attendance', rec.id, { checkIn: checkInTime, status })
        rec.checkIn = checkInTime; rec.status = status
      } else {
        const data = { staffId, staffName: staff.name, date: viewDate, checkIn: checkInTime, checkOut: null, status, note: '' }
        const id = await createDoc('attendance', data)
        attendanceDb[viewDate].push({ ...data, id })
      }
    } catch { return showToast('บันทึกไม่สำเร็จ', 'error') }

    showToast(`✅ ${staff.name} เข้างาน ${checkInTime} ${lateMinutes > 15 ? '⚠️ สาย ' + lateMinutes + ' นาที' : ''}`, status === 'late' ? 'warning' : 'success')
    renderPage()
  }

  async function checkOut(staffId) {
    const rec = attendanceDb[viewDate]?.find(r => r.staffId === staffId)
    if (!rec || !rec.checkIn) return showToast('ยังไม่ได้ลงเวลาเข้า', 'warning')
    if (rec.checkOut) return showToast('ลงเวลาออกแล้ว', 'warning')
    const checkOutTime = nowStr()
    try {
      await updateDocData('attendance', rec.id, { checkOut: checkOutTime })
      rec.checkOut = checkOutTime
    } catch { return showToast('บันทึกไม่สำเร็จ', 'error') }
    showToast(`👋 ${rec.staffName} ออกงาน ${checkOutTime}`, 'success')
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
            <div class="page-subtitle">ลงเวลาเข้า-ออกงาน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="att-export">📥 Export</button>
          </div>
        </div>

        ${!activeStaff.length ? `<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted)">
          ยังไม่มีข้อมูลพนักงานในระบบ — เพิ่มพนักงานที่หน้า HR &gt; พนักงาน ก่อน
        </div>` : `
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
        `}
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
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${escHtml((r.staffName||'?').charAt(0))}</div>
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
    const monthRecs = Object.values(attendanceDb).flat()
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
