/**
 * Petty Cash — เงินสดย่อย
 * Route: /finance/petty-cash
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PC_CATS = {
  supplies: { label: 'ของใช้สำนักงาน', icon: '📎' },
  refresh:  { label: 'น้ำ/กาแฟ/ขนมรับแขก', icon: '☕' },
  transport:{ label: 'เดินทาง/น้ำมัน', icon: '⛽' },
  postage:  { label: 'ไปรษณีย์/เอกสาร', icon: '📮' },
  repair:   { label: 'ซ่อมเล็กน้อย', icon: '🔨' },
  other:    { label: 'อื่นๆ', icon: '📌' },
}

const FLOAT_AMOUNT = 20000 // วงเงินตั้งต้น

export default async function PettyCashPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let txns = []
  let loading = true

  async function loadData() {
    loading = true
    try { txns = await listDocs('petty_cash', [], 'time', 'desc', 500) } catch (e) { txns = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function balance() {
    const settled = txns.filter(t => t.status !== 'pending' && t.status !== 'rejected')
    return FLOAT_AMOUNT + settled.reduce((a, t) => a + (t.type === 'in' ? t.amount : -t.amount), 0) - 10000
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const bal = balance()
    const settled = txns.filter(t => t.status !== 'pending' && t.status !== 'rejected')
    const pending = txns.filter(t => t.status === 'pending')
    const spentMonth = settled.filter(t => t.type === 'out').reduce((a, t) => a + t.amount, 0)
    const noReceipt = settled.filter(t => t.type === 'out' && !t.receipt).length
    const lowBalance = bal < FLOAT_AMOUNT * 0.25
    const sorted = [...settled].sort((a, b) => b.time.localeCompare(a.time))

    // spending by category
    const byCat = Object.keys(PC_CATS).map(k => ({
      cat: k, total: settled.filter(t => t.type === 'out' && t.cat === k).reduce((a, t) => a + t.amount, 0)
    })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
    const maxCat = Math.max(...byCat.map(c => c.total), 1)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💵 Petty Cash</div>
            <div class="page-subtitle">เงินสดย่อย — วงเงิน ${formatCurrency(FLOAT_AMOUNT)}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="refill-btn">💰 เติมเงิน</button>
            <button class="btn btn-primary" id="add-txn-btn">+ ขอเบิกเงิน</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💵 คงเหลือ', formatCurrency(bal), lowBalance ? 'danger' : 'success')}
          ${kpi('📉 ใช้ไปเดือนนี้', formatCurrency(spentMonth), 'warning')}
          ${kpi('🧾 ไม่มีใบเสร็จ', noReceipt + ' รายการ', noReceipt > 0 ? 'danger' : 'success')}
          ${kpi('⏳ รออนุมัติ', pending.length, pending.length > 0 ? 'warning' : 'secondary')}
        </div>

        ${lowBalance ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⚠️ <strong>เงินสดย่อยเหลือน้อย</strong> (${formatCurrency(bal)}) — ควรเบิกเติมจากบัญชีหลัก
          </div>
        ` : ''}

        ${pending.length ? `
        <div class="card" style="padding:14px;margin-bottom:12px;border:1px solid var(--warning)">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">⏳ รายการรออนุมัติ (${pending.length})</div>
          ${pending.map(t => {
            const pc = PC_CATS[t.cat]
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-size:0.8rem;font-weight:600">${pc?.icon} ${escHtml(t.desc)}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">${escHtml(t.by)} · ${timeAgo(t.time)} · ${formatCurrency(t.amount)}</div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-xs btn-success approve-btn" data-id="${t.id}">✓ อนุมัติ</button>
                <button class="btn btn-xs btn-danger reject-btn" data-id="${t.id}">✕ ปฏิเสธ</button>
              </div>
            </div>`
          }).join('')}
        </div>` : ''}

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
        title: '+ ขอเบิกเงินสดย่อย',
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
        confirmText: '📝 ส่งขออนุมัติ',
        async onConfirm() {
          const desc = document.getElementById('pt-desc')?.value?.trim()
          const amount = parseInt(document.getElementById('pt-amount')?.value) || 0
          if (!desc || amount <= 0) { showToast('❗ กรอกรายการและจำนวนเงิน', 'error'); return false }
          if (amount > balance()) { showToast('❗ เงินสดย่อยไม่พอ', 'error'); return false }
          try {
            await createDoc('petty_cash', { type:'out', cat:document.getElementById('pt-cat')?.value||'other', amount, desc, by:document.getElementById('pt-by')?.value||'—', time:new Date().toISOString(), receipt:document.getElementById('pt-receipt')?.checked||false, status:'pending' })
            showToast(`📝 ส่งคำขอเบิก ${formatCurrency(amount)} รออนุมัติแล้ว`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
        async onConfirm() {
          const amount = parseInt(document.getElementById('rf-amount')?.value) || 0
          if (amount <= 0) return false
          try {
            await createDoc('petty_cash', { type:'in', cat:'other', amount, desc:'เติมเงินสดย่อย (เบิกจากบัญชีหลัก)', by:'การเงิน', time:new Date().toISOString(), receipt:true, status:'approved' })
            showToast(`💰 เติม ${formatCurrency(amount)} แล้ว`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', async () => {
      try {
        await updateDocData('petty_cash', b.dataset.id, { status: 'approved' })
        showToast('✓ อนุมัติแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', async () => {
      try {
        await updateDocData('petty_cash', b.dataset.id, { status: 'rejected' })
        showToast('✕ ปฏิเสธคำขอแล้ว', 'warning')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
