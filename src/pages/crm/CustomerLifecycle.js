/**
 * Customer Lifecycle — วงจรชีวิตลูกค้า
 * Route: /crm/lifecycle
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }
function addMonths(n) { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0,10) }

const LIFECYCLE_STAGES = {
  prospect:    { label: 'Prospect', color: 'secondary', icon: '🔍', desc: 'ยังไม่เคยซื้อ' },
  first_buyer: { label: 'ลูกค้าใหม่', color: 'primary', icon: '🌟', desc: 'ซื้อครั้งแรก' },
  repeat:      { label: 'ลูกค้าประจำ', color: 'success', icon: '💚', desc: 'ซื้อซ้ำ 2+ ครั้ง' },
  champion:    { label: 'Champion', color: 'warning', icon: '👑', desc: 'ยอดสูง + แนะนำ' },
  at_risk:     { label: 'At Risk', color: 'danger', icon: '⚠️', desc: 'ไม่ได้ติดต่อ 6+ เดือน' },
  churned:     { label: 'หลุดแล้ว', color: 'secondary', icon: '💔', desc: 'ไม่กลับมา' },
}

const DEMO_CUSTOMERS = [
  { id: 'C001', name: 'สมชาย ใจดี', stage: 'champion', purchases: 3, totalValue: 5196000, lastContact: addDays(-15), nextAction: 'เสนอรุ่นใหม่', model: 'BYD Seal', referrals: 2 },
  { id: 'C002', name: 'มาลี สุขใจ', stage: 'repeat', purchases: 2, totalValue: 2598000, lastContact: addDays(-30), nextAction: 'ต่ออายุประกัน', model: 'BYD Dolphin', referrals: 0 },
  { id: 'C003', name: 'ธนพล เที่ยงตรง', stage: 'first_buyer', purchases: 1, totalValue: 1299000, lastContact: addDays(-7), nextAction: 'เช็คความพอใจ', model: 'MG ZS EV', referrals: 0 },
  { id: 'C004', name: 'อรทัย ตั้งใจ', stage: 'at_risk', purchases: 1, totalValue: 1599000, lastContact: addDays(-180), nextAction: 'โทรหาด่วน!', model: 'BYD Atto 3', referrals: 0 },
  { id: 'C005', name: 'วิรัช เก่งมาก', stage: 'prospect', purchases: 0, totalValue: 0, lastContact: addDays(-3), nextAction: 'ส่งใบเสนอราคา', model: '—', referrals: 0 },
  { id: 'C006', name: 'ชาตรี เข้มแข็ง', stage: 'churned', purchases: 1, totalValue: 799000, lastContact: addDays(-365), nextAction: 'Win-back campaign', model: 'MG ZS EV', referrals: 0 },
]

const FUNNEL = [
  { stage: 'prospect', count: 48 },
  { stage: 'first_buyer', count: 22 },
  { stage: 'repeat', count: 15 },
  { stage: 'champion', count: 6 },
  { stage: 'at_risk', count: 9 },
  { stage: 'churned', count: 14 },
]

export default async function CustomerLifecyclePage(container) {
  const myGen = container.__routerGen
  let customers = DEMO_CUSTOMERS.map(c => ({ ...c }))
  let stageFilter = 'all'
  let dataSource = 'demo'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const byName = {}
      const today = Date.now()
      for (const s of sales) {
        const name = s.customerName || s.custName || ''
        if (!name) continue
        if (!byName[name]) byName[name] = { purchases: 0, totalValue: 0, lastDate: '', model: '' }
        byName[name].purchases++
        byName[name].totalValue += s.salePrice || 0
        const d = s.deliveryDate || s.bookingDate || ''
        if (d > byName[name].lastDate) { byName[name].lastDate = d; byName[name].model = s.model || '' }
      }
      const live = Object.entries(byName).map(([name, d], i) => {
        const daysSince = d.lastDate ? Math.floor((today - new Date(d.lastDate).getTime()) / 86400000) : 999
        const stage = d.purchases >= 3 ? 'champion' : d.purchases >= 2 ? 'repeat' : daysSince > 180 ? 'at_risk' : 'first_buyer'
        return {
          id: `LV${i+1}`, name, stage, purchases: d.purchases, totalValue: d.totalValue,
          lastContact: d.lastDate, nextAction: stage === 'at_risk' ? 'โทรหาด่วน!' : 'ติดตาม',
          model: d.model, referrals: 0,
        }
      })
      customers = [...live, ...DEMO_CUSTOMERS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = customers.filter(c => stageFilter === 'all' || c.stage === stageFilter)
    const totalValue = customers.reduce((a, c) => a + c.totalValue, 0)
    const atRisk = customers.filter(c => c.stage === 'at_risk').length
    const champions = customers.filter(c => c.stage === 'champion').length
    const maxFunnelCount = Math.max(...FUNNEL.map(f => f.count))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔄 Customer Lifecycle</div>
            <div class="page-subtitle">วงจรชีวิตลูกค้า — ติดตามและพัฒนาความสัมพันธ์${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-action-btn">+ Action Plan</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าทั้งหมด', customers.length + ' ราย', 'primary')}
          ${kpi('👑 Champion', champions, 'warning')}
          ${kpi('⚠️ At Risk', atRisk, atRisk > 0 ? 'danger' : 'secondary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'success')}
        </div>

        <!-- Funnel visualization -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🔄 Lifecycle Funnel</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${FUNNEL.map(f => {
              const ls = LIFECYCLE_STAGES[f.stage]
              const pct = Math.round(f.count / maxFunnelCount * 100)
              return `<div style="display:flex;align-items:center;gap:10px">
                <div style="width:120px;font-size:0.75rem;text-align:right">${ls?.icon} ${ls?.label}</div>
                <div style="flex:1;background:var(--surface-2);border-radius:4px;height:20px;position:relative">
                  <div style="width:${pct}%;background:var(--${ls?.color});height:20px;border-radius:4px;display:flex;align-items:center;padding-left:8px">
                    <span style="font-size:0.68rem;font-weight:700;color:white">${f.count} ราย</span>
                  </div>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Stage filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${stageFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(LIFECYCLE_STAGES).map(([k,v]) => `<button class="btn btn-xs ${stageFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Customer list -->
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">ลูกค้า</th>
                <th style="padding:8px 10px">Stage</th>
                <th style="padding:8px 10px;text-align:right">ซื้อ</th>
                <th style="padding:8px 10px;text-align:right">มูลค่า</th>
                <th style="padding:8px 10px">ติดต่อล่าสุด</th>
                <th style="padding:8px 14px">Action ต่อไป</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(c => {
                const ls = LIFECYCLE_STAGES[c.stage]
                const isAtRisk = c.stage === 'at_risk'
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${isAtRisk?';background:var(--danger)11':''}">
                  <td style="padding:8px 14px">
                    <div style="font-weight:600">${escHtml(c.name)}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">🚗 ${escHtml(c.model)}${c.referrals>0?' · 🤝 '+c.referrals+' referral':''}</div>
                  </td>
                  <td style="padding:8px 10px;text-align:center"><span class="badge badge-${ls?.color}" style="font-size:0.6rem">${ls?.icon} ${ls?.label}</span></td>
                  <td style="padding:8px 10px;text-align:right">${c.purchases} ครั้ง</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700">${c.totalValue>0?formatCurrency(c.totalValue):'—'}</td>
                  <td style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted)">${timeAgo(c.lastContact)}</td>
                  <td style="padding:8px 14px;font-size:0.75rem">${escHtml(c.nextAction)}</td>
                  <td style="padding:8px 14px"><button class="btn btn-xs btn-secondary action-btn" data-id="${c.id}">✏️</button></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { stageFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-action-btn')?.addEventListener('click', openAddActionModal)
    container.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', () => {
      const c = customers.find(x => x.id === b.dataset.id); if (c) openUpdateStage(c)
    }))
  }

  function openAddActionModal() {
    const today = new Date().toISOString().slice(0,10)
    openModal({
      title: '+ สร้าง Action Plan',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ลูกค้า *</label>
            <select id="ap-cust" class="input">
              ${customers.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)} — ${LIFECYCLE_STAGES[c.stage]?.icon} ${LIFECYCLE_STAGES[c.stage]?.label}</option>`).join('')}
            </select>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">Action ที่จะทำ *</label>
            <input id="ap-action" class="input" placeholder="โทรหา / ส่งใบเสนอราคา / นัดทดลองขับ..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Stage ใหม่</label>
              <select id="ap-stage" class="input">
                ${Object.entries(LIFECYCLE_STAGES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันที่ดำเนินการ</label>
              <input id="ap-date" type="date" class="input" value="${today}"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">หมายเหตุ</label>
            <textarea id="ap-note" class="input" rows="2" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="ap-save">✅ บันทึก Action Plan</button>
        </div>
      `
    })
    document.getElementById('ap-save')?.addEventListener('click', () => {
      const custId = document.getElementById('ap-cust')?.value
      const action = document.getElementById('ap-action')?.value.trim()
      if (!action) { showToast('⚠️ กรุณากรอก Action', 'warning'); return }
      const cust = customers.find(c => c.id === custId)
      if (cust) {
        cust.nextAction = action
        cust.stage = document.getElementById('ap-stage')?.value || cust.stage
        cust.lastContact = document.getElementById('ap-date')?.value || addDays(0)
      }
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ บันทึก Action Plan สำหรับ ' + (cust?.name || '') + ' แล้ว', 'success')
      renderPage()
    })
  }

  function openUpdateStage(customer) {
    openModal({
      title: '✏️ อัปเดต Stage',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div><strong>${escHtml(customer.name)}</strong></div>
        <div class="input-group"><label class="input-label">Stage ใหม่</label>
          <select class="input" id="new-stage">
            ${Object.entries(LIFECYCLE_STAGES).map(([k,v]) => `<option value="${k}" ${customer.stage===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group"><label class="input-label">Action ต่อไป</label><input class="input" id="new-action" value="${escHtml(customer.nextAction)}"></div>
      </div>`,
      onConfirm() {
        customer.stage = document.getElementById('new-stage')?.value || customer.stage
        customer.nextAction = document.getElementById('new-action')?.value || customer.nextAction
        customer.lastContact = addDays(0)
        showToast('✅ อัปเดต Stage แล้ว', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
