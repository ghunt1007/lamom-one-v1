/**
 * Recall Management — จัดการการเรียกคืนรถ
 * Route: /service/recall
 */
import { formatDate, formatCurrency, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, createDoc, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const RECALL_STATUS = {
  open:       { label: 'เปิดอยู่', color: 'danger' },
  in_progress:{ label: 'กำลังดำเนินการ', color: 'warning' },
  completed:  { label: 'เสร็จสิ้น', color: 'success' },
  closed:     { label: 'ปิดแล้ว', color: 'secondary' },
}

const VEHICLE_STATUS = {
  pending_contact: { label: 'ยังไม่ติดต่อ', color: 'secondary' },
  contacted:       { label: 'ติดต่อแล้ว', color: 'primary' },
  scheduled:       { label: 'นัดแล้ว', color: 'warning' },
  fixed:           { label: 'แก้ไขแล้ว', color: 'success' },
  declined:        { label: 'ปฏิเสธ', color: 'danger' },
}

function addDays(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export default async function RecallManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let recalls = []
  let vehicles = []
  let selectedRecall = null
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [r, v] = await Promise.all([
        listDocs('recall_campaigns', [], 'issueDate', 'desc', 200),
        listDocs('recall_campaign_vehicles', [], 'plate', 'asc', 500),
      ])
      // softDelete() ไม่ได้ลบเอกสารจริง แค่ตั้ง deleted:true — ถ้าไม่กรองออก แคมเปญ/รถที่ "ลบ" ไปแล้วจะโผล่กลับมา
      // ทุกครั้งที่โหลดหน้านี้ใหม่ (บั๊กคลาสเดียวกับที่เจอซ้ำหลายจุดในระบบนี้ — Customers/Staff/Stock/Bookings)
      recalls = r.filter(x => !x.deleted); vehicles = v.filter(x => !x.deleted)
      if (selectedRecall) selectedRecall = recalls.find(x => x.id === selectedRecall.id) || null
    } catch (e) { recalls = []; vehicles = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const open = recalls.filter(r => r.status === 'open').length
    const critical = recalls.filter(r => r.severity === 'critical').length
    const totalPending = recalls.reduce((a, r) => a + r.pending, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔔 Recall Management</div>
            <div class="page-subtitle">จัดการการเรียกคืนและแจ้งเตือนรถ</div>
          </div>
          <button class="btn btn-primary" id="new-recall-btn">➕ สร้าง Recall Campaign</button>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 Recall ทั้งหมด', recalls.length, 'primary')}
          ${kpi('🔴 เปิดอยู่', open, open > 0 ? 'danger' : 'secondary')}
          ${kpi('⚠️ Critical', critical, critical > 0 ? 'danger' : 'secondary')}
          ${kpi('🚗 รอซ่อม', totalPending + ' คัน', totalPending > 0 ? 'warning' : 'secondary')}
        </div>

        <div style="display:grid;grid-template-columns:${selectedRecall ? '1fr 1fr' : '1fr'};gap:14px">
          <!-- Recall list -->
          <div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${recalls.map(r => {
                const st = RECALL_STATUS[r.status]
                const progressPct = Math.round(r.fixed / r.totalVehicles * 100)
                const isSelected = selectedRecall?.id === r.id
                return `<div class="card recall-card" data-id="${r.id}" style="padding:14px;cursor:pointer;border-left:3px solid var(--${st?.color});${isSelected?'box-shadow:0 0 0 2px var(--primary)':''}">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <div>
                      <div style="font-weight:700;font-size:0.88rem">${escHtml(r.title)}</div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(r.recallNo)} · ${escHtml(r.brand)} ${escHtml(r.model)}</div>
                    </div>
                    <div style="text-align:right">
                      <span class="badge badge-${st?.color}" style="font-size:0.65rem">${st?.label}</span>
                      <div style="font-size:0.65rem;margin-top:2px;color:${r.severity==='critical'?'var(--danger)':'var(--warning)'}">${r.severity === 'critical' ? '🔴 Critical' : '🟡 High'}</div>
                      <button class="btn btn-xs btn-secondary del-recall-btn" data-id="${r.id}" title="ลบ Recall Campaign นี้" style="margin-top:4px">🗑</button>
                    </div>
                  </div>
                  <div style="margin-bottom:6px">
                    <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:2px">
                      <span style="color:var(--text-muted)">ความคืบหน้า ${r.fixed}/${r.totalVehicles} คัน</span>
                      <span style="font-weight:700;color:${progressPct>=80?'var(--success)':progressPct>=50?'var(--warning)':'var(--danger)'}">${progressPct}%</span>
                    </div>
                    <div style="background:var(--surface-2);border-radius:3px;height:6px">
                      <div style="width:${progressPct}%;background:${progressPct>=80?'var(--success)':progressPct>=50?'var(--warning)':'var(--danger)'};height:6px;border-radius:3px"></div>
                    </div>
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">Deadline: ${formatDate(r.deadline)}</div>
                </div>`
              }).join('')}
            </div>
          </div>

          <!-- Vehicle list for selected recall -->
          ${selectedRecall ? `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-weight:700;font-size:0.9rem">🚗 รายการรถใน ${escHtml(selectedRecall.id)}</div>
                <button class="btn btn-xs btn-primary" id="add-recall-veh-btn">➕ เพิ่มรถ</button>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">${escHtml(selectedRecall.fixDescription)}</div>
              ${vehicles.filter(v => v.recallId === selectedRecall.id).map(v => {
                const vs = VEHICLE_STATUS[v.vStatus]
                return `<div class="card" style="padding:10px;margin-bottom:6px;border-left:3px solid var(--${vs?.color})">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <div>
                      <div style="font-weight:600;font-size:0.83rem">${escHtml(v.plate)} — ${escHtml(v.owner)}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(v.phone)}</div>
                    </div>
                    <span class="badge badge-${vs?.color}" style="font-size:0.62rem">${vs?.label}</span>
                  </div>
                  ${v.appointDate ? `<div style="font-size:0.72rem;color:var(--text-muted)">นัด: ${formatDate(v.appointDate)}</div>` : ''}
                  <div style="display:flex;gap:4px;margin-top:6px">
                    ${v.vStatus === 'pending_contact' ? `<button class="btn btn-xs btn-primary contact-veh-btn" data-id="${escHtml(v.id)}">📞 ติดต่อ</button>` : ''}
                    ${v.vStatus === 'contacted' ? `<button class="btn btn-xs btn-warning schedule-veh-btn" data-id="${escHtml(v.id)}">📅 นัด</button>` : ''}
                    ${v.vStatus === 'scheduled' ? `<button class="btn btn-xs btn-success fix-veh-btn" data-id="${escHtml(v.id)}">✅ แก้ไขแล้ว</button>` : ''}
                  </div>
                </div>`
              }).join('')}
              ${!vehicles.filter(v => v.recallId === selectedRecall.id).length ? `<div style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:14px">ยังไม่มีรถในแคมเปญนี้ — กด "➕ เพิ่มรถ"</div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.recall-card').forEach(el => el.addEventListener('click', () => {
      const r = recalls.find(x => x.id === el.dataset.id)
      selectedRecall = selectedRecall?.id === r?.id ? null : r
      renderPage()
    }))

    container.querySelectorAll('.del-recall-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const r = recalls.find(x => x.id === b.dataset.id)
      if (!r) return
      if (!await confirmDialog({ title: 'ลบ Recall Campaign', message: `ลบ "${escHtml(r.title)}" (${escHtml(r.recallNo)})? รถที่อยู่ในแคมเปญนี้จะถูกลบไปด้วย — การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบ', danger: true })) return
      try {
        await Promise.all(vehicles.filter(v => v.recallId === r.id).map(v => softDelete('recall_campaign_vehicles', v.id)))
        await softDelete('recall_campaigns', r.id)
        if (selectedRecall?.id === r.id) selectedRecall = null
        showToast('🗑 ลบ Recall Campaign แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))

    // เดิม recall_campaign_vehicles อ่าน/อัปเดตสถานะรถได้เท่านั้น ไม่มีทางเพิ่มรถเข้าแคมเปญเลยจากในแอป —
    // ทำให้ "สร้าง Recall Campaign" ข้างบนใช้งานได้จริงแค่ครึ่งเดียว (มีแคมเปญแต่ไม่มีรถให้ติดตามจริง)
    document.getElementById('add-recall-veh-btn')?.addEventListener('click', e => { e.stopPropagation()
      if (!selectedRecall) return
      const { el } = openModal({
        title: '➕ เพิ่มรถเข้า Recall Campaign',
        size: 'sm',
        body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ทะเบียนรถ *</label>
            <input class="input" id="nv-plate" style="width:100%;margin-top:4px" placeholder="1กข-1234"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อเจ้าของรถ *</label>
            <input class="input" id="nv-owner" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เบอร์โทร</label>
            <input class="input" id="nv-phone" style="width:100%;margin-top:4px" placeholder="08xxxxxxxx"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">VIN</label>
            <input class="input" id="nv-vin" style="width:100%;margin-top:4px"></div>
        </div>`,
        confirmText: '💾 เพิ่ม',
        onConfirm: async () => {
          const plate = el.querySelector('#nv-plate')?.value?.trim()
          const owner = el.querySelector('#nv-owner')?.value?.trim()
          if (!plate || !owner) { showToast('กรุณากรอกทะเบียนและชื่อเจ้าของรถ', 'warning'); return false }
          try {
            await createDoc('recall_campaign_vehicles', {
              recallId: selectedRecall.id,
              plate, owner,
              phone: el.querySelector('#nv-phone')?.value?.trim() || '',
              vin: el.querySelector('#nv-vin')?.value?.trim() || '',
              vStatus: 'pending_contact',
            })
            showToast('✅ เพิ่มรถเข้า Recall Campaign แล้ว', 'success')
            await loadData()
            return true
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        },
      })
    })

    // เดิมทั้งหน้านี้และ RecallTracker.js (/service/recall-tracker) อ่านจาก recall_campaigns อย่างเดียว
    // ไม่มีทางสร้างแคมเปญใหม่ได้เลยจากในแอป (ต้องเข้า Firestore console ตรงเท่านั้น) — ทำให้ทั้งฟีเจอร์ Recall
    // ใช้งานจริงไม่ได้เลยในระบบที่ยังไม่มีข้อมูล seed มาก่อน พบจากการทดสอบคลิกใช้งานจริง
    document.getElementById('new-recall-btn')?.addEventListener('click', () => {
      const { el, close } = openModal({
        title: '➕ สร้าง Recall Campaign ใหม่',
        size: 'sm',
        body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">หัวข้อ Recall *</label>
            <input class="input" id="nr-title" style="width:100%;margin-top:4px" placeholder="เช่น เปลี่ยนปั๊มเบรก"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เลข Recall *</label>
            <input class="input" id="nr-no" style="width:100%;margin-top:4px" placeholder="เช่น RC-2026-001"></div>
          <div style="display:flex;gap:8px">
            <div style="flex:1"><label style="font-size:0.72rem;color:var(--text-muted)">ยี่ห้อ *</label>
              <input class="input" id="nr-brand" style="width:100%;margin-top:4px"></div>
            <div style="flex:1"><label style="font-size:0.72rem;color:var(--text-muted)">รุ่น *</label>
              <input class="input" id="nr-model" style="width:100%;margin-top:4px"></div>
          </div>
          <div style="display:flex;gap:8px">
            <div style="flex:1"><label style="font-size:0.72rem;color:var(--text-muted)">ความรุนแรง</label>
              <select class="input" id="nr-sev" style="width:100%;margin-top:4px">
                <option value="critical">🔴 วิกฤต</option><option value="high" selected>🟡 สูง</option>
                <option value="medium">กลาง</option><option value="low">ต่ำ</option>
              </select></div>
            <div style="flex:1"><label style="font-size:0.72rem;color:var(--text-muted)">Deadline</label>
              <input class="input" type="date" id="nr-deadline" style="width:100%;margin-top:4px"></div>
          </div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">จำนวนรถที่เกี่ยวข้อง (คัน) *</label>
            <input class="input" type="number" id="nr-total" style="width:100%;margin-top:4px" placeholder="0"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">รายละเอียดการแก้ไข</label>
            <textarea class="input" id="nr-desc" rows="2" style="width:100%;margin-top:4px" placeholder="สิ่งที่ต้องแก้ไข/เปลี่ยนให้ลูกค้า"></textarea></div>
        </div>`,
        confirmText: '💾 สร้าง',
        onConfirm: async () => {
          const title = document.getElementById('nr-title')?.value?.trim()
          const recallNo = document.getElementById('nr-no')?.value?.trim()
          const brand = document.getElementById('nr-brand')?.value?.trim()
          const model = document.getElementById('nr-model')?.value?.trim()
          const total = Math.max(0, Number(document.getElementById('nr-total')?.value) || 0)
          if (!title || !recallNo || !brand || !model) { showToast('กรุณากรอกข้อมูลที่มี * ให้ครบ', 'warning'); return false }
          try {
            await createDoc('recall_campaigns', {
              title, recallNo, brand, model, total,
              severity: document.getElementById('nr-sev')?.value || 'medium',
              deadline: document.getElementById('nr-deadline')?.value || '',
              fixDescription: document.getElementById('nr-desc')?.value?.trim() || '',
              status: 'open', totalVehicles: total, fixed: 0, pending: total,
              issueDate: addDays(0),
            })
            showToast('✅ สร้าง Recall Campaign แล้ว', 'success')
            await loadData()
            return true
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
        },
      })
    })

    container.querySelectorAll('.contact-veh-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const v = vehicles.find(x => x.id === b.dataset.id)
      if (!v) return
      try {
        await updateDocData('recall_campaign_vehicles', v.id, { vStatus: 'contacted' })
        showToast('📞 ติดต่อลูกค้าแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.schedule-veh-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const v = vehicles.find(x => x.id === b.dataset.id)
      if (!v) return
      try {
        await updateDocData('recall_campaign_vehicles', v.id, { vStatus: 'scheduled', appointDate: addDays(5) })
        showToast('📅 นัดหมายแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.fix-veh-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const v = vehicles.find(x => x.id === b.dataset.id)
      if (!v) return
      const recall = recalls.find(r => r.id === v.recallId)
      try {
        await updateDocData('recall_campaign_vehicles', v.id, { vStatus: 'fixed' })
        if (recall) await updateDocData('recall_campaigns', recall.id, { fixed: recall.fixed + 1, pending: Math.max(0, recall.pending - 1) })
        showToast('✅ บันทึกการแก้ไขแล้ว!', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
