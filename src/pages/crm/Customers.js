// Unified Customer Workspace — merges the old Customers.js + Leads.js into one page/collection.
// Route: /crm/customers (also aliased from /crm/leads — see router.js)
// Collection: `customers` — single source of truth, stage-based pipeline (lead → pp → booking → delivered)
import { listDocs, listAllDocs, watchDocs, createDoc, updateDocData, softDelete, readDoc, seedDemoData } from '../../core/db.js'
import { showToast, getState, on } from '../../core/store.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord, normName, isProgramOwner } from '../../core/hierarchy.js'
import { openSheetReconcile } from '../../utils/sheetReconcileModal.js'
import { formatDate, timeAgo, formatPhone, formatCurrency, initials, fullName, todayBangkok, toDate } from '../../utils/format.js'
import { newBookingNo } from '../../utils/bookingNo.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel, openImportModal } from '../../utils/importExport.js'
import { SmartSheet } from '../../components/SmartSheet.js'
import { navigate } from '../../core/router.js'
import { getSalesStaff } from '../../data/masterData.js'
import {
  getFollowUpRecommendation, getBookingDiagnosis, isModelInStock,
  deriveInitialStage, shouldAutoPromoteToPP,
} from '../../core/customerInsights.js'
import { aiSalesCloser, isAiEnabled, suggestCustomerReply } from '../../utils/ai.js'
import { buildCustomerBrief, addDaysIso, catalogContext, modelFacts, modelMatches } from '../../utils/salesAi.js'
import { flatMonthly } from '../../utils/installment.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { maskContacts } from '../../utils/leadText.js'
import { enhanceMics, bindMic, hasSpeechInput } from '../../utils/micInput.js'
import { matchesSearch, parseSmartQuery } from '../../utils/customerSearch.js'
import { stockLine } from '../../utils/stockLine.js'
import { heuristicScore } from '../../utils/leadScore.js'
import { OCCUPATIONS } from '../../utils/financeMatch.js'
import { openQuickLead, findDuplicate } from '../../utils/quickLead.js'
import { planLeadImport } from '../../utils/leadImport.js'
import { scheduleLeadFollowups, closeAutoLeadFollowups } from '../../utils/leadFollowups.js'
import { pendingFollowupsFor, followupWindowFilters, followupStatusByCustomer, matchFollowupFilter, QUIET_DAYS, quietDays } from '../../utils/customerFollowups.js'
import { reasonChipsHtml, bindReasonChips } from '../../utils/lostReason.js'
import { openAddFollowup, offerNextFollowup } from '../../utils/addFollowupModal.js'
import { touchCustomerContact } from '../../utils/customerContact.js'
import { armCallLog } from '../../utils/callLogger.js'
import { openTestDriveForm, loadUpcomingTestDrive, loadTestDrivesFor, mentionsTestDrive } from '../../utils/testDriveForm.js'
import { moveFollowupsOnReassign } from '../../utils/leadAssign.js'

const pendingFuCount = new WeakMap() // ลูกค้า → จำนวนนัดค้าง (ใช้ตัดสินว่าควรเสนอนัดครั้งถัดไปหลังโทรไหม)

// แถบ "โอกาสปิด" เล็กๆ ใต้อุณหภูมิ — เฉพาะ Lead/Prospect ที่ยังไม่เสียดีล (สูตรใน utils/leadScore.js)
function scoreBar(c) {
  if (c.isLost || !['lead', 'pp'].includes(c.stage)) return ''
  const { score, signals } = heuristicScore(c)
  const color = score >= 80 ? 'var(--danger)' : score >= 60 ? 'var(--warning)' : 'var(--text-muted)'
  return `<div title="โอกาสปิดการขาย ${score}%\n${escHtml(signals.join('\n'))}" style="margin-top:4px;display:flex;align-items:center;gap:4px;font-size:0.62rem;color:var(--text-muted)">
    <div style="width:44px;height:4px;border-radius:2px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:${score}%;background:${color}"></div></div>${score}%</div>`
}

// 🧮 คิดค่างวดคร่าวๆ ในหน้าลูกค้า (ลูกค้าถามบ่อยที่สุด "ผ่อนเดือนละเท่าไหร่") — ใช้ราคาจากฐานข้อมูลรถ
function calcHtml(c) {
  const vs = modelMatches(c.interestedModel, getVehicles(), 6).filter(v => v.price > 0)
  if (!vs.length) return ''
  // มีงบในใจ → เลือกรุ่นย่อยแพงสุดที่ไม่เกินงบให้ก่อน (ไม่มีรุ่นไหนอยู่ในงบ = รุ่นถูกสุด)
  const budget = Number(c.budget) || 0
  const fit = budget ? vs.reduce((best, v, i) => v.price <= budget && (best < 0 || v.price > vs[best].price) ? i : best, -1) : -1
  const opt = (arr, sel, fmt) => arr.map(x => `<option value="${x}" ${x === sel ? 'selected' : ''}>${fmt(x)}</option>`).join('')
  return `<div id="wk-calc" style="margin-top:6px;padding:8px;border:1px dashed var(--border);border-radius:8px">
    <div style="font-weight:600;margin-bottom:6px">🧮 ผ่อนเดือนละเท่าไหร่ (คร่าวๆ)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(120px,100%),1fr));gap:6px">
      <select class="input" id="wk-calc-v" style="font-size:0.76rem">${vs.map((v, i) => `<option value="${i}" data-p="${v.price}" ${i === fit ? 'selected' : ''}>${escHtml(v.variant || v.model)} · ${Number(v.price).toLocaleString('en-US')}</option>`).join('')}</select>
      <select class="input" id="wk-calc-d" style="font-size:0.76rem">${opt([0, 10, 15, 20, 25, 30, 40], 20, x => `ดาวน์ ${x}%`)}</select>
      <select class="input" id="wk-calc-m" style="font-size:0.76rem">${opt([48, 60, 72, 84], 72, x => `${x} งวด`)}</select>
      <label style="display:flex;align-items:center;gap:4px;font-size:0.72rem;white-space:nowrap">ดอก <input class="input" id="wk-calc-r" type="number" step="0.01" value="2.79" style="width:72px;font-size:0.76rem" title="ดอกเบี้ยต่อปี (flat)"> %/ปี</label>
    </div>
    <div id="wk-calc-out" style="margin-top:6px"></div>
  </div>`
}
function bindCalc(root) {
  const box = root.querySelector('#wk-calc')
  if (!box) return
  const $ = id => box.querySelector('#' + id)
  const run = () => {
    const sel = $('wk-calc-v').selectedOptions[0]
    const price = Number(sel?.dataset.p) || 0
    const r = flatMonthly(price, $('wk-calc-d').value, $('wk-calc-m').value, $('wk-calc-r').value)
    const txt = `${sel?.textContent.split(' · ')[0] || ''} ราคา ${price.toLocaleString('en-US')} บาท\nดาวน์ ${$('wk-calc-d').value}% (${r.down.toLocaleString('en-US')} บาท) ผ่อน ${$('wk-calc-m').value} งวด\nประมาณเดือนละ ${r.monthly.toLocaleString('en-US')} บาท (ดอกเบี้ย ${$('wk-calc-r').value}% ต่อปี)\n*ตัวเลขเบื้องต้น อัตราจริงขึ้นกับการอนุมัติของไฟแนนซ์`
    $('wk-calc-out').innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div>ยอดจัด ${r.loan.toLocaleString('en-US')} · <b style="font-size:1rem;color:var(--primary)">≈ ${r.monthly.toLocaleString('en-US')} บาท/เดือน</b></div><button type="button" class="btn btn-secondary btn-xs" id="wk-calc-copy">📋 คัดลอกส่งลูกค้า</button></div>`
    $('wk-calc-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(txt); showToast('📋 คัดลอกแล้ว วางใน LINE ได้เลย', 'success') } catch { showToast('คัดลอกไม่สำเร็จ', 'warning') }
    })
  }
  ;['wk-calc-v', 'wk-calc-d', 'wk-calc-m', 'wk-calc-r'].forEach(id => $(id).addEventListener('input', run))
  run()
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
// หมวดเหตุผลเสียดีลยอดนิยม (ปุ่มลัดในหน้าต่างมาร์คเสียดีล) — รายงานสัปดาห์นับรวมตามคำแรกก่อนเครื่องหมาย "-"

const STAGE = {
  lead:      { label: '🧲 Lead',        short: 'Lead',       badge: 'accent',  color: '#06B6D4' },
  pp:        { label: '📇 Prospect',    short: 'Prospect',   badge: 'primary', color: '#5B9BFF' },
  booking:   { label: '📝 จองแล้ว',     short: 'จองแล้ว',    badge: 'warning', color: '#F59E0B' },
  delivered: { label: '✅ ส่งมอบแล้ว',  short: 'ส่งมอบแล้ว', badge: 'success', color: '#10B981' },
}
const STAGE_ORDER = ['lead', 'pp', 'booking', 'delivered']

const TEMP = {
  hot:  { label: '🔴 Hot',  badge: 'danger' },
  warm: { label: '🟡 Warm', badge: 'warning' },
  cold: { label: '🔵 Cold', badge: 'accent' },
}

const SOURCE = {
  facebook: '📘 Facebook', line: '💚 LINE', tiktok: '🎵 TikTok', 'walk-in': '🚶 Walk-in',
  referral: '🤝 Referral', google: '🔍 Google', website: '🌐 Website', phone: '📱 โทรเข้า', other: '📌 อื่นๆ',
}

const URGENCY = {
  high:   { label: '🔥 ด่วน',    badge: 'danger' },
  medium: { label: '⏱ ปานกลาง', badge: 'warning' },
  low:    { label: '· ปกติ',    badge: 'secondary' },
}

const LOG_ICONS = { call: '📞', line: '💚', email: '📧', visit: '🚶', note: '📝' }
const LOG_LABELS = { call: 'โทรศัพท์', line: 'LINE', visit: 'เข้าโชว์รูม', email: 'Email', note: 'Note' }
const NOTE_TYPE_ICONS = { call: '📞', visit: '🤝', chat: '💬', email: '📧', internal: '📌' }
const NOTE_TYPE_LABELS = { call: 'โทรศัพท์', visit: 'เข้าพบ', chat: 'แชท/LINE', email: 'อีเมล', internal: 'บันทึกภายใน' }

export default async function CustomersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let customers = []
  let filtered = []
  let search = ''
  let stageFilter = 'all'
  let lostOnly = false
  let salesFilter = ''
  let sourceFilter = ''
  let fuFilter = ''
  let autoAiOnce = false // เปิดจากหน้า "งานของฉันวันนี้" ด้วย ?ai=1 → กด "AI ช่วยปิดการขาย" ให้อัตโนมัติครั้งเดียว
  let sortMode = 'urgent' // urgent = ด่วนก่อน (เดิม) · quiet = เงียบนานสุดก่อน · new = เพิ่มล่าสุดก่อน
  let fuStatus = null // โหลดนัดติดตามเฉพาะตอนเลือกตัวกรองนัดครั้งแรก (ไม่ให้ทุกคนเสียเวลาโหลด)

  // (v1.0.467) เปลี่ยนจาก getMyTeamNames() (มี fallback ผ่อนปรนให้ manager ที่ไม่มีลูกทีมจริงเห็นทุกคนแทน)
  // มาใช้ getVisibilityScope() ตามนโยบายที่เจ้าของระบบยืนยันไว้เข้มงวด — "เห็นเฉพาะผู้ใต้บังคับบัญชาโดยตรง
  // ลงไปเท่านั้น ไม่สามารถดูข้ามทีม ข้ามบริษัทได้ ไม่มีข้อยกเว้น" — แอดมิน/เจ้าของบริษัท/groupWide/เจ้าของ
  // โปรแกรม เห็นทุกคนในขอบเขตที่อนุญาตอยู่แล้วจาก companyScopeFilters() ระดับ query (ownScopeActive=false
  // ไม่ต้องกรองซ้ำ) ส่วนคนอื่นทั้งหมด (รวม manager ที่ไม่มีลูกทีมเชื่อมไว้) ถูกจำกัดเห็นแค่ตัวเอง/ลูกทีมจริง
  // เสมอ ไม่มี fallback เห็นกว้างขึ้นอีกต่อไป — เทียบชื่อแบบ normalize เหมือนเดิมเพราะ assignedTo เป็นข้อความ
  // อิสระที่พิมพ์เอง ไม่ใช่ uid ผูกตรงๆ
  const myDisplayName = getState('user')?.displayName || ''
  const visScope = await getVisibilityScope()
  const ownScopeActive = !visScope.unrestricted && !visScope.companyOnly
  const myTeamNames = visScope.names || new Set([normName(myDisplayName)])

  async function loadData() {
    // softDelete() ไม่ได้ลบเอกสารจริง แค่ตั้ง deleted:true (กู้คืนได้ใน 30 วันตามที่แจ้งผู้ใช้) — ถ้าไม่กรอง
    // ออกตรงนี้ ลูกค้าที่ "ลบ" ไปแล้วจะยังโผล่กลับมาในตาราง/สถิติทุกครั้งที่โหลดใหม่หรือมี snapshot ใหม่เข้ามา
    try { customers = (await listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 400)).filter(c => !c.deleted) } catch { customers = [] }
    applyFilter()
  }

  // Real-time: อัปเดตสดเมื่อมีคนอื่นเพิ่ม/แก้ไขลูกค้าจากเครื่องอื่น — แค่รีเฟรชสถิติ+ตาราง ไม่แตะช่องค้นหา
  let unsubCustomers = () => {}
  // (v1.0.453) การกรองตามบริษัทย้ายเข้า query จริงแล้ว (companyScopeFilters()) — ต้องยกเลิก subscription
  // เก่าแล้วยิงใหม่ทุกครั้งที่ activeCompanyFilter (ตัวกรอง Topbar) เปลี่ยน ไม่งั้นตัวกรองจะหยุดทำงาน
  function startWatchCustomers() {
    unsubCustomers()
    unsubCustomers = watchDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 400, rows => {
      if (container.__routerGen !== myGen) { unsubCustomers(); return }
      customers = rows.filter(c => !c.deleted)
      applyFilter()
    })
  }
  startWatchCustomers()
  const offCompanyFilter = on('activeCompanyFilter', startWatchCustomers)

  function quickUrgency(c) {
    try { return getFollowUpRecommendation(c, []).urgency } catch { return 'low' }
  }

  function applyFilter() {
    // (v1.0.453) การกรองตามบริษัทย้ายเข้า query จริงแล้ว (companyScopeFilters() ใน loadData()/
    // startWatchCustomers()) — ไม่ต้องกรองซ้ำที่นี่อีก
    const today = todayBangkok()
    const smartOpts = { isQuiet: c => ['lead', 'pp'].includes(c.stage) && !c.isLost && (quietDays(c, today) ?? 0) >= QUIET_DAYS }
    // บอกผู้ใช้ว่าระบบเข้าใจคำพิมพ์ว่าอะไร (เช่น "ร้อน s07" → 🔴 ลูกค้าร้อน + หา "s07")
    const smartEl = document.getElementById('cust-smart')
    if (smartEl) {
      const { labels, text } = parseSmartQuery(search)
      smartEl.innerHTML = labels.length ? `🧠 เข้าใจว่า: ${labels.map(l => `<span class="badge badge-primary">${escHtml(l)}</span>`).join(' ')}${text.length ? ` + หา “${escHtml(text.join(' '))}”` : ''}` : ''
      smartEl.style.display = labels.length ? '' : 'none'
    }
    filtered = customers.filter(c => {
      const matchSearch = matchesSearch(c, search, fullName, smartOpts)
      // ตรงกับตัวเลขบนการ์ด: การ์ดสถานะไม่นับลูกค้าที่เสียดีลแล้ว (ดูได้ที่การ์ด ⬛ เสียดีล)
      const matchStage = stageFilter === 'all' || (c.stage === stageFilter && !c.isLost)
      const matchLost = !lostOnly || c.isLost
      // '__none' = ลูกค้าที่ยังไม่มีผู้ดูแล (เช่น ทัก LINE OA เข้ามาเอง) — มอบให้เซลส์ได้ที่หน้า "งานของฉันวันนี้"
      const matchSales = !salesFilter || (salesFilter === '__none' ? !String(c.assignedTo || '').trim() : c.assignedTo === salesFilter)
      const matchSource = !sourceFilter || (sourceFilter === 'other' ? !SOURCE[c.source] || c.source === 'other' : c.source === sourceFilter)
      const matchOwn = !ownScopeActive || scopeIncludesRecord(visScope, c.assignedTo, c)
      const matchFu = matchFollowupFilter(c, fuFilter, fuStatus, today)
      return matchSearch && matchStage && matchLost && matchSales && matchSource && matchOwn && matchFu
    })
    const rank = { high: 0, medium: 1, low: 2 }
    const qd = c => quietDays(c, today) ?? -1
    filtered.sort((a, b) => {
      if (!!a.isLost !== !!b.isLost) return a.isLost ? 1 : -1
      if (sortMode === 'quiet') return qd(b) - qd(a)
      const newer = (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0) // createdAt เป็น Timestamp — new Date() ตรงๆ ได้ NaN
      if (sortMode === 'new') return newer
      if (sortMode === 'score') return heuristicScore(b).score - heuristicScore(a).score || newer
      const ua = rank[quickUrgency(a)], ub = rank[quickUrgency(b)]
      if (ua !== ub) return ua - ub
      return newer
    })
    renderStats()
    renderTable()
  }

  function renderStats() {
    STAGE_ORDER.forEach(k => {
      const el = document.getElementById(`stat-${k}`)
      if (el) el.textContent = customers.filter(c => c.stage === k && !c.isLost).length
    })
    const lostEl = document.getElementById('stat-lost')
    if (lostEl) lostEl.textContent = customers.filter(c => c.isLost).length
    const allEl = document.getElementById('stat-all')
    if (allEl) allEl.textContent = customers.length
    const countEl = document.getElementById('cust-count')
    if (countEl) countEl.textContent = `${filtered.length} / ${customers.length} รายการ`
  }

  function renderTable() {
    const tbody = document.getElementById('cust-tbody')
    if (!tbody) return
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">ไม่พบลูกค้า</div><div class="empty-desc">${search ? 'ลองเปลี่ยนคำค้นหา' : 'เริ่มเพิ่มลูกค้าคนแรก'}</div></div></td></tr>`
      return
    }
    const today = todayBangkok()
    const quietBadge = c => {
      if (c.isLost || !['lead', 'pp'].includes(c.stage)) return ''
      const d = quietDays(c, today)
      return d != null && d >= QUIET_DAYS ? `<div style="color:var(--warning);font-size:0.68rem;margin-top:2px">💤 เงียบ ${d} วัน</div>` : ''
    }
    tbody.innerHTML = filtered.map(c => {
      const st = STAGE[c.stage] || { label: c.stage || 'ไม่ระบุ', badge: 'secondary' }
      const urgency = URGENCY[quickUrgency(c)]
      return `
      <tr class="cust-row ${c.isLost ? 'is-lost' : ''}" data-id="${c.id}">
        <td class="cc-name">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar avatar-md cust-row-avatar" style="background:${avatarColor(c)};color:#fff">${escHtml(initials(c.firstName, c.lastName))}</div>
            <div>
              <div style="font-weight:600;color:var(--text);white-space:nowrap">${escHtml(fullName(c))}${c.vip ? ' <span title="VIP">⭐</span>' : ''}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(c.email || '')}</div>
            </div>
          </div>
        </td>
        <td class="cc-contact${c.phone || c.lineId ? '' : ' cc-blank'}" style="white-space:nowrap">${formatPhone(c.phone) || '<span style="color:var(--text-muted)">-</span>'}${c.lineId ? `<div style="font-size:0.7rem;color:var(--text-muted)">💚 ${escHtml(c.lineId)}</div>` : ''}</td>
        <td class="cc-stage">
          <span class="badge badge-${st.badge}">${escHtml(st.label)}</span>
          ${c.isLost ? `<div style="margin-top:3px"><span class="badge badge-secondary" style="font-size:0.62rem">⬛ เสียดีล</span></div>` : ''}
        </td>
        <td class="cc-temp${c.temperature || scoreBar(c) ? '' : ' cc-blank'}">${c.temperature ? `<span class="badge badge-${TEMP[c.temperature]?.badge}" style="font-size:0.68rem">${TEMP[c.temperature]?.label}</span>` : scoreBar(c) ? '' : '<span style="color:var(--text-muted)">-</span>'}${scoreBar(c)}</td>
        <td class="cc-model${c.interestedModel ? '' : ' cc-blank'}" style="color:var(--text-2)">${escHtml(c.interestedModel || '-')}</td>
        <td class="cc-src${c.source ? '' : ' cc-blank'}" style="color:var(--text-3);font-size:0.8rem">${SOURCE[c.source] || escHtml(c.source) || '-'}</td>
        <td class="cc-urg">${!c.isLost ? `<span class="badge badge-${urgency.badge}" style="font-size:0.65rem">${urgency.label}</span>` : ''}</td>
        <td class="cc-age" style="color:var(--text-muted);font-size:0.8rem">${timeAgo(c.createdAt)}${quietBadge(c)}</td>
        <td class="cc-act">
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${c.id}" title="แก้ไข">✏️</button>
            <button class="btn btn-ghost btn-sm del-btn" data-id="${c.id}" title="ลบ" style="color:var(--danger)">🗑</button>
          </div>
        </td>
      </tr>
    `}).join('')

    tbody.querySelectorAll('.cust-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.edit-btn,.del-btn')) return
        const c = filtered.find(x => x.id === row.dataset.id)
        if (c) openDetail(c)
      })
    })
    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const c = customers.find(x => x.id === btn.dataset.id)
        if (c) openForm(c)
      })
    )
    tbody.querySelectorAll('.del-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        const c = customers.find(x => x.id === btn.dataset.id)
        const ok = await confirmDialog({ title: 'ลบลูกค้า', message: `ต้องการลบ "${fullName(c)}"? (กู้คืนได้ใน 30 วัน)`, confirmText: 'ลบ', danger: true })
        if (!ok) return
        try {
          await softDelete('customers', c.id)
          showToast(`ลบ ${fullName(c)} แล้ว`, 'success')
          await loadData()
        } catch { showToast('เกิดข้อผิดพลาด', 'error') }
      })
    )
  }

  // ── Detail Workspace — everything about this customer, one place, no page-hopping ──
  async function openDetail(c) {
    const { el, close } = openModal({
      title: `👤 ${fullName(c)}`,
      size: 'xl',
      body: `
        <div class="grid-2" style="gap:24px;align-items:flex-start">
          <div style="display:flex;flex-direction:column;gap:18px">
            <div>
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
                <div class="avatar avatar-xl" style="background:${avatarColor(c)};color:#fff;font-size:1.4rem">${escHtml(initials(c.firstName, c.lastName))}</div>
                <div>
                  <div style="font-size:1.2rem;font-weight:700">${escHtml(fullName(c))}${c.vip ? ' ⭐' : ''}</div>
                  ${!c.isLost && ['lead', 'pp'].includes(c.stage) ? (sc => `<div title="${escHtml(sc.signals.join('\n'))}" style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">🎯 โอกาสปิดการขาย <b style="color:${sc.score >= 80 ? 'var(--danger)' : sc.score >= 60 ? 'var(--warning)' : 'var(--text-2)'}">${sc.score}%</b></div>`)(heuristicScore(c)) : ''}
                  <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                    <span class="badge badge-${STAGE[c.stage]?.badge || 'secondary'}">${STAGE[c.stage]?.label || escHtml(c.stage)}</span>
                    ${!c.isLost && ['lead', 'pp'].includes(c.stage)
                      ? `<span id="wk-temp" style="display:inline-flex;gap:3px" title="ความสนใจของลูกค้า — กดเพื่อเปลี่ยน">${Object.entries(TEMP).map(([k, v]) => `<button type="button" class="btn btn-xs wk-temp ${c.temperature === k ? `btn-${v.badge}` : 'btn-ghost'}" data-t="${k}">${v.label}</button>`).join('')}</span>`
                      : c.temperature ? `<span class="badge badge-${TEMP[c.temperature]?.badge}">${TEMP[c.temperature]?.label}</span>` : ''}
                    ${c.isLost ? `<span class="badge badge-secondary">⬛ เสียดีล</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${detail('📱 โทร', c.phone && String(c.phone).replace(/[^\d+]/g, '') ? `<a id="wk-tel" href="tel:${String(c.phone).replace(/[^\d+]/g, '')}" style="color:var(--primary)">${formatPhone(c.phone)}</a>` : (formatPhone(c.phone) || '-'))}
                ${detail('💚 LINE', escHtml(c.lineId || '-'))}
                ${detail('📧 Email', escHtml(c.email || '-'))}
                ${detail('🚗 สนใจ', escHtml(c.interestedModel || '-') + (c.isLost ? '' : ' <button class="btn btn-ghost btn-xs" id="wk-td-btn" title="นัดลูกค้ามาทดลองขับ">🚙 นัดทดลองขับ</button>'))}
                ${(() => { const f = c.interestedModel ? modelFacts(c.interestedModel, getVehicles(), 4) : []; return f.length ? `<details style="margin:-2px 0 2px;font-size:0.76rem"><summary style="cursor:pointer;color:var(--primary)">📋 ราคา/สเปครุ่นนี้ (ไว้ตอบลูกค้า)</summary><div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${f.map(x => `<div style="padding:6px 8px;border-radius:8px;background:var(--surface-2);line-height:1.45">${escHtml(x)}</div>`).join('')}<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:0.66rem;color:var(--text-muted)">ราคาตั้งจากฐานข้อมูลรถ ยังไม่รวมโปรโมชั่น</span><button type="button" class="btn btn-secondary btn-xs" id="wk-facts-copy">📋 คัดลอกสเปคส่งลูกค้า</button></div>${calcHtml(c)}</div></details>` : '' })()}
                ${detail('💰 งบประมาณ', c.budget ? formatCurrency(c.budget) : '-')}
                ${detail('💼 อาชีพ', escHtml(c.occupation || '-'))}
                ${detail('💵 รายได้ต่อเดือน', c.monthlyIncome ? formatCurrency(c.monthlyIncome) : '-')}
                ${detail('📌 ที่มา', SOURCE[c.source] || escHtml(c.source) || '-')}
                ${detail('👤 ผู้ดูแล', escHtml(c.assignedTo || '-'))}
                ${detail('📅 เพิ่มเมื่อ', formatDate(c.createdAt))}
                ${detail('📞 ติดต่อล่าสุด', `<span id="wk-last-contact">${c.lastContactAt ? timeAgo(c.lastContactAt) : 'ยังไม่มีบันทึก'}</span> <button class="btn btn-ghost btn-xs" id="wk-touch-btn" title="โทร/ทักลูกค้าแล้ว กดบันทึกไว้">✅ ติดต่อแล้ว</button>`)}
                ${c.isLost ? detail('❌ เหตุผลเสียดีล', escHtml(c.lostReason || '-')) : ''}
                ${!c.isLost && c.prevLostReason ? detail('↩️ เคยเสียดีล', escHtml(c.prevLostReason)) : ''}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
                <button class="btn btn-secondary btn-sm" id="wk-edit-btn">✏️ แก้ไขข้อมูล</button>
                ${c.stage === 'lead' && (c.phone || c.lineId) ? `<button class="btn btn-primary btn-sm" id="wk-promote-btn">📇 มาร์คเป็น Prospect</button>` : ''}
                ${!c.isLost ? `<button class="btn btn-ghost btn-sm" id="wk-lost-btn" style="color:var(--danger)">⬛ มาร์คเสียดีล</button>` : `<button class="btn btn-ghost btn-sm" id="wk-unlost-btn">↩️ ยกเลิกเสียดีล</button>`}
              </div>
            </div>

            <div id="wk-followup-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧭 คำแนะนำการติดตาม</div>
              <div class="skeleton" style="height:56px;border-radius:10px"></div>
            </div>

            <div id="wk-fu-list-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">📅 นัดติดตามที่ค้างอยู่</div>
              <div class="skeleton" style="height:40px;border-radius:10px"></div>
            </div>

            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-weight:600;font-size:0.85rem">📝 ไทม์ไลน์การติดต่อ</span>
                <button class="btn btn-secondary btn-xs" id="add-comm-btn">➕ บันทึกการติดต่อ</button>
              </div>
              <div id="wk-timeline" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto">
                <div class="skeleton" style="height:48px;border-radius:10px"></div>
                <div class="skeleton" style="height:48px;border-radius:10px"></div>
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:18px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" id="wk-quote-btn">🧾 สร้างใบเสนอราคา</button>
              ${/* ลูกค้า walk-in จองเลยได้ตั้งแต่เป็น Lead ไม่ต้องย้ายเป็น Prospect ก่อน */ ''}${!c.bookingId && !c.isLost ? `<button class="btn btn-primary btn-sm" id="wk-booking-btn">📝 สร้างใบจอง</button>` : ''}
              <button class="btn btn-secondary btn-sm" id="wk-jobcard-btn">🔧 เปิด Job Card</button>
            </div>

            <div id="wk-booking-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🚗 ใบจองที่เชื่อมโยง</div>
              ${c.bookingId ? `<div class="skeleton" style="height:90px;border-radius:10px"></div>` : `<div class="empty-state" style="padding:16px"><div class="empty-icon" style="font-size:1.4rem">📋</div><div class="empty-title" style="font-size:0.82rem">ยังไม่มีใบจอง</div></div>`}
            </div>

            <div id="wk-quote-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧾 ใบเสนอราคาที่เกี่ยวข้อง</div>
              <div class="skeleton" style="height:40px;border-radius:10px"></div>
            </div>

            <div id="wk-jobcard-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🔧 ประวัติซ่อม/บริการ (Job Card)</div>
              <div class="skeleton" style="height:40px;border-radius:10px"></div>
            </div>

            <div id="wk-complaint-panel">
              <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">⚠️ ประวัติร้องเรียน</div>
              <div class="skeleton" style="height:40px;border-radius:10px"></div>
            </div>
            <div id="wk-empty-summary" style="display:none;font-size:0.78rem;color:var(--text-muted);padding:8px 10px;border:1px dashed var(--border);border-radius:10px"></div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost btn-sm" id="wk-delete-btn" style="color:var(--danger);margin-right:auto">🗑️ ลบ</button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
        ${String(c.phone || '').replace(/[^\d+]/g, '') ? `<a class="btn btn-primary" id="wk-tel2" href="tel:${String(c.phone).replace(/[^\d+]/g, '')}">📞 โทรหาลูกค้า</a>` : ''}
      `,
    })

    bindCalc(el)
    // ส่งราคา/สเปครุ่นที่สนใจให้ลูกค้าทาง LINE ในคลิกเดียว (ข้อมูลเดียวกับที่โชว์ ไม่มีข้อมูลลูกค้าปน)
    el.querySelector('#wk-facts-copy')?.addEventListener('click', async () => {
      const lines = modelFacts(c.interestedModel, getVehicles(), 4)
      const text = [`ข้อมูล ${c.interestedModel} ครับ`, ...lines.map(x => '• ' + x), '*ราคาตั้ง ยังไม่รวมโปรโมชั่น สอบถามโปรล่าสุดได้เลยครับ'].join('\n')
      try { await navigator.clipboard.writeText(text); showToast('📋 คัดลอกแล้ว วางใน LINE ได้เลย', 'success') } catch { showToast('คัดลอกไม่สำเร็จ', 'warning') }
    })
    el.querySelector('#wk-td-btn')?.addEventListener('click', () => openTestDriveForm(c, { onSaved: showTd }))
    // ถ้ามีนัดลองขับอยู่แล้ว ให้เห็นทันทีว่านัดวันไหน (ไม่ต้องไปเปิดหน้า Test Drive)
    function showTd(t) {
      const b = el.querySelector('#wk-td-btn')
      if (b && t?.date) { b.textContent = `🚙 นัดลองขับ ${t.date === todayBangkok() ? 'วันนี้' : formatDate(t.date)}${t.time ? ' ' + t.time : ''}`; b.style.color = 'var(--success)' }
    }
    if (!c.isLost) loadUpcomingTestDrive(c).then(showTd).catch(() => {})
    el.querySelector('#wk-touch-btn')?.addEventListener('click', async e => {
      const b = e.currentTarget
      b.disabled = true
      const now = new Date().toISOString()
      if (await touchCustomerContact(c.id, now)) {
        c.lastContactAt = now
        const span = el.querySelector('#wk-last-contact')
        if (span) span.textContent = timeAgo(now)
        showToast('✅ บันทึกว่าติดต่อลูกค้าแล้ว', 'success')
      } else { b.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    // โทรจากเบอร์ในหน้านี้ → วางสายกลับมาที่แอป ระบบถามผลการโทร (utils/callLogger.js)
    const armCall = () => armCallLog(c, {
      hasPending: () => (pendingFuCount.get(c) || 0) > 0,
      onSaved: () => { refreshFollowupList(c); const span = document.getElementById('wk-last-contact'); if (span && c.lastContactAt) span.textContent = timeAgo(c.lastContactAt) },
    })
    el.querySelector('#wk-tel')?.addEventListener('click', armCall)
    // ปุ่มโทรใหญ่ด้านล่าง (บนมือถือเบอร์ด้านบนเลื่อนหายไปเร็ว) · ปุ่มลบย่อลงไว้ซ้าย กันกดพลาด
    el.querySelector('#wk-tel2')?.addEventListener('click', armCall)
    // ตั้งความสนใจ (Hot/Warm/Cold) ได้ในคลิกเดียว — กดซ้ำปุ่มเดิมเพื่อล้าง
    el.querySelectorAll('.wk-temp').forEach(btn => btn.addEventListener('click', async () => {
      const t = c.temperature === btn.dataset.t ? null : btn.dataset.t
      try {
        await updateDocData('customers', c.id, { temperature: t })
        c.temperature = t
        const row = customers.find(x => x.id === c.id)
        if (row) row.temperature = t
        el.querySelectorAll('.wk-temp').forEach(x => { x.className = `btn btn-xs wk-temp ${x.dataset.t === t ? `btn-${TEMP[t].badge}` : 'btn-ghost'}` })
        renderTable()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    el.querySelector('#wk-edit-btn')?.addEventListener('click', () => {
      close(); openForm(c, { onSaved: updated => openDetail(updated) })
    })
    el.querySelector('#wk-promote-btn')?.addEventListener('click', async () => {
      try {
        const patch = { stage: 'pp', stageChangedAt: new Date().toISOString() }
        await updateDocData('customers', c.id, patch)
        Object.assign(c, patch)
        showToast('🎉 อัปเกรดเป็น Prospect อัตโนมัติ (ได้เบอร์ติดต่อ/LINE แล้ว)', 'success')
        close(); await loadData(); openDetail(c)
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
    el.querySelector('#wk-lost-btn')?.addEventListener('click', () => openLostModal(c, () => { close(); loadData().then(() => openDetail(c)) }))
    el.querySelector('#wk-unlost-btn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ยกเลิกสถานะเสียดีล', message: `นำ "${fullName(c)}" กลับมาเป็นลูกค้าที่ยังติดตามอยู่?`, confirmText: 'ยกเลิกเสียดีล' })
      if (!ok) return
      try {
        // เริ่มนับความเงียบใหม่จากวันนี้ (ไม่งั้นขึ้นว่า "เงียบ 60 วัน" ทันทีที่ดึงกลับมา) และเก็บเหตุผลเดิมไว้ดูย้อนหลัง
        const now = new Date().toISOString()
        const patch = { isLost: false, lostReason: '', lostAt: null, stageChangedAt: now, prevLostReason: c.lostReason || '', revivedAt: now }
        await updateDocData('customers', c.id, patch)
        Object.assign(c, patch)
        showToast('↩️ ยกเลิกสถานะเสียดีลแล้ว · นัดติดตามครั้งถัดไปได้เลย', 'success')
        close(); await loadData(); openDetail(c)
        openAddFollowup(c, { me: myDisplayName, onSaved: () => refreshFollowupList(c) })
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
    el.querySelector('#wk-delete-btn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบลูกค้า', message: `ต้องการลบ "${fullName(c)}"? (กู้คืนได้ใน 30 วัน)`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('customers', c.id)
        showToast(`ลบ ${fullName(c)} แล้ว`, 'success')
        close(); await loadData()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
    el.querySelector('#add-comm-btn')?.addEventListener('click', () => openCommForm(c, () => refreshTimeline(c)))
    el.querySelector('#wk-quote-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('lamom_quote_prefill', JSON.stringify({
        customerId: c.id, customerName: fullName(c), phone: c.phone || '', email: c.email || '',
        lineId: c.lineId || '', interestedModel: c.interestedModel || '',
      }))
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
      navigate('/crm/quotation')
    })
    el.querySelector('#wk-booking-btn')?.addEventListener('click', () => openCreateBookingModal(c, updated => { close(); loadData().then(() => openDetail(updated)) }))
    el.querySelector('#wk-jobcard-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('lamom_jobcard_prefill', JSON.stringify({
        customerId: c.id, custName: fullName(c), phone: c.phone || '',
      }))
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
      navigate('/service/jobs')
    })

    refreshTimeline(c)
    refreshFollowup(c)
    refreshFollowupList(c)
    refreshBookingPanel(c)
    refreshQuotePanel(c)
    refreshJobCardPanel(c)
    refreshComplaintPanel(c)
  }

  // นัดติดตามที่ยังไม่ทำของลูกค้ารายนี้ + ปุ่มทำแล้ว/นัดใหม่ (ไม่ต้องสลับไปหน้า Follow-up)
  async function refreshFollowupList(c) {
    const el = document.getElementById('wk-fu-list-panel')
    if (!el) return
    const today = todayBangkok()
    let rows = []
    try { rows = await listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000) } catch {}
    const list = pendingFollowupsFor(rows, c.id, today)
    pendingFuCount.set(c, list.length)
    if (!document.getElementById('wk-fu-list-panel')) return
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:600;font-size:0.85rem">📅 นัดติดตามที่ค้างอยู่${list.length ? ` (${list.length})` : ''}</span>
        <button class="btn btn-secondary btn-xs" id="wk-fu-add-btn">➕ นัดติดตาม</button>
      </div>
      ${list.length ? `<div style="display:flex;flex-direction:column;gap:6px">${list.map(f => `
        <div style="display:flex;align-items:center;gap:8px;background:var(--surface-2);border-radius:var(--radius-md);padding:8px 10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:0.8rem;font-weight:600">${escHtml(f.purpose || 'ติดตาม')}
              ${f.late > 0 ? `<span class="badge badge-danger" style="font-size:0.65rem">เลย ${f.late} วัน</span>` : f.late === 0 ? `<span class="badge badge-warning" style="font-size:0.65rem">วันนี้</span>` : ''}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${formatDate(f.dueDate)}${f.salesperson ? ` · ${escHtml(f.salesperson)}` : ''}${f.note ? ` · ${escHtml(f.note)}` : ''}</div>
          </div>
          <button class="btn btn-ghost btn-xs wk-fu-done" data-id="${escHtml(f.id)}">✅ ทำแล้ว</button>
        </div>`).join('')}</div>`
        : `<div style="font-size:0.78rem;color:var(--text-muted);padding:6px 2px">ไม่มีนัดค้าง${!c.isLost && ['lead', 'pp'].includes(c.stage) ? ' — ควรนัดติดตามครั้งถัดไปไว้ จะได้ไม่ลืม' : ''}</div>`}
    `
    el.querySelector('#wk-fu-add-btn')?.addEventListener('click', () => openAddFollowup(c, { me: myDisplayName, onSaved: () => refreshFollowupList(c) }))
    el.querySelectorAll('.wk-fu-done').forEach(btn => btn.addEventListener('click', () => {
      const f = list.find(x => x.id === btn.dataset.id)
      if (!f) return
      openModal({
        title: '✅ บันทึกผลการติดตาม', size: 'sm',
        body: `<div class="input-group"><label class="input-label">ผลการติดต่อ *</label><textarea class="input" id="wk-fu-result" data-mic rows="3" placeholder="เช่น สนใจ นัดทดลองขับเสาร์นี้"></textarea></div>`,
        async onConfirm() {
          const result = document.getElementById('wk-fu-result')?.value?.trim()
          if (!result) { showToast('❗ กรุณากรอกผลการติดต่อ', 'error'); return false }
          try {
            await updateDocData('followups', f.id, { status: 'done', result })
            touchCustomerContact(f.customerId)
            showToast('✅ บันทึกผลแล้ว', 'success'); refreshFollowupList(c)
            offerNextFollowup(c, result, { me: myDisplayName, hasPending: list.some(x => x.id !== f.id), onSaved: () => refreshFollowupList(c) })
          } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        },
      })
      setTimeout(() => document.getElementById('wk-fu-result')?.focus(), 50)
    }))
  }

  // ไทม์ไลน์การติดต่อ (comm_logs + customer_notes) ใหม่สุดก่อน — ใช้ทั้งหน้าไทม์ไลน์และ AI ผู้ช่วยปิดการขาย
  async function loadHistory(c) {
    let logs = [], notes = []
    try { logs = await listDocs('comm_logs', [['customerId', '==', c.id], ...companyScopeFilters()], 'createdAt', 'desc', 30) } catch {}
    try { notes = await listDocs('customer_notes', [], 'time', 'desc', 300) } catch {}
    notes = notes.filter(n => n.customer === fullName(c))
    return [
      ...logs.map(l => ({ ts: l.createdAt, icon: LOG_ICONS[l.type] || '📌', label: LOG_LABELS[l.type] || l.type, text: l.note || '' })),
      ...notes.map(n => ({ ts: n.time, icon: NOTE_TYPE_ICONS[n.type] || '📌', label: NOTE_TYPE_LABELS[n.type] || n.type, text: n.text || '', pinned: n.pinned })),
    ].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0))
  }

  async function refreshTimeline(c) {
    const el = document.getElementById('wk-timeline')
    if (!el) return
    const merged = await loadHistory(c)
    if (!document.getElementById('wk-timeline')) return
    if (!merged.length) { el.innerHTML = `<div class="empty-state" style="padding:12px"><div class="empty-icon" style="font-size:1.5rem">📝</div><div class="empty-title" style="font-size:0.85rem">ยังไม่มีบันทึก</div></div>`; return }
    el.innerHTML = merged.map(m => `
      <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px 12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span>${m.icon}</span>
          <span style="font-weight:600;font-size:0.78rem">${escHtml(m.label)}</span>
          ${m.pinned ? '<span style="font-size:0.7rem">📌</span>' : ''}
          <span style="margin-left:auto;font-size:0.72rem;color:var(--text-muted)">${timeAgo(m.ts)}</span>
        </div>
        <div style="font-size:0.825rem;color:var(--text-2)">${escHtml(m.text)}</div>
      </div>
    `).join('')
  }

  async function refreshFollowup(c) {
    const el = document.getElementById('wk-followup-panel')
    if (!el) return
    let commLogs = []
    try { commLogs = await listDocs('comm_logs', [['customerId', '==', c.id], ...companyScopeFilters()], 'createdAt', 'desc', 30) } catch {}
    let stockAvailable = null
    let overBudget = false
    try {
      const vehicles = await listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 500)
      if (c.interestedModel) {
        stockAvailable = isModelInStock(c.interestedModel, vehicles)
        const needle = c.interestedModel.toLowerCase()
        const match = vehicles.find(v => `${v.brand || ''} ${v.model || ''} ${v.variant || ''}`.toLowerCase().includes(needle))
        if (c.budget && match?.price) overBudget = c.budget < match.price * 0.9
      }
    } catch {}
    const rec = getFollowUpRecommendation(c, commLogs, { stockAvailable, overBudget })
    const u = URGENCY[rec.urgency] || URGENCY.low
    if (!document.getElementById('wk-followup-panel')) return
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:600;font-size:0.85rem">🧭 คำแนะนำการติดตาม</span>
        <button class="btn btn-primary btn-xs" id="wk-ai-analyze-btn" style="background:linear-gradient(135deg,#8B5CF6,#3B82F6);border:none;box-shadow:0 2px 10px rgba(99,102,241,.35)">✨ AI ช่วยปิดการขาย</button>
      </div>
      <div class="card" style="padding:12px 14px;border-left:3px solid var(--${u.badge})">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="badge badge-${u.badge}" style="font-size:0.68rem">${u.label}</span>
          ${rec.diagnosedProblem ? `<span style="font-size:0.72rem;color:var(--text-muted)">🔎 ${escHtml(rec.diagnosedProblem)}</span>` : ''}
        </div>
        <div style="font-size:0.82rem;color:var(--text-2);line-height:1.5">${escHtml(rec.recommendation)}</div>
      </div>
      <div id="wk-ai-analysis"></div>
      <details id="wk-ai-reply" style="margin-top:8px">
        <summary style="cursor:pointer;font-size:0.8rem;font-weight:600;color:var(--primary)">💬 ลูกค้าถามมา — ให้ AI ช่วยร่างคำตอบ</summary>
        <textarea id="wk-ai-reply-q" data-mic class="form-input" rows="3" style="margin-top:6px;width:100%;font-size:0.82rem" placeholder="วางข้อความที่ลูกค้าถาม เช่น &quot;S05 วิ่งได้กี่โล ชาร์จที่บ้านได้ไหม&quot;"></textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="btn btn-primary btn-xs" id="wk-ai-reply-btn">✨ ร่างคำตอบ</button></div>
        <div id="wk-ai-reply-out"></div>
      </details>
    `
    enhanceMics(el)
    document.getElementById('wk-ai-reply-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('wk-ai-reply-btn')
      const out = document.getElementById('wk-ai-reply-out')
      const q = maskContacts(document.getElementById('wk-ai-reply-q')?.value || '').trim()
      if (!q) { showToast('วางข้อความที่ลูกค้าถามก่อน', 'warning'); return }
      if (!isAiEnabled()) { showToast('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้ AI', 'warning'); return }
      btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังร่าง...'
      try {
        const brief = buildCustomerBrief(c, { history: await loadHistory(c), today: todayBangkok(), vehicles: getVehicles(), testDrives: await loadTestDrivesFor(c).catch(() => null) })
        // รุ่นที่ลูกค้าถามอาจไม่ใช่รุ่นที่บันทึกไว้ → แนบข้อมูลรุ่นที่อยู่ในคำถามด้วย
        // แนบรถพร้อมขายแยกรุ่น/สี ด้วย — ลูกค้ามักถาม "สีขาวมีพร้อมส่งไหม" (โหลดไม่ได้ก็ร่างต่อโดยไม่มีข้อมูลสต็อก)
        const catalog = [catalogContext(q, getVehicles()), await stockLine()].filter(Boolean).join('\n')
        const draft = await suggestCustomerReply(q, { channel: 'LINE', sender: c.firstName || 'ลูกค้า', customerInfo: brief, catalog })
        if (!document.getElementById('wk-ai-reply-out')) return
        if (!draft) { out.innerHTML = `<div style="font-size:0.78rem;color:var(--danger);margin-top:6px">AI ร่างไม่สำเร็จ ลองใหม่อีกครั้ง</div>`; return }
        out.innerHTML = `<div class="card" style="padding:10px 12px;margin-top:6px;background:var(--primary-dim);border:1px solid var(--primary)">
          <div id="wk-ai-reply-text" style="font-size:0.84rem;line-height:1.55;white-space:pre-wrap">${escHtml(draft)}</div>
          <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px"><button class="btn btn-secondary btn-xs" id="wk-ai-reply-copy">📋 คัดลอกไปวางใน LINE</button></div>
        </div>`
        document.getElementById('wk-ai-reply-copy')?.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(draft); showToast('📋 คัดลอกแล้ว วางใน LINE ได้เลย', 'success') } catch { showToast('คัดลอกไม่สำเร็จ — กดค้างที่ข้อความแล้วคัดลอกเอง', 'warning') }
        })
      } catch { if (out) out.innerHTML = `<div style="font-size:0.78rem;color:var(--danger);margin-top:6px">AI ร่างไม่สำเร็จ ลองใหม่อีกครั้ง</div>` }
      finally { if (document.getElementById('wk-ai-reply-btn')) { btn.disabled = false; btn.innerHTML = '✨ ร่างคำตอบ' } }
    })
    if (autoAiOnce) { autoAiOnce = false; setTimeout(() => document.getElementById('wk-ai-analyze-btn')?.click(), 0) }
    // AI ผู้ช่วยปิดการขาย (Gemini) — เรียกเฉพาะตอนกดปุ่ม ไม่เรียกอัตโนมัติทุกครั้งที่เปิดดูลูกค้า (แพง/ช้า และไม่ควร
    // ส่งข้อมูลลูกค้าออกไปโดยไม่จำเป็น) ส่งแค่สรุปสถานะ/ประวัติการติดต่อ ไม่ส่งเบอร์/อีเมล/LINE ID (ดู utils/salesAi.js)
    document.getElementById('wk-ai-analyze-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('wk-ai-analyze-btn')
      const box = document.getElementById('wk-ai-analysis')
      if (!isAiEnabled()) { showToast('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้ AI วิเคราะห์', 'warning'); return }
      btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> AI กำลังคิด...'
      const fail = () => { if (document.getElementById('wk-ai-analysis')) box.innerHTML = `<div style="font-size:0.78rem;color:var(--danger);margin-top:6px">AI วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง</div>` }
      try {
        const today = todayBangkok()
        let fuRows = []
        try { fuRows = await listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000) } catch {}
        const brief = buildCustomerBrief(c, { history: await loadHistory(c), followups: pendingFollowupsFor(fuRows, c.id, today), today, vehicles: getVehicles(), testDrives: await loadTestDrivesFor(c).catch(() => null) })
        const r = await aiSalesCloser(brief)
        if (!document.getElementById('wk-ai-analysis')) return
        if (!r) { fail(); return }
        const ch = { call: '📞 โทร', line: '💚 LINE', visit: '🏠 นัดพบ' }[r.channel] || ''
        const scoreColor = r.score >= 70 ? 'success' : r.score >= 40 ? 'warning' : 'danger'
        box.innerHTML = `<div class="card ai-closer" style="padding:12px 14px;margin-top:8px;background:var(--primary-dim);border:1px solid var(--primary)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:0.75rem;color:var(--primary);font-weight:700">🤖 AI ผู้ช่วยปิดการขาย</span>
            ${r.score !== null ? `<span class="badge badge-${scoreColor}" style="margin-left:auto">โอกาสปิด ${r.score}%</span>` : ''}
          </div>
          ${r.score !== null ? `<div style="height:5px;border-radius:3px;background:var(--surface-2);overflow:hidden;margin-bottom:8px"><div style="height:100%;width:${r.score}%;background:var(--${scoreColor})"></div></div>` : ''}
          ${r.summary ? `<div style="font-size:0.8rem;color:var(--text-2);line-height:1.5">${escHtml(r.summary)}</div>` : ''}
          ${r.nextAction ? `<div style="font-size:0.82rem;font-weight:600;color:var(--primary);margin-top:6px">→ ${escHtml(r.nextAction)}${r.when || ch ? `<span style="font-weight:400;color:var(--text-muted)"> · ${escHtml([ch, r.when].filter(Boolean).join(' · '))}</span>` : ''}</div>` : ''}
          ${r.objections.length ? `<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">ลูกค้าอาจกังวลเรื่อง:</div><ul style="margin:2px 0 0 18px;padding:0;font-size:0.78rem;color:var(--text-2);line-height:1.5">${r.objections.map(o => `<li>${escHtml(o)}</li>`).join('')}</ul>` : ''}
          ${r.lineMessage ? `<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">💚 ข้อความ LINE ที่ส่งได้เลย (แก้ได้):</div>
            <textarea class="input" id="wk-ai-line" rows="3" style="width:100%;margin-top:3px;font-size:0.8rem">${escHtml(r.lineMessage)}</textarea>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${r.lineMessage ? `<button class="btn btn-primary btn-xs" id="wk-ai-copy">📋 คัดลอกข้อความ</button>` : ''}
            ${!c.isLost && mentionsTestDrive(r.nextAction + ' ' + (r.when || '')) ? `<button class="btn btn-secondary btn-xs" id="wk-ai-td">🚙 นัดทดลองขับเลย</button>` : ''}
            ${!c.isLost && r.followUpDays !== null ? `<button class="btn btn-secondary btn-xs" id="wk-ai-plan">📅 นัดตามที่ AI แนะนำ (${r.followUpDays === 0 ? 'วันนี้' : `อีก ${r.followUpDays} วัน`})</button>` : ''}
          </div>
        </div>`
        box.querySelector('#wk-ai-copy')?.addEventListener('click', async () => {
          const text = box.querySelector('#wk-ai-line')?.value || r.lineMessage
          try { await navigator.clipboard.writeText(text); showToast('📋 คัดลอกแล้ว วางใน LINE ได้เลย', 'success') } catch { showToast('คัดลอกไม่สำเร็จ — กดค้างที่ข้อความแล้วคัดลอกเอง', 'warning') }
        })
        // AI แนะนำให้ชวนลองขับ → เปิดฟอร์มนัดที่เติมวันจากคำแนะนำ (เช่น "พรุ่งนี้" "เสาร์นี้") ให้เลย
        box.querySelector('#wk-ai-td')?.addEventListener('click', () => openTestDriveForm(c, { hint: `ลองขับ ${r.when || ''}` }))
        box.querySelector('#wk-ai-plan')?.addEventListener('click', () => openAddFollowup(c, {
          me: myDisplayName, dueDate: addDaysIso(today, r.followUpDays), type: r.channel, note: r.nextAction.slice(0, 120),
          onSaved: () => refreshFollowupList(c),
        }))
      } catch (e) {
        if (e?.code === 'NOT_ENABLED') showToast('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้ AI วิเคราะห์', 'warning')
        fail()
      } finally {
        if (document.getElementById('wk-ai-analyze-btn')) { btn.disabled = false; btn.innerHTML = '✨ AI ช่วยปิดการขาย' }
      }
    })
  }

  // ส่วนที่ยังไม่มีข้อมูล (ใบจอง/ใบเสนอราคา/ซ่อม/ร้องเรียน) ไม่ต้องโชว์หัวข้อ + กล่องว่างทีละอัน ยาวเต็มจอ
  // รวมเป็นบรรทัดเดียว "ยังไม่มี: …" แทน — ส่วนที่มีข้อมูลยังแสดงเต็มเหมือนเดิม
  function markPanelEmpty(el, label) {
    el.innerHTML = ''
    el.style.display = 'none'
    el.dataset.emptyLabel = label
    const sum = document.getElementById('wk-empty-summary')
    if (!sum) return
    const labels = ['wk-booking-panel', 'wk-quote-panel', 'wk-jobcard-panel', 'wk-complaint-panel']
      .map(id => document.getElementById(id)?.dataset.emptyLabel).filter(Boolean)
    sum.textContent = 'ยังไม่มี: ' + labels.join(' · ')
    sum.style.display = labels.length ? '' : 'none'
  }

  async function refreshBookingPanel(c) {
    const el = document.getElementById('wk-booking-panel')
    if (!el) return
    if (!c.bookingId) {
      markPanelEmpty(el, '🚗 ใบจอง')
      return
    }
    let booking = null
    try { booking = await readDoc('bookings', c.bookingId) } catch {}
    if (!document.getElementById('wk-booking-panel')) return
    if (!booking) {
      el.innerHTML = `<div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🚗 ใบจองที่เชื่อมโยง</div><div style="font-size:0.8rem;color:var(--text-muted)">⚠️ ไม่พบใบจอง (อาจถูกลบ)</div>`
      return
    }
    const diag = getBookingDiagnosis(booking)
    const blockerBadge = diag.blockerType === 'none' ? 'success' : diag.blockerType === 'finance_rejected' ? 'danger' : 'warning'
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🚗 ใบจองที่เชื่อมโยง</div>
      <div class="card" style="padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;font-size:0.85rem;color:var(--primary)">${escHtml(booking.bookingNo || '')}</span>
          <span style="font-size:0.78rem;font-weight:700;color:var(--accent)">${formatCurrency(booking.price || 0)}</span>
        </div>
        ${detail('รุ่นรถ', escHtml(`${booking.brand || ''} ${booking.model || ''} ${booking.variant || ''}`.trim() || '-'))}
        ${detail('สถานะ', escHtml(booking.status || '-'))}
        ${detail('ไฟแนนซ์', escHtml(booking.finStatus || '-'))}
        ${detail('นัดส่งมอบ', formatDate(booking.deliveryDate))}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="badge badge-${blockerBadge}" style="font-size:0.66rem">${escHtml(diag.message)}</span>
          </div>
          ${diag.suggestedAction && diag.suggestedAction !== '-' ? `<div style="font-size:0.78rem;color:var(--text-2)">💡 ${escHtml(diag.suggestedAction)}</div>` : ''}
          ${c.stage === 'delivered' ? `<div style="margin-top:6px;display:flex;gap:6px"><button class="btn btn-ghost btn-xs" id="wk-followup-link">📞 Follow-up</button><button class="btn btn-ghost btn-xs" id="wk-winback-link">💝 Win-Back</button></div>` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" id="wk-view-booking" style="margin-top:10px;width:100%;justify-content:center">🔗 เปิดใบจองนี้</button>
      </div>
    `
    document.getElementById('wk-view-booking')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/crm/bookings?id=' + encodeURIComponent(c.bookingId)) })
    document.getElementById('wk-followup-link')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/crm/followup') })
    document.getElementById('wk-winback-link')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/crm/winback') })
  }

  async function refreshQuotePanel(c) {
    const el = document.getElementById('wk-quote-panel')
    if (!el) return
    let quotes = []
    try { quotes = await listDocs('quotations', [['customerId', '==', c.id], ...companyScopeFilters()], 'createdAt', 'desc', 20) } catch { quotes = [] }
    if (!document.getElementById('wk-quote-panel')) return
    if (!quotes.length) {
      markPanelEmpty(el, '🧾 ใบเสนอราคา')
      return
    }
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🧾 ใบเสนอราคาที่เกี่ยวข้อง</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${quotes.map(q => `
          <div class="card" style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:0.8rem;font-weight:600">${escHtml(q.quoteNo || q.id)}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(q.model || q.interestedModel || '-')}</div>
            </div>
            <div style="font-size:0.78rem;font-weight:700;color:var(--accent)">${q.price ? formatCurrency(q.price) : ''}</div>
          </div>
        `).join('')}
      </div>
    `
  }

  // (v1.0.459) ประวัติ Job Card ของลูกค้าคนนี้ — job_cards ยังไม่มี field customerId มาก่อน (พึ่งเพิ่มใหม่)
  // เลยจับคู่แบบ best-effort ด้วยเบอร์โทร (เชื่อถือได้กว่าชื่อ เพราะพิมพ์ผิด/สะกดต่างกันได้) ควบกับ customerId
  // จริงสำหรับ Job Card ที่เปิดจากปุ่ม "🔧 เปิด Job Card" ในหน้านี้นับจากนี้ไป
  function normPhone(p) { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('66') && d.length === 11 ? '0' + d.slice(2) : d } // +66 = 0
  async function refreshJobCardPanel(c) {
    const el = document.getElementById('wk-jobcard-panel')
    if (!el) return
    let jobs = []
    try { jobs = await listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 300) } catch { jobs = [] }
    const myPhone = normPhone(c.phone)
    const matched = jobs.filter(j => !j.deleted && (j.customerId === c.id || (myPhone && normPhone(j.phone) === myPhone)))
    if (!document.getElementById('wk-jobcard-panel')) return
    if (!matched.length) {
      markPanelEmpty(el, '🔧 ประวัติซ่อม')
      return
    }
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">🔧 ประวัติซ่อม/บริการ (Job Card)</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${matched.slice(0, 5).map(j => `
          <div class="card" style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:0.8rem;font-weight:600">${escHtml(j.jobNo || '')}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(`${j.brand||''} ${j.model||''}`.trim() || '-')} · ${formatDate(j.createdAt)}</div>
            </div>
            <span class="badge badge-secondary" style="font-size:0.68rem">${escHtml(j.status || '-')}</span>
          </div>
        `).join('')}
        ${matched.length > 5 ? `<div style="font-size:0.72rem;color:var(--text-muted)">และอีก ${matched.length - 5} รายการ</div>` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" id="wk-view-jobcards" style="margin-top:8px;width:100%;justify-content:center">🔗 ดู Job Card ทั้งหมด</button>
    `
    document.getElementById('wk-view-jobcards')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/service/jobs') })
  }

  // (v1.0.478) ประวัติร้องเรียนของลูกค้าคนนี้ — collection 'complaints' ยังไม่มี field customerId เลย (เก็บแค่
  // custName/phone แบบพิมพ์เอง) เลยจับคู่แบบ best-effort ด้วยเบอร์โทรเหมือนแพทเทิร์น refreshJobCardPanel()
  // ด้านบน (v1.0.459) — เดิมเซลส์ที่คุยกับลูกค้าไม่มีทางรู้จากหน้านี้เลยว่าลูกค้าเคยร้องเรียนอะไรมาก่อน
  async function refreshComplaintPanel(c) {
    const el = document.getElementById('wk-complaint-panel')
    if (!el) return
    let complaints = []
    try { complaints = await listDocs('complaints', companyScopeFilters(), 'createdAt', 'desc', 300) } catch { complaints = [] }
    const myPhone = normPhone(c.phone)
    const matched = complaints.filter(x => myPhone && normPhone(x.phone) === myPhone)
    if (!document.getElementById('wk-complaint-panel')) return
    if (!matched.length) {
      markPanelEmpty(el, '⚠️ ร้องเรียน')
      return
    }
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;font-size:0.85rem">⚠️ ประวัติร้องเรียน (${matched.length})</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${matched.slice(0, 5).map(x => `
          <div class="card" style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:0.8rem;font-weight:600">${escHtml(x.subject || '-')}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(x.openDate || '')}</div>
            </div>
            <span class="badge badge-secondary" style="font-size:0.68rem">${escHtml(x.status || '-')}</span>
          </div>
        `).join('')}
        ${matched.length > 5 ? `<div style="font-size:0.72rem;color:var(--text-muted)">และอีก ${matched.length - 5} รายการ</div>` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" id="wk-view-complaints" style="margin-top:8px;width:100%;justify-content:center">🔗 ดูเรื่องร้องเรียนทั้งหมด</button>
    `
    document.getElementById('wk-view-complaints')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); navigate('/crm/complaints') })
  }

  function openLostModal(c, onDone) {
    const { el, close } = openModal({
      title: `⬛ มาร์คเสียดีล — ${escHtml(fullName(c))}`, size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">เหตุผลที่เสียดีล <span class="required">*</span></label>
          ${reasonChipsHtml('lost-chip')}
          <textarea class="input" id="lost-reason" data-mic rows="3" placeholder="เลือกเหตุผลด้านบน แล้วพิมพ์รายละเอียดต่อได้ เช่น ราคา - อีกร้านลดมากกว่า 20,000"></textarea>
          <span class="input-error" id="lost-reason-e"></span>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="lm-c">ยกเลิก</button><button class="btn btn-danger" id="lm-s">⬛ ยืนยันเสียดีล</button>`,
    })
    // ปุ่มเหตุผลยอดนิยม — ขึ้นต้นข้อความด้วยหมวดเดียวกันเสมอ รายงานสัปดาห์จะนับรวมตามหมวดได้
    bindReasonChips(el, 'lost-chip', el.querySelector('#lost-reason'))
    el.querySelector('#lm-c').addEventListener('click', close)
    el.querySelector('#lm-s').addEventListener('click', async () => {
      const reason = el.querySelector('#lost-reason').value.trim().replace(/\s*[-–—:]$/, '').trim()
      if (!reason) { el.querySelector('#lost-reason-e').textContent = 'กรุณาระบุเหตุผล'; return }
      try {
        const patch = { isLost: true, lostReason: reason, lostAt: new Date().toISOString() }
        await updateDocData('customers', c.id, patch)
        Object.assign(c, patch)
        closeAutoLeadFollowups(c.id, `ปิดอัตโนมัติ: เสียดีล (${reason})`)
        close(); showToast('⬛ มาร์คเป็นเสียดีลแล้ว', 'warning')
        onDone?.()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
  }

  function openCreateBookingModal(c, onDone) {
    const { el, close } = openModal({
      title: `📝 สร้างใบจอง — ${escHtml(fullName(c))}`, size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่นรถ</label>
            <input class="input" id="cb-model" value="${escHtml(c.interestedModel || '')}" placeholder="เช่น DEEPAL S07" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคาขาย (บาท)</label>
            <input class="input" id="cb-price" type="number" value="${c.budget || ''}" placeholder="0" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เงินจอง (บาท) *</label>
            <input class="input" id="cb-deposit" type="number" placeholder="5000" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">พนักงานขาย</label>
            <select class="input" id="cb-sales" style="width:100%;margin-top:4px">${getSalesStaff().map(s => `<option ${s === c.assignedTo ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}</select></div>
          <span class="input-error" id="cb-err"></span>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="cb-c">ยกเลิก</button><button class="btn btn-primary" id="cb-s">📝 สร้างใบจอง</button>`,
    })
    el.querySelector('#cb-c').addEventListener('click', close)
    el.querySelector('#cb-s').addEventListener('click', async () => {
      const model = el.querySelector('#cb-model').value.trim()
      const price = Number(el.querySelector('#cb-price').value) || 0
      const deposit = Number(el.querySelector('#cb-deposit').value) || 0
      const salesName = el.querySelector('#cb-sales').value
      if (!model) { el.querySelector('#cb-err').textContent = '⚠️ กรุณาระบุรุ่นรถ'; return }
      if (!deposit) { el.querySelector('#cb-err').textContent = '⚠️ กรุณาระบุเงินจอง'; return }
      const btn = el.querySelector('#cb-s'); btn.disabled = true
      try {
        const bookingNo = newBookingNo()
        const bookingData = {
          // (v1.0.518) สร้างจากหน้า Customer Workspace เป็น flow แบบเร็ว เก็บแค่เงินจองตอนนี้ ยังไม่รู้เงินดาวน์
          // (จะกำหนดตอนเซ็นสัญญา) financeAmount จึงเท่ากับราคาเต็มไปก่อน แก้ไขยอดจัดไฟแนนซ์ได้อีกทีตอนกรอกเงินดาวน์จริง
          bookingNo, custName: fullName(c), phone: c.phone || '', customerId: c.id,
          model, price, cost: 0, bookingDeposit: deposit, down: 0, financeAmount: price, finStatus: '',
          salesName, source: c.source || '', status: 'ยอดจองคงค้าง',
          margin: 0, budgetUsed: 0, com70: 0, comFinance: 0, marginLeft: 0, totalIncome: 0,
          // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
          // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
          bookingDate: todayBangkok(), notes: `สร้างจาก Customer Workspace (${fullName(c)})`,
          companyId: myEffectiveCompanyId(),
        }
        const bookingId = await createDoc('bookings', bookingData)
        const stageChangedAt = new Date().toISOString()
        await updateDocData('customers', c.id, { stage: 'booking', stageChangedAt, bookingId })
        Object.assign(c, { stage: 'booking', stageChangedAt, bookingId })
        closeAutoLeadFollowups(c.id, 'ปิดอัตโนมัติ: ลูกค้าจองแล้ว')
        close()
        showToast(`📝 สร้างใบจอง ${bookingNo} แล้ว — อัปเดตสถานะลูกค้าเป็น "จองแล้ว"`, 'success')
        onDone?.(c)
      } catch { btn.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openCommForm(c, onSaved) {
    const { el, close } = openModal({
      title: '📝 บันทึกการติดต่อ', size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="input-group">
            <label class="input-label">ประเภท</label>
            <select class="input" id="log-type">
              ${Object.entries(LOG_ICONS).map(([k, v]) => `<option value="${k}">${v} ${LOG_LABELS[k]}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">รายละเอียด <span class="required">*</span></label>
            <textarea class="input" id="log-note" data-mic rows="3" placeholder="บันทึกสิ่งที่คุย..."></textarea>
            <span class="input-error" id="log-err"></span>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="lc">ยกเลิก</button><button class="btn btn-primary" id="ls">💾 บันทึก</button>`,
    })
    el.querySelector('#lc').addEventListener('click', close)
    el.querySelector('#ls').addEventListener('click', async () => {
      const note = document.getElementById('log-note').value.trim()
      if (!note) { document.getElementById('log-err').textContent = 'กรุณาระบุรายละเอียด'; return }
      try {
        const me = getState('user') || {}
        await createDoc('comm_logs', { customerId: c.id, type: document.getElementById('log-type').value, note, createdBy: me.displayName || me.email || me.uid || '', companyId: myEffectiveCompanyId() })
        touchCustomerContact(c.id)
        close(); showToast('บันทึกแล้ว', 'success')
        onSaved?.()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    })
  }

  // รุ่นที่ลูกค้าโชว์รูมนี้สนใจบ่อยขึ้นก่อน ตามด้วยรุ่นจากฐานข้อมูลรถ (ช่วยพิมพ์ให้ชื่อรุ่นตรงกัน)
  function modelSuggestions() {
    const freq = new Map()
    customers.forEach(c => { const m = String(c.interestedModel || '').trim(); if (m) freq.set(m, (freq.get(m) || 0) + 1) })
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m).slice(0, 15)
    return [...new Set([...top, ...getVehicles().map(v => [v.brand, v.model].filter(Boolean).join(' '))])].slice(0, 60)
  }

  function openForm(existing = null, { onSaved, prefill } = {}) {
    const isEdit = !!existing
    const pre = existing || prefill || null // prefill = ค่าที่พิมพ์มาจากฟอร์ม Lead ด่วน (ยังเป็นการเพิ่มใหม่)
    const { el, close } = openModal({
      title: isEdit ? `✏️ แก้ไข ${fullName(existing)}` : '➕ เพิ่มลูกค้าใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อ <span class="required">*</span></label><input class="input" id="ff" value="${escHtml(pre?.firstName || '')}" placeholder="ชื่อ"><span class="input-error" id="ff-e"></span></div>
            <div class="input-group"><label class="input-label">นามสกุล</label><input class="input" id="fl" value="${escHtml(pre?.lastName || '')}" placeholder="ไม่รู้ก็เว้นไว้ได้"><span class="input-error" id="fl-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="fp" type="tel" inputmode="tel" autocomplete="off" value="${escHtml(pre?.phone || '')}" placeholder="08x-xxx-xxxx"></div>
            <div class="input-group"><label class="input-label">LINE ID</label><input class="input" id="fl2" value="${escHtml(pre?.lineId || '')}" placeholder="@lineid"></div>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:-8px">💡 ถ้ายังไม่มีทั้งเบอร์โทรและ LINE ID ระบบจะเก็บเป็นสถานะ "Lead" — เมื่อกรอกอย่างใดอย่างหนึ่งจะขึ้นเป็น "Prospect" อัตโนมัติ</div>
          <div class="input-group"><label class="input-label">Email</label><input class="input" id="fe" type="email" value="${escHtml(pre?.email || '')}" placeholder="email@example.com"></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">รถที่สนใจ</label><input class="input" id="fm" list="fm-models" autocomplete="off" value="${escHtml(pre?.interestedModel || '')}" placeholder="เช่น DEEPAL S07"><datalist id="fm-models">${modelSuggestions().map(m => `<option value="${escHtml(m)}">`).join('')}</datalist></div>
            <div class="input-group"><label class="input-label">งบประมาณ (บาท)</label><input class="input" type="number" id="fb" value="${pre?.budget || ''}" placeholder="1000000"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">อาชีพ</label><select class="input" id="fo"><option value="">-</option>${OCCUPATIONS.map(o => `<option value="${o}" ${pre?.occupation === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
            <div class="input-group"><label class="input-label">รายได้ต่อเดือน (บาท)</label><input class="input" type="number" id="fic" value="${pre?.monthlyIncome || ''}" placeholder="30000"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ที่มา</label><select class="input" id="fso">${Object.entries(SOURCE).map(([k, v]) => `<option value="${k}" ${pre?.source === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="input-group"><label class="input-label">อุณหภูมิ</label><select class="input" id="ft"><option value="">-</option>${Object.entries(TEMP).map(([k, v]) => `<option value="${k}" ${pre?.temperature === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ผู้ดูแล</label><select class="input" id="fa"><option value="">-</option>${getSalesStaff().map(s => `<option ${(existing ? existing.assignedTo : myDisplayName) === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}</select></div>
            <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;margin-top:22px;cursor:pointer"><input type="checkbox" id="fvip" ${pre?.vip ? 'checked' : ''}> ⭐ ลูกค้า VIP</label>
          </div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="fn" rows="2" placeholder="บันทึกข้อมูลเพิ่มเติม...">${escHtml(pre?.notes || '')}</textarea></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="fc">ยกเลิก</button><button class="btn btn-primary" id="fok">💾 ${isEdit ? 'บันทึก' : 'เพิ่ม'}</button>`,
    })
    el.querySelector('#fc').addEventListener('click', close)
    el.querySelector('#fok').addEventListener('click', async () => {
      const first = document.getElementById('ff').value.trim()
      const last = document.getElementById('fl').value.trim()
      let ok = true
      if (!first) { document.getElementById('ff-e').textContent = 'กรุณาระบุชื่อ'; ok = false }
      if (!ok) return
      const btn = el.querySelector('#fok'); const btnHtml = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const fields = {
        firstName: first, lastName: last,
        phone: document.getElementById('fp').value.trim(),
        lineId: document.getElementById('fl2').value.trim(),
        email: document.getElementById('fe').value.trim(),
        interestedModel: document.getElementById('fm').value.trim(),
        budget: Number(document.getElementById('fb').value) || 0,
        occupation: document.getElementById('fo').value || '',
        monthlyIncome: Number(document.getElementById('fic').value) || 0,
        source: document.getElementById('fso').value,
        temperature: document.getElementById('ft').value || null,
        assignedTo: document.getElementById('fa').value || '',
        vip: document.getElementById('fvip').checked,
        notes: document.getElementById('fn').value.trim(),
      }
      try {
        if (isEdit) {
          const promote = shouldAutoPromoteToPP(existing, fields)
          const patch = { ...fields }
          if (promote) { patch.stage = 'pp'; patch.stageChangedAt = new Date().toISOString() }
          const prevOwner = existing.assignedTo || ''
          await updateDocData('customers', existing.id, patch)
          Object.assign(existing, patch)
          close()
          if (fields.assignedTo && normName(fields.assignedTo) !== normName(prevOwner)) {
            const moved = await moveFollowupsOnReassign(existing.id, prevOwner, fields.assignedTo)
            if (moved) showToast(`ย้ายนัดติดตาม ${moved} นัดไปให้ ${fields.assignedTo} แล้ว`, 'info')
          }
          if (promote) showToast('🎉 อัปเกรดเป็น Prospect อัตโนมัติ (ได้เบอร์ติดต่อ/LINE แล้ว)', 'success')
          else showToast(`แก้ไข ${first} ${last} แล้ว`, 'success')
          await loadData()
          onSaved?.(existing)
        } else {
          // เตือนก่อนถ้าเบอร์/LINE ซ้ำกับลูกค้าที่มีอยู่แล้ว (เหมือนฟอร์ม + Lead) — กันลูกค้าคนเดียวมีสองแฟ้ม/สองผู้ดูแล
          const dup = findDuplicate({ phone: fields.phone, lineId: fields.lineId }, customers)
          if (dup && !window.confirm(`เบอร์/LINE นี้มีอยู่แล้ว: ${fullName(dup)}${dup.assignedTo ? ` (ผู้ดูแล ${dup.assignedTo})` : ''}\nยังต้องการเพิ่มเป็นลูกค้าใหม่อีกคนหรือไม่?`)) {
            btn.disabled = false; btn.innerHTML = btnHtml; return
          }
          const stage = deriveInitialStage(fields)
          // Phase 2 หลายบริษัท — ติด companyId ของบริษัทหลักที่พนักงานคนสร้างสังกัดอยู่ (ถ้ามี) เพื่อให้กรอง
          // ตามบริษัทได้ในอนาคต ลูกค้าเดิมที่ไม่มี companyId ยังเห็นได้ทุกคนเหมือนเดิม (ไม่ถูกกรองออก)
          const payload = { ...fields, stage, stageChangedAt: new Date().toISOString(), isLost: false, lostReason: '', lostAt: null, bookingId: null, tags: [], companyId: myEffectiveCompanyId() }
          const id = await createDoc('customers', payload)
          const created = { ...payload, id }
          customers.unshift(created)
          close()
          const fu = await scheduleLeadFollowups(payload, id)
          showToast(`เพิ่ม ${first} ${last} แล้ว (${STAGE[stage]?.short})${fu ? ` · นัดติดตาม ${fu} ครั้ง` : ''}`, 'success')
          applyFilter()
          onSaved?.(created)
        }
      } catch { btn.disabled = false; btn.textContent = 'บันทึก'; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  // (v1.0.747) ซิงก์ลูกค้า/ใบจองให้ตรงกับไฟล์ DATA Booking — ลบได้ จึงเปิดเฉพาะเจ้าของ/แอดมิน (v1.0.748 ย้ายมาไว้นอกเมนู ⋯ ให้เห็นทันที)
  const canReconcileSheet = isProgramOwner() || ['owner', 'admin'].includes(getState('role') || getState('user')?.role)

  // ── Page HTML ─────────────────────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div><div class="page-title">👥 ลูกค้า</div><div class="page-subtitle" id="cust-count">กำลังโหลด...</div></div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm pa-more" id="pipeline-link-btn">📋 Pipeline View</button>
          <button class="btn btn-ghost btn-sm pa-more" id="sheet-view-btn" title="Spreadsheet View">📊 Sheet</button>
          <button class="btn btn-ghost btn-sm pa-more" id="import-cust-btn">📤 Import</button>
          <button class="btn btn-secondary btn-sm pa-more" id="export-cust-btn">📥 Export</button>
          <button class="btn btn-ghost btn-sm pa-more-btn" type="button" title="เมนูเพิ่มเติม">⋯ อื่นๆ</button>
          ${canReconcileSheet ? `<button class="btn btn-secondary btn-sm" id="sheet-reconcile-btn" title="ทำให้ลูกค้า/ใบจองตรงกับไฟล์ DATA Booking (Google Sheet) ในคลิกเดียว">🔄 ซิงก์ Sheet</button>` : ''}
          <button class="btn btn-primary" id="add-cust-btn" title="ฟอร์มสั้น กรอกแค่ชื่อกับเบอร์ก็บันทึกได้ · ต้องการกรอกครบทุกช่องกด 📝 กรอกแบบละเอียด ในฟอร์ม">➕ เพิ่มลูกค้า</button>
        </div>
      </div>

      ${ownScopeActive ? `
      <div id="cust-scope-banner" style="padding:8px 14px;background:var(--primary)11;border:1px solid var(--primary)33;border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.76rem;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <span>🔒 ${myTeamNames.size > 1 ? `กำลังแสดงเฉพาะลูกค้าของคุณและทีมที่ดูแล (${myTeamNames.size} คน)` : `กำลังแสดงเฉพาะลูกค้าที่คุณดูแล (ผู้ดูแล = "${escHtml(myDisplayName)}")`}</span>
      </div>
      ` : ''}

 <!-- การ์ดตัวเลข = ตัวกรองสถานะ (เดิมมีปุ่มกรองชุดเดียวกันซ้ำอีกแถวในกล่องค้นหา) กดใบเดิมซ้ำ = ทั้งหมด -->
      <div class="cust-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:8px;margin-bottom:16px">
        <div class="card stat-pill sf-card sf-on" data-s="all" role="button" tabindex="0" style="padding:10px 12px;text-align:center;cursor:pointer">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">📋 ทั้งหมด</div>
          <div id="stat-all" style="font-size:1.5rem;font-weight:800;color:var(--text)">0</div>
        </div>
        ${STAGE_ORDER.map(k => `
          <div class="card stat-pill sf-card" data-s="${k}" role="button" tabindex="0" style="padding:10px 12px;text-align:center;cursor:pointer">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">${STAGE[k].label}</div>
            <div id="stat-${k}" style="font-size:1.5rem;font-weight:800;color:var(--${STAGE[k].badge})">0</div>
          </div>
        `).join('')}
        <div class="card stat-pill sf-card" data-s="__lost" role="button" tabindex="0" style="padding:10px 12px;text-align:center;cursor:pointer">
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">⬛ เสียดีล</div>
          <div id="stat-lost" style="font-size:1.5rem;font-weight:800;color:var(--text-muted)">0</div>
        </div>
      </div>

      <div class="card mb-4" style="padding:14px 20px">
        <div class="cust-filters" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:200px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="cust-search" placeholder="ชื่อ เบอร์ รุ่น เช่น ร้อน s07" title="พิมพ์ภาษาพูดได้: ร้อน/อุ่น/เย็น, lead, จอง, เงียบ, ไม่มีเบอร์, ไม่มีผู้ดูแล + ชื่อหรือรุ่นรถ" style="padding-left:32px${hasSpeechInput() ? ';padding-right:44px' : ''}">
            ${hasSpeechInput() ? '<button type="button" class="btn btn-ghost btn-sm" id="cust-search-mic" title="พูดชื่อ/เบอร์ที่ต้องการหา" style="position:absolute;right:4px;top:50%;transform:translateY(-50%)">🎤</button>' : ''}
          </div>
          <div id="cust-smart" style="display:none;order:99;flex-basis:100%;font-size:0.76rem;color:var(--text-3);line-height:1.9"></div>
          <select class="input" id="cust-sales-filter" style="width:auto;min-width:140px" title="กรองตามผู้ดูแล">
            <option value="">👤 ผู้ดูแล</option>
            <option value="__none">⚠️ ยังไม่มีผู้ดูแล</option>
            ${getSalesStaff().map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('')}
          </select>
          <select class="input" id="cust-source-filter" style="width:auto;min-width:120px" title="กรองตามที่มา">
            <option value="">📌 ที่มา</option>
            ${Object.entries(SOURCE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
          <select class="input" id="cust-sort" style="width:auto;min-width:120px" title="เรียงลำดับ">
            <option value="urgent">↕️ ด่วนก่อน</option>
            <option value="quiet">💤 เงียบนานสุดก่อน</option>
            <option value="new">🆕 เพิ่มล่าสุดก่อน</option>
            <option value="score">🎯 โอกาสปิดสูงสุดก่อน</option>
          </select>
          <select class="input" id="cust-fu-filter" style="width:auto;min-width:130px" title="กรองตามนัดติดตาม">
            <option value="">📅 นัด</option>
            <option value="none">⚠️ Lead/Prospect ที่ไม่มีนัดเลย</option>
            <option value="late">🔴 มีนัดเลยกำหนด</option>
            <option value="quiet">💤 Lead/Prospect เงียบ ${QUIET_DAYS} วัน+</option>
            <option value="hot">🔥 Lead/Prospect ที่เป็น Hot</option>
          </select>
        </div>
      </div>

      <div class="table-wrap cust-table-wrap">
        <table class="cust-table">
          <thead><tr>
            <th>ลูกค้า</th><th>ติดต่อ</th><th>สถานะ</th><th>อุณหภูมิ</th><th>รถที่สนใจ</th><th>ที่มา</th><th>ความเร่งด่วน</th><th>เพิ่มเมื่อ</th><th></th>
          </tr></thead>
          <tbody id="cust-tbody">
            ${[...Array(5)].map(() => `<tr>${[...Array(9)].map(() => `<td><div class="skeleton" style="height:16px;border-radius:4px"></div></td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div id="sheet-view-wrap" style="display:none"></div>
    </div>
  `

  if (!document.getElementById('cust-style')) {
    const s = document.createElement('style')
    s.id = 'cust-style'
    s.textContent = `.cust-row{cursor:pointer}.cust-row:hover td{background:var(--surface-2)}.cust-row.is-lost{opacity:0.55}.ss-active{background:var(--primary-dim)!important}`
    document.head.appendChild(s)
  }

  // Sheet / Table toggle
  let sheetMode = false
  let sheet = null
  const SHEET_COLS = [
    { key: 'firstName', label: 'ชื่อ', width: 100, required: true },
    { key: 'lastName', label: 'นามสกุล', width: 110, required: true },
    { key: 'phone', label: 'โทรศัพท์', width: 120 },
    { key: 'lineId', label: 'LINE ID', width: 100 },
    { key: 'email', label: 'Email', width: 150 },
    { key: 'interestedModel', label: 'รถที่สนใจ', width: 130 },
    { key: 'stage', label: 'สถานะ', width: 100, type: 'select', options: STAGE_ORDER.map(v => ({ value: v, label: STAGE[v].short })) },
    { key: 'temperature', label: 'อุณหภูมิ', width: 90, type: 'select', options: [{ value: '', label: '-' }, ...Object.entries(TEMP).map(([v, s]) => ({ value: v, label: s.label.replace(/[🔴🟡🔵]\s*/, '') }))] },
    { key: 'vip', label: 'VIP', width: 60, type: 'boolean' },
    { key: 'isLost', label: 'เสียดีล', width: 70, type: 'boolean' },
    { key: 'source', label: 'ที่มา', width: 100, type: 'select', options: Object.entries(SOURCE).map(([v, l]) => ({ value: v, label: l.replace(/[📘💚🎵🚶🤝🔍🌐📱📌]\s*/, '') })) },
  ]

  document.getElementById('sheet-view-btn').addEventListener('click', () => {
    sheetMode = !sheetMode
    const tableWrap = container.querySelector('.table-wrap')
    const sheetWrap = document.getElementById('sheet-view-wrap')
    const btn = document.getElementById('sheet-view-btn')
    const addBtn = document.getElementById('add-cust-btn')
    if (sheetMode) {
      tableWrap.style.display = 'none'
      sheetWrap.style.display = ''
      btn.textContent = '📋 Table'; btn.className = 'btn btn-primary btn-sm'
      addBtn.style.display = 'none'
      sheet = new SmartSheet(sheetWrap, {
        columns: SHEET_COLS,
        rows: filtered, // เฉพาะที่เห็นบนหน้าจอ (ตัวกรอง + สิทธิ์การมองเห็น)
        onSave: async (row) => {
          try {
            if (row.id) await updateDocData('customers', row.id, row)
            else {
              if (!row.stage) row.stage = deriveInitialStage(row)
              row.stageChangedAt = new Date().toISOString()
              // (v1.0.472) เพิ่มลูกค้าใหม่ผ่าน Sheet view เดิมไม่เคยติด companyId เลย — พนักงานที่ถูกจำกัด
              // สิทธิ์ตามบริษัทจะมองไม่เห็นแถวที่ตัวเองเพิ่งเพิ่มเองทันที (แพทเทิร์นเดียวกับที่พบใน Bookings.js)
              row.companyId = myEffectiveCompanyId()
              const id = await createDoc('customers', row); row.id = id
            }
            showToast('บันทึกแล้ว', 'success')
            await loadData(); sheet.setRows(filtered)
          } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
        },
        onDelete: async (row) => {
          if (row.id) await softDelete('customers', row.id).catch(() => {})
        },
      })
    } else {
      tableWrap.style.display = ''
      sheetWrap.style.display = 'none'
      btn.textContent = '📊 Sheet'; btn.className = 'btn btn-ghost btn-sm'
      addBtn.style.display = ''
      sheet = null
      renderTable()
    }
  })

  // ปุ่มเดียว: เปิดฟอร์มสั้น (Lead ด่วน) ก่อน — เดิมมี 2 ปุ่ม "Lead ด่วน" กับ "เพิ่มลูกค้า" ทำงานซ้ำกัน ต้องเลือกเอง
  // อยากกรอกครบกด "📝 กรอกแบบละเอียด" ในฟอร์ม ค่าที่พิมพ์ไว้ตามไปด้วย
  document.getElementById('add-cust-btn').addEventListener('click', () => {
    if (sheetMode) return
    openQuickLead({ onFull: prefill => openForm(null, { prefill }) })
  })
  // มือถือ: ปุ่มรอง (Pipeline/Sheet/Import/Export) ซ่อนไว้ใต้ ⋯ อื่นๆ หัวหน้าไม่รก
  container.querySelector('.pa-more-btn')?.addEventListener('click', e => e.currentTarget.closest('.page-actions').classList.toggle('pa-open'))
  document.getElementById('pipeline-link-btn').addEventListener('click', () => navigate('/crm/pipeline'))

  document.getElementById('sheet-reconcile-btn')?.addEventListener('click', () => openSheetReconcile({ onDone: () => loadData() }))
  document.getElementById('export-cust-btn').addEventListener('click', () => {
    // Export เฉพาะรายการที่เห็นบนหน้าจอ (ตามตัวกรอง + สิทธิ์การมองเห็น) — เซลส์ไม่ควรดึงลูกค้าของทีมอื่นออกไปได้
    if (!filtered.length) { showToast('ไม่มีข้อมูลสำหรับ Export', 'warning'); return }
    const rows = filtered.map(c => ({
      'ชื่อ': c.firstName || '', 'นามสกุล': c.lastName || '',
      'โทรศัพท์': c.phone || '', 'LINE ID': c.lineId || '', 'Email': c.email || '',
      'รถที่สนใจ': c.interestedModel || '', 'งบประมาณ': c.budget || '',
      'สถานะ': STAGE[c.stage]?.short || c.stage || '', 'อุณหภูมิ': c.temperature || '',
      'VIP': c.vip ? 'ใช่' : '', 'เสียดีล': c.isLost ? 'ใช่' : '',
      'ที่มา': c.source || '', 'แท็ก': (c.tags || []).join(', '),
      'ผู้ดูแล': c.assignedTo || '',
      'วันที่เพิ่ม': formatDate(c.createdAt),
      'ติดต่อล่าสุด': c.lastContactAt ? formatDate(c.lastContactAt) : '',
    }))
    exportToExcel(rows, `customers-${todayBangkok()}.xlsx`, 'ลูกค้า')
    showToast(`Export ${rows.length} รายการแล้ว`, 'success')
  })

  const IMPORT_COLS = ['ชื่อ', 'นามสกุล', 'โทรศัพท์', 'LINE ID', 'Email', 'รถที่สนใจ', 'ที่มา', 'ผู้ดูแล', 'หมายเหตุ']
  document.getElementById('import-cust-btn').addEventListener('click', () => {
    openImportModal({
      title: 'นำเข้า Lead / ลูกค้า',
      columns: IMPORT_COLS,
      onImport: async (rows) => {
        // เช็คซ้ำกับลูกค้าทั้งหมดในระบบ (ไม่ใช่แค่ 400 รายล่าสุดที่หน้านี้โหลดไว้) — ถ้าโหลดไม่ได้ใช้เท่าที่มี
        let all = customers
        try { all = (await listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 500)).filter(c => !c.deleted) } catch {}
        const plan = planLeadImport(rows, all, { assignedTo: myDisplayName })
        let added = 0, failed = 0
        for (const doc of plan.creates) {
          try {
            await createDoc('customers', { ...doc, stageChangedAt: new Date().toISOString(), companyId: myEffectiveCompanyId() })
            added++
          } catch { failed++ }
        }
        showToast(`นำเข้า ${added} ราย${plan.duplicates.length ? ` · ข้ามซ้ำ ${plan.duplicates.length}` : ''}${failed ? ` · พลาด ${failed}` : ''}`, failed ? 'warning' : 'success', 8000)
        if (plan.duplicates.length) {
          openModal({
            title: `⚠️ ข้ามรายชื่อซ้ำ ${plan.duplicates.length} ราย`, size: 'md',
            body: `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">รายชื่อเหล่านี้มีอยู่แล้ว ระบบจึงไม่เพิ่มซ้ำ (แถวตามไฟล์ Excel)</div>
              <div class="table-wrap" style="max-height:320px;overflow:auto"><table><thead><tr><th>แถว</th><th>ชื่อ</th><th>เหตุผล</th></tr></thead><tbody>
              ${plan.duplicates.map(d => `<tr><td>${d.row}</td><td>${escHtml(d.name)}</td><td style="font-size:0.75rem">${escHtml(d.reason)}</td></tr>`).join('')}
              </tbody></table></div>`,
          })
        }
        await loadData()
      },
    })
  })
  document.getElementById('cust-search').addEventListener('input', e => { search = e.target.value.trim().toLowerCase(); applyFilter() })
  // พูดแทนพิมพ์ในช่องค้นหา (มือถือ) — แทนที่คำค้นเดิม แล้วกรองทันที
  bindMic(document.getElementById('cust-search-mic'), document.getElementById('cust-search'), { replace: true })
  document.getElementById('cust-sales-filter').addEventListener('change', e => { salesFilter = e.target.value; applyFilter() })
  document.getElementById('cust-source-filter').addEventListener('change', e => { sourceFilter = e.target.value; applyFilter() })
  document.getElementById('cust-sort').addEventListener('change', e => { sortMode = e.target.value; applyFilter() })
  document.getElementById('cust-fu-filter').addEventListener('change', async e => {
    fuFilter = e.target.value
    if ((fuFilter === 'none' || fuFilter === 'late') && !fuStatus) {
      const today = todayBangkok()
      try {
        fuStatus = followupStatusByCustomer(await listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 3000), today)
      } catch { showToast('โหลดนัดติดตามไม่สำเร็จ', 'error'); fuStatus = new Map() }
    }
    applyFilter()
  })
  const pickStat = key => {
    // กดใบที่เลือกอยู่ซ้ำ = กลับไปดูทั้งหมด
    const cur = lostOnly ? '__lost' : stageFilter
    if (key === cur && key !== 'all') key = 'all'
    lostOnly = key === '__lost'
    stageFilter = lostOnly ? 'all' : key
    document.querySelectorAll('.stat-pill').forEach(c => c.classList.toggle('sf-on', c.dataset.s === key))
    applyFilter()
  }
  document.querySelectorAll('.stat-pill').forEach(card => {
    card.addEventListener('click', () => pickStat(card.dataset.s))
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickStat(card.dataset.s) } })
  })

  if (container.__routerGen !== myGen) { unsubCustomers(); return }
  await loadData()

  // Deep-link จากหน้าอื่น (เช่น QuotationBuilder "ดูข้อมูลลูกค้า") — /crm/customers?id=xxx เปิดรายละเอียดลูกค้าคนนั้นทันที
  const deepLinkId = new URLSearchParams(window.location.search).get('id')
  if (deepLinkId) {
    const c = customers.find(x => x.id === deepLinkId)
    autoAiOnce = !!c && new URLSearchParams(window.location.search).get('ai') === '1' && isAiEnabled()
    if (c) openDetail(c)
    else showToast('ไม่พบลูกค้ารายนี้ (อาจถูกลบไปแล้ว)', 'warning')
  }

  return function cleanupCustomers() { unsubCustomers(); offCompanyFilter() }
}

function avatarColor(c) {
  if (c.isLost) return '#6B7280'
  if (c.vip) return '#8B5CF6'
  return { hot: '#EF4444', warm: '#F59E0B', cold: '#06B6D4' }[c.temperature] || { lead: '#06B6D4', pp: '#5B9BFF', booking: '#F59E0B', delivered: '#10B981' }[c.stage] || '#6B7280'
}
function detail(label, value) {
  return `<div style="display:flex;gap:8px;font-size:0.875rem"><span style="color:var(--text-muted);min-width:100px">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}
