// "วางข้อความแชท ให้ช่วยกรอก" — เซลส์ก๊อปข้อความลูกค้าจาก Facebook/LINE/TikTok มาวาง ระบบดึงเบอร์/LINE/รุ่น/ที่มาให้เอง
// ส่วนนี้ทำในเครื่องล้วน (ไม่ส่งข้อมูลออก) — ชื่อลูกค้าให้ AI ช่วยเดาได้ โดยปิดเบอร์โทรก่อนส่ง (maskContacts)
const PHONE_RE = /(?:\+?66[\s-]?|0)\d(?:[\s-]?\d){7,8}/g

export function maskContacts(text) {
  return String(text || '').replace(PHONE_RE, '[เบอร์]').replace(/@[\w.\-]{3,}/g, '[LINE]')
}

export function parseLeadText(text, models = []) {
  const t = String(text || '')
  const out = { contact: '', model: '', source: '', hot: false, name: '' }
  const ph = t.match(PHONE_RE)
  if (ph) {
    let d = ph[0].replace(/\D/g, '')
    if (d.startsWith('66') && d.length === 11) d = '0' + d.slice(2)
    out.contact = d
  } else {
    const line = t.match(/(@[\w.\-]{3,})/) || t.match(/(?:ไลน์|line\s*id|line)\s*[:：]?\s*([a-z0-9][\w.\-]{2,})/i)
    if (line) out.contact = line[1]
  }
  // ชื่อที่บอกชัดๆ ("คุณสมชาย 08x..." / "ชื่อ วิภา ค่ะ") — ต้องมีช่องว่าง/ตัวเลข/คำลงท้ายตามหลัง กันกินคำอื่นติดมา
  const nm = t.match(/(?:คุณ|ชื่อ)\s*([ก-๙a-zA-Z]{2,20}?)(?=\s|\d|$|[,.!?]|ค่ะ|คะ|ครับ|นะ)/)
  if (nm && !/^(ลูกค้า|ครับ|ค่ะ)$/.test(nm[1])) out.name = nm[1]
  const low = t.toLowerCase()
  const hit = [...models].sort((a, b) => b.length - a.length).find(m => m && low.includes(String(m).toLowerCase()))
  // พูด/พิมพ์แค่ชื่อรุ่นไม่มียี่ห้อ (เช่น "สนใจ S05") ก็ยังจับรุ่นเต็ม "DEEPAL S05" ได้
  const tail = m => String(m).trim().split(/\s+/).slice(1).join(' ').toLowerCase()
  const hit2 = hit || [...models].filter(m => tail(m).length >= 3).sort((a, b) => tail(b).length - tail(a).length).find(m => low.includes(tail(m)))
  if (hit2) out.model = hit2
  if (/facebook|เฟส|เฟซ|fb\b|เพจ/i.test(t)) out.source = 'facebook'
  else if (/tiktok|ติ๊กต็อก|ติ๊กตอก/i.test(t)) out.source = 'tiktok'
  else if (/ไลน์|line/i.test(t)) out.source = 'line'
  else if (/แนะนำ|เพื่อนบอก|ญาติบอก/.test(t)) out.source = 'referral'
  out.hot = /อยากได้เลย|จองเลย|พร้อมซื้อ|ซื้อเลย|ด่วน|ภายในเดือนนี้|ดาวน์เท่าไ|ผ่อนเดือนละ|ขอใบเสนอราคา|ขอราคา/.test(t)
  return out
}

export function buildLeadNamePrompt(maskedText) {
  return `จากข้อความแชทของลูกค้าที่สนใจซื้อรถด้านล่าง ตอบเป็น JSON อย่างเดียว:
{"name": "ชื่อลูกค้า (ถ้าไม่มีให้เป็น \\"\\")", "model": "รุ่นรถที่สนใจ (ถ้าไม่มีให้เป็น \\"\\")", "summary": "ลูกค้าต้องการอะไร 1 ประโยคสั้นๆ"}
ห้ามเดาชื่อที่ไม่มีในข้อความ
ข้อความ:
${String(maskedText).slice(0, 1500)}`
}

export function parseLeadNameReply(text) {
  const raw = String(text || '').match(/\{[\s\S]*\}/)?.[0]
  if (!raw) return null
  try {
    const o = JSON.parse(raw)
    const s = v => (typeof v === 'string' ? v.trim().slice(0, 80) : '')
    return { name: s(o.name), model: s(o.model), summary: s(o.summary) }
  } catch { return null }
}
