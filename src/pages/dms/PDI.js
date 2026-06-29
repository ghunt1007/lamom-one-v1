import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { navigate } from '../../core/router.js'
import { pickVehicle } from '../../utils/vehiclePicker.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PDI_STATUS = {
  pending:    { label: '⏳ รอตรวจ',       badge: 'primary' },
  inprogress: { label: '🔧 กำลังตรวจ',    badge: 'warning' },
  passed:     { label: '✅ ผ่าน PDI',     badge: 'success' },
  failed:     { label: '❌ ไม่ผ่าน',       badge: 'danger'  },
  rectified:  { label: '🔁 แก้ไขแล้ว',   badge: 'accent'  },
}

// PDI checklist groups
const PDI_CHECKS = [
  { group: 'ภายนอก', items: ['สีตัวถัง ไม่มีรอย/บุบ', 'กระจกหน้า-หลัง ไม่มีรอยแตก', 'ไฟหน้า-หลัง ครบถ้วน', 'ยางและล้อ สภาพดี', 'กันชน และชิ้นส่วนภายนอก', 'ฝากระโปรง เปิด-ปิดปกติ'] },
  { group: 'ภายใน', items: ['เบาะและซุ้มล้อ ไม่มีรอย', 'ระบบ Infotainment ทำงานปกติ', 'เครื่องปรับอากาศ ทำงานปกติ', 'กระจกไฟฟ้า ครบทุกบาน', 'Safety belt ครบทุกเส้น', 'Airbag warning light ปกติ'] },
  { group: 'ระบบไฟฟ้า/แบตเตอรี่', items: ['ชาร์จแบตฯ ไม่มีข้อผิดพลาด', 'State of Health แบตฯ > 95%', 'แผง BMS ไม่มี error', 'ระบบ Regen ทำงานปกติ', 'Port ชาร์จ AC/DC ปกติ'] },
  { group: 'ขับขี่และความปลอดภัย', items: ['ระบบเบรก ABS ทำงานปกติ', 'ESP/Traction Control ปกติ', 'ADAS (Lane Keep, ACC) ปกติ', 'พวงมาลัย Power Steering ปกติ', 'ระบบ Over-the-Air อัพเดตล่าสุด'] },
  { group: 'เอกสารและอุปกรณ์', items: ['คู่มือรถและใบรับประกัน', 'สมุดบริการ', 'สายชาร์จ Type2 และ Adapter', 'กุญแจสำรอง', 'ยางอะไหล่หรืออุปกรณ์เสริม'] },
]

const DEMO_PDI = [
  { id:'pdi1', vehicleId:'v4', brand:'DEEPAL', model:'S7', color:'ดำ', vin:'LZEZ1EBA0PA000004', techName:'สมชาย รักงาน', status:'inprogress', startDate:'2025-04-02', checks:{}, defects:[], notes:'' },
  { id:'pdi2', vehicleId:'v1', brand:'BYD', model:'Seal', color:'ขาว Pearl', vin:'LGXCE4C10PA000001', techName:'วิชัย ช่างดี', status:'passed', startDate:'2025-03-05', endDate:'2025-03-05', checks:{}, defects:[], notes:'ผ่านทุกรายการ' },
  { id:'pdi3', vehicleId:'v3', brand:'MG', model:'MG4', color:'แดง', vin:'SDUZZZEF5PA000003', techName:'สมชาย รักงาน', status:'pending', startDate:'2025-03-10', checks:{}, defects:[], notes:'' },
]

export default async function PdiPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let pdis = []
  let filtered = []
  let statusFilter = 'all'

  async function loadData() {
    try { pdis = await listDocs('pdi', [], 'startDate', 'desc', 200) } catch {}
    if (!pdis.length) DEMO_PDI.forEach(p => pdis.push({ ...p }))
    updateStats(); applyFilter()
  }

  function updateStats() {
    Object.keys(PDI_STATUS).forEach(k => {
      const el = document.getElementById(`pstat-${k}`)
      if (el) el.textContent = pdis.filter(p => p.status === k).length
    })
    const totEl = document.getElementById('pdi-total')
    if (totEl) totEl.textContent = `${pdis.length} รายการ`
  }

  function applyFilter() {
    filtered = pdis.filter(p => statusFilter === 'all' || p.status === statusFilter)
    renderTable()
  }

  function renderTable() {
    const wrap = document.getElementById('pdi-content')
    if (!wrap) return

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">✅</div><div class="empty-title">ไม่มีรายการ PDI</div></div>`
      return
    }

    wrap.innerHTML = `<div class="table-wrap">
      <table>
        <thead><tr>
          <th>ยี่ห้อ/รุ่น</th><th>VIN</th><th>สี</th><th>ช่างตรวจ</th>
          <th>วันที่ตรวจ</th><th>สถานะ</th><th>ข้อบกพร่อง</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(p => tableRow(p)).join('')}</tbody>
      </table>
    </div>`

    document.querySelectorAll('.pdi-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.open-pdi')) return
        openChecklist(pdis.find(p => p.id === row.dataset.id))
      })
    })
    document.querySelectorAll('.open-pdi').forEach(btn => btn.addEventListener('click', () => {
      openChecklist(pdis.find(p => p.id === btn.dataset.id))
    }))
  }

  function tableRow(p) {
    const st = PDI_STATUS[p.status] || { label: p.status, badge: 'primary' }
    const defects = p.defects?.length || 0
    return `
      <tr class="pdi-row" data-id="${p.id}" style="cursor:pointer">
        <td>
          <div style="font-weight:600">${escHtml(p.brand)} ${escHtml(p.model)}</div>
        </td>
        <td style="font-size:0.75rem;color:var(--text-muted);font-family:monospace">${escHtml(p.vin || '-')}</td>
        <td>${escHtml(p.color || '-')}</td>
        <td style="font-size:0.85rem">${escHtml(p.techName || '-')}</td>
        <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(p.startDate)}</td>
        <td><span class="badge badge-${st.badge}">${st.label}</span></td>
        <td>${defects > 0 ? `<span style="color:var(--danger);font-weight:600">⚠️ ${defects} รายการ</span>` : '<span style="color:var(--success);font-size:0.8rem">ไม่มี</span>'}</td>
        <td><button class="btn btn-primary btn-sm open-pdi" data-id="${p.id}">📋 ตรวจสอบ</button></td>
      </tr>`
  }

  function openChecklist(p) {
    if (!p) return
    const isReadOnly = p.status === 'passed' || p.status === 'failed'
    const checks = p.checks || {}
    const defects = p.defects || []

    const { el, close } = openModal({
      title: '🔧 PDI — ' + escHtml(p.brand) + ' ' + escHtml(p.model) + ' (' + escHtml(p.color) + ')', size: 'xl',
      body: `
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <!-- Checklist -->
          <div style="flex:2;min-width:300px">
            <div style="font-weight:600;margin-bottom:12px;color:var(--text)">รายการตรวจสอบ</div>
            ${PDI_CHECKS.map(g => `
              <div style="margin-bottom:14px">
                <div style="font-weight:600;font-size:0.85rem;color:var(--primary);margin-bottom:6px;padding:4px 8px;background:var(--primary-dim);border-radius:var(--radius-sm)">${g.group}</div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  ${g.items.map(item => {
                    const key = btoa(unescape(encodeURIComponent(item))).slice(0,20)
                    const val = checks[key]
                    return `
                      <label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--radius-sm);cursor:pointer;${val === 'fail' ? 'background:var(--danger-dim)' : val === 'pass' ? 'background:var(--success-dim)' : 'background:var(--surface-2)'}">
                        <input type="radio" name="chk-${key}" value="pass" ${val==='pass'?'checked':''} ${isReadOnly?'disabled':''} data-key="${key}"> <span style="font-size:0.75rem;color:var(--success)">✅</span>
                        <input type="radio" name="chk-${key}" value="fail" ${val==='fail'?'checked':''} ${isReadOnly?'disabled':''} data-key="${key}"> <span style="font-size:0.75rem;color:var(--danger)">❌</span>
                        <span style="font-size:0.83rem;flex:1">${item}</span>
                      </label>`
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          <!-- Right panel -->
          <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:12px">
            <div style="font-weight:600;margin-bottom:6px">ข้อมูล</div>
            <div class="input-group"><label class="input-label">ช่างตรวจ</label><input class="input" id="pdi-tech" value="${escHtml(p.techName||'')}" ${isReadOnly?'disabled':''}></div>
            <div class="input-group"><label class="input-label">สถานะ</label>
              <select class="input" id="pdi-status" ${isReadOnly?'disabled':''}>
                ${Object.entries(PDI_STATUS).map(([k,v]) => `<option value="${k}" ${p.status===k?'selected':''}>${v.label}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">ข้อบกพร่อง (กรอกแล้ว Enter)</label>
              <div style="display:flex;gap:6px">
                <input class="input" id="pdi-defect-input" placeholder="เช่น กระจกมีรอยขีดข่วน" ${isReadOnly?'disabled':''} style="flex:1">
                <button class="btn btn-secondary btn-sm" id="pdi-add-defect" ${isReadOnly?'disabled':''}>+</button>
              </div>
              <div id="pdi-defects-list" style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
                ${defects.map((d, i) => `<div style="display:flex;align-items:center;gap:6px;background:var(--danger-dim);padding:4px 8px;border-radius:var(--radius-sm);font-size:0.8rem">
                  <span style="flex:1">⚠️ ${escHtml(d)}</span>
                  ${!isReadOnly ? `<button class="btn btn-ghost btn-sm rm-defect" data-i="${i}" style="color:var(--danger);padding:0 4px">✕</button>` : ''}
                </div>`).join('')}
              </div>
            </div>
            <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="pdi-notes" rows="3" ${isReadOnly?'disabled':''}>${escHtml(p.notes||'')}</textarea></div>
          </div>
        </div>
      `,
      footer: isReadOnly
        ? `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>`
        : `<button class="btn btn-secondary" id="pdi-cancel">ยกเลิก</button>
           <button class="btn btn-success" id="pdi-pass">✅ ผ่าน PDI</button>
           <button class="btn btn-primary" id="pdi-save">💾 บันทึก</button>`
    })

    // Collect current state
    function collectState() {
      const newChecks = {}
      el.querySelectorAll('input[type=radio]:checked').forEach(r => { newChecks[r.dataset.key] = r.value })
      const localDefects = []
      el.querySelectorAll('#pdi-defects-list > div').forEach(d => {
        const t = d.querySelector('span')?.textContent?.replace('⚠️ ','').trim()
        if (t) localDefects.push(t)
      })
      return {
        checks: newChecks,
        defects: localDefects,
        techName: el.querySelector('#pdi-tech')?.value?.trim() || p.techName,
        status: el.querySelector('#pdi-status')?.value || p.status,
        notes: el.querySelector('#pdi-notes')?.value?.trim() || '',
      }
    }

    // Defect management
    if (!isReadOnly) {
      const addBtn = el.querySelector('#pdi-add-defect')
      const defectInput = el.querySelector('#pdi-defect-input')
      function addDefect() {
        const val = defectInput.value.trim()
        if (!val) return
        const list = el.querySelector('#pdi-defects-list')
        const div = document.createElement('div')
        div.style.cssText = 'display:flex;align-items:center;gap:6px;background:var(--danger-dim);padding:4px 8px;border-radius:var(--radius-sm);font-size:0.8rem'
        div.innerHTML = `<span style="flex:1">⚠️ ${val}</span><button class="btn btn-ghost btn-sm rm-defect" style="color:var(--danger);padding:0 4px">✕</button>`
        div.querySelector('.rm-defect').addEventListener('click', () => div.remove())
        list.appendChild(div)
        defectInput.value = ''
      }
      addBtn.addEventListener('click', addDefect)
      defectInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addDefect() } })
      el.querySelectorAll('.rm-defect').forEach(btn => btn.addEventListener('click', () => btn.closest('div').remove()))

      el.querySelector('#pdi-cancel').addEventListener('click', close)
      el.querySelector('#pdi-save').addEventListener('click', async () => {
        const data = collectState()
        try {
          await updateDocData('pdi', p.id, data)
          Object.assign(p, data)
          showToast('บันทึกแล้ว', 'success'); close(); updateStats(); applyFilter()
        } catch { showToast('บันทึกไม่สำเร็จ','error') }
      })
      el.querySelector('#pdi-pass').addEventListener('click', async () => {
        const data = { ...collectState(), status: 'passed', endDate: new Date().toISOString().slice(0,10) }
        try {
          await updateDocData('pdi', p.id, data)
          Object.assign(p, data)
          showToast('✅ ผ่าน PDI แล้ว! พร้อมส่งมอบ', 'success')
          close(); updateStats(); applyFilter()
        } catch { showToast('บันทึกไม่สำเร็จ','error') }
      })
    }
  }

  function openNewPdiForm() {
    const { el, close } = openModal({
      title: '➕ เปิด PDI ใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <button class="btn btn-secondary" id="np-pick-btn" style="align-self:flex-start">🚗 เลือกจาก Catalog</button>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ยี่ห้อ *</label><input class="input" id="np-brand" placeholder="BYD"></div>
            <div class="input-group"><label class="input-label">รุ่น *</label><input class="input" id="np-model" placeholder="Seal"><span class="input-error" id="np-model-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">สี</label><input class="input" id="np-color" placeholder="ขาว"></div>
            <div class="input-group"><label class="input-label">VIN</label><input class="input" id="np-vin" placeholder="17 หลัก"></div>
          </div>
          <div class="input-group"><label class="input-label">ช่างตรวจ *</label><input class="input" id="np-tech" placeholder="ชื่อช่าง"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="npc">ยกเลิก</button><button class="btn btn-primary" id="nps">✅ เปิด PDI</button>`
    })
    el.querySelector('#np-pick-btn').addEventListener('click', () => {
      pickVehicle(v => {
        el.querySelector('#np-brand').value = v.brand || ''
        el.querySelector('#np-model').value = v.model || ''
        el.querySelector('#np-color').value = ''
        el.querySelector('#np-vin').value = v.vin || ''
      })
    })
    el.querySelector('#npc').addEventListener('click', close)
    el.querySelector('#nps').addEventListener('click', async () => {
      const model = el.querySelector('#np-model').value.trim()
      if (!model) { el.querySelector('#np-model-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#nps'); btn.disabled = true
      const data = {
        brand: el.querySelector('#np-brand').value.trim(),
        model, color: el.querySelector('#np-color').value.trim(),
        vin: el.querySelector('#np-vin').value.trim(),
        techName: el.querySelector('#np-tech').value.trim(),
        status: 'inprogress', checks: {}, defects: [],
        startDate: new Date().toISOString().slice(0,10), notes: '',
      }
      try {
        const id = await createDoc('pdi', data)
        pdis.unshift({ ...data, id })
        showToast('✅ เปิด PDI แล้ว', 'success'); close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  // ── Page HTML ─────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">✅ PDI — Pre-Delivery Inspection</div>
          <div class="page-subtitle" id="pdi-total">กำลังโหลด...</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="pdi-stock-btn">📦 ไปสต็อก</button>
          <button class="btn btn-primary" id="add-pdi-btn">➕ เปิด PDI</button>
        </div>
      </div>

      <!-- Status Tabs -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-sm pf-btn btn-primary" data-sf="all">ทั้งหมด</button>
        ${Object.entries(PDI_STATUS).map(([k,v]) => `
          <button class="btn btn-sm pf-btn btn-secondary" data-sf="${k}">
            ${v.label} <span class="badge badge-${v.badge} ml-1" id="pstat-${k}" style="margin-left:4px">0</span>
          </button>
        `).join('')}
      </div>

      <div id="pdi-content">
        ${[...Array(3)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('add-pdi-btn').addEventListener('click', () => openNewPdiForm())
  document.getElementById('pdi-stock-btn').addEventListener('click', () => navigate('/dms/stock'))
  document.querySelectorAll('.pf-btn').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.sf
    document.querySelectorAll('.pf-btn').forEach(b => b.className = `btn btn-sm pf-btn ${b.dataset.sf === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))

  if (container.__routerGen === myGen) await loadData()
}
