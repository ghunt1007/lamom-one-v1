/**
 * Sentiment Analysis — AI วิเคราะห์ความรู้สึกลูกค้าจากแชท/รีวิว
 * Route: /marketing/sentiment
 */
import { showToast } from '../../core/store.js'

const CHATS = [
  { id:'C001', customer:'สมชาย ใจดี',    channel:'LINE',     date:'2026-06-14', sentiment:'positive', score:92, text:'รถสวยมาก บริการดีเยี่ยม ประทับใจมากครับ' },
  { id:'C002', customer:'นภา สุขใจ',     channel:'Facebook', date:'2026-06-14', sentiment:'neutral',  score:55, text:'ราคาก็โอเคนะ ลองไปดูที่อื่นด้วยก่อน' },
  { id:'C003', customer:'วิชัย ดีมาก',   channel:'LINE',     date:'2026-06-13', sentiment:'negative', score:18, text:'รอนานมาก พนักงานไม่ค่อยใส่ใจ ไม่ค่อยพอใจ' },
  { id:'C004', customer:'มาลี รุ่งเรือง',channel:'Phone',    date:'2026-06-13', sentiment:'positive', score:88, text:'ดูแลลูกค้าดีมาก ขอบคุณทีม LAMOM มากๆ' },
  { id:'C005', customer:'อรุณ วิชิต',    channel:'LINE',     date:'2026-06-12', sentiment:'positive', score:78, text:'ชอบรุ่นนี้ ราคาก็ยุติธรรม จะพิจารณาอยู่' },
  { id:'C006', customer:'สุดา ภักดี',    channel:'Facebook', date:'2026-06-12', sentiment:'negative', score:22, text:'ทำไมราคาสูงกว่าโชว์รูมอื่น ไม่พอใจเลย' },
  { id:'C007', customer:'ประยุทธ มั่นคง',channel:'LINE',     date:'2026-06-11', sentiment:'neutral',  score:60, text:'ดูก่อนนะครับ ยังไม่ตัดสินใจ' },
  { id:'C008', customer:'พิมพ์ สวัสดี',  channel:'Phone',    date:'2026-06-11', sentiment:'positive', score:95, text:'ขอบคุณมากเลยค่ะ ส่งมอบรถเรียบร้อยดีมาก' },
]

const MONTHLY = [
  { month:'ม.ค.', pos:62 }, { month:'ก.พ.', pos:58 }, { month:'มี.ค.', pos:65 },
  { month:'เม.ย.', pos:70 }, { month:'พ.ค.', pos:68 }, { month:'มิ.ย.', pos:75 },
]

export default async function SentimentPage(container) {
  let filterCh   = 'all'
  let filterSent = 'all'

  function chatRow(c) {
    const icon  = c.sentiment==='positive'?'😊':c.sentiment==='negative'?'😠':'😐'
    const bg    = c.sentiment==='positive'?'var(--success)':c.sentiment==='negative'?'var(--danger)':'var(--warning)'
    const label = c.sentiment==='positive'?'บวก':c.sentiment==='negative'?'ลบ':'กลางๆ'
    return `<div class="card" style="padding:12px;border-left:3px solid ${bg}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:1.4rem">${icon}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.84rem">${c.customer}</span>
            <span style="font-size:0.66rem;background:var(--surface-2);padding:1px 7px;border-radius:8px">${c.channel}</span>
            <span style="font-size:0.62rem;background:${bg};color:#fff;padding:1px 8px;border-radius:8px">${label} ${c.score}%</span>
            <span style="font-size:0.64rem;color:var(--text-muted);margin-left:auto">${c.date}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted)">"${c.text}"</div>
        </div>
      </div>
    </div>`
  }

  function render() {
    let rows = CHATS
    if (filterCh   !== 'all') rows = rows.filter(c=>c.channel===filterCh)
    if (filterSent !== 'all') rows = rows.filter(c=>c.sentiment===filterSent)

    const pos      = CHATS.filter(c=>c.sentiment==='positive').length
    const neg      = CHATS.filter(c=>c.sentiment==='negative').length
    const neu      = CHATS.filter(c=>c.sentiment==='neutral').length
    const avgScore = Math.round(CHATS.reduce((s,c)=>s+c.score,0)/CHATS.length)
    const barMax   = Math.max(...MONTHLY.map(m=>m.pos))

    const bars = MONTHLY.map(m => {
      const h = Math.round(m.pos/barMax*60)
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">'
        + '<div style="width:28px;background:var(--success);border-radius:3px 3px 0 0;height:' + h + 'px"></div>'
        + '<div style="font-size:0.6rem;color:var(--text-muted)">' + m.month + '</div>'
        + '<div style="font-size:0.58rem;color:var(--success)">' + m.pos + '%</div>'
        + '</div>'
    }).join('')

    const chBreakdown = ['LINE','Facebook','Phone'].map(ch => {
      const items = CHATS.filter(c=>c.channel===ch)
      const avg   = items.length ? Math.round(items.reduce((s,c)=>s+c.score,0)/items.length) : 0
      const col   = avg>=70?'var(--success)':avg>=50?'var(--warning)':'var(--danger)'
      return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.74rem">'
        + '<span>' + ch + ' (' + items.length + ')</span>'
        + '<b style="color:' + col + '">' + avg + '%</b>'
        + '</div>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧠 Sentiment Analysis</div>
            <div class="page-subtitle">AI วิเคราะห์ความรู้สึกลูกค้าจากแชท/รีวิว · ${CHATS.length} บทสนทนา</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="analyze-btn">🤖 วิเคราะห์ใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('😊 ความรู้สึกบวก', pos+' ('+Math.round(pos/CHATS.length*100)+'%)', 'var(--success)')}
          ${sc('😐 กลางๆ', neu+' ('+Math.round(neu/CHATS.length*100)+'%)', 'var(--warning)')}
          ${sc('😠 ความรู้สึกลบ', neg+' ('+Math.round(neg/CHATS.length*100)+'%)', 'var(--danger)')}
          ${sc('⭐ คะแนนเฉลี่ย', avgScore+'%', avgScore>=70?'var(--success)':avgScore>=50?'var(--warning)':'var(--danger)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;margin-bottom:16px">
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 แนวโน้ม Sentiment บวก รายเดือน</div>
            <div style="display:flex;align-items:flex-end;gap:8px;height:80px">${bars}</div>
          </div>
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 แยกตาม Channel</div>
            ${chBreakdown}
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
          ${['all','LINE','Facebook','Phone'].map(ch=>`<button class="btn btn-xs ${filterCh===ch?'btn-primary':'btn-secondary'} ch-btn" data-ch="${ch}">${ch==='all'?'ทุก Channel':ch}</button>`).join('')}
          <span style="width:1px;background:var(--border);margin:0 4px"></span>
          ${['all','positive','neutral','negative'].map(s=>`<button class="btn btn-xs ${filterSent===s?'btn-primary':'btn-secondary'} sent-btn" data-s="${s}">${s==='all'?'ทั้งหมด':s==='positive'?'😊 บวก':s==='neutral'?'😐 กลางๆ':'😠 ลบ'}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(c=>chatRow(c)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบบทสนทนา</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.ch-btn').forEach(b=>b.addEventListener('click',()=>{filterCh=b.dataset.ch;render()}))
    container.querySelectorAll('.sent-btn').forEach(b=>b.addEventListener('click',()=>{filterSent=b.dataset.s;render()}))
    document.getElementById('analyze-btn')?.addEventListener('click',()=>{
      CHATS.forEach(c => {
        const delta = Math.round((Math.random() - 0.45) * 12)
        c.score = Math.max(5, Math.min(99, c.score + delta))
        c.sentiment = c.score >= 70 ? 'positive' : c.score >= 40 ? 'neutral' : 'negative'
      })
      const pos = CHATS.filter(c=>c.sentiment==='positive').length
      const neg = CHATS.filter(c=>c.sentiment==='negative').length
      render()
      showToast(`🤖 Re-analyze เสร็จ — บวก ${pos} · ลบ ${neg} · กลาง ${CHATS.length-pos-neg}`, 'success')
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
