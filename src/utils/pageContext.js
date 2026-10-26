// ข้อความ "หน้าจอที่เห็นอยู่" สำหรับส่งให้ LAMI ช่วยสรุป/แนะนำ — ตัดของซ้ำ/ปุ่มทั่วไปออก ปิดเบอร์ LINE เลขบัตรก่อนส่งเสมอ
import { maskContacts } from './leadText.js'

// ข้อความปุ่ม/ป้ายที่มีทุกหน้า ไม่ช่วยให้ AI เข้าใจหน้าเลย
const NOISE = /^(⋯ อื่นๆ|🔄 รีเฟรช|📥 Export|📤 Import|🔽 ตัวกรองคอลัมน์|แก้ไข|ลบ|✏️|🗑|▼|▲|กรอง\.\.\.|—|-|\d{1,2}|ทั้งหมด)$/

export function maskSensitive(text) {
  // เลขบัตร 13 หลักก่อน (ไม่งั้นตัวปิดเบอร์โทรกินเลขบางส่วนไป)
  const noId = String(text || '').replace(/\d[\d\s-]{11,17}\d/g, m => (m.replace(/\D/g, '').length === 13 ? '[เลขบัตร]' : m))
  return maskContacts(noId)
}

// raw = innerText ของหน้า · คืนข้อความสั้นลง ไม่ซ้ำบรรทัด ไม่เกิน max ตัวอักษร
export function compactPageText(raw, max = 3500) {
  const seen = new Set()
  const out = []
  let len = 0
  for (const line0 of String(raw || '').split(/\n+/)) {
    const line = line0.replace(/\s+/g, ' ').trim()
    if (!line || NOISE.test(line) || seen.has(line)) continue
    seen.add(line)
    if (len + line.length + 1 > max) { out.push('…(ตัดส่วนที่เหลือ)'); break }
    out.push(line)
    len += line.length + 1
  }
  return maskSensitive(out.join('\n'))
}

export const PAGE_ASKS = [
  { key: 'sum', label: '✨ สรุปหน้านี้', q: 'สรุปสิ่งที่เห็นในหน้านี้ให้สั้นที่สุดเป็นข้อๆ ตัวเลขสำคัญคืออะไร มีอะไรผิดปกติหรือน่ากังวลไหม' },
  { key: 'next', label: '🎯 ควรทำอะไรต่อ', q: 'จากข้อมูลในหน้านี้ ฉันควรทำอะไรก่อน 3 อย่าง บอกชื่อลูกค้า/รายการให้เจาะจง พร้อมเหตุผลสั้นๆ' },
  { key: 'how', label: '❓ หน้านี้ใช้ยังไง', q: 'หน้านี้ใช้ทำอะไร และใช้งานยังไงแบบทีละขั้น สั้นๆ เข้าใจง่ายสำหรับพนักงานขาย' },
]

export function pageContextFor({ title = '', path = '', text = '' } = {}) {
  return {
    'หน้าจอที่ผู้ใช้เปิดอยู่': `${title || path} (${path})`,
    'สิ่งที่เห็นบนหน้าจอ (ข้อมูลส่วนตัวถูกปิดไว้)': compactPageText(text),
    'วิธีตอบ': 'ตอบจากสิ่งที่เห็นบนหน้าจอเป็นหลัก ภาษาไทยสั้นกระชับ ถ้าข้อมูลบนจอไม่พอให้บอกตรงๆ ว่าต้องดูที่หน้าไหน',
  }
}
