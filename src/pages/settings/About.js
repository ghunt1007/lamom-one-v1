import { showToast } from '../../core/store.js'

const MODULES = [
  { icon:'👥', name:'CRM & การขาย', pages:37, color:'primary' },
  { icon:'🚗', name:'DMS / โชว์รูม', pages:39, color:'accent' },
  { icon:'🔧', name:'ศูนย์บริการ', pages:33, color:'warning' },
  { icon:'💰', name:'การเงิน', pages:40, color:'success' },
  { icon:'📣', name:'การตลาด', pages:18, color:'primary' },
  { icon:'👤', name:'HR & องค์กร', pages:28, color:'accent' },
  { icon:'📈', name:'Analytics', pages:23, color:'success' },
  { icon:'🤖', name:'AI Officers', pages:9, color:'warning' },
  { icon:'🛡', name:'ประกัน', pages:6, color:'danger' },
  { icon:'🎓', name:'Training', pages:9, color:'primary' },
  { icon:'🎮', name:'Gamification', pages:6, color:'accent' },
  { icon:'💬', name:'สื่อสาร', pages:8, color:'success' },
  { icon:'📋', name:'Quality & PDPA', pages:9, color:'warning' },
  { icon:'🤝', name:'B2B & Partner', pages:9, color:'primary' },
  { icon:'📄', name:'เอกสาร', pages:5, color:'accent' },
  { icon:'⚙️', name:'ระบบ & ตั้งค่า', pages:21, color:'primary' },
]

const CHANGELOG = [
  { ver:'1.0.79', date:'2026-07-03', label:'ล่าสุด', changes:['🔒 ความปลอดภัย: userDb (ระบบผู้ใช้ภายใน) เก็บรหัสผ่านเป็น plaintext ใน localStorage มาตลอด — เปลี่ยนเป็น SHA-256 hash + salt ต่อผู้ใช้ ครอบคลุมทั้ง createUser/setPassword/verifyLogin/changeOwnPassword, ผู้ใช้เก่าที่ยังเป็น plaintext จะถูกอัปเกรดเป็น hash อัตโนมัติทันทีที่ login สำเร็จครั้งถัดไป (ไม่ต้องทำอะไรเพิ่ม)', 'ทดสอบครบ 8 เคสก่อนขึ้น production: สร้างผู้ใช้ใหม่ไม่มี plaintext หลงเหลือ, login ถูก/ผิดรหัส, ตรวจรหัสปัจจุบันตอนเปลี่ยนรหัสเอง, เปลี่ยนรหัสเอง+ห้ามซ้ำเดิม, admin ตั้งรหัสใหม่ให้ผู้ใช้อื่น, migration จาก legacy record — ทดสอบทั้งเรียกฟังก์ชันตรงและผ่านหน้าจอจริง (สร้างผู้ใช้/รีเซ็ตรหัสผ่านจาก User Management)'] },
  { ver:'1.0.78', date:'2026-07-03', label:'', changes:['แก้: ข้อความ error ตอน login มองไม่เห็น — Toast container เดิม mount หลัง login สำเร็จเท่านั้น ทำให้กรอกรหัสผิดแล้วเงียบสนิท ไม่มี feedback ใดๆ (เจอจากทดสอบบน production จริง) ตอนนี้ mount ตั้งแต่เปิดแอป + แก้ toast เด้งซ้ำหลัง login-logout วนหลายรอบ', 'Service Worker: CACHE_NAME ผูกกับเวอร์ชันจาก package.json อัตโนมัติตอน build (เดิมค้างที่ v1.0.70 มา 7 releases ทำให้ cache เก่าสะสมใน storage ผู้ใช้ไม่มีวันถูกล้าง) + /sw.js เสิร์ฟแบบ no-cache ให้ browser เห็น SW ใหม่ทันทีหลัง deploy', 'ยืนยันบน production จริงผ่าน Chrome: login email/password ใช้งานได้ (Firebase ตอบถูกต้อง — ไม่ต้องตั้ง authorized domain สำหรับ email/password), Global Search (Ctrl+K) ค้นข้ามทุก collection + นำทางได้, Theme Picker สลับและจำธีมถูกต้อง', 'CI: อัป Node 20 → 22 ใน GitHub Actions (Node 20 ถูก deprecate บน runners)'] },
  { ver:'1.0.77', date:'2026-07-02', label:'', changes:['🆕 ตารางดอกเบี้ยไฟแนนซ์ (/finance/rate-sheets): อัปโหลดรูปตารางโปรโมชั่น → Gemini AI วิเคราะห์แยก ธนาคาร/แคมเปญ/ยี่ห้อ/รุ่น/ปี/เดือน/ช่วงวันที่/เงื่อนไข/คอมไฟแนนซ์/Extra/Subsidy → ผู้ใช้ตรวจสอบแก้ไขทีละรายการก่อนบันทึก (สถานะ "รอตรวจสอบ" → กดยืนยันอีกชั้น)', 'ระบบแจ้งเตือนทำงานจริงทั้งวงจร: จุดแดงกระดิ่งผูกกับจำนวนยังไม่อ่านจริง (reactive ไม่ต้อง reload), คลิกแจ้งเตือนในแผง popup นำทางไปหน้าที่เกี่ยวข้อง, รายการ AI รอตรวจสอบสร้างแจ้งเตือนอัตโนมัติพร้อม deep link', 'Responsive จอแคบ/มือถือ: grid คอลัมน์ fix-px ยุบเป็นคอลัมน์เดียว, แถบปุ่ม flex ขึ้นบรรทัดใหม่อัตโนมัติ, แก้ Fleet GPS (aspect-ratio+min-height ดันจอ), Break-even, Shift Schedule — ตรวจครบ 308 หน้าไม่มีล้นจอ', 'แก้: Org Chart เลื่อนแนวนอนได้เมื่อผังกว้าง, แก้ไข rate sheet ไม่รีเซ็ตสถานะเป็นยืนยันเอง, Notification Center ไม่แสดง "undefined" ที่แท็บกรอง'] },
  { ver:'1.0.76', date:'2026-07-01', label:'', changes:['Cloudflare Pages ย้ายไปโปรเจกต์ชื่อสั้นลง: lamom-one.pages.dev (จากเดิม lamom-one-v1.pages.dev) — อัปเดต GitHub Actions ให้ deploy ไปโปรเจกต์ใหม่', 'แก้ layout ทั้งระบบ: .page-content ไม่ถูกจำกัดความกว้างอีกต่อไป, แก้ .main-wrap flex min-width bug ที่ทำให้เนื้อหาล้นจอโดยเลื่อนดูไม่ได้ (ยืนยันแล้วทุก 307 หน้า), Sidebar ไม่เด้งไปบนสุดเวลาเปลี่ยนหน้าอีกต่อไป', 'แก้บั๊กแถบเปอร์เซ็นต์ล้นจอ 3 หน้า: Performance Review (คำนวณคะแนน ×10 ซ้ำ), Stock Analysis (เป้าหมายเกิน 100%), Branch Comparison (ข้อมูลคนละชุดกับตัวคำนวณ max)', 'Bookings: แถบสถานะแสดงครบทุกสถานะเสมอ, การ์ดแบรนด์แสดงเฉพาะแบรนด์ที่มีการจองจริง', 'Vehicle Comparison: เปลี่ยนจากรถตัวอย่าง 5 คัน เป็นเลือกได้จากฐานข้อมูลจริงทั้ง 140 รุ่น'] },
  { ver:'1.0.74', date:'2026-06-30', label:'', changes:['db.js seedDemoData: เพิ่ม 16 collections ที่ขาดหาย — walk_ins, appointments, referrals, referrers, quotations, car_photos, price_history, model_year_changeovers, parts_inventory, petty_cash (fix cat values), finance_banks, monthly_close_items, vat_invoices, purchase_orders, documents, fleet_deals → ทุก 309 หน้าแสดงข้อมูล demo ครบ', 'About.js: แก้ module page counts (CRM 37, DMS 39, Finance 40 ฯลฯ), version badge 1.0.73→1.0.74, Vite 8 + Firebase 12'] },
  { ver:'1.0.73', date:'2026-06-30', label:'', changes:['modal.js: แก้ async onConfirm bug — confirm handler เป็น sync เดิม ทำให้ async onConfirm() คืน Promise (truthy) → modal ปิดทันทีโดยไม่รอ validation; แก้เป็น async handler + await + loading state + error recovery', 'router.js: แก้ silent .catch(()=>{}) → .catch(e => console.error) เพื่อให้เห็น error ของ page ทุกหน้า', 'firestore.indexes.json: เพิ่ม 2 composite indexes (bookings+deliveryDate, custom_fields+order) + firebase deploy --only firestore:indexes'] },
  { ver:'1.0.72', date:'2026-06-30', label:'', changes:['PersonalAI.js: Agentic OS redesign — fullscreen overlay, orbital animation, one-shot mic, 5-button layout, camera cleanup, TTS streaming', 'ai.js: SSE streaming Gemini 2.5 Flash, 429 retry wait 8s, extractMemories ทุก 3 message, TTS Google Translate fallback สำหรับ Thai', 'voice.js: TTS Thai voice selection + chunk splitting 150 chars, STT SpeechRecognition API'] },
  { ver:'1.0.71', date:'2026-06-29', label:'', changes:['Login.js: แก้ meta/init doc check สำหรับ first-user detection, แก้ Firestore collection query permission', 'auth.js: initAuth — initialized flag ป้องกัน bootstrapShell ซ้อน, hasPermission แก้ CJS→ESM import getState'] },
  { ver:'1.0.70', date:'2026-06-29', label:'', changes:['First-user setup — เพิ่มฟอร์ม "สร้างบัญชีใหม่" บนหน้า Login สำหรับเจ้าของระบบ (owner คนแรก), Firebase Auth authorized domain: lamom-one-v1.pages.dev ✓, Firebase Storage ลบออก — ใช้ Cloudflare R2 แทน (Spark plan ฟรี)'] },
  { ver:'1.0.69', date:'2026-06-29', label:'', changes:['Production Deployment สมบูรณ์ — Firebase project lamom-one-v1 สร้างใหม่ (Firestore asia-southeast1 + 42 indexes + rules deployed), Gemini 2.5 Flash AI (รุ่นใหม่ล่าสุด ฟรีตลอดไป), GitHub repo ghunt1007/lamom-one-v1 + GitHub Actions auto-deploy, Cloudflare Pages lamom-one-v1.pages.dev (live 24/7 ฟรี), GitHub Secrets ครบ (Firebase + Gemini + Cloudflare)'] },
  { ver:'1.0.68', date:'2026-06-29', label:'', changes:['Cloud Deployment Stack — เปลี่ยน AI Engine จาก Claude API → Google Gemini 2.5 Flash (ฟรีตลอดไป), สร้าง Cloudflare R2 Upload Worker (workers/r2-upload.js) พร้อม storage.js utility สำหรับ file upload ทุกหน้า, เพิ่ม public/_redirects + public/_headers สำหรับ Cloudflare Pages SPA routing + security headers, wrangler.toml สำหรับ deploy R2 Worker'] },
  { ver:'1.0.67', date:'2026-06-29', label:'', changes:['P31 ตรวจสอบความสมบูรณ์ระบบ — ยืนยัน 308 pages ผ่าน build ✓ 361 modules ไม่มี error, ไม่มี stub pages, ไม่มี Coming Soon screens, ทุก page มี demo data fallback + Firestore integration, ทุก import จาก db.js ถูกต้อง (createDoc/listDocs/updateDocData/seedDemoData/getSalesData/getCommissionData), router.js มี 308 routes ครบทุก page, Kanban Pipeline + drag-drop, Leave workflow + approval, Attendance 30-day demo, Complaints + SLA tracking ทุกอย่างครบสมบูรณ์'] },
  { ver:'1.0.66', date:'2026-06-29', label:'', changes:['P30 Demo Seed Data Batch 3 + Indexes — เพิ่ม price_negotiations, voice_notes, surveys, welfare, vendor_payments, receipts, landing_pages, utm_links ใน seedDemoData() + firestore.indexes.json เพิ่ม 13 indexes ใหม่ (vehicles+model, bookings+brand, test_drives+date, trade_ins, bank_transactions+matched, plate_tracking, price_negotiations, voice_notes, broadcasts, surveys, comm_messages+channel)', 'Dashboard monthly chart — ดึงข้อมูลจริงจาก sales (bookings) แทน hardcode ค่า static — แสดงจำนวน/เดือนจริง ปีปัจจุบัน พร้อม skeleton loader ระหว่างโหลด'] },
  { ver:'1.0.65', date:'2026-06-29', label:'', changes:['P29 Demo Seed Data Batch 2 — เพิ่ม 24 collections ใหม่ใน seedDemoData(): vehicle_models, stock, reservations, vehicle_reservations, consignments, trade_ins, used_cars, test_drives, test_drive_certs, vehicle_transfers, vehicle_receiving, stock_audit, suppliers, bank_transactions, plate_tracking, floor_plan, model_configs, special_editions, licenses, gov_docs, homologations, comm_messages, broadcasts, sms_campaigns, customer_areas — ทุก DMS+Comms page ไม่แสดง empty state ใน demo mode'] },
  { ver:'1.0.64', date:'2026-06-29', label:'', changes:['P28 Dashboard Live Data — Today panel + Activity Feed ดึงข้อมูลจริงจาก Firestore (bookings/pdi/job_cards/tasks/customers) แทน hardcode', 'Demo Seed Data Expansion — เพิ่ม 20+ collections ใหม่: action_plans, complaints, csat, customer_notes, deals, service_appointments, accessories, demo_fleet, keys, assets, deposits, expense_approvals, commission_rules, debts, leave_requests, call_logs, chat_templates, escalation_rules, meeting_minutes, fleet_accounts, fleet_vehicles, corporate_quotes, leasing_contracts, gov_bids, partner_commissions', 'format.js — timeAgo/formatDate/formatDateTime รองรับ Firestore Timestamp objects (v?.toDate())', 'firestore.indexes.json — เพิ่ม 29 composite indexes สำหรับ production deployment (status+createdAt, assignedTo+status, userId+createdAt ฯลฯ)'] },
  { ver:'1.0.63', date:'2026-06-29', label:'', changes:['P27 Firebase App Check — เพิ่ม initializeAppCheck() ด้วย ReCaptchaV3Provider ใน firebase.js (conditional: เปิดใช้เมื่อ VITE_FIREBASE_APP_CHECK_KEY ตั้งค่าใน .env — ป้องกัน unauthorized Firebase API calls จากแอปปลอม)', '.env.example: เพิ่ม VITE_FIREBASE_APP_CHECK_KEY พร้อมคำอธิบายวิธีตั้งค่า reCAPTCHA v3 + Firebase Console'] },
  { ver:'1.0.62', date:'2026-06-29', label:'', changes:['P26 XSS sweep (สมบูรณ์) — escHtml() เพิ่มใน 12 ไฟล์ที่เหลือ: comms/EscalationRules, comms/ChatTemplates, hr/ShiftSchedule, b2b/B2BPortal, b2b/FleetGps, b2b/LeasingManagement, b2b/GovBidding, b2b/CorporateQuote, b2b/PartnerCommission, b2b/FleetManagement, quality/QualityCompliance, ai/AiOfficers — ครอบ Firestore string data ใน innerHTML ทุก context ครบสมบูรณ์'] },
  { ver:'1.0.61', date:'2026-06-29', label:'', changes:['Security: deepSanitize() ใน db.js — strip <script> tags + on* event handlers จาก string values ทั้งหมดก่อน addDoc/updateDoc (ป้องกัน stored XSS ผ่าน Firestore)', 'Security: auth.js — first Firebase Auth user auto-gets owner role, subsequent new users get staff (แก้ช่องโหว่ทุก signup ได้ owner)', 'Auth: auth.js — import getDocs/query/limit เพิ่มเพื่อ check existingUsers'] },
  { ver:'1.0.60', date:'2026-06-29', label:'', changes:['P26 XSS sweep — analytics/ (ครบทุกไฟล์): escHtml() ครอบ Firestore string data ใน StockAnalysis (m.name จาก brand+model), DailyReport (t.name จาก salesperson), PartsAnalytics (p.name จาก parts_inventory ใน table+dead stock alert) + ยืนยัน safe: ConversionFunnel/ServiceAnalytics/AnalyticsDashboard/CustomerJourney/OperationsDashboard (numeric/static only)', 'P26 XSS sweep — settings/ (21 ไฟล์): ยืนยัน SAFE ทั้งหมด — ไม่มี Firestore reads (listDocs/getDocs/getDoc)', 'P26 XSS sweep — dms/ (ครบทุกไฟล์): DealerLicense/PriceHistory/GovDocs/FloorPlanFinance/ModelConfig/KeyManagement/VehicleTransfer/TradeIn/VinDecoder'] },
  { ver:'1.0.59', date:'2026-06-28', label:'', changes:['P26 XSS sweep — finance/ (ครบทุกไฟล์): escHtml() ครอบ Firestore string data ใน MonthlyClose (category/name/responsible/id), FinancialGoals (title/unit ใน card+modal), LoanCalculator (bank name จาก Firestore), TargetActual (salesperson name จาก getSalesData) + skip safe-only files (EnergyUtility/MultiCurrency/PL/BankPartners/BreakEven/BudgetPlanning/ChargingCost/ChargingRevenue)'] },
  { ver:'1.0.58', date:'2026-06-28', label:'', changes:['importExport.js: เขียนใหม่ทั้งหมดด้วย ExcelJS (dynamic import) แทน xlsx ที่มี High CVE — รองรับ export/import .xlsx/.csv + template download + drag-drop import modal UI', 'ai.js (NEW): Claude API integration — askLami(), analyzeCustomer(), generateDailySummary(), suggestPrice() + keyword fallback demo mode เมื่อไม่มี VITE_CLAUDE_API_KEY', 'sessionTimeout.js (NEW): auto-logout 30 นาที + warning toast 25 นาที + reset on user activity', 'LamiBrain.js: เชื่อม askLami() จริง — sendMessage() เป็น async + typing indicator + escHtml() chat bubbles + AI_ENABLED badge', 'main.js: initSessionTimeout(logout) ใน bootstrapShell() + destroySessionTimeout() ตอน logout', '.env.example: เพิ่ม VITE_CLAUDE_API_KEY + VITE_CLAUDE_MODEL docs'] },
  { ver:'1.0.57', date:'2026-06-28', label:'', changes:['TestDriveScheduler.js: escHtml() ครอบ booking.customerName/model/staff/id ใน timeline + b.customerName/phone/model/time/staff/id ในตาราง+ปุ่ม + modal title→concat + row() calls b.model/time/staff/phone/notes (CRITICAL)', 'VehicleAging.js: escHtml() ครอบ r.vin/model/color ในตาราง + data-vin/data-model + modal title→concat + input value (Firestore)', 'UsedCar.js: escHtml() ครอบ c.buyer (CRITICAL) ใน buyerLine + c.id ในปุ่ม + c.brand/model/plate ในการ์ด + modal title+body c.plate (Firestore)', 'VehicleComparison.js: escHtml() ครอบ v.id/brand/model/variant ใน toggle buttons + car.brand/model/variant ใน header + val||"-" (text) + feat/pros/cons (Firestore array)', 'VehicleReservation.js: escHtml() ครอบ r.customer/phone/model/color/staff/stockId ในการ์ด + data-id (r.id) ทุกปุ่ม (Firestore)'] },
  { ver:'1.0.56', date:'2026-06-26', label:'', changes:['ReserveLock.js: escHtml() ครอบ v.model/v.color/v.vin/v.customer/v.agent ในการ์ด+filter options+openLockModal select+unlock modal (Firestore CRITICAL customer)', 'SpecialEdition.js: escHtml() ครอบ e.name/e.model/e.color/u.vin/u.customer ในการ์ด+unit row + modal title (Firestore CRITICAL)', 'StockAudit.js: escHtml() ครอบ s.model/s.vin/s.systemLoc ในรายการ+missing banner + data-id attrs (Firestore)', 'StockValuation.js: escHtml() ครอบ s.brand/s.model/s.variant/s.color/s.vin/s.branch ในตาราง + brand summary + branch filter (Firestore)', 'TdCert.js: escHtml() ครอบ c.customer/c.phone/c.model/c.plate/c.km/c.fuel/c.staff/c.damage ในรายการ+detail modal + print popup (Firestore CRITICAL print window)'] },
  { ver:'1.0.55', date:'2026-06-26', label:'', changes:['PlateTracking.js: escHtml() ครอบ r.customer/r.model/r.vin/r.redPlate/r.newPlate/r.note ในการ์ด+overdue banner (Firestore CRITICAL note)', 'PriceList.js: escHtml() ครอบ m.brand/m.model/m.type/m.colors ในการ์ด+openDetail modal+compare table + modal titles (Firestore)', 'QrVehicle.js: escHtml() ครอบ v.model/v.color/v.vin/v.plate/v.promo/spec keys+vals/service.type+by+note ในการ์ด+openVehicleDetail modal (Firestore CRITICAL promo+service.note)'] },
  { ver:'1.0.54', date:'2026-06-26', label:'', changes:['CarPhotos.js: escHtml() ครอบ c.model/c.vin ในการ์ด + modal title (Firestore)', 'ConsignmentVehicle.js: escHtml() ครอบ i.owner/i.phone/i.model/i.plate ในตาราง + closeSale modal title (Firestore)', 'DeliveryCalendar.js: escHtml() ครอบ d.model/d.color/d.vin/d.customer/d.phone/d.staff ในการ์ด (Firestore customerName CRITICAL)', 'DemoFleet.js: escHtml() ครอบ c.model/c.plate/c.note ในการ์ด+insExpiring banner+modal title (Firestore CRITICAL note)', 'DmsDashboard.js: escHtml() ครอบ v.brand/v.model/v.color/v.status ใน recent stock list (Firestore)', 'Homologation.js: escHtml() ครอบ r.model/r.standard/r.category/r.certNo/r.agency/r.note ในตาราง+modal (Firestore CRITICAL note)', 'ModelYearChangeover.js: escHtml() ครอบ c.model/c.changes ในการ์ด+modal title+data-attr (Firestore)', 'PDI.js: escHtml() ครอบ p.brand/p.model/p.color/p.vin/p.techName ในตาราง+modal title + defects/notes ใน modal body (Firestore CRITICAL)'] },
  { ver:'1.0.53', date:'2026-06-26', label:'', changes:['DuplicateManager.js: escHtml() ครอบ r.name/r.phone/r.email/r.source ในการ์ด + merge modal (Firestore customerName)', 'FleetCorporate.js: escHtml() ครอบ d.company/d.contact/d.phone/d.sales/d.model/d.notes ใน dealCard+viewDeal modal (Firestore CRITICAL)', 'LoyaltyTiers.js: escHtml() ครอบ m.name ในตาราง + modal title + h.desc ใน history (Firestore customerName)', 'QuotationCompare.js: escHtml() ครอบ m.name ใน pick buttons+data-m attr+table header (Firestore vehicle name)', 'ReferralProgram.js: escHtml() ครอบ r.referrer/r.referee/r.model ในการ์ด (Firestore customerName)', 'ReferralQr.js: escHtml() ครอบ r.name/r.phone/r.code/sel.name/sel.code/sel.qrUrl ในการ์ด+QR panel+print popup (Firestore)', 'VipClub.js: escHtml() ครอบ v.name ในการ์ด + modal title (Firestore customerName CRITICAL)'] },
  { ver:'1.0.52', date:'2026-06-26', label:'', changes:['Anniversary.js: escHtml() ครอบ c.name/c.phone/c.model ในการ์ด+modal (Firestore customerName)', 'BirthdayGreetings.js: escHtml() ครอบ e.customer/e.note/e.model/e.phone ในการ์ด+tpl+modal title (Firestore customerName CRITICAL)', 'ChurnPrediction.js: escHtml() ครอบ c.name/c.model/c.sales ในการ์ด (Firestore customerName)', 'Csat.js: escHtml() ครอบ r.customer/r.model/r.comment ในรีวิว (Firestore feedback CRITICAL)', 'CustomerLifecycle.js: escHtml() ครอบ c.name/c.model/c.nextAction ในตาราง+modal', 'CustomerLifetimeValue.js: escHtml() ครอบ c.name ในตาราง+modal title', 'CustomerLoyalty.js: escHtml() ครอบ m.name/m.phone/m.vehicles/h.desc ใน table+modal+select'] },
  { ver:'1.0.51', date:'2026-06-26', label:'', changes:['CommInbox.js: escHtml() ครอบ m.avatar (Firestore d.avatar field)', 'DocumentStudio.js: escHtml() ครอบ type/status fallback labels ใน renderList()+openDocEditor() (Firestore d.type/d.status unknown keys)', 'VehicleOrders.js: escHtml() ครอบ o.status fallback label ใน tableRow()+openDetail() (Firestore unknown status)'] },
  { ver:'1.0.50', date:'2026-06-26', label:'', changes:['WinBack.js: escHtml() ครอบ t.customer+t.phone ในการ์ด + modal title (Firestore customerName CRITICAL)', 'MeetingMinutes.js: escHtml() ครอบ statusBadge() fallback label (Firestore d.status unknown value)'] },
  { ver:'1.0.49', date:'2026-06-26', label:'', changes:['CommHub.js: escHtml() ครอบ m.author/m.role/m.content ใน renderMessages (user-typed chat CRITICAL)', 'NotificationCenter.js: escHtml() ครอบ n.title+n.body (Firestore notifications)', 'AccessoryShop.js: escHtml() ครอบ a.name ในการ์ด + c.name ใน openCart (Firestore)', 'PurchaseOrder.js: escHtml() ครอบ o.title/o.id/o.supplier ในการ์ด+detail + o.approvedBy (Firestore+form input)'] },
  { ver:'1.0.48', date:'2026-06-26', label:'', changes:['Broadcast.js: escHtml() ครอบ b.title/b.target fallback/b.message ในการ์ด + bc.id/bc.title/bc.target/bc.message ใน openDetail modal (CRITICAL user-typed)', 'SMSMarketing.js: escHtml() ครอบ c.name+c.message ในการ์ด (CRITICAL user-typed SMS content)'] },
  { ver:'1.0.47', date:'2026-06-26', label:'', changes:['DeliveryNote.js: escHtml() ครอบ getBranches()+getSalesStaff() datalist values ใน openDNForm (ครบ consistent กับ openScheduleForm)'] },
  { ver:'1.0.46', date:'2026-06-26', label:'', changes:['Bookings.js: escHtml() ครอบ b.bookingNo ใน modal title + b.status ใน badge body + bkNo ใน edit modal title', 'Stock.js: escHtml() ครอบ v.brand/v.model/v.color ใน openDetail+QR modal titles + st.label fallback (Firestore v.status)'] },
  { ver:'1.0.45', date:'2026-06-26', label:'', changes:['BayManagement.js: escHtml() ครอบ b.job/b.car/b.tech ใน bayCard+openBay modal — b.tech เป็น user input CRITICAL', 'ServiceDashboard.js: escHtml() ครอบ j.custName/j.brand/j.model/j.status ใน active jobs (Firestore)', 'StaffDocuments.js: escHtml() ครอบ d.staff/d.name (user-typed CRITICAL) + search value attr', 'WarrantyManagement.js: escHtml() ครอบ searchQ ใน search value attr'] },
  { ver:'1.0.44', date:'2026-06-26', label:'', changes:['CashFlow.js: escHtml() ครอบ f.desc ในตาราง+chart title attr / f.date / f.cat fallback — CRITICAL user-input modal desc', 'ExpenseApproval.js: escHtml() ครอบ title/submittedBy/dept/notes ในการ์ด+modal body + modal title e.id (concat) + row() call sites approvedBy/notes', 'PettyCash.js: escHtml() ครอบ t.desc (CRITICAL) / t.by ใน transaction cards'] },
  { ver:'1.0.43', date:'2026-06-26', label:'', changes:['SECURITY: สร้าง firestore.rules — RBAC ครบ 30+ collections (owner/admin/manager/finance/hr/service/staff)', 'SECURITY: สร้าง storage.rules — type+size validation สำหรับ image/PDF/Excel uploads', 'SECURITY: เพิ่ม CSP+HSTS+Permissions-Policy ใน firebase.json headers + อ้างอิง rules files', 'SECURITY: npm audit fix — แก้ protobufjs vulnerability (xlsx ยังไม่มีแพตช์ — queue migrate ExcelJS)'] },
  { ver:'1.0.42', date:'2026-06-26', label:'', changes:['StaffProfile.js: escHtml() ครอบ name/nameEn/role/dept/email/phone/skills ใน cards+profile detail + search value attr + dept filter buttons', 'KpiManagement.js: escHtml() ครอบ name.charAt(0)/name/role/dept ใน overview+table + modal title template literal → concatenation', 'StaffLoan.js: escHtml() ครอบ staff/reason (CRITICAL user-input) ใน loan cards'] },
  { ver:'1.0.41', date:'2026-06-26', label:'', changes:['Performance.js: escHtml() ครอบ name/dept/role/period/reviewer/strengths/improvements/goals/nextGoals ใน cards+table+openDetail modal+row calls+kpi topPerformer', 'Commission.js: escHtml() ครอบ salesName/month/id ใน renderTable + s.name ใน renderSummary + data-id attrs', 'OvertimeTracking.js: escHtml() ครอบ staff/dept/reason (CRITICAL user-input) ใน OT cards'] },
  { ver:'1.0.40', date:'2026-06-25', label:'', changes:['NoClaim.js: escHtml() ครอบ customer/plate/model/insurer ในตาราง + alert banner', 'Payroll.js: escHtml() ครอบ name/dept/position ใน staffRow + dept filter buttons + openEditForm modal title', 'Attendance.js: escHtml() ครอบ staffName/shift/dept ใน renderToday + name ใน renderMonthly header + name/dept/shift ใน renderReport cards'] },
  { ver:'1.0.39', date:'2026-06-25', label:'', changes:['InsuranceClaims.js: escHtml() ครอบ id/customer/plate/model/insurer/note ใน claim cards', 'InsuranceRenewal.js: escHtml() ครอบ customerName/vehicleModel/vehiclePlate/insurer/policyNo ใน cards + openDetail title+row calls+notes + openRenewModal title+body', 'PolicyManagement.js: escHtml() ครอบ plate/model/customer/insurer/type ใน policyRow + renew modal title+body'] },
  { ver:'1.0.38', date:'2026-06-25', label:'', changes:['WaitingLounge.js: escHtml() ครอบ plate/customer/service ใน queue cards + plate ใน TV modal', 'RepairEstimate.js: escHtml() ครอบ customer/plate ใน value attr ของ form inputs', 'Insurance.js: escHtml() ครอบ policyNo/custName/brand/model/plate/insurer/type ในตาราง + modal title + dRow calls + openRenewForm + openForm value attrs'] },
  { ver:'1.0.37', date:'2026-06-24', label:'', changes:['VehicleInspection.js: escHtml() ครอบ brand/model/plate/customerName/techName ใน card + modal title + fail-note value + textarea notes', 'ActionPlan.js: upgrade esc() ให้ escape " ด้วย + fix salesFilter buttons + inp() value attr', 'CourtesyCar.js: escHtml() ครอบ plate/customer/phone/address/service/driver ใน job cards'] },
  { ver:'1.0.36', date:'2026-06-24', label:'', changes:['VehicleOrders.js: escHtml() ครอบ orderNo/brand/model/variant/color/supplier/notes ใน tableRow+openDetail+openForm value attrs', 'EVDiagnostic.js: escHtml() ครอบ vehicleModel/vehiclePlate/customerName ใน cards + modal title + notes', 'PayrollDetail.js: escHtml() ครอบ name/dept ในตาราง + openSlip modal title+body + dept filter options'] },
  { ver:'1.0.35', date:'2026-06-24', label:'', changes:['VehicleReceiving.js: escHtml() ครอบ brand/model/variant/color/vin/branch/supplier ใน card+PDI modal+detail modal', 'LostDealAnalysis.js: escHtml() ครอบ custName/phone/interestedIn/salesperson/lostTo/competitor ในตาราง+ชาร์ท+KPI+options', 'BodyRepair.js: escHtml() ครอบ plate/model/customer/insurer/damage/tech/claim ใน jobCard+detail modal+modal title'] },
  { ver:'1.0.34', date:'2026-06-24', label:'', changes:['MeetingMinutes.js: escHtml() ครอบ title/date/time/dept/attendees/agenda/minutes + actionRow task/owner ทุก injection point', 'IncidentReport.js: escHtml() ครอบ title/reporter/rootCause/action ใน incident cards', 'LoanerCar.js: escHtml() ครอบ model/plate/color/loanedTo ใน fleet + custName/phone/carModel/carPlate/jobCard ในตารางยืม'] },
  { ver:'1.0.33', date:'2026-06-24', label:'', changes:['CommInbox.js: escHtml() ครอบ sender/subject/preview ใน message list + renderMsgDetail + openReply modal title/body', 'CallLog.js: escHtml() ครอบ caller/phone/staff/note ใน call cards', 'DisciplinaryRecords.js: escHtml() ครอบ staff/dept/reason/by ในตาราง + watchlist names'] },
  { ver:'1.0.32', date:'2026-06-24', label:'', changes:['Leave.js: escHtml() ครอบ staff/from/to/reason/approvedBy ใน renderRequests + name ใน renderQuota/Calendar', 'ExpenseClaims.js: escHtml() ครอบ date/staffName/desc/rejectReason ใน renderClaims table', 'Tasks.js: escHtml() ครอบ title/desc/assignedTo ใน taskCard/openDetail/openForm + dRow() escape ภายใน'] },
  { ver:'1.0.31', date:'2026-06-24', label:'', changes:['CustomerNotes.js: escHtml() ครอบ customer/text/staff ใน timeline cards', 'ServiceAppointment.js: escHtml() ครอบ custName/model/plate/type/note/tech ใน renderApptCard/openApptForm/openApptDetail + modal title', 'QuotationBuilder.js: escHtml() ครอบ id/customerName/phone/vehicleLabel/color ในตาราง/openQuoteDetail + row() call sites'] },
  { ver:'1.0.30', date:'2026-06-24', label:'', changes:['Staff.js: escHtml() ครอบ firstName/lastName/nickname/role/dept/status/phone ใน staffCard/openDetail/openForm + dRow() escape ภายใน', 'Invoice.js: escHtml() ครอบ no/custName/date/dueDate/paidDate/items.desc/note ในตาราง/openDocDetail/openDocForm', 'PreDelivery.js: esc() ครอบ b.bookingNo/car ใน openChecklist() modal title'] },
  { ver:'1.0.29', date:'2026-06-24', label:'', changes:['TestDrive.js: escHtml() ครอบ custName/phone/vehicle/staff/note ใน today schedule/table/openDetail/openResultForm + dr() helper escape ภายใน', 'ServiceHistory.js: escHtml() ครอบ customerName/brand/model/plate/vin/technicianName/services/notes ในตาราง/openDetail + search value', 'Parts.js: escHtml() ครอบ sku/name/category/brand/unit/location ใน tableRow/openDetail/openAdjust/openForm'] },
  { ver:'1.0.28', date:'2026-06-24', label:'', changes:['ShowroomAppointment.js: escHtml() ครอบทุก field ใน renderApptCard/renderTable/openForm/openDetail (custName, phone, purpose, interestedIn, salesperson, source, note)', 'WalkIn.js: escHtml() ครอบ name/phone/staff/interestedIn/notes ใน render list', 'Pipeline.js: escHtml() ครอบ fullName/initials/interestedModel/phone ใน cardHTML + showLeadQuick popup'] },
  { ver:'1.0.27', date:'2026-06-24', label:'', changes:['Complaints.js: escHtml() ครอบทุก field ใน renderComplaintCard/openComplaintForm/openComplaintDetail (subject, custName, vehicle, assignedTo, detail, response)', 'CustomerFeedback.js: escHtml() ครอบ customerName/comment/response ใน renderList/openFeedbackDetail/openResponseModal + modal titles'] },
  { ver:'1.0.26', date:'2026-06-24', label:'', changes:['DocumentStudio.js: escHtml() ครอบ d.title ใน doc list / modal title / share modal / print window', 'SupplierManagement.js: escHtml() ครอบทุก field ใน renderSuppliers/renderPOs/renderPerformance/openSupplierDetail/openSupplierForm/openPODetail/openPOForm'] },
  { ver:'1.0.25', date:'2026-06-24', label:'', changes:['WarrantyManagement.js: escHtml() ครอบทุก field ใน renderWarranties/renderClaims/renderExpiring/openWarrantyDetail/openClaimForm/openWarrantyForm', 'DeliveryNote.js: escHtml() ครอบทุก field ใน renderPage/openDNDetail/openScheduleForm/openDeliveryConfirm + accessories/notes', 'Recruitment.js: escHtml() ครอบทุก field ใน renderJobs/renderApplicants/renderPipeline/openJobDetail/openApplicantDetail/openJobForm'] },
  { ver:'1.0.24', date:'2026-06-24', label:'', changes:['Leads.js: escHtml() ครอบทุก field ใน renderTable/openDetail/row2()/openForm + notes/lostReason', 'JobCards.js: escHtml() ครอบ tableRow/openDetail/dRow()/openForm + desc/parts', 'FollowUp.js: escHtml() ครอบ renderCard/salesperson options/openFUDetail/openResultForm + note/result'] },
  { ver:'1.0.23', date:'2026-06-24', label:'', changes:['Customers.js: escHtml() ครอบทุก Firestore field ในตาราง/modal/form + l.note (comm logs)', 'Bookings.js: escHtml() ครอบทุก field ใน tableRow() + dRow() + b.notes', 'Stock.js: escHtml() ครอบทุก field ใน tableRow/cardView/openDetail/QR modal/form values'] },
  { ver:'1.0.22', date:'2026-06-23', label:'', changes:['Dashboard.js: แก้ XSS — escHtml() ครอบ user.displayName + customer fields (firstName, lastName, interestedModel, phone, status) ก่อน inject HTML'] },
  { ver:'1.0.21', date:'2026-06-23', label:'', changes:['SmartSheet.js: แก้ XSS — _displayVal() escape เฉพาะ < ไม่ครบ → เปลี่ยนเป็น escHtml() เต็มรูป', 'SmartSheet.js: deleteSelected() + saveAll() เปลี่ยน sequential for...await → Promise.all()'] },
  { ver:'1.0.20', date:'2026-06-23', label:'', changes:['importExport.js: แก้ XSS — escHtml() ครอบ column headers + cell values ใน preview table (จากไฟล์ Excel/CSV ของผู้ใช้)'] },
  { ver:'1.0.19', date:'2026-06-23', label:'', changes:['NotifPanel.js: แก้ XSS — escHtml() ครอบ n.title/n.body ก่อน inject HTML', 'NotifPanel.js: mark-all-read เปลี่ยน sequential await → Promise.all()', 'sw.js: CACHE_NAME bump v1.0.13 → v1.0.19 (ให้ browser ล้าง cache เก่า)', 'sw.js: push icon /icons/icon-192.png → /favicon.svg (ไฟล์ที่มีจริง)'] },
  { ver:'1.0.18', date:'2026-06-23', label:'', changes:['Toast.js: แก้ XSS — escHtml() ครอบ toast.message + เปลี่ยน onclick inline → addEventListener', 'GlobalSearch.js: ดึง 9 collections ขนานกัน (Promise.all) แทน sequential await → เร็วขึ้น ~9×', 'router.js: async page cleanup — result.then(cleanup => currentCleanup) แทน result.catch เปล่า'] },
  { ver:'1.0.17', date:'2026-06-23', label:'', changes:['tableTools.js: แก้ MutationObserver batching bug — mutations ที่เข้ามาขณะ pending=true ถูกทิ้ง → เก็บ pendingNodes ก่อน RAF', 'Topbar.js: แก้ lami-chat-btn ไม่มี handler → navigate /ai/ask', 'Sidebar.js: แก้ XSS — escHtml() ครอบ displayName/email ก่อน inject HTML', 'package.json: version 0.0.0 → 1.0.17'] },
  { ver:'1.0.16', date:'2026-06-23', label:'', changes:['firebase.js: ย้าย config ไป VITE_FIREBASE_* env vars + fallback placeholder (ไม่ต้อง hardcode ใน source)', 'สร้าง .env.example template สำหรับ production setup'] },
  { ver:'1.0.15', date:'2026-06-23', label:'', changes:['แก้ auth.js: initAuth onReady ถูกเรียกซ้ำทุก auth-state-change → initRouter/bootstrapShell ซ้อน; ใส่ initialized flag', 'แก้ auth.js: hasPermission ใช้ require() (CJS) ใน ESM + getState ไม่ได้ import → return false เสมอ; import getState + fix', 'ลบ console.log SW registration จาก main.js'] },
  { ver:'1.0.14', date:'2026-06-23', label:'', changes:['สร้าง vite.config.js: manualChunks แยก firebase/xlsx/vehicleDatabase → index.js เล็กลง 435kB→75kB (gzip 131→22kB)', 'สร้าง firebase.json: SPA rewrite + Cache-Control immutable assets + security headers', 'สร้าง .firebaserc: project=lamom-one-v1'] },
  { ver:'1.0.13', date:'2026-06-23', label:'', changes:['แก้ PWA: manifest.json อ้าง /icons/*.png ที่ไม่มีอยู่ → เปลี่ยนเป็น favicon.svg (SVG any)', 'sw.js: CACHE_NAME bump v1.0.13 + ลบ /src/main.js /src/style.css (dev paths)', 'index.html: เพิ่ม apple-touch-icon', 'scan Promise.all ครบ 17 calls: ทุกอันอยู่ใน try-catch + .catch(()=>[])'] },
  { ver:'1.0.12', date:'2026-06-23', label:'', changes:['แก้ TypeError crash: MonthlyTrend.js year=2026 ไม่อยู่ใน YEARLY_DATA → EMPTY_YEAR fallback + maxV guard', 'scan Math.max spread ครบ ~60 patterns: safe ยกเว้น MonthlyTrend'] },
  { ver:'1.0.11', date:'2026-06-23', label:'', changes:['แก้ Infinity% ใน SalesForecast conversion column เมื่อ live data: d.leads guard', 'แก้ unguarded JSON.parse: Company.js loadBranches() ครอบ try-catch', 'scan: setFullYear/toDate/toFixed/template-NaN/undefined-display ทุก patterns clean'] },
  { ver:'1.0.10', date:'2026-06-23', label:'', changes:['แก้ CSS undefined tokens: --text-color/--text-primary → --text ใน 5 ไฟล์, เพิ่ม --border-subtle ใน themes.css ทุก 6 themes (37 จุด)', 'แก้ RangeError Invalid time value: DealerLicense.js renewLic() guard empty expiry', 'แก้ .find().property crash: .find()?. ใน TrainingBot, ReportBuilder, Integrations', 'แก้ event listener accumulation: Performance.js addEventListener นอก renderPage()'] },
  { ver:'1.0.9', date:'2026-06-23', label:'', changes:['try-catch ครอบทุก Firestore write (createDoc/updateDocData/softDelete) ใน 14 ไฟล์ รวม 30+ จุด', 'แก้ JSON.parse localStorage try-catch ครบ 6 ไฟล์', 'getSalesData() ทุกไฟล์ protected ด้วย .catch() หรือ try-catch'] },
  { ver:'1.0.8', date:'2026-06-23', label:'', changes:['localStorage.setItem try-catch ครบทุก write path (core, data, pages รวม 20+ จุด)', 'แก้ routerGen race condition ครบ 13 ไฟล์ (confirmDialog + render)', 'แก้ confirmDialog(string) bug → object ใน 4 ไฟล์', 'แก้ division-by-zero: ProfitAnalysis 3 จุด + VehicleInspection 1 จุด'] },
  { ver:'1.0.7', date:'2026-06-23', label:'', changes:['แก้ routerGen race condition ครบ 13 ไฟล์ (confirmDialog + render)', 'แก้ confirmDialog(string) bug → object ใน 4 ไฟล์ (ActionPlan, CampaignBuilder, ApiKeys, BranchSettings)', 'แก้ division-by-zero: ProfitAnalysis 3 จุด + VehicleInspection 1 จุด', 'format.js: formatNumber ใหม่ + formatDate ISO fast-path'] },
  { ver:'1.0.6', date:'2026-06-23', label:'', changes:['V8-Parity ครบ: EventManagement ใช้ getSalesData() + live avg deal size', 'แก้ CSS token \'muted\'/\'info\' → \'secondary\'/\'primary\' ครบ 18 ไฟล์', 'แก้ showToast type \'info\' → \'success\'/\'warning\' ครบ 16 ไฟล์'] },
  { ver:'1.0.5', date:'2026-06-22', label:'', changes:['แก้ไข CSS token badge-info/badge-muted ทั้งระบบ (30+ ไฟล์)', 'เพิ่มฟีเจอร์ Branch Management ใน Company Settings', 'ปรับปรุง Users & Roles page ให้สมบูรณ์', 'แก้ไข toast.info CSS ใช้ var(--accent)'] },
  { ver:'1.0.4', date:'2025-06-09', label:'', changes:['เพิ่ม HrDashboard Quick Links 16 ระบบ', 'เพิ่ม CrmDashboard KPI + Alerts', 'ปรับปรุง Pipeline Kanban drag-drop'] },
  { ver:'1.0.3', date:'2025-05-20', label:'', changes:['เพิ่มโมดูล Gamification ครบ 5 หน้า', 'เพิ่ม AI Officers 9 เจ้าหน้าที่', 'ปรับ Dark mode ทุก component'] },
  { ver:'1.0.0', date:'2025-04-01', label:'', changes:['Launch LAMOM ONE V1', 'Vite + ES6 + Firebase stack', 'Demo mode สำหรับทดลองใช้'] },
]

const TECH_STACK = [
  { icon:'⚡', name:'Vite 8', desc:'Build < 1 วินาที, HMR instant' },
  { icon:'🟨', name:'Vanilla JS ES6+', desc:'ไม่มี framework, เบา & เร็ว' },
  { icon:'🔥', name:'Firebase 12', desc:'Firestore + Auth + Cloudflare R2' },
  { icon:'🎨', name:'CSS Custom Properties', desc:'Dark mode + 6 ธีมสี' },
  { icon:'🎮', name:'Demo Mode', desc:'ทดลองโดยไม่ต้องสมัคร' },
  { icon:'📦', name:'Modular Architecture', desc:'300+ หน้า, 16 โมดูล' },
]

export default function AboutPage(container) {
  const totalPages = MODULES.reduce((a, m) => a + m.pages, 0)
  const maxPages = Math.max(...MODULES.map(m => m.pages))

  const lsKeys = Object.keys(localStorage).filter(k => k.startsWith('lamom-'))
  const storedMB = lsKeys.reduce((t, k) => t + (localStorage.getItem(k)||'').length, 0)

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div style="max-width:720px;margin:0 auto">

        <!-- Hero -->
        <div class="card" style="padding:28px;text-align:center;margin-bottom:14px;background:linear-gradient(135deg,var(--surface),var(--surface-2))">
          <div style="width:68px;height:68px;border-radius:18px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900;color:white;margin:0 auto 12px;box-shadow:0 4px 16px var(--primary-dim)">L</div>
          <div style="font-size:1.5rem;font-weight:900;letter-spacing:-0.02em">LAMOM ONE</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin:4px 0 12px">ระบบปฏิบัติการธุรกิจยานยนต์ครบวงจร</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <span class="badge badge-primary">Version 1.0.79</span>
            <span class="badge badge-success">${totalPages}+ ระบบย่อย</span>
            <span class="badge badge-accent">${MODULES.length} โมดูล</span>
            <span class="badge badge-warning">Vite 8 + ES6 + Firebase 12</span>
          </div>
        </div>

        <!-- Owner -->
        <div class="card" style="padding:16px;margin-bottom:14px;border-left:3px solid var(--warning)">
          <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">👑 เจ้าของระบบ (ตลอดไป)</div>
          <div style="font-weight:900;font-size:1.05rem">ทวีศักดิ์ สุขสมบัติเสถียร</div>
          <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px">Thaweesak Sooksombatisatian — LAMOM ONE เป็นทรัพย์สินทางปัญญาของเจ้าของแท้จริงตลอดไป</div>
        </div>

        <!-- System Stats -->
        <div class="grid-4 mb-4">
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--primary)">
            <div style="font-size:1.8rem;font-weight:900;color:var(--primary)">${MODULES.length}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">โมดูล</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--success)">
            <div style="font-size:1.8rem;font-weight:900;color:var(--success)">${totalPages}+</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">ระบบย่อย</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--accent)">
            <div style="font-size:1.8rem;font-weight:900;color:var(--accent)">9</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">AI Officers</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--warning)">
            <div style="font-size:1.3rem;font-weight:900;color:var(--warning)">${(storedMB/1024).toFixed(1)}KB</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">Local Storage</div>
          </div>
        </div>

        <!-- Modules with bar chart -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📦 โมดูลและจำนวนระบบย่อย</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${MODULES.map(m => `
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:160px;font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.icon} ${m.name}</div>
                <div style="flex:1;height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${Math.round((m.pages/maxPages)*100)}%;background:var(--${m.color});border-radius:4px;transition:width 0.4s ease"></div>
                </div>
                <div style="width:28px;text-align:right;font-size:0.72rem;font-weight:700;color:var(--text-muted)">${m.pages}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:10px;font-size:0.72rem;color:var(--text-muted);text-align:right">รวม ${totalPages} ระบบย่อย</div>
        </div>

        <!-- Tech Stack -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🛠 เทคโนโลยีหลัก</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${TECH_STACK.map(t => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="font-size:1.3rem">${t.icon}</div>
                <div>
                  <div style="font-size:0.78rem;font-weight:700">${t.name}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${t.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Changelog -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📋 Changelog</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${CHANGELOG.map(c => `
              <div style="border-left:2px solid var(--${c.label?'primary':'border'});padding-left:12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span style="font-size:0.8rem;font-weight:700">v${c.ver}</span>
                  <span style="font-size:0.68rem;color:var(--text-muted)">${c.date}</span>
                  ${c.label ? `<span class="badge badge-primary" style="font-size:0.6rem">${c.label}</span>` : ''}
                </div>
                <ul style="margin:0;padding-left:16px;font-size:0.72rem;color:var(--text-muted);line-height:1.8">
                  ${c.changes.map(ch => `<li>${ch}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align:center;font-size:0.7rem;color:var(--text-muted);padding:12px 0 24px">
          LAMOM ONE V1 © 2569 — พัฒนาด้วย ❤️ เพื่อธุรกิจยานยนต์ไทย
        </div>
      </div>
    </div>
  `
}
