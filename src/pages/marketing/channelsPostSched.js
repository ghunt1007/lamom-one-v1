// (v1.0.1152) ตั้งเวลาโพสต์ลงเพจ Facebook / Instagram — ส่วนของแท็บ 📝 โพสต์
// เขียนโพสต์ไว้ล่วงหน้า เลือกวันเวลา แล้วระบบโพสต์เองภายใน 10 นาทีหลังเวลาที่ตั้ง (workers/scheduledPost.js)
import { showToast, getState } from '../../core/store.js'
import { escHtml as esc } from '../../utils/escape.js'
import { formatDateTime } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { isManagerRole } from '../../utils/managerRole.js'
import { metaPostSchedule, metaPostUnschedule, metaPostScheduled } from '../../utils/socialApi.js'

export const STATUS_LABEL = { sent: '✅ โพสต์แล้ว', partial: '⚠️ โพสต์ได้บางส่วน', failed: '❌ โพสต์ไม่สำเร็จ', missed: '⏭ ข้าม (เลยเวลา)' }

/** ตรวจโพสต์ก่อนตั้งเวลา → ข้อความ error หรือ '' */
export function draftProblem(d = {}, nowMs = Date.now()) {
  if (!d.pageIds?.length) return 'เลือกเพจก่อน'
  if (!String(d.message || '').trim() && !d.imageUrl) return 'พิมพ์ข้อความก่อน'
  if (d.toInstagram && !d.imageUrl) return 'Instagram ต้องมีลิงก์รูป'
  if (d.at !== undefined) {
    const t = new Date(d.at || '').getTime()
    if (!Number.isFinite(t)) return 'เลือกวันและเวลา'
    if (t < nowMs + 60_000) return 'เวลาที่เลือกผ่านไปแล้ว — เลือกเวลาในอนาคต'
    if (t > nowMs + 60 * 864e5) return 'กำหนดล่วงหน้าได้ไม่เกิน 60 วัน'
  }
  return ''
}

const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s }

export function canSchedulePosts() {
  return isManagerRole() || (getState('role') || getState('user')?.role) === 'marketing'
}

export function createPostSched({ getDraft, getPages, rerender }) {
  let data = null, loading = false, err = '', busy = ''
  const allowed = canSchedulePosts()

  async function load(force = false) {
    if (loading || (data && !force)) return
    loading = true; err = ''
    try { data = await metaPostScheduled() } catch (e) { err = e.message || 'โหลดไม่สำเร็จ' }
    loading = false; rerender()
  }

  const row = (r, pending) => `
    <div class="ch-sp-row">
      <div class="ch-sp-main"><b>${esc(formatDateTime(r.at))}</b> <small class="ch-muted">${esc((r.pageNames || []).join(', ') || `${r.pages} เพจ`)}${r.toInstagram ? ' + Instagram' : ''}${r.by ? ` · โดย ${esc(r.by)}` : ''}</small>
        <div class="ch-sp-msg">${r.imageUrl ? '🖼 ' : ''}${esc(cut(r.message, 140)) || '<i>(รูปอย่างเดียว)</i>'}</div>
        ${pending ? '' : `<small class="ch-sp-st">${esc(STATUS_LABEL[r.status] || r.status)}${r.note ? ` · ${esc(r.note)}` : ''}</small>`}
      </div>
      ${pending && allowed ? `<button type="button" class="btn btn-ghost btn-sm" data-sp-cancel="${esc(r.id)}" ${busy ? 'disabled' : ''}>✖ ยกเลิก</button>` : ''}
    </div>`

  /** ปุ่มตั้งเวลา (วางใต้ปุ่ม 🚀 โพสต์เลย) */
  function buttonHtml() {
    return allowed ? '<button type="button" class="btn btn-secondary" id="ps-sched">⏰ ตั้งเวลาโพสต์</button>' : ''
  }

  /** การ์ดรายการที่ตั้งเวลาไว้ + ผลล่าสุด */
  function html() {
    if (!data && !err) { load(); return '<div class="ch-card"><div class="ch-card-h">⏰ โพสต์ที่ตั้งเวลาไว้</div><div class="ch-muted">⏳ กำลังโหลด…</div></div>' }
    if (err && !data) return `<div class="ch-card"><div class="ch-card-h">⏰ โพสต์ที่ตั้งเวลาไว้</div><div class="ch-note bad">⚠️ ${esc(err)}</div><button type="button" class="btn btn-secondary btn-sm" id="sp-reload">🔄 ลองใหม่</button></div>`
    const p = data.pending || [], r = data.recent || []
    return `
      <div class="ch-card ch-sp">
        <div class="ch-card-h">⏰ โพสต์ที่ตั้งเวลาไว้ <small class="ch-muted">${p.length} รายการ · ระบบโพสต์เองภายใน 10 นาทีหลังเวลาที่ตั้ง</small></div>
        ${p.length ? p.map(x => row(x, true)).join('') : `<div class="ch-muted">ยังไม่มี${allowed ? ' — เขียนโพสต์ด้านบนแล้วกด "⏰ ตั้งเวลาโพสต์"' : ''}</div>`}
        ${r.length ? `<div class="ch-g-h">ผลล่าสุด (เก็บ 14 วัน)</div>${r.map(x => row(x, false)).join('')}` : ''}
        <button type="button" class="btn btn-ghost btn-sm" id="sp-reload">🔄 ดึงใหม่</button>
      </div>`
  }

  function openSchedule() {
    const d = getDraft()
    const pages = getPages().filter(p => d.pageIds.includes(p.id))
    const problem = draftProblem(d)
    if (problem) { showToast(problem, 'error'); return }
    openModal({
      title: '⏰ ตั้งเวลาโพสต์',
      size: 'sm',
      body: `<div class="input-group"><label class="input-label" for="sp-at">วันและเวลาที่ต้องการโพสต์ *</label><input class="input" type="datetime-local" id="sp-at"></div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:8px">จะโพสต์ลง: <b>${esc(pages.map(p => p.name).join(', '))}${d.toInstagram ? ' + Instagram' : ''}</b><br>ถึงเวลาแล้วระบบโพสต์ให้เอง ไม่ต้องกลับมากด · ยกเลิกได้ก่อนถึงเวลา · ถ้าระบบล่มเกิน 6 ชั่วโมงจะไม่โพสต์ย้อนหลัง</div>`,
      confirmText: '💾 บันทึกกำหนดการ',
      async onConfirm() {
        const val = document.getElementById('sp-at')?.value
        const at = val ? new Date(val).toISOString() : ''
        const p2 = draftProblem({ ...d, at })
        if (p2) { showToast('❗ ' + p2, 'error'); return false }
        try {
          const r = await metaPostSchedule({ ...d, pageNames: pages.map(p => p.name), imageUrl: d.imageUrl || undefined, link: d.link || undefined, at })
          if (r.configured === false) { showToast(r.error || 'ยังไม่ได้เชื่อม Facebook', 'error'); return false }
          showToast(`✅ ตั้งเวลาแล้ว — จะโพสต์ ${formatDateTime(at)}`, 'success', 6000)
          load(true)
        } catch (e) { showToast(e.message || 'ตั้งเวลาไม่สำเร็จ', 'error'); return false }
      },
    })
  }

  async function cancel(id) {
    if (!(await confirmDialog({ title: 'ยกเลิกโพสต์ที่ตั้งเวลาไว้?', message: 'โพสต์นี้จะไม่ถูกโพสต์ และจะหายจากรายการ', confirmText: '✖ ยกเลิกโพสต์นี้' }))) return
    busy = id; rerender()
    try { await metaPostUnschedule(id); showToast('ยกเลิกแล้ว', 'success') } catch (e) { showToast(e.message || 'ยกเลิกไม่สำเร็จ', 'error') }
    busy = ''; await load(true)
  }

  function handleClick(t) {
    if (t.closest('#ps-sched')) { openSchedule(); return true }
    if (t.closest('#sp-reload')) { data = null; err = ''; rerender(); return true }
    const c = t.closest('[data-sp-cancel]'); if (c) { cancel(c.dataset.spCancel); return true }
    return false
  }

  return { html, buttonHtml, handleClick }
}
