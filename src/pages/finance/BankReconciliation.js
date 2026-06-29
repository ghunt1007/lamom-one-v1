/**
 * Bank Reconciliation — กระทบยอดธนาคาร
 * Route: /finance/bank-recon
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DEMO_BANK_TXNS = [
  { id: 'BT001', date: addDays(-1), desc: 'TRF จาก สมชาย ใจดี', amount: 1299000, matched: 'IV001', type: 'in' },
  { id: 'BT002', date: addDays(-1), desc: 'TRF จาก มาลี สุขใจ', amount: 28500, matched: 'IV002', type: 'in' },
  { id: 'BT003', date: addDays(-2), desc: 'เงินโอนเข้า ไม่ระบุชื่อ', amount: 12400, matched: null, type: 'in' },
  { id: 'BT004', date: addDays(-2), desc: 'จ่าย BYD Auto Thailand', amount: -8990000, matched: 'PO001', type: 'out' },
  { id: 'BT005', date: addDays(-3), desc: 'จ่ายเงินเดือน (Batch)', amount: -680000, matched: 'PAY-06', type: 'out' },
  { id: 'BT006', date: addDays(-3), desc: 'ค่าธรรมเนียมธนาคาร', amount: -350, matched: null, type: 'out' },
  { id: 'BT007', date: addDays(-4), desc: 'TRF เข้า 086-xxx-1122', amount: 8900, matched: null, type: 'in' },
]

const DEMO_BOOK_ENTRIES = [
  { id: 'IV001', desc: 'Invoice — สมชาย ใจดี (BYD Dolphin)', amount: 1299000 },
  { id: 'IV002', desc: 'Invoice — มาลี สุขใจ (ค่าซ่อม)', amount: 28500 },
  { id: 'IV003', desc: 'Invoice — ธนพล เที่ยงตรง (ค่าซ่อม)', amount: 8900 },
  { id: 'IV004', desc: 'Invoice — อรทัย ตั้งใจ (อะไหล่)', amount: 12400 },
  { id: 'PO001', desc: 'PO — BYD Auto (รถ 8 คัน)', amount: -8990000 },
  { id: 'PAY-06', desc: 'เงินเดือน มิ.ย.', amount: -680000 },
]

export default async function BankReconciliationPage(container) {
  const myGen = container.__routerGen
  let txns = DEMO_BANK_TXNS.map(t => ({ ...t }))
  let bookEntries = DEMO_BOOK_ENTRIES.map(b => ({ ...b }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('bank_transactions', [], 'date', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `BT${String(i+1).padStart(3,'0')}`,
        date: d.date || d.createdAt?.slice(0,10) || '',
        desc: d.desc || d.description || d.reference || '',
        amount: d.amount || 0,
        matched: d.matched || null,
        type: d.type || (d.amount > 0 ? 'in' : 'out'),
      }))
      txns = [...mapped, ...DEMO_BANK_TXNS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const unmatched = txns.filter(t => !t.matched)
    const matchedAmt = txns.filter(t => t.matched).reduce((a, t) => a + Math.abs(t.amount), 0)
    const unmatchedBooks = bookEntries.filter(b => !txns.some(t => t.matched === b.id))
    const reconPct = Math.round(txns.filter(t => t.matched).length / txns.length * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Bank Reconciliation</div>
            <div class="page-subtitle">กระทบยอดธนาคาร vs บัญชีในระบบ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
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
            ${unmatched.length > 0 ? `
              <div style="margin-top:12px;padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.72rem;color:var(--text-muted)">
                💡 "เงินโอนเข้าไม่ระบุชื่อ ฿12,400" ตรงกับ IV004 (อรทัย — อะไหล่) — กด Auto-Match เพื่อจับคู่ตามจำนวนเงิน
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `

    document.getElementById('auto-match-btn')?.addEventListener('click', () => {
      let matched = 0
      txns.filter(t => !t.matched).forEach(t => {
        const candidate = DEMO_BOOK_ENTRIES.find(b => b.amount === t.amount && !txns.some(x => x.matched === b.id))
        if (candidate) { t.matched = candidate.id; matched++ }
      })
      showToast(matched > 0 ? `🤖 Auto-Match จับคู่ได้ ${matched} รายการ!` : '🤖 ไม่พบรายการที่จับคู่ได้เพิ่ม', matched > 0 ? 'success' : 'secondary')
      renderPage()
    })
    container.querySelectorAll('.match-btn').forEach(b => b.addEventListener('click', () => {
      const t = txns.find(x => x.id === b.dataset.id)
      if (t) openModal({
        title: '🔗 จับคู่: ' + escHtml(t.desc),
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">เลือกรายการบัญชี</label>
          <select class="input" id="mt-book">
            <option value="">— ไม่จับคู่ (บันทึกเป็นรายการอื่น) —</option>
            ${DEMO_BOOK_ENTRIES.filter(bk => !txns.some(x => x.matched === bk.id)).map(bk => `<option value="${escHtml(bk.id)}" ${bk.amount===t.amount?'selected':''}>${escHtml(bk.id)} — ${escHtml(bk.desc)} (${formatCurrency(bk.amount)})</option>`).join('')}
          </select></div>`,
        onConfirm() {
          const id = document.getElementById('mt-book')?.value
          if (id) { t.matched = id; showToast('🔗 จับคู่แล้ว', 'success') }
          else { t.matched = 'MISC'; showToast('📝 บันทึกเป็นรายการอื่น (ค่าธรรมเนียม/ปรับปรุง)', 'primary') }
          renderPage()
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
        onConfirm() {
          const file = document.getElementById('stmt-file')?.files[0]
          if (!file) { showToast('กรุณาเลือกไฟล์ก่อน', 'error'); return false }
          txns.unshift({
            id: 'BT-IMP-' + Date.now(),
            date: new Date().toISOString().slice(0,10),
            desc: `[Import] ${file.name}`,
            amount: 0,
            matched: null,
            type: 'in',
          })
          showToast(`📥 Import ${file.name} สำเร็จ — พบรายการใหม่ (Demo)`, 'success')
          renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
