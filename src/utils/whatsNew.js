// "✨ มีอะไรใหม่" — โชว์ครั้งเดียวต่อเครื่องหลังอัปเดตใหญ่ ให้ทีมรู้ว่ามีปุ่ม/ความสามารถใหม่อะไรบ้าง
// (ฟีเจอร์ใหม่ที่ไม่มีใครรู้ว่ามี = ไม่มีใครใช้) · จำว่าเห็นแล้วใน localStorage ถ้าเบราว์เซอร์ไม่ให้เก็บก็แค่ไม่โชว์
import { openModal } from './modal.js'
import { escHtml as esc } from './escape.js'

export const WHATS_NEW_ID = '2026-11-03'
export const HIGHLIGHTS = [
  { icon: '⌨️', title: 'พิมพ์ต่อเนื่องได้ทุกช่อง', desc: 'แก้อาการพิมพ์ได้ตัวเดียวแล้วเด้ง ต้องคลิกใหม่ — ช่องค้นหาและช่องกรอกทุกหน้า พิมพ์ยาวๆ ได้ลื่นแล้ว', path: '/crm/customers' },
  { icon: '🤖', title: 'ถาม LAMI เรื่องลูกค้ารายคนได้', desc: 'ถามเช่น "มานีถึงไหนแล้ว" "ใบจองเลขนี้สถานะอะไร" LAMI ตอบจากข้อมูลจริงในระบบ: สถานะ นัดส่งมอบ นัดติดตามถัดไป ขั้นต่อไป', path: '/ai/ask' },
  { icon: '📝', title: 'จองใหม่ ผูกลูกค้าเดิมให้เอง', desc: 'กรอกเบอร์ลูกค้าที่มีอยู่แล้วในฟอร์มจอง ระบบผูกใบจองกับลูกค้าคนนั้นให้อัตโนมัติ ไม่ต้องค้นหาเอง', path: '/crm/bookings' },
  { icon: '📱', title: 'มือถือดูง่ายขึ้น', desc: 'หน้าลูกค้า: สถานะเป็นแถวเลื่อนแถวเดียว ตัวกรองซ่อนไว้ใต้ปุ่ม "⚙️ ตัวกรอง" · ตารางที่เคยล้นจอเลื่อนซ้าย-ขวาดูได้ครบ', path: '/crm/customers' },
  { icon: '🔍', title: 'ค้นหาด้านบนเร็วขึ้น', desc: 'กด 🔍 หรือ Ctrl+K พิมพ์ชื่อ เบอร์ เลขจอง รุ่นรถ ผลขึ้นทันที · ยี่ห้อที่ขายอยู่ขึ้นก่อนในทุกช่องเลือกรถ', path: '/' },
]

export function shouldShowWhatsNew(seen, id = WHATS_NEW_ID) { return seen !== id }

const KEY = 'lamom.whatsNewSeen'
export function maybeShowWhatsNew({ navigate, openQuickLead } = {}) {
  let seen = null
  try { seen = localStorage.getItem(KEY) } catch { return }
  if (!shouldShowWhatsNew(seen)) return
  try { localStorage.setItem(KEY, WHATS_NEW_ID) } catch { return }
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
