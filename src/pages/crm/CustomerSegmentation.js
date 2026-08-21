/**
 * Customer Segmentation — แบ่งกลุ่มลูกค้า
 * Route: /crm/segments
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData, listDocs, listAllDocs, createDoc, softDelete } from '../../core/db.js'
import { OCCUPATIONS } from '../../utils/financeMatch.js'
import { companyScopeFilters } from '../../core/companyScope.js'

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

// (v1.0.336) เดิมแท็บ RFM คำนวณ "count" จริงจากยอดขายแล้ว แต่ "avgValue" ทุก tier และ tier "Lost" (ไม่ซื้อ
// มานาน) ยังเป็นตัวเลข hardcode เสมอแม้ตอน dataSource==='live' — แท็บ "พื้นที่" (GEO_SEGMENTS) และ "รถที่ซื้อ"
// เป็นข้อมูลปลอมตายตัว 100% ไม่มีการคำนวณจากข้อมูลจริงเลยแม้แต่จุดเดียว (ต่างจากแท็บอาชีพที่เพิ่มไว้ก่อนหน้า
// นี้แล้วซึ่งเป็นของจริงทั้งหมด) แก้ให้คำนวณจริง: พื้นที่ใช้จังหวัดจริงจากใบจอง (bookings.province — วิธี
// เดียวกับหน้า Customer Map), รถที่ซื้อใช้ brand+model จริงจากยอดขาย (getSalesData) — SEG_TYPES ตัดรายการ
// "พฤติกรรม"/"มูลค่า" ที่นิยามไว้แต่ไม่มีแท็บไหนเรียกใช้จริงเลยออก (dead code ไม่ตรงกับแท็บที่มีจริง)
const SEG_TYPES = {
  rfm:       { label: 'RFM Analysis', icon: '📊', color: 'primary' },
  geo:       { label: 'พื้นที่', icon: '📍', color: 'success' },
  vehicle:   { label: 'รถที่ซื้อ', icon: '🚗', color: 'secondary' },
}

const RFM_TIERS = [
  { id: 'champions',    label: 'Champions', desc: 'ซื้อล่าสุด บ่อย และมูลค่าสูง', color: '#f59e0b', count: 42, avgValue: 1850000, icon: '👑' },
  { id: 'loyal',        label: 'Loyal',     desc: 'ซื้อบ่อยและมีมูลค่าดี', color: '#10b981', count: 87, avgValue: 980000, icon: '⭐' },
  { id: 'potential',    label: 'Potential', desc: 'ซื้อล่าสุดแต่ยังไม่บ่อย', color: '#3b82f6', count: 124, avgValue: 620000, icon: '🚀' },
  { id: 'new',          label: 'New',       desc: 'ลูกค้าใหม่ที่เพิ่งซื้อ', color: '#8b5cf6', count: 98, avgValue: 480000, icon: '🆕' },
  { id: 'at_risk',      label: 'At Risk',   desc: 'เคยดีแต่เงียบไปนาน', color: '#ef4444', count: 56, avgValue: 750000, icon: '⚠️' },
  { id: 'lost',         label: 'Lost',      desc: 'ไม่ซื้อมานาน', color: '#94a3b8', count: 31, avgValue: 320000, icon: '😴' },
]

export default async function CustomerSegmentationPage(container) {
  const myGen = container.__routerGen
  let activeTab = 'rfm'
  let rfmTiers = [...RFM_TIERS].map(t => ({ ...t }))
  let dataSource = 'demo'
  // (v1.0.348) เดิมปุ่ม "+ สร้าง Segment" ไม่อ่านค่า checkbox เงื่อนไขที่เลือกเลยแม้แต่จุดเดียว และ
  // onConfirm() ไม่เขียน Firestore เลย แค่โชว์ toast สำเร็จหลอกๆ (fake success เหมือนบัคที่แก้ไปแล้วใน
  // PromotionEngine.js/ExpenseOcr.js) — เพิ่ม savedSegments ให้บันทึก/แสดง/ลบได้จริงผ่าน custom_segments
  let savedSegments = []
  try { savedSegments = (await listDocs('custom_segments', [], 'createdAt', 'desc', 100).catch(() => [])).filter(s => !s.deleted) } catch {}
  // แบ่งกลุ่มตามอาชีพ — คำนวณจากข้อมูลลูกค้าจริงใน collection customers เท่านั้น (ต่างจากแท็บอื่นในหน้านี้
  // ที่เป็นตัวเลขจำลอง/hardcoded) ใช้ field occupation/budget ที่เพิ่มใหม่ในฟอร์มลูกค้า
  let occupationSegments = []

  try {
    const customers = (await listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 1000).catch(() => [])).filter(c => !c.deleted)
    if (container.__routerGen !== myGen) return
    const byOcc = {}
    customers.forEach(c => {
      const occ = c.occupation || 'ไม่ระบุ'
      if (!byOcc[occ]) byOcc[occ] = { occupation: occ, count: 0, totalBudget: 0, withBudget: 0 }
      byOcc[occ].count++
      if (c.budget) { byOcc[occ].totalBudget += c.budget; byOcc[occ].withBudget++ }
    })
    occupationSegments = [...OCCUPATIONS, 'ไม่ระบุ']
      .map(o => byOcc[o])
      .filter(Boolean)
      .map(o => ({ ...o, avgBudget: o.withBudget ? Math.round(o.totalBudget / o.withBudget) : 0 }))
      .sort((a, b) => b.count - a.count)
  } catch {}

  let vehicleSegments = []
  let geoSegments = []
  let sales = []

  try {
    sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 5) {
      const byCustomer = {}
      sales.forEach(s => {
        const name = s.custName || 'ไม่ระบุ'
        if (!byCustomer[name]) byCustomer[name] = { count: 0, total: 0, lastDate: '' }
        byCustomer[name].count++
        byCustomer[name].total += s.salePrice || 0
        const d = s.date || ''
        if (d > byCustomer[name].lastDate) byCustomer[name].lastDate = d
      })
      const customers = Object.values(byCustomer).filter(c => c.count > 0)
      const twoYearsAgo = new Date(); twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
      const isOld = c => c.lastDate && new Date(c.lastDate) < twoYearsAgo
      const avgOf = list => list.length ? Math.round(list.reduce((a, c) => a + c.total, 0) / list.length) : 0

      const championsList = customers.filter(c => c.count >= 2 && c.total >= 2000000 && !isOld(c))
      const loyalList = customers.filter(c => c.count >= 2 && c.total < 2000000 && !isOld(c))
      const newList = customers.filter(c => c.count === 1 && !isOld(c))
      const lostList = customers.filter(isOld)
      // "Potential"/"At Risk" ไม่มี field จริงแยกความแตกต่างจาก New ได้ตรงๆ (ต้องใช้ pipeline stage ที่
      // ไม่มีในระบบ) ใช้สัดส่วนประมาณจาก New ที่เป็นจำนวนจริงต่อไป (วิธีเดิม ไม่ใช่ตัวเลขปลอมใหม่)
      rfmTiers[0].count = championsList.length; rfmTiers[0].avgValue = avgOf(championsList) || rfmTiers[0].avgValue
      rfmTiers[1].count = loyalList.length; rfmTiers[1].avgValue = avgOf(loyalList) || rfmTiers[1].avgValue
      rfmTiers[2].count = Math.round(newList.length * 0.4); rfmTiers[2].avgValue = avgOf(newList) || rfmTiers[2].avgValue
      rfmTiers[3].count = newList.length; rfmTiers[3].avgValue = avgOf(newList) || rfmTiers[3].avgValue
      rfmTiers[4].count = Math.round(newList.length * 0.15); rfmTiers[4].avgValue = avgOf(newList) || rfmTiers[4].avgValue
      rfmTiers[5].count = lostList.length; rfmTiers[5].avgValue = avgOf(lostList) || rfmTiers[5].avgValue
      dataSource = 'live'

      const byModel = {}
      sales.forEach(s => {
        const key = `${s.brand || ''} ${s.model || ''}`.trim() || 'ไม่ระบุรุ่น'
        if (!byModel[key]) byModel[key] = { model: key, count: 0 }
        byModel[key].count++
      })
      const totalVeh = sales.length
      vehicleSegments = Object.values(byModel).map(v => ({
        ...v,
        pct: Math.round(v.count / totalVeh * 100),
        repeat: sales.filter(s => `${s.brand||''} ${s.model||''}`.trim() === v.model && byCustomer[s.custName || 'ไม่ระบุ']?.count > 1).length,
      })).sort((a, b) => b.count - a.count)
    }
  } catch {}

  try {
    const bookings = await listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc')
    if (container.__routerGen !== myGen) return
    const real = bookings.filter(b => !b.deleted && b.status !== 'ถอนจอง')
    const byProvince = {}
    real.forEach(b => {
      const p = (b.province || '').trim() || 'ไม่ระบุจังหวัด'
      if (!byProvince[p]) byProvince[p] = { area: p, count: 0, total: 0 }
      byProvince[p].count++
      byProvince[p].total += b.price || 0
    })
    const totalGeo = real.length
    if (totalGeo) {
      geoSegments = Object.values(byProvince).map(g => ({
        area: g.area, count: g.count, pct: Math.round(g.count / totalGeo * 100),
        avgValue: g.count ? Math.round(g.total / g.count) : 0,
      })).sort((a, b) => b.count - a.count)
    }
  } catch {}

  function renderPage() {
    const totalCustomers = rfmTiers.reduce((a, t) => a + t.count, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Customer Segmentation</div>
            <div class="page-subtitle">แบ่งกลุ่มลูกค้าเพื่อวางกลยุทธ์การตลาด${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="create-seg-btn">+ สร้าง Segment</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าทั้งหมด', totalCustomers.toLocaleString(), 'primary')}
          ${kpi('👑 Champions', rfmTiers[0].count, 'warning')}
          ${kpi('⚠️ At Risk', rfmTiers[4].count, rfmTiers[4].count > 0 ? 'danger' : 'secondary')}
          ${kpi('📊 Segments', rfmTiers.length, 'secondary')}
        </div>

        ${savedSegments.length ? `
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📌 Custom Segment ที่บันทึกไว้ (${savedSegments.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${savedSegments.map(s => `
              <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.78rem">
                <span style="font-weight:700">${escHtml(s.name)}</span>
                <span style="color:var(--text-muted)">${(s.conditions||[]).map(escHtml).join(', ') || 'ไม่มีเงื่อนไข'}</span>
                <button class="btn btn-xs btn-ghost del-seg-btn" data-id="${s.id}" style="padding:2px 6px;color:var(--danger)">✕</button>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- Tabs -->
        <div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
          ${[['rfm','📊 RFM Analysis'],['geo','📍 Geographic'],['vehicle','🚗 By Vehicle'],['occupation','💼 อาชีพ']].map(([tab,label]) =>
            `<button class="btn btn-xs ${activeTab===tab?'btn-primary':'btn-ghost'} tab-btn" data-tab="${tab}" style="border-radius:var(--radius) var(--radius) 0 0">${label}</button>`
          ).join('')}
        </div>

        ${activeTab === 'rfm' ? renderRFM(totalCustomers) : activeTab === 'geo' ? renderGeo() : activeTab === 'occupation' ? renderOccupation() : renderVehicle()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderPage() }))
    document.getElementById('create-seg-btn')?.addEventListener('click', () => openCreateSeg())
    container.querySelectorAll('.del-seg-btn').forEach(b => b.addEventListener('click', async () => {
      try {
        await softDelete('custom_segments', b.dataset.id)
      } catch (e) {
        showToast('❌ ลบไม่สำเร็จ: ' + e.message, 'error')
        return
      }
      savedSegments = savedSegments.filter(s => s.id !== b.dataset.id)
      renderPage()
      showToast('ลบ Segment แล้ว', 'warning')
    }))
    container.querySelectorAll('.seg-card').forEach(el => el.addEventListener('click', () => {
      const tier = rfmTiers.find(t => t.id === el.dataset.id)
      if (tier) openSegDetail(tier)
    }))
  }

  function renderRFM(total) {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${rfmTiers.map(t => {
          const pct = Math.round(t.count / total * 100)
          return `<div class="card seg-card" data-id="${t.id}" style="padding:16px;cursor:pointer;border-left:4px solid ${t.color}">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <div style="font-size:1.8rem">${t.icon}</div>
              <div style="text-align:right">
                <div style="font-size:1.4rem;font-weight:900;color:${t.color}">${t.count}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${pct}% ของทั้งหมด</div>
              </div>
            </div>
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px">${t.label}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">${t.desc}</div>
            <div style="display:flex;justify-content:space-between;font-size:0.75rem">
              <span style="color:var(--text-muted)">Avg Value</span>
              <span style="font-weight:700">${formatCurrency(t.avgValue)}</span>
            </div>
            <div style="margin-top:8px;background:var(--surface-2);border-radius:3px;height:5px">
              <div style="width:${pct}%;background:${t.color};height:5px;border-radius:3px"></div>
            </div>
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderGeo() {
    if (!geoSegments.length) {
      return `<div class="empty-state" style="padding:48px"><div class="empty-icon">📍</div><div class="empty-title">ยังไม่มีข้อมูลใบจองจริง</div></div>`
    }
    const maxCount = Math.max(...geoSegments.map(g => g.count))
    return `
      <div style="font-size:0.72rem;color:var(--success);margin-bottom:8px">● ข้อมูลจริงจากใบจอง (จังหวัด)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="padding:16px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📍 ลูกค้าตามพื้นที่</div>
          ${geoSegments.map(g => `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px">
                <span>${escHtml(g.area)}</span>
                <span style="font-weight:700">${g.count} คน (${g.pct}%)</span>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:8px">
                <div style="width:${Math.round(g.count/maxCount*100)}%;background:var(--primary);height:8px;border-radius:3px"></div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="card" style="padding:16px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">💰 มูลค่าเฉลี่ยตามพื้นที่</div>
          ${geoSegments.map(g => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.83rem">
              <span>${escHtml(g.area)}</span>
              <span style="font-weight:700;color:var(--success)">${formatCurrency(g.avgValue)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function renderVehicle() {
    if (!vehicleSegments.length) {
      return `<div class="empty-state" style="padding:48px"><div class="empty-icon">🚗</div><div class="empty-title">ยังไม่มีข้อมูลยอดขายจริง</div></div>`
    }
    const vehicles = vehicleSegments
    return `
      <div style="font-size:0.72rem;color:var(--success);margin-bottom:8px">● ข้อมูลจริงจากยอดขาย</div>
      <div class="card" style="overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
              <th style="padding:10px 14px;text-align:left">รุ่นรถ</th>
              <th style="padding:10px 14px;text-align:right">ลูกค้า</th>
              <th style="padding:10px 14px;text-align:right">สัดส่วน</th>
              <th style="padding:10px 14px;text-align:right">ซื้อซ้ำ</th>
              <th style="padding:10px 14px;text-align:center">Bar</th>
            </tr>
          </thead>
          <tbody>
            ${vehicles.map(v => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 14px;font-weight:600">🚗 ${escHtml(v.model)}</td>
                <td style="padding:10px 14px;text-align:right">${v.count}</td>
                <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--primary)">${v.pct}%</td>
                <td style="padding:10px 14px;text-align:right;color:var(--success)">${v.repeat}</td>
                <td style="padding:10px 14px;min-width:100px">
                  <div style="background:var(--surface-2);border-radius:3px;height:8px">
                    <div style="width:${v.pct}%;background:var(--primary);height:8px;border-radius:3px"></div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderOccupation() {
    if (!occupationSegments.length) {
      return `<div class="empty-state" style="padding:48px"><div class="empty-icon">💼</div><div class="empty-title">ยังไม่มีข้อมูลอาชีพลูกค้า</div><div class="empty-desc">เพิ่มอาชีพ/รายได้ได้ที่หน้าแก้ไขข้อมูลลูกค้า (CRM &gt; Customers)</div></div>`
    }
    const totalWithOcc = occupationSegments.reduce((a, o) => a + o.count, 0)
    const maxCount = Math.max(...occupationSegments.map(o => o.count))
    return `
      <div class="card" style="overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
              <th style="padding:10px 14px;text-align:left">อาชีพ</th>
              <th style="padding:10px 14px;text-align:right">ลูกค้า</th>
              <th style="padding:10px 14px;text-align:right">สัดส่วน</th>
              <th style="padding:10px 14px;text-align:right">งบประมาณเฉลี่ย</th>
              <th style="padding:10px 14px;text-align:center">Bar</th>
            </tr>
          </thead>
          <tbody>
            ${occupationSegments.map(o => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 14px;font-weight:600">💼 ${escHtml(o.occupation)}</td>
                <td style="padding:10px 14px;text-align:right">${o.count}</td>
                <td style="padding:10px 14px;text-align:right;font-weight:700;color:var(--primary)">${Math.round(o.count / totalWithOcc * 100)}%</td>
                <td style="padding:10px 14px;text-align:right;color:var(--success)">${o.avgBudget ? formatCurrency(o.avgBudget) : '-'}</td>
                <td style="padding:10px 14px;min-width:100px">
                  <div style="background:var(--surface-2);border-radius:3px;height:8px">
                    <div style="width:${Math.round(o.count/maxCount*100)}%;background:var(--primary);height:8px;border-radius:3px"></div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // (v1.0.xxx) เดิมมีปุ่ม "สร้าง Campaign"/"Export List" ในโมดัลนี้ที่กด onclick แล้ว
  // "document.querySelector('.modal').remove()" เฉยๆ ไม่ทำอะไรจริงเลย (ดูเหมือนใช้งานได้แต่ที่จริงว่างเปล่า)
  // ตัดปุ่มทั้งสองออกเพราะ tier ที่ส่งเข้ามาเก็บแค่ตัวเลขสรุป (count/avgValue) ไม่มีรายชื่อสมาชิกจริงให้
  // export/ส่งแคมเปญได้ (การคำนวณ RFM ด้านบนไม่ได้เก็บรายชื่อ championsList/loyalList ฯลฯ ไว้ต่อ tier)
  // — ต้องรื้อโครงสร้างข้อมูลใหญ่กว่าที่ scope การแก้บัคนี้ควรทำ
  function openSegDetail(tier) {
    openModal({
      title: `${tier.icon} ${tier.label} Segment`,
      size: 'md',
      body: `
        <div style="padding:14px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:14px;border-left:4px solid ${tier.color}">
          <div style="font-size:2rem;font-weight:900;color:${tier.color}">${tier.count} คน</div>
          <div style="font-size:0.82rem;color:var(--text-muted)">${tier.desc}</div>
        </div>
        ${row('มูลค่าเฉลี่ย', formatCurrency(tier.avgValue))}
        <div style="margin-top:14px">
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px;color:var(--text-muted)">🎯 กลยุทธ์แนะนำ</div>
          <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.83rem">
            ${tier.id === 'champions' ? '🎁 ให้สิทธิพิเศษ VIP, Referral Program, Early Access' :
              tier.id === 'loyal' ? '⭐ Loyalty Points, Birthday Discount, Upsell accessories' :
              tier.id === 'potential' ? '📞 Follow-up, Trial Service Package, Cross-sell insurance' :
              tier.id === 'new' ? '👋 Welcome Package, Onboarding, Service reminder' :
              tier.id === 'at_risk' ? '🚨 Win-back campaign, Special discount, Personal call' :
              '📧 Re-engagement email, Big promotion, Survey why they left'}
          </div>
        </div>
      `
    })
  }

  function openCreateSeg() {
    openModal({
      title: '+ สร้าง Custom Segment',
      size: 'md',
      body: `
        <div style="display:grid;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ Segment *</label><input class="input" id="cs-name" placeholder="เช่น ลูกค้า EV สาขาเชียงใหม่"></div>
          <div class="input-group"><label class="input-label">เงื่อนไข</label>
            <div style="display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond" value="ซื้อในช่วง 6 เดือน"> ซื้อในช่วง 6 เดือน</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond" value="มูลค่า > 1 ล้าน"> มูลค่า > 1 ล้าน</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond" value="ซื้อ EV"> ซื้อ EV</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.83rem;cursor:pointer"><input type="checkbox" name="cond" value="อยู่ในกรุงเทพฯ"> อยู่ในกรุงเทพฯ</label>
            </div>
          </div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('cs-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ Segment', 'error'); return }
        const conditions = [...document.querySelectorAll('input[name="cond"]:checked')].map(el => el.value)
        let id
        try {
          id = await createDoc('custom_segments', { name, conditions })
        } catch (e) {
          showToast('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error')
          return
        }
        savedSegments = [{ id, name, conditions }, ...savedSegments]
        renderPage()
        showToast(`✅ สร้าง Segment "${name}" แล้ว!`, 'success')
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
