// (2026-11-02) ปุ่มเดียว "📄 เอกสาร" ในใบจอง — พิมพ์เอกสารทุกแบบจากข้อมูลใบจอง + แนบไฟล์เอกสารจริง (สแกน/รูป/PDF)
import { openModal } from './modal.js'
import { showToast, getState } from '../core/store.js'
import { updateDocData, readDoc } from '../core/db.js'
import { uploadFile } from './storage.js'
import { printBooking } from './bookingDocs.js'
import { openSaleEditor } from './saleEditor.js'
import {
  printJobOrder, printContract, printContractAttachment, printExpenseNotice, printDeliveryNote,
  printRegistrationIntent, printCommissionSheet, printWithdrawRequest,
} from './dealerForms.js'

// (2026-11-02) แบบฟอร์มตามตัวอย่างจริงของโชว์รูม เรียงตามขั้นตอนการขาย — print(b, company)
export const BOOKING_PRINTS = [
  { key: 'booking', icon: '📝', label: 'ใบจอง', print: b => printBooking(b) },
  { key: 'joborder', icon: '🎨', label: 'ใบสั่งแต่ง (Job Order)', print: printJobOrder },
  { key: 'contract', icon: '📜', label: 'สัญญาซื้อขาย', print: printContract },
  { key: 'attachment', icon: '📎', label: 'แนบท้ายสัญญา', print: printContractAttachment },
  { key: 'expense', icon: '💵', label: 'แจ้งค่าใช้จ่าย', print: printExpenseNotice },
  { key: 'registration', icon: '🪪', label: 'แจ้งจดทะเบียน', print: printRegistrationIntent },
  { key: 'delivery', icon: '🚗', label: 'ใบส่งมอบรถ', print: printDeliveryNote },
  { key: 'commission', icon: '💰', label: 'ใบค่าคอม', print: printCommissionSheet },
  { key: 'withdraw', icon: '❌', label: 'ใบขอยกเลิกจอง', print: null }, // ถามเหตุผลก่อน
]

// ข้อมูลบริษัทของใบจอง (หัวกระดาษ/บัญชี/ผู้ลงนาม) — ไม่มีก็พิมพ์ได้ เว้นช่องไว้
async function companyFor(b) {
  if (!b?.companyId) return {}
  try { return (await readDoc('org_companies', b.companyId)) || {} } catch { return {} }
}

export const MAX_FILE_MB = 15
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// รายการไฟล์ที่จะเก็บในใบจอง (ไม่เก็บตัวไฟล์ใน Firestore เก็บแค่ลิงก์)
export function fileEntry(file, res, by, at = new Date().toISOString()) {
  return { name: String(file?.name || 'ไฟล์').slice(0, 120), url: res.url, key: res.key, type: file?.type || '', size: file?.size || 0, at, by: by || '' }
}

function askWithdraw(b, co, onChange) {
  const { el, close } = openModal({
    title: '❌ ใบขอยกเลิกจอง ' + esc(b.bookingNo || ''), size: 'sm',
    body: `<div class="input-group"><label class="input-label">เหตุผลที่ขอยกเลิก</label>
      <textarea class="input" id="wd-reason" rows="3" placeholder="เช่น ไฟแนนซ์ไม่อนุมัติ">${esc(b.cancelReason || '')}</textarea></div>`,
    footer: `<button class="btn btn-secondary" id="wd-c">ยกเลิก</button><button class="btn btn-primary" id="wd-p">🖨️ พิมพ์</button>`,
  })
  el.querySelector('#wd-c').addEventListener('click', close)
  el.querySelector('#wd-p').addEventListener('click', async () => {
    const reason = el.querySelector('#wd-reason').value.trim()
    if (reason && reason !== b.cancelReason) {
      try { await updateDocData('bookings', b.id, { cancelReason: reason }); b.cancelReason = reason; onChange?.(b) } catch {}
    }
    close()
    printWithdrawRequest(b, co, { reason })
  })
}

// พิมพ์ฟอร์มเดียวตรงๆ (ใช้กับปุ่ม "ขั้นต่อไป")
export async function printBookingForm(b, key) {
  const p = BOOKING_PRINTS.find(x => x.key === key)
  if (!p?.print) return openBookingDocs(b)
  p.print(b, await companyFor(b))
}

export function openBookingDocs(b, { onChange } = {}) {
  if (!b) return
  const me = getState('user') || {}
  const { el } = openModal({
    title: `📄 เอกสาร · ${esc(b.bookingNo || b.custName || '')}`,
    size: 'md',
    body: `<div id="bd-body"></div>`,
    footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>`,
  })
  const body = el.querySelector('#bd-body')

  function render(busy = '') {
    const files = b.files || []
    body.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
        <div style="font-weight:700;flex:1 1 160px">🖨️ พิมพ์ (ดึงข้อมูลจากใบจองให้เอง)</div>
        <button class="btn btn-primary btn-sm" id="bd-edit">✏️ ข้อมูลเอกสารขาย${b.sale ? ' ✓' : ''}</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:16px">
        ${BOOKING_PRINTS.map(p => `<button class="btn btn-secondary" data-print="${p.key}" style="justify-content:flex-start;white-space:normal;text-align:left">${p.icon} ${p.label}</button>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
        <div style="font-weight:700;flex:1 1 160px">📎 เอกสารที่แนบ (${files.length})</div>
        <label class="btn btn-primary btn-sm" style="cursor:pointer">${busy || '➕ แนบไฟล์ / ถ่ายรูป'}
          <input type="file" id="bd-file" accept="image/*,application/pdf" multiple hidden ${busy ? 'disabled' : ''}>
        </label>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">เช่น สัญญาที่เซ็นแล้ว สำเนาบัตร ใบเสร็จ เล่มทะเบียน · รูปหรือ PDF ไม่เกิน ${MAX_FILE_MB} MB ต่อไฟล์</div>
      ${files.length ? files.map((f, i) => `
        <div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--border)">
          <span>${/pdf/.test(f.type) ? '📄' : '🖼️'}</span>
          <a href="${esc(f.url)}" target="_blank" rel="noopener" style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(f.name)}</a>
          <span style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap">${esc(String(f.at || '').slice(0, 10))}</span>
          <button class="btn btn-ghost btn-sm" data-del="${i}" title="เอาออก">✕</button>
        </div>`).join('') : '<div style="font-size:0.8rem;color:var(--text-muted);padding:8px 0">ยังไม่มีไฟล์แนบ</div>'}`

    body.querySelector('#bd-edit')?.addEventListener('click', () => openSaleEditor(b, { onSaved: x => { onChange?.(x); render() } }))
    body.querySelectorAll('[data-print]').forEach(btn => btn.addEventListener('click', async () => {
      const p = BOOKING_PRINTS.find(x => x.key === btn.dataset.print)
      const co = await companyFor(b)
      if (p.key === 'withdraw') return askWithdraw(b, co, onChange)
      p.print(b, co)
    }))
    body.querySelector('#bd-file')?.addEventListener('change', e => upload([...e.target.files]))
    body.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      const f = files[Number(btn.dataset.del)]
      if (!confirm(`เอา "${f.name}" ออกจากใบจองนี้?`)) return
      await save(files.filter((_, i) => i !== Number(btn.dataset.del)))
    }))
  }

  async function save(next) {
    try {
      await updateDocData('bookings', b.id, { files: next })
      b.files = next
      onChange?.(b)
    } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error') }
    render()
  }

  async function upload(list) {
    const ok = list.filter(f => f.size <= MAX_FILE_MB * 1024 * 1024)
    if (ok.length < list.length) showToast(`ข้าม ${list.length - ok.length} ไฟล์ที่ใหญ่เกิน ${MAX_FILE_MB} MB`, 'warning')
    if (!ok.length) return
    const added = []
    for (let i = 0; i < ok.length; i++) {
      render(`⏳ กำลังอัปโหลด ${i + 1}/${ok.length}...`)
      try { added.push(fileEntry(ok[i], await uploadFile(ok[i], 'bookings'), me.displayName || me.email)) }
      catch (e) { showToast(`อัปโหลด ${ok[i].name} ไม่สำเร็จ: ${e.message || e}`, 'error') }
    }
    if (added.length) { await save([...(b.files || []), ...added]); showToast(`📎 แนบแล้ว ${added.length} ไฟล์`, 'success') }
    else render()
  }

  render()
}
