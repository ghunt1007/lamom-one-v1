/**
 * Upsell / Cross-sell AI Advisor — แนะนำ Upsell สินค้าและบริการต่อลูกค้า
 * Route: /ai/upsell
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const CUSTOMERS = [
  { id:'C001', name:'นภา มีสุข', model:'BYD Atto 3', buyDate:'2025-01-15', mileage:18500, lastService:'2026-01-10', insurance:false, charger:false, score:92,
    upsells:[
      { id:'u1', type:'insurance', icon:'🛡', title:'ต่อประกันภัยชั้น 1', price:28000, reason:'ประกันหมดแล้ว 5 เดือน · ลูกค้ายังไม่ต่อ', priority:'high', prob:88 },
      { id:'u2', type:'accessory', icon:'🔌', title:'Wall Charger บ้าน 11kW', price:25000, reason:'ยังใช้ชาร์จจาก socket ธรรมดา ชาร์จช้ากว่า 4x', priority:'high', prob:72 },
      { id:'u3', type:'service', icon:'🔧', title:'Service Package 3 ปี', price:12000, reason:'ไม่มีแพ็กเกจ · เช็คระยะล่าสุด 3 เดือนที่แล้ว', priority:'med', prob:58 },
    ]
  },
  { id:'C002', name:'สมชาย วิเศษ', model:'BYD Seal AWD', buyDate:'2024-09-01', mileage:32000, lastService:'2026-05-20', insurance:true, charger:true, score:78,
    upsells:[
      { id:'u4', type:'upgrade', icon:'🚗', title:'Upgrade → BYD Han (Trade-in)', price:500000, reason:'ใช้รถมา 20 เดือน · ไมล์สูง · Han ใหม่ราคาดี', priority:'med', prob:45 },
      { id:'u5', type:'accessory', icon:'🎨', title:'PPF ฟิล์มกันรอย', price:35000, reason:'รถยังไม่ได้ติด PPF · ซื้อรถมา 20 เดือน', priority:'med', prob:52 },
      { id:'u6', type:'service', icon:'🔋', title:'Battery Health Check', price:1500, reason:'ไมล์สูง 32,000 · ควรเช็คสุขภาพแบตฯ รายงาน SOH', priority:'low', prob:80 },
    ]
  },
  { id:'C003', name:'มาลี จันทร์ดี', model:'MG ZS EV', buyDate:'2025-06-01', mileage:5200, lastService:'2026-06-01', insurance:true, charger:false, score:61,
    upsells:[
      { id:'u7', type:'accessory', icon:'🔌', title:'Wall Charger บ้าน 7.4kW', price:18000, reason:'ยังชาร์จจาก socket ปกติ · ชาร์จช้า 3x', priority:'high', prob:75 },
      { id:'u8', type:'service', icon:'✨', title:'เคลือบแก้ว Ceramic Coat', price:15000, reason:'รถใหม่ 1 ปี เหมาะเคลือบก่อนฝนมา', priority:'med', prob:60 },
    ]
  },
]

const PRIORITY = { high:{ label:'สูง', color:'var(--danger)' }, med:{ label:'กลาง', color:'var(--warning)' }, low:{ label:'ต่ำ', color:'var(--text-muted)' } }

export default async function UpsellAdvisorPage(container) {
  let selected = null
  let filterType = 'all'

  function render() {
    const totalOpportunity = CUSTOMERS.reduce((s,c) => s + c.upsells.reduce((ss,u) => ss+u.price,0), 0)
    const highCount = CUSTOMERS.reduce((s,c) => s + c.upsells.filter(u=>u.priority==='high').length, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 Upsell / Cross-sell AI</div>
            <div class="page-subtitle">AI วิเคราะห์โอกาสขายเพิ่มต่อลูกค้า · ${CUSTOMERS.length} คน · ${CUSTOMERS.reduce((s,c)=>s+c.upsells.length,0)} โอกาส</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="campaign-btn">📢 สร้าง Campaign</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('💰 มูลค่ารวม', formatCurrency(totalOpportunity), 'var(--success)')}
          ${sc('🔴 Priority สูง', highCount+' รายการ', 'var(--danger)')}
          ${sc('👥 ลูกค้า', CUSTOMERS.length+' คน', 'var(--primary)')}
          ${sc('📊 AI Score เฉลี่ย', Math.round(CUSTOMERS.reduce((s,c)=>s+c.score,0)/CUSTOMERS.length)+'%', 'var(--text)')}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${['all','insurance','accessory','service','upgrade'].map(t=>`
            <button class="btn btn-xs ${filterType===t?'btn-primary':'btn-secondary'} type-btn" data-t="${t}">
              ${t==='all'?'ทุกประเภท':t==='insurance'?'🛡 ประกัน':t==='accessory'?'🔌 อุปกรณ์':t==='service'?'🔧 บริการ':'🚗 Upgrade'}
            </button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          ${CUSTOMERS.map(c => customerBlock(c)).join('')}
        </div>
      </div>`

    container.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { filterType = b.dataset.t; render() }))
    container.querySelectorAll('.offer-btn').forEach(b => b.addEventListener('click', () => {
      const c = CUSTOMERS.find(x => x.id === b.dataset.cid)
      const u = c?.upsells.find(x => x.id === b.dataset.uid)
      if (c && u) openOfferModal(c, u)
    }))
    document.getElementById('campaign-btn')?.addEventListener('click', () => {
      openModal({
        title:'📢 สร้าง Campaign Upsell', size:'sm',
        body:`<div style="font-size:0.8rem">
          <p style="color:var(--text-muted);margin-bottom:10px">AI เลือก Priority High ทั้งหมด ${highCount} รายการ ส่ง LINE แจ้งลูกค้าอัตโนมัติ</p>
          ${CUSTOMERS.map(c=>c.upsells.filter(u=>u.priority==='high').map(u=>`
            <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
              <b>${c.name}</b> — ${u.title} (${formatCurrency(u.price)}) <span style="color:var(--success)">Prob ${u.prob}%</span>
            </div>`).join('')).join('')}`,
        confirmText:'📢 ส่ง LINE ทุกราย',
        onConfirm() {
          CUSTOMERS.forEach(c => c.upsells.filter(u => u.priority === 'high').forEach(u => { u.sent = true; u.sentAt = new Date().toISOString() }))
          render()
          showToast(`📢 ส่ง LINE ${highCount} ราย ให้ทีมขายติดตาม High Priority Upsell แล้ว`, 'success')
        }
      })
    })
  }

  function customerBlock(c) {
    const upsells = filterType === 'all' ? c.upsells : c.upsells.filter(u => u.type === filterType)
    if (!upsells.length) return ''
    const scoreColor = c.score >= 80 ? 'var(--success)' : c.score >= 60 ? 'var(--warning)' : 'var(--danger)'
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${c.name}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${c.model} · ไมล์ ${c.mileage.toLocaleString()} km · ซื้อ ${c.buyDate}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.2rem;font-weight:900;color:${scoreColor}">${c.score}%</div>
            <div style="font-size:0.64rem;color:var(--text-muted)">Upsell Score</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${upsells.map(u => upsellRow(c, u)).join('')}
        </div>
      </div>`
  }

  function upsellRow(c, u) {
    const p = PRIORITY[u.priority]
    return `
      <div style="display:flex;align-items:center;gap:10px;background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);border-left:3px solid ${p.color}">
        <span style="font-size:1.3rem">${u.icon}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:0.82rem">${u.title}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${u.reason}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:700;color:var(--primary);font-size:0.82rem">${formatCurrency(u.price)}</div>
          <div style="font-size:0.64rem;color:var(--text-muted)">ความน่าจะซื้อ ${u.prob}%</div>
          <span style="font-size:0.62rem;background:${p.color};color:#fff;padding:1px 6px;border-radius:8px">${p.label}</span>
        </div>
        <button class="btn btn-xs btn-primary offer-btn" data-cid="${c.id}" data-uid="${u.id}" style="font-size:0.72rem;flex-shrink:0">📤 เสนอ</button>
      </div>`
  }

  function openOfferModal(c, u) {
    openModal({
      title: `${u.icon} เสนอ ${u.title}`,
      size: 'sm',
      body: `
        <div style="font-size:0.78rem">
          <div style="background:var(--primary)11;padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:12px">
            <div style="font-weight:700;margin-bottom:4px">ลูกค้า: ${c.name}</div>
            <div style="color:var(--text-muted)">${c.model} · สั่ง AI โน้มน้าว · Prob. ${u.prob}%</div>
          </div>
          <div style="margin-bottom:8px"><b>ราคา:</b> ${formatCurrency(u.price)}</div>
          <div style="margin-bottom:8px"><b>เหตุผลที่ AI แนะนำ:</b><br>${u.reason}</div>
          <div style="margin-bottom:8px"><b>ช่องทางเสนอขาย:</b></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:4px;font-size:0.76rem"><input type="radio" name="ch" value="line" checked> LINE</label>
            <label style="display:flex;align-items:center;gap:4px;font-size:0.76rem"><input type="radio" name="ch" value="call"> โทรศัพท์</label>
            <label style="display:flex;align-items:center;gap:4px;font-size:0.76rem"><input type="radio" name="ch" value="visit"> Walk-in</label>
          </div>
          <div style="margin-top:10px"><label style="font-size:0.72rem;color:var(--text-muted)">ข้อความ AI แนะนำ</label>
            <textarea class="input" style="width:100%;height:80px;margin-top:4px;font-size:0.76rem">สวัสดีคุณ${c.name} ทีม LAMOM อยากแจ้งว่า ${u.title} (${formatCurrency(u.price)}) เหมาะมากสำหรับ${c.model} ของคุณ เพราะ ${u.reason.split('·')[0]} สนใจให้เจ้าหน้าที่ติดต่อกลับไหมครับ?</textarea>
          </div>
        </div>`,
      confirmText: '📤 ส่ง Offer',
      onConfirm() {
        const ch = document.querySelector('input[name="ch"]:checked')?.value || 'line'
        u.sent = true; u.sentAt = new Date().toISOString(); u.channel = ch
        render()
        showToast(`📤 ส่ง Offer "${u.title}" ให้คุณ${c.name} ทาง ${ch.toUpperCase()} แล้ว · ทีมขายรับเรื่อง`, 'success')
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
