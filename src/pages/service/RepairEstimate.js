/**
 * Repair Estimate — ใบประเมินราคาซ่อม
 * Route: /service/estimate
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, softDelete } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const LABOR_RATE = 500 // บาท/ชม.

const PARTS_CATALOG = [
  { name: 'ผ้าเบรกหน้า BYD', price: 1500, hours: 1 },
  { name: 'ผ้าเบรกหลัง BYD', price: 1200, hours: 1 },
  { name: 'ไส้กรองอากาศ', price: 450, hours: 0.5 },
  { name: 'ไส้กรองแอร์', price: 380, hours: 0.5 },
  { name: 'ยาง 215/55R17 (ต่อเส้น)', price: 4500, hours: 0.5 },
  { name: 'ใบปัดน้ำฝน (คู่)', price: 650, hours: 0.25 },
  { name: 'น้ำยาหล่อเย็น (เปลี่ยนถ่าย)', price: 1800, hours: 1 },
  { name: '12V Battery', price: 3500, hours: 0.5 },
  { name: 'ไฟหน้า LED Assembly', price: 14000, hours: 2 },
  { name: 'ตรวจเช็คระบบ HV (เหมา)', price: 2500, hours: 1.5 },
]

export default async function RepairEstimatePage(container) {
  const myGen = container.__routerGen
  let items = []
  let customer = ''
  let plate = ''
  let discount = 0
  let pastEstimates = []
  let loadingPast = true

  async function loadEstimates() {
    loadingPast = true
    try { pastEstimates = await listDocs('repair_estimates', [], 'createdAt', 'desc', 100) } catch { pastEstimates = [] }
    loadingPast = false
    if (container.__routerGen === myGen) renderPage()
  }

  function estimateRow(e) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
      <div>
        <div style="font-weight:700">${escHtml(e.customer || '-')}${e.plate ? ' · ' + escHtml(e.plate) : ''}</div>
        <div style="font-size:0.66rem;color:var(--text-muted)">${formatDate(e.createdAt)} · ${(e.items || []).length} รายการ</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <strong style="color:var(--success)">${formatCurrency(e.grand)}</strong>
        <button class="btn btn-xs btn-secondary del-est-btn" data-id="${e.id}" title="ลบ" style="color:var(--danger)">🗑</button>
      </div>
    </div>`
  }

  function renderPage() {
    const partsTotal = items.reduce((a, i) => a + i.price * i.qty, 0)
    const laborHours = items.reduce((a, i) => a + i.hours * i.qty, 0)
    const laborTotal = Math.round(laborHours * LABOR_RATE)
    const subtotal = partsTotal + laborTotal
    const discountAmt = Math.round(subtotal * discount / 100)
    const beforeVat = subtotal - discountAmt
    const vat = Math.round(beforeVat * 0.07)
    const grand = beforeVat + vat

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧾 Repair Estimate</div>
            <div class="page-subtitle">ใบประเมินราคาซ่อม — ค่าอะไหล่ + ค่าแรง (${formatCurrency(LABOR_RATE)}/ชม.)</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="send-est-btn" ${items.length===0?'disabled':''}>📤 ส่งให้ลูกค้าอนุมัติ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <!-- Catalog -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔩 เลือกรายการ</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${PARTS_CATALOG.map((p, i) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 8px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.78rem">
                  <div>
                    <div style="font-weight:600">${p.name}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">${formatCurrency(p.price)} + แรง ${p.hours} ชม.</div>
                  </div>
                  <button class="btn btn-xs btn-primary add-item-btn" data-i="${i}">+</button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Estimate -->
          <div class="card" style="padding:14px;height:fit-content">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
              <div class="input-group"><label class="input-label">ลูกค้า</label><input class="input" id="est-customer" value="${escHtml(customer)}" style="padding:6px 10px;font-size:0.8rem"></div>
              <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="est-plate" value="${escHtml(plate)}" style="padding:6px 10px;font-size:0.8rem"></div>
            </div>

            ${items.length === 0 ? `
              <div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.8rem">เลือกรายการจากด้านซ้าย</div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px">
                ${items.map((it, i) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;padding:5px 0;border-bottom:1px solid var(--border)">
                    <span>${it.name} ×${it.qty}</span>
                    <div style="display:flex;gap:6px;align-items:center">
                      <strong>${formatCurrency(it.price * it.qty)}</strong>
                      <button class="btn btn-xs btn-secondary rm-btn" data-i="${i}">−</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="font-size:0.78rem;display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--border);padding-top:10px">
                ${sumRow('ค่าอะไหล่', formatCurrency(partsTotal))}
                ${sumRow('ค่าแรง (' + laborHours + ' ชม.)', formatCurrency(laborTotal))}
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="color:var(--text-muted)">ส่วนลด</span>
                  <select class="input" id="est-discount" style="width:90px;padding:3px 8px;font-size:0.75rem">
                    ${[0,5,10,15,20,25].map(d => `<option value="${d}" ${discount===d?'selected':''}>${d}%</option>`).join('')}
                  </select>
                </div>
                ${discount > 0 ? sumRow('ส่วนลด ' + discount + '%', '−' + formatCurrency(discountAmt), 'danger') : ''}
                ${sumRow('VAT 7%', formatCurrency(vat))}
                <div style="display:flex;justify-content:space-between;font-weight:900;font-size:1rem;padding-top:8px;border-top:1px solid var(--border)">
                  <span>รวมทั้งสิ้น</span><span style="color:var(--success)">${formatCurrency(grand)}</span>
                </div>
              </div>
            `}
          </div>
        </div>

        <div class="card" style="padding:14px;margin-top:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 ใบประเมินที่ส่งแล้ว (${pastEstimates.length})</div>
          ${loadingPast
            ? '<div class="skeleton" style="height:40px;border-radius:6px"></div>'
            : pastEstimates.length === 0
              ? '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:0.8rem">ยังไม่มีใบประเมินที่ส่ง</div>'
              : pastEstimates.map(e => estimateRow(e)).join('')
          }
        </div>
      </div>
    `

    document.getElementById('est-customer')?.addEventListener('change', e => { customer = e.target.value })
    document.getElementById('est-plate')?.addEventListener('change', e => { plate = e.target.value })
    document.getElementById('est-discount')?.addEventListener('change', e => { discount = parseInt(e.target.value); renderPage() })
    container.querySelectorAll('.add-item-btn').forEach(b => b.addEventListener('click', () => {
      const p = PARTS_CATALOG[parseInt(b.dataset.i)]
      const existing = items.find(x => x.name === p.name)
      if (existing) existing.qty++
      else items.push({ ...p, qty: 1 })
      renderPage()
    }))
    container.querySelectorAll('.rm-btn').forEach(b => b.addEventListener('click', () => {
      const it = items[parseInt(b.dataset.i)]
      if (it.qty > 1) it.qty--
      else items.splice(parseInt(b.dataset.i), 1)
      renderPage()
    }))
    document.getElementById('send-est-btn')?.addEventListener('click', async () => {
      customer = document.getElementById('est-customer')?.value || customer
      if (!customer) { showToast('❗ กรอกชื่อลูกค้าก่อนส่ง', 'error'); return }
      const btn = document.getElementById('send-est-btn')
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>' }
      try {
        await createDoc('repair_estimates', {
          customer, plate,
          items: items.map(i => ({ name: i.name, price: i.price, hours: i.hours, qty: i.qty })),
          discount, partsTotal, laborHours, laborTotal, subtotal, discountAmt, vat, grand,
          status: 'sent',
        })
        showToast(`📤 ส่งใบประเมิน ${formatCurrency(grand)} ให้ ${customer} ทาง LINE — รอลูกค้ากดอนุมัติ`, 'success')
        items = []; discount = 0
        await loadEstimates()
      } catch {
        showToast('บันทึกใบประเมินไม่สำเร็จ', 'error')
        if (btn) { btn.disabled = false; btn.textContent = '📤 ส่งให้ลูกค้าอนุมัติ' }
      }
    })
    container.querySelectorAll('.del-est-btn').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.id
      if (!await confirmDialog({ title: 'ลบใบประเมิน', message: 'ยืนยันลบใบประเมินนี้? ไม่สามารถกู้คืนได้', confirmText: 'ลบ', danger: true })) return
      try {
        await softDelete('repair_estimates', id)
        pastEstimates = pastEstimates.filter(e => e.id !== id)
        showToast('ลบแล้ว', 'success')
        renderPage()
      } catch { showToast('เกิดข้อผิดพลาด', 'error') }
    }))
  }

  renderPage()
  await loadEstimates()
}

function sumRow(l, v, c) { return `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">${l}</span><span style="${c?'color:var(--'+c+')':''}">${v}</span></div>` }
