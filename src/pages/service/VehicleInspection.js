import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const INSPECTION_TYPES = {
  pdi:       { label: 'Pre-Delivery (PDI)', icon: '🚗', color: 'primary' },
  periodic:  { label: 'ตรวจสภาพตามระยะ', icon: '📅', color: 'success' },
  warranty:  { label: 'ตรวจรับประกัน', icon: '🛡', color: 'warning' },
  accident:  { label: 'ตรวจหลังอุบัติเหตุ', icon: '⚠️', color: 'danger' },
  resale:    { label: 'ตรวจก่อนขายต่อ', icon: '🏷', color: 'accent' },
}

const INS_STATUS = {
  pending:  { label: 'รอตรวจ', color: 'warning' },
  inprog:   { label: 'กำลังตรวจ', color: 'primary' },
  done:     { label: 'ตรวจแล้ว', color: 'success' },
  fail:     { label: 'ไม่ผ่าน', color: 'danger' },
}

const ITEM_STATUS = { pass: '✅', fail: '❌', na: '⬜' }

// Standard inspection checklist template
const CHECKLIST_TEMPLATE = {
  exterior: {
    label: 'ภายนอกรถ',
    items: ['สภาพตัวถัง — ไม่มีรอยขีดข่วน/บุบ', 'กระจกหน้า-หลัง — ไม่มีรอยร้าว', 'ไฟหน้า/ไฟท้าย — ทำงานปกติ', 'ยางรถ — ร่องยางพอดี สภาพดี', 'ล้ออัลลอย — ไม่มีรอยช้ำ', 'กระจกมองข้าง — ปรับได้ปกติ', 'ซีลยาง ประตู/กระจก — สภาพดี']
  },
  interior: {
    label: 'ภายในรถ',
    items: ['เบาะนั่ง — ไม่ชำรุด/ฉีกขาด', 'พวงมาลัย — ไม่มีรอย', 'แดชบอร์ด/Infotainment — ทำงานปกติ', 'เข็มขัดนิรภัย — ทำงานได้ทุกที่นั่ง', 'ระบบ A/C — เย็นปกติ', 'ลำโพง/ระบบเสียง — ทำงานปกติ', 'ไฟภายในห้องโดยสาร — ทำงานปกติ']
  },
  mechanical: {
    label: 'ระบบกลไก',
    items: ['ระดับน้ำมันเครื่อง (สำหรับ PHEV)', 'น้ำยาหล่อเย็น — ระดับปกติ', 'น้ำมันเบรก — ระดับปกติ', 'น้ำกระจก — มีเพียงพอ', 'ระบบเบรก — ทำงานปกติ', 'ช่วงล่าง — ไม่มีเสียงผิดปกติ', 'พวงมาลัยพาวเวอร์ — ทำงานปกติ']
  },
  ev: {
    label: 'ระบบ EV',
    items: ['แบตเตอรี่ — SoC ปกติ (>80%)', 'ระบบชาร์จ Type 1 — ทำงาน', 'ระบบชาร์จ Type 2 — ทำงาน', 'CCS/CHAdeMO — ทำงาน (ถ้ามี)', 'มอเตอร์ไฟฟ้า — ไม่มีเสียงผิดปกติ', 'Regen Braking — ทำงานปกติ', 'อุณหภูมิแบตเตอรี่ — ปกติ']
  },
  safety: {
    label: 'ระบบความปลอดภัย',
    items: ['Airbag Warning Light — ไม่ติด', 'ABS — ไม่มี Warning Light', 'ADAS (ถ้ามี) — ปรับแต่งแล้ว', 'ระบบล็อคอัตโนมัติ — ทำงาน', 'กล้องถอยหลัง — ชัดเจน', 'Blind Spot (ถ้ามี) — ทำงาน']
  },
  documents: {
    label: 'เอกสาร',
    items: ['คู่มือรถ — มีครบ', 'ใบรับประกัน — กรอกแล้ว', 'บัตรบริการ Service Card', 'Certificate of Compliance', 'สมุดบันทึกการบำรุง', 'อุปกรณ์มาตรฐาน (ไขควง/แม่แรง) — ครบ']
  }
}

const DEMO_INSPECTIONS = [
  { id: 'INS001', type: 'pdi', vehiclePlate: 'กก 1234 BKK', brand: 'BYD', model: 'Seal AWD', vin: 'LBWAB2EB7PD001001', customerId: 'C001', customerName: 'วิชาญ มีโชค', techId: 'T001', techName: 'ธีรยุทธ เก่งกาจ', date: '2025-06-05', status: 'done', mileage: 12, overallResult: 'pass', notes: 'รถสภาพดีพร้อมส่งมอบ', items: null },
  { id: 'INS002', type: 'periodic', vehiclePlate: 'ขข 5678 BKK', brand: 'MG', model: 'ZS EV', vin: 'LSJWSRAR7NE001007', customerId: 'C003', customerName: 'ธีรยุทธ เก่งกาจ', techId: 'T002', techName: 'สมชาย ช่างดี', date: '2025-06-08', status: 'inprog', mileage: 25000, overallResult: null, notes: '', items: null },
  { id: 'INS003', type: 'pdi', vehiclePlate: 'คค 9012 BKK', brand: 'BYD', model: 'Atto 3', vin: 'LBWAB2EB7PD001003', customerId: 'C004', customerName: 'สมหญิง รักรถ', techId: 'T001', techName: 'ธีรยุทธ เก่งกาจ', date: formatDate_(new Date()), status: 'pending', mileage: 8, overallResult: null, notes: '', items: null },
]

function formatDate_(d) { return d.toISOString().slice(0, 10) }

export default async function VehicleInspectionPage(container) {
  let tab = 'list'
  let statusFilter = 'all'
  let typeFilter = 'all'
  let inspections = DEMO_INSPECTIONS.map(ins => ({ ...ins, items: ins.items || buildDefaultItems() }))
  let activeInspection = null

  function buildDefaultItems() {
    const result = {}
    Object.entries(CHECKLIST_TEMPLATE).forEach(([section, data]) => {
      result[section] = data.items.map(text => ({ text, status: 'na', note: '' }))
    })
    return result
  }

  function calcResult(items) {
    const all = Object.values(items).flat()
    const checked = all.filter(i => i.status !== 'na')
    const failed = all.filter(i => i.status === 'fail')
    if (!checked.length) return null
    return failed.length ? 'fail' : 'pass'
  }

  function renderPage() {
    const pending = inspections.filter(i => i.status === 'pending').length
    const inprog = inspections.filter(i => i.status === 'inprog').length
    const done = inspections.filter(i => i.status === 'done').length
    const fail = inspections.filter(i => i.overallResult === 'fail').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔍 Vehicle Inspection</div>
            <div class="page-subtitle">ตรวจสภาพรถยนต์ — Checklist ละเอียด</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-ins-btn">+ สร้างการตรวจ</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('⏳ รอตรวจ', pending, 'warning')}
          ${kpi('🔍 กำลังตรวจ', inprog, 'primary')}
          ${kpi('✅ ผ่านแล้ว', done - fail, 'success')}
          ${kpi('❌ ไม่ผ่าน', fail, 'danger')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
          ${Object.entries(INS_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          <select class="input" id="type-filter" style="width:180px;margin-left:auto">
            <option value="all">ประเภททั้งหมด</option>
            ${Object.entries(INSPECTION_TYPES).map(([k,v]) => `<option value="${k}" ${typeFilter===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
          </select>
        </div>

        <!-- List -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${inspections.filter(i => (statusFilter === 'all' || i.status === statusFilter) && (typeFilter === 'all' || i.type === typeFilter)).map(ins => renderCard(ins)).join('')}
        </div>
      </div>
    `

    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('type-filter')?.addEventListener('change', e => { typeFilter = e.target.value; renderPage() })
    document.getElementById('add-ins-btn')?.addEventListener('click', () => openInsForm())
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(inspections.map(i => ({ ID: i.id, ประเภท: INSPECTION_TYPES[i.type]?.label, รถ: `${i.brand} ${i.model}`, VIN: i.vin, ลูกค้า: i.customerName, ช่าง: i.techName, วันที่: i.date, เลขไมล์: i.mileage, สถานะ: INS_STATUS[i.status]?.label, ผล: i.overallResult === 'pass' ? 'ผ่าน' : i.overallResult === 'fail' ? 'ไม่ผ่าน' : '-' })), 'inspections')
      showToast('📥 Export แล้ว!', 'success')
    })
    document.querySelectorAll('.open-ins-btn').forEach(b => b.addEventListener('click', () => { const ins = inspections.find(x => x.id === b.dataset.id); if (ins) openChecklist(ins) }))
    document.querySelectorAll('.start-ins-btn').forEach(b => b.addEventListener('click', () => { const ins = inspections.find(x => x.id === b.dataset.id); if (!ins) return; ins.status = 'inprog'; showToast('🔍 เริ่มการตรวจแล้ว', 'success'); renderPage() }))
  }

  function renderCard(ins) {
    const tp = INSPECTION_TYPES[ins.type]
    const st = INS_STATUS[ins.status]
    const all = Object.values(ins.items).flat()
    const checked = all.filter(i => i.status !== 'na').length
    const failed = all.filter(i => i.status === 'fail').length
    const total = all.length
    const pct = total ? Math.round(checked / total * 100) : 0

    return `<div class="card" style="padding:14px 16px;border-left:3px solid var(--${tp.color})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span>${tp.icon}</span>
            <span style="font-weight:700;font-size:0.9rem">${escHtml(ins.brand)} ${escHtml(ins.model)}</span>
            <span style="font-family:monospace;font-size:0.75rem;color:var(--text-muted)">${escHtml(ins.vehiclePlate)}</span>
            <span class="badge badge-${st.color}">${st.label}</span>
            ${ins.overallResult === 'pass' ? '<span class="badge badge-success">✅ ผ่าน</span>' : ins.overallResult === 'fail' ? '<span class="badge badge-danger">❌ ไม่ผ่าน</span>' : ''}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${ins.tp?.label || INSPECTION_TYPES[ins.type]?.label} · ลูกค้า: ${escHtml(ins.customerName)} · ช่าง: ${escHtml(ins.techName)} · ${formatDate(ins.date)} · ${ins.mileage.toLocaleString()} กม.</div>
          <!-- Progress -->
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
            <div style="flex:1;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${failed?'var(--danger)':'var(--primary)'};border-radius:3px"></div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted)">${checked}/${total} รายการ${failed ? ` · <span style="color:var(--danger)">ไม่ผ่าน ${failed}</span>` : ''}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">
          ${ins.status === 'pending' ? `<button class="btn btn-sm btn-primary start-ins-btn" data-id="${ins.id}">▶ เริ่มตรวจ</button>` : ''}
          <button class="btn btn-sm btn-secondary open-ins-btn" data-id="${ins.id}">${ins.status === 'inprog' ? '📝 ตรวจต่อ' : '🔍 ดู Checklist'}</button>
        </div>
      </div>
    </div>`
  }

  function openChecklist(ins) {
    const tp = INSPECTION_TYPES[ins.type]
    const buildChecklist = () => {
      return Object.entries(CHECKLIST_TEMPLATE).map(([sectionKey, section]) => {
        const sectionItems = ins.items[sectionKey] || []
        return `<div style="margin-bottom:16px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;color:var(--primary)">${section.label}</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${sectionItems.map((item, idx) => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="display:flex;gap:4px">
                  <button class="btn btn-xs item-btn ${item.status==='pass'?'btn-success':'btn-secondary'}" data-sec="${sectionKey}" data-i="${idx}" data-v="pass">✅</button>
                  <button class="btn btn-xs item-btn ${item.status==='fail'?'btn-danger':'btn-secondary'}" data-sec="${sectionKey}" data-i="${idx}" data-v="fail">❌</button>
                  <button class="btn btn-xs item-btn ${item.status==='na'?'btn-secondary':''}" data-sec="${sectionKey}" data-i="${idx}" data-v="na">⬜</button>
                </div>
                <span style="flex:1;font-size:0.82rem;${item.status==='fail'?'color:var(--danger);font-weight:600':''}">${item.text}</span>
                ${item.status === 'fail' ? `<input class="input fail-note" data-sec="${sectionKey}" data-i="${idx}" value="${escHtml(item.note)}" placeholder="หมายเหตุ..." style="width:160px;font-size:0.78rem;padding:4px 8px">` : ''}
              </div>
            `).join('')}
          </div>
        </div>`
      }).join('')
    }

    const modal = openModal({
      title: '🔍 ' + tp.icon + ' ' + escHtml(ins.brand) + ' ' + escHtml(ins.model) + ' — ' + escHtml(ins.vehiclePlate),
      size: 'xl',
      body: `<div id="checklist-body">${buildChecklist()}</div>
        <div style="margin-top:14px">
          <div class="input-group"><label class="input-label">หมายเหตุรวม</label><textarea class="input" id="ins-overall-note" rows="2" placeholder="สรุปผลการตรวจ...">${escHtml(ins.notes)}</textarea></div>
        </div>`,
      footer: `<div style="display:flex;gap:8px">
        <button class="btn btn-success" id="ins-pass-btn">✅ บันทึก — ผ่าน</button>
        <button class="btn btn-danger" id="ins-fail-btn">❌ บันทึก — ไม่ผ่าน</button>
        <button class="btn btn-secondary" id="ins-save-btn">💾 บันทึกร่าง</button>
      </div>`
    })

    setTimeout(() => {
      // Item toggle buttons
      document.querySelectorAll('.modal .item-btn').forEach(b => {
        b.addEventListener('click', () => {
          const sec = b.dataset.sec
          const i = +b.dataset.i
          const v = b.dataset.v
          ins.items[sec][i].status = v
          // Re-render checklist only
          document.getElementById('checklist-body').innerHTML = buildChecklist()
          // Re-bind
          bindChecklistEvents()
        })
      })
      // Fail notes
      document.querySelectorAll('.modal .fail-note').forEach(inp => {
        inp.addEventListener('change', () => {
          ins.items[inp.dataset.sec][+inp.dataset.i].note = inp.value
        })
      })

      function bindChecklistEvents() {
        document.querySelectorAll('.modal .item-btn').forEach(b => {
          b.addEventListener('click', () => {
            ins.items[b.dataset.sec][+b.dataset.i].status = b.dataset.v
            document.getElementById('checklist-body').innerHTML = buildChecklist()
            bindChecklistEvents()
          })
        })
        document.querySelectorAll('.modal .fail-note').forEach(inp => {
          inp.addEventListener('change', () => { ins.items[inp.dataset.sec][+inp.dataset.i].note = inp.value })
        })
      }

      function saveIns(result) {
        ins.notes = document.getElementById('ins-overall-note')?.value || ''
        ins.overallResult = result
        ins.status = 'done'
        document.querySelector('.modal-close-btn')?.click()
        showToast(result === 'pass' ? '✅ ตรวจผ่านแล้ว!' : '❌ บันทึกผลไม่ผ่านแล้ว', result === 'pass' ? 'success' : 'warning')
        renderPage()
      }

      document.getElementById('ins-pass-btn')?.addEventListener('click', () => saveIns('pass'))
      document.getElementById('ins-fail-btn')?.addEventListener('click', () => saveIns('fail'))
      document.getElementById('ins-save-btn')?.addEventListener('click', () => {
        ins.notes = document.getElementById('ins-overall-note')?.value || ''
        ins.status = 'inprog'
        document.querySelector('.modal-close-btn')?.click()
        showToast('💾 บันทึกร่างแล้ว', 'success')
        renderPage()
      })
    }, 80)
  }

  function openInsForm() {
    const today = new Date().toISOString().slice(0, 10)
    openModal({
      title: '+ สร้างการตรวจสภาพ',
      size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ประเภทการตรวจ</label>
          <select class="input" id="if-type">${Object.entries(INSPECTION_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">ทะเบียนรถ *</label><input class="input" id="if-plate" placeholder="กก 1234 BKK"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="if-model" placeholder="BYD Seal AWD"></div>
        <div class="input-group"><label class="input-label">ชื่อลูกค้า</label><input class="input" id="if-cname" placeholder="ชื่อลูกค้า"></div>
        <div class="input-group"><label class="input-label">วันที่ตรวจ</label><input type="date" class="input" id="if-date" value="${today}"></div>
        <div class="input-group"><label class="input-label">เลขไมล์ (กม.)</label><input type="number" class="input" id="if-km" placeholder="0"></div>
      </div>`,
      onConfirm() {
        const plate = document.getElementById('if-plate')?.value?.trim()
        if (!plate) { showToast('❗ กรุณากรอกทะเบียน', 'error'); return }
        const newIns = {
          id: `INS${String(inspections.length+1).padStart(3,'0')}`,
          type: document.getElementById('if-type')?.value,
          vehiclePlate: plate, brand: '', model: document.getElementById('if-model')?.value||'',
          vin: '', customerId: '', customerName: document.getElementById('if-cname')?.value||'',
          techId: 'T001', techName: 'ธีรยุทธ เก่งกาจ',
          date: document.getElementById('if-date')?.value||today,
          status: 'pending', mileage: +document.getElementById('if-km')?.value||0,
          overallResult: null, notes: '', items: buildDefaultItems()
        }
        inspections.unshift(newIns)
        showToast('✅ สร้างการตรวจแล้ว', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
