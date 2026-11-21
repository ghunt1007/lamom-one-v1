// (v1.0.1232) "📷 ให้ AI ดูรูปรถเทิร์น" — อ่านยี่ห้อ/รุ่น/ปีโดยประมาณ เลขไมล์ สภาพ และช่วงราคาคร่าวๆ
// AI ไม่มีฐานราคารถมือสองไทยจริง → ตัวเลขเป็นแค่ช่วงเบื้องต้น ห้ามใช้แทนเต็นท์/คนประเมิน (บอกในหน้าจอทุกครั้ง)
// ฟังก์ชันล้วนเทสได้ (prompt + ตรวจคำตอบ) ส่วนเรียก AI อยู่ใน ai.js analyzeTradeInPhotos

export const TRADEIN_PROMPT = `คุณคือผู้ช่วยประเมินรถมือสองในประเทศไทย ดูรูปรถที่ลูกค้าจะนำมาเทิร์น (อาจมีรูปหน้าปัดเลขไมล์)
ตอบเป็น JSON object อย่างเดียว ห้ามมีข้อความอื่น:
{"brand":"ยี่ห้อ","model":"รุ่น","year":ปี ค.ศ.โดยประมาณหรือ null,"mileage":เลขไมล์ กม. ที่อ่านได้จากหน้าปัด หรือ null,
"grade":"A|B|C|D","priceLow":ราคาตลาดรถมือสองในไทยโดยประมาณ ต่ำสุด (บาท) หรือ null,"priceHigh":สูงสุด (บาท) หรือ null,
"issues":["จุดที่เห็นว่ามีปัญหา เช่น รอยบุบประตูหน้าซ้าย"],"checks":["สิ่งที่ต้องตรวจจริงก่อนเสนอราคา"],"confidence":"low|medium|high"}
เกรด: A สภาพดีมาก, B ดี, C พอใช้, D ต้องซ่อมเยอะ · ไม่แน่ใจให้ใส่ null ห้ามเดา · ราคาเป็นช่วงกว้างพอสมควร`

const num = (v, lo, hi) => { if (/^\s*-/.test(String(v ?? ''))) return null; const n = Math.round(Number(String(v ?? '').replace(/[^\d.]/g, ''))); return Number.isFinite(n) && n >= lo && n <= hi ? n : null }
const txt = (v, n = 80) => String(v ?? '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)
const list = (v, max = 6) => (Array.isArray(v) ? v : []).map(x => txt(x, 120)).filter(Boolean).slice(0, max)

// ข้อความจาก AI → { car, year, mileage, grade, low, high, issues, checks, confidence } หรือ null
export function parseTradeInReply(text, thisYear = new Date().getFullYear()) {
  const raw = String(text || '').match(/\{[\s\S]*\}/)?.[0]
  if (!raw) return null
  let o
  try { o = JSON.parse(raw) } catch { return null }
  if (!o || typeof o !== 'object') return null
  const year = num(o.year, 1980, thisYear + 1)
  let low = num(o.priceLow, 10000, 20000000), high = num(o.priceHigh, 10000, 20000000)
  if (low && high && low > high) [low, high] = [high, low]
  if (low && high && high > low * 3) { low = null; high = null } // ช่วงกว้างเกินไป = ไม่มีประโยชน์
  const grade = ['A', 'B', 'C', 'D'].includes(String(o.grade || '').toUpperCase()) ? String(o.grade).toUpperCase() : null
  const car = [txt(o.brand, 40), txt(o.model, 60), year || ''].filter(Boolean).join(' ')
  if (!car && !low && !grade) return null
  return {
    car, year, mileage: num(o.mileage, 0, 2000000), grade, low, high,
    issues: list(o.issues), checks: list(o.checks),
    confidence: ['low', 'medium', 'high'].includes(o.confidence) ? o.confidence : 'low',
  }
}

export const midPrice = r => (r?.low && r?.high ? Math.round((r.low + r.high) / 2 / 1000) * 1000 : null)

// ตัวกลาง AI รับคำขอได้ไม่เกิน ~200KB (workers/ai-proxy.js) → เก็บรูปตามลำดับจนเต็มงบ (รูปแรกสำคัญสุด)
export const PHOTO_BUDGET = 180_000
export function fitImages(list, budget = PHOTO_BUDGET) {
  const out = []
  let used = 0
  for (const b of list || []) { if (!b) continue; if (used + b.length > budget) break; out.push(b); used += b.length }
  return out
}
