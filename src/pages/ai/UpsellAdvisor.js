/**
 * Upsell / Cross-sell AI Advisor — แนะนำ Upsell สินค้าและบริการต่อลูกค้า
 * Route: /ai/upsell
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData, listDocs, createDoc } from '../../core/db.js'
import { sendSms } from '../../utils/comms.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// (v1.0.328) เดิม CUSTOMERS 3 คนพร้อมโอกาส upsell ทั้งหมด (ราคา/เหตุผล/% ความน่าจะซื้อ) เป็นข้อมูลปลอม
// ตายตัวทั้งหมด และปุ่ม "ส่ง LINE ทุกราย"/"ส่ง Offer" แค่ตั้ง u.sent=true ในหน่วยความจำ ไม่ได้เรียกฟังก์ชัน
// ส่งจริง (sendSms ใน utils/comms.js) ที่มีอยู่แล้วในระบบเลย (ใช้จริงแล้วใน BirthdayGreetings.js) แก้ให้
// สร้างลูกค้า+โอกาสจากข้อมูลจริง: ลูกค้าจริงจากยอดขาย (getSalesData), ประกันหมดอายุจริงจาก
// insurance_policies, ระยะเวลาตรวจเช็คจริงจาก job_cards (มี mileage จริงด้วย) — ไม่มีราคา/ความน่าจะซื้อ
// แต่งขึ้นอีกต่อไป (ถ้าไม่มีข้อมูลราคาจริงจะโชว์ "ติดต่อเพื่อเสนอราคา" ไม่ใช่เลขปลอม) ปุ่มส่ง Offer เรียก
// sendSms จริง + บันทึกจริงลง Firestore (upsell_offers)

const OPP_TYPES = {
  insurance: { icon: '🛡', label: 'ต่อ/ทำประกันภัย', priority: 'high' },
  service:   { icon: '🔧', label: 'นัดตรวจเช็คระยะ', priority: 'med' },
  upgrade:   { icon: '🚗', label: 'พิจารณา Trade-in/อัปเกรดรุ่นใหม่', priority: 'low' },
}
const PRIORITY = { high:{ label:'สูง', color:'var(--danger)' }, med:{ label:'กลาง', color:'var(--warning)' }, low:{ label:'ต่ำ', color:'var(--text-muted)' } }

function matchByCustomer(records, cust) {
  return records.filter(r =>
    (cust.phone && r.phone === cust.phone) ||
    (!r.phone && r.custName && cust.name && r.custName.trim().toLowerCase() === cust.name.trim().toLowerCase())
  )
}

export default async function UpsellAdvisorPage(container) {
  const myGen = container.__routerGen
  let customers = []
  let filterType = 'all'
  let loading = true

  async function loadData() {
    loading = true
    let sales = [], policies = [], jobCards = []
    try { sales = await getSalesData() } catch {}
    try { policies = await listDocs('insurance_policies', [], 'endDate', 'desc', 500) } catch {}
    try { jobCards = await listDocs('job_cards', [], 'createdAt', 'desc', 500) } catch {}
    if (container.__routerGen !== myGen) return

    // รวมยอดขายเป็นรายลูกค้า (ชื่อ+เบอร์เดียวกัน) ใช้ยอดขายล่าสุดของคนนั้นเป็นตัวแทน
    const byCust = {}
    sales.filter(s => s.custName && s.salePrice > 0).forEach(s => {
      const key = (s.phone || '') + '|' + s.custName.trim().toLowerCase()
      if (!byCust[key] || (s.date || '') > (byCust[key].date || '')) byCust[key] = s
    })

    // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
    // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
    // เป็นจุดตั้งต้นเสมอ แล้วบวก/ลบด้วย UTC methods (ไม่ผูกกับ timezone ของเครื่อง/เบราว์เซอร์ผู้ใช้)
    const today = todayBangkok()
    const [tY, tM, tD] = today.split('-').map(Number)
    const sixMonthsAgo = new Date(Date.UTC(tY, tM - 1, tD)); sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6)
    const twoYearsAgo = new Date(Date.UTC(tY, tM - 1, tD)); twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2)

    customers = Object.values(byCust).map(s => {
      const cust = { name: s.custName, phone: s.phone || '', model: `${s.brand||''} ${s.model||''}`.trim(), buyDate: s.date }
      const myPolicies = matchByCustomer(policies, cust).sort((a,b) => (b.endDate||'').localeCompare(a.endDate||''))
      const latestPolicy = myPolicies[0]
      const myJobs = matchByCustomer(jobCards, cust).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''))
      const latestJob = myJobs[0]

      const opportunities = []
      if (!latestPolicy || (latestPolicy.endDate && latestPolicy.endDate < today)) {
        opportunities.push({ type: 'insurance',
          reason: latestPolicy ? `ประกันหมดอายุแล้วตั้งแต่ ${formatDate(latestPolicy.endDate)}` : 'ยังไม่พบประวัติทำประกันภัยในระบบ',
          price: latestPolicy?.premium || null })
      }
      if (!latestJob || new Date(latestJob.createdAt) < sixMonthsAgo) {
        opportunities.push({ type: 'service',
          reason: latestJob ? `เข้าศูนย์บริการล่าสุด ${formatDate(latestJob.createdAt)} (เกิน 6 เดือน)` : 'ยังไม่พบประวัติเข้าศูนย์บริการในระบบ',
          price: null })
      }
      if (s.date && new Date(s.date) < twoYearsAgo) {
        opportunities.push({ type: 'upgrade', reason: `ซื้อรถมาแล้ว ${formatDate(s.date)} (เกิน 2 ปี) อาจสนใจดูรุ่นใหม่/Trade-in`, price: null })
      }

      return { ...cust, mileage: latestJob?.mileage || null, lastService: latestJob?.createdAt || null, opportunities }
    }).filter(c => c.opportunities.length)

    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const allOpps = customers.flatMap(c => c.opportunities)
    const highCount = allOpps.filter(o => OPP_TYPES[o.type].priority === 'high').length
    const withPrice = allOpps.filter(o => o.price > 0)
    const totalOpportunity = withPrice.reduce((s,o) => s + o.price, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 Upsell / Cross-sell AI</div>
            <div class="page-subtitle">วิเคราะห์โอกาส Upsell จากข้อมูลจริง · ${customers.length} คน · ${allOpps.length} โอกาส</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="campaign-btn" ${highCount ? '' : 'disabled'}>📤 ส่ง SMS Priority สูงทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('💰 มูลค่าที่ทราบราคา', formatCurrency(totalOpportunity), 'var(--success)')}
          ${sc('🔴 Priority สูง', highCount+' รายการ', 'var(--danger)')}
          ${sc('👥 ลูกค้าที่มีโอกาส', customers.length+' คน', 'var(--primary)')}
          ${sc('📋 โอกาสทั้งหมด', allOpps.length+' รายการ', 'var(--text)')}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${['all', ...Object.keys(OPP_TYPES)].map(t=>`
            <button class="btn btn-xs ${filterType===t?'btn-primary':'btn-secondary'} type-btn" data-t="${t}">
              ${t==='all'?'ทุกประเภท':OPP_TYPES[t].icon+' '+OPP_TYPES[t].label}
            </button>`).join('')}
        </div>

        ${!customers.length ? `<div class="empty-state"><div class="empty-icon">🤖</div><div class="empty-title">ยังไม่พบโอกาส Upsell จากข้อมูลจริงในระบบ</div></div>` : `
        <div style="display:flex;flex-direction:column;gap:14px">
          ${customers.map(c => customerBlock(c)).join('')}
        </div>
        `}
      </div>`

    container.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { filterType = b.dataset.t; render() }))
    container.querySelectorAll('.offer-btn').forEach(b => b.addEventListener('click', () => {
      const c = customers.find(x => x.phone === b.dataset.cid || x.name === b.dataset.cid)
      const o = c?.opportunities[+b.dataset.oi]
      if (c && o) openOfferModal(c, o)
    }))
    document.getElementById('campaign-btn')?.addEventListener('click', () => {
      const targets = []
      customers.forEach(c => c.opportunities.forEach((o, i) => { if (OPP_TYPES[o.type].priority === 'high') targets.push({ c, o, i }) }))
      openModal({
        title:'📤 ส่ง SMS Priority สูงทั้งหมด', size:'sm',
        body:`<div style="font-size:0.8rem">
          <p style="color:var(--text-muted);margin-bottom:10px">ส่ง SMS แจ้งโอกาส Priority สูงทั้งหมด ${targets.length} รายการ (ต้องมีเบอร์โทรจริง)</p>
          ${targets.map(({c,o})=>`
            <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
              <b>${esc(c.name)}</b> — ${OPP_TYPES[o.type].label} ${!c.phone ? '<span style="color:var(--danger)">(ไม่มีเบอร์โทร)</span>' : ''}
            </div>`).join('')}`,
        confirmText:'📤 ส่ง SMS ทุกราย',
        async onConfirm() {
          let ok = 0, failed = 0
          for (const { c, o } of targets) {
            if (!c.phone) { failed++; continue }
            try {
              const msg = buildMsg(c, o)
              await sendSms([c.phone], msg)
              await createDoc('upsell_offers', { customer: c.name, phone: c.phone, type: o.type, channel: 'sms', message: msg, sentAt: new Date().toISOString() })
              ok++
            } catch { failed++ }
          }
          showToast(failed ? `📤 ส่งสำเร็จ ${ok} ราย — พลาด ${failed} ราย` : `📤 ส่ง SMS สำเร็จทั้งหมด ${ok} ราย`, failed ? 'error' : 'success')
        }
      })
    })
  }

  function buildMsg(c, o) {
    return `สวัสดีคุณ${c.name} ทีม LAMOM แจ้งว่า${OPP_TYPES[o.type].label}สำหรับ ${c.model} ของคุณ เพราะ ${o.reason} สนใจให้เจ้าหน้าที่ติดต่อกลับไหมครับ?`
  }

  function customerBlock(c) {
    const opps = filterType === 'all' ? c.opportunities : c.opportunities.filter(o => o.type === filterType)
    if (!opps.length) return ''
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${esc(c.name)}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${esc(c.model)}${c.mileage ? ' · ไมล์ล่าสุด ' + c.mileage.toLocaleString() + ' km' : ''} · ซื้อ ${formatDate(c.buyDate)}</div>
          </div>
          <div style="text-align:right;font-size:0.72rem;color:var(--text-muted)">${c.phone ? '📱 ' + esc(c.phone) : '⚠️ ไม่มีเบอร์โทร'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${c.opportunities.map((o, i) => (opps.includes(o) ? upsellRow(c, o, i) : '')).join('')}
        </div>
      </div>`
  }

  function upsellRow(c, o, i) {
    const t = OPP_TYPES[o.type]
    const p = PRIORITY[t.priority]
    return `
      <div style="display:flex;align-items:center;gap:10px;background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);border-left:3px solid ${p.color}">
        <span style="font-size:1.3rem">${t.icon}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:0.82rem">${t.label}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${esc(o.reason)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:700;color:var(--primary);font-size:0.82rem">${o.price > 0 ? formatCurrency(o.price) : 'ติดต่อเพื่อเสนอราคา'}</div>
          <span style="font-size:0.62rem;background:${p.color};color:#fff;padding:1px 6px;border-radius:8px">${p.label}</span>
        </div>
        <button class="btn btn-xs btn-primary offer-btn" data-cid="${esc(c.phone || c.name)}" data-oi="${i}" style="font-size:0.72rem;flex-shrink:0" ${c.phone ? '' : 'disabled title="ไม่มีเบอร์โทร"'}>📤 เสนอ</button>
      </div>`
  }

  function openOfferModal(c, o) {
    const t = OPP_TYPES[o.type]
    openModal({
      title: `${t.icon} เสนอ ${t.label}`,
      size: 'sm',
      body: `
        <div style="font-size:0.78rem">
          <div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:12px">
            <div style="font-weight:700;margin-bottom:4px">ลูกค้า: ${esc(c.name)}</div>
            <div style="color:var(--text-muted)">${esc(c.model)}</div>
          </div>
          <div style="margin-bottom:8px"><b>ราคา:</b> ${o.price > 0 ? formatCurrency(o.price) : 'ยังไม่มีข้อมูลราคา — เจ้าหน้าที่เสนอราคาตอนติดต่อ'}</div>
          <div style="margin-bottom:8px"><b>เหตุผล:</b><br>${esc(o.reason)}</div>
          <div style="margin-top:10px"><label style="font-size:0.72rem;color:var(--text-muted)">ข้อความ SMS</label>
            <textarea class="input" id="offer-msg" style="width:100%;height:80px;margin-top:4px;font-size:0.76rem">${esc(buildMsg(c, o))}</textarea>
          </div>
        </div>`,
      confirmText: '📤 ส่ง SMS',
      async onConfirm() {
        if (!c.phone) { showToast('❗ ไม่มีเบอร์โทรลูกค้ารายนี้', 'error'); return false }
        const msg = document.getElementById('offer-msg')?.value?.trim()
        try {
          await sendSms([c.phone], msg)
          await createDoc('upsell_offers', { customer: c.name, phone: c.phone, type: o.type, channel: 'sms', message: msg, sentAt: new Date().toISOString() })
          showToast(`📤 ส่ง SMS ถึงคุณ${c.name} แล้ว`, 'success')
        } catch { showToast('ส่งไม่สำเร็จ', 'error'); return false }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
