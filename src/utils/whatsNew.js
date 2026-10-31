// "✨ มีอะไรใหม่" — โชว์ครั้งเดียวต่อเครื่องหลังอัปเดตใหญ่ ให้ทีมรู้ว่ามีปุ่ม/ความสามารถใหม่อะไรบ้าง
// (ฟีเจอร์ใหม่ที่ไม่มีใครรู้ว่ามี = ไม่มีใครใช้) · จำว่าเห็นแล้วใน localStorage ถ้าเบราว์เซอร์ไม่ให้เก็บก็แค่ไม่โชว์
import { openModal } from './modal.js'

export const WHATS_NEW_ID = '2026-10-31e'
export const HIGHLIGHTS = [
  { icon: '🔎', title: 'กดตัวเลขดูใบจองที่นับ', desc: 'หน้าภาพรวม: กดช่องตัวเลขบนสุดเห็นรายการใบจองเบื้องหลัง ค้นหาได้ ส่งออก Excel ได้ · สลับดู เดือน/ไตรมาส/ปี · ชี้กราฟเห็นตัวเลขเดือนนั้น', path: '/' },
  { icon: '📊', title: 'หน้าภาพรวมโฉมใหม่', desc: 'ตัวเลขหลัก 6 ช่องบนสุดพร้อม % เทียบเดือนก่อนและกราฟเล็ก · ปุ่ม ◀ ▶ เปลี่ยนเดือนทั้งหน้า · ⚙️ ปรับแต่ง ซ่อน/เรียงการ์ดเอง · 🖨 พิมพ์/บันทึก PDF', path: '/' },
  { icon: '🇹🇭', title: 'เมนูภาษาไทยทั้งหมด', desc: 'ทุกเมนูเป็นชื่อไทยแล้ว (เช่น Payroll → เงินเดือน) พิมพ์หาชื่ออังกฤษเดิมก็ยังเจอ', path: '/crm/my-day' },
  { icon: '🗂', title: 'รวมหน้าที่ซ้ำกัน', desc: 'หน้าที่ใช้ข้อมูลชุดเดียวกันรวมเป็นเมนูเดียว มีแท็บสลับมุมมองใต้หัวหน้า เช่น ทดลองขับ: รายการ ↔ ตารางเวลา', path: '/crm/testdrive' },
  { icon: '📂', title: 'ลงรถเข้าสต็อกจาก Excel', desc: 'หน้าสต็อกกด "📂 นำเข้า Excel" ลงรถทั้งล็อตทีเดียว VIN ซ้ำข้ามให้เอง', path: '/dms/stock' },
  { icon: '👤', title: 'ชื่อเซลส์จริง', desc: 'ช่องเลือกเซลส์ทุกหน้าใช้ชื่อเซลส์จากใบจองจริง ไม่มีชื่อตัวอย่างอีกแล้ว', path: '/crm/bookings' },
  { icon: '🧭', title: 'ใบจองบอกขั้นต่อไปเอง', desc: 'เปิดใบจองเห็นทันทีว่าต้องทำอะไรต่อ (ตามไฟแนนซ์ นัดส่งมอบ ใส่เลขถัง) · ปุ่ม "🧭 ต้องจัดการ" กดครั้งเดียวเห็นเฉพาะใบที่ต้องเร่ง', path: '/crm/bookings' },
  { icon: '🎯', title: 'เป้าแนะนำ + คาดการณ์สิ้นเดือน', desc: 'ยังไม่ได้ตั้งเป้า ระบบแนะนำให้จากยอด 3 เดือนก่อน +10% และบอกว่าสิ้นเดือนน่าจะได้กี่คัน ต้องเร่งวันละเท่าไร', path: '/' },
  { icon: '🤖', title: 'LAMI ฉลาดขึ้น ถามที่เดียว', desc: 'ถามได้ว่า "เดือนนี้จะถึงเป้าไหม" "ใครมีลูกค้าเงียบนาน" "รถคันไหนค้างสต็อก" · LAMI Brain กดเปิดลูกค้าที่ควรโทรได้เลย', path: '/ai/ask' },
  { icon: '📦', title: 'สต็อกบอกวันค้าง', desc: 'ทุกคันโชว์ "ในสต็อก N วัน" (เหลือง 60+ แดง 90+) · ปุ่ม "⏳ ค้าง 60 วัน+" ดูคันที่ควรเร่งขาย', path: '/dms/stock' },
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
