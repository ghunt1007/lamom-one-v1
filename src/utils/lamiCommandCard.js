// การ์ด "🪄 สั่งงาน" ใต้คำสั่งที่พิมพ์ให้ LAMI — กด ✅ ทำเลย ครั้งเดียวจบ (ใช้ทั้งหน้าแชท LAMI และแผง 🤖)
import { runLamiCommand, commandHref } from './lamiCommands.js'
import { escHtml as esc } from './escape.js'

export function commandIntro(cmds) {
  return cmds.length === 1 ? '🪄 เข้าใจว่าให้ทำแบบนี้ครับ — กด ✅ ทำเลย เพื่อยืนยัน' : '🪄 เจอลูกค้าชื่อคล้ายกันหลายคน — เลือกคนที่ใช่ แล้วกด ✅ ทำเลย'
}

// ทำคำสั่งจริง (ใช้ร่วมกัน: การ์ด ✅ ทำเลย และ Enter ใน Ctrl K) — คืนข้อความผลลัพธ์
export async function executeCommand(cmd) {
  const [db, { myEffectiveCompanyId, companyScopeFilters }, { getState }, { followupWindowFilters }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('../core/store.js'), import('./customerFollowups.js'), import('./format.js')])
  const me = getState('user')?.displayName || ''
  const today = todayBangkok()
  const msg = await runLamiCommand({ ...cmd, today }, { me, db, companyId: myEffectiveCompanyId(), followupFilters: [...companyScopeFilters(), ...followupWindowFilters(today)] })
  // ติดต่อแล้วแต่ยังไม่ได้บอกนัดถัดไป → เปิดฟอร์มนัดต่อที่เดาวันให้แล้ว (ลูกค้า Lead/Prospect เท่านั้น)
  if (cmd.kind === 'log' && !cmd.next) import('./addFollowupModal.js').then(m => m.offerNextFollowup(cmd.customer, cmd.contacted ? cmd.text : cmd.text + ' โทรใหม่พรุ่งนี้', { me })).catch(() => {})
  return msg
}

// multi = คำสั่งกลุ่ม (หลายคน): มีปุ่ม "✅ ทำทั้งหมด" · ทำทีละใบได้โดยไม่ปิดใบอื่น · onDone เรียกครั้งเดียวตอนครบทุกใบ
export function mountCommandCard(slot, cmds, { onDone, multi = false } = {}) {
  if (!slot || !cmds?.length) return
  // ปุ่มทำทั้งหมดอยู่ท้ายรายการ (แผง/แชทเลื่อนลงล่างสุดเอง จึงเห็นทันที)
  slot.innerHTML = `<div class="lami-cmds">${cmds.map((c, i) => `
    <div class="lami-cmd" data-i="${i}">
      <div class="lami-cmd-t"><b>${esc(c.label)}</b>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}</div>
      <button type="button" class="btn btn-primary btn-sm lami-cmd-go" data-i="${i}">${c.kind === 'tel' ? '📞 โทรเลย' : c.kind === 'td' ? '🚗 เปิดฟอร์ม' : c.kind === 'lead' ? '➕ เปิดฟอร์ม' : c.kind === 'book' ? '📝 เปิดฟอร์มจอง' : c.kind === 'open' ? '👤 เปิด' : c.kind === 'bk' ? '📝 เปิดใบจอง' : c.kind === 'stage' ? '📝 อัปเดตใบจอง' : '✅ ทำเลย'}</button>
    </div>`).join('')}</div>${multi && cmds.length > 1 ? `<div class="lami-cmds-all"><button type="button" class="btn btn-primary lami-cmd-all">✅ ทำทั้งหมด ${cmds.length} คน</button></div>` : ''}`
  const done = new Set()
  // บันทึกใบที่ i (คำสั่งที่บันทึกได้ทันที) — คืน true ถ้าสำเร็จ
  async function save(i, { quiet = false } = {}) {
    const btn = slot.querySelector(`.lami-cmd-go[data-i="${i}"]`), cmd = cmds[i]
    if (!btn || !cmd || done.has(i)) return false
    btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก…'
    try {
      const msg = await executeCommand(cmd)
      done.add(i)
      btn.closest('.lami-cmd').classList.add('done')
      btn.outerHTML = '<span class="lami-cmd-ok">✓ เรียบร้อย</span>'
      if (!multi) {
        slot.querySelectorAll('.lami-cmd-go').forEach(b => { b.disabled = true })
        const { showToast } = await import('../core/store.js'); showToast(msg, 'success')
        onDone?.(msg, cmd)
      } else if (!quiet) {
        const { showToast } = await import('../core/store.js'); showToast(msg, 'success')
      }
      if (multi && done.size === cmds.length) { slot.querySelector('.lami-cmds-all')?.remove(); onDone?.(`✅ ทำครบ ${cmds.length} รายการแล้ว`, cmd) }
      return true
    } catch (e) {
      btn.disabled = false; btn.textContent = '✅ ทำเลย'
      if (!quiet) import('../core/store.js').then(m => m.showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'))
      return false
    }
  }
  slot.querySelector('.lami-cmd-all')?.addEventListener('click', async e => {
    const all = e.currentTarget
    all.disabled = true; all.textContent = '⏳ กำลังบันทึก…'
    let ok = 0, fail = 0
    for (let i = 0; i < cmds.length; i++) { if (done.has(i)) continue; (await save(i, { quiet: true })) ? ok++ : fail++ }
    const { showToast } = await import('../core/store.js')
    showToast(`✅ บันทึกแล้ว ${ok} รายการ${fail ? ` · ไม่สำเร็จ ${fail} (กดทำเลยทีละใบได้)` : ''}`, fail ? 'warning' : 'success')
    if (fail && all.isConnected) { all.disabled = false; all.textContent = `✅ ทำที่เหลือ ${cmds.length - done.size} คน` }
  })
  slot.querySelectorAll('.lami-cmd-go').forEach(btn => btn.addEventListener('click', async () => {
    const cmd = cmds[+btn.dataset.i]
    if (!cmd) return
    if (cmd.kind === 'tel') {
      import('./callLogger.js').then(m => m.armCallLog?.(cmd.customer)).catch(() => {})
      location.href = 'tel:' + cmd.phone; return
    }
    const href = commandHref(cmd)
    if (href) {
      const [{ navigate }, panel] = await Promise.all([import('../core/router.js'), import('./lamiPanel.js')])
      panel.closeLamiPanel?.()
      navigate(href); return
    }
    if (cmd.kind === 'lead') {
      const { openQuickLead } = await import('./quickLead.js')
      openQuickLead({ pasteText: cmd.text, name: cmd.name }); return
    }
    if (cmd.kind === 'td') {
      const { openTestDriveForm } = await import('./testDriveForm.js')
      openTestDriveForm(cmd.customer, { hint: cmd.hint || '' }); return
    }
    await save(+btn.dataset.i)
  }))
}

// (v1.0.1039) คำสั่งกลุ่ม "นัดลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง" → null ถ้าไม่ใช่ · คืน { cmds, intro }
export async function loadBulkCommands(q, customersPromise) {
  const bulk = await import('./bulkCommands.js')
  const { todayBangkok } = await import('./format.js')
  const today = todayBangkok()
  const spec = bulk.parseBulkSpec(q, today)
  if (!spec) return null
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js')])
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  const res = bulk.bulkTargets({ customers, followups, today, spec })
  return { cmds: bulk.bulkCommands(res.list, spec), intro: bulk.bulkIntro(spec, res) }
}

// (v1.0.1045) ถามหารายชื่อ "ลูกค้า hot มีใครบ้าง" → null ถ้าไม่ใช่ · คืน { cmds, intro, next }
export async function loadListCommands(q, customersPromise) {
  const lq = await import('./listQuestions.js')
  const spec = lq.parseListSpec(q)
  if (!spec) return null
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  const res = lq.listTargets({ customers, followups, today, spec })
  return { cmds: lq.listCommands(res.list), intro: lq.listIntro(spec, res), next: lq.listFollowUp(spec, res) }
}

// (v1.0.1046) ถามหาใบจอง "ใครรอไฟแนนซ์ / ใครยังไม่นัดส่งมอบ / ใบจองไหนค้างนานสุด" → null ถ้าไม่ใช่ · คืน { cmds, intro }
// เห็นเฉพาะใบจองของลูกค้าที่ผู้ใช้มองเห็น (สิทธิ์เดียวกับรายชื่อลูกค้า)
export async function loadBookingListCommands(q, customersPromise) {
  const bq = await import('./bookingQuestions.js')
  const spec = bq.parseBookingListSpec(q)
  if (!spec) return null
  const [{ listAllDocs }, { companyScopeFilters }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('./format.js')])
  const [customers, bookings] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
  ])
  const res = bq.bookingTargets({ customers, bookings, today: todayBangkok(), spec })
  return { cmds: bq.bookingListCommands(res.list), intro: bq.bookingListIntro(spec, res) }
}

// (v1.0.1048) ถามถึงลูกค้าคนเดียว "สมชายถึงไหนแล้ว / สรุปมานี" → null ถ้าไม่ใช่ · คืน { text, cmds, customer, chips }
export async function loadCustomerBrief(q, customersPromise) {
  const cb = await import('./customerBrief.js')
  const customers = await (customersPromise || visibleCustomersForCommands())
  const c = cb.briefTarget(q, customers)
  if (!c) return null
  const [{ listDocs, readDoc }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }, { quickChips }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js'), import('./lamiCommands.js')])
  const today = todayBangkok()
  const [followups, booking, drives] = await Promise.all([
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
    c.bookingId ? readDoc('bookings', c.bookingId).catch(() => null)
      : listDocs('bookings', [...companyScopeFilters(), ['customerId', '==', c.id]], 'createdAt', 'desc', 3).then(r => r.find(b => !b.deleted) || null).catch(() => null), // (v1.0.1101) ใบจองที่ผูกด้วย customerId
    listDocs('test_drives', companyScopeFilters(), 'date', 'desc', 1000).catch(() => null),
  ])
  return { text: cb.customerBrief({ customer: c, followups, booking: booking && !booking.deleted ? booking : null, today, drives }), cmds: cb.briefCommands(c), customer: c, chips: quickChips(c).filter(x => !/\s$/.test(x)) }
}

// (v1.0.1049) "วันนี้มีอะไรบ้าง / สรุปวันนี้" → null ถ้าไม่ใช่ · คืน { text, next: [ประโยคถามต่อ] }
export async function loadTodayBrief(q, customersPromise) {
  const tb = await import('./todayBrief.js')
  if (!tb.isTodayQuestion(q)) return null
  const [{ listDocs, listAllDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok, addDaysBangkok, dmy }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups, bookings] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
  ])
  const st = tb.todayStats({ customers, followups, bookings, today, tomorrow: addDaysBangkok(1) })
  return { text: tb.todayBriefText(st, dmy(today)), next: tb.todayFollowUps(st) }
}

// (v1.0.1059) "พรุ่งนี้มีอะไรบ้าง / สัปดาห์นี้มีอะไรบ้าง" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadAheadBrief(q, customersPromise) {
  const ab = await import('./aheadBrief.js')
  const spec = ab.parseAheadSpec(q)
  if (!spec) return null
  const [{ listDocs, listAllDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups, bookings] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
  ])
  const st = ab.aheadStats({ customers, followups, bookings, today, mode: spec.mode })
  return { text: ab.aheadBriefText(st), next: ab.aheadFollowUps(st), go: { path: '/calendar', label: '🗓️ เปิดปฏิทินงาน' } }
}

// (v1.0.1051) "ยอดเดือนนี้เป็นไง / ถึงเป้าหรือยัง / ใครขายดีสุด" → null ถ้าไม่ใช่ · คืน { text, next }
// นับเฉพาะใบจองของเซลส์ที่ผู้ใช้มองเห็น (ตัวเอง + ลูกทีม · แอดมิน/เจ้าของ = ทั้งโชว์รูม)
export async function loadMonthBrief(q) {
  const mb = await import('./monthBrief.js')
  const past = mb.isPrevMonthQuestion(q)
  const per = !past ? mb.periodSpec(q) : null
  if (!past && !per && !mb.isMonthQuestion(q)) return null
  const [{ listAllDocs, readDoc }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord, normName }, { todayBangkok }, { SALES_TARGETS_COLLECTION }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js'), import('./format.js'), import('./salesTargets.js')])
  const today = past ? mb.prevMonthEnd(todayBangkok()) : todayBangkok()
  const [all, vis, tdoc] = await Promise.all([
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
    getVisibilityScope().catch(() => null),
    readDoc(SALES_TARGETS_COLLECTION, today.slice(0, 7)).catch(() => null),
  ])
  if (!vis) return null
  const whole = !!(vis.unrestricted || vis.companyOnly)
  let bookings = all.filter(b => !b.deleted && scopeIncludesRecord(vis, b.salesName, b))
  // (v1.0.1088) ถามยอดของเซลส์รายคน (เฉพาะคนที่ผู้ถามมองเห็นอยู่แล้ว)
  const seller = mb.findSeller(q, bookings.map(b => b.salesName))
  if (seller) bookings = bookings.filter(b => normName(b.salesName) === normName(seller))
  const target = Object.entries(tdoc?.targets || {}).reduce((s, [n, v]) => s + ((seller ? normName(n) === normName(seller) : whole || vis.names?.has(normName(n))) ? Number(v) || 0 : 0), 0)
  const scopeLabel = seller ? `👤 ${seller}` : whole ? 'ทั้งโชว์รูม' : vis.hasSubordinates ? 'คุณและทีม' : 'ของคุณ'
  if (per) return { text: mb.periodBriefText(mb.periodStats({ bookings, today, period: per.period, prev: per.prev }), { scope: scopeLabel, colors: mb.isColorRankQuestion(q) }), next: ['ยอดเดือนนี้เป็นไง', per.period === 'year' ? 'ยอดไตรมาสนี้' : 'ปีนี้ขายได้กี่คัน', 'รถรุ่นไหนขายดีสุดเดือนนี้'] }
  const st = mb.monthStats({ bookings, today, target })
  if (past) return { text: mb.monthBriefText(st, { scope: scopeLabel, past: true, models: mb.isModelRankQuestion(q), colors: mb.isColorRankQuestion(q) }), next: ['ยอดเดือนนี้เป็นไง', 'ค่าคอมเดือนก่อนเท่าไหร่', 'ลูกค้าเสียดีลเดือนก่อนมีใครบ้าง'] }
  return { text: mb.monthBriefText(st, { scope: scopeLabel, models: mb.isModelRankQuestion(q), colors: mb.isColorRankQuestion(q) }), next: mb.monthFollowUps(st) }
}

// (v1.0.1058) "ค่าคอมเดือนนี้เท่าไหร่ / รายได้เดือนก่อน" → null ถ้าไม่ใช่ · คืน { text, next, go } · ขอบเขตเดียวกับหน้ารายได้รายเซลส์
export async function loadIncomeBrief(q) {
  const ib = await import('./incomeBrief.js')
  if (!ib.isIncomeQuestion(q)) return null
  const [{ listAllDocs }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js'), import('./format.js')])
  const [all, vis] = await Promise.all([
    listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc').catch(() => []),
    getVisibilityScope().catch(() => null),
  ])
  if (!vis) return null
  const whole = !!(vis.unrestricted || vis.companyOnly)
  let rows = all.filter(b => !b.deleted && scopeIncludesRecord(vis, b.salesName, b))
  // (v1.0.1091) "ค่าคอมของสมชายเดือนนี้" → เฉพาะเซลส์คนนั้น (ต้องอยู่ในขอบเขตที่มองเห็น)
  const { findSeller } = await import('./monthBrief.js')
  const seller = findSeller(q, rows.map(b => b.salesName))
  if (seller) rows = rows.filter(b => String(b.salesName || '').trim() === seller)
  const st = ib.incomeStats({ bookings: rows, today: todayBangkok(), prev: ib.wantsPrevMonth(q) })
  return { seller, text: ib.incomeBriefText(st, { scope: seller ? '👤 ' + seller : whole ? 'ทั้งโชว์รูม' : vis.hasSubordinates ? 'คุณและทีม' : 'ของคุณ' }), next: ib.incomeFollowUps(st), go: { path: '/crm/sales-income', label: '💰 เปิดหน้ารายได้รายเซลส์' } }
}

// (v1.0.1053) "S07 สีขาวมีไหม / มีรถอะไรพร้อมขาย / รถค้างสต็อกนานมีคันไหน" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadStockAnswer(q) {
  const sq = await import('./stockQuestions.js')
  if (!sq.maybeStockQuestion(q)) return null
  const [{ listDocs }, { companyScopeFilters }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('./format.js')])
  const vehicles = await listDocs('vehicles', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => [])
  const spec = sq.parseStockSpec(q, vehicles)
  if (!spec) return null
  const res = sq.stockAnswer({ vehicles, spec, today: todayBangkok() })
  return { text: res.text, next: res.next, copy: res.copy, go: { path: '/dms/stock' + (res.query ? '?q=' + encodeURIComponent(res.query) : ''), label: '🚙 เปิดหน้าสต็อก' } }
}

// (v1.0.1054) "S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่ / ผ่อน AION V เดือนละเท่าไหร่" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadPayAnswer(q) {
  const pq = await import('./payQuestions.js')
  if (!pq.maybePayQuestion(q)) return null
  const { getVehicles } = await import('../data/vehicleDatabase.js')
  const spec = pq.parsePaySpec(q, getVehicles())
  if (!spec) return null
  return { text: pq.payAnswer(spec), copy: pq.payCustomerText(spec), next: pq.payFollowUps(spec), go: { path: '/finance/loan-calc?' + pq.loanCalcQuery(spec), label: '🧮 เทียบไฟแนนซ์ด้วยเงื่อนไขนี้' } }
}

// (v1.0.1073) "ใบเสนอราคาค้างอยู่กี่ใบ / ใบไหนใกล้หมดอายุ" → null ถ้าไม่ใช่ · คืน { text, next, go } · ขอบเขตเดียวกับหน้าใบเสนอราคา
export async function loadQuoteAnswer(q) {
  const qq = await import('./quoteQuestions.js')
  const spec = qq.parseQuoteSpec(q)
  if (!spec) return null
  const [{ listDocs }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js'), import('./format.js')])
  const [all, vis] = await Promise.all([
    listDocs('quotations', companyScopeFilters(), 'createdDate', 'desc', 500).catch(() => []),
    getVisibilityScope().catch(() => null),
  ])
  if (!vis) return null
  const st = qq.quoteStats({ quotes: all.filter(r => !r.deleted && scopeIncludesRecord(vis, r.salesperson, r)), today: todayBangkok() })
  const status = qq.quotePageQuery(st, spec)
  return { text: qq.quoteBriefText(st, spec), next: qq.quoteFollowUps(st, spec), go: { path: '/crm/quotation' + (status ? '?status=' + status : ''), label: '📄 เปิดหน้าใบเสนอราคา' } }
}

// (v1.0.1079) "นัดทดลองขับวันนี้มีใครบ้าง / LINE รอตอบไหม / ร้องเรียนค้างไหม / ลูกค้าใหม่เดือนนี้กี่คน / ครบรอบซื้อรถ" → null ถ้าไม่ใช่
// ขอบเขต: เซลส์เห็นของตัวเอง/ลูกทีม (ตามผู้ดูแล) · หัวหน้า/เจ้าของเห็นทั้งโชว์รูม
export async function loadOpsAnswer(q, customersPromise) {
  const oq = await import('./opsQuestions.js')
  const spec = oq.parseOpsSpec(q)
  if (!spec) return null
  const [{ listDocs, listAllDocs }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord }, { todayBangkok }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js'), import('./format.js')])
  const today = todayBangkok()
  const f = companyScopeFilters()
  const vis = await getVisibilityScope().catch(() => null)
  if (!vis) return null
  const mine = (name, rec) => scopeIncludesRecord(vis, name, rec)
  let res
  if (spec.kind === 'tdnobook') {
    const [drives, bks] = await Promise.all([listDocs('test_drives', f, 'date', 'desc', 500).catch(() => []), listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])])
    res = oq.tdNoBookAnswer(drives.filter(t => mine(t.staff, t)), bks, { today, range: spec.range })
  } else if (spec.kind === 'testdrive') res = oq.testDriveAnswer((await listDocs('test_drives', f, 'date', 'desc', 300).catch(() => [])).filter(t => mine(t.staff, t)), { today, day: spec.day })
  else if (spec.kind === 'showroom') res = oq.showroomAnswer((await listDocs('appointments', f, 'date', 'desc', 300).catch(() => [])).filter(a => mine(a.salesperson, a)), { today, day: spec.day })
  else if (spec.kind === 'complaint') res = oq.complaintAnswer(await listDocs('complaints', f, 'createdAt', 'desc', 300).catch(() => []), { today })
  else if (spec.kind === 'line') {
    const [threads, customers] = await Promise.all([listDocs('social_threads', [], 'lastAt', 'desc', 300).catch(() => []), customersPromise || visibleCustomersForCommands()])
    const mineIds = new Set((customers || []).filter(c => mine(c.assignedTo, c)).map(c => c.lineUserId).filter(Boolean))
    const whole = !!(vis.unrestricted || vis.companyOnly)
    res = oq.lineWaitingAnswer(threads.filter(t => whole || mineIds.has(t.userId)), customers || [])
  } else if (spec.kind === 'newcust') {
    const [{ QUICK_SOURCES }, customers] = await Promise.all([import('./quickLead.js'), customersPromise || visibleCustomersForCommands()])
    res = oq.newCustomerAnswer((customers || []).filter(c => mine(c.assignedTo, c)), { today, period: spec.period, source: spec.source, sourceLabel: { event: '🎪 ออกบูธ/อีเวนต์', ...Object.fromEntries(QUICK_SOURCES) } })
  } else if (spec.kind === 'lost') {
    const customers = await (customersPromise || visibleCustomersForCommands())
    res = oq.lostAnswer((customers || []).filter(c => mine(c.assignedTo, c)), { today, prev: spec.prev })
  } else if (spec.kind === 'claim') {
    res = oq.claimAnswer(await listDocs('insurance_claims', [], 'reported', 'desc', 300).catch(() => []), { today })
  } else if (spec.kind === 'parts') {
    res = oq.partsLowAnswer(await listDocs('parts', f, 'name', 'asc', 1000).catch(() => []))
  } else if (spec.kind === 'servicerev') {
    res = oq.serviceRevAnswer(await listDocs('job_cards', f, 'createdAt', 'desc', 1000).catch(() => []), { today, prev: spec.prev })
  } else if (spec.kind === 'yesterday') {
    const [customers, bks, walkins, drives] = await Promise.all([customersPromise || visibleCustomersForCommands(), listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => []), listDocs('walk_ins', [], 'visitTime', 'desc', 300).catch(() => []), listDocs('test_drives', f, 'date', 'desc', 300).catch(() => [])])
    res = oq.yesterdayAnswer({ customers: (customers || []).filter(c => mine(c.assignedTo, c)), bookings: bks.filter(b => mine(b.salesName, b)), walkins: walkins.filter(w => mine(w.staff, w)), drives: drives.filter(t => mine(t.staff, t)) }, { today })
  } else if (spec.kind === 'referask') {
    const [bks, comps] = await Promise.all([listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => []), listDocs('complaints', f, 'createdAt', 'desc', 300).catch(() => [])])
    const complainedNames = new Set(comps.map(c => String(c.customerName || c.customer || c.name || '').replace(/\s+/g, '')).filter(Boolean))
    res = oq.referAskAnswer(bks.filter(b => mine(b.salesName, b)), { today, complainedNames })
  } else if (spec.kind === 'eventbest') {
    const [{ eventMetrics }, events, customers, bks, drives] = await Promise.all([import('./marketingEvents.js'), listDocs('marketing_events', [], 'startDate', 'desc', 300).catch(() => []), listDocs('customers', f, 'createdAt', 'desc', 3000).catch(() => []), listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => []), listDocs('test_drives', f, 'date', 'desc', 1000).catch(() => [])])
    res = oq.eventBestAnswer(events, e => eventMetrics(e, { customers, bookings: bks, testDrives: drives }), { today })
  } else if (spec.kind === 'campaignbest') {
    res = oq.campaignBestAnswer((await listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])).filter(b => mine(b.salesName, b)), { today })
  } else if (spec.kind === 'csat') {
    res = oq.csatAnswer(await listDocs('csat', [], 'createdAt', 'desc', 500).catch(() => []), { today, prev: spec.prev, low: spec.low })
  } else if (spec.kind === 'expense' || spec.kind === 'profit') {
    if (!(vis.unrestricted || vis.companyOnly)) res = { n: 0, text: '🔒 ตัวเลขกำไร/ค่าใช้จ่ายของโชว์รูมดูได้เฉพาะผู้จัดการและเจ้าของ — ถามค่าคอมของตัวเองได้ เช่น "ค่าคอมเดือนนี้เท่าไหร่"' }
    else {
      const [{ opexEntries }, { saleCost }, { getSalesData }, claims, petty] = await Promise.all([import('./opex.js'), import('./saleCost.js'), import('../core/db.js'),
        listDocs('expense_claims', f, 'date', 'desc', 2000).catch(() => []), listDocs('petty_cash', f, 'time', 'desc', 2000).catch(() => [])])
      const sales = spec.kind === 'profit' ? await getSalesData().catch(() => []) : []
      res = oq.moneyMonthAnswer({ sales, opex: opexEntries(claims, petty), today, prev: spec.prev, kind: spec.kind, saleCost })
    }
  } else if (spec.kind === 'leave') {
    const whole = !!(vis.unrestricted || vis.companyOnly)
    if (!whole && !vis.hasSubordinates) res = { n: 0, text: '👥 ข้อมูลการลาของพนักงานดูได้เฉพาะหัวหน้าทีมและผู้จัดการ — เปิดหน้าการลาเพื่อดูของตัวเอง' }
    else { const rows = await listDocs('leave_requests', f, 'from', 'desc', 500).catch(() => []); res = oq.leaveAnswer(whole ? rows : rows.filter(r => mine(r.staff, r)), { today, day: spec.day }) }
  } else if (spec.kind === 'incoming') {
    const [vs, ords] = await Promise.all([listDocs('vehicles', f, 'createdAt', 'desc', 3000).catch(() => []), listDocs('vehicle_orders', f, 'createdAt', 'desc', 500).catch(() => [])])
    res = oq.incomingAnswer(vs, ords, { today })
  } else if (spec.kind === 'lowstock') {
    const [vs, bks] = await Promise.all([listDocs('vehicles', f, 'createdAt', 'desc', 3000).catch(() => []), listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])])
    res = oq.lowStockAnswer(vs, bks)
  } else if (spec.kind === 'noanswer') {
    const [customers, logs, fus] = await Promise.all([customersPromise || visibleCustomersForCommands(), listDocs('comm_logs', f, 'createdAt', 'desc', 1000).catch(() => []), listDocs('followups', f, 'dueDate', 'desc', 2000).catch(() => [])])
    res = oq.noAnswerAnswer((customers || []).filter(c => mine(c.assignedTo, c)), logs, fus, { today })
  } else if (spec.kind === 'hotbyseller') {
    res = oq.hotBySellerAnswer(((await (customersPromise || visibleCustomersForCommands())) || []).filter(c => mine(c.assignedTo, c)))
  } else if (spec.kind === 'pdi') {
    res = oq.pdiAnswer(await listDocs('pdi', f, 'startDate', 'desc', 300).catch(() => []), { today })
  } else if (spec.kind === 'stale') {
    res = oq.staleProspectAnswer(((await (customersPromise || visibleCustomersForCommands())) || []).filter(c => mine(c.assignedTo, c)), { today })
  } else if (spec.kind === 'tradein') {
    res = oq.tradeInAnswer(await listDocs('trade_ins', f, 'date', 'desc', 300).catch(() => []), { today })
  } else if (spec.kind === 'closerate') {
    const [customers, bks] = await Promise.all([customersPromise || visibleCustomersForCommands(), listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])])
    res = oq.closeRateAnswer((customers || []).filter(c => mine(c.assignedTo, c)), bks.filter(b => mine(b.salesName, b)), { today, prev: spec.prev })
  } else if (spec.kind === 'noquote') {
    const [customers, quotes] = await Promise.all([customersPromise || visibleCustomersForCommands(), listDocs('quotations', f, 'createdDate', 'desc', 3000).catch(() => [])])
    res = oq.noQuoteAnswer((customers || []).filter(c => mine(c.assignedTo, c)), quotes)
  } else if (spec.kind === 'bookmodel') {
    res = oq.bookingsByModelAnswer((await listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])).filter(b => mine(b.salesName, b)), { today, model: spec.model, period: spec.period })
  } else if (spec.kind === 'notd') {
    const [customers, drives] = await Promise.all([customersPromise || visibleCustomersForCommands(), listDocs('test_drives', f, 'date', 'desc', 2000).catch(() => [])])
    res = oq.noTestDriveAnswer((customers || []).filter(c => mine(c.assignedTo, c)), drives)
  } else if (spec.kind === 'mycust' || spec.kind === 'nophone' || spec.kind === 'topscore') {
    const customers = ((await (customersPromise || visibleCustomersForCommands())) || []).filter(c => mine(c.assignedTo, c))
    if (spec.kind === 'topscore') { const { heuristicScore } = await import('./leadScore.js'); res = oq.topScoreAnswer(customers, { scoreOf: c => heuristicScore(c) }) }
    else res = spec.kind === 'mycust' ? oq.myCustomersAnswer(customers, { today }) : oq.noPhoneAnswer(customers)
  } else if (spec.kind === 'delivered') {
    res = oq.deliveredAnswer((await listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])).filter(b => mine(b.salesName, b)), { today, period: spec.period })
  } else if (spec.kind === 'withdrawn' || spec.kind === 'finbank') {
    const bks = (await listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])).filter(b => mine(b.salesName, b))
    res = spec.kind === 'withdrawn' ? oq.withdrawnAnswer(bks, { today, prev: spec.prev }) : oq.finBankAnswer(bks, { today })
  } else if (spec.kind === 'noshow') {
    const [appts, drives] = await Promise.all([listDocs('appointments', f, 'date', 'desc', 500).catch(() => []), listDocs('test_drives', f, 'date', 'desc', 500).catch(() => [])])
    res = oq.noShowAnswer(appts.filter(a => mine(a.salesperson, a)), drives.filter(t => mine(t.staff, t)), { today, range: spec.range })
  } else if (spec.kind === 'nobookseller') {
    const [{ getSalesStaff }, customers, bks] = await Promise.all([import('../data/masterData.js'), customersPromise || visibleCustomersForCommands(), listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])])
    const whole = !!(vis.unrestricted || vis.companyOnly)
    let staff = []; try { staff = whole ? (getSalesStaff() || []) : [] } catch {}
    res = oq.noBookSellerAnswer({ sellers: staff, customers: (customers || []).filter(c => mine(c.assignedTo, c)), bookings: bks.filter(b => mine(b.salesName, b)), today })
  } else if (spec.kind === 'bookday') {
    res = oq.bookDayAnswer((await listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])).filter(b => mine(b.salesName, b)), { today, day: spec.day })
  } else if (spec.kind === 'delivery' || spec.kind === 'income') {
    const bks = (await listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])).filter(b => mine(b.salesName, b))
    res = spec.kind === 'delivery' ? oq.deliveryAnswer(bks, { today, day: spec.day }) : oq.incomeMissingAnswer(bks, { today })
  } else if (spec.kind === 'walkin') {
    res = oq.walkinAnswer((await listDocs('walk_ins', [], 'visitTime', 'desc', 500).catch(() => [])).filter(w => mine(w.staff, w)), { today, day: spec.day })
  } else if (spec.kind === 'insurance') {
    res = oq.insuranceAnswer(await listDocs('insurance_renewals', [], 'expiryDate', 'asc', 500).catch(() => []), { today, range: spec.range })
  } else if (spec.kind === 'warranty') {
    const { loadWarranties } = await import('../pages/service/WarrantyManagement.js')
    res = oq.warrantyAnswer(await loadWarranties().catch(() => []), { today, range: spec.range })
  } else if (spec.kind === 'reminder') {
    res = oq.reminderAnswer(await listDocs('service_reminders', [], 'dueDate', 'asc', 500).catch(() => []), { today, range: spec.range })
  } else if (spec.kind === 'overdue') {
    const [{ buildWorkItems, KINDS }, { followupWindowFilters }] = await Promise.all([import('./workCalendar.js'), import('./customerFollowups.js')])
    const g = (col, filters, sort) => listDocs(col, filters, sort, 'desc', 1000).catch(() => [])
    const [bookings, appointments, testDrives, followups, serviceAppts, tasks] = await Promise.all([
      listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => []), g('appointments', f, 'date'), g('test_drives', f, 'date'),
      listDocs('followups', [...f, ...followupWindowFilters(today)], 'dueDate', 'asc', 3000).catch(() => []), g('service_appointments', f, 'date'), g('tasks', f, 'dueDate')])
    const items = buildWorkItems({ bookings, appointments, testDrives, followups, serviceAppts, tasks }, today).filter(it => it.shared || mine(it.owner, it.rec))
    res = oq.overdueAnswer(items, { today, labels: KINDS })
  } else if (spec.kind === 'service') {
    const [ap, jobs] = await Promise.all([listDocs('service_appointments', f, 'date', 'desc', 300).catch(() => []), listDocs('job_cards', f, 'createdAt', 'desc', 500).catch(() => [])])
    res = oq.serviceAnswer(ap.filter(a => mine(a.tech, a)), jobs.filter(j => mine(j.techName, j)), { today, day: spec.day })
  } else if (spec.kind === 'unassigned') {
    // ลูกค้าในขอบเขตที่มองเห็นอยู่แล้ว (ไม่กรองตามผู้ดูแล เพราะคำถามคือคนที่ยังไม่มีผู้ดูแล)
    res = oq.unassignedAnswer(await (customersPromise || visibleCustomersForCommands()) || [])
  } else if (spec.kind === 'anniv') res = oq.annivAnswer((await listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => [])).filter(b => mine(b.salesName, b)), { today, range: spec.range, asked: q, nextMonth: !!spec.nextMonth })
  if (!res) return null
  return { text: res.text, next: oq.opsFollowUps(spec), go: oq.OPS_LINKS[spec.kind] }
}

// (v1.0.1070) "รถไฟฟ้าไม่เกิน 1 ล้าน / SUV 7 ที่นั่ง งบ 1.2 ล้าน" → null ถ้าไม่ใช่ · คืน { text, next, go, copy }
export async function loadCarPick(q) {
  const cp = await import('./carPick.js')
  if (!cp.maybeCarPick(q)) return null
  const spec = cp.parseCarPick(q)
  if (!spec) return null
  const { getVehicles, dealerRank, DEALER_BRANDS } = await import('../data/vehicleDatabase.js')
  const res = cp.carPick(spec, getVehicles(), { dealerRank, dealerCount: DEALER_BRANDS.length })
  const ids = res.top.slice(0, 3).map(g => g.vs[0].id).filter(Boolean)
  return { text: res.text, next: res.next, copy: res.copy || undefined, go: ids.length >= 2 ? { path: '/dms/compare?ids=' + encodeURIComponent(ids.join(',')), label: '⚖️ เทียบรุ่นที่แนะนำ' } : { path: '/dms/vehicle-db', label: '🚗 เปิดฐานข้อมูลรถ' } }
}

// (v1.0.1069) "โปรเดือนนี้มีอะไรบ้าง / S07 มีโปรอะไร / โปรไหนใกล้หมด" → null ถ้าไม่ใช่ · คืน { text, next, go, copy }
export async function loadPromoAnswer(q) {
  const pq = await import('./promoQuestions.js')
  if (!pq.maybePromoQuestion(q)) return null
  const [{ listDocs }, { getVehicles }, { normalizeProgram }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../data/vehicleDatabase.js'), import('./salesPrograms.js'), import('./format.js')])
  const spec = pq.parsePromoSpec(q, getVehicles())
  if (!spec) return null
  const programs = (await listDocs('sales_programs', [], 'dateFrom', 'desc', 1000).catch(() => [])).filter(r => !r.deleted).map(r => ({ ...normalizeProgram(r), id: r.id }))
  const res = pq.promoAnswer({ programs, spec, today: todayBangkok() })
  return { text: res.text, next: res.next, copy: res.copy || undefined, go: { path: '/crm/programs', label: '🎁 เปิดหน้าแคมเปญ & อัตรา' } }
}

// (v1.0.1068) "ราคา AION V เท่าไหร่ / S07 วิ่งได้กี่กิโล / เทียบ AION V กับ S07" → null ถ้าไม่ใช่ · คืน { text, next, go, copy }
export async function loadModelAnswer(q) {
  const mq = await import('./modelQuestions.js')
  if (!mq.maybeModelQuestion(q)) return null
  const { getVehicles } = await import('../data/vehicleDatabase.js')
  const vehicles = getVehicles()
  const spec = mq.parseModelSpec(q, vehicles)
  if (!spec) return null
  const res = mq.modelAnswer(spec, vehicles)
  if (!res) return null
  const go = spec.mode === 'compare'
    ? { path: '/dms/compare?ids=' + encodeURIComponent(res.ids.join(',')), label: '⚖️ เปิดหน้าเปรียบเทียบเต็ม' }
    : { path: '/dms/vehicle-db?q=' + encodeURIComponent(res.query), label: '🚗 เปิดข้อมูลรุ่นนี้' }
  // (v1.0.1071) ถามราคารุ่นเดียว → ทำใบเสนอราคารุ่นนี้ได้ในแตะเดียว
  const go2 = spec.mode === 'info' && res.vehicleId ? { path: '/crm/quotation?vehicle=' + encodeURIComponent(res.vehicleId), label: '📄 ทำใบเสนอราคารุ่นนี้' } : undefined
  return { text: res.text, next: res.next, copy: res.copy || undefined, go, go2 }
}

// (v1.0.1056) "ทีมวันนี้เป็นไง / ใครมีนัดค้างเยอะสุด" → null ถ้าไม่ใช่ · คืน { text, next, go }
export async function loadTeamBrief(q, customersPromise) {
  const tm = await import('./teamBrief.js')
  if (!tm.isTeamQuestion(q)) return null
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok, dmy }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js')])
  const today = todayBangkok()
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  const st = tm.teamStats({ customers, followups, today })
  return { text: tm.teamBriefText(st, dmy(today)), next: tm.teamFollowUps(st), go: { path: '/crm/followup', label: '📞 เปิดหน้าติดตามลูกค้า' } }
}

// (v1.0.1035) "วันนี้ควรโทรหาใคร" → รายชื่อพร้อมปุ่มโทร (ลูกค้าที่ผู้ใช้เห็นเท่านั้น)
export async function loadCallListCommands(customersPromise) {
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }, { callList, callListCommands }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js'), import('./callList.js')])
  const today = todayBangkok()
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  return callListCommands(callList({ customers, followups, today }))
}
export function callListIntro(cmds) {
  return cmds.length ? `📞 วันนี้ควรโทร ${cmds.length} คนนี้ก่อน (เรียงจากเร่งด่วนที่สุด) — กดโทรได้เลย วางสายแล้วระบบถามผลให้บันทึก` : '🎉 วันนี้ไม่มีนัดค้างหรือลูกค้า Hot/Warm ที่เงียบนาน — ลองดูลูกค้าใหม่ในหน้า Lead'
}

// ลูกค้าที่ผู้ใช้คนนี้มองเห็น (ตามสิทธิ์เดียวกับหน้าแชท) — ใช้จับชื่อในคำสั่ง
export async function visibleCustomersForCommands() {
  const [{ listDocs }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js')])
  const [rows, vis] = await Promise.all([
    listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
    getVisibilityScope().catch(() => null),
  ])
  return rows.filter(c => !c.deleted && !!vis && (vis.unrestricted || vis.companyOnly || scopeIncludesRecord(vis, c.assignedTo, c)))
}
