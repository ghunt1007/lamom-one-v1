/**
 * AI Deal Coach — แนะนำ Sales Real-time per deal
 * Route: /crm/deal-coach
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEMO_DEALS = [
  { id:'DC001', customer:'คุณวรพจน์ แก้วมณี', model:'BYD Atto 3 Extended', price:1199900, stage:'ไฟแนนซ์', winPct:78, salesperson:'กิตติ', days:12,
    advice:['ลูกค้าสนใจแต่ยังลังเล เรื่องค่างวด — เสนอดาวน์เพิ่มขึ้นเพื่อลดงวด','ส่ง LINE video รีวิวจากลูกค้าจริงที่ใช้รุ่นนี้อยู่','นัดทดลองขับอีกครั้ง เน้นโหมด EV เปรียบกับรถเก่า'],
    objections:['ค่างวดสูงไป','กลัวแบตเสื่อม'],
    competitors:['MG ZS EV','Neta V'] },
  { id:'DC002', customer:'บริษัท ทรัพย์สมบูรณ์ จก.', model:'BYD Seal AWD x3', price:5399700, stage:'เจรจา', winPct:55, salesperson:'ปิยะ', days:8,
    advice:['ดีลฝูงรถ — ขอนัดประชุม MD ให้ได้ภายในสัปดาห์นี้','เสนอแพ็กเกจ service ฟรี 3 ปีเป็น sweetener','คำนวณ TCO เทียบรถน้ำมันให้เห็นประหยัดชัดเจน'],
    objections:['ต้องการ 3 สีต่างกัน','งบอนุมัติช้า'],
    competitors:['Tesla Model 3','Volvo EX30'] },
  { id:'DC003', customer:'คุณนภา รุ่งเรือง', model:'BYD Dolphin Boost', price:799900, stage:'จอง', winPct:92, salesperson:'สมพงษ์', days:3,
    advice:['ใกล้ปิดดีลแล้ว — รีบยืนยันวันส่งมอบ','ส่งใบจองให้เซ็น ไม่ให้เปลี่ยนใจ','แนะนำอุปกรณ์เสริมก่อนส่งมอบ'],
    objections:[],
    competitors:[] },
  { id:'DC004', customer:'คุณเกรียงไกร สมศักดิ์', model:'MG ZS EV Luxury Plus', price:999900, stage:'สนใจ', winPct:35, salesperson:'กิตติ', days:21,
    advice:['Win rate ต่ำ — ระบุเหตุผลที่ยังไม่ตัดสินใจ','ลองเสนอ Test Drive ที่บ้านลูกค้า','ตรวจสอบว่าคู่แข่งเสนออะไรอยู่'],
    objections:['ยังเปรียบเทียบอยู่','รอรุ่นใหม่'],
    competitors:['Honda e:N1','BYD Atto 3'] },
  { id:'DC005', customer:'คุณพรทิพย์ วงษ์ทอง', model:'BYD Han EV', price:1899900, stage:'เจรจา', winPct:61, salesperson:'ปิยะ', days:6,
    advice:['ลูกค้า VIP — ให้ผู้จัดการโทรหาโดยตรงสัปดาห์นี้','เสนอ Priority Delivery ก่อนใคร','ให้สิทธิ์ Club Membership พิเศษ'],
    objections:['ราคายังสูง','อยากได้ของแถม'],
    competitors:['BMW iX3','Mercedes EQB'] },
]

const TIPS = [
  'ตอบ objection "ราคาสูง" ด้วยการเปรียบ TCO 5 ปี — ลูกค้ามักประหลาดใจ',
  'ถามคำถามปลายเปิด: "หากทุกอย่างโอเค คุณจะตัดสินใจได้เมื่อไหร่?" — ระบุ timeline',
  'ดีลที่ค้างนาน >14 วัน ควร escalate ให้ผู้จัดการช่วย',
  'ลูกค้า Fleet ต้องการ ROI Report — เตรียมตัวเลขประหยัดน้ำมันเทียบ EV',
  'Follow-up ภายใน 24 ชม. หลัง Test Drive เพิ่ม conversion 40%',
]

export default async function DealCoachPage(container) {
  const myGen = container.__routerGen
  let DEALS = DEMO_DEALS.map(d => ({ ...d, advice: [...d.advice], objections: [...d.objections], competitors: [...d.competitors] }))
  let dataSource = 'demo'
  let filterSales = 'all'
  let selDealId = null

  try {
    const docs = await listDocs('deals', [], 'winPct', 'desc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `DC${i+1}`,
        customer: d.customer || d.customerName || 'ลูกค้า',
        model: d.model || d.vehicleModel || '',
        price: d.price || d.finalPrice || 0,
        stage: d.stage || 'สนใจ',
        winPct: d.winPct || d.probability || 50,
        salesperson: d.salesperson || d.salesName || '',
        days: d.days || 0,
        advice: d.advice || [],
        objections: d.objections || [],
        competitors: d.competitors || [],
      }))
      DEALS = [...mapped, ...DEMO_DEALS]
      dataSource = 'live'
    }
  } catch {}

  function winColor(pct) {
    return pct>=80?'var(--success)':pct>=50?'var(--warning)':'var(--danger)'
  }

  function dealCard(d) {
    const isSel = d.id===selDealId
    const wc = winColor(d.winPct)
    return '<div class="card deal-card" data-id="'+d.id+'" style="padding:14px;cursor:pointer;border:2px solid '+(isSel?'var(--primary)':'transparent')+';margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.84rem">'+escHtml(d.customer)+'</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted)">'+escHtml(d.model)+'</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-size:1rem;font-weight:900;color:'+wc+'">'+d.winPct+'%</div>' +
          '<div style="font-size:0.62rem;color:var(--text-muted)">Win Rate</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:8px">' +
        '<span style="background:var(--surface-2);padding:2px 8px;border-radius:6px">'+escHtml(d.stage)+'</span>' +
        '<span style="color:var(--text-muted)">'+escHtml(d.salesperson)+' · '+d.days+' วัน</span>' +
      '</div>' +
      '<div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">' +
        '<div style="height:100%;width:'+d.winPct+'%;background:'+wc+';border-radius:3px"></div>' +
      '</div>' +
    '</div>'
  }

  function renderDetail(d) {
    const advHtml = d.advice.map((a,i)=>'<div style="display:flex;gap:8px;margin-bottom:8px;font-size:0.76rem">' +
      '<span style="color:var(--primary);font-weight:700;flex-shrink:0">'+(i+1)+'.</span><span>'+escHtml(a)+'</span></div>').join('')
    const objHtml = d.objections.length ? d.objections.map(o=>'<span style="font-size:0.7rem;background:var(--danger);color:#fff;padding:2px 8px;border-radius:8px;margin-right:4px">'+escHtml(o)+'</span>').join('') : '<span style="font-size:0.72rem;color:var(--text-muted)">ไม่มี</span>'
    const compHtml = d.competitors.length ? d.competitors.map(c=>'<span style="font-size:0.7rem;background:var(--surface-2);padding:2px 8px;border-radius:8px;margin-right:4px">'+escHtml(c)+'</span>').join('') : '<span style="font-size:0.72rem;color:var(--text-muted)">ไม่มี</span>'
    return '<div class="card" style="padding:16px">' +
      '<div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">🤖 AI Coaching — '+escHtml(d.customer)+'</div>' +
      '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:14px">฿'+d.price.toLocaleString()+' · Win Rate: <span style="color:'+winColor(d.winPct)+';font-weight:700">'+d.winPct+'%</span></div>' +
      '<div style="font-size:0.76rem;font-weight:700;margin-bottom:8px;color:var(--primary)">💡 แนะนำขั้นตอนต่อไป</div>' +
      advHtml +
      '<div style="font-size:0.76rem;font-weight:700;margin:12px 0 6px;color:var(--danger)">⚠️ Objections</div>' +
      '<div style="margin-bottom:10px">'+objHtml+'</div>' +
      '<div style="font-size:0.76rem;font-weight:700;margin-bottom:6px;color:var(--text-muted)">🏁 คู่แข่ง</div>' +
      '<div style="margin-bottom:14px">'+compHtml+'</div>' +
      '<button class="btn btn-primary btn-sm" id="log-action-btn" style="width:100%">✅ บันทึกการดำเนินการ</button>' +
    '</div>'
  }

  function render() {
    const list = filterSales==='all' ? DEALS : DEALS.filter(d=>d.salesperson===filterSales)
    const avgWin = Math.round(list.reduce((s,d)=>s+d.winPct,0)/Math.max(list.length,1))
    const hot = list.filter(d=>d.winPct>=80).length
    const salespeople = [...new Set(DEALS.map(d=>d.salesperson))]
    const filterBtns = ['all',...salespeople].map(s=>'<button class="btn btn-sm '+(filterSales===s?'btn-primary':'btn-secondary')+' sales-filter" data-s="'+s+'">'+( s==='all'?'ทั้งหมด':escHtml(s))+'</button>').join('')
    const tipOfDay = TIPS[Math.floor(Math.random()*TIPS.length)]
    const detailPanel = selDealId ? renderDetail(DEALS.find(d=>d.id===selDealId)) : '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem">🤖</div><div style="font-size:0.82rem;margin-top:8px">เลือก Deal เพื่อดูคำแนะนำ AI</div></div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 AI Deal Coach</div>
            <div class="page-subtitle">แนะนำ Sales Real-time · ${list.length} ดีลที่กำลังดำเนินการ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="train-btn">🎯 Training Mode</button>
          </div>
        </div>

        <div style="background:var(--surface-2);border:1px solid var(--primary);border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:0.78rem">
          <span style="color:var(--primary);font-weight:700">💡 Tip of the day:</span> ${tipOfDay}
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('🎯 ดีลทั้งหมด', list.length+' ดีล', 'var(--primary)')}
          ${sc('🔥 Win Rate สูง (≥80%)', hot+' ดีล', 'var(--success)')}
          ${sc('📊 Avg Win Rate', avgWin+'%', avgWin>=60?'var(--success)':'var(--warning)')}
          ${sc('⏳ ค้างนานสุด', Math.max(...list.map(d=>d.days))+' วัน', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="display:flex;flex-direction:column">
            ${list.map(d=>dealCard(d)).join('')}
          </div>
          <div>${detailPanel}</div>
        </div>
      </div>`

    container.querySelectorAll('.deal-card').forEach(c=>c.addEventListener('click',()=>{selDealId=c.dataset.id;render()}))
    container.querySelectorAll('.sales-filter').forEach(b=>b.addEventListener('click',()=>{filterSales=b.dataset.s;selDealId=null;render()}))
    document.getElementById('log-action-btn')?.addEventListener('click',()=>openLogActionModal())
    document.getElementById('train-btn')?.addEventListener('click',()=>openTrainingModal())
  }

  function openLogActionModal() {
    const deal = DEALS.find(d => d.id === selDealId)
    if (!deal) { showToast('⚠️ เลือก Deal ก่อน', 'warning'); return }
    openModal({
      title: '✅ บันทึกการดำเนินการ — ' + escHtml(deal.customer),
      size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="background:var(--surface-2);border-radius:8px;padding:8px 12px;font-size:0.76rem">
            <span style="color:var(--text-muted)">รุ่น: </span><span style="font-weight:700">${escHtml(deal.model)}</span>
            &nbsp;·&nbsp;<span style="color:var(--text-muted)">Win Rate: </span><span style="font-weight:700;color:${winColor(deal.winPct)}">${deal.winPct}%</span>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">สิ่งที่ทำไป *</label>
            <input id="la-action" class="input" placeholder="โทรหาลูกค้า / ส่งใบเสนอ / นัดประชุม..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ผลลัพธ์</label>
              <select id="la-result" class="input">
                <option value="positive">✅ ตอบรับดี</option>
                <option value="neutral">➡️ รอติดตาม</option>
                <option value="negative">❌ ยังลังเล</option>
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">อัปเดต Win Rate (%)</label>
              <input id="la-win" type="number" min="0" max="100" class="input" value="${deal.winPct}"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">Action ต่อไป</label>
            <input id="la-next" class="input" placeholder="นัด Test Drive / ส่งสัญญา..."></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="la-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('la-save')?.addEventListener('click', () => {
      const action = document.getElementById('la-action')?.value.trim()
      if (!action) { showToast('⚠️ กรุณากรอกสิ่งที่ทำไป', 'warning'); return }
      const newWin = parseInt(document.getElementById('la-win')?.value)
      const next   = document.getElementById('la-next')?.value.trim()
      if (!isNaN(newWin) && newWin >= 0 && newWin <= 100) deal.winPct = newWin
      if (next) deal.advice = [next, ...deal.advice.slice(0, 2)]
      deal.days = 0
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ บันทึกการดำเนินการ: ' + action, 'success')
      render()
    })
  }

  function openTrainingModal() {
    const OBJECTIONS = [
      { obj: 'ราคาสูงไป', response: 'เปรียบ TCO 5 ปี: ค่าน้ำมัน ≈ ฿8,000/เดือน vs ชาร์จไฟ ≈ ฿800/เดือน ประหยัดได้ ฿432,000 ใน 5 ปี — ราคารถคุ้มทุนแล้ว' },
      { obj: 'กลัวแบตเสื่อม', response: 'BYD รับประกันแบตเตอรี่ 8 ปี / 200,000 กม. และ Blade Battery ผ่าน Nail Penetration Test แบตแข็งแรงที่สุดในตลาด' },
      { obj: 'ชาร์จไฟยาก', response: 'LAMOM ONE ติดตั้ง Wallbox ฟรีที่บ้าน + สถานีชาร์จสาธารณะ 2,000+ จุดทั่วไทย ชาร์จ DC Fast 30 นาทีได้ 80%' },
      { obj: 'ยังเปรียบเทียบอยู่', response: 'ถามตรงๆ ว่า "รุ่นไหนที่กำลังเปรียบ?" แล้ว Present จุดแข็งของ BYD/MG เทียบโดยตรง พร้อม Test Drive ทันที' },
      { obj: 'รอรุ่นใหม่', response: 'รุ่นใหม่มาอีก 6-12 เดือน ราคาปัจจุบันจะถูกกว่า ประหยัดค่าน้ำมันระหว่างรอได้ถึง ฿48,000 — ไม่คุ้มที่จะรอ' },
      { obj: 'ไม่มีสีที่ต้องการ', response: 'เช็คสต็อกสาขาอื่น / สั่งจองล่วงหน้า 2-4 สัปดาห์ เสนอของแถม (ฟิล์ม / ยางสำรอง) เพื่อชดเชยระหว่างรอ' },
    ]
    openModal({
      title: '🎯 Training Mode — Objection Handling',
      size: 'lg',
      body: `
        <div style="font-size:0.82rem">
          <div style="background:var(--primary)11;border:1px solid var(--primary)33;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:0.76rem">
            <span style="color:var(--primary);font-weight:700">🎓 เป้าหมาย:</span> ฝึกตอบ Objection ลูกค้าได้อย่างมั่นใจ ด้วยข้อมูลที่ถูกต้องและน่าเชื่อถือ
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;max-height:380px;overflow-y:auto">
            ${OBJECTIONS.map((item, i) => `
              <div class="card" style="padding:12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  <span style="background:var(--danger);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0">${i+1}</span>
                  <span style="font-weight:700;color:var(--danger)">"${item.obj}"</span>
                </div>
                <div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:4px;padding-left:30px">✅ วิธีตอบ:</div>
                <div style="font-size:0.76rem;line-height:1.6;padding-left:30px;border-left:3px solid var(--success);margin-left:11px;padding-right:4px">${item.response}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:12px;padding:10px 14px;background:var(--surface-2);border-radius:8px">
            <div style="font-size:0.74rem;font-weight:700;margin-bottom:6px">📌 Tips ที่ควรจำ</div>
            ${TIPS.map(t => `<div style="font-size:0.72rem;color:var(--text-muted);padding:3px 0;border-bottom:1px solid var(--border-subtle)">• ${t}</div>`).join('')}
          </div>
        </div>
      `
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
