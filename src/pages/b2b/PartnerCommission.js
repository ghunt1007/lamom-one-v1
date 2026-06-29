/**
 * Partner Commission — ค่าคอมพาร์ทเนอร์/นายหน้า
 * Route: /b2b/partner-commission
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const PC_STATUS = {
  pending:  { label: 'รอตรวจสอบ', color: 'warning', icon: '⏳' },
  approved: { label: 'อนุมัติ', color: 'primary', icon: '✅' },
  paid:     { label: 'จ่ายแล้ว', color: 'success', icon: '💸' },
  rejected: { label: 'ปฏิเสธ', color: 'danger', icon: '❌' },
}

const PARTNER_TYPES = {
  broker:   { label: 'นายหน้าอิสระ', rate: '1.5%', icon: '🤵' },
  dealer:   { label: 'ดีลเลอร์พันธมิตร', rate: '1.0%', icon: '🏪' },
  finance:  { label: 'ไฟแนนซ์แนะนำ', rate: '0.5%', icon: '🏦' },
  corporate:{ label: 'องค์กรแนะนำ', rate: '0.8%', icon: '🏢' },
}

const DEMO_COMMISSIONS = [
  { id: 'PC001', partner: 'คุณสมหมาย (นายหน้า)', type: 'broker', deal: 'BYD Seal AWD — สมชาย ใจดี', dealValue: 1699000, rate: 1.5, status: 'paid', date: addDays(-20) },
  { id: 'PC002', partner: 'ดีลเลอร์มอเตอร์กรุ๊ป', type: 'dealer', deal: 'BYD Atto 3 ×3 — บ.ABC', dealValue: 3297000, rate: 1.0, status: 'approved', date: addDays(-8) },
  { id: 'PC003', partner: 'กรุงศรี ออโต้', type: 'finance', deal: 'BYD Dolphin — มาลี สุขใจ', dealValue: 899000, rate: 0.5, status: 'pending', date: addDays(-3) },
  { id: 'PC004', partner: 'คุณวิเชียร (นายหน้า)', type: 'broker', deal: 'MG4 — ธนพล เที่ยงตรง', dealValue: 949000, rate: 1.5, status: 'pending', date: addDays(-1) },
  { id: 'PC005', partner: 'โรงแรมสยาม (องค์กร)', type: 'corporate', deal: 'BYD Han ×2 Fleet', dealValue: 4198000, rate: 0.8, status: 'rejected', date: addDays(-15) },
]

function commAmt(c) { return Math.round(c.dealValue * c.rate / 100) }

export default async function PartnerCommissionPage(container) {
  const myGen = container.__routerGen
  let items = DEMO_COMMISSIONS.map(c => ({ ...c }))
  let dataSource = 'demo'
  let statusFilter = 'all'

  try {
    const docs = await listDocs('partner_commissions', [], 'date', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `PC${i+1}`,
        partner: d.partner || d.partnerName || 'พาร์ทเนอร์',
        type: d.type || 'broker',
        deal: d.deal || d.dealName || '',
        dealValue: d.dealValue || 0,
        rate: d.rate || 1.5,
        status: d.status || 'pending',
        date: d.date || d.createdAt?.slice(0,10) || '',
      }))
      items = [...mapped, ...DEMO_COMMISSIONS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = items.filter(c => statusFilter === 'all' || c.status === statusFilter)
    const pendingAmt = items.filter(c => c.status === 'pending').reduce((a, c) => a + commAmt(c), 0)
    const approvedAmt = items.filter(c => c.status === 'approved').reduce((a, c) => a + commAmt(c), 0)
    const paidAmt = items.filter(c => c.status === 'paid').reduce((a, c) => a + commAmt(c), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤝 Partner Commission</div>
            <div class="page-subtitle">ค่าคอมนายหน้า / พาร์ทเนอร์แนะนำลูกค้า${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-pc-btn">+ บันทึกค่าคอม</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⏳ รอตรวจสอบ', formatCurrency(pendingAmt), pendingAmt > 0 ? 'warning' : 'secondary')}
          ${kpi('✅ รอจ่าย', formatCurrency(approvedAmt), 'primary')}
          ${kpi('💸 จ่ายแล้ว (เดือนนี้)', formatCurrency(paidAmt), 'success')}
          ${kpi('📋 รายการ', items.length, 'secondary')}
        </div>

        <!-- Rate card -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">💲 อัตราค่าคอมมาตรฐาน</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Object.values(PARTNER_TYPES).map(p => `
              <div style="background:var(--surface-2);padding:6px 10px;border-radius:var(--radius-sm);font-size:0.72rem">
                ${p.icon} ${p.label} — <strong style="color:var(--primary)">${p.rate}</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(PC_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(c => {
            const ps = PC_STATUS[c.status]
            const pt = PARTNER_TYPES[c.type]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${ps?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.85rem">${pt?.icon} ${escHtml(c.partner)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${escHtml(c.deal)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">มูลค่าดีล ${formatCurrency(c.dealValue)} × ${c.rate}% · ${formatDate(c.date)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ps?.color}" style="font-size:0.62rem">${ps?.icon} ${ps?.label}</span>
                  <div style="font-size:0.9rem;font-weight:700;color:var(--success)">${formatCurrency(commAmt(c))}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${c.status === 'pending' ? `
                  <button class="btn btn-xs btn-primary approve-btn" data-id="${c.id}">✅ อนุมัติ</button>
                  <button class="btn btn-xs btn-danger reject-btn" data-id="${c.id}">❌ ปฏิเสธ</button>` : ''}
                ${c.status === 'approved' ? `<button class="btn btn-xs btn-success pay-btn" data-id="${c.id}">💸 จ่าย</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const c = items.find(x => x.id === b.dataset.id); if (c) { c.status = 'approved'; showToast('✅ อนุมัติค่าคอมแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const c = items.find(x => x.id === b.dataset.id); if (c) { c.status = 'rejected'; renderPage() }
    }))
    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', () => {
      const c = items.find(x => x.id === b.dataset.id); if (c) { c.status = 'paid'; showToast(`💸 จ่าย ${formatCurrency(commAmt(c))} ให้ ${c.partner} แล้ว`, 'success'); renderPage() }
    }))
    document.getElementById('add-pc-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ บันทึกค่าคอมพาร์ทเนอร์',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">พาร์ทเนอร์ *</label><input class="input" id="pc-partner"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="pc-type">${Object.entries(PARTNER_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label} (${v.rate})</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ดีลที่แนะนำ</label><input class="input" id="pc-deal"></div>
          <div class="input-group"><label class="input-label">มูลค่าดีล (บาท)</label><input class="input" type="number" id="pc-value"></div>
        </div>`,
        onConfirm() {
          const partner = document.getElementById('pc-partner')?.value?.trim()
          if (!partner) { showToast('❗ กรุณากรอกชื่อพาร์ทเนอร์', 'error'); return }
          const type = document.getElementById('pc-type')?.value || 'broker'
          const rate = parseFloat(PARTNER_TYPES[type].rate)
          items.unshift({ id:`PC${String(items.length+1).padStart(3,'0')}`, partner, type, deal:document.getElementById('pc-deal')?.value||'—', dealValue:parseInt(document.getElementById('pc-value')?.value)||0, rate, status:'pending', date:addDays(0) })
          showToast('✅ บันทึกแล้ว — รอตรวจสอบ', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
