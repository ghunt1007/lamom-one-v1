// "✨ มีอะไรใหม่" — โชว์ครั้งเดียวต่อเครื่องหลังอัปเดตใหญ่ ให้ทีมรู้ว่ามีปุ่ม/ความสามารถใหม่อะไรบ้าง
// (ฟีเจอร์ใหม่ที่ไม่มีใครรู้ว่ามี = ไม่มีใครใช้) · จำว่าเห็นแล้วใน localStorage ถ้าเบราว์เซอร์ไม่ให้เก็บก็แค่ไม่โชว์
import { openModal } from './modal.js'
import { escHtml as esc } from './escape.js'

export const WHATS_NEW_ID = '2026-11-16'
// roles: ถ้าใส่ไว้ = โชว์เฉพาะตำแหน่งนั้น (เจ้าของ/แอดมินเห็นทุกข้อ) · ไม่ใส่ = โชว์ทุกคน
export const HIGHLIGHTS = [
  { icon: '📅', title: 'ปฏิทินงานรวมที่เดียว', desc: 'นัดลูกค้า ทดลองขับ ส่งมอบ ตามไฟแนนซ์ และงานติดตาม รวมในปฏิทินเดียว ทำเสร็จกด ✓ ได้เลย', path: '/calendar' },
  { icon: '🤖', title: 'สั่ง LAMI เป็นประโยคได้', desc: 'พิมพ์เช่น "นัดสมชายพรุ่งนี้ 10 โมง" หรือ "จดว่า สมชาย ขอส่วนลด" แล้วกด ✅ ทำเลย ไม่ต้องเปิดฟอร์ม', path: '/ai/ask' },
  { icon: '🌞', title: 'งานของฉันวันนี้', desc: 'ใครต้องโทร ใครต้องตาม โปรไหนใกล้หมด เรียงให้แล้วในหน้าเดียว กดเบอร์เพื่อโทรได้ทันที', path: '/crm/my-day' },
  { icon: '🔔', title: 'ลีดใหม่เด้งเข้า LINE ทันที', desc: 'ลีดจากฟอร์ม/เว็บ/Facebook แจ้งเซลส์ที่ดูแลทันที ถ้า 30 นาทียังไม่ได้ติดต่อจะเตือนอีกครั้ง', path: '/crm/customers', roles: ['manager', 'sales', 'marketing'] },
  { icon: '🗗', title: 'เปิดหลายหน้าต่างพร้อมกัน', desc: 'กดปุ่ม 🗗 หรือ Ctrl+คลิกเมนู เพื่อเปิดอีกหน้าคู่กัน เช่น ใบจองคู่กับลูกค้า ข้อมูลอัปเดตตรงกันเอง', path: '/crm/bookings' },
  { icon: '📣', title: 'ตั้งเวลาโพสต์ Facebook / Instagram', desc: 'เขียนโพสต์ล่วงหน้า ระบบโพสต์ให้ตามเวลา และดูผลโฆษณาต่อแคมเปญว่าได้ลีด/ยอดจองเท่าไร', path: '/marketing/channels', roles: ['marketing'] },
  { icon: '🤝', title: 'ลิงก์แนะนำเพื่อนใช้ได้จริง', desc: 'สร้างลิงก์ + QR ให้ลูกค้าเก่าส่งต่อเพื่อน เพื่อนสแกนหรือกรอกชื่อ-เบอร์แล้วลีดเข้าระบบทันทีพร้อมรหัสผู้แนะนำ ระบบนับลีด/จอง/ขายได้และค่าคอมให้เอง', path: '/crm/referral-qr', roles: ['manager', 'sales', 'marketing'] },
  { icon: '📇', title: 'QR นามบัตรของเซลส์แต่ละคน', desc: 'หน้า งานของฉันวันนี้ กด 📇 QR ของฉัน บันทึกรูปไปใส่นามบัตรหรือส่งในแชต ลูกค้าสแกนฝากชื่อ ลีดเข้าชื่อคุณทันทีและแจ้งเตือนทาง LINE', path: '/crm/my-day', roles: ['manager', 'sales'] },
  { icon: '🔳', title: 'QR ที่บูธและที่รถโชว์ ลูกค้าสแกนฝากชื่อเอง', desc: 'พิมพ์ป้าย QR จากตารางออกบูธ หรือหน้า QR ประจำรุ่นรถ ลูกค้าสแกนกรอกชื่อ-เบอร์ ลีดเข้าระบบติดชื่องาน/รุ่น และแจ้งเซลส์ทันที ถ้า 10 นาทียังไม่ติดต่อจะเตือนซ้ำ', path: '/marketing/events', roles: ['manager', 'sales', 'marketing'] },
  { icon: '🧹', title: 'ใบจองที่ต้องแก้ใน Sheet', desc: 'ปุ่ม 🧹 ในหน้าใบจองชี้ใบที่ข้อมูลขาดจนรายงานนับพลาด เช่น ส่งมอบแล้วไม่มีวันที่ หรือชื่อเซลส์ไม่ตรงกับพนักงาน บอกคอลัมน์ที่ต้องแก้ให้เลย', path: '/crm/bookings', roles: [] },
  { icon: '🚦', title: 'เช็กความพร้อมระบบในหน้าเดียว', desc: 'ดูว่ากุญแจ LINE/Meta/AI ใส่ครบไหม รายงาน LINE ส่งออกจริงไหม โควตา LINE เหลือเท่าไร และสำรองข้อมูลล่าสุดเมื่อไร — ถ้ามีปัญหาจะขึ้นแถบเตือนที่หน้าแรกเอง', path: '/settings/health', roles: [] },
]
const ALL_ROLES = ['owner', 'admin']
export function highlightsFor(role, owner = false) {
  if (owner || ALL_ROLES.includes(role)) return HIGHLIGHTS
  return HIGHLIGHTS.filter(h => !h.roles || h.roles.includes(role))
}

export function shouldShowWhatsNew(seen, id = WHATS_NEW_ID) { return seen !== id }

const KEY = 'lamom.whatsNewSeen'
export function maybeShowWhatsNew({ navigate, openQuickLead, role, owner } = {}) {
  const items = highlightsFor(role, owner)
  let seen = null
  try { seen = localStorage.getItem(KEY) } catch { return }
  if (!shouldShowWhatsNew(seen)) return
  try { localStorage.setItem(KEY, WHATS_NEW_ID) } catch { return }
  const { el, close } = openModal({
    title: '✨ มีอะไรใหม่ใน LAMOM ONE', size: 'md',
    body: `<div style="display:flex;flex-direction:column;gap:8px">${items.map((h, i) => `
      <div class="card" style="padding:10px 12px;display:flex;gap:10px;align-items:flex-start">
        <div style="font-size:1.5rem;line-height:1">${h.icon}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.88rem">${esc(h.title)}</div><div style="font-size:0.78rem;color:var(--text-muted);line-height:1.55">${esc(h.desc)}</div>
          <button class="btn btn-secondary btn-xs wn-go" data-i="${i}" style="margin-top:6px">ลองเลย →</button></div>
      </div>`).join('')}</div>`,
    footer: `<button class="btn btn-primary" id="wn-ok">เข้าใจแล้ว 👍</button>`,
  })
  el.querySelector('#wn-ok').addEventListener('click', close)
  el.querySelectorAll('.wn-go').forEach(b => b.addEventListener('click', () => {
    const h = items[+b.dataset.i]
    close()
    if (h.path) navigate?.(h.path)
    else if (h.action === 'quickLead') openQuickLead?.()
  }))
}
