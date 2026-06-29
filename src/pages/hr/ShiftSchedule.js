import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SHIFTS = {
  morning:   { label: 'เช้า', time: '06:00-14:00', color: 'warning', icon: '🌅' },
  day:       { label: 'กลางวัน', time: '08:00-17:00', color: 'primary', icon: '☀️' },
  afternoon: { label: 'บ่าย', time: '14:00-22:00', color: 'accent', icon: '🌆' },
  off:       { label: 'หยุด', time: '-', color: 'primary', icon: '🏖' },
}

const DEMO_STAFF = [
  { id:'S001', name:'วิชาญ มีโชค', dept:'sales', position:'Sales Executive' },
  { id:'S002', name:'อรนุช สายใจ', dept:'sales', position:'Sales Executive' },
  { id:'S003', name:'ธีรยุทธ เก่งกาจ', dept:'service', position:'Service Advisor' },
  { id:'S004', name:'พิมพ์ใจ ตั้งมั่น', dept:'service', position:'Technician' },
  { id:'S005', name:'นภา จิตดี', dept:'admin', position:'Admin' },
  { id:'S006', name:'สุทธิพงษ์ ขยัน', dept:'service', position:'Technician' },
]

function getWeekDates(weekOffset = 0) {
  const today = new Date()
  const mon = new Date(today)
  mon.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function generateDefaultSchedule(dates) {
  const sch = {}
  dates.forEach(d => {
    const dow = new Date(d).getDay() // 0=Sun, 6=Sat
    sch[d] = {}
    DEMO_STAFF.forEach(s => {
      if (dow === 0) sch[d][s.id] = 'off'
      else if (dow === 6 && s.dept === 'admin') sch[d][s.id] = 'off'
      else if (dow === 6) sch[d][s.id] = 'day'
      else sch[d][s.id] = s.dept === 'service' ? (s.id === 'S003' ? 'morning' : 'day') : 'day'
    })
  })
  return sch
}

export default async function ShiftSchedulePage(container) {
  const myGen = container.__routerGen
  let activeStaff = [...DEMO_STAFF]
  let dataSource = 'demo'
  let weekOffset = 0
  let schedule = {}
  let deptFilter = 'all'

  try {
    const staff = await listDocs('staff', [], 'name', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (staff.length >= 2) {
      activeStaff = staff.map((s, i) => ({
        id: s.id || s.docId || `ST${i+1}`,
        name: s.name || s.displayName || 'พนักงาน',
        dept: s.dept || s.department || 'admin',
        position: s.position || s.role || '',
      }))
      dataSource = 'live'
    }
  } catch {}

  function getWeek() { return getWeekDates(weekOffset) }

  function ensureSchedule(dates) {
    dates.forEach(d => {
      if (!schedule[d]) {
        const sch = {}
        const dow = new Date(d).getDay()
        activeStaff.forEach(s => {
          if (dow === 0) sch[s.id] = 'off'
          else if (dow === 6 && s.dept === 'admin') sch[s.id] = 'off'
          else if (dow === 6) sch[s.id] = 'day'
          else sch[s.id] = s.dept === 'service' ? 'morning' : 'day'
        })
        schedule[d] = sch
      }
    })
  }

  function getFilteredStaff() {
    if (deptFilter === 'all') return activeStaff
    return activeStaff.filter(s => s.dept === deptFilter)
  }

  function renderPage() {
    const dates = getWeek()
    ensureSchedule(dates)
    const staff = getFilteredStaff()
    const today = new Date().toISOString().slice(0, 10)

    const dayNames = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']
    const dateObjs = dates.map(d => new Date(d))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📆 Shift & Schedule</div>
            <div class="page-subtitle">ตารางกะและจัดการเวลาทำงาน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● พนักงานจากระบบจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="prev-week">◀ สัปดาห์ก่อน</button>
            <button class="btn btn-secondary" id="this-week">วันนี้</button>
            <button class="btn btn-secondary" id="next-week">สัปดาห์ถัดไป ▶</button>
            <button class="btn btn-secondary" id="sch-export">📥 Export</button>
          </div>
        </div>

        <!-- Dept filter -->
        <div style="display:flex;gap:4px;margin-bottom:16px;align-items:center">
          ${['all','sales','service','admin'].map(d => `<button class="btn btn-sm ${deptFilter===d?'btn-primary':'btn-secondary'} dept-btn" data-d="${d}">${{all:'ทุกแผนก',sales:'Sales',service:'Service',admin:'Admin'}[d]}</button>`).join('')}
          <!-- Shift legend -->
          <div style="margin-left:auto;display:flex;gap:8px">
            ${Object.entries(SHIFTS).map(([k,v]) => `<span style="font-size:0.72rem;padding:2px 8px;border-radius:99px;background:var(--${v.color}-dim);color:var(--${v.color})">${v.icon} ${v.label} ${v.time!=='-'?v.time:''}</span>`).join('')}
          </div>
        </div>

        <!-- Summary row -->
        <div style="display:grid;grid-template-columns:180px repeat(7,1fr);gap:4px;margin-bottom:4px">
          <div style="font-size:0.72rem;color:var(--text-muted);padding:4px 8px">แผนก / พนักงาน</div>
          ${dates.map((d, i) => {
            const isToday = d === today; const isWeekend = [5,6].includes(i)
            return `<div style="text-align:center;padding:4px;background:${isToday?'var(--primary-dim)':isWeekend?'var(--surface-2)':'transparent'};border-radius:var(--radius-sm)">
              <div style="font-size:0.75rem;color:${isToday?'var(--primary)':isWeekend?'var(--text-muted)':'var(--text)'};font-weight:${isToday?700:400}">${dayNames[i]}</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">${d.slice(5)}</div>
            </div>`
          }).join('')}
        </div>

        <!-- Schedule grid -->
        <div style="display:flex;flex-direction:column;gap:3px">
          ${staff.map(s => `
            <div style="display:grid;grid-template-columns:180px repeat(7,1fr);gap:4px;align-items:center">
              <div style="padding:6px 8px">
                <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(s.name)}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">${escHtml(s.position)}</div>
              </div>
              ${dates.map(d => {
                const shiftKey = schedule[d]?.[s.id] || 'off'
                const shift = SHIFTS[shiftKey]
                return `<div class="shift-cell" data-date="${d}" data-sid="${s.id}" style="
                  text-align:center;padding:6px 2px;border-radius:var(--radius-sm);
                  background:var(--${shift.color}-dim);cursor:pointer;
                  border:1px solid var(--${shift.color});
                " title="${shift.label} ${shift.time}">
                  <div style="font-size:0.9rem">${shift.icon}</div>
                  <div style="font-size:0.6rem;color:var(--${shift.color})">${shift.label}</div>
                </div>`
              }).join('')}
            </div>
          `).join('')}
        </div>

        <!-- Daily summary -->
        <div style="display:grid;grid-template-columns:180px repeat(7,1fr);gap:4px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="font-size:0.72rem;color:var(--text-muted);padding:4px 8px">รวมคน (ไม่นับหยุด)</div>
          ${dates.map(d => {
            const working = staff.filter(s => schedule[d]?.[s.id] !== 'off').length
            return `<div style="text-align:center;font-size:0.8rem;font-weight:700;color:${working<2?'var(--danger)':'var(--success)'}">${working}</div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('prev-week')?.addEventListener('click', () => { weekOffset--; renderPage() })
    document.getElementById('this-week')?.addEventListener('click', () => { weekOffset=0; renderPage() })
    document.getElementById('next-week')?.addEventListener('click', () => { weekOffset++; renderPage() })
    document.querySelectorAll('.dept-btn').forEach(b => b.addEventListener('click', () => { deptFilter = b.dataset.d; renderPage() }))
    document.getElementById('sch-export')?.addEventListener('click', () => {
      const rows = []
      dates.forEach(d => staff.forEach(s => { const sh = SHIFTS[schedule[d]?.[s.id]||'off']; rows.push({ วันที่:d, พนักงาน:s.name, แผนก:s.dept, กะ:sh.label, เวลา:sh.time }) }))
      exportToExcel(rows, 'ShiftSchedule')
    })

    document.querySelectorAll('.shift-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const d = cell.dataset.date; const sid = cell.dataset.sid
        openShiftEditor(d, sid)
      })
    })
  }

  function openShiftEditor(date, staffId) {
    const s = activeStaff.find(x => x.id === staffId)
    const current = schedule[date]?.[staffId] || 'off'
    const { el, close } = openModal({
      title: `📆 กำหนดกะ — ${escHtml(s?.name || '')}`, size: 'sm',
      body: `<div>
        <div style="font-size:0.83rem;color:var(--text-muted);margin-bottom:12px">วันที่: ${date}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${Object.entries(SHIFTS).map(([k, v]) => `
            <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ${current===k?'var(--'+v.color+')':'var(--border)'};border-radius:var(--radius-md);cursor:pointer;background:${current===k?'var(--'+v.color+'-dim)':'transparent'}">
              <input type="radio" name="shift-opt" value="${k}" ${current===k?'checked':''} style="width:16px;height:16px">
              <span style="font-size:1.1rem">${v.icon}</span>
              <div>
                <div style="font-size:0.85rem;font-weight:600">${v.label}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">${v.time}</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="se-c">ยกเลิก</button><button class="btn btn-primary" id="se-s">💾 บันทึก</button>`
    })
    el.querySelector('#se-c').addEventListener('click', close)
    el.querySelector('#se-s').addEventListener('click', () => {
      const selected = el.querySelector('input[name="shift-opt"]:checked')?.value
      if (selected) {
        if (!schedule[date]) schedule[date] = {}
        schedule[date][staffId] = selected
        showToast(`✅ กำหนดกะ ${SHIFTS[selected].label} แล้ว`, 'success')
      }
      close(); renderPage()
    })
  }

  renderPage()
}
