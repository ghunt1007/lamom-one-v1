/**
 * Key Management — จัดการกุญแจรถ
 * Route: /dms/keys
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const KEY_STATUS = {
  in_cabinet: { label: 'อยู่ในตู้', color: 'success', icon: '🔐' },
  checked_out:{ label: 'ถูกเบิกออก', color: 'warning', icon: '🔑' },
  missing:    { label: 'หาไม่เจอ!', color: 'danger', icon: '🚨' },
}

const DEMO_KEYS = [
  { id: 'K-A01', slot: 'A01', vehicle: 'BYD Dolphin (สต็อก)', vin: '...1122', status: 'in_cabinet', holder: null, since: addHours(20), purpose: null },
  { id: 'K-A02', slot: 'A02', vehicle: 'BYD Atto 3 (สต็อก)', vin: '...3344', status: 'checked_out', holder: 'วิชัย ยอดขาย', since: addHours(1), purpose: 'พาลูกค้าดูรถ' },
  { id: 'K-A03', slot: 'A03', vehicle: 'BYD Seal AWD (สต็อก)', vin: '...5566', status: 'in_cabinet', holder: null, since: addHours(5), purpose: null },
  { id: 'K-B01', slot: 'B01', vehicle: 'รถ Demo ทด-001', vin: '...7788', status: 'checked_out', holder: 'ธนา เก่ง', since: addHours(3), purpose: 'Test Drive ลูกค้า' },
  { id: 'K-B02', slot: 'B02', vehicle: 'รถ Demo ทด-003', vin: '...9900', status: 'checked_out', holder: 'สมบัติ ขับดี', since: addHours(26), purpose: 'รับ-ส่งเอกสารขนส่ง' },
  { id: 'K-C01', slot: 'C01', vehicle: 'รถลูกค้า 1กข-1234 (ซ่อม)', vin: '...3456', status: 'in_cabinet', holder: null, since: addHours(2), purpose: null },
  { id: 'K-C02', slot: 'C02', vehicle: 'รถลูกค้า 2ขค-5678 (ซ่อม)', vin: '...9012', status: 'missing', holder: 'มานะ ขยัน (ล่าสุด)', since: addHours(50), purpose: 'ย้ายรถเข้า Bay' },
]

export default async function KeyManagementPage(container) {
  const myGen = container.__routerGen
  let keys = DEMO_KEYS.map(k => ({ ...k }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('keys', [], 'slot', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `K-${String(i+1).padStart(3,'0')}`,
        slot: d.slot || '',
        vehicle: d.vehicle || d.vehicleName || '',
        vin: d.vin || '',
        status: d.status || 'in_cabinet',
        holder: d.holder || null,
        since: d.since || new Date().toISOString(),
        purpose: d.purpose || null,
      }))
      keys = [...mapped, ...DEMO_KEYS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const out = keys.filter(k => k.status === 'checked_out')
    const missing = keys.filter(k => k.status === 'missing')
    const longHeld = out.filter(k => new Date(k.since) < new Date(Date.now() - 24 * 3600000))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔑 Key Management</div>
            <div class="page-subtitle">ตู้กุญแจ — รู้เสมอว่ากุญแจอยู่ไหน ใครถือ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔐 ในตู้', keys.filter(k=>k.status==='in_cabinet').length + '/' + keys.length, 'success')}
          ${kpi('🔑 ถูกเบิกออก', out.length, out.length > 0 ? 'warning' : 'secondary')}
          ${kpi('⏰ เกิน 24 ชม.', longHeld.length, longHeld.length > 0 ? 'danger' : 'success')}
          ${kpi('🚨 หาไม่เจอ', missing.length, missing.length > 0 ? 'danger' : 'success')}
        </div>

        ${missing.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🚨 <strong>กุญแจหาย:</strong> ${missing.map(k => `${escHtml(k.vehicle)} (คนถือล่าสุด: ${escHtml(k.holder)})`).join(' · ')} — ตามด่วน!
          </div>
        ` : ''}
        ${longHeld.length > 0 ? `
          <div style="padding:10px 14px;background:var(--warning)11;border:1px solid var(--warning)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⏰ <strong>เบิกนานเกิน 24 ชม.:</strong> ${longHeld.map(k => `${escHtml(k.vehicle)} — ${escHtml(k.holder)}`).join(' · ')}
          </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">
          ${keys.map(k => {
            const ks = KEY_STATUS[k.status]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${ks?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.83rem">${escHtml(k.vehicle)}</div>
                  <div style="font-size:0.66rem;color:var(--text-muted)">ช่อง ${escHtml(k.slot)} · VIN ${escHtml(k.vin)}</div>
                </div>
                <span class="badge badge-${ks?.color}" style="font-size:0.6rem">${ks?.icon} ${ks?.label}</span>
              </div>
              ${k.holder ? `<div style="font-size:0.72rem;color:var(--text-muted)">👤 ${escHtml(k.holder)} · ${timeAgo(k.since)}${k.purpose ? '<br>📌 ' + escHtml(k.purpose) : ''}</div>` : `<div style="font-size:0.72rem;color:var(--text-muted)">คืนล่าสุด ${timeAgo(k.since)}</div>`}
              <div style="display:flex;gap:5px;margin-top:8px">
                ${k.status === 'in_cabinet' ? `<button class="btn btn-xs btn-warning out-btn" data-id="${k.id}">🔑 เบิก</button>` : ''}
                ${k.status === 'checked_out' ? `<button class="btn btn-xs btn-success in-btn" data-id="${k.id}">🔐 คืน</button><button class="btn btn-xs btn-danger lost-btn" data-id="${k.id}">🚨 หาย</button>` : ''}
                ${k.status === 'missing' ? `<button class="btn btn-xs btn-success found-btn" data-id="${k.id}">✅ เจอแล้ว</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.out-btn').forEach(b => b.addEventListener('click', () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (k) openModal({
        title: '🔑 เบิกกุญแจ: ' + escHtml(k.vehicle),
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ผู้เบิก *</label>
            <select class="input" id="ky-holder"><option>วิชัย ยอดขาย</option><option>สุดา มาดี</option><option>ธนา เก่ง</option><option>วิทยา ช่างใหญ่</option><option>มานะ ขยัน</option><option>สมบัติ ขับดี</option></select>
          </div>
          <div class="input-group"><label class="input-label">เหตุผล *</label>
            <select class="input" id="ky-purpose"><option>พาลูกค้าดูรถ</option><option>Test Drive ลูกค้า</option><option>ย้ายรถเข้า Bay</option><option>นำรถไปล้าง</option><option>รับ-ส่งเอกสาร</option></select>
          </div>
        </div>`,
        onConfirm() {
          k.status = 'checked_out'
          k.holder = document.getElementById('ky-holder')?.value || '—'
          k.purpose = document.getElementById('ky-purpose')?.value || '—'
          k.since = new Date().toISOString()
          showToast(`🔑 ${k.holder} เบิกกุญแจ ${k.slot} แล้ว — บันทึก log`, 'warning'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.in-btn').forEach(b => b.addEventListener('click', () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (k) { k.status = 'in_cabinet'; k.holder = null; k.purpose = null; k.since = new Date().toISOString(); showToast('🔐 คืนกุญแจเข้าตู้แล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.lost-btn').forEach(b => b.addEventListener('click', () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (k) { k.status = 'missing'; k.holder = (k.holder||'') + ' (ล่าสุด)'; showToast('🚨 แจ้งกุญแจหาย — เปิด Incident อัตโนมัติ', 'error'); renderPage() }
    }))
    container.querySelectorAll('.found-btn').forEach(b => b.addEventListener('click', () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (k) { k.status = 'in_cabinet'; k.holder = null; k.purpose = null; k.since = new Date().toISOString(); showToast('✅ เจอกุญแจแล้ว — คืนเข้าตู้', 'success'); renderPage() }
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
