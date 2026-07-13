// SmartSheet — Excel-like editable grid with keyboard nav + copy-paste
// Usage: new SmartSheet(container, { columns, rows, onSave, onDelete, readOnly })

import { confirmDialog } from '../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export class SmartSheet {
  constructor(container, options = {}) {
    this.container = container
    this.columns = options.columns || []   // [{ key, label, type, width, required, options }]
    this.rows = (options.rows || []).map((r, i) => ({ ...r, __id: r.__id ?? i }))
    this.onSave = options.onSave || null
    this.onDelete = options.onDelete || null
    this.readOnly = options.readOnly || false
    this.activeCell = null  // { row, col }
    this.editingCell = null
    this.selectedRows = new Set()
    this.dirty = new Set()  // row __id
    this.nextId = this.rows.length
    this.sortState = { ci: null, dir: 0 }   // dir: 1 asc, -1 desc, 0 none
    this.filters = {}                        // ci -> filter string (lowercase)
    this.showFilter = false

    this._render()
    this._bindKeys()
  }

  // คำนวณแถวที่จะแสดง: ใช้ filter + sort (ไม่แตะ this.rows ต้นทาง)
  _computeView() {
    let view = this.rows.slice()
    const activeFilters = Object.entries(this.filters).filter(([, v]) => v)
    if (activeFilters.length) {
      view = view.filter(row => activeFilters.every(([ci, f]) => {
        const col = this.columns[ci]
        if (!col) return true
        return String(this._displayValRaw(col, row[col.key])).toLowerCase().includes(f)
      }))
    }
    if (this.sortState.dir !== 0 && this.sortState.ci != null) {
      const col = this.columns[this.sortState.ci]
      const dir = this.sortState.dir
      view.sort((a, b) => {
        let av = a[col.key], bv = b[col.key]
        if (col.type === 'number') { av = Number(av) || 0; bv = Number(bv) || 0; return (av - bv) * dir }
        av = String(av ?? '').toLowerCase(); bv = String(bv ?? '').toLowerCase()
        return av < bv ? -dir : av > bv ? dir : 0
      })
    }
    return view
  }

  _displayValRaw(col, val) {
    if (col.type === 'select') {
      const opt = (col.options || []).find(o => (typeof o === 'object' ? o.value : o) === val)
      return opt ? (typeof opt === 'object' ? opt.label : opt) : (val ?? '')
    }
    if (col.type === 'boolean') return val ? '✔' : ''
    return val ?? ''
  }

  _renderBody() {
    this.tbody.innerHTML = ''
    const view = this._computeView()
    view.forEach((row, ri) => this._renderRow(row, ri))
    this._updateToolbar()
    const info = this.container.querySelector('#ss-filter-info')
    if (info) info.textContent = view.length !== this.rows.length ? ('กรองเหลือ ' + view.length + '/' + this.rows.length) : ''
  }

  _render() {
    this.container.innerHTML = ''
    this.container.style.cssText = 'position:relative;overflow:auto;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface)'

    const toolbar = document.createElement('div')
    toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);background:var(--surface-2)'
    toolbar.innerHTML = `
      ${!this.readOnly ? `
        <button class="btn btn-primary btn-sm" id="ss-add">➕ แถวใหม่</button>
        <button class="btn btn-danger btn-sm" id="ss-del-sel" style="display:none">🗑 ลบที่เลือก (<span id="ss-sel-count">0</span>)</button>
        <button class="btn btn-secondary btn-sm" id="ss-save" style="display:none">💾 บันทึก</button>
      ` : ''}
      <button class="btn btn-ghost btn-sm" id="ss-filter-toggle" title="กรองข้อมูล (เหมือน Excel)">🔽 กรอง</button>
      <span id="ss-filter-info" style="font-size:0.74rem;color:var(--warning)"></span>
      <span style="font-size:0.78rem;color:var(--text-muted);margin-left:auto">${this.rows.length} แถว · คลิกหัวคอลัมน์เพื่อจัดเรียง · วาง Excel ได้ (Ctrl+V)</span>
    `
    this.container.appendChild(toolbar)

    const wrap = document.createElement('div')
    wrap.style.cssText = 'overflow:auto;max-height:520px'
    this.tableWrap = wrap

    const table = document.createElement('table')
    table.id = 'ss-table'
    table.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;min-width:max-content'
    this.table = table

    // Header
    const thead = document.createElement('thead')
    thead.innerHTML = `<tr>
      <th style="width:40px;position:sticky;top:0;left:0;z-index:3;background:var(--surface-3);border:1px solid var(--border)">
        <input type="checkbox" id="ss-check-all">
      </th>
      <th style="width:36px;position:sticky;top:0;z-index:2;background:var(--surface-3);border:1px solid var(--border);color:var(--text-muted);font-size:0.72rem">#</th>
      ${this.columns.map((col, ci) => {
        const arrow = this.sortState.ci === ci ? (this.sortState.dir === 1 ? ' ▲' : this.sortState.dir === -1 ? ' ▼' : '') : ''
        return `
        <th class="ss-th" data-ci="${ci}" style="width:${col.width || 140}px;position:sticky;top:0;z-index:2;background:var(--surface-3);border:1px solid var(--border);padding:6px 8px;font-size:0.78rem;white-space:nowrap;cursor:pointer;user-select:none" title="คลิกเพื่อจัดเรียง">
          ${col.label}${col.required ? '<span style="color:var(--danger)">*</span>' : ''}<span style="color:var(--primary)">${arrow}</span>
        </th>
      `}).join('')}
    </tr>
    <tr class="ss-filter-row" style="${this.showFilter ? '' : 'display:none'}">
      <th style="position:sticky;top:31px;z-index:2;background:var(--surface-2);border:1px solid var(--border)"></th>
      <th style="position:sticky;top:31px;z-index:2;background:var(--surface-2);border:1px solid var(--border)"></th>
      ${this.columns.map((col, ci) => `
        <th style="position:sticky;top:31px;z-index:2;background:var(--surface-2);border:1px solid var(--border);padding:3px 4px">
          <input class="ss-filter-input" data-ci="${ci}" value="${(this.filters[ci] || '').replace(/"/g,'&quot;')}" placeholder="กรอง..."
            style="width:100%;border:1px solid var(--border);border-radius:4px;font-size:0.72rem;padding:3px 5px;background:var(--surface);color:var(--text)">
        </th>
      `).join('')}
    </tr>`
    table.appendChild(thead)

    this.tbody = document.createElement('tbody')
    table.appendChild(this.tbody)
    wrap.appendChild(table)
    this.container.appendChild(wrap)
    this._renderBody()

    // จัดเรียงเมื่อคลิกหัวคอลัมน์ (asc → desc → ปิด)
    thead.querySelectorAll('.ss-th').forEach(th => th.addEventListener('click', () => {
      const ci = Number(th.dataset.ci)
      if (this.sortState.ci !== ci) this.sortState = { ci, dir: 1 }
      else this.sortState.dir = this.sortState.dir === 1 ? -1 : this.sortState.dir === -1 ? 0 : 1
      this._render(); this._bindKeys()
    }))
    // กรองแบบ Excel
    thead.querySelectorAll('.ss-filter-input').forEach(inp => {
      inp.addEventListener('click', e => e.stopPropagation())
      inp.addEventListener('input', () => { this.filters[inp.dataset.ci] = inp.value.toLowerCase(); this._renderBody() })
    })

    if (!this.readOnly) {
      toolbar.querySelector('#ss-add')?.addEventListener('click', () => this.addRow())
      toolbar.querySelector('#ss-del-sel')?.addEventListener('click', () => this.deleteSelected())
      toolbar.querySelector('#ss-save')?.addEventListener('click', () => this.saveAll())
    }
    toolbar.querySelector('#ss-filter-toggle')?.addEventListener('click', () => {
      this.showFilter = !this.showFilter
      const fr = this.table.querySelector('.ss-filter-row')
      if (fr) fr.style.display = this.showFilter ? '' : 'none'
      if (!this.showFilter) { this.filters = {}; this._renderBody() }
    })
    if (!this.readOnly) {

      thead.querySelector('#ss-check-all')?.addEventListener('change', e => {
        this.rows.forEach(r => e.target.checked ? this.selectedRows.add(r.__id) : this.selectedRows.delete(r.__id))
        this._updateCheckboxes()
        this._updateToolbar()
      })

      // Paste from Excel (bind once — _render may run again on sort)
      if (!this._pasteBound) {
        this.container.addEventListener('paste', e => this._handlePaste(e))
        this._pasteBound = true
      }
      this.container.setAttribute('tabindex', '0')
    }
  }

  _renderRow(row, ri) {
    const tr = document.createElement('tr')
    tr.dataset.id = row.__id
    tr.style.cssText = 'border-bottom:1px solid var(--border)'

    const isDirty = this.dirty.has(row.__id)
    if (isDirty) tr.style.background = 'var(--warning-dim)'

    // Checkbox
    const tdCheck = document.createElement('td')
    tdCheck.style.cssText = 'width:40px;text-align:center;border:1px solid var(--border);position:sticky;left:0;background:var(--surface)'
    tdCheck.innerHTML = `<input type="checkbox" class="ss-row-check" data-id="${row.__id}" ${this.selectedRows.has(row.__id) ? 'checked' : ''}>`
    tdCheck.querySelector('input').addEventListener('change', e => {
      e.target.checked ? this.selectedRows.add(row.__id) : this.selectedRows.delete(row.__id)
      this._updateToolbar()
    })
    tr.appendChild(tdCheck)

    // Row number
    const tdNum = document.createElement('td')
    tdNum.style.cssText = 'width:36px;text-align:center;color:var(--text-muted);font-size:0.72rem;border:1px solid var(--border);user-select:none'
    tdNum.textContent = ri + 1
    tr.appendChild(tdNum)

    // Data cells
    this.columns.forEach((col, ci) => {
      const td = document.createElement('td')
      td.dataset.row = row.__id
      td.dataset.col = ci
      td.style.cssText = `width:${col.width||140}px;border:1px solid var(--border);padding:0;cursor:${this.readOnly?'default':'cell'};position:relative`

      const val = row[col.key] ?? ''
      td.innerHTML = `<div class="ss-cell-view" style="padding:5px 8px;font-size:0.825rem;min-height:30px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-2)">${this._displayVal(col, val)}</div>`

      if (!this.readOnly) {
        td.addEventListener('click', () => this._activateCell(row.__id, ci, td))
        td.addEventListener('dblclick', () => this._startEdit(row.__id, ci, td))
      }
      tr.appendChild(td)
    })

    const existing = this.tbody.querySelector(`tr[data-id="${row.__id}"]`)
    if (existing) existing.replaceWith(tr)
    else this.tbody.appendChild(tr)
  }

  _displayVal(col, val) {
    if (val === '' || val == null) return '<span style="color:var(--text-muted);font-style:italic">-</span>'
    if (col.type === 'select') {
      const opt = (col.options || []).find(o => (typeof o === 'object' ? o.value : o) === val)
      const label = opt ? (typeof opt === 'object' ? opt.label : opt) : val
      return escHtml(label)
    }
    if (col.type === 'boolean') return val ? '✅' : '☐'
    return escHtml(String(val))
  }

  _activateCell(rowId, ci, td) {
    // Clear previous active
    this.table.querySelectorAll('.ss-active').forEach(el => el.classList.remove('ss-active'))
    td.classList.add('ss-active')
    td.style.outline = '2px solid var(--primary)'
    td.style.outlineOffset = '-2px'
    this.activeCell = { rowId, ci }
    this.container.focus()
  }

  _startEdit(rowId, ci, td) {
    if (this.editingCell) this._commitEdit()
    const col = this.columns[ci]
    const row = this.rows.find(r => r.__id === rowId)
    const val = row?.[col.key] ?? ''

    td.innerHTML = ''
    let input

    if (col.type === 'select') {
      input = document.createElement('select')
      input.className = 'input'
      input.style.cssText = 'width:100%;height:30px;border:none;font-size:0.825rem;padding:2px 6px;background:var(--surface);color:var(--text)'
      ;(col.options || []).forEach(o => {
        const v = typeof o === 'object' ? o.value : o
        const l = typeof o === 'object' ? o.label : o
        const opt = document.createElement('option')
        opt.value = v; opt.textContent = l; if (v === val) opt.selected = true
        input.appendChild(opt)
      })
    } else if (col.type === 'boolean') {
      input = document.createElement('input')
      input.type = 'checkbox'; input.checked = !!val
      input.style.cssText = 'margin:8px;width:16px;height:16px'
    } else {
      input = document.createElement('input')
      input.type = col.type === 'number' ? 'number' : 'text'
      input.value = val
      input.style.cssText = 'width:100%;height:30px;border:none;font-size:0.825rem;padding:0 8px;background:var(--surface);color:var(--text);outline:none'
    }

    td.appendChild(input)
    input.focus()
    if (input.select) input.select()
    this.editingCell = { rowId, ci, td, input, col }

    const commit = () => this._commitEdit()
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._commitEdit(); this._moveActive(1, 0) }
      if (e.key === 'Escape') { this._cancelEdit(); }
      if (e.key === 'Tab') { e.preventDefault(); this._commitEdit(); this._moveActive(0, e.shiftKey ? -1 : 1) }
    })
  }

  _commitEdit() {
    if (!this.editingCell) return
    const { rowId, ci, td, input, col } = this.editingCell
    const row = this.rows.find(r => r.__id === rowId)
    if (!row) { this.editingCell = null; return }

    let newVal
    if (col.type === 'boolean') newVal = input.checked
    else if (col.type === 'number') newVal = input.value === '' ? '' : Number(input.value)
    else newVal = input.value

    if (row[col.key] !== newVal) {
      row[col.key] = newVal
      this.dirty.add(rowId)
      const saveBtn = this.container.querySelector('#ss-save')
      if (saveBtn) saveBtn.style.display = ''
    }

    const ri = this.rows.findIndex(r => r.__id === rowId)
    this._renderRow(row, ri)
    this.editingCell = null
  }

  _cancelEdit() {
    if (!this.editingCell) return
    const { rowId, ci } = this.editingCell
    const row = this.rows.find(r => r.__id === rowId)
    const ri = this.rows.findIndex(r => r.__id === rowId)
    this.editingCell = null
    if (row) this._renderRow(row, ri)
  }

  _moveActive(dr, dc) {
    if (!this.activeCell) return
    const { rowId, ci } = this.activeCell
    const ri = this.rows.findIndex(r => r.__id === rowId)
    const newRi = Math.max(0, Math.min(this.rows.length - 1, ri + dr))
    const newCi = Math.max(0, Math.min(this.columns.length - 1, ci + dc))
    const newRow = this.rows[newRi]
    if (!newRow) return
    const td = this.table.querySelector(`td[data-row="${newRow.__id}"][data-col="${newCi}"]`)
    if (td) this._activateCell(newRow.__id, newCi, td)
  }

  _bindKeys() {
    if (this._keysBound) return
    this._keysBound = true
    this.container.addEventListener('keydown', e => {
      if (this.editingCell) return
      if (!this.activeCell) return
      const { rowId, ci } = this.activeCell
      if (e.key === 'ArrowDown')  { e.preventDefault(); this._moveActive(1, 0) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); this._moveActive(-1, 0) }
      if (e.key === 'ArrowRight') { e.preventDefault(); this._moveActive(0, 1) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); this._moveActive(0, -1) }
      if (e.key === 'Enter' || e.key === 'F2') {
        const td = this.table.querySelector(`td[data-row="${rowId}"][data-col="${ci}"]`)
        if (td) this._startEdit(rowId, ci, td)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.key === 'Delete') {
          const row = this.rows.find(r => r.__id === rowId)
          const col = this.columns[ci]
          if (row && col) { row[col.key] = ''; this.dirty.add(rowId); const ri = this.rows.findIndex(r => r.__id === rowId); this._renderRow(row, ri) }
        }
      }
    })
  }

  _handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return

    const pasteRows = text.split('\n').filter(r => r.trim()).map(r => r.split('\t'))
    if (!pasteRows.length) return

    const startRow = this.activeCell
      ? this.rows.findIndex(r => r.__id === this.activeCell.rowId)
      : this.rows.length
    const startCol = this.activeCell?.ci ?? 0

    pasteRows.forEach((pRow, ri) => {
      let row = this.rows[startRow + ri]
      if (!row) { row = { __id: this.nextId++ }; this.rows.push(row) }
      pRow.forEach((val, ci) => {
        const col = this.columns[startCol + ci]
        if (col) row[col.key] = val.trim()
      })
      this.dirty.add(row.__id)
    })

    // Re-render all rows
    this._renderBody()

    const saveBtn = this.container.querySelector('#ss-save')
    if (saveBtn) saveBtn.style.display = ''

    // show via DOM toast directly
    const t = document.createElement('div')
    t.textContent = `📋 วาง ${pasteRows.length} แถวจาก Excel แล้ว`
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--success);color:#fff;padding:8px 20px;border-radius:var(--radius-full);font-size:0.875rem;z-index:9999;animation:slideUp 200ms ease'
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  addRow() {
    const row = { __id: this.nextId++ }
    this.columns.forEach(col => { row[col.key] = col.default ?? '' })
    this.rows.push(row)
    this.dirty.add(row.__id)
    this._renderRow(row, this.rows.length - 1)
    this._updateToolbar()
    // activate first cell of new row
    const td = this.table.querySelector(`td[data-row="${row.__id}"][data-col="0"]`)
    if (td) { this._activateCell(row.__id, 0, td); this._startEdit(row.__id, 0, td) }
    const saveBtn = this.container.querySelector('#ss-save')
    if (saveBtn) saveBtn.style.display = ''
  }

  async deleteSelected() {
    if (!this.selectedRows.size) return
    const ok = await confirmDialog({ title: '🗑 ลบแถวที่เลือก', message: `ต้องการลบ ${this.selectedRows.size} แถวที่เลือกหรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบ', danger: true })
    if (!ok) return
    if (this.onDelete) {
      const toDelete = [...this.selectedRows].map(id => this.rows.find(r => r.__id === id)).filter(Boolean)
      await Promise.all(toDelete.map(row => this.onDelete(row)))
    }
    this.rows = this.rows.filter(r => !this.selectedRows.has(r.__id))
    this.selectedRows.clear()
    this.dirty.clear()
    this._renderBody()
  }

  async saveAll() {
    if (!this.dirty.size || !this.onSave) return
    const dirtyRows = this.rows.filter(r => this.dirty.has(r.__id))
    await Promise.all(dirtyRows.map(row => this.onSave(row)))
    this.dirty.clear()
    this._renderBody()
    const saveBtn = this.container.querySelector('#ss-save')
    if (saveBtn) saveBtn.style.display = 'none'
  }

  _updateCheckboxes() {
    this.table.querySelectorAll('.ss-row-check').forEach(cb => {
      cb.checked = this.selectedRows.has(Number(cb.dataset.id))
    })
  }

  _updateToolbar() {
    const delBtn = this.container.querySelector('#ss-del-sel')
    const countEl = this.container.querySelector('#ss-sel-count')
    if (delBtn) {
      delBtn.style.display = this.selectedRows.size ? '' : 'none'
      if (countEl) countEl.textContent = this.selectedRows.size
    }
    const countSpan = this.container.querySelector('span[style*="margin-left:auto"]')
    if (countSpan) countSpan.textContent = `${this.rows.length} แถว · วางจาก Excel ได้ (Ctrl+V)`
  }

  // Update data externally
  setRows(rows) {
    this.rows = rows.map((r, i) => ({ ...r, __id: r.__id ?? i }))
    this.nextId = this.rows.length
    this.dirty.clear()
    this.selectedRows.clear()
    this._renderBody()
  }
}
