// สรุปรายได้รายเซลส์ — Route: /crm/sales-income
// รวมรายได้/คอมที่กรอกไว้ในใบจองของคันที่ส่งมอบในเดือนที่เลือก แยกตามเซลส์ (ดูสูตรใน utils/salesIncome.js)
// เซลส์ทั่วไปเห็นเฉพาะของตัวเอง/ลูกทีม ตามกติกาเดียวกับหน้าใบจอง (getVisibilityScope)
import { listAllDocs, readDoc, setDocData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import { showToast, getState } from '../../core/store.js'
import { openModal } from '../../utils/modal.js'
import { SALES_TARGETS_COLLECTION, targetFor, goalProgress } from '../../utils/salesTargets.js'
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { summarizeSalesIncome, lastMonths } from '../../utils/salesIncome.js'
import { askDeliveryIncome, needsIncome } from '../../utils/deliveryIncome.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}` }

export default async function SalesIncomePage(container) {
  const myGen = container.__routerGen
  let month = todayBangkok().slice(0, 7)
  let bookings = []
  const open = new Set()
  let targets = {}
  const role = getState('role') || getState('user')?.role || 'staff'
  const canSetTarget = ['owner', 'admin', 'manager'].includes(role)
  async function loadTargets() {
    try { targets = (await readDoc(SALES_TARGETS_COLLECTION, month))?.targets || {} } catch { targets = {} }
  }

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
  const scope = await getVisibilityScope()
  try {
    bookings = (await listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 500))
      .filter(b => !b.deleted && scopeIncludesRecord(scope, b.salesName, b))
  } catch { showToast('โหลดใบจองไม่สำเร็จ', 'error') }
  await loadTargets()
  if (container.__routerGen !== myGen) return

  function render() {
    const { rows, total } = summarizeSalesIncome(bookings, month)
    // เซลส์ที่ตั้งเป้าไว้แต่ยังไม่มีจอง/ส่งมอบในเดือนนี้ ให้ขึ้นแถวด้วย (เห็นว่ายังเป็น 0)
    Object.entries(targets).forEach(([n, v]) => {
      if (Number(v) > 0 && !rows.some(r => targetFor({ [n]: 1 }, r.name)) && scopeIncludesRecord(scope, n, {})) {
        rows.push({ name: n, booked: 0, cancelled: 0, delivered: 0, missing: 0, marginLeft: 0, com70: 0, comFinance: 0, income: 0, cars: [] })
      }
    })
    // เทียบเดือนก่อน (รายได้และจำนวนคันส่งมอบ) — ช่วยดูว่าใครกำลังขึ้น/ลง
    const prevMonth = lastMonths(month, 2)[1]
    const prev = summarizeSalesIncome(bookings, prevMonth)
    const prevOf = name => prev.rows.find(p => targetFor({ [p.name]: 1 }, name)) || { income: 0, delivered: 0 }
    const delta = (cur, old, money) => {
      if (cur === old) return ''
      const up = cur > old
      return `<div style="font-size:0.66rem;font-weight:600;color:var(--${up ? 'success' : 'danger'})">${up ? '▲' : '▼'} ${money ? formatCurrency(Math.abs(cur - old)) : Math.abs(cur - old)}</div>`
    }
    const teamTarget = rows.reduce((t, r) => t + targetFor(targets, r.name), 0)
    const goalCell = r => {
      const t = targetFor(targets, r.name)
      const g = goalProgress(r.delivered, t)
      const edit = canSetTarget && !r.name.startsWith('(') ? ` <button class="btn btn-ghost btn-xs si-target" data-n="${escHtml(r.name)}" title="ตั้งเป้า">✏️</button>` : ''
      if (!t) return `<span style="color:var(--text-muted)">—</span>${edit}`
      return `<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><span style="font-weight:700;color:var(--${g.color})">${r.delivered}/${t}</span><div style="width:50px;height:6px;background:var(--surface-2);border-radius:3px"><div style="height:100%;width:${Math.min(100, g.pct)}%;background:var(--${g.color});border-radius:3px"></div></div>${edit}</div>`
    }
    const card = (icon, label, value, color, sub = '') => `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.75rem;color:var(--text-muted)">${icon} ${label}</div>
      <div style="font-size:1.35rem;font-weight:800;color:var(--${color})">${value}</div>${sub ? `<div style="font-size:0.7rem;color:var(--text-muted)">${sub}</div>` : ''}</div>`
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div><div class="page-title">💰 รายได้รายเซลส์</div><div class="page-subtitle">ตัวเลขจากใบจองที่ส่งมอบใน${escHtml(monthLabel(month))}</div></div>
          <div class="page-actions">
            <select class="input" id="si-month" style="width:auto">${lastMonths(todayBangkok().slice(0, 7)).map(m => `<option value="${m}" ${m === month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
            ${canSetTarget ? `<button class="btn btn-secondary btn-sm si-target" data-n="">🎯 ตั้งเป้า</button>` : ''}
            <button class="btn btn-secondary btn-sm" id="si-export">📥 Export</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:16px">
          ${card('💰', 'รายได้รวม', formatCurrency(total.income), 'accent', `เดือนก่อน ${formatCurrency(prev.total.income)}`)}
          ${card('🚗', 'ส่งมอบ', total.delivered + ' คัน', 'success', `จองใหม่ ${total.booked} คัน${total.cancelled ? ` · ถอนจอง ${total.cancelled} คัน` : ''}${teamTarget ? ` · เป้ารวม ${teamTarget} คัน (${goalProgress(total.delivered, teamTarget).pct}%)` : ''}`)}
          ${card('👤', 'คอมเซลส์', formatCurrency(total.com70), 'primary')}
          ${card('🏦', 'คอมไฟแนนซ์', formatCurrency(total.comFinance), 'primary')}
          ${card('📈', 'มาร์จิ้นคงเหลือ', formatCurrency(total.marginLeft), 'warning')}
          ${total.missing ? card('⚠️', 'ยังไม่กรอกรายได้', total.missing + ' คัน', 'danger', 'กดชื่อเซลส์เพื่อกรอก') : ''}
        </div>
        ${rows.length ? `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table>
          <thead><tr><th>เซลส์</th><th style="text-align:right">จอง</th><th style="text-align:right">ถอนจอง</th><th style="text-align:right">ส่งมอบ</th><th style="text-align:right">เป้า (คัน)</th><th style="text-align:right">มาร์จิ้นคงเหลือ</th><th style="text-align:right">คอมเซลส์</th><th style="text-align:right">คอมไฟแนนซ์</th><th style="text-align:right">รายได้รวม</th></tr></thead>
          <tbody>${rows.map(r => `
            <tr class="si-row" data-n="${escHtml(r.name)}" style="cursor:pointer">
              <td style="font-weight:700">${open.has(r.name) ? '▾' : '▸'} ${escHtml(r.name)}${r.missing ? ` <span class="badge badge-danger" style="font-size:0.62rem">ยังไม่กรอก ${r.missing}</span>` : ''}</td>
              <td style="text-align:right">${r.booked}</td><td style="text-align:right;${r.cancelled ? 'color:var(--danger)' : 'color:var(--text-muted)'}">${r.cancelled}</td><td style="text-align:right">${r.delivered}${delta(r.delivered, prevOf(r.name).delivered)}</td><td style="text-align:right">${goalCell(r)}</td>
              <td style="text-align:right">${formatCurrency(r.marginLeft)}</td><td style="text-align:right">${formatCurrency(r.com70)}</td>
              <td style="text-align:right">${formatCurrency(r.comFinance)}</td><td style="text-align:right;font-weight:800;color:var(--accent)">${formatCurrency(r.income)}${delta(r.income, prevOf(r.name).income, true)}</td>
            </tr>
            ${open.has(r.name) ? r.cars.map(b => `<tr style="background:var(--surface-2);font-size:0.78rem">
              <td style="padding-left:28px">${escHtml(b.custName || '—')} · ${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '—')}<div style="font-size:0.68rem;color:var(--text-muted)">${escHtml(b.bookingNo || '')} · ส่งมอบ ${formatDate(b.cutDate || b.actualDeliveryDate)}</div></td>
              <td></td><td></td><td></td><td></td>
              <td style="text-align:right">${formatCurrency(b.marginLeft || 0)}</td><td style="text-align:right">${formatCurrency(b.com70 || 0)}</td><td style="text-align:right">${formatCurrency(b.comFinance || 0)}</td>
              <td style="text-align:right">${needsIncome(b) ? `<button class="btn btn-warning btn-xs si-income" data-id="${escHtml(b.id)}">💰 กรอกรายได้</button>` : formatCurrency(b.totalIncome || 0)}</td>
            </tr>`).join('') : ''}`).join('')}
          </tbody></table></div></div>`
        : `<div class="empty-state" style="padding:48px"><div class="empty-icon">💰</div><div class="empty-title">ยังไม่มีรถส่งมอบใน${escHtml(monthLabel(month))}</div></div>`}
        <div class="card" style="padding:12px 16px;margin-top:16px;font-size:0.8rem;color:var(--text-2)">
          📲 <b>ให้เซลส์รับเตือนงานค้างทาง LINE ของตัวเองทุก 9 โมงเช้า:</b> ทัก LINE OA ของบริษัท แล้วพิมพ์ <code>ลงทะเบียน ชื่อเซลส์</code> (ชื่อต้องตรงกับชื่อในช่องเซลส์/ผู้ดูแลของแอป เช่น <code>ลงทะเบียน ${escHtml(rows[0]?.name && !rows[0].name.startsWith('(') ? rows[0].name : 'สมชาย')}</code>) · พิมพ์ <code>งาน</code> เพื่อดูงานค้างได้ทุกเวลา · <code>หา 08xxxxxxxx</code> ค้นหาลูกค้า · <code>คำสั่ง</code> ดูคำสั่งทั้งหมด · พิมพ์ <code>ยกเลิก</code> เพื่อหยุดรับ
        </div>
      </div>`

    container.querySelector('#si-month').addEventListener('change', async e => { month = e.target.value; open.clear(); await loadTargets(); render() })
    container.querySelectorAll('.si-target').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation()
      const fixed = btn.dataset.n
      const known = [...new Set(bookings.map(b => (b.salesName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))
      openModal({
        title: `🎯 เป้าส่งมอบ · ${escHtml(monthLabel(month))}`, size: 'sm',
        body: `<div class="input-group"><label class="input-label">เซลส์</label>${fixed ? `<div style="font-weight:700">${escHtml(fixed)}</div>` : `<input class="input" id="si-target-name" list="si-target-names" placeholder="พิมพ์หรือเลือกชื่อเซลส์" autocomplete="off"><datalist id="si-target-names">${known.map(n => `<option value="${escHtml(n)}">`).join('')}</datalist>`}</div>
          <div class="input-group" style="margin-top:10px"><label class="input-label">จำนวนคันที่ต้องส่งมอบเดือนนี้ (ใส่ 0 = ไม่ตั้งเป้า)</label><input type="number" min="0" class="input" id="si-target-val" value="${fixed ? targetFor(targets, fixed) || '' : ''}"></div>`,
        async onConfirm() {
          const name = fixed || document.getElementById('si-target-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณาใส่ชื่อเซลส์', 'error'); return false }
          const key = Object.keys(targets).find(n => targetFor({ [n]: 1 }, name)) || name
          const v = Math.max(0, parseInt(document.getElementById('si-target-val')?.value, 10) || 0)
          try {
            await setDocData(SALES_TARGETS_COLLECTION, month, { month, targets: { [key]: v } })
            targets = { ...targets, [key]: v }
            showToast('🎯 บันทึกเป้าแล้ว', 'success'); render()
          } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        },
      })
      setTimeout(() => document.getElementById(fixed ? 'si-target-val' : 'si-target-name')?.focus(), 50)
    }))
    container.querySelector('#si-export').addEventListener('click', () => {
      const out = rows.flatMap(r => r.cars.map(b => ({
        เดือน: month, เซลส์: r.name, เป้า: targetFor(targets, r.name) || '', ลูกค้า: b.custName, รุ่น: [b.brand, b.model].filter(Boolean).join(' '), เลขจอง: b.bookingNo,
        วันส่งมอบ: b.cutDate || b.actualDeliveryDate, มาร์จิ้นคงเหลือ: b.marginLeft || 0, คอมเซลส์: b.com70 || 0, คอมไฟแนนซ์: b.comFinance || 0, รายได้รวม: b.totalIncome || 0,
      })))
      if (!out.length) { showToast('ไม่มีข้อมูลให้ Export', 'warning'); return }
      exportToExcel(out, `sales-income-${month}.xlsx`, 'รายได้รายเซลส์')
    })
    container.querySelectorAll('.si-row').forEach(tr => tr.addEventListener('click', () => {
      const n = tr.dataset.n
      if (open.has(n)) open.delete(n); else open.add(n)
      render()
    }))
    container.querySelectorAll('.si-income').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const b = bookings.find(x => x.id === btn.dataset.id)
      if (b && await askDeliveryIncome(b)) { showToast('💰 บันทึกรายได้แล้ว', 'success'); render() }
    }))
  }
  render()
}
