/**
 * Test Drive Scheduler — ตารางทดลองขับ
 * Route: /dms/testdrive-schedule
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TD_STATUS = {
  scheduled: { label: 'นัดแล้ว', color: 'primary' },
  confirmed: { label: 'ยืนยันแล้ว', color: 'success' },
  in_progress:{ label: 'กำลังขับ', color: 'warning' },
  done:      { label: 'เสร็จแล้ว', color: 'success' },
  no_show:   { label: 'ไม่มา', color: 'danger' },
  cancelled: { label: 'ยกเลิก', color: 'secondary' },
}

const DEMO_VEHICLES = ['BYD Seal AWD', 'BYD Atto 3', 'MG ZS EV', 'BYD Dolphin']
const STAFF_LIST = ['วิชัย ยอดขาย', 'สุดา มาดี', 'ธนา เก่ง', 'ปทิตา ที่ปรึกษา']

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function timeSlot(h) { return `${String(h).padStart(2,'0')}:00` }

const TIME_SLOTS = [9,10,11,13,14,15,16,17].map(timeSlot)

const DEMO_BOOKINGS = [
  { id: 'TD001', customerName: 'วิชัย มีโชค', phone: '085-xxx', model: 'BYD Seal AWD', date: addDays(0), time: '10:00', staff: 'วิชัย ยอดขาย', status: 'confirmed', notes: 'สนใจจริงจัง' },
  { id: 'TD002', customerName: 'สุดา อารมณ์ดี', phone: '086-xxx', model: 'BYD Atto 3', date: addDays(0), time: '14:00', staff: 'สุดา มาดี', status: 'scheduled', notes: '' },
  { id: 'TD003', customerName: 'ธนา เก่งกว่า', phone: '087-xxx', model: 'MG ZS EV', date: addDays(1), time: '11:00', staff: 'ธนา เก่ง', status: 'scheduled', notes: 'มากับครอบครัว' },
  { id: 'TD004', customerName: 'อรวรรณ ขยัน', phone: '088-xxx', model: 'BYD Dolphin', date: addDays(1), time: '15:00', staff: 'ปทิตา ที่ปรึกษา', status: 'confirmed', notes: '' },
  { id: 'TD005', customerName: 'ปทิตา สาวสวย', phone: '089-xxx', model: 'BYD Seal AWD', date: addDays(-1), time: '13:00', staff: 'วิชัย ยอดขาย', status: 'done', notes: 'สนใจซื้อ — ส่ง quote แล้ว' },
  { id: 'TD006', customerName: 'ชัยวัฒน์ ลูกค้า', phone: '090-xxx', model: 'MG ZS EV', date: addDays(-1), time: '16:00', staff: 'สุดา มาดี', status: 'no_show', notes: '' },
]

export default async function TestDriveSchedulerPage(container) {
  const myGen = container.__routerGen
  let bookings = DEMO_BOOKINGS.map(b => ({ ...b }))
  let dataSource = 'demo'
  let viewDate = addDays(0)
  let statusFilter = 'all'

  try {
    const docs = await listDocs('test_drives', [], 'date', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `TD${String(i+1).padStart(3,'0')}`,
        customerName: d.customerName || d.customer || 'ลูกค้า',
        phone: d.phone || '',
        model: d.model || d.vehicleModel || '',
        date: d.date || d.bookingDate || '',
        time: d.time || d.bookingTime || '10:00',
        staff: d.staff || d.salesName || '',
        status: d.status || 'scheduled',
        notes: d.notes || '',
      }))
      bookings = [...mapped, ...DEMO_BOOKINGS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const todayList = bookings.filter(b => b.date === viewDate)
    const scheduled = bookings.filter(b => b.status === 'scheduled' || b.status === 'confirmed').length
    const doneToday = bookings.filter(b => b.date === addDays(0) && b.status === 'done').length
    const noShow = bookings.filter(b => b.status === 'no_show').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Test Drive Scheduler</div>
            <div class="page-subtitle">ตารางนัดทดลองขับ — จัดการ Time Slot${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="book-td-btn">+ นัดทดลองขับ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📅 นัดทั้งหมด', bookings.length, 'primary')}
          ${kpi('⏳ รอขับ', scheduled, 'primary')}
          ${kpi('✅ ขับแล้ววันนี้', doneToday, 'success')}
          ${kpi('❌ No Show', noShow, noShow > 0 ? 'danger' : 'secondary')}
        </div>

        <!-- Date navigator -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <button class="btn btn-secondary btn-xs" id="prev-day">◀</button>
          <div style="font-weight:700;font-size:0.9rem">${viewDate === addDays(0) ? '📅 วันนี้' : viewDate === addDays(1) ? '📅 พรุ่งนี้' : viewDate === addDays(-1) ? '📅 เมื่อวาน' : '📅 ' + formatDate(viewDate)}</div>
          <button class="btn btn-secondary btn-xs" id="next-day">▶</button>
          <button class="btn btn-xs btn-ghost" id="today-btn">วันนี้</button>
        </div>

        <!-- Timeline view -->
        <div class="card" style="overflow:hidden;margin-bottom:14px">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">⏰ Timeline ${formatDate(viewDate)}</div>
          ${TIME_SLOTS.map(slot => {
            const booking = todayList.find(b => b.time === slot)
            const st = booking ? TD_STATUS[booking.status] : null
            return `<div style="display:flex;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);min-height:52px;align-items:center">
              <div style="min-width:50px;font-size:0.82rem;font-weight:700;color:var(--text-muted)">${slot}</div>
              ${booking ? `
                <div style="flex:1;padding:8px 12px;background:var(--surface-2);border-radius:var(--radius-sm);border-left:3px solid var(--${st?.color});cursor:pointer" class="td-slot-item" data-id="${escHtml(booking.id)}">
                  <div style="display:flex;justify-content:space-between">
                    <div>
                      <div style="font-weight:700;font-size:0.85rem">${escHtml(booking.customerName)}</div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${escHtml(booking.model)} · ${escHtml(booking.staff)}</div>
                    </div>
                    <span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span>
                  </div>
                </div>
              ` : `<div style="flex:1;padding:8px 12px;background:var(--surface-2);border-radius:var(--radius-sm);border:1px dashed var(--border);color:var(--text-muted);font-size:0.78rem;cursor:pointer" class="empty-slot" data-time="${slot}">+ ว่าง — คลิกเพื่อจอง</div>`}
            </div>`
          }).join('')}
        </div>

        <!-- All bookings list -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📋 รายการทั้งหมด</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">ลูกค้า</th>
                <th style="padding:8px 14px;text-align:center">รุ่น</th>
                <th style="padding:8px 14px;text-align:center">วัน-เวลา</th>
                <th style="padding:8px 14px;text-align:center">เซลส์</th>
                <th style="padding:8px 14px;text-align:center">สถานะ</th>
                <th style="padding:8px 14px;text-align:center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map(b => {
                const st = TD_STATUS[b.status]
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 14px;font-size:0.83rem">
                    <div style="font-weight:600">${escHtml(b.customerName)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(b.phone)}</div>
                  </td>
                  <td style="padding:8px 14px;text-align:center;font-size:0.8rem">🚗 ${escHtml(b.model)}</td>
                  <td style="padding:8px 14px;text-align:center;font-size:0.78rem">${formatDate(b.date)}<br>${escHtml(b.time)}</td>
                  <td style="padding:8px 14px;text-align:center;font-size:0.78rem">${escHtml(b.staff)}</td>
                  <td style="padding:8px 14px;text-align:center"><span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span></td>
                  <td style="padding:8px 14px;text-align:center">
                    <div style="display:flex;gap:4px;justify-content:center">
                      ${b.status === 'scheduled' ? `<button class="btn btn-xs btn-success confirm-btn" data-id="${escHtml(b.id)}">✓ ยืนยัน</button>` : ''}
                      ${(b.status === 'confirmed' || b.status === 'scheduled') ? `<button class="btn btn-xs btn-primary done-btn" data-id="${escHtml(b.id)}">✅ เสร็จ</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('prev-day')?.addEventListener('click', () => {
      const d = new Date(viewDate); d.setDate(d.getDate() - 1); viewDate = d.toISOString().slice(0, 10); renderPage()
    })
    document.getElementById('next-day')?.addEventListener('click', () => {
      const d = new Date(viewDate); d.setDate(d.getDate() + 1); viewDate = d.toISOString().slice(0, 10); renderPage()
    })
    document.getElementById('today-btn')?.addEventListener('click', () => { viewDate = addDays(0); renderPage() })
    document.getElementById('book-td-btn')?.addEventListener('click', () => openBookForm())
    container.querySelectorAll('.td-slot-item').forEach(el => el.addEventListener('click', () => {
      const b = bookings.find(x => x.id === el.dataset.id); if (b) openDetail(b)
    }))
    container.querySelectorAll('.empty-slot').forEach(el => el.addEventListener('click', () => openBookForm(el.dataset.time)))
    container.querySelectorAll('.confirm-btn').forEach(b => b.addEventListener('click', () => {
      const bk = bookings.find(x => x.id === b.dataset.id)
      if (bk) { bk.status = 'confirmed'; showToast('✅ ยืนยันนัดแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.done-btn').forEach(b => b.addEventListener('click', () => {
      const bk = bookings.find(x => x.id === b.dataset.id)
      if (bk) { bk.status = 'done'; showToast('✅ บันทึกเสร็จสิ้น', 'success'); renderPage() }
    }))
  }

  function openDetail(b) {
    const st = TD_STATUS[b.status]
    openModal({
      title: '🚗 ' + escHtml(b.id) + ' — ' + escHtml(b.customerName),
      size: 'sm',
      body: `
        <div style="margin-bottom:10px"><span class="badge badge-${st?.color}">${st?.label}</span></div>
        ${row('รุ่นรถ', escHtml(b.model))}
        ${row('วันที่', formatDate(b.date))}
        ${row('เวลา', escHtml(b.time))}
        ${row('เซลส์', escHtml(b.staff))}
        ${row('โทรศัพท์', escHtml(b.phone))}
        ${b.notes ? row('หมายเหตุ', escHtml(b.notes)) : ''}
      `
    })
  }

  function openBookForm(defaultTime = '') {
    openModal({
      title: '+ นัดทดลองขับ',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="tf-name"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="tf-phone"></div>
          <div class="input-group"><label class="input-label">รุ่นที่สนใจ</label>
            <select class="input" id="tf-model">${DEMO_VEHICLES.map(v=>`<option>${v}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เซลส์</label>
            <select class="input" id="tf-staff">${STAFF_LIST.map(s=>`<option>${s}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">วันที่</label><input type="date" class="input" id="tf-date" value="${viewDate}"></div>
          <div class="input-group"><label class="input-label">เวลา</label>
            <select class="input" id="tf-time">${TIME_SLOTS.map(t=>`<option ${t===defaultTime?'selected':''}>${t}</option>`).join('')}</select>
          </div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('tf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return }
        bookings.unshift({
          id: `TD${String(bookings.length+1).padStart(3,'0')}`, customerName: name,
          phone: document.getElementById('tf-phone')?.value||'',
          model: document.getElementById('tf-model')?.value||DEMO_VEHICLES[0],
          date: document.getElementById('tf-date')?.value||viewDate,
          time: document.getElementById('tf-time')?.value||'10:00',
          staff: document.getElementById('tf-staff')?.value||STAFF_LIST[0],
          status: 'scheduled', notes: ''
        })
        showToast('✅ นัดทดลองขับแล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
