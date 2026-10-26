// breadcrumb แถบบน = ชื่อกลุ่ม + ชื่อหน้า จากเมนูชุดเดียวกับแถบซ้าย (data/navMenu.js) — เดิมเป็นรายการเขียนมือ
// แยกอีกชุด มีแค่ ~25 หน้า (อีก 300 หน้าไม่มีชื่อเลย) และชื่อไม่ตรงกับเมนู เช่นเมนู "ภาพรวมบริษัท" แต่แถบบนเขียน "Dashboard"
import { SIMPLE_LABELS } from './navSimple.js'

// route ที่ใช้หน้าเดียวกับเมนูอื่น (core/router.js) แต่ไม่มีในเมนู
const SAME_PAGE = { '/crm/leads': '/crm/customers', '/service/parts-inventory': '/service/parts', '/crm/anniversary': '/crm/birthdays' }

function findItem(nav, path) {
  for (const g of nav) for (const i of g.items) if (i.path === path) return { g, i }
  return null
}

export function breadcrumbFor(nav, route, lang = 'th') {
  const raw = String(route || '/').split('?')[0].replace(/\/+$/, '') || '/'
  const path = SAME_PAGE[raw] || raw
  // หน้าย่อยที่ไม่มีในเมนู (เช่น /crm/leads) ใช้ชื่อหน้าแม่ที่ใกล้ที่สุด
  let p = path, hit = findItem(nav, p)
  while (!hit && p.lastIndexOf('/') > 0) { p = p.slice(0, p.lastIndexOf('/')); hit = findItem(nav, p) }
  if (!hit) return []
  const { g, i } = hit
  const group = (lang === 'en' ? g.groupEn : lang === 'zh' ? g.groupZh : null) || g.group
  const label = lang === 'en' ? i.labelEn || i.label : lang === 'zh' ? i.labelZh || i.label : SIMPLE_LABELS[i.path] || i.label
  return [group, label]
}
