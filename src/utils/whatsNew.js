// "✨ มีอะไรใหม่" — โชว์ครั้งเดียวต่อเครื่องหลังอัปเดตใหญ่ ให้ทีมรู้ว่ามีปุ่ม/ความสามารถใหม่อะไรบ้าง
// (ฟีเจอร์ใหม่ที่ไม่มีใครรู้ว่ามี = ไม่มีใครใช้) · จำว่าเห็นแล้วใน localStorage ถ้าเบราว์เซอร์ไม่ให้เก็บก็แค่ไม่โชว์
import { openModal } from './modal.js'

export const WHATS_NEW_ID = '2026-10-31b'
export const HIGHLIGHTS = [
  { icon: '🧭', title: 'ใบจองบอกขั้นต่อไปเอง', desc: 'เปิดใบจองเห็นทันทีว่าต้องทำอะไรต่อ (ตามไฟแนนซ์ นัดส่งมอบ ใส่เลขถัง) · ปุ่ม "🧭 ต้องจัดการ" กดครั้งเดียวเห็นเฉพาะใบที่ต้องเร่ง', path: '/crm/bookings' },
  { icon: '🎯', title: 'เป้าแนะนำ + คาดการณ์สิ้นเดือน', desc: 'ยังไม่ได้ตั้งเป้า ระบบแนะนำให้จากยอด 3 เดือนก่อน +10% และบอกว่าสิ้นเดือนน่าจะได้กี่คัน ต้องเร่งวันละเท่าไร', path: '/' },
  { icon: '🤖', title: 'LAMI ฉลาดขึ้น ถามที่เดียว', desc: 'ถามได้ว่า "เดือนนี้จะถึงเป้าไหม" "ใครมีลูกค้าเงียบนาน" "รถคันไหนค้างสต็อก" · LAMI Brain กดเปิดลูกค้าที่ควรโทรได้เลย', path: '/ai/ask' },
  { icon: '📦', title: 'สต็อกบอกวันค้าง', desc: 'ทุกคันโชว์ "ในสต็อก N วัน" (เหลือง 60+ แดง 90+) · ปุ่ม "⏳ ค้าง 60 วัน+" ดูคันที่ควรเร่งขาย', path: '/dms/stock' },
  { icon: '⌨️', title: 'พิมพ์สั่งงานได้เลย', desc: 'กด 🔍 แล้วพิมพ์ "จองใหม่" "นัดลองขับ" หรือ "นัดติดตาม" กด Enter เปิดฟอร์มทันทีจากหน้าไหนก็ได้', path: '/crm/testdrive?new=1' },
  { icon: '✨', title: 'หน้าตาสะอาด ไม่ซ้ำซ้อน', desc: 'ตัวเลขรวมไว้บนปุ่มกรอง ไม่โชว์ 2 ที่ · ช่องที่เป็น 0 จางลง · มือถือตารางเป็นการ์ด · งานของฉันวันนี้บนคอมเรียง 2 คอลัมน์', path: '/crm/my-day' },
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
