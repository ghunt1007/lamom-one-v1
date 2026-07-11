import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const FOLLOWUP_TYPES = {
  call:     { label: 'โทรศัพท์', icon: '📞', color: 'primary' },
  line:     { label: 'LINE', icon: '💬', color: 'success' },
  visit:    { label: 'เยี่ยมบ้าน', icon: '🏠', color: 'warning' },
  email:    { label: 'อีเมล', icon: '📧', color: 'accent' },
  sms:      { label: 'SMS', icon: '📱', color: 'secondary' },
}

const FU_STATUS = {
  pending:   { label: 'รอติดตาม', color: 'warning' },
  done:      { label: 'ติดตามแล้ว', color: 'success' },
  skipped:   { label: 'ข้ามไป', color: 'secondary' },
  escalated: { label: 'Escalate', color: 'danger' },
}

const PURPOSES = ['หลังส่งมอบรถ', 'ตรวจสอบความพึงพอใจ', 'แจ้งบริการถึงกำหนด', 'เสนอต่ออายุประกัน', 'แนะนำรุ่นใหม่', 'กิจกรรม/โปรโมชัน', 'วันเกิด/เทศกาล', 'ทั่วไป']

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const today = new Date().toISOString().slice(0, 10)

export default async function FollowUpPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let tab = 'today'
  let typeFilter = 'all'
  let salespersonFilter = 'all'
  let followups = []
  let salespersons = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      const stored = await listDocs('followups', [], 'dueDate', 'asc', 300)
      let virtual = []
      try {
        const bookings = await listDocs('bookings', [], 'createdAt', 'desc', 200)
        const delivered = bookings.filter(b => b.status === 'ส่งมอบแล้ว')
        virtual = delivered
          .filter(b => !stored.some(s => s.sourceBookingId === b.id))
          .map(b => {
            const deliveryDate = b.actualDeliveryDate
              || (b.updatedAt?.toDate ? b.updatedAt.toDate().toISOString().slice(0, 10) : null)
              || today
            const dueDate = (() => {
              const d = new Date(deliveryDate); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10)
            })()
            return {
              id: 'FU-' + b.id, customerId: b.id, sourceBookingId: b.id,
              customerName: b.custName || 'ลูกค้า', phone: b.custPhone || '',
              vehicleModel: ((b.brand || '') + ' ' + (b.model || '')).trim() || 'รถ',
              salesperson: b.salesName || '', type: 'call',
              purpose: 'หลังส่งมอบรถ', dueDate,
              status: 'pending',
              note: 'ส่งมอบแล้ว ' + (deliveryDate || '') + ' — ตรวจสอบความพึงพอใจ 7 วัน',
              result: '', _source: 'booking',
            }
          })
      } catch (e) {}
      followups = [...stored, ...virtual]
    } catch (e) { followups = [] }
    salespersons = [...new Set(followups.map(f => f.salesperson).filter(Boolean))]
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function isOverdue(f) { return f.status === 'pending' && f.dueDate < today }
  function isToday(f) { return f.dueDate === today }
  function isUpcoming(f) { return f.status === 'pending' && f.dueDate > today }

  function getFiltered(subset) {
    return subset.filter(f => {
      if (typeFilter !== 'all' && f.type !== typeFilter) return false
      if (salespersonFilter !== 'all' && f.salesperson !== salespersonFilter) return false
      return true
    })
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const overdueList = followups.filter(f => isOverdue(f))
    const todayList = followups.filter(f => isToday(f) && f.status === 'pending')
    const upcomingList = followups.filter(f => isUpcoming(f))
    const doneList = followups.filter(f => f.status === 'done')

    let subset
    if (tab === 'today') subset = getFiltered([...overdueList, ...todayList])
    else if (tab === 'upcoming') subset = getFiltered(upcomingList)
    else if (tab === 'done') subset = getFiltered(doneList)
    else subset = getFiltered(followups)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📞 After-Sales Follow-up</div>
            <div class="page-subtitle">ติดตามหลังการขาย — รักษาความสัมพันธ์ลูกค้า</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-fu-btn">+ เพิ่ม Follow-up</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('🔴 เกินกำหนด', overdueList.length, 'danger')}
          ${kpi('📅 วันนี้', todayList.length, 'warning')}
          ${kpi('📆 กำลังมา', upcomingList.length, 'primary')}
          ${kpi('✅ ดำเนินการแล้ว', doneList.length, 'success')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-sm ${tab==='today'?'btn-primary':'btn-secondary'} tab-btn" data-t="today">🔥 วันนี้&เกินกำหนด ${overdueList.length+todayList.length > 0 ? `<span style="background:var(--danger);border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:0.68rem;margin-left:4px">${overdueList.length+todayList.length}</span>` : ''}</button>
          <button class="btn btn-sm ${tab==='upcoming'?'btn-primary':'btn-secondary'} tab-btn" data-t="upcoming">📆 กำลังมา</button>
          <button class="btn btn-sm ${tab==='all'?'btn-primary':'btn-secondary'} tab-btn" data-t="all">📋 ทั้งหมด</button>
          <button class="btn btn-sm ${tab==='done'?'btn-primary':'btn-secondary'} tab-btn" data-t="done">✅ ดำเนินการแล้ว</button>
        </div>

        <!-- Sub-filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} type-btn" data-t="all">ทั้งหมด</button>
            ${Object.entries(FOLLOWUP_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-primary':'btn-secondary'} type-btn" data-t="${k}">${v.icon}</button>`).join('')}
          </div>
          <select class="input" id="sales-filter" style="width:170px">
            <option value="all">เซลส์ทั้งหมด</option>
            ${salespersons.map(s => `<option value="${escHtml(s)}" ${salespersonFilter===s?'selected':''}>${escHtml(s)}</option>`).join('')}
          </select>
          <div style="margin-left:auto;font-size:0.82rem;color:var(--text-muted)">${subset.length} รายการ</div>
        </div>

        <!-- List -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${subset.map(f => renderCard(f)).join('')}
          ${!subset.length ? `<div class="empty-state"><div class="empty-state-icon">📞</div><div>ไม่มีรายการ Follow-up</div></div>` : ''}
        </div>
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('sales-filter')?.addEventListener('change', e => { salespersonFilter = e.target.value; renderPage() })
    document.getElementById('add-fu-btn')?.addEventListener('click', () => openFUForm(null))
    document.getElementById('export-btn')?.addEventListener('click', () => { exportToExcel(subset.map(f => ({ ID: f.id, ลูกค้า: f.customerName, รถ: f.vehicleModel, เซลส์: f.salesperson, ประเภท: FOLLOWUP_TYPES[f.type]?.label, วัตถุประสงค์: f.purpose, กำหนด: f.dueDate, สถานะ: FU_STATUS[f.status]?.label, ผลลัพธ์: f.result })), 'followup'); showToast('📥 Export แล้ว!', 'success') })
    document.querySelectorAll('.fu-done-btn').forEach(b => b.addEventListener('click', () => { const f = followups.find(x => x.id === b.dataset.id); if (f) openResultForm(f) }))
    document.querySelectorAll('.fu-skip-btn').forEach(b => b.addEventListener('click', async () => {
      const f = followups.find(x => x.id === b.dataset.id)
      if (!f) return
      try {
        if (f._source === 'booking') {
          const { _source, id, ...rest } = f
          await createDoc('followups', { ...rest, status: 'skipped' })
        } else {
          await updateDocData('followups', f.id, { status: 'skipped' })
        }
        showToast('⏭ ข้ามรายการนี้แล้ว', 'warning')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.querySelectorAll('.fu-detail-btn').forEach(b => b.addEventListener('click', () => { const f = followups.find(x => x.id === b.dataset.id); if (f) openFUDetail(f) }))
  }

  function renderCard(f) {
    const tp = FOLLOWUP_TYPES[f.type]
    const st = FU_STATUS[f.status]
    const overdue = isOverdue(f)
    const isT = isToday(f)
    const borderColor = overdue ? 'var(--danger)' : isT ? 'var(--warning)' : f.status === 'done' ? 'var(--success)' : 'var(--border)'

    return `<div class="card" style="padding:14px 16px;border-left:3px solid ${borderColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:1rem">${tp.icon}</span>
            <span style="font-weight:700;font-size:0.9rem">${escHtml(f.customerName)}</span>
            <span class="badge badge-${tp.color}" style="font-size:0.65rem">${tp.label}</span>
            <span class="badge badge-${st.color}" style="font-size:0.65rem">${st.label}</span>
            ${overdue ? `<span class="badge badge-danger" style="font-size:0.65rem">⚠️ เกินกำหนด</span>` : ''}
            ${isT && f.status === 'pending' ? `<span class="badge badge-warning" style="font-size:0.65rem">📅 วันนี้</span>` : ''}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(f.vehicleModel)} · ${escHtml(f.salesperson)} · ${escHtml(f.phone)}</div>
          <div style="font-size:0.82rem;margin-top:4px"><strong>${escHtml(f.purpose)}</strong>${f.note ? ` — ${escHtml(f.note)}` : ''}</div>
          ${f.result ? `<div style="font-size:0.8rem;margin-top:4px;color:var(--success)">✓ ${escHtml(f.result)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <div style="font-size:0.78rem;color:${overdue?'var(--danger)':'var(--text-muted)'}">${formatDate(f.dueDate)}</div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs btn-secondary fu-detail-btn" data-id="${f.id}">ดู</button>
            ${f.status === 'pending' ? `
              <button class="btn btn-xs btn-success fu-done-btn" data-id="${f.id}">✓ บันทึกผล</button>
              <button class="btn btn-xs btn-secondary fu-skip-btn" data-id="${f.id}">⏭</button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>`
  }

  function openResultForm(f) {
    openModal({
      title: '✓ บันทึกผล Follow-up — ' + escHtml(f.customerName),
      size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">
          <strong>${FOLLOWUP_TYPES[f.type]?.icon} ${f.purpose}</strong><br>
          <span style="color:var(--text-muted)">${escHtml(f.note)}</span>
        </div>
        <div class="input-group"><label class="input-label">ผลการติดต่อ *</label><textarea class="input" id="fu-result" rows="3" placeholder="บันทึกผลการติดต่อ เช่น ลูกค้าพอใจ รับทราบ นัดหมายครั้งถัดไป..."></textarea></div>
        <div class="input-group"><label class="input-label">Follow-up ครั้งถัดไป (ถ้ามี)</label><input type="date" class="input" id="fu-next"></div>
        <div class="input-group"><label class="input-label">วัตถุประสงค์ครั้งถัดไป</label>
          <select class="input" id="fu-next-purpose">
            <option value="">— ไม่มี —</option>
            ${PURPOSES.map(p => `<option>${p}</option>`).join('')}
          </select>
        </div>
      </div>`,
      async onConfirm() {
        const result = document.getElementById('fu-result')?.value?.trim()
        if (!result) { showToast('❗ กรุณากรอกผลการติดต่อ', 'error'); return false }
        const nextDate = document.getElementById('fu-next')?.value
        const nextPurpose = document.getElementById('fu-next-purpose')?.value
        try {
          if (f._source === 'booking') {
            const { _source, id, ...rest } = f
            await createDoc('followups', { ...rest, status: 'done', result })
          } else {
            await updateDocData('followups', f.id, { status: 'done', result })
          }
          if (nextDate && nextPurpose) {
            await createDoc('followups', { customerId: f.customerId, customerName: f.customerName, phone: f.phone, vehicleModel: f.vehicleModel, salesperson: f.salesperson, type: f.type, purpose: nextPurpose, dueDate: nextDate, status: 'pending', note: '', result: '' })
          }
          showToast('✅ บันทึกผล Follow-up แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openFUDetail(f) {
    const tp = FOLLOWUP_TYPES[f.type]
    const st = FU_STATUS[f.status]
    openModal({
      title: `📞 ${f.id} — Follow-up Detail`,
      size: 'md',
      body: `
        ${rowD('ลูกค้า', escHtml(f.customerName))}${rowD('โทร', escHtml(f.phone))}${rowD('รถ', escHtml(f.vehicleModel))}${rowD('เซลส์', escHtml(f.salesperson))}
        ${rowD('ประเภท', `${tp.icon} ${tp.label}`)}
        ${rowD('วัตถุประสงค์', escHtml(f.purpose))}
        ${rowD('กำหนดวันที่', formatDate(f.dueDate))}
        ${rowD('สถานะ', `<span class="badge badge-${st.color}">${st.label}</span>`)}
        ${f.note ? rowD('หมายเหตุ', escHtml(f.note)) : ''}
        ${f.result ? `<div style="margin-top:10px;padding:10px;background:rgba(34,197,94,.1);border-radius:var(--radius-sm);font-size:0.82rem;border-left:3px solid var(--success)"><strong>ผลลัพธ์:</strong> ${escHtml(f.result)}</div>` : ''}
      `,
      footer: f.status === 'pending' ? `<button class="btn btn-success fu-modal-done">✓ บันทึกผล</button>` : ''
    })
    setTimeout(() => { document.querySelector('.modal .fu-modal-done')?.addEventListener('click', () => { document.querySelector('.modal-close-btn')?.click(); openResultForm(f) }) }, 50)
  }

  function openFUForm(existing) {
    openModal({
      title: '+ เพิ่ม Follow-up ใหม่',
      size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="ff-name" placeholder="ชื่อลูกค้า"></div>
        <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="ff-phone" placeholder="08x-xxx-xxxx"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="ff-car" placeholder="เช่น BYD Seal AWD"></div>
        <div class="input-group"><label class="input-label">ประเภทการติดต่อ</label>
          <select class="input" id="ff-type">${Object.entries(FOLLOWUP_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">วัตถุประสงค์</label>
          <select class="input" id="ff-purpose">${PURPOSES.map(p=>`<option>${p}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">กำหนดวันที่</label><input type="date" class="input" id="ff-date" value="${today}"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="ff-note" rows="2"></textarea></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('ff-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return false }
        try {
          await createDoc('followups', { customerId: '', customerName: name, phone: document.getElementById('ff-phone')?.value||'', vehicleModel: document.getElementById('ff-car')?.value||'', salesperson: salespersons[0]||'', type: document.getElementById('ff-type')?.value, purpose: document.getElementById('ff-purpose')?.value, dueDate: document.getElementById('ff-date')?.value||today, status: 'pending', note: document.getElementById('ff-note')?.value||'', result: '' })
          showToast('✅ เพิ่ม Follow-up แล้ว!', 'success')
          tab = 'today'
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}

function rowD(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${label}</span><span>${value}</span></div>`
}
