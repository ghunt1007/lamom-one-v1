// Import/Export Engine — Excel (ExcelJS) / CSV
// ExcelJS loaded dynamically — ไม่เพิ่ม bundle หน้าแรก

async function getXlsx() {
  const mod = await import('exceljs')
  return mod.default || mod
}

// ── EXPORT ──────────────────────────────────────────────────

export async function exportToCSV(data, filename = 'export.csv') {
  if (!data?.length) return
  const headers = Object.keys(data[0])
  const rows    = [headers, ...data.map(row => headers.map(h => escapeCSV(row[h])))]
  const csv     = rows.map(r => r.join(',')).join('\n')
  const bom     = '﻿'
  downloadBlob(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }), filename)
}

export async function exportToExcel(data, filename = 'export.xlsx', sheetName = 'Data') {
  if (!data?.length) return
  const ExcelJS = await getXlsx()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'LAMOM ONE'
  const ws = wb.addWorksheet(sheetName)

  const headers = Object.keys(data[0])
  ws.columns = headers.map(h => ({
    header: h, key: h,
    width: Math.min(40, Math.max(h.length + 2, ...data.slice(0, 50).map(r => String(r[h] ?? '').length)) + 2),
  }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
  data.forEach(row => ws.addRow(row))

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

export async function exportMultiSheet(sheets, filename = 'export.xlsx') {
  const ExcelJS = await getXlsx()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'LAMOM ONE'

  for (const { name, data } of sheets) {
    const ws = wb.addWorksheet(name)
    if (!data?.length) continue
    const headers = Object.keys(data[0])
    ws.columns = headers.map(h => ({
      header: h, key: h,
      width: Math.min(40, Math.max(h.length + 2, ...data.slice(0, 50).map(r => String(r[h] ?? '').length)) + 2),
    }))
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    data.forEach(row => ws.addRow(row))
  }

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

// ── IMPORT ──────────────────────────────────────────────────

export function importFromCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text  = e.target.result.replace(/\r\n?/g, '\n')
        const table = parseCSV(text)
        if (table.length < 2) { reject(new Error('ไฟล์ว่างหรือไม่มีข้อมูล')); return }
        const headers = table[0]
        const rows    = table.slice(1).map(vals => {
          const obj = {}
          headers.forEach((h, i) => { obj[h.trim()] = vals[i]?.trim() || '' })
          return obj
        }).filter(r => Object.values(r).some(v => v))
        resolve({ headers, rows, total: rows.length })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsText(file, 'UTF-8')
  })
}

export async function importFromExcel(file) {
  const ExcelJS = await getXlsx()
  const wb      = new ExcelJS.Workbook()
  const buf     = await file.arrayBuffer()
  try { await wb.xlsx.load(buf) } catch { throw new Error('อ่านไฟล์ Excel ไม่ได้ กรุณาตรวจสอบรูปแบบ') }

  const ws      = wb.worksheets[0]
  if (!ws)      throw new Error('ไม่พบ Sheet ในไฟล์')

  let headers   = []
  const rows    = []

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const vals = row.values.slice(1).map(v => {
      if (v == null) return ''
      if (typeof v === 'object' && v.text) return String(v.text)
      return String(v)
    })
    if (rowNum === 1) { headers = vals; return }
    if (!vals.some(v => v.trim())) return
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    rows.push(obj)
  })

  return { headers, rows, total: rows.length, sheetName: ws.name }
}

export async function importFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'csv')              return importFromCSV(file)
  if (['xlsx', 'xls'].includes(ext)) return importFromExcel(file)
  throw new Error('รองรับเฉพาะ .csv, .xlsx, .xls')
}

// ── TEMPLATE DOWNLOAD ────────────────────────────────────────

export async function downloadTemplate(columns, filename = 'template.xlsx') {
  const ExcelJS = await getXlsx()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'LAMOM ONE'
  const ws = wb.addWorksheet('Template')
  ws.columns = columns.map(c => ({ header: c, key: c, width: Math.max(c.length + 4, 14) }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

// ── IMPORT MODAL UI ──────────────────────────────────────────

export function openImportModal({ title = 'นำเข้าข้อมูล', columns, onImport }) {
  const existing = document.getElementById('import-modal-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'import-modal-overlay'
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal modal-lg" style="max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <span class="modal-title">📥 ${escHtml(title)}</span>
        <button class="modal-close" id="import-close">✕</button>
      </div>
      <div class="modal-body" style="flex:1;overflow-y:auto">
        <div id="drop-zone" style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:40px;text-align:center;cursor:pointer;transition:all 200ms;background:var(--surface-2);margin-bottom:20px">
          <div style="font-size:2.5rem;margin-bottom:8px">📂</div>
          <div style="font-weight:600;margin-bottom:4px">ลากไฟล์มาวางที่นี่</div>
          <div style="color:var(--text-muted);font-size:0.85rem">หรือคลิกเพื่อเลือกไฟล์ (.xlsx, .xls, .csv)</div>
          <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-size:0.85rem;color:var(--text-muted)">ยังไม่มีไฟล์? ดาวน์โหลด Template ก่อน</span>
          <button class="btn btn-ghost btn-sm" id="dl-template-btn">📄 ดาวน์โหลด Template</button>
        </div>
        <div id="import-preview" style="display:none">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span id="preview-count" style="font-size:0.875rem;color:var(--success);font-weight:600"></span>
            <div style="display:flex;gap:8px">
              <span id="import-errors" style="font-size:0.75rem;color:var(--danger)"></span>
              <button class="btn btn-ghost btn-sm" id="clear-import">✕ ล้าง</button>
            </div>
          </div>
          <div style="overflow-x:auto;max-height:280px;border-radius:var(--radius-md);border:1px solid var(--border)">
            <table class="table" id="preview-table">
              <thead id="preview-head"></thead>
              <tbody id="preview-body"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="import-cancel">ยกเลิก</button>
        <button class="btn btn-primary" id="import-confirm" disabled>✅ นำเข้าข้อมูล</button>
      </div>
    </div>`

  document.body.appendChild(overlay)
  let parsedData = null
  const close = () => overlay.remove()

  overlay.querySelector('#import-close').addEventListener('click', close)
  overlay.querySelector('#import-cancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelector('#dl-template-btn').addEventListener('click', () => {
    if (columns) downloadTemplate(columns, title.replace(/\s/g, '-') + '-template.xlsx')
  })

  const fileInput = overlay.querySelector('#import-file-input')
  const dropZone  = overlay.querySelector('#drop-zone')

  dropZone.addEventListener('click', () => fileInput.click())
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; dropZone.style.background = 'var(--primary-dim)' })
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; dropZone.style.background = 'var(--surface-2)' })
  dropZone.addEventListener('drop', e => {
    e.preventDefault()
    dropZone.style.borderColor = 'var(--border)'
    dropZone.style.background  = 'var(--surface-2)'
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  })
  fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]) })

  overlay.querySelector('#clear-import').addEventListener('click', () => {
    parsedData = null
    fileInput.value = ''
    overlay.querySelector('#import-preview').style.display = 'none'
    overlay.querySelector('#import-confirm').disabled = true
    dropZone.style.display = 'block'
  })

  overlay.querySelector('#import-confirm').addEventListener('click', async () => {
    if (!parsedData) return
    const btn = overlay.querySelector('#import-confirm')
    btn.disabled = true; btn.textContent = '⏳ กำลังนำเข้า...'
    try { await onImport(parsedData); close() }
    catch (err) {
      btn.disabled = false; btn.textContent = '✅ นำเข้าข้อมูล'
      overlay.querySelector('#import-errors').textContent = 'เกิดข้อผิดพลาด: ' + err.message
    }
  })

  async function processFile(file) {
    dropZone.style.display = 'none'
    const preview = overlay.querySelector('#import-preview')
    preview.style.display = 'block'
    overlay.querySelector('#preview-count').textContent = '⏳ กำลังอ่านไฟล์...'
    try {
      const result = await importFile(file)
      parsedData   = result.rows
      overlay.querySelector('#preview-count').textContent = `✅ พบ ${result.total} รายการ จากไฟล์ "${escHtml(file.name)}"`
      const ph = result.headers.slice(0, 8)
      overlay.querySelector('#preview-head').innerHTML = `<tr>${ph.map(h => `<th>${escHtml(h)}</th>`).join('')}${result.headers.length > 8 ? '<th>...</th>' : ''}</tr>`
      overlay.querySelector('#preview-body').innerHTML  = result.rows.slice(0, 10).map(row =>
        `<tr>${ph.map(h => `<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(String(row[h] ?? ''))}</td>`).join('')}${result.headers.length > 8 ? '<td>...</td>' : ''}</tr>`
      ).join('')
      overlay.querySelector('#import-confirm').disabled = false
    } catch (err) {
      overlay.querySelector('#preview-count').textContent = ''
      overlay.querySelector('#import-errors').textContent = '❌ ' + escHtml(err.message)
      dropZone.style.display  = 'block'
      preview.style.display   = 'none'
    }
  }
}

// ── HELPERS ──────────────────────────────────────────────────

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeCSV(val) {
  if (val == null) return ''
  let s = String(val)
  // ป้องกัน CSV/Formula Injection (CWE-1236) — ค่าที่ขึ้นต้นด้วย =, +, -, @ หรือ tab/CR
  // จะถูก Excel/Sheets ตีความเป็นสูตรทันทีที่เปิดไฟล์ (เช่น =HYPERLINK ขโมยข้อมูล)
  // เติม ' นำหน้าตามคำแนะนำ OWASP เพื่อบังคับให้อ่านเป็น text ธรรมดา
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

// parseCSV — อ่านทั้งไฟล์เป็น state machine เดียว (ไม่ใช้ split('\n') ก่อน)
// เพื่อรองรับฟิลด์ที่มีขึ้นบรรทัดใหม่จริงอยู่ภายในเครื่องหมายคำพูด (มาตรฐาน CSV RFC 4180)
// เช่น ที่อยู่/หมายเหตุหลายบรรทัดที่ export มาจาก Excel — เดิม split บรรทัดก่อน parse
// ทำให้ฟิลด์แบบนี้ขาดกลางคันกลายเป็น 2 แถวที่ผิดทั้งคู่
function parseCSV(text) {
  const rows = []
  let row = [], cur = '', inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      row.push(cur); cur = ''
    } else if (ch === '\n' && !inQuote) {
      row.push(cur); cur = ''
      rows.push(row); row = []
    } else {
      cur += ch
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim()))
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
