/**
 * Bank Finance Partners — รายชื่อธนาคาร / โปรสินเชื่อ / Approval Rate
 * Route: /finance/bank-partners
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const BANKS = [
  { id:'SCB',  name:'SCB',            fullName:'ธนาคารไทยพาณิชย์',     logo:'🟣', rate:2.49, maxYr:7, minDown:10, approval:82, avgDays:2.1, quota:80,  used:61, contact:'คุณสมศักดิ์ 081-111-0001' },
  { id:'KBANK',name:'KBANK',          fullName:'ธนาคารกสิกรไทย',       logo:'🟢', rate:2.39, maxYr:7, minDown:10, approval:79, avgDays:2.5, quota:70,  used:48, contact:'คุณวิภา 082-222-0002' },
  { id:'KTB',  name:'KTB',           fullName:'ธนาคารกรุงไทย',         logo:'🔵', rate:2.59, maxYr:7, minDown:15, approval:76, avgDays:3.0, quota:60,  used:39, contact:'คุณประยุทธ 083-333-0003' },
  { id:'BAY',  name:'BAY',           fullName:'ธนาคารกรุงศรีอยุธยา',   logo:'🟡', rate:2.69, maxYr:6, minDown:15, approval:74, avgDays:3.2, quota:50,  used:28, contact:'คุณสุนิตา 084-444-0004' },
  { id:'TMB',  name:'TTB',           fullName:'ธนาคารทีทีบี',          logo:'🔷', rate:2.79, maxYr:5, minDown:20, approval:71, avgDays:3.5, quota:40,  used:18, contact:'คุณมนัส 085-555-0005' },
  { id:'GE',   name:'GE Capital',    fullName:'GE Capital (Leasing)',  logo:'🔴', rate:3.49, maxYr:5, minDown:0,  approval:88, avgDays:1.5, quota:30,  used:24, contact:'คุณสมหวัง 086-666-0006' },
  { id:'AYUD', name:'Ayudhya Capital',fullName:'อยุธยา แคปปิตอล',     logo:'🟠', rate:3.29, maxYr:6, minDown:5,  approval:85, avgDays:1.8, quota:35,  used:21, contact:'คุณลัดดา 087-777-0007' },
]

const RECENT_APPS = [
  { customer:'สมชาย ใจดี',   model:'BYD Atto 3', amount:990000, bank:'SCB',   status:'approved', date:'2026-06-14' },
  { customer:'นภา สุขใจ',    model:'BYD Seal',   amount:1540000,bank:'KBANK', status:'approved', date:'2026-06-13' },
  { customer:'วิชัย ดีมาก',  model:'BYD Han',    amount:1900000,bank:'KTB',   status:'pending',  date:'2026-06-13' },
  { customer:'มาลี รุ่งเรือง',model:'MG ZS EV',  amount:720000, bank:'GE',    status:'approved', date:'2026-06-12' },
  { customer:'อรุณ วิชิต',   model:'BYD Dolphin',amount:800000, bank:'BAY',   status:'rejected', date:'2026-06-11' },
]

export default async function BankPartnersPage(container) {
  let selBank = null

  function render() {
    const sel = selBank ? BANKS.find(b=>b.id===selBank) : null
    const totalQuota = BANKS.reduce((s,b)=>s+b.quota,0)
    const totalUsed  = BANKS.reduce((s,b)=>s+b.used,0)
    const avgApproval= Math.round(BANKS.reduce((s,b)=>s+b.approval,0)/BANKS.length)
    const bestRate   = BANKS.reduce((a,b)=>a.rate<b.rate?a:b)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Bank Finance Partners</div>
            <div class="page-subtitle">พันธมิตรธนาคาร ${BANKS.length} แห่ง · โปรสินเชื่อ · วงเงินรวม ${totalQuota} ล้าน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="compare-btn">⚖️ เปรียบเทียบดอกเบี้ย</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🏦 ธนาคาร', BANKS.length+' แห่ง', 'var(--primary)')}
          ${sc('✅ Approval avg.', avgApproval+'%', 'var(--success)')}
          ${sc('💳 วงเงินใช้ไป', totalUsed+'/'+totalQuota+' M', 'var(--warning)')}
          ${sc('💸 Rate ต่ำสุด', bestRate.rate+'%', 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:${sel?'1fr 300px':'1fr'};gap:16px">
          <!-- Bank cards -->
          <div style="display:flex;flex-direction:column;gap:8px">
            ${BANKS.map(b => {
              const quotaPct = Math.round(b.used/b.quota*100)
              return `
              <div class="card bank-card" data-id="${b.id}" style="padding:14px;cursor:pointer;border:2px solid ${selBank===b.id?'var(--primary)':'transparent'};transition:border .2s">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="font-size:1.8rem;width:40px;text-align:center">${b.logo}</div>
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span style="font-weight:700;font-size:0.9rem">${b.name}</span>
                      <span style="font-size:0.68rem;color:var(--text-muted)">${b.fullName}</span>
                    </div>
                    <div style="display:flex;gap:14px;font-size:0.72rem;color:var(--text-muted);margin-bottom:5px">
                      <span>📊 ${b.rate}%/ปี</span>
                      <span>📅 สูงสุด ${b.maxYr} ปี</span>
                      <span>💵 Down ${b.minDown}%</span>
                      <span>✅ Approval ${b.approval}%</span>
                      <span>⏱ ${b.avgDays} วัน</span>
                    </div>
                    <!-- Quota bar -->
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="flex:1;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${quotaPct}%;background:${quotaPct>=90?'var(--danger)':quotaPct>=70?'var(--warning)':'var(--success)'};border-radius:3px"></div>
                      </div>
                      <span style="font-size:0.64rem;color:var(--text-muted)">${b.used}/${b.quota}M (${quotaPct}%)</span>
                    </div>
                  </div>
                  <button class="btn btn-xs btn-primary submit-btn" data-id="${b.id}" style="font-size:0.7rem;flex-shrink:0">📤 ยื่น</button>
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- Detail panel / Recent apps -->
          <div style="display:flex;flex-direction:column;gap:10px">
            ${sel ? `
            <div class="card" style="padding:14px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <div style="font-size:1.5rem">${sel.logo}</div>
                <div><div style="font-weight:700">${sel.name}</div><div style="font-size:0.7rem;color:var(--text-muted)">${sel.fullName}</div></div>
              </div>
              ${[
                ['📊 อัตราดอกเบี้ย',sel.rate+'%/ปี'],
                ['📅 ระยะเวลาสูงสุด',sel.maxYr+' ปี'],
                ['💵 เงินดาวน์ต่ำสุด',sel.minDown+'%'],
                ['✅ Approval Rate',sel.approval+'%'],
                ['⏱ เฉลี่ยวันอนุมัติ',sel.avgDays+' วัน'],
                ['💳 วงเงินใช้ไป',sel.used+'/'+sel.quota+' ล้าน'],
                ['📞 ติดต่อ',sel.contact],
              ].map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.76rem"><span style="color:var(--text-muted)">${k}</span><b>${v}</b></div>`).join('')}
            </div>` : ''}

            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 ใบสมัครล่าสุด</div>
              ${RECENT_APPS.map(a=>`
                <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.74rem">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-weight:600">${a.customer} · ${a.model}</div>
                      <div style="font-size:0.66rem;color:var(--text-muted)">${a.bank} · ${formatCurrency(a.amount)}</div>
                    </div>
                    <span style="font-size:0.6rem;background:${a.status==='approved'?'var(--success)':a.status==='pending'?'var(--warning)':'var(--danger)'};color:#fff;padding:1px 8px;border-radius:8px">
                      ${a.status==='approved'?'✅ อนุมัติ':a.status==='pending'?'⏳ รอ':'❌ ปฏิเสธ'}
                    </span>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.bank-card').forEach(el=>el.addEventListener('click',()=>{selBank=selBank===el.dataset.id?null:el.dataset.id;render()}))
    container.querySelectorAll('.submit-btn').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation()
      const bank=BANKS.find(x=>x.id===b.dataset.id)
      if(bank) showToast(`📤 เปิดฟอร์มยื่นสินเชื่อ ${bank.name} แล้ว`,'success')
    }))
    document.getElementById('compare-btn')?.addEventListener('click',()=>{
      openModal({ title:'⚖️ เปรียบเทียบดอกเบี้ย', size:'sm',
        body:`<div style="font-size:0.8rem">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="color:var(--text-muted);font-size:0.7rem;border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:6px">ธนาคาร</th><th style="text-align:right">Rate</th><th style="text-align:right">ปี</th><th style="text-align:right">Approval</th>
            </tr></thead>
            <tbody>${BANKS.sort((a,b)=>a.rate-b.rate).map(b=>`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px">${b.logo} ${b.name}</td><td style="text-align:right;font-weight:700;color:var(--success)">${b.rate}%</td><td style="text-align:right">${b.maxYr}</td><td style="text-align:right">${b.approval}%</td></tr>`).join('')}</tbody>
          </table>
        </div>`,
        confirmText:'ปิด',
        onConfirm(){}
      })
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
