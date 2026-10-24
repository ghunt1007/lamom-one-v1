// หน้าต่าง "➕ นัดติดตาม" ใช้ร่วมกันระหว่างหน้ารายละเอียดลูกค้า (Customers.js) และหน้างานของฉันวันนี้ (MyDay.js)
import { createDoc } from '../core/db.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { showToast } from '../core/store.js'
import { openModal } from './modal.js'
import { formatDate, todayBangkok } from './format.js'
import { addDays, buildManualFollowup, FOLLOWUP_PURPOSES } from './customerFollowups.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// c = ลูกค้า (ต้องมี id) — me = ชื่อผู้กด (ใช้เป็นผู้ติดตามถ้าลูกค้ายังไม่มีผู้ดูแล) — onSaved(followup) หลังบันทึกสำเร็จ
export function openAddFollowup(c, { me = '', onSaved } = {}) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || 'ลูกค้า'
  const defPurpose = c.stage === 'lead' || c.stage === 'pp' ? 'ติดตาม Lead ใหม่' : 'ทั่วไป'
  openModal({
    title: `➕ นัดติดตาม ${escHtml(name)}`, size: 'sm',
    body: `
      <div class="input-group"><label class="input-label">วันที่นัด *</label><input class="input" type="date" id="wk-nf-date" value="${addDays(todayBangkok(), 1)}"></div>
      <div class="input-group"><label class="input-label">เรื่อง</label><select class="input" id="wk-nf-purpose">${FOLLOWUP_PURPOSES.map(p => `<option${p === defPurpose ? ' selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="input-group"><label class="input-label">ช่องทาง</label><select class="input" id="wk-nf-type"><option value="call">📞 โทร</option><option value="line">💚 LINE</option><option value="visit">🏠 นัดพบ</option></select></div>
      <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="wk-nf-note" placeholder="เช่น โทรหลังเที่ยง"></div>
    `,
    async onConfirm() {
      const dueDate = document.getElementById('wk-nf-date')?.value
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || '')) { showToast('❗ กรุณาเลือกวันที่', 'error'); return false }
      const f = buildManualFollowup(c, {
        dueDate, purpose: document.getElementById('wk-nf-purpose')?.value, type: document.getElementById('wk-nf-type')?.value,
        note: document.getElementById('wk-nf-note')?.value, me,
      })
      try {
        const doc = { ...f, companyId: c.companyId ?? myEffectiveCompanyId() }
        const id = await createDoc('followups', doc)
        showToast(`📅 นัดติดตามวันที่ ${formatDate(dueDate)} แล้ว`, 'success'); onSaved?.({ ...doc, id })
      } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
    },
  })
}
