/**
 * Government Documents — เอกสารราชการ โอนกรรมสิทธิ์ ภาษีป้าย ตรวจสภาพ
 * Route: /dms/gov-docs
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DOC_TYPES = ['โอนกรรมสิทธิ์','ภาษีป้าย','หนังสือมอบอำนาจ','ตรวจสภาพ (ตรอ.)','ประกันภัย','ทะเบียนรถใหม่']

const DEMO_DOCS = [
  { id:'GD001', type:'โอนกรรมสิทธิ์', customer:'คุณวรพจน์ แก้วมณี', vin:'LVVDBCAE1PD123456', status:'กำลังดำเนินการ', dueDate:'2026-06-20', officer:'ฝ่ายทะเบียน', note:'ยื่นกรมขนส่งสาขาบึงกุ่ม' },
  { id:'GD002', type:'ภาษีป้าย', customer:'บริษัท ทรัพย์สมบูรณ์', vin:'LVVDBCAE1PD234567', status:'รอดำเนินการ', dueDate:'2026-07-01', officer:'ฝ่ายทะเบียน', note:'ต่อภาษีประจำปี 2569' },
  { id:'GD003', type:'ตรวจสภาพ (ตรอ.)', customer:'คุณนภา รุ่งเรือง', vin:'LVVDBCAE1PD345678', status:'เสร็จสิ้น', dueDate:'2026-06-15', officer:'ช่างตรวจ', note:'ผ่านเรียบร้อย' },
  { id:'GD004', type:'หนังสือมอบอำนาจ', customer:'คุณพรทิพย์ วงษ์ทอง', vin:'LVVDBCAE1PD456789', status:'รอดำเนินการ', dueDate:'2026-06-25', officer:'Admin', note:'รอลายเซ็นเจ้าของ' },
  { id:'GD005', type:'ทะเบียนรถใหม่', customer:'คุณเกรียงไกร สมศักดิ์', vin:'LVVDBCAE1PD567890', status:'กำลังดำเนินการ', dueDate:'2026-06-22', officer:'ฝ่ายทะเบียน', note:'ยื่นขอหมายเลขทะเบียนแล้ว' },
  { id:'GD006', type:'ประกันภัย', customer:'คุณสมชาย ดีมาก', vin:'LVVDBCAE1PD678901', status:'เสร็จสิ้น', dueDate:'2026-06-10', officer:'ฝ่ายประกัน', note:'คุ้มครองเริ่ม 2026-06-10' },
]

export default async function GovDocsPage(container) {
  const myGen = container.__routerGen
  let govDocs = DEMO_DOCS.map(d => ({ ...d }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('gov_docs', [], 'dueDate', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `GD${String(i+1).padStart(3,'0')}`,
        type: d.type || '',
        customer: d.customer || '',
        vin: d.vin || '',
        status: d.status || 'รอดำเนินการ',
        dueDate: d.dueDate || '',
        officer: d.officer || '',
        note: d.note || '',
      }))
      govDocs = [...mapped, ...DEMO_DOCS]
      dataSource = 'live'
    }
  } catch {}

  let filterStatus = 'all'
  let filterType = 'all'

  function statusBadge(s) {
    const map = { 'เสร็จสิ้น':'var(--success)', 'กำลังดำเนินการ':'var(--primary)', 'รอดำเนินการ':'var(--warning)' }
    return '<span style="font-size:0.62rem;background:'+( map[s]||'var(--surface-2)')+';color:#fff;padding:2px 8px;border-radius:8px">'+escHtml(s)+'</span>'
  }

  function docRow(d) {
    const isOverdue = d.status!=='เสร็จสิ้น' && new Date(d.dueDate)<new Date()
    return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
      '<td style="padding:8px 10px">' +
        '<div style="font-weight:600;font-size:0.78rem">' + escHtml(d.type) + (isOverdue?'<span style="font-size:0.6rem;color:var(--danger);margin-left:6px">⚠️เกินกำหนด</span>':'') + '</div>' +
        '<div style="font-size:0.66rem;color:var(--text-muted)">' + escHtml(d.vin) + '</div>' +
      '</td>' +
      '<td style="padding:8px 10px;font-size:0.76rem">' + escHtml(d.customer) + '</td>' +
      '<td style="padding:8px 10px">' + statusBadge(d.status) + '</td>' +
      '<td style="padding:8px 10px;font-size:0.74rem;color:'+(isOverdue?'var(--danger)':'var(--text-muted)')+'">' + escHtml(d.dueDate) + '</td>' +
      '<td style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted)">' + escHtml(d.officer) + '</td>' +
      '<td style="padding:8px 10px">' +
        '<button class="btn btn-sm btn-secondary view-btn" data-id="'+escHtml(d.id)+'">ดู</button>' +
      '</td>' +
    '</tr>'
  }

  function render() {
    let list = govDocs
    if(filterStatus!=='all') list = list.filter(d=>d.status===filterStatus)
    if(filterType!=='all') list = list.filter(d=>d.type===filterType)

    const done = govDocs.filter(d=>d.status==='เสร็จสิ้น').length
    const inProgress = govDocs.filter(d=>d.status==='กำลังดำเนินการ').length
    const pending = govDocs.filter(d=>d.status==='รอดำเนินการ').length
    const overdue = govDocs.filter(d=>d.status!=='เสร็จสิ้น' && new Date(d.dueDate)<new Date()).length

    const statusBtns = ['all','รอดำเนินการ','กำลังดำเนินการ','เสร็จสิ้น'].map(s=>'<button class="btn btn-sm '+(filterStatus===s?'btn-primary':'btn-secondary')+' sf-btn" data-s="'+s+'">'+( s==='all'?'ทั้งหมด':s)+'</button>').join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 เอกสารราชการ</div>
            <div class="page-subtitle">โอนกรรมสิทธิ์ · ภาษีป้าย · หนังสือมอบอำนาจ · ตรวจสภาพ · ทะเบียน${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-doc-btn">+ เพิ่มเอกสาร</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('📋 รอดำเนินการ', pending+' รายการ', 'var(--warning)')}
          ${sc('⚙️ กำลังดำเนินการ', inProgress+' รายการ', 'var(--primary)')}
          ${sc('✅ เสร็จสิ้น', done+' รายการ', 'var(--success)')}
          ${sc('⚠️ เกินกำหนด', overdue+' รายการ', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
          ${statusBtns}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead>
              <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">ประเภทเอกสาร</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">ลูกค้า</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">สถานะ</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">กำหนดเสร็จ</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">ผู้รับผิดชอบ</th>
                <th style="padding:10px 10px"></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(d=>docRow(d)).join('')}
            </tbody>
          </table>
        </div>
      </div>`

    container.querySelectorAll('.sf-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.view-btn').forEach(b=>b.addEventListener('click',()=>{
      const d = govDocs.find(x=>x.id===b.dataset.id)
      if(!d) return
      openModal({
        title: '📋 '+escHtml(d.type),
        size: 'sm',
        body: '<div style="font-size:0.84rem;line-height:2">' +
          '<div><b>ลูกค้า:</b> '+escHtml(d.customer)+'</div>' +
          '<div><b>VIN:</b> '+escHtml(d.vin)+'</div>' +
          '<div><b>สถานะ:</b> '+escHtml(d.status)+'</div>' +
          '<div><b>กำหนดเสร็จ:</b> '+escHtml(d.dueDate)+'</div>' +
          '<div><b>ผู้รับผิดชอบ:</b> '+escHtml(d.officer)+'</div>' +
          '<div><b>หมายเหตุ:</b> '+escHtml(d.note)+'</div>' +
        '</div>',
        confirmText: 'อัปเดตสถานะ',
        onConfirm: () => { showToast('✅ อัปเดตสถานะแล้ว','success'); return true }
      })
    }))
    document.getElementById('add-doc-btn')?.addEventListener('click', openAddDocModal)
  }

  function openAddDocModal() {
    const today = new Date().toISOString().slice(0, 10)
    openModal({
      title: '📋 เพิ่มงานเอกสารราชการ',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภทเอกสาร *</label>
            <select id="gd-type" class="input">
              ${DOC_TYPES.map(t=>`<option>${t}</option>`).join('')}
            </select>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อลูกค้า *</label>
            <input id="gd-cust" class="input" placeholder="คุณ... / บริษัท..."></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">VIN / เลขตัวถัง</label>
            <input id="gd-vin" class="input" placeholder="LVVDBCAE1PD..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ผู้รับผิดชอบ</label>
              <input id="gd-off" class="input" placeholder="ฝ่ายทะเบียน / Admin..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">กำหนดเสร็จ</label>
              <input id="gd-due" type="date" class="input" value="${today}"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">หมายเหตุ</label>
            <input id="gd-note" class="input" placeholder="รายละเอียดเพิ่มเติม..."></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="gd-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('gd-save')?.addEventListener('click', () => {
      const customer = document.getElementById('gd-cust')?.value.trim()
      if (!customer) { showToast('⚠️ กรุณากรอกชื่อลูกค้า', 'warning'); return }
      govDocs.push({
        id: 'GD' + String(govDocs.length + 1).padStart(3,'0'),
        type: document.getElementById('gd-type')?.value || DOC_TYPES[0],
        customer,
        vin: document.getElementById('gd-vin')?.value.trim() || '-',
        status: 'รอดำเนินการ',
        dueDate: document.getElementById('gd-due')?.value || today,
        officer: document.getElementById('gd-off')?.value.trim() || 'ฝ่ายทะเบียน',
        note: document.getElementById('gd-note')?.value.trim() || '',
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ เพิ่มงานเอกสารแล้ว', 'success')
      render()
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
