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

  // ── พารามิเตอร์จำลองแผนการขาย (what-if) — ปรับได้อิสระต่อช่องทาง ──────────────
  const sim = {
    showroom: { staffDelta: 0, dealsPerStaffPct: 0, avgDealSizePct: 0 },
    online:   { staffDelta: 0, dealsPerStaffPct: 0, avgDealSizePct: 0 },
  }

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

  // ฉายภาพผลลัพธ์ถ้าปรับพารามิเตอร์จำลอง — ไม่กระทบข้อมูลจริง เป็นการคำนวณชั่วคราวเท่านั้น
  function projectedStats(channel, base) {
    const p = sim[channel]
    const newStaffCount = Math.max(0, base.staffCount + p.staffDelta)
    const newDealsPerStaff = base.dealsPerStaff * (1 + p.dealsPerStaffPct / 100)
    const newAvgDealSize = base.avgDealSize * (1 + p.avgDealSizePct / 100)
    const newDealCount = Math.round(newStaffCount * newDealsPerStaff)
    const newRevenue = Math.round(newDealCount * newAvgDealSize)
    return {
      staffCount: newStaffCount, dealCount: newDealCount, revenue: newRevenue,
      dealsPerStaff: +newDealsPerStaff.toFixed(1), avgDealSize: Math.round(newAvgDealSize),
      revenuePerStaff: newStaffCount ? Math.round(newRevenue / newStaffCount) : 0,
    }
  }

  function render() {
    const showroomStats = channelStats('showroom')
    const onlineStats = channelStats('online')
    const showroomProj = projectedStats('showroom', showroomStats)
    const onlineProj = projectedStats('online', onlineStats)
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

        <div class="card mt-4" style="padding:16px">
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">🧪 จำลองแผนการขาย (What-if)</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:14px">ปรับสมมติฐานเพื่อดูผลลัพธ์ที่คาดการณ์ — ไม่กระทบข้อมูลจริง เป็นการคำนวณชั่วคราวเพื่อวางแผนเท่านั้น</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${simPanel('showroom', showroomStats, showroomProj)}
            ${simPanel('online', onlineStats, onlineProj)}
          </div>
          <div style="margin-top:14px;padding:12px;background:var(--primary-dim);border-radius:8px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--primary);margin-bottom:6px">📊 สรุปผลจำลองรวมทั้งสองช่องทาง</div>
            <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:0.8rem">
              <span>🚗 ดีลรวม: <b>${showroomStats.dealCount + onlineStats.dealCount}</b> → <b style="color:var(--primary)">${showroomProj.dealCount + onlineProj.dealCount}</b></span>
              <span>💰 รายได้รวม: <b>${formatCurrency(showroomStats.revenue + onlineStats.revenue)}</b> → <b style="color:var(--primary)">${formatCurrency(showroomProj.revenue + onlineProj.revenue)}</b></span>
            </div>
          </div>
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

    container.querySelectorAll('.sim-input').forEach(inp => inp.addEventListener('input', () => {
      const ch = inp.dataset.ch, key = inp.dataset.key
      sim[ch][key] = Number(inp.value) || 0
      render()
    }))
    container.querySelectorAll('.sim-reset').forEach(btn => btn.addEventListener('click', () => {
      const ch = btn.dataset.ch
      sim[ch] = { staffDelta: 0, dealsPerStaffPct: 0, avgDealSizePct: 0 }
      render()
    }))
  }

  function simPanel(channel, base, proj) {
    const c = CHANNELS[channel]
    const p = sim[channel]
    const dealDiff = proj.dealCount - base.dealCount
    const revDiff = proj.revenue - base.revenue
    return `<div style="background:var(--surface-2);border-radius:10px;padding:12px">
      <div style="font-weight:700;font-size:0.82rem;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
        ${c.label}
        <button class="btn btn-ghost btn-xs sim-reset" data-ch="${channel}">↩️ รีเซ็ต</button>
      </div>
      <div class="input-group" style="margin-bottom:8px"><label class="input-label" style="font-size:0.7rem">➕ เพิ่ม/ลด จำนวนพนักงาน</label>
        <input class="input sim-input" data-ch="${channel}" data-key="staffDelta" type="number" value="${p.staffDelta}" style="font-size:0.78rem">
      </div>
      <div class="input-group" style="margin-bottom:8px"><label class="input-label" style="font-size:0.7rem">📈 ปรับดีล/พนักงาน (%)</label>
        <input class="input sim-input" data-ch="${channel}" data-key="dealsPerStaffPct" type="number" value="${p.dealsPerStaffPct}" style="font-size:0.78rem">
      </div>
      <div class="input-group" style="margin-bottom:10px"><label class="input-label" style="font-size:0.7rem">💵 ปรับมูลค่าดีลเฉลี่ย (%)</label>
        <input class="input sim-input" data-ch="${channel}" data-key="avgDealSizePct" type="number" value="${p.avgDealSizePct}" style="font-size:0.78rem">
      </div>
      <div style="border-top:1px solid var(--border-subtle);padding-top:8px;font-size:0.78rem">
        <div style="display:flex;justify-content:space-between"><span>พนักงาน</span><b>${base.staffCount} → ${proj.staffCount}</b></div>
        <div style="display:flex;justify-content:space-between"><span>ดีลคาดการณ์</span><b style="color:${dealDiff>=0?'var(--success)':'var(--danger)'}">${proj.dealCount} (${dealDiff>=0?'+':''}${dealDiff})</b></div>
        <div style="display:flex;justify-content:space-between"><span>รายได้คาดการณ์</span><b style="color:${revDiff>=0?'var(--success)':'var(--danger)'}">${formatCurrency(proj.revenue)}</b></div>
      </div>
    </div>`
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
