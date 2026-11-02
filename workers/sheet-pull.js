// (2026-11-02) ดึงไฟล์ "DATA Booking Bangbuathong" จาก Google Drive ให้แอปเอง — เดิมเจ้าของต้องดาวน์โหลด xlsx
// แล้วเลือกไฟล์ทุกครั้ง ตอนนี้กด "🔄 ซิงก์ Sheet" แล้วแอปขอไฟล์ล่าสุดจาก worker นี้เลย (ยังมีหน้ายืนยันเหมือนเดิม)
//
// - ใช้ service account ตัวเดียวกับ Firestore (secret FIRESTORE_SERVICE_ACCOUNT_JSON) ขอสิทธิ์ Drive แบบอ่านอย่างเดียว
// - เจ้าของต้องแชร์ไฟล์ให้อีเมลของ service account (ผู้มีสิทธิ์อ่าน) ครั้งเดียว — ถ้ายังไม่แชร์ ตอบ not_shared
//   พร้อมอีเมลที่ต้องแชร์ให้ แอปเอาไปโชว์พร้อมปุ่มคัดลอก
// - ไฟล์ xlsx ที่อัปโหลดไว้ใน Drive → alt=media · Google Sheet จริง → export เป็น xlsx
// - GET /sheet/status = แค่วันเวลาแก้ล่าสุด (แอปเช็กทุกชั่วโมง ถ้า Sheet เปลี่ยนจะเด้งปุ่มซิงก์)
// - GET /sheet/latest = ตัวไฟล์ · ทั้งสองเส้นทางเฉพาะเจ้าของโปรแกรม (ตรวจใน daily-report.js)
// - ข้อมูลลูกค้าไม่ถูกเก็บที่ worker ส่งผ่านไปเบราว์เซอร์ของเจ้าของเท่านั้น

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
export const SHEET_FILE_ID_DEFAULT = '194PmgsKGdGytByQBau8MUhDrFrM-LBl0'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const GSHEET = 'application/vnd.google-apps.spreadsheet'
const DRIVE = 'https://www.googleapis.com/drive/v3/files/'

export function sheetFileId(env) {
  return String(env.SHEET_FILE_ID || '').trim() || SHEET_FILE_ID_DEFAULT
}

export function serviceAccountEmail(env) {
  try { return JSON.parse(env.FIRESTORE_SERVICE_ACCOUNT_JSON).client_email || '' } catch { return '' }
}

const jsonRes = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// แปลงคำตอบที่ไม่ผ่านของ Drive เป็นข้อความที่เจ้าของทำตามได้
async function driveError(res, env, cors) {
  const body = await res.json().catch(() => ({}))
  const reason = body?.error?.errors?.[0]?.reason || body?.error?.details?.[0]?.reason || ''
  const msg = String(body?.error?.message || '')
  if (res.status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(reason + ' ' + msg)) {
    const link = (msg.match(/https:\/\/console\.developers\.google\.com\/\S+/) || [])[0] || ''
    return jsonRes({ error: 'drive_api_off', message: 'ยังไม่ได้เปิด Google Drive API ให้โปรเจกต์ Firebase', link: link.replace(/[.)]+$/, '') }, 409, cors)
  }
  if (res.status === 403 || res.status === 404) {
    return jsonRes({ error: 'not_shared', message: 'ยังไม่ได้แชร์ไฟล์ Sheet ให้ระบบ', shareWith: serviceAccountEmail(env), fileId: sheetFileId(env) }, 409, cors)
  }
  return jsonRes({ error: `Google Drive ตอบ ${res.status}` }, 502, cors)
}

export async function handleSheetPull(env, { getToken }, cors, { metaOnly = false } = {}) {
  const token = await getToken()
  if (!token) return jsonRes({ error: 'ขอสิทธิ์ Google ไม่ได้ — ตรวจสอบ secret FIRESTORE_SERVICE_ACCOUNT_JSON' }, 500, cors)
  const id = encodeURIComponent(sheetFileId(env))
  const auth = { Authorization: `Bearer ${token}` }
  const metaRes = await fetch(`${DRIVE}${id}?fields=id,name,mimeType,modifiedTime&supportsAllDrives=true`, { headers: auth })
  if (!metaRes.ok) return driveError(metaRes, env, cors)
  const meta = await metaRes.json()
  if (metaOnly) return jsonRes({ name: meta.name || '', modifiedTime: meta.modifiedTime || '' }, 200, cors)
  const url = meta.mimeType === GSHEET
    ? `${DRIVE}${id}/export?mimeType=${encodeURIComponent(XLSX)}`
    : `${DRIVE}${id}?alt=media&supportsAllDrives=true`
  const fileRes = await fetch(url, { headers: auth })
  if (!fileRes.ok) return driveError(fileRes, env, cors)
  return new Response(fileRes.body, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': XLSX,
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'X-Sheet-Name, X-Sheet-Modified',
      'X-Sheet-Name': encodeURIComponent(meta.name || 'DATA Booking.xlsx'),
      'X-Sheet-Modified': meta.modifiedTime || '',
    },
  })
}
