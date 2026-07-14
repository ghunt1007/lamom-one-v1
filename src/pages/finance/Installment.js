/**
 * Installment Tracking — ติดตามงวดผ่อนลูกค้าที่ซื้อตรง
 * Route: /finance/installment
 */
import { formatDate } from '../../utils/format.js'
import { showToast, getState, setState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'

function addMonths(dateStr, n) {
  const d = dateStr ? new Date(dateStr) : new Date()
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

// ── แจ้งเตือนฝ่ายที่เกี่ยวข้อง — ใช้ pattern เดียวกับ notifyDept() ใน Bookings.js ──
async function notifyInstallment(title, body) {
  try {
    await createDoc('notifications', { type: 'finance', title, body, read: false, link: '/finance/installment', createdAt: new Date().toISOString() })
    setState('unreadCount', (getState('unreadCount') || 0) + 1)
  } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบข้อมูลหลักที่บันทึกไปแล้ว */ }
}

export default async function InstallmentPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let plans = []
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    if (container.__routerGen === myGen) renderLoading()
    try { plans = await listDocs('installment_plans', [], 'createdAt', 'desc', 200) } catch (e) { plans = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function renderLoading() {
    container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
  }

  function planCard(p) {
    const totalInst  = p.totalInst || 1
    const paid       = p.paid || 0
    const pct        = Math.round(paid / totalInst * 100)
    const remaining  = totalInst - paid
    const balance    = remaining * (p.monthly || 0)
    const isOD   = p.status === 'overdue'
    const isDone = p.status === 'completed'
    const statusBg    = isDone ? 'var(--success)' : isOD ? 'var(--danger)' : 'var(--primary)'
    const statusLabel = isDone ? '✅ ชำระครบ' : isOD ? '⚠️ ค้างชำระ' : '💳 ปกติ'
    const overdueStr  = isOD ? ' <span style="color:var(--danger);font-weight:700">ค้าง ' + (p.overdue || 0) + ' วัน</span>' : ''
    const nextStr     = isDone ? 'ปิดบัญชีแล้ว' : 'งวดถัดไป ' + formatDate(p.nextDate)
    const remindBtn   = isOD  ? '<button class="btn btn-xs btn-primary remind-btn" data-id="' + p.id + '" style="font-size:0.68rem">📱 ทวง</button>' : ''
    const payBtn      = !isDone ? '<button class="btn btn-xs btn-secondary pay-btn" data-id="' + p.id + '" style="font-size:0.68rem">💳 บันทึกงวด</button>' : ''
    return `<div class="card" style="padding:14px;border-left:3px solid ${statusBg}">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:1.4rem">💳</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.88rem">${p.customer}</span>
            <span style="font-size:0.66rem;color:var(--text-muted)">${p.model}</span>
            <span style="font-size:0.62rem;background:${statusBg};color:#fff;padding:1px 8px;border-radius:8px">${statusLabel}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">
            ผ่อน ${(p.monthly || 0).toLocaleString()} บ./เดือน · ชำระแล้ว ${paid}/${totalInst} งวด${overdueStr}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <div style="flex:1;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${statusBg};border-radius:3px"></div>
            </div>
            <span style="font-size:0.64rem;color:var(--text-muted)">${pct}%</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted)">
            ยอดค้างอยู่ ฿${balance.toLocaleString()} · ${nextStr}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">${remindBtn}${payBtn}</div>
      </div>
    </div>`
  }

  function render() {
    let rows = plans
    if (filterStatus !== 'all') rows = rows.filter(p => p.status === filterStatus)

    const overdue   = plans.filter(p => p.status === 'overdue').length
    const current   = plans.filter(p => p.status === 'current').length
    const completed = plans.filter(p => p.status === 'completed').length
    const totalBal  = plans.filter(p => p.status !== 'completed').reduce((s, p) => s + ((p.totalInst || 0) - (p.paid || 0)) * (p.monthly || 0), 0)

    const filterBtns = ['all', 'overdue', 'current', 'completed'].map(s => {
      const label = s === 'all' ? 'ทั้งหมด' : s === 'overdue' ? '⚠️ ค้างชำระ' : s === 'current' ? '💳 ปกติ' : '✅ ปิดบัญชี'
      return '<button class="btn btn-xs ' + (filterStatus === s ? 'btn-primary' : 'btn-secondary') + ' stat-btn" data-s="' + s + '">' + label + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Installment Tracking</div>
            <div class="page-subtitle">ติดตามงวดผ่อนลูกค้าที่ซื้อตรง · ${plans.length} สัญญา</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="remind-all-btn">📱 ทวงทั้งหมด</button>
            <button class="btn btn-primary" id="add-plan-btn">+ สัญญาใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('⚠️ ค้างชำระ', overdue + ' สัญญา', 'var(--danger)')}
          ${sc('💳 ปกติ', current + ' สัญญา', 'var(--primary)')}
          ${sc('✅ ปิดบัญชี', completed + ' สัญญา', 'var(--success)')}
          ${sc('💰 ยอดค้างรวม', '฿' + totalBal.toLocaleString(), 'var(--warning)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(p => planCard(p)).join('')}
          ${rows.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>' : ''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.s; render() }))

    container.querySelectorAll('.remind-btn').forEach(b => b.addEventListener('click', async () => {
      const p = plans.find(x => x.id === b.dataset.id)
      if (!p) return
      await notifyInstallment(
        '📱 ทวงถามลูกค้าค้างชำระ: ' + p.customer,
        p.customer + ' (' + p.model + ') ค้างชำระ ' + (p.overdue || 0) + ' วัน · ผ่อน ' + (p.monthly || 0).toLocaleString() + ' บ./เดือน · สัญญา ' + p.id
      )
      showToast('📱 ส่งแจ้งเตือน SMS/LINE ให้ ' + p.customer + ' แล้ว', 'success')
    }))

    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', async () => {
      const p = plans.find(x => x.id === b.dataset.id)
      if (!p || p.status === 'completed') return
      const newPaid = (p.paid || 0) + 1
      const totalInst = p.totalInst || 1
      const isDone = newPaid >= totalInst
      const paidHistory = Array.isArray(p.paidHistory) ? [...p.paidHistory] : []
      paidHistory.push({ date: new Date().toISOString().slice(0, 10), amount: p.monthly || 0 })
      const btn = b
      btn.disabled = true
      try {
        await updateDocData('installment_plans', p.id, {
          paid: newPaid,
          status: isDone ? 'completed' : 'current',
          overdue: 0,
          nextDate: isDone ? '' : addMonths(p.nextDate, 1),
          paidHistory,
        })
        showToast('💳 บันทึกงวด ' + newPaid + '/' + totalInst + ' ให้ ' + p.customer, 'success')
        await loadData()
      } catch (e) {
        btn.disabled = false
        showToast('บันทึกไม่สำเร็จ', 'error')
      }
    }))

    document.getElementById('remind-all-btn')?.addEventListener('click', async () => {
      const overduePlans = plans.filter(p => p.status === 'overdue')
      if (!overduePlans.length) { showToast('ไม่มีรายการค้างชำระ', 'info'); return }
      await notifyInstallment(
        '📱 ทวงถามลูกค้าค้างชำระทั้งหมด ' + overduePlans.length + ' ราย',
        overduePlans.map(p => p.customer + ' (ค้าง ' + (p.overdue || 0) + ' วัน)').join(', ')
      )
      showToast('📱 ส่งทวงถามทั้ง ' + overduePlans.length + ' รายที่ค้างชำระแล้ว', 'success')
    })

    document.getElementById('add-plan-btn')?.addEventListener('click', openAddForm)
  }

  function openAddForm() {
    openModal({
      title: '+ สัญญาผ่อนใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="ip-customer" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">รุ่นรถ *</label><input class="input" id="ip-model" placeholder="เช่น BYD Atto 3"></div>
          <div class="input-group"><label class="input-label">ราคารวม (บาท) *</label><input type="number" class="input" id="ip-total" placeholder="0"></div>
          <div class="input-group"><label class="input-label">จำนวนงวดทั้งหมด *</label><input type="number" class="input" id="ip-totalinst" placeholder="36"></div>
          <div class="input-group"><label class="input-label">ผ่อนต่อเดือน (บาท) *</label><input type="number" class="input" id="ip-monthly" placeholder="0"></div>
          <div class="input-group"><label class="input-label">งวดถัดไป</label><input type="date" class="input" id="ip-nextdate" value="${new Date().toISOString().slice(0, 10)}"></div>
        </div>
      `,
      async onConfirm() {
        const customer = document.getElementById('ip-customer')?.value?.trim()
        const model = document.getElementById('ip-model')?.value?.trim()
        const total = +document.getElementById('ip-total')?.value || 0
        const totalInst = +document.getElementById('ip-totalinst')?.value || 0
        const monthly = +document.getElementById('ip-monthly')?.value || 0
        if (!customer) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return false }
        if (!model) { showToast('❗ กรุณากรอกรุ่นรถ', 'error'); return false }
        if (total <= 0 || totalInst <= 0 || monthly <= 0) { showToast('❗ กรุณากรอกยอดเงิน/จำนวนงวดให้ครบ', 'error'); return false }
        try {
          await createDoc('installment_plans', {
            customer, model, total, totalInst, monthly,
            paid: 0, overdue: 0, status: 'current',
            nextDate: document.getElementById('ip-nextdate')?.value || new Date().toISOString().slice(0, 10),
            paidHistory: [],
          })
          showToast('✅ สร้างสัญญาผ่อนใหม่แล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
