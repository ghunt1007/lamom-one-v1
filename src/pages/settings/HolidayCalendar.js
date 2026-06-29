/**
 * Holiday Calendar — ปฏิทินวันหยุดบริษัท
 * Route: /settings/holidays
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const HOLIDAY_TYPES = {
  national: { label: 'วันหยุดราชการ', color: 'danger', icon: '🇹🇭' },
  company:  { label: 'วันหยุดบริษัท', color: 'primary', icon: '🏢' },
  special:  { label: 'กิจกรรมพิเศษ', color: 'warning', icon: '🎉' },
}

const YEAR = new Date().getFullYear()

const DEMO_HOLIDAYS = [
  { id: 'H01', name: 'วันขึ้นปีใหม่', date: `${YEAR}-01-01`, type: 'national', showroomOpen: false },
  { id: 'H02', name: 'วันมาฆบูชา', date: `${YEAR}-03-03`, type: 'national', showroomOpen: true },
  { id: 'H03', name: 'วันจักรี', date: `${YEAR}-04-06`, type: 'national', showroomOpen: true },
  { id: 'H04', name: 'สงกรานต์', date: `${YEAR}-04-13`, type: 'national', showroomOpen: false },
  { id: 'H05', name: 'สงกรานต์', date: `${YEAR}-04-14`, type: 'national', showroomOpen: false },
  { id: 'H06', name: 'สงกรานต์', date: `${YEAR}-04-15`, type: 'national', showroomOpen: false },
  { id: 'H07', name: 'วันแรงงาน', date: `${YEAR}-05-01`, type: 'national', showroomOpen: true },
  { id: 'H08', name: 'วันวิสาขบูชา', date: `${YEAR}-05-31`, type: 'national', showroomOpen: true },
  { id: 'H09', name: 'งานเลี้ยงประจำปีบริษัท', date: `${YEAR}-12-25`, type: 'company', showroomOpen: false },
  { id: 'H10', name: 'วันสิ้นปี', date: `${YEAR}-12-31`, type: 'national', showroomOpen: false },
  { id: 'H11', name: 'Motor Show (ทีมขายออกบูธ)', date: `${YEAR}-06-25`, type: 'special', showroomOpen: true },
  { id: 'H12', name: 'อบรมประจำปีทั้งบริษัท', date: `${YEAR}-07-15`, type: 'company', showroomOpen: false },
]

export default async function HolidayCalendarPage(container) {
  let holidays = DEMO_HOLIDAYS.map(h => ({ ...h }))
  let typeFilter = 'all'

  function renderPage() {
    const today = new Date().toISOString().slice(0,10)
    const list = holidays
      .filter(h => typeFilter === 'all' || h.type === typeFilter)
      .sort((a, b) => a.date.localeCompare(b.date))
    const upcoming = holidays.filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date))
    const next = upcoming[0]
    const closedDays = holidays.filter(h => !h.showroomOpen).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 Holiday Calendar</div>
            <div class="page-subtitle">ปฏิทินวันหยุด ${YEAR} — โชว์รูม + บริษัท</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-holiday-btn">+ เพิ่มวันหยุด</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📅 วันหยุดทั้งปี', holidays.length + ' วัน', 'primary')}
          ${kpi('🚪 โชว์รูมปิด', closedDays + ' วัน', 'warning')}
          ${kpi('⏭ วันหยุดถัดไป', next ? next.name : '—', 'secondary')}
        </div>

        <!-- Type filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(HOLIDAY_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">วันที่</th>
                <th style="padding:8px 10px;text-align:left">วันหยุด</th>
                <th style="padding:8px 10px">ประเภท</th>
                <th style="padding:8px 10px">โชว์รูม</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(h => {
                const ht = HOLIDAY_TYPES[h.type]
                const isPast = h.date < today
                const isNext = next && h.id === next.id
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${isPast?';opacity:0.45':''}${isNext?';background:var(--primary)0d':''}">
                  <td style="padding:8px 14px;font-weight:${isNext?700:400}">${formatDate(h.date)}${isNext?' ⏭':''}</td>
                  <td style="padding:8px 10px">${h.name}</td>
                  <td style="padding:8px 10px;text-align:center"><span class="badge badge-${ht?.color}" style="font-size:0.6rem">${ht?.icon} ${ht?.label}</span></td>
                  <td style="padding:8px 10px;text-align:center">
                    <button class="btn btn-xs ${h.showroomOpen?'btn-success':'btn-danger'} open-toggle" data-id="${h.id}">${h.showroomOpen?'🟢 เปิด':'🔴 ปิด'}</button>
                  </td>
                  <td style="padding:8px 14px;text-align:right">
                    ${h.type !== 'national' ? `<button class="btn btn-xs btn-secondary del-btn" data-id="${h.id}">🗑</button>` : ''}
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 วันที่โชว์รูม "ปิด" ระบบจะไม่ให้ลูกค้านัดหมาย และแจ้งอัตโนมัติใน Chat / Booking</p>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.open-toggle').forEach(b => b.addEventListener('click', () => {
      const h = holidays.find(x => x.id === b.dataset.id)
      if (h) { h.showroomOpen = !h.showroomOpen; showToast(h.showroomOpen ? '🟢 โชว์รูมเปิดวันนี้' : '🔴 โชว์รูมปิดวันนี้', 'primary'); renderPage() }
    }))
    container.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', () => {
      holidays = holidays.filter(x => x.id !== b.dataset.id); showToast('🗑 ลบวันหยุดแล้ว', 'secondary'); renderPage()
    }))
    document.getElementById('add-holiday-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่มวันหยุด',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อ *</label><input class="input" id="hd-name"></div>
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="hd-date" value="${today}"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="hd-type"><option value="company">🏢 วันหยุดบริษัท</option><option value="special">🎉 กิจกรรมพิเศษ</option></select>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer">
            <input type="checkbox" id="hd-open" checked style="accent-color:var(--primary)"> โชว์รูมยังเปิดทำการ
          </label>
        </div>`,
        onConfirm() {
          const name = document.getElementById('hd-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
          holidays.push({ id:`H${String(holidays.length+1).padStart(2,'0')}`, name, date:document.getElementById('hd-date')?.value||today, type:document.getElementById('hd-type')?.value||'company', showroomOpen:document.getElementById('hd-open')?.checked??true })
          showToast('✅ เพิ่มวันหยุดแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
