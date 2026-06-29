/**
 * Win-Back Campaign — ดึงลูกค้าเก่ากลับมา
 * Route: /crm/winback
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const WB_STATUS = {
  target:    { label: 'เป้าหมาย', color: 'secondary', icon: '🎯' },
  contacted: { label: 'ติดต่อแล้ว', color: 'primary', icon: '📞' },
  interested:{ label: 'สนใจ', color: 'warning', icon: '✨' },
  returned:  { label: 'กลับมาแล้ว!', color: 'success', icon: '🎉' },
  lost:      { label: 'ไม่กลับ', color: 'danger', icon: '💔' },
}

const CHURN_REASONS = {
  price:    'ราคา/ค่าบริการแพง',
  service:  'ไม่พอใจบริการ',
  distance: 'ย้ายที่อยู่/ไกล',
  sold_car: 'ขายรถไปแล้ว',
  unknown:  'ไม่ทราบสาเหตุ',
}

const DEMO_TARGETS = [
  { id: 'WB001', customer: 'ชาตรี เข้มแข็ง', phone: '084-666', lastVisit: addDays(-380), reason: 'service', value: 45000, status: 'contacted', offer: 'ส่วนลดบริการ 20% + ตรวจฟรี 30 รายการ', attempts: 2 },
  { id: 'WB002', customer: 'นภา ห่างหาย', phone: '083-777', lastVisit: addDays(-420), reason: 'distance', value: 38000, status: 'interested', offer: 'บริการรถรับ-ส่งฟรี + ส่วนลด 15%', attempts: 3 },
  { id: 'WB003', customer: 'พิชัย จากไป', phone: '082-888', lastVisit: addDays(-300), reason: 'price', value: 62000, status: 'target', offer: '', attempts: 0 },
  { id: 'WB004', customer: 'รัตนา คืนมา', phone: '081-999', lastVisit: addDays(-350), reason: 'unknown', value: 28000, status: 'returned', offer: 'แพ็กเกจเช็คระยะ 50% ครั้งแรก', attempts: 2 },
  { id: 'WB005', customer: 'สมพงษ์ ลาก่อน', phone: '080-000', lastVisit: addDays(-500), reason: 'sold_car', value: 15000, status: 'lost', offer: 'ส่วนลดรถใหม่ 30,000 บาท', attempts: 4 },
  { id: 'WB006', customer: 'อัมพร เงียบไป', phone: '089-123', lastVisit: addDays(-310), reason: 'unknown', value: 52000, status: 'target', offer: '', attempts: 0 },
]

export default async function WinBackPage(container) {
  const myGen = container.__routerGen
  let targets = DEMO_TARGETS.map(t => ({ ...t }))
  let statusFilter = 'all'
  let dataSource = 'demo'

  try {
    const delivered = await listDocs('bookings', [['status','==','ส่งมอบแล้ว']], 'deliveryDate', 'asc', 300).catch(() => [])
    if (container.__routerGen !== myGen) return
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 10)
    const inactive = delivered.filter(b => {
      const d = new Date(b.deliveryDate || b.bookingDate || 0)
      return d < cutoff
    })
    if (inactive.length >= 2) {
      const live = inactive.map((b, i) => ({
        id: `WL${i+1}`, customer: b.customerName || b.custName || 'ลูกค้า',
        phone: b.phone || '', lastVisit: b.deliveryDate || b.bookingDate || '',
        reason: 'unknown', value: 0, status: 'target', offer: '', attempts: 0,
      }))
      targets = [...live, ...DEMO_TARGETS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = targets.filter(t => statusFilter === 'all' || t.status === statusFilter)
    const returned = targets.filter(t => t.status === 'returned')
    const winRate = Math.round(returned.length / targets.filter(t => ['returned','lost'].includes(t.status)).length * 100) || 0
    const potentialValue = targets.filter(t => !['returned','lost'].includes(t.status)).reduce((a, t) => a + t.value, 0)
    const recoveredValue = returned.reduce((a, t) => a + t.value, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💝 Win-Back Campaign</div>
            <div class="page-subtitle">ดึงลูกค้าที่หายไป 10+ เดือนกลับมา${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="scan-btn">🔍 สแกนลูกค้าหาย</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🎯 เป้าหมาย', targets.length + ' ราย', 'primary')}
          ${kpi('🎉 กลับมาแล้ว', returned.length + ' ราย', 'success')}
          ${kpi('📊 Win Rate', winRate + '%', winRate >= 30 ? 'success' : 'warning')}
          ${kpi('💰 มูลค่ากู้คืน', formatCurrency(recoveredValue), 'success')}
        </div>

        <div style="padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--primary);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.78rem">
          🤖 <strong>LAMI:</strong> มูลค่าที่ยังกู้คืนได้ ${formatCurrency(potentialValue)} — ลูกค้าที่หายเพราะ "ไม่พอใจบริการ" ควรให้ผู้จัดการโทรเอง ไม่ใช่ส่งแค่ SMS
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(WB_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(t => {
            const ws = WB_STATUS[t.status]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${ws?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.86rem">${escHtml(t.customer)} <span style="font-size:0.7rem;color:var(--text-muted)">📞 ${escHtml(t.phone)}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">หายไป ${timeAgo(t.lastVisit)} · สาเหตุ: ${CHURN_REASONS[t.reason]}</div>
                  ${t.offer ? `<div style="font-size:0.72rem;color:var(--warning)">🎁 ข้อเสนอ: ${t.offer}</div>` : ''}
                  ${t.attempts > 0 ? `<div style="font-size:0.68rem;color:var(--text-muted)">📞 ติดต่อแล้ว ${t.attempts} ครั้ง</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ws?.color}" style="font-size:0.62rem">${ws?.icon} ${ws?.label}</span>
                  <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted)">LTV ${formatCurrency(t.value)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${t.status === 'target' ? `<button class="btn btn-xs btn-primary offer-btn" data-id="${t.id}">🎁 สร้างข้อเสนอ + ติดต่อ</button>` : ''}
                ${t.status === 'contacted' ? `
                  <button class="btn btn-xs btn-warning interest-btn" data-id="${t.id}">✨ สนใจ</button>
                  <button class="btn btn-xs btn-secondary retry-btn" data-id="${t.id}">📞 ติดต่ออีกครั้ง</button>
                  <button class="btn btn-xs btn-danger lost-btn" data-id="${t.id}">💔 ไม่กลับ</button>` : ''}
                ${t.status === 'interested' ? `
                  <button class="btn btn-xs btn-success return-btn" data-id="${t.id}">🎉 กลับมาแล้ว!</button>
                  <button class="btn btn-xs btn-danger lost-btn" data-id="${t.id}">💔 ไม่กลับ</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.offer-btn').forEach(b => b.addEventListener('click', () => {
      const t = targets.find(x => x.id === b.dataset.id)
      if (t) openModal({
        title: '🎁 สร้างข้อเสนอ: ' + escHtml(t.customer),
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="font-size:0.78rem;color:var(--text-muted)">สาเหตุที่หาย: <strong>${CHURN_REASONS[t.reason]}</strong></div>
          <div class="input-group"><label class="input-label">ข้อเสนอ</label>
            <select class="input" id="wb-offer">
              <option>ส่วนลดบริการ 20% + ตรวจฟรี 30 รายการ</option>
              <option>บริการรถรับ-ส่งฟรี + ส่วนลด 15%</option>
              <option>แพ็กเกจเช็คระยะ 50% ครั้งแรก</option>
              <option>ส่วนลดรถใหม่ 30,000 บาท</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">ช่องทาง</label>
            <select class="input" id="wb-channel"><option>โทรศัพท์ (ผู้จัดการ)</option><option>LINE</option><option>SMS</option></select>
          </div>
        </div>`,
        confirmText: '📤 ส่งข้อเสนอ',
        onConfirm() {
          t.offer = document.getElementById('wb-offer')?.value || ''
          t.status = 'contacted'; t.attempts = 1
          showToast('📤 ส่งข้อเสนอแล้ว', 'success'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.interest-btn').forEach(b => b.addEventListener('click', () => {
      const t = targets.find(x => x.id === b.dataset.id); if (t) { t.status = 'interested'; renderPage() }
    }))
    container.querySelectorAll('.retry-btn').forEach(b => b.addEventListener('click', () => {
      const t = targets.find(x => x.id === b.dataset.id); if (t) { t.attempts++; showToast('📞 บันทึกการติดต่อครั้งที่ ' + t.attempts, 'primary'); renderPage() }
    }))
    container.querySelectorAll('.return-btn').forEach(b => b.addEventListener('click', () => {
      const t = targets.find(x => x.id === b.dataset.id); if (t) { t.status = 'returned'; showToast('🎉 ' + t.customer + ' กลับมาแล้ว!', 'success'); renderPage() }
    }))
    container.querySelectorAll('.lost-btn').forEach(b => b.addEventListener('click', () => {
      const t = targets.find(x => x.id === b.dataset.id); if (t) { t.status = 'lost'; renderPage() }
    }))
    document.getElementById('scan-btn')?.addEventListener('click', () => {
      const unworked = targets.filter(t => t.status === 'target' && t.attempts === 0)
      if (unworked.length > 0) {
        showToast(`🔍 พบ ${unworked.length} ราย ที่ยังไม่ได้ติดต่อ — ดูในรายการเป้าหมาย`, 'warning')
      } else {
        targets.push({
          id: 'WB' + Date.now(),
          customer: 'ประสิทธิ์ หายไป',
          phone: '088-555-6789',
          lastVisit: addDays(-365),
          reason: 'unknown',
          value: 35000,
          status: 'target',
          offer: '',
          attempts: 0,
        })
        showToast('🔍 สแกนเสร็จ — พบลูกค้าหายใหม่ 1 ราย เพิ่มในรายการแล้ว', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
