/**
 * Floor Plan Finance — สินเชื่อสต็อกรถ (Stocking Loan)
 * Route: /dms/floorplan
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const FP_RATE = 6.5 // % ต่อปี
const CREDIT_LINE = 50000000

function daysHeld(u) { return Math.round((new Date() - new Date(u.drawDate)) / 86400000) }
function interestAccrued(u) { return Math.round(u.principal * (FP_RATE / 100) * daysHeld(u) / 365) }

export default async function FloorPlanFinancePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let units = []
  let loading = true

  async function loadData() {
    loading = true
    try { units = await listDocs('floor_plan', [], 'drawDate', 'desc', 200) } catch (e) { units = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const active = units.filter(u => u.status === 'active')
    const outstanding = active.reduce((a, u) => a + u.principal, 0)
    const totalInterest = active.reduce((a, u) => a + interestAccrued(u), 0)
    const available = CREDIT_LINE - outstanding
    const utilization = Math.round(outstanding / CREDIT_LINE * 100)
    const aging = active.filter(u => daysHeld(u) > 120)
    const dailyInterest = Math.round(active.reduce((a, u) => a + u.principal * (FP_RATE/100) / 365, 0))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Floor Plan Finance</div>
            <div class="page-subtitle">สินเชื่อสต็อกรถ — วงเงิน ${formatCurrency(CREDIT_LINE)} @ ${FP_RATE}%/ปี</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="draw-btn">+ เบิกวงเงิน (รถเข้าใหม่)</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 ยอดเบิกคงค้าง', formatCurrency(outstanding), 'warning')}
          ${kpi('📊 ใช้วงเงิน', utilization + '%', utilization >= 80 ? 'danger' : utilization >= 60 ? 'warning' : 'success')}
          ${kpi('💸 ดอกเบี้ยสะสม', formatCurrency(totalInterest), 'danger')}
          ${kpi('🔥 ดอกเบี้ย/วัน', formatCurrency(dailyInterest), 'secondary')}
        </div>

        <!-- Credit line bar -->
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:4px">
            <span style="color:var(--text-muted)">วงเงินคงเหลือ ${formatCurrency(available)}</span>
            <span>${formatCurrency(outstanding)} / ${formatCurrency(CREDIT_LINE)}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:4px;height:12px">
            <div style="width:${utilization}%;background:var(--${utilization>=80?'danger':utilization>=60?'warning':'primary'});height:12px;border-radius:4px"></div>
          </div>
        </div>

        ${aging.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🔥 <strong>รถค้างเกิน 120 วัน (ดอกเบี้ยกินกำไร):</strong> ${aging.map(u => `${escHtml(u.model)} (${daysHeld(u)} วัน — ดอกแล้ว ${formatCurrency(interestAccrued(u))})`).join(' · ')} — เร่งขาย/ลดราคา!
          </div>
        ` : ''}

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">รถ</th>
                <th style="padding:8px 10px;text-align:right">เงินต้น</th>
                <th style="padding:8px 10px;text-align:right">ถือมา (วัน)</th>
                <th style="padding:8px 10px;text-align:right">ดอกเบี้ยสะสม</th>
                <th style="padding:8px 10px;text-align:right">ดอก/วัน</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${units.map(u => {
                const days = daysHeld(u)
                const interest = interestAccrued(u)
                const perDay = Math.round(u.principal * (FP_RATE/100) / 365)
                const isAging = days > 120 && u.status === 'active'
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${u.status==='paid'?';opacity:0.5':''}${isAging?';background:var(--danger)08':''}">
                  <td style="padding:8px 14px">
                    <div style="font-weight:600">${escHtml(u.model)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">VIN ${escHtml(u.vin)} · เบิก ${formatDate(u.drawDate)}</div>
                  </td>
                  <td style="padding:8px 10px;text-align:right">${formatCurrency(u.principal)}</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--${days>120?'danger':days>90?'warning':'text-muted'})">${days}${isAging?' 🔥':''}</td>
                  <td style="padding:8px 10px;text-align:right;color:var(--danger)">${u.status==='active'?formatCurrency(interest):'—'}</td>
                  <td style="padding:8px 10px;text-align:right;font-size:0.72rem;color:var(--text-muted)">${u.status==='active'?formatCurrency(perDay):'—'}</td>
                  <td style="padding:8px 14px;text-align:right">
                    ${u.status === 'active' ? `<button class="btn btn-xs btn-success payoff-btn" data-id="${u.id}">💵 ขายแล้ว — ปิดยอด</button>` : '<span class="badge badge-success" style="font-size:0.6rem">✅ ปิดแล้ว</span>'}
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 ขายรถแล้วต้องปิดยอด Floor Plan ภายใน 3 วันทำการ — ดอกเบี้ยคิดรายวันจนกว่าจะปิด</p>
      </div>
    `

    container.querySelectorAll('.payoff-btn').forEach(b => b.addEventListener('click', () => {
      const u = units.find(x => x.id === b.dataset.id)
      if (u) openModal({
        title: '💵 ปิดยอด Floor Plan',
        size: 'sm',
        body: `<div style="font-size:0.82rem;line-height:1.8">
          <div style="display:flex;justify-content:space-between"><span>${escHtml(u.model)}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">เงินต้น</span><strong>${formatCurrency(u.principal)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">ดอกเบี้ย ${daysHeld(u)} วัน</span><strong style="color:var(--danger)">${formatCurrency(interestAccrued(u))}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:6px"><span>ยอดปิดรวม</span><strong style="color:var(--primary)">${formatCurrency(u.principal + interestAccrued(u))}</strong></div>
        </div>`,
        confirmText: '💵 โอนปิดยอด',
        async onConfirm() {
          try {
            await updateDocData('floor_plan', u.id, { status: 'paid', sold: true })
            showToast(`✅ ปิดยอด ${formatCurrency(u.principal + interestAccrued(u))} แล้ว — วงเงินคืนกลับ`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    document.getElementById('draw-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เบิกวงเงิน (รถเข้าสต็อกใหม่)',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">รุ่นรถ *</label><input class="input" id="fp-model"></div>
          <div class="input-group"><label class="input-label">ราคาทุน (บาท)</label><input class="input" type="number" id="fp-amount"></div>
          <div style="font-size:0.72rem;color:var(--text-muted)">วงเงินคงเหลือ: <strong>${formatCurrency(available)}</strong></div>
        </div>`,
        async onConfirm() {
          const model = document.getElementById('fp-model')?.value?.trim()
          const amount = parseInt(document.getElementById('fp-amount')?.value) || 0
          if (!model || amount <= 0) { showToast('❗ กรอกข้อมูลให้ครบ', 'error'); return false }
          if (amount > available) { showToast('❗ เกินวงเงินคงเหลือ', 'error'); return false }
          try {
            await createDoc('floor_plan', { model, vin:'...ใหม่', principal:amount, drawDate:addDays(0), status:'active', sold:false })
            showToast(`✅ เบิก ${formatCurrency(amount)} แล้ว — ดอกเบี้ยเริ่มเดินวันนี้`, 'warning')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
