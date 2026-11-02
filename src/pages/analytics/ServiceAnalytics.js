/**
 * Service Analytics — วิเคราะห์ศูนย์บริการ
 * Route: /analytics/service
 *
 * (v1.0.941) ใช้ข้อมูลจริงจากใบงานซ่อม (job_cards) อย่างเดียว — เดิมเดือนที่ไม่มีงานยังโชว์ตัวเลขตัวอย่าง
 * (98/112/105... งาน) ปนกับของจริงทั้งที่ป้ายบอก "ข้อมูลจริง" ชื่อเดือนตายตัว ม.ค.–มิ.ย. ไม่ตรงกับ 6 เดือนล่าสุด
 * และเวลาเฉลี่ย/CSAT/อัตราใช้ Bay เป็นตัวเลขสมมติทั้งหมด
 */
import { formatCurrency, todayBangkok, monthBangkok, toDate } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { kpi } from '../../utils/kpiCard.js'
import { escHtml } from '../../utils/escape.js'

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TYPE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']
const DONE = ['done', 'delivered', 'completed', 'เสร็จ', 'ส่งมอบแล้ว']

// เดือน (เวลาไทย) ของใบงาน: jobDate ถ้ามี ไม่งั้น createdAt
function jobMonth(j) {
  if (typeof j.jobDate === 'string' && /^\d{4}-\d{2}/.test(j.jobDate)) return j.jobDate.slice(0, 7)
  const d = toDate(j.createdAt)
  return d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7) : ''
}
// ยอดเงินของใบงาน: total ถ้ามี ไม่งั้น ค่าแรง + อะไหล่
export function jobAmount(j) {
  if (Number(j.total) > 0) return Number(j.total)
  const parts = Array.isArray(j.parts) ? j.parts.reduce((a, p) => a + (Number(p.qty) || 1) * (Number(p.price) || 0), 0) : Number(j.partsCost) || 0
  return (Number(j.labor) || 0) + parts
}

export default async function ServiceAnalyticsPage(container) {
  const myGen = container.__routerGen
  const today = todayBangkok()
  const months = [5, 4, 3, 2, 1, 0].map(k => monthBangkok(-k, today))
  const labels = months.map(m => TH_M[Number(m.slice(5, 7)) - 1])
  const nowYm = months[5]
  let jobs = []
  let metric = 'jobs'

  try {
    jobs = (await listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 1000).catch(() => [])).filter(j => !j.deleted)
    if (container.__routerGen !== myGen) return
  } catch {}

  const byMonth = months.map(m => jobs.filter(j => jobMonth(j) === m))
  const monthly = {
    jobs: byMonth.map(l => l.length),
    revenue: byMonth.map(l => l.reduce((a, j) => a + jobAmount(j), 0)),
  }
  const thisMonth = byMonth[5]

  function group(list, key, fallback) {
    const g = {}
    list.forEach(j => { const k = String(j[key] || '').trim() || fallback; (g[k] ||= { name: k, jobs: 0, revenue: 0 }); g[k].jobs++; g[k].revenue += jobAmount(j) })
    return Object.values(g).sort((a, b) => b.jobs - a.jobs || b.revenue - a.revenue)
  }

  function renderPage() {
    const jobsNow = monthly.jobs[5] // เดือนนี้ยังไม่จบ ไม่โชว์ % เทียบเดือนก่อน (ต้นเดือนจะขึ้น -100% เสมอ)
    const revNow = monthly.revenue[5]
    const openNow = jobs.filter(j => !DONE.includes(j.status)).length
    const avgTicket = jobsNow ? Math.round(revNow / jobsNow) : 0
    const data = monthly[metric]
    const maxV = Math.max(...data, 1)
    const types = group(thisMonth, 'type', 'ไม่ระบุประเภท')
    const techs = group(thisMonth, 'techName', 'ไม่ระบุช่าง').slice(0, 5)
    const bays = group(jobs.filter(j => !DONE.includes(j.status)), 'bay', 'ไม่ระบุช่องซ่อม')
    const empty = '<div style="padding:14px;text-align:center;font-size:0.76rem;color:var(--text-muted)">ยังไม่มีใบงานเดือนนี้</div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔧 วิเคราะห์ศูนย์บริการ</div>
            <div class="page-subtitle">จากใบงานซ่อมจริง — 6 เดือนล่าสุด${jobs.length ? '' : ' · ยังไม่มีใบงาน'}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="export-btn">📤 ส่งออก</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔧 งานเดือนนี้', jobsNow + ' งาน', 'success')}
          ${kpi('💰 รายได้เดือนนี้', formatCurrency(revNow), 'primary')}
          ${kpi('🧾 เฉลี่ยต่องาน', jobsNow ? formatCurrency(avgTicket) : '—', 'accent')}
          ${kpi('⏳ งานที่ยังไม่เสร็จ', openNow + ' งาน', openNow ? 'warning' : 'success')}
        </div>

        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">📈 แนวโน้ม 6 เดือน</div>
            <div style="display:flex;gap:4px">
              ${[['jobs', 'งาน'], ['revenue', 'รายได้']].map(([k, l]) =>
                `<button class="btn btn-xs ${metric === k ? 'btn-primary' : 'btn-secondary'} mx-btn" data-m="${k}">${l}</button>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end;height:90px">
            ${data.map((v, i) => {
              const pct = Math.round(v / maxV * 100)
              const isLast = i === data.length - 1
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="font-size:0.62rem;color:var(--${isLast ? 'primary' : 'text-muted'});font-weight:${isLast ? 700 : 400}">${metric === 'revenue' ? Math.round(v / 1000) + 'K' : v}</div>
                <div style="width:100%;background:${isLast ? 'var(--primary)' : 'var(--surface-2)'};border:1px solid ${isLast ? 'var(--primary)' : 'var(--border)'};border-radius:3px 3px 0 0;height:${pct * 0.65}px;min-height:4px"></div>
                <div style="font-size:0.6rem;color:var(--text-muted)">${labels[i]}</div>
              </div>`
            }).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:14px">
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 แยกตามประเภทงาน (เดือนนี้)</div>
            ${types.length ? types.map((s, i) => {
              const pct = Math.round(s.jobs / Math.max(jobsNow, 1) * 100)
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;gap:8px;font-size:0.73rem;margin-bottom:3px">
                  <span>${escHtml(s.name)}</span>
                  <span style="color:var(--text-muted);white-space:nowrap">${s.jobs} งาน · ${formatCurrency(s.revenue)}</span>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:9px">
                  <div style="width:${pct}%;background:${TYPE_COLORS[i % TYPE_COLORS.length]};height:9px;border-radius:3px"></div>
                </div>
              </div>`
            }).join('') : empty}
          </div>

          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🏗 งานที่ยังไม่เสร็จ แยกตามช่องซ่อม</div>
            ${bays.length ? bays.map(b => `<div style="display:flex;justify-content:space-between;font-size:0.76rem;padding:5px 0;border-bottom:1px solid var(--border-subtle)">
                <span>${escHtml(b.name)}</span><strong>${b.jobs} งาน</strong></div>`).join('')
              : '<div style="padding:14px;text-align:center;font-size:0.76rem;color:var(--text-muted)">ไม่มีงานค้าง</div>'}
          </div>
        </div>

        <div class="card" style="overflow-x:auto">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">🏆 ผลงานช่าง (เดือนนี้)</div>
          ${techs.length ? `<table style="width:100%;border-collapse:collapse"><tbody>
              ${techs.map((t, i) => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px;width:36px">${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'}</td>
                  <td style="padding:8px 6px;font-weight:600">${escHtml(t.name)}</td>
                  <td style="padding:8px 10px;text-align:right;white-space:nowrap">${t.jobs} งาน</td>
                  <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--success);white-space:nowrap">${formatCurrency(t.revenue)}</td>
                </tr>`).join('')}
            </tbody></table>` : empty}
        </div>
      </div>
    `

    container.querySelectorAll('.mx-btn').forEach(b => b.addEventListener('click', () => { metric = b.dataset.m; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(
        months.map((m, i) => ({ 'เดือน': `${labels[i]} ${Number(m.slice(0, 4)) + 543}`, 'จำนวนงาน': monthly.jobs[i], 'รายได้ (บาท)': monthly.revenue[i] })),
        `Service_Analytics_${nowYm}.xlsx`,
        'Service'
      )
      showToast('📥 ส่งออกแล้ว', 'success')
    })
  }

  renderPage()
}
