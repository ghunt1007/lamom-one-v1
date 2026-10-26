/**
 * Lead Source Analytics — สรุปแหล่งที่มา Lead จากแคมเปญจริง (real-data hub)
 * Route: /marketing/lead-sources
 * เดิมไฟล์นี้เป็นข้อมูล hardcoded ทั้งหมด (leads/conversion/CPL ต่อช่องทางเป็นตัวเลขปลอม) ซ้ำซ้อนกับ
 * LeadGeneration.js (/marketing/leads) ที่เป็น Firestore จริงอยู่แล้ว
 * แก้ให้ดึงแคมเปญจริงจาก lead_gen_campaigns มา group ตามช่องทาง (channel) แทนตัวเลขปลอม
 * แล้วมีทางลัดไปหน้า Lead Generation เต็มรูปแบบสำหรับจัดการแคมเปญ
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportMultiSheet } from '../../utils/importExport.js'
import { listDocs, listAllDocs } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { todayBangkok } from '../../utils/format.js'
import { summarizeSources, periodRange } from '../../utils/sourcePerformance.js'

const PERIODS = [['month', 'เดือนนี้'], ['last-month', 'เดือนที่แล้ว'], ['3m', '3 เดือนล่าสุด'], ['year', 'ปีนี้'], ['all', 'ทั้งหมด']]

const CHANNEL_MAP = {
  facebook: { label: 'Facebook Ads', icon: '📘', color: '#1877F2' },
  google:   { label: 'Google Ads', icon: '🔍', color: '#f59e0b' },
  line:     { label: 'LINE OA', icon: '💬', color: '#06C755' },
  organic:  { label: 'Organic SEO', icon: '🌱', color: '#64748b' },
  referral: { label: 'Referral', icon: '🤝', color: '#ef4444' },
  walkin:   { label: 'Walk-in', icon: '🚶', color: '#6366f1' },
  event:    { label: 'Event/Expo', icon: '🎪', color: '#ec4899' },
}

export default async function LeadSourcesPage(container) {
  let campaigns = []
  let customers = []
  let bookings = []
  let period = '3m'
  const myGen = container.__routerGen
  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
  // ผลจริงจากลูกค้าในระบบ (v1.0.549) — ลูกค้า/ใบจองจริงแยกตามที่มา ไม่ใช่ตัวเลขที่กรอกเองในแคมเปญ
  const [cmp, cus, bks] = await Promise.all([
    listDocs('lead_gen_campaigns', [], 'startDate', 'desc', 500).catch(() => []),
    listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
  ])
  campaigns = cmp; customers = cus; bookings = bks
  if (myGen !== undefined && container.__routerGen !== myGen) return

  function realSection() {
    const { rows, total, best } = summarizeSources({ customers, bookings, campaigns }, periodRange(period, todayBangkok()))
    const maxLeads = Math.max(1, ...rows.map(r => r.leads))
    const money = v => (v == null ? '—' : formatCurrency(v))
    return `<div class="card" style="padding:14px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="font-weight:800">🎯 ช่องทางไหนขายได้จริง <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted)">(นับจากลูกค้าจริงในระบบ ${total.leads} ราย)</span></div>
        <select class="input" id="ls-period" style="width:auto;margin-left:auto">${PERIODS.map(([k, l]) => `<option value="${k}" ${k === period ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      ${best ? `<div style="font-size:0.8rem;margin-bottom:10px;padding:8px 12px;border-radius:8px;background:var(--surface-2)">🏆 <b>${best.icon} ${best.label}</b> ปิดเป็นใบจองได้ ${best.bookRate}% ของลูกค้าที่เข้ามา (สูงสุดในช่วงนี้)</div>` : ''}
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>ช่องทาง</th><th style="text-align:right">ลูกค้าเข้า</th><th style="text-align:right">จอง</th><th style="text-align:right">% จอง</th><th style="text-align:right">ส่งมอบ</th><th style="text-align:right">ยังคุยอยู่</th><th style="text-align:right">เสียดีล</th><th style="text-align:right">วันถึงจอง (เฉลี่ย)</th><th style="text-align:right">รายได้</th><th style="text-align:right">งบที่ใช้</th><th style="text-align:right">ต้นทุน/คันที่ขาย</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><div style="font-weight:700">${r.icon} ${r.label}</div><div style="height:5px;background:var(--surface-2);border-radius:3px;margin-top:4px;width:120px"><div style="height:100%;width:${Math.round(r.leads / maxLeads * 100)}%;background:var(--primary);border-radius:3px"></div></div></td>
          <td style="text-align:right">${r.leads}</td><td style="text-align:right">${r.booked}</td>
          <td style="text-align:right;font-weight:800;color:var(--${r.bookRate >= total.bookRate ? 'success' : 'warning'})">${r.bookRate}%</td>
          <td style="text-align:right">${r.delivered}</td><td style="text-align:right">${r.open}</td><td style="text-align:right">${r.lost}</td>
          <td style="text-align:right">${r.avgDaysToBook == null ? '—' : r.avgDaysToBook + ' วัน'}</td>
          <td style="text-align:right">${formatCurrency(r.income)}</td><td style="text-align:right">${r.spent ? formatCurrency(r.spent) : '—'}</td><td style="text-align:right">${money(r.costPerSale)}</td>
        </tr>`).join('')}
        <tr style="font-weight:800;border-top:2px solid var(--border)"><td>รวม</td><td style="text-align:right">${total.leads}</td><td style="text-align:right">${total.booked}</td><td style="text-align:right">${total.bookRate}%</td><td style="text-align:right">${total.delivered}</td><td style="text-align:right">${total.open}</td><td style="text-align:right">${total.lost}</td><td></td><td style="text-align:right">${formatCurrency(total.income)}</td><td style="text-align:right">${total.spent ? formatCurrency(total.spent) : '—'}</td><td></td></tr>
        </tbody></table></div>
        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:8px">รายได้ = รายได้รวมที่กรอกในใบจองของลูกค้ากลุ่มนี้ · งบที่ใช้ = ยอด "ใช้ไป" ของแคมเปญที่เริ่มในช่วงนี้ (หน้า Lead Generation) · ลูกค้าที่ไม่ได้เลือกที่มาจะอยู่ใน "อื่นๆ"</div>`
        : `<div class="empty-state" style="padding:24px"><div class="empty-icon">🎯</div><div class="empty-title">ยังไม่มีลูกค้าใหม่ในช่วงนี้</div></div>`}
    </div>`
  }

  function aggregateByChannel() {
    const map = {}
    campaigns.forEach(c => {
      const ch = c.channel || 'other'
      if (!map[ch]) map[ch] = { channel: ch, leads: 0, qualified: 0, closed: 0, spent: 0, budget: 0 }
      map[ch].leads += c.leads || 0
      map[ch].qualified += c.qualified || 0
      map[ch].closed += c.closed || 0
      map[ch].spent += c.spent || 0
      map[ch].budget += c.budget || 0
    })
    return Object.values(map).map(m => ({
      ...m,
      info: CHANNEL_MAP[m.channel] || { label: m.channel, icon: '📌', color: '#94a3b8' },
      conv: m.leads ? Math.round(m.closed / m.leads * 100) : 0,
      cpl: m.leads ? Math.round(m.spent / m.leads) : 0,
    })).sort((a, b) => b.leads - a.leads)
  }

  function render() {
    const totals = aggregateByChannel()
    const totalLeads = totals.reduce((s, x) => s + x.leads, 0)
    const totalSales = totals.reduce((s, x) => s + x.closed, 0)
    const bestSrc = totals[0] || null
    const topConv = totals.length ? [...totals].sort((a, b) => b.conv - a.conv)[0] : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧲 Lead Source Analytics</div>
            <div class="page-subtitle">สรุปแหล่งที่มา Lead จาก ${campaigns.length} แคมเปญจริง — ข้อมูลจริงจาก Lead Generation</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 ส่งออก</button>
            <button class="btn btn-primary" id="goto-leadgen-btn">🧲 จัดการแคมเปญ</button>
          </div>
        </div>

        ${realSection()}
        <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin:4px 0 10px">📣 ตัวเลขจากแคมเปญ (กรอกเองในหน้า Lead Generation)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">
          ${sc('🧲 Leads รวม', totalLeads + ' คน', 'var(--primary)')}
          ${sc('🚗 ปิดได้', totalSales + ' ดีล', 'var(--success)')}
          ${sc('🏆 แหล่งดีสุด', bestSrc ? bestSrc.info.icon + ' ' + bestSrc.info.label : '-', 'var(--primary)')}
          ${sc('🎯 Conv. สูงสุด', topConv ? topConv.info.icon + ' ' + topConv.conv + '%' : '-', 'var(--success)')}
        </div>

        ${!totals.length ? `
          <div class="empty-state">
            <div class="empty-icon">🧲</div>
            <div class="empty-title">ยังไม่มีข้อมูลแคมเปญ</div>
            <div style="color:var(--text-muted);font-size:0.85rem">ไปสร้างแคมเปญที่หน้า Lead Generation ก่อน</div>
          </div>
        ` : `
        <div class="card" style="padding:14px">
          <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📊 Leads ต่อช่องทาง (รวมทุกแคมเปญ)</div>
          ${totals.map(s => {
            const pct = totalLeads ? Math.round(s.leads / totalLeads * 100) : 0
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:0.74rem;margin-bottom:3px">
                <span>${s.info.icon} ${s.info.label}</span>
                <span style="font-weight:700">${s.leads} leads (${pct}%)</span>
              </div>
              <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${s.info.color};border-radius:4px"></div>
              </div>
              <div style="display:flex;gap:10px;font-size:0.64rem;color:var(--text-muted);margin-top:2px">
                <span>Conv. ${s.conv}%</span>
                <span>ปิดได้ ${s.closed} ดีล</span>
                <span>CPL ${s.cpl > 0 ? formatCurrency(s.cpl) : 'ฟรี'}</span>
              </div>
            </div>`
          }).join('')}
        </div>
        `}
      </div>`

    document.getElementById('ls-period')?.addEventListener('change', e => { period = e.target.value; render() })
    document.getElementById('goto-leadgen-btn')?.addEventListener('click', () => navigate('/marketing/leads'))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const real = summarizeSources({ customers, bookings, campaigns }, periodRange(period, todayBangkok())).rows
      exportMultiSheet([
        { name: 'ผลจริงจากลูกค้า', data: real.map(r => ({ 'ช่องทาง': r.label, 'ลูกค้าเข้า': r.leads, 'จอง': r.booked, '% จอง': r.bookRate, 'ส่งมอบ': r.delivered, 'ยังคุยอยู่': r.open, 'เสียดีล': r.lost, 'วันถึงจอง (เฉลี่ย)': r.avgDaysToBook ?? '', 'รายได้ (บาท)': r.income, 'งบที่ใช้ (บาท)': r.spent, 'ต้นทุนต่อคันที่ขาย (บาท)': r.costPerSale ?? '' })) },
        { name: 'ตัวเลขแคมเปญ', data: totals.map(s => ({ 'ช่องทาง': s.info.label, 'Leads รวม': s.leads, 'Qualified': s.qualified, 'ปิดได้': s.closed, 'Conversion %': s.conv, 'ใช้งบ (บาท)': s.spent, 'CPL (บาท)': s.cpl })) },
      ], 'Lead_Sources_Report.xlsx')
      showToast('📥 Export Lead Source Report แล้ว', 'success')
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
