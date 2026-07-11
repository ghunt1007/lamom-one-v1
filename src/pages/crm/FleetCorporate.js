/**
 * Fleet & Corporate Sales — ดีลใหญ่หลายคัน เงื่อนไขพิเศษ
 * Route: /crm/fleet
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ST = {
  prospect: { label: 'Prospect', color: 'var(--text-muted)' },
  proposal: { label: 'ส่ง Proposal', color: 'var(--primary)' },
  negotiation: { label: 'เจรจา', color: 'var(--warning)' },
  won:  { label: 'ปิดดีล ✅', color: 'var(--success)' },
  lost: { label: 'เสียดีล', color: 'var(--danger)' },
}

function dealValue(d) { return d.units * d.unitPrice * (1 - d.discount / 100) }
function discountAmt(d) { return d.units * d.unitPrice * (d.discount / 100) }

export default async function FleetCorporatePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let DEALS = []
  let loading = true

  async function loadData() {
    loading = true
    try { DEALS = await listDocs('fleet_deals', [], 'delivery', 'asc', 100) } catch (e) { DEALS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const pipeline = DEALS.filter(d => !['won','lost'].includes(d.status))
    const pipelineValue = pipeline.reduce((s, d) => s + dealValue(d), 0)
    const wonValue = DEALS.filter(d => d.status === 'won').reduce((s, d) => s + dealValue(d), 0)
    const totalUnits = DEALS.filter(d => d.status === 'won').reduce((s, d) => s + d.units, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏢 Fleet & Corporate Sales</div>
            <div class="page-subtitle">ดีลองค์กร/หน่วยงาน · บริหารราคาพิเศษ เงื่อนไขพิเศษ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-btn">➕ สร้างดีล Fleet</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🔄 Pipeline (ดีลระหว่างทาง)', pipeline.length, 'var(--primary)')}
          ${sc('💼 มูลค่า Pipeline', formatCurrency(pipelineValue), 'var(--primary)')}
          ${sc('🏆 ปิดแล้ว', formatCurrency(wonValue), 'var(--success)')}
          ${sc('🚗 คันที่ส่งแล้ว', totalUnits + ' คัน', 'var(--success)')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${DEALS.map(d => dealCard(d)).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.move-btn').forEach(b => b.addEventListener('click', () => moveStage(b.dataset.id)))
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => viewDeal(b.dataset.id)))
    document.getElementById('add-btn')?.addEventListener('click', openAdd)
  }

  function dealCard(d) {
    const s = ST[d.status]; const val = dealValue(d); const disc = discountAmt(d)
    const nextStage = { prospect: 'proposal', proposal: 'negotiation', negotiation: 'won' }[d.status]
    return `
      <div class="card" style="padding:14px;border-left:4px solid ${s.color}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${escHtml(d.company)}
              <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:1px 8px;border-radius:10px;margin-left:6px">${s.label}</span>
            </div>
            <div style="font-size:0.74rem;color:var(--text-muted)">${escHtml(d.contact)} · ${escHtml(d.phone)} · Sales: ${escHtml(d.sales)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.1rem;font-weight:900;color:var(--primary)">${formatCurrency(val)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">${d.units} คัน × ${formatCurrency(d.unitPrice)} ลด ${d.discount}%</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:180px;background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm);font-size:0.76rem">
            🚗 <strong>${escHtml(d.model)}</strong> × ${d.units} คัน<br>
            💰 ส่วนลดรวม ${formatCurrency(disc)}<br>
            ${d.delivery ? `📅 ส่งมอบ ${formatDate(d.delivery)}` : '📅 ยังไม่กำหนดวันส่ง'}
          </div>
          ${d.notes ? `<div style="flex:1;min-width:180px;background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm);font-size:0.74rem;color:var(--text-muted)">💬 ${escHtml(d.notes)}</div>` : ''}
        </div>

        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-xs btn-secondary view-btn" data-id="${d.id}">📋 รายละเอียด</button>
          ${nextStage ? `<button class="btn btn-xs btn-primary move-btn" data-id="${d.id}">➡ ${ST[nextStage].label}</button>` : ''}
          ${d.status === 'negotiation' ? `<button class="btn btn-xs btn-secondary" style="color:var(--danger)" onclick="(function(){})()">❌ เสียดีล</button>` : ''}
        </div>
      </div>`
  }

  async function moveStage(id) {
    const d = DEALS.find(x => x.id === id)
    const next = { prospect: 'proposal', proposal: 'negotiation', negotiation: 'won' }[d.status]
    if (!next) return
    try {
      await updateDocData('fleet_deals', d.id, { status: next })
      showToast(`ดีล ${d.id} (${d.company}) → ${ST[next].label}`, 'success')
      await loadData()
    } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
  }

  function viewDeal(id) {
    const d = DEALS.find(x => x.id === id)
    openModal({
      title: '📋 ' + d.id + ' · ' + escHtml(d.company),
      size: 'sm',
      body: `<div style="display:grid;gap:8px;font-size:0.8rem">
        <div><span style="color:var(--text-muted)">รุ่นรถ:</span> <strong>${escHtml(d.model)}</strong> × <strong>${d.units} คัน</strong></div>
        <div><span style="color:var(--text-muted)">ราคาต่อคัน:</span> ${formatCurrency(d.unitPrice)}</div>
        <div><span style="color:var(--text-muted)">ส่วนลด:</span> ${d.discount}% (${formatCurrency(discountAmt(d))})</div>
        <div><span style="color:var(--text-muted)">มูลค่าดีล:</span> <strong style="color:var(--primary)">${formatCurrency(dealValue(d))}</strong></div>
        ${d.delivery ? `<div><span style="color:var(--text-muted)">ส่งมอบ:</span> ${formatDate(d.delivery)}</div>` : ''}
        <div><span style="color:var(--text-muted)">Sales:</span> ${escHtml(d.sales)}</div>
        ${d.notes ? `<div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm);color:var(--text-muted)">💬 ${escHtml(d.notes)}</div>` : ''}
      </div>`,
      confirmText: '📄 ส่ง Quotation',
      async onConfirm() {
        try {
          if (d.status === 'prospect') await updateDocData('fleet_deals', d.id, { status: 'proposal' })
          showToast(`📄 ส่ง Fleet Quotation ให้ ${d.company} แล้ว · สถานะ → ส่ง Proposal`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openAdd() {
    openModal({
      title: '➕ สร้างดีล Fleet',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อบริษัท/หน่วยงาน *</label><input class="input" id="fl-co"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">ผู้ติดต่อ</label><input class="input" id="fl-contact"></div>
          <div class="input-group" style="flex:1"><label class="input-label">เบอร์โทร</label><input class="input" id="fl-phone"></div>
        </div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">รุ่นรถ *</label><input class="input" id="fl-model"></div>
          <div class="input-group" style="width:70px"><label class="input-label">จำนวน</label><input class="input" type="number" id="fl-units" value="1"></div>
        </div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">ราคา/คัน</label><input class="input" type="number" id="fl-price"></div>
          <div class="input-group" style="width:80px"><label class="input-label">ลด (%)</label><input class="input" type="number" id="fl-disc" value="3"></div>
        </div>
      </div>`,
      confirmText: '💾 สร้างดีล',
      async onConfirm() {
        const company = document.getElementById('fl-co').value.trim()
        const model = document.getElementById('fl-model').value.trim()
        const units = parseInt(document.getElementById('fl-units').value) || 1
        const unitPrice = parseInt(document.getElementById('fl-price').value) || 0
        if (!company || !model) { showToast('❗ กรอกข้อมูลที่จำเป็น', 'error'); return false }
        try {
          await createDoc('fleet_deals', { company, contact: document.getElementById('fl-contact').value.trim(), phone: document.getElementById('fl-phone').value.trim(),
            units, model, unitPrice, discount: parseFloat(document.getElementById('fl-disc').value) || 0,
            status: 'prospect', delivery: '', sales: 'ทีมขาย', notes: '' })
          showToast(`สร้างดีล Fleet (${company} · ${units} คัน) แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
