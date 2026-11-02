// (v1.0.933) ชื่อรถสำหรับแสดงผล: ยี่ห้อ + รุ่น (+ รุ่นย่อย) โดยไม่พิมพ์ยี่ห้อซ้ำ
// ข้อมูลจาก Sheet มักเขียนรุ่นรวมยี่ห้อมาแล้ว เช่น ยี่ห้อ "AION" รุ่น "AION V" → เดิมขึ้น "AION AION V"
// ยี่ห้อ "OMODA & JAECOO" รุ่น "JAECOO 6" → เดิมขึ้น "OMODA & JAECOO JAECOO 6" — ตอนนี้ได้ "AION V" / "JAECOO 6"
const words = s => String(s || '').toLowerCase().split(/[^a-z0-9ก-๙]+/i).filter(w => w.length >= 2)

export function carLabel(brand, model, variant) {
  const b = String(brand || '').trim()
  const m = String(model || '').trim()
  const v = String(variant || '').trim()
  const mw = new Set(words(m))
  const showBrand = b && !words(b).some(w => mw.has(w))
  const vw = words(v)
  const showVariant = v && !(vw.length && vw.every(w => mw.has(w)))
  return [showBrand ? b : '', m, showVariant ? v : ''].filter(Boolean).join(' ')
}

// ใช้กับเรคคอร์ดที่มี brand/model/variant (ใบจอง รถในสต็อก งานซ่อม ฯลฯ)
export const carOf = (r, withVariant = false) => r ? carLabel(r.brand, r.model, withVariant ? r.variant : '') : ''
