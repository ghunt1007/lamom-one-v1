/**
 * Warranty Claim — เคลมประกันรถ/อะไหล่จากค่าย
 * Route: /service/warranty-claim
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const WC_STATUS = {
  draft:      { label: 'ร่าง', color: 'secondary', icon: '📝' },
  submitted:  { label: 'ส่งค่ายแล้ว', color: 'primary', icon: '📤' },
  approved:   { label: 'ค่ายอนุมัติ', color: 'success', icon: '✅' },
  rejected:   { label: 'ค่ายปฏิเสธ', color: 'danger', icon: '❌' },
  reimbursed: { label: 'รับเงินคืนแล้ว', color: 'success', icon: '💰' },
}

const DEMO_CLAIMS = [
  { id: 'WC001', plate: '1กข-1234', model: 'BYD Seal', vin: '...3456', issue: 'มอเตอร์มีเสียงผิดปกติ', parts: 'Motor Assembly', laborHrs: 4, partCost: 45000, status: 'approved', submitted: addDays(-8), warrantyType: 'Powertrain 8 ปี' },
  { id: 'WC002', plate: '2ขค-5678', model: 'BYD Dolphin', vin: '...9012', issue: 'จอ infotainment ค้าง', parts: 'Head Unit', laborHrs: 1.5, partCost: 18000, status: 'submitted', submitted: addDays(-3), warrantyType: 'ทั่วไป 3 ปี' },
  { id: 'WC003', plate: '3คง-9012', model: 'MG ZS EV', vin: '...7788', issue: 'แบตเสื่อมเร็วผิดปกติ (SOH 72%)', parts: 'Battery Pack', laborHrs: 6, partCost: 280000, status: 'submitted', submitted: addDays(-1), warrantyType: 'Battery 8 ปี/160k km' },
  { id: 'WC004', plate: '4งจ-3456', model: 'BYD Atto 3', vin: '...5566', issue: 'ที่ปัดน้ำฝนไม่ทำงาน', parts: 'Wiper Motor', laborHrs: 1, partCost: 3200, status: 'reimbursed', submitted: addDays(-30), warrantyType: 'ทั่วไป 3 ปี' },
  { id: 'WC005', plate: '5จฉ-7890', model: 'BYD Han', vin: '...2233', issue: 'ระบบเบรกเตือน error (ลูกค้าใช้ผิดวิธี)', parts: '—', laborHrs: 0.5, partCost: 0, status: 'rejected', submitted: addDays(-15), warrantyType: 'ทั่วไป 3 ปี' },
]

const LABOR_RATE = 500

const NEXT = { draft: 'submitted', submitted: 'approved', approved: 'reimbursed' }

export default async function WarrantyClaimPage(container) {
  let claims = DEMO_CLAIMS.map(c => ({ ...c }))
  let statusFilter = 'all'

  function claimValue(c) { return c.partCost + Math.round(c.laborHrs * LABOR_RATE) }

  function renderPage() {
    const list = claims.filter(c => statusFilter === 'all' || c.status === statusFilter)
    const pending = claims.filter(c => c.status === 'submitted')
    const pendingValue = pending.reduce((a, c) => a + claimValue(c), 0)
    const reimbursed = claims.filter(c => c.status === 'reimbursed').reduce((a, c) => a + claimValue(c), 0)
    const approveRate = Math.round(claims.filter(c => ['approved','reimbursed'].includes(c.status)).length / claims.filter(c => c.status !== 'submitted' && c.status !== 'draft').length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛡 Warranty Claim</div>
            <div class="page-subtitle">เคลมรับประกันจากค่ายรถ — เบิกค่าอะไหล่+ค่าแรงคืน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-wc-btn">+ เปิดเคลม</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📤 รอค่ายอนุมัติ', pending.length, pending.length > 0 ? 'warning' : 'success')}
          ${kpi('💸 มูลค่ารออนุมัติ', formatCurrency(pendingValue), 'primary')}
          ${kpi('💰 รับคืนแล้ว (เดือนนี้)', formatCurrency(reimbursed), 'success')}
          ${kpi('📊 อัตราอนุมัติ', approveRate + '%', approveRate >= 70 ? 'success' : 'warning')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(WC_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(c => {
            const cs = WC_STATUS[c.status]
            const next = NEXT[c.status]
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${cs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.86rem">${c.plate} — ${c.model} <span style="font-size:0.68rem;color:var(--text-muted)">VIN ${c.vin}</span></div>
                  <div style="font-size:0.74rem;color:var(--text-muted)">🔧 ${c.issue}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">อะไหล่: ${c.parts} · แรง ${c.laborHrs} ชม. · 🛡 ${c.warrantyType} · ส่ง ${timeAgo(c.submitted)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${cs?.color}" style="font-size:0.62rem">${cs?.icon} ${cs?.label}</span>
                  <div style="font-size:0.88rem;font-weight:700;color:var(--success)">${formatCurrency(claimValue(c))}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${next ? `<button class="btn btn-xs btn-${WC_STATUS[next]?.color} next-btn" data-id="${c.id}">${WC_STATUS[next]?.icon} → ${WC_STATUS[next]?.label}</button>` : ''}
                ${c.status === 'submitted' ? `<button class="btn btn-xs btn-danger reject-btn" data-id="${c.id}">❌ ค่ายปฏิเสธ</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', () => {
      const c = claims.find(x => x.id === b.dataset.id)
      if (c) { c.status = NEXT[c.status]; showToast(`${WC_STATUS[c.status]?.icon} ${WC_STATUS[c.status]?.label}`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const c = claims.find(x => x.id === b.dataset.id); if (c) { c.status = 'rejected'; renderPage() }
    }))
    document.getElementById('add-wc-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เปิดเคลมรับประกัน',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ทะเบียน *</label><input class="input" id="wc-plate"></div>
          <div class="input-group"><label class="input-label">รุ่น</label><input class="input" id="wc-model"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">อาการ/ปัญหา *</label><input class="input" id="wc-issue"></div>
          <div class="input-group"><label class="input-label">อะไหล่ที่เปลี่ยน</label><input class="input" id="wc-parts"></div>
          <div class="input-group"><label class="input-label">ค่าอะไหล่ (บาท)</label><input class="input" type="number" id="wc-cost" value="0"></div>
          <div class="input-group"><label class="input-label">ชั่วโมงแรง</label><input class="input" type="number" step="0.5" id="wc-hrs" value="1"></div>
          <div class="input-group"><label class="input-label">ประเภทประกัน</label>
            <select class="input" id="wc-type"><option>ทั่วไป 3 ปี</option><option>Powertrain 8 ปี</option><option>Battery 8 ปี/160k km</option></select>
          </div>
        </div>`,
        confirmText: '📤 เปิดเคลม + ส่งค่าย',
        onConfirm() {
          const plate = document.getElementById('wc-plate')?.value?.trim()
          const issue = document.getElementById('wc-issue')?.value?.trim()
          if (!plate || !issue) { showToast('❗ กรอกทะเบียนและอาการ', 'error'); return false }
          claims.unshift({ id:`WC${String(claims.length+1).padStart(3,'0')}`, plate, model:document.getElementById('wc-model')?.value||'—', vin:'...ใหม่', issue, parts:document.getElementById('wc-parts')?.value||'—', laborHrs:parseFloat(document.getElementById('wc-hrs')?.value)||1, partCost:parseInt(document.getElementById('wc-cost')?.value)||0, status:'submitted', submitted:addDays(0), warrantyType:document.getElementById('wc-type')?.value||'ทั่วไป 3 ปี' })
          showToast('📤 เปิดเคลม + ส่งค่ายแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
