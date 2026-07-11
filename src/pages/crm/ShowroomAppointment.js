import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const APPT_STATUS = {
  scheduled:  { label: 'นัดแล้ว', color: 'primary' },
  confirmed:  { label: 'ยืนยัน', color: 'success' },
  arrived:    { label: 'มาถึงแล้ว', color: 'warning' },
  done:       { label: 'เสร็จสิ้น', color: 'success' },
  noshow:     { label: 'ไม่มา', color: 'danger' },
  cancelled:  { label: 'ยกเลิก', color: 'danger' },
}

const APPT_PURPOSE = [
  'ดูรถ / สอบถาม', 'ทดลองขับ', 'รับใบเสนอราคา', 'ปิดดีล / เซ็นสัญญา',
  'รับรถ (Delivery)', 'พูดคุยไฟแนนซ์', 'อื่นๆ',
]

const SALESPERSONS = ['วิชาญ มีโชค', 'อรนุช สายใจ', 'ยังไม่ระบุ']

export default async function ShowroomAppointmentPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let appts = []
  let viewDate = new Date().toISOString().slice(0, 10)
  let statusFilter = 'all'
  let salesFilter = 'all'
  let tab = 'today' // today | upcoming | all
  let loading = true

  async function loadData() {
    loading = true
    try { appts = await listDocs('appointments', [], 'date', 'desc', 300) } catch (e) { appts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getFiltered() {
    let list = appts
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter)
    if (salesFilter !== 'all') list = list.filter(a => a.salesperson === salesFilter)
    if (tab === 'today') list = list.filter(a => a.date === viewDate)
    else if (tab === 'upcoming') {
      list = list.filter(a => a.date >= viewDate && !['done','cancelled','noshow'].includes(a.status))
    }
    return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  }

  function getStats() {
    const today = new Date().toISOString().slice(0, 10)
    const todayList = appts.filter(a => a.date === today)
    return {
      today: todayList.length,
      confirmed: todayList.filter(a => a.status === 'confirmed').length,
      arrived: todayList.filter(a => a.status === 'arrived').length,
      done: todayList.filter(a => a.status === 'done').length,
      upcoming: appts.filter(a => a.date > today && !['cancelled','noshow'].includes(a.status)).length,
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = getStats()
    const filtered = getFiltered()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏪 Showroom Appointment</div>
            <div class="page-subtitle">จัดการนัดหมายลูกค้าเข้าโชว์รูม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="sa-export">📥 Export</button>
            <button class="btn btn-primary" id="new-sa-btn">➕ นัดหมายใหม่</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
          ${kpi('📅 วันนี้', s.today, 'primary')}
          ${kpi('✅ ยืนยัน', s.confirmed, 'success')}
          ${kpi('🏪 มาถึงแล้ว', s.arrived, 'warning')}
          ${kpi('🏁 เสร็จ', s.done, 'success')}
          ${kpi('📆 รออยู่', s.upcoming, 'primary')}
        </div>

        <!-- Tabs + Filters -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            ${[['today','📅 วันนี้'],['upcoming','📆 กำลังมา'],['all','📋 ทั้งหมด']].map(([t,l]) => `<button class="btn btn-sm ${tab===t?'btn-primary':'btn-secondary'} tab-btn" data-t="${t}">${l}</button>`).join('')}
          </div>
          ${tab === 'today' ? `<input type="date" class="input" id="view-date" value="${viewDate}" style="width:150px">` : ''}
          <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap">
            <select class="input" id="sales-sel" style="width:150px">
              <option value="all">ทุกเซลส์</option>
              ${SALESPERSONS.map(s => `<option value="${s}" ${salesFilter===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <select class="input" id="status-sel" style="width:130px">
              <option value="all">ทุกสถานะ</option>
              ${Object.entries(APPT_STATUS).map(([k,v]) => `<option value="${k}" ${statusFilter===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Timeline for today -->
        ${tab === 'today' ? renderTimeline(filtered) : renderTable(filtered)}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('view-date')?.addEventListener('change', e => { viewDate = e.target.value; renderPage() })
    document.getElementById('sales-sel')?.addEventListener('change', e => { salesFilter = e.target.value; renderPage() })
    document.getElementById('status-sel')?.addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    document.getElementById('new-sa-btn')?.addEventListener('click', () => openForm())
    document.getElementById('sa-export')?.addEventListener('click', () => exportToExcel(filtered.map(a => ({ วันที่:a.date, เวลา:a.time, ลูกค้า:a.custName, วัตถุประสงค์:a.purpose, รุ่นที่สนใจ:a.interestedIn, เซลส์:a.salesperson, สถานะ:APPT_STATUS[a.status].label })), 'ShowroomAppts'))
    document.querySelectorAll('.status-quick-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const a = appts.find(x => x.id === btn.dataset.id)
        if (!a) return
        try {
          await updateDocData('appointments', a.id, { status: btn.dataset.s })
          showToast('✅ อัพเดตแล้ว', 'success')
          await loadData()
        } catch (err) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
    document.querySelectorAll('.appt-row, .appt-card-click').forEach(el => {
      el.addEventListener('click', () => { const a = appts.find(x => x.id === el.dataset.id); if (a) openDetail(a) })
    })
  }

  function renderTimeline(list) {
    if (!list.length) return `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">ไม่มีนัดหมายวันนี้</div></div>`

    const hours = [...new Set(list.map(a => a.time.slice(0,2)))].sort()
    return `<div style="display:flex;flex-direction:column;gap:0">
      ${hours.map(h => {
        const slotAppts = list.filter(a => a.time.startsWith(h))
        return `<div style="display:flex;gap:12px;margin-bottom:16px">
          <div style="min-width:52px;text-align:right;padding-top:4px">
            <div style="font-size:1rem;font-weight:700;color:var(--primary)">${h}:00</div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px">
            ${slotAppts.map(a => renderApptCard(a)).join('')}
          </div>
        </div>`
      }).join('')}
    </div>`
  }

  function renderApptCard(a) {
    const st = APPT_STATUS[a.status] || APPT_STATUS.scheduled
    const isToday = a.date === new Date().toISOString().slice(0, 10)
    return `<div class="appt-card-click" data-id="${a.id}" style="
      padding:12px 16px;background:var(--surface);border:1px solid var(--border);
      border-left:3px solid var(--${st.color});border-radius:var(--radius-md);cursor:pointer;
    ">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-weight:700;font-size:0.88rem">${escHtml(a.custName)}</span>
            <span class="badge badge-${st.color}" style="font-size:0.63rem">${st.label}</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(a.purpose)} · ${escHtml(a.interestedIn)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">📞 ${escHtml(a.phone)} · 👤 ${escHtml(a.salesperson)} · 📣 ${escHtml(a.source)}</div>
          ${a.note ? `<div style="font-size:0.72rem;margin-top:4px;color:var(--primary)">📝 ${escHtml(a.note)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
          ${a.status === 'scheduled' ? `<button class="btn btn-xs btn-success status-quick-btn" data-id="${a.id}" data-s="confirmed">ยืนยัน</button>` : ''}
          ${a.status === 'confirmed' ? `<button class="btn btn-xs btn-warning status-quick-btn" data-id="${a.id}" data-s="arrived">มาถึง</button>` : ''}
          ${a.status === 'arrived' ? `<button class="btn btn-xs btn-success status-quick-btn" data-id="${a.id}" data-s="done">เสร็จ</button>` : ''}
          ${['scheduled','confirmed'].includes(a.status) ? `<button class="btn btn-xs btn-danger status-quick-btn" data-id="${a.id}" data-s="noshow">ไม่มา</button>` : ''}
        </div>
      </div>
    </div>`
  }

  function renderTable(list) {
    return `<div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr><th>วันที่/เวลา</th><th>ลูกค้า</th><th>วัตถุประสงค์</th><th>รุ่นที่สนใจ</th><th>เซลส์</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>
          ${list.map(a => {
            const st = APPT_STATUS[a.status] || APPT_STATUS.scheduled
            return `<tr class="appt-row" data-id="${a.id}" style="cursor:pointer">
              <td style="font-size:0.8rem;white-space:nowrap">${escHtml(a.date)}<br><span style="color:var(--primary);font-weight:700">${escHtml(a.time)}</span></td>
              <td><div style="font-weight:600;font-size:0.85rem">${escHtml(a.custName)}</div><div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(a.phone)}</div></td>
              <td style="font-size:0.82rem">${escHtml(a.purpose)}</td>
              <td style="font-size:0.82rem">${escHtml(a.interestedIn)}</td>
              <td style="font-size:0.8rem">${escHtml(a.salesperson)}</td>
              <td><span class="badge badge-${st.color}">${st.label}</span></td>
              <td onclick="event.stopPropagation()">
                <div style="display:flex;gap:4px">
                  ${a.status === 'scheduled' ? `<button class="btn btn-xs btn-success status-quick-btn" data-id="${a.id}" data-s="confirmed">ยืนยัน</button>` : ''}
                  ${a.status === 'confirmed' ? `<button class="btn btn-xs btn-warning status-quick-btn" data-id="${a.id}" data-s="arrived">มาถึง</button>` : ''}
                  ${a.status === 'arrived' ? `<button class="btn btn-xs btn-success status-quick-btn" data-id="${a.id}" data-s="done">เสร็จ</button>` : ''}
                </div>
              </td>
            </tr>`
          }).join('')}
          ${!list.length ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่มีนัดหมาย</td></tr>` : ''}
        </tbody>
      </table>
    </div>`
  }

  function openForm(appt = null) {
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: appt ? '✏️ แก้ไขนัดหมาย' : '🏪 นัดหมายใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="sa-name" value="${escHtml(appt?.custName||'')}" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร *</label><input class="input" id="sa-phone" value="${escHtml(appt?.phone||'')}" placeholder="08x-xxx-xxxx"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วัตถุประสงค์</label>
            <select class="input" id="sa-purpose">
              ${APPT_PURPOSE.map(p => `<option value="${p}" ${appt?.purpose===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">รุ่นรถที่สนใจ</label><input class="input" id="sa-interest" value="${escHtml(appt?.interestedIn||'')}" placeholder="เช่น BYD Seal AWD"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันที่นัด *</label><input class="input" type="date" id="sa-date" value="${appt?.date||today}"></div>
          <div class="input-group"><label class="input-label">เวลา *</label><input class="input" type="time" id="sa-time" value="${appt?.time||'10:00'}"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">เซลส์ผู้ดูแล</label>
            <select class="input" id="sa-sales">
              ${SALESPERSONS.map(s => `<option value="${s}" ${appt?.salesperson===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">ช่องทางที่มา</label>
            <select class="input" id="sa-source">
              ${['LINE OA','Facebook','TikTok','Walk-in','Referral','Sale Team','อื่นๆ'].map(s => `<option value="${s}" ${appt?.source===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="input-group"><label class="input-label">งบประมาณ (฿)</label><input class="input" type="number" id="sa-budget" value="${appt?.budget||''}" placeholder="0"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="sa-note" rows="2">${escHtml(appt?.note||'')}</textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="sa-c">ยกเลิก</button><button class="btn btn-primary" id="sa-s">💾 บันทึก</button>`
    })
    el.querySelector('#sa-c').addEventListener('click', close)
    el.querySelector('#sa-s').addEventListener('click', async () => {
      const custName = el.querySelector('#sa-name').value.trim()
      const phone = el.querySelector('#sa-phone').value.trim()
      const date = el.querySelector('#sa-date').value
      const time = el.querySelector('#sa-time').value
      if (!custName || !phone || !date || !time) return showToast('❗ กรอกข้อมูลที่จำเป็น', 'warning')
      const data = { custName, phone, date, time, purpose: el.querySelector('#sa-purpose').value, interestedIn: el.querySelector('#sa-interest').value, salesperson: el.querySelector('#sa-sales').value, source: el.querySelector('#sa-source').value, budget: +el.querySelector('#sa-budget').value || 0, note: el.querySelector('#sa-note').value }
      try {
        if (appt) await updateDocData('appointments', appt.id, data)
        else await createDoc('appointments', { ...data, status: 'scheduled', email: '' })
        showToast('📅 บันทึกนัดหมายแล้ว', 'success'); close()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openDetail(a) {
    const st = APPT_STATUS[a.status] || APPT_STATUS.scheduled
    openModal({
      title: '🏪 ' + escHtml(a.custName), size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:0.85rem">
        <span class="badge badge-${st.color}">${st.label}</span>
        <div class="grid-2" style="gap:8px">
          <div>📞 ${escHtml(a.phone)}</div><div>📅 ${escHtml(a.date)} ${escHtml(a.time)}</div>
          <div>🎯 ${escHtml(a.purpose)}</div><div>🚗 ${escHtml(a.interestedIn)}</div>
          <div>👤 ${escHtml(a.salesperson)}</div><div>📣 ${escHtml(a.source)}</div>
        </div>
        ${a.note ? `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-sm)">📝 ${escHtml(a.note)}</div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--border)">
          ${Object.entries(APPT_STATUS).filter(([k]) => k !== a.status).map(([k,v]) => `<button class="btn btn-xs btn-secondary det-status-btn" data-s="${k}">${v.label}</button>`).join('')}
          <button class="btn btn-xs btn-primary edit-det-btn" style="margin-left:auto">✏️</button>
        </div>
      </div>`, footer: ''
    })
    document.querySelectorAll('.det-status-btn').forEach(btn => { btn.addEventListener('click', async () => {
      try {
        await updateDocData('appointments', a.id, { status: btn.dataset.s })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ อัพเดตแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }) })
    document.querySelector('.edit-det-btn')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(a) })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
