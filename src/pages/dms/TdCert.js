/**
 * Test Drive Certificate — ใบรับรองการทดลองขับ
 * Route: /dms/td-cert
 */
import { formatDate, formatDateTime } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default async function TdCertPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let certs = []
  let loading = true

  async function loadData() {
    loading = true
    try { certs = await listDocs('test_drive_certs', [], 'date', 'desc', 200) } catch (e) { certs = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  let selDate = ''

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const rows = selDate ? certs.filter(c => c.date === selDate) : certs
    const signed   = certs.filter(c => c.signed).length
    const unsigned = certs.filter(c => !c.signed).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Test Drive Certificate</div>
            <div class="page-subtitle">ใบรับรองการทดลองขับ · บันทึกก่อน-หลัง · ${certs.length} ใบ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="print-all-btn">🖨 พิมพ์ทั้งหมด</button>
            <button class="btn btn-primary" id="new-cert-btn">+ สร้างใบใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📋 ทั้งหมด', certs.length+' ใบ', 'var(--primary)')}
          ${sc('✅ เซ็นแล้ว', signed+' ใบ', 'var(--success)')}
          ${sc('⏳ รอเซ็น', unsigned+' ใบ', 'var(--warning)')}
          ${sc('🚗 วันนี้', certs.filter(c=>c.date===new Date().toISOString().slice(0,10)).length+' ใบ', 'var(--text)')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input class="input" id="date-filter" type="date" value="${selDate}" style="width:180px">
          <button class="btn btn-secondary" id="clear-date">ทั้งหมด</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${rows.map(c => `
            <div class="card cert-row" data-id="${escHtml(c.id)}" style="padding:14px;cursor:pointer;border-left:3px solid ${c.signed?'var(--success)':'var(--warning)'}">
              <div style="display:flex;align-items:flex-start;gap:14px">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span style="font-weight:700;font-size:0.88rem">${escHtml(c.customer)}</span>
                    <span style="font-size:0.68rem;color:var(--text-muted)">${escHtml(c.phone)}</span>
                    <span style="font-size:0.62rem;background:${c.signed?'var(--success)':'var(--warning)'};color:#fff;padding:1px 8px;border-radius:10px">${c.signed?'✅ เซ็นแล้ว':'⏳ รอเซ็น'}</span>
                  </div>
                  <div style="display:flex;gap:16px;font-size:0.74rem;color:var(--text-muted)">
                    <span>🚗 ${escHtml(c.model)}</span>
                    <span>🔑 ${escHtml(c.plate)}</span>
                    <span>📅 ${formatDate(c.date)} ${escHtml(c.time)}</span>
                    <span>📍 ${escHtml(String(c.km))} km</span>
                    <span>⛽ ${escHtml(c.fuel)}</span>
                    <span>👤 ${escHtml(c.staff)}</span>
                  </div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  ${!c.signed?`<button class="btn btn-xs btn-primary sign-btn" data-id="${escHtml(c.id)}" style="font-size:0.7rem">✍️ เซ็น</button>`:''}
                  <button class="btn btn-xs btn-secondary print-btn" data-id="${escHtml(c.id)}" style="font-size:0.7rem">🖨 พิมพ์</button>
                </div>
              </div>
            </div>`).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    document.getElementById('date-filter')?.addEventListener('change', e => { selDate=e.target.value; render() })
    document.getElementById('clear-date')?.addEventListener('click', () => { selDate=''; render() })
    document.getElementById('print-all-btn')?.addEventListener('click', () => {
      const printRows = selDate ? certs.filter(c => c.date === selDate) : certs
      if (!printRows.length) { showToast('ไม่มีรายการ', 'warning'); return }
      const win = window.open('', '_blank', 'width=900,height=700')
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบรับรอง Test Drive</title>
        <style>body{font-family:sans-serif;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f5f5f5}h2{margin:0 0 12px}.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px}@media print{.no-print{display:none}}</style>
      </head><body>
        <h2>📋 รายงานใบรับรอง Test Drive${selDate ? ' — ' + selDate : ''}</h2>
        <table><thead><tr><th>เลขที่</th><th>ลูกค้า</th><th>รุ่น</th><th>ทะเบียน</th><th>วันที่</th><th>km</th><th>พนักงาน</th><th>เซ็น</th></tr></thead>
        <tbody>${printRows.map(c => `<tr><td>${escHtml(c.id)}</td><td>${escHtml(c.customer)}</td><td>${escHtml(c.model)}</td><td>${escHtml(c.plate)}</td><td>${escHtml(c.date)} ${escHtml(c.time)}</td><td>${escHtml(String(c.km))}</td><td>${escHtml(c.staff)}</td><td>${c.signed ? '✅' : '—'}</td></tr>`).join('')}</tbody>
        </table><p style="margin-top:12px;color:#666">พิมพ์วันที่: ${new Date().toLocaleString('th-TH')} · รวม ${printRows.length} รายการ</p>
        <script>window.print()</script></body></html>`)
      win.document.close()
      showToast(`🖨 พิมพ์ใบรับรอง ${printRows.length} รายการแล้ว`, 'success')
    })
    document.getElementById('new-cert-btn')?.addEventListener('click', () => openNewModal())
    container.querySelectorAll('.sign-btn').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation()
      const c = certs.find(x=>x.id===b.dataset.id)
      if (!c) return
      try {
        await updateDocData('test_drive_certs', c.id, { signed: true })
        showToast('✅ บันทึกลายเซ็นแล้ว','success')
        await loadData()
      } catch (err) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.print-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation()
      const c = certs.find(x=>x.id===b.dataset.id)
      if(c) showToast(`🖨 พิมพ์ใบรับรองทดลองขับ ${c.customer} - ${c.model} แล้ว`,'success')
    }))
    container.querySelectorAll('.cert-row').forEach(el => el.addEventListener('click', () => {
      const c = certs.find(x=>x.id===el.dataset.id)
      if(c) openDetailModal(c)
    }))
  }

  function openDetailModal(c) {
    openModal({
      title:'📋 ใบรับรองทดลองขับ — ' + escHtml(c.id), size:'sm',
      body:`<div style="font-size:0.8rem;border:1px solid var(--border);border-radius:8px;padding:14px">
        <div style="text-align:center;font-weight:700;font-size:1rem;margin-bottom:12px">LAMOM ONE — ใบรับรองการทดลองขับรถ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.78rem">
          <div><b>ลูกค้า:</b> ${escHtml(c.customer)}</div><div><b>เบอร์:</b> ${escHtml(c.phone)}</div>
          <div><b>รุ่นรถ:</b> ${escHtml(c.model)}</div><div><b>ทะเบียน:</b> ${escHtml(c.plate)}</div>
          <div><b>วันที่:</b> ${formatDate(c.date)} ${escHtml(c.time)}</div><div><b>พนักงาน:</b> ${escHtml(c.staff)}</div>
          <div><b>ระยะทาง:</b> ${escHtml(String(c.km))} km</div><div><b>น้ำมัน/แบต:</b> ${escHtml(c.fuel)}</div>
          <div><b>ความเสียหาย:</b> ${escHtml(c.damage)}</div><div><b>สถานะ:</b> ${c.signed?'✅ เซ็นแล้ว':'⏳ รอเซ็น'}</div>
        </div>
        <div style="margin-top:14px;border-top:1px dashed var(--border);padding-top:10px;display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted)">
          <span>ลายเซ็นลูกค้า: ____________________</span>
          <span>ลายเซ็นพนักงาน: ____________________</span>
        </div>
      </div>`,
      confirmText:'🖨 พิมพ์ / ยืนยันเซ็น',
      async onConfirm(){
        try {
          await updateDocData('test_drive_certs', c.id, { signed: true })
          showToast(`🖨 พิมพ์ใบ ${c.id} — ${c.customer} (${c.model}) เซ็นรับแล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openNewModal() {
    openModal({
      title:'+ ใบรับรองทดลองขับใหม่', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อลูกค้า</label><input class="input" id="td-name" style="width:100%;margin-top:3px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เบอร์โทร</label><input class="input" id="td-phone" style="width:100%;margin-top:3px"></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่นรถ</label>
          <select class="input" id="td-model" style="width:100%;margin-top:3px">
            <option>BYD Atto 3</option><option>BYD Seal AWD</option><option>BYD Han</option><option>BYD Dolphin</option><option>MG ZS EV</option>
          </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่</label><input class="input" id="td-date" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;margin-top:3px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เวลา</label><input class="input" id="td-time" type="time" value="10:00" style="width:100%;margin-top:3px"></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">พนักงานดูแล</label>
          <select class="input" id="td-staff" style="width:100%;margin-top:3px">
            <option>พนักงาน A</option><option>พนักงาน B</option><option>พนักงาน C</option>
          </select></div>
      </div>`,
      confirmText:'📋 สร้างใบ',
      async onConfirm(){
        const name = document.getElementById('td-name')?.value?.trim()
        if(!name){ showToast('ใส่ชื่อลูกค้า','warning'); return false }
        try {
          await createDoc('test_drive_certs', {
            customer:name, phone:document.getElementById('td-phone')?.value||'-',
            model:document.getElementById('td-model')?.value||'BYD Atto 3',
            plate:'รอกำหนด', date:document.getElementById('td-date')?.value||new Date().toISOString().slice(0,10),
            time:document.getElementById('td-time')?.value||'10:00', km:0,
            staff:document.getElementById('td-staff')?.value||'พนักงาน A',
            fuel:'100%', damage:'ไม่มี', signed:false
          })
          showToast('📋 สร้างใบรับรองทดลองขับแล้ว','success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
