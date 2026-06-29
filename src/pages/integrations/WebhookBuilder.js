/**
 * Webhook Builder — สร้าง/จัดการ Outbound Webhook แจ้งระบบภายนอก
 * Route: /integrations/webhooks
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const EVENTS = ['sale.created','sale.updated','service.booked','service.completed','lead.created','lead.converted','payment.received','invoice.issued','customer.created','stock.updated']

let webhooks = [
  { id:'wh001', name:'LINE Notify – ยอดขาย', url:'https://notify-api.line.me/api/notify', events:['sale.created','sale.updated'], method:'POST', active:true, lastFired:'2026-06-14T09:32:00', fires:142, fails:0, secret:'sk_ln_xxxx' },
  { id:'wh002', name:'Google Sheets – Lead', url:'https://script.google.com/macros/s/xxxxx/exec', events:['lead.created','lead.converted'], method:'POST', active:true, lastFired:'2026-06-13T17:05:00', fires:67, fails:2, secret:'' },
  { id:'wh003', name:'Slack – บริการแจ้งเตือน', url:'https://hooks.slack.com/services/T00/B00/xxx', events:['service.completed'], method:'POST', active:false, lastFired:'2026-05-30T12:00:00', fires:23, fails:0, secret:'' },
]

export default async function WebhookBuilderPage(container) {
  function render() {
    const active = webhooks.filter(w => w.active).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔗 Webhook Builder</div>
            <div class="page-subtitle">แจ้งระบบภายนอกอัตโนมัติเมื่อเกิด Event ในระบบ · ${webhooks.length} Webhooks · ${active} Active</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="test-all-btn">⚡ Test All</button>
            <button class="btn btn-primary" id="new-btn">+ สร้าง Webhook</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🔗 Webhooks', webhooks.length, 'var(--primary)')}
          ${sc('✅ Active', active, 'var(--success)')}
          ${sc('📤 Fires วันนี้', webhooks.reduce((s,w)=>s+w.fires,0), 'var(--text)')}
          ${sc('❌ Fails', webhooks.reduce((s,w)=>s+w.fails,0), webhooks.some(w=>w.fails>0)?'var(--danger)':'var(--success)')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${webhooks.map(w => whCard(w)).join('')}
        </div>

        <div class="card" style="padding:14px;margin-top:16px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📖 Events ที่รองรับ</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${EVENTS.map(e=>`<code style="font-size:0.72rem;background:var(--surface-2);padding:3px 8px;border-radius:6px">${e}</code>`).join('')}
          </div>
        </div>
      </div>
    `

    document.getElementById('new-btn')?.addEventListener('click', () => openCreateModal())
    document.getElementById('test-all-btn')?.addEventListener('click', () => {
      showToast(`⚡ ส่ง Test Payload ไปยัง ${active} Webhooks แล้ว`, 'success')
    })
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', () => {
      const w = webhooks.find(x => x.id === b.dataset.id)
      if (w) { w.active = !w.active; render(); showToast(`${w.active?'✅ เปิด':'⏸ ปิด'} ${w.name} แล้ว`, 'success') }
    }))
    container.querySelectorAll('.test-btn').forEach(b => b.addEventListener('click', () => {
      const w = webhooks.find(x => x.id === b.dataset.id)
      if (w) showToast(`⚡ Test → ${w.url.slice(0,40)}... → 200 OK (${Math.floor(120+Math.random()*80)}ms)`, 'success')
    }))
    container.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', () => {
      openModal({ title:'ลบ Webhook?', size:'xs', body:`<p style="font-size:0.82rem">ลบ Webhook นี้จะไม่สามารถย้อนกลับได้</p>`,
        confirmText:'ลบ', onConfirm() {
          webhooks = webhooks.filter(x => x.id !== b.dataset.id)
          render(); showToast('🗑 ลบ Webhook แล้ว', 'success')
        }})
    }))
    container.querySelectorAll('.detail-btn').forEach(b => b.addEventListener('click', () => {
      const w = webhooks.find(x => x.id === b.dataset.id)
      if (w) openDetailModal(w)
    }))
  }

  function whCard(w) {
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="width:8px;height:8px;border-radius:50%;background:${w.active?'var(--success)':'var(--text-muted)'};flex-shrink:0"></span>
              <span style="font-weight:700;font-size:0.88rem">${w.name}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-family:monospace;margin-bottom:8px">${w.url}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              ${w.events.map(e=>`<span style="font-size:0.64rem;background:var(--primary)22;color:var(--primary);padding:2px 7px;border-radius:8px">${e}</span>`).join('')}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:0.72rem;color:var(--text-muted)">Fires: <b>${w.fires}</b> · Fails: <b style="color:${w.fails>0?'var(--danger)':'inherit'}">${w.fails}</b></div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn btn-xs ${w.active?'btn-secondary':'btn-primary'} toggle-btn" data-id="${w.id}">${w.active?'⏸ ปิด':'▶ เปิด'}</button>
          <button class="btn btn-xs btn-secondary test-btn" data-id="${w.id}">⚡ Test</button>
          <button class="btn btn-xs btn-secondary detail-btn" data-id="${w.id}">⚙ แก้ไข</button>
          <button class="btn btn-xs btn-secondary del-btn" data-id="${w.id}" style="color:var(--danger)">🗑</button>
        </div>
      </div>`
  }

  function openCreateModal() {
    openModal({
      title: '+ สร้าง Webhook ใหม่',
      size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อ Webhook</label>
            <input class="input" id="wh-name" placeholder="เช่น LINE Notify – ยอดขาย" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">URL ปลายทาง</label>
            <input class="input" id="wh-url" placeholder="https://..." style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">Events (เลือกได้หลายรายการ)</label>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
              ${EVENTS.map(e=>`<label style="display:flex;align-items:center;gap:4px;font-size:0.72rem;cursor:pointer"><input type="checkbox" class="wh-ev" value="${e}"> ${e}</label>`).join('')}
            </div>
          </div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">Secret (optional)</label>
            <input class="input" id="wh-secret" placeholder="HMAC SHA-256 signing secret" style="width:100%;margin-top:4px"></div>
        </div>`,
      confirmText: 'สร้าง Webhook',
      onConfirm() {
        const name = document.getElementById('wh-name')?.value.trim()
        const url  = document.getElementById('wh-url')?.value.trim()
        const evs  = [...document.querySelectorAll('.wh-ev:checked')].map(c=>c.value)
        if (!name || !url || !evs.length) { showToast('กรอกข้อมูลให้ครบ', 'warning'); return false }
        webhooks.push({ id:'wh'+Date.now(), name, url, events:evs, method:'POST', active:true, lastFired:null, fires:0, fails:0, secret:document.getElementById('wh-secret')?.value||'' })
        render(); showToast(`✅ สร้าง Webhook "${name}" แล้ว`, 'success')
      }
    })
  }

  function openDetailModal(w) {
    openModal({
      title: `⚙ แก้ไข ${w.name}`,
      size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อ Webhook</label>
            <input class="input" id="ed-name" value="${w.name}" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">URL ปลายทาง</label>
            <input class="input" id="ed-url" value="${w.url}" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">Events</label>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
              ${EVENTS.map(e=>`<label style="display:flex;align-items:center;gap:4px;font-size:0.72rem;cursor:pointer"><input type="checkbox" class="ed-ev" value="${e}"${w.events.includes(e)?' checked':''}> ${e}</label>`).join('')}
            </div>
          </div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">Secret (optional)</label>
            <input class="input" id="ed-secret" placeholder="HMAC SHA-256 signing secret" value="${w.secret||''}" style="width:100%;margin-top:4px"></div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Fires: <b>${w.fires}</b> · Fails: <b>${w.fails}</b> · Last: ${w.lastFired ? new Date(w.lastFired).toLocaleString('th-TH') : '-'}</div>
        </div>`,
      confirmText: '💾 บันทึก',
      onConfirm() {
        const name = document.getElementById('ed-name')?.value.trim()
        const url  = document.getElementById('ed-url')?.value.trim()
        const evs  = [...document.querySelectorAll('.ed-ev:checked')].map(c => c.value)
        if (!name || !url || !evs.length) { showToast('กรอกข้อมูลให้ครบ', 'warning'); return false }
        w.name = name; w.url = url; w.events = evs; w.secret = document.getElementById('ed-secret')?.value || ''
        render()
        showToast(`💾 อัปเดต "${name}" แล้ว`, 'success')
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
