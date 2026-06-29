import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, timeAgo, formatPhone, initials, fullName } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS = {
  new:        { label: '🆕 ใหม่',        badge: 'accent',  next: 'contacted' },
  contacted:  { label: '📞 ติดต่อแล้ว',  badge: 'primary', next: 'interested' },
  interested: { label: '💡 สนใจ',        badge: 'warning', next: 'qualified' },
  qualified:  { label: '⭐ Qualified',   badge: 'accent',  next: 'booking' },
  booking:    { label: '📝 จอง',         badge: 'success', next: null },
  lost:       { label: '❌ เสียดีล',     badge: 'danger',  next: null },
}

const SOURCE = {
  facebook:'📘 Facebook', line:'💚 LINE', tiktok:'🎵 TikTok',
  google:'🔍 Google', 'walk-in':'🚶 Walk-in', referral:'🤝 Referral',
  phone:'📱 โทรเข้า', website:'🌐 Website', other:'📌 อื่นๆ'
}

const DEMO_LEADS = [
  { id:'ld1', firstName:'ธีรพงศ์', lastName:'แสงทอง', phone:'0851234567', lineId:'@theer', email:'', source:'facebook', status:'new', interestedModel:'BYD Atto 3', budget:1200000, assignedTo:'sales1', notes:'ถามราคา Atto3 ผ่าน FB Inbox', createdAt: new Date(Date.now()-3600000*2).toISOString() },
  { id:'ld2', firstName:'อรนุช', lastName:'พรหมมา', phone:'0892345678', lineId:'', email:'ornuch@gmail.com', source:'line', status:'contacted', interestedModel:'MG4', budget:900000, assignedTo:'sales1', notes:'ส่งโบรชัวร์แล้ว นัดทดลองขับ', createdAt: new Date(Date.now()-86400000).toISOString() },
  { id:'ld3', firstName:'กิตติพงษ์', lastName:'วรรณศิลป์', phone:'0823456789', lineId:'@kitti', email:'', source:'tiktok', status:'interested', interestedModel:'DEEPAL S7', budget:1500000, assignedTo:'sales2', notes:'ดูคลิป TikTok แล้วสนใจมาก', createdAt: new Date(Date.now()-86400000*2).toISOString() },
  { id:'ld4', firstName:'พิมพ์ชนก', lastName:'ทองสุข', phone:'0834567890', lineId:'', email:'', source:'walk-in', status:'qualified', interestedModel:'BYD Seal', budget:1300000, assignedTo:'sales1', notes:'เข้ามาโชว์รูมเอง ทดลองขับแล้วชอบมาก', createdAt: new Date(Date.now()-86400000*3).toISOString() },
  { id:'ld5', firstName:'วรพจน์', lastName:'ศรีสมบัติ', phone:'0845678901', lineId:'@worapot', email:'', source:'referral', status:'lost', interestedModel:'NETA V', budget:700000, assignedTo:'sales2', notes:'เลือกไปซื้อที่อื่น ราคาถูกกว่า 5,000 บาท', lostReason:'ราคาแพงกว่าคู่แข่ง', createdAt: new Date(Date.now()-86400000*7).toISOString() },
  { id:'ld6', firstName:'สุภาพร', lastName:'ใจดี', phone:'0856789012', lineId:'@supaporn', email:'', source:'google', status:'new', interestedModel:'NETA V', budget:800000, assignedTo:'sales1', notes:'ค้นหาจาก Google แล้ว fill form', createdAt: new Date(Date.now()-3600000*5).toISOString() },
]

export default async function LeadsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let leads = []
  let filtered = []
  let statusFilter = 'all'
  let search = ''
  let sortBy = 'createdAt'

  async function loadData() {
    try { leads = await listDocs('leads', [], 'createdAt', 'desc', 500) } catch {}
    if (!leads.length) DEMO_LEADS.forEach(l => leads.push({...l}))
    updateStats()
    applyFilter()
  }

  function updateStats() {
    Object.keys(STATUS).forEach(k => {
      const el = document.getElementById(`stat-${k}`)
      if (el) el.textContent = leads.filter(l => l.status === k).length
    })
    const total = document.getElementById('lead-count')
    if (total) total.textContent = `${leads.length} Lead ทั้งหมด`
  }

  function applyFilter() {
    filtered = leads.filter(l => {
      const name = fullName(l).toLowerCase()
      const ms = statusFilter === 'all' || l.status === statusFilter
      const ss = !search || name.includes(search) || (l.phone||'').includes(search) || (l.interestedModel||'').toLowerCase().includes(search)
      return ms && ss
    })
    filtered.sort((a,b) => sortBy === 'budget' ? (b.budget||0)-(a.budget||0) : new Date(b.createdAt)-new Date(a.createdAt))
    renderTable()
  }

  function renderTable() {
    const tbody = document.getElementById('lead-tbody')
    if (!tbody) return
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🧲</div><div class="empty-title">ไม่พบ Lead</div><div class="empty-desc">${search ? 'ลองเปลี่ยนคำค้นหา' : 'เพิ่ม Lead แรกได้เลย'}</div></div></td></tr>`
      return
    }
    tbody.innerHTML = filtered.map(l => {
      const st = STATUS[l.status] || { label:l.status, badge:'primary' }
      return `
        <tr class="lead-row" data-id="${l.id}" style="cursor:pointer">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="avatar avatar-sm" style="background:var(--${st.badge}-dim);color:var(--${st.badge})">${escHtml(initials(l.firstName,l.lastName))}</div>
              <div>
                <div style="font-weight:600;color:var(--text)">${escHtml(fullName(l))}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">${SOURCE[l.source] || escHtml(l.source) || '-'}</div>
              </div>
            </div>
          </td>
          <td style="font-size:0.85rem">${formatPhone(l.phone)}</td>
          <td><span class="badge badge-${st.badge}">${st.label}</span></td>
          <td style="color:var(--text-2);font-size:0.85rem">${escHtml(l.interestedModel||'-')}</td>
          <td style="color:var(--accent);font-weight:600;font-size:0.85rem">${l.budget ? '฿'+Number(l.budget).toLocaleString() : '-'}</td>
          <td style="color:var(--text-muted);font-size:0.78rem">${escHtml(l.assignedTo||'-')}</td>
          <td style="font-size:0.78rem;color:var(--text-2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(l.notes||'')}">${escHtml(l.notes||'-')}</td>
          <td style="color:var(--text-muted);font-size:0.78rem">${timeAgo(l.createdAt)}</td>
          <td>
            <div style="display:flex;gap:3px;align-items:center">
              ${STATUS[l.status]?.next ? `<button class="btn btn-primary btn-sm next-btn" data-id="${l.id}" style="font-size:0.7rem;padding:3px 6px" title="เลื่อนสถานะ">→ ${STATUS[STATUS[l.status].next]?.label.split(' ').slice(1).join(' ')}</button>` : ''}
              <button class="btn btn-ghost btn-sm edit-btn" data-id="${l.id}" title="แก้ไข">✏️</button>
              <button class="btn btn-ghost btn-sm del-btn" data-id="${l.id}" title="ลบ" style="color:var(--danger)">🗑</button>
            </div>
          </td>
        </tr>`
    }).join('')

    tbody.querySelectorAll('.lead-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.edit-btn,.del-btn,.next-btn')) return
        openDetail(leads.find(x => x.id === row.dataset.id))
      })
    })
    tbody.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openForm(leads.find(x => x.id === btn.dataset.id))))
    tbody.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', async () => {
      const l = leads.find(x => x.id === btn.dataset.id)
      if (!await confirmDialog({ title:'ลบ Lead', message:`ลบ "${fullName(l)}"?`, confirmText:'ลบ', danger:true })) return
      try {
        await softDelete('leads', btn.dataset.id)
        leads = leads.filter(x => x.id !== btn.dataset.id)
        showToast('ลบแล้ว','success'); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
    tbody.querySelectorAll('.next-btn').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const l = leads.find(x => x.id === btn.dataset.id)
      if (!l) return
      const next = STATUS[l.status]?.next
      if (!next) return
      try {
        await updateDocData('leads', l.id, { status: next })
        l.status = next
        showToast(`✅ เลื่อนเป็น ${STATUS[next]?.label}`, 'success')
        updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
  }

  function openDetail(l) {
    if (!l) return
    const st = STATUS[l.status] || { label:l.status, badge:'primary' }
    const { el, close } = openModal({
      title: '🧲 ' + escHtml(fullName(l)),
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;align-items:center;gap:14px">
            <div class="avatar avatar-xl" style="background:var(--${st.badge}-dim);color:var(--${st.badge});font-size:1.4rem">${escHtml(initials(l.firstName,l.lastName))}</div>
            <div>
              <div style="font-size:1.15rem;font-weight:700">${escHtml(fullName(l))}</div>
              <span class="badge badge-${st.badge}" style="margin-top:4px">${st.label}</span>
            </div>
          </div>
          <div class="grid-2" style="gap:8px">
            ${row2('📱','โทร',formatPhone(l.phone))}
            ${row2('💚','LINE',l.lineId||'-')}
            ${row2('📧','Email',l.email||'-')}
            ${row2('🚗','รถที่สนใจ',l.interestedModel||'-')}
            ${row2('💰','Budget','฿'+Number(l.budget||0).toLocaleString())}
            ${row2('📌','ที่มา',SOURCE[l.source]||l.source||'-')}
            ${row2('👤','มอบหมาย',l.assignedTo||'-')}
            ${row2('📅','วันที่',formatDate(l.createdAt))}
          </div>
          ${l.notes ? `<div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-md);font-size:0.85rem;color:var(--text-2)">📝 ${escHtml(l.notes)}</div>` : ''}
          ${l.lostReason ? `<div style="background:var(--danger-dim);padding:10px 12px;border-radius:var(--radius-md);font-size:0.85rem;color:var(--danger)">❌ เหตุผล: ${escHtml(l.lostReason)}</div>` : ''}

          <!-- Action buttons -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px">
            ${STATUS[l.status]?.next ? `<button class="btn btn-primary btn-sm" id="dd-next">➡️ เลื่อนสถานะ</button>` : ''}
            <button class="btn btn-secondary btn-sm" id="dd-convert">🚀 แปลงเป็นลูกค้า</button>
            <button class="btn btn-ghost btn-sm" id="dd-booking">📝 สร้างใบจอง</button>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="dd-close">ปิด</button><button class="btn btn-primary" id="dd-edit">✏️ แก้ไข</button>`
    })
    el.querySelector('#dd-close').addEventListener('click', close)
    el.querySelector('#dd-edit').addEventListener('click', () => { close(); openForm(l) })
    el.querySelector('#dd-next')?.addEventListener('click', async () => {
      const next = STATUS[l.status]?.next
      if (!next) return
      try {
        await updateDocData('leads', l.id, { status: next })
        l.status = next
        showToast(`✅ เลื่อนเป็น ${STATUS[next]?.label}`, 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
    el.querySelector('#dd-convert').addEventListener('click', async () => {
      try {
        await createDoc('customers', { firstName:l.firstName, lastName:l.lastName, phone:l.phone, lineId:l.lineId||'', email:l.email||'', interestedModel:l.interestedModel||'', status:'hot', source:l.source||'other', tags:[], fromLeadId:l.id })
        await updateDocData('leads', l.id, { status:'booking', convertedToCustomer:true })
        l.status = 'booking'; l.convertedToCustomer = true
        showToast(`🎉 แปลง ${fullName(l)} เป็นลูกค้าแล้ว`, 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
    el.querySelector('#dd-booking').addEventListener('click', () => {
      close()
      openModal({
        title: `📝 สร้างใบจอง — ${fullName(l)}`,
        size: 'sm',
        body: `
          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
            <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่นรถ</label>
              <input class="input" id="bk-model" value="${escHtml(l.interestedModel||'')}" placeholder="เช่น BYD Seal AWD" style="width:100%;margin-top:4px"></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">เงินจอง (บาท)</label>
              <input class="input" id="bk-deposit" type="number" placeholder="5000" style="width:100%;margin-top:4px"></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่ส่งมอบ (โดยประมาณ)</label>
              <input class="input" id="bk-delivery" type="date" value="2026-07-31" style="width:100%;margin-top:4px"></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">หมายเหตุ</label>
              <input class="input" id="bk-note" placeholder="เงื่อนไขพิเศษ..." style="width:100%;margin-top:4px"></div>
          </div>
        `,
        confirmText: '📝 สร้างใบจอง',
        async onConfirm() {
          const model    = document.getElementById('bk-model')?.value?.trim()
          const deposit  = parseInt(document.getElementById('bk-deposit')?.value) || 0
          const delivery = document.getElementById('bk-delivery')?.value
          if (!model) { showToast('ระบุรุ่นรถ', 'warning'); return false }
          try {
            await updateDocData('leads', l.id, { status: 'booking', depositAmount: deposit, deliveryDate: delivery })
            l.status = 'booking'
            showToast(`📝 สร้างใบจอง ${fullName(l)} — ${model} เงินจอง ฿${deposit.toLocaleString()} แล้ว`, 'success')
            updateStats(); applyFilter()
          } catch { showToast('เกิดข้อผิดพลาด','error') }
        }
      })
    })
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const { el, close } = openModal({
      title: isEdit ? `✏️ แก้ไข ${fullName(existing)}` : '➕ เพิ่ม Lead ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อ <span class="required">*</span></label><input class="input" id="lf-fn" value="${escHtml(existing?.firstName||'')}" placeholder="ชื่อ"><span class="input-error" id="lf-fn-e"></span></div>
            <div class="input-group"><label class="input-label">นามสกุล <span class="required">*</span></label><input class="input" id="lf-ln" value="${escHtml(existing?.lastName||'')}" placeholder="นามสกุล"><span class="input-error" id="lf-ln-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">โทรศัพท์ <span class="required">*</span></label><input class="input" id="lf-ph" value="${escHtml(existing?.phone||'')}" placeholder="0812345678"><span class="input-error" id="lf-ph-e"></span></div>
            <div class="input-group"><label class="input-label">LINE ID</label><input class="input" id="lf-li" value="${escHtml(existing?.lineId||'')}" placeholder="@lineid"></div>
          </div>
          <div class="input-group"><label class="input-label">Email</label><input class="input" type="email" id="lf-em" value="${escHtml(existing?.email||'')}" placeholder="email@example.com"></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">รถที่สนใจ</label><input class="input" id="lf-mo" value="${escHtml(existing?.interestedModel||'')}" placeholder="เช่น BYD Seal"></div>
            <div class="input-group"><label class="input-label">Budget (บาท)</label><input class="input" type="number" id="lf-bu" value="${existing?.budget||''}" placeholder="1000000"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ที่มา</label><select class="input" id="lf-so">${Object.entries(SOURCE).map(([k,v])=>`<option value="${k}" ${existing?.source===k?'selected':''}>${v}</option>`).join('')}</select></div>
            <div class="input-group"><label class="input-label">สถานะ</label><select class="input" id="lf-st">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${(existing?.status||'new')===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
          </div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="lf-no" rows="2" placeholder="บันทึกข้อมูลเพิ่มเติม...">${escHtml(existing?.notes||'')}</textarea></div>
          <div class="input-group" id="lost-reason-group" style="display:${existing?.status==='lost'?'':'none'}">
            <label class="input-label">เหตุผลที่เสียดีล</label>
            <input class="input" id="lf-lr" value="${escHtml(existing?.lostReason||'')}" placeholder="ราคา / คู่แข่ง / ไฟแนนซ์ไม่ผ่าน...">
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="lf-cancel">ยกเลิก</button><button class="btn btn-primary" id="lf-save">💾 บันทึก</button>`
    })

    el.querySelector('#lf-st').addEventListener('change', e => {
      el.querySelector('#lost-reason-group').style.display = e.target.value === 'lost' ? '' : 'none'
    })
    el.querySelector('#lf-cancel').addEventListener('click', close)
    el.querySelector('#lf-save').addEventListener('click', async () => {
      const fn = el.querySelector('#lf-fn').value.trim()
      const ln = el.querySelector('#lf-ln').value.trim()
      const ph = el.querySelector('#lf-ph').value.trim()
      let ok = true
      if (!fn) { el.querySelector('#lf-fn-e').textContent = 'กรุณาระบุ'; ok = false }
      if (!ln) { el.querySelector('#lf-ln-e').textContent = 'กรุณาระบุ'; ok = false }
      if (!ph) { el.querySelector('#lf-ph-e').textContent = 'กรุณาระบุ'; ok = false }
      if (!ok) return
      const btn = el.querySelector('#lf-save'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        firstName: fn, lastName: ln, phone: ph,
        lineId: el.querySelector('#lf-li').value.trim(),
        email: el.querySelector('#lf-em').value.trim(),
        interestedModel: el.querySelector('#lf-mo').value.trim(),
        budget: Number(el.querySelector('#lf-bu').value) || 0,
        source: el.querySelector('#lf-so').value,
        status: el.querySelector('#lf-st').value,
        notes: el.querySelector('#lf-no').value.trim(),
        lostReason: el.querySelector('#lf-lr')?.value.trim() || '',
      }
      try {
        if (isEdit) { await updateDocData('leads', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('leads', data); leads.unshift({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่ม Lead แล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  // ── Page HTML ─────────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🧲 Lead Management</div>
          <div class="page-subtitle" id="lead-count">กำลังโหลด...</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="lead-pipeline-btn">📋 Pipeline View</button>
          <button class="btn btn-secondary btn-sm" id="lead-export-btn">📥 Export</button>
          <button class="btn btn-primary" id="lead-add-btn">➕ เพิ่ม Lead</button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px">
        ${Object.entries(STATUS).map(([k,v]) => `
          <div class="card stat-pill" data-s="${k}" style="padding:10px 12px;text-align:center;cursor:pointer;transition:all 150ms">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">${v.label}</div>
            <div id="stat-${k}" style="font-size:1.5rem;font-weight:800;color:var(--${v.badge})">0</div>
          </div>
        `).join('')}
      </div>

      <!-- Filter -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div style="position:relative;flex:1;min-width:200px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="lead-search" placeholder="ค้นหาชื่อ เบอร์ รถที่สนใจ..." style="padding-left:32px">
          </div>
          <select class="input" id="lead-sort" style="width:160px">
            <option value="createdAt">เรียง: ล่าสุดก่อน</option>
            <option value="budget">เรียง: Budget สูงสุด</option>
          </select>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button class="btn btn-sm sf-lead btn-primary" data-s="all">ทั้งหมด</button>
            ${Object.entries(STATUS).map(([k,v]) => `<button class="btn btn-sm sf-lead btn-secondary" data-s="${k}">${v.label}</button>`).join('')}
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Lead</th><th>โทร</th><th>สถานะ</th><th>รถที่สนใจ</th>
            <th>Budget</th><th>มอบหมาย</th><th>หมายเหตุ</th><th>เมื่อ</th><th></th>
          </tr></thead>
          <tbody id="lead-tbody">
            ${[...Array(5)].map(() => `<tr>${[...Array(9)].map(() => `<td><div class="skeleton" style="height:14px;border-radius:4px"></div></td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `

  if (!document.getElementById('lead-style')) {
    const s = document.createElement('style')
    s.id = 'lead-style'
    s.textContent = `.lead-row:hover td{background:var(--surface-2)}.stat-pill:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.3)}`
    document.head.appendChild(s)
  }

  document.getElementById('lead-add-btn').addEventListener('click', () => openForm())
  document.getElementById('lead-export-btn').addEventListener('click', () => {
    if (!leads.length) { showToast('ไม่มีข้อมูล','warning'); return }
    exportToExcel(leads.map(l => ({ ชื่อ:l.firstName, นามสกุล:l.lastName, โทร:l.phone, LINE:l.lineId, รถที่สนใจ:l.interestedModel, Budget:l.budget, สถานะ:STATUS[l.status]?.label||l.status, ที่มา:SOURCE[l.source]||l.source, หมายเหตุ:l.notes, วันที่:formatDate(l.createdAt) })), `leads-${new Date().toISOString().slice(0,10)}.xlsx`, 'Lead')
    showToast('Export แล้ว', 'success')
  })
  document.getElementById('lead-pipeline-btn').addEventListener('click', () => navigate('/crm/pipeline'))
  document.getElementById('lead-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('lead-sort').addEventListener('change', e => { sortBy = e.target.value; applyFilter() })
  document.querySelectorAll('.sf-lead').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.s
    document.querySelectorAll('.sf-lead').forEach(b => b.className = `btn btn-sm sf-lead ${b.dataset.s === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))
  document.querySelectorAll('.stat-pill').forEach(card => card.addEventListener('click', () => {
    statusFilter = card.dataset.s
    document.querySelectorAll('.sf-lead').forEach(b => b.className = `btn btn-sm sf-lead ${b.dataset.s === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))

  if (container.__routerGen === myGen) await loadData()
}

function row2(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px;align-items:flex-start"><span>${icon}</span><span style="color:var(--text-muted);min-width:72px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${escHtml(String(value ?? ''))}</span></div>`
}
