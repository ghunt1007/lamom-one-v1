// (2026-11-02) หน้า "หน้าไหนมีข้อมูลจริง" — ใช้ตัดสินใจว่าจะซ่อนเมนูไหน (ซ่อนเท่านั้น ไม่ลบโค้ด)
// ตรรกะล้วน (ไม่แตะ Firestore) เพื่อเทสได้ · ตัวเลขจริงมาจาก settings/PageUsage.js

// ข้อมูลหลักที่หลายหน้าดึงมาโชว์ร่วมกัน — หน้าที่มีแค่ข้อมูลกลุ่มนี้ไม่ได้แปลว่ามีคนใช้หน้านั้นจริง
export const CORE_COLLECTIONS = [
  'bookings', 'customers', 'staff', 'users', 'vehicles', 'vehicle_models', 'branches', 'companies',
  'org_companies', 'company_profile', 'master_data', 'roles', 'user_settings', 'notifications',
]

export const USAGE = {
  own: { key: 'own', label: 'มีข้อมูลของตัวเอง', icon: '🟢' },
  core: { key: 'core', label: 'โชว์แค่ข้อมูลหลัก', icon: '🟡' },
  empty: { key: 'empty', label: 'ไม่มีข้อมูลเลย', icon: '⚪' },
}

export function basePath(p) { return String(p || '').split('?')[0].split('#')[0] }

/**
 * nav: NAV จาก navMenu · pageCols: { path: [collection] } · counts: { col: number|null } · lastTs: { col: ISO }
 * คืน [{ group, items:[{ icon,label,path, cols:[{name,count,core,last}], usage, own, last }], summary }]
 */
export function classifyPages(nav, pageCols, counts = {}, lastTs = {}) {
  const core = new Set(CORE_COLLECTIONS)
  return nav.map(g => {
    const items = g.items.map(i => {
      const names = pageCols[basePath(i.path)] || []
      const cols = names.map(name => ({ name, count: counts[name] ?? null, core: core.has(name), last: lastTs[name] || '' }))
      const ownCols = cols.filter(c => !c.core)
      const own = ownCols.reduce((s, c) => s + (c.count || 0), 0)
      const anyCore = cols.some(c => c.core && c.count > 0)
      const usage = own > 0 ? USAGE.own : anyCore ? USAGE.core : USAGE.empty
      const last = ownCols.map(c => c.last).filter(Boolean).sort().pop() || ''
      return { icon: i.icon, label: i.label, path: i.path, cols, usage, own, last }
    })
    const summary = { total: items.length, own: 0, core: 0, empty: 0 }
    items.forEach(i => { summary[i.usage.key]++ })
    return { group: g.group, items, summary }
  })
}

// รวม collection ทั้งหมดที่ต้องนับ (ไม่ซ้ำ) ของเมนูที่ส่งมา
export function collectionsToCount(nav, pageCols) {
  const set = new Set()
  nav.forEach(g => g.items.forEach(i => (pageCols[basePath(i.path)] || []).forEach(c => set.add(c))))
  return [...set].sort()
}

// จาก audit_log ล่าสุด (เรียงใหม่→เก่า) หาเวลาแก้ล่าสุดของแต่ละ collection
export function lastActivityByCollection(logs) {
  const out = {}
  for (const l of logs) {
    if (!l?.module || !l.ts) continue
    if (!out[l.module] || l.ts > out[l.module]) out[l.module] = l.ts
  }
  return out
}
