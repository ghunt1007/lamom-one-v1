/**
 * Bank Reconciliation — กระทบยอดธนาคาร
 * Route: /finance/bank-recon
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// เดิม "บัญชีในระบบ" ผูกกับ DEMO_BOOK_ENTRIES ตายตัว 6 รายการ ไม่เคยเชื่อมกับ invoices/purchase_orders จริง
// เลยสักครั้ง — เปลี่ยนมาดึงจริงจาก 2 collection นี้แทน: invoices (type:'invoice', status ยังไม่ 'paid'/'cancelled'
// → เงินเข้า/บวก) และ purchase_orders (status:'received', ยังไม่จ่าย → เงินออก/ลบ) ใช้เฉพาะตอนมีข้อมูลจริง
// เท่านั้น ถ้าไม่มีทั้งสอง collection เลยค่อย fallback ไปใช้ตัวอย่างเดิมเพื่อไม่ให้หน้าว่างเปล่าตอนยังไม่มีข้อมูล
const DEMO_BOOK_ENTRIES = [
  { id: 'IV001', desc: 'Invoice — สมชาย ใจดี (BYD Dolphin)', amount: 1299000 },
  { id: 'IV002', desc: 'Invoice — มาลี สุขใจ (ค่าซ่อม)', amount: 28500 },
  { id: 'IV003', desc: 'Invoice — ธนพล เที่ยงตรง (ค่าซ่อม)', amount: 8900 },
  { id: 'IV004', desc: 'Invoice — อรทัย ตั้งใจ (อะไหล่)', amount: 12400 },
  { id: 'PO001', desc: 'PO — BYD Auto (รถ 8 คัน)', amount: -8990000 },
  { id: 'PAY-06', desc: 'เงินเดือน มิ.ย.', amount: -680000 },
]

// แปลง invoices/purchase_orders จริงให้อยู่ในรูปแบบเดียวกับ DEMO_BOOK_ENTRIES (id, desc, amount)
async function loadRealBookEntries() {
  const entries = []
  try {
    const invoices = await listDocs('invoices', companyScopeFilters(), 'date', 'desc', 300)
    invoices
      .filter(i => i.type === 'invoice' && i.status !== 'paid' && i.status !== 'cancelled')
      .forEach(i => {
        const total = (i.items || []).reduce((a, x) => a + (x.qty || 0) * (x.price || 0) * (1 + (x.vat || 0) / 100), 0)
        entries.push({ id: i.id, desc: `Invoice ${i.no || ''} — ${i.custName || 'ลูกค้า'}`, amount: Math.round(total) })
      })
  } catch (e) {}
  try {
    const pos = await listAllDocsSafe()
    pos
      .filter(p => p.status === 'received' && p.amount > 0)
      .forEach(p => entries.push({ id: p.id, desc: `PO — ${p.supplier || 'ผู้จัดหา'} (${p.title || ''})`, amount: -Math.round(p.amount) }))
  } catch (e) {}
  return entries
}

async function listAllDocsSafe() {
  try { return await listDocs('purchase_orders', companyScopeFilters(), 'requestDate', 'desc', 300) } catch (e) { return [] }
}

export default async function BankReconciliationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let txns = []
  let bookEntries = DEMO_BOOK_ENTRIES
  let bookSource = 'demo'
  let loading = true

  async function loadData() {
    loading = true
    try { txns = await listDocs('bank_transactions', companyScopeFilters(), 'date', 'desc', 200) } catch (e) { txns = [] }
    try {
      const real = await loadRealBookEntries()
      if (container.__routerGen !== myGen) return
      if (real.length) { bookEntries = real; bookSource = 'live' }
      else { bookEntries = DEMO_BOOK_ENTRIES; bookSource = 'demo' }
    } catch (e) { bookEntries = DEMO_BOOK_ENTRIES; bookSource = 'demo' }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const unmatched = txns.filter(t => !t.matched)
    const matchedAmt = txns.filter(t => t.matched).reduce((a, t) => a + Math.abs(t.amount), 0)
    const unmatchedBooks = bookEntries.filter(b => !txns.some(t => t.matched === b.id))
    const reconPct = Math.round(txns.filter(t => t.matched).length / txns.length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Bank Reconciliation</div>
            <div class="page-subtitle">กระทบยอดธนาคาร vs บัญชีในระบบ
              ${bookSource === 'live' ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● บัญชีในระบบจาก invoices/purchase_orders จริง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">ตัวอย่าง (ยังไม่มี invoice/PO ค้างจริง)</span>'}
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="import-btn">📥 Import Statement</button>
            <button class="btn btn-primary" id="auto-match-btn">🤖 Auto-Match</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📊 Matched', reconPct + '%', reconPct === 100 ? 'success' : 'warning')}
          ${kpi('💰 ยอดกระทบแล้ว', formatCurrency(matchedAmt), 'primary')}
          ${kpi('❓ รายการธนาคารค้าง', unmatched.length, unmatched.length > 0 ? 'danger' : 'success')}
          ${kpi('📋 Invoice ยังไม่เจอเงิน', unmatchedBooks.length, unmatchedBooks.length > 0 ? 'warning' : 'success')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <!-- Bank transactions -->
          <div>
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🏦 รายการธนาคาร (Statement)</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${txns.map(t => `
                <div class="card" style="padding:10px 12px;border-left:3px solid var(--${t.matched?'success':'danger'})">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-size:0.78rem;font-weight:600">${escHtml(t.desc)}</div>
                      <div style="font-size:0.65rem;color:var(--text-muted)">${formatDate(t.date)} ${t.matched ? '· ✅ จับคู่: ' + escHtml(t.matched) : ''}</div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-weight:700;font-size:0.82rem;color:var(--${t.amount>=0?'success':'danger'})">${t.amount>=0?'+':''}${formatCurrency(t.amount)}</div>
                      ${!t.matched ? `<button class="btn btn-xs btn-warning match-btn" data-id="${escHtml(t.id)}" style="margin-top:3px">🔗 จับคู่</button>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Book entries -->
          <div>
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📒 บัญชีในระบบ (รอจับคู่)</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${unmatchedBooks.map(b => `
                <div class="card" style="padding:10px 12px;border-left:3px solid var(--warning)">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-size:0.78rem;font-weight:600">${escHtml(b.desc)}</div>
                      <div style="font-size:0.65rem;color:var(--text-muted)">${escHtml(b.id)}</div>
                    </div>
                    <div style="font-weight:700;font-size:0.82rem;color:var(--${b.amount>=0?'success':'danger'})">${b.amount>=0?'+':''}${formatCurrency(b.amount)}</div>
                  </div>
                </div>
              `).join('') || '<div style="padding:14px;text-align:center;color:var(--success);font-size:0.8rem">✅ จับคู่ครบทุกรายการ</div>'}
            </div>
            ${unmatched.length > 0 && bookSource === 'demo' ? `
              <div style="margin-top:12px;padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.72rem;color:var(--text-muted)">
                💡 "เงินโอนเข้าไม่ระบุชื่อ ฿12,400" ตรงกับ IV004 (อรทัย — อะไหล่) — กด Auto-Match เพื่อจับคู่ตามจำนวนเงิน
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `

    document.getElementById('auto-match-btn')?.addEventListener('click', async () => {
      const toMatch = []
      txns.filter(t => !t.matched).forEach(t => {
        const candidate = bookEntries.find(b => b.amount === t.amount && !txns.some(x => x.matched === b.id) && !toMatch.some(x => x.matchId === b.id))
        if (candidate) toMatch.push({ txnId: t.id, matchId: candidate.id })
      })
      if (!toMatch.length) { showToast('🤖 ไม่พบรายการที่จับคู่ได้เพิ่ม', 'secondary'); return }
      try {
        for (const m of toMatch) await updateDocData('bank_transactions', m.txnId, { matched: m.matchId })
        showToast(`🤖 Auto-Match จับคู่ได้ ${toMatch.length} รายการ!`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    container.querySelectorAll('.match-btn').forEach(b => b.addEventListener('click', () => {
      const t = txns.find(x => x.id === b.dataset.id)
      if (t) openModal({
        title: '🔗 จับคู่: ' + escHtml(t.desc),
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">เลือกรายการบัญชี</label>
          <select class="input" id="mt-book">
            <option value="">— ไม่จับคู่ (บันทึกเป็นรายการอื่น) —</option>
            ${bookEntries.filter(bk => !txns.some(x => x.matched === bk.id)).map(bk => `<option value="${escHtml(bk.id)}" ${bk.amount===t.amount?'selected':''}>${escHtml(bk.id)} — ${escHtml(bk.desc)} (${formatCurrency(bk.amount)})</option>`).join('')}
          </select></div>`,
        async onConfirm() {
          const id = document.getElementById('mt-book')?.value
          try {
            await updateDocData('bank_transactions', t.id, { matched: id || 'MISC' })
            showToast(id ? '🔗 จับคู่แล้ว' : '📝 บันทึกเป็นรายการอื่น (ค่าธรรมเนียม/ปรับปรุง)', id ? 'success' : 'primary')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    document.getElementById('import-btn')?.addEventListener('click', () => {
      openModal({
        title: '📥 Import Bank Statement',
        size: 'sm',
        body: `
          <div style="font-size:0.82rem;display:flex;flex-direction:column;gap:12px">
            <div style="background:var(--surface-2);border-radius:8px;padding:10px;font-size:0.74rem;color:var(--text-muted)">
              รองรับ CSV จาก K-Bank, SCB, BBL, KTB<br>
              <span style="color:var(--primary)">Format: Date, Description, Amount, Balance</span>
            </div>
            <div><label class="input-label">เลือกไฟล์ Statement</label>
              <input type="file" id="stmt-file" class="input" accept=".csv,.xls,.xlsx" style="padding:6px"></div>
            <div><label class="input-label">ธนาคาร</label>
              <select id="stmt-bank" class="input">
                <option>K-Bank (กสิกร)</option><option>SCB (ไทยพาณิชย์)</option>
                <option>BBL (กรุงเทพ)</option><option>KTB (กรุงไทย)</option>
              </select>
            </div>
          </div>
        `,
        confirmText: '📥 Import',
        // เดิมไม่อ่านไฟล์ที่อัปโหลดเลย สร้างแค่ 1 แถวปลอม amount:0 ป้ายกำกับ "(Demo)" แล้ว toast ว่าสำเร็จ
        // ผู้ใช้เข้าใจผิดว่า Import จริง แก้ให้อ่านไฟล์ CSV จริง (comma-split ธรรมดา ตามคอลัมน์ Date, Description,
        // Amount, Balance ที่บอกไว้ในฟอร์ม) แล้วสร้างเอกสาร bank_transactions จริงทีละแถว — ไม่รองรับ .xls/.xlsx
        // ไฟล์ไบนารีจริง (ต้อง parser เฉพาะทาง เกินขอบเขตที่นี่) ถ้าอัปโหลดไฟล์ที่ parse เป็นแถวไม่ได้เลยจะแจ้ง error
        async onConfirm() {
          const file = document.getElementById('stmt-file')?.files[0]
          if (!file) { showToast('กรุณาเลือกไฟล์ก่อน', 'error'); return false }
          let text
          try {
            text = await file.text()
          } catch (e) { showToast('อ่านไฟล์ไม่สำเร็จ', 'error'); return false }
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
          if (!lines.length) { showToast('ไฟล์ว่างเปล่า', 'error'); return false }
          // แถวแรกถ้าเป็น header (คอลัมน์แรกไม่ใช่ตัวเลข/วันที่) ให้ข้าม
          const firstCols = lines[0].split(',')
          const startIdx = isNaN(Date.parse(firstCols[0])) ? 1 : 0
          const rows = []
          for (let i = startIdx; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim())
            if (cols.length < 3) continue
            const [dateStr, desc, amountStr] = cols
            const parsedDate = new Date(dateStr)
            const amount = parseFloat((amountStr || '0').replace(/[^0-9.\-]/g, ''))
            if (isNaN(parsedDate.getTime()) || isNaN(amount)) continue
            rows.push({
              date: parsedDate.toISOString().slice(0, 10),
              desc: desc || `[Import] ${file.name}`,
              amount,
              matched: null,
              type: amount >= 0 ? 'in' : 'out',
              companyId: myEffectiveCompanyId(),
            })
          }
          if (!rows.length) { showToast('❗ ไม่พบแถวข้อมูลที่ถูกต้องในไฟล์ (ต้องเป็น CSV คอลัมน์ Date, Description, Amount)', 'error'); return false }
          try {
            for (const r of rows) await createDoc('bank_transactions', r)
            showToast(`📥 Import ${file.name} สำเร็จ — เพิ่ม ${rows.length} รายการ`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
