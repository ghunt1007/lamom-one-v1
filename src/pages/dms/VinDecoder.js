/**
 * VIN Decoder & Vehicle Lookup — ค้นหารถจาก VIN/ทะเบียน
 * Route: /dms/vin-lookup
 */
import { formatDate, formatCurrency, todayBangkok, toDateStr } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listAllDocs, listDocs, createDoc } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// (v1.0.335) เดิมรถปลอม 4 คัน (DEMO_VEHICLES) ถูกผสมเข้ากับผลค้นหาจริงถาวรเสมอ (ไม่ใช่แค่ตอนไม่มีข้อมูล
// จริง) และปุ่ม "ประวัติซ่อม" สร้างประวัติซ่อมปลอมขึ้นมาทุกครั้งไม่ว่าจะเป็นรถจริงหรือปลอม ปุ่ม "นัดเช็คระยะ"
// ก็แค่โชว์ toast สำเร็จ ไม่บันทึกอะไรจริงเลย — แก้ให้ใช้ข้อมูลรถจริงจากใบจอง (bookings — มี vin/whitePlate/
// redPlate/custName/phone จริงอยู่แล้ว ไม่ใช่ vehicles/Stock ที่เป็นสต็อกก่อนขาย ไม่มีข้อมูลเจ้าของ) จับคู่
// ประวัติซ่อมจริงจาก job_cards และประกันจริงจาก insurance_policies ด้วยทะเบียนจริง ไม่มีข้อมูลสเปกแบตเตอรี่/
// มอเตอร์/ประกันแบตจริงในระบบเลย จึงตัดออก (ไม่ควรแต่งขึ้น) ปุ่ม "นัดเช็คระยะ" เขียนจริงลง job_cards
// (status:'waiting' — เหมือนที่หน้า Job Cards ใช้จริง)

export default async function VinDecoderPage(container) {
  const myGen = container.__routerGen
  let vehicles = []
  let dataSource = 'demo'
  let result = null
  let notFound = false
  let query = ''
  let loading = true

  async function loadData() {
    loading = true
    let bookings = [], jobs = [], policies = []
    try { bookings = await listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc') } catch {}
    try { jobs = await listAllDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc') } catch {}
    try { policies = await listDocs('insurance_policies', [], 'endDate', 'desc', 500) } catch {}
    if (container.__routerGen !== myGen) return

    const realBookings = bookings.filter(b => !b.deleted && b.status !== 'ถอนจอง' && (b.vin || b.whitePlate || b.redPlate))
    vehicles = realBookings.map(b => {
      const plate = b.whitePlate || b.redPlate || ''
      const matchedJobs = jobs.filter(j => (plate && j.plate === plate) || (b.custName && j.custName === b.custName))
        .sort((a, z) => (z.createdAt || '').localeCompare(a.createdAt || ''))
      const matchedPolicy = policies.find(p => (plate && p.plate === plate) || p.custName === b.custName)
      return {
        vin: b.vin || '',
        plate,
        model: `${b.brand || ''} ${b.model || ''}`.trim() || '-',
        color: b.colorOut || '',
        owner: b.custName || '',
        phone: b.phone || '',
        purchaseDate: b.actualDeliveryDate || b.deliveryDate || b.bookingDate || toDateStr(b.createdAt),
        serviceCount: matchedJobs.length,
        lastService: matchedJobs[0]?.createdAt || '',
        insurer: matchedPolicy?.insurer || '',
        _jobs: matchedJobs,
      }
    })
    dataSource = vehicles.length ? 'live' : 'demo'
    if (!vehicles.length) vehicles = DEMO_VEHICLES.map(v => ({ ...v, _jobs: [] }))
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔎 Vehicle Lookup</div>
            <div class="page-subtitle">ค้นหารถจาก VIN / ทะเบียน — ดูประวัติครบในที่เดียว${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ' <span style="color:var(--text-muted);font-size:0.75rem">Demo (ยังไม่มีข้อมูลใบจองจริง)</span>'}</div>
          </div>
        </div>

        <!-- Search box -->
        <div class="card" style="padding:20px;max-width:560px;margin:0 auto 16px">
          <div style="display:flex;gap:8px">
            <input class="input" id="vin-input" placeholder="พิมพ์ VIN หรือทะเบียน เช่น 1กข-1234" value="${escHtml(query)}" style="flex:1;font-size:0.9rem;padding:10px 12px">
            <button class="btn btn-primary" id="search-btn">🔎 ค้นหา</button>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">
            💡 ลองค้น: ${vehicles.slice(0, 8).map(v => `<a href="#" class="quick-link" data-q="${escHtml(v.plate)}" style="color:var(--primary);margin-right:8px">${escHtml(v.plate)}</a>`).join('')}
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
                  <div style="font-weight:900;font-size:1.2rem">${escHtml(result.model)}</div>
                  <div style="font-size:0.78rem;color:var(--text-muted);font-family:monospace">VIN: ${escHtml(result.vin || '-')}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700;font-size:1rem">${escHtml(result.plate || '-')}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${result.color ? 'สี' + escHtml(result.color) : ''}</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
                ${spec('📅 ซื้อเมื่อ', formatDate(result.purchaseDate))}
                ${spec('🔧 เข้าศูนย์', result.serviceCount + ' ครั้ง')}
                ${spec('📆 ซ่อมล่าสุด', result.lastService ? formatDate(result.lastService) : '-')}
              </div>
            </div>

            <!-- Owner card -->
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">👤 เจ้าของรถ</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${escHtml(result.owner || '-')}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">📞 ${escHtml(result.phone || '-')}${result.insurer ? ' · 🛡 ' + escHtml(result.insurer) : ''}</div>
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
        (v.vin && v.vin.toUpperCase() === norm) ||
        (v.plate && (v.plate.replace(/-/g, '') === query.replace(/-/g, '') || v.plate === query))
      ) || null
      notFound = !result && query !== ''
      renderPage()
    }

    document.getElementById('search-btn')?.addEventListener('click', () => doSearch(document.getElementById('vin-input')?.value || ''))
    document.getElementById('vin-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(e.target.value) })
    container.querySelectorAll('.quick-link').forEach(a => a.addEventListener('click', e => { e.preventDefault(); doSearch(a.dataset.q) }))
    document.getElementById('view-history-btn')?.addEventListener('click', () => {
      const history = result._jobs || []
      openModal({
        title: '📖 ประวัติซ่อม — ' + escHtml(result.plate),
        size: 'md',
        body: `
          <div style="font-size:0.82rem">
            <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:10px">🚗 ${escHtml(result.model)} · 👤 ${escHtml(result.owner || '-')} · 📞 ${escHtml(result.phone || '-')}</div>
            ${history.length ? `<table style="width:100%;border-collapse:collapse;font-size:0.76rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                  <th style="padding:7px 9px;text-align:left">วันที่</th>
                  <th style="padding:7px 9px;text-align:left">รายการ</th>
                  <th style="padding:7px 9px;text-align:right">ค่าแรง</th>
                </tr>
              </thead>
              <tbody>
                ${history.map(h => `<tr style="border-bottom:1px solid var(--border-subtle)">
                  <td style="padding:6px 9px;color:var(--text-muted)">${formatDate(h.createdAt)}</td>
                  <td style="padding:6px 9px">${escHtml(h.desc || h.type || '-')}</td>
                  <td style="padding:6px 9px;text-align:right;font-weight:700;color:var(--success)">${formatCurrency(h.labor || 0)}</td>
                </tr>`).join('')}
              </tbody>
            </table>` : `<div class="empty-state" style="padding:16px"><div class="empty-icon">🔧</div><div class="empty-title">ยังไม่มีประวัติซ่อมในระบบ</div></div>`}
          </div>
        `
      })
    })
    document.getElementById('book-service-btn')?.addEventListener('click', () => {
      // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
      // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
      const today = todayBangkok()
      openModal({
        title: '📅 นัดเช็คระยะ — ' + escHtml(result.plate),
        size: 'sm',
        body: `
          <div style="font-size:0.82rem;display:flex;flex-direction:column;gap:10px">
            <div style="font-size:0.74rem;color:var(--text-muted)">🚗 ${escHtml(result.model)} · 👤 ${escHtml(result.owner || '-')}</div>
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
        async onConfirm() {
          const date = document.getElementById('bk-date')?.value
          const type = document.getElementById('bk-type')?.value
          const note = document.getElementById('bk-note')?.value?.trim()
          if (!date) { showToast('กรุณาเลือกวันนัด', 'error'); return false }
          try {
            await createDoc('job_cards', {
              custName: result.owner || '-', phone: result.phone || '', brand: (result.model||'').split(' ')[0]||'', model: result.model || '',
              plate: result.plate || '', vin: result.vin || '', type: 'service', status: 'waiting',
              desc: `${type}${note ? ' — ' + note : ''}`, scheduledDate: date, parts: [], labor: 0,
              companyId: myEffectiveCompanyId(),
            })
            showToast(`📅 นัด ${result.owner} — ${type} วันที่ ${date} แล้ว — บันทึกจริงเข้าระบบ Job Cards`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        }
      })
    })
  }

  await loadData()
}

// ใช้เฉพาะตอนยังไม่มีข้อมูลใบจองจริงเลยในระบบ (empty-state ตัวอย่าง ไม่ผสมกับของจริง)
const DEMO_VEHICLES = [
  { vin: 'LGXC74C44N0123456', plate: '1กข-1234', model: 'BYD Seal AWD', color: 'ดำ', owner: 'สมชาย ใจดี', phone: '085-111', purchaseDate: '2023-08-15', serviceCount: 0, lastService: '', insurer: '' },
  { vin: 'LGXC74C44N0789012', plate: '2ขค-5678', model: 'BYD Dolphin', color: 'ขาว', owner: 'มาลี สุขใจ', phone: '086-222', purchaseDate: '2022-11-02', serviceCount: 0, lastService: '', insurer: '' },
]

function spec(l, v) { return `<div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm)"><div style="font-size:0.63rem;color:var(--text-muted)">${l}</div><div style="font-weight:700;font-size:0.78rem">${escHtml(String(v ?? ''))}</div></div>` }
