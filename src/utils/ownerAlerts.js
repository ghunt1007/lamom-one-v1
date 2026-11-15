// (v1.0.1163) แถบเตือนเจ้าของบนหน้าแรก — เรื่องที่ "พังเงียบ" ถ้าไม่มีใครเปิดหน้าสถานะระบบ:
// รายงาน LINE 09:00/18:00 ส่งไม่ออกหรือหยุดส่ง, สำรองข้อมูลอัตโนมัติไม่ได้ทำเกิน 36 ชม.
// ใช้เกณฑ์เดียวกับการ์ด "🚦 ความพร้อมใช้งานจริง" (readiness.js) · โชว์เฉพาะข้อที่ "ต้องทำ" จริง ไม่โชว์ข้อที่ตรวจไม่ได้
// ปิดแถบได้ (จำไว้ทั้งวันในเครื่องนี้) · เจ้าของโปรแกรมเท่านั้น (อ่าน system_integrations ได้คนเดียว)
import { readinessItems } from '../pages/settings/readiness.js'
import { escHtml as esc } from './escape.js'

export const ALERT_IDS = ['report_morning', 'report_evening', 'backup']
const TITLES = { report_morning: 'รายงานเช้า 09:00', report_evening: 'รายงานเย็น 18:00', backup: 'สำรองข้อมูลอัตโนมัติ' }

// (v1.0.1181) ฟอร์มฝากชื่อปิดอยู่ แต่มีลิงก์/QR ที่แจกออกไปแล้ว (แนะนำเพื่อน, หน้าแคมเปญ, UTM, QR ติดรถ, งานบูธที่ยังไม่จบ)
// → ลูกค้าที่สแกน/กดเข้ามาจะเจอ "ฟอร์มนี้ปิดรับอยู่" ลีดหายเงียบ · links = { referrers, landing, utm, showroom, events } (จำนวน)
export function formOffItem(publicForm, links = {}) {
  if (publicForm !== false) return null
  const LABEL = { referrers: 'ลิงก์แนะนำเพื่อน', landing: 'หน้าเว็บแคมเปญ', utm: 'ลิงก์ UTM', showroom: 'QR ติดรถ', events: 'งานบูธที่ยังไม่จบ' }
  const used = Object.entries(LABEL).filter(([k]) => Number(links[k]) > 0).map(([k, l]) => `${l} ${links[k]}`)
  if (!used.length) return null
  return { id: 'publicform', state: 'todo', title: 'ฟอร์มฝากชื่อปิดอยู่', hint: `มีลิงก์/QR ที่แจกออกไปแล้ว (${used.join(', ')}) ลูกค้าที่กดเข้ามาจะส่งข้อมูลไม่ได้ — เปิดที่ 🔗 ช่องทางโซเชียล › 🤖 ตอบอัตโนมัติ`, nav: '/marketing/channels?tab=auto' }
}

export function ownerAlertItems({ reports = null, lastBackupMs = null, now = Date.now(), publicForm, links } = {}) {
  const out = readinessItems({ status: null, auto: { _noAccess: true }, reports, lastBackupMs, now })
    .filter(i => ALERT_IDS.includes(i.id) && i.state === 'todo')
    .map(i => ({ ...i, title: TITLES[i.id] }))
  const f = formOffItem(publicForm, links)
  return f ? [f, ...out] : out
}

const KEY = 'lamom.ownerAlertsHidden'
const dayKey = now => new Date(now + 7 * 3600e3).toISOString().slice(0, 10)

export async function mountOwnerAlerts(el, { now = Date.now() } = {}) {
  if (!el) return
  const { isProgramOwner } = await import('../core/hierarchy.js')
  if (!isProgramOwner()) return
  try { if (localStorage.getItem(KEY) === dayKey(now)) return } catch { /* ไม่มี storage ก็โชว์ */ }
  const { readDoc, listDocs } = await import('../core/db.js')
  let reports = null, lastBackupMs = null
  try { reports = await readDoc('system_integrations', 'report_status') } catch { /* ไม่มีสิทธิ์/ออฟไลน์ */ }
  try {
    const b = await listDocs('system_backups', [], 'time', 'desc', 20)
    const ok = b.find(x => x.status === 'success' || x.status === 'partial')
    if (ok) lastBackupMs = Date.parse(ok.time) || null
  } catch { /* ข้าม */ }
  let publicForm, links = {}
  try {
    const auto = await readDoc('system_integrations', 'inbox_auto')
    publicForm = !!auto?.publicForm
    if (!publicForm) {
      const today = new Date(now + 7 * 3600e3).toISOString().slice(0, 10)
      const n = async (col, sortBy, keep = () => true) => { try { return (await listDocs(col, [], sortBy, 'desc', 200)).filter(d => !d.deleted && keep(d)).length } catch { return 0 } }
      const [referrers, landing, utm, showroom, events] = await Promise.all([
        n('referrers', 'createdAt'), n('landing_pages', 'created', d => d.status !== 'ended'), n('utm_links', 'created'), n('digital_showroom', 'model'),
        n('marketing_events', 'startDate', d => d.status !== 'cancelled' && String(d.endDate || d.startDate || '') >= today),
      ])
      links = { referrers, landing, utm, showroom, events }
    }
  } catch { /* อ่านสวิตช์ไม่ได้ — ไม่เตือนเรื่องนี้ */ }
  const items = ownerAlertItems({ reports, lastBackupMs, now, publicForm, links })
  if (!items.length || !el.isConnected) return
  el.innerHTML = `<div class="card" role="status" style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin-bottom:12px;border-left:4px solid var(--warning)">
    <div style="font-size:1.2rem;line-height:1">⚠️</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:0.86rem">ระบบมีเรื่องต้องดู ${items.length} ข้อ</div>
      ${items.map(i => `<div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;overflow-wrap:anywhere">• <b>${esc(i.title)}</b>: ${esc(i.hint)}</div>`).join('')}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${items.some(i => i.id === 'publicform') ? '<button class="btn btn-primary btn-xs" data-nav="/marketing/channels?tab=auto">🔗 ไปเปิดฟอร์ม</button>' : ''}
        ${items.some(i => i.id !== 'publicform') ? '<button class="btn btn-primary btn-xs" data-nav="/settings/health">ดูหน้าสถานะระบบ</button>' : ''}
        <button class="btn btn-ghost btn-xs" id="owner-alerts-hide">ซ่อนวันนี้</button>
      </div>
    </div>
  </div>`
  el.querySelector('#owner-alerts-hide')?.addEventListener('click', () => {
    try { localStorage.setItem(KEY, dayKey(Date.now())) } catch { /* ข้าม */ }
    el.innerHTML = ''
  })
}
