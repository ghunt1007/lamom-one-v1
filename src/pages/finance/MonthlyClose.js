/**
 * Monthly Close — ปิดงบประจำเดือน
 * Route: /finance/monthly-close
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addMonths(n) { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7) }

const STATUS_MAP = {
  done:    { label: 'เสร็จ', color: 'success', icon: '✅' },
  pending: { label: 'รอดำเนินการ', color: 'warning', icon: '⏳' },
  review:  { label: 'รอตรวจ', color: 'primary', icon: '🔍' },
  locked:  { label: 'ล็อค', color: 'secondary', icon: '🔒' },
}

export default async function MonthlyClosePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let allItems = []
  let closings = []
  let currentMonth = addMonths(0)
  let loading = true

  async function loadData() {
    loading = true
    try {
      allItems = await listDocs('monthly_close_items', [], 'category', 'asc', 500)
      closings = await listDocs('financial_closings', [], 'period', 'desc', 100)
    } catch (e) { allItems = []; closings = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const items = allItems.filter(i => (i.period || addMonths(0)) === currentMonth)
    const isClosed = closings.some(c => c.period === currentMonth)
    const revenue = items.filter(i => i.amount > 0).reduce((a, i) => a + i.amount, 0)
    const costs = items.filter(i => i.amount < 0).reduce((a, i) => a + i.amount, 0)
    const netProfit = revenue + costs
    const margin = revenue > 0 ? Math.round(netProfit / revenue * 100) : 0
    const donePct = items.length ? Math.round(items.filter(i => i.status === 'done').length / items.length * 100) : 100
    const pendingCount = items.filter(i => ['pending', 'review'].includes(i.status)).length
    const cats = [...new Set(items.map(i => i.category))]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 Monthly Close</div>
            <div class="page-subtitle">ปิดงบประจำเดือน — ${currentMonth}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="prev-month-btn">◀ เดือนก่อน</button>
            <button class="btn btn-secondary btn-xs" id="curr-month-btn">เดือนนี้</button>
            ${!isClosed && pendingCount === 0
              ? `<button class="btn btn-primary" id="close-btn">🔒 ปิดงบเดือนนี้</button>`
              : isClosed
                ? `<span class="badge badge-success" style="padding:8px 14px">🔒 ปิดงบแล้ว</span>`
                : `<button class="btn btn-secondary" id="close-btn" disabled>⏳ รอ ${pendingCount} รายการ</button>`
            }
          </div>
        </div>

        <!-- Progress bar -->
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
            <span>ความคืบหน้า</span><span style="color:var(--${donePct===100?'success':'warning'})">${donePct}%</span>
          </div>
          <div style="background:var(--surface-2);border-radius:4px;height:8px">
            <div style="width:${donePct}%;background:var(--${donePct===100?'success':'warning'});height:8px;border-radius:4px"></div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 รายรับรวม', formatCurrency(revenue), 'primary')}
          ${kpi('📉 ต้นทุน+ค่าใช้จ่าย', formatCurrency(Math.abs(costs)), 'warning')}
          ${kpi('📊 กำไรสุทธิ', formatCurrency(netProfit), netProfit >= 0 ? 'success' : 'danger')}
          ${kpi('📈 Net Margin', margin + '%', margin >= 15 ? 'success' : margin >= 8 ? 'warning' : 'danger')}
        </div>

        <!-- Items by category -->
        ${cats.map(cat => {
          const catItems = items.filter(i => i.category === cat)
          return `<div class="card" style="overflow:hidden;margin-bottom:10px">
            <div style="padding:8px 14px;border-bottom:1px solid var(--border);background:var(--surface-2);font-size:0.78rem;font-weight:700">${escHtml(cat)}</div>
            <table style="width:100%;border-collapse:collapse">
              <tbody>
                ${catItems.map(i => {
                  const sm = STATUS_MAP[isClosed ? 'locked' : i.status]
                  return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                    <td style="padding:8px 14px;font-weight:500">${escHtml(i.name)}</td>
                    <td style="padding:8px 10px;color:var(--text-muted);font-size:0.73rem">${escHtml(i.responsible)}</td>
                    <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--${i.amount>=0?'success':'danger'})">${i.amount>=0?'+':''}${formatCurrency(i.amount)}</td>
                    <td style="padding:8px 10px;text-align:center"><span class="badge badge-${sm?.color}" style="font-size:0.6rem">${sm?.icon} ${sm?.label}</span></td>
                    <td style="padding:8px 14px;text-align:right">
                      ${!isClosed && i.status !== 'done' ? `<button class="btn btn-xs btn-success mark-done-btn" data-id="${escHtml(i.id)}">✅ เสร็จ</button>` : ''}
                    </td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>`
        }).join('')}
      </div>
    `

    container.querySelectorAll('.mark-done-btn').forEach(b => b.addEventListener('click', async () => {
      try {
        await updateDocData('monthly_close_items', b.dataset.id, { status: 'done' })
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('prev-month-btn')?.addEventListener('click', () => { const d = new Date(currentMonth + '-01'); d.setMonth(d.getMonth()-1); currentMonth = d.toISOString().slice(0,7); renderPage() })
    document.getElementById('curr-month-btn')?.addEventListener('click', () => { currentMonth = addMonths(0); renderPage() })
    document.getElementById('close-btn')?.addEventListener('click', () => {
      openModal({
        title: '🔒 ปิดงบเดือน ' + currentMonth,
        size: 'sm',
        body: `<p style="font-size:0.85rem">ยืนยันปิดงบ? ข้อมูลจะถูกล็อคและไม่สามารถแก้ไขได้</p>
               <p style="font-size:0.85rem;color:var(--success)">กำไรสุทธิ: <strong>${formatCurrency(netProfit)}</strong></p>`,
        confirmText: '🔒 ปิดงบ',
        async onConfirm() {
          try {
            await createDoc('financial_closings', { period: currentMonth, closedAt: new Date().toISOString(), closedBy: 'พนักงาน', revenue, costs, netProfit, margin })
            showToast('✅ ปิดงบเดือน ' + currentMonth + ' แล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
