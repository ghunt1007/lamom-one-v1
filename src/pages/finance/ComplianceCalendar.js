/**
 * Compliance Calendar — ต่ออายุใบอนุญาต ภาษี กฎหมาย ครบกำหนด
 * Route: /finance/compliance-calendar
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const CATEGORIES = ['ใบอนุญาต','ภาษี','แรงงาน','สัญญา']

export default async function ComplianceCalendarPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  const TODAY = new Date()

  let EVENTS = []
  let filterCat = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { EVENTS = await listDocs('compliance_events', [], 'dueDate', 'asc', 500) } catch (e) { EVENTS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function urgencyColor(dueDate, status) {
    if(status==='done') return 'var(--success)'
    const diff = Math.ceil((new Date(dueDate)-TODAY)/(1000*60*60*24))
    if(diff<0) return 'var(--danger)'
    if(diff<=14) return 'var(--danger)'
    if(diff<=30) return 'var(--warning)'
    return 'var(--text-muted)'
  }

  function daysLabel(dueDate, status) {
    if(status==='done') return 'เสร็จแล้ว'
    const diff = Math.ceil((new Date(dueDate)-TODAY)/(1000*60*60*24))
    if(diff<0) return 'เกินกำหนด '+Math.abs(diff)+' วัน'
    if(diff===0) return 'วันนี้!'
    return 'อีก '+diff+' วัน'
  }

  function eventRow(e) {
    const uc = urgencyColor(e.dueDate, e.status)
    const dl = daysLabel(e.dueDate, e.status)
    const catColors = { 'ใบอนุญาต':'var(--primary)','ภาษี':'var(--danger)','แรงงาน':'var(--warning)','สัญญา':'var(--success)' }
    return '<tr class="event-row" data-id="'+e.id+'" style="border-bottom:1px solid var(--border-subtle);cursor:pointer">' +
      '<td style="padding:9px 10px">' +
        '<div style="font-weight:600;font-size:0.78rem;margin-bottom:2px">'+e.title+'</div>' +
        '<div style="font-size:0.66rem;color:var(--text-muted)">ผู้รับผิดชอบ: '+e.responsible+'</div>' +
      '</td>' +
      '<td style="padding:9px 10px"><span style="font-size:0.62rem;background:'+(catColors[e.category]||'var(--surface-2)')+';color:#fff;padding:2px 8px;border-radius:8px">'+e.category+'</span></td>' +
      '<td style="padding:9px 10px;font-size:0.74rem">'+e.dueDate+'</td>' +
      '<td style="padding:9px 10px;font-size:0.74rem;font-weight:700;color:'+uc+'">'+dl+'</td>' +
      '<td style="padding:9px 10px">' +
        (e.status==='done'
          ? '<span style="font-size:0.62rem;color:var(--success)">✅ เสร็จแล้ว</span>'
          : '<button class="btn btn-sm btn-primary done-btn" data-id="'+e.id+'">ทำเสร็จ</button>') +
      '</td>' +
    '</tr>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let list = filterCat==='all' ? EVENTS : EVENTS.filter(e=>e.category===filterCat)
    list = [...list].sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))

    const overdue = EVENTS.filter(e=>e.status!=='done' && new Date(e.dueDate)<TODAY).length
    const soon = EVENTS.filter(e=>{
      if(e.status==='done') return false
      const d = Math.ceil((new Date(e.dueDate)-TODAY)/(1000*60*60*24))
      return d>=0 && d<=30
    }).length
    const done = EVENTS.filter(e=>e.status==='done').length
    const catBtns = ['all',...CATEGORIES].map(c=>'<button class="btn btn-sm '+(filterCat===c?'btn-primary':'btn-secondary')+' cat-btn" data-c="'+c+'">'+( c==='all'?'ทั้งหมด':c)+'</button>').join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 Compliance Calendar</div>
            <div class="page-subtitle">ใบอนุญาต · ภาษี · กฎหมาย · สัญญา — ครบกำหนด</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-event-btn">+ เพิ่มรายการ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('⚠️ เกินกำหนด', overdue+' รายการ', 'var(--danger)')}
          ${sc('🔔 ครบกำหนดใน 30 วัน', soon+' รายการ', 'var(--warning)')}
          ${sc('✅ เสร็จแล้ว', done+' รายการ', 'var(--success)')}
          ${sc('📋 ทั้งหมด', EVENTS.length+' รายการ', 'var(--primary)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${catBtns}</div>

        <div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead>
              <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">รายการ</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">ประเภท</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">กำหนดวัน</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">เหลือเวลา</th>
                <th style="padding:10px 10px"></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(e=>eventRow(e)).join('')}
            </tbody>
          </table>
        </div>
      </div>`

    container.querySelectorAll('.cat-btn').forEach(b=>b.addEventListener('click',()=>{filterCat=b.dataset.c;render()}))
    container.querySelectorAll('.done-btn').forEach(b=>b.addEventListener('click', async ()=>{
      const e = EVENTS.find(x=>x.id===b.dataset.id)
      if(!e) return
      try {
        await updateDocData('compliance_events', e.id, { status: 'done' })
        showToast('✅ บันทึกเสร็จสิ้น: '+e.title,'success')
        await loadData()
      } catch (err) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.event-row').forEach(r=>r.addEventListener('click',(ev)=>{
      if(ev.target.tagName==='BUTTON') return
      const e = EVENTS.find(x=>x.id===r.dataset.id)
      if(!e) return
      openModal({ title:'📅 '+e.title, size:'sm',
        body:'<div style="font-size:0.84rem;line-height:2"><div><b>ประเภท:</b> '+e.category+'</div><div><b>กำหนด:</b> '+e.dueDate+'</div><div><b>ผู้รับผิดชอบ:</b> '+e.responsible+'</div><div><b>รายละเอียด:</b> '+e.desc+'</div></div>',
        confirmText:'รับทราบ', onConfirm:()=>true })
    }))
    document.getElementById('add-event-btn')?.addEventListener('click', openAddEventModal)
  }

  function openAddEventModal() {
    const todayStr = new Date().toISOString().slice(0, 10)
    openModal({
      title: '📅 เพิ่มรายการ Compliance ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อรายการ *</label>
            <input id="cc-title" class="input" placeholder="เช่น ต่อใบอนุญาต / ยื่นภาษี..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภท</label>
              <select id="cc-cat" class="input">
                ${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">กำหนดวันครบ</label>
              <input id="cc-due" type="date" class="input" value="${todayStr}"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ผู้รับผิดชอบ</label>
            <input id="cc-resp" class="input" placeholder="ฝ่ายบัญชี / HR / ผู้จัดการ..."></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">รายละเอียด</label>
            <textarea id="cc-desc" class="input" rows="2" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="cc-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('cc-save')?.addEventListener('click', async () => {
      const title = document.getElementById('cc-title')?.value.trim()
      if (!title) { showToast('⚠️ กรุณากรอกชื่อรายการ', 'warning'); return }
      try {
        await createDoc('compliance_events', {
          title,
          category: document.getElementById('cc-cat')?.value || 'ใบอนุญาต',
          dueDate: document.getElementById('cc-due')?.value || todayStr,
          responsible: document.getElementById('cc-resp')?.value.trim() || '-',
          status: 'pending',
          desc: document.getElementById('cc-desc')?.value.trim() || '',
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ เพิ่มรายการแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
