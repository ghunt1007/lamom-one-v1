import { getState, on, toggleSidebar } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { logout } from '../../core/auth.js'

const NAV = [
  {
    group: 'ภาพรวม',
    items: [
      { icon: '🏠', label: 'Dashboard', path: '/' },
      { icon: '🔔', label: 'Notifications', path: '/notifications' },
    ]
  },
  {
    group: 'การขาย',
    items: [
      { icon: '👥', label: 'ลูกค้า', path: '/crm/customers' },
      { icon: '🧲', label: 'Lead', path: '/crm/leads' },
      { icon: '📋', label: 'Pipeline', path: '/crm/pipeline' },
      { icon: '📝', label: 'จองรถ', path: '/crm/bookings' },
      { icon: '🗂️', label: 'Action Plan', path: '/crm/action-plan' },
      { icon: '✅', label: 'ตรวจรถก่อนส่งมอบ', path: '/crm/predelivery' },
      { icon: '🚗', label: 'Test Drive', path: '/crm/testdrive' },
      { icon: '🌐', label: 'Customer Portal', path: '/crm/portal' },
      { icon: '📢', label: 'ร้องเรียน', path: '/crm/complaints' },
      { icon: '📉', label: 'Lost Deal', path: '/crm/lostdeals' },
      { icon: '🏪', label: 'Showroom Appt', path: '/crm/showroom' },
      { icon: '📞', label: 'Follow-up', path: '/crm/followup' },
      { icon: '👑', label: 'Loyalty', path: '/crm/loyalty' },
      { icon: '💬', label: 'Feedback', path: '/crm/feedback' },
      { icon: '📄', label: 'ใบเสนอราคา', path: '/crm/quotation' },
      { icon: '🎯', label: 'Segmentation', path: '/crm/segments' },
      { icon: '🤝', label: 'Referral Program', path: '/crm/referral' },
      { icon: '🚶', label: 'Walk-In Traffic', path: '/crm/walkin' },
      { icon: '🔄', label: 'Customer Lifecycle', path: '/crm/lifecycle' },
      { icon: '🎂', label: 'Birthday Greetings', path: '/crm/birthdays' },
      { icon: '💝', label: 'Win-Back', path: '/crm/winback' },
      { icon: '📒', label: 'Customer Notes', path: '/crm/notes' },
      { icon: '👑', label: 'VIP Club', path: '/crm/vip' },
      { icon: '🧬', label: 'Duplicates', path: '/crm/duplicates' },
      { icon: '🗺', label: 'Customer Map', path: '/crm/map' },
      { icon: '⚖️', label: 'Quotation Compare', path: '/crm/quote-compare' },
      { icon: '🎙', label: 'Voice-to-CRM', path: '/crm/voice-crm' },
      { icon: '🏢', label: 'Fleet & Corporate', path: '/crm/fleet' },
      { icon: '💎', label: 'Customer CLV', path: '/crm/clv' },
      { icon: '🔮', label: 'Churn Prediction', path: '/crm/churn' },
      { icon: '🏆', label: 'Loyalty Tiers', path: '/crm/loyalty-tiers' },
      { icon: '🔗', label: 'Referral QR', path: '/crm/referral-qr' },
      { icon: '⭐', label: 'CSAT / NPS', path: '/crm/csat' },
      { icon: '🎂', label: 'Anniversary', path: '/crm/anniversary' },
      { icon: '💬', label: 'Price Negotiation', path: '/crm/price-negotiation' },
      { icon: '🤖', label: 'Deal Coach AI', path: '/crm/deal-coach' },
    ]
  },
  {
    group: 'โชว์รูม',
    items: [
      { icon: '🚗', label: 'DMS', path: '/dms' },
      { icon: '📦', label: 'สต็อกรถ', path: '/dms/stock' },
      { icon: '🛒', label: 'สั่งรถใหม่', path: '/dms/orders' },
      { icon: '✅', label: 'PDI', path: '/dms/pdi' },
      { icon: '🤝', label: 'Suppliers', path: '/dms/suppliers' },
      { icon: '📦', label: 'Stock Valuation', path: '/dms/stockvalue' },
      { icon: '⚖️', label: 'เปรียบเทียบรถ', path: '/dms/compare' },
      { icon: '🚗', label: 'ใบส่งมอบรถ', path: '/dms/delivery' },
      { icon: '📦', label: 'รับรถเข้าสต็อก', path: '/dms/receiving' },
      { icon: '🚛', label: 'โอนรถ', path: '/dms/transfer' },
      { icon: '🗓', label: 'TD Schedule', path: '/dms/testdrive-schedule' },
      { icon: '💰', label: 'Price List', path: '/dms/pricelist' },
      { icon: '📋', label: 'Reservation', path: '/dms/reservation' },
      { icon: '🔄', label: 'Trade-In', path: '/dms/tradein' },
      { icon: '🔎', label: 'Vehicle Lookup', path: '/dms/vin-lookup' },
      { icon: '🛍', label: 'Accessory Shop', path: '/dms/accessories' },
      { icon: '🎨', label: 'สั่งแต่งรถ', path: '/dms/custom-orders' },
      { icon: '🎉', label: 'Delivery Calendar', path: '/dms/delivery-calendar' },
      { icon: '🚙', label: 'Plate Tracking', path: '/dms/plates' },
      { icon: '🚗', label: 'Demo Fleet', path: '/dms/demo-fleet' },
      { icon: '🔑', label: 'Key Management', path: '/dms/keys' },
      { icon: '📸', label: 'Car Photos', path: '/dms/photos' },
      { icon: '🏦', label: 'Floor Plan', path: '/dms/floorplan' },
      { icon: '📋', label: 'Stock Audit', path: '/dms/stock-audit' },
      { icon: '🤝', label: 'รถฝากขาย', path: '/dms/consignment' },
      { icon: '⏳', label: 'Vehicle Aging', path: '/dms/aging' },
      { icon: '⭐', label: 'Special Edition', path: '/dms/special-edition' },
      { icon: '🔄', label: 'Model Year', path: '/dms/model-year' },
      { icon: '📋', label: 'ใบอนุญาต', path: '/dms/licenses' },
      { icon: '📱', label: 'QR per Vehicle', path: '/dms/qr-vehicle' },
      { icon: '📋', label: 'Homologation', path: '/dms/homologation' },
      { icon: '📈', label: 'Price History', path: '/dms/price-history' },
      { icon: '📋', label: 'TD Certificate', path: '/dms/td-cert' },
      { icon: '🔐', label: 'Reserve Lock', path: '/dms/reserve-lock' },
      { icon: '🎨', label: 'Color Matrix', path: '/dms/color-matrix' },
      { icon: '🚗', label: 'Used Car', path: '/dms/used-car' },
      { icon: '⚙️', label: 'Model Config', path: '/dms/model-config' },
      { icon: '📋', label: 'เอกสารราชการ', path: '/dms/gov-docs' },
      { icon: '⚡', label: 'EV Station', path: '/dms/ev-station' },
      { icon: '🚘', label: 'Vehicle Database', path: '/dms/vehicle-db' },
    ]
  },
  {
    group: 'บริการ',
    items: [
      { icon: '🔧', label: 'Service', path: '/service' },
      { icon: '🗂️', label: 'Job Card', path: '/service/jobs' },
      { icon: '🔩', label: 'อะไหล่', path: '/service/parts' },
      { icon: '📅', label: 'Service Appt', path: '/service/appointment' },
      { icon: '🚙', label: 'Loaner Car', path: '/service/loaner' },
      { icon: '🛡', label: 'Warranty', path: '/service/warranty' },
      { icon: '🔍', label: 'Inspection', path: '/service/inspection' },
      { icon: '🛒', label: 'สั่งอะไหล่', path: '/service/parts-order' },
      { icon: '📖', label: 'ประวัติซ่อม', path: '/service/history' },
      { icon: '⚡', label: 'EV Diagnostic', path: '/service/ev-diagnostic' },
      { icon: '🔔', label: 'Recall', path: '/service/recall' },
      { icon: '📦', label: 'Service Packages', path: '/service/packages' },
      { icon: '🗓️', label: 'ตารางบำรุงรักษาเช็คระยะ', path: '/service/maintenance-schedule' },
      { icon: '⚡', label: 'Charging Station', path: '/service/charging' },
      { icon: '👷', label: 'Technician Schedule', path: '/service/technicians' },
      { icon: '🔋', label: 'EV Battery Health', path: '/service/ev-battery' },
      { icon: '🔩', label: 'Parts Inventory', path: '/service/parts-inventory' },
      { icon: '🔔', label: 'Service Reminder', path: '/service/reminders' },
      { icon: '🚿', label: 'Wash & Detailing', path: '/service/wash' },
      { icon: '🚐', label: 'Pickup & Delivery', path: '/service/pickup' },
      { icon: '🧾', label: 'Repair Estimate', path: '/service/estimate' },
      { icon: '🛋', label: 'Waiting Lounge', path: '/service/lounge' },
      { icon: '🚨', label: 'Roadside Assist', path: '/service/roadside' },
      { icon: '🛡', label: 'Warranty Claim', path: '/service/warranty-claim' },
      { icon: '🏗', label: 'Bay Management', path: '/service/bay' },
      { icon: '🔍', label: 'Surveyor Appt', path: '/service/surveyor' },
      { icon: '🗺', label: 'EV Range Planner', path: '/service/ev-range' },
      { icon: '🔔', label: 'Recall Tracker', path: '/service/recall-tracker' },
      { icon: '🔄', label: 'Reschedule AI', path: '/service/reschedule-ai' },
      { icon: '🛡', label: 'Warranty Expiry', path: '/service/warranty-expiry' },
      { icon: '↩️', label: 'Parts RMA', path: '/service/parts-rma' },
      { icon: '🔧', label: 'Technician KPI', path: '/service/tech-kpi' },
      { icon: '⚡', label: 'Quick Lane', path: '/service/quick-lane' },
      { icon: '🚗', label: 'Body & Paint (BP)', path: '/service/bp' },
    ]
  },
  {
    group: 'การเงิน',
    items: [
      { icon: '💰', label: 'Finance', path: '/finance' },
      { icon: '📊', label: 'Margin', path: '/finance/margin' },
      { icon: '💎', label: 'GP & FOC', path: '/finance/gp-foc' },
      { icon: '🎯', label: 'งบขาย & งบแถม', path: '/finance/sales-budget' },
      { icon: '🏆', label: 'Commission', path: '/finance/commission' },
      { icon: '📉', label: 'P&L', path: '/finance/pl' },
      { icon: '💳', label: 'Payroll', path: '/finance/payroll' },
      { icon: '💸', label: 'Cash Flow', path: '/finance/cashflow' },
      { icon: '🧾', label: 'Invoice', path: '/finance/invoice' },
      { icon: '🏦', label: 'ยื่นไฟแนนซ์', path: '/finance/application' },
      { icon: '📋', label: 'Finance Tracker', path: '/finance/tracker' },
      { icon: '📊', label: 'Budget Planning', path: '/finance/budget' },
      { icon: '🧾', label: 'Tax Report', path: '/finance/tax' },
      { icon: '📝', label: 'หัก ณ ที่จ่าย (ใบ 50 ทวิ)', path: '/finance/withholding-tax' },
      { icon: '📑', label: 'วางบิล', path: '/finance/billing-run' },
      { icon: '🏦', label: 'Credit Control', path: '/finance/credit' },
      { icon: '🏭', label: 'Assets', path: '/finance/assets' },
      { icon: '💸', label: 'Expense Approval', path: '/finance/expenses' },
      { icon: '📊', label: 'Payroll Detail', path: '/finance/payroll-detail' },
      { icon: '📋', label: 'Purchase Orders', path: '/finance/po' },
      { icon: '🎯', label: 'Financial Goals', path: '/finance/goals' },
      { icon: '📅', label: 'Monthly Close', path: '/finance/monthly-close' },
      { icon: '🧾', label: 'VAT Report', path: '/finance/vat' },
      { icon: '💳', label: 'Debt Collection', path: '/finance/debt' },
      { icon: '⚙️', label: 'Commission Rules', path: '/finance/commission-rules' },
      { icon: '💵', label: 'Petty Cash', path: '/finance/petty-cash' },
      { icon: '🧮', label: 'Loan Calculator', path: '/finance/loan-calc' },
      { icon: '🏦', label: 'Bank Recon', path: '/finance/bank-recon' },
      { icon: '💵', label: 'Cashier Desk', path: '/finance/cashier' },
      { icon: '⚡', label: 'Charging Cost', path: '/finance/charging-cost' },
      { icon: '⚡', label: 'Charging Revenue', path: '/finance/charging-revenue' },
      { icon: '💱', label: 'Multi-Currency', path: '/finance/multi-currency' },
      { icon: '🏦', label: 'Bank Partners', path: '/finance/bank-partners' },
      { icon: '📈', label: 'ดอกเบี้ยไฟแนนซ์', path: '/finance/rate-sheets' },
      { icon: '💵', label: 'Deposit (มัดจำ)', path: '/finance/deposit' },
      { icon: '⚖️', label: 'Break-even', path: '/finance/breakeven' },
      { icon: '💸', label: 'Refund', path: '/finance/refund' },
      { icon: '💳', label: 'Installment', path: '/finance/installment' },
      { icon: '🧾', label: 'Receipt Auto', path: '/finance/receipt-auto' },
      { icon: '⚡', label: 'Energy & Utility', path: '/finance/energy' },
      { icon: '🎯', label: 'Target vs Actual', path: '/finance/target-actual' },
      { icon: '🏭', label: 'Vendor Management', path: '/finance/vendor' },
      { icon: '📅', label: 'Compliance Calendar', path: '/finance/compliance-calendar' },
      { icon: '💳', label: 'Payment Gateway', path: '/finance/payment' },
    ]
  },
  {
    group: 'ประกัน',
    items: [
      { icon: '🛡', label: 'Insurance', path: '/insurance' },
      { icon: '🔄', label: 'ต่ออายุประกัน', path: '/insurance/renewal' },
      { icon: '📋', label: 'Claims', path: '/insurance/claims' },
      { icon: '⚖️', label: 'Compare', path: '/insurance/compare' },
      { icon: '🏅', label: 'No-Claim Bonus', path: '/insurance/ncb' },
      { icon: '📋', label: 'Policy Management', path: '/insurance/policy' },
    ]
  },
  {
    group: 'การตลาด',
    items: [
      { icon: '📣', label: 'Marketing', path: '/marketing' },
      { icon: '🎯', label: 'Campaigns', path: '/marketing/campaigns' },
      { icon: '📱', label: 'Social Hub', path: '/marketing/social' },
      { icon: '🎪', label: 'Events', path: '/marketing/events' },
      { icon: '🧲', label: 'Lead Generation', path: '/marketing/leads' },
      { icon: '📅', label: 'Content Calendar', path: '/marketing/content' },
      { icon: '🎪', label: 'Promotions', path: '/marketing/promotions' },
      { icon: '⭐', label: 'Customer Reviews', path: '/marketing/reviews' },
      { icon: '📊', label: 'Marketing ROI', path: '/marketing/roi' },
      { icon: '💚', label: 'LINE OA', path: '/marketing/line-oa' },
      { icon: '🎪', label: 'Event Check-in', path: '/marketing/event-checkin' },
      { icon: '📊', label: 'Social Analytics', path: '/marketing/social-analytics' },
      { icon: '🧲', label: 'Lead Sources', path: '/marketing/lead-sources' },
      { icon: '🧠', label: 'Sentiment AI', path: '/marketing/sentiment' },
      { icon: '🌐', label: 'Landing Pages', path: '/marketing/landing-pages' },
      { icon: '🔗', label: 'UTM Tracker', path: '/marketing/utm-tracker' },
      { icon: '🌐', label: 'Digital Showroom', path: '/marketing/digital-showroom' },
      { icon: '✨', label: 'AI Content Factory', path: '/marketing/ai-content' },
    ]
  },
  {
    group: 'องค์กร',
    items: [
      { icon: '👤', label: 'HR', path: '/hr' },
      { icon: '🏛', label: 'Org Chart', path: '/hr/orgchart' },
      { icon: '👤', label: 'Staff Profiles', path: '/hr/profile' },
      { icon: '🏖', label: 'ลาพนักงาน', path: '/hr/leave' },
      { icon: '🕐', label: 'Attendance', path: '/hr/attendance' },
      { icon: '📆', label: 'Shift & Schedule', path: '/hr/shift' },
      { icon: '🎯', label: 'KPI', path: '/hr/kpi' },
      { icon: '💳', label: 'Expense Claims', path: '/hr/expense' },
      { icon: '👔', label: 'Recruitment', path: '/hr/recruitment' },
      { icon: '📊', label: 'Performance', path: '/hr/performance' },
      { icon: '📝', label: 'Performance Review', path: '/hr/performance-review' },
      { icon: '🎉', label: 'Onboarding', path: '/hr/onboarding' },
      { icon: '👋', label: 'Offboarding', path: '/hr/offboarding' },
      { icon: '💸', label: 'Staff Loan', path: '/hr/loans' },
      { icon: '💼', label: 'Salary Scale', path: '/hr/salary-scale' },
      { icon: '📁', label: 'Staff Documents', path: '/hr/documents' },
      { icon: '⏱', label: 'Overtime', path: '/hr/overtime' },
      { icon: '👥', label: 'Team Meeting', path: '/hr/meetings' },
      { icon: '🧩', label: 'Skill Matrix', path: '/hr/skills' },
      { icon: '📢', label: 'Announcements', path: '/hr/announcements' },
      { icon: '⚠️', label: 'Disciplinary', path: '/hr/disciplinary' },
      { icon: '🎯', label: 'Succession Plan', path: '/hr/succession' },
      { icon: '🧾', label: 'Expense OCR', path: '/hr/expense-ocr' },
      { icon: '😊', label: 'Mood Survey', path: '/hr/mood-survey' },
      { icon: '🎁', label: 'Bonus Pool', path: '/hr/bonus-pool' },
      { icon: '🎁', label: 'Employee Welfare', path: '/hr/welfare' },
      { icon: '🎓', label: 'Training', path: '/training' },
      { icon: '📚', label: 'หลักสูตร', path: '/training/courses' },
      { icon: '📊', label: 'Training Progress', path: '/training/progress' },
      { icon: '🏆', label: 'Certification', path: '/training/certification' },
      { icon: '📝', label: 'Training Quiz', path: '/training/quiz' },
      { icon: '📚', label: 'Knowledge Base', path: '/training/knowledge' },
      { icon: '🕵️', label: 'Competitor Intel', path: '/training/competitor' },
      { icon: '📚', label: 'Product Knowledge', path: '/training/product-knowledge' },
      { icon: '🤖', label: 'TrainingBot AI', path: '/training/bot' },
      { icon: '📈', label: 'Analytics', path: '/analytics' },
      { icon: '🎮', label: 'Gamification', path: '/gamification' },
      { icon: '🏆', label: 'Leaderboard', path: '/gamification/leaderboard' },
      { icon: '🏅', label: 'Badges', path: '/gamification/badges' },
      { icon: '🎯', label: 'Challenges', path: '/gamification/challenges' },
      { icon: '🎁', label: 'Reward Store', path: '/gamification/rewards' },
      { icon: '🎯', label: 'Daily Missions', path: '/gamification/missions' },
      { icon: '📊', label: 'Report Center', path: '/analytics/reports' },
      { icon: '🎯', label: 'Company KPI', path: '/analytics/kpi' },
      { icon: '🔮', label: 'Sales Forecast', path: '/analytics/forecast' },
      { icon: '🧠', label: 'Customer Insights', path: '/analytics/customers' },
      { icon: '⚙️', label: 'Operations', path: '/analytics/operations' },
      { icon: '📈', label: 'Profit Analysis', path: '/analytics/profit' },
      { icon: '🗺️', label: 'Customer Journey', path: '/analytics/journey' },
      { icon: '🚗', label: 'Sales By Model', path: '/analytics/by-model' },
      { icon: '📅', label: 'Daily Report', path: '/analytics/daily' },
      { icon: '📦', label: 'Stock Analysis', path: '/analytics/stock' },
      { icon: '📈', label: 'Monthly Trend', path: '/analytics/monthly' },
      { icon: '🏢', label: 'Branch Comparison', path: '/analytics/branches' },
      { icon: '⚖️', label: 'ทีมหน้าร้าน vs ออนไลน์', path: '/analytics/sales-channel' },
      { icon: '🏭', label: 'ภาพรวมประสิทธิภาพแผนก', path: '/analytics/dept-ops' },
      { icon: '🔻', label: 'Conversion Funnel', path: '/analytics/funnel' },
      { icon: '🔧', label: 'Service Analytics', path: '/analytics/service' },
      { icon: '📋', label: 'Executive Summary', path: '/analytics/executive' },
      { icon: '🔩', label: 'Parts Analytics', path: '/analytics/parts' },
      { icon: '📊', label: 'Market Share', path: '/analytics/market-share' },
      { icon: '🌿', label: 'Carbon Footprint', path: '/analytics/carbon' },
      { icon: '🔋', label: 'EV Adoption', path: '/analytics/ev-adoption' },
      { icon: '📅', label: 'Seasonal Trends', path: '/analytics/seasonal' },
      { icon: '📊', label: 'Model Profitability', path: '/analytics/model-profit' },
      { icon: '🔧', label: 'Report Builder', path: '/analytics/report-builder' },
    ]
  },
  {
    group: 'เอกสาร',
    items: [
      { icon: '📄', label: 'Document Studio', path: '/documents' },
      { icon: '🗂️', label: 'คลังเอกสาร', path: '/documents/library' },
      { icon: '📜', label: 'Contracts', path: '/documents/contracts' },
      { icon: '📑', label: 'Templates', path: '/documents/templates' },
      { icon: '📝', label: 'Form Builder', path: '/documents/form-builder' },
      { icon: '✅', label: 'Checklist Engine', path: '/documents/checklist' },
    ]
  },
  {
    group: 'AI & งาน',
    items: [
      { icon: '💫', label: 'ผู้ช่วยส่วนตัว', path: '/ai/personal' },
      { icon: '🤖', label: 'AI Officers', path: '/ai' },
      { icon: '🧠', label: 'LAMI Brain', path: '/ai/lami' },
      { icon: '🎯', label: 'Sales Coach', path: '/ai/sales-coach' },
      { icon: '🔮', label: 'AI Insights', path: '/ai/insights' },
      { icon: '💲', label: 'Pricing Advisor', path: '/ai/pricing' },
      { icon: '🧠', label: 'Lead Scoring', path: '/ai/lead-scoring' },
      { icon: '💬', label: 'Ask LAMI', path: '/ai/ask' },
      { icon: '🎯', label: 'Upsell AI', path: '/ai/upsell' },
      { icon: '✅', label: 'Tasks', path: '/tasks' },
    ]
  },
  {
    group: 'สื่อสาร',
    items: [
      { icon: '💬', label: 'Comm Hub', path: '/comms' },
      { icon: '📬', label: 'Inbox', path: '/comms/inbox' },
      { icon: '📢', label: 'Broadcast', path: '/comms/broadcast' },
      { icon: '📱', label: 'SMS Marketing', path: '/comms/sms' },
      { icon: '💬', label: 'Chat Templates', path: '/comms/templates' },
      { icon: '☎️', label: 'Call Log', path: '/comms/calls' },
      { icon: '⚡', label: 'Escalation Rules', path: '/comms/escalation' },
      { icon: '📋', label: 'Meeting Minutes', path: '/comms/meetings' },
    ]
  },
  {
    group: 'คุณภาพ',
    items: [
      { icon: '📋', label: 'Quality & PDPA', path: '/quality' },
      { icon: '📖', label: 'SOP', path: '/quality/sop' },
      { icon: '✅', label: 'Compliance', path: '/quality/compliance' },
      { icon: '⭐', label: 'Satisfaction', path: '/quality/satisfaction' },
      { icon: '🔍', label: 'Audit Schedule', path: '/quality/audit-schedule' },
      { icon: '🚨', label: 'Incident Report', path: '/quality/incidents' },
      { icon: '🔒', label: 'PDPA Consent', path: '/quality/pdpa' },
      { icon: '🧹', label: '5S Audit', path: '/quality/5s' },
      { icon: '🔧', label: 'Equipment Maint.', path: '/quality/maintenance' },
    ]
  },
  {
    group: 'B2B & Partner',
    items: [
      { icon: '🤝', label: 'B2B Portal', path: '/b2b' },
      { icon: '🏢', label: 'Fleet Management', path: '/b2b/fleet' },
      { icon: '🚙', label: 'Leasing', path: '/b2b/leasing' },
      { icon: '🤝', label: 'Partners', path: '/b2b/partners' },
      { icon: '📄', label: 'Corporate Quotes', path: '/b2b/quotes' },
      { icon: '🚌', label: 'Fleet Quote', path: '/b2b/fleet-quote' },
      { icon: '🤝', label: 'Partner Commission', path: '/b2b/partner-commission' },
      { icon: '🏛', label: 'Gov Bidding', path: '/b2b/gov-bidding' },
      { icon: '🛰', label: 'Fleet GPS', path: '/b2b/fleet-gps' },
    ]
  },
  {
    group: 'ระบบ',
    items: [
      { icon: '⚙️', label: 'ตั้งค่า', path: '/settings' },
      { icon: '🔔', label: 'Notification Settings', path: '/settings/notifications' },
      { icon: '🏢', label: 'Multi-Branch', path: '/settings/branches' },
      { icon: '🗂', label: 'Master Data', path: '/settings/master-data' },
      { icon: '🎨', label: 'White-label', path: '/settings/whitelabel' },
      { icon: '📋', label: 'Audit Log', path: '/settings/audit' },
      { icon: '🔍', label: 'User Activity', path: '/settings/activity' },
      { icon: '💾', label: 'Backup & Restore', path: '/settings/backup' },
      { icon: '🔑', label: 'API Keys', path: '/settings/api-keys' },
      { icon: '📅', label: 'Holiday Calendar', path: '/settings/holidays' },
      { icon: '💟', label: 'System Health', path: '/settings/health' },
      { icon: '🔐', label: 'Security', path: '/settings/security' },
      { icon: '👥', label: 'User Management', path: '/settings/users-manage' },
      { icon: '👤', label: 'บัญชีของฉัน', path: '/settings/my-account' },
      { icon: 'ℹ️', label: 'About', path: '/settings/about' },
      { icon: '🔗', label: 'Integrations', path: '/integrations' },
      { icon: '⚙️', label: 'Integration Config', path: '/integrations/settings' },
      { icon: '🔗', label: 'Webhook Builder', path: '/integrations/webhooks' },
      { icon: '📺', label: 'Digital Signage', path: '/settings/digital-signage' },
      { icon: '📱', label: 'SMS OTP / 2FA', path: '/settings/sms-otp' },
      { icon: '🔄', label: 'V8 Migration', path: '/migration' },
      { icon: '🗺️', label: 'Data Mapping', path: '/migration/mapping' },
      { icon: '📤', label: 'Data Export', path: '/migration/export' },
    ]
  },
]

// ── Group collapse state (localStorage) ─────────────────────────────────────
const GRP_KEY = 'lamom_sidebar_groups'
function loadGroupState() {
  try { return JSON.parse(localStorage.getItem(GRP_KEY)) || {} } catch { return {} }
}
function saveGroupState(s) {
  try { localStorage.setItem(GRP_KEY, JSON.stringify(s)) } catch {}
}

export function Sidebar(container) {
  let el = null
  const unsubs = []

  function render() {
    const collapsed = getState('sidebarCollapsed')
    const route = getState('currentRoute')
    const user = getState('user')
    const grpState = loadGroupState()

    // Auto-expand the group containing the active route
    NAV.forEach(g => {
      if (g.items.some(i => i.path === route) && !(g.group in grpState)) {
        grpState[g.group] = false // false = expanded
      }
    })

    const html = `
      <aside class="sidebar ${collapsed ? 'collapsed' : ''}" id="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">L</div>
          ${!collapsed ? '<span class="sidebar-logo-text">LAMOM ONE</span>' : ''}
          ${!collapsed ? `<button class="sidebar-toggle" id="sidebar-toggle" title="ย่อ Sidebar">◀</button>` : ''}
        </div>

        <nav class="sidebar-nav">
          ${NAV.map(group => {
            const isGroupCollapsed = !collapsed && !!grpState[group.group]
            const hasActive = group.items.some(i => i.path === route)
            return `
            <div class="nav-group">
              ${!collapsed ? `
                <div class="nav-group-label nav-group-toggle ${hasActive ? 'has-active' : ''}" data-grp="${escHtml(group.group)}">
                  <span>${group.group}</span>
                  <span class="nav-grp-arrow">${isGroupCollapsed ? '▸' : '▾'}</span>
                </div>
              ` : ''}
              <div class="nav-group-items ${isGroupCollapsed ? 'grp-hidden' : ''}">
                ${group.items.map(item => `
                  <div class="nav-item ${route === item.path ? 'active' : ''}"
                       data-path="${item.path}"
                       title="${item.label}">
                    <span class="nav-icon">${item.icon}</span>
                    ${!collapsed ? `<span class="nav-label">${item.label}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `}).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="lami-widget" id="lami-widget">
            <div class="lami-avatar">🤖</div>
            ${!collapsed ? `
              <div class="lami-info">
                <div class="lami-name">LAMI</div>
                <div class="lami-mood">ยินดีช่วยเสมอ 😊</div>
              </div>
            ` : ''}
          </div>
          <div class="user-mini" id="user-mini">
            <div class="user-avatar-mini">${getInitials(user?.displayName || user?.email || 'U')}</div>
            ${!collapsed ? `
              <div style="overflow:hidden">
                <div class="user-name-mini">${escHtml(user?.displayName || user?.email || 'ผู้ใช้')}</div>
                <div class="user-role-mini">${escHtml(roleLabel(user?.role))}</div>
              </div>
            ` : ''}
          </div>
          ${collapsed ? `<button class="sidebar-toggle" id="sidebar-toggle" title="ขยาย Sidebar">▶</button>` : ''}
        </div>
      </aside>
    `

    if (!el) {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html
      el = wrapper.firstElementChild
      container.appendChild(el)
      bindEvents()
    } else {
      const scrollTop = el.querySelector('.sidebar-nav')?.scrollTop || 0
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html
      const newEl = wrapper.firstElementChild
      el.replaceWith(newEl)
      el = newEl
      bindEvents()
      const nav = el.querySelector('.sidebar-nav')
      if (nav) nav.scrollTop = scrollTop
    }
  }

  function bindEvents() {
    el.querySelector('#sidebar-toggle')?.addEventListener('click', () => toggleSidebar())

    // Group toggle
    el.querySelectorAll('.nav-group-toggle[data-grp]').forEach(label => {
      label.addEventListener('click', () => {
        const grp = label.dataset.grp
        const s = loadGroupState()
        s[grp] = !s[grp]
        saveGroupState(s)
        render()
      })
    })

    el.querySelectorAll('.nav-item[data-path]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.path))
    })
    // LAMI widget → ผู้ช่วยส่วนตัว
    el.querySelector('#lami-widget')?.addEventListener('click', () => navigate('/ai/personal'))
    // เมนูผู้ใช้: บัญชีของฉัน / ออกจากระบบ
    el.querySelector('#user-mini')?.addEventListener('click', (e) => {
      e.stopPropagation()
      document.getElementById('user-menu-pop')?.remove()
      const pop = document.createElement('div')
      pop.id = 'user-menu-pop'
      pop.style.cssText = 'position:fixed;bottom:64px;left:14px;z-index:1000;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 30px rgba(0,0,0,0.4);padding:6px;min-width:180px'
      pop.innerHTML = `
        <button id="um-account" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:none;color:var(--text);cursor:pointer;font-size:0.82rem;border-radius:var(--radius-sm);text-align:left">👤 บัญชีของฉัน</button>
        <button id="um-logout" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.82rem;border-radius:var(--radius-sm);text-align:left">🚪 ออกจากระบบ</button>
      `
      document.body.appendChild(pop)
      pop.querySelectorAll('button').forEach(b => {
        b.addEventListener('mouseenter', () => b.style.background = 'var(--surface-2)')
        b.addEventListener('mouseleave', () => b.style.background = 'none')
      })
      pop.querySelector('#um-account').addEventListener('click', () => { pop.remove(); navigate('/settings/my-account') })
      pop.querySelector('#um-logout').addEventListener('click', async () => {
        pop.remove()
        try { await logout() } catch { navigate('/login') }
      })
      setTimeout(() => document.addEventListener('click', () => pop.remove(), { once: true }), 50)
    })
  }

  render()

  unsubs.push(on('sidebarCollapsed', render))
  unsubs.push(on('currentRoute', render))
  unsubs.push(on('user', render))

  return () => unsubs.forEach(fn => fn())
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getInitials(name) {
  if (!name) return 'U'
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function roleLabel(role) {
  const map = { owner: 'เจ้าของ', admin: 'แอดมิน', manager: 'ผู้จัดการ', sales: 'เซลส์', service: 'ช่าง', staff: 'พนักงาน' }
  return map[role] || role || 'พนักงาน'
}
