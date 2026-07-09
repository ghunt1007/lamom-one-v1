/**
 * Stock Audit — ตรวจนับรถจริง vs ระบบ
 * Route: /dms/stock-audit
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const LOCATIONS = ['โชว์รูม', 'ลานหลัง A', 'ลานหลัง B', 'ศูนย์บริการ', 'อื่นๆ']

const LAST_AUDIT = { date: addDays(-30), result: 'ครบ 100% (ผิดตำแหน่ง 1 คัน)' }

export default async function StockAuditPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let stock = []
  let auditStarted = false
  let loading = true

  async function loadData() {
    loading = true
    try { stock = await listDocs('stock_audit', [], 'model', 'asc', 200) } catch (e) { stock = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const checked = stock.filter(s => s.checked)
    const pct = Math.round(checked.length / stock.length * 100)
    const mismatched = checked.filter(s => s.foundLoc && s.foundLoc !== s.systemLoc)
    const missing = checked.filter(s => s.foundLoc === 'ไม่พบ!')
    const done = checked.length === stock.length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Stock Audit</div>
            <div class="page-subtitle">ตรวจนับรถจริง vs ระบบ — ทำทุกเดือน</div>
          </div>
          <div class="page-actions">
            ${!auditStarted ? `<button class="btn btn-primary" id="start-btn">▶️ เริ่มตรวจนับรอบใหม่</button>` :
              done ? `<button class="btn btn-success" id="finish-btn">✅ ปิดรอบตรวจนับ</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚗 รถในระบบ', stock.length + ' คัน', 'primary')}
          ${kpi('✅ ตรวจแล้ว', checked.length + '/' + stock.length + ' (' + pct + '%)', done ? 'success' : 'warning')}
          ${kpi('📍 ผิดตำแหน่ง', mismatched.length, mismatched.length > 0 ? 'warning' : 'success')}
          ${kpi('🚨 หาไม่เจอ', missing.length, missing.length > 0 ? 'danger' : 'success')}
        </div>

        ${!auditStarted ? `
          <div class="card" style="padding:24px;text-align:center">
            <div style="font-size:2rem;margin-bottom:8px">📋</div>
            <div style="font-weight:700;margin-bottom:4px">รอบล่าสุด: ${formatDate(LAST_AUDIT.date)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">ผล: ${LAST_AUDIT.result}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:10px">💡 เดินตรวจตาม VIN ทีละคัน — ระบุตำแหน่งจริงที่พบ</div>
          </div>
        ` : `
          ${missing.length > 0 ? `
            <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
              🚨 <strong>หาไม่เจอ:</strong> ${missing.map(s => escHtml(s.model) + ' (' + escHtml(s.vin) + ')').join(' · ')} — แจ้งผู้จัดการด่วน + เช็คกล้องวงจรปิด
            </div>
          ` : ''}
          <div style="margin-bottom:12px">
            <div style="background:var(--surface-2);border-radius:4px;height:10px">
              <div style="width:${pct}%;background:var(--${done?'success':'primary'});height:10px;border-radius:4px;transition:width .3s"></div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${stock.map(s => {
              const mismatch = s.checked && s.foundLoc && s.foundLoc !== s.systemLoc && s.foundLoc !== 'ไม่พบ!'
              const notFound = s.foundLoc === 'ไม่พบ!'
              return `<div class="card" style="padding:11px 14px;border-left:3px solid var(--${!s.checked?'border':notFound?'danger':mismatch?'warning':'success'})">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-weight:700;font-size:0.83rem">${escHtml(s.model)}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">VIN ${escHtml(s.vin)} · ระบบ: 📍 ${escHtml(s.systemLoc)}</div>
                    ${s.checked ? `<div style="font-size:0.7rem;color:var(--${notFound?'danger':mismatch?'warning':'success'})">
                      ${notFound ? '🚨 ไม่พบรถ!' : mismatch ? `⚠️ พบที่ "${s.foundLoc}" (ระบบว่า ${escHtml(s.systemLoc)}) — อัปเดตระบบแล้ว` : '✅ พบตรงตำแหน่ง'}
                    </div>` : ''}
                  </div>
                  ${!s.checked ? `
                    <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
                      ${LOCATIONS.map(loc => `<button class="btn btn-xs ${loc===s.systemLoc?'btn-success':'btn-secondary'} found-btn" data-id="${escHtml(s.id)}" data-loc="${loc}">${loc===s.systemLoc?'✓ ':''}${loc}</button>`).join('')}
                      <button class="btn btn-xs btn-danger found-btn" data-id="${escHtml(s.id)}" data-loc="ไม่พบ!">🚨 ไม่พบ</button>
                    </div>
                  ` : `<button class="btn btn-xs btn-secondary recheck-btn" data-id="${escHtml(s.id)}">↺</button>`}
                </div>
              </div>`
            }).join('')}
          </div>
        `}
      </div>
    `

    document.getElementById('start-btn')?.addEventListener('click', () => { auditStarted = true; showToast('▶️ เริ่มตรวจนับ — เดินเช็คทีละคัน', 'primary'); renderPage() })
    document.getElementById('finish-btn')?.addEventListener('click', async () => {
      try {
        await Promise.all(stock.map(s => updateDocData('stock_audit', s.id, {
          systemLoc: (s.foundLoc && s.foundLoc !== 'ไม่พบ!') ? s.foundLoc : s.systemLoc,
          checked: false,
          foundLoc: null,
        })))
        showToast(`✅ ปิดรอบ — ครบ ${stock.length - missing.length}/${stock.length} คัน${mismatched.length > 0 ? ' อัปเดตตำแหน่ง ' + mismatched.length + ' คัน' : ''} — บันทึกรายงาน`, 'success')
        auditStarted = false
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    container.querySelectorAll('.found-btn').forEach(b => b.addEventListener('click', async () => {
      const s = stock.find(x => x.id === b.dataset.id)
      if (!s) return
      try { await updateDocData('stock_audit', s.id, { checked: true, foundLoc: b.dataset.loc }); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.recheck-btn').forEach(b => b.addEventListener('click', async () => {
      const s = stock.find(x => x.id === b.dataset.id)
      if (!s) return
      try { await updateDocData('stock_audit', s.id, { checked: false, foundLoc: null }); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
