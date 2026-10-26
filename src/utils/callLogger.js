// "โทรเสร็จแล้วบันทึกผลทันที" — กดปุ่ม 📞 โทร บนมือถือ แอปจะถูกพักไว้ระหว่างคุย พอกลับมาที่แอป
// ระบบถามผลการโทรด้วยปุ่มเดียว (สนใจ / ขอคิดก่อน / ไม่รับสาย / ไม่สนใจ) แล้วบันทึกลงไทม์ไลน์ลูกค้า + นัดครั้งถัดไปให้
import { createDoc } from '../core/db.js'
import { getState, showToast } from '../core/store.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { openModal } from './modal.js'
import { touchCustomerContact } from './customerContact.js'
import { offerNextFollowup } from './addFollowupModal.js'

export const CALL_OUTCOMES = [
  { k: 'interested', label: '😊 คุยแล้ว สนใจ', contacted: true, next: '' },
  { k: 'thinking', label: '🤔 ขอคิดดูก่อน', contacted: true, next: '' },
  { k: 'noanswer', label: '📵 ไม่รับสาย', contacted: false, next: 'โทรใหม่พรุ่งนี้' },
  { k: 'notinterested', label: '🙅 ไม่สนใจ', contacted: true, next: 'ไม่สนใจ' },
]
const MIN_MS = 4000          // กลับมาเร็วกว่านี้ = ยังไม่ได้โทรจริง (กดผิด/ยกเลิก)
const MAX_MS = 2 * 3600e3    // ทิ้งไว้นานเกินนี้ไม่ถามแล้ว

// ข้อความที่บันทึกลงไทม์ไลน์ + ข้อความที่ใช้เดาวันนัดถัดไป
export function callLogText(outcomeKey, note = '') {
  const o = CALL_OUTCOMES.find(x => x.k === outcomeKey) || CALL_OUTCOMES[0]
  const n = String(note || '').trim()
  return { log: `${o.label.replace(/^\S+\s/, '')}${n ? ` — ${n}` : ''}`, nextHint: `${n} ${o.next}`.trim(), contacted: o.contacted }
}

export function shouldAsk(pending, now) {
  return !!pending && now - pending.at >= MIN_MS && now - pending.at <= MAX_MS
}

let pending = null
let listening = false
function onVisible() {
  if (document.visibilityState !== 'visible' || !pending) return
  const p = pending
  if (!shouldAsk(p, Date.now())) { if (Date.now() - p.at > MAX_MS) pending = null; return }
  pending = null
  askOutcome(p)
}

// เรียกตอนกดปุ่มโทร — customer = เอกสารลูกค้า (ต้องมี id) — hasPending() = ลูกค้ามีนัดค้างอื่นอยู่แล้วหรือไม่
export function armCallLog(customer, { hasPending = () => false, onSaved } = {}) {
  if (!customer?.id) return
  pending = { customer, hasPending, onSaved, at: Date.now() }
  if (!listening) { document.addEventListener('visibilitychange', onVisible); listening = true }
}

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

function askOutcome({ customer: c, hasPending, onSaved }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || c.customerName || 'ลูกค้า'
  let choice = ''
  const { el, close } = openModal({
    title: `📞 โทรหา ${escHtml(name)} เป็นยังไงบ้าง?`, size: 'sm',
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" data-keep>
        ${CALL_OUTCOMES.map(o => `<button type="button" class="btn btn-secondary cl-o" data-k="${o.k}" style="padding:12px 8px">${o.label}</button>`).join('')}
      </div>
      <textarea class="input" id="cl-note" data-mic rows="2" style="margin-top:10px;width:100%;font-size:16px" placeholder="รายละเอียดเพิ่ม (ไม่บังคับ) เช่น นัดทดลองขับเสาร์นี้"></textarea>`,
    footer: `<button class="btn btn-secondary" id="cl-skip">ข้าม</button><button class="btn btn-primary" id="cl-save" disabled>💾 บันทึก</button>`,
  })
  el.querySelectorAll('.cl-o').forEach(b => b.addEventListener('click', () => {
    choice = b.dataset.k
    el.querySelectorAll('.cl-o').forEach(x => { x.className = `btn ${x.dataset.k === choice ? 'btn-primary' : 'btn-secondary'} cl-o` })
    el.querySelector('#cl-save').disabled = false
  }))
  el.querySelector('#cl-skip').addEventListener('click', close)
  el.querySelector('#cl-save').addEventListener('click', async () => {
    if (!choice) return
    const t = callLogText(choice, el.querySelector('#cl-note').value)
    const me = getState('user') || {}
    el.querySelector('#cl-save').disabled = true
    try {
      await createDoc('comm_logs', { customerId: c.id, type: 'call', note: t.log, createdBy: me.displayName || me.email || me.uid || '', companyId: c.companyId ?? myEffectiveCompanyId() })
      if (t.contacted) { await touchCustomerContact(c.id); c.lastContactAt = new Date().toISOString() }
      close(); showToast('✅ บันทึกผลการโทรแล้ว', 'success')
      onSaved?.(t)
      offerNextFollowup(c, t.nextHint, { me: me.displayName || '', hasPending: hasPending(), onSaved })
    } catch { showToast('บันทึกไม่สำเร็จ', 'error'); el.querySelector('#cl-save').disabled = false }
  })
}
