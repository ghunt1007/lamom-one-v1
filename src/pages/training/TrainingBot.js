/**
 * TrainingBot AI — สอนพนักงานใหม่อัตโนมัติ
 * Route: /training/bot
 */
import { showToast } from '../../core/store.js'

const TOPICS = [
  { id:'product', label:'🚗 Product Knowledge', icon:'🚗' },
  { id:'sales', label:'💼 Sales Technique', icon:'💼' },
  { id:'service', label:'🔧 Service Process', icon:'🔧' },
  { id:'finance', label:'💳 Finance & Insurance', icon:'💳' },
  { id:'crm', label:'👤 CRM & Customer Care', icon:'👤' },
]

const BOT_RESPONSES = {
  product: [
    { q:'BYD Atto 3 มี Variant อะไรบ้าง?', a:'BYD Atto 3 มี 2 Variant หลัก:\n• Standard Range: แบต 49.92 kWh วิ่งได้ 345 km ราคา 1,099,900 บาท\n• Extended Range: แบต 60.48 kWh วิ่งได้ 420 km ราคา 1,199,900 บาท\nจุดขาย: Blade Battery ปลอดภัยสูงสุด, Interior วัสดุ PU + Vegan Leather' },
    { q:'จุดต่างระหว่าง BYD กับ MG คืออะไร?', a:'BYD:\n• มีแบตเตอรี่ Blade Battery ของตัวเอง — ปลอดภัยกว่า\n• ระยะทาง EV ดีกว่าในราคาเดียวกัน\n• Software OTA update บ่อยกว่า\n\nMG:\n• Network อ่างล้างหน้าแข็งแกร่งกว่าในไทย\n• ราคาถูกกว่าเล็กน้อย\n• iSmart App ครบ' },
  ],
  sales: [
    { q:'วิธีจัดการ objection "ราคาแพงเกินไป"?', a:'ขั้นตอน 3 ขั้น:\n1. รับฟัง & ยืนยัน: "ผมเข้าใจครับ งบมีจำกัด..."\n2. เปรียบ TCO: คำนวณค่าน้ำมัน vs ค่าไฟ 5 ปี → ประหยัด 200,000+ บาท\n3. เสนอทางออก: ดาวน์มากขึ้น / แพ็กเกจผ่อนดอกเบี้ยต่ำ / Balloon Payment\n\nTip: อย่าลด ราคาทันที — ให้เพิ่ม Value ก่อน!' },
    { q:'เทคนิค Close Deal ที่ดีที่สุด?', a:'เทคนิค 3 อย่างที่ได้ผลดีที่สุด:\n1. Alternative Close: "คุณลูกค้าชอบสี Arctic Blue หรือ Cosmos Black ครับ?" — ไม่ถามว่า "ซื้อไหม"\n2. Urgency Close: "โค้วต้าเดือนนี้เหลืออีก 2 คันครับ"\n3. Summary Close: สรุปทุก benefit ที่ลูกค้าชอบ แล้วจบด้วย "พร้อมจะเริ่มเอกสารได้เลยครับ"' },
  ],
  service: [
    { q:'ขั้นตอนการเปิด Job Card มีอะไรบ้าง?', a:'ขั้นตอน Job Card:\n1. รับรถ + ตรวจสภาพภายนอก (ถ่ายรูป 4 ด้าน)\n2. คุยกับลูกค้า — อาการ/ปัญหา (บันทึกใน CRM)\n3. ประเมินงานเบื้องต้น — แจ้งเวลา/ราคาคร่าว\n4. มอบหมายช่าง + เปิด Job Card ในระบบ\n5. อัปเดตลูกค้าทุก 2 ชม. หรือเมื่อมีความเปลี่ยนแปลง\n6. QC ก่อนส่งคืน — ล้างรถ/เช็ดรถ' },
  ],
  finance: [
    { q:'วิธีอธิบาย Balloon Payment ให้ลูกค้าเข้าใจ?', a:'Balloon Payment คือ:\n• ผ่อนงวดต่ำๆ ทุกเดือน (เช่น 5,000 บาท/เดือน)\n• แต่มีงวดสุดท้ายใหญ่ (เช่น 300,000 บาท)\n\nอธิบายให้ลูกค้า:\n"เหมือนผ่อนเบาๆ ก่อน พอครบ 3 ปีค่อยตัดสินใจ: จ่ายก้อนสุดท้าย, รีไฟแนนซ์, หรือเปลี่ยนรถใหม่เลย"\n\nเหมาะกับลูกค้าที่รายได้ขึ้นลง หรือยังไม่แน่ใจอนาคต' },
  ],
  crm: [
    { q:'ควร Follow-up ลูกค้าบ่อยแค่ไหน?', a:'Timeline Follow-up:\n• ทดลองขับแล้ว → 24 ชม. แรก: โทรขอบคุณ + ถามความรู้สึก\n• วันที่ 3: ส่งใบเสนอราคาพร้อม spec\n• วันที่ 7: LINE ข้อเสนอพิเศษ / โปรโมชั่นเดือนนี้\n• วันที่ 14: โทรตรง — มีคำถามเพิ่มเติมไหม?\n• วันที่ 30: แจ้งสต็อกใหม่หรือโปรใหม่\n\nอย่า Silent เกิน 7 วัน — โอกาสหลุดสูงมาก!' },
  ],
}

export default async function TrainingBotPage(container) {
  let selTopic = null
  let messages = []
  let qIndex = 0

  function msgBubble(msg) {
    const isBot = msg.role==='bot'
    return '<div style="display:flex;justify-content:'+(isBot?'flex-start':'flex-end')+';margin-bottom:10px">' +
      (isBot?'<div style="width:28px;height:28px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:0.9rem;margin-right:8px;flex-shrink:0">🤖</div>':'') +
      '<div style="max-width:75%;padding:10px 14px;border-radius:'+(isBot?'4px 12px 12px 12px':'12px 4px 12px 12px')+';background:'+(isBot?'var(--surface-2)':'var(--primary)')+';font-size:0.76rem;white-space:pre-line;line-height:1.6">' +
        msg.text +
      '</div>' +
      (!isBot?'<div style="width:28px;height:28px;border-radius:50%;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:0.9rem;margin-left:8px;flex-shrink:0">👤</div>':'') +
    '</div>'
  }

  function startTopic(topicId) {
    selTopic = topicId
    qIndex = 0
    messages = [{ role:'bot', text:'สวัสดีครับ! ผม LEARN ผู้ช่วย AI ฝึกอบรม 🤖\nวันนี้เราจะเรียน '+(TOPICS.find(t=>t.id===topicId)?.label||topicId)+' ด้วยกันนะครับ\n\nมี '+(BOT_RESPONSES[topicId]?.length||0)+' หัวข้อย่อย กดปุ่มด้านล่างเพื่อเริ่มต้นเลยครับ!' }]
    render()
  }

  function askQuestion(qId) {
    const topic = selTopic
    const responses = BOT_RESPONSES[topic]||[]
    const item = responses[qId]
    if(!item) return
    messages.push({ role:'user', text:item.q })
    messages.push({ role:'bot', text:item.a })
    qIndex++
    render()
    // scroll chat to bottom
    setTimeout(()=>{
      const chat = document.getElementById('chat-area')
      if(chat) chat.scrollTop = chat.scrollHeight
    }, 50)
  }

  function render() {
    const topicBtns = TOPICS.map(t=>'<button class="btn btn-sm '+(selTopic===t.id?'btn-primary':'btn-secondary')+' topic-btn" data-t="'+t.id+'">'+t.icon+' '+t.label.split(' ').slice(1).join(' ')+'</button>').join('')

    if(!selTopic) {
      container.innerHTML = `
        <div class="page-content animate-slide">
          <div class="page-header">
            <div>
              <div class="page-title">🤖 TrainingBot AI</div>
              <div class="page-subtitle">สอนพนักงานใหม่อัตโนมัติ · ขับเคลื่อนโดย LEARN AI Officer</div>
            </div>
          </div>
          <div class="card" style="padding:32px;text-align:center;margin-bottom:16px">
            <div style="font-size:3rem;margin-bottom:10px">🤖</div>
            <div style="font-size:1rem;font-weight:700;margin-bottom:6px">สวัสดีครับ! ผม LEARN</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">AI ผู้ช่วยฝึกอบรมส่วนตัวของคุณ<br>เลือกหัวข้อที่ต้องการเรียนรู้ได้เลยครับ</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${TOPICS.map(t=>'<div class="card topic-select-card" data-t="'+t.id+'" style="padding:18px;cursor:pointer;text-align:center;transition:border-color .2s;border:2px solid transparent"><div style="font-size:2rem;margin-bottom:6px">'+t.icon+'</div><div style="font-weight:700;font-size:0.84rem">'+t.label.split(' ').slice(1).join(' ')+'</div></div>').join('')}
          </div>
        </div>`
      container.querySelectorAll('.topic-select-card').forEach(c=>c.addEventListener('click',()=>startTopic(c.dataset.t)))
      return
    }

    const responses = BOT_RESPONSES[selTopic]||[]
    const remaining = responses.slice(qIndex)
    const quickBtns = remaining.map((r,i)=>'<button class="btn btn-sm btn-secondary ask-btn" data-q="'+(qIndex+i)+'">'+r.q+'</button>').join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 TrainingBot AI</div>
            <div class="page-subtitle">${TOPICS.find(t=>t.id===selTopic)?.label||''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="back-topics-btn">← เลือกหัวข้อใหม่</button>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">${topicBtns}</div>

        <div class="card" style="padding:0;display:flex;flex-direction:column;height:420px">
          <div id="chat-area" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column">
            ${messages.map(m=>msgBubble(m)).join('')}
            ${remaining.length===0?'<div style="text-align:center;color:var(--success);font-size:0.8rem;margin-top:10px">✅ เรียนครบทุกหัวข้อแล้ว! ยอดเยี่ยมมากครับ</div>':''}
          </div>
          ${remaining.length>0?`
          <div style="border-top:1px solid var(--border);padding:12px">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">💬 คำถามที่พบบ่อย — คลิกเพื่อถาม:</div>
            <div style="display:flex;flex-direction:column;gap:6px">${quickBtns}</div>
          </div>`:''}
        </div>
      </div>`

    document.getElementById('back-topics-btn')?.addEventListener('click',()=>{selTopic=null;messages=[];render()})
    container.querySelectorAll('.topic-btn').forEach(b=>b.addEventListener('click',()=>startTopic(b.dataset.t)))
    container.querySelectorAll('.ask-btn').forEach(b=>b.addEventListener('click',()=>askQuestion(parseInt(b.dataset.q))))
    const chat = document.getElementById('chat-area')
    if(chat) chat.scrollTop = chat.scrollHeight
  }

  render()
}
