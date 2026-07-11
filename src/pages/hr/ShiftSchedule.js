import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SHIFTS = {
  morning:   { label: 'เช้า', time: '06:00-14:00', color: 'warning', icon: '🌅' },
  day:       { label: 'กลางวัน', time: '08:00-17:00', color: 'primary', icon: '☀️' },
  afternoon: { label: 'บ่าย', time: '14:00-22:00', color: 'accent', icon: '🌆' },
  off:       { label: 'หยุด', time: '-', color: 'primary', icon: '🏖' },
}

function getWeekDates(weekOffset = 0) {
  const today = new Date()
  const mon = new Date(today)
  mon.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function roleToDeptKey(role) {
  if (role === 'sales') return 'sales'
  if (role === 'service') return 'service'
  return 'admin'
}

function defaultShiftFor(s, dow) {
  if (dow === 0) return 'off'
  if (dow === 6 && s.dept === 'admin') return 'off'
  if (dow === 6) return 'day'
  return s.dept === 'service' ? 'morning' : 'day'
}

export default async function ShiftSchedulePage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let activeStaff = []
  let weekOffset = 0
  let schedule = {}        // schedule[date][staffId] = shift — persisted assignments only
  let scheduleDocs = []     // raw shift_schedules docs, for id lookup on save
  let deptFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [staff, shifts] = await Promise.all([
        listDocs('staff', [], 'firstName', 'asc', 200),
        listDocs('shift_schedules', [], 'date', 'asc', 2000),
      ])
      activeStaff = staff.map(s => ({
        id: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || 'พนักงาน',
        dept: roleToDeptKey(s.role || s.dept),
        position: s.role || s.position || '',
      }))
      scheduleDocs = shifts
      schedule = {}
      shifts.forEach(s => {
        if (!schedule[s.date]) schedule[s.date] = {}
        schedule[s.date][s.staffId] = s.shift
      })
    } catch (e) { activeStaff = []; scheduleDocs = []; schedule = {} }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getWeek() { return getWeekDates(weekOffset) }

  function getShift(date, staffId, s) {
    if (schedule[date]?.[staffId]) return schedule[date][staffId]
    return defaultShiftFor(s, new Date(date).getDay())
  }

  function getFilteredStaff() {
    if (deptFilter === 'all') return activeStaff
    return activeStaff.filter(s => s.dept === deptFilter)
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const dates = getWeek()
    const staff = getFilteredStaff()
    const today = new Date().toISOString().slice(0, 10)

    const dayNames = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']
    const dateObjs = dates.map(d => new Date(d))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📆 Shift & Schedule</div>
            <div class="page-subtitle">ตารางกะและจัดการเวลาทำงาน</div>
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
                const shiftKey = getShift(d, s.id, s)
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
            const working = staff.filter(s => getShift(d, s.id, s) !== 'off').length
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
      dates.forEach(d => staff.forEach(s => { const sh = SHIFTS[getShift(d, s.id, s)]; rows.push({ วันที่:d, พนักงาน:s.name, แผนก:s.dept, กะ:sh.label, เวลา:sh.time }) }))
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
    const current = getShift(date, staffId, s)
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
    el.querySelector('#se-s').addEventListener('click', async () => {
      const selected = el.querySelector('input[name="shift-opt"]:checked')?.value
      if (!selected) { close(); return }
      try {
        const existing = scheduleDocs.find(x => x.date === date && x.staffId === staffId)
        if (existing) await updateDocData('shift_schedules', existing.id, { shift: selected })
        else await createDoc('shift_schedules', { staffId, date, shift: selected })
        showToast(`✅ กำหนดกะ ${SHIFTS[selected].label} แล้ว`, 'success')
        close()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}
