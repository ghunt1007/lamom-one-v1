// (v1.0.981) แถบบอก "หน้านี้มีหน้าใหม่ที่ดีกว่าแล้ว" — ลดการทำงานซ้ำซ้อนระหว่างหน้าเก่ากับหน้าใหม่ (หน้าเก่ายังเปิดดูข้อมูลเดิมได้)
import { navigate } from '../core/router.js'
import { escHtml } from './escape.js'

export function movedBannerHtml(to, label, note = '') {
  return `<div class="card" style="padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-left:3px solid var(--primary)">
    <div style="flex:1;min-width:200px;font-size:0.82rem">✨ ตอนนี้ใช้หน้า <b>${escHtml(label)}</b> แทนแล้ว${note ? ` — ${escHtml(note)}` : ''}</div>
    <button type="button" class="btn btn-primary btn-sm moved-go" data-to="${escHtml(to)}">ไปหน้าใหม่ →</button>
  </div>`
}

export function bindMovedBanner(container) {
  if (!container || container.__movedBound) return
  container.__movedBound = true
  container.addEventListener('click', e => {
    const b = e.target.closest('.moved-go')
    if (b && container.contains(b)) navigate(b.dataset.to)
  })
}
