/**
 * Surveyor Appointment — นัดช่างประกันตรวจรถ
 * Route: /service/surveyor
 */
import { formatDate, formatDateTime } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const INSURERS = ['กรุงเทพประกันภัย','เมืองไทยประกันภัย','วิริยะประกันภัย','อาคเนย์ประกันภัย','คุ้มภัยโตเกียวมารีน']

let APPTS = [
  { id: 'SA-001', claimNo: 'CLM-2401', customer: 'คุณสมชาย', plate: 'กข-1234', model: 'BYD Atto 3', insurer: 'กรุงเทพประกันภัย', surveyor: 'คุณสมศักดิ์', date: '2026-06-16', time: '10:00', status: 'confirmed', damage: 'กันชนหน้า ฝากระโปรง' },
  { id: 'SA-002', claimNo: 'CLM-2398', customer: 'คุณวันดี', plate: '1กก-5678', model: 'MG ZS EV', insurer: 'วิริยะประกันภัย', surveyor: '', date: '2026-06-17', time: '13:30', status: 'pending', damage: 'ประตูซ้ายบุบ กระจกแตก' },
  { id: 'SA-003', claimNo: 'CLM-2390', customer: 'บ.รุ่งเรือง', plate: '2ขข-9999', model: 'BYD Seal AWD', insurer: 'เมืองไทยประกันภัย', surveyor: 'คุณสมหมาย', date: '2026-06-14', time: '09:00', status: 'done', damage: 'หลังคาบุบ หน้าต่างร้าว', estimateApproved: 85000 },
]

const ST = {
  pending:   { label: 'รอยืนยัน', color: 'var(--warning)' },
  confirmed: { label: 'นัดแล้ว',  color: 'var(--primary)' },
  done:      { label: 'ตรวจแล้ว', color: 'var(--success)' },
  cancelled: { label: 'ยกเลิก',   color: 'var(--text-muted)' },
}

export default async function SurveyorAppointmentPage(container) {
  function render() {
    const today = new Date().toISOString().slice(0,10)
    const todayAppts = APPTS.filter(a => a.date === today)
    const pending = APPTS.filter(a => a.status === 'pending')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔍 Surveyor Appointment</div>
            <div class="page-subtitle">นัดช่างประกันตรวจความเสียหาย · ติดตามสถานะเคลม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-btn">➕ นัดช่างประกัน</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📅 นัดวันนี้', todayAppts.length, 'var(--primary)')}
          ${sc('⏳ รอยืนยัน', pending.length, pending.length > 0 ? 'var(--warning)' : 'var(--success)')}
          ${sc('✅ ตรวจแล้วเดือนนี้', APPTS.filter(a=>a.status==='done').length, 'var(--success)')}
          ${sc('💰 วงเงินอนุมัติรวม', '฿' + APPTS.filter(a=>a.estimateApproved).reduce((s,a)=>s+a.estimateApproved,0).toLocaleString(), 'var(--success)')}
        </div>

        ${todayAppts.length ? `
          <div class="card" style="padding:12px 14px;margin-bottom:12px;border-left:4px solid var(--primary)">
            <div style="font-size:0.76rem;font-weight:700;color:var(--primary);margin-bottom:6px">📅 นัดวันนี้ (${todayAppts.length} คัน)</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${todayAppts.map(a => `<div style="font-size:0.78rem">⏰ ${a.time} · ${a.customer} · ${a.model} (${a.plate}) · ${a.insurer}${a.surveyor ? ` · ช่าง: ${a.surveyor}` : ' · <span style="color:var(--warning)">รอช่าง</span>'}</div>`).join('')}
            </div>
          </div>` : ''}

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:860px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
              <th style="padding:10px 12px">เลขที่ / เคลม</th><th>ลูกค้า / รถ</th><th>บริษัทประกัน</th>
              <th>ความเสียหาย</th><th style="text-align:center">วัน-เวลา</th><th style="text-align:center">สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              ${APPTS.map(a => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:9px 12px;font-weight:600">${a.id}<div style="font-size:0.68rem;color:var(--text-muted)">${a.claimNo}</div></td>
                  <td>${a.customer}<div style="font-size:0.7rem;color:var(--text-muted)">${a.model} · ${a.plate}</div></td>
                  <td style="font-size:0.76rem">${a.insurer}${a.surveyor?`<div style="font-size:0.68rem;color:var(--text-muted)">ช่าง: ${a.surveyor}</div>`:''}</td>
                  <td style="font-size:0.74rem;max-width:180px">${a.damage}${a.estimateApproved?`<div style="color:var(--success);font-weight:700">อนุมัติ ฿${a.estimateApproved.toLocaleString()}</div>`:''}</td>
                  <td style="text-align:center;font-size:0.74rem">${formatDate(a.date)}<div>${a.time} น.</div></td>
                  <td style="text-align:center"><span style="font-size:0.66rem;background:${ST[a.status].color};color:#fff;padding:2px 8px;border-radius:10px">${ST[a.status].label}</span></td>
                  <td style="padding-right:12px;white-space:nowrap">
                    ${a.status==='pending'?`<button class="btn btn-xs btn-secondary confirm-btn" data-id="${a.id}">ยืนยัน</button> `:''}
                    ${a.status==='confirmed'?`<button class="btn btn-xs btn-secondary done-btn" data-id="${a.id}">บันทึกผล</button> `:''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.confirm-btn').forEach(b => b.addEventListener('click', () => confirmAppt(b.dataset.id)))
    container.querySelectorAll('.done-btn').forEach(b => b.addEventListener('click', () => doneAppt(b.dataset.id)))
    document.getElementById('add-btn')?.addEventListener('click', openAdd)
  }

  function confirmAppt(id) {
    const a = APPTS.find(x => x.id === id)
    openModal({
      title: `✅ ยืนยันนัด ${id}`,
      size: 'sm',
      body: `<div class="input-group" style="margin-bottom:10px"><label class="input-label">ชื่อช่างประกัน *</label><input class="input" id="sa-surv" value="${a.surveyor}"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="sa-note" placeholder="ข้อมูลเพิ่มเติม"></div>`,
      confirmText: '✅ ยืนยันนัด',
      onConfirm() {
        const surv = document.getElementById('sa-surv').value.trim()
        if (!surv) { showToast('❗ ระบุชื่อช่างประกัน', 'error'); return false }
        a.surveyor = surv; a.status = 'confirmed'
        showToast(`ยืนยันนัด ${id} กับช่าง ${surv} แล้ว · แจ้งลูกค้า ${a.customer}`, 'success')
        render()
      }
    })
  }

  function doneAppt(id) {
    const a = APPTS.find(x => x.id === id)
    openModal({
      title: `📋 บันทึกผลการตรวจ ${id}`,
      size: 'sm',
      body: `<div class="input-group" style="margin-bottom:10px"><label class="input-label">วงเงินที่อนุมัติ (บาท)</label><input class="input" type="number" id="sa-amt" placeholder="0 = รอผล"></div>
        <div class="input-group"><label class="input-label">หมายเหตุจากช่าง</label><textarea class="input" id="sa-remark" rows="2"></textarea></div>`,
      confirmText: '💾 บันทึกผล',
      onConfirm() {
        const amt = parseInt(document.getElementById('sa-amt').value) || 0
        a.status = 'done'; if (amt) a.estimateApproved = amt
        showToast(`บันทึกผลการตรวจ ${id}${amt ? ` · อนุมัติ ฿${amt.toLocaleString()}` : ''} แล้ว`, 'success')
        render()
      }
    })
  }

  function openAdd() {
    openModal({
      title: '➕ นัดช่างประกัน',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">เลขที่เคลม *</label><input class="input" id="sa-claim" placeholder="CLM-xxxx"></div>
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="sa-cust"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">รุ่นรถ</label><input class="input" id="sa-model"></div>
          <div class="input-group" style="width:110px"><label class="input-label">ทะเบียน</label><input class="input" id="sa-plate"></div>
        </div>
        <div class="input-group"><label class="input-label">บริษัทประกัน</label><select class="input" id="sa-ins">${INSURERS.map(i=>`<option>${i}</option>`).join('')}</select></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">วันนัด *</label><input class="input" type="date" id="sa-date"></div>
          <div class="input-group" style="width:100px"><label class="input-label">เวลา</label><input class="input" type="time" id="sa-time" value="09:00"></div>
        </div>
        <div class="input-group"><label class="input-label">ความเสียหาย</label><input class="input" id="sa-dmg"></div>
      </div>`,
      confirmText: '📅 สร้างนัด',
      onConfirm() {
        const claimNo = document.getElementById('sa-claim').value.trim()
        const customer = document.getElementById('sa-cust').value.trim()
        const date = document.getElementById('sa-date').value
        if (!claimNo || !customer || !date) { showToast('❗ กรอกข้อมูลที่จำเป็น', 'error'); return false }
        const id = 'SA-' + String(APPTS.length + 1).padStart(3,'0')
        APPTS.unshift({ id, claimNo, customer, plate: document.getElementById('sa-plate').value.trim(),
          model: document.getElementById('sa-model').value.trim(), insurer: document.getElementById('sa-ins').value,
          surveyor: '', date, time: document.getElementById('sa-time').value,
          status: 'pending', damage: document.getElementById('sa-dmg').value.trim() })
        showToast(`สร้างนัดช่างประกัน ${id} แล้ว · แจ้งบริษัทประกัน`, 'success')
        render()
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
