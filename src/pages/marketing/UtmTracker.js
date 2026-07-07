/**
 * UTM Tracker — วัดที่มา Lead แม่นยำ ด้วย UTM Parameters
 * Route: /marketing/utm-tracker
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

export default async function UtmTrackerPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let UTM_LINKS = []
  let filterSrc = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { UTM_LINKS = await listDocs('utm_links', [], 'created', 'desc', 500) } catch (e) { UTM_LINKS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function linkRow(u) {
    const convColor = u.conv >= 7 ? 'var(--success)' : u.conv >= 4 ? 'var(--warning)' : 'var(--danger)'
    const utmUrl = u.url + '?utm_source=' + u.source + '&utm_medium=' + u.medium + '&utm_campaign=' + u.campaign
    return `<div class="card" style="padding:14px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:1.5rem">🔗</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.88rem">${u.name}</span>
            <span style="font-size:0.62rem;background:var(--surface-2);padding:1px 8px;border-radius:8px">${u.source}</span>
            <span style="font-size:0.62rem;background:var(--surface-2);padding:1px 8px;border-radius:8px">${u.medium}</span>
          </div>
          <div style="font-size:0.64rem;color:var(--text-muted);margin-bottom:8px;word-break:break-all">${utmUrl}</div>
          <div style="display:flex;gap:14px;font-size:0.74rem">
            <span>👆 ${u.clicks.toLocaleString()} clicks</span>
            <span>🎯 ${u.leads} leads</span>
            <span style="color:${convColor};font-weight:700">🔄 ${u.conv}%</span>
          </div>
        </div>
        <button class="btn btn-xs btn-secondary copy-btn" data-id="${u.id}" style="font-size:0.68rem;flex-shrink:0">📋 Copy</button>
      </div>
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const sources = [...new Set(UTM_LINKS.map(u=>u.source))]
    let rows = filterSrc === 'all' ? UTM_LINKS : UTM_LINKS.filter(u=>u.source===filterSrc)

    const totClicks = UTM_LINKS.reduce((s,u)=>s+u.clicks,0)
    const totLeads  = UTM_LINKS.reduce((s,u)=>s+u.leads,0)
    const avgConv   = (totLeads/totClicks*100).toFixed(1)
    const bestSrc   = [...UTM_LINKS].sort((a,b)=>b.conv-a.conv)[0]

    const srcBtns = ['all',...sources].map(s=>{
      const label = s==='all' ? 'ทั้งหมด' : s
      return '<button class="btn btn-xs ' + (filterSrc===s?'btn-primary':'btn-secondary') + ' src-btn" data-s="' + s + '">' + label + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔗 UTM Tracker</div>
            <div class="page-subtitle">วัดที่มา Lead แม่นยำ · ${UTM_LINKS.length} Campaign Links</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-utm-btn">+ สร้าง UTM Link</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('👆 รวม Clicks', totClicks.toLocaleString(), 'var(--primary)')}
          ${sc('🎯 รวม Leads', totLeads+' ราย', 'var(--success)')}
          ${sc('🔄 Avg Conv.', avgConv+'%', 'var(--warning)')}
          ${sc('🏆 Best Source', bestSrc.source+' ('+bestSrc.conv+'%)', 'var(--success)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${srcBtns}</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(u=>linkRow(u)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบลิงก์</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.src-btn').forEach(b=>b.addEventListener('click',()=>{filterSrc=b.dataset.s;render()}))
    container.querySelectorAll('.copy-btn').forEach(b=>b.addEventListener('click',()=>{
      const u=UTM_LINKS.find(x=>x.id===b.dataset.id)
      if(u){
        const url=u.url+'?utm_source='+u.source+'&utm_medium='+u.medium+'&utm_campaign='+u.campaign
        navigator.clipboard?.writeText(url).catch(()=>{})
        showToast('📋 Copy URL: '+u.name,'success')
      }
    }))
    document.getElementById('new-utm-btn')?.addEventListener('click',()=>openNewModal())
  }

  function openNewModal() {
    openModal({
      title:'🔗 สร้าง UTM Link', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อ Campaign</label><input class="input" id="utm-name" style="width:100%;margin-top:3px" placeholder="Facebook June Promo..."></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">Landing Page URL</label><input class="input" id="utm-url" style="width:100%;margin-top:3px" placeholder="https://..."></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">utm_source</label>
            <select class="input" id="utm-src" style="width:100%;margin-top:3px">
              <option>facebook</option><option>google</option><option>line</option><option>tiktok</option><option>email</option><option>organic</option>
            </select></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">utm_medium</label>
            <select class="input" id="utm-med" style="width:100%;margin-top:3px">
              <option>paid</option><option>cpc</option><option>social</option><option>video</option><option>email</option><option>organic</option>
            </select></div>
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">utm_campaign</label><input class="input" id="utm-camp" style="width:100%;margin-top:3px" placeholder="june_promo_2026..."></div>
      </div>`,
      confirmText:'🔗 สร้าง Link',
      async onConfirm() {
        const name=document.getElementById('utm-name')?.value?.trim()
        const url=document.getElementById('utm-url')?.value?.trim()
        const camp=document.getElementById('utm-camp')?.value?.trim()
        if(!name||!url||!camp){showToast('กรอกข้อมูลให้ครบ','warning');return false}
        const src=document.getElementById('utm-src')?.value||'facebook'
        const med=document.getElementById('utm-med')?.value||'paid'
        try {
          await createDoc('utm_links', { name, url, source:src, medium:med, campaign:camp, clicks:0, leads:0, conv:0, created:new Date().toISOString().slice(0,10) })
          showToast('🔗 สร้าง UTM Link: '+name,'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
