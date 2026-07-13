/**
 * Error Log — ตรวจจับ error ฝั่ง client อัตโนมัติ (window.onerror / unhandledrejection)
 * Route: /settings/errors
 */
import { timeAgo } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'
import { listDocs, softDelete } from '../../core/db.js'
import { confirmDialog } from '../../utils/modal.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function ErrorLogPage(container) {
  let search = ''
  let logs = []

  try {
    logs = await listDocs('error_log', [], 'createdAt', 'desc', 500)
  } catch (e) {
    logs = []
  }

  function filtered() {
    if (!search) return logs
    const q = search.toLowerCase()
    return logs.filter(l => (l.message || '').toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q) || (l.userName || '').toLowerCase().includes(q))
  }

  function renderPage() {
    const list = filtered()
    const today = logs.filter(l => (l.createdAt || '').startsWith(addDays(0))).length
    const affectedUsers = new Set(logs.map(l => l.userName)).size

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🐞 Error Log</div>
            <div class="page-subtitle">Error ที่เกิดขึ้นจริงฝั่งผู้ใช้ — จับอัตโนมัติ ไม่ต้องรอลูกค้าแจ้ง</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            ${logs.length ? `<button class="btn btn-danger" id="clear-btn">🗑 ล้างทั้งหมด</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🐞 ทั้งหมด', logs.length, logs.length ? 'danger' : 'secondary')}
          ${kpi('📅 วันนี้', today, today ? 'warning' : 'secondary')}
          ${kpi('👥 ผู้ใช้ที่เจอ', affectedUsers, 'secondary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input class="input" id="search-inp" placeholder="🔍 ค้นหาข้อความ error / หน้า / ผู้ใช้..." style="max-width:320px" value="${search}">
        </div>

        ${!list.length ? `
          <div class="card" style="padding:48px;text-align:center;color:var(--text-muted)">
            <div style="font-size:2rem;margin-bottom:8px">✅</div>
            ${logs.length ? 'ไม่พบ error ที่ตรงกับคำค้นหา' : 'ยังไม่พบ error ในระบบ — ระบบกำลังเฝ้าดูอัตโนมัติ'}
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${list.map(l => `
              <div class="card" style="padding:12px 16px">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:0.85rem;color:var(--danger);word-break:break-word">${esc(l.message || '(ไม่มีข้อความ)')}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
                      📍 ${esc(l.url || '-')} ${l.line ? `· บรรทัด ${l.line}${l.col ? ':' + l.col : ''}` : ''}
                    </div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">
                      👤 ${esc(l.userName || 'unknown')} · ${l.createdAt ? timeAgo(l.createdAt) : '-'}
                    </div>
                    ${l.stack ? `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:0.72rem;color:var(--text-muted)">Stack trace</summary><pre style="font-size:0.68rem;white-space:pre-wrap;color:var(--text-muted);margin-top:4px;max-height:160px;overflow:auto">${esc(l.stack)}</pre></details>` : ''}
                  </div>
                  <button class="btn btn-secondary btn-sm del-err-btn" data-id="${l.id}" title="ลบรายการนี้">🗑</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;text-align:right">แสดง ${list.length} จาก ${logs.length} รายการ</div>
      </div>
    `

    document.getElementById('search-inp')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(list.map(l => ({ เวลา: l.createdAt || '-', ผู้ใช้: l.userName || '-', ข้อความ: l.message || '-', หน้า: l.url || '-', บรรทัด: l.line || '-' })), 'error_log')
      showToast('📥 Export Error Log แล้ว!', 'success')
    })
    document.getElementById('clear-btn')?.addEventListener('click', async () => {
      if (!await confirmDialog({ title: 'ล้าง Error Log ทั้งหมด', message: `ลบรายการ error ทั้งหมด ${logs.length} รายการ? การกระทำนี้ย้อนกลับไม่ได้`, confirmText: 'ลบทั้งหมด', danger: true })) return
      try {
        await Promise.all(logs.map(l => softDelete('error_log', l.id)))
        showToast('ล้าง Error Log แล้ว', 'success')
        logs = []
        renderPage()
      } catch (e) { showToast('ล้างไม่สำเร็จ', 'error') }
    })
    container.querySelectorAll('.del-err-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!await confirmDialog({ title: 'ลบรายการ Error', message: 'ลบรายการนี้?', confirmText: 'ลบ', danger: true })) return
        try {
          await softDelete('error_log', btn.dataset.id)
          logs = logs.filter(l => l.id !== btn.dataset.id)
          showToast('ลบแล้ว', 'success')
          renderPage()
        } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
