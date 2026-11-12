/**
 * Quotation Builder — สร้างใบเสนอราคา
 * Route: /crm/quotation
 *
 * เชื่อมกับข้อมูลลูกค้า:
 *   หน้าลูกค้า (Customers/Leads/Bookings) เขียน sessionStorage key 'lamom_quote_prefill' เป็น JSON
 *   รูปแบบ {customerId, customerName, phone, email, lineId, interestedModel} แล้ว navigate('/crm/quotation')
 *   มา — หน้านี้จะอ่านค่า, ลบ key ทิ้งทันที (กันไม่ให้เผลอเด้งฟอร์มซ้ำตอนเข้าหน้านี้ครั้งต่อไป),
 *   แล้วเปิดฟอร์ม "สร้างใบเสนอราคา" อัตโนมัติพร้อมข้อมูลลูกค้า/รุ่นรถที่สนใจ (ถ้าตรงกับ catalog)
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import './quoteCampaigns.css'
import { exportToExcel } from '../../utils/importExport.js'
import { navigate } from '../../core/router.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { getAccessories, getSalesStaff } from '../../data/masterData.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { scheduleQuoteFollowup } from '../../utils/quoteFollowup.js'
import { escHtml as __escA } from '../../utils/escape.js'
import { escHtml } from '../../utils/escape.js'
import { salesOptionsHtml } from '../../utils/defaultSalesperson.js'
import { kpi } from '../../utils/kpiCard.js'
import { quoteText } from '../../utils/quoteText.js'
import { copyText } from '../../utils/copyText.js'
import { callLink } from '../../utils/callLink.js'
import { addDaysBangkok as addDays } from '../../utils/format.js'
import { programsForCar, carSummary, bestRates, CUSTOMER_TYPES, PROGRAM_TYPES, rangeLabel, normalizeProgram } from '../../utils/salesPrograms.js'

// (v1.0.976) อ่านค่าตัวเลขจากช่อง — ช่องว่างใช้ค่าเริ่มต้น แต่ 0 คือ 0 จริง (เดิม 0% กลายเป็น 2.99%)
const numIn = (id, dflt = 0) => { const v = document.getElementById(id)?.value; if (v == null || String(v).trim() === '') return dflt; const n = Number(v); return Number.isFinite(n) ? n : dflt }

const QT_STATUS = {
  draft:    { label: 'ร่าง', color: 'secondary' },
  sent:     { label: 'ส่งแล้ว', color: 'primary' },
  accepted: { label: 'ลูกค้ายอมรับ', color: 'success' },
  rejected: { label: 'ลูกค้าปฏิเสธ', color: 'danger' },
  expired:  { label: 'หมดอายุ', color: 'secondary' },
}

// ค่าจดทะเบียนเริ่มต้น (ป้ายทะเบียน+ค่าโอน โดยประมาณ) — แก้ไขต่อใบเสนอราคาได้เสมอ
const DEFAULT_REG_FEE = 2900

const PREFILL_KEY = 'lamom_quote_prefill'

// ราคาอุปกรณ์เสริมของรถรุ่นที่เลือก — ใช้ priceByVehicle[vehicleId] ถ้ามี ไม่งั้น fallback เป็นราคาเริ่มต้น
function getAccessoryPrice(acc, vehicleId) {
  const override = acc?.priceByVehicle && vehicleId != null ? acc.priceByVehicle[vehicleId] : undefined
  return (override != null && !isNaN(override)) ? override : (acc?.price || 0)
}

// รองรับข้อมูลเก่า (accessories: ['A001','A002']) ให้แสดงผลได้เหมือนข้อมูลใหม่ (array of line items)
function normalizeAccessories(accessories) {
  if (!Array.isArray(accessories)) return []
  const catalog = getAccessories()
  return accessories.map(item => {
    if (typeof item === 'string') {
      const a = catalog.find(x => x.id === item)
      return a ? { id: a.id, name: a.name, price: a.price, free: false, source: 'catalog' } : null
    }
    return item
  }).filter(Boolean)
}

// พยายามจับคู่ "รุ่นที่สนใจ" (ข้อความอิสระจากหน้าลูกค้า) กับรถใน catalog
function matchVehicle(interestedModel) {
  const q = String(interestedModel || '').trim().toLowerCase()
  if (!q) return null
  return getVehicles().find(v => {
    const full = `${v.brand} ${v.model} ${v.variant}`.toLowerCase()
    const short = `${v.brand} ${v.model}`.toLowerCase()
    return full.includes(q) || q.includes(short) || short.includes(q)
  }) || null
}

export default async function QuotationBuilderPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  // ── อ่านและ consume sessionStorage prefill (ครั้งเดียวต่อการเข้าหน้า) ──────────
  let prefillData = null
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY)
    if (raw) {
      sessionStorage.removeItem(PREFILL_KEY)
      prefillData = JSON.parse(raw)
    }
  } catch (e) { prefillData = null }

  let quotes = []
  let statusFilter = 'all'
  // (v1.0.1073) ?status=sent → เปิดหน้ามาพร้อมตัวกรองสถานะ (ลิงก์จาก LAMI)
  try { const st = new URLSearchParams(location.search).get('status'); if (st && QT_STATUS[st]) statusFilter = st } catch (e) { /* ใช้ค่าเริ่มต้น */ }
  let loading = true
  // เซลส์เห็นเฉพาะใบเสนอราคาของตัวเอง/ลูกทีม (หรือที่ตัวเองสร้าง) — ผู้บริหาร/เจ้าของเห็นทั้งหมด
  const visScope = await getVisibilityScope()
  const myDisplayName = getState('user')?.displayName || ''

  async function loadData() {
    loading = true
    try { quotes = (await listDocs('quotations', companyScopeFilters(), 'createdDate', 'desc', 200)).filter(q => !q.deleted && scopeIncludesRecord(visScope, q.salesperson, q)) } catch (e) { quotes = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return quotes.filter(q => statusFilter === 'all' || q.status === statusFilter)
      .sort((a, b) => String(b.createdDate || '').localeCompare(String(a.createdDate || '')))
  }

  // (v1.0.1073) บรรทัดเตือนใต้วันหมดอายุ: หมดแล้ว / เหลือกี่วัน / ส่งไปกี่วัน / ยอมรับแล้วรอทำใบจอง
  function quoteHint(q, isExpired) {
    const today = addDays(0)
    const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
    let t = ''
    if (q.status === 'accepted' && !q.bookingId) t = '<span style="color:var(--success)">✅ รอทำใบจอง</span>'
    else if (!['draft', 'sent'].includes(q.status)) return ''
    else if (isExpired) t = '<span style="color:var(--danger)">⌛ หมดอายุแล้ว</span>'
    else {
      const left = /^\d{4}-\d{2}-\d{2}/.test(q.validUntil || '') ? days(today, String(q.validUntil).slice(0, 10)) : null
      if (left != null && left <= 7) t = `<span style="color:var(--warning)">⏳ ${left === 0 ? 'หมดวันนี้' : 'เหลือ ' + left + ' วัน'}</span>`
      else if (q.status === 'sent' && /^\d{4}-\d{2}-\d{2}/.test(q.sentDate || '')) { const d = days(String(q.sentDate).slice(0, 10), today); if (d > 0) t = `<span style="color:var(--text-muted)">📞 ส่งไป ${d} วัน</span>` }
    }
    return t ? `<div style="font-size:0.7rem;margin-top:2px">${t}</div>` : ''
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = filtered()
    const totalValue = quotes.filter(q => q.status === 'accepted').reduce((a, q) => a + q.finalPrice, 0)
    const convRate = quotes.length ? Math.round(quotes.filter(q => q.status === 'accepted').length / quotes.filter(q => q.status !== 'draft').length * 100) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📄 ใบเสนอราคา</div>
            <div class="page-subtitle">สร้าง ส่ง และติดตามใบเสนอราคาให้ลูกค้า</div>
          </div>
          <div class="page-actions">
            ${quotes.length ? '<button class="btn btn-secondary" id="export-btn">📥 ส่งออก</button>' : ''}
            <button class="btn btn-primary" id="add-qt-btn">+ สร้างใบเสนอราคา</button>
          </div>
        </div>

        ${!quotes.length ? `<div class="card empty-state" style="padding:40px 20px;text-align:center">
          <div class="empty-icon">📄</div>
          <div class="empty-title">ยังไม่มีใบเสนอราคา</div>
          <div class="empty-desc" style="margin-bottom:14px">สร้างใบแรกได้เลย ระบบคำนวณดาวน์/ผ่อนให้ และนัดโทรถามผลให้อัตโนมัติหลังกดส่ง</div>
          <button class="btn btn-primary" id="add-qt-empty">+ สร้างใบเสนอราคา</button>
        </div>` : ''}
        <!-- ยังไม่มีใบเสนอราคาเลย: ซ่อนตัวเลข 0 / ปุ่มกรอง / ตารางว่าง ให้เหลือการ์ดชวนสร้างใบแรกอย่างเดียว -->
        <div ${quotes.length ? '' : 'hidden'}>
        <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));margin-bottom:16px">
          ${kpi('📄 ทั้งหมด', quotes.length, 'primary')}
          ${kpi('✅ ยอมรับ', quotes.filter(q=>q.status==='accepted').length, 'success')}
          ${kpi('💰 มูลค่ายอมรับ', formatCurrency(totalValue), 'success')}
          ${kpi('📈 อัตรายอมรับ', (isNaN(convRate) ? 0 : convRate) + '%', convRate >= 50 ? 'success' : 'warning')}
        </div>

        <div class="chip-scroll" style="overflow-x:auto;display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด (${quotes.length})</button>
          ${Object.entries(QT_STATUS).map(([k,v]) => { const n = quotes.filter(q => q.status === k).length; return n || statusFilter === k ? `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label} (${n})</button>` : '' }).join('')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap"><table class="table">
            <thead><tr><th>วันที่</th><th>ลูกค้า</th><th>รถ</th><th class="text-right">ราคาสุทธิ</th><th class="text-right">ดาวน์</th><th class="text-right">ผ่อน/เดือน</th><th>วันหมดอายุ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${list.map(q => {
                const st = QT_STATUS[q.status]
                const isExpired = q.validUntil < addDays(0) && !['accepted','rejected'].includes(q.status)
                return `<tr>
                  <td style="font-size:0.8rem;white-space:nowrap" title="${escHtml(q.id)}">${formatDate(q.createdDate)}</td>
                  <td>
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(q.customerName)}${q.customerId ? ' <span title="ลิงค์กับข้อมูลลูกค้า" style="font-size:0.7rem">🔗</span>' : ''}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${callLink(q.phone, q.customerName)}</div>
                  </td>
                  <td>
                    <div style="font-size:0.85rem">${escHtml(q.vehicleLabel)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(q.color)}</div>
                  </td>
                  <td class="text-right" style="font-weight:700;color:var(--success)">${formatCurrency(q.finalPrice)}</td>
                  <td class="text-right" style="font-size:0.82rem">${formatCurrency(q.downPayment)}</td>
                  <td class="text-right" style="font-size:0.82rem">${formatCurrency(q.monthlyPayment)}</td>
                  <td style="font-size:0.82rem;color:${isExpired?'var(--danger)':'inherit'}">${formatDate(q.validUntil)}${quoteHint(q, isExpired)}</td>
                  <td><span class="badge badge-${st?.color}">${st?.label}</span></td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-xs btn-secondary open-qt-btn" data-id="${q.id}">ดู</button>
                      ${q.status === 'draft' ? `<button class="btn btn-xs btn-primary send-qt-btn" data-id="${q.id}" title="คัดลอกข้อความใบเสนอราคาไปวางใน LINE แล้วบันทึกว่าส่งแล้ว">📤 ส่ง LINE</button>` : ''}
                      ${q.status === 'sent' ? `<button class="btn btn-xs btn-success accept-qt-btn" data-id="${q.id}">✓ ยอมรับ</button>` : ''}
                      ${q.bookingId ? `<button class="btn btn-xs btn-secondary book-qt-btn" data-id="${q.id}" title="เปิดใบจองของใบเสนอราคานี้">📝 ใบจอง</button>` : q.status !== 'rejected' ? `<button class="btn btn-xs btn-success book-qt-btn" data-id="${q.id}" title="จองจากใบเสนอราคานี้ ไม่ต้องกรอกซ้ำ">📝 จองเลย</button>` : ''}
                      <button class="btn btn-xs btn-danger del-qt-btn" data-id="${q.id}" title="ลบใบเสนอราคา">🗑</button>
                    </div>
                  </td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบใบเสนอราคา</td></tr>` : ''}
            </tbody>
          </table></div>
        </div>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-qt-btn')?.addEventListener('click', () => openCreateForm())
    document.getElementById('add-qt-empty')?.addEventListener('click', () => openCreateForm())
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(quotes.map(q => ({
        เลขที่: q.id, ลูกค้า: q.customerName, customerId: q.customerId || '', รถ: q.vehicleLabel,
        ราคารถ: q.basePrice, ค่าจดทะเบียน: q.regFee || 0, ราคาสุทธิ: q.finalPrice, ดาวน์: q.downPayment, ผ่อน: q.monthlyPayment,
        สถานะ: QT_STATUS[q.status]?.label
      })), 'quotations')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-qt-btn').forEach(b => b.addEventListener('click', () => {
      const q = quotes.find(x => x.id === b.dataset.id); if (q) openQuoteDetail(q)
    }))
    container.querySelectorAll('.send-qt-btn').forEach(b => b.addEventListener('click', async () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      if (!q) return
      await markSent(q)
    }))
    container.querySelectorAll('.accept-qt-btn').forEach(b => b.addEventListener('click', async () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      if (!q) return
      try { await updateDocData('quotations', q.id, { status: 'accepted' }); showToast(`✅ ${q.customerName} ยอมรับใบเสนอราคาแล้ว!`, 'success'); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.book-qt-btn').forEach(b => b.addEventListener('click', () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      navigate(q?.bookingId ? '/crm/bookings?id=' + encodeURIComponent(q.bookingId) : '/crm/bookings?fromQuote=' + encodeURIComponent(b.dataset.id))
    }))
    container.querySelectorAll('.del-qt-btn').forEach(b => b.addEventListener('click', async () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      if (!q) return
      const ok = await confirmDialog({ title: '🗑 ลบใบเสนอราคา', message: `ลบใบเสนอราคา ${q.id} ของ "${escHtml(q.customerName)}" ออกจากระบบ? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('quotations', q.id)
        showToast('🗑 ลบใบเสนอราคาแล้ว', 'warning')
        if (container.__routerGen !== myGen) return
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  // (v1.0.1072) "ส่ง" = คัดลอกข้อความใบเสนอราคา (วางใน LINE ได้ทันที) + บันทึกว่าส่งแล้ว + นัดโทรถามผล — แตะครั้งเดียว
  // คัดลอกก่อน await อื่น เพื่อให้เบราว์เซอร์มือถือยังนับว่าเป็นการกดของผู้ใช้
  async function markSent(q) {
    const copied = await copyText(quoteText(q, normalizeAccessories(q.accessories)), '', '')
    try {
      if (q.status === 'draft') await updateDocData('quotations', q.id, { status: 'sent', sentDate: todayBangkok() })
      const fu = q.status === 'draft' ? await scheduleQuoteFollowup(q) : null
      showToast(`${copied ? '📋 คัดลอกใบเสนอราคาแล้ว วางใน LINE ส่งลูกค้าได้เลย' : '📤 บันทึกว่าส่งแล้ว (คัดลอกไม่สำเร็จ กดเปิดใบเสนอราคาเพื่อคัดลอกเอง)'}${fu ? ' · นัดโทรถามผลอีก 2 วัน' : ''}`, copied ? 'success' : 'warning')
      await loadData()
    } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
  }

  function openQuoteDetail(q) {
    const st = QT_STATUS[q.status]
    const accItems = normalizeAccessories(q.accessories)
    const paidItems = accItems.filter(i => !i.free)
    const freeItems = accItems.filter(i => i.free)
    const accTotal = paidItems.reduce((a, i) => a + (i.price || 0), 0)
    const regFee = q.regFee || 0
    const vat = Math.round((q.basePrice || 0) * 7 / 107)
    const related = q.customerId ? quotes.filter(x => x.id !== q.id && x.customerId === q.customerId) : []

    const { el } = openModal({
      title: '📄 ใบเสนอราคา — ' + escHtml(q.customerName || 'ลูกค้า'), // (v1.0.1072) เดิมโชว์ไอดีระบบยาวๆ อ่านไม่ออก
      size: 'lg',
      footer: `<button class="btn btn-secondary" id="qt-copy">📋 คัดลอกส่งลูกค้า</button>${q.status === 'draft' ? '<button class="btn btn-primary" id="qt-send">📤 ส่ง LINE + บันทึกว่าส่งแล้ว</button>' : ''}${q.status === 'sent' ? '<button class="btn btn-success" id="qt-accept">✓ ลูกค้ายอมรับ</button>' : ''}${q.status !== 'rejected' ? `<button class="btn btn-success" id="qt-book">${q.bookingId ? '📝 เปิดใบจอง' : '📝 ทำใบจอง'}</button>` : ''}`,
      body: `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:14px;margin-bottom:14px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">ลูกค้า</div>
            ${row('ชื่อ', escHtml(q.customerName))}${row('โทร', callLink(q.phone, q.customerName) || '-')}${row('เซลส์', escHtml(q.salesperson))}${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
            ${q.customerId ? `<button class="btn btn-xs btn-secondary" id="qt-view-customer" style="margin-top:6px">👤 ดูข้อมูลลูกค้า</button>` : ''}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">รถที่เสนอ</div>
            ${row('รุ่น', escHtml(q.vehicleLabel))}${row('สี', escHtml(q.color))}${row('ราคารถ (รวม VAT)', formatCurrency(q.basePrice))}
            ${row('VAT (7%, รวมในราคารถแล้ว)', `<span style="color:var(--text-muted)">${formatCurrency(vat)}</span>`)}
            ${row('ค่าจดทะเบียน', formatCurrency(regFee))}
            ${row('ส่วนลด', q.discount ? `<span style="color:var(--success)">- ${formatCurrency(q.discount)}</span>` : '-')}
            ${row('เทิร์นอิน', q.tradeIn ? `<span style="color:var(--success)">- ${formatCurrency(q.tradeIn)}</span>` : '-')}
          </div>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin:-8px 0 12px;font-style:italic">
          * ราคารถของไทยรวม VAT 7% ไว้ในราคาแล้วตามกฎหมาย บรรทัด VAT ด้านบนเป็นตัวเลขแสดงยอดภาษีที่แฝงอยู่ในราคาเพื่อความโปร่งใส ไม่ใช่ค่าใช้จ่ายที่บวกเพิ่ม
        </div>
        ${accItems.length ? `<div style="margin-bottom:12px">
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">อุปกรณ์เสริม</div>
          ${paidItems.map(a => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:0.8rem"><span>✓ ${escHtml(a.name)}${a.source === 'custom' ? ' <span style="color:var(--text-muted);font-size:0.7rem">(พิมพ์เอง)</span>' : ''}</span><span>${formatCurrency(a.price)}</span></div>`).join('')}
          ${freeItems.map(a => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--text-muted)"><span>🎁 ${escHtml(a.name)}</span><span><span style="text-decoration:line-through">${formatCurrency(a.price)}</span> <span class="badge badge-success" style="font-size:0.65rem">แถมฟรี</span></span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:700;margin-top:4px"><span>รวมอุปกรณ์ (เฉพาะรายการซื้อเพิ่ม)</span><span>${formatCurrency(accTotal)}</span></div>
        </div>` : ''}
        <div style="background:var(--primary-dim);border-radius:var(--radius-sm);padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:12px">
          ${kpi('💰 ราคาสุทธิ', formatCurrency(q.finalPrice), 'success')}
          ${kpi('💳 เงินดาวน์', formatCurrency(q.downPayment), 'primary')}
          ${kpi('📅 ผ่อน/เดือน', formatCurrency(q.monthlyPayment), 'warning')}
        </div>
        <div style="margin-top:10px;font-size:0.78rem;display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">สร้างวันที่: ${formatDate(q.createdDate)}</span>
          <span style="color:var(--text-muted)">ใช้ได้ถึง: ${formatDate(q.validUntil)}</span>
        </div>
        ${related.length ? `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">📄 ใบเสนอราคาอื่นของลูกค้ารายนี้ (${related.length})</div>
          ${related.map(r => `<div class="qt-related-item" data-id="${r.id}" style="display:flex;justify-content:space-between;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:4px;font-size:0.78rem;cursor:pointer">
            <span>${escHtml(r.id)} — ${escHtml(r.vehicleLabel)}</span>
            <span>${formatCurrency(r.finalPrice)} <span class="badge badge-${QT_STATUS[r.status]?.color}" style="font-size:0.65rem">${QT_STATUS[r.status]?.label}</span></span>
          </div>`).join('')}
        </div>` : ''}
      `
    })

    el.querySelector('#qt-copy')?.addEventListener('click', () => copyText(quoteText(q, accItems), '📋 คัดลอกแล้ว วางใน LINE ส่งลูกค้าได้เลย'))
    el.querySelector('#qt-send')?.addEventListener('click', async () => { el.remove(); await markSent(q) })
    el.querySelector('#qt-accept')?.addEventListener('click', async () => {
      try { await updateDocData('quotations', q.id, { status: 'accepted' }); el.remove(); showToast(`✅ ${q.customerName} ยอมรับใบเสนอราคาแล้ว!`, 'success'); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    el.querySelector('#qt-book')?.addEventListener('click', () => { el.remove(); navigate(q.bookingId ? '/crm/bookings?id=' + encodeURIComponent(q.bookingId) : '/crm/bookings?fromQuote=' + encodeURIComponent(q.id)) })
    el.querySelector('#qt-view-customer')?.addEventListener('click', () => {
      el.remove()
      navigate('/crm/customers?id=' + encodeURIComponent(q.customerId))
    })
    el.querySelectorAll('.qt-related-item').forEach(item => item.addEventListener('click', () => {
      const r = quotes.find(x => x.id === item.dataset.id)
      el.remove()
      if (r) openQuoteDetail(r)
    }))
  }

  function openCreateForm(prefill = null) {
    const customerId = prefill?.customerId || null
    const matchedVehicle = (prefill?.vehicleId && getVehicles().find(v => v.id === prefill.vehicleId)) || matchVehicle(prefill?.interestedModel)
    let customAccessories = [] // {name, price} — อุปกรณ์พิมพ์เองนอกแคตตาล็อก
    // (v1.0.976) แคมเปญที่ใช้ได้วันนี้ (จากหน้า "แคมเปญ & เงื่อนไขขาย") — กดใช้ได้ทันที ไม่ต้องพิมพ์ส่วนลด/ดอกเบี้ยเอง
    let programs = []
    let appliedIds = []
    let appliedFinanceCo = ''
    listDocs('sales_programs', [], 'dateFrom', 'desc', 1000).then(rows => { programs = rows.filter(r => !r.deleted).map(r => ({ ...normalizeProgram(r), id: r.id })); renderPrograms() }).catch(() => {})
    function programState() {
      const v = getVehicles().find(m => m.id === currentVehicleId())
      if (!v) return null
      const list = programsForCar(programs, { brand: v.brand, model: v.model, date: todayBangkok(), isManager: false }).filter(p => CUSTOMER_TYPES.includes(p.type))
      const s = carSummary(list)
      const gross = (v.price || 0) + numIn('qf-regfee') - s.customerCash - numIn('qf-tradein')
      const downPct = gross > 0 ? Math.round(numIn('qf-down') / gross * 100) : 0
      const best = bestRates(list, { down: numIn('qf-down') ? downPct : null, months: numIn('qf-term', 60) })[0] || null
      return { list, s, best, downPct }
    }
    function renderPrograms() {
      const box = document.getElementById('qf-programs')
      if (!box) return
      const st = programState()
      if (!st || !st.list.length) { box.innerHTML = programs.length ? '<div class="qf-pg-empty">ยังไม่มีแคมเปญที่ใช้ได้วันนี้สำหรับรุ่นนี้</div>' : ''; return }
      const { list, s, best } = st
      const html = `<div class="qf-pg-h">🎯 แคมเปญที่ใช้ได้วันนี้ <small>${list.length} รายการ</small></div>
        ${list.map(p => `<div class="qf-pg-i"><span>${PROGRAM_TYPES[p.type].icon}</span><div><b>${escHtml(p.title)}</b><small>${[p.amount && p.type !== 'finance' ? 'ลด ' + formatCurrency(p.amount) : '', p.gift ? 'แถม ' + escHtml(p.gift) : '', p.type === 'finance' && p.rates?.length ? escHtml(p.financeCo) + ' ' + p.rates.map(r => `${r.rate}% (ดาวน์ ${r.down}% ${r.months} งวด)`).slice(0, 3).join(', ') : '', escHtml(rangeLabel(p))].filter(Boolean).join(' · ')}</small></div></div>`).join('')}
        <div class="qf-pg-sum">${s.customerCash ? `ส่วนลดรวม <b>${formatCurrency(s.customerCash)}</b>` : ''}${best ? ` · ดอกเบี้ยดีสุด <b>${best.rate}%</b> ${escHtml(best.financeCo || '')}` : ''}${s.gifts.length ? ` · แถม ${escHtml(s.gifts.join(', '))}` : ''}</div>
`
      // ปุ่มสร้างครั้งเดียว วาดใหม่แค่ส่วนรายละเอียด — ไม่งั้นกดปุ่มหลังพิมพ์ช่องดาวน์ ปุ่มถูกแทนที่ตอน blur แล้วกดไม่ติด
      if (!box.querySelector('.qf-pg')) {
        box.innerHTML = '<div class="qf-pg"><div class="qf-pg-body"></div><button type="button" class="btn btn-sm btn-primary" id="qf-pg-apply">✨ ใช้แคมเปญทั้งหมด</button></div>'
        box.querySelector('#qf-pg-apply').addEventListener('click', applyPrograms)
      }
      const body = box.querySelector('.qf-pg-body')
      if (body.__html !== html) { body.innerHTML = html; body.__html = html }
    }
    function applyPrograms() {
      {
        const cur = programState(); if (!cur) return
        if (cur.s.customerCash) document.getElementById('qf-discount').value = cur.s.customerCash
        if (cur.best) { document.getElementById('qf-rate').value = cur.best.rate; appliedFinanceCo = cur.best.financeCo || '' }
        const notes = document.getElementById('qf-notes')
        const giftTxt = cur.s.gifts.length ? 'แถม ' + cur.s.gifts.join(', ') : ''
        if (giftTxt && notes && !notes.value.includes(giftTxt)) notes.value = [notes.value.trim(), giftTxt].filter(Boolean).join(' · ')
        appliedIds = cur.list.map(p => p.id).filter(Boolean)
        updateSummary()
        showToast('✅ ใส่ส่วนลด/ดอกเบี้ย/ของแถมจากแคมเปญแล้ว', 'success')
      }
    }

    function currentVehicleId() { return document.getElementById('qf-vehicle')?.value }

    function refreshAccRow(rowEl, vehicleId) {
      const id = rowEl.dataset.id
      const acc = getAccessories().find(x => x.id === id)
      if (!acc) return
      const price = getAccessoryPrice(acc, vehicleId)
      const mode = rowEl.querySelector('.acc-mode')?.value
      const priceEl = rowEl.querySelector('.acc-price')
      if (!priceEl) return
      priceEl.innerHTML = mode === 'free'
        ? `<span style="text-decoration:line-through">${formatCurrency(price)}</span> <b style="color:var(--success)">฿0</b>`
        : formatCurrency(price)
    }

    function refreshAllAccRows() {
      const vehicleId = currentVehicleId()
      document.querySelectorAll('.modal .acc-row').forEach(row => refreshAccRow(row, vehicleId))
    }

    function renderCustomList() {
      const listEl = document.getElementById('qf-custom-list')
      if (!listEl) return
      listEl.innerHTML = customAccessories.map((c, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;padding:4px 8px;background:var(--bg-2);border-radius:var(--radius-sm)">
          <span>${escHtml(c.name)}</span>
          <span style="display:flex;align-items:center;gap:8px">${formatCurrency(c.price)} <button type="button" class="btn btn-xs btn-secondary custom-rm-btn" data-i="${i}">✕</button></span>
        </div>`).join('')
      listEl.querySelectorAll('.custom-rm-btn').forEach(b => b.addEventListener('click', () => {
        customAccessories.splice(+b.dataset.i, 1)
        renderCustomList()
        updateSummary()
      }))
    }

    function collectCatalogAcc(vehicleId) {
      const paid = [], free = []
      document.querySelectorAll('.modal .acc-row').forEach(row => {
        const mode = row.querySelector('.acc-mode')?.value
        if (!mode) return
        const acc = getAccessories().find(x => x.id === row.dataset.id)
        if (!acc) return
        const price = getAccessoryPrice(acc, vehicleId)
        const item = { id: acc.id, name: acc.name, price, free: mode === 'free', source: 'catalog' }
        if (mode === 'free') free.push(item); else paid.push(item)
      })
      return { paid, free }
    }

    function updateSummary() {
      const summaryEl = document.getElementById('qf-summary')
      if (!summaryEl) return
      const vehicleId = currentVehicleId()
      const vehicle = getVehicles().find(m => m.id === vehicleId)
      const basePrice = vehicle?.price || 0
      const regFee = +document.getElementById('qf-regfee')?.value || 0
      const discount = +document.getElementById('qf-discount')?.value || 0
      const tradeIn = +document.getElementById('qf-tradein')?.value || 0
      const { paid, free } = collectCatalogAcc(vehicleId)
      const customTotal = customAccessories.reduce((a, c) => a + (c.price || 0), 0)
      const accTotal = paid.reduce((a, i) => a + i.price, 0) + customTotal
      const finalPrice = basePrice + regFee + accTotal - discount - tradeIn
      const vat = Math.round(basePrice * 7 / 107)
      summaryEl.innerHTML = `
        ${row('ราคารถ (รวม VAT แล้ว)', formatCurrency(basePrice))}
        ${row('VAT (7%, รวมในราคารถแล้ว)', `<span style="color:var(--text-muted)">${formatCurrency(vat)}</span>`)}
        ${row('ค่าจดทะเบียน', '+ ' + formatCurrency(regFee))}
        ${row('อุปกรณ์ซื้อเพิ่ม (' + (paid.length + customAccessories.length) + ' รายการ)', '+ ' + formatCurrency(accTotal))}
        ${free.length ? row('อุปกรณ์แถมฟรี (' + free.length + ' รายการ)', '฿0') : ''}
        ${row('ส่วนลด', discount ? ('- ' + formatCurrency(discount)) : '-')}
        ${row('เทิร์นอิน', tradeIn ? ('- ' + formatCurrency(tradeIn)) : '-')}
        <div style="display:flex;justify-content:space-between;padding-top:6px;font-weight:700;font-size:0.9rem"><span>ราคาสุทธิ</span><span style="color:var(--success)">${formatCurrency(finalPrice)}</span></div>
        ${(() => { const down = numIn('qf-down'), term = numIn('qf-term', 60), rate = numIn('qf-rate', 2.99), loan = finalPrice - down; return loan > 0 && down > 0 ? `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:2px 8px;padding-top:4px;font-size:0.82rem"><span>ยอดจัด ${formatCurrency(loan)} · ${term} งวด · ${rate}%</span><b>งวดละ ~${formatCurrency(Math.round(loan * (1 + rate / 100 * term / 12) / term))}</b></div>` : '' })()}
      `
      renderPrograms()
    }

    openModal({
      title: '+ สร้างใบเสนอราคา' + (customerId ? ' (ลิงค์กับลูกค้า)' : ''),
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="qf-name" placeholder="ชื่อลูกค้า" value="${escHtml(prefill?.customerName || '')}"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="qf-phone" placeholder="08x-xxx-xxxx" value="${escHtml(prefill?.phone || '')}"></div>
          <div class="input-group" style="grid-column:1/-1">
            <label class="input-label">รถที่เสนอ *</label>
            <select class="input" id="qf-vehicle">
              ${getVehicles().map(m => `<option value="${__escA(m.id)}" ${matchedVehicle?.id === m.id ? 'selected' : ''}>${m.brand} ${m.model} ${m.variant} — ${formatCurrency(m.price)}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">สี</label><input class="input" id="qf-color" placeholder="Cosmos Black"></div>
          <div class="input-group"><label class="input-label">ค่าจดทะเบียน (บาท)</label><input type="number" class="input" id="qf-regfee" value="${__escA(DEFAULT_REG_FEE)}"></div>
          <div class="input-group"><label class="input-label">ส่วนลด (บาท)</label><input type="number" class="input" id="qf-discount" value="0"></div>
          <div class="input-group"><label class="input-label">มูลค่าเทิร์นอิน (บาท)</label><input type="number" class="input" id="qf-tradein" value="0"></div>
          <div class="input-group"><label class="input-label">เงินดาวน์ (บาท)</label><input type="number" class="input" id="qf-down" placeholder="200000"></div>
          <div class="input-group"><label class="input-label">ระยะผ่อน (เดือน)</label><select class="input" id="qf-term"><option>48</option><option selected>60</option><option>72</option></select></div>
          <div class="input-group"><label class="input-label">ดอกเบี้ย (%/ปี)</label><input type="number" class="input" id="qf-rate" value="2.99" step="0.01"></div>
          <div id="qf-programs" style="grid-column:1/-1"></div>

          <div class="input-group" style="grid-column:1/-1">
            <label class="input-label">อุปกรณ์เสริม (จากรายการ) — ราคาอาจต่างกันตามรุ่นรถที่เลือก</label>
            <div id="qf-acc-list" style="display:flex;flex-direction:column;gap:6px">
              ${getAccessories().map(a => `
                <div class="acc-row" data-id="${a.id}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                  <span style="flex:1;font-size:0.82rem">${escHtml(a.name)}</span>
                  <span class="acc-price" style="font-size:0.78rem;color:var(--text-muted);min-width:90px;text-align:right">${formatCurrency(getAccessoryPrice(a, matchedVehicle?.id || getVehicles()[0]?.id))}</span>
                  <select class="input acc-mode" style="width:130px;font-size:0.78rem;padding:2px 6px">
                    <option value="">ไม่รวม</option>
                    <option value="paid">ซื้อเพิ่ม</option>
                    <option value="free">แถมฟรี</option>
                  </select>
                </div>`).join('')}
            </div>
          </div>

          <div class="input-group" style="grid-column:1/-1">
            <label class="input-label">อุปกรณ์เพิ่มเติม (พิมพ์เองนอกรายการ)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input class="input" id="qf-custom-name" placeholder="ชื่ออุปกรณ์" style="flex:2">
              <input type="number" class="input" id="qf-custom-price" placeholder="ราคา" style="flex:1">
              <button type="button" class="btn btn-sm btn-secondary" id="qf-custom-add">+ เพิ่ม</button>
            </div>
            <div id="qf-custom-list" style="margin-top:6px;display:flex;flex-direction:column;gap:4px"></div>
          </div>

          <div class="input-group"><label class="input-label">เซลส์</label><select class="input" id="qf-sales">${salesOptionsHtml(getSalesStaff(), { current: prefill?.salesperson || '', me: myDisplayName, isSales: getState('user')?.role === 'sales' })}</select></div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="qf-notes" placeholder="บันทึก..."></div>

          <div class="input-group" style="grid-column:1/-1;background:var(--bg-2);border-radius:var(--radius-sm);padding:10px">
            <label class="input-label" style="margin-bottom:6px">สรุปราคา (ประมาณการ)</label>
            <div id="qf-summary"></div>
          </div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('qf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return false }
        const vehicleId = document.getElementById('qf-vehicle')?.value
        const vehicle = getVehicles().find(m => m.id === vehicleId)
        const regFee = numIn('qf-regfee')
        const discount = numIn('qf-discount')
        const tradeIn = numIn('qf-tradein')
        const downPayment = numIn('qf-down')
        const term = numIn('qf-term', 60) || 60
        const rate = numIn('qf-rate', 2.99)
        const { paid, free } = collectCatalogAcc(vehicleId)
        const customItems = customAccessories.map(c => ({ id: null, name: c.name, price: c.price, free: false, source: 'custom' }))
        const accessories = [...paid, ...free, ...customItems]
        const accTotal = paid.reduce((a, i) => a + i.price, 0) + customItems.reduce((a, i) => a + i.price, 0)
        const finalPrice = (vehicle?.price || 0) + regFee + accTotal - discount - tradeIn
        const loanAmount = finalPrice - downPayment
        const monthly = loanAmount > 0 ? Math.round(loanAmount * (1 + rate / 100 * term / 12) / term) : 0
        try {
          await createDoc('quotations', {
            customerId: customerId || null,
            customerName: name, phone: document.getElementById('qf-phone')?.value || '',
            vehicleLabel: `${vehicle?.brand} ${vehicle?.model} ${vehicle?.variant}`,
            brand: vehicle?.brand || '', model: vehicle?.model || '', variant: vehicle?.variant || '',
            basePrice: vehicle?.price || 0, color: document.getElementById('qf-color')?.value || '',
            regFee,
            downPayment, term, rate, accessories,
            discount, tradeIn, finalPrice, monthlyPayment: monthly,
            programIds: appliedIds, financeCo: appliedFinanceCo,
            status: 'draft', createdDate: addDays(0), validUntil: addDays(30),
            salesperson: document.getElementById('qf-sales')?.value || '',
            notes: document.getElementById('qf-notes')?.value || '',
            companyId: myEffectiveCompanyId()
          })
          showToast('✅ สร้างใบเสนอราคาแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })

    // ── wire up interactivity หลังจาก modal ถูกแทรกเข้า DOM แล้ว ──────────────────
    document.getElementById('qf-vehicle')?.addEventListener('change', () => { refreshAllAccRows(); updateSummary() })
    document.querySelectorAll('.modal .acc-mode').forEach(sel => sel.addEventListener('change', (e) => {
      refreshAccRow(e.target.closest('.acc-row'), currentVehicleId())
      updateSummary()
    }))
    ;['qf-regfee', 'qf-discount', 'qf-tradein', 'qf-down', 'qf-term', 'qf-rate'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateSummary)
      document.getElementById(id)?.addEventListener('change', updateSummary)
    })
    document.getElementById('qf-custom-add')?.addEventListener('click', () => {
      const nameEl = document.getElementById('qf-custom-name')
      const priceEl = document.getElementById('qf-custom-price')
      const cname = nameEl?.value?.trim()
      const cprice = +priceEl?.value || 0
      if (!cname) { showToast('❗ กรอกชื่ออุปกรณ์ก่อนเพิ่ม', 'error'); return }
      customAccessories.push({ name: cname, price: cprice })
      nameEl.value = ''; priceEl.value = ''
      renderCustomList()
      updateSummary()
    })

    refreshAllAccRows()
    renderCustomList()
    updateSummary()
  }

  await loadData()
  if (prefillData) openCreateForm(prefillData)
  else {
    // (v1.0.1071) เปิดจาก LAMI "ราคา S07 เท่าไหร่" → ปุ่มทำใบเสนอราคา: /crm/quotation?vehicle=<id> เปิดฟอร์มพร้อมรุ่นนั้น
    const vid = new URLSearchParams(location.search).get('vehicle')
    if (vid && getVehicles().some(v => v.id === vid)) openCreateForm({ vehicleId: vid })
  }
}

function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
