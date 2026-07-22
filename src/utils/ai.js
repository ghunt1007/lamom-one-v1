// LAMOM ONE AI Service — Google Gemini ผ่าน Cloudflare Worker Proxy
// เดิมไฟล์นี้เรียก Gemini API ตรงจาก browser ด้วย VITE_GEMINI_API_KEY ซึ่งเป็นตัวแปร
// Vite ที่ค่าจริงถูกฝังลงใน JS bundle สาธารณะ — ใครก็เปิด DevTools มาดู key ได้ (SEC-006)
// ตอนนี้ key จริงอยู่เป็น secret ฝั่ง Worker เท่านั้น (workers/ai-proxy.js) ฝั่งนี้ส่งแค่
// Firebase ID token ของผู้ใช้ที่ล็อกอินจริงไปยืนยันตัวตนแทน — demo mode (ไม่มี Firebase
// session จริง) จึงใช้คำตอบสำรอง (fallback) เหมือนเดิม ไม่เรียก proxy เลย
import { auth } from '../core/firebase.js'

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || 'https://lamom-ai-proxy.ghunt1007.workers.dev'

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

export function isAiEnabled() { return !!auth.currentUser }

async function authHeader() {
  const u = auth.currentUser
  if (!u) return null
  const token = await u.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function callProxy(path, payload) {
  const auth_ = await authHeader()
  if (!auth_) throw new Error('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้งาน AI (ไม่รองรับใน Demo Mode)')
  const res = await fetch(`${PROXY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth_ },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `AI Proxy Error ${res.status}`)
  }
  return res.json()
}

export async function askLami(userMessage, history = [], context = {}) {
  if (!isAiEnabled()) return generateFallbackReply(userMessage)

  // Build Gemini contents array (alternating user/model)
  const contents = []
  history.slice(-10).forEach(h => {
    if (h.role === 'user')  contents.push({ role: 'user',  parts: [{ text: h.text }] })
    if (h.role === 'lami')  contents.push({ role: 'model', parts: [{ text: h.text }] })
  })
  contents.push({ role: 'user', parts: [{ text: buildPrompt(userMessage, context) }] })

  const data = await callProxy('/generate', {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  })
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่ได้รับคำตอบจาก AI'
}

// ── AI Officers (9 personas) — real Gemini call with per-officer persona ──────
// systemPrompt is authored by the caller (AiOfficers.js knows each officer's
// title/desc/skills + live business stats) and passed in here, same shape as
// askLami's SYSTEM_PROMPT but per-officer instead of one global persona.
export async function askAiOfficer(officerId, prompt, history = [], systemPrompt = '') {
  if (!isAiEnabled()) return generateOfficerFallback(officerId)

  // Build Gemini contents array (alternating user/model) — history entries use
  // {role:'user'|'assistant', content} as stored by AiOfficers.js chat state
  const contents = []
  history.slice(-10).forEach(h => {
    if (h.role === 'user') contents.push({ role: 'user', parts: [{ text: h.content }] })
    if (h.role === 'assistant') contents.push({ role: 'model', parts: [{ text: h.content }] })
  })
  contents.push({ role: 'user', parts: [{ text: prompt }] })

  const data = await callProxy('/generate', {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
  })
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่ได้รับคำตอบจาก AI'
}

function generateOfficerFallback(officerId) {
  return `ขอบคุณที่ทักมาครับ 🙏 ตอนนี้ยังไม่ได้ล็อกอินด้วยบัญชีจริง เลยยังคุยกับ AI Officer (${String(officerId).toUpperCase()}) แบบจริงไม่ได้ กรุณาล็อกอินด้วยบัญชีจริงเพื่อเปิดใช้งาน AI (Demo Mode)`
}

export async function analyzeCustomer(customer) {
  if (!isAiEnabled()) return null
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

// ── Finance Rate Sheet — วิเคราะห์ตารางดอกเบี้ยไฟแนนซ์จากรูปภาพ ─────────────────
const RATE_SHEET_PROMPT = `คุณคือผู้เชี่ยวชาญวิเคราะห์ตารางโปรโมชั่นดอกเบี้ยไฟแนนซ์รถยนต์ของไทย
วิเคราะห์รูปภาพตารางดอกเบี้ย/โปรโมชั่นไฟแนนซ์ที่แนบมา แล้วดึงข้อมูลทุกแถว/ทุกรายการที่พบในตาราง

สำหรับแต่ละรายการ ให้ระบุฟิลด์เหล่านี้ (ใส่ "" หรือ 0 ถ้าไม่มีข้อมูลในภาพ ห้ามเดาข้อมูลที่ไม่มี):
- bank: ชื่อธนาคาร/ไฟแนนซ์ (เช่น "SCB", "KBANK", "TISCO", "BAY", "ttb")
- campaign: ชื่อแคมเปญ/โปรโมชั่น
- brand: ยี่ห้อรถ
- model: รุ่นรถ (ถ้าระบุ)
- year: ปีรถ (ตัวเลข ค.ศ. หรือ พ.ศ. ตามที่ระบุในภาพ)
- month: เดือนที่โปรโมชั่นมีผล (ชื่อเดือนภาษาไทยหรือเลขเดือน)
- dateFrom: วันที่เริ่มโปรโมชั่น รูปแบบ YYYY-MM-DD (แปลงจาก พ.ศ. เป็น ค.ศ. โดยลบ 543)
- dateTo: วันที่สิ้นสุดโปรโมชั่น รูปแบบ YYYY-MM-DD (แปลงจาก พ.ศ. เป็น ค.ศ. โดยลบ 543)
- conditions: เงื่อนไขแคมเปญ (สรุปสั้นๆ เช่น ดาวน์ขั้นต่ำ, งวดผ่อน, เงื่อนไขพิเศษ)
- financeCommission: ค่าคอมมิชชั่นไฟแนนซ์ (ตัวเลข บาท หรือ % ถ้าระบุเป็น % ให้ใส่ตัวเลขแล้วเติม % ต่อท้ายใน conditions แทน และใส่ตัวเลขเปล่าใน field นี้)
- extraPayment: ค่า Extra ที่จ่ายเพิ่ม (ตัวเลข บาท)
- subsidy: เงิน Subsidy ที่ไฟแนนซ์ช่วยสนับสนุน (ตัวเลข บาท)

ตอบเป็น JSON array เท่านั้น ไม่ต้องมีคำอธิบายอื่น เช่น:
[{"bank":"SCB","campaign":"ดอกเบี้ยพิเศษ 2.99%","brand":"DEEPAL","model":"S07","year":2026,"month":"กรกฎาคม","dateFrom":"2026-07-01","dateTo":"2026-07-31","conditions":"ดาวน์ 20% ผ่อน 60 งวด","financeCommission":8000,"extraPayment":2000,"subsidy":15000}]

ถ้าอ่านภาพไม่ออกหรือไม่ใช่ตารางดอกเบี้ยไฟแนนซ์ ให้ตอบ [] เท่านั้น`

export async function analyzeFinanceRateSheet(imageBase64, mimeType = 'image/jpeg') {
  if (!isAiEnabled()) {
    // Demo mode — ตัวอย่างผลลัพธ์เพื่อให้ทดสอบ flow การยืนยันได้โดยไม่ต้องล็อกอินจริง
    return {
      demo: true,
      rows: [
        { bank: 'SCB', campaign: 'ดอกเบี้ยพิเศษหน้าฝน', brand: 'DEEPAL', model: 'S07', year: 2026, month: 'กรกฎาคม', dateFrom: '2026-07-01', dateTo: '2026-07-31', conditions: 'ดาวน์ขั้นต่ำ 20% ผ่อนสูงสุด 60 งวด (ตัวอย่าง demo mode)', financeCommission: 8000, extraPayment: 2000, subsidy: 15000 },
      ],
    }
  }
  const data = await callProxy('/generate', {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: RATE_SHEET_PROMPT },
      ],
    }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
  })
  const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '[]'
  let rows = []
  try { rows = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]') } catch { rows = [] }
  return { demo: false, rows }
}

// ── Expense Receipt OCR — อ่านใบเสร็จค่าใช้จ่ายจากรูปภาพ ─────────────────────
const RECEIPT_PROMPT = `คุณคือผู้เชี่ยวชาญอ่านใบเสร็จ/ใบกำกับภาษีค่าใช้จ่ายของไทย
วิเคราะห์รูปภาพใบเสร็จที่แนบมา แล้วดึงข้อมูลตามฟิลด์นี้ (ใส่ "" หรือ 0 ถ้าไม่มีข้อมูลในภาพ ห้ามเดา):
- vendor: ชื่อร้าน/บริษัทที่ออกใบเสร็จ
- date: วันที่ในใบเสร็จ รูปแบบ YYYY-MM-DD (แปลงจาก พ.ศ. เป็น ค.ศ. โดยลบ 543 ถ้าจำเป็น)
- amount: ยอดเงินรวมสุทธิ (ตัวเลข ไม่มีเครื่องหมายจุลภาค)
- category: หมวดหมู่ค่าใช้จ่ายที่เหมาะสมที่สุดจากลิสต์นี้เท่านั้น: "เลี้ยงรับรองลูกค้า","ค่าน้ำมัน","ค่าเดินทาง","ค่าที่พัก","เครื่องเขียน/อุปกรณ์สำนักงาน","ค่าอาหารพนักงาน","ค่าขนส่ง","อื่นๆ"

ตอบเป็น JSON object เดียวเท่านั้น ไม่ต้องมีคำอธิบายอื่น เช่น:
{"vendor":"ร้านอาหาร MK","date":"2026-07-04","amount":1240,"category":"เลี้ยงรับรองลูกค้า"}

ถ้าอ่านภาพไม่ออกหรือไม่ใช่ใบเสร็จ ให้ตอบ {"vendor":"","date":"","amount":0,"category":"อื่นๆ"}`

export async function analyzeExpenseReceipt(imageBase64, mimeType = 'image/jpeg') {
  if (!isAiEnabled()) {
    // Demo mode — ตัวอย่างผลลัพธ์เพื่อให้ทดสอบ flow การยืนยันได้โดยไม่ต้องล็อกอินจริง
    return { demo: true, vendor: 'ร้านค้าตัวอย่าง (Demo Mode)', date: new Date().toISOString().slice(0, 10), amount: 1000, category: 'อื่นๆ', confidence: 85 }
  }
  const data = await callProxy('/generate', {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: RECEIPT_PROMPT },
      ],
    }],
    // maxOutputTokens ต้องเผื่อสูงกว่า output จริงมาก — gemini-2.5-flash ใช้ "thinking"
    // tokens แย่งโควต้าเดียวกันนี้ก่อนถึงคำตอบจริง เจอจริงว่า 400 ตัดคำตอบกลางคันบ่อย
    // (thoughtsTokenCount กิน 381/400 จนคำตอบขาดกลาง JSON) จึงตั้งสูงเหมือน analyzeFinanceRateSheet
    generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
  })
  const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '{}'
  let result = {}
  try { result = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch { result = {} }
  return { demo: false, vendor: result.vendor || '', date: result.date || '', amount: Number(result.amount) || 0, category: result.category || 'อื่นๆ', confidence: 95 }
}

// ── Campaign Bulletin — วิเคราะห์ประกาศแคมเปญส่งเสริมการขายจากรูปภาพ/ข้อความ ────
const CAMPAIGN_PROMPT = `คุณคือผู้เชี่ยวชาญวิเคราะห์ประกาศแคมเปญส่งเสริมการขายรถยนต์ของไทย
วิเคราะห์เนื้อหาที่แนบมา (อาจเป็นรูปภาพโปสเตอร์/เอกสาร หรือข้อความ) แล้วดึงแคมเปญทุกรายการที่พบ
(1 ประกาศอาจมีหลายรุ่น/หลายเงื่อนไข ให้แยกเป็นหลายรายการ)

สำหรับแต่ละรายการ ให้ระบุฟิลด์เหล่านี้ (ใส่ "" หรือ 0 ถ้าไม่มีข้อมูล ห้ามเดา):
- brand: ยี่ห้อรถ (เช่น "BYD", "MG", "DEEPAL", "NETA")
- model: รุ่นรถ (ถ้าระบุ "ทุกรุ่น" ถ้าใช้กับทุกรุ่น)
- title: ชื่อแคมเปญ/หัวข้อประกาศ
- type: ประเภทจากลิสต์นี้เท่านั้น "discount"(ส่วนลด),"cashback","free_acc"(ของแถม),"free_service"(บริการฟรี),"trade_in","finance"(ดอกเบี้ยพิเศษ)
- value: มูลค่า/จำนวนเงินของสิทธิประโยชน์ (ตัวเลข บาท)
- startDate: วันเริ่มแคมเปญ YYYY-MM-DD (แปลง พ.ศ.→ค.ศ. ลบ 543 ถ้าจำเป็น)
- endDate: วันสิ้นสุดแคมเปญ YYYY-MM-DD
- conditions: เงื่อนไขสรุปสั้นๆ
- budget: งบประมาณรวมของแคมเปญถ้าระบุ (ตัวเลข บาท)
- limit: จำนวนสิทธิ์/คันที่จำกัดถ้าระบุ (ตัวเลข)

ตอบเป็น JSON array เท่านั้น เช่น:
[{"brand":"BYD","model":"Dolphin","title":"ลดพิเศษปลายปี","type":"discount","value":20000,"startDate":"2026-07-01","endDate":"2026-07-31","conditions":"เฉพาะสีขาว-ดำ","budget":1000000,"limit":50}]

ถ้าอ่านไม่ออกหรือไม่ใช่ประกาศแคมเปญส่งเสริมการขาย ให้ตอบ [] เท่านั้น`

export async function analyzeCampaignAnnouncement({ text = '', imageBase64 = null, mimeType = 'image/jpeg' } = {}) {
  if (!isAiEnabled()) {
    return {
      demo: true,
      rows: [
        { brand: 'BYD', model: 'Dolphin', title: 'ตัวอย่าง Demo Mode — ล็อกอินด้วยบัญชีจริงเพื่อวิเคราะห์จริง', type: 'discount', value: 20000, startDate: new Date().toISOString().slice(0, 10), endDate: '', conditions: '', budget: 0, limit: 0 },
      ],
    }
  }
  const parts = []
  if (imageBase64) parts.push({ inlineData: { mimeType, data: imageBase64 } })
  parts.push({ text: (text ? `ข้อความประกาศ:\n${text}\n\n` : '') + CAMPAIGN_PROMPT })

  const data = await callProxy('/generate', {
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
  })
  const respText = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '[]'
  let rows = []
  try { rows = JSON.parse(respText.match(/\[[\s\S]*\]/)?.[0] || '[]') } catch { rows = [] }
  return { demo: false, rows }
}

export async function generateDailySummary(data) {
  if (!isAiEnabled()) return null
  const prompt = `สรุปประจำวันโชว์รูม:
- Lead ใหม่: ${data.newLeads || 0} ราย
- ยอดขาย: ${data.sales || 0} คัน (เป้า ${data.target || 0})
- Job Card เปิด: ${data.openJobs || 0}
- รายได้วันนี้: ฿${(data.revenue || 0).toLocaleString()}

สรุป 3-4 ประโยค highlight สำคัญ และ 2 สิ่งที่ต้องทำวันพรุ่งนี้`
  return askLami(prompt)
}

// ── Morning Briefing — สรุปสถานการณ์เชิงรุกทุกเช้าจากข้อมูลจริงของโชว์รูม ────────
// context: { todayCount, stuckBookings, overdueJobs, staleLeads, agingStock, revenueThisMonth, targetPct }
// คืนค่าเป็นข้อความไทย 3-5 ประโยค + บรรทัดสุดท้าย "🎯 สิ่งที่ควรทำก่อน: ..."
export async function generateMorningBriefing(context = {}) {
  if (!isAiEnabled()) return generateFallbackBriefing(context)

  const {
    todayCount = 0, stuckBookings = 0, overdueJobs = 0, staleLeads = 0,
    agingStock = 0, revenueThisMonth = 0, targetPct = null,
  } = context

  const prompt = `สร้างสรุปสถานการณ์ประจำวันเช้าของโชว์รูมรถ EV จากข้อมูลจริงต่อไปนี้:
- นัดหมาย/ส่งมอบวันนี้: ${todayCount} รายการ
- ใบจองค้างสถานะเกิน 14 วัน: ${stuckBookings} ใบ
- งานซ่อมค้างเกิน 7 วัน: ${overdueJobs} งาน
- Lead ใหม่ยังไม่ติดตามเกิน 3 วัน: ${staleLeads} ราย
- รถค้างสต็อกเกิน 90 วัน: ${agingStock} คัน
- มูลค่าใบจองสะสมเดือนนี้: ฿${Math.round(revenueThisMonth).toLocaleString()}
- ความคืบหน้าเป้ายอดขายเดือนนี้: ${targetPct !== null ? targetPct + '%' : 'ไม่มีข้อมูลเป้าหมาย'}

เขียนสรุป 3-5 ประโยค ภาษาไทย น้ำเสียงกระตือรือร้นเป็นมิตรแบบผู้ช่วยส่วนตัวที่ห่วงใยผลงานของทีม
ให้ภาพรวมวันนี้แบบกระชับ ไม่ต้องทวนตัวเลขทุกตัว เลือกเฉพาะประเด็นสำคัญที่สุด
ปิดท้ายด้วยบรรทัดใหม่ขึ้นต้นด้วย "🎯 สิ่งที่ควรทำก่อน: " ตามด้วยคำแนะนำสิ่งที่ควรทำเป็นอันดับแรกของวันนี้ 1 ข้อ สั้น กระชับ นำไปทำได้ทันที
ห้ามใส่ markdown หรือ bullet point อื่นใด ตอบเป็นข้อความธรรมดาเท่านั้น`

  try {
    // เรียกผ่าน proxy ตรง (ไม่ผ่าน askLami) — gemini-2.5-flash เป็น thinking model ที่กิน
    // maxOutputTokens ไปกับ "thought" parts ก่อนถึงคำตอบจริง ถ้าเผื่อโควต้าไม่พอคำตอบจะขาดกลางประโยค
    // (ปัญหาเดียวกับที่ analyzeExpenseReceipt/analyzeFinanceRateSheet เจอมาก่อน) จึงต้องเผื่อสูงและกรอง
    // p.thought ออกเองแทนที่จะใช้ askLami ซึ่งอ่านแค่ parts[0].text เฉยๆ
    const data = await callProxy('/generate', {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
    })
    const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim()
    return text || generateFallbackBriefing(context)
  } catch {
    return generateFallbackBriefing(context)
  }
}

function generateFallbackBriefing(context = {}) {
  const {
    todayCount = 0, stuckBookings = 0, overdueJobs = 0, staleLeads = 0,
    agingStock = 0, revenueThisMonth = 0, targetPct = null,
  } = context

  const openItems = stuckBookings + overdueJobs + staleLeads + agingStock
  const opening = todayCount > 0
    ? `อรุณสวัสดิ์ครับ วันนี้มีนัดหมาย/รายการส่งมอบ ${todayCount} รายการที่ต้องติดตาม`
    : `อรุณสวัสดิ์ครับ วันนี้ยังไม่มีนัดหมายหรือส่งมอบที่ตั้งไว้`
  const targetLine = targetPct !== null
    ? ` ยอดขายเดือนนี้อยู่ที่ ${targetPct}% ของเป้าหมาย`
    : (revenueThisMonth > 0 ? ` มูลค่าใบจองสะสมเดือนนี้ ฿${Math.round(revenueThisMonth).toLocaleString()}` : '')
  const statusLine = openItems > 0
    ? ` มีเรื่องค้างที่ต้องจัดการรวม ${openItems} รายการในระบบ`
    : ` ระบบปกติ ไม่มีเรื่องค้างเกินกำหนด`

  let priority = 'ตรวจสอบภาพรวม Dashboard และติดตามลูกค้าที่ค้างนานที่สุดก่อนครับ'
  if (stuckBookings > 0) priority = `ติดตามใบจองที่ค้างสถานะนานที่สุดก่อน — มี ${stuckBookings} ใบที่ค้างเกิน 14 วัน`
  else if (overdueJobs > 0) priority = `เร่งปิดงานซ่อมที่ค้างนานที่สุด — มี ${overdueJobs} งานที่ค้างเกิน 7 วัน`
  else if (staleLeads > 0) priority = `โทรติดตาม Lead ที่ยังไม่ติดต่อกลับ — มี ${staleLeads} รายที่รอเกิน 3 วัน`
  else if (agingStock > 0) priority = `พิจารณาโปรโมชั่นระบายสต็อกรถค้างนาน — มี ${agingStock} คันที่ค้างเกิน 90 วัน`

  return `${opening}${targetLine}${statusLine} (demo mode — ล็อกอินด้วยบัญชีจริงเพื่อเปิดสรุปจาก AI จริง)\n\n🎯 สิ่งที่ควรทำก่อน: ${priority}`
}

export async function suggestPrice(vehicleData, marketData = {}) {
  if (!isAiEnabled()) return null
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

// onChunk(chunkText, fullTextSoFar) — called progressively as tokens stream in
export async function askPersonalAI(message, history = [], memoryContext = '', imageBase64 = null, onChunk = null) {
  if (!isAiEnabled()) return 'กรุณาล็อกอินด้วยบัญชีจริงเพื่อเปิดใช้งาน LAMI ครับ'

  const contents = []
  // 6 messages instead of 12 — shorter context = faster + cheaper
  history.slice(-6).forEach(h => {
    if (h.role === 'user')  contents.push({ role: 'user',  parts: [{ text: h.content }] })
    if (h.role === 'lami')  contents.push({ role: 'model', parts: [{ text: h.content }] })
  })

  const parts = []
  if (imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } })
  parts.push({ text: message })
  contents.push({ role: 'user', parts })

  const systemWithMemory = PERSONAL_SYSTEM + memoryContext

  const body = {
    systemInstruction: { parts: [{ text: systemWithMemory }] },
    contents,
    generationConfig: { maxOutputTokens: 500, temperature: 0.85 },
  }

  const auth_ = await authHeader()
  if (!auth_) throw new Error('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้งาน AI (ไม่รองรับใน Demo Mode)')

  const fetchStream = () => fetch(`${PROXY_URL}/generate-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth_ },
    body: JSON.stringify(body),
  })

  // Stream via SSE — first token arrives within ~1s instead of waiting for full response
  let res = await fetchStream()

  // Retry once on 429 (rate limit) after 8 seconds
  if (res.status === 429) {
    onChunk?.(null, null)  // signal caller to show wait message
    await new Promise(r => setTimeout(r, 8000))
    res = await fetchStream()
  }

  if (!res.ok) {
    if (res.status === 429) throw new Error('โควต้า API เกินครับ กรุณารอสักครู่แล้วพูดใหม่')
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `AI Proxy Error ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer   = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()  // keep last incomplete line in buffer
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr || jsonStr === '[DONE]') continue
      try {
        const data = JSON.parse(jsonStr)
        // Filter out thought parts (Gemini 2.5 thinking tokens — not for display)
        const parts = data.candidates?.[0]?.content?.parts || []
        const text = parts.filter(p => !p.thought).map(p => p.text || '').join('')
        if (text) {
          fullText += text
          onChunk?.(text, fullText)
        }
      } catch { /* ignore malformed SSE line */ }
    }
  }

  return fullText || 'ไม่ได้รับคำตอบครับ'
}

// Extract key long-term facts from conversation to store as memories
export async function extractMemories(userMsg, aiMsg) {
  if (!isAiEnabled()) return []
  const prompt = `จากบทสนทนานี้ ระบุข้อเท็จจริงสำคัญเกี่ยวกับผู้ใช้ที่ควรจำระยะยาว
ผู้ใช้: "${userMsg}"
AI: "${aiMsg}"

ตอบเฉพาะ JSON array เท่านั้น เช่น ["ชอบกาแฟดำ","มีลูก 2 คน"] หรือ [] ถ้าไม่มีข้อมูลใหม่
จำเฉพาะ: ชื่อ อาชีพ ครอบครัว สุขภาพ ความชอบ เป้าหมาย ที่อยู่ ปัญหาสำคัญ
ไม่ต้องจำ: คำถามทั่วไป อารมณ์ชั่วคราว เรื่องประจำวัน`

  try {
    const data = await callProxy('/generate', {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0 },
    })
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
  if (lower.includes('lead') || lower.includes('ลีด'))    return 'Lead ร้อนวันนี้ 3 ราย — วิชัย มีโชค score 87% แนะนำโทรก่อนครับ (demo mode — ล็อกอินด้วยบัญชีจริงเพื่อเปิด AI จริง)'
  if (lower.includes('ยอดขาย') || lower.includes('sales')) return 'เดือนนี้ปิดได้ 12/20 คัน (60%) แนวโน้มดีขึ้นครับ (demo mode)'
  if (lower.includes('สต็อก') || lower.includes('stock')) return 'BYD Seal AWD เหลือ 2 คัน แนะนำสั่งเพิ่มครับ (demo mode)'
  return `ขอบคุณสำหรับคำถาม "${q}" — กรุณาล็อกอินด้วยบัญชีจริงเพื่อเปิดใช้งาน AI จริงครับ 🤖`
}
