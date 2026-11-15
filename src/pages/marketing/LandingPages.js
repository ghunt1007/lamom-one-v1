/**
 * Landing Pages — สร้างหน้า Campaign / Lead Form ไม่ต้องพึ่ง Dev
 * Route: /marketing/landing-pages
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { todayBangkok } from '../../utils/format.js'
import { escHtml as esc } from '../../utils/escape.js'
import { withUtm, utmLeadCounts, utmKey, leadFormUrl } from '../../utils/publicLinks.js'
import { companyScopeFilters } from '../../core/companyScope.js'

// ป้องกัน XSS — ชื่อหน้า/Campaign เป็นข้อมูลที่ผู้ใช้พิมพ์เอง ต้อง escape ก่อนแสดงผลเสมอ

const TEMPLATES =[
  { id:'t1', name:'Test Drive Form',    icon:'🚗' },
  { id:'t2', name:'Promotion Landing',  icon:'🎯' },
  { id:'t3', name:'Event Registration', icon:'🎪' },
  { id:'t4', name:'Lead Capture Basic', icon:'📋' },
]

export const pageLink = p => withUtm(leadFormUrl(), { source: 'landing', medium: 'form', campaign: p.campaign || p.title || '' })

export default async function LandingPagesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let PAGES = []
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { PAGES = await listDocs('landing_pages', [], 'created', 'desc', 500) } catch (e) { PAGES = [] }
    // (v1.0.1177) แต่ละหน้า = ลิงก์ฟอร์มฝากชื่อ-เบอร์ของเราที่ติดชื่อแคมเปญ (utm_source=landing) นับลีดจริงจากลูกค้า
    let counts = null
    try { counts = utmLeadCounts(await listDocs('customers', [...companyScopeFilters(), ['autoLead', '==', true]], 'createdAt', 'desc', 2000)) } catch (e) { counts = null }
    PAGES = PAGES.map(p => ({ ...p, leads: counts ? (counts[utmKey('landing', p.campaign)] || 0) : (Number(p.leads) || 0), link: pageLink(p) }))
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function pageRow(p) {
    const isActive  = p.status === 'active'
    const statusBg  = isActive ? 'var(--success)' : 'var(--text-muted)'
    const statusLabel = isActive ? '🟢 Active' : '⬛ Ended'
    const editBtn = isActive ? '<button class="btn btn-xs btn-secondary edit-btn" data-id="' + p.id + '" style="font-size:0.68rem">✏️ แก้ไข</button>' : ''
    return `<div class="card" style="padding:14px">
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="font-size:1.5rem">🌐</div>
        <div style="flex:1 1 200px;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:0.88rem">${esc(p.title)}</span>
            <span style="font-size:0.62rem;background:${statusBg};color:#fff;padding:1px 8px;border-radius:8px">${statusLabel}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">📣 ${esc(p.campaign)} · สร้าง ${p.created}</div>
          <div style="font-size:0.74rem">🎯 ${p.leads} ลีด</div>
          <div style="font-size:0.7rem;color:var(--text-muted);overflow-wrap:anywhere;word-break:break-all">${esc(p.link)}</div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:100%">
          <button class="btn btn-xs btn-primary link-btn" data-id="${p.id}" style="font-size:0.68rem">🔗 คัดลอกลิงก์</button>
          <button class="btn btn-xs btn-secondary preview-btn" data-id="${p.id}" style="font-size:0.68rem">👁 ดูตัวอย่าง</button>
          ${editBtn}
          <button class="btn btn-xs btn-secondary dup-btn" data-id="${p.id}" style="font-size:0.68rem">📋 คัดลอก</button>
        </div>
      </div>
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let rows = PAGES
    if (filterStatus !== 'all') rows = rows.filter(p=>p.status===filterStatus)

    const active  = PAGES.filter(p=>p.status==='active').length
    const totLead = PAGES.reduce((s,p)=>s+p.leads,0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🌐 Landing Pages</div>
            <div class="page-subtitle">สร้างหน้า Campaign / Lead Form ไม่ต้องพึ่ง Dev · ${PAGES.length} หน้า</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-page-btn">+ สร้างหน้าใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:12px;margin-bottom:12px">
          ${sc('🌐 หน้าที่เปิดอยู่', active+' หน้า', 'var(--primary)')}
          ${sc('🎯 ลีดรวม', totLead+' ราย', 'var(--success)')}
        </div>
        <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:14px;line-height:1.6">แต่ละหน้าคือลิงก์ฟอร์มฝากชื่อ-เบอร์ของเราที่ติดชื่อแคมเปญไว้ เอาไปใส่โฆษณา/โพสต์ได้เลย ลีดที่กรอกเข้ามาจะนับให้หน้านั้นอัตโนมัติ (ฟอร์มต้องเปิดรับอยู่)</div>

        <div style="display:flex;gap:6px;margin-bottom:14px">
          ${['all','active','ended'].map(s=>`<button class="btn btn-xs ${filterStatus===s?'btn-primary':'btn-secondary'} stat-btn" data-s="${s}">${s==='all'?'ทั้งหมด':s==='active'?'🟢 Active':'⬛ Ended'}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(p=>pageRow(p)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบหน้า Landing</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.link-btn').forEach(b=>b.addEventListener('click',()=>{
      const p=PAGES.find(x=>x.id===b.dataset.id)
      if(!p) return
      navigator.clipboard?.writeText(p.link).then(()=>showToast('🔗 คัดลอกลิงก์แล้ว · '+p.link,'success')).catch(()=>showToast('🔗 '+p.link,'success'))
    }))
    container.querySelectorAll('.preview-btn').forEach(b=>b.addEventListener('click',()=>{
      const p=PAGES.find(x=>x.id===b.dataset.id)
      if(p) openPreviewModal(p)
    }))
    container.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click',()=>{
      const p=PAGES.find(x=>x.id===b.dataset.id)
      if(p) openEditModal(p)
    }))
    container.querySelectorAll('.dup-btn').forEach(b=>b.addEventListener('click',async ()=>{
      const p=PAGES.find(x=>x.id===b.dataset.id)
      if(!p) return
      try {
        await createDoc('landing_pages', { title:'[Copy] '+p.title, campaign:p.campaign, leads:0, status:'active', created:todayBangkok() })
        showToast('📋 Duplicate: '+p.title,'success')
        await loadData()
      } catch (e) { showToast('ทำสำเนาไม่สำเร็จ', 'error') }
    }))
    document.getElementById('new-page-btn')?.addEventListener('click',()=>openNewModal())
  }

  function openPreviewModal(p) {
    openModal({
      title: '👁 Preview — ' + esc(p.title),
      size: 'md',
      body: `
        <div style="font-size:0.82rem">
          <div style="margin-bottom:12px;line-height:1.6">ลูกค้าที่เปิดลิงก์นี้จะเห็นฟอร์มฝากชื่อ-เบอร์ของเรา และลีดจะติดแคมเปญ <b>${esc(p.campaign)}</b></div>
          <div style="font-size:0.74rem;color:var(--primary);overflow-wrap:anywhere;margin-bottom:10px">${esc(p.link)}</div>
          <a class="btn btn-primary btn-sm" href="${esc(p.link)}" target="_blank" rel="noopener" style="margin-bottom:14px">👁 เปิดดูหน้าจริง</a>
          <div style="background:var(--surface-2);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:1rem;font-weight:700;color:var(--success)">${p.leads}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">ลีดจากหน้านี้</div>
          </div>
        </div>
      `
    })
  }

  function openEditModal(p) {
    openModal({
      title: '✏️ แก้ไข Landing Page',
      size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อหน้า *</label>
            <input id="ep-title" class="input" value="${esc(p.title)}"></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">Campaign</label>
            <input id="ep-camp" class="input" value="${esc(p.campaign)}"></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">สถานะ</label>
            <select id="ep-status" class="input">
              <option value="active" ${p.status==='active'?'selected':''}>🟢 Active</option>
              <option value="ended" ${p.status==='ended'?'selected':''}>⬛ Ended</option>
            </select>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="ep-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('ep-save')?.addEventListener('click', async () => {
      const title = document.getElementById('ep-title')?.value.trim()
      if (!title) { showToast('⚠️ กรุณากรอกชื่อหน้า', 'warning'); return }
      const campaign = document.getElementById('ep-camp')?.value.trim() || p.campaign
      const status = document.getElementById('ep-status')?.value || p.status
      try {
        await updateDocData('landing_pages', p.id, { title, campaign, status })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ อัปเดต Landing Page: ' + title, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openNewModal() {
    const tmplOpts = TEMPLATES.map(t=>'<label style="display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--border);border-radius:6px;cursor:pointer"><input type="radio" name="tmpl" value="' + t.id + '"> ' + t.icon + ' ' + t.name + '</label>').join('')
    openModal({
      title:'🌐 สร้าง Landing Page ใหม่', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อหน้า</label><input class="input" id="lp-title" style="width:100%;margin-top:3px" placeholder="เช่น BYD Atto 3 โปรพิเศษ..."></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">Campaign</label><input class="input" id="lp-camp" style="width:100%;margin-top:3px" placeholder="ชื่อ Campaign..."></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เลือก Template</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">${tmplOpts}</div>
        </div>
      </div>`,
      confirmText:'🌐 สร้างหน้า',
      async onConfirm() {
        const title=document.getElementById('lp-title')?.value?.trim()
        const camp=document.getElementById('lp-camp')?.value?.trim()
        if(!title||!camp){showToast('ใส่ชื่อหน้าและ Campaign','warning');return false}
        try {
          await createDoc('landing_pages', { title, campaign:camp, leads:0, status:'active', created:todayBangkok() })
          showToast('🌐 สร้าง Landing Page: '+title,'success')
          await loadData()
        } catch (e) { showToast('สร้างไม่สำเร็จ', 'error') }
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
