// (v1.0.1147) ร่าง "ข้อมูลโชว์รูมที่ให้ AI ใช้ตอบ" จากข้อมูลที่มีในระบบอยู่แล้ว (ข้อมูลบริษัท + รุ่นรถและราคาในแค็ตตาล็อก)
// เป็น "ร่าง" ให้เจ้าของตรวจและแก้ก่อนกดบันทึกเสมอ — ระบบไม่ส่งข้อมูลนี้ให้ AI เองโดยไม่มีคนตรวจ
// เพราะราคาในแค็ตตาล็อกเป็นราคาอ้างอิง อาจไม่ตรงกับราคาขายจริงของโชว์รูม
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const baht = n => Number(n).toLocaleString('en-US')

/** รวมรุ่นย่อยเป็นรุ่นละบรรทัด ใช้ราคาต่ำสุดเป็น "เริ่มต้น" */
export function modelLines(vehicles = [], { dealerBrands = [], maxLines = 30 } = {}) {
  const want = dealerBrands.map(b => String(b).toLowerCase())
  const byModel = new Map()
  for (const v of vehicles) {
    if (!v || !v.brand || !v.model) continue
    const brand = String(v.brand)
    if (want.length && !want.some(b => brand.toLowerCase().includes(b))) continue
    const price = Number(v.priceMin || v.price) || 0
    const key = `${brand}|${v.model}`
    const cur = byModel.get(key)
    if (!cur) byModel.set(key, { brand, model: String(v.model), price, fuel: clip(v.fuel, 20), type: clip(v.type, 20) })
    else if (price && (!cur.price || price < cur.price)) cur.price = price
  }
  return [...byModel.values()].slice(0, maxLines).map(m => `- ${m.brand} ${m.model}${[m.fuel, m.type].filter(Boolean).length ? ` (${[m.fuel, m.type].filter(Boolean).join(', ')})` : ''}${m.price ? `: เริ่มต้น ${baht(m.price)} บาท` : ''}`)
}

export function buildShowroomInfo({ company = {}, vehicles = [], dealerBrands = [], max = 2900 } = {}) {
  const c = company || {}
  const head = [
    c.nameTh || c.name ? `ชื่อโชว์รูม: ${clip(c.nameTh || c.name, 120)}` : '',
    c.address ? `ที่อยู่: ${clip(c.address, 240)}` : '',
    c.phone ? `โทร: ${clip(c.phone, 40)}` : '',
    c.lineOA ? `LINE: ${clip(c.lineOA, 40)}` : '',
    c.facebook ? `Facebook: ${clip(c.facebook, 60)}` : '',
    'เวลาเปิดทำการ: (ใส่เวลาเปิด–ปิด เช่น 08:30–18:00 ทุกวัน)',
    'ทดลองขับ: นัดล่วงหน้าได้ทุกวัน',
  ].filter(Boolean)
  const models = modelLines(vehicles, { dealerBrands })
  const parts = [...head]
  if (models.length) parts.push('', 'รุ่นที่จำหน่ายและราคาเริ่มต้น (ลบรุ่นที่ไม่ได้ขาย และแก้ราคาให้ตรงก่อนบันทึก):', ...models)
  let out = parts.join('\n')
  // ตัดทีละบรรทัดจากท้าย ไม่ตัดกลางบรรทัด
  while (out.length > max && parts.length > head.length) { parts.pop(); out = parts.join('\n') }
  return out.slice(0, max)
}
