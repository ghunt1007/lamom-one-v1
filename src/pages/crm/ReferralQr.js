/**
 * Referral QR Generator — QR แนะนำเพื่อน ได้ Commission อัตโนมัติ
 * Route: /crm/referral-qr
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_REFERRERS = [
  { id:'RF001', name:'นภา มีสุข', phone:'081-234-5678', code:'NAPA001', qrUrl:'lamom.app/ref/NAPA001', clicks:28, leads:8, sales:3, commission:15000, paid:10000, createdAt:'2026-01-15' },
  { id:'RF002', name:'สมชาย วิเศษ', phone:'089-876-5432', code:'SOMC002', qrUrl:'lamom.app/ref/SOMC002', clicks:45, leads:12, sales:5, commission:25000, paid:25000, createdAt:'2026-01-20' },
  { id:'RF003', name:'มาลี จันทร์ดี', phone:'076-111-2222', code:'MALI003', qrUrl:'lamom.app/ref/MALI003', clicks:12, leads:3, sales:1, commission:5000, paid:0, createdAt:'2026-03-01' },
  { id:'RF004', name:'วิชัย รุ่งเรือง', phone:'095-555-6666', code:'WICH004', qrUrl:'lamom.app/ref/WICH004', clicks:8, leads:2, sales:0, commission:0, paid:0, createdAt:'2026-05-10' },
]

const COMMISSION_RATE = 5000 // บาทต่อคันที่ขายได้

export default async function ReferralQrPage(container) {
  const myGen = container.__routerGen
  let REFERRERS = DEMO_REFERRERS.map(r => ({ ...r }))
  let dataSource = 'demo'
  let selId = null

  try {
    const docs = await listDocs('referrers', [], 'sales', 'desc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `RF${String(i+1).padStart(3,'0')}`,
        name: d.name || d.referrerName || 'ผู้แนะนำ',
        phone: d.phone || '',
        code: d.code || d.referralCode || `REF${i+1}`,
        qrUrl: d.qrUrl || `lamom.app/ref/${d.code || `REF${i+1}`}`,
        clicks: d.clicks || 0,
        leads: d.leads || 0,
        sales: d.sales || d.referredSales || 0,
        commission: d.commission || (d.sales || 0) * COMMISSION_RATE,
        paid: d.paid || d.paidCommission || 0,
        createdAt: d.createdAt || d.date || '',
      }))
      REFERRERS = [...mapped, ...DEMO_REFERRERS]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const totalSales = REFERRERS.reduce((s,r)=>s+r.sales,0)
    const totalComm  = REFERRERS.reduce((s,r)=>s+r.commission,0)
    const unpaid     = REFERRERS.reduce((s,r)=>s+(r.commission-r.paid),0)
    const sel = selId ? REFERRERS.find(r=>r.id===selId) : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔗 Referral QR Generator</div>
            <div class="page-subtitle">QR แนะนำเพื่อน ✕ Commission ${formatCurrency(COMMISSION_RATE)}/คัน · ${REFERRERS.length} ผู้แนะนำ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-ref-btn">+ สร้าง QR ใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('👥 ผู้แนะนำ', REFERRERS.length+' คน', 'var(--primary)')}
          ${sc('🚗 ยอดขายจาก Ref', totalSales+' คัน', 'var(--success)')}
          ${sc('💰 Commission รวม', formatCurrency(totalComm), 'var(--text)')}
          ${sc('⏳ ค้างจ่าย', formatCurrency(unpaid), unpaid>0?'var(--danger)':'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:${sel?'1fr 320px':'1fr'};gap:16px">
          <!-- Referrer list -->
          <div style="display:flex;flex-direction:column;gap:10px">
            ${REFERRERS.map(r => referrerCard(r)).join('')}
          </div>

          <!-- Selected QR detail -->
          ${sel ? `
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📱 QR Code — ${escHtml(sel.name)}</div>
              <!-- QR mock -->
              <div style="aspect-ratio:1;max-width:180px;margin:0 auto 12px;background:var(--surface-2);border-radius:var(--radius-sm);display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px solid var(--primary)">
                <div style="font-size:3rem">📱</div>
                <div style="font-size:0.62rem;color:var(--text-muted);margin-top:4px;text-align:center">${escHtml(sel.code)}<br>SCAN TO REFER</div>
              </div>
              <div style="font-size:0.7rem;text-align:center;color:var(--primary);margin-bottom:10px">${escHtml(sel.qrUrl)}</div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-secondary" id="copy-link" style="flex:1;font-size:0.74rem">📋 Copy Link</button>
                <button class="btn btn-primary" id="print-qr" style="flex:1;font-size:0.74rem">🖨 พิมพ์</button>
              </div>
            </div>

            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 สถิติ</div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:0.78rem">
                ${[['👆 Clicks',sel.clicks],['🧲 Leads',sel.leads],['🚗 ขายได้',sel.sales+' คัน'],['💰 Commission',formatCurrency(sel.commission)],['✅ จ่ายแล้ว',formatCurrency(sel.paid)],['⏳ ค้างจ่าย',formatCurrency(sel.commission-sel.paid)]].map(([k,v])=>`
                  <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                    <span style="color:var(--text-muted)">${k}</span>
                    <span style="font-weight:700">${v}</span>
                  </div>`).join('')}
              </div>
              ${sel.commission-sel.paid > 0 ? `
              <button class="btn btn-primary" id="pay-btn" style="width:100%;margin-top:10px;font-size:0.8rem">💸 จ่าย Commission ${formatCurrency(sel.commission-sel.paid)}</button>` : ''}
            </div>
          </div>` : ''}
        </div>
      </div>`

    document.getElementById('new-ref-btn')?.addEventListener('click', () => openNewModal())
    container.querySelectorAll('.ref-card').forEach(el => el.addEventListener('click', () => {
      selId = el.dataset.id === selId ? null : el.dataset.id; render()
    }))
    container.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation()
      const r = REFERRERS.find(x=>x.id===b.dataset.id)
      if (r) showToast(`📤 ส่งลิงก์ ${r.qrUrl} ให้ ${r.name} ทาง LINE แล้ว`, 'success')
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
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR ${escHtml(sel.name)}</title><style>body{font-family:sans-serif;text-align:center;padding:30px}h2{margin:0 0 8px}p{color:#666;font-size:14px}</style></head><body><h2>${escHtml(sel.name)}</h2><p>Referral QR Code</p><p style="font-size:20px;margin:20px">▩▦▩<br>▦▩▦<br>▩▦▩</p><p>${escHtml(sel.qrUrl)}</p><script>window.print()</script></body></html>`)
      win.document.close()
      showToast(`🖨 พิมพ์ QR ของ ${sel.name} แล้ว`, 'success')
    })
    document.getElementById('pay-btn')?.addEventListener('click', () => {
      openModal({ title:'💸 จ่าย Commission', size:'xs',
        body:`<div style="font-size:0.8rem">
          <div style="margin-bottom:10px">จ่าย Commission <b>${sel?.name}</b></div>
          <div style="font-size:1.2rem;font-weight:900;color:var(--primary);margin-bottom:10px">${formatCurrency((sel?.commission||0)-(sel?.paid||0))}</div>
          <select class="input" style="width:100%"><option>โอนธนาคาร</option><option>พร้อมเพย์</option><option>เงินสด</option></select>
        </div>`,
        confirmText:'💸 ยืนยันจ่าย',
        onConfirm() {
          if (sel) { sel.paid = sel.commission; render(); showToast(`💸 จ่าย Commission ${sel.name} แล้ว`, 'success') }
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
          <span>👆 ${r.clicks}</span><span>🧲 ${r.leads}</span><span>🚗 ${r.sales} คัน</span><span>🎯 Conv.${conv}%</span>
        </div>
        <div style="margin-top:8px">
          <button class="btn btn-xs btn-secondary share-btn" data-id="${r.id}" style="font-size:0.7rem">📤 ส่ง QR ทาง LINE</button>
        </div>
      </div>`
  }

  function openNewModal() {
    openModal({
      title:'+ สร้าง Referral QR', size:'xs',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อผู้แนะนำ</label><input class="input" id="rf-name" placeholder="ชื่อลูกค้า" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เบอร์โทร</label><input class="input" id="rf-phone" placeholder="08x-xxx-xxxx" style="width:100%;margin-top:4px"></div>
        <div style="font-size:0.7rem;color:var(--text-muted)">Commission: ${formatCurrency(COMMISSION_RATE)}/คัน · หมดอายุ 1 ปี</div>`,
      confirmText:'🔗 สร้าง QR',
      onConfirm() {
        const name = document.getElementById('rf-name')?.value?.trim()
        const phone = document.getElementById('rf-phone')?.value?.trim()
        if (!name) { showToast('ใส่ชื่อ', 'warning'); return false }
        const code = name.replace(/\s/g,'').toUpperCase().slice(0,4)+(REFERRERS.length+1).toString().padStart(3,'0')
        REFERRERS.unshift({ id:'RF'+Date.now(), name, phone, code, qrUrl:`lamom.app/ref/${code}`, clicks:0, leads:0, sales:0, commission:0, paid:0, createdAt:'2026-06-14' })
        selId = REFERRERS[0].id; render(); showToast(`🔗 สร้าง QR ของ ${name} แล้ว · Code: ${code}`, 'success')
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
