// "✨ มีอะไรใหม่" — โชว์ครั้งเดียวต่อเครื่องหลังอัปเดตใหญ่ ให้ทีมรู้ว่ามีปุ่ม/ความสามารถใหม่อะไรบ้าง
// (ฟีเจอร์ใหม่ที่ไม่มีใครรู้ว่ามี = ไม่มีใครใช้) · จำว่าเห็นแล้วใน localStorage ถ้าเบราว์เซอร์ไม่ให้เก็บก็แค่ไม่โชว์
import { openModal } from './modal.js'

export const WHATS_NEW_ID = '2026-10-26'
export const HIGHLIGHTS = [
  { icon: '☀️', title: 'งานของฉันวันนี้ ฉลาดขึ้น', desc: 'บอก 3 อย่างที่ควรทำก่อน · Lead ใหม่รอมากี่นาที · ให้ AI ร่างข้อความ LINE ทักลูกค้าที่เงียบได้ทีละหลายคน', path: '/crm/my-day' },
  { icon: '👥', title: 'หน้าลูกค้า มีผู้ช่วย AI', desc: 'AI ช่วยปิดการขาย · ลูกค้าถามอะไรมา วางแล้ว AI ร่างคำตอบให้ · ดูราคา/สเปค และคิดค่างวดได้ทันที', path: '/crm/customers' },
  { icon: '🤖', title: 'LAMI เก่งขึ้น', desc: 'รู้ราคา สเปค ค่างวด ผลงานทีม และยอดที่น่าจะปิดได้ · มีปุ่มถามต่อ และกด 🔊 ฟังคำตอบได้', path: '/ai/ask' },
  { icon: '🎤', title: 'พูดแทนพิมพ์', desc: 'เพิ่ม Lead ด้วยเสียง หรือวางแชทลูกค้าให้ระบบกรอกให้ · ช่องบันทึกต่างๆ มีปุ่ม 🎤', action: 'quickLead' },
  { icon: '📝', title: 'จองรถ แจ้งลูกค้าง่ายขึ้น', desc: 'เปลี่ยนสถานะแล้วมีข้อความแจ้งลูกค้าร่างไว้ให้คัดลอกส่ง LINE · บนมือถือเป็นการ์ดอ่านง่าย', path: '/crm/bookings' },
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
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.88rem">${esc(h.title)}</div><div style="font-size:0.76rem;color:var(--text-muted);line-height:1.5">${esc(h.desc)}</div></div>
        <button class="btn btn-secondary btn-xs wn-go" data-i="${i}" style="flex-shrink:0">ลองเลย</button>
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
