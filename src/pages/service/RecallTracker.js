/**
 * Recall Tracker Detail — ติดตาม Recall ต่อ VIN + แจ้งลูกค้า
 * Route: /service/recall-tracker
 */
import { formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// เดิมหน้านี้มี RECALLS เป็น const array ปลอมแยกต่างหาก ไม่เชื่อมกับระบบ Recall จริงที่ RecallManagement.js ใช้
// (collection 'recall_campaigns') ทำให้ recall ที่สร้าง/อัปเดตจริงจากหน้า RecallManagement ไม่โผล่ที่นี่เลย
// แก้โดยอ่านจาก 'recall_campaigns' ตัวเดียวกันแทน (ดู loadData ด้านล่าง) — mapRecallFields() แปลง field name
// ให้ตรงกับที่ template ในไฟล์นี้คาดหวัง (campaign/model/issue/announced) จากของจริง (recallNo/brand+model/fixDescription/issueDate)
function mapRecallFields(r) {
  return { id: r.id, campaign: r.recallNo || r.id, model: [r.brand, r.model].filter(Boolean).join(' ') || '—', issue: r.fixDescription || '', severity: r.severity || 'medium', announced: r.issueDate || '', deadline: r.deadline || '' }
}

const SEV = { critical:{ label:'วิกฤต', color:'var(--danger)' }, high:{ label:'สูง', color:'#FF6F00' }, medium:{ label:'กลาง', color:'var(--warning)' }, low:{ label:'ต่ำ', color:'var(--text-muted)' } }
const WST = { pending:{ label:'ยังไม่ดำเนินการ', color:'var(--danger)' }, notified:{ label:'แจ้งแล้ว', color:'var(--warning)' }, completed:{ label:'เสร็จแล้ว', color:'var(--success)' } }

export default async function RecallTrackerPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let filterRecall = 'all'
  let filterWst = 'all'
  let VEHICLES = []
  let RECALLS = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [v, campaigns] = await Promise.all([
        listDocs('recall_tracker_vehicles', [], 'plate', 'asc', 500),
        listDocs('recall_campaigns', [], 'issueDate', 'desc', 200),
      ])
      VEHICLES = v
      RECALLS = campaigns.map(mapRecallFields)
    } catch (e) { VEHICLES = []; RECALLS = [] }
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
            <button class="btn btn-secondary" id="add-vehicle-btn">➕ เพิ่มรถเข้า Recall</button>
            <button class="btn btn-secondary" id="notify-pending-btn">📢 แจ้งทั้งหมด (Pending)</button>
            <button class="btn btn-primary" id="report-btn">📊 รายงาน</button>
          </div>
        </div>

        <!-- Recall campaigns -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${RECALLS.map(r => {
            const s = SEV[r.severity] || SEV.medium
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
    // เดิมหน้านี้ไม่มีทางเพิ่มรถเข้า recall_tracker_vehicles ได้เลยแม้แต่จุดเดียว (ไม่มีปุ่ม/ไม่มีจุดไหนเรียก
    // createDoc ในทั้งไฟล์) ต้องพึ่ง seedDemoData() เท่านั้น — เมื่อมี Recall จริงเกิดขึ้น (สร้างแคมเปญใหม่ที่
    // RecallManagement.js) ไม่มีทางเอารถที่ได้รับผลกระทบจริงเข้ามาติดตามในหน้านี้ได้เลย เพิ่มปุ่มนี้ให้ค้นรถจริง
    // จากใบจอง (bookings) แล้วผูกกับแคมเปญจริง (RECALLS ที่อ่านจาก recall_campaigns อยู่แล้ว) — ถ้า VIN นั้น
    // มีอยู่ในระบบติดตามแล้ว จะเพิ่มแคมเปญนี้เข้าไปในรถคันเดิม ไม่สร้างแถวซ้ำ
    document.getElementById('add-vehicle-btn')?.addEventListener('click', () => {
      if (!RECALLS.length) { showToast('⚠️ ยังไม่มี Recall Campaign ในระบบ — สร้างที่หน้า Recall Management ก่อน', 'warning'); return }
      let matches = []
      let picked = null
      const { el } = openModal({
        title: '➕ เพิ่มรถเข้า Recall',
        size: 'sm',
        body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">Recall Campaign *</label>
            <select class="input" id="av-campaign" style="width:100%;margin-top:4px">${RECALLS.map(r => `<option value="${r.id}">${escHtml(r.campaign)} — ${escHtml(r.model)}</option>`).join('')}</select></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ค้นหารถจากใบจอง (VIN / ทะเบียน / ชื่อลูกค้า)</label>
            <input class="input" id="av-search" placeholder="พิมพ์เพื่อค้นหา..." style="width:100%;margin-top:4px"></div>
          <div id="av-results" style="max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:4px"></div>
          <div id="av-picked" style="font-size:0.76rem;color:var(--success)"></div>
        </div>`,
        confirmText: '➕ เพิ่ม',
        async onConfirm() {
          if (!picked) { showToast('⚠️ กรุณาเลือกรถก่อน', 'warning'); return false }
          const campaignId = document.getElementById('av-campaign')?.value
          const existing = VEHICLES.find(v => v.vin === picked.vin)
          try {
            if (existing) {
              if (existing.recalls.includes(campaignId)) { showToast('รถคันนี้อยู่ใน Recall นี้แล้ว', 'warning'); return false }
              await updateDocData('recall_tracker_vehicles', existing.id, {
                recalls: [...existing.recalls, campaignId],
                status: { ...existing.status, [campaignId]: 'pending' },
              })
            } else {
              await createDoc('recall_tracker_vehicles', {
                vin: picked.vin, plate: picked.plate, model: picked.model, owner: picked.owner, phone: picked.phone,
                recalls: [campaignId], status: { [campaignId]: 'pending' },
              })
            }
            showToast(`✅ เพิ่ม ${picked.owner} เข้า Recall แล้ว`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        }
      })
      let searchTimer = null
      el.querySelector('#av-search')?.addEventListener('input', e => {
        clearTimeout(searchTimer)
        const q = e.target.value.trim().toLowerCase()
        searchTimer = setTimeout(async () => {
          if (q.length < 2) { el.querySelector('#av-results').innerHTML = ''; return }
          let bookings = []
          try { bookings = await listDocs('bookings', [], 'createdAt', 'desc', 500) } catch { bookings = [] }
          matches = bookings.filter(b => !b.deleted && (
            (b.vin || '').toLowerCase().includes(q) || (b.whitePlate || '').toLowerCase().includes(q) || (b.custName || '').toLowerCase().includes(q)
          )).slice(0, 8)
          el.querySelector('#av-results').innerHTML = matches.map((b, i) => `
            <button type="button" class="btn btn-xs btn-secondary av-pick" data-i="${i}" style="text-align:left;justify-content:flex-start">
              ${escHtml(b.custName)} · ${escHtml(b.brand)} ${escHtml(b.model)} · VIN ${escHtml((b.vin||'').slice(-8))}
            </button>`).join('') || '<div style="font-size:0.72rem;color:var(--text-muted)">ไม่พบ</div>'
          el.querySelectorAll('.av-pick').forEach(btn => btn.addEventListener('click', () => {
            const b = matches[parseInt(btn.dataset.i)]
            picked = { vin: b.vin, plate: b.whitePlate || b.vin, model: [b.brand, b.model].filter(Boolean).join(' '), owner: b.custName, phone: b.phone || '' }
            el.querySelector('#av-picked').textContent = `✅ เลือกแล้ว: ${picked.owner} (${picked.model})`
          }))
        }, 300)
      })
    })
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
          <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่เข้ารับบริการ</label><input class="input" id="rc-date" type="date" value="${todayBangkok()}" style="width:100%;margin-top:4px"></div>
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
