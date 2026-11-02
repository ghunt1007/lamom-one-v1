// (2026-11-02) ปุ่มเดียว "📄 เอกสาร" ในใบจอง — พิมพ์เอกสารทุกแบบจากข้อมูลใบจอง + แนบไฟล์เอกสารจริง (สแกน/รูป/PDF)
import { openModal } from './modal.js'
import { showToast, getState } from '../core/store.js'
import { updateDocData } from '../core/db.js'
import { uploadFile } from './storage.js'
import { printBooking, printAccessoryOrder, printSaleContract, printRegistrationRequest } from './bookingDocs.js'

export const BOOKING_PRINTS = [
  { key: 'booking', icon: '📝', label: 'ใบจอง', print: printBooking },
  { key: 'accessory', icon: '🎨', label: 'ใบสั่งแต่ง', print: printAccessoryOrder },
  { key: 'contract', icon: '📜', label: 'สัญญาจะซื้อจะขาย', print: printSaleContract },
  { key: 'withdraw', icon: '❌', label: 'ใบถอนจอง', print: null }, // ถามเหตุผล/ยอดหักก่อน (onWithdraw)
  { key: 'registration', icon: '🪪', label: 'ใบขอจดทะเบียน', print: printRegistrationRequest },
]

export const MAX_FILE_MB = 15
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// รายการไฟล์ที่จะเก็บในใบจอง (ไม่เก็บตัวไฟล์ใน Firestore เก็บแค่ลิงก์)
export function fileEntry(file, res, by, at = new Date().toISOString()) {
  return { name: String(file?.name || 'ไฟล์').slice(0, 120), url: res.url, key: res.key, type: file?.type || '', size: file?.size || 0, at, by: by || '' }
}

export function openBookingDocs(b, { onWithdraw, onChange } = {}) {
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
      <div style="font-weight:700;margin-bottom:8px">🖨️ พิมพ์ (ดึงข้อมูลจากใบจองให้เอง)</div>
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

    body.querySelectorAll('[data-print]').forEach(btn => btn.addEventListener('click', () => {
      const p = BOOKING_PRINTS.find(x => x.key === btn.dataset.print)
      if (p.key === 'withdraw') { onWithdraw ? onWithdraw(b) : null; return }
      p.print(b)
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
