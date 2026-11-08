// คู่มือเชื่อมช่องทางโซเชียล (ภาษาไทย) — ใช้ในหน้า /marketing/channels แท็บ "วิธีเชื่อม"
// แต่ละช่องทาง: ทำอะไรได้ในแอป / ต้องตั้งค่าอะไร / แพลตฟอร์มไม่อนุญาตอะไร (บอกตรงๆ)

export const SECRET_STEPS = [
  'เข้า dash.cloudflare.com → Workers & Pages → เลือก lamom-daily-report',
  'แท็บ Settings → Variables and Secrets → กด Add',
  'Type เลือก Secret → ใส่ชื่อตามที่บอก → วางค่า → Deploy',
  'กลับมาหน้านี้ กด 🔄 ตรวจสถานะ — ขึ้น ✅ แปลว่าใช้ได้',
]

export const PLATFORM_GUIDE = [
  {
    key: 'line', icon: '💚', name: 'LINE OA', statusKey: 'line',
    can: ['ลูกค้าทัก LINE OA → ข้อความเข้ากล่องแชตรวมในแอปทันที', 'ตอบลูกค้าจากแอปได้ (ใครตอบ ระบบจำไว้)', 'สร้าง Lead อัตโนมัติจากคนที่ทักมา + แจกเซลส์ (เปิดไว้แล้วถ้าตั้ง AUTO_LEAD_FROM_LINE)', 'ส่งข้อความหาเพื่อนทั้งหมด (Broadcast) จากหน้า LINE OA'],
    setup: ['เชื่อมไว้แล้ว (ใช้ตัวเดียวกับรายงาน 18:00) — ไม่ต้องทำอะไรเพิ่ม', 'ใน LINE OA Manager → ตั้งค่า → การตอบกลับ: เปิดทั้ง "แชต" และ "Webhook" เพื่อให้ตอบได้ทั้งในแอป LINE OA และใน LAMOM'],
    cannot: ['ดึงแชตเก่าย้อนหลังไม่ได้ (LINE ไม่มี API) — เห็นเฉพาะข้อความที่เข้ามาหลังเปิดใช้', 'LINE ส่วนตัวของเซลส์เชื่อมไม่ได้ (ไม่มี API) — ใช้ปุ่ม "แชร์ทาง LINE" แทน', 'ข้อความที่ตอบจากแอปนับโควตา LINE OA (แพ็กเกจฟรี 300 ข้อความ/เดือน) — ตอบในแอป LINE OA เองไม่นับ', 'ตอนนี้รองรับ LINE OA หลัก 1 บัญชี (OA ของเซลส์แต่ละคนบันทึกไว้ในแท็บบัญชีได้ แต่แชตยังไม่เข้า)'],
  },
  {
    key: 'facebook', icon: '📘', name: 'Facebook เพจ (Messenger)', statusKey: 'meta',
    can: ['อ่านและตอบแชต Messenger ของทุกเพจ (ทีม/โชว์รูม/เพจของเซลส์) ในกล่องเดียว', 'โพสต์ข้อความหรือรูปลงหลายเพจพร้อมกัน', 'ดูจำนวนผู้ติดตามเพจ', 'กดเปลี่ยนแชตเป็น Lead ได้ทันที'],
    setup: [
      'business.facebook.com → ตั้งค่าธุรกิจ → บัญชี → เพจ → เพิ่มทุกเพจเข้าธุรกิจ (เพจของเซลส์: ให้เซลส์กดยอมรับคำขอ "พาร์ทเนอร์")',
      'developers.facebook.com → สร้างแอป → ประเภท "ธุรกิจ" → ผูกกับธุรกิจเดียวกัน → เพิ่มผลิตภัณฑ์ Messenger, Instagram, Marketing API',
      'กลับไปตั้งค่าธุรกิจ → ผู้ใช้ → ผู้ใช้ระบบ (System users) → เพิ่ม (สิทธิ์ Admin) → "กำหนดสินทรัพย์": เลือกทุกเพจ, IG, บัญชีโฆษณา ให้สิทธิ์ควบคุมเต็ม',
      'กด "สร้างโทเค็น" → เลือกแอปที่สร้าง → วันหมดอายุ "ไม่มี" → ติ๊ก pages_show_list, pages_read_engagement, pages_manage_posts, pages_messaging, pages_manage_metadata, instagram_basic, instagram_content_publish, instagram_manage_messages, business_management, ads_read, ads_management',
      'คัดลอกโทเค็น → ตั้งเป็น Secret ชื่อ META_SYSTEM_USER_TOKEN (ดูขั้นตอนด้านล่าง) — ห้ามส่งโทเค็นในแชตหรือ LINE',
      'ถ้า Meta ขอ "ยืนยันธุรกิจ" ให้ใช้หนังสือรับรองบริษัท (ทำครั้งเดียว)',
    ],
    cannot: ['Facebook โปรไฟล์ส่วนตัว: Meta ไม่เปิดให้โปรแกรมใดอ่าน/ตอบ Messenger ส่วนตัว หรือโพสต์ลงโปรไฟล์ส่วนตัว — ใช้ปุ่ม "แชร์ไป Facebook" ให้เซลส์กดแชร์เองแทน (แนะนำให้เซลส์เปิดเพจของตัวเอง)', 'ตอบแชตได้ภายใน 24 ชม. หลังลูกค้าทักล่าสุดเท่านั้น (กฎ Meta) เกินนั้นให้โทรหรือรอลูกค้าทักใหม่', 'อ่านกลุ่ม Facebook / Marketplace ไม่ได้'],
  },
  {
    key: 'instagram', icon: '📸', name: 'Instagram', statusKey: 'meta',
    can: ['อ่านและตอบ DM ในกล่องแชตรวม', 'โพสต์รูปพร้อมแคปชันพร้อมกับโพสต์ Facebook'],
    setup: ['เปลี่ยน IG เป็นบัญชี "มืออาชีพ" (ธุรกิจ) และผูกกับเพจ Facebook', 'ในแอป IG → ตั้งค่า → ข้อความ → เครื่องมือที่เชื่อมต่อ → เปิด "อนุญาตให้เข้าถึงข้อความ"', 'ใช้โทเค็นเดียวกับ Facebook (ไม่ต้องตั้งเพิ่ม)'],
    cannot: ['IG ส่วนตัว (Personal) เชื่อมไม่ได้', 'โพสต์ IG ต้องมีรูปทุกครั้ง และรูปต้องเป็นลิงก์ https ที่เปิดได้สาธารณะ', 'ยังไม่รองรับ Reels/Story จากแอป (โพสต์ในแอป IG แทน)'],
  },
  {
    key: 'metaAds', icon: '📣', name: 'โฆษณา Facebook/IG', statusKey: 'metaAds',
    can: ['ดูทุกแคมเปญ: สถานะ งบ ยอดใช้เดือนนี้ จำนวน Lead และต้นทุนต่อ Lead', 'ผู้จัดการกดหยุด/เปิดแคมเปญ และปรับงบรายวันได้จากแอป'],
    setup: ['ใช้โทเค็นเดียวกับ Facebook (ต้องกำหนดบัญชีโฆษณาให้ System User ด้วย)', '(ไม่บังคับ) ตั้ง Secret META_AD_ACCOUNT_IDS = act_เลขบัญชี คั่นด้วย , ถ้าต้องการเห็นเฉพาะบางบัญชี'],
    cannot: ['สร้างโฆษณาใหม่ทั้งชิ้นยังต้องทำใน Ads Manager', 'ปรับงบรายวันจากแอปได้เฉพาะแคมเปญที่ตั้งงบระดับแคมเปญ (Advantage campaign budget)', 'เซลส์ดูได้อย่างเดียว เปลี่ยนไม่ได้'],
  },
  {
    key: 'tiktok', icon: '🎵', name: 'TikTok', statusKey: 'tiktok',
    can: ['ตอนนี้: บันทึกบัญชี TikTok ของทีม/เซลส์ และนับ Lead ที่มาจาก TikTok ในรายงานแหล่งที่มา', 'แชร์ข้อความ/คัดลอกแคปชันไปโพสต์เอง'],
    setup: ['ใช้บัญชี TikTok Business', 'ถ้าต้องการโพสต์จากแอป: สมัคร developers.tiktok.com → สร้างแอป → ขอ Content Posting API และส่งให้ TikTok ตรวจ (ใช้เวลา 1–2 สัปดาห์) แล้วบอก Claude ให้ต่อระบบ', 'ถ้าต้องการดูโฆษณา TikTok: สมัคร TikTok Marketing API (business-api.tiktok.com) แล้วบอก Claude'],
    cannot: ['อ่าน/ตอบ DM TikTok ผ่าน API ไม่ได้ (TikTok เปิดเฉพาะพาร์ทเนอร์บางราย)', 'ก่อนแอปผ่านการตรวจ โพสต์ผ่าน API จะเห็นได้แค่ตัวเอง (Private)', 'บัญชีส่วนตัวของเซลส์เชื่อมไม่ได้'],
  },
  {
    key: 'google', icon: '📍', name: 'Google Business / Google Maps', statusKey: 'google',
    can: ['ตอนนี้: บันทึกลิงก์หน้าร้าน Google Maps และปุ่มขอรีวิวในหน้ารีวิวลูกค้า', 'เมื่อได้รับอนุมัติ API: ดูและตอบรีวิว, โพสต์อัปเดต, ดูยอดโทร/ขอเส้นทาง/คลิกเว็บ'],
    setup: ['business.google.com → ยืนยันโชว์รูมให้เรียบร้อย (ขึ้น "ยืนยันแล้ว")', 'ขอสิทธิ์ Business Profile API ผ่านแบบฟอร์มของ Google (ใช้เวลาหลายวัน) แล้วบอก Claude ให้ต่อระบบ'],
    cannot: ['แชตผ่าน Google (Business Messages) Google ปิดบริการแล้วตั้งแต่ปี 2024', 'ลบรีวิวลูกค้าเองไม่ได้ (รายงานรีวิวไม่เหมาะสมได้เท่านั้น)', 'ซื้ออันดับใน Google Maps ไม่ได้'],
  },
]

export const LEVELS = { team: '👥 ทีม/บริษัท', showroom: '🏢 โชว์รูม', sales: '🧑‍💼 เซลส์' }
export const ACCOUNT_PLATFORMS = {
  facebook: '📘 Facebook เพจ', instagram: '📸 Instagram', line: '💚 LINE OA', tiktok: '🎵 TikTok', google: '📍 Google Maps', youtube: '▶️ YouTube', other: '📌 อื่นๆ',
}
