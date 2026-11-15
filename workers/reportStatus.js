// (v1.0.1161) บันทึกผลการส่งรายงาน 09:00 / 18:00 ล่าสุด — เดิมถ้าส่งไม่ออก (โควตา LINE หมด, token หมดอายุ, Firestore อ่านไม่ได้)
// ไม่มีใครรู้จนสังเกตว่าเงียบ ตอนนี้เก็บผลไว้ที่ system_integrations/report_status ให้การ์ด "🚦 ความพร้อมใช้งานจริง" แสดง
// ไม่มีข้อความรายงานหรือข้อมูลลูกค้าในเอกสารนี้ เก็บแค่เวลา สำเร็จไหม และข้อความ error สั้นๆ
import { fsBase, call, auth, enc } from './scheduledSend.js'

export const REPORT_STATUS_DOC = 'report_status'

// ข้อความ error ภาษาอังกฤษที่เจอบ่อย → ภาษาไทยที่เจ้าของเข้าใจ
export function thaiSendError(msg = '') {
  const m = String(msg)
  if (/monthly limit|quota/i.test(m)) return 'โควตาข้อความ LINE OA เดือนนี้หมดแล้ว (อัปแพ็กเกจใน LINE OA Manager หรือรอต้นเดือนหน้า)'
  if (/invalid.*token|authentication|401/i.test(m)) return 'กุญแจ LINE (token) ใช้ไม่ได้แล้ว — ออกกุญแจใหม่ใน LINE Developers แล้วใส่ในหน้า 🔑'
  return m
}

/** ผลจาก runDailyReport → { ok, error } — สำเร็จถ้าส่งออกอย่างน้อยหนึ่งช่องทาง (LINE หรือ Telegram) */
export function summarizeReportRun(res) {
  if (!res) return { ok: false, error: 'ไม่ได้ผลลัพธ์จากรายงาน' }
  if (res.error) return { ok: false, error: String(res.error).slice(0, 200) }
  const ch = [['LINE', res.line], ['Telegram', res.telegram]]
  const ok = ch.some(([, r]) => r?.sent === true)
  const errs = ch.filter(([, r]) => r && r.configured !== false && r.sent !== true).map(([n, r]) => `${n}: ${thaiSendError(String(r.error || 'ส่งไม่สำเร็จ')).slice(0, 160)}`)
  if (!ok && !errs.length) return { ok: false, error: 'ยังไม่ได้ตั้งค่าช่องทางส่งรายงาน (LINE/Telegram)' }
  return { ok, error: errs.join(' · ').slice(0, 300) }
}

export async function saveReportStatus(env, token, kind, res, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!token || !['morning', 'evening'].includes(kind)) return false
  const s = summarizeReportRun(res)
  const data = { kind: 'report-status', [`${kind}At`]: new Date(now).toISOString(), [`${kind}Ok`]: s.ok, [`${kind}Error`]: s.error }
  const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)]))
  const r = await call(fetchImpl, `${fsBase(env)}/system_integrations/${REPORT_STATUS_DOC}?${mask}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ fields }) })
  return !!r?.ok
}
