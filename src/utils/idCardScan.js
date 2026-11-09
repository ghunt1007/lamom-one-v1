// (v1.0.985) ปุ่ม "📷 ถ่ายบัตรประชาชน" — เปิดกล้อง/เลือกรูป → ย่อรูป → ให้ AI อ่าน → คืนข้อมูลที่ตรวจแล้ว
// ใช้ในฟอร์มจองรถ (ทั้งแบบทีละขั้นและฟอร์มเต็ม) · รูปไม่ถูกอัปโหลดเก็บ ใช้อ่านครั้งเดียวแล้วทิ้ง
import { parseIdCardReply, formatThaiId } from './idCard.js'
import { escHtml } from './escape.js'

function pickImage() {
  return new Promise(resolve => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment')
    inp.style.display = 'none'
    inp.addEventListener('change', () => { resolve(inp.files?.[0] || null); inp.remove() })
    document.body.appendChild(inp)
    inp.click()
  })
}

// ย่อด้านยาวเหลือ ~1600px เป็น JPEG — รูปจากมือถือ 4–12 MB ส่งช้าและเกินขนาดที่ AI รับ
export async function imageToJpegBase64(file, max = 1600) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.88).split(',')[1]
  } finally { URL.revokeObjectURL(url) }
}

// ปุ่มกด → { name, nid, nidOk, nidRead, address, province, birthDate } หรือ null (ยกเลิก/อ่านไม่ได้ — แจ้ง toast แล้ว)
export async function scanIdCard(btn, toast) {
  const file = await pickImage()
  if (!file) return null
  const label = btn?.innerHTML
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ AI กำลังอ่านบัตร...' }
  try {
    const { analyzeIdCard } = await import('./ai.js')
    const r = parseIdCardReply(await analyzeIdCard(await imageToJpegBase64(file), 'image/jpeg'))
    if (!r) { toast('อ่านบัตรไม่ได้ ลองถ่ายใหม่ให้เห็นทั้งใบ ไม่สะท้อนแสง', 'error'); return null }
    toast(r.nidRead && !r.nidOk ? 'อ่านเลขบัตรไม่ชัด (เลขไม่ผ่านการตรวจ) กรอกเลขบัตรเองนะครับ ส่วนอื่นกรอกให้แล้ว' : 'กรอกจากบัตรแล้ว ตรวจทานก่อนบันทึกนะครับ', r.nidRead && !r.nidOk ? 'warning' : 'success')
    return r
  } catch (e) {
    const { aiErrorText } = await import('./ai.js')
    toast(aiErrorText(e), 'error'); return null
  } finally { if (btn) { btn.disabled = false; btn.innerHTML = label } }
}

// บรรทัดสรุปสั้นๆ ใต้ปุ่ม ให้เห็นว่าอ่านอะไรได้บ้าง (เลขบัตรแสดงเฉพาะคนที่มีสิทธิ์ดู)
export function idCardSummary(r, showNid) {
  if (!r) return ''
  const parts = []
  if (showNid && r.nid) parts.push(`🪪 ${formatThaiId(r.nid)} ✓`)
  if (r.address) parts.push(`🏠 ${r.address}`)
  return parts.length ? `<div class="idc-sum" style="font-size:0.74rem;color:var(--text-muted);line-height:1.45;margin-top:4px">${escHtml(parts.join(' · '))}</div>` : ''
}
