/**
 * Customer Notes — สมุดบันทึกลูกค้า (Timeline)
 * Route: /crm/notes
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const NOTE_TYPES = {
  call:    { label: 'โทรศัพท์', color: 'primary', icon: '📞' },
  visit:   { label: 'เข้าพบ', color: 'success', icon: '🤝' },
  chat:    { label: 'แชท/LINE', color: 'secondary', icon: '💬' },
  email:   { label: 'อีเมล', color: 'secondary', icon: '📧' },
  internal:{ label: 'บันทึกภายใน', color: 'warning', icon: '📌' },
}

const DEMO_CUSTOMERS = ['สมชาย ใจดี', 'มาลี สุขใจ', 'ธนพล เที่ยงตรง', 'อรทัย ตั้งใจ']

const DEMO_NOTES = [
  { id: 'N001', customer: 'สมชาย ใจดี', type: 'call', text: 'โทรสอบถามโปรเดือนนี้ — สนใจ BYD Seal สีดำ บอกว่าจะมาดูเสาร์นี้', staff: 'วิชัย ยอดขาย', time: addHours(2), pinned: true },
  { id: 'N002', customer: 'สมชาย ใจดี', type: 'internal', text: 'ลูกค้าเคยขอส่วนลดเกิน floor — ระวังตอนต่อรอง ให้เน้นของแถมแทน', staff: 'ผจก.ขาย', time: addHours(26), pinned: true },
  { id: 'N003', customer: 'มาลี สุขใจ', type: 'visit', text: 'มารับรถหลังเช็คระยะ พอใจมาก ฝากถามเรื่อง Wallbox สำหรับบ้าน', staff: 'วิทยา ช่างใหญ่', time: addHours(5), pinned: false },
  { id: 'N004', customer: 'ธนพล เที่ยงตรง', type: 'chat', text: 'ทัก LINE ถามค่างวดไฟแนนซ์ 48 vs 60 เดือน — ส่งตารางเทียบให้แล้ว', staff: 'สุดา มาดี', time: addHours(8), pinned: false },
  { id: 'N005', customer: 'อรทัย ตั้งใจ', type: 'email', text: 'ส่งใบเสนอราคา MG4 + อุปกรณ์เสริมตามที่ขอ', staff: 'ธนา เก่ง', time: addHours(30), pinned: false },
  { id: 'N006', customer: 'มาลี สุขใจ', type: 'internal', text: 'ลูกค้า VIP — ซื้อ 2 คันแล้ว แนะนำเพื่อนมาอีก 1 ดูแลพิเศษ', staff: 'ผจก.ขาย', time: addHours(100), pinned: true },
]

export default async function CustomerNotesPage(container) {
  const myGen = container.__routerGen
  let notes = DEMO_NOTES.map(n => ({ ...n }))
  let dataSource = 'demo'
  let customerFilter = 'all'
  let typeFilter = 'all'

  try {
    const docs = await listDocs('customer_notes', [], 'time', 'desc', 500).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `N${i+1}`,
        customer: d.customer || d.customerName || 'ลูกค้า',
        type: d.type || 'internal',
        text: d.text || d.note || d.content || '',
        staff: d.staff || d.staffName || '',
        time: d.time || d.createdAt || new Date().toISOString(),
        pinned: d.pinned || false,
      }))
      notes = [...mapped, ...DEMO_NOTES]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = notes
      .filter(n => (customerFilter === 'all' || n.customer === customerFilter) && (typeFilter === 'all' || n.type === typeFilter))
      .sort((a, b) => (b.pinned - a.pinned) || b.time.localeCompare(a.time))
    const pinnedCount = notes.filter(n => n.pinned).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📒 Customer Notes</div>
            <div class="page-subtitle">สมุดบันทึกลูกค้า — ทุกการติดต่อในที่เดียว${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-note-btn">+ บันทึกใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📒 บันทึกทั้งหมด', notes.length, 'primary')}
          ${kpi('📌 ปักหมุด', pinnedCount, 'warning')}
          ${kpi('🕐 ล่าสุด', timeAgo(notes.reduce((a,n) => n.time > a ? n.time : a, '')), 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <select class="input" id="cust-filter" style="width:180px;padding:6px 10px;font-size:0.8rem">
            <option value="all">ลูกค้าทุกคน</option>
            ${DEMO_CUSTOMERS.map(c => `<option ${customerFilter===c?'selected':''}>${c}</option>`).join('')}
          </select>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
            ${Object.entries(NOTE_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Timeline -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(n => {
            const nt = NOTE_TYPES[n.type]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${nt?.color})${n.pinned?';background:var(--warning)08':''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">
                <div style="display:flex;gap:8px;align-items:center">
                  <span style="font-size:1rem">${nt?.icon}</span>
                  <div>
                    <span style="font-weight:700;font-size:0.83rem">${escHtml(n.customer)}</span>
                    ${n.pinned ? '<span style="font-size:0.7rem;margin-left:6px">📌</span>' : ''}
                  </div>
                </div>
                <span style="font-size:0.68rem;color:var(--text-muted)">${timeAgo(n.time)}</span>
              </div>
              <div style="font-size:0.8rem;margin-bottom:6px;line-height:1.5">${escHtml(n.text)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:0.67rem;color:var(--text-muted)">✍️ ${escHtml(n.staff)} · ${nt?.label}</span>
                <button class="btn btn-xs btn-secondary pin-btn" data-id="${n.id}">${n.pinned?'📌 เลิกปัก':'📌 ปักหมุด'}</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('cust-filter')?.addEventListener('change', e => { customerFilter = e.target.value; renderPage() })
    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.pin-btn').forEach(b => b.addEventListener('click', () => {
      const n = notes.find(x => x.id === b.dataset.id); if (n) { n.pinned = !n.pinned; renderPage() }
    }))
    document.getElementById('add-note-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ บันทึกการติดต่อ',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ลูกค้า</label>
            <select class="input" id="nt-customer">${DEMO_CUSTOMERS.map(c=>`<option>${c}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ช่องทาง</label>
            <select class="input" id="nt-type">${Object.entries(NOTE_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">บันทึก *</label><textarea class="input" id="nt-text" rows="3"></textarea></div>
        </div>`,
        onConfirm() {
          const text = document.getElementById('nt-text')?.value?.trim()
          if (!text) { showToast('❗ กรุณากรอกบันทึก', 'error'); return }
          notes.unshift({ id:`N${String(notes.length+1).padStart(3,'0')}`, customer:document.getElementById('nt-customer')?.value||DEMO_CUSTOMERS[0], type:document.getElementById('nt-type')?.value||'call', text, staff:'คุณ (Demo)', time:new Date().toISOString(), pinned:false })
          showToast('✅ บันทึกแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
