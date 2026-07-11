/**
 * Delivery Calendar — ปฏิทินส่งมอบรถ
 * Route: /dms/delivery-calendar
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

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

// Local status -> real 'bookings' collection status string (shared with CRM/Bookings.js)
const LOCAL_TO_BOOKING_STATUS = { preparing: 'รอส่งมอบ', ready: 'ตัดตัวเลขรอส่งมอบ', delivered: 'ส่งมอบแล้ว' }

export default async function DeliveryCalendarPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let deliveries = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      const docs = await listDocs('bookings', [], 'deliveryDate', 'asc', 200)
      const pending = docs.filter(d => d.deliveryDate && ['จองแล้ว','รอส่งมอบ','ตัดตัวเลขรอส่งมอบ','ส่งมอบแล้ว'].includes(d.status))
      deliveries = pending.map(d => ({
        id: d.id,
        customer: d.customerName || d.custName || 'ลูกค้า',
        phone: d.phone || '',
        model: d.model || d.vehicleModel || '',
        color: d.colorOut || d.color || '',
        vin: d.vin || d.chassisNo || '',
        date: d.deliveryDate || d.bookingDate || '',
        time: d.deliveryTime || '10:00',
        status: d.status === 'ส่งมอบแล้ว' ? 'delivered' : (d.status === 'รอส่งมอบ' || d.status === 'ตัดตัวเลขรอส่งมอบ') ? 'ready' : 'preparing',
        staff: d.salesName || d.salesPerson || '',
        prep: Array.isArray(d.prep) ? d.prep : [false, false, false, false, false],
      }))
    } catch (e) { deliveries = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const today = addDays(0)
    const todayList = deliveries.filter(d => d.date === today && d.status !== 'delivered')
    const overdue = deliveries.filter(d => d.date < today && d.status !== 'delivered')
    const upcoming = deliveries.filter(d => d.date > today)
    const done = deliveries.filter(d => d.status === 'delivered')
    const notReady = todayList.filter(d => d.status === 'preparing').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎉 Delivery Calendar</div>
            <div class="page-subtitle">ปฏิทินส่งมอบรถ — เตรียมความพร้อมทุกคัน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-dlv-btn">+ นัดส่งมอบ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
          ${kpi('⚠️ เลยกำหนด', overdue.length + ' คัน', overdue.length > 0 ? 'danger' : 'success')}
          ${kpi('🎉 ส่งมอบวันนี้', todayList.length + ' คัน', 'primary')}
          ${kpi('⚠️ ยังไม่พร้อม', notReady, notReady > 0 ? 'danger' : 'success')}
          ${kpi('📅 คิวถัดไป', upcoming.length + ' คัน', 'secondary')}
          ${kpi('✅ เดือนนี้', done.length + ' คัน', 'success')}
        </div>

        ${section('⚠️ เลยกำหนด', overdue)}
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

    container.querySelectorAll('.prep-check').forEach(cb => cb.addEventListener('change', async () => {
      const d = deliveries.find(x => x.id === cb.dataset.id)
      if (!d) return
      const prep = [...d.prep]
      prep[parseInt(cb.dataset.i)] = cb.checked
      try { await updateDocData('bookings', d.id, { prep }); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.ready-btn').forEach(b => b.addEventListener('click', async () => {
      const d = deliveries.find(x => x.id === b.dataset.id)
      if (!d) return
      try {
        await updateDocData('bookings', d.id, { status: LOCAL_TO_BOOKING_STATUS.ready })
        showToast('✅ พร้อมส่งมอบ — แจ้งลูกค้าแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.deliver-btn').forEach(b => b.addEventListener('click', async () => {
      const d = deliveries.find(x => x.id === b.dataset.id)
      if (!d) return
      try {
        await updateDocData('bookings', d.id, { status: LOCAL_TO_BOOKING_STATUS.delivered, actualDeliveryDate: addDays(0) })
        showToast('🎉 ส่งมอบสำเร็จ! ระบบนัดเช็คระยะแรกอัตโนมัติ', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
        async onConfirm() {
          const deliveryDate = document.getElementById('pp-date')?.value || d.date
          const deliveryTime = document.getElementById('pp-time')?.value || d.time
          try {
            await updateDocData('bookings', d.id, { deliveryDate, deliveryTime })
            showToast('📅 เลื่อนนัดแล้ว — แจ้งลูกค้าทาง LINE', 'primary')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
        async onConfirm() {
          const name = document.getElementById('dl-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
          try {
            await createDoc('bookings', {
              custName: name, phone: document.getElementById('dl-phone')?.value||'—',
              model: document.getElementById('dl-model')?.value||'—', colorOut: document.getElementById('dl-color')?.value||'—',
              vin: '', deliveryDate: document.getElementById('dl-date')?.value||addDays(3), deliveryTime: document.getElementById('dl-time')?.value||'10:00',
              status: LOCAL_TO_BOOKING_STATUS.preparing, salesName: 'คุณ (Demo)', prep: [false,false,false,false,false],
              bookingNo: '', nid: '', address: '', province: '', source: 'Walk-in',
              brand: '', variant: '', colorIn: '', motorNo: '', batNo: '',
              price: 0, cost: 0, down: 0, financeCo: '', financeAmount: 0, finStatus: '', installments: 0, interestRate: 0, monthly: 0, campaign: '',
              margin: 0, budgetUsed: 0, com70: 0, comFinance: 0, marginLeft: 0, totalIncome: 0,
              bookingDate: addDays(0), submitDate: '', approveDate: '', signDate: '', cutDate: '', actualDeliveryDate: '', notes: '',
            })
            showToast('✅ นัดส่งมอบแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
