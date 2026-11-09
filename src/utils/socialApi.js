// ช่องทางโซเชียล — เรียก workers/social.js (อยู่ใน worker รายงานประจำวัน ซึ่ง deploy อัตโนมัติทุกครั้งที่ merge)
// token ของ Facebook/IG/LINE เก็บเป็น secret ฝั่งเซิร์ฟเวอร์เท่านั้น หน้าเว็บส่งแค่ Firebase ID token ไปยืนยันตัวตน
import { auth } from '../core/firebase.js'

const URL_ = import.meta.env.VITE_DAILY_REPORT_URL || 'https://lamom-daily-report.ghunt1007.workers.dev'

async function call(path, body = {}) {
  const u = auth.currentUser
  if (!u) throw new Error('ต้องล็อกอินด้วยบัญชีจริงก่อน')
  const res = await fetch(`${URL_}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await u.getIdToken()}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `เซิร์ฟเวอร์ตอบ ${res.status}`)
  return data
}

export const socialStatus = () => call('/social/status')
export const metaInbox = (pageId, platform) => call('/social/meta/inbox', { pageId, platform })
export const metaReply = (pageId, recipientId, text) => call('/social/meta/reply', { pageId, recipientId, text })
export const metaPost = payload => call('/social/meta/post', payload)
export const metaAds = () => call('/social/meta/ads')
export const metaAdsUpdate = payload => call('/social/meta/ads/update', payload)
export const lineReply = (threadId, text) => call('/social/line/reply', { threadId, text })

// ลิงก์แชร์ด้วยบัญชีส่วนตัว (ทำได้ทุกคนโดยไม่ต้องใช้ API — คนกดแชร์เองจากเครื่องตัวเอง)
export function shareLinks(text = '', link = '') {
  const full = [text, link].filter(Boolean).join('\n')
  return {
    line: `https://line.me/R/share?text=${encodeURIComponent(full)}`,
    facebook: link ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` : 'https://www.facebook.com/',
  }
}
export const googlePlaces = query => call('/social/google/places', { query })
