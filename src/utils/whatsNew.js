// "✨ มีอะไรใหม่" — โชว์ครั้งเดียวต่อเครื่องหลังอัปเดตใหญ่ ให้ทีมรู้ว่ามีปุ่ม/ความสามารถใหม่อะไรบ้าง
// (ฟีเจอร์ใหม่ที่ไม่มีใครรู้ว่ามี = ไม่มีใครใช้) · จำว่าเห็นแล้วใน localStorage ถ้าเบราว์เซอร์ไม่ให้เก็บก็แค่ไม่โชว์
import { openModal } from './modal.js'

export const WHATS_NEW_ID = '2026-10-31'
export const HIGHLIGHTS = [
  { icon: '⌨️', title: 'พิมพ์ "จองใหม่" เปิดฟอร์มจองได้ทันที', desc: 'กด 🔍 หรือ Ctrl+K แล้วพิมพ์ "จองใหม่" กด Enter — เปิดฟอร์มจอง 4 ขั้นจากหน้าไหนก็ได้', path: '/crm/bookings?new=1' },
  { icon: '🤖', title: 'LAMI รู้ลึกขึ้น', desc: 'ตอบได้ว่าใบจองค้างสถานะไหน นานกี่วัน รถคันไหนเลยกำหนดส่งมอบ รุ่นไหนขายดี แนวโน้ม 6 เดือน · ปุ่มถามใหม่ 🏁 รุ่นขายดี · ถามเฉพาะหน้าได้เพิ่มอีก 11 หน้า', path: '/ai/ask' },
  { icon: '🚗', title: 'ภาพรวมบริษัทไม่ซ้ำซ้อน', desc: 'ยอดจอง/ยอดขายรายเดือนกับการเทียบเดือนรวมเป็นการ์ดเดียว เลือกเดือนที่เดียว · มือถือเรียง 2 คอลัมน์', path: '/' },
  { icon: '☀️', title: 'งานของฉันวันนี้ ลื่นขึ้น', desc: 'ปุ่มกระโดดไปแต่ละหมวด · ลูกค้าคนเดียวที่มีหลายนัดเหลือแถวเดียว กด ✅ ครั้งเดียวปิดครบ', path: '/crm/my-day' },
  { icon: '📱', title: 'มือถือดูสะอาดตา', desc: 'แถวปุ่มกรองเลื่อนซ้าย-ขวาแถวเดียว · หน้าที่ยังไม่มีข้อมูลไม่โชว์เลข 0 เต็มจอ · หน้าจองรถกระชับ ช่องวันที่ซ่อนเป็นปุ่ม 📅 · ปุ่มเขียว/ส้มอ่านชัดขึ้น', path: '/crm/bookings' },
  { icon: '🔄', title: 'สถานะตรงกับ Google Sheet', desc: 'เพิ่ม ผ่านไฟแนนซ์รอเบิก · ซื้อสดรอเบิกรถ · ผ่านไฟแนนซ์รอจอง · หลังอัปเดตระบบแล้วแอปโหลดใหม่ให้เอง ไม่ค้าง', path: '/crm/customers' },
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
