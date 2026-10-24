// ถามรายได้ตอนกดส่งมอบ — เดิมกด "ส่งมอบแล้ว" จากปฏิทินส่งมอบหรือป็อปอัพเปลี่ยนสถานะในหน้าใบจอง จะไม่มีที่ให้กรอก
// มาร์จิ้น/ค่าคอมเลย totalIncome ค้างเป็น 0 จนรายงานประจำวันขึ้น "ยังไม่กรอกรายได้" ทุกวัน ต้องไปเปิดฟอร์มใบจอง
// เต็มๆ แก้ทีหลังเอง (ซึ่งมักลืม) — ตัวนี้เด้งช่องกรอก 4 ช่องเดียวกับฟอร์มใบจองขึ้นมาทันทีที่ส่งมอบ ข้ามได้ถ้ายังไม่รู้ตัวเลข
import { openModal } from './modal.js'
import { formatCurrency } from './format.js'
import { updateDocData } from '../core/db.js'

export const DELIVERED_STATUSES = ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ']

// สูตรเดียวกับฟอร์มใบจองใน Bookings.js: รายได้รวม = (มาร์จิ้น − งบการตลาด) + คอมเซลส์ + คอมไฟแนนซ์
export function calcIncome({ margin = 0, budgetUsed = 0, com70 = 0, comFinance = 0 } = {}) {
  const n = v => Number(v) || 0
  const marginLeft = n(margin) - n(budgetUsed)
  return {
    margin: n(margin), budgetUsed: n(budgetUsed), com70: n(com70), comFinance: n(comFinance),
    marginLeft, totalIncome: marginLeft + n(com70) + n(comFinance),
  }
}

// นิยามเดียวกับรายงานประจำวัน (workers/daily-report.js): ส่งมอบแล้วแต่ totalIncome ยังเป็น 0/ว่าง
export function needsIncome(b) {
  return !!b && !b.deleted && DELIVERED_STATUSES.includes(b.status) && !(Number(b.totalIncome) || 0)
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// เปิดช่องกรอกรายได้ของใบจอง b — บันทึกลง Firestore แล้ว Object.assign กลับเข้า b ให้หน้าที่เรียกเห็นค่าใหม่เลย
// คืน Promise<boolean>: true = บันทึกแล้ว, false = กดข้าม/ปิด
export function askDeliveryIncome(b, { title = '💰 กรอกรายได้คันนี้' } = {}) {
  return new Promise(resolve => {
    let done = false
    const finish = v => { if (!done) { done = true; resolve(v) } }
    const field = (id, label, val) => `<div class="input-group"><label class="input-label">${label}</label><input class="input di-num" type="number" inputmode="numeric" id="${id}" value="${Number(val) || ''}" placeholder="0"></div>`
    const { el } = openModal({
      title, size: 'sm',
      body: `
        <div style="font-size:0.8rem;color:var(--text-2);margin-bottom:10px">🚗 ${escHtml(b.custName || '—')} · ${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '—')}${b.salesName ? ` · 👤 ${escHtml(b.salesName)}` : ''}</div>
        <div class="grid-2">${field('di-margin', 'กำไรขั้นต้น Margin', b.margin)}${field('di-budget', 'งบการตลาดที่ใช้', b.budgetUsed)}</div>
        <div class="grid-2">${field('di-com70', 'คอมเซลส์', b.com70)}${field('di-comfin', 'คอมไฟแนนซ์', b.comFinance)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;margin-top:6px;background:var(--surface-2);border-radius:8px">
          <span style="font-size:0.8rem;color:var(--text-muted)">รายได้รวม</span><b id="di-total" style="color:var(--accent);font-size:1rem">฿0</b>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">ยังไม่รู้ตัวเลข? กด "ไว้ทีหลัง" ได้ คันนี้จะอยู่ในรายการ "ยังไม่กรอกรายได้" ในหน้าใบจอง</div>`,
      confirmText: '💾 บันทึกรายได้', cancelText: 'ไว้ทีหลัง',
      onClose: () => finish(false),
      async onConfirm() {
        const patch = calcIncome(read())
        await updateDocData('bookings', b.id, { ...patch, updatedAt: new Date().toISOString() })
        Object.assign(b, patch)
        finish(true)
      },
    })
    const val = id => el.querySelector('#' + id)?.value
    const read = () => ({ margin: val('di-margin'), budgetUsed: val('di-budget'), com70: val('di-com70'), comFinance: val('di-comfin') })
    const refresh = () => { el.querySelector('#di-total').textContent = formatCurrency(calcIncome(read()).totalIncome) }
    el.querySelectorAll('.di-num').forEach(i => i.addEventListener('input', refresh))
    refresh()
    // openModal ลบ overlay เองหลัง onConfirm สำเร็จ แต่ไม่เรียก onClose — finish(true) ไปแล้วจาก onConfirm
    // ถ้าปิดด้วยวิธีอื่น (เช่น router เปลี่ยนหน้า) ให้ resolve false กัน Promise ค้าง
    new MutationObserver((_, obs) => { if (!document.body.contains(el)) { obs.disconnect(); finish(false) } })
      .observe(document.body, { childList: true })
    setTimeout(() => el.querySelector('#di-margin')?.focus(), 50)
  })
}

// เปลี่ยนสถานะเร็ว (ไม่ผ่านฟอร์ม) → เติมวันที่ที่รายงานใช้นับ ถ้ายังว่าง: ส่งมอบแล้ว = วันส่งมอบจริง,
// ตัดตัวเลขรอส่งมอบ = วันตัดตัวเลข — ไม่งั้นคันนั้นไม่ถูกนับเป็นยอดส่งมอบของเดือนไหนเลย (นับตาม cutDate/actualDeliveryDate)
export function statusDatePatch(b, newStatus, today) {
  if (newStatus === 'ส่งมอบแล้ว' && !/^\d{4}-\d{2}-\d{2}/.test(b?.actualDeliveryDate || '')) return { actualDeliveryDate: today }
  if (newStatus === 'ตัดตัวเลขรอส่งมอบ' && !/^\d{4}-\d{2}-\d{2}/.test(b?.cutDate || '')) return { cutDate: today }
  return {}
}
