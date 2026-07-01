/**
 * Finance Rate Sheets — ตารางดอกเบี้ยไฟแนนซ์
 * อัปโหลดรูปตารางดอกเบี้ย/โปรโมชั่นไฟแนนซ์ → AI วิเคราะห์ดึงข้อมูล → ผู้ใช้ตรวจสอบ/แก้ไข/ยืนยันก่อนบันทึก
 * Route: /finance/rate-sheets
 */
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { analyzeFinanceRateSheet } from '../../utils/ai.js'
import { uploadFile } from '../../utils/storage.js'
import { getFinanceCompanies, getCampaigns } from '../../data/masterData.js'
import { getBrands } from '../../data/vehicleDatabase.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const STATUS_MAP = { confirmed: { label: 'ยืนยันแล้ว', cls: 'success' }, pending: { label: 'รอตรวจสอบ', cls: 'warning' } }
function statusBadge(status) {
  const m = STATUS_MAP[status] || STATUS_MAP.pending
  return `<span class="badge badge-${m.cls}">${m.label}</span>`
}

function blankRow() {
  return { bank: '', campaign: '', brand: '', model: '', year: new Date().getFullYear(), month: MONTHS_TH[new Date().getMonth()], dateFrom: '', dateTo: '', conditions: '', financeCommission: 0, extraPayment: 0, subsidy: 0 }
}

export default async function FinanceRateSheetsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let sheets = []
  let bankFilter = ''
  let brandFilter = ''
  let statusFilter = ''
  let search = ''

  async function loadData() {
    try { sheets = await listDocs('finance_rate_sheets', [], 'createdAt', 'desc', 500) } catch { sheets = [] }
    if (container.__routerGen === myGen) render()
  }

  function getFiltered() {
    return sheets.filter(s => {
      if (bankFilter && s.bank !== bankFilter) return false
      if (brandFilter && s.brand !== brandFilter) return false
      if (statusFilter && s.status !== statusFilter) return false
      if (search) {
        const hay = [s.bank, s.campaign, s.brand, s.model, s.conditions].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
  }

  function render() {
    const filtered = getFiltered()
    const pendingCount = sheets.filter(s => s.status === 'pending').length
    const today = new Date().toISOString().slice(0, 10)
    const activeCount = sheets.filter(s => s.status === 'confirmed' && (!s.dateTo || s.dateTo >= today)).length
    const banks = [...new Set(sheets.map(s => s.bank).filter(Boolean))].sort()
    const brands = [...new Set(sheets.map(s => s.brand).filter(Boolean))].sort()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📈 ตารางดอกเบี้ยไฟแนนซ์</div>
            <div class="page-subtitle">แสดง ${filtered.length} / ${sheets.length} รายการ${pendingCount ? ` · <span style="color:var(--warning);font-weight:600">⚠️ ${pendingCount} รายการรอตรวจสอบ</span>` : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="add-manual-btn">+ เพิ่มด้วยตนเอง</button>
            <button class="btn btn-primary" id="upload-btn">📷 อัปโหลดตาราง (AI วิเคราะห์)</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${kpi('📋 ทั้งหมด', sheets.length + ' รายการ', 'primary')}
          ${kpi('✅ ใช้งานอยู่', activeCount + ' รายการ', 'success')}
          ${kpi('⚠️ รอตรวจสอบ', pendingCount + ' รายการ', pendingCount ? 'warning' : 'secondary')}
          ${kpi('🏦 ธนาคาร', banks.length + ' แห่ง', 'accent')}
        </div>

        <div class="card mb-4" style="padding:10px 14px">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <select class="input" id="f-bank" style="width:auto;font-size:0.76rem">
              <option value="">ทุกธนาคาร</option>
              ${banks.map(b => `<option value="${escHtml(b)}" ${b === bankFilter ? 'selected' : ''}>${escHtml(b)}</option>`).join('')}
            </select>
            <select class="input" id="f-brand" style="width:auto;font-size:0.76rem">
              <option value="">ทุกแบรนด์</option>
              ${brands.map(b => `<option value="${escHtml(b)}" ${b === brandFilter ? 'selected' : ''}>${escHtml(b)}</option>`).join('')}
            </select>
            <select class="input" id="f-status" style="width:auto;font-size:0.76rem">
              <option value="">ทุกสถานะ</option>
              <option value="confirmed" ${statusFilter === 'confirmed' ? 'selected' : ''}>ยืนยันแล้ว</option>
              <option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>รอตรวจสอบ</option>
            </select>
            <div style="position:relative;flex:1;min-width:180px">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.78rem">🔍</span>
              <input class="input" id="f-search" placeholder="ค้นหาธนาคาร/แคมเปญ/รุ่น..." value="${escHtml(search)}" style="padding-left:30px;font-size:0.78rem">
            </div>
            <button class="btn btn-secondary btn-xs" id="export-btn">📥 Export</button>
          </div>
        </div>

        <div id="rs-content"></div>
      </div>`

    renderTable(filtered)

    document.getElementById('upload-btn').addEventListener('click', () => openUploadFlow())
    document.getElementById('add-manual-btn').addEventListener('click', () => openManualForm())
    document.getElementById('export-btn').addEventListener('click', () => exportRows(filtered))
    document.getElementById('f-bank').addEventListener('change', e => { bankFilter = e.target.value; render() })
    document.getElementById('f-brand').addEventListener('change', e => { brandFilter = e.target.value; render() })
    document.getElementById('f-status').addEventListener('change', e => { statusFilter = e.target.value; render() })
    document.getElementById('f-search').addEventListener('input', e => { search = e.target.value.trim().toLowerCase(); render() })
  }

  function kpi(label, value, color) {
    return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
  }

  function exportRows(rows) {
    exportToExcel(rows.map(s => ({
      ธนาคาร: s.bank, แคมเปญ: s.campaign, แบรนด์: s.brand, รุ่น: s.model, ปี: s.year, เดือน: s.month,
      วันที่เริ่ม: formatDate(s.dateFrom), วันที่สิ้นสุด: formatDate(s.dateTo), เงื่อนไข: s.conditions,
      คอมไฟแนนซ์: s.financeCommission, Extra: s.extraPayment, Subsidy: s.subsidy, สถานะ: STATUS_MAP[s.status]?.label || s.status,
    })), 'finance-rate-sheets-' + new Date().toISOString().slice(0, 10) + '.xlsx', 'ดอกเบี้ยไฟแนนซ์')
    showToast('📥 Export แล้ว', 'success')
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  function renderTable(filtered) {
    const wrap = document.getElementById('rs-content')
    if (!wrap) return
    if (!filtered.length) { wrap.innerHTML = '<div class="empty-state" style="padding:48px"><div class="empty-icon">📈</div><div class="empty-title">ไม่มีตารางดอกเบี้ย</div><div class="empty-desc">กด "📷 อัปโหลดตาราง" เพื่อให้ AI อ่านจากรูปภาพ หรือ "+ เพิ่มด้วยตนเอง"</div></div>'; return }
    wrap.innerHTML = `<div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap"><table>
        <thead><tr>
          <th>ธนาคาร</th><th>แคมเปญ</th><th>แบรนด์ / รุ่น</th><th>ปี / เดือน</th>
          <th>ช่วงวันที่</th><th>เงื่อนไข</th><th>คอมไฟแนนซ์</th><th>Extra</th><th>Subsidy</th><th>สถานะ</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(s => tableRow(s)).join('')}</tbody>
      </table></div>
    </div>`

    wrap.querySelectorAll('.rs-row').forEach(row => row.addEventListener('click', e => {
      if (e.target.closest('.rs-edit') || e.target.closest('.rs-del') || e.target.closest('.rs-confirm')) return
      openDetail(sheets.find(s => s.id === row.dataset.id))
    }))
    wrap.querySelectorAll('.rs-edit').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openManualForm(sheets.find(s => s.id === btn.dataset.id)) }))
    wrap.querySelectorAll('.rs-confirm').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const s = sheets.find(x => x.id === btn.dataset.id)
      try { await updateDocData('finance_rate_sheets', s.id, { status: 'confirmed' }); s.status = 'confirmed'; showToast('✅ ยืนยันแล้ว', 'success'); render() }
      catch { showToast('อัปเดตไม่สำเร็จ', 'error') }
    }))
    wrap.querySelectorAll('.rs-del').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const ok = await confirmDialog({ title: 'ลบรายการ', message: 'ต้องการลบตารางดอกเบี้ยรายการนี้?', danger: true })
      if (!ok) return
      try { await softDelete('finance_rate_sheets', btn.dataset.id); sheets = sheets.filter(s => s.id !== btn.dataset.id); showToast('🗑 ลบแล้ว', 'success'); render() }
      catch { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  function tableRow(s) {
    return `<tr class="rs-row" data-id="${s.id}" style="cursor:pointer">
      <td><span class="badge badge-primary" style="font-size:0.7rem">${escHtml(s.bank || '-')}</span></td>
      <td style="font-size:0.8rem;font-weight:600">${escHtml(s.campaign || '-')}</td>
      <td style="font-size:0.8rem">${escHtml(s.brand || '-')}<div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(s.model || '')}</div></td>
      <td style="font-size:0.76rem;white-space:nowrap">${s.year || '-'} / ${escHtml(s.month || '-')}</td>
      <td style="font-size:0.74rem;white-space:nowrap">${s.dateFrom ? formatDate(s.dateFrom) : '-'} — ${s.dateTo ? formatDate(s.dateTo) : '-'}</td>
      <td style="font-size:0.72rem;color:var(--text-muted);max-width:220px;white-space:normal">${escHtml(s.conditions || '-')}</td>
      <td style="font-size:0.78rem;text-align:right">${formatCurrency(s.financeCommission)}</td>
      <td style="font-size:0.78rem;text-align:right">${formatCurrency(s.extraPayment)}</td>
      <td style="font-size:0.78rem;text-align:right">${formatCurrency(s.subsidy)}</td>
      <td>${statusBadge(s.status)}</td>
      <td style="white-space:nowrap">
        ${s.status === 'pending' ? `<button class="btn btn-xs btn-success rs-confirm" data-id="${s.id}" title="ยืนยัน">✔</button>` : ''}
        <button class="btn btn-ghost btn-xs rs-edit" data-id="${s.id}" title="แก้ไข">✏️</button>
        <button class="btn btn-ghost btn-xs rs-del" data-id="${s.id}" title="ลบ">🗑</button>
      </td>
    </tr>`
  }

  function openDetail(s) {
    if (!s) return
    const dRow = (label, value) => `<div style="display:flex;gap:6px;padding:3px 0;font-size:0.82rem"><span style="color:var(--text-muted);min-width:120px;flex-shrink:0">${label}</span><span>${escHtml(String(value ?? '-'))}</span></div>`
    openModal({
      title: `📈 ${escHtml(s.bank)} — ${escHtml(s.campaign)}`, size: 'md',
      body: `<div>
        <div style="margin-bottom:10px">${statusBadge(s.status)}</div>
        ${s.imageUrl ? `<img src="${escHtml(s.imageUrl)}" style="max-width:100%;border-radius:8px;margin-bottom:12px;border:1px solid var(--border)">` : ''}
        ${dRow('ธนาคาร/ไฟแนนซ์', s.bank)}
        ${dRow('แคมเปญ', s.campaign)}
        ${dRow('แบรนด์ / รุ่น', (s.brand || '-') + ' ' + (s.model || ''))}
        ${dRow('ปี / เดือน', (s.year || '-') + ' / ' + (s.month || '-'))}
        ${dRow('ช่วงวันที่มีผล', (s.dateFrom ? formatDate(s.dateFrom) : '-') + ' ถึง ' + (s.dateTo ? formatDate(s.dateTo) : '-'))}
        ${dRow('เงื่อนไขแคมเปญ', s.conditions)}
        ${dRow('ค่าคอมไฟแนนซ์', formatCurrency(s.financeCommission))}
        ${dRow('การจ่าย Extra', formatCurrency(s.extraPayment))}
        ${dRow('Subsidy', formatCurrency(s.subsidy))}
      </div>`,
      footer: '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">ปิด</button>',
    })
  }

  // ── ฟอร์มเพิ่ม/แก้ไขด้วยตนเอง ──────────────────────────────────────────────
  function openManualForm(existing = null) {
    const isEdit = !!existing
    const e = existing || blankRow()
    const inp = (id, label, val, type) => `<div class="input-group"><label class="input-label">${label}</label><input class="input" id="${id}" ${type ? `type="${type}"` : ''} value="${escHtml(val == null ? '' : val)}"></div>`
    const datalist = (id, label, list, val) => `<div class="input-group"><label class="input-label">${label}</label><input class="input" id="${id}" list="${id}-l" value="${escHtml(val || '')}"><datalist id="${id}-l">${list.map(o => `<option value="${escHtml(o)}">`).join('')}</datalist></div>`
    const monthOpts = MONTHS_TH.map(m => `<option ${m === e.month ? 'selected' : ''}>${m}</option>`).join('')

    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขตารางดอกเบี้ย' : '➕ เพิ่มตารางดอกเบี้ย', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:8px;max-height:66vh;overflow:auto;padding-right:4px">
        <div class="grid-2">${datalist('rf-bank', 'ธนาคาร/ไฟแนนซ์ *', getFinanceCompanies(), e.bank)}${datalist('rf-campaign', 'แคมเปญ', getCampaigns(), e.campaign)}</div>
        <div class="grid-2">${datalist('rf-brand', 'ยี่ห้อรถ', getBrands(), e.brand)}${inp('rf-model', 'รุ่นรถ', e.model)}</div>
        <div class="grid-2">${inp('rf-year', 'ปี', e.year, 'number')}<div class="input-group"><label class="input-label">เดือน</label><select class="input" id="rf-month">${monthOpts}</select></div></div>
        <div class="grid-2">${inp('rf-from', 'วันที่เริ่ม', e.dateFrom, 'date')}${inp('rf-to', 'วันที่สิ้นสุด', e.dateTo, 'date')}</div>
        <div class="input-group"><label class="input-label">เงื่อนไขแคมเปญ</label><textarea class="input" id="rf-conditions" rows="2">${escHtml(e.conditions)}</textarea></div>
        <div class="grid-2">${inp('rf-comm', 'คอมไฟแนนซ์ (บาท)', e.financeCommission, 'number')}${inp('rf-extra', 'การจ่าย Extra (บาท)', e.extraPayment, 'number')}</div>
        ${inp('rf-subsidy', 'Subsidy (บาท)', e.subsidy, 'number')}
        <span class="input-error" id="rf-bank-e"></span>
      </div>`,
      footer: '<button class="btn btn-secondary" id="rfc">ยกเลิก</button><button class="btn btn-primary" id="rfs">💾 บันทึก</button>',
    })

    el.querySelector('#rfc').addEventListener('click', close)
    el.querySelector('#rfs').addEventListener('click', async () => {
      const g = id => el.querySelector('#' + id)
      const bank = g('rf-bank').value.trim()
      if (!bank) { g('rf-bank-e').textContent = '⚠️ กรุณาระบุธนาคาร/ไฟแนนซ์'; return }
      const num = id => Number(g(id).value) || 0
      const data = {
        bank, campaign: g('rf-campaign').value.trim(), brand: g('rf-brand').value.trim(), model: g('rf-model').value.trim(),
        year: num('rf-year'), month: g('rf-month').value, dateFrom: g('rf-from').value, dateTo: g('rf-to').value,
        conditions: g('rf-conditions').value.trim(), financeCommission: num('rf-comm'), extraPayment: num('rf-extra'), subsidy: num('rf-subsidy'),
        status: 'confirmed',
      }
      const btn = g('rfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        if (isEdit) { await updateDocData('finance_rate_sheets', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('finance_rate_sheets', { ...data, imageUrl: '', createdAt: new Date().toISOString() }); sheets.unshift({ ...data, id, imageUrl: '', createdAt: new Date().toISOString() }) }
        showToast(isEdit ? '✏️ แก้ไขแล้ว' : '✅ เพิ่มแล้ว', 'success')
        close(); render()
      } catch { btn.disabled = false; btn.textContent = '💾 บันทึก'; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  // ── อัปโหลดรูปตารางดอกเบี้ย → AI วิเคราะห์ ──────────────────────────────────
  function openUploadFlow() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result
        const base64 = dataUrl.split(',')[1]
        const mimeType = file.type || 'image/jpeg'
        const { el, close } = openModal({
          title: '🤖 กำลังวิเคราะห์ตารางดอกเบี้ย...', size: 'sm',
          body: `<div style="text-align:center;padding:10px">
            <img src="${dataUrl}" style="max-width:100%;max-height:220px;border-radius:8px;margin-bottom:14px;border:1px solid var(--border)">
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;color:var(--text-muted);font-size:0.85rem"><span class="spinner spinner-sm"></span> กำลังวิเคราะห์ด้วย AI...</div>
          </div>`,
        })
        try {
          const result = await analyzeFinanceRateSheet(base64, mimeType)
          close()
          if (!result.rows.length) { showToast('⚠️ ไม่พบข้อมูลตารางดอกเบี้ยในภาพนี้ ลองภาพอื่นหรือกรอกด้วยตนเอง', 'warning'); return }
          if (result.demo) showToast('🤖 Demo mode — ตั้งค่า VITE_GEMINI_API_KEY เพื่อวิเคราะห์ภาพจริง', 'info')
          openReviewModal(result.rows, file, dataUrl)
        } catch (err) {
          close()
          showToast('วิเคราะห์ไม่สำเร็จ: ' + err.message, 'error')
        }
      }
      reader.readAsDataURL(file)
    })
    input.click()
  }

  // ── ตรวจสอบ/แก้ไข/ยืนยัน รายการที่ AI ดึงมาได้ ─────────────────────────────
  function openReviewModal(rows, file, previewDataUrl) {
    const items = rows.map(r => ({ ...blankRow(), ...r, _include: true }))

    function rowHtml(r, i) {
      const inp = (field, label, type) => `<div class="input-group"><label class="input-label" style="font-size:0.68rem">${label}</label><input class="input" data-i="${i}" data-f="${field}" ${type ? `type="${type}"` : ''} value="${escHtml(r[field] == null ? '' : r[field])}" style="font-size:0.78rem;padding:6px 8px"></div>`
      return `<div class="card rs-review-item" data-i="${i}" style="padding:10px;margin-bottom:8px;${r._include ? '' : 'opacity:.45'}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <input type="checkbox" class="rs-inc" data-i="${i}" ${r._include ? 'checked' : ''}>
          <span style="font-weight:700;font-size:0.8rem">รายการที่ ${i + 1}</span>
        </div>
        <div class="grid-2">${inp('bank', 'ธนาคาร/ไฟแนนซ์')}${inp('campaign', 'แคมเปญ')}</div>
        <div class="grid-2">${inp('brand', 'ยี่ห้อรถ')}${inp('model', 'รุ่นรถ')}</div>
        <div class="grid-2">${inp('year', 'ปี', 'number')}${inp('month', 'เดือน')}</div>
        <div class="grid-2">${inp('dateFrom', 'วันที่เริ่ม', 'date')}${inp('dateTo', 'วันที่สิ้นสุด', 'date')}</div>
        <div class="input-group"><label class="input-label" style="font-size:0.68rem">เงื่อนไขแคมเปญ</label><textarea class="input" data-i="${i}" data-f="conditions" rows="2" style="font-size:0.78rem">${escHtml(r.conditions)}</textarea></div>
        <div class="grid-2">${inp('financeCommission', 'คอมไฟแนนซ์ (บาท)', 'number')}${inp('extraPayment', 'Extra (บาท)', 'number')}</div>
        ${inp('subsidy', 'Subsidy (บาท)', 'number')}
      </div>`
    }

    const { el, close } = openModal({
      title: `🔎 ตรวจสอบข้อมูลที่ AI วิเคราะห์ได้ (${items.length} รายการ)`, size: 'lg',
      body: `<div style="max-height:60vh;overflow:auto;padding-right:4px">
        <div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:10px">💡 ตรวจสอบและแก้ไขข้อมูลให้ถูกต้องก่อนบันทึก — ยกเลิกติ๊กถูกเพื่อข้ามรายการที่ไม่ต้องการ</div>
        <div id="rs-review-list">${items.map((r, i) => rowHtml(r, i)).join('')}</div>
      </div>`,
      footer: '<button class="btn btn-secondary" id="rrc">ยกเลิก</button><button class="btn btn-primary" id="rrs">💾 บันทึกที่ยืนยันแล้ว</button>',
    })

    el.querySelectorAll('.rs-inc').forEach(cb => cb.addEventListener('change', () => {
      const i = +cb.dataset.i
      items[i]._include = cb.checked
      el.querySelector(`.rs-review-item[data-i="${i}"]`).style.opacity = cb.checked ? '1' : '.45'
    }))
    el.querySelectorAll('#rs-review-list input[data-f], #rs-review-list textarea[data-f]').forEach(inp => inp.addEventListener('input', () => {
      const i = +inp.dataset.i, f = inp.dataset.f
      items[i][f] = (f === 'year' || f === 'financeCommission' || f === 'extraPayment' || f === 'subsidy') ? Number(inp.value) || 0 : inp.value
    }))

    el.querySelector('#rrc').addEventListener('click', close)
    el.querySelector('#rrs').addEventListener('click', async () => {
      const toSave = items.filter(r => r._include)
      if (!toSave.length) { showToast('กรุณาเลือกอย่างน้อย 1 รายการ', 'warning'); return }
      const btn = el.querySelector('#rrs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังบันทึก...'
      try {
        let imageUrl = ''
        try { const up = await uploadFile(file, 'finance-rate-sheets'); imageUrl = up.url } catch { /* เก็บ record ไว้ได้แม้ upload ไม่สำเร็จ */ }
        for (const r of toSave) {
          const { _include, ...data } = r
          const record = { ...data, imageUrl, status: 'pending', createdAt: new Date().toISOString() }
          const id = await createDoc('finance_rate_sheets', record)
          sheets.unshift({ ...record, id })
        }
        close()
        showToast(`✅ บันทึก ${toSave.length} รายการแล้ว (รอตรวจสอบ)`, 'success')
        render()
      } catch (err) {
        btn.disabled = false; btn.innerHTML = '💾 บันทึกที่ยืนยันแล้ว'
        showToast('บันทึกไม่สำเร็จ: ' + err.message, 'error')
      }
    })
  }

  container.innerHTML = '<div class="page-content animate-slide">' + [...Array(3)].map(() => '<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>').join('') + '</div>'
  if (container.__routerGen === myGen) await loadData()
}
