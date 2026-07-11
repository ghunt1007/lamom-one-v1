/**
 * Credit Control — ควบคุมเครดิตลูกหนี้
 * Route: /finance/credit
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEBT_STATUS = {
  current:    { label: 'ปกติ', color: 'success' },
  overdue_7:  { label: 'ค้าง 1-7 วัน', color: 'warning' },
  overdue_30: { label: 'ค้าง 8-30 วัน', color: 'warning' },
  overdue_60: { label: 'ค้าง 31-60 วัน', color: 'danger' },
  bad_debt:   { label: 'หนี้เสีย >60 วัน', color: 'danger' },
  settled:    { label: 'ชำระแล้ว', color: 'secondary' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function CreditControlPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let debtors = []
  let statusFilter = 'all'
  let loading = true

  // Derived from the shared `bookings` collection (owned by DMS/CRM booking flows — never
  // written to here). Outstanding bookings become "virtual" debtor rows; once the user acts
  // on one (e.g. settles it), a real record is materialized into `debt_settlements` carrying
  // sourceBookingId, and the matching virtual row is filtered out on the next load.
  async function loadData() {
    loading = true
    try {
      const stored = await listDocs('debt_settlements', [], 'oldest', 'asc', 300)
      let virtual = []
      try {
        const bookings = await listDocs('bookings', [], 'createdAt', 'desc', 300)
        const outstanding = bookings.filter(b => ['ยืนยัน', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status))
        virtual = outstanding.filter(b => !stored.some(s => s.sourceBookingId === b.id)).map(b => {
          const bookDate = (b.bookingDate || b.createdAt?.toDate?.()?.toISOString() || '').slice(0, 10)
          const dueDate = bookDate ? new Date(new Date(bookDate).getTime() + 30 * 86400000).toISOString().slice(0, 10) : ''
          const daysPast = dueDate ? Math.max(0, Math.round((Date.now() - new Date(dueDate)) / 86400000)) : 0
          return {
            id: 'CR-' + b.id, customerId: b.id, sourceBookingId: b.id,
            customer: b.custName || 'ลูกค้า', contact: b.custName || '', phone: b.phone || '',
            type: 'retail', invoices: 1, oldest: dueDate,
            creditLimit: b.price || 0, used: b.price || 0,
            status: daysPast > 30 ? 'overdue_30' : daysPast > 0 ? 'overdue_7' : 'current',
            notes: `${b.brand || ''} ${b.model || ''}`.trim(), _source: 'booking',
          }
        })
      } catch (e) {}
      debtors = [...stored, ...virtual]
    } catch (e) { debtors = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  async function persistDebtor(d, fields) {
    if (d._source === 'booking') {
      const { _source, id, ...rest } = d
      await createDoc('debt_settlements', { ...rest, sourceBookingId: d.sourceBookingId, ...fields })
    } else {
      await updateDocData('debt_settlements', d.id, fields)
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = debtors.filter(d => statusFilter === 'all' || d.status === statusFilter)
    const totalOutstanding = debtors.reduce((a, d) => a + d.used, 0)
    const overdue = debtors.filter(d => d.status !== 'current' && d.status !== 'settled')
    const overdueAmount = overdue.reduce((a, d) => a + d.used, 0)
    const badDebtAmount = debtors.filter(d => d.status === 'bad_debt').reduce((a, d) => a + d.used, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Credit Control</div>
            <div class="page-subtitle">ติดตามลูกหนี้และควบคุมเครดิต</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-debtor-btn">+ เพิ่มลูกหนี้</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💸 ยอดค้างชำระรวม', formatCurrency(totalOutstanding), 'primary')}
          ${kpi('⚠️ ค้างเกินกำหนด', formatCurrency(overdueAmount), 'warning')}
          ${kpi('❌ หนี้เสีย', formatCurrency(badDebtAmount), badDebtAmount > 0 ? 'danger' : 'secondary')}
          ${kpi('📊 ลูกหนี้ทั้งหมด', debtors.length + ' ราย', 'primary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(DEBT_STATUS).filter(([k])=>k!=='settled').map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(d => {
            const st = DEBT_STATUS[d.status]
            const utilPct = d.creditLimit ? Math.round(d.used / d.creditLimit * 100) : 0
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${escHtml(d.customer)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${d.type === 'b2b' ? '🏢 B2B' : d.type === 'gov' ? '🏛 ราชการ' : '👤 รายย่อย'} · ${escHtml(d.contact)} · ${escHtml(d.phone)}</div>
                </div>
                <div style="text-align:right">
                  <span class="badge badge-${st?.color}" style="font-size:0.68rem">${st?.label}</span>
                  <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${d.invoices} ใบแจ้งหนี้</div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
                <div><div style="font-size:0.68rem;color:var(--text-muted)">ค้างชำระ</div><div style="font-weight:800;color:var(--${st?.color})">${formatCurrency(d.used)}</div></div>
                <div><div style="font-size:0.68rem;color:var(--text-muted)">วงเงินเครดิต</div><div style="font-weight:700">${formatCurrency(d.creditLimit)}</div></div>
                <div><div style="font-size:0.68rem;color:var(--text-muted)">ใช้ไป</div><div style="font-weight:700;color:${utilPct>=90?'var(--danger)':utilPct>=70?'var(--warning)':'var(--text)'}">${utilPct}%</div></div>
              </div>

              <div style="margin-bottom:8px">
                <div style="background:var(--surface-2);border-radius:3px;height:5px">
                  <div style="width:${Math.min(utilPct,100)}%;background:${utilPct>=90?'var(--danger)':utilPct>=70?'var(--warning)':'var(--success)'};height:5px;border-radius:3px"></div>
                </div>
              </div>

              ${d.notes ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">📌 ${escHtml(d.notes)}</div>` : ''}

              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-btn" data-id="${escHtml(d.id)}">ดูรายละเอียด</button>
                <button class="btn btn-xs btn-primary call-btn" data-id="${escHtml(d.id)}">📞 ติดตาม</button>
                ${d.status !== 'settled' ? `<button class="btn btn-xs btn-success settle-btn" data-id="${escHtml(d.id)}">✅ ชำระแล้ว</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-debtor-btn')?.addEventListener('click', openAddDebtor)
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const d = debtors.find(x => x.id === b.dataset.id); if (d) openDetail(d)
    }))
    container.querySelectorAll('.call-btn').forEach(b => b.addEventListener('click', () => {
      showToast(`📞 บันทึกการติดตาม ${debtors.find(x=>x.id===b.dataset.id)?.customer} แล้ว`, 'success')
    }))
    container.querySelectorAll('.settle-btn').forEach(b => b.addEventListener('click', async () => {
      const d = debtors.find(x => x.id === b.dataset.id)
      if (!d) return
      try {
        await persistDebtor(d, { status: 'settled', used: 0 })
        showToast(`✅ ชำระหนี้ ${d.customer} แล้ว!`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openDetail(d) {
    const st = DEBT_STATUS[d.status]
    openModal({
      title: '🏦 ' + escHtml(d.id) + ' — ' + escHtml(d.customer),
      size: 'md',
      body: `
        <div style="margin-bottom:12px"><span class="badge badge-${st?.color}">${st?.label}</span></div>
        ${row('ประเภท', d.type === 'b2b' ? '🏢 B2B' : d.type === 'gov' ? '🏛 ราชการ' : '👤 รายย่อย')}
        ${row('ผู้ติดต่อ', escHtml(d.contact) + ' · ' + escHtml(d.phone))}
        ${row('ยอดค้างชำระ', formatCurrency(d.used))}
        ${row('วงเงินเครดิต', formatCurrency(d.creditLimit))}
        ${row('จำนวนใบแจ้งหนี้', d.invoices + ' ใบ')}
        ${row('ค้างมาตั้งแต่', formatDate(d.oldest))}
        ${d.notes ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📌 ${escHtml(d.notes)}</div>` : ''}
      `
    })
  }

  function openAddDebtor() {
    openModal({
      title: '+ เพิ่มลูกหนี้',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อ/บริษัท *</label><input class="input" id="df-name"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="df-type"><option value="retail">รายย่อย</option><option value="b2b">B2B</option><option value="gov">ราชการ</option></select>
          </div>
          <div class="input-group"><label class="input-label">วงเงินเครดิต</label><input type="number" class="input" id="df-limit" placeholder="500000"></div>
          <div class="input-group"><label class="input-label">ยอดค้างชำระ</label><input type="number" class="input" id="df-used" placeholder="0"></div>
          <div class="input-group"><label class="input-label">ผู้ติดต่อ</label><input class="input" id="df-contact" placeholder="ชื่อผู้ติดต่อ"></div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('df-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        const used = +document.getElementById('df-used')?.value || 0
        const limit = +document.getElementById('df-limit')?.value || 500000
        try {
          await createDoc('debt_settlements', {
            customer: name,
            type: document.getElementById('df-type')?.value||'retail',
            creditLimit: limit, used, invoices: used > 0 ? 1 : 0,
            oldest: addDays(0), status: used > 0 ? 'overdue_7' : 'current',
            contact: document.getElementById('df-contact')?.value||'', phone: '', notes: ''
          })
          showToast('✅ เพิ่มลูกหนี้แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
