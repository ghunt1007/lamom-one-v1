/**
 * Maintenance Schedule — ตารางบำรุงรักษาเช็คระยะ (ตามยี่ห้อ/รุ่น/ระยะทาง-เวลา)
 * Route: /service/maintenance-schedule
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const BRANDS = ['DEEPAL', 'AION', 'OMODA & JAECOO', 'SUZUKI', 'NISSAN']
const BRAND_ICONS = { DEEPAL: '🔵', AION: '🟢', 'OMODA & JAECOO': '🟡', SUZUKI: '🔴', NISSAN: '🟣' }

export default async function MaintenanceSchedulePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let schedules = []
  let brandFilter = 'all'
  let search = ''
  let loading = true

  async function loadData() {
    loading = true
    try { schedules = await listDocs('maintenance_schedules', [], 'intervalKm', 'asc', 300) } catch (e) { schedules = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getFiltered() {
    let list = schedules
    if (brandFilter !== 'all') list = list.filter(s => s.brand === brandFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => `${s.brand} ${s.model}`.toLowerCase().includes(q) || (s.items || []).some(it => it.toLowerCase().includes(q)))
    }
    return list
  }

  function groupByModel(list) {
    const groups = {}
    list.forEach(s => {
      const key = s.brand + '||' + s.model
      if (!groups[key]) groups[key] = { brand: s.brand, model: s.model, entries: [] }
      groups[key].entries.push(s)
    })
    Object.values(groups).forEach(g => g.entries.sort((a, b) => (a.intervalKm || 0) - (b.intervalKm || 0)))
    return Object.values(groups).sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model))
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const filtered = getFiltered()
    const groups = groupByModel(filtered)
    const modelCount = new Set(schedules.map(s => s.brand + '||' + s.model)).size
    const avgItems = schedules.length ? Math.round(schedules.reduce((a, s) => a + (s.items || []).length, 0) / schedules.length * 10) / 10 : 0
    const totalEstCost = schedules.reduce((a, s) => a + (s.estCost || 0), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗓️ ตารางบำรุงรักษาเช็คระยะ</div>
            <div class="page-subtitle">รายการเช็ค/เปลี่ยนตามระยะทาง-เวลา แยกตามยี่ห้อ/รุ่น — ใช้อ้างอิงตอนเปิด Job Card</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="ms-export">📥 Export</button>
            <button class="btn btn-primary" id="ms-add-btn">➕ เพิ่มระยะเช็ค</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('📋 ระยะเช็คทั้งหมด', schedules.length, 'primary')}
          ${kpi('🚗 รุ่นที่มีตาราง', modelCount, 'accent')}
          ${kpi('🔧 รายการเฉลี่ย/ระยะ', avgItems, 'warning')}
          ${kpi('💰 มูลค่ารวมเต็มตาราง', formatCurrency(totalEstCost), 'success')}
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
          <input class="input" id="ms-search" placeholder="🔍 ค้นหารุ่นรถ/รายการ..." value="${escHtml(search)}" style="width:220px">
          <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap">
            <button class="btn btn-sm ${brandFilter==='all'?'btn-primary':'btn-secondary'} bf-btn" data-b="all">ทั้งหมด</button>
            ${BRANDS.map(b => `<button class="btn btn-sm ${brandFilter===b?'btn-primary':'btn-secondary'} bf-btn" data-b="${escHtml(b)}">${BRAND_ICONS[b]||'🏷️'} ${escHtml(b)}</button>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px">
          ${groups.map(g => renderGroup(g)).join('')}
          ${!groups.length ? `<div class="empty-state"><div class="empty-icon">🗓️</div><div class="empty-title">ยังไม่มีตารางบำรุงรักษา</div><div class="empty-desc">กด "➕ เพิ่มระยะเช็ค" เพื่อเริ่มสร้างตารางสำหรับรุ่นรถ</div></div>` : ''}
        </div>
      </div>
    `

    document.getElementById('ms-search')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    document.querySelectorAll('.bf-btn').forEach(b => b.addEventListener('click', () => { brandFilter = b.dataset.b; renderPage() }))
    document.getElementById('ms-add-btn')?.addEventListener('click', () => openEntryForm())
    document.getElementById('ms-export')?.addEventListener('click', () => exportToExcel(filtered.map(s => ({ ยี่ห้อ:s.brand, รุ่น:s.model, ระยะ:intervalLabel(s), รายการ:(s.items||[]).join(', '), 'ค่าแรง(ชม.)':s.estLaborHours||0, 'ค่าใช้จ่ายประมาณ':s.estCost||0, หมายเหตุ:s.notes||'' })), 'MaintenanceSchedule'))
    document.querySelectorAll('.ms-edit').forEach(btn => btn.addEventListener('click', () => {
      const s = schedules.find(x => x.id === btn.dataset.id); if (s) openEntryForm(s)
    }))
    document.querySelectorAll('.ms-del').forEach(btn => btn.addEventListener('click', async () => {
      const s = schedules.find(x => x.id === btn.dataset.id)
      if (!s) return
      const ok = await confirmDialog({ title: '🗑️ ลบระยะเช็ค', message: `ยืนยันลบ "${escHtml(s.brand)} ${escHtml(s.model)} — ${escHtml(intervalLabel(s))}"?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      await softDelete('maintenance_schedules', s.id)
      showToast('🗑️ ลบแล้ว', 'success')
      await loadData()
    }))
  }

  function intervalLabel(s) {
    const parts = []
    if (s.intervalKm) parts.push(s.intervalKm.toLocaleString() + ' km')
    if (s.intervalMonths) parts.push(s.intervalMonths + ' เดือน')
    return parts.length ? parts.join(' / ') : '—'
  }

  function renderGroup(g) {
    return `<div class="card" style="padding:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:1.1rem">${BRAND_ICONS[g.brand]||'🏷️'}</span>
        <span style="font-weight:700;font-size:0.95rem">${escHtml(g.brand)} ${escHtml(g.model)}</span>
        <span class="badge badge-secondary" style="font-size:0.65rem">${g.entries.length} ระยะ</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>ระยะ</th><th>รายการเช็ค/เปลี่ยน</th><th>ค่าแรง (ชม.)</th><th>ค่าใช้จ่ายประมาณ</th><th></th></tr></thead>
        <tbody>
          ${g.entries.map(s => `<tr>
            <td style="white-space:nowrap"><span class="badge badge-primary" style="font-size:0.72rem">${escHtml(intervalLabel(s))}</span></td>
            <td style="font-size:0.82rem">${(s.items||[]).map(it => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;background:var(--surface-2);border-radius:8px;font-size:0.74rem">${escHtml(it)}</span>`).join('')}</td>
            <td style="font-size:0.8rem">${s.estLaborHours || 0} ชม.</td>
            <td style="font-size:0.82rem;font-weight:600">${formatCurrency(s.estCost || 0)}</td>
            <td style="white-space:nowrap">
              <button class="btn btn-ghost btn-xs ms-edit" data-id="${s.id}" title="แก้ไข">✏️</button>
              <button class="btn btn-ghost btn-xs ms-del" data-id="${s.id}" title="ลบ">🗑️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`
  }

  function openEntryForm(existing = null) {
    const isEdit = !!existing
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขระยะเช็ค' : '➕ เพิ่มระยะเช็คใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ยี่ห้อ *</label>
            <select class="input" id="ms-brand">${BRANDS.map(b => `<option ${existing?.brand===b?'selected':''}>${escHtml(b)}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">รุ่น *</label><input class="input" id="ms-model" value="${escHtml(existing?.model||'')}" placeholder="เช่น S07, Y Plus"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ระยะทาง (กม.)</label><input class="input" type="number" id="ms-km" value="${existing?.intervalKm||''}" placeholder="10000"></div>
          <div class="input-group"><label class="input-label">หรือ ระยะเวลา (เดือน)</label><input class="input" type="number" id="ms-months" value="${existing?.intervalMonths||''}" placeholder="6"></div>
        </div>
        <div class="input-group"><label class="input-label">รายการเช็ค/เปลี่ยน (คั่นด้วยจุลภาค) *</label><textarea class="input" id="ms-items" rows="3" placeholder="น้ำมันเครื่อง, ไส้กรองอากาศ, ตรวจเบรก">${escHtml((existing?.items||[]).join(', '))}</textarea></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ค่าแรงประมาณ (ชม.)</label><input class="input" type="number" step="0.5" id="ms-labor" value="${existing?.estLaborHours||''}" placeholder="1"></div>
          <div class="input-group"><label class="input-label">ค่าใช้จ่ายประมาณ (฿)</label><input class="input" type="number" id="ms-cost" value="${existing?.estCost||''}" placeholder="1500"></div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="ms-notes" value="${escHtml(existing?.notes||'')}" placeholder="หมายเหตุ (ถ้ามี)"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ms-c">ยกเลิก</button><button class="btn btn-primary" id="ms-s">💾 บันทึก</button>`
    })
    el.querySelector('#ms-c').addEventListener('click', close)
    el.querySelector('#ms-s').addEventListener('click', async () => {
      const brand = el.querySelector('#ms-brand').value
      const model = el.querySelector('#ms-model').value.trim()
      const itemsRaw = el.querySelector('#ms-items').value.trim()
      const intervalKm = +el.querySelector('#ms-km').value || 0
      const intervalMonths = +el.querySelector('#ms-months').value || 0
      if (!model) return showToast('❗ กรุณาระบุรุ่นรถ', 'warning')
      if (!itemsRaw) return showToast('❗ กรุณาระบุรายการเช็ค/เปลี่ยนอย่างน้อย 1 รายการ', 'warning')
      if (!intervalKm && !intervalMonths) return showToast('❗ กรุณาระบุระยะทางหรือระยะเวลาอย่างน้อย 1 อย่าง', 'warning')
      const items = itemsRaw.split(',').map(s => s.trim()).filter(Boolean)
      const data = {
        brand, model, intervalKm, intervalMonths, items,
        estLaborHours: +el.querySelector('#ms-labor').value || 0,
        estCost: +el.querySelector('#ms-cost').value || 0,
        notes: el.querySelector('#ms-notes').value.trim(),
      }
      if (isEdit) await updateDocData('maintenance_schedules', existing.id, data)
      else await createDoc('maintenance_schedules', data)
      showToast(isEdit ? '✅ แก้ไขแล้ว' : '✅ เพิ่มระยะเช็คแล้ว', 'success'); close(); await loadData()
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
