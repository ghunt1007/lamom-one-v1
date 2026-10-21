// (v1.0.539) White-label ใช้งานจริงทั้งระบบ — เดิมหน้า /settings/whitelabel บันทึกชื่อแบรนด์/โลโก้/favicon/
// Layout/Default Route ลง Firestore ได้ แต่ไม่มีที่ไหนอ่านค่ากลับมาใช้ตอนเปิดแอปเลย (มีผลแค่แท็บที่กดบันทึก
// จนกว่าจะรีเฟรช) ไฟล์นี้โหลดค่าครั้งเดียวตอน bootstrapShell แล้วเก็บใน store key 'brand'
//
// สีหลัก/สีเสริมของแบรนด์ไม่ถูก apply ตอน boot โดยตั้งใจ — ระบบธีมรายบุคคล (33 ธีม + Light Mode, v1.0.535)
// ใช้ตัวแปร --primary/--accent เดียวกัน ถ้าทับตอน boot ตัวเลือกธีมของพนักงานทุกคนจะใช้ไม่ได้ทันที
import { listDocs } from './db.js'
import { setState, getState } from './store.js'

export const BRAND_DEFAULT = { brandName: 'LAMOM ONE', logoUrl: '', favicon: '', layoutId: '', defaultRoute: '/' }
const POST_LOGIN_KEY = 'lamom_post_login'

// รับเฉพาะ URL http(s) หรือ path ภายในเว็บ — กัน javascript:/data: ที่ใส่ผ่านช่อง URL
export function safeAssetUrl(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//'))) return u
  return ''
}

export function applyBrand(cfg) {
  const brand = {
    ...BRAND_DEFAULT,
    brandName: String(cfg?.brandName || '').trim() || BRAND_DEFAULT.brandName,
    logoUrl: safeAssetUrl(cfg?.logoUrl),
    favicon: safeAssetUrl(cfg?.favicon),
    layoutId: cfg?.layoutId || '',
    defaultRoute: typeof cfg?.defaultRoute === 'string' && cfg.defaultRoute.startsWith('/') ? cfg.defaultRoute : '/',
  }
  setState('brand', brand)
  if (brand.brandName !== BRAND_DEFAULT.brandName) document.title = brand.brandName
  if (brand.favicon) {
    const link = document.querySelector('link[rel="icon"]')
    if (link) { link.removeAttribute('type'); link.href = brand.favicon }
  }
  return brand
}

// Layout ที่เจ้าของเลือกเป็นค่าเริ่มต้นของทั้งองค์กร — ใช้เฉพาะคนที่ยังไม่เคยกดย่อ/ขยายเมนูเอง
// (toggleSidebar() เขียน localStorage 'lamom_sidebar' ไว้แล้ว ค่าที่พนักงานเลือกเองต้องชนะเสมอ)
export function applyLayoutDefault(layoutId) {
  let userChose = false
  try { userChose = localStorage.getItem('lamom_sidebar') !== null } catch {}
  if (userChose) return
  if (layoutId === 'sidebar-compact' && !getState('sidebarCollapsed')) setState('sidebarCollapsed', true)
  if (layoutId === 'sidebar-full' && getState('sidebarCollapsed')) setState('sidebarCollapsed', false)
}

export function markPostLogin() {
  try { sessionStorage.setItem(POST_LOGIN_KEY, '1') } catch {}
}
export function clearPostLogin() {
  try { sessionStorage.removeItem(POST_LOGIN_KEY) } catch {}
}

// Default Route หลัง Login — ใช้เฉพาะตอนเพิ่ง login สำเร็จแล้วถูกส่งมาที่ '/' (ไม่ดีดคนที่รีเฟรชหน้า Dashboard เอง)
export function postLoginRoute(brand, path) {
  let fresh = false
  try { fresh = sessionStorage.getItem(POST_LOGIN_KEY) === '1' } catch {}
  clearPostLogin()
  if (!fresh || path !== '/') return null
  return brand?.defaultRoute && brand.defaultRoute !== '/' ? brand.defaultRoute : null
}

export async function loadWhiteLabel() {
  try {
    const docs = await listDocs('whitelabel_settings', [], 'createdAt', 'asc', 1)
    const brand = applyBrand(docs[0] || {})
    applyLayoutDefault(brand.layoutId)
    return brand
  } catch {
    return applyBrand({})
  }
}
