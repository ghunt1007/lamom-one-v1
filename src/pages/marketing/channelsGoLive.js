// (v1.0.1150) การ์ด "เปิดรับแชตลูกค้าจริง" — หลังเชื่อม Facebook/Instagram แล้ว แอป Meta ยังอยู่โหมดทดสอบ
// ข้อความลูกค้าจริงและลีดจากฟอร์มโฆษณาจะเข้าก็ต่อเมื่อผ่าน 4 ขั้นของ Meta การ์ดนี้บอกทีละขั้น พร้อมลิงก์
// และข้อความภาษาอังกฤษสำหรับวางในแบบฟอร์มขอสิทธิ์ (App Review) — เจ้าของเป็นคนกดส่งเองเท่านั้น
export const GO_LIVE_STEPS = [
  { n: 1, title: 'ยืนยันธุรกิจกับ Meta', who: 'เจ้าของทำเอง', text: 'อัปโหลดเอกสารบริษัท (หนังสือรับรองบริษัท หรือใบทะเบียนพาณิชย์) ชื่อและที่อยู่ต้องตรงกับเอกสาร Meta ใช้เวลาตรวจ 1–5 วันทำการ', url: 'https://business.facebook.com/settings/security', link: 'เปิดศูนย์ความปลอดภัยของธุรกิจ' },
  { n: 2, title: 'ใส่ไอคอนและหมวดหมู่ของแอป', who: '2 นาที', text: 'ที่หน้า การตั้งค่าแอพ → ข้อมูลพื้นฐาน อัปโหลดไอคอน (ดาวน์โหลดจากปุ่มด้านล่าง) และเลือกหมวดหมู่ "ธุรกิจและเพจ"', url: 'https://developers.facebook.com/apps/', link: 'เปิดหน้าแอป Meta' },
  { n: 3, title: 'ขอสิทธิ์ขั้นสูง (App Review)', who: 'เจ้าของกดส่ง', text: 'ที่หน้า การตรวจพิจารณาแอพ → สิทธิ์การอนุญาตและฟีเจอร์ กด "ขอสิทธิ์การเข้าถึงขั้นสูง" ของสิทธิ์ด้านล่าง วางคำอธิบายที่เตรียมไว้ และแนบคลิปหน้าจอสั้น ๆ ที่แสดงการใช้งานจริงในแอปนี้ Meta ใช้เวลาตรวจประมาณ 3–10 วัน', url: 'https://developers.facebook.com/apps/', link: 'เปิดหน้าแอป Meta' },
  { n: 4, title: 'สลับแอปเป็น "เปิดใช้งาน"', who: '1 คลิก', text: 'เมื่อ Meta อนุมัติแล้ว เปิดสวิตช์โหมดแอปด้านบนของหน้าแอปจาก "การพัฒนา" เป็น "เปิดใช้งาน" จากนั้นแชตและลีดจากลูกค้าจริงจะเข้าแท็บ 💬 แชตรวม', url: 'https://developers.facebook.com/apps/', link: 'เปิดหน้าแอป Meta' },
]

// คำอธิบายภาษาอังกฤษต่อสิทธิ์ — ผู้ตรวจของ Meta อ่านภาษาอังกฤษ เขียนตามที่แอปทำจริง (ดู workers/leadIntake.js, workers/social.js)
export const REVIEW_NOTES = [
  { perm: 'pages_messaging', text: 'LAMOM One is the internal CRM of our car showroom. Our staff read and answer customer messages sent to our own Facebook Pages from one shared inbox inside the CRM. We use pages_messaging to receive those messages by webhook and to send the replies our staff write (or approve) back to the same customer within the standard messaging window. We only message people who contacted our Page first.' },
  { perm: 'instagram_manage_messages', text: 'Our staff read and answer direct messages sent to our own Instagram professional account from the shared inbox inside our CRM (LAMOM One). We use instagram_manage_messages to receive those messages by webhook and to send our replies to the same customer. We only reply to people who messaged us first.' },
  { perm: 'leads_retrieval', text: 'We run Facebook and Instagram lead ads for our own Pages. When a person submits a lead form, our CRM receives the leadgen webhook and uses leads_retrieval to read that lead (name, phone number, model of interest) so a salesperson can call back within minutes. Leads are stored only in our CRM and used only to contact that person about their request.' },
  { perm: 'pages_manage_metadata', text: 'Used to subscribe our own Pages to the webhook of this app (messages, messaging_postbacks, leadgen) so that customer messages and lead-form submissions reach our CRM.' },
  { perm: 'pages_read_engagement', text: 'Used to list our own Pages with their names and follower counts inside our CRM so staff can choose which Page to post to or answer from.' },
  { perm: 'pages_manage_posts', text: 'Our marketing staff write a post once in our CRM and publish it to our own Facebook Pages. We use pages_manage_posts only to create posts on Pages we own, at our staff\'s explicit request.' },
  { perm: 'business_management', text: 'Used to read the Pages, Instagram account and ad account that belong to our own Business portfolio, so the CRM can show them in one place. We do not manage assets of any other business.' },
]

// ขั้นตอนถ่ายคลิปสาธิตที่ Meta ขอ (ถ่ายหน้าจอคอม 1–2 นาที ไม่ต้องมีเสียง)
export const DEMO_STEPS = [
  'เปิดแอป LAMOM One แล้วล็อกอิน ให้เห็นหน้าจอ แชต & โพสต์โซเชียล',
  'ใช้มือถืออีกเครื่อง (บัญชี Facebook ที่เป็นผู้ดูแลแอป) ทักข้อความเข้าเพจ Deepal EV Car',
  'ให้เห็นข้อความนั้นขึ้นในแท็บ 💬 แชตรวม แล้วพิมพ์ตอบจากในแอป ให้เห็นคำตอบไปถึงมือถือ',
  'ทำแบบเดียวกันกับ Instagram @deepalevcar',
  'เปิดลูกค้าที่มาจากฟอร์มโฆษณา (ถ้ามี) ให้เห็นชื่อและเบอร์ที่ระบบดึงมา',
]

export function goLiveHtml(esc, origin = '') {
  const base = String(origin || '').replace(/\/+$/, '')
  return `
    <details class="ch-card ch-g ch-golive" id="g-golive">
      <summary><span>🚦 <b>เปิดรับแชตลูกค้าจริงจาก Facebook / Instagram</b></span><span class="ch-st">เหลือ 4 ขั้น</span></summary>
      <div class="ch-g-b">
        <div class="ch-note">ตอนนี้แอป Meta อยู่ "โหมดทดสอบ" โพสต์ลงเพจและดูโฆษณาได้แล้ว แต่แชตและลีดจากลูกค้าจริงจะเข้าหลังผ่าน 4 ขั้นนี้ (กฎของ Meta) ระหว่างรอ ใช้ลิงก์ฟอร์มฝากชื่อและ LINE OA รับลูกค้าได้ตามปกติ</div>
        <ol class="ch-golive-steps">
          ${GO_LIVE_STEPS.map(s => `<li><b>${esc(s.title)}</b> <small class="ch-muted">(${esc(s.who)})</small><br>${esc(s.text)}<br><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.link)} ↗</a>${s.n === 2 ? ` · <a href="${esc(base)}/meta-app-icon.png" download="lamom-one-icon.png">⬇️ ดาวน์โหลดไอคอน 1024×1024</a>` : ''}</li>`).join('')}
        </ol>
        <div class="ch-g-h">📋 คำอธิบายสำหรับวางในขั้นที่ 3 (ภาษาอังกฤษ ตามที่ Meta กำหนด)</div>
        ${REVIEW_NOTES.map(r => `<div class="ch-key-copy ch-golive-note"><small><code>${esc(r.perm)}</code></small><span>${esc(r.text)}</span><button type="button" class="btn btn-secondary btn-xs" data-key-copy="${esc(r.text)}">📋 คัดลอก</button></div>`).join('')}
        <div class="ch-g-h">🎬 คลิปสาธิตที่ต้องแนบ (ถ่ายหน้าจอ 1–2 นาที)</div>
        <ol>${DEMO_STEPS.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>
    </details>`
}
