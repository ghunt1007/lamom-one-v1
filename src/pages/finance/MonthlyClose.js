/**
 * Monthly Close — ปิดงบประจำเดือน
 * Route: /finance/monthly-close
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addMonths(n) { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7) }

const CLOSE_ITEMS = [
  { id: 'CI01', category: 'รายรับ', name: 'รายรับขายรถ', status: 'done', amount: 12987000, responsible: 'การเงิน' },
  { id: 'CI02', category: 'รายรับ', name: 'รายรับบริการ', status: 'done', amount: 524000, responsible: 'บริการ' },
  { id: 'CI03', category: 'รายรับ', name: 'รายรับประกัน', status: 'done', amount: 187000, responsible: 'ประกัน' },
  { id: 'CI04', category: 'ต้นทุน', name: 'ต้นทุนรถ (COGS)', status: 'done', amount: -10389600, responsible: 'การเงิน' },
  { id: 'CI05', category: 'ต้นทุน', name: 'ต้นทุนอะไหล่', status: 'done', amount: -198000, responsible: 'บริการ' },
  { id: 'CI06', category: 'ค่าใช้จ่าย', name: 'เงินเดือนพนักงาน', status: 'pending', amount: -680000, responsible: 'HR' },
  { id: 'CI07', category: 'ค่าใช้จ่าย', name: 'ค่าเช่า + สาธารณูปโภค', status: 'done', amount: -120000, responsible: 'การเงิน' },
  { id: 'CI08', category: 'ค่าใช้จ่าย', name: 'ค่าการตลาด', status: 'pending', amount: -85000, responsible: 'การตลาด' },
  { id: 'CI09', category: 'ค่าใช้จ่าย', name: 'ค่า Commission', status: 'pending', amount: -259740, responsible: 'การเงิน' },
  { id: 'CI10', category: 'ปรับปรุง', name: 'ค่าเสื่อมราคา', status: 'review', amount: -45000, responsible: 'การเงิน' },
  { id: 'CI11', category: 'ปรับปรุง', name: 'ปรับมูลค่าสต็อก', status: 'review', amount: -12000, responsible: 'DMS' },
]

const STATUS_MAP = {
  done:    { label: 'เสร็จ', color: 'success', icon: '✅' },
  pending: { label: 'รอดำเนินการ', color: 'warning', icon: '⏳' },
  review:  { label: 'รอตรวจ', color: 'primary', icon: '🔍' },
  locked:  { label: 'ล็อค', color: 'secondary', icon: '🔒' },
}

export default async function MonthlyClosePage(container) {
  const myGen = container.__routerGen
  let items = CLOSE_ITEMS.map(i => ({ ...i }))
  let currentMonth = addMonths(0)
  let isClosed = false
  let dataSource = 'demo'

  try {
    const docs = await listDocs('monthly_close_items', [], 'id', 'asc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `CI${String(i+1).padStart(2,'0')}`,
        category: d.category || 'ค่าใช้จ่าย',
        name: d.name || d.title || 'รายการ',
        status: d.status || 'pending',
        amount: d.amount || 0,
        responsible: d.responsible || d.dept || '',
      }))
      items = [...mapped, ...CLOSE_ITEMS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const revenue = items.filter(i => i.amount > 0).reduce((a, i) => a + i.amount, 0)
    const costs = items.filter(i => i.amount < 0).reduce((a, i) => a + i.amount, 0)
    const netProfit = revenue + costs
    const margin = revenue > 0 ? Math.round(netProfit / revenue * 100) : 0
    const donePct = Math.round(items.filter(i => i.status === 'done').length / items.length * 100)
    const pendingCount = items.filter(i => ['pending', 'review'].includes(i.status)).length
    const cats = [...new Set(items.map(i => i.category))]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 Monthly Close</div>
            <div class="page-subtitle">ปิดงบประจำเดือน — ${currentMonth}${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
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

    container.querySelectorAll('.mark-done-btn').forEach(b => b.addEventListener('click', () => {
      const it = items.find(x => x.id === b.dataset.id); if (it) { it.status = 'done'; renderPage() }
    }))
    document.getElementById('prev-month-btn')?.addEventListener('click', () => { const d = new Date(currentMonth + '-01'); d.setMonth(d.getMonth()-1); currentMonth = d.toISOString().slice(0,7); renderPage() })
    document.getElementById('curr-month-btn')?.addEventListener('click', () => { currentMonth = addMonths(0); isClosed = false; renderPage() })
    document.getElementById('close-btn')?.addEventListener('click', () => {
      openModal({
        title: '🔒 ปิดงบเดือน ' + currentMonth,
        size: 'sm',
        body: `<p style="font-size:0.85rem">ยืนยันปิดงบ? ข้อมูลจะถูกล็อคและไม่สามารถแก้ไขได้</p>
               <p style="font-size:0.85rem;color:var(--success)">กำไรสุทธิ: <strong>${formatCurrency(netProfit)}</strong></p>`,
        confirmText: '🔒 ปิดงบ',
        onConfirm() { isClosed = true; showToast('✅ ปิดงบเดือน ' + currentMonth + ' แล้ว', 'success'); renderPage() }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
