// i18n — รองรับหลายภาษา (v1.0.353)
// เริ่มจากเมนูหลัก/ส่วนกลาง (Sidebar, Topbar, Login, Dashboard) ผ่าน t() key-based dictionary นี้ —
// คีย์ที่ไม่มีคำแปลจะ fallback กลับไปเป็นภาษาไทยเสมอ (ไม่มีวันโชว์ key เปล่าๆหรือ undefined ให้ผู้ใช้เห็น)
// ส่วนคำศัพท์ที่ใช้ซ้ำทั่วเนื้อหาในแต่ละหน้า (ปุ่ม/label/สถานะ/หัวตาราง — ไม่ได้เรียก t() เพราะเขียนไว้ก่อนมี
// ระบบ i18n) แปลผ่านกลไกคนละแบบ: src/i18n/autoTranslate.js (v1.0.402) — ดู comment หัวไฟล์นั้นสำหรับ
// ข้อจำกัด (ไม่ครอบคลุมเนื้อหาเฉพาะหน้าแบบยาวๆ/ประโยคที่ต้องแปล contextual)
import { getState } from '../core/store.js'

export const LANGUAGES = [
  { id: 'th', label: 'ไทย', flag: '🇹🇭' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'zh', label: '中文', flag: '🇨🇳' },
]

const DICT = {
  th: {
    appTagline: 'ระบบปฏิบัติการธุรกิจยานยนต์',
    email: 'อีเมล', password: 'รหัสผ่าน', passwordAgain: 'รหัสผ่านอีกครั้ง',
    login: 'เข้าสู่ระบบ', loggingIn: 'กำลังเข้าสู่ระบบ...', forgotPassword: 'ลืมรหัสผ่าน?',
    createAccount: 'สร้างบัญชีใหม่', createAccountTitle: 'สร้างบัญชีผู้ใช้ใหม่', creatingAccount: 'กำลังสร้างบัญชี...',
    passwordMin: 'รหัสผ่าน (อย่างน้อย 8 ตัว)', confirmPassword: 'ยืนยันรหัสผ่าน',
    pleaseEnterEmail: 'กรุณาระบุอีเมล', pleaseEnterPassword: 'กรุณาระบุรหัสผ่าน',
    passwordMinError: 'รหัสผ่านอย่างน้อย 8 ตัว', passwordMismatch: 'รหัสผ่านไม่ตรงกัน',
    enterEmailFirst: 'กรอกอีเมลของคุณก่อน แล้วกด "ลืมรหัสผ่าน?" อีกครั้ง',
    searchPlaceholder: 'ค้นหาทุกอย่าง...',
    filterCompany: 'กรองบริษัท', changeTheme: 'เปลี่ยน Theme', notifications: 'การแจ้งเตือน', chatWithLami: 'คุยกับ LAMI',
    selectTheme: 'เลือก Theme', selectLanguage: 'เลือกภาษา',
    all: 'ทั้งหมด', companies: 'บริษัท',
    collapseSidebar: 'ย่อ Sidebar', expandSidebar: 'ขยาย Sidebar', menu: 'เมนู',
    myAccount: 'บัญชีของฉัน', logout: 'ออกจากระบบ', user: 'ผู้ใช้', alwaysHappyToHelp: 'ยินดีช่วยเสมอ 😊',
    roleOwner: 'เจ้าของ', roleAdmin: 'แอดมิน', roleManager: 'ผู้จัดการ', roleSales: 'เซลส์', roleService: 'ช่าง', roleStaff: 'พนักงาน',
    greetingMorning: 'อรุณสวัสดิ์', greetingAfternoon: 'สวัสดีตอนบ่าย', greetingEvening: 'สวัสดีตอนเย็น',
    welcome: 'ยินดีต้อนรับ', newLead: 'Lead ใหม่',
    markAllRead: 'อ่านทั้งหมด', newBadge: 'ใหม่', noNotifications: 'ไม่มีการแจ้งเตือน',
    searchAllPlaceholder: 'ค้นหาลูกค้า · ใบจอง · รถ · อะไหล่ · พนักงาน · เมนู...',
    moveHint: '↑↓ เลื่อน', openHint: '↵ เปิด', closeHint: 'Esc ปิด', goToPage: 'ไปที่หน้า', noResultsFor: 'ไม่พบ', noName: '(ไม่มีชื่อ)',
    grpMenu: 'เมนู', grpBookings: 'ใบจอง', grpCustomers: 'ลูกค้า', grpStock: 'สต็อกรถ', grpStaff: 'พนักงาน',
    grpParts: 'อะไหล่', grpInsurance: 'ประกันภัย', grpTasks: 'งาน',
  },
  en: {
    appTagline: 'Automotive Business Operating System',
    email: 'Email', password: 'Password', passwordAgain: 'Password again',
    login: 'Log In', loggingIn: 'Logging in...', forgotPassword: 'Forgot password?',
    createAccount: 'Create account', createAccountTitle: 'Create a new account', creatingAccount: 'Creating account...',
    passwordMin: 'Password (min. 8 characters)', confirmPassword: 'Confirm password',
    pleaseEnterEmail: 'Please enter your email', pleaseEnterPassword: 'Please enter your password',
    passwordMinError: 'Password must be at least 8 characters', passwordMismatch: 'Passwords do not match',
    enterEmailFirst: 'Enter your email first, then click "Forgot password?" again',
    searchPlaceholder: 'Search anything...',
    filterCompany: 'Filter company', changeTheme: 'Change theme', notifications: 'Notifications', chatWithLami: 'Chat with LAMI',
    selectTheme: 'Select theme', selectLanguage: 'Select language',
    all: 'All', companies: 'companies',
    collapseSidebar: 'Collapse sidebar', expandSidebar: 'Expand sidebar', menu: 'Menu',
    myAccount: 'My Account', logout: 'Log out', user: 'User', alwaysHappyToHelp: 'Always happy to help 😊',
    roleOwner: 'Owner', roleAdmin: 'Admin', roleManager: 'Manager', roleSales: 'Sales', roleService: 'Technician', roleStaff: 'Staff',
    greetingMorning: 'Good morning', greetingAfternoon: 'Good afternoon', greetingEvening: 'Good evening',
    welcome: 'Welcome', newLead: 'New Lead',
    markAllRead: 'Mark all read', newBadge: 'new', noNotifications: 'No notifications',
    searchAllPlaceholder: 'Search customers · bookings · vehicles · parts · staff · pages...',
    moveHint: '↑↓ Move', openHint: '↵ Open', closeHint: 'Esc Close', goToPage: 'Go to page', noResultsFor: 'No results for', noName: '(No name)',
    grpMenu: 'Pages', grpBookings: 'Bookings', grpCustomers: 'Customers', grpStock: 'Stock', grpStaff: 'Staff',
    grpParts: 'Parts', grpInsurance: 'Insurance', grpTasks: 'Tasks',
  },
  zh: {
    appTagline: '汽车业务运营系统',
    email: '电子邮箱', password: '密码', passwordAgain: '再次输入密码',
    login: '登录', loggingIn: '正在登录...', forgotPassword: '忘记密码？',
    createAccount: '创建新账户', createAccountTitle: '创建新用户账户', creatingAccount: '正在创建账户...',
    passwordMin: '密码（至少8位）', confirmPassword: '确认密码',
    pleaseEnterEmail: '请输入电子邮箱', pleaseEnterPassword: '请输入密码',
    passwordMinError: '密码至少需要8位', passwordMismatch: '密码不一致',
    enterEmailFirst: '请先输入邮箱，再次点击"忘记密码？"',
    searchPlaceholder: '搜索任何内容...',
    filterCompany: '筛选公司', changeTheme: '更换主题', notifications: '通知', chatWithLami: '与 LAMI 对话',
    selectTheme: '选择主题', selectLanguage: '选择语言',
    all: '全部', companies: '家公司',
    collapseSidebar: '收起侧边栏', expandSidebar: '展开侧边栏', menu: '菜单',
    myAccount: '我的账户', logout: '退出登录', user: '用户', alwaysHappyToHelp: '随时为您服务 😊',
    roleOwner: '所有者', roleAdmin: '管理员', roleManager: '经理', roleSales: '销售', roleService: '技师', roleStaff: '员工',
    greetingMorning: '早上好', greetingAfternoon: '下午好', greetingEvening: '晚上好',
    welcome: '欢迎', newLead: '新潜在客户',
    markAllRead: '全部标为已读', newBadge: '条新', noNotifications: '没有通知',
    searchAllPlaceholder: '搜索客户 · 订单 · 车辆 · 配件 · 员工 · 页面...',
    moveHint: '↑↓ 移动', openHint: '↵ 打开', closeHint: 'Esc 关闭', goToPage: '前往页面', noResultsFor: '找不到', noName: '（无名称）',
    grpMenu: '页面', grpBookings: '订车', grpCustomers: '客户', grpStock: '库存', grpStaff: '员工',
    grpParts: '配件', grpInsurance: '保险', grpTasks: '任务',
  },
}

export function t(key) {
  const lang = getState('language') || 'th'
  return DICT[lang]?.[key] ?? DICT.th[key] ?? key
}
