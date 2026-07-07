/**
 * Landing Pages — สร้างหน้า Campaign / Lead Form ไม่ต้องพึ่ง Dev
 * Route: /marketing/landing-pages
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const TEMPLATES = [
  { id:'t1', name:'Test Drive Form',    icon:'🚗' },
  { id:'t2', name:'Promotion Landing',  icon:'🎯' },
  { id:'t3', name:'Event Registration', icon:'🎪' },
  { id:'t4', name:'Lead Capture Basic', icon:'📋' },
]

export default async function LandingPagesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let PAGES = []
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { PAGES = await listDocs('landing_pages', [], 'created', 'desc', 500) } catch (e) { PAGES = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function pageRow(p) {
    const isActive  = p.status === 'active'
    const convColor = p.conv >= 7 ? 'var(--success)' : p.conv >= 5 ? 'var(--warning)' : 'var(--danger)'
    const statusBg  = isActive ? 'var(--success)' : 'var(--text-muted)'
    const statusLabel = isActive ? '🟢 Active' : '⬛ Ended'
    const editBtn = isActive ? '<button class="btn btn-xs btn-secondary edit-btn" data-id="' + p.id + '" style="font-size:0.68rem">✏️ แก้ไข</button>' : ''
    return `<div class="card" style="padding:14px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:1.5rem">🌐</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.88rem">${p.title}</span>
            <span style="font-size:0.62rem;background:${statusBg};color:#fff;padding:1px 8px;border-radius:8px">${statusLabel}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">📣 ${p.campaign} · สร้าง ${p.created}</div>
          <div style="display:flex;gap:16px;font-size:0.74rem">
            <span>👁 ${p.visits.toLocaleString()} visits</span>
            <span>🎯 ${p.leads} leads</span>
            <span style="color:${convColor};font-weight:700">🔄 ${p.conv}% conv.</span>
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-xs btn-secondary preview-btn" data-id="${p.id}" style="font-size:0.68rem">👁 Preview</button>
          ${editBtn}
          <button class="btn btn-xs btn-secondary dup-btn" data-id="${p.id}" style="font-size:0.68rem">📋 Copy</button>
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
    const totVis  = PAGES.reduce((s,p)=>s+p.visits,0)
    const totLead = PAGES.reduce((s,p)=>s+p.leads,0)
    const avgConv = (totLead/totVis*100).toFixed(1)

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

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🌐 Active Pages', active+' หน้า', 'var(--primary)')}
          ${sc('👁 รวม Visits', totVis.toLocaleString(), 'var(--primary)')}
          ${sc('🎯 รวม Leads', totLead+' ราย', 'var(--success)')}
          ${sc('🔄 Avg Conversion', avgConv+'%', 'var(--warning)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">
          ${['all','active','ended'].map(s=>`<button class="btn btn-xs ${filterStatus===s?'btn-primary':'btn-secondary'} stat-btn" data-s="${s}">${s==='all'?'ทั้งหมด':s==='active'?'🟢 Active':'⬛ Ended'}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(p=>pageRow(p)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบหน้า Landing</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
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
        await createDoc('landing_pages', { title:'[Copy] '+p.title, campaign:p.campaign, visits:0, leads:0, conv:0, status:'active', created:new Date().toISOString().slice(0,10) })
        showToast('📋 Duplicate: '+p.title,'success')
        await loadData()
      } catch (e) { showToast('ทำสำเนาไม่สำเร็จ', 'error') }
    }))
    document.getElementById('new-page-btn')?.addEventListener('click',()=>openNewModal())
  }

  function openPreviewModal(p) {
    const convColor = p.conv >= 7 ? 'var(--success)' : p.conv >= 5 ? 'var(--warning)' : 'var(--danger)'
    openModal({
      title: '👁 Preview — ' + p.title,
      size: 'md',
      body: `
        <div style="font-size:0.82rem">
          <!-- Mock landing page preview -->
          <div style="background:linear-gradient(135deg,var(--primary)22,var(--accent)11);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px">
            <div style="background:var(--primary);padding:16px 20px;color:#fff;text-align:center">
              <div style="font-size:1.1rem;font-weight:700">${p.title}</div>
              <div style="font-size:0.76rem;opacity:0.85;margin-top:4px">📣 ${p.campaign}</div>
            </div>
            <div style="padding:16px 20px">
              <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;text-align:center">กรอกข้อมูลเพื่อรับโปรโมชั่นพิเศษ</div>
              <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
                <input class="input" placeholder="ชื่อ-นามสกุล *" disabled style="opacity:0.6;font-size:0.78rem">
                <input class="input" placeholder="เบอร์โทรศัพท์ *" disabled style="opacity:0.6;font-size:0.78rem">
                <input class="input" placeholder="อีเมล" disabled style="opacity:0.6;font-size:0.78rem">
                <select class="input" disabled style="opacity:0.6;font-size:0.78rem"><option>รุ่นที่สนใจ...</option></select>
              </div>
              <div style="background:var(--primary);color:#fff;padding:10px;border-radius:8px;text-align:center;font-size:0.84rem;font-weight:700">🎯 รับโปรโมชั่นเลย</div>
            </div>
          </div>
          <!-- Stats -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
            <div style="background:var(--surface-2);border-radius:8px;padding:10px">
              <div style="font-size:1rem;font-weight:700;color:var(--primary)">${p.visits.toLocaleString()}</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">Visits</div>
            </div>
            <div style="background:var(--surface-2);border-radius:8px;padding:10px">
              <div style="font-size:1rem;font-weight:700;color:var(--success)">${p.leads}</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">Leads</div>
            </div>
            <div style="background:var(--surface-2);border-radius:8px;padding:10px">
              <div style="font-size:1rem;font-weight:700;color:${convColor}">${p.conv}%</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">Conversion</div>
            </div>
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
            <input id="ep-title" class="input" value="${p.title}"></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">Campaign</label>
            <input id="ep-camp" class="input" value="${p.campaign}"></div>
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
          await createDoc('landing_pages', { title, campaign:camp, visits:0, leads:0, conv:0, status:'active', created:new Date().toISOString().slice(0,10) })
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
