/**
 * Key Management — จัดการกุญแจรถ
 * Route: /dms/keys
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const KEY_STATUS = {
  in_cabinet: { label: 'อยู่ในตู้', color: 'success', icon: '🔐' },
  checked_out:{ label: 'ถูกเบิกออก', color: 'warning', icon: '🔑' },
  missing:    { label: 'หาไม่เจอ!', color: 'danger', icon: '🚨' },
}

export default async function KeyManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let keys = []
  let loading = true

  async function loadData() {
    loading = true
    try { keys = await listDocs('keys', [], 'slot', 'asc', 200) } catch (e) { keys = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const out = keys.filter(k => k.status === 'checked_out')
    const missing = keys.filter(k => k.status === 'missing')
    const longHeld = out.filter(k => new Date(k.since) < new Date(Date.now() - 24 * 3600000))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔑 Key Management</div>
            <div class="page-subtitle">ตู้กุญแจ — รู้เสมอว่ากุญแจอยู่ไหน ใครถือ</div>
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
        async onConfirm() {
          const holder = document.getElementById('ky-holder')?.value || '—'
          const purpose = document.getElementById('ky-purpose')?.value || '—'
          try {
            await updateDocData('keys', k.id, { status: 'checked_out', holder, purpose, since: new Date().toISOString() })
            showToast(`🔑 ${holder} เบิกกุญแจ ${k.slot} แล้ว — บันทึก log`, 'warning')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    container.querySelectorAll('.in-btn').forEach(b => b.addEventListener('click', async () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (!k) return
      try {
        await updateDocData('keys', k.id, { status: 'in_cabinet', holder: null, purpose: null, since: new Date().toISOString() })
        showToast('🔐 คืนกุญแจเข้าตู้แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.lost-btn').forEach(b => b.addEventListener('click', async () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (!k) return
      try {
        await updateDocData('keys', k.id, { status: 'missing', holder: (k.holder||'') + ' (ล่าสุด)' })
        showToast('🚨 แจ้งกุญแจหาย — เปิด Incident อัตโนมัติ', 'error')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.found-btn').forEach(b => b.addEventListener('click', async () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (!k) return
      try {
        await updateDocData('keys', k.id, { status: 'in_cabinet', holder: null, purpose: null, since: new Date().toISOString() })
        showToast('✅ เจอกุญแจแล้ว — คืนเข้าตู้', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
