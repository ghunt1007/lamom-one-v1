// (v1.0.747) หน้าจอ "🔍 เทียบกับ Sheet" — เลือกไฟล์ DATA Booking แล้วแสดงสิ่งที่โปรแกรมมีเกิน/ไม่ตรงกับไฟล์
// ให้เจ้าของติ๊กเลือกก่อนแก้ทุกครั้ง กติกาการจับคู่อยู่ใน sheetReconcile.js
// - ก่อนแก้ ดาวน์โหลดไฟล์สำรองลูกค้า+ใบจองทั้งหมดให้อัตโนมัติ
// - "ลบ" = soft delete (deleted:true) ติดป้าย deletedBy:'sheet-sync' ไว้ กดกู้คืนจากหน้าจอนี้ได้ภายหลัง
// - ข้อมูลลูกค้าอ่านในเบราว์เซอร์ของคนที่ login อยู่เท่านั้น ไม่ส่งไปที่อื่น
import { listDocs, listAllDocs, createDoc, updateDocData } from '../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../core/companyScope.js'
import { showToast } from '../core/store.js'
import { openModal, confirmDialog } from './modal.js'
import { exportMultiSheet } from './importExport.js'
import { todayBangkok } from './format.js'
import { readBookingSheet, newCustomerDoc, companyForBrand, brandCompanyMap } from './bookingImport.js'
import { planSheetReconcile, customerFullName } from './sheetReconcile.js'

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
    <details class="srm-sec" ${checked ? 'open' : ''} style="margin-top:10px;border:1px solid var(--border);border-radius:8px;padding:8px 10px">
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
    let sheet, plan, allBookings, allCustomers, companies = []
    try {
      const mod = await import('exceljs')
      const ExcelJS = mod.default || mod
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      sheet = readBookingSheet(wb)
      ;[allBookings, allCustomers, companies] = await Promise.all([
        listAllDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 500),
        listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 500),
        listDocs('org_companies', [], 'name', 'asc', 50).catch(() => []),
      ])
      plan = planSheetReconcile(sheet.rows, allBookings, allCustomers)
    } catch (e) {
      showToast('❌ ' + (e?.message || 'อ่านไฟล์ไม่สำเร็จ'), 'error', 6000)
      return
    }
    const restorable = [
      ...allBookings.filter(b => b.deleted && b.deletedBy === SYNC_TAG).map(d => ({ col: 'bookings', d })),
      ...allCustomers.filter(c => c.deleted && c.deletedBy === SYNC_TAG).map(d => ({ col: 'customers', d })),
    ]
    const { extraBookings, renumberBookings, extraCustomers, leads, customerFixes, missingCustomers, linkOnly, missingBookings } = plan
    const box = (n, label, color) => `<div style="background:var(--surface-2);border-radius:8px;padding:8px 10px;min-width:0"><div style="font-size:1.3rem;font-weight:800;color:${color}">${n}</div><div style="font-size:0.75rem">${label}</div></div>`
    const bkLine = x => `<b>${esc(x.booking.bookingNo || '(ไม่มีเลข)')}</b> · ${esc(x.booking.custName)} ${x.booking.phone ? '· ' + esc(x.booking.phone) : ''} · ${esc(x.booking.status || '')} <span style="color:var(--text-muted)">— ${esc(x.note)}</span>`
    const custLine = x => `<b>${esc(customerFullName(x.customer) || '(ไม่มีชื่อ)')}</b> ${x.customer.phone ? '· ' + esc(x.customer.phone) : ''} · ${esc(STAGE_TH[x.customer.stage] || x.customer.stage || '')} <span style="color:var(--text-muted)">— ${esc(x.note)}</span>`
    const fixLine = f => `<b>${esc(customerFullName(f.customer))}</b> → ${f.changes.map(c => c === 'name' ? `ชื่อ "${esc(f.sheet.custName)}"` : c === 'phone' ? `เบอร์ ${esc(f.sheet.phone)}` : CHANGE_TH[c]).join(', ')} <span style="color:var(--text-muted)">(ใบจอง ${esc(f.sheet.bookingNo || '-')})</span>`
    const missLine = m => `<b>${esc(m.sheet.custName)}</b> ${m.sheet.phone ? '· ' + esc(m.sheet.phone) : ''} · ใบจอง ${esc(m.booking.bookingNo)}`
    const renumLine = r => `${esc(r.booking.bookingNo)} → <b>${esc(r.patch.bookingNo)}</b> · ${esc(r.booking.custName)}`
    const leadLine = c => `<b>${esc(customerFullName(c) || '(ไม่มีชื่อ)')}</b> ${c.phone ? '· ' + esc(c.phone) : ''} · ${esc(STAGE_TH[c.stage] || c.stage || 'Lead')} ${c.source ? '· ' + esc(c.source) : ''}`

    const lists = {
      xb: extraBookings, rn: renumberBookings, xc: extraCustomers, fx: customerFixes, mc: missingCustomers,
      ld: leads.map(c => ({ customer: c })),
    }
    const totalTodo = extraBookings.length + renumberBookings.length + extraCustomers.length + customerFixes.length + missingCustomers.length + linkOnly.length
    const { el, close } = openModal({
      title: '🔍 เทียบข้อมูลกับ Sheet (ยึด Sheet เป็นหลัก)',
      size: 'lg',
      body: `
        <div style="font-size:0.85rem;line-height:1.6">
          <div>ไฟล์: <b>${esc(file.name)}</b> (แท็บ ${esc(sheet.sheetName)}, ${plan.sheetCount} รายการ)</div>
          <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px">
            ${box(plan.keptBookingCount, 'ใบจองตรงกับไฟล์', 'var(--success)')}
            ${box(extraBookings.length, 'ใบจองเกิน/ซ้ำ', 'var(--danger)')}
            ${box(extraCustomers.length, 'ลูกค้าเกิน/ซ้ำ', 'var(--danger)')}
            ${box(customerFixes.length, 'ลูกค้าข้อมูลไม่ตรง', 'var(--warning)')}
            ${box(missingCustomers.length + missingBookings.length, 'มีในไฟล์ แต่โปรแกรมไม่มี', 'var(--primary)')}
            ${box(leads.length, 'Lead ที่ยังไม่จอง (ไม่แตะ)', 'var(--text-muted)')}
          </div>
          ${missingBookings.length ? `<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.12);font-size:0.8rem">⚠️ ไฟล์มีใบจองที่โปรแกรมยังไม่มี <b>${missingBookings.length}</b> ใบ (เช่น ${missingBookings.slice(0, 5).map(m => esc(m.bookingNo)).join(', ')}) — กด <b>📥 นำเข้าจาก Excel</b> ในหน้ายอดจองด้วยไฟล์เดียวกัน ระบบจะสร้างใบจองและลูกค้าให้ แล้วกลับมาเทียบอีกรอบ</div>` : ''}
          ${section('xb', '🗑️ ใบจองที่จะลบ (ไม่มีในไฟล์ / ซ้ำ)', extraBookings, bkLine)}
          ${section('rn', '🔢 ใบจองเลขชั่วคราว → เปลี่ยนเป็นเลขจริงจากไฟล์', renumberBookings, renumLine)}
          ${section('xc', '🗑️ ลูกค้าที่จะลบ (ไม่มีในไฟล์ / ซ้ำ)', extraCustomers, custLine, { hint: 'ลูกค้าซ้ำ: เก็บคนที่ผูกกับใบจองไว้ ลบคนที่ซ้ำ' })}
          ${section('fx', '✏️ แก้ข้อมูลลูกค้าให้ตรงกับไฟล์', customerFixes, fixLine)}
          ${section('mc', '➕ สร้างลูกค้าให้ใบจองที่ยังไม่มีลูกค้า', missingCustomers, missLine)}
          ${section('ld', '🧲 Lead / Prospect ที่ยังไม่จอง (ไม่อยู่ในไฟล์ตามปกติ)', lists.ld, x => leadLine(x.customer), { checked: false, hint: 'ไฟล์ DATA Booking มีแต่ลูกค้าที่จองแล้ว กลุ่มนี้จึงไม่อยู่ในไฟล์ ไม่ถูกลบถ้าไม่ติ๊กเอง' })}
          ${linkOnly.length ? `<div style="margin-top:8px;font-size:0.78rem;color:var(--text-muted)">🔗 จะผูกใบจองกับลูกค้าที่มีอยู่แล้วให้อีก ${linkOnly.length} คู่</div>` : ''}
          ${!totalTodo ? `<div style="margin-top:12px;font-weight:700;color:var(--success)">✅ ข้อมูลในโปรแกรมตรงกับไฟล์แล้ว</div>` : ''}
          <div style="margin-top:10px;font-size:0.75rem;color:var(--text-muted)">ก่อนแก้ ระบบจะดาวน์โหลดไฟล์สำรองลูกค้า+ใบจองทั้งหมดให้ก่อน · รายการที่ลบกู้คืนได้จากหน้าจอนี้</div>
          ${restorable.length ? `<div style="margin-top:10px;padding:8px 10px;border:1px dashed var(--border);border-radius:8px;font-size:0.8rem">↩️ ลบไปจากการเทียบครั้งก่อน ${restorable.length} รายการ <button class="btn btn-ghost btn-sm" id="srm-restore">กู้คืนทั้งหมด</button></div>` : ''}
        </div>`,
      confirmText: '✅ ทำรายการที่เลือก',
      onConfirm: async () => {
        const pick = key => [...el.querySelectorAll(`input[data-sec="${key}"]:checked`)].map(i => lists[key][Number(i.dataset.i)])
        const sel = { xb: pick('xb'), rn: pick('rn'), xc: pick('xc'), fx: pick('fx'), mc: pick('mc'), ld: pick('ld') }
        const delCount = sel.xb.length + sel.xc.length + sel.ld.length
        const n = delCount + sel.rn.length + sel.fx.length + sel.mc.length + linkOnly.length
        if (!n) { showToast('ยังไม่ได้เลือกรายการ', 'warning'); return false }
        const ok = await confirmDialog({
          title: 'ยืนยันแก้ข้อมูลให้ตรงกับ Sheet',
          message: `ลบ ${delCount} รายการ (กู้คืนได้) · แก้ลูกค้า ${sel.fx.length} · เปลี่ยนเลขใบจอง ${sel.rn.length} · สร้างลูกค้า ${sel.mc.length} — ระบบจะดาวน์โหลดไฟล์สำรองก่อนเริ่ม`,
          confirmText: `ยืนยัน ${n} รายการ`, danger: delCount > 0,
        })
        if (!ok) return false
        try {
          await exportMultiSheet([
            { name: 'customers', data: backupRows('customers', allCustomers) },
            { name: 'bookings', data: backupRows('bookings', allBookings) },
          ], `backup-before-sheet-sync-${todayBangkok()}.xlsx`)
        } catch {
          showToast('❌ สร้างไฟล์สำรองไม่สำเร็จ — ยังไม่ได้แก้อะไร', 'error', 6000)
          return false
        }
        const now = new Date().toISOString()
        const del = { deleted: true, deletedAt: now, deletedBy: SYNC_TAG }
        let done = 0, errors = 0
        const run = async fn => { try { await fn(); done++ } catch { errors++ } }
        for (const x of sel.xb) await run(() => updateDocData('bookings', x.booking.id, del))
        for (const x of [...sel.xc, ...sel.ld]) await run(() => updateDocData('customers', x.customer.id, del))
        for (const r of sel.rn) await run(() => updateDocData('bookings', r.booking.id, r.patch))
        for (const f of sel.fx) await run(() => updateDocData('customers', f.customer.id, f.patch.stage ? { ...f.patch, stageChangedAt: now } : f.patch))
        for (const l of linkOnly) {
          await run(async () => {
            await updateDocData('bookings', l.booking.id, { customerId: l.customer.id })
            if (!l.customer.bookingId) await updateDocData('customers', l.customer.id, { bookingId: l.booking.id })
          })
        }
        const learned = brandCompanyMap(allBookings)
        for (const m of sel.mc) {
          await run(async () => {
            const companyId = m.booking.companyId || companyForBrand(m.sheet.brand, companies, myEffectiveCompanyId(), learned)
            const id = await createDoc('customers', { ...newCustomerDoc(m.sheet, { companyId }), bookingId: m.booking.id })
            await updateDocData('bookings', m.booking.id, { customerId: id })
          })
        }
        showToast(`✅ แก้ให้ตรงกับ Sheet แล้ว ${done} รายการ${errors ? ` · พลาด ${errors}` : ''}`, errors ? 'warning' : 'success', 8000)
        onDone?.()
        return true
      },
    })
    el.querySelectorAll('input[data-all]').forEach(all => all.addEventListener('change', () => {
      el.querySelectorAll(`input[data-sec="${all.dataset.all}"]`).forEach(i => { i.checked = all.checked })
    }))
    el.querySelector('#srm-restore')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'กู้คืนรายการที่ลบ', message: `กู้คืน ${restorable.length} รายการที่ลบจากการเทียบกับ Sheet ครั้งก่อน?`, confirmText: 'กู้คืน' })
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
