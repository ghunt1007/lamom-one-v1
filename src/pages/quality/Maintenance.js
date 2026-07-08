/**
 * Equipment Maintenance Schedule — ตารางบำรุงรักษาอุปกรณ์โชว์รูม
 * Route: /quality/maintenance
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const STATUS_CFG = {
  ok:       { label:'ปกติ',       bg:'var(--success)',    icon:'✅' },
  due_soon: { label:'ใกล้ถึงเวลา', bg:'var(--warning)',    icon:'⚠️' },
  overdue:  { label:'เกินกำหนด',  bg:'var(--danger)',     icon:'🚨' },
}

const CAT_LABELS = { service:'ศูนย์บริการ', office:'สำนักงาน' }

export default async function MaintenancePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let EQUIPMENT = []
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { EQUIPMENT = await listDocs('maintenance_equipment', [], 'name', 'asc', 500) } catch (e) { EQUIPMENT = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function daysUntil(dateStr) {
    const d = new Date(dateStr)
    const today = new Date()
    return Math.ceil((d-today)/(1000*60*60*24))
  }

  function eqRow(eq) {
    const cfg   = STATUS_CFG[eq.status]
    const days  = daysUntil(eq.nextService)
    const daysStr = days < 0 ? 'เกิน '+Math.abs(days)+' วัน' : days===0 ? 'วันนี้!' : 'อีก '+days+' วัน'
    const daysColor = days < 0 ? 'var(--danger)' : days <= 7 ? 'var(--warning)' : 'var(--text-muted)'
    const srvBtn = '<button class="btn btn-xs btn-primary srv-btn" data-id="' + eq.id + '" style="font-size:0.68rem">🔧 บำรุงรักษา</button>'
    const catBadge = '<span style="font-size:0.62rem;background:var(--surface-2);padding:1px 7px;border-radius:8px">' + (CAT_LABELS[eq.category]||eq.category) + '</span>'
    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<div style="font-size:1.6rem">🔧</div>' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
            '<span style="font-weight:700;font-size:0.88rem">' + eq.name + '</span>' +
            catBadge +
            '<span style="font-size:0.62rem;background:' + cfg.bg + ';color:#fff;padding:1px 7px;border-radius:8px">' + cfg.icon + ' ' + cfg.label + '</span>' +
          '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">ช่างผู้รับผิดชอบ: ' + eq.technician + ' · รอบ: ทุก ' + eq.cycle + ' วัน</div>' +
          '<div style="display:flex;gap:14px;font-size:0.74rem">' +
            '<span>✅ บำรุงล่าสุด: ' + formatDate(eq.lastService) + '</span>' +
            '<span>📅 ครั้งถัดไป: ' + formatDate(eq.nextService) + '</span>' +
            '<span style="color:' + daysColor + ';font-weight:700">' + daysStr + '</span>' +
          '</div>' +
        '</div>' +
        '<div>' + srvBtn + '</div>' +
      '</div>' +
    '</div>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let rows = EQUIPMENT
    if (filterStatus !== 'all') rows = rows.filter(e=>e.status===filterStatus)

    const okCount      = EQUIPMENT.filter(e=>e.status==='ok').length
    const dueSoonCount = EQUIPMENT.filter(e=>e.status==='due_soon').length
    const overdueCount = EQUIPMENT.filter(e=>e.status==='overdue').length

    const statusBtns = ['all','ok','due_soon','overdue'].map(s=>{
      const lbl = s==='all'?'ทั้งหมด':STATUS_CFG[s].icon+' '+STATUS_CFG[s].label
      return '<button class="btn btn-xs ' + (filterStatus===s?'btn-primary':'btn-secondary') + ' stat-btn" data-s="' + s + '">' + lbl + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔧 Equipment Maintenance</div>
            <div class="page-subtitle">ตารางบำรุงรักษาอุปกรณ์ · ${EQUIPMENT.length} รายการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-eq-btn">+ เพิ่มอุปกรณ์</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('✅ ปกติ', okCount+' รายการ', 'var(--success)')}
          ${sc('⚠️ ใกล้ถึงเวลา', dueSoonCount+' รายการ', 'var(--warning)')}
          ${sc('🚨 เกินกำหนด', overdueCount+' รายการ', 'var(--danger)')}
          ${sc('🔧 รวมอุปกรณ์', EQUIPMENT.length+' ชิ้น', 'var(--primary)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${statusBtns}</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(e=>eqRow(e)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.srv-btn').forEach(b=>b.addEventListener('click',()=>{
      const eq=EQUIPMENT.find(x=>x.id===b.dataset.id)
      if(eq) openServiceModal(eq)
    }))
    document.getElementById('add-eq-btn')?.addEventListener('click', openAddEquipmentModal)
  }

  function openAddEquipmentModal() {
    const today = new Date().toISOString().slice(0, 10)
    openModal({
      title: '🔧 เพิ่มอุปกรณ์ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่ออุปกรณ์ *</label>
            <input id="eq-name" class="input" placeholder="เช่น Lift C, Scanner, ปั้มลม..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">หมวดหมู่</label>
              <select id="eq-cat" class="input">
                <option value="service">ศูนย์บริการ</option>
                <option value="office">สำนักงาน</option>
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รอบบำรุง (วัน)</label>
              <select id="eq-cycle" class="input">
                ${[30,60,90,180,365].map(c=>`<option value="${c}">${c} วัน</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">บำรุงล่าสุด</label>
              <input id="eq-last" type="date" class="input" value="${today}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ช่างผู้รับผิดชอบ</label>
              <input id="eq-tech" class="input" placeholder="ช่าง วิชัย / บริษัทภายนอก..."></div>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="eq-save">💾 เพิ่มอุปกรณ์</button>
        </div>
      `
    })
    document.getElementById('eq-save')?.addEventListener('click', async () => {
      const name = document.getElementById('eq-name')?.value.trim()
      if (!name) { showToast('⚠️ กรุณากรอกชื่ออุปกรณ์', 'warning'); return }
      const cycle = parseInt(document.getElementById('eq-cycle')?.value) || 90
      const lastService = document.getElementById('eq-last')?.value || today
      const nextDate = new Date(lastService)
      nextDate.setDate(nextDate.getDate() + cycle)
      const nextService = nextDate.toISOString().slice(0, 10)
      const daysLeft = Math.ceil((nextDate - new Date(today)) / (1000 * 60 * 60 * 24))
      const status = daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'due_soon' : 'ok'
      try {
        await createDoc('maintenance_equipment', {
          name,
          category: document.getElementById('eq-cat')?.value || 'service',
          lastService, nextService, cycle, status,
          technician: document.getElementById('eq-tech')?.value.trim() || '-',
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ เพิ่มอุปกรณ์ ' + name + ' แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openServiceModal(eq) {
    openModal({
      title: '🔧 บำรุงรักษา: ' + eq.name, size:'sm',
      body: `<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div style="background:var(--surface-2);border-radius:8px;padding:10px;font-size:0.76rem">
          <div>📋 รอบบำรุงรักษา: ทุก <strong>${eq.cycle} วัน</strong></div>
          <div style="margin-top:4px">👷 ช่างผู้รับผิดชอบ: <strong>${eq.technician}</strong></div>
          <div style="margin-top:4px">📅 ครั้งถัดไปจะเป็น: <strong>${new Date().toLocaleDateString('th-TH')}</strong></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">หมายเหตุการบำรุงรักษา</label>
          <textarea class="input" id="maint-note" style="width:100%;margin-top:3px;height:60px;resize:vertical" placeholder="รายละเอียดการซ่อมบำรุง..."></textarea></div>
      </div>`,
      confirmText: '✅ บันทึกการบำรุงรักษา',
      async onConfirm() {
        const today  = new Date().toISOString().slice(0, 10)
        const nextD  = new Date(today)
        nextD.setDate(nextD.getDate() + eq.cycle)
        try {
          await updateDocData('maintenance_equipment', eq.id, { lastService: today, nextService: nextD.toISOString().slice(0,10), status: 'ok' })
          showToast('✅ บันทึกการบำรุงรักษา: ' + eq.name + ' แล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
