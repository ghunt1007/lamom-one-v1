// (v1.0.954) ตารางใบจอง "แบบ Google Sheet"
//
// เจ้าของบอกว่าคีย์ใน Sheet ง่ายกว่าโปรแกรม: Sheet เห็นครบ 65 คอลัมน์ในหน้าเดียว กดช่องไหนก็พิมพ์ได้เลย
// แต่ในโปรแกรมตารางโชว์แค่ 13 คอลัมน์ และแก้ช่องเดียวต้องเปิดฟอร์มยาว 50 ช่อง
//
// ตารางนี้ทำงานเหมือน Sheet:
// - ครบทุกคอลัมน์ เรียงตามไฟล์ DATA Booking (รายการคอลัมน์อยู่ใน utils/sheetColumns.js)
// - แตะช่อง = พิมพ์แก้ได้ทันที · Enter = บันทึกแล้วลงช่องล่าง · Tab = ไปช่องขวา · Esc = ยกเลิก
// - หัวตารางค้างไว้ด้านบน · เลขใบจองกับชื่อลูกค้าค้างไว้ด้านซ้ายเวลาเลื่อนไปขวา · แถวผลรวมด้านล่าง
// - "➕ เพิ่มแถว" = แถวใหม่บนสุด พิมพ์ชื่อลูกค้าแล้วบันทึกเป็นใบจองทันที (ไม่ต้องผ่านฟอร์ม 4 ขั้น)
// - กดหัวคอลัมน์ = เรียงข้อมูล
//
// หน้าเพจ (Bookings.js) เป็นคนบันทึกจริงผ่าน ctx.onSave / onStatus / onCreate — ไฟล์นี้ดูแลแค่หน้าตาและคีย์บอร์ด

import { SHEET_COLUMNS, YN_OPTIONS, colWidth, parseCell, displayCell, columnTotals, sortRows, parseClipboardGrid, planPaste, patchForCell } from '../../utils/sheetColumns.js'
import { escHtml } from '../../utils/escape.js'
import { showToast } from '../../core/store.js'

const ROWNUM_W = 44
let styleAdded = false
let lastScroll = [0, 0]
// (v1.0.957) หน้าเพจวาดใหม่ทั้งหน้าทุกครั้งที่ข้อมูลเปลี่ยน (รวมตอนที่เราเพิ่งบันทึกเอง) — ตาราง 300 แถว × 65 ช่อง
// สร้างใหม่ทีละ ~1 วินาที เก็บตารางที่สร้างแล้วไว้ ถ้าข้อมูลที่โชว์ไม่เปลี่ยนก็หยิบอันเดิมมาใส่ (แทบไม่เสียเวลา)
let cache = { sig: '', el: null }
const FIRST_ROWS = 60, CHUNK_ROWS = 80

function gridSig(ctx) {
  return JSON.stringify([ctx.instance, ctx.canViewNid, ctx.sort, ctx.hideEmpty,
    ctx.draft ? Object.entries(ctx.draft).filter(([k]) => k !== '__focus') : null,
    ctx.rows.map(r => [r.id, ...SHEET_COLUMNS.map(c => r[c.f] ?? '')])])
}
function addStyle() {
  if (styleAdded) return
  styleAdded = true
  const css = document.createElement('style')
  css.textContent = `
  .sg-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
  .sg-hint{font-size:0.7rem;color:var(--text-muted)}
  @media (max-width:599px), (max-height: 500px) and (pointer: coarse) {.sg-hint{display:none}}
  .sg-wrap{overflow:auto;max-height:calc(100vh - 210px);min-height:260px;border:1px solid var(--border);border-radius:10px;background:var(--surface);-webkit-overflow-scrolling:touch}
  .sg-table{border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:0.78rem}
  .sg-table th,.sg-table td{border-right:1px solid var(--border-subtle,var(--border));border-bottom:1px solid var(--border-subtle,var(--border));padding:0 6px;height:32px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--surface);color:var(--text)}
  .sg-table thead th{position:sticky;top:0;z-index:3;background:var(--surface-2);font-weight:700;font-size:0.72rem;cursor:pointer;user-select:none;text-align:left}
  .sg-table thead th.sg-extra{color:var(--primary)}
  .sg-table tfoot td{position:sticky;bottom:0;z-index:3;background:var(--surface-2);font-weight:700}
  .sg-table td.sg-c{cursor:text}
  .sg-table td.sg-c:hover{box-shadow:inset 0 0 0 1px var(--primary)}
  .sg-table td.sg-num{text-align:right;font-variant-numeric:tabular-nums}
  .sg-table td.sg-ro{color:var(--text-muted);cursor:default;background:var(--surface-2)}
  .sg-table td.sg-ed{padding:0;box-shadow:inset 0 0 0 2px var(--primary);overflow:visible}
  .sg-table td.sg-saving{opacity:.55}
  .sg-table td.sg-ok{animation:sgok 1s ease}
  @keyframes sgok{from{background:color-mix(in srgb,var(--success) 30%,transparent)}to{}}
  .sg-ed input,.sg-ed select{width:100%;height:31px;border:0;outline:0;padding:0 6px;font:inherit;font-size:16px;background:var(--surface);color:var(--text)}
  .sg-rn{text-align:center;color:var(--text-muted);font-size:0.68rem;padding:0 2px!important;cursor:pointer}
  .sg-rn:hover{color:var(--primary)}
  .sg-draft td{background:color-mix(in srgb,var(--primary) 7%,var(--surface))}
  .sg-yn-Y{color:var(--success);font-weight:700}
  .sg-yn-N{color:var(--danger);font-weight:700}
  .sg-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
  /* ค้างคอลัมน์ซ้าย: จอเล็กค้างแค่ชื่อลูกค้า จอกว้างค้าง # + เลขใบจอง + ชื่อ */
  .sg-table .sg-fix-name{position:sticky;left:0;z-index:2;font-weight:600}
  .sg-table thead .sg-fix-name{z-index:4}
  .sg-table tfoot .sg-fix-name{z-index:4}
  @media (min-width:600px) and (min-height: 501px), (min-width:600px) and (pointer: fine) {
    .sg-table .sg-fix-rn{position:sticky;left:0;z-index:2}
    .sg-table .sg-fix-no{position:sticky;left:${ROWNUM_W}px;z-index:2}
    .sg-table .sg-fix-name{left:${ROWNUM_W + 110}px}
    .sg-table thead .sg-fix-rn,.sg-table thead .sg-fix-no,.sg-table tfoot .sg-fix-rn,.sg-table tfoot .sg-fix-no{z-index:4}
  }
  .sg-table .sg-fix-name{box-shadow:2px 0 0 var(--border)}
  `
  document.head.appendChild(css)
}

// ctx: { rows, draft, canViewNid, options:{status,colors,sources,sales,finance,campaigns,finStatus}, statusColors,
//        sort:{f,dir}, hideEmpty, onSort(f), onToggleEmpty(), onAddRow(), onSave(b,col,value)→patch,
//        onStatus(b,status), onCreate(draft)→booking, onOpen(b) }
export function renderSheetGrid(wrap, ctx) {
  addStyle()
  const sig = gridSig(ctx)
  if (cache.el && cache.sig === sig && !ctx.focusDraft) {
    wrap.replaceChildren(cache.el)
    const sw0 = cache.el.querySelector('.sg-wrap')
    if (sw0) { sw0.scrollLeft = lastScroll[0]; sw0.scrollTop = lastScroll[1] }
    return
  }
  const root = document.createElement('div')
  cache = { sig, el: root }
  const myCache = cache

  let cols = SHEET_COLUMNS.filter(c => c.t !== 'nid' || ctx.canViewNid)
  const sortCol = ctx.sort?.f ? cols.find(c => c.f === ctx.sort.f) : null
  const rows = sortRows(ctx.rows, sortCol, ctx.sort?.dir || 1)
  const emptyCols = cols.filter(c => !rows.some(r => !isBlank(c, r[c.f])))
  if (ctx.hideEmpty) cols = cols.filter(c => !emptyCols.includes(c) || ['bookingNo', 'custName', 'status'].includes(c.f))
  const all = ctx.draft ? [ctx.draft, ...rows] : rows
  const totals = columnTotals(rows, cols)

  const fixClass = c => c.f === 'bookingNo' ? ' sg-fix-no' : c.f === 'custName' ? ' sg-fix-name' : ''
  const head = `<tr><th class="sg-fix-rn" style="width:${ROWNUM_W}px;text-align:center">#</th>${cols.map(c => {
    const arrow = sortCol === c ? (ctx.sort.dir > 0 ? ' ▲' : ' ▼') : ''
    return `<th class="${c.extra ? 'sg-extra' : ''}${fixClass(c)}" data-f="${c.f}" title="${escHtml(c.h)}${c.ro ? ' (คำนวณอัตโนมัติ)' : ''} · กดเพื่อเรียง">${escHtml(c.h)}${arrow}</th>`
  }).join('')}</tr>`

  const rowHtml = (r, i) => `<tr data-i="${i}"${r.__draft ? ' class="sg-draft"' : ''}>
    <td class="sg-rn sg-fix-rn" title="${r.__draft ? 'แถวใหม่ (กดเพื่อยกเลิก)' : 'เปิดรายละเอียดใบจอง'}">${r.__draft ? '✕' : (i + (ctx.draft ? 0 : 1))}</td>
    ${cols.map((c, j) => cellHtml(r, c, j, ctx)).join('')}</tr>`
  // วาด 60 แถวแรกทันที ที่เหลือทยอยเติมทีละ 80 แถว — หน้าจอขึ้นเร็ว ไม่ค้าง
  const body = all.slice(0, FIRST_ROWS).map(rowHtml).join('')

  const foot = `<tr><td class="sg-fix-rn"></td>${cols.map(c => {
    if (c.f === 'custName' || (c.f === 'bookingNo' && !cols.some(x => x.f === 'custName'))) return `<td class="${fixClass(c).trim()}">รวม ${rows.length} แถว</td>`
    if (c.f in totals) return `<td class="sg-num${fixClass(c)}">${totals[c.f] ? displayCell(c, totals[c.f]) : ''}</td>`
    return `<td class="${fixClass(c).trim()}"></td>`
  }).join('')}</tr>`

  const tableW = ROWNUM_W + cols.reduce((s, c) => s + colWidth(c), 0)
  root.innerHTML = `
    <div class="sg-bar">
      <button class="btn btn-primary btn-sm" id="sg-add">➕ เพิ่มแถว</button>
      <button class="btn btn-ghost btn-sm" id="sg-empty" title="${emptyCols.length} คอลัมน์ไม่มีข้อมูลเลย">${ctx.hideEmpty ? '👁 โชว์ทุกคอลัมน์' : `🙈 ซ่อนคอลัมน์ว่าง (${emptyCols.length})`}</button>
      <span class="sg-hint">แตะช่องเพื่อแก้ · Enter/↓ = ลงล่าง · Tab = ไปขวา · Esc = ยกเลิก · วางหลายช่องจาก Sheet ได้ (Ctrl+V) · กด # เพื่อดูใบจองเต็ม</span>
    </div>
    <div class="sg-wrap"><table class="sg-table" data-no-enhance="1" style="width:${tableW}px">
      <colgroup><col style="width:${ROWNUM_W}px">${cols.map(c => `<col style="width:${colWidth(c)}px">`).join('')}</colgroup>
      <thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>
    </table></div>`

  wrap.replaceChildren(root)
  const sw = root.querySelector('.sg-wrap')
  // หน้าเพจวาดใหม่ทั้งหน้าเมื่อข้อมูลเปลี่ยน — คืนตำแหน่งเลื่อนเดิมให้ ไม่เด้งกลับไปแถวแรก
  sw.scrollLeft = lastScroll[0]; sw.scrollTop = lastScroll[1]
  sw.addEventListener('scroll', () => { lastScroll = [sw.scrollLeft, sw.scrollTop] }, { passive: true })

  root.querySelector('#sg-add').addEventListener('click', () => ctx.onAddRow())
  root.querySelector('#sg-empty').addEventListener('click', () => ctx.onToggleEmpty())
  root.querySelectorAll('thead th[data-f]').forEach(th => th.addEventListener('click', () => ctx.onSort(th.dataset.f)))
  const tbody = root.querySelector('tbody')
  const wantScroll = [...lastScroll]
  sw.scrollLeft = wantScroll[0]; sw.scrollTop = wantScroll[1]
  let drawn = Math.min(FIRST_ROWS, all.length)
  const drawMore = () => {
    if (cache !== myCache || drawn >= all.length) return
    const end = Math.min(drawn + CHUNK_ROWS, all.length)
    tbody.insertAdjacentHTML('beforeend', all.slice(drawn, end).map((r, k) => rowHtml(r, drawn + k)).join(''))
    drawn = end
    if (sw.scrollTop < wantScroll[1]) sw.scrollTop = wantScroll[1]
    if (drawn < all.length) setTimeout(drawMore, 0)
  }
  if (drawn < all.length) setTimeout(drawMore, 0)
  tbody.addEventListener('click', e => {
    const td = e.target.closest('td')
    if (!td || td.classList.contains('sg-ed')) return
    const tr = td.closest('tr'); const r = all[Number(tr.dataset.i)]
    if (td.classList.contains('sg-rn')) { if (r.__draft) ctx.onCancelDraft(); else ctx.onOpen(r); return }
    if (td.classList.contains('sg-c')) startEdit(td)
  })
  // ช่องว่างที่ draft ยังไม่มีชื่อ → เปิดช่องชื่อให้พิมพ์ทันที
  if (ctx.draft && ctx.focusDraft) {
    ctx.focusDraft = false
    const td = tbody.querySelector('tr[data-i="0"] td[data-f="custName"]')
    if (td) { sw.scrollLeft = 0; sw.scrollTop = 0; startEdit(td) }
  }

  function cellAt(i, j) { return tbody.querySelector(`tr[data-i="${i}"] td[data-j="${j}"]`) }
  function nextEditable(i, j, di, dj) {
    for (let k = 0; k < 400; k++) {
      i += di; j += dj
      if (j >= cols.length) { j = 0; i += 1 }
      if (j < 0) { j = cols.length - 1; i -= 1 }
      if (i < 0 || i >= all.length) return null
      const td = cellAt(i, j)
      if (td && td.classList.contains('sg-c')) return td
      if (di && !dj) return null // ลงล่างแล้วเจอช่องอ่านอย่างเดียว ก็หยุด
    }
    return null
  }

  function startEdit(td) {
    const i = Number(td.closest('tr').dataset.i), j = Number(td.dataset.j)
    const r = all[i], c = cols[j]
    if (!r || !c || c.ro) return
    if (r.__draft && c.f !== 'custName' && !r.custName) {
      // แถวใหม่ต้องมีชื่อลูกค้าก่อน — พาไปช่องชื่อ
      const nameTd = tbody.querySelector(`tr[data-i="${i}"] td[data-f="custName"]`)
      if (nameTd && nameTd !== td) { showToast('พิมพ์ชื่อลูกค้าก่อน แล้วค่อยกรอกช่องอื่น', 'info'); startEdit(nameTd); return }
    }
    const cur = r[c.f]
    td.classList.add('sg-ed')
    let editor
    if (c.t === 'status' || c.t === 'yn') {
      const opts = c.t === 'yn' ? YN_OPTIONS : ctx.options.status
      const list = cur && !opts.includes(cur) ? [cur, ...opts] : opts
      td.innerHTML = `<select>${list.map(o => `<option value="${escHtml(o)}"${o === (cur || '') ? ' selected' : ''}>${escHtml(o || '—')}</option>`).join('')}</select>`
      editor = td.querySelector('select')
    } else {
      const type = c.t === 'date' ? 'date' : 'text'
      const val = c.t === 'num' ? (Number(cur) ? String(cur) : '') : (c.t === 'date' ? String(cur || '').slice(0, 10) : (cur ?? ''))
      const dl = c.t === 'list' ? `<datalist id="sg-dl">${(ctx.options[c.opts] || []).map(o => `<option value="${escHtml(o)}">`).join('')}</datalist>` : ''
      td.innerHTML = `<input type="${type}" ${c.t === 'num' ? 'inputmode="decimal"' : ''}${c.f === 'phone' ? ' inputmode="tel"' : ''}${dl ? ' list="sg-dl"' : ''} value="${escHtml(String(val))}">${dl}`
      editor = td.querySelector('input')
    }
    editor.focus()
    if (editor.select && editor.type === 'text') editor.select()
    let done = false
    const finish = async (save, move) => {
      if (done) return
      done = true
      const raw = editor.value
      td.classList.remove('sg-ed')
      td.innerHTML = cellInner(r, c, ctx)
      const target = move ? nextEditable(i, j, move[0], move[1]) : null
      if (!save) { if (target) startEdit(target); return }
      const v = parseCell(c, raw)
      if (v === null) showToast(`"${raw}" ไม่ใช่${c.t === 'date' ? 'วันที่' : 'ตัวเลข'} — ไม่ได้บันทึก`, 'warning')
      else if (!sameVal(c, v, cur)) {
        if (r.__draft) {
          r[c.f] = v
          td.innerHTML = cellInner(r, c, ctx)
          if (c.f === 'custName' && v) {
            td.classList.add('sg-saving')
            try { await ctx.onCreate(r) } catch { td.classList.remove('sg-saving') }
            return // หน้าเพจวาดตารางใหม่หลังสร้างใบจองแล้ว
          }
        } else if (c.t === 'status') {
          ctx.onStatus(r, v)
          return
        } else {
          // บันทึกเบื้องหลัง แล้วไปช่องถัดไปทันที (ไม่ต้องรอเน็ต)
          td.classList.add('sg-saving')
          // ใส่ค่าใหม่ในแถวก่อนเลย แล้วจำว่าตารางที่โชว์ตรงกับค่าใหม่แล้ว — ฐานข้อมูลแจ้งการเปลี่ยนแปลงกลับมา
          // ทันทีที่เริ่มบันทึก (ก่อนบันทึกเสร็จ) หน้าเพจจะได้ใช้ตารางเดิม ไม่ต้องวาดใหม่ทั้งตาราง
          const before = {}
          const optimistic = patchForCell(r, c, v)
          Object.keys(optimistic).forEach(k => { before[k] = r[k] })
          Object.assign(r, optimistic)
          if (cache === myCache) cache.sig = gridSig(ctx)
          Promise.resolve().then(() => ctx.onSave(r, c, v)).then(patch => {
            td.classList.remove('sg-saving')
            if (cache === myCache) cache.sig = gridSig(ctx)
            if (!td.classList.contains('sg-ed')) { td.innerHTML = cellInner(r, c, ctx); flash(td) }
            // ช่องที่คำนวณตาม (มาจิ้นเหลือ, เงินได้รวม) อัปเดตในแถวเดียวกันทันที
            Object.keys(patch || {}).forEach(f => {
              const k = cols.findIndex(x => x.f === f)
              const other = k >= 0 && k !== j ? cellAt(i, k) : null
              if (other && !other.classList.contains('sg-ed')) other.innerHTML = cellInner(r, cols[k], ctx)
            })
          }).catch(err => {
            Object.assign(r, before)
            if (cache === myCache) cache.sig = gridSig(ctx)
            td.classList.remove('sg-saving')
            if (!td.classList.contains('sg-ed')) td.innerHTML = cellInner(r, c, ctx)
            showToast('บันทึกไม่สำเร็จ — ' + (err?.message || 'ลองใหม่อีกครั้ง'), 'error')
          })
        }
      }
      if (target) startEdit(target)
    }
    editor.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true, e.shiftKey ? [-1, 0] : [1, 0]) }
      else if (e.key === 'Tab') { e.preventDefault(); finish(true, e.shiftKey ? [0, -1] : [0, 1]) }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false) }
      // ลูกศรขึ้น/ลง = ย้ายแถวเหมือน Sheet (ช่องวันที่/ตัวเลือกใช้ลูกศรเปลี่ยนค่า จึงไม่ย้าย)
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && editor.tagName === 'INPUT' && editor.type === 'text' && c.t !== 'list') {
        e.preventDefault(); finish(true, e.key === 'ArrowDown' ? [1, 0] : [-1, 0])
      }
    })
    // วางข้อมูลที่คัดลอกจาก Google Sheet/Excel หลายช่อง → กระจายลงช่องข้างๆ/แถวถัดไปเหมือนวางใน Sheet
    editor.addEventListener('paste', e => {
      const text = e.clipboardData?.getData('text/plain') || ''
      const grid = parseClipboardGrid(text)
      if (grid.length <= 1 && (grid[0] || []).length <= 1) return // ช่องเดียว = วางปกติ
      e.preventDefault()
      if (r.__draft) { showToast('พิมพ์ชื่อลูกค้าในแถวใหม่ก่อน แล้วค่อยวางหลายช่อง', 'info'); return }
      done = true
      td.classList.remove('sg-ed')
      td.innerHTML = cellInner(r, c, ctx)
      const realRows = all.map(x => (x.__draft ? null : x))
      const plan = planPaste(grid, realRows, cols, i, j)
      ctx.onPasteMany(plan.changes.map(ch => ({ b: realRows[ch.row], col: ch.col, value: ch.value })), plan.bad.length, grid.length)
    })
    if (editor.tagName === 'SELECT') editor.addEventListener('change', () => finish(true))
    editor.addEventListener('blur', () => setTimeout(() => finish(true), 0))
  }
}

function isBlank(c, v) { return v == null || v === '' || (c.t === 'num' && !Number(v)) }
function sameVal(c, a, b) {
  if (c.t === 'num') return (Number(a) || 0) === (Number(b) || 0)
  return String(a ?? '').trim() === String(b ?? '').trim()
}
function flash(td) { td.classList.remove('sg-ok'); void td.offsetWidth; td.classList.add('sg-ok') }

function cellInner(r, c, ctx) {
  const v = r[c.f]
  if (c.t === 'status') {
    if (!v) return ''
    const col = ctx.statusColors?.[v] || '#6b7280'
    return `<span class="sg-dot" style="background:${col}"></span>${escHtml(v)}`
  }
  if (c.t === 'yn') return v ? `<span class="sg-yn-${v === 'Y' ? 'Y' : v === 'N' ? 'N' : ''}">${escHtml(v)}</span>` : ''
  return escHtml(displayCell(c, v))
}

function cellHtml(r, c, j, ctx) {
  const cls = ['sg-c']
  if (c.ro) { cls.length = 0; cls.push('sg-ro') }
  if (c.t === 'num') cls.push('sg-num')
  if (c.f === 'bookingNo') cls.push('sg-fix-no')
  if (c.f === 'custName') cls.push('sg-fix-name')
  const v = r[c.f]
  const title = c.ro ? 'คำนวณอัตโนมัติ' : (v != null && String(v).length > 14 ? String(displayCell(c, v)) : '')
  return `<td class="${cls.join(' ')}" data-j="${j}" data-f="${c.f}"${title ? ` title="${escHtml(title)}"` : ''}>${cellInner(r, c, ctx)}</td>`
}
