/**
 * Expense Receipt OCR — สแกนใบเสร็จ AI อ่าน ขออนุมัติ
 * Route: /hr/expense-ocr
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'
import { uploadFile } from '../../utils/storage.js'
import { analyzeExpenseReceipt } from '../../utils/ai.js'

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
  const myGen = container.__routerGen
  let filterStatus = 'all'

  if (!RECEIPTS.some(r => r._persisted)) {
    try {
      const real = await listDocs('expense_receipts', [], 'date', 'desc', 200).catch(() => [])
      if (container.__routerGen === myGen && real.length) {
        RECEIPTS = [...real.map(r => ({ ...r, _persisted: true })), ...RECEIPTS]
      }
    } catch {}
  }

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
      const toApprove = RECEIPTS.filter(r=>r.status==='pending')
      toApprove.forEach(r => { r.status='approved'; if (r._persisted) updateDocData('expense_receipts', r.id, { status: 'approved' }).catch(() => {}) })
      render(); showToast(`✅ อนุมัติ ${toApprove.length} ใบเสร็จแล้ว`, 'success')
    })
    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { filterStatus=b.dataset.s; render() }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const r = RECEIPTS.find(x=>x.id===b.dataset.id)
      if (!r) return
      r.status='approved'
      if (r._persisted) updateDocData('expense_receipts', r.id, { status: 'approved' }).catch(() => {})
      render(); showToast(`✅ อนุมัติใบเสร็จ ${r.vendor} แล้ว`, 'success')
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => {
      const r = RECEIPTS.find(x=>x.id===b.dataset.id)
      if (!r) return
      r.status='rejected'; r.note='ผู้อนุมัติปฏิเสธ'
      if (r._persisted) updateDocData('expense_receipts', r.id, { status: 'rejected', note: r.note }).catch(() => {})
      render(); showToast(`❌ ปฏิเสธใบเสร็จ ${r.vendor}`, 'warning')
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
          ${r.imageUrl
            ? `<img src="${r.imageUrl}" style="max-width:100%;max-height:180px;border-radius:6px;cursor:pointer" onclick="window.open('${r.imageUrl}','_blank')">`
            : `📷 ไม่มีภาพแนบ<br><span style="font-size:1.5rem">🧾</span>`}
        </div>
        <div style="font-size:0.72rem"><b>สถานะ:</b> <span style="background:${s.color};color:#fff;padding:1px 8px;border-radius:8px">${s.label}</span></div>
        ${r.note ? `<div style="font-size:0.72rem;color:var(--danger);margin-top:6px">⚠️ ${r.note}</div>` : ''}`,
      confirmText: r.status==='pending' ? '✅ อนุมัติ' : '💾 OK',
      onConfirm() {
        if (r.status==='pending') {
          r.status='approved'
          if (r._persisted) updateDocData('expense_receipts', r.id, { status: 'approved' }).catch(() => {})
          render(); showToast(`✅ อนุมัติ ${r.vendor} แล้ว`,'success')
        }
      }
    })
  }

  function openScanModal() {
    const { el, close } = openModal({
      title:'📷 สแกนใบเสร็จใหม่', size:'sm',
      body:`<div style="text-align:center;padding:12px 0;font-size:0.82rem">
        <div style="font-size:3rem;margin-bottom:10px">📷</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px">อัปโหลดรูปใบเสร็จ — AI จะอ่านและกรอกข้อมูลอัตโนมัติ</div>
        <input class="input" type="file" id="rc-file" accept="image/*" style="margin-bottom:8px">
        <div style="font-size:0.68rem;color:var(--text-muted)">รองรับ JPG, PNG · ขนาดไม่เกิน 10 MB</div>
        <span class="input-error" id="rc-err"></span>
      </div>`,
      footer: '<button class="btn btn-secondary" id="rc-c">ยกเลิก</button><button class="btn btn-primary" id="rc-s">🤖 ประมวลผล OCR</button>',
    })
    el.querySelector('#rc-c').addEventListener('click', close)
    el.querySelector('#rc-s').addEventListener('click', async () => {
      const file = el.querySelector('#rc-file')?.files?.[0]
      if (!file) { el.querySelector('#rc-err').textContent = '⚠️ กรุณาเลือกรูปใบเสร็จ'; return }
      if (file.size > 10 * 1024 * 1024) { el.querySelector('#rc-err').textContent = '⚠️ ไฟล์ใหญ่เกิน 10 MB'; return }

      const btn = el.querySelector('#rc-s'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> AI กำลังอ่านใบเสร็จ...'
      try {
        const base64 = await fileToBase64(file)
        const [ocr, up] = await Promise.all([
          analyzeExpenseReceipt(base64, file.type || 'image/jpeg'),
          uploadFile(file, 'expense-receipts').catch(() => ({ url: '' })),
        ])
        const me = getState('user') || {}
        const data = {
          staff: me.displayName || me.email || 'ผู้ใช้ปัจจุบัน', dept: '—',
          date: ocr.date || new Date().toISOString().slice(0, 10),
          vendor: ocr.vendor || 'ไม่ทราบชื่อร้าน', amount: ocr.amount || 0, cat: ocr.category || 'อื่นๆ',
          status: 'pending', note: '', confidence: ocr.confidence || 90, imageUrl: up.url || '',
        }
        try {
          const id = await createDoc('expense_receipts', data)
          RECEIPTS.unshift({ id, ...data, _persisted: true })
          try {
            await createDoc('notifications', {
              type: 'expense',
              title: 'มีใบเสร็จค่าใช้จ่ายรออนุมัติ',
              body: `${data.staff} ส่งใบเสร็จ ${data.vendor} (${formatCurrency(data.amount)}) — กรุณาตรวจสอบ`,
              read: false, link: '/hr/expense-ocr', createdAt: new Date().toISOString(),
            })
            setState('unreadCount', (getState('unreadCount') || 0) + 1)
          } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบใบเสร็จที่บันทึกไปแล้ว */ }
        } catch {
          RECEIPTS.unshift({ id: 'R' + Date.now(), ...data, _persisted: false })
        }
        close(); render()
        showToast(ocr.demo ? '🤖 Demo mode — ตั้งค่า VITE_GEMINI_API_KEY เพื่ออ่านใบเสร็จจริง' : '🤖 AI อ่านใบเสร็จสำเร็จ · ส่งขออนุมัติแล้ว', ocr.demo ? 'info' : 'success')
      } catch (err) {
        btn.disabled = false; btn.textContent = '🤖 ประมวลผล OCR'
        showToast(`❗ ประมวลผลไม่สำเร็จ: ${err.message || 'ไม่ทราบสาเหตุ'}`, 'error')
      }
    })
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
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
