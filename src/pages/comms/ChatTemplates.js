/**
 * Chat Templates — ข้อความตอบกลับสำเร็จรูป
 * Route: /comms/templates
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TPL_CATS = {
  greeting: { label: 'ทักทาย', color: 'primary', icon: '👋' },
  product:  { label: 'ข้อมูลสินค้า', color: 'success', icon: '🚗' },
  price:    { label: 'ราคา/โปร', color: 'warning', icon: '💰' },
  booking:  { label: 'นัดหมาย', color: 'secondary', icon: '📅' },
  after:    { label: 'หลังการขาย', color: 'danger', icon: '🔧' },
}

const DEMO_TEMPLATES = [
  { id: 'CT001', cat: 'greeting', title: 'ทักทายลูกค้าใหม่', text: 'สวัสดีค่ะ ยินดีต้อนรับสู่ LAMOM 🙏 สนใจรถรุ่นไหนเป็นพิเศษไหมคะ หรือให้แนะนำรุ่นที่เหมาะกับการใช้งานของคุณลูกค้าดีคะ?', usage: 342 },
  { id: 'CT002', cat: 'greeting', title: 'ตอบนอกเวลาทำการ', text: 'ขอบคุณที่ติดต่อ LAMOM ค่ะ ขณะนี้นอกเวลาทำการ (เปิด 8:30-18:00 ทุกวัน) ทีมงานจะรีบติดต่อกลับทันทีในเวลาทำการนะคะ 🙏', usage: 156 },
  { id: 'CT003', cat: 'product', title: 'แนะนำ BYD Dolphin', text: 'BYD Dolphin 🐬 เริ่มต้น 899,000 บาท วิ่งไกล 410 km/ชาร์จ แบต Blade Battery ปลอดภัยสูง รับประกันแบต 8 ปี สนใจนัดทดลองขับไหมคะ?', usage: 218 },
  { id: 'CT004', cat: 'price', title: 'ขอใบเสนอราคา', text: 'ยินดีค่ะ 😊 รบกวนขอข้อมูลเพื่อทำใบเสนอราคา: 1) รุ่น/สีที่สนใจ 2) ชื่อ-นามสกุล 3) เบอร์โทร — เดี๋ยวทีมงานส่งใบเสนอราคาพร้อมโปรล่าสุดให้เลยค่ะ', usage: 187 },
  { id: 'CT005', cat: 'booking', title: 'นัด Test Drive', text: 'นัดทดลองขับได้เลยค่ะ 🚗 สะดวกวันไหน-กี่โมงคะ? (เปิดทุกวัน 8:30-18:00) ใช้แค่ใบขับขี่ใบเดียว ใช้เวลาประมาณ 30 นาทีค่ะ', usage: 264 },
  { id: 'CT006', cat: 'after', title: 'นัดเช็คระยะ', text: 'แจ้งนัดเช็คระยะค่ะ 🔧 รบกวนแจ้ง: 1) ทะเบียนรถ 2) เลขไมล์ปัจจุบัน 3) วันเวลาที่สะดวก — มีบริการรถรับ-ส่งฟรีในรัศมี 10 กม. ค่ะ', usage: 143 },
  { id: 'CT007', cat: 'after', title: 'ติดตามความพอใจหลังซ่อม', text: 'สอบถามความพอใจค่ะ 😊 หลังจากรับรถไปแล้ว ทุกอย่างเรียบร้อยดีไหมคะ? หากมีปัญหาใดๆ แจ้งได้เลยนะคะ ยินดีดูแลค่ะ 🙏', usage: 98 },
]

export default async function ChatTemplatesPage(container) {
  const myGen = container.__routerGen
  let templates = DEMO_TEMPLATES.map(t => ({ ...t }))
  let dataSource = 'demo'
  let catFilter = 'all'
  let search = ''

  try {
    const docs = await listDocs('chat_templates', [], 'usage', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `CT${i+1}`,
        cat: d.cat || d.category || 'greeting',
        title: d.title || d.name || 'Template',
        text: d.text || d.message || d.content || '',
        usage: d.usage || d.useCount || 0,
      }))
      templates = [...mapped, ...DEMO_TEMPLATES]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = templates.filter(t =>
      (catFilter === 'all' || t.cat === catFilter) &&
      (search === '' || t.title.toLowerCase().includes(search) || t.text.toLowerCase().includes(search))
    )
    const totalUsage = templates.reduce((a, t) => a + t.usage, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💬 Chat Templates</div>
            <div class="page-subtitle">ข้อความตอบกลับสำเร็จรูป — LINE / Facebook / SMS${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-tpl-btn">+ สร้าง Template</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('💬 Templates', templates.length, 'primary')}
          ${kpi('📊 ใช้งานรวม', totalUsage.toLocaleString() + ' ครั้ง', 'success')}
          ${kpi('🏆 ยอดนิยม', escHtml([...templates].sort((a,b)=>b.usage-a.usage)[0]?.title || '—'), 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-input" placeholder="ค้นหา..." value="${search}" style="width:180px;padding:6px 10px;font-size:0.8rem">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
            ${Object.entries(TPL_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
          ${list.map(t => {
            const tc = TPL_CATS[t.cat]
            return `<div class="card" style="padding:14px;display:flex;flex-direction:column">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="font-weight:700;font-size:0.85rem">${escHtml(t.title)}</div>
                <span class="badge badge-${tc?.color}" style="font-size:0.6rem;white-space:nowrap">${tc?.icon} ${tc?.label}</span>
              </div>
              <div style="font-size:0.76rem;color:var(--text-muted);line-height:1.5;flex:1;margin-bottom:10px">${escHtml(t.text)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:0.65rem;color:var(--text-muted)">📊 ใช้ ${t.usage} ครั้ง</span>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-secondary edit-btn" data-id="${t.id}">✏️</button>
                  <button class="btn btn-xs btn-primary copy-btn" data-id="${t.id}">📋 คัดลอก</button>
                </div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('search-input')?.addEventListener('input', e => { search = e.target.value.toLowerCase(); renderPage() })
    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', () => {
      const t = templates.find(x => x.id === b.dataset.id)
      if (t) {
        navigator.clipboard?.writeText(t.text).catch(() => {})
        t.usage++
        showToast('📋 คัดลอกข้อความแล้ว — วางในแชทได้เลย', 'success'); renderPage()
      }
    }))
    container.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => {
      const t = templates.find(x => x.id === b.dataset.id); if (t) openEditForm(t)
    }))
    document.getElementById('add-tpl-btn')?.addEventListener('click', () => openEditForm())
  }

  function openEditForm(t = null) {
    openModal({
      title: t ? '✏️ แก้ไข Template' : '+ สร้าง Template',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อ *</label><input class="input" id="ct-title" value="${escHtml(t?.title||'')}"></div>
        <div class="input-group"><label class="input-label">หมวด</label>
          <select class="input" id="ct-cat">${Object.entries(TPL_CATS).map(([k,v])=>`<option value="${k}" ${t?.cat===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">ข้อความ</label><textarea class="input" id="ct-text" rows="4">${escHtml(t?.text||'')}</textarea></div>
      </div>`,
      onConfirm() {
        const title = document.getElementById('ct-title')?.value?.trim()
        if (!title) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
        const text = document.getElementById('ct-text')?.value || ''
        const cat = document.getElementById('ct-cat')?.value || 'greeting'
        if (t) { t.title = title; t.text = text; t.cat = cat }
        else templates.push({ id:`CT${String(templates.length+1).padStart(3,'0')}`, cat, title, text, usage:0 })
        showToast('✅ บันทึก Template แล้ว', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
