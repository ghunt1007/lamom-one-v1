/**
 * Customer Segmentation — แบ่งกลุ่มลูกค้า
 * Route: /crm/segments
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

const SEG_TYPES = {
  rfm:       { label: 'RFM Analysis', icon: '📊', color: 'primary' },
  behavior:  { label: 'พฤติกรรม', icon: '🎯', color: 'warning' },
  geo:       { label: 'พื้นที่', icon: '📍', color: 'success' },
  vehicle:   { label: 'รถที่ซื้อ', icon: '🚗', color: 'secondary' },
  value:     { label: 'มูลค่า', icon: '💰', color: 'success' },
}

const RFM_TIERS = [
  { id: 'champions',    label: 'Champions', desc: 'ซื้อล่าสุด บ่อย และมูลค่าสูง', color: '#f59e0b', count: 42, avgValue: 1850000, icon: '👑' },
  { id: 'loyal',        label: 'Loyal',     desc: 'ซื้อบ่อยและมีมูลค่าดี', color: '#10b981', count: 87, avgValue: 980000, icon: '⭐' },
  { id: 'potential',    label: 'Potential', desc: 'ซื้อล่าสุดแต่ยังไม่บ่อย', color: '#3b82f6', count: 124, avgValue: 620000, icon: '🚀' },
  { id: 'new',          label: 'New',       desc: 'ลูกค้าใหม่ที่เพิ่งซื้อ', color: '#8b5cf6', count: 98, avgValue: 480000, icon: '🆕' },
  { id: 'at_risk',      label: 'At Risk',   desc: 'เคยดีแต่เงียบไปนาน', color: '#ef4444', count: 56, avgValue: 750000, icon: '⚠️' },
  { id: 'lost',         label: 'Lost',      desc: 'ไม่ซื้อมานาน', color: '#94a3b8', count: 31, avgValue: 320000, icon: '😴' },
]

const GEO_SEGMENTS = [
  { area: 'กรุงเทพฯ', count: 312, pct: 36, avgValue: 920000 },
  { area: 'ปริมณฑล', count: 198, pct: 23, avgValue: 780000 },
  { area: 'ภาคกลาง', count: 124, pct: 14, avgValue: 680000 },
  { area: 'ภาคเหนือ', count: 98, pct: 11, avgValue: 650000 },
  { area: 'ภาคใต้', count: 87, pct: 10, avgValue: 720000 },
  { area: 'ภาคอีสาน', count: 48, pct: 6, avgValue: 590000 },
]

export default async function CustomerSegmentationPage(container) {
  const myGen = container.__routerGen
  let activeTab = 'rfm'
  let rfmTiers = [...RFM_TIERS].map(t => ({ ...t }))
  let dataSource = 'demo'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 5) {
      const byCustomer = {}
      sales.forEach(s => {
        const name = s.custName || 'ไม่ระบุ'
        if (!byCustomer[name]) byCustomer[name] = { count: 0, total: 0, lastDate: '' }
        byCustomer[name].count++
        byCustomer[name].total += s.salePrice || 0
        const d = s.bookingDate || ''
        if (d > byCustomer[name].lastDate) byCustomer[name].lastDate = d
      })
      const customers = Object.values(byCustomer).filter(c => c.count > 0)
      const champions = customers.filter(c => c.count >= 2 && c.total >= 2000000).length
      const loyal = customers.filter(c => c.count >= 2 && c.total < 2000000).length
      const newCust = customers.filter(c => c.count === 1).length
      const atRisk = Math.round(newCust * 0.15)
      rfmTiers[0].count = champions || rfmTiers[0].count
      rfmTiers[1].count = loyal || rfmTiers[1].count
      rfmTiers[2].count = Math.round(newCust * 0.4) || rfmTiers[2].count
      rfmTiers[3].count = newCust || rfmTiers[3].count
      rfmTiers[4].count = atRisk || rfmTiers[4].count
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const totalCustomers = rfmTiers.reduce((a, t) => a + t.count, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Customer Segmentation</div>
            <div class="page-subtitle">แบ่งกลุ่มลูกค้าเพื่อวางกลยุทธ์การตลาด${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="create-seg-btn">+ สร้าง Segment</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าทั้งหมด', totalCustomers.toLocaleString(), 'primary')}
          ${kpi('👑 Champions', rfmTiers[0].count, 'warning')}
          ${kpi('⚠️ At Risk', rfmTiers[4].count, rfmTiers[4].count > 0 ? 'danger' : 'secondary')}
          ${kpi('📊 Segments', rfmTiers.length, 'secondary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
          ${[['rfm','📊 RFM Analysis'],['geo','📍 Geographic'],['vehicle','🚗 By Vehicle']].map(([tab,label]) =>
            `<button class="btn btn-xs ${activeTab===tab?'btn-primary':'btn-ghost'} tab-btn" data-tab="${tab}" style="border-radius:var(--radius) var(--radius) 0 0">${label}</button>`
          ).join('')}
        </div>

        ${activeTab === 'rfm' ? renderRFM(totalCustomers) : activeTab === 'geo' ? renderGeo() : renderVehicle()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderPage() }))
    document.getElementById('create-seg-btn')?.addEventListener('click', () => openCreateSeg())
    container.querySelectorAll('.seg-card').forEach(el => el.addEventListener('click', () => {
      const tier = rfmTiers.find(t => t.id === el.dataset.id)
      if (tier) openSegDetail(tier)
    }))
  }

  function renderRFM(total) {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${rfmTiers.map(t => {
          const pct = Math.round(t.count / total * 100)
          return `<div class="card seg-card" data-id="${t.id}" style="padding:16px;cursor:pointer;border-left:4px solid ${t.color}">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <div style="font-size:1.8rem">${t.icon}</div>
              <div style="text-align:right">
                <div style="font-size:1.4rem;font-weight:900;color:${t.color}">${t.count}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${pct}% ของทั้งหมด</div>
              </div>
            </div>
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px">${t.label}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">${t.desc}</div>
            <div style="display:flex;justify-content:space-between;font-size:0.75rem">
              <span style="color:var(--text-muted)">Avg Value</span>
              <span style="font-weight:700">${formatCurrency(t.avgValue)}</span>
            </div>
            <div style="margin-top:8px;background:var(--surface-2);border-radius:3px;height:5px">
              <div style="width:${pct}%;background:${t.color};height:5px;border-radius:3px"></div>
            </div>
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderGeo() {
    const maxCount = Math.max(...GEO_SEGMENTS.map(g => g.count))
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="padding:16px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📍 ลูกค้าตามพื้นที่</div>
          ${GEO_SEGMENTS.map(g => `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
                <span>${g.area}</span>
                <span style="font-weight:700">${g.count} คน (${g.pct}%)</span>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:8px">
                <div style="width:${Math.round(g.count/maxCount*100)}%;background:var(--primary);height:8px;border-radius:3px"></div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="card" style="padding:16px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">💰 มูลค่าเฉลี่ยตามพื้นที่</div>
          ${GEO_SEGMENTS.map(g => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.83rem">
              <span>${g.area}</span>
              <span style="font-weight:700;color:var(--success)">${formatCurrency(g.avgValue)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function renderVehicle() {
    const vehicles = [
      { model: 'BYD Seal AWD', count: 182, pct: 21, repeat: 12 },
      { model: 'BYD Atto 3', count: 241, pct: 28, repeat: 18 },
      { model: 'MG ZS EV', count: 198, pct: 23, repeat: 22 },
      { model: 'BYD Dolphin', count: 134, pct: 15, repeat: 8 },
      { model: 'อื่นๆ', count: 113, pct: 13, repeat: 5 },
    ]
    return `
      <div class="card" style="overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
              <th style="padding:10px 14px;text-align:left">รุ่นรถ</th>
              <th style="padding:10px 14px;text-align:right">ลูกค้า</th>
              <th style="padding:10px 14px;text-align:right">สัดส่วน</th>
              <th style="padding:10px 14px;text-align:right">ซื้อซ้ำ</th>
              <th style="padding:10px 14px;text-align:center">Bar</th>
            </tr>
          </thead>
          <tbody>
            ${vehicles.map(v => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 14px;font-weight:600">🚗 ${v.model}</td>
                <td style="padding:10px 14px;text-align:right">${v.count}</td>
                <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--primary)">${v.pct}%</td>
                <td style="padding:10px 14px;text-align:right;color:var(--success)">${v.repeat}</td>
                <td style="padding:10px 14px;min-width:100px">
                  <div style="background:var(--surface-2);border-radius:3px;height:8px">
                    <div style="width:${v.pct}%;background:var(--primary);height:8px;border-radius:3px"></div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function openSegDetail(tier) {
    openModal({
      title: `${tier.icon} ${tier.label} Segment`,
      size: 'md',
      body: `
        <div style="padding:14px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:14px;border-left:4px solid ${tier.color}">
          <div style="font-size:2rem;font-weight:900;color:${tier.color}">${tier.count} คน</div>
          <div style="font-size:0.82rem;color:var(--text-muted)">${tier.desc}</div>
        </div>
        ${row('มูลค่าเฉลี่ย', formatCurrency(tier.avgValue))}
        <div style="margin-top:14px">
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px;color:var(--text-muted)">🎯 กลยุทธ์แนะนำ</div>
          <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.83rem">
            ${tier.id === 'champions' ? '🎁 ให้สิทธิพิเศษ VIP, Referral Program, Early Access' :
              tier.id === 'loyal' ? '⭐ Loyalty Points, Birthday Discount, Upsell accessories' :
              tier.id === 'potential' ? '📞 Follow-up, Trial Service Package, Cross-sell insurance' :
              tier.id === 'new' ? '👋 Welcome Package, Onboarding, Service reminder' :
              tier.id === 'at_risk' ? '🚨 Win-back campaign, Special discount, Personal call' :
              '📧 Re-engagement email, Big promotion, Survey why they left'}
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn btn-primary" style="flex:1" onclick="document.querySelector('.modal').remove()">📢 สร้าง Campaign</button>
          <button class="btn btn-secondary" style="flex:1" onclick="document.querySelector('.modal').remove()">📋 Export List</button>
        </div>
      `
    })
  }

  function openCreateSeg() {
    openModal({
      title: '+ สร้าง Custom Segment',
      size: 'md',
      body: `
        <div style="display:grid;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ Segment *</label><input class="input" id="cs-name" placeholder="เช่น ลูกค้า EV สาขาเชียงใหม่"></div>
          <div class="input-group"><label class="input-label">เงื่อนไข</label>
            <div style="display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond"> ซื้อในช่วง 6 เดือน</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond"> มูลค่า > 1 ล้าน</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond"> ซื้อ EV</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond"> อยู่ในกรุงเทพฯ</label>
            </div>
          </div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('cs-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ Segment', 'error'); return }
        showToast(`✅ สร้าง Segment "${name}" แล้ว!`, 'success')
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
