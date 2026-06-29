/**
 * Expense Receipt OCR — สแกนใบเสร็จ AI อ่าน ขออนุมัติ
 * Route: /hr/expense-ocr
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

let RECEIPTS = [
  { id:'R001', staff:'นภา มีสุข', dept:'ฝ่ายขาย', date:'2026-06-12', vendor:'ร้านอาหาร MK Suki', amount:1240, cat:'เลี้ยงรับรองลูกค้า', status:'approved', note:'', confidence:97 },
  { id:'R002', staff:'สมชาย วิเศษ', dept:'ฝ่ายบริการ', date:'2026-06-11', vendor:'บ.น้ำมัน PTT จำกัด', amount:850, cat:'ค่าน้ำมัน', status:'pending', note:'', confidence:94 },
  { id:'R003', staff:'มาลี จันทร์ดี', dept:'ฝ่ายการตลาด', date:'2026-06-10', vendor:'FedEx Thailand', amount:320, cat:'ค่าขนส่ง', status:'rejected', note:'ไม่ได้รับอนุมัติล่วงหน้า', confidence:88 },
  { id:'R004', staff:'วิชัย รุ่งเรือง', dept:'ฝ่ายขาย', date:'2026-06-13', vendor:'Grab For Business', amount:560, cat:'ค่าเดินทาง', status:'pending', note:'', confidence:99 },
  { id:'R005', staff:'รัชนี สุขใจ', dept:'ฝ่าย HR', date:'2026-06-09', vendor:'Office Depot', amount:4800, cat:'เครื่องเขียน/อุปกรณ์สำนักงาน', status:'approved', note:'', confidence:91 },
]

const CATS = ['เลี้ยงรับรองลูกค้า','ค่าน้ำมัน','ค่าเดินทาง','ค่าที่พัก','เครื่องเขียน/อุปกรณ์สำนักงาน','ค่าอาหารพนักงาน','ค่าขนส่ง','อื่นๆ']

const ST = {
  approved: { label:'อนุมัติแล้ว', color:'var(--success)' },
  pending:  { label:'รออนุมัติ',   color:'var(--warning)' },
  rejected: { label:'ปฏิเสธ',     color:'var(--danger)'  },
}

export default async function ExpenseOcrPage(container) {
  let filterStatus = 'all'

  function render() {
    const rows = filterStatus === 'all' ? RECEIPTS : RECEIPTS.filter(r => r.status === filterStatus)
    const pending = RECEIPTS.filter(r => r.status === 'pending')
    const totalAmt = RECEIPTS.filter(r=>r.status==='approved').reduce((s,r)=>s+r.amount,0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧾 Expense Receipt OCR</div>
            <div class="page-subtitle">AI อ่านใบเสร็จ แยกหมวด ส่งขออนุมัติ · ${RECEIPTS.length} ใบ · ${pending.length} รออนุมัติ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="scan-btn">📷 สแกนใบเสร็จใหม่</button>
            <button class="btn btn-primary" id="approve-all-btn">✅ อนุมัติทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📤 ส่งขออนุมัติ', pending.length+' ใบ', 'var(--warning)')}
          ${sc('✅ อนุมัติแล้ว', RECEIPTS.filter(r=>r.status==='approved').length+' ใบ', 'var(--success)')}
          ${sc('💰 ยอดอนุมัติ', formatCurrency(totalAmt), 'var(--primary)')}
          ${sc('🤖 ความแม่นยำ AI', Math.round(RECEIPTS.reduce((s,r)=>s+r.confidence,0)/RECEIPTS.length)+'%', 'var(--text)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:12px">
          ${['all','pending','approved','rejected'].map(s=>`
            <button class="btn btn-xs ${filterStatus===s?'btn-primary':'btn-secondary'} sf-btn" data-s="${s}">
              ${s==='all'?'ทั้งหมด':ST[s]?.label||s}
              ${s!=='all'?`(${RECEIPTS.filter(r=>r.status===s).length})`:''}
            </button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${rows.map(r => receiptCard(r)).join('')}
        </div>
      </div>`

    document.getElementById('scan-btn')?.addEventListener('click', () => openScanModal())
    document.getElementById('approve-all-btn')?.addEventListener('click', () => {
      const n = RECEIPTS.filter(r=>r.status==='pending').length
      RECEIPTS.forEach(r => { if (r.status==='pending') r.status='approved' })
      render(); showToast(`✅ อนุมัติ ${n} ใบเสร็จแล้ว`, 'success')
    })
    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { filterStatus=b.dataset.s; render() }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const r = RECEIPTS.find(x=>x.id===b.dataset.id)
      if (r) { r.status='approved'; render(); showToast(`✅ อนุมัติใบเสร็จ ${r.vendor} แล้ว`, 'success') }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const r = RECEIPTS.find(x=>x.id===b.dataset.id)
      if (r) { r.status='rejected'; r.note='ผู้อนุมัติปฏิเสธ'; render(); showToast(`❌ ปฏิเสธใบเสร็จ ${r.vendor}`, 'warning') }
    }))
    container.querySelectorAll('.detail-btn').forEach(b => b.addEventListener('click', () => {
      const r = RECEIPTS.find(x=>x.id===b.dataset.id)
      if (r) openDetailModal(r)
    }))
  }

  function receiptCard(r) {
    const s = ST[r.status]
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <!-- Receipt icon/thumb -->
          <div style="width:52px;height:66px;background:var(--surface-2);border-radius:var(--radius-sm);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border:1px dashed var(--border)">
            <div style="font-size:1.4rem">🧾</div>
            <div style="font-size:0.54rem;color:var(--text-muted);margin-top:2px">OCR ${r.confidence}%</div>
          </div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div>
                <div style="font-weight:700;font-size:0.84rem">${r.vendor}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${r.staff} · ${r.dept} · ${formatDate(r.date)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:1rem;font-weight:900;color:var(--primary)">${formatCurrency(r.amount)}</div>
                <span style="font-size:0.62rem;background:${s.color};color:#fff;padding:2px 8px;border-radius:10px">${s.label}</span>
              </div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">
              🏷 ${r.cat}
              ${r.note ? ` · ⚠️ ${r.note}` : ''}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-xs btn-secondary detail-btn" data-id="${r.id}">🔍 รายละเอียด</button>
              ${r.status==='pending' ? `
                <button class="btn btn-xs btn-primary approve-btn" data-id="${r.id}">✅ อนุมัติ</button>
                <button class="btn btn-xs btn-secondary reject-btn" data-id="${r.id}" style="color:var(--danger)">✕ ปฏิเสธ</button>` : ''}
            </div>
          </div>
        </div>
      </div>`
  }

  function openDetailModal(r) {
    const s = ST[r.status]
    openModal({
      title: `🧾 ${r.vendor}`,
      size: 'sm',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.76rem;margin-bottom:12px">
          ${[['พนักงาน',r.staff],['แผนก',r.dept],['วันที่',formatDate(r.date)],['หมวด',r.cat],['จำนวนเงิน',formatCurrency(r.amount)],['AI Confidence',r.confidence+'%']].map(([k,v])=>`
            <div style="background:var(--surface-2);padding:6px 8px;border-radius:var(--radius-sm)">
              <div style="font-size:0.62rem;color:var(--text-muted)">${k}</div>
              <div style="font-weight:600">${v}</div>
            </div>`).join('')}
        </div>
        <div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:10px;text-align:center;font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">
          📷 ภาพใบเสร็จ (OCR preview)<br>
          <span style="font-size:1.5rem">🧾</span>
        </div>
        <div style="font-size:0.72rem"><b>สถานะ:</b> <span style="background:${s.color};color:#fff;padding:1px 8px;border-radius:8px">${s.label}</span></div>
        ${r.note ? `<div style="font-size:0.72rem;color:var(--danger);margin-top:6px">⚠️ ${r.note}</div>` : ''}`,
      confirmText: r.status==='pending' ? '✅ อนุมัติ' : '💾 OK',
      onConfirm() {
        if (r.status==='pending') { r.status='approved'; render(); showToast(`✅ อนุมัติ ${r.vendor} แล้ว`,'success') }
      }
    })
  }

  function openScanModal() {
    openModal({
      title:'📷 สแกนใบเสร็จใหม่', size:'sm',
      body:`<div style="text-align:center;padding:20px 0;font-size:0.82rem">
        <div style="font-size:3rem;margin-bottom:10px">📷</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">อัปโหลดรูปใบเสร็จ — AI จะอ่านและกรอกข้อมูลอัตโนมัติ</div>
        <div style="border:2px dashed var(--border);padding:20px;border-radius:var(--radius-sm);margin-bottom:12px;cursor:pointer">📎 ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</div>
        <div style="font-size:0.68rem;color:var(--text-muted)">รองรับ JPG, PNG, PDF · ขนาดไม่เกิน 10 MB</div>
      </div>`,
      confirmText:'🤖 ประมวลผล OCR',
      onConfirm() {
        const id = 'R' + Date.now()
        RECEIPTS.unshift({ id, staff:'ผู้ใช้ปัจจุบัน', dept:'—', date:'2026-06-14', vendor:'ร้านค้า (OCR)', amount:Math.floor(Math.random()*3000+200), cat:'อื่นๆ', status:'pending', note:'', confidence:Math.floor(Math.random()*10+88) })
        render(); showToast('🤖 OCR อ่านใบเสร็จสำเร็จ · ส่งขออนุมัติแล้ว', 'success')
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.3rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
