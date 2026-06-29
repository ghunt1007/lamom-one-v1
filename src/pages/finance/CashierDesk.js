/**
 * Cashier Desk — จุดรับชำระเงิน
 * Route: /finance/cashier
 */
import { formatCurrency, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addMinutes(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const PAY_METHODS = {
  cash:     { label: 'เงินสด', icon: '💵' },
  transfer: { label: 'โอน/PromptPay', icon: '📲' },
  card:     { label: 'บัตรเครดิต', icon: '💳' },
  cheque:   { label: 'เช็ค', icon: '🏦' },
}

const DEMO_PAYMENTS = [
  { id: 'PM001', customer: 'สมชาย ใจดี', ref: 'IV2406-042', desc: 'ค่าเช็คระยะ 20,000 km', amount: 3745, method: 'transfer', time: addMinutes(15), cashier: 'สมศรี การเงิน' },
  { id: 'PM002', customer: 'มาลี สุขใจ', ref: 'IV2406-041', desc: 'ค่าอะไหล่ + ฟิล์ม', amount: 13375, method: 'card', time: addMinutes(95), cashier: 'สมศรี การเงิน' },
  { id: 'PM003', customer: 'อรทัย ตั้งใจ', ref: 'BK2406-008', desc: 'มัดจำจองรถ MG4', amount: 10000, method: 'transfer', time: addMinutes(180), cashier: 'สมศรี การเงิน' },
  { id: 'PM004', customer: 'วิรัช เก่งมาก', ref: 'IV2406-040', desc: 'ค่าล้าง + Detailing', amount: 2675, method: 'cash', time: addMinutes(260), cashier: 'สมศรี การเงิน' },
]

const PENDING_BILLS = [
  { id: 'IV2406-043', customer: 'ธนพล เที่ยงตรง', desc: 'ค่าซ่อมเบรก (Job J002)', amount: 9095 },
  { id: 'IV2406-044', customer: 'ชาตรี เข้มแข็ง', desc: 'ค่าอะไหล่ใบปัดน้ำฝน', amount: 696 },
]

export default async function CashierDeskPage(container) {
  let payments = DEMO_PAYMENTS.map(p => ({ ...p }))
  let pending = PENDING_BILLS.map(b => ({ ...b }))

  function renderPage() {
    const todayTotal = payments.reduce((a, p) => a + p.amount, 0)
    const byMethod = Object.keys(PAY_METHODS).map(k => ({ k, total: payments.filter(p => p.method === k).reduce((a, p) => a + p.amount, 0) }))
    const cashInDrawer = byMethod.find(m => m.k === 'cash')?.total || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💵 Cashier Desk</div>
            <div class="page-subtitle">จุดรับชำระ — วันนี้</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="close-shift-btn">🔒 ปิดกะ + นับเงิน</button>
            <button class="btn btn-primary" id="new-pay-btn">+ รับชำระ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 รับวันนี้', formatCurrency(todayTotal), 'success')}
          ${kpi('💵 เงินสดในลิ้นชัก', formatCurrency(cashInDrawer), 'warning')}
          ${kpi('🧾 รายการ', payments.length, 'primary')}
          ${kpi('⏳ บิลรอชำระ', pending.length, pending.length > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <!-- Pending bills -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⏳ บิลรอชำระ</div>
            ${pending.length === 0 ? '<div style="text-align:center;color:var(--success);font-size:0.8rem;padding:14px">✅ ไม่มีบิลค้าง</div>' : pending.map(b => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:0.8rem;font-weight:600">${escHtml(b.customer)}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${escHtml(b.id)} — ${escHtml(b.desc)}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <strong style="font-size:0.85rem">${formatCurrency(b.amount)}</strong>
                  <button class="btn btn-xs btn-success collect-btn" data-id="${escHtml(b.id)}">💵 รับเงิน</button>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- By method -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 แยกตามช่องทาง</div>
            ${byMethod.map(m => {
              const pm = PAY_METHODS[m.k]
              const pct = todayTotal > 0 ? Math.round(m.total / todayTotal * 100) : 0
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
                  <span>${pm.icon} ${pm.label}</span><strong>${formatCurrency(m.total)} (${pct}%)</strong>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:8px">
                  <div style="width:${pct}%;background:var(--primary);height:8px;border-radius:3px"></div>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Payment log -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">🧾 รายการรับชำระวันนี้</div>
          <table style="width:100%;border-collapse:collapse">
            <tbody>
              ${payments.map(p => {
                const pm = PAY_METHODS[p.method]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px">
                    <div style="font-weight:600">${escHtml(p.customer)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">${escHtml(p.ref)} — ${escHtml(p.desc)}</div>
                  </td>
                  <td style="padding:8px 10px;text-align:center"><span class="badge badge-secondary" style="font-size:0.6rem">${pm?.icon} ${pm?.label}</span></td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--success)">${formatCurrency(p.amount)}</td>
                  <td style="padding:8px 14px;text-align:right;font-size:0.68rem;color:var(--text-muted)">${timeAgo(p.time)}</td>
                  <td style="padding:8px 14px;text-align:right"><button class="btn btn-xs btn-secondary">🖨 ใบเสร็จ</button></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.collect-btn').forEach(b => b.addEventListener('click', () => {
      const bill = pending.find(x => x.id === b.dataset.id)
      if (bill) openCollect(bill)
    }))
    document.getElementById('new-pay-btn')?.addEventListener('click', () => openCollect())
    document.getElementById('close-shift-btn')?.addEventListener('click', () => {
      openModal({
        title: '🔒 ปิดกะ + นับเงิน',
        size: 'sm',
        body: `<div style="display:grid;gap:10px;font-size:0.82rem">
          <div style="display:flex;justify-content:space-between"><span>💵 เงินสดตามระบบ</span><strong>${formatCurrency(cashInDrawer)}</strong></div>
          <div class="input-group"><label class="input-label">นับเงินสดจริงได้ (บาท)</label><input class="input" type="number" id="cs-counted" value="${cashInDrawer}"></div>
        </div>`,
        confirmText: '🔒 ปิดกะ',
        onConfirm() {
          const counted = parseInt(document.getElementById('cs-counted')?.value) || 0
          const diff = counted - cashInDrawer
          if (diff === 0) showToast('✅ ปิดกะสำเร็จ — เงินตรงพอดี!', 'success')
          else showToast(`⚠️ ปิดกะ — เงิน${diff > 0 ? 'เกิน' : 'ขาด'} ${formatCurrency(Math.abs(diff))} (บันทึกผลต่าง)`, 'warning')
        }
      })
    })
  }

  function openCollect(bill = null) {
    openModal({
      title: '💵 รับชำระเงิน',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="py-customer" value="${escHtml(bill?.customer||'')}"></div>
        <div class="input-group"><label class="input-label">รายการ</label><input class="input" id="py-desc" value="${escHtml(bill?.desc||'')}"></div>
        <div class="input-group"><label class="input-label">จำนวนเงิน *</label><input class="input" type="number" id="py-amount" value="${bill?.amount||''}"></div>
        <div class="input-group"><label class="input-label">ช่องทาง</label>
          <select class="input" id="py-method">${Object.entries(PAY_METHODS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
      </div>`,
      confirmText: '💵 รับเงิน + พิมพ์ใบเสร็จ',
      onConfirm() {
        const customer = document.getElementById('py-customer')?.value?.trim()
        const amount = parseInt(document.getElementById('py-amount')?.value) || 0
        if (!customer || amount <= 0) { showToast('❗ กรอกชื่อและจำนวนเงิน', 'error'); return }
        payments.unshift({ id:`PM${String(payments.length+1).padStart(3,'0')}`, customer, ref:bill?.id||'MISC', desc:document.getElementById('py-desc')?.value||'—', amount, method:document.getElementById('py-method')?.value||'cash', time:new Date().toISOString(), cashier:'คุณ (Demo)' })
        if (bill) pending = pending.filter(x => x.id !== bill.id)
        showToast(`✅ รับชำระ ${formatCurrency(amount)} — พิมพ์ใบเสร็จแล้ว`, 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
