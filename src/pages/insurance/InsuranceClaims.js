/**
 * Insurance Claims — เคลมประกัน
 * Route: /insurance/claims
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const CLAIM_STATUS = {
  reported:  { label: 'แจ้งเคลม', color: 'secondary', icon: '📋' },
  surveying: { label: 'สำรวจภัย', color: 'primary', icon: '🔍' },
  approved:  { label: 'อนุมัติ', color: 'success', icon: '✅' },
  repairing: { label: 'กำลังซ่อม', color: 'warning', icon: '🔧' },
  completed: { label: 'เสร็จสิ้น', color: 'success', icon: '🏁' },
  rejected:  { label: 'ปฏิเสธ', color: 'danger', icon: '❌' },
}

const CLAIM_TYPES = {
  collision: { label: 'ชนกับรถ', icon: '🚗' },
  object:    { label: 'ชนสิ่งของ', icon: '🚧' },
  theft:     { label: 'สูญหาย/โจรกรรม', icon: '🔒' },
  flood:     { label: 'น้ำท่วม', icon: '🌊' },
  glass:     { label: 'กระจกแตก', icon: '🪟' },
  other:     { label: 'อื่นๆ', icon: '📌' },
}

const DEMO_CLAIMS = [
  { id: 'CLM001', customer: 'สมชาย ใจดี', plate: '1กข-1234', model: 'BYD Seal', type: 'collision', insurer: 'วิริยะประกันภัย', status: 'repairing', estimate: 45000, approved: 42000, reported: addDays(-10), note: 'ชนท้ายที่แยกอโศก คู่กรณีรับผิด' },
  { id: 'CLM002', customer: 'มาลี สุขใจ', plate: '2ขค-5678', model: 'BYD Dolphin', type: 'glass', insurer: 'กรุงเทพประกันภัย', status: 'completed', estimate: 12000, approved: 12000, reported: addDays(-25), note: 'กระจกหน้าร้าวจากหินกระเด็น' },
  { id: 'CLM003', customer: 'ธนพล เที่ยงตรง', plate: '3คง-9012', model: 'MG ZS EV', type: 'object', insurer: 'ทิพยประกันภัย', status: 'surveying', estimate: 28000, approved: 0, reported: addDays(-3), note: 'เฉี่ยวเสาในลานจอด' },
  { id: 'CLM004', customer: 'อรทัย ตั้งใจ', plate: '4งจ-3456', model: 'BYD Atto 3', type: 'flood', insurer: 'วิริยะประกันภัย', status: 'reported', estimate: 0, approved: 0, reported: addDays(-1), note: 'น้ำท่วมถึงพื้นรถ รอสำรวจ' },
  { id: 'CLM005', customer: 'วิรัช เก่งมาก', plate: '5จฉ-7890', model: 'BYD Han', type: 'collision', insurer: 'เมืองไทยประกันภัย', status: 'rejected', estimate: 95000, approved: 0, reported: addDays(-30), note: 'เมาแล้วขับ — ประกันไม่คุ้มครอง' },
]

const NEXT_STATUS = { reported: 'surveying', surveying: 'approved', approved: 'repairing', repairing: 'completed' }

export default async function InsuranceClaimsPage(container) {
  let claims = DEMO_CLAIMS.map(c => ({ ...c }))
  let statusFilter = 'all'

  function renderPage() {
    const list = claims.filter(c => statusFilter === 'all' || c.status === statusFilter)
    const active = claims.filter(c => !['completed','rejected'].includes(c.status)).length
    const totalApproved = claims.reduce((a, c) => a + c.approved, 0)
    const approvalRate = Math.round(claims.filter(c => c.approved > 0).length / claims.filter(c => c.status !== 'reported' && c.status !== 'surveying').length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛡 Insurance Claims</div>
            <div class="page-subtitle">เคลมประกัน — ติดตามทุกขั้นตอน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-claim-btn">+ แจ้งเคลม</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 เคลมทั้งหมด', claims.length, 'primary')}
          ${kpi('🔄 กำลังดำเนินการ', active, active > 0 ? 'warning' : 'secondary')}
          ${kpi('💰 อนุมัติรวม', formatCurrency(totalApproved), 'success')}
          ${kpi('📊 Approval Rate', approvalRate + '%', approvalRate >= 80 ? 'success' : 'warning')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(CLAIM_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Claims list -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(c => {
            const cs = CLAIM_STATUS[c.status]
            const ct = CLAIM_TYPES[c.type]
            const next = NEXT_STATUS[c.status]
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${cs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(c.id)} — ${escHtml(c.customer)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${escHtml(c.plate)} · ${escHtml(c.model)} · ${ct?.icon} ${ct?.label}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🏢 ${escHtml(c.insurer)} · แจ้ง ${formatDate(c.reported)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${cs?.color}" style="font-size:0.63rem">${cs?.icon} ${cs?.label}</span>
                  ${c.estimate > 0 ? `<div style="font-size:0.72rem;color:var(--text-muted)">ประเมิน ${formatCurrency(c.estimate)}</div>` : ''}
                  ${c.approved > 0 ? `<div style="font-size:0.8rem;font-weight:700;color:var(--success)">อนุมัติ ${formatCurrency(c.approved)}</div>` : ''}
                </div>
              </div>
              ${c.note ? `<div style="font-size:0.73rem;color:var(--text-muted);font-style:italic;margin-bottom:8px">📌 ${escHtml(c.note)}</div>` : ''}
              <div style="display:flex;gap:6px">
                ${next ? `<button class="btn btn-xs btn-${CLAIM_STATUS[next]?.color} next-btn" data-id="${c.id}">${CLAIM_STATUS[next]?.icon} → ${CLAIM_STATUS[next]?.label}</button>` : ''}
                ${['reported','surveying'].includes(c.status) ? `<button class="btn btn-xs btn-danger reject-btn" data-id="${c.id}">❌ ปฏิเสธ</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', () => {
      const c = claims.find(x => x.id === b.dataset.id)
      if (c) {
        const next = NEXT_STATUS[c.status]
        if (next === 'approved' && c.approved === 0) {
          openModal({
            title: '✅ อนุมัติเคลม ' + c.id,
            size: 'sm',
            body: `<div class="input-group"><label class="input-label">วงเงินอนุมัติ (บาท)</label><input class="input" type="number" id="clm-approved" value="${c.estimate}"></div>`,
            onConfirm() {
              c.approved = parseInt(document.getElementById('clm-approved')?.value) || c.estimate
              c.status = 'approved'; showToast('✅ อนุมัติเคลมแล้ว', 'success'); renderPage()
            }
          })
        } else { c.status = next; showToast(`${CLAIM_STATUS[next]?.icon} เปลี่ยนสถานะแล้ว`, 'success'); renderPage() }
      }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const c = claims.find(x => x.id === b.dataset.id); if (c) { c.status = 'rejected'; showToast('❌ ปฏิเสธเคลมแล้ว', 'secondary'); renderPage() }
    }))
    document.getElementById('add-claim-btn')?.addEventListener('click', openAddForm)
  }

  function openAddForm() {
    openModal({
      title: '+ แจ้งเคลมใหม่',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="cl-name"></div>
        <div class="input-group"><label class="input-label">ทะเบียนรถ</label><input class="input" id="cl-plate" placeholder="1กข-1234"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="cl-model"></div>
        <div class="input-group"><label class="input-label">ประเภทเหตุ</label>
          <select class="input" id="cl-type">${Object.entries(CLAIM_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">บริษัทประกัน</label>
          <select class="input" id="cl-insurer"><option>วิริยะประกันภัย</option><option>กรุงเทพประกันภัย</option><option>ทิพยประกันภัย</option><option>เมืองไทยประกันภัย</option></select>
        </div>
        <div class="input-group"><label class="input-label">ประเมินเบื้องต้น (บาท)</label><input class="input" type="number" id="cl-estimate" value="0"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">รายละเอียดเหตุการณ์</label><input class="input" id="cl-note"></div>
      </div>`,
      onConfirm() {
        const name = document.getElementById('cl-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return }
        claims.unshift({ id:`CLM${String(claims.length+1).padStart(3,'0')}`, customer:name, plate:document.getElementById('cl-plate')?.value||'—', model:document.getElementById('cl-model')?.value||'—', type:document.getElementById('cl-type')?.value||'other', insurer:document.getElementById('cl-insurer')?.value||'—', status:'reported', estimate:parseInt(document.getElementById('cl-estimate')?.value)||0, approved:0, reported:addDays(0), note:document.getElementById('cl-note')?.value||'' })
        showToast('✅ แจ้งเคลมแล้ว', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
