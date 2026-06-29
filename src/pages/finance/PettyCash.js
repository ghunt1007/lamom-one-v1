/**
 * Petty Cash — เงินสดย่อย
 * Route: /finance/petty-cash
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const PC_CATS = {
  supplies: { label: 'ของใช้สำนักงาน', icon: '📎' },
  refresh:  { label: 'น้ำ/กาแฟ/ขนมรับแขก', icon: '☕' },
  transport:{ label: 'เดินทาง/น้ำมัน', icon: '⛽' },
  postage:  { label: 'ไปรษณีย์/เอกสาร', icon: '📮' },
  repair:   { label: 'ซ่อมเล็กน้อย', icon: '🔨' },
  other:    { label: 'อื่นๆ', icon: '📌' },
}

const FLOAT_AMOUNT = 20000 // วงเงินตั้งต้น

const DEMO_TRANSACTIONS = [
  { id: 'PT001', type: 'out', cat: 'refresh', amount: 850, desc: 'กาแฟ+ขนมรับลูกค้า (Makro)', by: 'สุดา มาดี', time: addHours(3), receipt: true },
  { id: 'PT002', type: 'out', cat: 'transport', amount: 500, desc: 'ค่าน้ำมันรถรับ-ส่งเอกสารขนส่ง', by: 'สมบัติ ขับดี', time: addHours(8), receipt: true },
  { id: 'PT003', type: 'out', cat: 'supplies', amount: 1240, desc: 'กระดาษ A4 + หมึกพิมพ์', by: 'Admin', time: addHours(26), receipt: true },
  { id: 'PT004', type: 'out', cat: 'postage', amount: 120, desc: 'EMS ส่งเล่มทะเบียนให้ลูกค้า', by: 'Admin', time: addHours(30), receipt: false },
  { id: 'PT005', type: 'in', cat: 'other', amount: 10000, desc: 'เติมเงินสดย่อย (เบิกจากบัญชีหลัก)', by: 'สมศรี การเงิน', time: addHours(72), receipt: true },
  { id: 'PT006', type: 'out', cat: 'repair', amount: 350, desc: 'เปลี่ยนหลอดไฟห้องน้ำลูกค้า', by: 'มานะ ขยัน', time: addHours(96), receipt: true },
]

export default async function PettyCashPage(container) {
  const myGen = container.__routerGen
  let txns = DEMO_TRANSACTIONS.map(t => ({ ...t }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('petty_cash', [], 'time', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `PT${String(i+1).padStart(3,'0')}`,
        type: d.type || (d.amount > 0 ? 'out' : 'in'),
        cat: d.cat || d.category || 'other',
        amount: Math.abs(d.amount || 0),
        desc: d.desc || d.description || d.title || '',
        by: d.by || d.staffName || '',
        time: d.time || d.createdAt || new Date().toISOString(),
        receipt: d.receipt !== undefined ? d.receipt : false,
      }))
      txns = [...mapped, ...DEMO_TRANSACTIONS]
      dataSource = 'live'
    }
  } catch {}

  function balance() {
    return FLOAT_AMOUNT + txns.reduce((a, t) => a + (t.type === 'in' ? t.amount : -t.amount), 0) - 10000
  }

  function renderPage() {
    const bal = balance()
    const spentMonth = txns.filter(t => t.type === 'out').reduce((a, t) => a + t.amount, 0)
    const noReceipt = txns.filter(t => t.type === 'out' && !t.receipt).length
    const lowBalance = bal < FLOAT_AMOUNT * 0.25
    const sorted = [...txns].sort((a, b) => b.time.localeCompare(a.time))

    // spending by category
    const byCat = Object.keys(PC_CATS).map(k => ({
      cat: k, total: txns.filter(t => t.type === 'out' && t.cat === k).reduce((a, t) => a + t.amount, 0)
    })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
    const maxCat = Math.max(...byCat.map(c => c.total), 1)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💵 Petty Cash</div>
            <div class="page-subtitle">เงินสดย่อย — วงเงิน ${formatCurrency(FLOAT_AMOUNT)}${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="refill-btn">💰 เติมเงิน</button>
            <button class="btn btn-primary" id="add-txn-btn">+ จ่ายเงิน</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💵 คงเหลือ', formatCurrency(bal), lowBalance ? 'danger' : 'success')}
          ${kpi('📉 ใช้ไปเดือนนี้', formatCurrency(spentMonth), 'warning')}
          ${kpi('🧾 ไม่มีใบเสร็จ', noReceipt + ' รายการ', noReceipt > 0 ? 'danger' : 'success')}
          ${kpi('📋 รายการ', txns.length, 'secondary')}
        </div>

        ${lowBalance ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⚠️ <strong>เงินสดย่อยเหลือน้อย</strong> (${formatCurrency(bal)}) — ควรเบิกเติมจากบัญชีหลัก
          </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <!-- Transactions -->
          <div style="display:flex;flex-direction:column;gap:8px">
            ${sorted.map(t => {
              const pc = PC_CATS[t.cat]
              const isIn = t.type === 'in'
              return `<div class="card" style="padding:11px 14px;display:flex;justify-content:space-between;align-items:center;border-left:3px solid var(--${isIn?'success':'border'})">
                <div>
                  <div style="font-size:0.82rem;font-weight:600">${pc?.icon} ${escHtml(t.desc)}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${escHtml(t.by)} · ${timeAgo(t.time)} ${t.receipt ? '· 🧾 มีใบเสร็จ' : '· <span style="color:var(--danger)">❗ ไม่มีใบเสร็จ</span>'}</div>
                </div>
                <div style="font-weight:700;font-size:0.88rem;color:var(--${isIn?'success':'danger'})">${isIn?'+':'−'}${formatCurrency(t.amount)}</div>
              </div>`
            }).join('')}
          </div>

          <!-- By category -->
          <div class="card" style="padding:14px;height:fit-content">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 ใช้จ่ายแยกหมวด</div>
            ${byCat.map(c => {
              const pc = PC_CATS[c.cat]
              const pct = Math.round(c.total / maxCat * 100)
              return `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
                  <span>${pc?.icon} ${pc?.label}</span><strong>${formatCurrency(c.total)}</strong>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:7px">
                  <div style="width:${pct}%;background:var(--warning);height:7px;border-radius:3px"></div>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>
      </div>
    `

    document.getElementById('add-txn-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ จ่ายเงินสดย่อย',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">รายการ *</label><input class="input" id="pt-desc"></div>
          <div class="input-group"><label class="input-label">หมวด</label>
            <select class="input" id="pt-cat">${Object.entries(PC_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">จำนวนเงิน (บาท) *</label><input class="input" type="number" id="pt-amount"></div>
          <div class="input-group"><label class="input-label">ผู้เบิก</label><input class="input" id="pt-by"></div>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer">
            <input type="checkbox" id="pt-receipt" checked style="accent-color:var(--primary)"> มีใบเสร็จ
          </label>
        </div>`,
        onConfirm() {
          const desc = document.getElementById('pt-desc')?.value?.trim()
          const amount = parseInt(document.getElementById('pt-amount')?.value) || 0
          if (!desc || amount <= 0) { showToast('❗ กรอกรายการและจำนวนเงิน', 'error'); return }
          if (amount > balance()) { showToast('❗ เงินสดย่อยไม่พอ', 'error'); return }
          txns.unshift({ id:`PT${String(txns.length+1).padStart(3,'0')}`, type:'out', cat:document.getElementById('pt-cat')?.value||'other', amount, desc, by:document.getElementById('pt-by')?.value||'—', time:new Date().toISOString(), receipt:document.getElementById('pt-receipt')?.checked||false })
          showToast(`✅ จ่าย ${formatCurrency(amount)} แล้ว`, 'success'); renderPage()
        }
      })
    })
    document.getElementById('refill-btn')?.addEventListener('click', () => {
      const need = FLOAT_AMOUNT - balance()
      openModal({
        title: '💰 เติมเงินสดย่อย',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="font-size:0.8rem">คงเหลือ: <strong>${formatCurrency(balance())}</strong> / วงเงิน ${formatCurrency(FLOAT_AMOUNT)}</div>
          <div class="input-group"><label class="input-label">จำนวนที่เติม</label><input class="input" type="number" id="rf-amount" value="${Math.max(need, 0)}"></div>
        </div>`,
        onConfirm() {
          const amount = parseInt(document.getElementById('rf-amount')?.value) || 0
          if (amount <= 0) return
          txns.unshift({ id:`PT${String(txns.length+1).padStart(3,'0')}`, type:'in', cat:'other', amount, desc:'เติมเงินสดย่อย (เบิกจากบัญชีหลัก)', by:'การเงิน', time:new Date().toISOString(), receipt:true })
          showToast(`💰 เติม ${formatCurrency(amount)} แล้ว`, 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
