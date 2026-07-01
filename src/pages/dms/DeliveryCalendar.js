/**
 * Delivery Calendar — ปฏิทินส่งมอบรถ
 * Route: /dms/delivery-calendar
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DLV_STATUS = {
  preparing: { label: 'เตรียมรถ', color: 'warning', icon: '🔧' },
  ready:     { label: 'พร้อมส่งมอบ', color: 'primary', icon: '✅' },
  delivered: { label: 'ส่งมอบแล้ว', color: 'success', icon: '🎉' },
  postponed: { label: 'เลื่อนนัด', color: 'danger', icon: '📅' },
}

const PREP_CHECKLIST = ['PDI ผ่านแล้ว', 'ติดฟิล์ม/อุปกรณ์ครบ', 'ล้างรถ + เติมไฟ 100%', 'เอกสาร/ป้ายแดงพร้อม', 'ของแถมจัดครบ']

const DEMO_DELIVERIES = [
  { id: 'DL001', customer: 'สมชาย ใจดี', phone: '085-111', model: 'BYD Seal AWD', color: 'ดำ', vin: '...3456', date: addDays(0), time: '10:00', status: 'ready', staff: 'วิชัย ยอดขาย', prep: [true, true, true, true, true] },
  { id: 'DL002', customer: 'มาลี สุขใจ', phone: '086-222', model: 'BYD Dolphin', color: 'ขาว', vin: '...9012', date: addDays(0), time: '14:00', status: 'preparing', staff: 'สุดา มาดี', prep: [true, true, false, true, false] },
  { id: 'DL003', customer: 'อรทัย ตั้งใจ', phone: '088-444', model: 'MG ZS EV', color: 'แดง', vin: '...7788', date: addDays(1), time: '11:00', status: 'preparing', staff: 'ธนา เก่ง', prep: [true, false, false, false, false] },
  { id: 'DL004', customer: 'วิรัช เก่งมาก', phone: '089-555', model: 'BYD Han', color: 'ขาว', vin: '...2233', date: addDays(2), time: '15:00', status: 'preparing', staff: 'วิชัย ยอดขาย', prep: [false, false, false, false, false] },
  { id: 'DL005', customer: 'ชาตรี เข้มแข็ง', phone: '084-666', model: 'BYD Atto 3', color: 'น้ำเงิน', vin: '...5566', date: addDays(-1), time: '13:00', status: 'delivered', staff: 'สุดา มาดี', prep: [true, true, true, true, true] },
]

export default async function DeliveryCalendarPage(container) {
  const myGen = container.__routerGen
  let deliveries = DEMO_DELIVERIES.map(d => ({ ...d, prep: [...d.prep] }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('bookings', [], 'deliveryDate', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    const pending = docs.filter(d => d.deliveryDate && ['จองแล้ว','รอส่งมอบ','ตัดตัวเลขรอส่งมอบ','ส่งมอบแล้ว'].includes(d.status))
    if (pending.length >= 2) {
      const mapped = pending.map((d, i) => ({
        id: d.id || `DL${i+1}`,
        customer: d.customerName || d.custName || 'ลูกค้า',
        phone: d.phone || '',
        model: d.model || d.vehicleModel || '',
        color: d.color || '',
        vin: d.vin || d.chassisNo || '',
        date: d.deliveryDate || d.bookingDate || '',
        time: d.deliveryTime || '10:00',
        status: d.status === 'ส่งมอบแล้ว' ? 'delivered' : (d.status === 'รอส่งมอบ' || d.status === 'ตัดตัวเลขรอส่งมอบ') ? 'ready' : 'preparing',
        staff: d.salesName || d.salesPerson || '',
        prep: [false, false, false, false, false],
      }))
      deliveries = [...mapped, ...DEMO_DELIVERIES]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const today = addDays(0)
    const todayList = deliveries.filter(d => d.date === today && d.status !== 'delivered')
    const upcoming = deliveries.filter(d => d.date > today)
    const done = deliveries.filter(d => d.status === 'delivered')
    const notReady = todayList.filter(d => d.status === 'preparing').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎉 Delivery Calendar</div>
            <div class="page-subtitle">ปฏิทินส่งมอบรถ — เตรียมความพร้อมทุกคัน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-dlv-btn">+ นัดส่งมอบ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🎉 ส่งมอบวันนี้', todayList.length + ' คัน', 'primary')}
          ${kpi('⚠️ ยังไม่พร้อม', notReady, notReady > 0 ? 'danger' : 'success')}
          ${kpi('📅 คิวถัดไป', upcoming.length + ' คัน', 'secondary')}
          ${kpi('✅ เดือนนี้', done.length + ' คัน', 'success')}
        </div>

        ${section('🎉 วันนี้', deliveries.filter(d => d.date === today))}
        ${section('📅 กำลังจะถึง', upcoming)}
        ${section('✅ ส่งมอบแล้ว', done.filter(d => d.date !== today))}
      </div>
    `

    function section(title, list) {
      if (!list.length) return ''
      return `
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin:14px 0 8px">${title}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(d => {
            const ds = DLV_STATUS[d.status]
            const prepDone = d.prep.filter(Boolean).length
            const prepPct = Math.round(prepDone / PREP_CHECKLIST.length * 100)
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${ds?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(d.model)} สี${escHtml(d.color)} <span style="font-size:0.7rem;color:var(--text-muted)">VIN ${escHtml(d.vin)}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👤 ${escHtml(d.customer)} 📞 ${escHtml(d.phone)} · 🗓 ${formatDate(d.date)} ${d.time} · เซลส์: ${escHtml(d.staff)}</div>
                </div>
                <span class="badge badge-${ds?.color}" style="font-size:0.63rem">${ds?.icon} ${ds?.label}</span>
              </div>
              ${d.status !== 'delivered' ? `
                <div style="margin-bottom:8px">
                  <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:3px">
                    <span style="color:var(--text-muted)">เตรียมรถ</span>
                    <span style="color:var(--${prepPct===100?'success':'warning'})">${prepDone}/${PREP_CHECKLIST.length}</span>
                  </div>
                  <div style="background:var(--surface-2);border-radius:3px;height:7px">
                    <div style="width:${prepPct}%;background:var(--${prepPct===100?'success':'warning'});height:7px;border-radius:3px"></div>
                  </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                  ${PREP_CHECKLIST.map((item, i) => `
                    <label style="display:flex;align-items:center;gap:4px;font-size:0.68rem;cursor:pointer;background:var(--surface-2);padding:3px 8px;border-radius:10px">
                      <input type="checkbox" class="prep-check" data-id="${d.id}" data-i="${i}" ${d.prep[i]?'checked':''} style="accent-color:var(--success)">
                      <span style="${d.prep[i]?'color:var(--success)':''}">${item}</span>
                    </label>
                  `).join('')}
                </div>
                <div style="display:flex;gap:6px">
                  ${d.status === 'ready' ? `<button class="btn btn-xs btn-success deliver-btn" data-id="${d.id}">🎉 ส่งมอบ + ถ่ายรูป</button>` : ''}
                  ${d.status === 'preparing' && prepPct === 100 ? `<button class="btn btn-xs btn-primary ready-btn" data-id="${d.id}">✅ พร้อมส่งมอบ</button>` : ''}
                  <button class="btn btn-xs btn-secondary postpone-btn" data-id="${d.id}">📅 เลื่อนนัด</button>
                </div>
              ` : `<div style="font-size:0.72rem;color:var(--success)">🎉 ส่งมอบเรียบร้อย — ส่ง LINE ขอบคุณ + นัดเช็คระยะแรก 1,000 km แล้ว</div>`}
            </div>`
          }).join('')}
        </div>
      `
    }

    container.querySelectorAll('.prep-check').forEach(cb => cb.addEventListener('change', () => {
      const d = deliveries.find(x => x.id === cb.dataset.id)
      if (d) { d.prep[parseInt(cb.dataset.i)] = cb.checked; renderPage() }
    }))
    container.querySelectorAll('.ready-btn').forEach(b => b.addEventListener('click', () => {
      const d = deliveries.find(x => x.id === b.dataset.id); if (d) { d.status = 'ready'; showToast('✅ พร้อมส่งมอบ — แจ้งลูกค้าแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.deliver-btn').forEach(b => b.addEventListener('click', () => {
      const d = deliveries.find(x => x.id === b.dataset.id)
      if (d) { d.status = 'delivered'; showToast('🎉 ส่งมอบสำเร็จ! ระบบนัดเช็คระยะแรกอัตโนมัติ', 'success'); renderPage() }
    }))
    container.querySelectorAll('.postpone-btn').forEach(b => b.addEventListener('click', () => {
      const d = deliveries.find(x => x.id === b.dataset.id)
      if (d) openModal({
        title: '📅 เลื่อนนัดส่งมอบ',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">วันใหม่</label><input class="input" type="date" id="pp-date" value="${addDays(3)}"></div>
          <div class="input-group"><label class="input-label">เวลา</label><input class="input" type="time" id="pp-time" value="${d.time}"></div>
        </div>`,
        onConfirm() {
          d.date = document.getElementById('pp-date')?.value || d.date
          d.time = document.getElementById('pp-time')?.value || d.time
          showToast('📅 เลื่อนนัดแล้ว — แจ้งลูกค้าทาง LINE', 'primary'); renderPage()
        }
      })
    }))
    document.getElementById('add-dlv-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ นัดส่งมอบรถ',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="dl-name"></div>
          <div class="input-group"><label class="input-label">โทร</label><input class="input" id="dl-phone"></div>
          <div class="input-group"><label class="input-label">รุ่น</label><input class="input" id="dl-model"></div>
          <div class="input-group"><label class="input-label">สี</label><input class="input" id="dl-color"></div>
          <div class="input-group"><label class="input-label">วันส่งมอบ</label><input class="input" type="date" id="dl-date" value="${addDays(3)}"></div>
          <div class="input-group"><label class="input-label">เวลา</label><input class="input" type="time" id="dl-time" value="10:00"></div>
        </div>`,
        onConfirm() {
          const name = document.getElementById('dl-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
          deliveries.push({ id:`DL${String(deliveries.length+1).padStart(3,'0')}`, customer:name, phone:document.getElementById('dl-phone')?.value||'—', model:document.getElementById('dl-model')?.value||'—', color:document.getElementById('dl-color')?.value||'—', vin:'...ใหม่', date:document.getElementById('dl-date')?.value||addDays(3), time:document.getElementById('dl-time')?.value||'10:00', status:'preparing', staff:'คุณ (Demo)', prep:[false,false,false,false,false] })
          showToast('✅ นัดส่งมอบแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
