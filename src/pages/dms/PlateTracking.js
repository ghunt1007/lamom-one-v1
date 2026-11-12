/**
 * Plate & Registration Tracking — ติดตามป้ายแดง/ป้ายขาว
 * Route: /dms/plates
 *
 * (v1.0.1104) ใช้ข้อมูลจริงจาก "ใบจอง" (ส่งมอบแล้ว) แทนรายการป้ายแดงสมมติ (ก-0041…) และคอลเลกชันแยกที่ต้องกรอกซ้ำ
 * กรอกเลขป้ายแดง/ป้ายขาวที่นี่ → บันทึกลงใบจองนั้นทันที (ช่องเดียวกับฟอร์มใบจองและ Sheet)
 */
import { formatDate, todayBangkok } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listAllDocs, listDocs, updateDocData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { escHtml } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'
import { carOf } from '../../utils/carLabel.js'
import { navigate } from '../../core/router.js'
import { plateRows, plateSummary, filterPlateRows, PLATE_LATE_DAYS } from '../../utils/plateList.js'

const VIEWS = [['pending', '🟥 ยังไม่ได้ป้ายขาว'], ['late', `⚠️ เกิน ${PLATE_LATE_DAYS} วัน`], ['done', '✅ ได้ป้ายขาวแล้ว'], ['all', 'ทั้งหมด']]

export default async function PlateTrackingPage(container) {
  const myGen = container.__routerGen
  let rows = [], legacy = [], loading = true, failed = false
  let view = 'pending', q = ''
  const today = todayBangkok()

  async function load() {
    try {
      const bookings = await listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc')
      rows = plateRows(bookings, { today })
      failed = false
    } catch { failed = true }
    // รายการเก่าที่เคยบันทึกไว้ในหน้านี้ (ก่อน v1.0.1104) — แสดงให้เห็นไว้ ไม่ลบ
    legacy = (await listDocs('plate_tracking', [], 'deliveredDate', 'desc', 200).catch(() => [])).filter(r => r && !r.deleted && r.status !== 'plated')
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function card(r) {
    const b = r.b
    const name = b.custName || b.customerName || 'ลูกค้า'
    const tone = r.white ? 'success' : r.late || r.dupRed ? 'danger' : 'warning'
    return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${tone})" data-row="${escHtml(b.id)}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="min-width:0;flex:1 1 200px">
          <div style="font-weight:700;font-size:0.9rem;overflow-wrap:anywhere">${escHtml(name)}${carOf(b) ? ` <span style="font-weight:500;color:var(--text-muted);font-size:0.8rem">· ${escHtml(carOf(b))}</span>` : ''}</div>
          <div style="font-size:0.74rem;color:var(--text-muted);overflow-wrap:anywhere">ส่งมอบ ${formatDate(r.b.actualDeliveryDate || r.b.deliveryDate)} (${r.age} วัน)${b.salesName ? ' · 👤 ' + escHtml(b.salesName) : ''}${b.vin ? ' · VIN …' + escHtml(String(b.vin).slice(-6)) : ''}</div>
        </div>
        <span class="badge badge-${tone}" style="font-size:0.66rem;white-space:nowrap">${r.white ? '✅ ได้ป้ายขาวแล้ว' : r.dupRed ? '⚠️ ป้ายแดงซ้ำกับคันอื่น' : r.late ? `⚠️ เกิน ${PLATE_LATE_DAYS} วัน` : r.red ? '🟥 ใช้ป้ายแดง' : '❔ ยังไม่กรอกป้ายแดง'}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:8px;align-items:end">
        <label class="input-group" style="margin:0"><span class="input-label" style="font-size:0.7rem">🟥 ป้ายแดง</span><input class="input pl-red" value="${escHtml(r.red)}" placeholder="ยังไม่กรอก" autocomplete="off"></label>
        <label class="input-group" style="margin:0"><span class="input-label" style="font-size:0.7rem">⬜ ป้ายขาว (ทะเบียนจริง)</span><input class="input pl-white" value="${escHtml(r.white)}" placeholder="ยังไม่กรอก" autocomplete="off"></label>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-primary pl-save" style="flex:1">💾 บันทึก</button>
          <button class="btn btn-sm btn-secondary pl-open" title="เปิดใบจอง">📝</button>
        </div>
      </div>
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const st = plateSummary(rows)
    const list = filterPlateRows(rows, { view, q })
    const count = { pending: st.pending, late: st.late, done: st.done, all: rows.length }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🪪 ติดตามป้ายทะเบียน</div>
            <div class="page-subtitle">รถที่ส่งมอบแล้วใน 180 วัน · ข้อมูลจากใบจอง กรอกที่นี่แล้วใบจองอัปเดตให้เอง</div>
          </div>
        </div>
        ${failed ? `<div class="card" style="padding:12px 14px;margin-bottom:12px;color:var(--danger)">โหลดใบจองไม่สำเร็จ ลองรีเฟรชอีกครั้ง</div>` : ''}
        <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:14px">
          ${kpi('🟥 ยังไม่ได้ป้ายขาว', st.pending + ' คัน', st.pending ? 'warning' : 'success')}
          ${kpi(`⚠️ เกิน ${PLATE_LATE_DAYS} วัน`, st.late + ' คัน', st.late ? 'danger' : 'success')}
          ${kpi('🟥 ป้ายแดงที่ใช้อยู่', st.redInUse + ' แผ่น', 'secondary')}
          ${kpi('✅ ได้ป้ายขาวแล้ว', st.done + ' คัน', 'success')}
        </div>
        ${st.dup ? `<div class="card" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--danger);font-size:0.8rem">⚠️ มีป้ายแดงแผ่นเดียวกันอยู่กับรถ ${st.dup} คัน — ตรวจเลขป้ายให้ถูกก่อนออกรถคันถัดไป</div>` : ''}
        ${st.late ? `<div class="card" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--danger);font-size:0.8rem">⚠️ ป้ายแดงใช้ได้ไม่เกิน ${PLATE_LATE_DAYS} วันหลังรับรถ — ตามงานทะเบียน ${st.late} คันนี้ก่อน</div>` : ''}
        <div class="chip-scroll" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${VIEWS.map(([k, l]) => `<button class="btn btn-sm ${view === k ? 'btn-primary' : 'btn-secondary'} pl-view" data-v="${k}">${l} ${count[k]}</button>`).join('')}
        </div>
        <input class="input" id="pl-q" placeholder="🔍 ค้นหาชื่อ รุ่น เลขตัวถัง หรือเลขป้าย" value="${escHtml(q)}" style="margin-bottom:12px" autocomplete="off">
        <div id="pl-list" style="display:flex;flex-direction:column;gap:10px">
          ${list.length ? list.slice(0, 200).map(card).join('') : `<div class="empty-state" style="padding:36px"><div class="empty-icon">${rows.length ? '🔍' : '🚗'}</div><div class="empty-title">${rows.length ? (view === 'pending' && !q ? 'รถทุกคันได้ป้ายขาวครบแล้ว 👍' : 'ไม่พบรายการ') : 'ยังไม่มีรถที่ส่งมอบใน 180 วัน'}</div><div class="empty-desc">${rows.length ? 'ลองเปลี่ยนตัวกรองหรือคำค้นหา' : 'เมื่อใบจองเปลี่ยนเป็น "ส่งมอบแล้ว" รถจะขึ้นที่นี่ให้ตามทะเบียนเอง'}</div></div>`}
        </div>
        ${legacy.length ? `<div class="card" style="padding:12px 14px;margin-top:16px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px">📁 รายการที่บันทึกไว้แบบเดิม (${legacy.length})</div>
          <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:6px">บันทึกไว้ก่อนหน้านี้ ยังไม่ได้ผูกกับใบจอง — กรอกป้ายในใบจองของลูกค้าคนนั้นด้านบนแทนได้เลย</div>
          ${legacy.map(r => `<div style="font-size:0.78rem;padding:4px 0;border-top:1px solid var(--border);overflow-wrap:anywhere">${escHtml(r.customer || '-')} · ${escHtml(r.model || '-')} · ป้ายแดง ${escHtml(r.redPlate || '-')}${r.newPlate ? ' · ทะเบียน ' + escHtml(r.newPlate) : ''} · ส่งมอบ ${formatDate(r.deliveredDate)}</div>`).join('')}
        </div>` : ''}
      </div>`

    container.querySelectorAll('.pl-view').forEach(b => b.addEventListener('click', () => { view = b.dataset.v; render() }))
    const qi = container.querySelector('#pl-q')
    qi?.addEventListener('input', () => {
      q = qi.value
      const l = filterPlateRows(rows, { view, q })
      const box = container.querySelector('#pl-list')
      if (box) { box.innerHTML = l.length ? l.slice(0, 200).map(card).join('') : `<div class="empty-state" style="padding:36px"><div class="empty-icon">🔍</div><div class="empty-title">ไม่พบรายการ</div></div>`; bindRows() }
    })
    bindRows()
  }

  function bindRows() {
    container.querySelectorAll('[data-row]').forEach(el => {
      const id = el.dataset.row
      const r = rows.find(x => x.b.id === id)
      if (!r) return
      const save = el.querySelector('.pl-save')
      el.querySelector('.pl-open')?.addEventListener('click', () => navigate('/crm/bookings?id=' + encodeURIComponent(id)))
      const doSave = async () => {
        const red = el.querySelector('.pl-red').value.trim(), white = el.querySelector('.pl-white').value.trim()
        if (red === r.red && white === r.white) { showToast('ไม่มีอะไรเปลี่ยน', 'info'); return }
        save.disabled = true
        try {
          await updateDocData('bookings', id, { redPlate: red, whitePlate: white })
          r.b.redPlate = red; r.b.whitePlate = white
          showToast(white && !r.white ? '✅ บันทึกป้ายขาวแล้ว — ปิดงานทะเบียนคันนี้' : '💾 บันทึกแล้ว', 'success')
          await load()
        } catch { showToast('บันทึกไม่สำเร็จ (อาจไม่มีสิทธิ์แก้ใบจองนี้)', 'error'); save.disabled = false }
      }
      save?.addEventListener('click', doSave)
      el.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSave() } }))
    })
  }

  render()
  await load()
}
