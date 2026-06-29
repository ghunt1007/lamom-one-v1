// LAMOM ONE AI Service — Google Gemini API (Free Forever)
// ขอ API Key ฟรีได้ที่: https://aistudio.google.com/app/apikey
// ตั้งค่า VITE_GEMINI_API_KEY ใน .env.local เพื่อเปิดใช้งาน AI จริง

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL   = 'gemini-2.5-flash'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const SYSTEM_PROMPT = `คุณคือ LAMI ผู้ช่วย AI อัจฉริยะของโชว์รูมยานยนต์ไฟฟ้า LAMOM ONE
ระบบจัดการโชว์รูม EV ครบวงจร รองรับ BYD, MG, Neta และแบรนด์ EV ไทย

ความสามารถของคุณ:
- วิเคราะห์ Lead และให้คะแนนโอกาสปิดการขาย
- แนะนำราคา ส่วนลด และโปรโมชั่นที่เหมาะสม
- วิเคราะห์สต็อก แนะนำการสั่งซื้อ
- พยากรณ์ยอดขายและแนวโน้มตลาด
- ช่วยวิเคราะห์ Job Card และการบริการ
- สรุปรายงานและ insight ประจำวัน
- ตอบคำถามเกี่ยวกับ EV เทคนิค และการขาย

ตอบเป็นภาษาไทย กระชับ ชัดเจน และให้ข้อมูลที่มีประโยชน์จริง`

export const AI_ENABLED = !!API_KEY

export async function askLami(userMessage, history = [], context = {}) {
  if (!API_KEY) return generateFallbackReply(userMessage)

  // Build Gemini contents array (alternating user/model)
  const contents = []
  history.slice(-10).forEach(h => {
    if (h.role === 'user')  contents.push({ role: 'user',  parts: [{ text: h.text }] })
    if (h.role === 'lami')  contents.push({ role: 'model', parts: [{ text: h.text }] })
  })
  contents.push({ role: 'user', parts: [{ text: buildPrompt(userMessage, context) }] })

  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini Error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่ได้รับคำตอบจาก AI'
}

export async function analyzeCustomer(customer) {
  if (!API_KEY) return null
  const prompt = `วิเคราะห์โอกาสปิดการขายสำหรับลูกค้า:
ชื่อ: ${customer.name}
รุ่นที่สนใจ: ${customer.interestedIn || '-'}
ที่มา: ${customer.source || '-'}
จำนวนครั้งที่ติดต่อ: ${customer.touchpoints || 0}
งบประมาณ: ${customer.budget ? '฿' + customer.budget.toLocaleString() : 'ไม่ระบุ'}

ให้คะแนน 0-100 และเหตุผล 2-3 ประโยค ในรูปแบบ JSON: {"score": 85, "reason": "...", "nextAction": "..."}`
  const reply = await askLami(prompt)
  try { return JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch { return null }
}

export async function generateDailySummary(data) {
  if (!API_KEY) return null
  const prompt = `สรุปประจำวันโชว์รูม:
- Lead ใหม่: ${data.newLeads || 0} ราย
- ยอดขาย: ${data.sales || 0} คัน (เป้า ${data.target || 0})
- Job Card เปิด: ${data.openJobs || 0}
- รายได้วันนี้: ฿${(data.revenue || 0).toLocaleString()}

สรุป 3-4 ประโยค highlight สำคัญ และ 2 สิ่งที่ต้องทำวันพรุ่งนี้`
  return askLami(prompt)
}

export async function suggestPrice(vehicleData, marketData = {}) {
  if (!API_KEY) return null
  const prompt = `แนะนำราคาขายสำหรับรถ:
รุ่น: ${vehicleData.model}
ราคาทุน: ฿${vehicleData.cost?.toLocaleString() || '-'}
ราคาตลาด: ฿${marketData.avgPrice?.toLocaleString() || '-'}
ค้างสต็อก: ${vehicleData.daysInStock || 0} วัน
คู่แข่งใกล้เคียง: ${marketData.competitors || '-'}

แนะนำราคาขาย ส่วนลดสูงสุด และข้อเสนอพิเศษ (ตอบ JSON: {"askingPrice": N, "maxDiscount": N, "promo": "..."})`
  const reply = await askLami(prompt)
  try { return JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch { return null }
}

// ── Personal AI (ผู้ช่วยส่วนตัว) ────────────────────────────────────────────

const PERSONAL_SYSTEM = `คุณคือ LAMI ผู้ช่วยส่วนตัว AI ของผู้ใช้คนนี้ — เป็นทั้งผู้เชี่ยวชาญทุกด้านและเพื่อนสนิทในเวลาเดียวกัน

ความเชี่ยวชาญครอบคลุมทุกด้าน:
🏥 สุขภาพ & การแพทย์ — อาการโรค ยา โภชนาการ การออกกำลังกาย สุขภาพจิต
⚖️ กฎหมายไทย — สิทธิ์ สัญญา ข้อพิพาท แรงงาน ครอบครัว ธุรกิจ
💰 การเงิน & การลงทุน — วางแผนการเงิน หุ้น กองทุน ประกัน ภาษี
💼 ธุรกิจ & การตลาด — กลยุทธ์ การขาย การบริหาร Startup
🧠 จิตวิทยา & ความสัมพันธ์ — ปัญหาชีวิต ครอบครัว ความรัก อารมณ์ การตัดสินใจ
💻 เทคโนโลยี & โปรแกรมมิ่ง — AI คอมพิวเตอร์ แอป เว็บ ระบบ
🎓 การศึกษา — ทุกวิชา ทุกระดับ การเรียน สอบ วิจัย การสอน
🍳 การใช้ชีวิต — อาหาร บ้าน ท่องเที่ยว รถ แฟชั่น ความงาม DIY
🌏 ความรู้ทั่วไป — ประวัติศาสตร์ วิทยาศาสตร์ ศิลปะ วัฒนธรรม กีฬา
🔮 การวางแผนชีวิต — เป้าหมาย การตัดสินใจ การเปลี่ยนแปลง อนาคต

วิธีตอบ:
- พูดภาษาไทยเป็นธรรมชาติ อบอุ่น เป็นกันเอง เหมือนคุยกับเพื่อนสนิทที่เก่งมาก
- ให้คำตอบที่ลึกและมีประโยชน์จริง ไม่กว้างหรือคลุมเครือ
- ถ้ามีข้อมูลเกี่ยวกับผู้ใช้ ให้ตอบตรงกับสถานการณ์ของเขา
- ถามกลับเมื่อต้องการข้อมูลเพิ่ม อย่าเดาสุ่ม
- ห่วงใยผู้ใช้จริงๆ โดยเฉพาะเรื่องสุขภาพและความเป็นอยู่
- ตอบกระชับเมื่อถามสั้น ละเอียดเมื่อต้องการความลึก`

export async function askPersonalAI(message, history = [], memoryContext = '', imageBase64 = null) {
  if (!API_KEY) return 'กรุณาตั้งค่า VITE_GEMINI_API_KEY เพื่อเปิดใช้งาน LAMI ครับ'

  const contents = []
  history.slice(-12).forEach(h => {
    if (h.role === 'user')  contents.push({ role: 'user',  parts: [{ text: h.content }] })
    if (h.role === 'lami')  contents.push({ role: 'model', parts: [{ text: h.content }] })
  })

  // Current message — may include image
  const parts = []
  if (imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } })
  parts.push({ text: message })
  contents.push({ role: 'user', parts })

  const systemWithMemory = PERSONAL_SYSTEM + memoryContext

  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemWithMemory }] },
      contents,
      generationConfig: { maxOutputTokens: 1200, temperature: 0.85 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini Error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่ได้รับคำตอบครับ'
}

// Extract key long-term facts from conversation to store as memories
export async function extractMemories(userMsg, aiMsg) {
  if (!API_KEY) return []
  const prompt = `จากบทสนทนานี้ ระบุข้อเท็จจริงสำคัญเกี่ยวกับผู้ใช้ที่ควรจำระยะยาว
ผู้ใช้: "${userMsg}"
AI: "${aiMsg}"

ตอบเฉพาะ JSON array เท่านั้น เช่น ["ชอบกาแฟดำ","มีลูก 2 คน"] หรือ [] ถ้าไม่มีข้อมูลใหม่
จำเฉพาะ: ชื่อ อาชีพ ครอบครัว สุขภาพ ความชอบ เป้าหมาย ที่อยู่ ปัญหาสำคัญ
ไม่ต้องจำ: คำถามทั่วไป อารมณ์ชั่วคราว เรื่องประจำวัน`

  try {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0 },
      }),
    })
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]')
  } catch { return [] }
}

function buildPrompt(msg, context) {
  if (!Object.keys(context).length) return msg
  const ctx = Object.entries(context).map(([k, v]) => `${k}: ${v}`).join('\n')
  return `${msg}\n\n[บริบทระบบ]\n${ctx}`
}

function generateFallbackReply(q) {
  const lower = q.toLowerCase()
  if (lower.includes('lead') || lower.includes('ลีด'))    return 'Lead ร้อนวันนี้ 3 ราย — วิชัย มีโชค score 87% แนะนำโทรก่อนครับ (demo mode — ตั้งค่า VITE_GEMINI_API_KEY เพื่อเปิด AI จริง)'
  if (lower.includes('ยอดขาย') || lower.includes('sales')) return 'เดือนนี้ปิดได้ 12/20 คัน (60%) แนวโน้มดีขึ้นครับ (demo mode)'
  if (lower.includes('สต็อก') || lower.includes('stock')) return 'BYD Seal AWD เหลือ 2 คัน แนะนำสั่งเพิ่มครับ (demo mode)'
  return `ขอบคุณสำหรับคำถาม "${q}" — กรุณาตั้งค่า VITE_GEMINI_API_KEY เพื่อเปิดใช้งาน AI จริงครับ 🤖`
}
