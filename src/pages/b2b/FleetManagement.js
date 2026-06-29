/**
 * Fleet Management — ลูกค้าองค์กร / รถยนต์หมู่
 * Route: /b2b/fleet
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const FLEET_STATUS = {
  prospect: { label: 'Prospect', color: 'secondary' },
  active:   { label: 'Active', color: 'success' },
  inactive: { label: 'Inactive', color: 'secondary' },
}

const INDUSTRIES = ['ขนส่งและโลจิสติกส์','อสังหาริมทรัพย์','ก่อสร้าง','ค้าปลีก','ธนาคาร/การเงิน','ประกันภัย','โรงแรม/ท่องเที่ยว','การแพทย์/สุขภาพ','รัฐบาล/รัฐวิสาหกิจ','อื่นๆ']

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_FLEETS = [
  {
    id: 'FL001', company: 'บริษัท ABC โลจิสติกส์ จำกัด', industry: 'ขนส่งและโลจิสติกส์',
    contact: 'ธีรศักดิ์ มั่งคั่ง', phone: '02-xxx-xxxx', email: 'fleet@abc.co.th',
    status: 'active', fleetSize: 12, evCount: 5, targetFleet: 20,
    totalRevenue: 6850000, lastOrderDate: addDays(-45),
    vehicles: [
      { model: 'BYD Seal AWD', qty: 3, unitPrice: 1449000 },
      { model: 'BYD Atto 3', qty: 2, unitPrice: 1099000 },
    ],
    discount: 3, creditTerms: 30, salesperson: 'อรนุช สายใจ',
    notes: 'ลูกค้า VIP ต้องการเพิ่มกองรถ Q3 2025'
  },
  {
    id: 'FL002', company: 'บริษัท XYZ Properties จำกัด', industry: 'อสังหาริมทรัพย์',
    contact: 'สุรชาติ เจริญทรัพย์', phone: '02-yyy-yyyy', email: 'fleet@xyz.co.th',
    status: 'active', fleetSize: 8, evCount: 2, targetFleet: 15,
    totalRevenue: 2890000, lastOrderDate: addDays(-90),
    vehicles: [
      { model: 'MG ZS EV', qty: 2, unitPrice: 1059000 },
    ],
    discount: 2, creditTerms: 45, salesperson: 'วิชาญ มีโชค',
    notes: 'ต้องการ Wall Charger สำหรับที่จอดรถทุกคัน'
  },
  {
    id: 'FL003', company: 'โรงพยาบาล HealthPlus', industry: 'การแพทย์/สุขภาพ',
    contact: 'ดร.มาลี วิทยาการ', phone: '02-zzz-zzzz', email: 'fleet@healthplus.th',
    status: 'prospect', fleetSize: 0, evCount: 0, targetFleet: 10,
    totalRevenue: 0, lastOrderDate: null,
    vehicles: [],
    discount: 4, creditTerms: 30, salesperson: 'อรนุช สายใจ',
    notes: 'นำเสนอเมื่อ 2 สัปดาห์ที่แล้ว รออนุมัติงบ'
  },
]

export default async function FleetManagementPage(container) {
  const myGen = container.__routerGen
  let statusFilter = 'all'
  let fleets = DEMO_FLEETS.map(f => ({ ...f }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('fleet_accounts', [], 'company', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `FL${i+1}`, company: d.company || d.name || 'บริษัท',
        industry: d.industry || 'อื่นๆ', contact: d.contact || d.contactName || '',
        phone: d.phone || '', email: d.email || '',
        status: d.status || 'prospect', fleetSize: d.fleetSize || 0,
        evCount: d.evCount || 0, targetFleet: d.targetFleet || 0,
        totalRevenue: d.totalRevenue || 0, lastOrderDate: d.lastOrderDate || null,
        vehicles: d.vehicles || [], discount: d.discount || 0,
        creditTerms: d.creditTerms || 30, salesperson: d.salesperson || '',
        notes: d.notes || '',
      }))
      fleets = [...mapped, ...DEMO_FLEETS]
      dataSource = 'live'
    }
  } catch {}

  function filtered() {
    return fleets.filter(f => statusFilter === 'all' || f.status === statusFilter)
  }

  function renderPage() {
    const list = filtered()
    const totalFleetSize = fleets.reduce((a, f) => a + f.fleetSize, 0)
    const totalRevenue = fleets.reduce((a, f) => a + f.totalRevenue, 0)
    const prospects = fleets.filter(f => f.status === 'prospect').length
    const totalEV = fleets.reduce((a, f) => a + f.evCount, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏢 Fleet Management</div>
            <div class="page-subtitle">ลูกค้าองค์กร — กองรถยนต์${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-fleet-btn">+ เพิ่มลูกค้าองค์กร</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🏢 องค์กร', fleets.length, 'primary')}
          ${kpi('🚗 กองรถรวม', totalFleetSize + ' คัน', 'success')}
          ${kpi('⚡ EV ในกอง', totalEV + ' คัน', 'primary')}
          ${kpi('💰 รายได้รวม', formatCurrency(totalRevenue), 'success')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(FLEET_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">
          ${list.map(f => {
            const fs = FLEET_STATUS[f.status]
            const evPct = f.fleetSize ? Math.round(f.evCount / f.fleetSize * 100) : 0
            const targetPct = f.targetFleet ? Math.round(f.fleetSize / f.targetFleet * 100) : 0
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${fs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${escHtml(f.company)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(f.industry)}</div>
                </div>
                <span class="badge badge-${fs?.color}">${fs?.label}</span>
              </div>
              <div style="display:flex;gap:12px;font-size:0.78rem;margin-bottom:8px">
                <span>👤 ${escHtml(f.contact)}</span>
                <span>📞 ${escHtml(f.phone)}</span>
              </div>
              <div style="display:flex;gap:10px;margin-bottom:8px">
                ${kpiMini('🚗 กองรถ', f.fleetSize + ' คัน')}
                ${kpiMini('⚡ EV', f.evCount + ' คัน')}
                ${kpiMini('🎯 เป้า', f.targetFleet + ' คัน')}
              </div>
              <div style="margin-bottom:6px">
                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">EV penetration ${evPct}%</div>
                <div style="background:var(--surface-2);border-radius:3px;height:5px">
                  <div style="width:${evPct}%;background:var(--success);height:5px;border-radius:3px"></div>
                </div>
              </div>
              <div style="margin-bottom:10px">
                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">เป้ากองรถ ${targetPct}%</div>
                <div style="background:var(--surface-2);border-radius:3px;height:5px">
                  <div style="width:${Math.min(targetPct,100)}%;background:var(--primary);height:5px;border-radius:3px"></div>
                </div>
              </div>
              ${f.totalRevenue > 0 ? `<div style="font-size:0.78rem;margin-bottom:10px">💰 รายได้รวม: <strong style="color:var(--success)">${formatCurrency(f.totalRevenue)}</strong></div>` : ''}
              ${f.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;padding:6px;background:var(--surface-2);border-radius:var(--radius-sm)">📌 ${escHtml(f.notes)}</div>` : ''}
              <button class="btn btn-xs btn-secondary open-fleet-btn" data-id="${f.id}" style="width:100%">ดูรายละเอียด</button>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-fleet-btn')?.addEventListener('click', openAddForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(fleets.map(f => ({ ID: f.id, บริษัท: f.company, อุตสาหกรรม: f.industry, ผู้ติดต่อ: f.contact, กองรถ: f.fleetSize, EV: f.evCount, รายได้: f.totalRevenue })), 'fleet_customers')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-fleet-btn').forEach(b => b.addEventListener('click', () => {
      const f = fleets.find(x => x.id === b.dataset.id); if (f) openFleetDetail(f)
    }))
  }

  function openFleetDetail(f) {
    const fs = FLEET_STATUS[f.status]
    openModal({
      title: `🏢 ${escHtml(f.company)}`,
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            ${row('อุตสาหกรรม', escHtml(f.industry))}${row('ผู้ติดต่อ', escHtml(f.contact))}${row('โทร', escHtml(f.phone))}${row('Email', escHtml(f.email))}${row('เซลส์', escHtml(f.salesperson))}${row('สถานะ', `<span class="badge badge-${fs?.color}">${fs?.label}</span>`)}
          </div>
          <div>
            ${row('กองรถปัจจุบัน', f.fleetSize + ' คัน')}${row('EV ในกอง', f.evCount + ' คัน')}${row('เป้าหมายกอง', f.targetFleet + ' คัน')}${row('ส่วนลด', f.discount + '%')}${row('เครดิต', f.creditTerms + ' วัน')}${f.lastOrderDate ? row('สั่งซื้อล่าสุด', formatDate(f.lastOrderDate)) : ''}
          </div>
        </div>
        ${f.vehicles.length ? `
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px">รายการรถในกอง</div>
          <div class="card" style="padding:0;overflow:hidden">
            <table class="table">
              <thead><tr><th>รุ่น</th><th class="text-right">จำนวน</th><th class="text-right">ราคา/คัน</th><th class="text-right">รวม</th></tr></thead>
              <tbody>
                ${f.vehicles.map(v => `<tr>
                  <td>${escHtml(v.model)}</td>
                  <td class="text-right">${v.qty} คัน</td>
                  <td class="text-right">${formatCurrency(v.unitPrice)}</td>
                  <td class="text-right" style="font-weight:700">${formatCurrency(v.qty * v.unitPrice)}</td>
                </tr>`).join('')}
              </tbody>
              <tfoot>
                <tr><td colspan="3" style="font-weight:800;padding:8px 12px">รวม</td><td class="text-right" style="font-weight:800;color:var(--success)">${formatCurrency(f.vehicles.reduce((a,v)=>a+v.qty*v.unitPrice,0))}</td></tr>
              </tfoot>
            </table>
          </div>
        ` : ''}
        ${f.notes ? `<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📌 ${escHtml(f.notes)}</div>` : ''}
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มลูกค้าองค์กร',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อบริษัท *</label><input class="input" id="ff-company" placeholder="บริษัท..."></div>
          <div class="input-group"><label class="input-label">อุตสาหกรรม</label>
            <select class="input" id="ff-industry">${INDUSTRIES.map(i => `<option>${i}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ผู้ติดต่อ</label><input class="input" id="ff-contact" placeholder="ชื่อผู้ติดต่อ"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="ff-phone" placeholder="02-xxx-xxxx"></div>
          <div class="input-group"><label class="input-label">Email</label><input class="input" id="ff-email" placeholder="fleet@company.co.th"></div>
          <div class="input-group"><label class="input-label">กองรถปัจจุบัน</label><input type="number" class="input" id="ff-fleet" value="0"></div>
          <div class="input-group"><label class="input-label">เป้าหมายกอง</label><input type="number" class="input" id="ff-target" value="10"></div>
          <div class="input-group"><label class="input-label">เซลส์</label><input class="input" id="ff-sales" placeholder="ชื่อเซลส์"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><textarea class="input" id="ff-notes" rows="2" placeholder="บันทึก..."></textarea></div>
        </div>
      `,
      onConfirm() {
        const company = document.getElementById('ff-company')?.value?.trim()
        if (!company) { showToast('❗ กรุณากรอกชื่อบริษัท', 'error'); return }
        fleets.unshift({
          id: `FL${String(fleets.length+1).padStart(3,'0')}`, company,
          industry: document.getElementById('ff-industry')?.value||'',
          contact: document.getElementById('ff-contact')?.value||'',
          phone: document.getElementById('ff-phone')?.value||'',
          email: document.getElementById('ff-email')?.value||'',
          status: 'prospect', fleetSize: +document.getElementById('ff-fleet')?.value||0,
          evCount: 0, targetFleet: +document.getElementById('ff-target')?.value||10,
          totalRevenue: 0, lastOrderDate: null, vehicles: [],
          discount: 2, creditTerms: 30,
          salesperson: document.getElementById('ff-sales')?.value||'',
          notes: document.getElementById('ff-notes')?.value||''
        })
        showToast('✅ เพิ่มลูกค้าองค์กรแล้ว!', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function kpiMini(l, v) { return `<div style="text-align:center;padding:6px;background:var(--surface-2);border-radius:var(--radius-sm);flex:1"><div style="font-size:0.68rem;color:var(--text-muted)">${l}</div><div style="font-size:0.85rem;font-weight:700">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
