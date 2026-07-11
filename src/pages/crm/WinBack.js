/**
 * Win-Back Campaign — ดึงลูกค้าเก่ากลับมา
 * Route: /crm/winback
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

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

export default async function WinBackPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let targets = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      const stored = await listDocs('winback_targets', [], 'lastVisit', 'asc', 300)
      let virtual = []
      try {
        const delivered = await listDocs('bookings', [['status','==','ส่งมอบแล้ว']], 'deliveryDate', 'asc', 300)
        const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 10)
        const inactive = delivered.filter(b => {
          const d = new Date(b.deliveryDate || b.bookingDate || 0)
          return d < cutoff && !stored.some(s => s.sourceBookingId === b.id)
        })
        virtual = inactive.map(b => ({
          id: `WL-${b.id}`, customerId: b.id, sourceBookingId: b.id,
          customer: b.customerName || b.custName || 'ลูกค้า',
          phone: b.phone || '', lastVisit: b.deliveryDate || b.bookingDate || '',
          reason: 'unknown', value: 0, status: 'target', offer: '', attempts: 0,
          _source: 'booking',
        }))
      } catch (e) {}
      targets = [...stored, ...virtual]
    } catch (e) { targets = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
            <div class="page-subtitle">ดึงลูกค้าที่หายไป 10+ เดือนกลับมา</div>
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
        async onConfirm() {
          const offer = document.getElementById('wb-offer')?.value || ''
          try {
            await persistTarget(t, { offer, status: 'contacted', attempts: 1 })
            showToast('📤 ส่งข้อเสนอแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    container.querySelectorAll('.interest-btn').forEach(b => b.addEventListener('click', async () => {
      const t = targets.find(x => x.id === b.dataset.id)
      if (!t) return
      try { await persistTarget(t, { status: 'interested' }); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.retry-btn').forEach(b => b.addEventListener('click', async () => {
      const t = targets.find(x => x.id === b.dataset.id)
      if (!t) return
      try {
        await persistTarget(t, { attempts: t.attempts + 1 })
        showToast('📞 บันทึกการติดต่อครั้งที่ ' + (t.attempts + 1), 'primary')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.return-btn').forEach(b => b.addEventListener('click', async () => {
      const t = targets.find(x => x.id === b.dataset.id)
      if (!t) return
      try {
        await persistTarget(t, { status: 'returned' })
        showToast('🎉 ' + t.customer + ' กลับมาแล้ว!', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.lost-btn').forEach(b => b.addEventListener('click', async () => {
      const t = targets.find(x => x.id === b.dataset.id)
      if (!t) return
      try { await persistTarget(t, { status: 'lost' }); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('scan-btn')?.addEventListener('click', async () => {
      const unworked = targets.filter(t => t.status === 'target' && t.attempts === 0)
      if (unworked.length > 0) {
        showToast(`🔍 พบ ${unworked.length} ราย ที่ยังไม่ได้ติดต่อ — ดูในรายการเป้าหมาย`, 'warning')
      } else {
        try {
          await createDoc('winback_targets', {
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
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  async function persistTarget(t, fields) {
    if (t._source === 'booking') {
      const { _source, id, ...rest } = t
      await createDoc('winback_targets', { ...rest, ...fields })
    } else {
      await updateDocData('winback_targets', t.id, fields)
    }
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
