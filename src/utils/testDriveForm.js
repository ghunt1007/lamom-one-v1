// นัดทดลองขับจากที่ไหนก็ได้ (หน้าลูกค้า / หลังบันทึกผลโทร) — เติมชื่อ เบอร์ รุ่นที่สนใจ
// และเดาวัน-เวลาจากข้อความที่เซลส์พิมพ์ไว้ (เช่น "นัดทดลองขับเสาร์นี้บ่าย 2") ให้เลย ไม่ต้องพิมพ์ซ้ำ
// เขียน collection 'test_drives' เดียวกับหน้า Test Drive / Scheduler
import { createDoc, listDocs } from '../core/db.js'
import { getState, showToast } from '../core/store.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../core/companyScope.js'
import { openModal } from './modal.js'
import { todayBangkok } from './format.js'
import { suggestNextDue } from './nextFollowup.js'
import { getVehicles } from '../data/vehicleDatabase.js'
import { getSalesStaff } from '../data/masterData.js'

export function mentionsTestDrive(text) {
  return /ทดลองขับ|ลองขับ|เทสไดร[ฟ์]|test\s*-?drive/i.test(String(text || ''))
}

// วันนัด: ใช้ตัวเดาวันเดียวกับนัดติดตาม ถ้าข้อความไม่บอกวันเลย → พรุ่งนี้
// เวลา: "14:30" / "14.30" / "บ่าย 2" / "2 โมง" / "เช้า" / "บ่าย" / "เย็น" → ไม่บอก = 10:00
export function guessTestDriveSlot(text, today) {
  const t = String(text || '')
  const s = suggestNextDue(t, today)
  const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
  const date = !s.skip && s.dueDate && !/3 วัน/.test(s.why || '') ? s.dueDate : tomorrow
  const pad = n => String(n).padStart(2, '0')
  let time = '10:00'
  const hm = t.match(/(?<![\d/])([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)(?!\d)/)
  const pm = t.match(/บ่าย\s*(\d{1,2})/)
  const oclock = t.match(/(?<!\d)(\d{1,2})\s*โมง/)
  if (hm) time = `${pad(+hm[1])}:${hm[2]}`
  else if (pm && +pm[1] >= 1 && +pm[1] <= 5) time = `${pad(12 + +pm[1])}:00`
  else if (oclock && +oclock[1] >= 7 && +oclock[1] <= 11) time = `${pad(+oclock[1])}:00`
  else if (oclock && +oclock[1] >= 1 && +oclock[1] <= 6) time = `${pad(12 + +oclock[1])}:00`
  else if (/บ่าย/.test(t)) time = '14:00'
  else if (/เย็น/.test(t)) time = '16:00'
  else if (/เช้า/.test(t)) time = '10:00'
  return { date, time }
}

// เลือกรุ่นในรายการให้ตรงกับรุ่นที่ลูกค้าสนใจ (เทียบแบบไม่สนตัวพิมพ์/ช่องว่าง เช่น "s07" ↔ "DEEPAL S07")
export function pickVehicleOption(options, interest) {
  const n = s => String(s || '').toLowerCase().replace(/\s+/g, '')
  const q = n(interest)
  if (!q) return ''
  return options.find(o => n(o) === q) || options.find(o => n(o).includes(q)) || options.find(o => q.includes(n(o).replace(/^deepal/, ''))) || ''
}

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

// c = ลูกค้า (ใช้ id, ชื่อ, เบอร์, interestedModel) · hint = ข้อความที่ใช้เดาวันเวลา
export function openTestDriveForm(c = {}, { hint = '', onSaved } = {}) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || c.customerName || ''
  const { date, time } = guessTestDriveSlot(hint, todayBangkok())
  const opts = [...new Set(getVehicles().map(v => [v.brand, v.model, v.variant].filter(Boolean).join(' ')))]
  const picked = pickVehicleOption(opts, c.interestedModel)
  if (c.interestedModel && !picked) opts.unshift(c.interestedModel)
  const sel = picked || c.interestedModel || ''
  const me = getState('user')?.displayName || ''
  const staff = getSalesStaff()
  const { el, close } = openModal({
    title: '🚗 นัดทดลองขับ', size: 'sm',
    body: `<div style="display:flex;flex-direction:column;gap:10px">
        ${hint && mentionsTestDrive(hint) ? '<div style="font-size:0.74rem;color:var(--primary)">✨ เติมวัน-เวลาจากที่บันทึกไว้ให้แล้ว ตรวจแล้วกดนัดได้เลย</div>' : ''}
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="tdf-name" value="${escHtml(name)}"></div>
        <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="tdf-phone" inputmode="tel" value="${escHtml(c.phone || '')}"></div>
        <div class="input-group"><label class="input-label">รุ่นที่ลองขับ</label>
          <select class="input" id="tdf-model">${opts.map(o => `<option ${o === sel ? 'selected' : ''}>${escHtml(o)}</option>`).join('')}</select></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="tdf-date" value="${date}"></div>
          <div class="input-group"><label class="input-label">เวลา</label><input class="input" type="time" id="tdf-time" value="${time}"></div>
        </div>
        <div class="input-group"><label class="input-label">เซลส์ที่ดูแล</label>
          <select class="input" id="tdf-staff">${[...new Set([c.assignedTo || me, ...staff].filter(Boolean))].map(s => `<option ${s === (c.assignedTo || me) ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}</select></div>
      </div>`,
    footer: `<button class="btn btn-secondary" id="tdf-cancel">ยกเลิก</button><button class="btn btn-primary" id="tdf-save">📅 นัดหมาย</button>`,
  })
  el.querySelector('#tdf-cancel').addEventListener('click', close)
  el.querySelector('#tdf-save').addEventListener('click', async e => {
    const btn = e.currentTarget
    const v = id => el.querySelector(id).value.trim()
    if (!v('#tdf-name')) { showToast('ใส่ชื่อลูกค้าก่อน', 'warning'); return }
    const d = v('#tdf-date'), tm = v('#tdf-time')
    if (!d) { showToast('เลือกวันที่ก่อน', 'warning'); return }
    btn.disabled = true
    // กันจองช่วงเวลาซ้อน (เหมือนหน้า Test Drive) — ถ้าเช็คไม่ได้ (ออฟไลน์/ไม่มี index) ก็ให้นัดต่อได้
    try {
      const same = await listDocs('test_drives', [...companyScopeFilters(), ['date', '==', d]], 'date', 'desc', 50)
      const clash = same.find(x => x.date === d && x.time === tm && !['cancelled', 'no_show'].includes(x.status))
      if (clash) { showToast(`❗ เวลา ${tm} มีนัดของ ${clash.customerName || 'ลูกค้าอื่น'} อยู่แล้ว ลองเปลี่ยนเวลา`, 'error'); btn.disabled = false; return }
    } catch { /* เช็คไม่ได้ ไม่ขวางการนัด */ }
    try {
      await createDoc('test_drives', {
        customerId: c.id || null, customerName: v('#tdf-name'), phone: v('#tdf-phone'), model: v('#tdf-model'),
        date: d, time: tm, staff: v('#tdf-staff'),
        status: 'scheduled', result: null, notes: '', km: 0, duration: 30,
        companyId: c.companyId ?? myEffectiveCompanyId(),
      })
      forgetTestDriveCache()
      close(); showToast('📅 นัดทดลองขับแล้ว — ดูได้ที่หน้า Test Drive', 'success')
      onSaved?.({ date: d, time: tm })
    } catch { btn.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
  })
}

// นัดลองขับทั้งหมดของลูกค้าคนนี้ ใหม่สุดก่อน (จับคู่ด้วย customerId หรือเบอร์โทร)
export function testDrivesFor(c, tds = []) {
  const digits = s => String(s || '').replace(/\D/g, '')
  const ph = digits(c?.phone)
  return tds.filter(t => t && !t.deleted && ((c?.id && t.customerId === c.id) || (ph.length >= 9 && digits(t.phone) === ph)))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

// นัดลองขับที่ยังไม่ถึงของลูกค้าคนนี้ (จับคู่ด้วย customerId หรือเบอร์โทร สำหรับนัดเก่าที่ไม่มี id)
export function upcomingTestDriveFor(c, tds = [], today) {
  const digits = s => String(s || '').replace(/\D/g, '')
  const ph = digits(c?.phone)
  return tds.filter(t => t && !t.deleted && t.date >= today && !['done', 'cancelled', 'no_show'].includes(t.status)
      && ((c?.id && t.customerId === c.id) || (ph.length >= 9 && digits(t.phone) === ph)))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0] || null
}

let tdCache = { at: 0, list: null }
async function allTestDrives() {
  if (!tdCache.list || Date.now() - tdCache.at > 60000) {
    tdCache = { at: Date.now(), list: await listDocs('test_drives', companyScopeFilters(), 'date', 'desc', 200) }
  }
  return tdCache.list
}
export async function loadUpcomingTestDrive(c) { return upcomingTestDriveFor(c, await allTestDrives(), todayBangkok()) }
export async function loadTestDrivesFor(c) { return testDrivesFor(c, await allTestDrives()) }
export function forgetTestDriveCache() { tdCache = { at: 0, list: null } }
