// Action Plan — แผนปฏิบัติการขาย: กิจกรรมที่เซลส์ต้องทำเพื่อปิดเป้า
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesStaff } from '../../data/masterData.js'

const TYPES = ['โทรติดตาม', 'นัดหมาย', 'ทดลองขับ', 'เสนอราคา', 'ติดตามไฟแนนซ์', 'ปิดการขาย', 'ดูแลหลังขาย', 'อื่นๆ']
const STATUS = {
  todo:  { label: 'รอทำ', color: 'secondary' },
  doing: { label: 'กำลังทำ', color: 'primary' },
  done:  { label: 'เสร็จ', color: 'success' },
}
const PRIORITY = { high: { label: 'สูง', color: 'danger' }, medium: { label: 'กลาง', color: 'warning' }, low: { label: 'ต่ำ', color: 'primary' } }

function today() { return new Date().toISOString().slice(0, 10) }

const DEMO = [
  { id:'ap1', salesName:'อรนุช เซลส์ดี', title:'โทรปิดดีล ธีรพงศ์ — BYD Seal', type:'ปิดการขาย', custName:'ธีรพงศ์ แสงทอง', dueDate: today(), status:'doing', priority:'high', note:'ลูกค้าขอส่วนลดเพิ่ม 1 หมื่น', createdAt:'2025-06-18' },
  { id:'ap2', salesName:'อรนุช เซลส์ดี', title:'นัดทดลองขับ Atto 3', type:'ทดลองขับ', custName:'สมหญิง ดีมาก', dueDate: today(), status:'todo', priority:'medium', note:'', createdAt:'2025-06-19' },
  { id:'ap3', salesName:'วิชัย ขายเก่ง', title:'ติดตามผลไฟแนนซ์ TTB', type:'ติดตามไฟแนนซ์', custName:'กิตติพงษ์ วรรณศิลป์', dueDate: '2025-06-20', status:'doing', priority:'high', note:'รอเอกสารเพิ่ม', createdAt:'2025-06-17' },
  { id:'ap4', salesName:'วิชัย ขายเก่ง', title:'ส่งใบเสนอราคา NETA V', type:'เสนอราคา', custName:'สุภาพร ใจดี', dueDate: '2025-06-22', status:'todo', priority:'medium', note:'', createdAt:'2025-06-19' },
  { id:'ap5', salesName:'อรนุช เซลส์ดี', title:'ส่งมอบรถ + แนะนำแอป', type:'ดูแลหลังขาย', custName:'สมบัติ ยิ่งใหญ่', dueDate:'2025-06-15', status:'done', priority:'low', note:'ส่งมอบเรียบร้อย', createdAt:'2025-06-14' },
]

export default async function ActionPlanPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let plans = []
  let salesFilter = 'all'
  let statusFilter = 'all'

  async function loadData() {
    try { plans = await listDocs('action_plans', [], 'createdAt', 'desc', 500) } catch {}
    if (!plans.length) plans = DEMO.map(p => ({ ...p }))
    render()
  }

  function overdue(p) { return p.status !== 'done' && p.dueDate && p.dueDate < today() }

  function getFiltered() {
    return plans.filter(p =>
      (salesFilter === 'all' || p.salesName === salesFilter) &&
      (statusFilter === 'all' || (statusFilter === 'overdue' ? overdue(p) : p.status === statusFilter))
    )
  }

  function render() {
    const total = plans.length
    const done = plans.filter(p => p.status === 'done').length
    const doing = plans.filter(p => p.status === 'doing').length
    const od = plans.filter(overdue).length
    const salesList = [...new Set(plans.map(p => p.salesName).filter(Boolean))]

    container.innerHTML =
      '<div class="page-content animate-slide">' +
        '<div class="page-header"><div>' +
          '<div class="page-title">🗂️ Action Plan — แผนปฏิบัติการขาย</div>' +
          '<div class="page-subtitle">กิจกรรมที่ต้องทำเพื่อปิดเป้า · ติดตามความคืบหน้ารายเซลส์</div>' +
        '</div><div class="page-actions"><button class="btn btn-primary" id="ap-add">➕ เพิ่มกิจกรรม</button></div></div>' +
        '<div class="grid-4 mb-6">' +
          card('📋 ทั้งหมด', total + ' รายการ', 'primary') +
          card('🔄 กำลังทำ', doing + ' รายการ', 'accent') +
          card('✅ เสร็จแล้ว', done + ' รายการ', 'success') +
          card('⚠️ เลยกำหนด', od + ' รายการ', od ? 'danger' : 'secondary') +
        '</div>' +
        '<div class="card mb-4" style="padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
          '<span style="font-size:0.82rem;color:var(--text-muted)">เซลส์:</span>' +
          '<button class="btn btn-sm ap-sf btn-primary" data-s="all">ทั้งหมด</button>' +
          salesList.map(s => '<button class="btn btn-sm ap-sf btn-secondary" data-s="' + esc(s) + '">' + esc(s) + '</button>').join('') +
          '<span style="width:1px;height:20px;background:var(--border);margin:0 4px"></span>' +
          '<span style="font-size:0.82rem;color:var(--text-muted)">สถานะ:</span>' +
          '<button class="btn btn-sm ap-stf btn-primary" data-s="all">ทั้งหมด</button>' +
          Object.entries(STATUS).map(([k, v]) => '<button class="btn btn-sm ap-stf btn-secondary" data-s="' + k + '">' + v.label + '</button>').join('') +
          '<button class="btn btn-sm ap-stf btn-secondary" data-s="overdue">⚠️ เลยกำหนด</button>' +
        '</div>' +
        '<div id="ap-table"></div>' +
      '</div>'

    renderTable()

    container.querySelector('#ap-add').addEventListener('click', () => openForm())
    container.querySelectorAll('.ap-sf').forEach(b => b.addEventListener('click', () => {
      salesFilter = b.dataset.s
      container.querySelectorAll('.ap-sf').forEach(x => x.className = 'btn btn-sm ap-sf ' + (x.dataset.s === salesFilter ? 'btn-primary' : 'btn-secondary'))
      renderTable()
    }))
    container.querySelectorAll('.ap-stf').forEach(b => b.addEventListener('click', () => {
      statusFilter = b.dataset.s
      container.querySelectorAll('.ap-stf').forEach(x => x.className = 'btn btn-sm ap-stf ' + (x.dataset.s === statusFilter ? 'btn-primary' : 'btn-secondary'))
      renderTable()
    }))
  }

  function renderTable() {
    const wrap = container.querySelector('#ap-table')
    if (!wrap) return
    const list = getFiltered()
    if (!list.length) { wrap.innerHTML = '<div class="empty-state" style="padding:48px"><div class="empty-icon">🗂️</div><div class="empty-title">ไม่มีกิจกรรม</div></div>'; return }
    wrap.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>กิจกรรม</th><th>ประเภท</th><th>ลูกค้า</th><th>เซลส์</th><th>กำหนด</th><th>ความสำคัญ</th><th>สถานะ</th><th></th>' +
      '</tr></thead><tbody>' +
      list.map(p => {
        const st = STATUS[p.status] || STATUS.todo
        const pr = PRIORITY[p.priority] || PRIORITY.medium
        const od = overdue(p)
        return '<tr>' +
          '<td style="font-weight:600">' + esc(p.title) + (p.note ? '<div style="font-size:0.7rem;color:var(--text-muted)">' + esc(p.note) + '</div>' : '') + '</td>' +
          '<td style="font-size:0.8rem">' + esc(p.type || '-') + '</td>' +
          '<td style="font-size:0.82rem">' + esc(p.custName || '-') + '</td>' +
          '<td style="font-size:0.8rem;color:var(--text-muted)">' + esc(p.salesName || '-') + '</td>' +
          '<td style="font-size:0.8rem;color:' + (od ? 'var(--danger)' : 'var(--text-2)') + '">' + formatDate(p.dueDate) + (od ? ' ⚠️' : '') + '</td>' +
          '<td><span class="badge badge-' + pr.color + '">' + pr.label + '</span></td>' +
          '<td><span class="badge badge-' + st.color + '">' + st.label + '</span></td>' +
          '<td style="white-space:nowrap">' +
            (p.status !== 'done' ? '<button class="btn btn-success btn-sm ap-done" data-id="' + p.id + '">✓ เสร็จ</button> ' : '') +
            '<button class="btn btn-ghost btn-sm ap-edit" data-id="' + p.id + '">✏️</button>' +
          '</td>' +
        '</tr>'
      }).join('') +
      '</tbody></table></div>'

    wrap.querySelectorAll('.ap-done').forEach(b => b.addEventListener('click', async () => {
      const p = plans.find(x => x.id === b.dataset.id); if (!p) return
      p.status = 'done'; await updateDocData('action_plans', p.id, { status: 'done' }).catch(() => {})
      showToast('✅ ทำกิจกรรมเสร็จแล้ว', 'success'); render()
    }))
    wrap.querySelectorAll('.ap-edit').forEach(b => b.addEventListener('click', () => openForm(plans.find(x => x.id === b.dataset.id))))
  }

  function openForm(existing) {
    const e = existing || {}
    const isEdit = !!existing
    const inp = (id, label, val, type) => '<div class="input-group"><label class="input-label">' + label + '</label><input class="input" id="' + id + '" ' + (type ? 'type="' + type + '"' : '') + ' value="' + esc(val) + '"></div>'
    const sel = (id, label, list, val) => '<div class="input-group"><label class="input-label">' + label + '</label><select class="input" id="' + id + '">' + list.map(o => '<option ' + (o === val ? 'selected' : '') + '>' + o + '</option>').join('') + '</select></div>'
    const selKV = (id, label, obj, val) => '<div class="input-group"><label class="input-label">' + label + '</label><select class="input" id="' + id + '">' + Object.entries(obj).map(([k, v]) => '<option value="' + k + '" ' + (k === val ? 'selected' : '') + '>' + v.label + '</option>').join('') + '</select></div>'

    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขกิจกรรม' : '➕ กิจกรรมใหม่', size: 'md',
      body: '<div style="display:flex;flex-direction:column;gap:8px">' +
        inp('af-title', 'กิจกรรม *', e.title) +
        '<div class="grid-2">' + sel('af-type', 'ประเภท', TYPES, e.type) + inp('af-cust', 'ลูกค้า', e.custName) + '</div>' +
        '<div class="grid-2">' + sel('af-sales', 'เซลส์', getSalesStaff().length ? getSalesStaff() : ['อรนุช เซลส์ดี', 'วิชัย ขายเก่ง'], e.salesName) + inp('af-due', 'กำหนดเสร็จ', e.dueDate || today(), 'date') + '</div>' +
        '<div class="grid-2">' + selKV('af-priority', 'ความสำคัญ', PRIORITY, e.priority || 'medium') + selKV('af-status', 'สถานะ', STATUS, e.status || 'todo') + '</div>' +
        inp('af-note', 'หมายเหตุ', e.note) +
        '<span class="input-error" id="af-err"></span>' +
        (isEdit ? '<button class="btn btn-danger btn-sm" id="af-del" style="align-self:flex-start;margin-top:4px">🗑 ลบกิจกรรมนี้</button>' : '') +
      '</div>',
      footer: '<button class="btn btn-secondary" id="af-cancel">ยกเลิก</button><button class="btn btn-primary" id="af-save">💾 บันทึก</button>'
    })

    el.querySelector('#af-cancel').addEventListener('click', close)
    el.querySelector('#af-del')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title:'🗑 ลบกิจกรรม', message:'ยืนยันลบกิจกรรมนี้?', confirmText:'ลบ', danger:true })
      if (!ok) return
      await softDelete('action_plans', existing.id).catch(() => {})
      plans = plans.filter(x => x.id !== existing.id)
      showToast('🗑 ลบแล้ว', 'success'); close()
      if (container.__routerGen !== myGen) return
      render()
    })
    el.querySelector('#af-save').addEventListener('click', async () => {
      const title = el.querySelector('#af-title').value.trim()
      if (!title) { el.querySelector('#af-err').textContent = '⚠️ ระบุชื่อกิจกรรม'; return }
      const data = {
        title, type: el.querySelector('#af-type').value, custName: el.querySelector('#af-cust').value.trim(),
        salesName: el.querySelector('#af-sales').value, dueDate: el.querySelector('#af-due').value,
        priority: el.querySelector('#af-priority').value, status: el.querySelector('#af-status').value,
        note: el.querySelector('#af-note').value.trim(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      }
      if (isEdit) { await updateDocData('action_plans', existing.id, data).catch(() => {}); Object.assign(existing, data) }
      else { const id = await createDoc('action_plans', data).catch(() => 'ap' + Date.now()); plans.unshift({ ...data, id }) }
      showToast(isEdit ? '✏️ แก้ไขแล้ว' : '✅ เพิ่มกิจกรรมแล้ว', 'success'); close(); render()
    })
  }

  if (container.__routerGen === myGen) await loadData()
}

function card(label, value, color) {
  return '<div class="card" style="padding:16px 18px;border-left:3px solid var(--' + color + ')">' +
    '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">' + label + '</div>' +
    '<div style="font-size:1.3rem;font-weight:800;color:var(--' + color + ')">' + value + '</div></div>'
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
