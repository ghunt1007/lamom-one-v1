/**
 * Recall Tracker Detail — ติดตาม Recall ต่อ VIN + แจ้งลูกค้า
 * Route: /service/recall-tracker
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

const RECALLS = [
  { id:'RC001', campaign:'BYD-TH-2025-001', model:'BYD Atto 3 (MY2024)', issue:'อัปเดต Software BMS ป้องกันการชาร์จเกิน', severity:'medium', announced:'2025-08-15', deadline:'2026-02-15', parts:'Software update only', labor:0 },
  { id:'RC002', campaign:'BYD-TH-2025-002', model:'BYD Seal (MY2024-2025)', issue:'ตรวจสอบและเปลี่ยน Coolant Pump แบตเตอรี่', severity:'high', announced:'2025-10-01', deadline:'2026-04-01', parts:'Coolant Pump', labor:1200 },
  { id:'RC003', campaign:'MG-TH-2024-005', model:'MG ZS EV (MY2023)', issue:'อัปเดต Firmware ระบบเบรก ABS', severity:'critical', announced:'2024-12-01', deadline:'2025-12-01', parts:'Software update', labor:0 },
]

const SEV = { critical:{ label:'วิกฤต', color:'var(--danger)' }, high:{ label:'สูง', color:'#FF6F00' }, medium:{ label:'กลาง', color:'var(--warning)' }, low:{ label:'ต่ำ', color:'var(--text-muted)' } }
const WST = { pending:{ label:'ยังไม่ดำเนินการ', color:'var(--danger)' }, notified:{ label:'แจ้งแล้ว', color:'var(--warning)' }, completed:{ label:'เสร็จแล้ว', color:'var(--success)' } }

export default async function RecallTrackerPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let filterRecall = 'all'
  let filterWst = 'all'
  let VEHICLES = []
  let loading = true

  async function loadData() {
    loading = true
    try { VEHICLES = await listDocs('recall_tracker_vehicles', [], 'plate', 'asc', 500) } catch (e) { VEHICLES = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const pending = VEHICLES.filter(v => Object.values(v.status).some(s => s === 'pending')).length
    const notified = VEHICLES.filter(v => Object.values(v.status).some(s => s === 'notified')).length
    const completed = VEHICLES.filter(v => Object.values(v.status).every(s => s === 'completed')).length

    let rows = VEHICLES
    if (filterRecall !== 'all') rows = rows.filter(v => v.recalls.includes(filterRecall))
    if (filterWst !== 'all') rows = rows.filter(v => Object.values(v.status).some(s => s === filterWst))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔔 Recall Tracker (Detail)</div>
            <div class="page-subtitle">ติดตามสถานะ Recall ต่อ VIN · ${VEHICLES.length} คัน · ${RECALLS.length} แคมเปญ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="notify-pending-btn">📢 แจ้งทั้งหมด (Pending)</button>
            <button class="btn btn-primary" id="report-btn">📊 รายงาน</button>
          </div>
        </div>

        <!-- Recall campaigns -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${RECALLS.map(r => {
            const s = SEV[r.severity]
            const done = VEHICLES.filter(v=>v.recalls.includes(r.id) && v.status[r.id]==='completed').length
            const total = VEHICLES.filter(v=>v.recalls.includes(r.id)).length
            return `
              <div class="card" style="padding:14px;border-left:4px solid ${s.color}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                  <div style="font-size:0.72rem;font-weight:700;font-family:monospace">${r.campaign}</div>
                  <span style="font-size:0.62rem;background:${s.color};color:#fff;padding:2px 7px;border-radius:8px">${s.label}</span>
                </div>
                <div style="font-size:0.78rem;font-weight:700;margin-bottom:4px">${r.model}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">${r.issue}</div>
                <div style="height:6px;background:var(--surface-2);border-radius:3px;margin-bottom:4px">
                  <div style="height:100%;width:${total?Math.round(done/total*100):0}%;background:var(--success);border-radius:3px"></div>
                </div>
                <div style="font-size:0.68rem;color:var(--text-muted)">${done}/${total} คัน · Deadline ${formatDate(r.deadline)}</div>
              </div>`
          }).join('')}
        </div>

        <!-- Summary stats -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          ${sc('⚠️ ยังไม่ดำเนินการ', pending+' คัน', 'var(--danger)')}
          ${sc('📢 แจ้งแล้ว', notified+' คัน', 'var(--warning)')}
          ${sc('✅ เสร็จแล้ว', completed+' คัน', 'var(--success)')}
          ${sc('🚗 รถทั้งหมด', VEHICLES.length+' คัน', 'var(--primary)')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <select class="input" id="sel-recall" style="min-width:200px">
            <option value="all">ทุก Recall Campaign</option>
            ${RECALLS.map(r=>`<option value="${r.id}" ${filterRecall===r.id?'selected':''}>${r.campaign}</option>`).join('')}
          </select>
          <select class="input" id="sel-wst" style="min-width:160px">
            <option value="all">ทุกสถานะ</option>
            ${Object.entries(WST).map(([k,v])=>`<option value="${k}" ${filterWst===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>

        <!-- Table -->
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:820px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
              <th style="padding:10px 12px;text-align:left">VIN / ทะเบียน</th>
              <th>รุ่น</th><th>เจ้าของ</th><th>Recall</th>
              <th style="text-align:center">สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              ${rows.map(v => {
                const rc = RECALLS.find(r => v.recalls.includes(r.id))
                const wst = v.status[v.recalls[0]]
                const w = WST[wst]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.78rem">
                  <td style="padding:9px 12px">
                    <div style="font-weight:700;font-size:0.76rem;font-family:monospace">${v.vin.slice(-10)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${v.plate}</div>
                  </td>
                  <td style="font-size:0.76rem">${v.model}</td>
                  <td>
                    <div style="font-size:0.78rem;font-weight:600">${v.owner}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${v.phone}</div>
                  </td>
                  <td style="font-size:0.7rem;font-family:monospace;color:var(--text-muted)">${rc?.campaign||'—'}</td>
                  <td style="text-align:center"><span style="font-size:0.64rem;background:${w?.color};color:#fff;padding:2px 8px;border-radius:10px">${w?.label||wst}</span></td>
                  <td>
                    <div style="display:flex;gap:5px">
                      ${wst==='pending'?`<button class="btn btn-xs btn-primary notify-btn" data-vin="${v.vin}" style="font-size:0.68rem">📢 แจ้ง</button>`:''}
                      ${wst==='notified'?`<button class="btn btn-xs btn-secondary done-btn" data-vin="${v.vin}" style="font-size:0.68rem">✅ บันทึกซ่อม</button>`:''}
                      <button class="btn btn-xs btn-secondary hist-btn" data-vin="${v.vin}" style="font-size:0.68rem">ประวัติ</button>
                    </div>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`

    document.getElementById('sel-recall')?.addEventListener('change', e => { filterRecall=e.target.value; render() })
    document.getElementById('sel-wst')?.addEventListener('change', e => { filterWst=e.target.value; render() })
    document.getElementById('notify-pending-btn')?.addEventListener('click', async () => {
      const toNotify = VEHICLES.filter(v=>Object.values(v.status).some(s=>s==='pending'))
      try {
        await Promise.all(toNotify.map(v => {
          const newStatus = { ...v.status }
          Object.keys(newStatus).forEach(k => { if (newStatus[k]==='pending') newStatus[k]='notified' })
          return updateDocData('recall_tracker_vehicles', v.id, { status: newStatus })
        }))
        showToast(`📢 แจ้ง ${toNotify.length} เจ้าของรถแล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    document.getElementById('report-btn')?.addEventListener('click', () => {
      const rows = VEHICLES.flatMap(v => v.recalls.map(rid => {
        const rc = RECALLS.find(r => r.id === rid)
        return {
          'VIN': v.vin,
          'ทะเบียน': v.plate,
          'รุ่น': v.model,
          'เจ้าของ': v.owner,
          'เบอร์โทร': v.phone,
          'แคมเปญ': rc?.campaign || rid,
          'ปัญหา': rc?.issue || '',
          'ความเร่งด่วน': rc ? (SEV[rc.severity]?.label || rc.severity) : '',
          'Deadline': rc?.deadline || '',
          'สถานะ': WST[v.status[rid] || 'pending']?.label || (v.status[rid] || 'pending'),
        }
      }))
      exportToExcel(rows, 'Recall_Tracker_Report.xlsx', 'Recall')
      showToast(`📊 Export รายงาน Recall ${rows.length} รายการแล้ว`, 'success')
    })
    container.querySelectorAll('.notify-btn').forEach(b => b.addEventListener('click', async () => {
      const v = VEHICLES.find(x=>x.vin===b.dataset.vin)
      if (!v) return
      const newStatus = { ...v.status }
      Object.keys(newStatus).forEach(k=>{if(newStatus[k]==='pending')newStatus[k]='notified'})
      try {
        await updateDocData('recall_tracker_vehicles', v.id, { status: newStatus })
        showToast(`📢 แจ้ง ${v.owner} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.done-btn').forEach(b => b.addEventListener('click', () => {
      openModal({ title:'✅ บันทึกงาน Recall', size:'xs',
        body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่เข้ารับบริการ</label><input class="input" id="rc-date" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ช่างผู้รับผิดชอบ</label><input class="input" id="rc-tech" placeholder="ชื่อช่าง" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">หมายเหตุ</label><input class="input" id="rc-note" placeholder="ผลการซ่อม..." style="width:100%;margin-top:4px"></div>
        </div>`,
        confirmText:'✅ บันทึก',
        async onConfirm() {
          const v = VEHICLES.find(x=>x.vin===b.dataset.vin)
          if (!v) return
          const newStatus = { ...v.status }
          Object.keys(newStatus).forEach(k=>{newStatus[k]='completed'})
          try {
            await updateDocData('recall_tracker_vehicles', v.id, { status: newStatus })
            showToast(`✅ บันทึก Recall เสร็จสมบูรณ์`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:12px 14px">
      <div style="font-size:0.7rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
