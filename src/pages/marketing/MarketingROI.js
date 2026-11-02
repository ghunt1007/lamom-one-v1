/**
 * Marketing ROI — วัดผลตอบแทนการตลาด
 * Route: /marketing/roi
 */
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData, listDocs, createDoc, updateDocData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'
import { openModal } from '../../utils/modal.js'
import { escHtml as __escA } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'

const BASE_CH = [
  { id: 'fb',       name: 'Facebook Ads',     icon: '📘', leadsTarget: 100, color: '#3b82f6', keys: ['facebook','fb','meta'] },
  { id: 'gg',       name: 'Google Ads',        icon: '🔵', leadsTarget: 80,  color: '#10b981', keys: ['google','google ads'] },
  { id: 'tt',       name: 'TikTok',            icon: '🎵', leadsTarget: 150, color: '#ec4899', keys: ['tiktok'] },
  { id: 'line',     name: 'LINE OA',           icon: '💚', leadsTarget: 50,  color: '#22c55e', keys: ['line','line oa'] },
  { id: 'event',    name: 'Event/Motor Show',  icon: '🎪', leadsTarget: 250, color: '#f59e0b', keys: ['event','motor show','motorshow','งาน','บูธ','booth'] },
  { id: 'referral', name: 'Referral',          icon: '🤝', leadsTarget: 40,  color: '#8b5cf6', keys: ['referral','แนะนำ','refer'] },
]

// เก็บใน Firestore collection เดียว doc เดียว ('marketing_budgets') → sync ข้ามอุปกรณ์จริง
// เดิมเก็บใน localStorage เครื่องเดียว ทำให้ทีมมาร์เก็ตติ้งเห็นงบต่อช่องทาง (และ ROI% ที่คำนวณจากงบนี้) ไม่ตรงกันข้ามเครื่อง
let _budgetDocId = null

async function loadBudgets() {
  try {
    const docs = await listDocs('marketing_budgets', [], 'createdAt', 'asc', 1)
    if (docs.length > 0) { _budgetDocId = docs[0].id; return docs[0].budgets || {} }
  } catch {}
  return {}
}

async function saveBudgets(b) {
  try {
    if (_budgetDocId) await updateDocData('marketing_budgets', _budgetDocId, { budgets: b })
    else _budgetDocId = await createDoc('marketing_budgets', { budgets: b })
    return true
  } catch { return false }
}

function matchChannel(source) {
  if (!source) return null
  const s = source.toLowerCase().trim()
  for (const ch of BASE_CH) {
    if (ch.keys.some(k => s.includes(k))) return ch.id
  }
  return null
}

export default async function MarketingROIPage(container) {
  const myGen = container.__routerGen
  let sortBy = 'roi'
  let allSales = []
  let leadCampaigns = []
  // เดิม new Date().toISOString().slice(0,7) คืนเดือนตาม UTC เสมอ ทำให้ "เดือนนี้" ผิดไปทุกครั้งที่
  // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
  let monthFilter = todayBangkok().slice(0, 7)
  let dataSource = 'demo'
  let budgets = await loadBudgets()
  if (container.__routerGen !== myGen) return

  try {
    const s = await getSalesData()
    if (container.__routerGen !== myGen) return
    if (s.length >= 1) {
      allSales = s
      // Only use live mode if some sales have a channel/source field
      const hasSource = s.some(x => x.source || x.channel || x.leadSource)
      dataSource = hasSource ? 'live' : 'demo'
    }
  } catch {}
  // (v1.0.527) เดิม Leads ต่อช่องทางไม่เคยเป็นข้อมูลจริงเลย (ประมาณจาก DEMO_CH ratio เสมอแม้ badge บอกว่า
  // "ข้อมูลจริง") ทั้งที่ระบบมี lead_gen_campaigns (LeadGeneration.js/LeadSources.js) เก็บจำนวน Lead จริงต่อ
  // แคมเปญ/ช่องทางอยู่แล้ว — ดึงมาใช้แทนถ้าช่องทางนั้นมีแคมเปญบันทึกไว้จริง (ไม่มีก็ยัง fallback เป็นค่าประมาณ
  // เหมือนเดิม ไม่ใช่ทุกช่องทางจะมีแคมเปญบันทึกครบ)
  try { leadCampaigns = await listDocs('lead_gen_campaigns', [], 'startDate', 'desc', 500) } catch {}

  function getMonths() {
    const mo = new Set(allSales.map(s => (s.date || '').slice(0, 7)).filter(Boolean))
    const arr = [...mo].sort().reverse().slice(0, 12)
    if (!arr.length) arr.push(monthFilter)
    return arr
  }

  function buildChannels(month) {
    return BASE_CH.map(ch => {
      // (v1.0.945) ยังไม่ได้ใส่งบ = 0 (เดิมใช้งบสมมติ 45,000/38,000... บาท ทำให้ ROI ติดลบปลอม)
      const spend = Number(budgets[ch.id]) || 0
      let leads, customers, revenue, profit
      // (แก้ไข) เดิม leads ในโหมด 'live' ยังคำนวณจาก DEMO_CH ratio อยู่ดี (ไม่ใช่ข้อมูลจริง) ทั้งที่ badge
      // หัวหน้า ● ข้อมูลจริง สื่อว่าทุกตัวเลขในหน้านี้เป็นข้อมูลจริง — ระบบไม่มี field จำนวน Lead ต่อช่องทาง
      // เก็บจริงเลย (มีแค่ยอดขาย/ลูกค้าจริงจาก bookings) จึงทำได้แค่ทำเครื่องหมาย leadsEstimated:true ไว้
      // แสดงกำกับใน UI ว่าตัวเลขนี้เป็นค่าประมาณ ไม่ใช่ของจริงเหมือนลูกค้า/รายได้
      let leadsEstimated = false
      if (dataSource === 'live') {
        const mySales = allSales.filter(s => {
          const mo = (s.date || '').slice(0, 7)
          return matchChannel(s.source || s.channel || s.leadSource || '') === ch.id && (!month || mo === month)
        })
        customers = mySales.length
        revenue = mySales.reduce((a, s) => a + (s.salePrice || 0), 0)
        // (v1.0.527) กำไรขั้นต้นจริงต่อดีล (totalIncome = margin−งบการตลาด+คอมเซลส์+คอมไฟแนนซ์ ต่อใบจอง)
        // แทนการสมมติอัตรากำไร 8% คงที่ — แต่ละดีลมาร์จิ้นไม่เท่ากันจริง ใช้ตัวเลขจริงแม่นยำกว่า
        profit = mySales.reduce((a, s) => a + (s.totalIncome || 0), 0)
        const myCampaigns = leadCampaigns.filter(c => matchChannel(c.channel || '') === ch.id && (!month || (c.startDate || '').slice(0, 7) === month))
        if (myCampaigns.length) {
          leads = myCampaigns.reduce((a, c) => a + (c.leads || 0), 0)
        } else {
          // (2026-11-02) ไม่เดาจำนวน Lead จากอัตราสมมติแล้ว — ยังไม่มีแคมเปญบันทึก Lead = ยังไม่รู้
          leads = 0
          leadsEstimated = customers > 0
        }
      } else {
        // (2026-11-02) ยังไม่มียอดขายจริง → โชว์ 0 ไม่ใช่ตัวเลขสมมติ
        leads = 0; customers = 0; revenue = 0; profit = 0
      }
      const roiPct = spend > 0 ? Math.round((profit - spend) / spend * 100) : null
      const cplV = leads > 0 ? Math.round(spend / leads) : 0
      const cacV = customers > 0 ? Math.round(spend / customers) : 0
      const convV = leads > 0 ? Math.round(customers / leads * 1000) / 10 : 0
      return { ...ch, spend, leads, leadsEstimated, customers, revenue, profit, roiPct, cplV, cacV, convV }
    }).map((c, _, all) => ({ ...c, spendPct: Math.round(c.spend / Math.max(...all.map(x => x.spend), 1) * 100) }))
  }

  function renderPage() {
    const channels = buildChannels(monthFilter)
    const sorted = [...channels].sort((a, b) => {
      if (sortBy === 'roi') return (b.roiPct ?? -Infinity) - (a.roiPct ?? -Infinity) || b.customers - a.customers
      if (sortBy === 'spend') return b.spend - a.spend
      if (sortBy === 'customers') return b.customers - a.customers
      return a.cplV - b.cplV
    })
    const totalSpend = channels.reduce((a, c) => a + c.spend, 0)
    const totalLeads = channels.reduce((a, c) => a + c.leads, 0)
    const totalCustomers = channels.reduce((a, c) => a + c.customers, 0)
    const totalRevenue = channels.reduce((a, c) => a + c.revenue, 0)
    const totalProfit = channels.reduce((a, c) => a + c.profit, 0)
    const blendedROI = totalSpend > 0 ? Math.round((totalProfit - totalSpend) / totalSpend * 100) : 0
    const withRoi = channels.filter(c => c.roiPct !== null).sort((a, b) => b.roiPct - a.roiPct)
    const best = withRoi[0]
    const worst = withRoi[withRoi.length - 1]
    const months = getMonths()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 ผลตอบแทนการตลาด (ROI)</div>
            <div class="page-subtitle">วัดผลตอบแทน — แต่ละช่องทางการตลาด${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem" title="ลูกค้า/รายได้/กำไร คำนวณจากยอดขายจริงเสมอ — Leads เป็นข้อมูลจริงถ้าช่องทางนั้นมีแคมเปญบันทึกไว้ใน Lead Generation ไม่งั้น fallback เป็นค่าประมาณ (ดูป้าย ประมาณ กำกับ)">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <select class="input" id="month-filter" style="font-size:0.78rem;padding:4px 10px;height:auto">
              <option value="">ทั้งหมด</option>
              ${months.map(m => `<option value="${__escA(m)}" ${m === monthFilter ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-xs" id="edit-budget-btn">✏️ แก้ไขงบ</button>
            <button class="btn btn-primary" id="export-btn">📤 ส่งออก</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💸 งบรวม', formatCurrency(totalSpend), 'warning')}
          ${kpi('🧲 Leads รวม', totalLeads.toLocaleString() + ' ราย', 'primary')}
          ${kpi('🎯 ลูกค้าใหม่', totalCustomers + ' ราย', 'success')}
          ${kpi('📈 ROI รวม', totalSpend > 0 ? blendedROI + '%' : '—', blendedROI >= 100 ? 'success' : 'warning')}
        </div>

        <!-- AI Insight -->
        <div style="padding:12px 14px;background:var(--surface-2);border-left:3px solid var(--primary);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.8rem">
          🤖 <strong>LAMI วิเคราะห์:</strong>
          ${best ? `${best.icon} <strong>${best.name}</strong> ROI ดีที่สุด (${best.roiPct}%)` : 'ยังไม่ได้ใส่งบการตลาด กด ✏️ แก้ไขงบ เพื่อดู ROI แต่ละช่องทาง'}
          ${worst && worst.id !== best?.id ? ` · ${worst.icon} ${worst.name} ROI ต่ำสุด (${worst.roiPct}%) ควรปรับกลยุทธ์` : ''}
          ${totalLeads > 0 ? ` · CPL เฉลี่ย ${formatCurrency(Math.round(totalSpend / totalLeads))} · Conversion ${Math.round(totalCustomers / totalLeads * 1000) / 10}%` : ''}
        </div>

        <!-- Sort tabs -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          ${[['roi','📈 ROI'],['spend','💸 งบ'],['customers','🎯 ลูกค้า'],['cpl','💰 CPL ต่ำสุด']].map(([k, l]) =>
            `<button class="btn btn-xs ${sortBy === k ? 'btn-primary' : 'btn-secondary'} sort-btn" data-s="${k}">${l}</button>`).join('')}
        </div>

        <!-- Channel cards -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sorted.map((c, i) => {
            const r = c.roiPct ?? 0
            const barColor = c.roiPct === null ? 'var(--text-muted)' : r >= 100 ? 'var(--success)' : r >= 0 ? 'var(--warning)' : 'var(--danger)'
            return `<div class="card" style="padding:13px 14px;border-left:3px solid ${c.color}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="display:flex;gap:8px;align-items:center">
                  ${i === 0 && c.roiPct !== null ? '<span style="font-size:1rem">👑</span>' : ''}
                  <div>
                    <div style="font-weight:700;font-size:0.88rem">${c.icon} ${c.name}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">งบ ${formatCurrency(c.spend)} → รายได้ ${formatCurrency(c.revenue)}</div>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:1.1rem;font-weight:900;color:${barColor}">${c.roiPct === null ? '—' : (r > 0 ? '+' : '') + r + '%'}</div>
                  <div style="font-size:0.63rem;color:var(--text-muted)">ROI</div>
                </div>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:4px;margin-bottom:8px">
                <div style="background:${c.color};width:${c.spendPct}%;height:4px;border-radius:3px;opacity:0.7;transition:width 0.4s"></div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
                ${mini(c.leadsEstimated ? '🧲 Leads (ประมาณ)' : '🧲 Leads', c.leads.toLocaleString())}
                ${mini('💰 CPL', formatCurrency(c.cplV))}
                ${mini('🎯 ลูกค้า', c.customers + ' (' + c.convV + '%)')}
                ${mini('📊 CAC', formatCurrency(c.cacV))}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sort-btn').forEach(b => b.addEventListener('click', () => { sortBy = b.dataset.s; renderPage() }))
    document.getElementById('month-filter')?.addEventListener('change', e => { monthFilter = e.target.value; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const rows = channels.map(c => ({
        channel: c.name, spend: c.spend, leads: c.leads, customers: c.customers,
        revenue: c.revenue, roi: c.roiPct === null ? '' : c.roiPct + '%', cpl: c.cplV, cac: c.cacV, conv: c.convV + '%'
      }))
      exportToExcel(channels.map(c => ({
        'ช่องทาง': c.name, 'งบ (฿)': c.spend, 'Leads': c.leads,
        'ลูกค้าใหม่': c.customers, 'รายได้ (฿)': c.revenue,
        'ROI': c.roiPct === null ? '' : c.roiPct + '%', 'CPL (฿)': c.cplV, 'CAC (฿)': c.cacV, 'Conversion%': c.convV + '%'
      })), 'marketing_roi')
    })
    document.getElementById('edit-budget-btn')?.addEventListener('click', () => {
      openModal({
        title: '✏️ แก้ไขงบการตลาดต่อช่องทาง',
        size: 'sm',
        body: `<div style="display:grid;gap:8px">${BASE_CH.map(ch => `
          <div class="input-group">
            <label class="input-label">${ch.icon} ${ch.name}</label>
            <input class="input" type="number" id="bgt-${ch.id}" value="${budgets[ch.id] ?? ''}" placeholder="0" step="1000" min="0">
          </div>`).join('')}
        </div>`,
        async onConfirm() {
          BASE_CH.forEach(ch => {
            const v = parseInt(document.getElementById('bgt-' + ch.id)?.value)
            if (!isNaN(v)) budgets[ch.id] = v
          })
          const ok = await saveBudgets(budgets)
          showToast(ok ? '✅ บันทึกงบแล้ว' : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
          if (ok) renderPage()
        }
      })
    })
  }

  renderPage()
}

function mini(l, v) { return `<div style="background:var(--surface-2);padding:6px 8px;border-radius:var(--radius-sm)"><div style="color:var(--text-muted);font-size:0.63rem">${l}</div><div style="font-weight:700;font-size:0.8rem">${v}</div></div>` }
