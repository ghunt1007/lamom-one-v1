/**
 * Plate & Registration Tracking — ติดตามป้ายแดง/จดทะเบียน
 * Route: /dms/plates
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const REG_STATUS = {
  red_plate:  { label: 'ใช้ป้ายแดง', color: 'danger', icon: '🟥' },
  submitted:  { label: 'ยื่นขนส่งแล้ว', color: 'warning', icon: '📋' },
  approved:   { label: 'ได้เลขทะเบียน', color: 'primary', icon: '🔢' },
  plated:     { label: 'ติดป้ายขาวแล้ว', color: 'success', icon: '✅' },
}

const RED_PLATE_POOL = [
  { plate: 'ก-0041', inUse: true }, { plate: 'ก-0042', inUse: true }, { plate: 'ก-0043', inUse: false },
  { plate: 'ก-0044', inUse: true }, { plate: 'ก-0045', inUse: true }, { plate: 'ก-0046', inUse: false },
]

const NEXT = { red_plate: 'submitted', submitted: 'approved', approved: 'plated' }

export default async function PlateTrackingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let regs = []
  let loading = true

  async function loadData() {
    loading = true
    try { regs = await listDocs('plate_tracking', [], 'deliveredDate', 'desc', 200) } catch (e) { regs = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const pending = regs.filter(r => r.status !== 'plated')
    const overdue = regs.filter(r => r.status === 'red_plate' && r.deliveredDate <= addDays(-45))
    const freePlates = RED_PLATE_POOL.filter(p => !regs.some(r => r.redPlate === p.plate && r.status !== 'plated')).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚙 Plate Tracking</div>
            <div class="page-subtitle">ติดตามป้ายแดง → จดทะเบียน → ป้ายขาว</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-reg-btn">+ รถส่งมอบใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔄 กำลังดำเนินการ', pending.length + ' คัน', 'primary')}
          ${kpi('⚠️ ป้ายแดงเกิน 45 วัน', overdue.length, overdue.length > 0 ? 'danger' : 'success')}
          ${kpi('🟥 ป้ายแดงว่าง', freePlates + '/' + RED_PLATE_POOL.length, freePlates === 0 ? 'danger' : 'secondary')}
          ${kpi('✅ เสร็จเดือนนี้', regs.filter(r=>r.status==='plated').length, 'success')}
        </div>

        ${overdue.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⚠️ <strong>ป้ายแดงใช้นานเกินกำหนด:</strong> ${overdue.map(r => `${escHtml(r.customer)} (${Math.abs(Math.round((new Date(r.deliveredDate) - new Date())/86400000))} วัน)`).join(' · ')} — เสี่ยงโดนปรับ
          </div>
        ` : ''}

        <div style="display:flex;flex-direction:column;gap:10px">
          ${regs.map(r => {
            const rs = REG_STATUS[r.status]
            const next = NEXT[r.status]
            const days = Math.abs(Math.round((new Date(r.deliveredDate) - new Date()) / 86400000))
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${rs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${escHtml(r.customer)} — ${escHtml(r.model)} <span style="font-size:0.7rem;color:var(--text-muted)">VIN ${escHtml(r.vin)}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🟥 ป้ายแดง ${escHtml(r.redPlate)} · ส่งมอบ ${formatDate(r.deliveredDate)} (${days} วันแล้ว)</div>
                  ${r.newPlate ? `<div style="font-size:0.78rem;font-weight:700;color:var(--success)">🔢 ทะเบียนใหม่: ${escHtml(r.newPlate)}</div>` : ''}
                  ${r.note ? `<div style="font-size:0.72rem;color:var(--warning);font-style:italic">📌 ${escHtml(r.note)}</div>` : ''}
                </div>
                <span class="badge badge-${rs?.color}" style="font-size:0.63rem">${rs?.icon} ${rs?.label}</span>
              </div>
              ${next ? `
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-${REG_STATUS[next]?.color} next-btn" data-id="${r.id}">${REG_STATUS[next]?.icon} → ${REG_STATUS[next]?.label}</button>
                </div>
              ` : `<div style="font-size:0.72rem;color:var(--success)">✅ คืนป้ายแดง ${escHtml(r.redPlate)} เข้า pool แล้ว</div>`}
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', () => {
      const r = regs.find(x => x.id === b.dataset.id)
      if (!r) return
      const next = NEXT[r.status]
      if (next === 'approved') {
        openModal({
          title: '🔢 บันทึกเลขทะเบียน',
          size: 'sm',
          body: `<div class="input-group"><label class="input-label">เลขทะเบียนใหม่ *</label><input class="input" id="rg-plate" placeholder="9กข 1234"></div>`,
          async onConfirm() {
            const p = document.getElementById('rg-plate')?.value?.trim()
            if (!p) { showToast('❗ กรอกเลขทะเบียน', 'error'); return false }
            try {
              await updateDocData('plate_tracking', r.id, { newPlate: p, status: 'approved', note: 'รอนัดติดป้าย' })
              showToast('🔢 บันทึกเลขทะเบียน + แจ้งลูกค้าแล้ว', 'success')
              await loadData()
            } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
          }
        })
      } else {
        (async () => {
          try {
            await updateDocData('plate_tracking', r.id, { status: next, note: next === 'plated' ? '' : r.note })
            if (next === 'plated') showToast('✅ ติดป้ายขาวแล้ว — คืนป้ายแดงเข้า pool', 'success')
            else showToast(`${REG_STATUS[next]?.icon} ${REG_STATUS[next]?.label}`, 'primary')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        })()
      }
    }))
    document.getElementById('add-reg-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ รถส่งมอบใหม่ (เริ่มติดตามทะเบียน)',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="rg-name"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="rg-model"></div>
          <div class="input-group"><label class="input-label">ป้ายแดง</label>
            <select class="input" id="rg-red">${RED_PLATE_POOL.map(p=>`<option>${p.plate}</option>`).join('')}</select>
          </div>
        </div>`,
        async onConfirm() {
          const name = document.getElementById('rg-name')?.value?.trim()
          if (!name) { showToast('❗ กรอกชื่อ', 'error'); return false }
          try {
            await createDoc('plate_tracking', { customer: name, model: document.getElementById('rg-model')?.value || '—', vin: '...ใหม่', redPlate: document.getElementById('rg-red')?.value || '—', deliveredDate: addDays(0), status: 'red_plate', newPlate: null, note: '' })
            showToast('✅ เริ่มติดตามแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
