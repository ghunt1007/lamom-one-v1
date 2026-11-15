// (v1.0.1160) โควตาข้อความ LINE OA เดือนนี้ — แพ็กเกจฟรีส่งได้จำกัดต่อเดือน (รายงาน 09:00/18:00, แจ้งเตือนลีด,
// เตือนแชตรอตอบ, Broadcast ใช้โควตาเดียวกัน) ถ้าหมดกลางเดือน ทุกอย่างหยุดส่งเงียบๆ จึงเตือนล่วงหน้าเมื่อใช้ไป 80%
// API: GET /v2/bot/message/quota → { type: 'none' | 'limited', value } · GET /v2/bot/message/quota/consumption → { totalUsage }
// ไม่ throw — อ่านไม่ได้คืน null (ห้ามเดาว่าปลอดภัย)

export const QUOTA_WARN_PCT = 80

export async function fetchLineQuota(token, fetchImpl = fetch) {
  if (!token) return null
  const h = { Authorization: `Bearer ${token}` }
  try {
    const [q, c] = await Promise.all([
      fetchImpl('https://api.line.me/v2/bot/message/quota', { headers: h }),
      fetchImpl('https://api.line.me/v2/bot/message/quota/consumption', { headers: h }),
    ])
    if (!q?.ok || !c?.ok) return null
    const qd = await q.json(), cd = await c.json()
    const used = Number(cd?.totalUsage)
    if (!Number.isFinite(used)) return null
    if (qd?.type !== 'limited') return { limited: false, limit: null, used, left: null, pct: null }
    const limit = Number(qd.value)
    if (!Number.isFinite(limit) || limit <= 0) return null
    return { limited: true, limit, used, left: Math.max(0, limit - used), pct: Math.min(100, Math.round(used / limit * 100)) }
  } catch { return null }
}

/** บรรทัดเตือนในรายงาน — คืน '' ถ้ายังไม่ถึง 80% / ไม่จำกัด / อ่านไม่ได้ */
export function lineQuotaLine(q) {
  if (!q?.limited || q.pct < QUOTA_WARN_PCT) return ''
  const n = v => Number(v).toLocaleString('en-US')
  return q.left > 0
    ? `⚠️ โควตาข้อความ LINE OA เดือนนี้ใช้ไป ${n(q.used)}/${n(q.limit)} (${q.pct}%) เหลือ ${n(q.left)} ข้อความ — ถ้าหมด รายงานและแจ้งเตือนทาง LINE จะหยุดจนถึงต้นเดือนหน้า (อัปแพ็กเกจได้ใน LINE OA Manager)`
    : `⛔ โควตาข้อความ LINE OA เดือนนี้หมดแล้ว (${n(q.used)}/${n(q.limit)}) — รายงานและแจ้งเตือนทาง LINE หยุดส่งจนถึงต้นเดือนหน้า หรืออัปแพ็กเกจใน LINE OA Manager`
}
