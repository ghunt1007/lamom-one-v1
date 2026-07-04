/**
 * Sales Channel Comparison — เปรียบเทียบทีมขายหน้าร้าน vs ทีมขายออนไลน์
 * Route: /analytics/sales-channel
 */
import { formatCurrency } from '../../utils/format.js'
import { getSalesData } from '../../core/db.js'
import { getSalesStaff, getSalesChannel } from '../../data/masterData.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CHANNELS = {
  showroom: { label: '🏢 ทีมหน้าร้าน', color: 'primary' },
  online:   { label: '💻 ทีมออนไลน์', color: 'success' },
}

export default async function SalesChannelComparisonPage(container) {
  const myGen = container.__routerGen
  let sales = []
  try { sales = await getSalesData() } catch {}
  if (container.__routerGen !== myGen) return

  const staff = getSalesStaff()
  const staffChannel = {}
  staff.forEach(s => { staffChannel[s] = getSalesChannel(s) })

  function channelStats(channel) {
    const staffInChannel = staff.filter(s => staffChannel[s] === channel)
    const deals = sales.filter(s => staffInChannel.includes(s.salesName))
    const delivered = deals.filter(d => d.delivered || d.status === 'ส่งมอบแล้ว')
    const revenue = deals.reduce((a, d) => a + (d.salePrice || 0), 0)
    const margin = deals.reduce((a, d) => a + (d.margin || 0), 0)
    const totalIncome = deals.reduce((a, d) => a + (d.totalIncome || 0), 0)
    return {
      staffCount: staffInChannel.length,
      dealCount: deals.length,
      deliveredCount: delivered.length,
      revenue, margin, totalIncome,
      avgDealSize: deals.length ? Math.round(revenue / deals.length) : 0,
      dealsPerStaff: staffInChannel.length ? +(deals.length / staffInChannel.length).toFixed(1) : 0,
      revenuePerStaff: staffInChannel.length ? Math.round(revenue / staffInChannel.length) : 0,
      deliveryRate: deals.length ? Math.round(delivered.length / deals.length * 100) : 0,
    }
  }

  function render() {
    const showroomStats = channelStats('showroom')
    const onlineStats = channelStats('online')
    const noChannelSet = staff.length > 0 && staff.every(s => staffChannel[s] === 'showroom') // ยังไม่มีใครถูกตั้งเป็นออนไลน์เลย

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚖️ เปรียบเทียบทีมขาย: หน้าร้าน vs ออนไลน์</div>
            <div class="page-subtitle">วิเคราะห์ประสิทธิภาพแยกตามช่องทางขาย</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="scc-export">📥 Export</button>
            <a class="btn btn-secondary" href="#" id="scc-setup">⚙️ ตั้งค่าช่องทางพนักงาน</a>
          </div>
        </div>

        ${noChannelSet ? `<div class="card mb-4" style="padding:12px 16px;background:rgba(245,158,11,.08);border:1px solid var(--warning)">
          <span style="font-size:0.82rem">⚠️ <b>ยังไม่ได้กำหนดช่องทางให้พนักงานขายคนใดเป็น "ทีมออนไลน์" เลย</b> — ทุกคนถูกจัดเป็น "ทีมหน้าร้าน" โดยค่าเริ่มต้น ไปที่ <b>Master Data → พนักงานขาย</b> เพื่อกดสลับช่องทางของแต่ละคน แล้วข้อมูลเปรียบเทียบด้านล่างจะแยกออกจากกันจริง</span>
        </div>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          ${channelCard('showroom', showroomStats)}
          ${channelCard('online', onlineStats)}
        </div>

        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:12px">📊 เปรียบเทียบรายละเอียด</div>
          <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8rem">
            <thead><tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">ตัวชี้วัด</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">${CHANNELS.showroom.label}</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">${CHANNELS.online.label}</th>
            </tr></thead>
            <tbody>
              ${cmpRow('👥 จำนวนพนักงาน', showroomStats.staffCount, onlineStats.staffCount)}
              ${cmpRow('🚗 จำนวนดีล', showroomStats.dealCount, onlineStats.dealCount)}
              ${cmpRow('📦 ส่งมอบแล้ว', showroomStats.deliveredCount + ` (${showroomStats.deliveryRate}%)`, onlineStats.deliveredCount + ` (${onlineStats.deliveryRate}%)`)}
              ${cmpRow('💰 รายได้รวม', formatCurrency(showroomStats.revenue), formatCurrency(onlineStats.revenue))}
              ${cmpRow('💵 มูลค่าดีลเฉลี่ย', formatCurrency(showroomStats.avgDealSize), formatCurrency(onlineStats.avgDealSize))}
              ${cmpRow('📈 ดีล/พนักงาน', showroomStats.dealsPerStaff, onlineStats.dealsPerStaff)}
              ${cmpRow('💸 รายได้/พนักงาน', formatCurrency(showroomStats.revenuePerStaff), formatCurrency(onlineStats.revenuePerStaff))}
              ${cmpRow('🏆 กำไรขั้นต้นรวม', formatCurrency(showroomStats.margin), formatCurrency(onlineStats.margin))}
            </tbody>
          </table></div>
        </div>
      </div>
    `

    document.getElementById('scc-export').addEventListener('click', () => {
      exportToExcel([
        { ช่องทาง: 'ทีมหน้าร้าน', ...flattenStats(showroomStats) },
        { ช่องทาง: 'ทีมออนไลน์', ...flattenStats(onlineStats) },
      ], 'sales-channel-comparison-' + new Date().toISOString().slice(0, 10) + '.xlsx', 'เปรียบเทียบช่องทาง')
      showToast('📥 Export แล้ว', 'success')
    })
    document.getElementById('scc-setup').addEventListener('click', (e) => {
      e.preventDefault()
      navigate('/settings/master-data')
    })
  }

  function flattenStats(s) {
    return {
      จำนวนพนักงาน: s.staffCount, จำนวนดีล: s.dealCount, ส่งมอบแล้ว: s.deliveredCount,
      อัตราส่งมอบ: s.deliveryRate + '%', รายได้รวม: s.revenue, มูลค่าดีลเฉลี่ย: s.avgDealSize,
      ดีลต่อพนักงาน: s.dealsPerStaff, รายได้ต่อพนักงาน: s.revenuePerStaff, กำไรขั้นต้นรวม: s.margin,
    }
  }

  function channelCard(channel, stats) {
    const c = CHANNELS[channel]
    return `<div class="card" style="padding:18px;border-top:3px solid var(--${c.color})">
      <div style="font-weight:800;font-size:1rem;margin-bottom:12px">${c.label}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div style="font-size:0.68rem;color:var(--text-muted)">พนักงาน</div><div style="font-size:1.2rem;font-weight:800">${stats.staffCount} คน</div></div>
        <div><div style="font-size:0.68rem;color:var(--text-muted)">จำนวนดีล</div><div style="font-size:1.2rem;font-weight:800;color:var(--${c.color})">${stats.dealCount}</div></div>
        <div><div style="font-size:0.68rem;color:var(--text-muted)">รายได้รวม</div><div style="font-size:1.05rem;font-weight:800;color:var(--success)">${formatCurrency(stats.revenue)}</div></div>
        <div><div style="font-size:0.68rem;color:var(--text-muted)">รายได้/พนักงาน</div><div style="font-size:1.05rem;font-weight:700">${formatCurrency(stats.revenuePerStaff)}</div></div>
      </div>
    </div>`
  }

  function cmpRow(label, a, b) {
    return `<tr><td style="padding:8px;color:var(--text-muted);border-bottom:1px solid var(--border-subtle)">${label}</td>
      <td style="text-align:center;padding:8px;border-bottom:1px solid var(--border-subtle)">${a}</td>
      <td style="text-align:center;padding:8px;border-bottom:1px solid var(--border-subtle)">${b}</td></tr>`
  }

  render()
}
