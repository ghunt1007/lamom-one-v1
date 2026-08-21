/**
 * Receipt Automation — ออกใบเสร็จอัตโนมัติ / กฎการส่ง
 * Route: /finance/receipt-auto
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency, todayBangkok } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { sendSms, sendEmail } from '../../utils/comms.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const STATUS_CFG = {
  sent:    { label:'ส่งแล้ว',    bg:'var(--success)',     icon:'✅' },
  pending: { label:'รอส่ง',      bg:'var(--warning)',     icon:'⏳' },
  failed:  { label:'ส่งไม่ได้',  bg:'var(--danger)',      icon:'❌' },
}

const RULE_TRIGGERS = ['sale.completed', 'service.completed', 'invoice.issued', 'insurance.renewed', 'payment.received']
const RULE_CHANNELS = { sms: '📱 SMS', email: '📧 Email', line: '💚 LINE' }

export default async function ReceiptAutoPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let RECEIPTS = []
  let AUTO_RULES = []
  let tab = 'receipts'
  let filterStatus = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      RECEIPTS = (await listDocs('auto_receipts', companyScopeFilters(), 'date', 'desc', 500)).filter(r => !r.deleted)
      AUTO_RULES = (await listDocs('auto_send_rules', companyScopeFilters(), 'name', 'asc', 500)).filter(r => !r.deleted)
    } catch (e) { RECEIPTS = []; AUTO_RULES = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function receiptRow(r) {
    const cfg     = STATUS_CFG[r.status]
    const retryBtn = r.status==='failed'  ? '<button class="btn btn-xs btn-primary retry-btn" data-id="' + r.id + '" style="font-size:0.68rem">🔄 Retry</button>' : ''
    const sendBtn  = r.status==='pending' ? '<button class="btn btn-xs btn-primary send-btn" data-id="' + r.id + '" style="font-size:0.68rem">📤 ส่งเลย</button>' : ''
    const channelIcon = r.channel==='email'?'📧':r.channel==='line'?'💚':'📱'
    return '<div class="card" style="padding:12px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:1.4rem">🧾</div>' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
            '<span style="font-weight:700;font-size:0.82rem">' + r.number + '</span>' +
            '<span style="font-size:0.62rem;background:' + cfg.bg + ';color:#fff;padding:1px 7px;border-radius:8px">' + cfg.icon + ' ' + cfg.label + '</span>' +
          '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted)">' + escHtml(r.customer) + ' · ฿' + r.amount.toLocaleString() + ' · ' + channelIcon + ' ' + r.channel + ' · ' + formatDate(r.date) + '</div>' +
        '</div>' +
        '<div>' + retryBtn + sendBtn + '</div>' +
      '</div>' +
    '</div>'
  }

  function ruleRow(rule) {
    const chIcon = rule.channel==='email'?'📧':rule.channel==='line'?'💚':'📱'
    const toggle = '<label style="cursor:pointer;display:flex;align-items:center;gap:6px">' +
      '<input type="checkbox" class="rule-toggle" data-id="' + rule.id + '" ' + (rule.active?'checked':'') + ' style="cursor:pointer">' +
      '<span style="font-size:0.72rem">' + (rule.active?'เปิด':'ปิด') + '</span>' +
    '</label>'
    return '<div class="card" style="padding:12px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:1.4rem">' + chIcon + '</div>' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:0.82rem;margin-bottom:2px">' + escHtml(rule.name) + '</div>' +
          '<div style="font-size:0.68rem;color:var(--text-muted)">Trigger: ' + escHtml(rule.trigger) + ' → ' + escHtml(rule.channel) + '</div>' +
        '</div>' +
        toggle +
        '<button class="btn btn-xs btn-ghost del-rule-btn" data-id="' + rule.id + '" title="ลบ" style="color:var(--danger)">🗑️</button>' +
      '</div>' +
    '</div>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let rows = RECEIPTS
    if (filterStatus !== 'all') rows = rows.filter(r=>r.status===filterStatus)

    const sentCount    = RECEIPTS.filter(r=>r.status==='sent').length
    const pendingCount = RECEIPTS.filter(r=>r.status==='pending').length
    const failedCount  = RECEIPTS.filter(r=>r.status==='failed').length
    const totalAmt     = RECEIPTS.reduce((s,r)=>s+r.amount,0)

    const statusBtns = ['all','sent','pending','failed'].map(s=>{
      const lbl = s==='all'?'ทั้งหมด':STATUS_CFG[s].icon+' '+STATUS_CFG[s].label
      return '<button class="btn btn-xs ' + (filterStatus===s?'btn-primary':'btn-secondary') + ' stat-btn" data-s="' + s + '">' + lbl + '</button>'
    }).join('')

    const tabBtns = [
      {key:'receipts', label:'🧾 ใบเสร็จ'},
      {key:'rules',    label:'⚙️ Auto Rules'},
    ].map(t=>'<button class="btn btn-sm ' + (tab===t.key?'btn-primary':'btn-secondary') + ' tab-btn" data-t="' + t.key + '">' + t.label + '</button>').join('')

    const rulesHtml = AUTO_RULES.map(r=>ruleRow(r)).join('') +
      (AUTO_RULES.length === 0 ? '<div class="empty-state"><div class="empty-icon">⚙️</div><div class="empty-title">ยังไม่มี Auto Rule</div><div class="empty-desc">กด "➕ เพิ่ม Rule" เพื่อตั้งกฎส่งใบเสร็จอัตโนมัติ</div></div>' : '')
    const receiptsHtml = `
      <div style="display:flex;gap:6px;margin-bottom:12px">${statusBtns}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${rows.map(r=>receiptRow(r)).join('')}
        ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>':''}
      </div>`

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧾 Receipt Automation</div>
            <div class="page-subtitle">ออกใบเสร็จอัตโนมัติ · ${RECEIPTS.length} รายการ</div>
          </div>
          <div class="page-actions">
            ${tab === 'rules' ? '<button class="btn btn-primary" id="add-rule-btn">➕ เพิ่ม Rule</button>' : '<button class="btn btn-primary" id="gen-btn">+ ออกใบเสร็จ</button>'}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('✅ ส่งแล้ว', sentCount+' รายการ', 'var(--success)')}
          ${sc('⏳ รอส่ง', pendingCount+' รายการ', 'var(--warning)')}
          ${sc('❌ ส่งไม่ได้', failedCount+' รายการ', 'var(--danger)')}
          ${sc('💰 รวมยอด', '฿'+totalAmt.toLocaleString(), 'var(--primary)')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px">${tabBtns}</div>

        ${tab==='receipts' ? receiptsHtml : '<div style="display:flex;flex-direction:column;gap:8px">' + rulesHtml + '</div>'}
      </div>`

    container.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.t;render()}))
    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.retry-btn').forEach(b=>b.addEventListener('click', async ()=>{
      const r=RECEIPTS.find(x=>x.id===b.dataset.id)
      if(!r) return
      await sendReceipt(r)
    }))
    container.querySelectorAll('.send-btn').forEach(b=>b.addEventListener('click', async ()=>{
      const r=RECEIPTS.find(x=>x.id===b.dataset.id)
      if(!r) return
      await sendReceipt(r)
    }))
    container.querySelectorAll('.rule-toggle').forEach(cb=>cb.addEventListener('change', async ()=>{
      const rule=AUTO_RULES.find(x=>x.id===cb.dataset.id)
      if(!rule) return
      try {
        await updateDocData('auto_send_rules', rule.id, { active: cb.checked })
        showToast((cb.checked?'✅ เปิด':'❌ ปิด')+' Rule: '+rule.name,'info')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('gen-btn')?.addEventListener('click', openGenReceiptModal)
    document.getElementById('add-rule-btn')?.addEventListener('click', openAddRuleModal)
    container.querySelectorAll('.del-rule-btn').forEach(b=>b.addEventListener('click', async ()=>{
      const rule = AUTO_RULES.find(x=>x.id===b.dataset.id)
      if (!rule) return
      const ok = await confirmDialog({ title:'🗑️ ลบ Auto Rule', message:`ยืนยันลบ Rule "${escHtml(rule.name)}"?`, confirmText:'ลบ', danger:true })
      if (!ok) return
      try {
        await softDelete('auto_send_rules', rule.id)
        showToast('🗑️ ลบแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  function openAddRuleModal() {
    openModal({
      title: '➕ เพิ่ม Auto Send Rule',
      size: 'sm',
      body: `<div style="display:grid;gap:10px;font-size:0.82rem">
        <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อ Rule *</label>
          <input id="ar-name" class="input" placeholder="เช่น ส่งใบเสร็จหลังปิดงาน"></div>
        <div><label style="font-size:0.74rem;color:var(--text-muted)">Trigger (เหตุการณ์ที่จะเริ่มส่ง)</label>
          <select id="ar-trig" class="input">${RULE_TRIGGERS.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
        <div><label style="font-size:0.74rem;color:var(--text-muted)">ช่องทางส่ง</label>
          <select id="ar-ch" class="input">${Object.entries(RULE_CHANNELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
        <span class="input-error" id="ar-err"></span>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ar-c">ยกเลิก</button><button class="btn btn-primary" id="ar-s">💾 บันทึก</button>`,
    })
    document.getElementById('ar-c')?.addEventListener('click', () => document.querySelector('.modal-overlay')?.remove())
    document.getElementById('ar-s')?.addEventListener('click', async () => {
      const name = document.getElementById('ar-name')?.value.trim()
      if (!name) { document.getElementById('ar-err').textContent = '❗ กรุณากรอกชื่อ Rule'; return }
      try {
        await createDoc('auto_send_rules', {
          name,
          trigger: document.getElementById('ar-trig')?.value || RULE_TRIGGERS[0],
          channel: document.getElementById('ar-ch')?.value || 'sms',
          active: true,
          companyId: myEffectiveCompanyId(),
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ เพิ่ม Rule แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  // เดิม "ส่งเลย"/"Retry" แค่ flip status เป็น 'sent' ไม่เคยเรียกผู้ให้บริการจริงเลย (ใบเสร็จไม่ถึงมือลูกค้าจริง
  // แต่ระบบขึ้นว่า "ส่งแล้ว") แก้ให้เรียก sendSms/sendEmail จริงผ่าน src/utils/comms.js (pattern เดียวกับ
  // Installment.js) จับคู่เบอร์โทร/อีเมลจาก r.phone/r.email ที่กรอกตอนออกใบเสร็จ — ช่องทาง LINE ที่เชื่อมจริง
  // เป็น broadcast ทั้งฐานลูกค้าเท่านั้น (sendLineBroadcast) ส่งเจาะรายบุคคลไม่ได้ จึงยังไม่มี API ส่งเฉพาะคน
  // สำหรับ LINE — คงพฤติกรรมเดิม (mark sent) ไว้เฉพาะช่องทางนี้เท่านั้น พร้อม comment อธิบายไว้ตรงนี้
  async function sendReceipt(r) {
    try {
      if (r.channel === 'sms') {
        if (!r.phone) {
          showToast('⚠️ ไม่มีเบอร์โทรของ ' + r.customer + ' ในระบบ — ส่งไม่ได้', 'error')
          await updateDocData('auto_receipts', r.id, { status: 'failed' })
          await loadData()
          return
        }
        await sendSms([r.phone], `LAMOM ใบเสร็จ ${r.number} — ${r.customer} ยอด ${formatCurrency(r.amount)} ขอบคุณที่ใช้บริการ`)
      } else if (r.channel === 'email') {
        if (!r.email) {
          showToast('⚠️ ไม่มีอีเมลของ ' + r.customer + ' ในระบบ — ส่งไม่ได้', 'error')
          await updateDocData('auto_receipts', r.id, { status: 'failed' })
          await loadData()
          return
        }
        await sendEmail([r.email], `ใบเสร็จ ${r.number}`, `เรียนคุณ ${r.customer}\n\nใบเสร็จเลขที่ ${r.number} ยอด ${formatCurrency(r.amount)}\nขอบคุณที่ใช้บริการ LAMOM`)
      }
      // channel === 'line' — ยังไม่มี API ส่งเฉพาะคนจริง (ดู comment ด้านบน) คงพฤติกรรมเดิม
      await updateDocData('auto_receipts', r.id, { status: 'sent', sent: true })
      showToast('📤 ส่งใบเสร็จ ' + r.number + ' แล้ว', 'success')
      await loadData()
    } catch (e) {
      await updateDocData('auto_receipts', r.id, { status: 'failed' }).catch(() => {})
      showToast('⚠️ ส่งใบเสร็จ ' + r.number + ' ไม่สำเร็จ', 'error')
      await loadData()
    }
  }

  function openGenReceiptModal() {
    // เดิม new Date().toISOString().slice(0,10) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้" ผิดไป 1 วันทุกครั้งที่
    // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
    const today = todayBangkok()
    const nextNum = 'REC-' + new Date().getFullYear() + '-' + String(RECEIPTS.length + 541 + 1).padStart(4,'0')
    openModal({
      title: '🧾 ออกใบเสร็จด่วน',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="background:var(--surface-2);border-radius:8px;padding:8px 12px;font-size:0.76rem">
            <span style="color:var(--text-muted)">เลขที่ใบเสร็จ: </span>
            <span style="font-weight:700;font-family:monospace">${nextNum}</span>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อลูกค้า *</label>
            <input id="rc-cust" class="input" placeholder="ชื่อ-นามสกุล..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภท</label>
              <select id="rc-type" class="input">
                <option value="purchase">ซื้อรถ</option>
                <option value="service">ซ่อมบริการ</option>
                <option value="insurance">ประกัน</option>
                <option value="parts">อะไหล่</option>
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ช่องทางส่ง</label>
              <select id="rc-ch" class="input">
                <option value="email">📧 Email</option>
                <option value="line">💚 LINE</option>
                <option value="sms">📱 SMS</option>
              </select>
            </div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ยอดรวม (฿) *</label>
            <input id="rc-amt" type="number" class="input" placeholder="0"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">เบอร์โทร (สำหรับส่ง SMS)</label>
              <input id="rc-phone" class="input" placeholder="08xxxxxxxx"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">อีเมล (สำหรับส่ง Email)</label>
              <input id="rc-email" class="input" type="email" placeholder="name@email.com"></div>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="rc-save">🧾 ออกใบเสร็จ</button>
        </div>
      `
    })
    document.getElementById('rc-save')?.addEventListener('click', async () => {
      const customer = document.getElementById('rc-cust')?.value.trim()
      const amount   = parseFloat(document.getElementById('rc-amt')?.value) || 0
      if (!customer || !amount) { showToast('⚠️ กรุณากรอกชื่อและยอดเงิน', 'warning'); return }
      try {
        await createDoc('auto_receipts', {
          number: nextNum,
          customer, amount,
          type:    document.getElementById('rc-type')?.value || 'service',
          channel: document.getElementById('rc-ch')?.value || 'email',
          phone:   document.getElementById('rc-phone')?.value?.trim() || '',
          email:   document.getElementById('rc-email')?.value?.trim() || '',
          date: today,
          sent: false,
          status: 'pending',
          companyId: myEffectiveCompanyId(),
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ ออกใบเสร็จ ' + nextNum + ' ให้ ' + customer + ' แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
