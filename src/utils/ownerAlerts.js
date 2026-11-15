// (v1.0.1163) แถบเตือนเจ้าของบนหน้าแรก — เรื่องที่ "พังเงียบ" ถ้าไม่มีใครเปิดหน้าสถานะระบบ:
// รายงาน LINE 09:00/18:00 ส่งไม่ออกหรือหยุดส่ง, สำรองข้อมูลอัตโนมัติไม่ได้ทำเกิน 36 ชม.
// ใช้เกณฑ์เดียวกับการ์ด "🚦 ความพร้อมใช้งานจริง" (readiness.js) · โชว์เฉพาะข้อที่ "ต้องทำ" จริง ไม่โชว์ข้อที่ตรวจไม่ได้
// ปิดแถบได้ (จำไว้ทั้งวันในเครื่องนี้) · เจ้าของโปรแกรมเท่านั้น (อ่าน system_integrations ได้คนเดียว)
import { readinessItems } from '../pages/settings/readiness.js'
import { escHtml as esc } from './escape.js'

export const ALERT_IDS = ['report_morning', 'report_evening', 'backup']
const TITLES = { report_morning: 'รายงานเช้า 09:00', report_evening: 'รายงานเย็น 18:00', backup: 'สำรองข้อมูลอัตโนมัติ' }

export function ownerAlertItems({ reports = null, lastBackupMs = null, now = Date.now() } = {}) {
  return readinessItems({ status: null, auto: { _noAccess: true }, reports, lastBackupMs, now })
    .filter(i => ALERT_IDS.includes(i.id) && i.state === 'todo')
    .map(i => ({ ...i, title: TITLES[i.id] }))
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
  const items = ownerAlertItems({ reports, lastBackupMs, now })
  if (!items.length || !el.isConnected) return
  el.innerHTML = `<div class="card" role="status" style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin-bottom:12px;border-left:4px solid var(--warning)">
    <div style="font-size:1.2rem;line-height:1">⚠️</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:0.86rem">ระบบมีเรื่องต้องดู ${items.length} ข้อ</div>
      ${items.map(i => `<div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;overflow-wrap:anywhere">• <b>${esc(i.title)}</b>: ${esc(i.hint)}</div>`).join('')}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="btn btn-primary btn-xs" data-nav="/settings/health">ดูหน้าสถานะระบบ</button>
        <button class="btn btn-ghost btn-xs" id="owner-alerts-hide">ซ่อนวันนี้</button>
      </div>
    </div>
  </div>`
  el.querySelector('#owner-alerts-hide')?.addEventListener('click', () => {
    try { localStorage.setItem(KEY, dayKey(Date.now())) } catch { /* ข้าม */ }
    el.innerHTML = ''
  })
}
