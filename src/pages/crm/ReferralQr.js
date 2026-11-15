/**
 * Referral QR Generator — QR แนะนำเพื่อน ได้ Commission อัตโนมัติ
 * Route: /crm/referral-qr
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { sendSms } from '../../utils/comms.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { escHtml } from '../../utils/escape.js'
import { referralUrl, newReferralCode, referralLeadCounts } from '../../utils/publicLinks.js'

const COMMISSION_RATE = 5000 // บาทต่อคันที่ขายได้
const PAY_ROLES = ['finance', 'manager', 'owner', 'admin']

export default async function ReferralQrPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  const me = getState('user') || {}
  // เดิมพนักงานคนไหนก็กด "จ่าย Commission" ให้ผู้แนะนำเองได้เลย แก้ Rules ให้จำกัดจริงแล้ว
  // (เฉพาะการเงิน/ผู้จัดการ) ตรงนี้แค่ซ่อนปุ่มเป็นชั้นป้องกันซ้อน
  const canPay = PAY_ROLES.includes(getState('role') || me.role || 'staff')

  let REFERRERS = []
  let leadCounts = null
  let selId = null
  let loading = true

  async function loadData() {
    loading = true
    try { REFERRERS = await listDocs('referrers', companyScopeFilters(), 'sales', 'desc', 100) } catch (e) { REFERRERS = [] }
    // (v1.0.1172) ลิงก์จริงไปฟอร์มรับลีด (?ref=รหัส) — นับลีดที่เข้ามาจากลิงก์ของแต่ละคนจากลูกค้าจริง
    // (สิทธิ์อ่านลูกค้าไม่พอ = ไม่แสดงตัวเลข ไม่เดา)
    leadCounts = null
    try { leadCounts = referralLeadCounts(await listDocs('customers', [...companyScopeFilters(), ['source', '==', 'referral']], 'createdAt', 'desc', 1000)) } catch (e) { leadCounts = null }
    REFERRERS = REFERRERS.map(r => ({ ...r, qrUrl: referralUrl(r.code), leads: leadCounts ? (leadCounts[String(r.code || '').toUpperCase()] || 0) : (r.leads || 0) }))
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const totalSales = REFERRERS.reduce((s,r)=>s+r.sales,0)
    const totalComm  = REFERRERS.reduce((s,r)=>s+r.commission,0)
    const unpaid     = REFERRERS.reduce((s,r)=>s+(r.commission-r.paid),0)
    const sel = selId ? REFERRERS.find(r=>r.id===selId) : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔗 ลิงก์แนะนำเพื่อน</div>
            <div class="page-subtitle">ลิงก์ให้ลูกค้าเก่าส่งต่อเพื่อน · Commission ${formatCurrency(COMMISSION_RATE)}/คัน · ${REFERRERS.length} ผู้แนะนำ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-ref-btn">+ สร้างลิงก์ใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('👥 ผู้แนะนำ', REFERRERS.length+' คน', 'var(--primary)')}
          ${sc('🚗 ยอดขายจาก Ref', totalSales+' คัน', 'var(--success)')}
          ${sc('💰 Commission รวม', formatCurrency(totalComm), 'var(--text)')}
          ${sc('⏳ ค้างจ่าย', formatCurrency(unpaid), unpaid>0?'var(--danger)':'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:${sel?'repeat(auto-fit,minmax(min(300px,100%),1fr))':'1fr'};gap:16px">
          <!-- Referrer list -->
          <div style="display:flex;flex-direction:column;gap:10px">
            ${REFERRERS.map(r => referrerCard(r)).join('')}
          </div>

          <!-- Selected QR detail -->
          ${sel ? `
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🔗 ลิงก์ของ ${escHtml(sel.name)}</div>
              <div style="text-align:center;margin-bottom:8px">
                <div style="font-size:0.7rem;color:var(--text-muted)">รหัสผู้แนะนำ</div>
                <div style="font-size:1.6rem;font-weight:900;letter-spacing:0.08em;color:var(--primary)">${escHtml(sel.code)}</div>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px;line-height:1.5">เพื่อนที่เปิดลิงก์นี้จะเจอฟอร์มฝากชื่อ-เบอร์ ลีดเข้าระบบพร้อมรหัสนี้ทันที (ฟอร์มต้องเปิดรับอยู่)</div>
              <div style="font-size:0.7rem;text-align:center;color:var(--primary);margin-bottom:10px;overflow-wrap:anywhere">${escHtml(sel.qrUrl)}</div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-secondary" id="copy-link" style="flex:1;font-size:0.74rem">📋 คัดลอกลิงก์</button>
                <button class="btn btn-primary" id="print-qr" style="flex:1;font-size:0.74rem">🖨 พิมพ์การ์ด</button>
              </div>
            </div>

            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">📊 สถิติ</div>
              <div style="font-size:0.66rem;color:var(--text-muted);margin-bottom:10px">🧲 Leads นับจากลูกค้าที่กรอกฟอร์มผ่านลิงก์ของคนนี้จริง${leadCounts ? '' : ' (ตอนนี้อ่านข้อมูลลูกค้าไม่ได้ จึงแสดงตัวเลขที่บันทึกไว้)'}</div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:0.78rem">
                ${[['🧲 Leads',sel.leads],['🚗 ขายได้',sel.sales+' คัน'],['💰 Commission',formatCurrency(sel.commission)],['✅ จ่ายแล้ว',formatCurrency(sel.paid)],['⏳ ค้างจ่าย',formatCurrency(sel.commission-sel.paid)]].map(([k,v])=>`
                  <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                    <span style="color:var(--text-muted)">${k}</span>
                    <span style="font-weight:700">${v}</span>
                  </div>`).join('')}
              </div>
              ${sel.commission-sel.paid > 0 && canPay ? `
              <button class="btn btn-primary" id="pay-btn" style="width:100%;margin-top:10px;font-size:0.8rem">💸 จ่าย Commission ${formatCurrency(sel.commission-sel.paid)}</button>` : ''}
            </div>
          </div>` : ''}
        </div>
      </div>`

    document.getElementById('new-ref-btn')?.addEventListener('click', () => openNewModal())
    container.querySelectorAll('.ref-card').forEach(el => el.addEventListener('click', () => {
      selId = el.dataset.id === selId ? null : el.dataset.id; render()
    }))
    container.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation()
      const r = REFERRERS.find(x=>x.id===b.dataset.id)
      if (!r) return
      // เดิมอ้างว่าส่งทาง LINE แต่ไม่มีการส่งจริง — ผู้แนะนำมีเบอร์โทรเก็บไว้อยู่แล้ว แก้ให้ส่ง SMS จริง
      if (r.phone) {
        try {
          await sendSms([r.phone], `LAMOM: นี่คือลิงก์แนะนำเพื่อนของคุณ ${r.qrUrl} — แนะนำเพื่อนซื้อรถรับค่าคอมมิชชั่นทันที!`)
          showToast(`📤 ส่ง SMS ลิงก์ ${r.qrUrl} ให้ ${r.name} แล้ว`, 'success')
        } catch { showToast(`⚠️ ส่ง SMS ให้ ${r.name} ไม่สำเร็จ`, 'error') }
      } else {
        showToast(`⚠️ ${r.name} ไม่มีเบอร์โทรในระบบ — กรุณาส่งลิงก์เอง: ${r.qrUrl}`, 'error')
      }
    }))
    document.getElementById('copy-link')?.addEventListener('click', () => {
      const url = sel?.qrUrl || ''
      navigator.clipboard?.writeText(url)
        .then(() => showToast(`📋 คัดลอก ${url} แล้ว`, 'success'))
        .catch(() => showToast(`📋 Copy: ${url}`, 'success'))
    })
    document.getElementById('print-qr')?.addEventListener('click', () => {
      if (!sel) { showToast('เลือก Referrer ก่อน', 'warning'); return }
      const win = window.open('', '_blank', 'width=400,height=500')
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>แนะนำเพื่อน ${escHtml(sel.name)}</title><style>body{font-family:sans-serif;text-align:center;padding:30px}h2{margin:0 0 8px}p{color:#444;font-size:15px}.code{font-size:40px;font-weight:900;letter-spacing:4px;margin:18px 0}.url{font-size:13px;word-break:break-all;color:#1d4ed8}</style></head><body><h2>แนะนำเพื่อนซื้อรถ</h2><p>โดยคุณ ${escHtml(sel.name)}</p><div class="code">${escHtml(sel.code)}</div><p>ให้เพื่อนเปิดลิงก์นี้ ฝากชื่อและเบอร์ไว้</p><p class="url">${escHtml(sel.qrUrl)}</p><script>window.print()<\/script></body></html>`)
      win.document.close()
      showToast(`🖨 เปิดหน้าพิมพ์ของ ${sel.name} แล้ว`, 'success')
    })
    document.getElementById('pay-btn')?.addEventListener('click', () => {
      openModal({ title:'💸 จ่าย Commission', size:'xs',
        body:`<div style="font-size:0.8rem">
          <div style="margin-bottom:10px">จ่าย Commission <b>${sel?.name}</b></div>
          <div style="font-size:1.2rem;font-weight:900;color:var(--primary);margin-bottom:10px">${formatCurrency((sel?.commission||0)-(sel?.paid||0))}</div>
          <select class="input" style="width:100%"><option>โอนธนาคาร</option><option>พร้อมเพย์</option><option>เงินสด</option></select>
        </div>`,
        confirmText:'💸 ยืนยันจ่าย',
        async onConfirm() {
          if (!sel) return
          try {
            await updateDocData('referrers', sel.id, { paid: sel.commission })
            showToast(`💸 จ่าย Commission ${sel.name} แล้ว`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  function referrerCard(r) {
    const conv = r.leads > 0 ? Math.round(r.sales/r.leads*100) : 0
    const isSelected = r.id === selId
    return `
      <div class="card ref-card" data-id="${r.id}" style="padding:14px;cursor:pointer;border:2px solid ${isSelected?'var(--primary)':'transparent'};transition:border .2s">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div style="font-weight:700;font-size:0.86rem">${escHtml(r.name)}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(r.phone)} · Code: <code style="font-size:0.7rem">${escHtml(r.code)}</code></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.8rem;font-weight:700;color:var(--primary)">${formatCurrency(r.commission)}</div>
            ${r.commission-r.paid > 0 ? `<div style="font-size:0.62rem;color:var(--danger)">ค้าง ${formatCurrency(r.commission-r.paid)}</div>` : `<div style="font-size:0.62rem;color:var(--success)">✅ จ่ายครบ</div>`}
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;font-size:0.72rem;color:var(--text-muted)">
          <span>🧲 ${r.leads}</span><span>🚗 ${r.sales} คัน</span><span>🎯 Conv.${conv}%</span>
        </div>
        <div style="margin-top:8px">
          <button class="btn btn-xs btn-secondary share-btn" data-id="${r.id}" style="font-size:0.7rem">📤 ส่งลิงก์ทาง SMS</button>
        </div>
      </div>`
  }

  function openNewModal() {
    openModal({
      title:'+ สร้างลิงก์แนะนำเพื่อน', size:'xs',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อผู้แนะนำ</label><input class="input" id="rf-name" placeholder="ชื่อลูกค้า" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เบอร์โทร</label><input class="input" id="rf-phone" placeholder="08x-xxx-xxxx" style="width:100%;margin-top:4px"></div>
        <div style="font-size:0.7rem;color:var(--text-muted)">Commission: ${formatCurrency(COMMISSION_RATE)}/คัน · หมดอายุ 1 ปี</div>`,
      confirmText:'🔗 สร้างลิงก์',
      async onConfirm() {
        const name = document.getElementById('rf-name')?.value?.trim()
        const phone = document.getElementById('rf-phone')?.value?.trim()
        if (!name) { showToast('ใส่ชื่อ', 'warning'); return false }
        let code = newReferralCode()
        while (REFERRERS.some(r => r.code === code)) code = newReferralCode()
        try {
          const newId = await createDoc('referrers', { name, phone, code, qrUrl: referralUrl(code), clicks:0, leads:0, sales:0, commission:0, paid:0, createdAt: todayBangkok(), companyId: myEffectiveCompanyId() })
          selId = newId
          showToast(`🔗 สร้างลิงก์ของ ${name} แล้ว · Code: ${code}`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.2rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
