/**
 * QR Code per Vehicle — สแกน QR ดูประวัติ สเปค ราคา ต่อคัน
 * Route: /dms/qr-vehicle
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_VEHICLES = [
  { vin: 'LGXC4EBA5PA000101', model: 'BYD Atto 3', color: 'ฟ้า', year: 2025, plate: 'กข-1234', price: 1099000, status: 'available',
    spec: { battery: '60.5 kWh', range: '480 km', power: '150 kW', charge: 'CCS2 + AC 7kW', seats: 5, warranty: '8 ปี / 160,000 km' },
    service: [{ date:'2026-05-10', type:'PDI ก่อนส่งมอบ', by:'ช่างสมชาย', note:'ผ่านทุกรายการ' }],
    promo: '🎁 แถมฟรี: ประกันชั้น 1 ปีแรก + ชาร์จเจอร์บ้าน 7.4kW',
  },
  { vin: 'LGXC5EBA6PA000202', model: 'BYD Seal AWD', color: 'ดำ', year: 2025, plate: '', price: 1699000, status: 'reserved',
    spec: { battery: '82.6 kWh', range: '520 km', power: '390 kW', charge: 'CCS2 + AC 11kW', seats: 5, warranty: '8 ปี / 160,000 km' },
    service: [],
    promo: '🎁 แถมฟรี: ประกันชั้น 1 ปีแรก + Floor Mat พรีเมียม',
  },
  { vin: 'LSGBC54C5PA000303', model: 'MG ZS EV', color: 'ขาว', year: 2025, plate: '1กก-5678', price: 799000, status: 'sold',
    spec: { battery: '51 kWh', range: '440 km', power: '130 kW', charge: 'CCS2 + AC 7kW', seats: 5, warranty: '5 ปี / 150,000 km' },
    service: [{ date:'2026-03-01', type:'ส่งมอบรถ', by:'นิภา', note:'ลูกค้ารับรถเรียบร้อย' }],
    promo: '',
  },
]

const ST = { available: { label: 'มีสต็อก', color: 'var(--success)' }, reserved: { label: 'จองแล้ว', color: 'var(--primary)' }, sold: { label: 'ขายแล้ว', color: 'var(--text-muted)' } }

export default async function QrVehiclePage(container) {
  const myGen = container.__routerGen
  let vehicles = [...DEMO_VEHICLES].map(v => ({ ...v, spec: { ...v.spec }, service: v.service.map(s => ({ ...s })) }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('stock', [], 'model', 'asc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        vin: d.vin || `VIN-${i+1}`,
        model: d.model || '',
        color: d.color || '',
        year: d.year || new Date().getFullYear(),
        plate: d.plate || '',
        price: d.price || d.salePrice || 0,
        status: d.status || 'available',
        spec: d.spec ? { ...d.spec } : { battery: '', range: '', power: '', charge: '', seats: 5, warranty: '' },
        service: Array.isArray(d.service) ? d.service.map(s => ({ ...s })) : [],
        promo: d.promo || '',
      }))
      vehicles = [...mapped, ...DEMO_VEHICLES]
      dataSource = 'live'
    }
  } catch {}

  let scanInput = ''

  function render() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📱 QR Code per Vehicle</div>
            <div class="page-subtitle">สแกน QR → ดูสเปค ประวัติ โปรโมชั่น ต่อคัน · พิมพ์ติด Windshield${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="print-all-btn">🖨 พิมพ์ QR ทุกคัน</button>
          </div>
        </div>

        <!-- Simulate scan -->
        <div class="card" style="padding:14px;margin-bottom:14px;border:2px dashed var(--border)">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🔍 ทดสอบสแกน QR (ใส่ VIN)</div>
          <div style="display:flex;gap:8px">
            <input class="input" id="scan-input" placeholder="ใส่ VIN เพื่อจำลองการสแกน..." value="${escHtml(scanInput)}" style="flex:1">
            <button class="btn btn-primary" id="scan-btn">📷 สแกน</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
          ${vehicles.map(v => vehicleCard(v)).join('')}
        </div>
      </div>
    `

    document.getElementById('scan-btn')?.addEventListener('click', () => {
      const vin = document.getElementById('scan-input').value.trim()
      const v = vehicles.find(x => x.vin.toLowerCase().includes(vin.toLowerCase()) || vin === '')
      if (!vin) { showToast('ใส่ VIN ก่อนสแกน', 'warning'); return }
      if (v) openVehicleDetail(v)
      else showToast('❌ ไม่พบ VIN นี้ในระบบ', 'error')
    })
    document.getElementById('print-all-btn')?.addEventListener('click', () => {
      const targets = vehicles.filter(v => v.status !== 'sold')
      targets.forEach(v => { v.printed = true })
      render()
      showToast(`🖨 สั่งพิมพ์ QR Code ${targets.length} แผ่น (${targets.map(v=>v.model).join(', ')}) แล้ว`, 'success')
    })
    container.querySelectorAll('.view-qr-btn').forEach(b => b.addEventListener('click', () => {
      const v = vehicles.find(x => x.vin === b.dataset.vin)
      if (v) openVehicleDetail(v)
    }))
    container.querySelectorAll('.print-qr-btn').forEach(b => b.addEventListener('click', () => {
      const v = vehicles.find(x => x.vin === b.dataset.vin)
      if (v) { v.printed = true; render() }
      showToast(`🖨 พิมพ์ QR ของ ${b.dataset.model} แล้ว`, 'success')
    }))
  }

  function vehicleCard(v) {
    const s = ST[v.status]
    const short = v.vin.slice(-8)
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:0.88rem">${escHtml(v.model)}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">สี${escHtml(v.color)} · MY${v.year}${v.plate ? ' · '+escHtml(v.plate) : ''}</div>
          </div>
          <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:2px 8px;border-radius:10px">${s.label}</span>
        </div>

        <!-- QR placeholder -->
        <div style="width:100%;aspect-ratio:1;max-width:120px;margin:0 auto 12px;background:var(--surface-2);border-radius:var(--radius-sm);display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid var(--border)">
          <div style="font-size:2rem">📱</div>
          <div style="font-size:0.6rem;color:var(--text-muted);margin-top:4px;text-align:center">${escHtml(short)}<br>SCAN ME</div>
        </div>

        <div style="font-size:0.72rem;color:var(--text-muted);text-align:center;margin-bottom:10px">VIN: <code style="font-size:0.7rem">${escHtml(v.vin)}</code></div>
        <div style="font-size:0.78rem;text-align:center;font-weight:700;color:var(--primary);margin-bottom:10px">${formatCurrency(v.price)}</div>

        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary view-qr-btn" data-vin="${escHtml(v.vin)}" style="flex:1;font-size:0.74rem">👁 ดูรายละเอียด</button>
          ${v.printed ? `<span style="font-size:0.66rem;color:var(--success);text-align:center;flex:1;align-self:center">✅ พิมพ์แล้ว</span>` : `<button class="btn btn-secondary print-qr-btn" data-vin="${escHtml(v.vin)}" data-model="${escHtml(v.model)}" style="flex:1;font-size:0.74rem">🖨 พิมพ์ QR</button>`}
        </div>
      </div>`
  }

  function openVehicleDetail(v) {
    const s = ST[v.status]
    openModal({
      title: '📱 ' + escHtml(v.model) + ' · ' + escHtml(v.vin.slice(-8)),
      size: 'sm',
      body: `
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:2px 8px;border-radius:10px">${s.label}</span>
          <span style="font-size:0.66rem;color:var(--text-muted)">สี${escHtml(v.color)} · MY${v.year}</span>
        </div>
        <div style="font-size:1.1rem;font-weight:900;color:var(--primary);margin-bottom:10px">${formatCurrency(v.price)}</div>

        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">🔧 สเปค</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.74rem;margin-bottom:10px">
          ${Object.entries(v.spec).map(([k,val]) => `
            <div style="background:var(--surface-2);padding:4px 8px;border-radius:var(--radius-sm)">
              <div style="color:var(--text-muted);font-size:0.64rem">${escHtml(k)}</div>
              <div style="font-weight:600">${escHtml(String(val))}</div>
            </div>`).join('')}
        </div>

        ${v.service.length ? `
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">📖 ประวัติ</div>
          ${v.service.map(s => `<div style="font-size:0.72rem;padding:4px 0;border-bottom:1px solid var(--border)">${formatDate(s.date)} · ${escHtml(s.type)} · ${escHtml(s.by)} — ${escHtml(s.note)}</div>`).join('')}
        ` : ''}

        ${v.promo ? `<div style="background:var(--success)22;padding:8px 10px;border-radius:var(--radius-sm);font-size:0.76rem;margin-top:10px">${escHtml(v.promo)}</div>` : ''}
        <div style="font-size:0.62rem;color:var(--text-muted);margin-top:8px">VIN: ${escHtml(v.vin)}</div>`,
      confirmText: '📤 ส่งให้ลูกค้า',
      onConfirm() {
        v.sentToCustomer = true; v.sentAt = new Date().toISOString()
        render()
        showToast(`📤 ส่งข้อมูล ${v.model} · VIN ${v.vin.slice(-6)} ให้ลูกค้าทาง LINE แล้ว`, 'success')
      }
    })
  }

  render()
}
