/**
 * Vehicle Reservation — จองคิวรถ
 * Route: /dms/reservation
 */
import { formatDate, formatCurrency, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const RESERVATION_STATUS = {
  active:   { label: 'จองแล้ว', color: 'primary', icon: '📋' },
  deposit:  { label: 'วางมัดจำ', color: 'warning', icon: '💰' },
  confirmed:{ label: 'ยืนยัน', color: 'success', icon: '✅' },
  expired:  { label: 'หมดอายุ', color: 'secondary', icon: '⏰' },
  cancelled:{ label: 'ยกเลิก', color: 'danger', icon: '❌' },
}

const MODELS = ['BYD Dolphin', 'BYD Atto 3', 'BYD Seal AWD', 'MG ZS EV', 'BYD Han', 'BYD Atto 3 Pro']

export default async function VehicleReservationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let reservations = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { reservations = await listDocs('vehicle_reservations', [], 'created', 'desc', 200) } catch (e) { reservations = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = reservations.filter(r => statusFilter === 'all' || r.status === statusFilter)
    const active = reservations.filter(r => ['active','deposit','confirmed'].includes(r.status)).length
    const deposit = reservations.filter(r => r.deposit > 0).reduce((a, r) => a + r.deposit, 0)
    const expiringSoon = reservations.filter(r => r.status !== 'expired' && r.status !== 'cancelled' && r.expiry <= addDays(3)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Vehicle Reservation</div>
            <div class="page-subtitle">จองคิวรถ — ติดตามการจองและมัดจำ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-res-btn">+ สร้างการจอง</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 จองที่ active', active + ' รายการ', 'primary')}
          ${kpi('💰 มัดจำรวม', formatCurrency(deposit), 'warning')}
          ${kpi('⏰ ใกล้หมดอายุ', expiringSoon + ' รายการ', expiringSoon > 0 ? 'danger' : 'secondary')}
          ${kpi('📊 ทั้งหมด', reservations.length, 'secondary')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(RESERVATION_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Reservations -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(r => {
            const rs = RESERVATION_STATUS[r.status]
            const isExpiring = r.status !== 'expired' && r.status !== 'cancelled' && r.expiry <= addDays(3)
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${rs?.color})${isExpiring?';background:var(--warning)08':''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(r.customer)} <span style="font-size:0.7rem;color:var(--text-muted)">📞 ${escHtml(r.phone)}</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${escHtml(r.model)} · 🎨 ${escHtml(r.color)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👤 ${escHtml(r.staff)} · จอง ${timeAgo(r.created)}</div>
                  <div style="font-size:0.72rem;color:var(--${isExpiring?'danger':'text-muted'})">⏰ หมดอายุ ${formatDate(r.expiry)}${isExpiring?' ⚠️':''}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${rs?.color}" style="font-size:0.63rem">${rs?.icon} ${rs?.label}</span>
                  ${r.deposit > 0 ? `<span style="font-size:0.78rem;font-weight:700;color:var(--warning)">💰 ${formatCurrency(r.deposit)}</span>` : ''}
                  ${r.stockId ? `<span style="font-size:0.65rem;color:var(--text-muted)">${escHtml(r.stockId)}</span>` : ''}
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${r.status === 'active' ? `<button class="btn btn-xs btn-warning deposit-btn" data-id="${escHtml(r.id)}">💰 รับมัดจำ</button>` : ''}
                ${r.status === 'deposit' ? `<button class="btn btn-xs btn-success confirm-btn" data-id="${escHtml(r.id)}">✅ ยืนยัน</button>` : ''}
                ${['active','deposit'].includes(r.status) ? `<button class="btn btn-xs btn-danger cancel-btn" data-id="${escHtml(r.id)}">❌ ยกเลิก</button>` : ''}
                <button class="btn btn-xs btn-secondary edit-btn" data-id="${escHtml(r.id)}">✏️</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.deposit-btn').forEach(b => b.addEventListener('click', async () => {
      const r = reservations.find(x=>x.id===b.dataset.id); if (!r) return
      try { await updateDocData('vehicle_reservations', r.id, { status: 'deposit', deposit: 10000 }); showToast('💰 บันทึกมัดจำแล้ว','warning'); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.confirm-btn').forEach(b => b.addEventListener('click', async () => {
      const r = reservations.find(x=>x.id===b.dataset.id); if (!r) return
      try { await updateDocData('vehicle_reservations', r.id, { status: 'confirmed' }); showToast('✅ ยืนยันการจองแล้ว','success'); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.cancel-btn').forEach(b => b.addEventListener('click', async () => {
      const r = reservations.find(x=>x.id===b.dataset.id); if (!r) return
      try { await updateDocData('vehicle_reservations', r.id, { status: 'cancelled' }); showToast('❌ ยกเลิกการจองแล้ว','secondary'); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('add-res-btn')?.addEventListener('click', () => openAddForm())
  }

  function openAddForm() {
    openModal({
      title: '+ สร้างการจองรถ',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="rs-name"></div>
        <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="rs-phone"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label>
          <select class="input" id="rs-model">${MODELS.map(m=>`<option>${m}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">สี</label><input class="input" id="rs-color" placeholder="ขาว / น้ำเงิน / เทา"></div>
        <div class="input-group"><label class="input-label">มัดจำ (บาท)</label><input class="input" type="number" id="rs-deposit" value="0"></div>
        <div class="input-group"><label class="input-label">วันหมดอายุจอง</label><input class="input" type="date" id="rs-expiry" value="${addDays(14)}"></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('rs-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ','error'); return false }
        const dep = parseInt(document.getElementById('rs-deposit')?.value)||0
        try {
          await createDoc('vehicle_reservations', {
            customer:name, phone:document.getElementById('rs-phone')?.value||'',
            model:document.getElementById('rs-model')?.value||MODELS[0],
            color:document.getElementById('rs-color')?.value||'ขาว', deposit:dep,
            staff:'วิชัย ยอดขาย', status:dep>0?'deposit':'active', created:new Date().toISOString(),
            expiry:document.getElementById('rs-expiry')?.value||addDays(14), stockId:null
          })
          showToast('✅ สร้างการจองแล้ว','success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
