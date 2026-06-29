/**
 * Knowledge Base — คลังความรู้ภายใน
 * Route: /training/knowledge
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const KB_CATS = {
  product: { label: 'ผลิตภัณฑ์/รถ', color: 'primary', icon: '🚗' },
  sales:   { label: 'งานขาย', color: 'success', icon: '💼' },
  service: { label: 'งานช่าง', color: 'warning', icon: '🔧' },
  system:  { label: 'ใช้งานระบบ', color: 'secondary', icon: '💻' },
  policy:  { label: 'นโยบาย/HR', color: 'danger', icon: '📜' },
}

const DEMO_ARTICLES = [
  { id: 'KB001', title: 'สเปคเต็ม BYD Seal AWD + จุดขายเทียบคู่แข่ง', cat: 'product', author: 'ผจก.ขาย', views: 234, helpful: 41, updated: addDays(-10), excerpt: 'มอเตอร์คู่ 390kW, 0-100 ใน 3.8 วิ, แบต 82.56 kWh — จุดขายหลักเทียบ Tesla Model 3...' },
  { id: 'KB002', title: 'วิธีตอบเมื่อลูกค้าถาม "แบตเสื่อมไหม เปลี่ยนแพงไหม"', cat: 'sales', author: 'วิชัย ยอดขาย', views: 189, helpful: 38, updated: addDays(-5), excerpt: 'ใช้ข้อมูลจริง: รับประกันแบต 8 ปี/160,000 km + SOH เฉลี่ยหลัง 3 ปียังเกิน 88%...' },
  { id: 'KB003', title: 'SOP ทำงานกับระบบไฟแรงสูง (HV) — บังคับอ่าน', cat: 'service', author: 'วิทยา ช่างใหญ่', views: 156, helpful: 52, updated: addDays(-30), excerpt: 'ก่อนแตะระบบ HV ทุกครั้ง: ปิดระบบ → ถอด service plug → รอ 10 นาที → วัดไฟยืนยัน 0V...' },
  { id: 'KB004', title: 'วิธีสร้างใบเสนอราคาใน LAMOM ONE', cat: 'system', author: 'Admin', views: 98, helpful: 22, updated: addDays(-15), excerpt: 'ไปที่ การขาย → ใบเสนอราคา → เลือกลูกค้า → เลือกรุ่น/สี/ของแถม → ระบบคำนวณให้...' },
  { id: 'KB005', title: 'ระเบียบการลา + วิธียื่นในระบบ', cat: 'policy', author: 'HR', views: 145, helpful: 30, updated: addDays(-60), excerpt: 'ลาป่วยแจ้งก่อน 9:00 / ลากิจล่วงหน้า 3 วัน / ลาพักร้อนล่วงหน้า 7 วัน — ยื่นผ่าน HR → ลาพนักงาน...' },
  { id: 'KB006', title: 'Troubleshooting: ลูกค้าชาร์จไฟไม่เข้า เช็คอะไรบ้าง', cat: 'service', author: 'สุรชัย มือดี', views: 121, helpful: 35, updated: addDays(-7), excerpt: '1) เช็คสาย/หัวชาร์จ 2) ดู error code บนจอ 3) ทดสอบกับตู้ชาร์จศูนย์ 4) อ่านค่า OBC...' },
]

export default async function KnowledgeBasePage(container) {
  let articles = DEMO_ARTICLES.map(a => ({ ...a }))
  let catFilter = 'all'
  let search = ''

  function renderPage() {
    const list = articles
      .filter(a => (catFilter === 'all' || a.cat === catFilter) && (search === '' || a.title.toLowerCase().includes(search) || a.excerpt.toLowerCase().includes(search)))
      .sort((a, b) => b.views - a.views)
    const totalViews = articles.reduce((a, x) => a + x.views, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📚 Knowledge Base</div>
            <div class="page-subtitle">คลังความรู้ภายใน — ค้นหาคำตอบได้เอง</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-kb-btn">+ เขียนบทความ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📚 บทความ', articles.length, 'primary')}
          ${kpi('👁 อ่านรวม', totalViews.toLocaleString() + ' ครั้ง', 'success')}
          ${kpi('🔥 ยอดนิยม', list[0]?.title.slice(0, 22) + '…' || '—', 'secondary')}
        </div>

        <!-- Search + filter -->
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-input" placeholder="🔍 ค้นหาความรู้..." value="${search}" style="width:240px;padding:8px 12px;font-size:0.85rem">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
            ${Object.entries(KB_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(a => {
            const kc = KB_CATS[a.cat]
            return `<div class="card kb-card" data-id="${a.id}" style="padding:14px;cursor:pointer;border-left:3px solid var(--${kc?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div style="font-weight:700;font-size:0.88rem">${a.title}</div>
                <span class="badge badge-${kc?.color}" style="font-size:0.6rem;white-space:nowrap">${kc?.icon} ${kc?.label}</span>
              </div>
              <div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:8px;line-height:1.5">${a.excerpt}</div>
              <div style="display:flex;justify-content:space-between;font-size:0.66rem;color:var(--text-muted)">
                <span>✍️ ${a.author} · อัปเดต ${timeAgo(a.updated)}</span>
                <span>👁 ${a.views} · 👍 ${a.helpful}</span>
              </div>
            </div>`
          }).join('')}
          ${list.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:0.85rem">🔍 ไม่พบบทความ — ลองคำค้นอื่น</div>' : ''}
        </div>
      </div>
    `

    document.getElementById('search-input')?.addEventListener('input', e => { search = e.target.value.toLowerCase(); renderPage() })
    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.kb-card').forEach(c => c.addEventListener('click', () => {
      const a = articles.find(x => x.id === c.dataset.id)
      if (a) {
        a.views++
        openModal({
          title: a.title,
          size: 'md',
          body: `<div style="font-size:0.85rem;line-height:1.7">
            <p>${a.excerpt}</p>
            <p style="color:var(--text-muted)">— (เนื้อหาเต็มของบทความ — Demo)</p>
            <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
              ✍️ ${a.author} · 👁 ${a.views} ครั้ง · 👍 ${a.helpful} คนบอกว่ามีประโยชน์
            </div>
          </div>`,
          confirmText: '👍 มีประโยชน์',
          onConfirm() { a.helpful++; showToast('👍 ขอบคุณสำหรับ feedback!', 'success'); renderPage() }
        })
        renderPage()
      }
    }))
    document.getElementById('add-kb-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เขียนบทความใหม่',
        size: 'md',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="kb-title"></div>
          <div class="input-group"><label class="input-label">หมวด</label>
            <select class="input" id="kb-cat">${Object.entries(KB_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เนื้อหา *</label><textarea class="input" id="kb-content" rows="5"></textarea></div>
        </div>`,
        onConfirm() {
          const title = document.getElementById('kb-title')?.value?.trim()
          const content = document.getElementById('kb-content')?.value?.trim()
          if (!title || !content) { showToast('❗ กรอกหัวข้อและเนื้อหา', 'error'); return }
          articles.unshift({ id:`KB${String(articles.length+1).padStart(3,'0')}`, title, cat:document.getElementById('kb-cat')?.value||'system', author:'คุณ (Demo)', views:0, helpful:0, updated:new Date().toISOString(), excerpt:content.slice(0,120)+(content.length>120?'…':'') })
          showToast('📚 เผยแพร่บทความแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
