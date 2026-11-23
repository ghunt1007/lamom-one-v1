// (v1.0.1356) ส่งข้อความถึงลูกค้ารายคน: ผูก LINE แล้ว (และยังรับ LINE ได้) = ส่งทาง LINE ฟรี · ไม่ได้ผูก = SMS
// prefs มาจาก loadContactPrefs() (marketingOptOut.js) — ผู้เรียกต้องกรองคนไม่ยินยอมรับข่าวสาร (prefs.optedOut) เองก่อน
import { phoneKey } from './marketingOptOut.js'

export const lineUidFor = (phone, prefs) => (phone && prefs?.line?.get(phoneKey(phone))) || null

export async function sendToCustomer(phone, msg, prefs) {
  const uid = lineUidFor(phone, prefs)
  if (uid) {
    const { lineReply } = await import('./socialApi.js')
    await lineReply('line_' + String(uid).replace(/[^A-Za-z0-9-]/g, ''), msg)
    return 'LINE'
  }
  const { sendSms } = await import('./comms.js')
  await sendSms([phone], msg)
  return 'SMS'
}

// "LINE 3 ราย · SMS 5 ราย" สำหรับกล่องยืนยันก่อนส่ง
export function viaSummary(rows = [], prefs, phoneOf = r => r.phone) {
  const line = rows.filter(r => lineUidFor(phoneOf(r), prefs)).length
  return [line ? `LINE ${line} ราย` : '', rows.length - line ? `SMS ${rows.length - line} ราย` : ''].filter(Boolean).join(' · ')
}
