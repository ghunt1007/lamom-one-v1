import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PRIORITY = {
  critical: { label: 'วิกฤต 🚨', color: 'danger', sla: 4 },
  high:     { label: 'สูง', color: 'danger', sla: 24 },
  medium:   { label: 'ปานกลาง', color: 'warning', sla: 72 },
  low:      { label: 'ต่ำ', color: 'primary', sla: 168 },
}

const CATEGORIES = {
  product:   'ปัญหารถ / ผลิตภัณฑ์',
  service:   'บริการซ่อม',
  sales:     'ทีมขาย',
  delivery:  'การส่งมอบรถ',
  billing:   'การเงิน / บิล',
  staff:     'พนักงาน',
  other:     'อื่นๆ',
}

const STATUS = {
  open:        { label: 'เปิด', color: 'warning' },
  investigating:{ label: 'กำลังสอบสวน', color: 'primary' },
  resolved:    { label: 'แก้ไขแล้ว', color: 'success' },
  closed:      { label: 'ปิด', color: 'primary' },
  escalated:   { label: 'Escalate', color: 'danger' },
}

const DEMO_COMPLAINTS = [
  { id:'CP001', custName:'สมชาย ใจดี', phone:'0812345678', vehicle:'BYD Seal AWD กข-1234', category:'product', priority:'high', subject:'เครื่องยนต์สั่นผิดปกติ', detail:'หลังจากซื้อรถได้ 2 อาทิตย์ มีเสียงสั่นที่พวงมาลัยตอนความเร็ว 80+ กม./ชม.', status:'investigating', openDate:'2025-06-05', closedDate:null, assignedTo:'ธีรยุทธ เก่งกาจ', response:'กำลังตรวจสอบ wheel balance' },
  { id:'CP002', custName:'วิชัย เดินดี', phone:'0834567890', vehicle:'MG4 X คง-5678', category:'service', priority:'medium', subject:'ซ่อมซ้ำปัญหาเดิม', detail:'เข้าซ่อม A/C ครั้งที่ 2 ปัญหาเดิมยังมีอยู่', status:'open', openDate:'2025-06-08', closedDate:null, assignedTo:'', response:'' },
  { id:'CP003', custName:'ประภา สวยงาม', phone:'0845678901', vehicle:'BYD Atto3 งจ-9012', category:'sales', priority:'low', subject:'เซลส์ไม่ติดต่อกลับ', detail:'นัดทดลองขับแล้วแต่เซลส์ไม่โทรกลับ 3 วัน', status:'resolved', openDate:'2025-06-01', closedDate:'2025-06-03', assignedTo:'ผู้จัดการ', response:'ขอโทษและส่งทีมขายพร้อม offer พิเศษ' },
  { id:'CP004', custName:'อนุชา รวยมาก', phone:'0856789012', vehicle:'MG ZS EV ชด-7890', category:'billing', priority:'critical', subject:'ถูกเก็บเงินเกิน', detail:'ใบแจ้งหนี้ระบุยอด 1,200,000 แต่ตกลงกันไว้ 1,049,000', status:'escalated', openDate:'2025-06-07', closedDate:null, assignedTo:'ผู้จัดการ', response:'กำลังตรวจสอบกับฝ่ายการเงิน' },
]

export default async function ComplaintsPage(container) {
  const myGen = container.__routerGen
  let complaints = DEMO_COMPLAINTS.map(c => ({ ...c }))
  let statusFilter = 'all'
  let priorityFilter = 'all'
  let tab = 'list'
  let dataSource = 'demo'

  try {
    const live = await listDocs('complaints', [], 'createdAt', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (live.length >= 2) {
      const mapped = live.map(c => ({
        id: c.id || c.docId,
        custName: c.custName || c.customerName || 'ลูกค้า',
        phone: c.phone || '',
        vehicle: c.vehicle || `${c.brand || ''} ${c.model || ''}`.trim() || '-',
        category: c.category || 'other',
        priority: c.priority || 'medium',
        subject: c.subject || c.title || '',
        detail: c.detail || c.description || '',
        status: c.status || 'open',
        openDate: (c.openDate || c.createdAt?.toDate?.()?.toISOString() || '').slice(0, 10),
        closedDate: c.closedDate || null,
        assignedTo: c.assignedTo || '',
        response: c.response || '',
      }))
      complaints = [...mapped, ...DEMO_COMPLAINTS]
      dataSource = 'live'
    }
  } catch {}

  function getFiltered() {
    let list = complaints
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter)
    if (priorityFilter !== 'all') list = list.filter(c => c.priority === priorityFilter)
    return list.sort((a, b) => {
      const pOrder = { critical:0, high:1, medium:2, low:3 }
      return (pOrder[a.priority]||9) - (pOrder[b.priority]||9)
    })
  }

  function getStats() {
    return {
      open: complaints.filter(c => ['open','investigating','escalated'].includes(c.status)).length,
      critical: complaints.filter(c => c.priority === 'critical' && c.status !== 'closed').length,
      resolved: complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length,
      total: complaints.length,
    }
  }

  function renderPage() {
    const s = getStats()
    const filtered = getFiltered()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📢 Complaint Management</div>
            <div class="page-subtitle">จัดการเรื่องร้องเรียนและ Case ลูกค้า${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="cp-export">📥 Export</button>
            <button class="btn btn-primary" id="new-cp-btn">➕ บันทึกเรื่องร้องเรียน</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('📋 ทั้งหมด', s.total, 'primary')}
          ${kpi('🔴 เปิดอยู่', s.open, 'warning')}
          ${kpi('🚨 วิกฤต', s.critical, 'danger')}
          ${kpi('✅ แก้ไขแล้ว', s.resolved, 'success')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
            ${Object.entries(STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px;margin-left:auto">
            ${Object.entries(PRIORITY).map(([k,v]) => `<button class="btn btn-sm ${priorityFilter===k?'btn-primary':'btn-secondary'} pf-btn" data-p="${k}">${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- List -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${filtered.map(c => renderComplaintCard(c)).join('')}
          ${!filtered.length ? `<div class="empty-state"><div class="empty-icon">📢</div><div class="empty-title">ไม่มีเรื่องร้องเรียน</div></div>` : ''}
        </div>
      </div>
    `

    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.querySelectorAll('.pf-btn').forEach(b => b.addEventListener('click', () => { priorityFilter = b.dataset.p; renderPage() }))
    document.getElementById('new-cp-btn')?.addEventListener('click', () => openComplaintForm())
    document.getElementById('cp-export')?.addEventListener('click', () => exportToExcel(filtered.map(c => ({ วันที่:c.openDate, ลูกค้า:c.custName, หมวด:CATEGORIES[c.category]||c.category, ความเร่งด่วน:PRIORITY[c.priority].label, หัวเรื่อง:c.subject, สถานะ:STATUS[c.status].label })), 'Complaints'))
    document.querySelectorAll('.cp-card').forEach(card => {
      card.addEventListener('click', () => { const c = complaints.find(x => x.id === card.dataset.id); if (c) openComplaintDetail(c) })
    })
  }

  function renderComplaintCard(c) {
    const pr = PRIORITY[c.priority]; const st = STATUS[c.status]
    const isOverdue = ['open','investigating'].includes(c.status) && new Date(c.openDate).getTime() + pr.sla * 3600000 < Date.now()
    return `
      <div class="cp-card" data-id="${c.id}" style="
        padding:14px 16px;background:var(--surface);
        border:1px solid ${isOverdue?'var(--danger)':c.priority==='critical'?'var(--danger)':'var(--border)'};
        border-left:3px solid var(--${pr.color});
        border-radius:var(--radius-md);cursor:pointer;
      ">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span class="badge badge-${pr.color}" style="font-size:0.65rem">${pr.label}</span>
              <span class="badge badge-${st.color}" style="font-size:0.65rem">${st.label}</span>
              ${isOverdue ? `<span class="badge badge-danger" style="font-size:0.65rem">⚠️ เกิน SLA</span>` : ''}
            </div>
            <div style="font-weight:700;font-size:0.9rem">${escHtml(c.subject)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(c.custName)} · ${escHtml(c.vehicle)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:0.72rem;color:var(--text-muted)">${timeAgo(c.openDate)}</div>
            ${c.assignedTo ? `<div style="font-size:0.72rem;color:var(--primary)">👤 ${escHtml(c.assignedTo)}</div>` : `<div style="font-size:0.72rem;color:var(--danger)">⚠️ ยังไม่มอบหมาย</div>`}
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5">${escHtml(c.detail.slice(0, 100))}${c.detail.length > 100 ? '...' : ''}</div>
        ${c.response ? `<div style="margin-top:6px;font-size:0.75rem;background:var(--success-dim);padding:5px 8px;border-radius:var(--radius-sm);color:var(--success)">💬 ${escHtml(c.response)}</div>` : ''}
      </div>
    `
  }

  function openComplaintForm(comp = null) {
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: comp ? '✏️ แก้ไขเรื่องร้องเรียน' : '📢 บันทึกเรื่องร้องเรียนใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="cp-cust" value="${escHtml(comp?.custName||'')}" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="cp-phone" value="${escHtml(comp?.phone||'')}" placeholder="08x-xxx-xxxx"></div>
        </div>
        <div class="input-group"><label class="input-label">รถ / ทะเบียน</label><input class="input" id="cp-vehicle" value="${escHtml(comp?.vehicle||'')}" placeholder="รุ่นรถ + ทะเบียน"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">หมวดหมู่</label>
            <select class="input" id="cp-cat">
              ${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}" ${comp?.category===k?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">ความเร่งด่วน</label>
            <select class="input" id="cp-pri">
              ${Object.entries(PRIORITY).map(([k,v]) => `<option value="${k}" ${(comp?.priority||'medium')===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="input-group"><label class="input-label">หัวเรื่อง *</label><input class="input" id="cp-sub" value="${escHtml(comp?.subject||'')}" placeholder="สรุปปัญหาสั้นๆ"></div>
        <div class="input-group"><label class="input-label">รายละเอียด</label><textarea class="input" id="cp-detail" rows="3">${escHtml(comp?.detail||'')}</textarea></div>
        <div class="input-group"><label class="input-label">มอบหมายให้</label><input class="input" id="cp-assign" value="${escHtml(comp?.assignedTo||'')}" placeholder="ชื่อผู้รับผิดชอบ"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="cp-c">ยกเลิก</button><button class="btn btn-primary" id="cp-s">💾 บันทึก</button>`
    })
    el.querySelector('#cp-c').addEventListener('click', close)
    el.querySelector('#cp-s').addEventListener('click', () => {
      const custName = el.querySelector('#cp-cust').value.trim()
      const subject = el.querySelector('#cp-sub').value.trim()
      if (!custName || !subject) return showToast('❗ กรอกข้อมูลให้ครบ', 'warning')
      const data = { custName, phone:el.querySelector('#cp-phone').value, vehicle:el.querySelector('#cp-vehicle').value, category:el.querySelector('#cp-cat').value, priority:el.querySelector('#cp-pri').value, subject, detail:el.querySelector('#cp-detail').value, assignedTo:el.querySelector('#cp-assign').value }
      if (comp) Object.assign(comp, data)
      else complaints.unshift({ id:'CP'+Date.now(), ...data, status:'open', openDate:today, closedDate:null, response:'' })
      showToast('📢 บันทึกแล้ว', 'success'); close(); renderPage()
    })
  }

  function openComplaintDetail(c) {
    const pr = PRIORITY[c.priority]; const st = STATUS[c.status]
    const { el, close } = openModal({
      title: '📢 ' + escHtml(c.subject), size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:6px"><span class="badge badge-${pr.color}">${pr.label}</span><span class="badge badge-${st.color}">${st.label}</span></div>
        <div class="grid-2" style="font-size:0.83rem">
          <div>👤 ${escHtml(c.custName)}</div><div>📱 ${escHtml(c.phone)}</div>
          <div>🚗 ${escHtml(c.vehicle)}</div><div>📅 ${escHtml(c.openDate)}</div>
          <div>🗂 ${escHtml(CATEGORIES[c.category]||c.category)}</div>
          <div>👤 ${escHtml(c.assignedTo||'ยังไม่มอบหมาย')}</div>
        </div>
        <div style="background:var(--surface-2);padding:12px;border-radius:var(--radius-sm);font-size:0.85rem;line-height:1.6">${escHtml(c.detail)}</div>
        <div class="input-group"><label class="input-label">การดำเนินการ / ตอบกลับ</label><textarea class="input" id="cp-resp" rows="3">${escHtml(c.response||'')}</textarea></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${Object.entries(STATUS).filter(([k])=>k!==c.status).map(([k,v])=>`<button class="btn btn-sm btn-secondary status-change" data-s="${k}">${v.label}</button>`).join('')}
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="det-c">ปิด</button><button class="btn btn-primary" id="det-s">💾 บันทึกการตอบ</button>`
    })
    el.querySelector('#det-c').addEventListener('click', close)
    el.querySelector('#det-s').addEventListener('click', () => {
      c.response = el.querySelector('#cp-resp').value
      showToast('💾 บันทึกแล้ว', 'success'); close(); renderPage()
    })
    el.querySelectorAll('.status-change').forEach(btn => {
      btn.addEventListener('click', () => { c.status = btn.dataset.s; if (btn.dataset.s === 'closed' || btn.dataset.s === 'resolved') c.closedDate = new Date().toISOString().slice(0,10); c.response = el.querySelector('#cp-resp').value; showToast('✅ อัพเดตสถานะแล้ว','success'); close(); renderPage() })
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
