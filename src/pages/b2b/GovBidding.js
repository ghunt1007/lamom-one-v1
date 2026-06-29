/**
 * Government Bidding — งานประมูลภาครัฐ (e-bidding)
 * Route: /b2b/gov-bidding
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const BID_STATUS = {
  watching:  { label: 'ติดตามอยู่', color: 'secondary', icon: '👀' },
  preparing: { label: 'เตรียมเอกสาร', color: 'warning', icon: '📋' },
  submitted: { label: 'ยื่นแล้ว', color: 'primary', icon: '📤' },
  won:       { label: 'ชนะประมูล!', color: 'success', icon: '🏆' },
  lost:      { label: 'ไม่ชนะ', color: 'danger', icon: '😔' },
}

const DOC_CHECKLIST = ['หนังสือรับรองบริษัท', 'งบการเงิน 3 ปี', 'ผลงานที่ผ่านมา', 'หนังสือค้ำประกัน (Bid Bond)', 'สเปครถ + ใบเสนอราคา', 'ลงทะเบียน e-GP']

const DEMO_BIDS = [
  { id: 'GB001', project: 'จัดซื้อรถยนต์ไฟฟ้า 15 คัน — เทศบาลนครสมุทรปราการ', budget: 16500000, deadline: addDays(12), status: 'preparing', docs: [true, true, true, false, true, true], ourBid: 15800000, note: 'รอ Bid Bond จากธนาคาร' },
  { id: 'GB002', project: 'เช่ารถ EV พร้อมคนขับ 5 คัน 3 ปี — สำนักงานเขตบางนา', budget: 9000000, deadline: addDays(25), status: 'watching', docs: [false, false, false, false, false, false], ourBid: 0, note: 'รอประกาศ TOR ฉบับจริง' },
  { id: 'GB003', project: 'จัดซื้อรถตรวจการณ์ EV 8 คัน — กรมศุลกากร', budget: 11200000, deadline: addDays(-10), status: 'submitted', docs: [true, true, true, true, true, true], ourBid: 10650000, note: 'ประกาศผล 25 มิ.ย.' },
  { id: 'GB004', project: 'จัดซื้อรถผู้บริหาร 3 คัน — อบจ.สมุทรปราการ', budget: 6300000, deadline: addDays(-45), status: 'won', docs: [true, true, true, true, true, true], ourBid: 5990000, note: 'เซ็นสัญญาแล้ว ส่งมอบ ส.ค.' },
  { id: 'GB005', project: 'จัดซื้อรถ EV 10 คัน — การไฟฟ้านครหลวง', budget: 12000000, deadline: addDays(-60), status: 'lost', docs: [true, true, true, true, true, true], ourBid: 11500000, note: 'แพ้ราคา — คู่แข่งเสนอ 11.2M' },
]

export default async function GovBiddingPage(container) {
  const myGen = container.__routerGen
  let bids = DEMO_BIDS.map(b => ({ ...b, docs: [...b.docs] }))
  let dataSource = 'demo'
  let statusFilter = 'all'

  try {
    const docs = await listDocs('gov_bids', [], 'deadline', 'asc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `GB${i+1}`,
        project: d.project || d.title || d.name || 'โครงการ',
        budget: d.budget || 0,
        deadline: d.deadline || d.dueDate || '',
        status: d.status || 'watching',
        docs: d.docs || [false, false, false, false, false, false],
        ourBid: d.ourBid || d.bidAmount || 0,
        note: d.note || d.notes || '',
      }))
      bids = [...mapped, ...DEMO_BIDS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = bids.filter(b => statusFilter === 'all' || b.status === statusFilter)
    const active = bids.filter(b => ['watching','preparing','submitted'].includes(b.status))
    const pipeline = active.reduce((a, b) => a + b.budget, 0)
    const wonValue = bids.filter(b => b.status === 'won').reduce((a, b) => a + b.ourBid, 0)
    const winRate = Math.round(bids.filter(b => b.status === 'won').length / bids.filter(b => ['won','lost'].includes(b.status)).length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏛 Government Bidding</div>
            <div class="page-subtitle">งานประมูลภาครัฐ — e-bidding / e-GP${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-bid-btn">+ เพิ่มงานประมูล</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 กำลังติดตาม', active.length + ' งาน', 'primary')}
          ${kpi('💰 Pipeline', formatCurrency(pipeline), 'warning')}
          ${kpi('🏆 ชนะแล้ว (ปีนี้)', formatCurrency(wonValue), 'success')}
          ${kpi('📊 Win Rate', winRate + '%', winRate >= 40 ? 'success' : 'warning')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(BID_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(b => {
            const bs = BID_STATUS[b.status]
            const docsDone = b.docs.filter(Boolean).length
            const daysLeft = Math.ceil((new Date(b.deadline) - new Date()) / 86400000)
            const isUrgent = ['watching','preparing'].includes(b.status) && daysLeft <= 14
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${bs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${escHtml(b.project)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">
                    💰 งบประมาณ ${formatCurrency(b.budget)}${b.ourBid > 0 ? ' · เสนอ ' + formatCurrency(b.ourBid) + ' (' + Math.round((1 - b.ourBid/b.budget)*100) + '% ต่ำกว่างบ)' : ''}
                  </div>
                  <div style="font-size:0.72rem;color:var(--${isUrgent?'danger':'text-muted'})">⏰ ปิดรับ ${formatDate(b.deadline)}${isUrgent ? ` (เหลือ ${daysLeft} วัน!)` : ''}</div>
                  ${b.note ? `<div style="font-size:0.72rem;color:var(--warning);font-style:italic">📌 ${escHtml(b.note)}</div>` : ''}
                </div>
                <span class="badge badge-${bs?.color}" style="font-size:0.63rem;white-space:nowrap">${bs?.icon} ${bs?.label}</span>
              </div>
              ${['preparing','watching'].includes(b.status) ? `
                <div style="margin-bottom:8px">
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">📄 เอกสาร ${docsDone}/${DOC_CHECKLIST.length}</div>
                  <div style="display:flex;flex-wrap:wrap;gap:5px">
                    ${DOC_CHECKLIST.map((d, i) => `
                      <label style="display:flex;align-items:center;gap:4px;font-size:0.66rem;cursor:pointer;background:var(--surface-2);padding:3px 8px;border-radius:10px">
                        <input type="checkbox" class="doc-check" data-id="${b.id}" data-i="${i}" ${b.docs[i]?'checked':''} style="accent-color:var(--success)">
                        <span style="${b.docs[i]?'color:var(--success)':''}">${d}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              <div style="display:flex;gap:6px">
                ${b.status === 'watching' ? `<button class="btn btn-xs btn-warning prep-btn" data-id="${b.id}">📋 เริ่มเตรียม</button>` : ''}
                ${b.status === 'preparing' && docsDone === DOC_CHECKLIST.length ? `<button class="btn btn-xs btn-primary submit-btn" data-id="${b.id}">📤 ยื่นประมูล</button>` : ''}
                ${b.status === 'submitted' ? `
                  <button class="btn btn-xs btn-success won-btn" data-id="${b.id}">🏆 ชนะ</button>
                  <button class="btn btn-xs btn-danger lost-btn" data-id="${b.id}">😔 ไม่ชนะ</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.doc-check').forEach(cb => cb.addEventListener('change', () => {
      const b = bids.find(x => x.id === cb.dataset.id)
      if (b) { b.docs[parseInt(cb.dataset.i)] = cb.checked; renderPage() }
    }))
    container.querySelectorAll('.prep-btn').forEach(b => b.addEventListener('click', () => {
      const x = bids.find(z => z.id === b.dataset.id); if (x) { x.status = 'preparing'; renderPage() }
    }))
    container.querySelectorAll('.submit-btn').forEach(b => b.addEventListener('click', () => {
      const x = bids.find(z => z.id === b.dataset.id)
      if (x) openModal({
        title: '📤 ยื่นประมูล',
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">ราคาที่เสนอ (บาท) — งบ ${formatCurrency(x.budget)}</label><input class="input" type="number" id="gb-bid" value="${Math.round(x.budget * 0.95)}"></div>`,
        confirmText: '📤 ยืนยันยื่น',
        onConfirm() {
          x.ourBid = parseInt(document.getElementById('gb-bid')?.value) || 0
          x.status = 'submitted'; x.note = 'รอประกาศผล'
          showToast('📤 ยื่นประมูลในระบบ e-GP แล้ว', 'success'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.won-btn').forEach(b => b.addEventListener('click', () => {
      const x = bids.find(z => z.id === b.dataset.id); if (x) { x.status = 'won'; x.note = 'รอเซ็นสัญญา'; showToast('🏆 ชนะประมูล! ' + formatCurrency(x.ourBid), 'success'); renderPage() }
    }))
    container.querySelectorAll('.lost-btn').forEach(b => b.addEventListener('click', () => {
      const x = bids.find(z => z.id === b.dataset.id); if (x) { x.status = 'lost'; renderPage() }
    }))
    document.getElementById('add-bid-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่มงานประมูล',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อโครงการ *</label><input class="input" id="gb-project"></div>
          <div class="input-group"><label class="input-label">งบประมาณ (บาท)</label><input class="input" type="number" id="gb-budget"></div>
          <div class="input-group"><label class="input-label">วันปิดรับ</label><input class="input" type="date" id="gb-deadline" value="${addDays(30)}"></div>
        </div>`,
        onConfirm() {
          const project = document.getElementById('gb-project')?.value?.trim()
          if (!project) { showToast('❗ กรอกชื่อโครงการ', 'error'); return }
          bids.unshift({ id:`GB${String(bids.length+1).padStart(3,'0')}`, project, budget:parseInt(document.getElementById('gb-budget')?.value)||0, deadline:document.getElementById('gb-deadline')?.value||addDays(30), status:'watching', docs:[false,false,false,false,false,false], ourBid:0, note:'' })
          showToast('✅ เพิ่มงานประมูลแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
