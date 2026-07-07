/**
 * Recall Management — จัดการการเรียกคืนรถ
 * Route: /service/recall
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

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

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

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
      recalls = r; vehicles = v
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
                      <div style="font-weight:700;font-size:0.88rem">${r.title}</div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">${r.recallNo} · ${r.brand} ${r.model}</div>
                    </div>
                    <div style="text-align:right">
                      <span class="badge badge-${st?.color}" style="font-size:0.65rem">${st?.label}</span>
                      <div style="font-size:0.65rem;margin-top:2px;color:${r.severity==='critical'?'var(--danger)':'var(--warning)'}">${r.severity === 'critical' ? '🔴 Critical' : '🟡 High'}</div>
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
              <div style="font-weight:700;margin-bottom:10px;font-size:0.9rem">🚗 รายการรถใน ${selectedRecall.id}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">${selectedRecall.fixDescription}</div>
              ${vehicles.filter(v => v.recallId === selectedRecall.id).map(v => {
                const vs = VEHICLE_STATUS[v.vStatus]
                return `<div class="card" style="padding:10px;margin-bottom:6px;border-left:3px solid var(--${vs?.color})">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <div>
                      <div style="font-weight:600;font-size:0.83rem">${v.plate} — ${v.owner}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">${v.phone}</div>
                    </div>
                    <span class="badge badge-${vs?.color}" style="font-size:0.62rem">${vs?.label}</span>
                  </div>
                  ${v.appointDate ? `<div style="font-size:0.72rem;color:var(--text-muted)">นัด: ${formatDate(v.appointDate)}</div>` : ''}
                  <div style="display:flex;gap:4px;margin-top:6px">
                    ${v.vStatus === 'pending_contact' ? `<button class="btn btn-xs btn-primary contact-veh-btn" data-vin="${v.vin}">📞 ติดต่อ</button>` : ''}
                    ${v.vStatus === 'contacted' ? `<button class="btn btn-xs btn-warning schedule-veh-btn" data-vin="${v.vin}">📅 นัด</button>` : ''}
                    ${v.vStatus === 'scheduled' ? `<button class="btn btn-xs btn-success fix-veh-btn" data-vin="${v.vin}">✅ แก้ไขแล้ว</button>` : ''}
                  </div>
                </div>`
              }).join('')}
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

    container.querySelectorAll('.contact-veh-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const v = vehicles.find(x => x.vin === b.dataset.vin)
      if (!v) return
      try {
        await updateDocData('recall_campaign_vehicles', v.id, { vStatus: 'contacted' })
        showToast('📞 ติดต่อลูกค้าแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.schedule-veh-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const v = vehicles.find(x => x.vin === b.dataset.vin)
      if (!v) return
      try {
        await updateDocData('recall_campaign_vehicles', v.id, { vStatus: 'scheduled', appointDate: addDays(5) })
        showToast('📅 นัดหมายแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.fix-veh-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const v = vehicles.find(x => x.vin === b.dataset.vin)
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
