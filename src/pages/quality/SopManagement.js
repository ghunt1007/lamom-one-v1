/**
 * SOP Management — คู่มือขั้นตอนการปฏิบัติงาน
 * Route: /quality/sop
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const SOP_CATS = {
  sales:    { label: 'การขาย', color: 'primary', icon: '🎯' },
  service:  { label: 'ศูนย์บริการ', color: 'warning', icon: '🔧' },
  delivery: { label: 'ส่งมอบรถ', color: 'success', icon: '🚗' },
  finance:  { label: 'การเงิน', color: 'secondary', icon: '💰' },
  hr:       { label: 'HR', color: 'secondary', icon: '👥' },
  pdpa:     { label: 'PDPA', color: 'danger', icon: '🛡' },
  safety:   { label: 'ความปลอดภัย', color: 'danger', icon: '⛑' },
}

const SOP_STATUS = {
  draft:    { label: 'ร่าง', color: 'secondary' },
  review:   { label: 'รอรีวิว', color: 'warning' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  archived: { label: 'เก็บเข้าคลัง', color: 'secondary' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_SOPS = [
  { id: 'SOP001', title: 'ขั้นตอนการรับลูกค้าเข้าโชว์รูม', category: 'sales', version: '1.2',
    status: 'approved', owner: 'ผู้จัดการขาย', updatedDate: addDays(-30), reviewDate: addDays(335),
    steps: ['ต้อนรับลูกค้าด้วยรอยยิ้มภายใน 30 วินาที','เชิญนั่งพักและเสนอเครื่องดื่ม','ถามความต้องการและงบประมาณ','นำเสนอรุ่นที่เหมาะสม','เสนอทดลองขับ'],
    tags: ['customer', 'showroom', 'greeting'] },
  { id: 'SOP002', title: 'ขั้นตอน PDI (Pre-Delivery Inspection)', category: 'delivery', version: '2.0',
    status: 'approved', owner: 'หัวหน้าช่าง', updatedDate: addDays(-14), reviewDate: addDays(351),
    steps: ['ตรวจสอบสภาพภายนอก - ขีดข่วน รอยเว้า','ตรวจภายใน - เบาะ แผงหน้าปัด','ตรวจระบบ EV - แบต ชาร์จ','ตรวจเอกสาร - สมุดคู่มือ ใบจดทะเบียน','ทดสอบการขับขี่ 5 กม.','บันทึกผลใน Checklist'],
    tags: ['pdi', 'delivery', 'quality'] },
  { id: 'SOP003', title: 'นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)', category: 'pdpa', version: '1.0',
    status: 'approved', owner: 'ฝ่ายกฎหมาย', updatedDate: addDays(-90), reviewDate: addDays(275),
    steps: ['ขอความยินยอมก่อนเก็บข้อมูล','ใช้ข้อมูลตามวัตถุประสงค์ที่แจ้ง','ไม่เปิดเผยข้อมูลโดยไม่ได้รับอนุญาต','ลูกค้ามีสิทธิ์ขอลบข้อมูล','เก็บรักษาข้อมูลอย่างปลอดภัย'],
    tags: ['pdpa', 'privacy', 'legal'] },
  { id: 'SOP004', title: 'ขั้นตอนการรับ Job Card และการซ่อม', category: 'service', version: '1.5',
    status: 'review', owner: 'หัวหน้าช่าง', updatedDate: addDays(-3), reviewDate: addDays(362),
    steps: ['รับรถจากลูกค้า ตรวจสอบสภาพเบื้องต้น','เปิด Job Card ในระบบ','วิเคราะห์ปัญหาและประเมินค่าใช้จ่าย','แจ้งลูกค้าก่อนดำเนินการ','ดำเนินการซ่อม','ตรวจงานหลังซ่อม','ส่งคืนรถลูกค้า'],
    tags: ['service', 'jobcard', 'repair'] },
]

export default async function SopManagementPage(container) {
  let catFilter = 'all'
  let statusFilter = 'all'
  let search = ''
  let sops = DEMO_SOPS.map(s => ({ ...s }))

  function filtered() {
    return sops.filter(s => {
      if (catFilter !== 'all' && s.category !== catFilter) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }

  function renderPage() {
    const list = filtered()
    const approved = sops.filter(s => s.status === 'approved').length
    const pending = sops.filter(s => s.status === 'review').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 SOP Management</div>
            <div class="page-subtitle">คู่มือขั้นตอนการปฏิบัติงาน — มาตรฐานองค์กร</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-sop-btn">+ สร้าง SOP</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 SOP ทั้งหมด', sops.length, 'primary')}
          ${kpi('✅ อนุมัติแล้ว', approved, 'success')}
          ${kpi('⏳ รอรีวิว', pending, pending > 0 ? 'warning' : 'secondary')}
          ${kpi('📂 หมวดหมู่', Object.keys(SOP_CATS).length, 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-inp" placeholder="🔍 ค้นหา..." style="max-width:200px" value="${search}">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
            ${Object.entries(SOP_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
          <select class="input" id="status-sel" style="max-width:150px">
            <option value="all">ทุกสถานะ</option>
            ${Object.entries(SOP_STATUS).map(([k,v]) => `<option value="${k}" ${statusFilter===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
          ${list.map(s => {
            const sc = SOP_CATS[s.category]
            const ss = SOP_STATUS[s.status]
            return `<div class="card" style="padding:14px;cursor:pointer;border-left:3px solid var(--${sc?.color})" data-id="${s.id}">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:1.3rem">${sc?.icon}</span>
                <div style="display:flex;gap:4px">
                  <span class="badge badge-${ss?.color}" style="font-size:0.65rem">${ss?.label}</span>
                  <span class="badge badge-secondary" style="font-size:0.65rem">v${s.version}</span>
                </div>
              </div>
              <div style="font-weight:700;font-size:0.87rem;margin-bottom:4px">${s.title}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">${sc?.label} · ${s.owner}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">${s.steps.length} ขั้นตอน · อัพเดท ${formatDate(s.updatedDate)}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
                ${s.tags.map(t => `<span style="font-size:0.65rem;padding:2px 6px;background:var(--surface-2);border-radius:10px;color:var(--text-muted)">#${t}</span>`).join('')}
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-sop-btn" data-id="${s.id}" style="flex:1">📖 ดู SOP</button>
                ${s.status === 'review' ? `<button class="btn btn-xs btn-success approve-sop-btn" data-id="${s.id}">✓ อนุมัติ</button>` : ''}
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📋</div><div>ไม่พบ SOP</div></div>` : ''}
        </div>
      </div>
    `

    document.getElementById('search-inp')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    document.getElementById('status-sel')?.addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    document.getElementById('add-sop-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-sop-btn').forEach(b => b.addEventListener('click', () => {
      const s = sops.find(x => x.id === b.dataset.id); if (s) openSopDetail(s)
    }))
    container.querySelectorAll('.approve-sop-btn').forEach(b => b.addEventListener('click', () => {
      const s = sops.find(x => x.id === b.dataset.id)
      if (s) { s.status = 'approved'; showToast(`✅ อนุมัติ "${s.title}" แล้ว`, 'success'); renderPage() }
    }))
  }

  function openSopDetail(s) {
    const sc = SOP_CATS[s.category]
    const ss = SOP_STATUS[s.status]
    openModal({
      title: `📋 ${s.id} — ${s.title}`,
      size: 'lg',
      body: `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <span class="badge badge-${sc?.color}">${sc?.icon} ${sc?.label}</span>
          <span class="badge badge-${ss?.color}">${ss?.label}</span>
          <span class="badge badge-secondary">v${s.version}</span>
          <span style="font-size:0.78rem;color:var(--text-muted)">เจ้าของ: ${s.owner}</span>
          <span style="font-size:0.78rem;color:var(--text-muted)">รีวิวครั้งถัดไป: ${formatDate(s.reviewDate)}</span>
        </div>
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px">📝 ขั้นตอน</div>
        <div>
          ${s.steps.map((step, i) => `
            <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="width:24px;height:24px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0">${i+1}</div>
              <div style="font-size:0.85rem;padding-top:3px">${step}</div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
          ${s.tags.map(t => `<span style="font-size:0.72rem;padding:3px 8px;background:var(--surface-2);border-radius:10px;color:var(--text-muted)">#${t}</span>`).join('')}
        </div>
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ สร้าง SOP ใหม่',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อ SOP *</label><input class="input" id="sf-title" placeholder="ขั้นตอน..."></div>
          <div class="input-group"><label class="input-label">หมวดหมู่</label>
            <select class="input" id="sf-cat">${Object.entries(SOP_CATS).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เจ้าของ</label><input class="input" id="sf-owner" placeholder="ผู้รับผิดชอบ"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ขั้นตอน (แต่ละบรรทัด = 1 ขั้นตอน)</label>
            <textarea class="input" id="sf-steps" rows="6" placeholder="ขั้นตอนที่ 1&#10;ขั้นตอนที่ 2&#10;ขั้นตอนที่ 3"></textarea>
          </div>
        </div>
      `,
      onConfirm() {
        const title = document.getElementById('sf-title')?.value?.trim()
        if (!title) { showToast('❗ กรุณากรอกชื่อ SOP', 'error'); return }
        const steps = (document.getElementById('sf-steps')?.value || '').split('\n').map(s => s.trim()).filter(Boolean)
        sops.unshift({
          id: `SOP${String(sops.length+1).padStart(3,'0')}`, title,
          category: document.getElementById('sf-cat')?.value||'sales', version: '1.0',
          status: 'draft', owner: document.getElementById('sf-owner')?.value||'',
          updatedDate: addDays(0), reviewDate: addDays(365),
          steps: steps.length ? steps : ['ขั้นตอนที่ยังไม่ได้กำหนด'],
          tags: []
        })
        showToast('✅ สร้าง SOP แล้ว!', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
