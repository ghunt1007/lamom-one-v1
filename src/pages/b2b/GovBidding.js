/**
 * Government Bidding — งานประมูลภาครัฐ (e-bidding)
 * Route: /b2b/gov-bidding
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

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

export default async function GovBiddingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let bids = []
  let loading = true
  let statusFilter = 'all'

  async function loadData() {
    loading = true
    try { bids = await listDocs('gov_bids', [], 'deadline', 'asc', 100) } catch (e) { bids = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
            <div class="page-subtitle">งานประมูลภาครัฐ — e-bidding / e-GP</div>
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
    container.querySelectorAll('.doc-check').forEach(cb => cb.addEventListener('change', async () => {
      const b = bids.find(x => x.id === cb.dataset.id)
      if (!b) return
      const docs = [...b.docs]
      docs[parseInt(cb.dataset.i)] = cb.checked
      try {
        await updateDocData('gov_bids', b.id, { docs })
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.prep-btn').forEach(b => b.addEventListener('click', async () => {
      const x = bids.find(z => z.id === b.dataset.id)
      if (!x) return
      try {
        await updateDocData('gov_bids', x.id, { status: 'preparing' })
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.submit-btn').forEach(b => b.addEventListener('click', () => {
      const x = bids.find(z => z.id === b.dataset.id)
      if (x) openModal({
        title: '📤 ยื่นประมูล',
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">ราคาที่เสนอ (บาท) — งบ ${formatCurrency(x.budget)}</label><input class="input" type="number" id="gb-bid" value="${Math.round(x.budget * 0.95)}"></div>`,
        confirmText: '📤 ยืนยันยื่น',
        async onConfirm() {
          const ourBid = parseInt(document.getElementById('gb-bid')?.value) || 0
          try {
            await updateDocData('gov_bids', x.id, { ourBid, status: 'submitted', note: 'รอประกาศผล' })
            showToast('📤 ยื่นประมูลในระบบ e-GP แล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    container.querySelectorAll('.won-btn').forEach(b => b.addEventListener('click', async () => {
      const x = bids.find(z => z.id === b.dataset.id)
      if (!x) return
      try {
        await updateDocData('gov_bids', x.id, { status: 'won', note: 'รอเซ็นสัญญา' })
        showToast('🏆 ชนะประมูล! ' + formatCurrency(x.ourBid), 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.lost-btn').forEach(b => b.addEventListener('click', async () => {
      const x = bids.find(z => z.id === b.dataset.id)
      if (!x) return
      try {
        await updateDocData('gov_bids', x.id, { status: 'lost' })
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
        async onConfirm() {
          const project = document.getElementById('gb-project')?.value?.trim()
          if (!project) { showToast('❗ กรอกชื่อโครงการ', 'error'); return false }
          try {
            await createDoc('gov_bids', {
              project,
              budget: parseInt(document.getElementById('gb-budget')?.value) || 0,
              deadline: document.getElementById('gb-deadline')?.value || addDays(30),
              status: 'watching',
              docs: [false,false,false,false,false,false],
              ourBid: 0, note: ''
            })
            showToast('✅ เพิ่มงานประมูลแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
