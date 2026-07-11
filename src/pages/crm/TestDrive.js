import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { getSalesStaff } from '../../data/masterData.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TD_STATUS = {
  scheduled: { label: '📅 นัดแล้ว', badge: 'primary' },
  inprogress: { label: '🚗 กำลัง Test Drive', badge: 'warning' },
  done:       { label: '✅ เสร็จแล้ว', badge: 'success' },
  cancelled:  { label: '❌ ยกเลิก', badge: 'danger' },
  noshow:     { label: '👻 ไม่มา', badge: 'primary' },
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

  let testdrives = []
  let filterStatus = 'all'
  let viewMode = 'list' // list | calendar
  let loading = true

  async function loadData() {
    loading = true
    try { testdrives = await listDocs('test_drive_records', [], 'date', 'desc', 200) } catch (e) { testdrives = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getStats() {
    return {
      total: testdrives.length,
      done: testdrives.filter(t => t.status === 'done').length,
      scheduled: testdrives.filter(t => t.status === 'scheduled').length,
      booked: testdrives.filter(t => t.result === 'booked').length,
      convRate: testdrives.length > 0 ? Math.round(testdrives.filter(t => t.result === 'booked').length / testdrives.filter(t => t.status === 'done').length * 100) : 0,
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = getStats()
    const filtered = filterStatus === 'all' ? testdrives : testdrives.filter(t => t.status === filterStatus)
    const today = new Date().toISOString().slice(0, 10)
    const todayTDs = testdrives.filter(t => t.date === today && t.status === 'scheduled')

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
                    <div style="font-weight:600">${escHtml(t.custName)} · ${escHtml(t.time)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(t.vehicle)} · ${escHtml(t.staff)}</div>
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
          <table class="table">
            <thead><tr><th>ลูกค้า</th><th>รถที่ Test Drive</th><th>วันที่/เวลา</th><th>Sales</th><th>สถานะ</th><th>ผลลัพธ์</th><th></th></tr></thead>
            <tbody>
              ${filtered.length ? filtered.map(t => {
                const st = TD_STATUS[t.status]
                const rs = TD_RESULT[t.result]
                return `<tr>
                  <td>
                    <div style="font-weight:600">${escHtml(t.custName)}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(t.phone)}</div>
                  </td>
                  <td style="font-size:0.83rem">${escHtml(t.vehicle)}</td>
                  <td style="font-size:0.82rem;white-space:nowrap">${escHtml(t.date)} ${escHtml(t.time)}</td>
                  <td style="font-size:0.83rem;color:var(--text-muted)">${escHtml(t.staff)}</td>
                  <td><span class="badge badge-${st?.badge}">${st?.label}</span></td>
                  <td>${rs ? `<span class="badge badge-${rs.badge}">${rs.label}</span>` : '-'}</td>
                  <td>
                    <div style="display:flex;gap:3px">
                      <button class="btn btn-ghost btn-sm td-view-btn" data-id="${t.id}">📋</button>
                      ${t.status === 'scheduled' ? `<button class="btn btn-primary btn-sm td-result-btn" data-id="${t.id}">✅ บันทึกผล</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('') : `<tr><td colspan="7"><div class="empty-state" style="padding:32px"><div class="empty-icon">🚗</div><div class="empty-title">ไม่มีรายการ</div></div></td></tr>`}
            </tbody>
          </table>
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
  }

  function openDetail(t) {
    const st = TD_STATUS[t.status]
    const rs = TD_RESULT[t.result]
    openModal({
      title: '🚗 ' + escHtml(t.custName) + ' — Test Drive', size:'md',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:6px">${rs ? `<span class="badge badge-${rs.badge}">${rs.label}</span>` : ''}<span class="badge badge-${st?.badge}">${st?.label}</span></div>
        ${dr('🚗','รถ',t.vehicle)}${dr('📅','วันที่',t.date+' '+t.time)}
        ${dr('👤','Sales',t.staff)}${dr('📞','โทร',t.phone)}
        ${t.km ? dr('📏','ระยะทาง',t.km+' กม.') : ''}
        ${t.duration ? dr('⏱','ระยะเวลา',t.duration+' นาที') : ''}
        ${t.note ? `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-md);font-size:0.85rem">${escHtml(t.note)}</div>` : ''}
      </div>`,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>`
    })
  }

  function openResultForm(t) {
    const { el, close } = openModal({
      title: '✅ บันทึกผล Test Drive — ' + escHtml(t.custName), size:'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="font-size:0.85rem;color:var(--text-muted)">${escHtml(t.vehicle)} · ${escHtml(t.date)} ${escHtml(t.time)}</div>
        <div class="input-group"><label class="input-label">สถานะ</label>
          <select class="input" id="tr-status">
            <option value="done">✅ เสร็จแล้ว</option>
            <option value="noshow">👻 ไม่มา</option>
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
        <div class="input-group"><label class="input-label">หมายเหตุ/Feedback</label><textarea class="input" id="tr-note" rows="2">${escHtml(t.note||'')}</textarea></div>
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
        note: el.querySelector('#tr-note').value.trim(),
      }
      try {
        await updateDocData('test_drive_records', t.id, fields)
        showToast('✅ บันทึกผล Test Drive แล้ว', 'success'); close()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openNewForm() {
    const today = new Date().toISOString().slice(0, 10)
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
    el.querySelector('#nfs').addEventListener('click', async () => {
      const name = el.querySelector('#nf-name').value.trim()
      if (!name) return
      try {
        await createDoc('test_drive_records', {
          custName: name,
          phone: el.querySelector('#nf-phone').value,
          vehicle: el.querySelector('#nf-vehicle').value,
          date: el.querySelector('#nf-date').value,
          time: el.querySelector('#nf-time').value,
          staff: el.querySelector('#nf-staff').value,
          status: 'scheduled', result: null, note: '',
          km: 0, duration: 30,
        })
        showToast('📅 นัด Test Drive แล้ว', 'success'); close()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
