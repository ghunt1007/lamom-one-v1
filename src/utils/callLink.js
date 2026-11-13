// เบอร์โทรที่แตะแล้วโทรออกได้ทันที — ใช้ร่วมกันทุกหน้าที่โชว์เบอร์ลูกค้า (ลดขั้นตอน: ไม่ต้องจำเบอร์ไปกดเอง)
import { escHtml } from './escape.js'

// ตัวเลขล้วนสำหรับ tel: (เก็บ + นำหน้าไว้) — สั้นกว่า 9 หลักถือว่าโทรไม่ได้
export function dialNumber(phone) {
  const n = String(phone ?? '').replace(/[^\d+]/g, '')
  return n.replace(/\D/g, '').length >= 9 ? n : ''
}

// คืน HTML: ลิงก์โทร (class call-pill) ถ้าเบอร์โทรได้ ไม่งั้นคืนข้อความเบอร์ธรรมดา (escape แล้ว) / ว่างถ้าไม่มีเบอร์
export function callLink(phone, name = '', { icon = '📞 ' } = {}) {
  const shown = String(phone ?? '').trim()
  if (!shown) return ''
  const n = dialNumber(shown)
  if (!n) return `${icon}${escHtml(shown)}`
  return `<a class="call-pill" href="tel:${n}" onclick="event.stopPropagation()" aria-label="โทรหา ${escHtml(name || 'ลูกค้า')}">${icon}${escHtml(shown)}</a>`
}

// (v1.0.1134) อีเมลที่แตะแล้วเปิดแอปอีเมลพร้อมหัวเรื่อง/คำทักทาย — คืน '' ถ้าไม่ใช่อีเมลที่ถูกต้อง
export function mailHref(email, { subject = '', body = '' } = {}) {
  const e = String(email ?? '').trim()
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e)) return ''
  const q = [subject && 'subject=' + encodeURIComponent(subject), body && 'body=' + encodeURIComponent(body)].filter(Boolean).join('&')
  return `mailto:${e}${q ? '?' + q : ''}`
}
