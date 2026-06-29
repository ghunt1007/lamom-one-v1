/**
 * VIN Decoder & Vehicle Lookup — ค้นหารถจาก VIN/ทะเบียน
 * Route: /dms/vin-lookup
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEMO_VEHICLES = [
  { vin: 'LGXC74C44N0123456', plate: '1กข-1234', model: 'BYD Seal AWD', year: 2023, color: 'ดำ', owner: 'สมชาย ใจดี', phone: '085-111', purchaseDate: '2023-08-15', warranty: '2031-08-15', battery: '82.56 kWh', motor: 'Dual Motor 390 kW', serviceCount: 4, lastService: '2026-04-20', insurer: 'วิริยะประกันภัย' },
  { vin: 'LGXC74C44N0789012', plate: '2ขค-5678', model: 'BYD Dolphin', year: 2022, color: 'ขาว', owner: 'มาลี สุขใจ', phone: '086-222', purchaseDate: '2022-11-02', warranty: '2030-11-02', battery: '44.9 kWh', motor: 'Single 70 kW', serviceCount: 7, lastService: '2026-05-12', insurer: 'กรุงเทพประกันภัย' },
  { vin: 'LSJW74T96MN345678', plate: '3คง-9012', model: 'MG ZS EV', year: 2021, color: 'แดง', owner: 'ธนพล เที่ยงตรง', phone: '087-333', purchaseDate: '2021-06-20', warranty: '2029-06-20', battery: '50.3 kWh', motor: 'Single 130 kW', serviceCount: 11, lastService: '2026-06-03', insurer: 'ทิพยประกันภัย' },
  { vin: 'LGXC74C44N0456789', plate: '4งจ-3456', model: 'BYD Atto 3', year: 2023, color: 'น้ำเงิน', owner: 'อรทัย ตั้งใจ', phone: '088-444', purchaseDate: '2023-03-10', warranty: '2031-03-10', battery: '60.5 kWh', motor: 'Single 150 kW', serviceCount: 3, lastService: '2026-02-28', insurer: 'วิริยะประกันภัย' },
]

export default async function VinDecoderPage(container) {
  const myGen = container.__routerGen
  let vehicles = DEMO_VEHICLES.map(v => ({ ...v }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('vehicles', [], 'purchaseDate', 'desc', 500).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map(d => ({
        vin: d.vin || '',
        plate: d.plate || d.licensePlate || '',
        model: d.model || d.vehicleModel || '',
        year: d.year || new Date().getFullYear(),
        color: d.color || '',
        owner: d.owner || d.ownerName || '',
        phone: d.phone || '',
        purchaseDate: d.purchaseDate || '',
        warranty: d.warranty || d.warrantyExpiry || '',
        battery: d.battery || '',
        motor: d.motor || '',
        serviceCount: d.serviceCount || 0,
        lastService: d.lastService || '',
        insurer: d.insurer || '',
      }))
      vehicles = [...mapped, ...DEMO_VEHICLES]
      dataSource = 'live'
    }
  } catch {}

  let result = null
  let notFound = false
  let query = ''

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔎 Vehicle Lookup</div>
            <div class="page-subtitle">ค้นหารถจาก VIN / ทะเบียน — ดูประวัติครบในที่เดียว${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
        </div>

        <!-- Search box -->
        <div class="card" style="padding:20px;max-width:560px;margin:0 auto 16px">
          <div style="display:flex;gap:8px">
            <input class="input" id="vin-input" placeholder="พิมพ์ VIN หรือทะเบียน เช่น 1กข-1234" value="${escHtml(query)}" style="flex:1;font-size:0.9rem;padding:10px 12px">
            <button class="btn btn-primary" id="search-btn">🔎 ค้นหา</button>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">
            💡 ลองค้น: ${vehicles.map(v => `<a href="#" class="quick-link" data-q="${escHtml(v.plate)}" style="color:var(--primary);margin-right:8px">${escHtml(v.plate)}</a>`).join('')}
          </div>
        </div>

        ${notFound ? `
          <div class="card" style="padding:30px;max-width:560px;margin:0 auto;text-align:center">
            <div style="font-size:2rem;margin-bottom:8px">🔍</div>
            <div style="font-weight:700">ไม่พบข้อมูลรถ "${escHtml(query)}"</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">ตรวจสอบ VIN/ทะเบียนอีกครั้ง หรือรถอาจไม่ได้ซื้อจากเรา</div>
          </div>
        ` : ''}

        ${result ? `
          <div style="max-width:680px;margin:0 auto">
            <!-- Vehicle card -->
            <div class="card" style="padding:18px;margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
                <div>
                  <div style="font-weight:900;font-size:1.2rem">${escHtml(result.model)} <span style="font-size:0.8rem;color:var(--text-muted)">${result.year}</span></div>
                  <div style="font-size:0.78rem;color:var(--text-muted);font-family:monospace">VIN: ${escHtml(result.vin)}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;font-size:1rem">${escHtml(result.plate)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">สี${escHtml(result.color)}</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
                ${spec('🔋 แบตเตอรี่', result.battery)}
                ${spec('⚙️ มอเตอร์', result.motor)}
                ${spec('📅 ซื้อเมื่อ', formatDate(result.purchaseDate))}
                ${spec('🛡 ประกันแบตถึง', formatDate(result.warranty))}
                ${spec('🔧 เข้าศูนย์', result.serviceCount + ' ครั้ง')}
                ${spec('📆 ซ่อมล่าสุด', formatDate(result.lastService))}
              </div>
            </div>

            <!-- Owner card -->
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">👤 เจ้าของรถ</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${escHtml(result.owner)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">📞 ${escHtml(result.phone)} · 🛡 ${escHtml(result.insurer)}</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-secondary" id="view-history-btn">📖 ประวัติซ่อม</button>
                  <button class="btn btn-xs btn-primary" id="book-service-btn">📅 นัดเช็คระยะ</button>
                </div>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `

    function doSearch(q) {
      query = q.trim()
      const norm = query.toUpperCase().replace(/\s|-/g, '')
      result = vehicles.find(v =>
        v.vin.toUpperCase() === norm ||
        v.plate.replace(/-/g, '') === query.replace(/-/g, '') ||
        v.plate === query
      ) || null
      notFound = !result && query !== ''
      renderPage()
    }

    document.getElementById('search-btn')?.addEventListener('click', () => doSearch(document.getElementById('vin-input')?.value || ''))
    document.getElementById('vin-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(e.target.value) })
    container.querySelectorAll('.quick-link').forEach(a => a.addEventListener('click', e => { e.preventDefault(); doSearch(a.dataset.q) }))
    document.getElementById('view-history-btn')?.addEventListener('click', () => {
      const mockHistory = Array.from({ length: Math.min(result.serviceCount, 5) }, (_, i) => {
        const d = new Date(result.lastService); d.setMonth(d.getMonth() - i * 3)
        const svc = ['ตรวจเช็คระยะ', 'เปลี่ยนยาง', 'ล้างแอร์', 'ตรวจระบบเบรก', 'ตรวจสภาพทั่วไป']
        const cost = [3500, 8200, 2800, 4500, 1500]
        return { date: d.toISOString().slice(0,10), service: svc[i%5], cost: cost[i%5] }
      })
      openModal({
        title: '📖 ประวัติซ่อม — ' + escHtml(result.plate),
        size: 'md',
        body: `
          <div style="font-size:0.82rem">
            <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:10px">🚗 ${escHtml(result.model)} · 👤 ${escHtml(result.owner)} · 📞 ${escHtml(result.phone)}</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.76rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                  <th style="padding:7px 9px;text-align:left">วันที่</th>
                  <th style="padding:7px 9px;text-align:left">รายการ</th>
                  <th style="padding:7px 9px;text-align:right">ค่าบริการ</th>
                </tr>
              </thead>
              <tbody>
                ${mockHistory.map(h => `<tr style="border-bottom:1px solid var(--border-subtle)">
                  <td style="padding:6px 9px;color:var(--text-muted)">${h.date}</td>
                  <td style="padding:6px 9px">${h.service}</td>
                  <td style="padding:6px 9px;text-align:right;font-weight:700;color:var(--success)">฿${h.cost.toLocaleString()}</td>
                </tr>`).join('')}
              </tbody>
            </table>
            <div style="margin-top:10px;font-size:0.72rem;color:var(--text-muted)">
              ซ่อมทั้งหมด ${result.serviceCount} ครั้ง · ซ่อมล่าสุด ${escHtml(result.lastService)} · 🛡 ประกัน ${escHtml(result.insurer)}
            </div>
          </div>
        `
      })
    })
    document.getElementById('book-service-btn')?.addEventListener('click', () => {
      const today = new Date().toISOString().slice(0,10)
      openModal({
        title: '📅 นัดเช็คระยะ — ' + escHtml(result.plate),
        size: 'sm',
        body: `
          <div style="font-size:0.82rem;display:flex;flex-direction:column;gap:10px">
            <div style="font-size:0.74rem;color:var(--text-muted)">🚗 ${escHtml(result.model)} · 👤 ${escHtml(result.owner)}</div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันที่นัด *</label>
              <input id="bk-date" type="date" class="input" value="${today}" min="${today}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภทงาน *</label>
              <select id="bk-type" class="input">
                <option>ตรวจเช็คระยะ</option><option>ล้างรถ / แว็กซ์</option>
                <option>เปลี่ยนยาง</option><option>ตรวจระบบเบรก</option>
                <option>EV Diagnostic</option><option>อื่นๆ</option>
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">หมายเหตุ</label>
              <input id="bk-note" class="input" placeholder="รายละเอียดเพิ่มเติม..."></div>
          </div>
        `,
        confirmText: '📅 ยืนยันนัด',
        onConfirm() {
          const date = document.getElementById('bk-date')?.value
          const type = document.getElementById('bk-type')?.value
          if (!date) { showToast('กรุณาเลือกวันนัด', 'error'); return false }
          showToast(`📅 นัด ${result.owner} — ${type} วันที่ ${date} แล้ว`, 'success')
        }
      })
    })
  }

  renderPage()
}

function spec(l, v) { return `<div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:0.63rem;color:var(--text-muted)">${l}</div><div style="font-weight:700;font-size:0.78rem">${escHtml(String(v ?? ''))}</div></div>` }
