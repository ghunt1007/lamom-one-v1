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
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'
import { navigate } from '../../core/router.js'

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
  try {
    campaigns = await listDocs('lead_gen_campaigns', [], 'startDate', 'desc', 500)
  } catch (e) {}

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
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="goto-leadgen-btn">🧲 จัดการแคมเปญ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
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

    document.getElementById('goto-leadgen-btn')?.addEventListener('click', () => navigate('/marketing/leads'))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(totals.map(s => ({
        'ช่องทาง': s.info.label,
        'Leads รวม': s.leads,
        'Qualified': s.qualified,
        'ปิดได้': s.closed,
        'Conversion %': s.conv,
        'ใช้งบ (บาท)': s.spent,
        'CPL (บาท)': s.cpl,
      })), 'Lead_Sources_Report.xlsx', 'Lead Sources')
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
