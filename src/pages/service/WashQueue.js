/**
 * Wash & Detailing Queue — คิวล้างรถ/ดีเทลลิ่ง
 * Route: /service/wash
 */
import { formatCurrency, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addMinutes(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const WASH_SERVICES = {
  basic:   { label: 'ล้างธรรมดา', price: 200, mins: 30, icon: '🚿' },
  premium: { label: 'ล้าง + แว็กซ์', price: 500, mins: 60, icon: '✨' },
  detail:  { label: 'Detailing เต็มระบบ', price: 2500, mins: 240, icon: '💎' },
  coating: { label: 'เคลือบเซรามิก', price: 12000, mins: 480, icon: '🛡' },
  interior:{ label: 'ซักเบาะ/ภายใน', price: 1500, mins: 180, icon: '🪑' },
}

const Q_STATUS = {
  waiting:  { label: 'รอคิว', color: 'secondary', icon: '⏳' },
  washing:  { label: 'กำลังทำ', color: 'warning', icon: '🧽' },
  done:     { label: 'เสร็จแล้ว', color: 'success', icon: '✅' },
  delivered:{ label: 'ส่งมอบแล้ว', color: 'secondary', icon: '🏁' },
}

const DEMO_QUEUE = [
  { id: 'W01', plate: '1กข-1234', model: 'BYD Seal', service: 'premium', status: 'washing', startTime: addMinutes(25), customer: 'สมชาย ใจดี', staff: 'ทีม A', isFree: false },
  { id: 'W02', plate: '2ขค-5678', model: 'BYD Dolphin', service: 'basic', status: 'waiting', startTime: null, customer: 'มาลี สุขใจ', staff: null, isFree: true },
  { id: 'W03', plate: '3คง-9012', model: 'MG ZS EV', service: 'detail', status: 'washing', startTime: addMinutes(120), customer: 'ธนพล เที่ยงตรง', staff: 'ทีม B', isFree: false },
  { id: 'W04', plate: '4งจ-3456', model: 'BYD Atto 3', service: 'basic', status: 'done', startTime: addMinutes(90), customer: 'อรทัย ตั้งใจ', staff: 'ทีม A', isFree: true },
  { id: 'W05', plate: '5จฉ-7890', model: 'BYD Han', service: 'coating', status: 'waiting', startTime: null, customer: 'วิรัช เก่งมาก', staff: null, isFree: false },
]

export default async function WashQueuePage(container) {
  let queue = DEMO_QUEUE.map(q => ({ ...q }))

  function renderPage() {
    const waiting = queue.filter(q => q.status === 'waiting')
    const washing = queue.filter(q => q.status === 'washing')
    const revenue = queue.filter(q => !q.isFree && ['done','delivered'].includes(q.status)).reduce((a, q) => a + WASH_SERVICES[q.service].price, 0)
    const estWait = waiting.reduce((a, q) => a + WASH_SERVICES[q.service].mins, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚿 Wash & Detailing</div>
            <div class="page-subtitle">คิวล้างรถ — ฟรีหลังบริการ / รับรายได้เสริม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-queue-btn">+ เพิ่มคิว</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⏳ รอคิว', waiting.length + ' คัน', waiting.length > 3 ? 'danger' : 'primary')}
          ${kpi('🧽 กำลังทำ', washing.length + ' คัน', 'warning')}
          ${kpi('⏱ รอประมาณ', Math.round(estWait/60*10)/10 + ' ชม.', estWait > 120 ? 'warning' : 'success')}
          ${kpi('💰 รายได้วันนี้', formatCurrency(revenue), 'success')}
        </div>

        <!-- Price board -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">💲 ราคาบริการ</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Object.values(WASH_SERVICES).map(s => `
              <div style="background:var(--surface-2);padding:6px 10px;border-radius:var(--radius-sm);font-size:0.72rem">
                ${s.icon} ${s.label} — <strong>${formatCurrency(s.price)}</strong> <span style="color:var(--text-muted)">(~${s.mins} นาที)</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Queue board -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${['waiting','washing','done'].map(st => {
            const qs = Q_STATUS[st]
            const items = queue.filter(q => q.status === st)
            return `<div>
              <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px;color:var(--${qs.color})">${qs.icon} ${qs.label} (${items.length})</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${items.map(q => {
                  const sv = WASH_SERVICES[q.service]
                  return `<div class="card" style="padding:10px 12px;border-left:3px solid var(--${qs.color})">
                    <div style="font-weight:700;font-size:0.83rem">${q.plate}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${q.model} · ${q.customer}</div>
                    <div style="font-size:0.7rem;margin-top:3px">${sv?.icon} ${sv?.label} ${q.isFree ? '<span class="badge badge-success" style="font-size:0.55rem">ฟรี</span>' : `<strong>${formatCurrency(sv?.price||0)}</strong>`}</div>
                    ${q.staff ? `<div style="font-size:0.65rem;color:var(--text-muted)">👷 ${q.staff}${q.startTime ? ' · เริ่ม ' + timeAgo(q.startTime) : ''}</div>` : ''}
                    <div style="display:flex;gap:4px;margin-top:6px">
                      ${st === 'waiting' ? `<button class="btn btn-xs btn-warning start-btn" data-id="${q.id}" style="flex:1">🧽 เริ่ม</button>` : ''}
                      ${st === 'washing' ? `<button class="btn btn-xs btn-success finish-btn" data-id="${q.id}" style="flex:1">✅ เสร็จ</button>` : ''}
                      ${st === 'done' ? `<button class="btn btn-xs btn-secondary deliver-btn" data-id="${q.id}" style="flex:1">🏁 ส่งมอบ + แจ้งลูกค้า</button>` : ''}
                    </div>
                  </div>`
                }).join('') || '<div style="font-size:0.72rem;color:var(--text-muted);padding:10px;text-align:center">— ว่าง —</div>'}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.start-btn').forEach(b => b.addEventListener('click', () => {
      const q = queue.find(x => x.id === b.dataset.id)
      if (q) { q.status = 'washing'; q.startTime = new Date().toISOString(); q.staff = 'ทีม ' + (Math.random() > 0.5 ? 'A' : 'B'); renderPage() }
    }))
    container.querySelectorAll('.finish-btn').forEach(b => b.addEventListener('click', () => {
      const q = queue.find(x => x.id === b.dataset.id); if (q) { q.status = 'done'; showToast('✅ ' + q.plate + ' เสร็จแล้ว', 'success'); renderPage() }
    }))
    container.querySelectorAll('.deliver-btn').forEach(b => b.addEventListener('click', () => {
      const q = queue.find(x => x.id === b.dataset.id)
      if (q) { q.status = 'delivered'; showToast('📱 แจ้งลูกค้า ' + q.customer + ' มารับรถแล้ว', 'success'); renderPage() }
    }))
    document.getElementById('add-queue-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่มคิวล้างรถ',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ทะเบียน *</label><input class="input" id="wq-plate" placeholder="1กข-1234"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="wq-model"></div>
          <div class="input-group"><label class="input-label">ชื่อลูกค้า</label><input class="input" id="wq-customer"></div>
          <div class="input-group"><label class="input-label">บริการ</label>
            <select class="input" id="wq-service">${Object.entries(WASH_SERVICES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label} — ${formatCurrency(v.price)}</option>`).join('')}</select>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer">
            <input type="checkbox" id="wq-free" style="accent-color:var(--primary)"> ฟรี (ลูกค้าหลังบริการซ่อม)
          </label>
        </div>`,
        onConfirm() {
          const plate = document.getElementById('wq-plate')?.value?.trim()
          if (!plate) { showToast('❗ กรุณากรอกทะเบียน', 'error'); return }
          queue.push({ id:`W${String(queue.length+1).padStart(2,'0')}`, plate, model:document.getElementById('wq-model')?.value||'—', service:document.getElementById('wq-service')?.value||'basic', status:'waiting', startTime:null, customer:document.getElementById('wq-customer')?.value||'—', staff:null, isFree:document.getElementById('wq-free')?.checked||false })
          showToast('✅ เพิ่มคิวแล้ว', 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
