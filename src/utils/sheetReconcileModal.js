// (v1.0.747) หน้าจอ "🔄 ซิงก์กับ Sheet" — เลือกไฟล์ DATA Booking ครั้งเดียว แล้วทำให้โปรแกรมตรงกับไฟล์ในคลิกเดียว
// (v1.0.748) รวมการนำเข้าใบจองใหม่/อัปเดตใบจองเดิม (planBookingImport) เข้ามาด้วย เจ้าของบอกว่าต้องกดหลายหน้าเกินไป
// ทุกอย่างติ๊กไว้ให้แล้ว ยกเว้น Lead ที่ยังไม่จอง กติกาการจับคู่อยู่ใน sheetReconcile.js
// - ก่อนแก้ ดาวน์โหลดไฟล์สำรองลูกค้า+ใบจองทั้งหมดให้อัตโนมัติ
// - "ลบ" = soft delete (deleted:true) ติดป้าย deletedBy:'sheet-sync' ไว้ กดกู้คืนจากหน้าจอนี้ได้ภายหลัง
// - ข้อมูลลูกค้าอ่านในเบราว์เซอร์ของคนที่ login อยู่เท่านั้น ไม่ส่งไปที่อื่น
import { listDocs, listAllDocs, createDoc, updateDocData, setDocData } from '../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../core/companyScope.js'
import { showToast, getState } from '../core/store.js'
import { openModal, confirmDialog } from './modal.js'
import { exportMultiSheet } from './importExport.js'
import { todayBangkok } from './format.js'
import { readBookingSheet, planBookingImport, newBookingDoc, newCustomerDoc, companyForBrand, brandCompanyMap } from './bookingImport.js'
import { maybeMarkCustomerDelivered, syncStockForBookings } from './bookingSync.js'
import { planSheetReconcile, customerFullName, normPhone, normPersonName } from './sheetReconcile.js'

export const SYNC_TAG = 'sheet-sync'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CHANGE_TH = { name: 'ชื่อ', phone: 'เบอร์โทร', stage: 'สถานะ → ส่งมอบแล้ว' }
const STAGE_TH = { lead: 'Lead', pp: 'Prospect', booking: 'จองแล้ว', delivered: 'ส่งมอบแล้ว' }

function backupRows(collection, docs) {
  return docs.map(d => ({
    collection, id: d.id,
    name: collection === 'customers' ? customerFullName(d) : (d.custName || ''),
    phone: d.phone || '', bookingNo: d.bookingNo || '', status: d.status || d.stage || '',
    deleted: d.deleted ? 'ใช่' : '',
    json: JSON.stringify(d),
  }))
}

function section(key, title, items, renderItem, { checked = true, hint = '' } = {}) {
  if (!items.length) return ''
  return `
    <details class="srm-sec" style="margin-top:10px;border:1px solid var(--border);border-radius:8px;padding:8px 10px">
      <summary style="cursor:pointer;font-weight:700">${title} <span style="color:var(--text-muted);font-weight:400">(${items.length})</span></summary>
      ${hint ? `<div style="font-size:0.75rem;color:var(--text-muted);margin:4px 0">${hint}</div>` : ''}
      <label style="display:flex;gap:6px;align-items:center;font-size:0.78rem;margin:6px 0"><input type="checkbox" data-all="${key}" ${checked ? 'checked' : ''}> เลือกทั้งหมด</label>
      <div style="max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:4px">
        ${items.map((it, i) => `
          <label style="display:flex;gap:8px;align-items:flex-start;font-size:0.8rem;line-height:1.4;overflow-wrap:anywhere">
            <input type="checkbox" data-sec="${key}" data-i="${i}" ${checked ? 'checked' : ''} style="margin-top:3px;flex-shrink:0">
            <span>${renderItem(it)}</span>
          </label>`).join('')}
      </div>
    </details>`
}

export function openSheetReconcile({ onDone } = {}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xlsx'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    showToast('⏳ กำลังอ่านไฟล์และเทียบกับข้อมูลในโปรแกรม...', 'info')
    const role = getState('role') || getState('user')?.role || 'staff'
    const canNid = ['owner', 'admin', 'manager', 'sales', 'finance'].includes(role)
    let sheet, plan, imp, allBookings, allCustomers, companies = [], vehicles = [], nidMap = {}
    try {
      const mod = await import('exceljs')
      const ExcelJS = mod.default || mod
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      sheet = readBookingSheet(wb)
      ;[allBookings, allCustomers, companies, vehicles, nidMap] = await Promise.all([
        listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 500),
        listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 500),
        listDocs('org_companies', [], 'name', 'asc', 50).then(r => r.filter(c => !c.deleted)).catch(() => []),
        listAllDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 500).then(r => r.filter(v => !v.deleted)).catch(() => []),
        canNid ? listAllDocs('booking_national_ids', companyScopeFilters(), 'updatedAt', 'desc', 500).then(r => Object.fromEntries(r.map(d => [d.id, d.nid]))).catch(() => ({})) : {},
      ])
      plan = planSheetReconcile(sheet.rows, allBookings, allCustomers)
      // นำเข้า/อัปเดตใบจอง: คิดจากสภาพหลังเปลี่ยนเลขใบจองชั่วคราวแล้ว และไม่นับใบที่จะลบ (กันสร้างซ้ำ/อัปเดตใบที่กำลังจะลบ)
      const renum = new Map(plan.renumberBookings.map(r => [r.booking.id, r.patch.bookingNo]))
      const dropIds = new Set(plan.extraBookings.map(x => x.booking.id))
      const learnedMap = brandCompanyMap(allBookings)
      imp = planBookingImport(sheet.rows, allBookings.filter(b => !dropIds.has(b.id)).map(b => renum.has(b.id) ? { ...b, bookingNo: renum.get(b.id) } : b),
        { companyFor: brand => companyForBrand(brand, companies, null, learnedMap) })
    } catch (e) {
      showToast('❌ ' + (e?.message || 'อ่านไฟล์ไม่สำเร็จ'), 'error', 6000)
      return
    }
    const restorable = [
      ...allBookings.filter(b => b.deleted && b.deletedBy === SYNC_TAG).map(d => ({ col: 'bookings', d })),
      ...allCustomers.filter(c => c.deleted && c.deletedBy === SYNC_TAG).map(d => ({ col: 'customers', d })),
    ]
    const { extraBookings, renumberBookings, extraCustomers, leads, customerFixes, missingCustomers, linkOnly } = plan
    const { creates, updates, unchanged } = imp
    const nidTodo = canNid ? [...updates, ...unchanged].filter(x => x.nid && nidMap[x.id] !== x.nid) : []
    const box = (n, label, color) => `<div style="background:var(--surface-2);border-radius:8px;padding:8px 10px;min-width:0"><div style="font-size:1.3rem;font-weight:800;color:${color}">${n}</div><div style="font-size:0.75rem">${label}</div></div>`
    const bkLine = x => `<b>${esc(x.booking.bookingNo || '(ไม่มีเลข)')}</b> · ${esc(x.booking.custName)} ${x.booking.phone ? '· ' + esc(x.booking.phone) : ''} · ${esc(x.booking.status || '')} <span style="color:var(--text-muted)">— ${esc(x.note)}</span>`
    const custLine = x => `<b>${esc(customerFullName(x.customer) || '(ไม่มีชื่อ)')}</b> ${x.customer.phone ? '· ' + esc(x.customer.phone) : ''} · ${esc(STAGE_TH[x.customer.stage] || x.customer.stage || '')} <span style="color:var(--text-muted)">— ${esc(x.note)}</span>`
    const fixLine = f => `<b>${esc(customerFullName(f.customer))}</b> → ${f.changes.map(c => c === 'name' ? `ชื่อ "${esc(f.sheet.custName)}"` : c === 'phone' ? `เบอร์ ${esc(f.sheet.phone)}` : CHANGE_TH[c]).join(', ')} <span style="color:var(--text-muted)">(ใบจอง ${esc(f.sheet.bookingNo || '-')})</span>`
    const missLine = m => `<b>${esc(m.sheet.custName)}</b> ${m.sheet.phone ? '· ' + esc(m.sheet.phone) : ''} · ใบจอง ${esc(m.booking.bookingNo)}`
    const renumLine = r => `${esc(r.booking.bookingNo)} → <b>${esc(r.patch.bookingNo)}</b> · ${esc(r.booking.custName)}`
    const newLine = m => `<b>${esc(m.bookingNo)}</b> · ${esc(m.custName)} ${m.phone ? '· ' + esc(m.phone) : ''} · ${esc(m.status)}`
    const updLine = u => `<b>${esc(u.bookingNo)}</b> · ${esc(u.existing.custName || u.patch.custName || '')} <span style="color:var(--text-muted)">— แก้ ${u.changes.length} ช่อง</span>`
    const leadLine = c => `<b>${esc(customerFullName(c) || '(ไม่มีชื่อ)')}</b> ${c.phone ? '· ' + esc(c.phone) : ''} · ${esc(STAGE_TH[c.stage] || c.stage || 'Lead')} ${c.source ? '· ' + esc(c.source) : ''}`

    const lists = {
      nb: creates, ub: updates, xb: extraBookings, rn: renumberBookings, xc: extraCustomers, fx: customerFixes, mc: missingCustomers,
      ld: leads.map(c => ({ customer: c })),
    }
    const delTotal = extraBookings.length + extraCustomers.length
    const fixTotal = updates.length + renumberBookings.length + customerFixes.length
    const addTotal = creates.length + missingCustomers.length
    const totalTodo = delTotal + fixTotal + addTotal + linkOnly.length + nidTodo.length
    const { el, close } = openModal({
      title: '🔄 ซิงก์ข้อมูลกับ Sheet',
      size: 'lg',
      body: `
        <div style="font-size:0.85rem;line-height:1.6">
          <div>ไฟล์: <b>${esc(file.name)}</b> (${plan.sheetCount} รายการ) · ยึดไฟล์เป็นหลัก</div>
          ${totalTodo ? `
          <div style="margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
            ${box(addTotal, 'จะเพิ่ม', 'var(--success)')}
            ${box(fixTotal, 'จะแก้', 'var(--warning)')}
            ${box(delTotal, 'จะลบ', 'var(--danger)')}
          </div>
          <div style="margin-top:8px;font-size:0.78rem;color:var(--text-muted)">ติ๊กไว้ให้ครบแล้ว กดปุ่มด้านล่างได้เลย · อยากดูหรือเอาบางรายการออก กดเปิดหัวข้อด้านล่าง</div>` : `<div style="margin-top:12px;font-weight:700;color:var(--success)">✅ ข้อมูลในโปรแกรมตรงกับไฟล์แล้ว</div>`}
          ${section('nb', '➕ ใบจองใหม่จากไฟล์', creates, newLine)}
          ${section('ub', '✏️ ใบจองที่ข้อมูลเปลี่ยนในไฟล์', updates, updLine)}
          ${section('rn', '🔢 ใบจองเลขชั่วคราว → เลขจริงจากไฟล์', renumberBookings, renumLine)}
          ${section('xb', '🗑️ ใบจองที่ไม่มีในไฟล์ / ซ้ำ', extraBookings, bkLine)}
          ${section('xc', '🗑️ ลูกค้าที่ไม่มีในไฟล์ / ซ้ำ', extraCustomers, custLine, { hint: 'ลูกค้าซ้ำ: เก็บคนที่ผูกกับใบจองไว้ ลบคนที่ซ้ำ' })}
          ${section('fx', '✏️ ลูกค้าที่ชื่อ/เบอร์/สถานะไม่ตรงไฟล์', customerFixes, fixLine)}
          ${section('mc', '➕ สร้างลูกค้าให้ใบจองที่ยังไม่มีลูกค้า', missingCustomers, missLine)}
          ${section('ld', '🧲 Lead ที่ยังไม่จอง (เก็บไว้ ไม่ลบ)', lists.ld, x => leadLine(x.customer), { checked: false, hint: 'ไฟล์ DATA Booking มีแต่ลูกค้าที่จองแล้ว Lead จึงไม่อยู่ในไฟล์เป็นปกติ จะลบก็ต่อเมื่อติ๊กเอง' })}
          <div style="margin-top:10px;font-size:0.75rem;color:var(--text-muted)">💾 ระบบดาวน์โหลดไฟล์สำรองให้ก่อนแก้ทุกครั้ง · ลบผิดกดกู้คืนได้จากหน้าจอนี้</div>
          ${restorable.length ? `<div style="margin-top:10px;padding:8px 10px;border:1px dashed var(--border);border-radius:8px;font-size:0.8rem">↩️ ลบไปจากการซิงก์ครั้งก่อน ${restorable.length} รายการ <button class="btn btn-ghost btn-sm" id="srm-restore">กู้คืนทั้งหมด</button></div>` : ''}
        </div>`,
      confirmText: totalTodo ? `✅ ซิงก์ให้ตรงกับ Sheet` : 'ปิด',
      onConfirm: async () => {
        if (!totalTodo) return true
        const pick = key => [...el.querySelectorAll(`input[data-sec="${key}"]:checked`)].map(i => lists[key][Number(i.dataset.i)])
        const sel = Object.fromEntries(Object.keys(lists).map(k => [k, pick(k)]))
        try {
          await exportMultiSheet([
            { name: 'customers', data: backupRows('customers', allCustomers) },
            { name: 'bookings', data: backupRows('bookings', allBookings) },
          ], `backup-before-sheet-sync-${todayBangkok()}.xlsx`)
        } catch {
          showToast('❌ สร้างไฟล์สำรองไม่สำเร็จ — ยังไม่ได้แก้อะไร', 'error', 6000)
          return false
        }
        showToast('⏳ กำลังซิงก์... อย่าปิดหน้านี้', 'info', 8000)
        const now = new Date().toISOString()
        const del = { deleted: true, deletedAt: now, deletedBy: SYNC_TAG }
        let done = 0, errors = 0
        const run = async fn => { try { await fn(); done++ } catch { errors++ } }
        const learned = brandCompanyMap(allBookings)
        const deletedCustIds = new Set([...sel.xc, ...sel.ld].map(x => x.customer.id))

        for (const r of sel.rn) await run(() => updateDocData('bookings', r.booking.id, r.patch))
        for (const x of sel.xb) await run(() => updateDocData('bookings', x.booking.id, del))
        for (const x of [...sel.xc, ...sel.ld]) await run(() => updateDocData('customers', x.customer.id, del))
        for (const f of sel.fx) await run(() => updateDocData('customers', f.customer.id, f.patch.stage ? { ...f.patch, stageChangedAt: now } : f.patch))
        for (const l of linkOnly) {
          await run(async () => {
            await updateDocData('bookings', l.booking.id, { customerId: l.customer.id })
            if (!l.customer.bookingId) await updateDocData('customers', l.customer.id, { bookingId: l.booking.id })
          })
        }
        for (const m of sel.mc) {
          await run(async () => {
            const companyId = m.booking.companyId || companyForBrand(m.sheet.brand, companies, myEffectiveCompanyId(), learned)
            const id = await createDoc('customers', { ...newCustomerDoc(m.sheet, { companyId }), bookingId: m.booking.id })
            await updateDocData('bookings', m.booking.id, { customerId: id })
          })
        }
        // ใบจองใหม่: ผูกกับลูกค้าที่มีอยู่แล้วถ้าเบอร์หรือชื่อตรง (ไม่สร้างลูกค้าซ้ำ) ไม่งั้นสร้างลูกค้าใหม่
        const liveCust = allCustomers.filter(c => !c.deleted && !deletedCustIds.has(c.id))
        const custByPhone = new Map(liveCust.filter(c => normPhone(c.phone)).map(c => [normPhone(c.phone), c]))
        const custByName = new Map(liveCust.filter(c => normPersonName(customerFullName(c))).map(c => [normPersonName(customerFullName(c)), c]))
        for (const m of sel.nb) {
          await run(async () => {
            const companyId = companyForBrand(m.brand, companies, myEffectiveCompanyId(), learned)
            let cust = custByPhone.get(normPhone(m.phone)) || custByName.get(normPersonName(m.custName))
            let customerId = cust?.id || null
            if (!customerId && (m.phone || m.custName)) {
              customerId = await createDoc('customers', newCustomerDoc(m, { companyId }))
              cust = { id: customerId, phone: m.phone }
              if (normPhone(m.phone)) custByPhone.set(normPhone(m.phone), cust)
              custByName.set(normPersonName(m.custName), cust)
            }
            const id = await createDoc('bookings', newBookingDoc(m, { companyId, customerId }))
            if (customerId) {
              // ลูกค้าเดิมที่ยังเป็น Lead/Prospect → ขยับเป็นจองแล้ว/ส่งมอบแล้วตามไฟล์
              const want = m.status === 'ส่งมอบแล้ว' ? 'delivered' : m.status === 'ถอนจอง' ? null : 'booking'
              const stagePatch = want && cust?.stage !== want && cust?.stage !== 'delivered' ? { stage: want, stageChangedAt: now } : {}
              await updateDocData('customers', customerId, { bookingId: id, ...stagePatch }).catch(() => {})
            }
            if (canNid && m.nid) await setDocData('booking_national_ids', id, { nid: m.nid, companyId }).catch(() => {})
          })
        }
        for (const u of sel.ub) {
          await run(async () => {
            await updateDocData('bookings', u.id, { ...u.patch, updatedAt: now })
            if (u.patch.status === 'ส่งมอบแล้ว' && u.statusFrom !== 'ส่งมอบแล้ว') await maybeMarkCustomerDelivered(u.existing)
            if (u.patch.companyId && u.existing.customerId) {
              const cust = allCustomers.find(c => c.id === u.existing.customerId)
              if (cust?.importedFromExcel && cust.companyId !== u.patch.companyId) await updateDocData('customers', cust.id, { companyId: u.patch.companyId }).catch(() => {})
            }
          })
        }
        for (const x of nidTodo) {
          const b = allBookings.find(y => y.id === x.id)
          await setDocData('booking_national_ids', x.id, { nid: x.nid, companyId: b?.companyId || myEffectiveCompanyId() }).catch(() => { errors++ })
        }
        // สต็อกรถให้ตรงกับสถานะใบจอง (ส่งมอบแล้ว → ขายแล้ว ฯลฯ)
        const patched = new Map(sel.ub.map(u => [u.id, { ...u.existing, ...u.patch }]))
        const dropped = new Set(sel.xb.map(x => x.booking.id))
        const stock = await syncStockForBookings([...sel.nb, ...allBookings.filter(b => !b.deleted && !dropped.has(b.id)).map(b => patched.get(b.id) || b)], vehicles).catch(() => 0)
        showToast(`✅ ซิงก์กับ Sheet เสร็จ ${done} รายการ${stock ? ` · สต็อก ${stock} คัน` : ''}${errors ? ` · พลาด ${errors}` : ''}`, errors ? 'warning' : 'success', 8000)
        onDone?.()
        return true
      },
    })
    el.querySelectorAll('input[data-all]').forEach(all => all.addEventListener('change', () => {
      el.querySelectorAll(`input[data-sec="${all.dataset.all}"]`).forEach(i => { i.checked = all.checked })
    }))
    el.querySelector('#srm-restore')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'กู้คืนรายการที่ลบ', message: `กู้คืน ${restorable.length} รายการที่ลบจากการซิงก์กับ Sheet ครั้งก่อน?`, confirmText: 'กู้คืน' })
      if (!ok) return
      let done = 0, errors = 0
      for (const { col, d } of restorable) {
        try { await updateDocData(col, d.id, { deleted: false, deletedAt: null, deletedBy: null }); done++ } catch { errors++ }
      }
      showToast(`↩️ กู้คืนแล้ว ${done} รายการ${errors ? ` · พลาด ${errors}` : ''}`, errors ? 'warning' : 'success')
      close()
      onDone?.()
    })
  })
  input.click()
}
