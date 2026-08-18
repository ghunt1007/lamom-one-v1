/**
 * Data Retention Policy — จัดการอายุการเก็บข้อมูล log/ประวัติที่ไม่จำเป็นต้องเก็บตลอดไป
 * Route: /settings/data-retention
 *
 * (v1.0.351) โมดูลที่ยังไม่มีในระบบ (ตามรายงานตรวจสอบ) — ตัดสินใจร่วมกับเจ้าของแล้วว่าต้องกดยืนยันเอง
 * ทุกครั้ง ไม่มี cron ลบข้อมูลอัตโนมัติ (เสี่ยงเกินไปสำหรับเวอร์ชันแรก ถ้าตั้งค่าผิดจะลบข้อมูลจริงถาวรโดย
 * ไม่มีใครเห็นก่อน) — หน้านี้จึงเป็นแค่เครื่องมือ "ตรวจสอบ + ลบตอนนี้" ที่แอดมินสั่งเองทุกครั้ง ไม่ใช่ระบบ
 * ทำงานเบื้องหลัง จำกัดเฉพาะ collection ประเภท log/ประวัติที่ไม่มีมูลค่าทางธุรกิจ/กฎหมายให้เก็บตลอดไป —
 * ห้ามรวม audit_log เด็ดขาด (Firestore Rules ตั้งใจกัน update/delete ไว้ถาวรเพื่อความน่าเชื่อถือของ log
 * ตรวจสอบ) และห้ามรวมข้อมูลลูกค้า/การเงิน/เอกสารที่มีผลทางกฎหมาย
 */
import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, listAllDocs, createDoc, softDelete, hardDeleteDoc } from '../../core/db.js'
import { isProgramOwner } from '../../core/hierarchy.js'

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function toDate(v) { return v?.toDate ? v.toDate() : new Date(v) }

const RETAINABLE_COLLECTIONS = {
  error_log: 'Error Log (บันทึกข้อผิดพลาดระบบ)',
  notifications: 'การแจ้งเตือน',
  security_sessions: 'Security Sessions (ประวัติ login)',
  security_alerts: 'Security Alerts (เหตุการณ์ความปลอดภัย)',
  chat_lami_brain: 'ประวัติแชท LAMI Brain',
  ai_officer_chats: 'ประวัติแชท AI Officer',
}

export default async function DataRetentionPage(container) {
  const myGen = container.__routerGen
  const canManage = isProgramOwner()
  let policies = []
  let loading = true
  // เก็บผลตรวจสอบล่าสุดต่อ policy — ต้องตรวจใหม่ทุกครั้งก่อนลบจริง (กันลบจากตัวเลขเก่าที่ไม่ตรงกับปัจจุบัน)
  const previewCounts = {}

  async function loadData() {
    loading = true
    try { policies = (await listDocs('data_retention_policies', [], 'createdAt', 'desc', 50)).filter(p => !p.deleted) } catch { policies = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  async function findOldDocs(colName, days) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    const all = await listAllDocs(colName, [], 'createdAt', 'asc')
    return all.filter(d => d.createdAt && toDate(d.createdAt) < cutoff)
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗑 Data Retention Policy</div>
            <div class="page-subtitle">กำหนดอายุการเก็บข้อมูล log/ประวัติเก่า — ตรวจสอบก่อนลบทุกครั้ง ไม่มีการลบอัตโนมัติ</div>
          </div>
          <div class="page-actions">
            ${canManage ? '<button class="btn btn-primary" id="add-policy-btn">+ เพิ่มนโยบาย</button>' : ''}
          </div>
        </div>

        ${!canManage ? `<div class="card" style="padding:12px 14px;margin-bottom:14px;border-left:3px solid var(--warning);font-size:0.8rem">⚠️ เฉพาะ Owner/Admin เท่านั้นที่ตรวจสอบ/ลบข้อมูลได้จริงในหน้านี้</div>` : ''}

        <div style="display:flex;flex-direction:column;gap:12px">
          ${policies.length ? policies.map(p => {
            const label = RETAINABLE_COLLECTIONS[p.collection] || p.collection
            const preview = previewCounts[p.id]
            return `<div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(label)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">ลบรายการที่เก่ากว่า ${p.days} วัน</div>
                </div>
                ${canManage ? `<button class="btn btn-xs btn-ghost del-policy-btn" data-id="${p.id}" style="color:var(--danger)">✕ ลบนโยบาย</button>` : ''}
              </div>
              ${preview !== undefined ? `<div style="font-size:0.8rem;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:8px">${preview.length ? `🔍 พบ <strong>${preview.length.toLocaleString()}</strong> รายการที่เก่ากว่า ${p.days} วัน (เก่าสุด: ${preview[0] ? formatDate(toDate(preview[0].createdAt).toISOString()) : '-'})` : '✅ ไม่มีรายการที่เก่ากว่ากำหนด'}</div>` : ''}
              ${canManage ? `<div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-secondary check-btn" data-id="${p.id}">🔍 ตรวจสอบตอนนี้</button>
                <button class="btn btn-sm btn-danger run-btn" data-id="${p.id}" ${!preview || !preview.length ? 'disabled' : ''}>🗑 ลบตามผลตรวจสอบล่าสุด</button>
              </div>` : ''}
            </div>`
          }).join('') : `<div class="empty-state"><div class="empty-icon">🗑</div><div class="empty-title">ยังไม่มีนโยบาย</div><div class="empty-desc">กด "+ เพิ่มนโยบาย" เพื่อกำหนดว่าจะเก็บข้อมูลประเภทไหนไว้กี่วัน</div></div>`}
        </div>
      </div>
    `

    document.getElementById('add-policy-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่มนโยบาย Data Retention',
        size: 'sm',
        body: `<div style="display:flex;flex-direction:column;gap:10px">
          <div class="input-group"><label class="input-label">ประเภทข้อมูล *</label>
            <select class="input" id="rp-col">${Object.entries(RETAINABLE_COLLECTIONS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เก็บไว้ (วัน) *</label><input type="number" class="input" id="rp-days" min="1" value="90"></div>
        </div>`,
        async onConfirm() {
          const col = document.getElementById('rp-col')?.value
          const days = parseInt(document.getElementById('rp-days')?.value)
          if (!col || !days || days < 1) { showToast('❗ กรอกจำนวนวันให้ถูกต้อง', 'error'); return false }
          try {
            await createDoc('data_retention_policies', { collection: col, days })
            showToast('✅ เพิ่มนโยบายแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error') }
        }
      })
    })

    container.querySelectorAll('.del-policy-btn').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบนโยบาย', message: 'ต้องการลบนโยบายนี้หรือไม่ (ไม่กระทบข้อมูลที่มีอยู่)?', confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('data_retention_policies', b.dataset.id)
        showToast('ลบนโยบายแล้ว', 'warning')
        await loadData()
      } catch (e) { showToast('ไม่สำเร็จ: ' + e.message, 'error') }
    }))

    container.querySelectorAll('.check-btn').forEach(b => b.addEventListener('click', async () => {
      const p = policies.find(x => x.id === b.dataset.id)
      if (!p) return
      b.disabled = true; b.textContent = '⏳ กำลังตรวจสอบ...'
      try {
        previewCounts[p.id] = await findOldDocs(p.collection, p.days)
      } catch (e) {
        showToast('ตรวจสอบไม่สำเร็จ: ' + e.message, 'error')
      }
      renderPage()
    }))

    container.querySelectorAll('.run-btn').forEach(b => b.addEventListener('click', async () => {
      const p = policies.find(x => x.id === b.dataset.id)
      const preview = previewCounts[p?.id]
      if (!p || !preview || !preview.length) return
      const label = RETAINABLE_COLLECTIONS[p.collection] || p.collection
      const ok = await confirmDialog({
        title: '⚠️ ยืนยันลบข้อมูลถาวร',
        message: `ต้องการลบ "${label}" ที่เก่ากว่า ${p.days} วัน จำนวน ${preview.length.toLocaleString()} รายการหรือไม่? การลบนี้ถาวร กู้คืนไม่ได้`,
        confirmText: `🗑 ลบ ${preview.length.toLocaleString()} รายการถาวร`,
        danger: true,
      })
      if (!ok) return
      // ตรวจซ้ำทันทีก่อนลบจริง กันกรณีมีรายการใหม่เพิ่มเข้ามาระหว่างที่ผู้ใช้กำลังอ่าน dialog ยืนยัน
      let toDelete
      try { toDelete = await findOldDocs(p.collection, p.days) } catch (e) { showToast('ตรวจสอบไม่สำเร็จ: ' + e.message, 'error'); return }
      let ok_ = 0, failed = 0
      for (const d of toDelete) {
        try { await hardDeleteDoc(p.collection, d.id); ok_++ } catch { failed++ }
      }
      showToast(failed ? `🗑 ลบสำเร็จ ${ok_} รายการ — พลาด ${failed} รายการ` : `🗑 ลบสำเร็จทั้งหมด ${ok_} รายการ`, failed ? 'error' : 'success')
      delete previewCounts[p.id]
      renderPage()
    }))
  }

  await loadData()
}
