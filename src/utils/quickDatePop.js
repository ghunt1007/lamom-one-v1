// (v1.0.1042) ป็อปอัพเลือกวันแบบแตะเดียว (พรุ่งนี้ / อีก 3 วัน / สัปดาห์หน้า …) — ใช้กับ "เลื่อนนัด" และ "นัดวันส่งมอบ"
// anchor = ปุ่มที่กด · options = [[จำนวนวันจากวันนี้, ป้าย]] · extra = { label, onClick } (เช่น "เลือกวันเอง…")
import { addDaysBangkok, formatDate } from './format.js'
import { escHtml } from './escape.js'

export const QUICK_DAYS = [[1, 'พรุ่งนี้'], [3, 'อีก 3 วัน'], [7, 'สัปดาห์หน้า']]

export function openQuickDatePop(anchor, { options = QUICK_DAYS, onPick, extra } = {}) {
  document.getElementById('quick-date-pop')?.remove()
  const pop = document.createElement('div')
  pop.id = 'quick-date-pop'; pop.className = 'fu-snooze-pop'
  pop.innerHTML = options.map(([n, l]) => `<button type="button" data-n="${n}">📅 ${escHtml(l)} <small>${formatDate(addDaysBangkok(n))}</small></button>`).join('') +
    (extra ? `<button type="button" data-x="1">${escHtml(extra.label)}</button>` : '')
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8)) + 'px'
  pop.style.left = Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8)) + 'px'
  const close = () => { pop.remove(); document.removeEventListener('click', onDoc); window.removeEventListener('popstate', close) }
  const onDoc = ev => { if (!pop.contains(ev.target)) close() }
  setTimeout(() => document.addEventListener('click', onDoc), 30)
  window.addEventListener('popstate', close)
  pop.querySelectorAll('button').forEach(o => o.addEventListener('click', () => {
    close()
    if (o.dataset.x) extra.onClick?.()
    else onPick?.(addDaysBangkok(+o.dataset.n))
  }))
  return close
}
