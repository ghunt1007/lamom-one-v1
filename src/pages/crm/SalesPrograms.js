// (v1.0.970) แคมเปญ & เงื่อนไขขายประจำเดือน — Route: /crm/programs
// ที่เดียวสำหรับ: ดอกเบี้ย/แคมเปญไฟแนนซ์ · แคมเปญแบรนด์ (มอเตอร์) · แคมเปญโชว์รูม · แคมเปญทีมขาย · แคมเปญที่เซลส์คิดเอง
// · มาร์จิ้นโชว์รูม · ค่าบริหารผู้จัดการทีม/ฝ่ายขาย · เงินรางวัลพิเศษ — 1 เดือนมีได้หลายแคมเปญ (แต่ละอันมีช่วงวันที่เอง)
// "ขายรุ่นไหน?" ด้านบนบอกทันทีว่ารถรุ่นนั้นวันนี้ได้อะไรบ้าง + ข้อความพร้อมส่งลูกค้า
// มาร์จิ้น/ค่าบริหาร เห็นเฉพาะผู้จัดการขึ้นไป (ซ่อนจากเซลส์) · ข้อมูลอยู่ใน sales_programs
import './salesPrograms.css'
import { watchDocs, createDoc, updateDocData, softDelete, listDocs } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { isManagerRole } from '../../utils/managerRole.js'
import { myEffectiveCompanyId, companyScopeFilters } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import { todayBangkok, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { escHtml } from '../../utils/escape.js'
import { navigate } from '../../core/router.js'
import { copyText } from '../../utils/copyText.js'
import { myName } from '../../utils/myName.js'
import { getFinanceCompanies, getSalesStaff } from '../../data/masterData.js'
import { getBrands, getVehicles } from '../../data/vehicleDatabase.js'
import { analyzeSalesProgram, aiErrorText } from '../../utils/ai.js'
import {
  PROGRAM_TYPES, TYPE_ORDER, CUSTOMER_TYPES, MGMT_ROLES, BONUS_FOR,
  normalizeProgram, validateProgram, overlapsMonth, liveState, daysLeft, rangeLabel, monthBounds, shiftMonth, monthLabelTh,
  sortPrograms, programsForCar, carSummary, copyToNextMonth, monthlyInstallment, canSeeType,
  fromLegacyRateSheet, fromLegacyPromotion, programEarnings, myBonusProgress, COUNT_BY,
} from '../../utils/salesPrograms.js'

const COL = 'sales_programs'
const baht = n => formatCurrency(Math.round(n || 0))
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch {} }


export default async function SalesProgramsPage(container) {
  const myGen = container.__routerGen
  const today = todayBangkok()
  const isManager = isManagerRole()
  const params = new URLSearchParams(location.search || '')
  let month = today.slice(0, 7)
  let typeFilter = TYPE_ORDER.includes(params.get('tab')) ? params.get('tab') : 'all'
  let programs = []
  let legacy = []
  let loaded = false
  const finder = { brand: lsGet('sp-brand', ''), model: lsGet('sp-model', ''), price: lsGet('sp-price', ''), down: lsGet('sp-down', '25'), months: lsGet('sp-months', '60') }

  const brands = getBrands()
  const visibleTypes = TYPE_ORDER.filter(t => canSeeType(t, isManager))

  container.innerHTML = `
    <div class="page-content animate-slide sp">
      <div class="page-header">
        <div>
          <div class="page-title">🎯 แคมเปญ & เงื่อนไขขาย</div>
          <div class="page-subtitle">ดอกเบี้ยไฟแนนซ์ · แคมเปญแบรนด์ / โชว์รูม / ทีม / เซลส์${isManager ? ' · มาร์จิ้น · ค่าบริหาร' : ''} · เงินรางวัล — 1 เดือนมีได้หลายแคมเปญ</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="sp-ai">✨ ให้ AI อ่านประกาศ</button>
          <button class="btn btn-primary" id="sp-add">＋ เพิ่มแคมเปญ</button>
        </div>
      </div>

      <div class="card sp-finder">
        <div class="sp-finder-h">🔎 ขายรุ่นไหน? <span>ดูว่ารถรุ่นนี้วันนี้ได้อะไรบ้าง</span></div>
        <div class="sp-finder-row">
          <select class="input" id="sp-f-brand" aria-label="ยี่ห้อ"><option value="">ทุกยี่ห้อ</option>${brands.map(b => `<option${b === finder.brand ? ' selected' : ''}>${escHtml(b)}</option>`).join('')}</select>
          <input class="input" id="sp-f-model" list="sp-models" placeholder="รุ่น เช่น S07" value="${escHtml(finder.model)}" aria-label="รุ่น">
          <input class="input" id="sp-f-price" inputmode="numeric" placeholder="ราคารถ (ไม่บังคับ)" value="${escHtml(finder.price)}" aria-label="ราคารถ">
          <select class="input" id="sp-f-down" aria-label="ดาวน์">${[0, 5, 10, 15, 20, 25, 30, 35, 40, 50].map(d => `<option value="${d}"${String(d) === finder.down ? ' selected' : ''}>ดาวน์ ${d}%</option>`).join('')}</select>
          <select class="input" id="sp-f-months" aria-label="จำนวนงวด">${[36, 48, 60, 72, 84].map(m => `<option value="${m}"${String(m) === finder.months ? ' selected' : ''}>${m} งวด</option>`).join('')}</select>
        </div>
        <datalist id="sp-models"></datalist>
        <div id="sp-f-out"></div>
      </div>

      <div class="sp-bar">
        <div class="sp-nav">
          <button class="btn btn-secondary btn-sm" id="sp-prev" aria-label="เดือนก่อน">‹</button>
          <div class="sp-month" id="sp-month"></div>
          <button class="btn btn-secondary btn-sm" id="sp-next" aria-label="เดือนถัดไป">›</button>
          <button class="btn btn-ghost btn-sm" id="sp-now">เดือนนี้</button>
        </div>
      </div>
      <div class="sp-chips chip-scroll" id="sp-chips"></div>
      <div id="sp-earn"></div>
      <div id="sp-list"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>
    </div>`

  const $ = s => container.querySelector(s)
  const alive = () => container.__routerGen === myGen && container.isConnected

  // ── ข้อมูล ──
  watchDocs(COL, [], 'dateFrom', 'desc', 2000, rows => {
    if (!alive()) return
    programs = rows.filter(r => !r.deleted)
    loaded = true
    render()
  })
  // ข้อมูลจากหน้าเดิม (ตารางดอกเบี้ย / โปรโมชั่น) แสดงรวมแบบอ่านอย่างเดียว ไม่ต้องกรอกซ้ำ
  Promise.all([
    listDocs('finance_rate_sheets', [], 'createdAt', 'desc', 300).catch(() => []),
    listDocs('promotions', [], 'startDate', 'desc', 300).catch(() => []),
  ]).then(([rs, pr]) => {
    legacy = [...rs.filter(r => !r.deleted).map(fromLegacyRateSheet), ...pr.filter(r => !r.deleted).map(fromLegacyPromotion)]
    if (alive() && loaded) render()
  })

  const all = () => [...programs, ...legacy].filter(p => canSeeType(p.type, isManager))

  // ใบจองจริง (ตามสิทธิ์การมองเห็น) — ใช้คำนวณรางวัล/มาร์จิ้น/ค่าบริหารที่ได้จริงในเดือนนี้
  let bookings = null
  Promise.all([getVisibilityScope().catch(() => null), listDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => [])])
    .then(([scope, rows]) => { bookings = rows.filter(b => !b.deleted && scopeIncludesRecord(scope, b.salesName, b)); if (alive() && loaded) renderEarn() })
  let earnOpen = lsGet('sp-earn-open', '1') === '1'

  // ── วาด ──
  function render() {
    renderFinder()
    renderEarn()
    $('#sp-month').textContent = monthLabelTh(month)
    const inMonth = all().filter(p => overlapsMonth(p, month))
    const counts = Object.fromEntries(visibleTypes.map(t => [t, inMonth.filter(p => p.type === t).length]))
    $('#sp-chips').innerHTML = `<button type="button" class="sp-chip${typeFilter === 'all' ? ' on' : ''}" data-t="all">ทั้งหมด <b>${inMonth.length}</b></button>` +
      visibleTypes.map(t => `<button type="button" class="sp-chip t-${t}${typeFilter === t ? ' on' : ''}" data-t="${t}">${PROGRAM_TYPES[t].icon} ${PROGRAM_TYPES[t].short} <b>${counts[t]}</b></button>`).join('')
    const shown = sortPrograms(inMonth.filter(p => typeFilter === 'all' || p.type === typeFilter))
    if (!loaded) return
    if (!shown.length) {
      const t = PROGRAM_TYPES[typeFilter]
      $('#sp-list').innerHTML = `<div class="empty-state sp-empty"><div class="empty-icon">${t ? t.icon : '🎯'}</div>
        <div class="empty-title">ยังไม่มี${t ? t.label : 'แคมเปญ'}ในเดือน${monthLabelTh(month)}</div>
        <div class="empty-desc">กด “＋ เพิ่มแคมเปญ” หรือก๊อปข้อความประกาศจาก LINE แล้วกด “✨ ให้ AI อ่านประกาศ”${month > today.slice(0, 7) ? ' · หรือคัดลอกแคมเปญเดือนก่อนมาใช้ต่อ (ปุ่ม 📄 บนการ์ด)' : ''}</div>
        <button class="btn btn-primary" data-add="${typeFilter === 'all' ? '' : typeFilter}">＋ เพิ่ม${t ? t.short : 'แคมเปญ'}</button></div>`
      return
    }
    const groups = TYPE_ORDER.filter(t => shown.some(p => p.type === t))
    $('#sp-list').innerHTML = groups.map(t => `
      <div class="sp-group">
        <div class="sp-group-h t-${t}"><span>${PROGRAM_TYPES[t].icon} ${PROGRAM_TYPES[t].label}</span><button class="btn btn-ghost btn-sm" data-add="${t}">＋ เพิ่ม</button></div>
        <div class="sp-cards">${shown.filter(p => p.type === t).map(card).join('')}</div>
      </div>`).join('')
  }

  // ── ผลตอบแทนเดือนนี้ (นับรถจริง) ──
  function renderEarn() {
    const box = $('#sp-earn')
    if (!box) return
    const relevant = all().filter(p => ['bonus', 'margin', 'mgmtfee'].includes(p.type) && overlapsMonth(p, month) && p.status !== 'draft')
    if (!relevant.length || !bookings) { box.innerHTML = ''; return }
    const e = programEarnings(relevant, bookings, { month, staff: getSalesStaff(), isManager })
    const me = myName('')
    const bar = (pct, ok) => `<div class="sp-prog"><i class="${ok ? 'ok' : ''}" style="width:${Math.max(3, pct ?? 0)}%"></i></div>`
    const rowHtml = (p, r) => {
      const ok = r.earned > 0
      const msg = ok ? `✅ ได้ ${baht(r.earned)}` : r.target ? `อีก <b>${r.left}</b> คัน ได้ ${baht(p.amount)}` : 'ยังไม่มียอด'
      return `<div class="sp-er"><div class="sp-er-n">${escHtml(r.name)}</div><div class="sp-er-u">${r.units}${r.target ? `/${r.target}` : ''} คัน</div>${r.target ? bar(r.pct, ok) : '<div></div>'}<div class="sp-er-m${ok ? ' ok' : ''}">${msg}</div></div>`
    }
    let body = ''
    if (isManager) {
      const bonusTotal = e.bonuses.reduce((a, b) => a + b.total, 0)
      const tiles = [
        e.bonuses.length ? `<div class="sp-f-tile"><span>🏆 รางวัลพิเศษที่ได้แล้ว</span><b>${baht(bonusTotal)}</b><small>${e.bonuses.length} รางวัล</small></div>` : '',
        relevant.some(p => p.type === 'margin') ? `<div class="sp-f-tile is-internal"><span>💹 มาร์จิ้นโชว์รูม</span><b>${baht(e.margin.amount)}</b><small>จาก ${e.margin.units} คัน</small></div>` : '',
        relevant.some(p => p.type === 'mgmtfee' && p.role !== 'salesManager') ? `<div class="sp-f-tile is-internal"><span>🧑‍💼 ค่าบริหาร ผจก.ทีม</span><b>${baht(e.mgmt.teamManager.amount)}</b><small>จาก ${e.mgmt.teamManager.units} คัน</small></div>` : '',
        relevant.some(p => p.type === 'mgmtfee' && p.role === 'salesManager') ? `<div class="sp-f-tile is-internal"><span>🧑‍💼 ค่าบริหาร ผจก.ฝ่าย</span><b>${baht(e.mgmt.salesManager.amount)}</b><small>จาก ${e.mgmt.salesManager.units} คัน</small></div>` : '',
      ].join('')
      body = `<div class="sp-f-sum">${tiles}</div>` + e.bonuses.map(({ p, rows }) => `
        <div class="sp-eb"><div class="sp-eb-h">🏆 ${escHtml(p.title)} <small>${escHtml(rangeLabel(p))} · ${escHtml(COUNT_BY[p.countBy] || COUNT_BY.delivered)}</small></div>
        ${rows.length ? rows.slice(0, 12).map(r => rowHtml(p, r)).join('') + (rows.length > 12 ? `<div class="sp-f-hint">และอีก ${rows.length - 12} คน</div>` : '') : '<div class="sp-f-hint">ยังไม่มียอด</div>'}</div>`).join('')
    } else {
      const mine = myBonusProgress(e, me)
      if (!mine.length) { box.innerHTML = ''; return }
      body = mine.map(({ p, row }) => `<div class="sp-eb"><div class="sp-eb-h">🏆 ${escHtml(p.title)} <small>${escHtml(rangeLabel(p))}</small></div>${rowHtml(p, { ...row, name: 'ของฉัน' })}</div>`).join('')
    }
    box.innerHTML = `<details class="card sp-earn"${earnOpen ? ' open' : ''}><summary>💰 ${isManager ? 'ผลตอบแทนจากแคมเปญ' : 'รางวัลของฉัน'} — ${escHtml(monthLabelTh(month))} <small>นับจากใบจองจริง</small></summary>${body}</details>`
    box.querySelector('details').addEventListener('toggle', ev => { earnOpen = ev.target.open; lsSet('sp-earn-open', earnOpen ? '1' : '0') })
  }

  function stateBadge(p) {
    const s = liveState(p, today)
    const left = daysLeft(p, today)
    const txt = { draft: 'ร่าง', soon: 'ยังไม่เริ่ม', ended: 'หมดแล้ว', ending: left === 0 ? 'วันสุดท้าย' : `เหลือ ${left} วัน`, live: 'ใช้ได้ตอนนี้' }[s]
    return `<span class="sp-state s-${s}">${txt}</span>`
  }

  function valueLine(p) {
    const bits = []
    if (p.type === 'finance') {
      if (p.financeCo) bits.push(`<b>${escHtml(p.financeCo)}</b>`)
      if (p.subsidy) bits.push(`ซับซิดี้ ${baht(p.subsidy)}`)
      if (p.financeCommission && isManager) bits.push(`คอมไฟแนนซ์ ${baht(p.financeCommission)}`)
    } else if (p.type === 'margin') {
      bits.push(`<b>${[p.amount ? baht(p.amount) + '/คัน' : '', p.percent ? p.percent + '%' : ''].filter(Boolean).join(' + ') || '-'}</b>`)
    } else if (p.type === 'mgmtfee') {
      bits.push(`${escHtml(MGMT_ROLES[p.role] || '')} <b>${baht(p.amount)}/คัน</b>`)
    } else if (p.type === 'bonus') {
      bits.push(`<b>${baht(p.amount)}</b>${p.targetUnits ? ` เมื่อถึง ${p.targetUnits} คัน` : ''}`)
      bits.push(escHtml(p.bonusFor === 'person' && p.owner ? p.owner : BONUS_FOR[p.bonusFor] || ''))
      if (p.sponsor) bits.push('ให้โดย ' + escHtml(p.sponsor))
    } else if (p.amount) bits.push(`ลด <b>${baht(p.amount)}</b>`)
    if (p.gift) bits.push('🎁 ' + escHtml(p.gift))
    if (p.owner && (p.type === 'sales' || p.type === 'team')) bits.push('👤 ' + escHtml(p.owner))
    return bits.join(' · ')
  }

  function card(p, { preview = false } = {}) {
    const t = PROGRAM_TYPES[p.type]
    const carTxt = [p.brand, p.models?.length ? p.models.join(', ') : (p.brand ? 'ทุกรุ่น' : 'ทุกยี่ห้อทุกรุ่น')].filter(Boolean).join(' ')
    const rates = p.type === 'finance' && p.rates?.length ? `<div class="sp-rates">${p.rates.map(r => `<span>ดาวน์ ${r.down}% · ${r.months} งวด · <b>${r.rate}%</b></span>`).join('')}</div>` : ''
    const mine = !p.legacy
    return `<div class="sp-card t-${p.type}${liveState(p, today) === 'ended' ? ' is-ended' : ''}">
      <div class="sp-card-top"><span class="sp-type">${t.icon} ${t.short}</span>${stateBadge(p)}</div>
      <div class="sp-title">${escHtml(p.title)}</div>
      <div class="sp-meta">🚗 ${escHtml(carTxt)} · 📅 ${escHtml(rangeLabel(p))}</div>
      ${valueLine(p) ? `<div class="sp-val">${valueLine(p)}</div>` : ''}
      ${rates}
      ${p.conditions ? `<div class="sp-cond">${escHtml(p.conditions)}</div>` : ''}
      ${preview ? '' : `<div class="sp-acts">${mine
        ? `<button class="btn btn-ghost btn-sm" data-edit="${escHtml(p.id)}">✏️ แก้</button>
           <button class="btn btn-ghost btn-sm" data-copy="${escHtml(p.id)}" title="คัดลอกไปเดือนถัดไป">📄 ใช้ต่อเดือนหน้า</button>
           <button class="btn btn-ghost btn-sm sp-del" data-del="${escHtml(p.id)}" aria-label="ลบ">🗑</button>`
        : `<button class="btn btn-ghost btn-sm" data-nav="${escHtml(p.legacy)}">จากหน้าเดิม ↗</button>`}</div>`}
    </div>`
  }

  // ── ขายรุ่นไหน ──
  function modelsOf(brand) {
    const set = new Set()
    getVehicles().forEach(v => { if (!brand || v.brand === brand) set.add(v.model) })
    all().forEach(p => { if (!brand || p.brand === brand) (p.models || []).forEach(m => set.add(m)) })
    return [...set].slice(0, 200)
  }
  function renderFinder() {
    $('#sp-models').innerHTML = modelsOf(finder.brand).map(m => `<option value="${escHtml(m)}">`).join('')
    const out = $('#sp-f-out')
    if (!finder.brand && !finder.model) {
      const live = all().filter(p => liveState(p, today) === 'live' || liveState(p, today) === 'ending')
      out.innerHTML = `<div class="sp-f-hint">เลือกยี่ห้อ/พิมพ์รุ่น แล้วระบบรวมส่วนลด ของแถม ดอกเบี้ยดีสุด${isManager ? ' มาร์จิ้น และค่าบริหาร' : ''}ของรุ่นนั้นให้ · ตอนนี้มีแคมเปญที่ใช้ได้ ${live.length} รายการ</div>`
      return
    }
    const list = programsForCar(all(), { brand: finder.brand, model: finder.model, date: today, isManager })
    const s = carSummary(list)
    const price = Number(String(finder.price).replace(/[^\d.]/g, '')) || 0
    const rates = list.filter(p => p.type === 'finance').flatMap(p => (p.rates || []).map(r => ({ ...r, financeCo: p.financeCo })))
      .filter(r => (!r.months || String(r.months) === finder.months) && r.down <= Number(finder.down)).sort((a, b) => a.rate - b.rate)
    const best = rates[0]
    const net = price ? Math.max(0, price - s.customerCash) : 0
    out.innerHTML = !list.length
      ? `<div class="sp-f-hint">ยังไม่มีแคมเปญที่ใช้ได้วันนี้สำหรับ ${escHtml([finder.brand, finder.model].filter(Boolean).join(' '))}</div>`
      : `<div class="sp-f-sum">
          <div class="sp-f-tile"><span>ลูกค้าได้ส่วนลดรวม</span><b>${baht(s.customerCash)}</b>${price ? `<small>เหลือ ${baht(net)}</small>` : ''}</div>
          <div class="sp-f-tile"><span>ดอกเบี้ยดีสุด (ดาวน์ ${finder.down}% · ${finder.months} งวด)</span><b>${best ? best.rate + '%' : '—'}</b>${best ? `<small>${escHtml(best.financeCo || '')}${price ? ` · งวดละ ~${baht(monthlyInstallment(net, finder.down, finder.months, best.rate))}` : ''}</small>` : '<small>ไม่มีแถวที่ตรงดาวน์/งวดนี้</small>'}</div>
          <div class="sp-f-tile"><span>ของแถม</span><b class="sp-f-small">${s.gifts.length ? escHtml(s.gifts.join(', ')) : '—'}</b></div>
          ${isManager ? `<div class="sp-f-tile is-internal"><span>มาร์จิ้น / ค่าบริหาร (ภายใน)</span><b>${baht(s.margin)}${s.marginPct ? ` + ${s.marginPct}%` : ''}</b><small>${[s.mgmt.teamManager ? 'ค่าบริหาร ผจก.ทีม ' + baht(s.mgmt.teamManager) : '', s.mgmt.salesManager ? 'ผจก.ฝ่าย ' + baht(s.mgmt.salesManager) : '', s.bonus ? 'รางวัล ' + baht(s.bonus) : ''].filter(Boolean).join(' · ') || 'ยังไม่มีค่าบริหาร/รางวัล'}</small></div>` : ''}
        </div>
        <div class="sp-f-list">${list.map(p => `<div class="sp-f-item t-${p.type}"><span>${PROGRAM_TYPES[p.type].icon}</span><div><b>${escHtml(p.title)}</b><small>${[valueLine(p), escHtml(rangeLabel(p))].filter(Boolean).join(' · ')}</small></div></div>`).join('')}</div>
        <div class="sp-f-acts"><button class="btn btn-primary btn-sm" id="sp-f-copy">📋 คัดลอกข้อความส่งลูกค้า</button></div>`
    out.querySelector('#sp-f-copy')?.addEventListener('click', () => {
      const cust = list.filter(p => CUSTOMER_TYPES.includes(p.type))
      const carName = [finder.brand, finder.model].filter(Boolean).join(' ')
      const lines = [`โปรโมชั่น ${carName} (ถึง ${rangeLabel({ dateFrom: today, dateTo: cust.map(p => p.dateTo).filter(Boolean).sort()[0] || '' }).replace(/^.*– /, '')})`]
      if (price) lines.push(`ราคา ${baht(price)}${s.customerCash ? ` ส่วนลดรวม ${baht(s.customerCash)} เหลือ ${baht(net)}` : ''}`)
      cust.filter(p => p.type !== 'finance').forEach(p => lines.push(`• ${p.title}${p.amount ? ` ลด ${baht(p.amount)}` : ''}${p.gift ? ` แถม ${p.gift}` : ''}`))
      if (best) lines.push(`• ดอกเบี้ย ${best.rate}% ดาวน์ ${best.down}% ผ่อน ${best.months} งวด${price ? ` งวดละประมาณ ${baht(monthlyInstallment(net, finder.down, finder.months, best.rate))} (ยังไม่รวม VAT)` : ''}`)
      lines.push('*เงื่อนไขเป็นไปตามที่บริษัทกำหนด')
      copyText(lines.join('\n')).then(() => showToast('📋 คัดลอกแล้ว วางใน LINE ได้เลย', 'success'))
    })
  }

  // ── เหตุการณ์ ──
  const saveFinder = () => Object.entries(finder).forEach(([k, v]) => lsSet('sp-' + k, v))
  $('#sp-f-brand').addEventListener('change', e => { finder.brand = e.target.value; saveFinder(); renderFinder() })
  $('#sp-f-model').addEventListener('input', e => { finder.model = e.target.value; saveFinder(); renderFinder() })
  $('#sp-f-price').addEventListener('input', e => { finder.price = e.target.value; saveFinder(); renderFinder() })
  $('#sp-f-down').addEventListener('change', e => { finder.down = e.target.value; saveFinder(); renderFinder() })
  $('#sp-f-months').addEventListener('change', e => { finder.months = e.target.value; saveFinder(); renderFinder() })
  $('#sp-prev').addEventListener('click', () => { month = shiftMonth(month, -1); render() })
  $('#sp-next').addEventListener('click', () => { month = shiftMonth(month, 1); render() })
  $('#sp-now').addEventListener('click', () => { month = today.slice(0, 7); render() })
  $('#sp-add').addEventListener('click', () => openForm(null, typeFilter !== 'all' ? typeFilter : ''))
  $('#sp-ai').addEventListener('click', openAi)
  $('#sp-chips').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { typeFilter = b.dataset.t; render() } })
  $('#sp-list').addEventListener('click', async e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) return navigate(nav.dataset.nav)
    const add = e.target.closest('[data-add]')
    if (add) return openForm(null, add.dataset.add)
    const ed = e.target.closest('[data-edit]')
    if (ed) { const p = programs.find(x => x.id === ed.dataset.edit); if (p) openForm(p) ; return }
    const cp = e.target.closest('[data-copy]')
    if (cp) {
      const p = programs.find(x => x.id === cp.dataset.copy); if (!p) return
      const next = copyToNextMonth(p)
      return openForm({ ...next, id: null }, '', `📄 ใช้ต่อเดือนหน้า — ${p.title}`)
    }
    const del = e.target.closest('[data-del]')
    if (del) {
      const p = programs.find(x => x.id === del.dataset.del); if (!p) return
      if (!(await confirmDialog({ title: 'ลบแคมเปญนี้?', message: `“${p.title}” จะหายจากรายการ`, confirmText: '🗑 ลบ', danger: true }))) return
      try { await softDelete(COL, p.id); showToast('ลบแล้ว', 'success') } catch { showToast('ลบไม่สำเร็จ', 'error') }
    }
  })

  // ── ฟอร์ม ──
  function openForm(p, presetType = '', titleOverride = '') {
    const isEdit = !!p?.id
    const [mFrom, mTo] = monthBounds(month)
    const v = p ? { ...p } : normalizeProgram({ type: presetType || (visibleTypes.includes('brand') ? 'brand' : visibleTypes[0]), dateFrom: month === today.slice(0, 7) ? today : mFrom, dateTo: mTo, owner: '' })
    if (!p && v.type === 'sales') v.owner = myName('')
    const fin = getFinanceCompanies()
    const staff = getSalesStaff()
    const typeOpts = visibleTypes.map(t => `<option value="${t}"${t === v.type ? ' selected' : ''}>${PROGRAM_TYPES[t].icon} ${PROGRAM_TYPES[t].label}</option>`).join('')
    const rateRow = r => `<div class="sp-rate-row"><input class="input" type="number" step="0.5" min="0" max="100" value="${r?.down ?? 25}" aria-label="ดาวน์ %" data-r="down"><input class="input" type="number" step="1" min="1" value="${r?.months ?? 60}" aria-label="งวด" data-r="months"><input class="input" type="number" step="0.01" min="0" value="${r?.rate ?? ''}" placeholder="%" aria-label="ดอกเบี้ย %" data-r="rate"><button type="button" class="btn btn-ghost btn-sm" data-rm aria-label="ลบแถว">✕</button></div>`
    const { el, close } = openModal({
      title: titleOverride || (isEdit ? `✏️ แก้ — ${p.title}` : '＋ เพิ่มแคมเปญ / เงื่อนไข'),
      size: 'lg',
      body: `<div class="sp-form">
        <div class="input-group sp-full"><label class="input-label">ประเภท</label><select class="input" id="f-type">${typeOpts}</select></div>
        <div class="input-group sp-full"><label class="input-label">ชื่อแคมเปญ *</label><input class="input" id="f-title" value="${escHtml(v.title || '')}" placeholder="เช่น ลดพิเศษปลายปี / ดอกเบี้ย 1.99%"></div>
        <div class="input-group"><label class="input-label">ยี่ห้อ</label><select class="input" id="f-brand"><option value="">ทุกยี่ห้อ</option>${brands.map(b => `<option${b === v.brand ? ' selected' : ''}>${escHtml(b)}</option>`).join('')}</select></div>
        <div class="input-group"><label class="input-label">รุ่น (คั่นด้วย , · ว่าง = ทุกรุ่น)</label><input class="input" id="f-models" list="f-models-dl" value="${escHtml((v.models || []).join(', '))}"><datalist id="f-models-dl"></datalist></div>
        <div class="input-group"><label class="input-label">วันเริ่ม *</label><input class="input" type="date" id="f-from" value="${escHtml(v.dateFrom || '')}"></div>
        <div class="input-group"><label class="input-label">วันสิ้นสุด (ว่าง = ไม่มีกำหนด)</label><input class="input" type="date" id="f-to" value="${escHtml(v.dateTo || '')}"></div>

        <div class="sp-full sp-x" data-for="finance">
          <div class="sp-form-2">
            <div class="input-group"><label class="input-label">บริษัทไฟแนนซ์ *</label><input class="input" id="f-fin" list="f-fin-dl" value="${escHtml(v.financeCo || '')}"><datalist id="f-fin-dl">${fin.map(f => `<option value="${escHtml(f)}">`).join('')}</datalist></div>
            <div class="input-group"><label class="input-label">ซับซิดี้ (บาท)</label><input class="input" type="number" id="f-sub" value="${v.subsidy || ''}"></div>
            ${isManager ? `<div class="input-group"><label class="input-label">คอมไฟแนนซ์ (บาท)</label><input class="input" type="number" id="f-fcom" value="${v.financeCommission || ''}"></div>` : ''}
          </div>
          <label class="input-label">ตารางดอกเบี้ย (ดาวน์ % · งวด · ดอกเบี้ย % ต่อปี)</label>
          <div id="f-rates">${(v.rates?.length ? v.rates : [null]).map(rateRow).join('')}</div>
          <button type="button" class="btn btn-ghost btn-sm" id="f-add-rate">＋ เพิ่มแถว</button>
        </div>
        <div class="input-group sp-x" data-for="brand showroom team sales"><label class="input-label">ส่วนลดให้ลูกค้า (บาท/คัน)</label><input class="input" type="number" id="f-amount-c" value="${CUSTOMER_TYPES.includes(v.type) ? (v.amount || '') : ''}"></div>
        <div class="input-group sp-x" data-for="brand showroom team sales finance"><label class="input-label">ของแถม</label><input class="input" id="f-gift" value="${escHtml(v.gift || '')}" placeholder="เช่น ฟิล์ม + ประกันชั้น 1"></div>
        <div class="input-group sp-x" data-for="team sales"><label class="input-label">ของใคร</label><input class="input" id="f-owner" list="f-staff-dl" value="${escHtml(v.owner || '')}"><datalist id="f-staff-dl">${staff.map(s => `<option value="${escHtml(s)}">`).join('')}</datalist></div>
        <div class="input-group sp-x" data-for="margin"><label class="input-label">มาร์จิ้น (บาท/คัน)</label><input class="input" type="number" id="f-amount-m" value="${v.type === 'margin' ? (v.amount || '') : ''}"></div>
        <div class="input-group sp-x" data-for="margin"><label class="input-label">มาร์จิ้น (% ของราคา)</label><input class="input" type="number" step="0.01" id="f-pct" value="${v.percent || ''}"></div>
        <div class="input-group sp-x" data-for="mgmtfee"><label class="input-label">ค่าบริหารของ</label><select class="input" id="f-role">${Object.entries(MGMT_ROLES).map(([k, l]) => `<option value="${k}"${k === v.role ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="input-group sp-x" data-for="mgmtfee"><label class="input-label">ค่าบริหาร (บาท/คัน)</label><input class="input" type="number" id="f-amount-f" value="${v.type === 'mgmtfee' ? (v.amount || '') : ''}"></div>
        <div class="input-group sp-x" data-for="bonus"><label class="input-label">เงินรางวัล (บาท)</label><input class="input" type="number" id="f-amount-b" value="${v.type === 'bonus' ? (v.amount || '') : ''}"></div>
        <div class="input-group sp-x" data-for="bonus"><label class="input-label">ได้เมื่อขายถึง (คัน · ว่าง = ทุกคัน)</label><input class="input" type="number" id="f-target" value="${v.targetUnits || ''}"></div>
        <div class="input-group sp-x" data-for="bonus"><label class="input-label">ให้ใคร</label><select class="input" id="f-bfor">${Object.entries(BONUS_FOR).map(([k, l]) => `<option value="${k}"${k === v.bonusFor ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="input-group sp-x" data-for="bonus"><label class="input-label">ชื่อ (ถ้าเฉพาะคน/ทีม) · ผู้ให้รางวัล</label><div class="sp-form-2"><input class="input" id="f-bowner" list="f-staff-dl" value="${escHtml(v.type === 'bonus' ? v.owner || '' : '')}" placeholder="ชื่อ"><input class="input" id="f-sponsor" value="${escHtml(v.sponsor || '')}" placeholder="เช่น แบรนด์ / โชว์รูม"></div></div>
        <div class="input-group sp-x" data-for="bonus margin mgmtfee"><label class="input-label">นับยอดจาก</label><select class="input" id="f-countby">${Object.entries(COUNT_BY).map(([k, l]) => `<option value="${k}"${k === (v.countBy || 'delivered') ? ' selected' : ''}>${l}ในช่วงแคมเปญ</option>`).join('')}</select></div>
        <div class="input-group sp-full"><label class="input-label">เงื่อนไข</label><textarea class="input" id="f-cond" rows="3" placeholder="เช่น เฉพาะจองและออกรถภายในเดือนนี้ · สีขาว/ดำ · จำกัด 10 คัน">${escHtml(v.conditions || '')}</textarea></div>
        <label class="sp-full sp-check"><input type="checkbox" id="f-draft"${v.status === 'draft' ? ' checked' : ''}> เก็บเป็นร่าง (ยังไม่ประกาศใช้)</label>
      </div>`,
      footer: '<button class="btn btn-secondary" id="f-cancel">ยกเลิก</button><button class="btn btn-primary" id="f-save">💾 บันทึก</button>',
    })
    const q = s => el.querySelector(s)
    const syncType = () => {
      const t = q('#f-type').value
      el.querySelectorAll('.sp-x').forEach(x => { x.hidden = !x.dataset.for.split(' ').includes(t) })
    }
    const syncModels = () => { q('#f-models-dl').innerHTML = modelsOf(q('#f-brand').value).map(m => `<option value="${escHtml(m)}">`).join('') }
    syncType(); syncModels()
    q('#f-type').addEventListener('change', syncType)
    q('#f-brand').addEventListener('change', syncModels)
    q('#f-add-rate').addEventListener('click', () => {
      const last = [...el.querySelectorAll('.sp-rate-row')].pop()
      const prev = last ? { down: last.querySelector('[data-r=down]').value, months: last.querySelector('[data-r=months]').value, rate: '' } : null
      q('#f-rates').insertAdjacentHTML('beforeend', rateRow(prev))
    })
    q('#f-rates').addEventListener('click', e => { if (e.target.closest('[data-rm]')) e.target.closest('.sp-rate-row').remove() })
    q('#f-cancel').addEventListener('click', close)
    q('#f-save').addEventListener('click', async () => {
      const t = q('#f-type').value
      const amountField = { margin: '#f-amount-m', mgmtfee: '#f-amount-f', bonus: '#f-amount-b' }[t] || '#f-amount-c'
      const data = normalizeProgram({
        type: t, title: q('#f-title').value, brand: q('#f-brand').value, models: q('#f-models').value,
        dateFrom: q('#f-from').value, dateTo: q('#f-to').value, conditions: q('#f-cond').value,
        amount: t === 'finance' ? 0 : q(amountField).value, gift: q('#f-gift').value,
        status: q('#f-draft').checked ? 'draft' : 'active',
        financeCo: q('#f-fin').value, subsidy: q('#f-sub').value, financeCommission: q('#f-fcom')?.value ?? v.financeCommission,
        rates: [...el.querySelectorAll('.sp-rate-row')].map(r => ({ down: r.querySelector('[data-r=down]').value, months: r.querySelector('[data-r=months]').value, rate: r.querySelector('[data-r=rate]').value })),
        percent: q('#f-pct').value, role: q('#f-role').value,
        owner: t === 'bonus' ? q('#f-bowner').value : q('#f-owner').value,
        bonusFor: q('#f-bfor').value, targetUnits: q('#f-target').value, sponsor: q('#f-sponsor').value,
        countBy: q('#f-countby').value,
      })
      const err = validateProgram(data)
      if (err) { showToast('❗ ' + err, 'error'); return }
      const btn = q('#f-save'); btn.disabled = true
      try {
        if (isEdit) await updateDocData(COL, p.id, data)
        else await createDoc(COL, { ...data, companyId: myEffectiveCompanyId() || null })
        showToast('✅ บันทึกแล้ว', 'success')
        if (data.dateFrom && !overlapsMonth(data, month)) { month = data.dateFrom.slice(0, 7); render() }
        close()
      } catch { btn.disabled = false; showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error') }
    })
  }

  // ── ให้ AI อ่านประกาศ ──
  function openAi() {
    let rows = []
    const { el, close } = openModal({
      title: '✨ ให้ AI อ่านประกาศแคมเปญ',
      size: 'lg',
      body: `<div class="sp-ai">
        <div class="empty-desc">ก๊อปข้อความประกาศจาก LINE/อีเมล (ดอกเบี้ย แคมเปญ มาร์จิ้น ค่าบริหาร รางวัล) มาวาง หรือแนบรูปตาราง แล้วกด “อ่าน” — ตรวจก่อนบันทึกทุกครั้ง</div>
        <textarea class="input" id="ai-text" rows="6" placeholder="วางข้อความประกาศที่นี่"></textarea>
        <div class="sp-ai-row"><input type="file" accept="image/*" id="ai-file" class="input"><button class="btn btn-primary" id="ai-go">✨ อ่าน</button></div>
        <div id="ai-out"></div>
      </div>`,
      footer: '<button class="btn btn-secondary" id="ai-cancel">ปิด</button><button class="btn btn-primary" id="ai-save" disabled>💾 บันทึกที่เลือก</button>',
    })
    const q = s => el.querySelector(s)
    q('#ai-cancel').addEventListener('click', close)
    q('#ai-go').addEventListener('click', async () => {
      const text = q('#ai-text').value.trim()
      const file = q('#ai-file').files?.[0]
      if (!text && !file) { showToast('❗ กรุณาวางข้อความหรือเลือกรูปก่อน', 'error'); return }
      const go = q('#ai-go'); go.disabled = true; go.textContent = '⏳ กำลังอ่าน...'
      try {
        let imageBase64 = null
        if (file) imageBase64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file) })
        const raw = await analyzeSalesProgram({ text, imageBase64, mimeType: file?.type || 'image/jpeg' })
        rows = raw.map(normalizeProgram).filter(r => canSeeType(r.type, isManager))
        if (!rows.length) { q('#ai-out').innerHTML = '<div class="empty-desc">อ่านไม่เจอแคมเปญในข้อความนี้ ลองวางข้อความให้ครบขึ้น</div>'; q('#ai-save').disabled = true; return }
        q('#ai-out').innerHTML = `<div class="sp-ai-list">${rows.map((r, i) => `<label class="sp-ai-item"><input type="checkbox" data-i="${i}" checked><div>${card(r, { preview: true })}${validateProgram(r) ? `<div class="sp-warn">⚠️ ${escHtml(validateProgram(r))} — แก้ได้หลังบันทึก</div>` : ''}</div></label>`).join('')}</div>`
        q('#ai-save').disabled = false
      } catch (err) { q('#ai-out').innerHTML = `<div class="sp-warn">${escHtml(aiErrorText(err))}</div>` } finally { go.disabled = false; go.textContent = '✨ อ่าน' }
    })
    q('#ai-save').addEventListener('click', async () => {
      const pick = [...el.querySelectorAll('[data-i]:checked')].map(c => rows[+c.dataset.i])
      if (!pick.length) { showToast('❗ เลือกอย่างน้อย 1 รายการ', 'error'); return }
      const btn = q('#ai-save'); btn.disabled = true
      let ok = 0
      for (const r of pick) {
        const data = { ...r, title: r.title || 'แคมเปญ', dateFrom: r.dateFrom || today, financeCo: r.type === 'finance' ? (r.financeCo || 'ไม่ระบุ') : r.financeCo, status: validateProgram({ ...r, title: r.title || 'x', dateFrom: r.dateFrom || today, financeCo: r.financeCo || 'x' }) ? 'draft' : r.status }
        try { await createDoc(COL, { ...normalizeProgram(data), companyId: myEffectiveCompanyId() || null }); ok++ } catch {}
      }
      showToast(ok ? `✅ บันทึก ${ok} รายการ` : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
      if (ok) { const f = pick.find(r => r.dateFrom); if (f) { month = f.dateFrom.slice(0, 7); render() } close() } else btn.disabled = false
    })
  }

  render()
}
