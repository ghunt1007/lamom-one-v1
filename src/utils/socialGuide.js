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
    key: 'ai', icon: '🤖', name: 'AI ตอบลูกค้าอัตโนมัติ', statusKey: 'ai',
    can: ['ตอบแชตลูกค้า LINE OA ทุกบัญชี (และ Facebook/IG เมื่อเชื่อมแล้ว) ให้เองตลอด 24 ชม. หรือเฉพาะนอกเวลาทำการ', 'ใช้โปรจากหน้าแคมเปญ + ข้อมูลโชว์รูมที่พิมพ์ไว้ ไม่แต่งราคาเอง', 'ลูกค้าขอคุยกับคน → ขึ้นป้าย 🙋 ให้ทีมรับช่วง · พนักงานตอบเมื่อไหร่ AI หยุดเอง 30 นาที'],
    setup: ['ใช้กุญแจ Gemini ตัวเดียวกับที่ LAMI ใช้อยู่ (aistudio.google.com → Get API key ถ้ายังไม่มี)', 'ตั้งเป็น Secret ชื่อ GEMINI_API_KEY ใน worker lamom-daily-report (ขั้นตอนด้านล่าง)', 'เปิดสวิตช์ที่แท็บ 🤖 ตอบอัตโนมัติ แล้วพิมพ์ข้อมูลโชว์รูม → บันทึก'],
    cannot: ['AI ตอบได้เฉพาะข้อความตัวอักษร (รูป/สติกเกอร์/เสียง รอพนักงานตอบ)', 'แชตเดียวกัน AI ตอบได้ไม่เกิน 6 ครั้งต่อชั่วโมง กันคุยวนไม่จบ'],
  },
  {
    key: 'line', icon: '💚', name: 'LINE OA', statusKey: 'line',
    can: ['ลูกค้าทัก LINE OA → ข้อความเข้ากล่องแชตรวมในแอปทันที', 'ตอบลูกค้าจากแอปได้ (ใครตอบ ระบบจำไว้)', 'สร้าง Lead อัตโนมัติจากคนที่ทักมา + แจกเซลส์ (เปิด/ปิดที่แท็บ 🤖 ตอบอัตโนมัติ)', 'ให้ AI ตอบลูกค้าอัตโนมัติ เปิด/ปิดได้ (แท็บ 🤖 ตอบอัตโนมัติ) — ใช้ reply ของ LINE จึงไม่กินโควตาข้อความ', 'ส่งข้อความหาเพื่อนทั้งหมด (Broadcast) จากหน้า LINE OA'],
    setup: ['OA หลักเชื่อมไว้แล้ว (ตัวเดียวกับรายงาน 18:00) — ไม่ต้องทำอะไรเพิ่ม', 'ใน LINE OA Manager → ตั้งค่า → การตอบกลับ: เปิดทั้ง "แชต" และ "Webhook" เพื่อให้ตอบได้ทั้งในแอป LINE OA และใน LAMOM',
      'เพิ่ม OA ของโชว์รูม/ทีม/เซลส์แต่ละคน: ในแต่ละ OA → LINE Developers → Messaging API → คัดลอก Channel secret และกด Issue Channel access token',
      'ตั้ง Secret ชื่อ LINE_EXTRA_CHANNELS เป็นรายการเดียว เช่น [{"id":"showroom","name":"LINE โชว์รูม","secret":"…","token":"…"},{"id":"sale-a","name":"LINE เซลส์ เอ","secret":"…","token":"…"}] (id ใช้ a-z 0-9 - เท่านั้น)',
      'ตั้ง Webhook URL ของแต่ละ OA เป็น https://lamom-daily-report.ghunt1007.workers.dev/line/webhook/<id> (เช่น …/line/webhook/showroom) แล้วกด Verify และเปิด Use webhook'],
    cannot: ['ดึงแชตเก่าย้อนหลังไม่ได้ (LINE ไม่มี API) — เห็นเฉพาะข้อความที่เข้ามาหลังเปิดใช้', 'LINE ส่วนตัวของเซลส์เชื่อมไม่ได้ (ไม่มี API) — ใช้ปุ่ม "แชร์ทาง LINE" แทน', 'ข้อความที่ตอบจากแอปนับโควตา LINE OA (แพ็กเกจฟรี 300 ข้อความ/เดือน) — ตอบในแอป LINE OA เองไม่นับ', 'OA เพิ่มเติม (โชว์รูม/ทีม/เซลส์) ใช้เก็บและตอบแชตลูกค้า — คำสั่งของเซลส์และรายงานประจำวันยังใช้ OA หลักตัวเดียว'],
  },
  {
    key: 'facebook', icon: '📘', name: 'Facebook เพจ (Messenger)', statusKey: 'meta',
    can: ['อ่านและตอบแชต Messenger ของทุกเพจ (ทีม/โชว์รูม/เพจของเซลส์) ในกล่องเดียว', 'ลูกค้าทักเพจ → สร้างลีด + AI ตอบอัตโนมัติ (เปิด/ปิดได้) · ลีดจากฟอร์มโฆษณา (Lead Ads) เข้าแอปทันทีพร้อมเบอร์โทร', 'โพสต์ข้อความหรือรูปลงหลายเพจพร้อมกัน', 'ดูจำนวนผู้ติดตามเพจ', 'กดเปลี่ยนแชตเป็น Lead ได้ทันที'],
    setup: [
      'business.facebook.com → ตั้งค่าธุรกิจ → บัญชี → เพจ → เพิ่มทุกเพจเข้าธุรกิจ (เพจของเซลส์: ให้เซลส์กดยอมรับคำขอ "พาร์ทเนอร์")',
      'developers.facebook.com → สร้างแอป → ประเภท "ธุรกิจ" → ผูกกับธุรกิจเดียวกัน → เพิ่มผลิตภัณฑ์ Messenger, Instagram, Marketing API',
      'กลับไปตั้งค่าธุรกิจ → ผู้ใช้ → ผู้ใช้ระบบ (System users) → เพิ่ม (สิทธิ์ Admin) → "กำหนดสินทรัพย์": เลือกทุกเพจ, IG, บัญชีโฆษณา ให้สิทธิ์ควบคุมเต็ม',
      'กด "สร้างโทเค็น" → เลือกแอปที่สร้าง → วันหมดอายุ "ไม่มี" → ติ๊ก pages_show_list, pages_read_engagement, pages_manage_posts, pages_messaging, pages_manage_metadata, instagram_basic, instagram_content_publish, instagram_manage_messages, business_management, ads_read, ads_management',
      'คัดลอกโทเค็น → ตั้งเป็น Secret ชื่อ META_SYSTEM_USER_TOKEN (ดูขั้นตอนด้านล่าง) — ห้ามส่งโทเค็นในแชตหรือ LINE',
      'ถ้า Meta ขอ "ยืนยันธุรกิจ" ให้ใช้หนังสือรับรองบริษัท (ทำครั้งเดียว)',
      '(ให้แชตและลีดจากฟอร์มโฆษณาเข้าแอปเอง + AI ตอบ) ในแอปที่สร้าง → App settings → Basic → คัดลอก App secret → ตั้ง Secret ชื่อ META_APP_SECRET',
      'ตั้ง Secret ชื่อ META_VERIFY_TOKEN เป็นคำลับอะไรก็ได้ที่ตั้งเอง (เช่น lamom-2569-xyz)',
      'ในแอป → Webhooks → เลือก Page → Callback URL: https://lamom-daily-report.ghunt1007.workers.dev/meta/webhook · Verify token: คำลับข้อก่อน → Verify and save → Subscribe ช่อง messages, messaging_postbacks, message_echoes, leadgen · เลือก Instagram → Subscribe ช่อง messages',
      'แต่ละเพจต้องกด "Subscribe" แอปนี้ด้วย: Messenger → Settings → Webhooks → Add subscriptions (หรือให้ Claude ทำผ่าน API เมื่อมีโทเค็นแล้ว)',
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
    key: 'leadhook', icon: '📮', name: 'ช่องรับลีดกลาง (TikTok · เว็บ · Google Form · อีเมล · ช่องทางอื่น)', statusKey: 'leadHook',
    can: ['ลีดจากฟอร์ม TikTok, ฟอร์มหน้าเว็บ, Google Form, อีเมล หรือเครื่องมืออย่าง Zapier/Make เข้าแอปเป็นลูกค้าใหม่ทันที (ชื่อ เบอร์ อีเมล ไลน์ รุ่นที่สนใจ ข้อความ)', 'เบอร์/อีเมลซ้ำกับลูกค้าเดิม → ไม่สร้างซ้ำ แต่จดโน้ตให้ลูกค้าเดิมว่าทักมาอีกครั้ง', 'ใส่ &account=<รหัสบัญชีจากแท็บ 👥 บัญชี> เพื่อนับว่าลีดมาจากเพจ/TikTok ของทีมหรือของเซลส์คนไหน'],
    setup: ['ตั้ง Secret ชื่อ LEAD_WEBHOOK_KEY เป็นรหัสยาวๆ ที่ตั้งเอง (เช่น ตัวอักษร+ตัวเลขสุ่ม 24 ตัว) — ห้ามบอกคนนอก', 'ปลายทางให้ส่งข้อมูลแบบ POST มาที่ https://lamom-daily-report.ghunt1007.workers.dev/lead/webhook?key=<รหัส>&source=tiktok (เปลี่ยน source เป็น website / email / google / facebook / line / other ตามช่องทาง)', 'TikTok: TikTok Ads Manager → Tools → Leads Center → CRM integration เลือก Zapier หรือ Make แล้วตั้ง Webhook (POST, JSON) ไปที่ลิงก์ข้างบน', 'Google Form: เปิด Apps Script ของฟอร์ม ใช้ UrlFetchApp.fetch(ลิงก์ข้างบน, {method:"post", contentType:"application/json", payload: JSON.stringify({name, phone, model})}) ตอนส่งฟอร์ม', 'อีเมล: ใช้ Zapier/Make "New email in Gmail" → Webhook POST {name, email, subject, body} มาที่ลิงก์ข้างบน (source=email)'],
    cannot: ['แชต DM TikTok และ LINE ส่วนตัว ไม่มี API ให้ดึง — ให้เซลส์ใช้ปุ่ม ➕ Lead → วางข้อความแชต ระบบแยกชื่อ/เบอร์ให้เอง', 'ตอบลูกค้ากลับผ่านช่องนี้ไม่ได้ (รับลีดอย่างเดียว) — โทรหรือทักกลับตามเบอร์/ไลน์ที่ได้'],
  },
  {
    key: 'tiktok', icon: '🎵', name: 'TikTok', statusKey: 'tiktok',
    can: ['ลีดจากฟอร์มโฆษณา TikTok เข้าแอปเองผ่าน 📮 ช่องรับลีดกลาง (ด้านบน)', 'บันทึกบัญชี TikTok ของทีม/เซลส์ และนับ Lead ที่มาจาก TikTok ในรายงานแหล่งที่มา', 'แชร์ข้อความ/คัดลอกแคปชันไปโพสต์เอง'],
    setup: ['ใช้บัญชี TikTok Business', 'ถ้าต้องการโพสต์จากแอป: สมัคร developers.tiktok.com → สร้างแอป → ขอ Content Posting API และส่งให้ TikTok ตรวจ (ใช้เวลา 1–2 สัปดาห์) แล้วบอก Claude ให้ต่อระบบ', 'ถ้าต้องการดูโฆษณา TikTok: สมัคร TikTok Marketing API (business-api.tiktok.com) แล้วบอก Claude'],
    cannot: ['อ่าน/ตอบ DM TikTok ผ่าน API ไม่ได้ (TikTok เปิดเฉพาะพาร์ทเนอร์บางราย)', 'ก่อนแอปผ่านการตรวจ โพสต์ผ่าน API จะเห็นได้แค่ตัวเอง (Private)', 'บัญชีส่วนตัวของเซลส์เชื่อมไม่ได้'],
  },
  {
    key: 'google', icon: '📍', name: 'Google Business / Google Maps', statusKey: 'google',
    can: ['แท็บ 📍 Google Maps: ค้นหาโชว์รูมเราและคู่แข่ง ดูคะแนนดาว จำนวนรีวิว และรีวิวล่าสุด 5 รายการ', 'ให้ AI ร่างคำตอบรีวิว แล้วกดเปิด Google Maps ไปวางตอบ', 'เมื่อได้รับอนุมัติ Business Profile API: ตอบรีวิวจากแอปโดยตรง, โพสต์อัปเดต, ดูยอดโทร/ขอเส้นทาง'],
    setup: ['console.cloud.google.com → เลือกโปรเจกต์ (หรือสร้างใหม่) → APIs & Services → Library → เปิด "Places API (New)"', 'Credentials → Create credentials → API key → Edit → API restrictions: เลือก Places API (New) อย่างเดียว', 'คัดลอกคีย์ → ตั้งเป็น Secret ชื่อ GOOGLE_MAPS_API_KEY (Google ให้ใช้ฟรีเดือนละหลายพันครั้ง ระบบจำผลค้นหาไว้ 6 ชม. เพื่อประหยัด)', '(ถ้าต้องการตอบรีวิวจากแอป) business.google.com ยืนยันโชว์รูม → ขอสิทธิ์ Business Profile API ผ่านแบบฟอร์มของ Google แล้วบอก Claude'],
    cannot: ['แชตผ่าน Google (Business Messages) Google ปิดบริการแล้วตั้งแต่ปี 2024', 'ลบรีวิวลูกค้าเองไม่ได้ (รายงานรีวิวไม่เหมาะสมได้เท่านั้น)', 'ซื้ออันดับใน Google Maps ไม่ได้'],
  },
]

export const LEVELS = { team: '👥 ทีม/บริษัท', showroom: '🏢 โชว์รูม', sales: '🧑‍💼 เซลส์' }
export const ACCOUNT_PLATFORMS = {
  facebook: '📘 Facebook เพจ', instagram: '📸 Instagram', line: '💚 LINE OA', tiktok: '🎵 TikTok', google: '📍 Google Maps', youtube: '▶️ YouTube', other: '📌 อื่นๆ',
}
