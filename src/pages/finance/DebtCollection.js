/**
 * Debt Collection — ติดตามหนี้ค้างชำระ
 * Route: /finance/debt
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DEBT_STATUS = {
  current:   { label: 'ยังไม่ครบกำหนด', color: 'secondary', icon: '📅' },
  overdue30: { label: 'ค้าง 1-30 วัน', color: 'warning', icon: '⏰' },
  overdue60: { label: 'ค้าง 31-60 วัน', color: 'danger', icon: '⚠️' },
  overdue90: { label: 'ค้าง 60+ วัน', color: 'danger', icon: '🚨' },
  paid:      { label: 'ชำระแล้ว', color: 'success', icon: '✅' },
}

const DEMO_DEBTS = [
  { id: 'DB001', customer: 'บริษัท ABC จำกัด', type: 'B2B Fleet', amount: 450000, dueDate: addDays(-45), status: 'overdue60', lastContact: addDays(-5), contacts: 3, note: 'สัญญาว่าจะจ่ายสิ้นเดือน' },
  { id: 'DB002', customer: 'สมชาย ใจดี', type: 'ค่าซ่อม', amount: 28500, dueDate: addDays(-12), status: 'overdue30', lastContact: addDays(-2), contacts: 1, note: '' },
  { id: 'DB003', customer: 'ร้านเช่ารถ XYZ', type: 'B2B Service', amount: 86000, dueDate: addDays(-70), status: 'overdue90', lastContact: addDays(-1), contacts: 6, note: 'เริ่มกระบวนการทางกฎหมาย?' },
  { id: 'DB004', customer: 'มาลี สุขใจ', type: 'ค่าอะไหล่', amount: 12400, dueDate: addDays(10), status: 'current', lastContact: null, contacts: 0, note: '' },
  { id: 'DB005', customer: 'ธนพล เที่ยงตรง', type: 'ค่าซ่อม', amount: 8900, dueDate: addDays(-8), status: 'overdue30', lastContact: addDays(-3), contacts: 2, note: 'ขอผ่อน 2 งวด' },
  { id: 'DB006', customer: 'โรงแรมสยาม', type: 'B2B Fleet', amount: 156000, dueDate: addDays(-20), status: 'paid', lastContact: addDays(-1), contacts: 2, note: 'จ่ายครบแล้ว' },
]

export default async function DebtCollectionPage(container) {
  const myGen = container.__routerGen
  let debts = DEMO_DEBTS.map(d => ({ ...d }))
  let statusFilter = 'all'
  let dataSource = 'demo'

  try {
    const docs = await listDocs('debts', [], 'dueDate', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `DB${String(i+1).padStart(3,'0')}`,
        customer: d.customer || d.customerName || 'ลูกค้า',
        type: d.type || 'ค้างชำระ',
        amount: d.amount || 0,
        dueDate: d.dueDate || addDays(0),
        status: d.status || 'current',
        lastContact: d.lastContact || null,
        contacts: d.contacts || 0,
        note: d.note || d.notes || '',
      }))
      debts = [...mapped, ...DEMO_DEBTS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = debts.filter(d => statusFilter === 'all' || d.status === statusFilter)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const outstanding = debts.filter(d => d.status !== 'paid').reduce((a, d) => a + d.amount, 0)
    const critical = debts.filter(d => d.status === 'overdue90')
    const criticalAmt = critical.reduce((a, d) => a + d.amount, 0)
    const collected = debts.filter(d => d.status === 'paid').reduce((a, d) => a + d.amount, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Debt Collection</div>
            <div class="page-subtitle">ติดตามหนี้ค้างชำระ — AR Aging${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-debt-btn">+ บันทึกหนี้</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 ค้างชำระรวม', formatCurrency(outstanding), 'danger')}
          ${kpi('🚨 ค้าง 60+ วัน', formatCurrency(criticalAmt), critical.length > 0 ? 'danger' : 'success')}
          ${kpi('✅ เก็บได้เดือนนี้', formatCurrency(collected), 'success')}
          ${kpi('📋 รายการค้าง', debts.filter(d=>d.status!=='paid').length, 'warning')}
        </div>

        ${critical.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🚨 <strong>ต้องจัดการด่วน:</strong> ${critical.map(d => `${escHtml(d.customer)} (${formatCurrency(d.amount)})`).join(' · ')}
          </div>
        ` : ''}

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(DEBT_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(d => {
            const ds = DEBT_STATUS[d.status]
            const daysOverdue = Math.floor((new Date() - new Date(d.dueDate)) / 86400000)
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${ds?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${escHtml(d.customer)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(d.type)} · ครบกำหนด ${formatDate(d.dueDate)}${daysOverdue > 0 && d.status !== 'paid' ? ` (ค้าง ${daysOverdue} วัน)` : ''}</div>
                  ${d.contacts > 0 ? `<div style="font-size:0.72rem;color:var(--text-muted)">📞 ติดตาม ${d.contacts} ครั้ง · ล่าสุด ${timeAgo(d.lastContact)}</div>` : ''}
                  ${d.note ? `<div style="font-size:0.72rem;color:var(--warning);font-style:italic">📌 ${escHtml(d.note)}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ds?.color}" style="font-size:0.62rem">${ds?.icon} ${ds?.label}</span>
                  <div style="font-size:0.92rem;font-weight:700;color:var(--${d.status==='paid'?'success':'danger'})">${formatCurrency(d.amount)}</div>
                </div>
              </div>
              ${d.status !== 'paid' ? `
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-primary contact-btn" data-id="${escHtml(d.id)}">📞 บันทึกติดตาม</button>
                  <button class="btn btn-xs btn-success paid-btn" data-id="${escHtml(d.id)}">✅ รับชำระ</button>
                  <button class="btn btn-xs btn-secondary partial-btn" data-id="${escHtml(d.id)}">💸 ชำระบางส่วน</button>
                </div>
              ` : ''}
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.contact-btn').forEach(b => b.addEventListener('click', () => {
      const d = debts.find(x => x.id === b.dataset.id)
      if (d) openModal({
        title: '📞 บันทึกการติดตาม: ' + escHtml(d.customer),
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ผลการติดต่อ</label>
            <select class="input" id="ct-result"><option>รับสาย — สัญญาจะจ่าย</option><option>รับสาย — ขอเลื่อน</option><option>ไม่รับสาย</option><option>ติดต่อไม่ได้</option></select>
          </div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="ct-note" value="${escHtml(d.note)}"></div>
        </div>`,
        onConfirm() {
          d.contacts++; d.lastContact = addDays(0); d.note = document.getElementById('ct-note')?.value || d.note
          showToast('📞 บันทึกการติดตามแล้ว', 'success'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.paid-btn').forEach(b => b.addEventListener('click', () => {
      const d = debts.find(x => x.id === b.dataset.id)
      if (d) { d.status = 'paid'; d.note = 'จ่ายครบแล้ว'; showToast(`✅ รับชำระ ${formatCurrency(d.amount)} แล้ว`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.partial-btn').forEach(b => b.addEventListener('click', () => {
      const d = debts.find(x => x.id === b.dataset.id)
      if (d) openModal({
        title: '💸 ชำระบางส่วน: ' + escHtml(d.customer),
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="font-size:0.82rem">ยอดค้าง: <strong style="color:var(--danger)">${formatCurrency(d.amount)}</strong></div>
          <div class="input-group"><label class="input-label">จำนวนที่ชำระ (บาท)</label><input class="input" type="number" id="pp-amt" max="${d.amount}"></div>
        </div>`,
        onConfirm() {
          const amt = parseInt(document.getElementById('pp-amt')?.value) || 0
          if (amt <= 0 || amt > d.amount) { showToast('❗ จำนวนไม่ถูกต้อง', 'error'); return }
          d.amount -= amt
          if (d.amount === 0) d.status = 'paid'
          showToast(`💸 รับชำระ ${formatCurrency(amt)} — คงเหลือ ${formatCurrency(d.amount)}`, 'success'); renderPage()
        }
      })
    }))
    document.getElementById('add-debt-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ บันทึกหนี้ใหม่',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ลูกหนี้ *</label><input class="input" id="db-name"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="db-type"><option>ค่าซ่อม</option><option>ค่าอะไหล่</option><option>B2B Fleet</option><option>B2B Service</option><option>อื่นๆ</option></select>
          </div>
          <div class="input-group"><label class="input-label">จำนวนเงิน (บาท)</label><input class="input" type="number" id="db-amt"></div>
          <div class="input-group"><label class="input-label">ครบกำหนด</label><input class="input" type="date" id="db-due" value="${addDays(30)}"></div>
        </div>`,
        onConfirm() {
          const name = document.getElementById('db-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
          debts.unshift({ id:`DB${String(debts.length+1).padStart(3,'0')}`, customer:name, type:document.getElementById('db-type')?.value||'อื่นๆ', amount:parseInt(document.getElementById('db-amt')?.value)||0, dueDate:document.getElementById('db-due')?.value||addDays(30), status:'current', lastContact:null, contacts:0, note:'' })
          showToast('✅ บันทึกหนี้แล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
