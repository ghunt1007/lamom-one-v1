/**
 * Roadside Assist — ช่วยเหลือฉุกเฉิน 24 ชม.
 * Route: /service/roadside
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const CASE_TYPES = {
  battery_dead: { label: 'แบต 12V หมด', icon: '🔋' },
  out_of_charge:{ label: 'ไฟหมดกลางทาง', icon: '⚡' },
  flat_tire:    { label: 'ยางแบน/รั่ว', icon: '🛞' },
  accident:     { label: 'อุบัติเหตุ', icon: '💥' },
  breakdown:    { label: 'รถเสีย/ขับต่อไม่ได้', icon: '🔧' },
  locked_out:   { label: 'กุญแจ/ล็อครถ', icon: '🔑' },
}

const CASE_STATUS = {
  new:       { label: 'รับแจ้งใหม่!', color: 'danger', icon: '🆕' },
  dispatched:{ label: 'ส่งทีมแล้ว', color: 'warning', icon: '🚐' },
  onsite:    { label: 'ถึงที่เกิดเหตุ', color: 'primary', icon: '📍' },
  resolved:  { label: 'ช่วยเสร็จแล้ว', color: 'success', icon: '✅' },
  towing:    { label: 'ลากเข้าศูนย์', color: 'warning', icon: '🚛' },
}

export default async function RoadsideAssistPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let cases = []
  let loading = true

  async function loadData() {
    loading = true
    try { cases = await listDocs('roadside_cases', [], 'reported', 'desc', 500) } catch (e) { cases = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const active = cases.filter(c => !['resolved'].includes(c.status))
    const newCases = cases.filter(c => c.status === 'new')
    const avgResponse = 22 // นาที

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚨 Roadside Assist</div>
            <div class="page-subtitle">ช่วยเหลือฉุกเฉิน 24 ชม. — Hotline 02-xxx-1669</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-danger" id="new-case-btn" style="font-size:0.95rem">🆘 รับแจ้งเหตุใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚨 เคส active', active.length, active.length > 0 ? 'danger' : 'success')}
          ${kpi('🆕 รอส่งทีม', newCases.length, newCases.length > 0 ? 'danger' : 'success')}
          ${kpi('⏱ Response เฉลี่ย', avgResponse + ' นาที', avgResponse <= 30 ? 'success' : 'warning')}
          ${kpi('✅ ช่วยแล้วเดือนนี้', '23 เคส', 'primary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${cases.map(c => {
            const ct = CASE_TYPES[c.type]
            const cs = CASE_STATUS[c.status]
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${cs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${ct?.icon} ${ct?.label} — ${c.plate} (${c.model})</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👤 ${c.customer} 📞 ${c.phone} · แจ้ง ${timeAgo(c.reported)}</div>
                  <div style="font-size:0.74rem;font-weight:600;color:var(--primary)">📍 ${c.location}</div>
                  ${c.team ? `<div style="font-size:0.72rem;color:var(--text-muted)">🚐 ${c.team}${c.eta > 0 ? ' · ถึงใน ~' + c.eta + ' นาที' : ''}</div>` : ''}
                </div>
                <span class="badge badge-${cs?.color}" style="font-size:0.65rem">${cs?.icon} ${cs?.label}</span>
              </div>
              <div style="display:flex;gap:6px">
                ${c.status === 'new' ? `<button class="btn btn-xs btn-warning dispatch-btn" data-id="${c.id}">🚐 ส่งทีม</button>` : ''}
                ${c.status === 'dispatched' ? `<button class="btn btn-xs btn-primary onsite-btn" data-id="${c.id}">📍 ถึงที่เกิดเหตุ</button>` : ''}
                ${c.status === 'onsite' ? `
                  <button class="btn btn-xs btn-success resolve-btn" data-id="${c.id}">✅ ช่วยเสร็จ — ขับต่อได้</button>
                  <button class="btn btn-xs btn-warning tow-btn" data-id="${c.id}">🚛 ต้องลากเข้าศูนย์</button>` : ''}
                ${c.status === 'towing' ? `<button class="btn btn-xs btn-success arrive-btn" data-id="${c.id}">🏁 ถึงศูนย์ — เปิด Job Card</button>` : ''}
                ${c.status !== 'resolved' ? `<button class="btn btn-xs btn-secondary call-btn" data-id="${c.id}">📞 โทรหาลูกค้า</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.dispatch-btn').forEach(b => b.addEventListener('click', () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (c) openModal({
        title: '🚐 ส่งทีมกู้ภัย',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ทีม</label>
            <select class="input" id="ra-team">
              <option>ทีมกู้ภัย A (มีตู้ชาร์จเคลื่อนที่)</option>
              <option>ทีมกู้ภัย B</option>
              <option>รถลาก + ประสานประกัน</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">ETA (นาที)</label><input class="input" type="number" id="ra-eta" value="30"></div>
        </div>`,
        async onConfirm() {
          const team = document.getElementById('ra-team')?.value || '—'
          const eta = parseInt(document.getElementById('ra-eta')?.value) || 30
          try {
            await updateDocData('roadside_cases', c.id, { team, eta, status: 'dispatched' })
            showToast(`🚐 ส่งทีมแล้ว — ETA ${eta} นาที`, 'warning')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    container.querySelectorAll('.onsite-btn').forEach(b => b.addEventListener('click', async () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (!c) return
      try { await updateDocData('roadside_cases', c.id, { status: 'onsite', eta: 0 }); await loadData() } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.resolve-btn').forEach(b => b.addEventListener('click', async () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (!c) return
      try {
        await updateDocData('roadside_cases', c.id, { status: 'resolved' })
        showToast('✅ ปิดเคสแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.tow-btn').forEach(b => b.addEventListener('click', async () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (!c) return
      try { await updateDocData('roadside_cases', c.id, { status: 'towing', eta: 45 }); await loadData() } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.arrive-btn').forEach(b => b.addEventListener('click', async () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (!c) return
      try {
        await updateDocData('roadside_cases', c.id, { status: 'resolved' })
        showToast('🏁 รถถึงศูนย์แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.call-btn').forEach(b => b.addEventListener('click', async () => {
      const c = cases.find(x => x.id === b.dataset.id)
      if (!c) return
      const callLog = (c.callLog || 0) + 1
      try {
        await updateDocData('roadside_cases', c.id, { callLog })
        showToast(`📞 โทรหา ${c.customer} · ${c.phone} (ครั้งที่ ${callLog}) บันทึกแล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('new-case-btn')?.addEventListener('click', () => {
      openModal({
        title: '🆘 รับแจ้งเหตุฉุกเฉิน',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ทะเบียน/ลูกค้า *</label><input class="input" id="ra-plate" autofocus placeholder="1กข-1234"></div>
          <div class="input-group"><label class="input-label">เบอร์ติดต่อ</label><input class="input" id="ra-phone"></div>
          <div class="input-group"><label class="input-label">ประเภทเหตุ</label>
            <select class="input" id="ra-type">${Object.entries(CASE_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">จุดเกิดเหตุ *</label><input class="input" id="ra-location" placeholder="ถนน/กม./จุดสังเกต"></div>
        </div>`,
        confirmText: '🆘 รับแจ้ง',
        async onConfirm() {
          const plate = document.getElementById('ra-plate')?.value?.trim()
          const location = document.getElementById('ra-location')?.value?.trim()
          if (!plate || !location) { showToast('❗ กรอกทะเบียนและจุดเกิดเหตุ', 'error'); return false }
          try {
            await createDoc('roadside_cases', { customer:'(ค้นจากทะเบียน)', phone:document.getElementById('ra-phone')?.value||'—', plate, model:'—', type:document.getElementById('ra-type')?.value||'breakdown', location, status:'new', reported:new Date().toISOString(), team:null, eta:0 })
            showToast('🆘 รับแจ้งแล้ว — เร่งส่งทีมภายใน 5 นาที!', 'error')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
