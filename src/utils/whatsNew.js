// "✨ มีอะไรใหม่" — โชว์ครั้งเดียวต่อเครื่องหลังอัปเดตใหญ่ ให้ทีมรู้ว่ามีปุ่ม/ความสามารถใหม่อะไรบ้าง
// (ฟีเจอร์ใหม่ที่ไม่มีใครรู้ว่ามี = ไม่มีใครใช้) · จำว่าเห็นแล้วใน localStorage ถ้าเบราว์เซอร์ไม่ให้เก็บก็แค่ไม่โชว์
import { openModal } from './modal.js'

export const WHATS_NEW_ID = '2026-10-27'
export const HIGHLIGHTS = [
  { icon: '🤖', title: 'LAMI ช่วยเรื่องหน้านี้', desc: 'กด 🤖 มุมขวาบนได้ทุกหน้า LAMI ดูข้อมูลหน้าที่เปิดอยู่แล้วตอบ พร้อมคำถามต่อยอดให้กดถามต่อได้เลย', path: '/crm/customers' },
  { icon: '⌨️', title: 'ค้นหาเดียวทำได้ทุกอย่าง', desc: 'กด 🔍 หรือ Ctrl+K ค้นลูกค้า ใบจอง ทุกเมนู · พิมพ์ "ชื่อ + เบอร์" แล้ว Enter = เพิ่มลูกค้าใหม่ทันที', action: 'quickLead' },
  { icon: '📝', title: 'จองจาก Lead ได้ในปุ่มเดียว', desc: 'หน้าลูกค้ามีปุ่ม 📝 สร้างใบจอง (Lead ก็กดได้) ข้อมูลลูกค้าเติมให้ครบ · หน้าจองเหลือปุ่มเดียว ➕ จองใหม่', path: '/crm/customers' },
  { icon: '📂', title: 'เมนูกระชับ หาง่าย', desc: 'แถบซ้ายโชว์ ⭐ เมนูที่ใช้บ่อยก่อน กด 📂 ดูเมนูทั้งหมด เมื่อต้องการ · ปุ่ม หัวตาราง และหัวข้อเป็นภาษาไทยเกือบทั้งหมด', path: '/' },
  { icon: '📱', title: 'ดูง่ายทุกจอ', desc: 'มือถือ แท็บเล็ต iPad แนวนอน จอคอม ตัวหนังสือไม่เบียด ตารางไม่ล้นจอ · ลูกค้า ใบจอง สต็อก เป็นการ์ดบนจอเล็ก', path: '/crm/bookings' },
  { icon: '☀️', title: 'งานของฉันวันนี้ กระชับขึ้น', desc: 'แต่ละหมวดโชว์ 5 รายการสำคัญก่อน กด "ดูอีก" เมื่อต้องการ · ไม่มีรายการซ้ำข้ามหมวด', path: '/crm/my-day' },
  { icon: '🧠', title: 'AI ตอบครบ ไม่ขาดกลางคัน', desc: 'LAMI ใช้ความรู้จากเอกสารในระบบ · คำตอบ AI Officers / LAMI ส่วนตัว / โพสต์โซเชียล ยาวพอไม่ถูกตัด · ข้อความแจ้งเมื่อ AI ขัดข้องเข้าใจง่าย', path: '/ai/ask' },
]

export function shouldShowWhatsNew(seen, id = WHATS_NEW_ID) { return seen !== id }

const KEY = 'lamom.whatsNewSeen'
export function maybeShowWhatsNew({ navigate, openQuickLead } = {}) {
  let seen = null
  try { seen = localStorage.getItem(KEY) } catch { return }
  if (!shouldShowWhatsNew(seen)) return
  try { localStorage.setItem(KEY, WHATS_NEW_ID) } catch { return }
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const { el, close } = openModal({
    title: '✨ มีอะไรใหม่ใน LAMOM ONE', size: 'md',
    body: `<div style="display:flex;flex-direction:column;gap:8px">${HIGHLIGHTS.map((h, i) => `
      <div class="card" style="padding:10px 12px;display:flex;gap:10px;align-items:flex-start">
        <div style="font-size:1.5rem;line-height:1">${h.icon}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.88rem">${esc(h.title)}</div><div style="font-size:0.78rem;color:var(--text-muted);line-height:1.55">${esc(h.desc)}</div>
          <button class="btn btn-secondary btn-xs wn-go" data-i="${i}" style="margin-top:6px">ลองเลย →</button></div>
      </div>`).join('')}</div>`,
    footer: `<button class="btn btn-primary" id="wn-ok">เข้าใจแล้ว 👍</button>`,
  })
  el.querySelector('#wn-ok').addEventListener('click', close)
  el.querySelectorAll('.wn-go').forEach(b => b.addEventListener('click', () => {
    const h = HIGHLIGHTS[+b.dataset.i]
    close()
    if (h.path) navigate?.(h.path)
    else if (h.action === 'quickLead') openQuickLead?.()
  }))
}
