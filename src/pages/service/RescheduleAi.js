/**
 * Appointment Rescheduler AI — AI จัดตารางนัดใหม่อัตโนมัติเมื่อมีการยกเลิก
 * Route: /service/reschedule-ai
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

const SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30']

const ST = {
  confirmed:  { label:'ยืนยันแล้ว', color:'var(--success)' },
  cancelled:  { label:'ยกเลิก',     color:'var(--danger)'  },
  waitlist:   { label:'Waitlist',   color:'var(--warning)' },
  rescheduled:{ label:'นัดใหม่ (AI)', color:'var(--primary)' },
}

export default async function RescheduleAiPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let filterDate = 'all'
  let APPTS = []
  let loading = true

  async function loadData() {
    loading = true
    try { APPTS = await listDocs('reschedule_appointments', [], 'date', 'asc', 500) } catch (e) { APPTS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const cancelled = APPTS.filter(a => a.status === 'cancelled').length
    const waitlist  = APPTS.filter(a => a.status === 'waitlist').length
    const rows = filterDate === 'all' ? APPTS : APPTS.filter(a => a.date === filterDate)
    const dates = [...new Set(APPTS.map(a => a.date))].sort()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 Appointment Rescheduler AI</div>
            <div class="page-subtitle">AI จัดตารางนัดใหม่อัตโนมัติ · ${cancelled} ยกเลิก · ${waitlist} Waitlist รอสล็อต</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="ai-run-btn">⚡ AI จัดใหม่ทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📅 นัดทั้งหมด', APPTS.length, 'var(--primary)')}
          ${sc('✅ ยืนยัน', APPTS.filter(a=>a.status==='confirmed').length, 'var(--success)')}
          ${sc('❌ ยกเลิก', cancelled, 'var(--danger)')}
          ${sc('⏳ Waitlist', waitlist, 'var(--warning)')}
        </div>

        <!-- Date filter -->
        <div style="display:flex;gap:6px;margin-bottom:12px">
          <button class="btn btn-xs ${filterDate==='all'?'btn-primary':'btn-secondary'} date-btn" data-d="all">ทุกวัน</button>
          ${dates.map(d=>`<button class="btn btn-xs ${filterDate===d?'btn-primary':'btn-secondary'} date-btn" data-d="${d}">${formatDate(d)}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${rows.map(a => apptCard(a)).join('')}
        </div>

        <!-- AI suggestion panel -->
        ${cancelled > 0 || waitlist > 0 ? `
        <div class="card" style="padding:14px;margin-top:14px;border:2px solid var(--primary)44;background:var(--primary)08">
          <div style="font-size:0.78rem;font-weight:700;color:var(--primary);margin-bottom:8px">🤖 AI แนะนำ</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">
            พบ <b>${cancelled} ช่อง</b> ที่ยกเลิก และ <b>${waitlist} คน</b> ใน Waitlist —
            AI สามารถเลื่อน Waitlist เข้าช่องที่ว่างอัตโนมัติ
          </div>
          <button class="btn btn-primary" id="ai-match-btn" style="margin-top:10px;font-size:0.8rem">⚡ จับคู่และแจ้งลูกค้า</button>
        </div>` : ''}
      </div>`

    container.querySelectorAll('.date-btn').forEach(b => b.addEventListener('click', () => { filterDate = b.dataset.d; render() }))
    document.getElementById('ai-run-btn')?.addEventListener('click', () => runAiReschedule())
    document.getElementById('ai-match-btn')?.addEventListener('click', () => runAiReschedule())
    container.querySelectorAll('.cancel-btn').forEach(b => b.addEventListener('click', async () => {
      const a = APPTS.find(x => x.id === b.dataset.id)
      if (!a) return
      try {
        await updateDocData('reschedule_appointments', a.id, { status: 'cancelled' })
        showToast(`❌ ยกเลิกนัด ${a.customer} แล้ว · AI จะหาสล็อตใหม่`, 'warning')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.reschedule-btn').forEach(b => b.addEventListener('click', () => {
      const a = APPTS.find(x => x.id === b.dataset.id)
      if (a) openRescheduleModal(a)
    }))
    container.querySelectorAll('.confirm-ai-btn').forEach(b => b.addEventListener('click', async () => {
      const a = APPTS.find(x => x.id === b.dataset.id)
      if (!a) return
      try {
        await updateDocData('reschedule_appointments', a.id, { status: 'confirmed', aiSuggested: false })
        showToast(`✅ ยืนยันนัดใหม่ของ ${a.customer} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function apptCard(a) {
    const s = ST[a.status]
    return `
      <div class="card" style="padding:14px;border-left:4px solid ${s.color}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-weight:700;font-size:0.86rem">${a.customer}</span>
              <span style="font-size:0.64rem;background:${s.color};color:#fff;padding:2px 8px;border-radius:10px">${s.label}</span>
              ${a.aiSuggested ? '<span style="font-size:0.62rem;background:var(--primary);color:#fff;padding:2px 7px;border-radius:10px">🤖 AI แนะนำ</span>' : ''}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${a.model} · ${a.service}</div>
            <div style="font-size:0.76rem;margin-top:4px">📅 ${formatDate(a.date)} · ⏰ ${a.slot} · 🏗 Bay ${a.bay}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${a.status==='confirmed' ? `<button class="btn btn-xs btn-secondary cancel-btn" data-id="${a.id}" style="font-size:0.7rem;color:var(--danger)">ยกเลิก</button>` : ''}
            ${a.status==='cancelled'||a.status==='waitlist' ? `<button class="btn btn-xs btn-secondary reschedule-btn" data-id="${a.id}" style="font-size:0.7rem">📅 นัดใหม่</button>` : ''}
            ${a.aiSuggested ? `<button class="btn btn-xs btn-primary confirm-ai-btn" data-id="${a.id}" style="font-size:0.7rem">✅ ยืนยัน</button>` : ''}
          </div>
        </div>
      </div>`
  }

  async function runAiReschedule() {
    const waitlist = APPTS.filter(a => a.status==='waitlist')
    const cancelled = [...APPTS.filter(a => a.status==='cancelled')]
    const updates = []
    waitlist.forEach(w => {
      const slot = cancelled.shift()
      if (slot) {
        updates.push(updateDocData('reschedule_appointments', w.id, { date: slot.date, slot: slot.slot, bay: slot.bay, status: 'rescheduled', aiSuggested: true }))
      }
    })
    try {
      await Promise.all(updates)
      if (updates.length > 0) showToast(`🤖 AI จัดนัดใหม่ ${updates.length} คน · รอยืนยัน`, 'success')
      else showToast('✅ ไม่มีนัดที่ต้องจัดใหม่', 'success')
      await loadData()
    } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
  }

  function openRescheduleModal(a) {
    openModal({
      title: `📅 นัดใหม่ — ${a.customer}`, size:'sm',
      body: `<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
        <div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm);font-size:0.76rem">
          ${a.model} · ${a.service}<br>
          <span style="color:var(--text-muted)">เดิม: ${formatDate(a.date)} ${a.slot}</span>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่ใหม่</label>
          <input class="input" id="new-date" type="date" value="${new Date(Date.now()+86400000*3).toISOString().slice(0,10)}" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เวลา</label>
          <select class="input" id="new-slot" style="width:100%;margin-top:4px">
            ${SLOTS.map(s=>`<option>${s}</option>`).join('')}
          </select></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">Bay</label>
          <select class="input" id="new-bay" style="width:100%;margin-top:4px">
            ${[1,2,3,4,5].map(b=>`<option>${b}</option>`).join('')}
          </select></div>
      </div>`,
      confirmText:'✅ ยืนยันนัดใหม่',
      async onConfirm() {
        const date = document.getElementById('new-date')?.value || a.date
        const slot = document.getElementById('new-slot')?.value || a.slot
        const bay  = parseInt(document.getElementById('new-bay')?.value) || a.bay
        try {
          await updateDocData('reschedule_appointments', a.id, { date, slot, bay, status: 'confirmed', aiSuggested: false })
          showToast(`✅ นัดใหม่ ${a.customer} → ${formatDate(date)} ${slot} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
