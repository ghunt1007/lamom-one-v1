/**
 * Debt Collection — ติดตามหนี้ค้างชำระ
 * Route: /finance/debt
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DEBT_STATUS = {
  current:   { label: 'ยังไม่ครบกำหนด', color: 'secondary', icon: '📅' },
  overdue30: { label: 'ค้าง 1-30 วัน', color: 'warning', icon: '⏰' },
  overdue60: { label: 'ค้าง 31-60 วัน', color: 'danger', icon: '⚠️' },
  overdue90: { label: 'ค้าง 60+ วัน', color: 'danger', icon: '🚨' },
  paid:      { label: 'ชำระแล้ว', color: 'success', icon: '✅' },
}

export default async function DebtCollectionPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let debts = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { debts = await listDocs('debts', [], 'dueDate', 'asc', 200) } catch (e) { debts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
            <div class="page-subtitle">ติดตามหนี้ค้างชำระ — AR Aging</div>
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
        async onConfirm() {
          const note = document.getElementById('ct-note')?.value || d.note
          try {
            await updateDocData('debts', d.id, { contacts: (d.contacts||0) + 1, lastContact: addDays(0), note })
            showToast('📞 บันทึกการติดตามแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    container.querySelectorAll('.paid-btn').forEach(b => b.addEventListener('click', async () => {
      const d = debts.find(x => x.id === b.dataset.id)
      if (!d) return
      try {
        await updateDocData('debts', d.id, { status: 'paid', note: 'จ่ายครบแล้ว' })
        showToast(`✅ รับชำระ ${formatCurrency(d.amount)} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
        async onConfirm() {
          const amt = parseInt(document.getElementById('pp-amt')?.value) || 0
          if (amt <= 0 || amt > d.amount) { showToast('❗ จำนวนไม่ถูกต้อง', 'error'); return false }
          const newAmount = d.amount - amt
          try {
            await updateDocData('debts', d.id, { amount: newAmount, status: newAmount === 0 ? 'paid' : d.status })
            showToast(`💸 รับชำระ ${formatCurrency(amt)} — คงเหลือ ${formatCurrency(newAmount)}`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
        async onConfirm() {
          const name = document.getElementById('db-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
          try {
            await createDoc('debts', {
              customer: name, type: document.getElementById('db-type')?.value||'อื่นๆ',
              amount: parseInt(document.getElementById('db-amt')?.value)||0,
              dueDate: document.getElementById('db-due')?.value||addDays(30),
              status: 'current', lastContact: null, contacts: 0, note: ''
            })
            showToast('✅ บันทึกหนี้แล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
