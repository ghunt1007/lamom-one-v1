// Module-level access control — maps sidebar groups/routes to a role's permitted modules
import { listDocs } from './db.js'

export const MODULES = [
  { key: 'sales',      label: 'การขาย',        prefixes: ['/crm'] },
  { key: 'dms',        label: 'โชว์รูม',        prefixes: ['/dms'] },
  { key: 'service',    label: 'บริการ',        prefixes: ['/service'] },
  { key: 'finance',    label: 'การเงิน',        prefixes: ['/finance'] },
  { key: 'insurance',  label: 'ประกัน',        prefixes: ['/insurance'] },
  { key: 'marketing',  label: 'การตลาด',       prefixes: ['/marketing'] },
  { key: 'hr',         label: 'องค์กร',        prefixes: ['/hr', '/training', '/analytics', '/gamification'] },
  { key: 'documents',  label: 'เอกสาร',        prefixes: ['/documents'] },
  { key: 'ai',         label: 'AI & งาน',      prefixes: ['/ai', '/tasks', '/calendar', '/notes'] },
  { key: 'comms',      label: 'สื่อสาร',        prefixes: ['/comms'] },
  { key: 'quality',    label: 'คุณภาพ',        prefixes: ['/quality'] },
  { key: 'b2b',        label: 'B2B & Partner', prefixes: ['/b2b'] },
  { key: 'settings',   label: 'ระบบ',          prefixes: ['/settings', '/integrations', '/migration'] },
]

// Paths not covered by any module (dashboard, notifications, login, etc.) are always allowed
export function getModuleForPath(path) {
  return MODULES.find(m => m.prefixes.some(p => path === p || path.startsWith(p + '/'))) || null
}

// (v1.0.520) extraGrants — สิทธิ์เสริมรายบุคคลนอกเหนือจาก role (เพิ่มเท่านั้น ไม่แทนที่) ค่าที่เป็นไปได้:
// 'finance'/'hr'/'sales'/'service' เท่านั้น (ไม่รวม manager/admin — ดูเหตุผลใน firestore.rules myGrants()) ผูกกับ
// module เดียวกับที่ role นั้นเปิดใช้งานตามปกติ ใช้แพทเทิร์นเดียวกับ firestore.rules myGrants()/isFinance()
export const GRANT_MODULE_MAP = { finance: 'finance', hr: 'hr', sales: 'sales', service: 'service' }

let cache = null
let cachePromise = null

export async function loadRolePermissions(force = false) {
  if (cache && !force) return cache
  if (cachePromise && !force) return cachePromise
  cachePromise = (async () => {
    try {
      const docs = await listDocs('roles', [], 'id', 'asc', 100)
      cache = {}
      docs.forEach(d => { cache[d.id] = d.modules || [] })
    } catch (e) { cache = {} }
    return cache
  })()
  return cachePromise
}

export function invalidateRolePermissionsCache() { cache = null; cachePromise = null }

// Synchronous check using whatever is currently cached — call loadRolePermissions() first to warm the cache
export function hasModuleAccess(role, moduleKey, extraGrants) {
  if (!moduleKey) return true // ungated paths (dashboard, etc.)
  if (!role) return true // no role info yet — fail open rather than lock out during load
  if (!cache) return true // permissions not loaded yet — fail open, real check happens after load
  const modules = cache[role]
  if (modules === undefined) return true // role has no configured restriction — default full access
  if (modules.includes('*') || modules.includes(moduleKey)) return true
  // (v1.0.520) role เดิมไม่ผ่าน — เช็คสิทธิ์เสริมรายบุคคล (extraGrants) เพิ่มอีกชั้น ก่อนตัดสิทธิ์จริง
  if (extraGrants?.some(g => GRANT_MODULE_MAP[g] === moduleKey)) return true
  return false
}
