/**
 * Fleet & Corporate Sales — ดีลใหญ่หลายคัน เงื่อนไขพิเศษ
 * Route: /crm/fleet
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

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

const DEMO_FLEET_DEALS = [
  { id: 'FL-001', company: 'บ.รุ่งเรือง จำกัด', contact: 'คุณสมชาย', phone: '089-111-2222', units: 5, model: 'BYD Atto 3 Pro', unitPrice: 1299000, discount: 3, status: 'negotiation', delivery: '2026-09-30', sales: 'นิภา', notes: 'ต้องการสีดำทั้งหมด ผ่อนบริษัท 60 งวด' },
  { id: 'FL-002', company: 'โรงพยาบาลสุขใจ', contact: 'คุณวิไล', phone: '02-222-3333', units: 3, model: 'BYD Seal', unitPrice: 1550000, discount: 2.5, status: 'proposal', delivery: '2026-10-15', sales: 'วิชัย', notes: 'รถผู้บริหาร สีขาว' },
  { id: 'FL-003', company: 'บ.สร้างดี จำกัด', contact: 'คุณอนุชา', phone: '081-333-4444', units: 10, model: 'BYD Dolphin', unitPrice: 899000, discount: 5, status: 'won', delivery: '2026-07-01', sales: 'สมชาย', notes: 'แล้วเสร็จ ส่งมอบ Q3' },
  { id: 'FL-004', company: 'หน่วยงานราชการ ก.', contact: 'คุณประเสริฐ', phone: '02-444-5555', units: 8, model: 'BYD Atto 3', unitPrice: 1099000, discount: 4, status: 'prospect', delivery: '', sales: 'มาลี', notes: 'งบประมาณปี 2027 รอกระบวนการจัดซื้อ' },
]

function dealValue(d) { return d.units * d.unitPrice * (1 - d.discount / 100) }
function discountAmt(d) { return d.units * d.unitPrice * (d.discount / 100) }

export default async function FleetCorporatePage(container) {
  const myGen = container.__routerGen
  let DEALS = DEMO_FLEET_DEALS.map(d => ({ ...d }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('fleet_deals', [], 'delivery', 'asc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `FL-${String(i+1).padStart(3,'0')}`,
        company: d.company || d.companyName || 'บริษัท',
        contact: d.contact || d.contactName || '',
        phone: d.phone || '',
        units: d.units || d.quantity || 1,
        model: d.model || d.vehicleModel || '',
        unitPrice: d.unitPrice || d.price || 0,
        discount: d.discount || 0,
        status: d.status || 'prospect',
        delivery: d.delivery || d.deliveryDate || '',
        sales: d.sales || d.salesName || '',
        notes: d.notes || '',
      }))
      DEALS = [...mapped, ...DEMO_FLEET_DEALS]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const pipeline = DEALS.filter(d => !['won','lost'].includes(d.status))
    const pipelineValue = pipeline.reduce((s, d) => s + dealValue(d), 0)
    const wonValue = DEALS.filter(d => d.status === 'won').reduce((s, d) => s + dealValue(d), 0)
    const totalUnits = DEALS.filter(d => d.status === 'won').reduce((s, d) => s + d.units, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏢 Fleet & Corporate Sales</div>
            <div class="page-subtitle">ดีลองค์กร/หน่วยงาน · บริหารราคาพิเศษ เงื่อนไขพิเศษ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
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

  function moveStage(id) {
    const d = DEALS.find(x => x.id === id)
    const next = { prospect: 'proposal', proposal: 'negotiation', negotiation: 'won' }[d.status]
    if (!next) return
    d.status = next
    showToast(`ดีล ${d.id} (${d.company}) → ${ST[next].label}`, 'success')
    render()
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
      onConfirm() {
        if (d.status === 'prospect') d.status = 'proposal'
        render()
        showToast(`📄 ส่ง Fleet Quotation ให้ ${d.company} แล้ว · สถานะ → ส่ง Proposal`, 'success')
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
      onConfirm() {
        const company = document.getElementById('fl-co').value.trim()
        const model = document.getElementById('fl-model').value.trim()
        const units = parseInt(document.getElementById('fl-units').value) || 1
        const unitPrice = parseInt(document.getElementById('fl-price').value) || 0
        if (!company || !model) { showToast('❗ กรอกข้อมูลที่จำเป็น', 'error'); return false }
        const id = 'FL-' + String(DEALS.length + 1).padStart(3,'0')
        DEALS.unshift({ id, company, contact: document.getElementById('fl-contact').value.trim(), phone: document.getElementById('fl-phone').value.trim(),
          units, model, unitPrice, discount: parseFloat(document.getElementById('fl-disc').value) || 0,
          status: 'prospect', delivery: '', sales: 'ทีมขาย', notes: '' })
        showToast(`สร้างดีล Fleet ${id} (${company} · ${units} คัน) แล้ว`, 'success')
        render()
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
