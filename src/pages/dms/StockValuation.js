import { formatCurrency, formatDate } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const BRANDS = ['BYD','MG','Neta','ORA','AION','GWM','Chery']
const STATUS_MAP = {
  available: { label: 'พร้อมขาย', color: 'success' },
  reserved:  { label: 'จอง', color: 'warning' },
  transit:   { label: 'ระหว่างขนส่ง', color: 'accent' },
  hold:      { label: 'Hold', color: 'secondary' },
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const DEMO_STOCK = [
  { id: 'ST001', brand: 'BYD', model: 'Seal', variant: 'Standard Range', color: 'ขาว Glacier White', vin: 'LBWAB2EB7PD001001', cost: 1050000, listPrice: 1199000, status: 'available', stockDate: daysAgo(45), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST002', brand: 'BYD', model: 'Seal', variant: 'AWD', color: 'ดำ Cosmos Black', vin: 'LBWAB2EB7PD001002', cost: 1270000, listPrice: 1449000, status: 'reserved', stockDate: daysAgo(30), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST003', brand: 'BYD', model: 'Atto 3', variant: 'Standard', color: 'ฟ้า Sky Blue', vin: 'LBWAB2EB7PD001003', cost: 870000, listPrice: 999000, status: 'available', stockDate: daysAgo(60), branch: 'สาขาชลบุรี' },
  { id: 'ST004', brand: 'BYD', model: 'Atto 3', variant: 'Extended', color: 'แดง Coral Red', vin: 'LBWAB2EB7PD001004', cost: 980000, listPrice: 1099000, status: 'available', stockDate: daysAgo(22), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST005', brand: 'BYD', model: 'Dolphin', variant: 'Standard', color: 'ขาว', vin: 'LBWAB2EB7PD001005', cost: 680000, listPrice: 799000, status: 'available', stockDate: daysAgo(15), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST006', brand: 'BYD', model: 'Dolphin', variant: 'Premium', color: 'เทา Graphite', vin: 'LBWAB2EB7PD001006', cost: 750000, listPrice: 869000, status: 'transit', stockDate: daysAgo(5), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST007', brand: 'MG', model: 'ZS EV', variant: 'Luxury', color: 'ขาว', vin: 'LSJWSRAR7NE001007', cost: 820000, listPrice: 949000, status: 'available', stockDate: daysAgo(90), branch: 'สาขาเชียงใหม่' },
  { id: 'ST008', brand: 'MG', model: 'ZS EV', variant: 'Grand Luxury', color: 'น้ำเงิน', vin: 'LSJWSRAR7NE001008', cost: 920000, listPrice: 1059000, status: 'hold', stockDate: daysAgo(75), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST009', brand: 'Neta', model: 'V', variant: 'Standard', color: 'ส้ม', vin: 'LNBSDBEB9PA001009', cost: 520000, listPrice: 619000, status: 'available', stockDate: daysAgo(40), branch: 'สาขาชลบุรี' },
  { id: 'ST010', brand: 'ORA', model: 'Good Cat', variant: 'Standard', color: 'เหลือง', vin: 'LGWEF4B31PB001010', cost: 650000, listPrice: 749000, status: 'available', stockDate: daysAgo(55), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST011', brand: 'BYD', model: 'Tang EV', variant: 'AWD', color: 'ดำ', vin: 'LBWAB2EB7PD001011', cost: 1750000, listPrice: 1999000, status: 'available', stockDate: daysAgo(20), branch: 'สำนักงานใหญ่ BKK' },
  { id: 'ST012', brand: 'GWM', model: 'ORA 03', variant: 'Standard', color: 'ชมพู', vin: 'LGWEF4B31PB001012', cost: 590000, listPrice: 679000, status: 'reserved', stockDate: daysAgo(10), branch: 'สาขาเชียงใหม่' },
]

export default async function StockValuationPage(container) {
  const myGen = container.__routerGen
  let brandFilter = 'all'
  let statusFilter = 'all'
  let branchFilter = 'all'
  let sortBy = 'daysInStock'
  let viewMode = 'table' // table | summary
  let stock = [...DEMO_STOCK]
  let dataSource = 'demo'

  try {
    const vehicles = await listDocs('vehicles', [], 'createdAt', 'desc', 500).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (vehicles.length >= 2) {
      const live = vehicles.map(v => ({
        id: v.id, vin: v.vin || '', plate: v.plate || '',
        brand: v.brand || '', model: v.model || '', year: v.year || new Date().getFullYear(),
        color: v.color || '', cost: v.cost || v.purchasePrice || 0,
        listPrice: v.listPrice || v.salePrice || v.cost || 0,
        status: v.status || 'available', branch: v.branch || v.location || 'สำนักงานใหญ่',
        stockDate: (v.stockDate || v.arrivedDate || v.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()).slice(0, 10),
        mileage: v.mileage || 0, notes: v.notes || '', _live: true,
      })).filter(v => v.brand || v.model)
      if (live.length) {
        stock = [...live, ...DEMO_STOCK]
        dataSource = 'live'
      }
    }
  } catch {}

  let branches = [...new Set(stock.map(s => s.branch))]

  function getAge(stockDate) {
    return Math.round((Date.now() - new Date(stockDate)) / 86400000)
  }

  function filtered() {
    return stock.filter(s => {
      if (brandFilter !== 'all' && s.brand !== brandFilter) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (branchFilter !== 'all' && s.branch !== branchFilter) return false
      return true
    }).sort((a, b) => {
      if (sortBy === 'daysInStock') return getAge(b.stockDate) - getAge(a.stockDate)
      if (sortBy === 'cost') return b.cost - a.cost
      if (sortBy === 'margin') return (b.listPrice - b.cost) - (a.listPrice - a.cost)
      return 0
    })
  }

  function renderPage() {
    const list = filtered()
    const totalCost = list.reduce((a, s) => a + s.cost, 0)
    const totalList = list.reduce((a, s) => a + s.listPrice, 0)
    const totalMargin = totalList - totalCost
    const avgAge = list.length ? Math.round(list.reduce((a, s) => a + getAge(s.stockDate), 0) / list.length) : 0
    const aged90 = list.filter(s => getAge(s.stockDate) >= 90).length

    // By brand summary
    const byBrand = {}
    stock.forEach(s => {
      if (!byBrand[s.brand]) byBrand[s.brand] = { count: 0, cost: 0, listPrice: 0 }
      byBrand[s.brand].count++
      byBrand[s.brand].cost += s.cost
      byBrand[s.brand].listPrice += s.listPrice
    })

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📦 Stock Valuation</div>
            <div class="page-subtitle">มูลค่าสินค้าคงคลัง — รถยนต์ในสต็อก${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm ${viewMode==='table'?'btn-primary':'btn-secondary'}" id="view-table">📋 ตาราง</button>
              <button class="btn btn-sm ${viewMode==='summary'?'btn-primary':'btn-secondary'}" id="view-sum">📊 สรุป</button>
            </div>
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
          ${kpi('🚗 คันทั้งหมด', list.length, 'primary')}
          ${kpi('💰 ทุนรวม', formatCurrency(totalCost), 'warning')}
          ${kpi('🏷 ราคาขายรวม', formatCurrency(totalList), 'success')}
          ${kpi('📈 Margin รวม', formatCurrency(totalMargin), 'success')}
          ${kpi('⏳ รถค้างสต็อก 90+วัน', aged90, aged90 > 0 ? 'danger' : 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
          <select class="input" id="brand-filter" style="width:120px">
            <option value="all">แบรนด์ทั้งหมด</option>
            ${[...new Set(DEMO_STOCK.map(s=>s.brand))].map(b => `<option value="${b}" ${brandFilter===b?'selected':''}>${b}</option>`).join('')}
          </select>
          <select class="input" id="status-filter" style="width:130px">
            <option value="all">สถานะทั้งหมด</option>
            ${Object.entries(STATUS_MAP).map(([k,v]) => `<option value="${k}" ${statusFilter===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
          <select class="input" id="branch-filter" style="width:180px">
            <option value="all">ทุกสาขา</option>
            ${branches.map(b => `<option value="${escHtml(b)}" ${branchFilter===b?'selected':''}>${escHtml(b)}</option>`).join('')}
          </select>
          <select class="input" id="sort-by" style="width:160px">
            <option value="daysInStock" ${sortBy==='daysInStock'?'selected':''}>เรียงตามวันในสต็อก</option>
            <option value="cost" ${sortBy==='cost'?'selected':''}>เรียงตามต้นทุน</option>
            <option value="margin" ${sortBy==='margin'?'selected':''}>เรียงตาม Margin</option>
          </select>
          <div style="margin-left:auto;font-size:0.82rem;color:var(--text-muted)">${list.length} คัน</div>
        </div>

        ${viewMode === 'table' ? renderTable(list) : renderSummary(byBrand, list)}
      </div>
    `

    document.getElementById('brand-filter')?.addEventListener('change', e => { brandFilter = e.target.value; renderPage() })
    document.getElementById('status-filter')?.addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    document.getElementById('branch-filter')?.addEventListener('change', e => { branchFilter = e.target.value; renderPage() })
    document.getElementById('sort-by')?.addEventListener('change', e => { sortBy = e.target.value; renderPage() })
    document.getElementById('view-table')?.addEventListener('click', () => { viewMode = 'table'; renderPage() })
    document.getElementById('view-sum')?.addEventListener('click', () => { viewMode = 'summary'; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(list.map(s => ({
        ID: s.id, แบรนด์: s.brand, รุ่น: s.model, Variant: s.variant, สี: s.color, VIN: s.vin,
        ต้นทุน: s.cost, ราคาขาย: s.listPrice, Margin: s.listPrice - s.cost, 'Margin%': (((s.listPrice - s.cost) / s.cost) * 100).toFixed(1) + '%',
        วันที่รับ: s.stockDate, วันในสต็อก: getAge(s.stockDate), สาขา: s.branch, สถานะ: STATUS_MAP[s.status]?.label
      })), 'stock_valuation')
      showToast('📥 Export แล้ว!', 'success')
    })
  }

  function renderTable(list) {
    return `
      <div class="card" style="padding:0;overflow:hidden;overflow-x:auto">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th><th>รถ</th><th>สี / VIN</th><th>สาขา</th>
              <th class="text-right">ต้นทุน</th><th class="text-right">ราคาขาย</th><th class="text-right">Margin</th><th class="text-right">%</th>
              <th>วันในสต็อก</th><th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(s => {
              const margin = s.listPrice - s.cost
              const marginPct = (margin / s.cost * 100).toFixed(1)
              const age = getAge(s.stockDate)
              const st = STATUS_MAP[s.status] || STATUS_MAP.available
              const ageColor = age >= 90 ? 'var(--danger)' : age >= 60 ? 'var(--warning)' : 'var(--text-muted)'
              return `<tr>
                <td style="font-family:monospace;font-size:0.78rem">${escHtml(s.id)}</td>
                <td>
                  <div style="font-weight:700;font-size:0.85rem">${escHtml(s.brand)} ${escHtml(s.model)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(s.variant)}</div>
                </td>
                <td>
                  <div style="font-size:0.82rem">${escHtml(s.color)}</div>
                  <div style="font-family:monospace;font-size:0.68rem;color:var(--text-muted)">${escHtml(s.vin)}</div>
                </td>
                <td style="font-size:0.8rem">${escHtml(s.branch)}</td>
                <td class="text-right" style="font-size:0.83rem">${formatCurrency(s.cost)}</td>
                <td class="text-right" style="font-size:0.83rem;font-weight:600">${formatCurrency(s.listPrice)}</td>
                <td class="text-right" style="font-size:0.83rem;color:var(--success);font-weight:600">${formatCurrency(margin)}</td>
                <td class="text-right" style="font-size:0.83rem;color:var(--success)">${marginPct}%</td>
                <td>
                  <div style="font-size:0.85rem;font-weight:700;color:${ageColor}">${age} วัน</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${formatDate(s.stockDate)}</div>
                </td>
                <td><span class="badge badge-${st.color}">${st.label}</span></td>
              </tr>`
            }).join('')}
            ${!list.length ? `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบข้อมูล</td></tr>` : ''}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface-2)">
              <td colspan="4" style="font-weight:700;padding:10px 12px">รวม ${list.length} คัน</td>
              <td class="text-right" style="font-weight:700;padding:10px 12px">${formatCurrency(list.reduce((a,s)=>a+s.cost,0))}</td>
              <td class="text-right" style="font-weight:700;padding:10px 12px">${formatCurrency(list.reduce((a,s)=>a+s.listPrice,0))}</td>
              <td class="text-right" style="font-weight:700;padding:10px 12px;color:var(--success)">${formatCurrency(list.reduce((a,s)=>a+(s.listPrice-s.cost),0))}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
  }

  function renderSummary(byBrand, list) {
    const maxCost = Math.max(...Object.values(byBrand).map(b => b.cost))
    // Age buckets
    const buckets = { '0-30 วัน': 0, '31-60 วัน': 0, '61-90 วัน': 0, '90+ วัน': 0 }
    list.forEach(s => {
      const age = getAge(s.stockDate)
      if (age <= 30) buckets['0-30 วัน']++
      else if (age <= 60) buckets['31-60 วัน']++
      else if (age <= 90) buckets['61-90 วัน']++
      else buckets['90+ วัน']++
    })
    const maxBucket = Math.max(...Object.values(buckets))

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- By Brand -->
        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:14px">📊 มูลค่าสต็อกตามแบรนด์</div>
          ${Object.entries(byBrand).map(([brand, data]) => {
            const pct = Math.round(data.cost / maxCost * 100)
            const margin = data.listPrice - data.cost
            return `<div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:0.83rem">
                <span style="font-weight:600">${escHtml(brand)} <span style="color:var(--text-muted);font-weight:400">(${data.count} คัน)</span></span>
                <span style="font-weight:700;color:var(--success)">${formatCurrency(data.cost)}</span>
              </div>
              <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:0.7rem;color:var(--text-muted)">
                <span>ราคาขาย ${formatCurrency(data.listPrice)}</span>
                <span>Margin ${formatCurrency(margin)}</span>
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Age Analysis -->
        <div>
          <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:14px">⏳ อายุสต็อก (Stock Age)</div>
            ${Object.entries(buckets).map(([label, count]) => {
              const pct = maxBucket ? Math.round(count / maxBucket * 100) : 0
              const isOld = label === '90+ วัน'
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
                  <span style="color:${isOld?'var(--danger)':''}">${label}</span>
                  <span style="font-weight:700;color:${isOld?'var(--danger)':'var(--text)'}">${count} คัน</span>
                </div>
                <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${isOld?'var(--danger)':'var(--primary)'};border-radius:4px"></div>
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- By Status -->
          <div class="card" style="padding:16px">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:12px">📋 สถานะสต็อก</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${Object.entries(STATUS_MAP).map(([k, v]) => {
                const cnt = DEMO_STOCK.filter(s => s.status === k).length
                const val = DEMO_STOCK.filter(s => s.status === k).reduce((a,s)=>a+s.cost,0)
                return `<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);border-left:3px solid var(--${v.color})">
                  <div style="font-size:0.72rem;color:var(--text-muted)">${v.label}</div>
                  <div style="font-weight:800;font-size:1.1rem;color:var(--${v.color})">${cnt}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${formatCurrency(val)}</div>
                </div>`
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
