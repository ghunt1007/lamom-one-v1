/**
 * Special Edition Allocation — จัดสรรรุ่นพิเศษ/Limited Edition
 * Route: /dms/special-edition
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_EDITIONS = [
  {
    id: 'SE-001', name: 'BYD Seal Performance Edition', model: 'BYD Seal', totalAlloc: 3, arrived: 2,
    price: 1899000, color: 'Midnight Black', launch: '2026-07-01',
    units: [
      { no: 1, vin: 'SEAL-PE-001', status: 'reserved', customer: 'คุณอนันต์', date: '2026-06-10' },
      { no: 2, vin: 'SEAL-PE-002', status: 'available', customer: '', date: '' },
      { no: 3, vin: '', status: 'incoming', customer: '', date: '', eta: '2026-06-20' },
    ]
  },
  {
    id: 'SE-002', name: 'BYD Han Dynasty Edition', model: 'BYD Han', totalAlloc: 2, arrived: 2,
    price: 2299000, color: 'Dynasty Red',  launch: '2026-05-15',
    units: [
      { no: 1, vin: 'HAN-DY-001', status: 'delivered', customer: 'คุณมาลี', date: '2026-06-01' },
      { no: 2, vin: 'HAN-DY-002', status: 'reserved', customer: 'คุณวีระ', date: '2026-06-08' },
    ]
  },
  {
    id: 'SE-003', name: 'MG4 XPOWER Limited', model: 'MG4 Electric', totalAlloc: 5, arrived: 0,
    price: 1299000, color: 'Storm Grey', launch: '2026-08-15',
    units: Array.from({length:5}, (_,i) => ({ no: i+1, vin: '', status: 'incoming', customer: '', date: '', eta: '2026-08-10' }))
  },
]

const UST = {
  available: { label: 'ว่าง',     color: 'var(--success)' },
  reserved:  { label: 'จอง',      color: 'var(--primary)' },
  delivered: { label: 'ส่งมอบแล้ว', color: 'var(--text-muted)' },
  incoming:  { label: 'กำลังมา',  color: 'var(--warning)' },
}

export default async function SpecialEditionPage(container) {
  const myGen = container.__routerGen
  let editions = DEMO_EDITIONS.map(e => ({ ...e, units: e.units.map(u => ({ ...u })) }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('special_editions', [], 'launch', 'desc', 50).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `SE-${String(i+1).padStart(3,'0')}`,
        name: d.name || '',
        model: d.model || '',
        totalAlloc: d.totalAlloc || 0,
        arrived: d.arrived || 0,
        price: d.price || 0,
        color: d.color || '',
        launch: d.launch || '',
        units: Array.isArray(d.units) ? d.units.map(u => ({ ...u })) : [],
      }))
      editions = [...mapped, ...DEMO_EDITIONS]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const totalAvail = editions.reduce((s,e) => s + e.units.filter(u=>u.status==='available').length, 0)
    const totalRes = editions.reduce((s,e) => s + e.units.filter(u=>u.status==='reserved').length, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⭐ Special Edition Allocation</div>
            <div class="page-subtitle">จัดสรรรุ่นพิเศษ/Limited Edition ไม่ให้ซ้อนกัน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-btn">➕ เพิ่มรุ่นพิเศษ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📦 Edition ทั้งหมด', editions.length, 'var(--primary)')}
          ${sc('🟢 ว่าง', totalAvail, totalAvail > 0 ? 'var(--success)' : 'var(--text-muted)')}
          ${sc('🔵 จองแล้ว', totalRes, 'var(--primary)')}
          ${sc('💰 มูลค่ารวม', formatCurrency(editions.reduce((s,e)=>s+e.price*e.units.filter(u=>!['incoming'].includes(u.status)).length,0)), 'var(--success)')}
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          ${editions.map(e => editionCard(e)).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.reserve-unit-btn').forEach(b => b.addEventListener('click', () => reserveUnit(b.dataset.eid, parseInt(b.dataset.no))))
    document.getElementById('add-btn')?.addEventListener('click', addEdition)
  }

  function editionCard(e) {
    const avail = e.units.filter(u=>u.status==='available').length
    const reserved = e.units.filter(u=>u.status==='reserved').length
    const done = e.units.filter(u=>u.status==='delivered').length
    const pct = Math.round((reserved + done) / e.totalAlloc * 100)

    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div style="font-size:0.95rem;font-weight:700">⭐ ${escHtml(e.name)}</div>
            <div style="font-size:0.74rem;color:var(--text-muted)">${escHtml(e.model)} · สี${escHtml(e.color)} · Launch ${formatDate(e.launch)} · ${formatCurrency(e.price)}/คัน</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.8rem;font-weight:700">${reserved + done}/${e.totalAlloc} คัน จอง/ส่งแล้ว</div>
            <div style="height:6px;width:120px;background:var(--surface-2);border-radius:3px;overflow:hidden;margin-top:4px">
              <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--success)':'var(--primary)'}"></div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">
          ${e.units.map(u => {
            const s = UST[u.status]
            return `<div style="border:2px solid ${s.color};border-radius:var(--radius-sm);padding:9px 11px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:0.8rem">คันที่ ${u.no}</strong>
                <span style="font-size:0.64rem;background:${s.color};color:#fff;padding:1px 7px;border-radius:10px">${s.label}</span>
              </div>
              ${u.vin ? `<div style="font-size:0.66rem;color:var(--text-muted);margin-top:2px">${escHtml(u.vin)}</div>` : ''}
              ${u.customer ? `<div style="font-size:0.72rem;margin-top:4px">👤 ${escHtml(u.customer)}<div style="font-size:0.64rem;color:var(--text-muted)">${formatDate(u.date)}</div></div>` : ''}
              ${u.eta ? `<div style="font-size:0.7rem;color:var(--warning);margin-top:4px">ETA: ${formatDate(u.eta)}</div>` : ''}
              ${u.status === 'available' ? `<button class="btn btn-xs btn-primary reserve-unit-btn" data-eid="${escHtml(e.id)}" data-no="${u.no}" style="width:100%;margin-top:8px">จอง</button>` : ''}
            </div>`
          }).join('')}
        </div>
      </div>`
  }

  function reserveUnit(eid, no) {
    const e = editions.find(x => x.id === eid)
    const u = e.units.find(x => x.no === no)
    openModal({
      title: '🔵 จอง ' + escHtml(e.name) + ' คันที่ ' + no,
      size: 'sm',
      body: `<div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="se-cust"></div>`,
      confirmText: '✅ ยืนยันจอง',
      onConfirm() {
        const cust = document.getElementById('se-cust').value.trim()
        if (!cust) { showToast('❗ ระบุชื่อลูกค้า', 'error'); return false }
        u.status = 'reserved'; u.customer = cust; u.date = new Date().toISOString().slice(0,10)
        showToast(`จอง ${e.name} คันที่ ${no} ให้ ${cust} แล้ว`, 'success')
        render()
      }
    })
  }

  function addEdition() {
    const today = new Date().toISOString().slice(0,10)
    openModal({
      title: '➕ เพิ่มรุ่นพิเศษ / Limited Edition',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อ Edition *</label>
            <input id="se-name" class="input" placeholder="BYD Seal Performance Edition..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่นรถ *</label>
              <input id="se-model" class="input" placeholder="BYD Seal / BYD Han..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">สีพิเศษ</label>
              <input id="se-color" class="input" placeholder="Midnight Black / Dynasty Red..."></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">จำนวน Allocation (คัน) *</label>
              <input id="se-alloc" type="number" min="1" class="input" placeholder="5"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาต่อคัน (บาท) *</label>
              <input id="se-price" type="number" class="input" placeholder="1899000"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วัน Launch</label>
              <input id="se-launch" type="date" class="input" value="${today}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ETA มาถึง (คาดการณ์)</label>
              <input id="se-eta" type="date" class="input" value="${today}"></div>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="se-save">⭐ เพิ่ม Edition</button>
        </div>
      `
    })
    document.getElementById('se-save')?.addEventListener('click', () => {
      const name  = document.getElementById('se-name')?.value.trim()
      const model = document.getElementById('se-model')?.value.trim()
      const alloc = parseInt(document.getElementById('se-alloc')?.value) || 0
      const price = parseInt(document.getElementById('se-price')?.value) || 0
      if (!name || !model || !alloc || !price) {
        showToast('⚠️ กรุณากรอกข้อมูลที่จำเป็นให้ครบ', 'warning'); return
      }
      const eta = document.getElementById('se-eta')?.value || today
      editions.push({
        id: 'SE-' + String(editions.length + 1).padStart(3,'0'),
        name, model,
        totalAlloc: alloc,
        arrived: 0,
        price,
        color: document.getElementById('se-color')?.value.trim() || '-',
        launch: document.getElementById('se-launch')?.value || today,
        units: Array.from({length: alloc}, (_, i) => ({
          no: i + 1, vin: '', status: 'incoming', customer: '', date: '', eta
        }))
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('⭐ เพิ่ม ' + name + ' (' + alloc + ' คัน) แล้ว', 'success')
      render()
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
