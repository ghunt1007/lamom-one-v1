import { listDocs, listAllDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, timeAgo, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { getSalesStaff } from '../../data/masterData.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { isProgramOwner } from '../../core/hierarchy.js'

// (v1.0.523) เดิมหน้านี้เขียน collection แยก 'test_drive_records' ของตัวเอง ในขณะที่ TestDriveScheduler.js
// (/dms/testdrive-schedule) เขียน collection 'test_drives' คนละตัวโดยสิ้นเชิง — ทำระบบเดียวกัน (นัด→ทดลองขับ→
// บันทึกผล) ซ้ำซ้อนกัน 2 ระบบไม่เชื่อมกันเลย ไม่มี companyId ผูกกับบริษัท และดู conversion rate จาก Test Drive
// ไปสู่การจองจริงไม่ได้เพราะข้อมูลกระจัดกระจาย — รวมให้ใช้ 'test_drives' เดียวกัน (เลือกเพราะ Scheduler มี
// company-scoping + real-time + กันจองซ้อนอยู่แล้ว) แมป field เดิม custName→customerName, vehicle→model,
// note→notes และเก็บ result/km/duration ที่หน้านี้เก็บอยู่แล้วไว้ในสคีมาร่วมด้วย (Scheduler ไม่ได้ใช้แต่ไม่กระทบ)
function toShared(old) {
  const statusMap = { inprogress: 'in_progress', noshow: 'no_show' }
  return {
    customerName: old.custName || '', phone: old.phone || '', model: old.vehicle || '',
    date: old.date || '', time: old.time || '', staff: old.staff || '',
    status: statusMap[old.status] || old.status || 'scheduled',
    result: old.result || null, notes: old.note || '', km: old.km || 0, duration: old.duration || 30,
  }
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TD_STATUS = {
  scheduled:   { label: '📅 นัดแล้ว', badge: 'primary' },
  confirmed:   { label: '✔️ ยืนยันแล้ว', badge: 'success' },
  in_progress: { label: '🚗 กำลัง Test Drive', badge: 'warning' },
  done:        { label: '✅ เสร็จแล้ว', badge: 'success' },
  cancelled:   { label: '❌ ยกเลิก', badge: 'danger' },
  no_show:     { label: '👻 ไม่มา', badge: 'primary' },
}

const TD_RESULT = {
  interested:  { label: '🔥 สนใจมาก', badge: 'danger' },
  maybe:       { label: '🤔 อาจจะ', badge: 'warning' },
  notinterested:{ label: '😐 ไม่สนใจ', badge: 'primary' },
  booked:      { label: '📝 จองแล้ว!', badge: 'success' },
}

export default async function TestDrivePage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  const canMigrate = isProgramOwner()

  let testdrives = []
  let filterStatus = 'all'
  let viewMode = 'list' // list | calendar
  let loading = true
  let legacyCount = 0
  let migrating = false

  async function loadData() {
    loading = true
    try { testdrives = await listDocs('test_drives', companyScopeFilters(), 'date', 'desc', 200) } catch (e) { testdrives = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
    if (canMigrate) checkLegacy()
  }

  async function checkLegacy() {
    try {
      const legacy = await listAllDocs('test_drive_records', [], 'date', 'desc', 500)
      legacyCount = legacy.filter(d => !d._migrated && !d.deleted).length
    } catch { legacyCount = 0 }
    if (container.__routerGen === myGen) renderPage()
  }

  async function runMigration() {
    migrating = true
    renderPage()
    let migrated = 0, errors = 0
    try {
      const legacy = await listAllDocs('test_drive_records', [], 'date', 'desc', 500)
      for (const doc of legacy.filter(d => !d._migrated && !d.deleted)) {
        try {
          await createDoc('test_drives', { ...toShared(doc), companyId: myEffectiveCompanyId() })
          await updateDocData('test_drive_records', doc.id, { _migrated: true })
          migrated++
        } catch { errors++ }
      }
    } catch { showToast('อ่านข้อมูลเก่าไม่สำเร็จ', 'error') }
    migrating = false
    showToast(`✅ ย้ายข้อมูลเก่าแล้ว ${migrated} รายการ${errors ? ` (พลาด ${errors} รายการ)` : ''}`, errors ? 'warning' : 'success')
    await loadData()
  }

  function getStats() {
    const done = testdrives.filter(t => t.status === 'done').length
    const booked = testdrives.filter(t => t.result === 'booked').length
    return {
      total: testdrives.length,
      done,
      scheduled: testdrives.filter(t => t.status === 'scheduled').length,
      booked,
      // เดิมกันแค่ testdrives.length===0 แต่ตัวหารจริงคือ "done" — ถ้ามี testdrive แต่ยังไม่มีรายการไหน
      // เสร็จเลย (done===0) ยังโชว์ NaN% อยู่ดี กันตัวหารเป็น 0 ตรงๆ
      convRate: done > 0 ? Math.round(booked / done * 100) : 0,
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = getStats()
    const filtered = filterStatus === 'all' ? testdrives : testdrives.filter(t => t.status === filterStatus)
    // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
    // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
    const today = todayBangkok()
    const todayTDs = testdrives.filter(t => t.date === today && ['scheduled','confirmed'].includes(t.status))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Test Drive Management</div>
            <div class="page-subtitle">นัดหมาย · ติดตาม · บันทึกผล</div>
          </div>
          <div class="page-actions">
            ${todayTDs.length > 0 ? `<span class="badge badge-primary">📅 วันนี้ ${todayTDs.length} นัด</span>` : ''}
            <button class="btn btn-primary" id="new-td-btn">➕ นัด Test Drive</button>
          </div>
        </div>

        ${canMigrate && legacyCount > 0 ? `
        <div class="card" style="padding:10px 14px;margin-bottom:14px;border:1px solid var(--warning);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:0.8rem;color:var(--warning)">⚠️ พบข้อมูล Test Drive เก่า ${legacyCount} รายการจากระบบเดิม (test_drive_records) ที่ยังไม่ได้ย้ายมารวม</span>
          <button class="btn btn-warning btn-sm" id="migrate-legacy-btn" ${migrating ? 'disabled' : ''}>${migrating ? '⏳ กำลังย้าย...' : '🔧 ย้ายข้อมูลเก่ามารวม'}</button>
        </div>` : ''}

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
          ${kpi('📋 ทั้งหมด', s.total, 'primary')}
          ${kpi('📅 นัดแล้ว', s.scheduled, 'accent')}
          ${kpi('✅ เสร็จแล้ว', s.done, 'success')}
          ${kpi('📝 จองต่อ', s.booked, 'success')}
          ${kpi('🎯 Conversion', s.convRate + '%', s.convRate >= 30 ? 'success' : 'warning')}
        </div>

        <!-- Today's schedule -->
        ${todayTDs.length > 0 ? `
          <div class="card" style="padding:16px;margin-bottom:16px;border:1px solid var(--primary)">
            <div style="font-weight:700;color:var(--primary);margin-bottom:12px">📅 นัด Test Drive วันนี้ (${todayTDs.length} รายการ)</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${todayTDs.map(t => `
                <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--primary-dim);border-radius:var(--radius-md)">
                  <div style="font-size:1.3rem;flex-shrink:0">🚗</div>
                  <div style="flex:1">
                    <div style="font-weight:600">${escHtml(t.customerName)} · ${escHtml(t.time)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(t.model)} · ${escHtml(t.staff)}</div>
                  </div>
                  <button class="btn btn-primary btn-sm start-td-btn" data-id="${t.id}">▶ เริ่ม</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Filter -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn btn-sm ${filterStatus==='all'?'btn-primary':'btn-secondary'} fs-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(TD_STATUS).map(([k,v]) => `<button class="btn btn-sm ${filterStatus===k?'btn-primary':'btn-secondary'} fs-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <!-- Table -->
        <div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap"><table class="table">
            <thead><tr><th>ลูกค้า</th><th>รถที่ Test Drive</th><th>วันที่/เวลา</th><th>Sales</th><th>สถานะ</th><th>ผลลัพธ์</th><th></th></tr></thead>
            <tbody>
              ${filtered.length ? filtered.map(t => {
                const st = TD_STATUS[t.status]
                const rs = TD_RESULT[t.result]
                return `<tr>
                  <td>
                    <div style="font-weight:600">${escHtml(t.customerName)}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(t.phone)}</div>
                  </td>
                  <td style="font-size:0.83rem">${escHtml(t.model)}</td>
                  <td style="font-size:0.82rem;white-space:nowrap">${escHtml(t.date)} ${escHtml(t.time)}</td>
                  <td style="font-size:0.83rem;color:var(--text-muted)">${escHtml(t.staff)}</td>
                  <td><span class="badge badge-${st?.badge}">${st?.label}</span></td>
                  <td>${rs ? `<span class="badge badge-${rs.badge}">${rs.label}</span>` : '-'}</td>
                  <td>
                    <div style="display:flex;gap:3px">
                      <button class="btn btn-ghost btn-sm td-view-btn" data-id="${t.id}">📋</button>
                      ${['scheduled','confirmed','in_progress'].includes(t.status) ? `<button class="btn btn-primary btn-sm td-result-btn" data-id="${t.id}">✅ บันทึกผล</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('') : `<tr><td colspan="7"><div class="empty-state" style="padding:32px"><div class="empty-icon">🚗</div><div class="empty-title">ไม่มีรายการ</div></div></td></tr>`}
            </tbody>
          </table></div>
        </div>
      </div>
    `

    document.getElementById('new-td-btn')?.addEventListener('click', openNewForm)
    document.querySelectorAll('.fs-btn').forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.s; renderPage() }))
    document.querySelectorAll('.td-view-btn').forEach(b => {
      b.addEventListener('click', () => { const t = testdrives.find(x => x.id === b.dataset.id); if (t) openDetail(t) })
    })
    document.querySelectorAll('.td-result-btn, .start-td-btn').forEach(b => {
      b.addEventListener('click', () => { const t = testdrives.find(x => x.id === b.dataset.id); if (t) openResultForm(t) })
    })
    document.getElementById('migrate-legacy-btn')?.addEventListener('click', runMigration)
  }

  function openDetail(t) {
    const st = TD_STATUS[t.status]
    const rs = TD_RESULT[t.result]
    openModal({
      title: '🚗 ' + escHtml(t.customerName) + ' — Test Drive', size:'md',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:6px">${rs ? `<span class="badge badge-${rs.badge}">${rs.label}</span>` : ''}<span class="badge badge-${st?.badge}">${st?.label}</span></div>
        ${dr('🚗','รถ',t.model)}${dr('📅','วันที่',t.date+' '+t.time)}
        ${dr('👤','Sales',t.staff)}${dr('📞','โทร',t.phone)}
        ${t.km ? dr('📏','ระยะทาง',t.km+' กม.') : ''}
        ${t.duration ? dr('⏱','ระยะเวลา',t.duration+' นาที') : ''}
        ${t.notes ? `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-md);font-size:0.85rem">${escHtml(t.notes)}</div>` : ''}
      </div>`,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>`
    })
  }

  function openResultForm(t) {
    const { el, close } = openModal({
      title: '✅ บันทึกผล Test Drive — ' + escHtml(t.customerName), size:'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="font-size:0.85rem;color:var(--text-muted)">${escHtml(t.model)} · ${escHtml(t.date)} ${escHtml(t.time)}</div>
        <div class="input-group"><label class="input-label">สถานะ</label>
          <select class="input" id="tr-status">
            <option value="done">✅ เสร็จแล้ว</option>
            <option value="no_show">👻 ไม่มา</option>
            <option value="cancelled">❌ ยกเลิก</option>
          </select>
        </div>
        <div class="input-group"><label class="input-label">ผลลัพธ์</label>
          <select class="input" id="tr-result">
            <option value="">— ยังไม่ระบุ —</option>
            ${Object.entries(TD_RESULT).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ระยะทาง (กม.)</label><input class="input" type="number" id="tr-km" value="${t.km || 0}"></div>
          <div class="input-group"><label class="input-label">ระยะเวลา (นาที)</label><input class="input" type="number" id="tr-dur" value="${t.duration || 30}"></div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ/Feedback</label><textarea class="input" id="tr-note" rows="2">${escHtml(t.notes||'')}</textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="trc">ยกเลิก</button><button class="btn btn-primary" id="trs">💾 บันทึก</button>`
    })
    el.querySelector('#trc').addEventListener('click', close)
    el.querySelector('#trs').addEventListener('click', async () => {
      const fields = {
        status: el.querySelector('#tr-status').value,
        result: el.querySelector('#tr-result').value || null,
        km: +el.querySelector('#tr-km').value,
        duration: +el.querySelector('#tr-dur').value,
        notes: el.querySelector('#tr-note').value.trim(),
      }
      try {
        await updateDocData('test_drives', t.id, fields)
        showToast('✅ บันทึกผล Test Drive แล้ว', 'success'); close()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openNewForm() {
    const today = todayBangkok()
    const { el, close } = openModal({
      title: '➕ นัด Test Drive ใหม่', size:'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="nf-name" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="nf-phone" placeholder="08x-xxx-xxxx"></div>
        </div>
        <div class="input-group"><label class="input-label">รถที่ Test Drive</label>
          <select class="input" id="nf-vehicle">${getVehicles().map(v => `<option>${v.brand} ${v.model} ${v.variant}</option>`).join('')}</select>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันที่</label><input class="input" type="date" id="nf-date" value="${today}"></div>
          <div class="input-group"><label class="input-label">เวลา</label><input class="input" type="time" id="nf-time" value="10:00"></div>
        </div>
        <div class="input-group"><label class="input-label">Sales ที่รับผิดชอบ</label>
          <select class="input" id="nf-staff">${getSalesStaff().map(s => `<option>${s}</option>`).join('')}</select>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="nfc">ยกเลิก</button><button class="btn btn-primary" id="nfs">📅 นัดหมาย</button>`
    })
    el.querySelector('#nfc').addEventListener('click', close)
    el.querySelector('#nfs').addEventListener('click', async (e) => {
      const name = el.querySelector('#nf-name').value.trim()
      if (!name) return
      const date = el.querySelector('#nf-date').value
      const time = el.querySelector('#nf-time').value
      // (v1.0.523) รวมเข้า collection เดียวกับ TestDriveScheduler.js แล้ว — เพิ่มเช็คจองซ้อนเหมือนกัน
      // (เดิมหน้านี้ไม่เคยเช็คเลย ต่างจาก Scheduler ที่กันไว้แล้ว ตอนนี้ใช้ข้อมูลร่วมกันต้องกันให้ตรงกันทั้ง 2 ทาง)
      const conflict = testdrives.find(x => x.date === date && x.time === time && !['cancelled','no_show'].includes(x.status))
      if (conflict) { showToast(`❗ ช่วงเวลา ${time} วัน ${formatDate(date)} มีนัดของ ${conflict.customerName} อยู่แล้ว`, 'error'); return }
      // เดิมปุ่มนี้ไม่ disable ระหว่างรอบันทึก กดซ้ำเร็วๆจะสร้างนัด Test Drive ซ้ำ 2 รายการ
      const btn = e.currentTarget
      btn.disabled = true
      try {
        await createDoc('test_drives', {
          customerName: name,
          phone: el.querySelector('#nf-phone').value,
          model: el.querySelector('#nf-vehicle').value,
          date, time,
          staff: el.querySelector('#nf-staff').value,
          status: 'scheduled', result: null, notes: '',
          km: 0, duration: 30,
          companyId: myEffectiveCompanyId(),
        })
        showToast('📅 นัด Test Drive แล้ว', 'success'); close()
        await loadData()
      } catch (e) { btn.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
function dr(icon, label, val) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:70px">${label}</span><span>${escHtml(String(val ?? ''))}</span></div>`
}
