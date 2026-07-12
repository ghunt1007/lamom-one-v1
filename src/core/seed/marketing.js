// Demo seed data — marketing module (split from demoSeedData.js for maintainability)
// ห้าม import อะไรจาก db.js — รับ demoCol เป็นพารามิเตอร์เพื่อกัน circular import
export function runSeed(demoCol) {

  const addDaysISO = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
  const now = new Date()

  // Marketing campaigns (หน้า /marketing/campaigns)
  const marketingCampaigns = [
    { id:'C001', name:'BYD Seal Launch Sale มิ.ย.', type:'social', status:'active', budget:50000, spent:32000, reach:45200, clicks:1230, leads:87, sales:5, startDate:'2025-06-01', endDate:'2025-06-30', target:'EV Enthusiast 25-45', channels:['Facebook','TikTok'], note:'Boost ทุกวันจันทร์-ศุกร์' },
    { id:'C002', name:'LINE OA Broadcast – ลูกค้าเก่า', type:'line', status:'active', budget:5000, spent:4800, reach:3200, clicks:340, leads:28, sales:2, startDate:'2025-06-05', endDate:'2025-06-30', target:'ลูกค้าเก่าทุกคน', channels:['LINE OA'], note:'' },
    { id:'C003', name:'Mid-Year Sale Google Ads', type:'google', status:'planned', budget:80000, spent:0, reach:0, clicks:0, leads:0, sales:0, startDate:'2025-07-01', endDate:'2025-07-31', target:'Search: EV ราคา', channels:['Google Search','Google Display'], note:'ใช้ keyword EV ราคาถูก' },
    { id:'C004', name:'Motor Expo Thailand', type:'event', status:'ended', budget:200000, spent:185000, reach:12000, clicks:0, leads:245, sales:18, startDate:'2025-05-15', endDate:'2025-05-25', target:'งานแสดงรถ', channels:['Offline'], note:'บูธ B12 ฮอลล์ 3' },
    { id:'C005', name:'Email Newsletter มิ.ย.', type:'email', status:'draft', budget:2000, spent:0, reach:0, clicks:0, leads:0, sales:0, startDate:'2025-06-15', endDate:'2025-06-15', target:'รายชื่อ Email ทั้งหมด', channels:['Email'], note:'' },
  ]
  marketingCampaigns.forEach(c => { if (!demoCol('marketing_campaigns')[c.id]) demoCol('marketing_campaigns')[c.id] = c })


  // Content calendar (หน้า /marketing/content)
  const contentCalendar = [
    { id:'CT001', title:'รีวิว BYD Seal: ขับแล้วเป็นยังไง?', type:'reel', platforms:['facebook','instagram','tiktok'], status:'published', publishDate:addDaysISO(-3), author:'ทีมคอนเทนต์', tags:['review','byd','ev'], views:12400, likes:856, shares:123 },
    { id:'CT002', title:'5 เหตุผลที่ควรเปลี่ยนมาใช้ EV', type:'blog', platforms:['website','facebook'], status:'published', publishDate:addDaysISO(-7), author:'สมชาย Content', tags:['ev','education'], views:3280, likes:142, shares:89 },
    { id:'CT003', title:'โปรโมชันพิเศษเดือนนี้', type:'post', platforms:['facebook','instagram','line'], status:'scheduled', publishDate:addDaysISO(1), author:'ทีมการตลาด', tags:['promotion','sale'], views:0, likes:0, shares:0 },
    { id:'CT004', title:'Behind the Scene: การส่งมอบรถ', type:'story', platforms:['instagram','facebook'], status:'in_progress', publishDate:addDaysISO(3), author:'ทีมคอนเทนต์', tags:['delivery','story'], views:0, likes:0, shares:0 },
    { id:'CT005', title:'Newsletter: ข่าว EV ประจำเดือน', type:'email', platforms:['website'], status:'review', publishDate:addDaysISO(5), author:'สุดา Marketing', tags:['newsletter','monthly'], views:0, likes:0, shares:0 },
    { id:'CT006', title:'TikTok: ชาร์จรถไฟฟ้าแบบไหนคุ้มสุด?', type:'reel', platforms:['tiktok','youtube'], status:'planned', publishDate:addDaysISO(7), author:'ทีมคอนเทนต์', tags:['ev','tips','charging'], views:0, likes:0, shares:0 },
    { id:'CT007', title:'Google Ads: BYD Atto 3 Test Drive', type:'ads', platforms:['website'], status:'published', publishDate:addDaysISO(-14), author:'ปทิตา SEM', tags:['ads','testdrive'], views:28000, likes:0, shares:0 },
  ]
  contentCalendar.forEach(c => { if (!demoCol('content_calendar')[c.id]) demoCol('content_calendar')[c.id] = c })


  // Marketing platform reviews (หน้า /marketing/reviews) — คนละหน้ากับ /quality/satisfaction ด้านล่าง
  const daysAgoISO = n => new Date(Date.now() - n * 86400000).toISOString()

  // Digital showroom (หน้า /marketing/digital-showroom)
  const showroomCars = [
    { id:'DS001', model:'BYD Atto 3', badge:'EV', colors:['#1565c0','#212121','#f5f5f5','#c62828'], views360:true, video:true,  views:4820, leads:142, conv:2.9, featured:true  },
    { id:'DS002', model:'BYD Seal AWD', badge:'EV', colors:['#212121','#b0bec5','#1b5e20'],       views360:true, video:true,  views:3210, leads:98,  conv:3.1, featured:true  },
    { id:'DS003', model:'BYD Dolphin', badge:'EV', colors:['#f5f5f5','#1565c0','#e91e63'],        views360:true, video:false, views:2880, leads:76,  conv:2.6, featured:false },
    { id:'DS004', model:'BYD Han', badge:'EV', colors:['#212121','#1b5e20'],                      views360:false,video:true,  views:1640, leads:44,  conv:2.7, featured:false },
    { id:'DS005', model:'MG ZS EV', badge:'EV', colors:['#f5f5f5','#c62828','#9e9e9e'],           views360:true, video:true,  views:2100, leads:58,  conv:2.8, featured:false },
    { id:'DS006', model:'BYD Atto 3 Pro', badge:'NEW', colors:['#1565c0','#212121','#ffd600'],    views360:true, video:false, views:980,  leads:31,  conv:3.2, featured:true  },
  ]
  showroomCars.forEach(c => { if (!demoCol('digital_showroom')[c.id]) demoCol('digital_showroom')[c.id] = c })


  // Event check-in visitors (หน้า /marketing/event-checkin)
  const minutesAgoISO = n => new Date(Date.now() - n * 60000).toISOString()

  // Marketing events (หน้า /marketing/events)
  const evAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // Lead generation campaigns (หน้า /marketing/lead-generation)
  const lgAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  // LINE OA broadcasts + auto-replies (หน้า /marketing/line-oa)
  const loAddDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

  // Social Hub posts (หน้า /marketing/social-hub)
  const socialPosts = [
    { id:'P001', content:'🔥 BYD Seal AWD ราคาพิเศษ 1,299,000 บาท\n✅ ดอกเบี้ย 2.79% ผ่อน 20,420 บาท/เดือน\n📞 ติดต่อ: 02-123-4567\n#EV #BYD #LAMOMONE', platforms:['facebook','instagram'], status:'published', scheduledAt:'2025-06-05 09:00', publishedAt:'2025-06-05 09:01', likes:234, comments:18, shares:45, reach:12400, image:null },
    { id:'P002', content:'🎯 ทดลองขับฟรี MG4 X\n📅 10 มิ.ย. 2025 เวลา 10:00-17:00\n📍 โชว์รูม LAMOM ONE สาขาหลัก\n#TestDrive #MG4', platforms:['facebook','line','tiktok'], status:'scheduled', scheduledAt:'2025-06-09 08:00', publishedAt:null, likes:0, comments:0, shares:0, reach:0, image:null },
    { id:'P003', content:'💬 ขอบคุณรีวิวจาก คุณสมชาย ใจดี\n"ประทับใจมาก ทีมงานดูแลดีมาก"\n🚗 BYD Seal AWD\n#CustomerReview', platforms:['facebook','instagram'], status:'draft', scheduledAt:null, publishedAt:null, likes:0, comments:0, shares:0, reach:0, image:null },
    { id:'P004', content:'🥳 ยินดีต้อนรับสู่ครอบครัว EV!\nคุณวิชัย เดินดี รับรถ MG4 X สีดำ 🚗✨\n#NewCarDay #MG4 #LAMOMONE', platforms:['facebook','tiktok'], status:'published', scheduledAt:'2025-06-02 10:00', publishedAt:'2025-06-02 10:01', likes:567, comments:42, shares:88, reach:28900, image:null },
  ]
  socialPosts.forEach(p => { if (!demoCol('social_posts')[p.id]) demoCol('social_posts')[p.id] = p })

}
