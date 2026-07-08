/**
 * Withholding Tax Certificate — หนังสือรับรองการหักภาษี ณ ที่จ่าย (ใบ 50 ทวิ)
 * Route: /finance/withholding-tax
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'
import { printWithholdingTaxCert } from '../../utils/taxDocs.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function today() { return new Date().toISOString().slice(0, 10) }

const INCOME_TYPES = {
  salary:    { label: 'เงินเดือน ค่าจ้าง (มาตรา 40(1))', rate: 5 },
  fee:       { label: 'ค่าธรรมเนียม ค่านายหน้า (มาตรา 40(2))', rate: 3 },
  royalty:   { label: 'ค่าลิขสิทธิ์ (มาตรา 40(3))', rate: 3 },
  rent:      { label: 'ค่าเช่าทรัพย์สิน (มาตรา 40(5))', rate: 5 },
  service:   { label: 'ค่าจ้างทำของ/บริการ (มาตรา 40(8))', rate: 3 },
  transport: { label: 'ค่าขนส่ง', rate: 1 },
  other:     { label: 'อื่นๆ', rate: 3 },
}

export default async function WithholdingTaxPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let certs = []
  let typeFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { certs = await listDocs('withholding_tax_certs', [], 'paymentDate', 'desc', 500) } catch (e) { certs = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = typeFilter === 'all' ? certs : certs.filter(c => c.incomeType === typeFilter)
    const totalPaid = certs.reduce((a, c) => a + c.amountPaid, 0)
    const totalWithheld = certs.reduce((a, c) => a + c.taxWithheld, 0)
    const thisMonth = certs.filter(c => (c.paymentDate || '').slice(0, 7) === today().slice(0, 7)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧾 หนังสือรับรองหัก ณ ที่จ่าย</div>
            <div class="page-subtitle">Withholding Tax Certificate (ใบ 50 ทวิ) — ตามมาตรา 50 ทวิ ประมวลรัษฎากร</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-cert-btn">+ ออกหนังสือรับรอง</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🧾 ใบรับรองทั้งหมด', certs.length, 'primary')}
          ${kpi('📅 เดือนนี้', thisMonth, 'secondary')}
          ${kpi('💰 ยอดจ่ายรวม', formatCurrency(totalPaid), 'primary')}
          ${kpi('📉 ภาษีที่หักรวม', formatCurrency(totalWithheld), 'warning')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(INCOME_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-primary':'btn-secondary'} tf-btn" data-t="${k}">${v.label.split(' (')[0]}</button>`).join('')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>เลขที่</th><th>ผู้รับเงิน</th><th>ประเภทเงินได้</th><th>วันที่จ่าย</th><th class="text-right">จำนวนเงิน</th><th class="text-right">อัตรา</th><th class="text-right">ภาษีหัก</th><th></th></tr></thead>
            <tbody>
              ${list.map(c => `<tr>
                <td style="font-family:monospace;font-size:0.8rem">${esc(c.certNo)}</td>
                <td style="font-size:0.83rem">${esc(c.payeeName)}</td>
                <td style="font-size:0.78rem">${esc((INCOME_TYPES[c.incomeType]||{}).label || c.incomeTypeLabel)}</td>
                <td style="font-size:0.8rem">${formatDate(c.paymentDate)}</td>
                <td class="text-right" style="font-size:0.83rem">${formatCurrency(c.amountPaid)}</td>
                <td class="text-right" style="font-size:0.83rem">${c.taxRate}%</td>
                <td class="text-right" style="font-weight:700;color:var(--warning)">${formatCurrency(c.taxWithheld)}</td>
                <td><button class="btn btn-xs btn-secondary print-btn" data-id="${c.id}">🖨 พิมพ์</button></td>
              </tr>`).join('')}
              ${!list.length ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบรายการ</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; render() }))
    document.getElementById('new-cert-btn')?.addEventListener('click', openNewCertModal)
    container.querySelectorAll('.print-btn').forEach(b => b.addEventListener('click', () => {
      const c = certs.find(x => x.id === b.dataset.id); if (c) printWithholdingTaxCert(c)
    }))
  }

  function openNewCertModal() {
    openModal({
      title: '+ ออกหนังสือรับรองหัก ณ ที่จ่าย',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อผู้รับเงิน *</label><input class="input" id="wt-payee"></div>
          <div class="input-group"><label class="input-label">เลขประจำตัวผู้เสียภาษี/บัตร ปชช.</label><input class="input" id="wt-taxid"></div>
          <div class="input-group"><label class="input-label">ที่อยู่</label><input class="input" id="wt-addr"></div>
          <div class="input-group"><label class="input-label">ประเภทเงินได้</label>
            <select class="input" id="wt-type">${Object.entries(INCOME_TYPES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">วันที่จ่ายเงิน</label><input type="date" class="input" id="wt-date" value="${today()}"></div>
          <div class="input-group"><label class="input-label">จำนวนเงินที่จ่าย (บาท) *</label><input type="number" class="input" id="wt-amount"></div>
          <div class="input-group"><label class="input-label">อัตราภาษี (%)</label><input type="number" class="input" id="wt-rate" step="0.5"></div>
          <div class="input-group"><label class="input-label">ผู้ออกหนังสือ</label><input class="input" id="wt-issuer" value="คุณ (Demo)"></div>
        </div>
      `,
      async onConfirm() {
        const payeeName = document.getElementById('wt-payee')?.value?.trim()
        const amountPaid = +document.getElementById('wt-amount')?.value || 0
        if (!payeeName || amountPaid <= 0) { showToast('❗ กรุณากรอกชื่อผู้รับเงินและจำนวนเงิน', 'error'); return false }
        const incomeType = document.getElementById('wt-type')?.value || 'service'
        const rateInput = document.getElementById('wt-rate')?.value
        const taxRate = rateInput ? +rateInput : INCOME_TYPES[incomeType].rate
        const taxWithheld = Math.round(amountPaid * taxRate / 100)
        try {
          const certNo = 'WHT-' + new Date().getFullYear() + '-' + String(certs.length + 1).padStart(4, '0')
          await createDoc('withholding_tax_certs', {
            certNo, payeeName,
            payeeTaxId: document.getElementById('wt-taxid')?.value?.trim() || '',
            payeeAddress: document.getElementById('wt-addr')?.value?.trim() || '',
            incomeType, incomeTypeLabel: INCOME_TYPES[incomeType].label,
            paymentDate: document.getElementById('wt-date')?.value || today(),
            amountPaid, taxRate, taxWithheld,
            issuedBy: document.getElementById('wt-issuer')?.value?.trim() || 'พนักงาน',
          })
          showToast('✅ ออกหนังสือรับรองแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
