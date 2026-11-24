/**
 * Loan Calculator — คำนวณค่างวดไฟแนนซ์
 * Route: /finance/loan-calc
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'
import { sendToCustomer, lineUidFor } from '../../utils/customerSend.js'
import { loadContactPrefs } from '../../utils/marketingOptOut.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { escHtml as __escA } from '../../utils/escape.js'
import { escHtml } from '../../utils/escape.js'

const MODELS = {
  'BYD Dolphin': 899000,
  'BYD Atto 3': 1099000,
  'BYD Atto 3 Pro': 1299000,
  'BYD Seal AWD': 1699000,
  'MG ZS EV': 799000,
  'MG4 Electric': 949000,
  'BYD Han': 2099000,
}

// อัตราตัวอย่าง — ใช้เฉพาะตอนยังไม่ได้ตั้งอัตราจริง (หน้าจอบอกชัดว่าเป็นตัวอย่าง) · ตั้งอัตราจริงได้ที่ปุ่ม ✏️ ตั้งอัตราดอกเบี้ย
export const TERMS = [48, 60, 72, 84]
const BANKS = [
  { name: 'กรุงศรี ออโต้', rates: { 48: 2.59, 60: 2.79, 72: 2.99, 84: 3.19 } },
  { name: 'ธนชาต DRIVE', rates: { 48: 2.49, 60: 2.69, 72: 2.89, 84: 3.09 } },
  { name: 'SCB ลีสซิ่ง', rates: { 48: 2.69, 60: 2.85, 72: 3.05, 84: 3.25 } },
  { name: 'เกียรตินาคิน', rates: { 48: 2.55, 60: 2.75, 72: 2.95, 84: 3.15 } },
]

// รุ่นรถ/ราคาจากฐานข้อมูลรถกลาง (Deepal ขึ้นก่อน) — ถ้าโหลดไม่ได้ใช้รายการตัวอย่างเดิม
export function catalogPriceList(vehicles) {
  const rows = (vehicles || []).filter(v => v && v.price > 0)
    .map(v => [`${v.brand} ${v.model}${v.variant ? ` ${v.variant}` : ''}`.trim(), v.price, v.brand])
    .sort((a, b) => Number(b[2] === 'Deepal') - Number(a[2] === 'Deepal') || String(a[2]).localeCompare(String(b[2])) || a[1] - b[1])
  return rows.length ? Object.fromEntries(rows.map(r => [r[0], r[1]])) : null
}
// เปิดจากหน้าลูกค้า (?model=DEEPAL S05) → เลือกรุ่นที่ใกล้เคียงที่สุดให้
export function pickModel(models, query) {
  const keys = Object.keys(models)
  const n = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9ก-๙]+/g, '')
  const q = n(query)
  if (q) {
    const hit = keys.find(k => n(k).includes(q)) || keys.find(k => q.includes(n(k.split(' ').slice(0, 2).join(' '))))
    if (hit) return hit
  }
  return keys[0]
}

// อ่านเงื่อนไขจากลิงก์ — รับเฉพาะค่าที่หน้านี้เลือกได้จริง (ดาวน์ 0–50% · 48/60/72/84 งวด)
export function loanPreset(qs) {
  const num = k => { const v = Number(qs.get(k)); return qs.get(k) != null && qs.get(k) !== '' && Number.isFinite(v) ? v : null }
  const price = num('price'), down = num('down'), term = num('term')
  return {
    price: price != null && price >= 100000 && price <= 20000000 ? Math.round(price) : null,
    down: down != null && down >= 0 && down <= 50 ? Math.round(down) : null,
    term: [48, 60, 72, 84].includes(term) ? term : null,
  }
}

function monthly(principal, flatRate, months) {
  const years = months / 12
  const interest = principal * (flatRate / 100) * years
  return Math.round((principal + interest) / months)
}

export default async function LoanCalculatorPage(container) {
  const myGen = container.__routerGen
  let models = MODELS
  try { models = catalogPriceList(getVehicles()) || MODELS } catch {}
  // (v1.0.1062) เปิดจากคำตอบค่างวดของ LAMI (?model=&price=&down=&term=) → ตั้งเงื่อนไขเดียวกันให้เลย ไม่ต้องกรอกซ้ำ
  const qs = new URLSearchParams(window.location.search)
  const pre = loanPreset(qs)
  let model = pickModel(models, qs.get('model'))
  let customPrice = pre.price && pre.price !== models[model] ? pre.price : null
  let downPct = pre.down ?? 20
  let term = pre.term ?? 60
  let banks = BANKS.map(b => ({ ...b, rates: { ...b.rates } }))
  let dataSource = 'demo'

  // (v1.0.1278) เดิมต้องมีอย่างน้อย 2 ไฟแนนซ์ถึงใช้ของจริง แล้วยังปนกับอัตราตัวอย่าง 4 เจ้า (ชื่อธนาคารจริง ตัวเลขสมมติ)
  // ซึ่งถูกคัดลอกส่งลูกค้า — และในแอปไม่มีที่ให้ตั้งอัตราจริงเลย · ตอนนี้มีปุ่มตั้งอัตรา และมีของจริงเมื่อไหร่ใช้ของจริงอย่างเดียว
  async function loadBanks() {
    const docs = (await listDocs('finance_banks', [], 'name', 'asc', 50).catch(() => [])).filter(d => !d.deleted)
    if (docs.length) {
      banks = docs.map(d => ({
        id: d.id, name: d.name || d.bankName || 'ธนาคาร',
        rates: Object.fromEntries(TERMS.map(t => [t, Number(d.rates?.[t] ?? d['rate' + t]) || null])),
      }))
      dataSource = 'live'
    } else { banks = BANKS.map(b => ({ ...b, rates: { ...b.rates } })); dataSource = 'demo' }
  }
  try { await loadBanks() } catch {}
  if (container.__routerGen !== myGen) return

  function openRatesEditor() {
    const rows = dataSource === 'live' ? banks : []
    const rowHtml = (b = {}) => `<div class="lc-rate-row" data-id="${__escA(b.id || '')}" style="display:grid;grid-template-columns:minmax(110px,1.6fr) repeat(4,minmax(54px,1fr));gap:6px;align-items:center">
      <input class="input lc-r-name" placeholder="ชื่อไฟแนนซ์" value="${__escA(b.name || '')}">
      ${TERMS.map(t => `<input class="input lc-r-rate" data-t="${t}" type="number" step="0.01" min="0" max="15" inputmode="decimal" placeholder="%" value="${b.rates?.[t] ?? ''}">`).join('')}
    </div>`
    const { el, close } = openModal({
      title: '✏️ ตั้งอัตราดอกเบี้ยไฟแนนซ์ (flat % ต่อปี)', size: 'md',
      body: `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">ใส่ตามเรทชีตเดือนนี้ · ลบชื่อออก = เอาไฟแนนซ์นั้นออก · ช่องว่าง = ไม่มีเรทงวดนั้น</div>
        <div style="display:grid;grid-template-columns:minmax(110px,1.6fr) repeat(4,minmax(54px,1fr));gap:6px;font-size:0.7rem;color:var(--text-muted);margin-bottom:4px"><span>ไฟแนนซ์</span>${TERMS.map(t => `<span>${t} งวด</span>`).join('')}</div>
        <div id="lc-rate-rows" style="display:flex;flex-direction:column;gap:6px;overflow-x:auto">${(rows.length ? rows : [{}, {}]).map(rowHtml).join('')}</div>
        <button class="btn btn-ghost btn-sm" id="lc-rate-add" style="margin-top:8px">➕ เพิ่มไฟแนนซ์</button>`,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const list = [...el.querySelectorAll('.lc-rate-row')].map(r => ({
          id: r.dataset.id, name: r.querySelector('.lc-r-name').value.trim(),
          rates: Object.fromEntries([...r.querySelectorAll('.lc-r-rate')].map(i => [i.dataset.t, i.value === '' ? null : Math.round(parseFloat(i.value) * 100) / 100])),
        }))
        const bad = list.find(b => b.name && Object.values(b.rates).some(v => v !== null && !(v >= 0 && v <= 15)))
        if (bad) { showToast(`❗ อัตราของ ${bad.name} ต้องอยู่ระหว่าง 0–15%`, 'error'); return false }
        try {
          for (const b of list) {
            const has = b.name && Object.values(b.rates).some(v => v !== null)
            if (b.id && !has) await softDelete('finance_banks', b.id)
            else if (b.id) await updateDocData('finance_banks', b.id, { name: b.name, rates: b.rates })
            else if (has) await createDoc('finance_banks', { name: b.name, rates: b.rates })
          }
          await loadBanks(); showToast('✅ บันทึกอัตราดอกเบี้ยแล้ว', 'success'); renderPage()
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e?.message || ''), 'error'); return false }
      },
    })
    el.querySelector('#lc-rate-add')?.addEventListener('click', () => el.querySelector('#lc-rate-rows').insertAdjacentHTML('beforeend', rowHtml()))
  }

  function renderPage() {
    const price = customPrice ?? models[model]
    const downAmt = Math.round(price * downPct / 100)
    const principal = price - downAmt
    const results = banks.filter(b => b.rates[term] > 0).map(b => ({
      ...b, rate: b.rates[term], pay: monthly(principal, b.rates[term], term),
      totalInterest: monthly(principal, b.rates[term], term) * term - principal
    })).sort((a, b) => a.pay - b.pay)
    const best = results[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧮 คำนวณค่างวด</div>
            <div class="page-subtitle">คำนวณค่างวด — เทียบ ${results.length} ไฟแนนซ์${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● อัตราที่ตั้งไว้</span>' : ' <span style="color:var(--warning);font-size:0.75rem">⚠️ อัตราตัวอย่าง ยังไม่ได้ตั้งอัตราจริง</span>'}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="lc-rates-btn">✏️ ตั้งอัตราดอกเบี้ย</button>
            <button class="btn btn-primary" id="send-btn">📤 ส่งให้ลูกค้า</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:14px">
          <!-- Inputs -->
          <div class="card" style="padding:16px;height:fit-content">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⚙️ เงื่อนไข</div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">รุ่นรถ</label>
              <select class="input" id="lc-model">${Object.keys(models).map(m => `<option ${model===m?'selected':''}>${m}</option>`).join('')}</select>
            </div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">ราคารถ (แก้ได้)</label>
              <input class="input" type="number" id="lc-price" value="${__escA(price)}">
            </div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">เงินดาวน์: <strong style="color:var(--primary)">${downPct}%</strong> = ${formatCurrency(downAmt)}</label>
              <input type="range" id="lc-down" min="0" max="50" step="5" value="${__escA(downPct)}" style="width:100%;accent-color:var(--primary)">
            </div>
            <div class="input-group" style="margin-bottom:14px">
              <label class="input-label">ระยะผ่อน</label>
              <div style="display:flex;flex-wrap:wrap;gap:4px">
                ${[48,60,72,84].map(t => `<button class="btn btn-xs ${term===t?'btn-primary':'btn-secondary'} term-btn" data-t="${t}" style="flex:1 1 64px">${t} งวด</button>`).join('')}
              </div>
            </div>
            <div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);font-size:0.78rem">
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">ราคารถ</span><strong>${formatCurrency(price)}</strong></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text-muted)">เงินดาวน์</span><strong>−${formatCurrency(downAmt)}</strong></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid var(--border)"><span style="color:var(--text-muted)">ยอดจัด</span><strong style="color:var(--primary)">${formatCurrency(principal)}</strong></div>
            </div>
          </div>

          <!-- Results -->
          <div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${results.map((r, i) => `
                <div class="card" style="padding:14px;border:2px solid ${i===0?'var(--success)':'transparent'}">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-weight:700;font-size:0.87rem">${i===0?'👑 ':''}${escHtml(r.name)}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">ดอกเบี้ย flat ${r.rate}% · ${term} งวด · ดอกเบี้ยรวม ${formatCurrency(r.totalInterest)}</div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:1.25rem;font-weight:900;color:var(--${i===0?'success':'primary'})">${formatCurrency(r.pay)}</div>
                      <div style="font-size:0.63rem;color:var(--text-muted)">ต่อเดือน</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            ${best ? `<p style="font-size:0.7rem;color:var(--text-muted);margin-top:10px;padding-left:4px">💡 ${dataSource === 'live' ? '' : '(อัตราตัวอย่าง) '}${escHtml(best.name)} ถูกสุดที่ ${formatCurrency(best.pay)}/เดือน — อัตราจริงขึ้นกับเครดิตลูกค้า ใช้เป็นตัวเลขเบื้องต้นเท่านั้น</p>` : `<div class="card" style="padding:16px;color:var(--text-muted);font-size:0.85rem">ยังไม่มีอัตรา ${term} งวด — กด ✏️ ตั้งอัตราดอกเบี้ย</div>`}
          </div>
        </div>
      </div>
    `

    document.getElementById('lc-model')?.addEventListener('change', e => { model = e.target.value; customPrice = null; renderPage() })
    document.getElementById('lc-price')?.addEventListener('change', e => { customPrice = parseInt(e.target.value) || models[model]; renderPage() })
    document.getElementById('lc-down')?.addEventListener('input', e => { downPct = parseInt(e.target.value); renderPage() })
    container.querySelectorAll('.term-btn').forEach(b => b.addEventListener('click', () => { term = parseInt(b.dataset.t); renderPage() }))
    document.getElementById('lc-rates-btn')?.addEventListener('click', openRatesEditor)
    document.getElementById('send-btn')?.addEventListener('click', () => {
      const price = customPrice ?? models[model]
      const principal = Math.round(price * (1 - downPct / 100))
      const bestBank = banks.filter(b => b.rates[term] > 0).sort((a, b) => a.rates[term] - b.rates[term])[0]
      if (!bestBank) { showToast(`ยังไม่มีอัตรา ${term} งวด — กด ✏️ ตั้งอัตราดอกเบี้ย ก่อน`, 'warning'); return }
      if (dataSource !== 'live') { showToast('ยังเป็นอัตราตัวอย่าง — กด ✏️ ตั้งอัตราดอกเบี้ยจริงก่อนส่งตัวเลขให้ลูกค้า', 'warning'); return }
      const rate = bestBank.rates[term]
      const pay = monthly(principal, rate, term)
      const summary = `ค่างวดโดยประมาณ ${model}\nราคา ${formatCurrency(price)} · ดาวน์ ${downPct}% (${formatCurrency(price * downPct / 100)})\nผ่อน ${term} งวด ประมาณ ฿${pay.toLocaleString()}/เดือน (ดอกเบี้ย ${rate}% ต่อปี)\n*ตัวเลขเบื้องต้น อัตราจริงขึ้นกับการอนุมัติของไฟแนนซ์`
      // (v1.0.1378) ใส่เบอร์ลูกค้าที่ผูก LINE แล้ว = ส่งเข้า LINE ให้เลย · ไม่ใส่/ยังไม่ผูก = คัดลอกไปวางเอง (เหมือนเดิม)
      const copy = () => navigator.clipboard?.writeText(summary)
        .then(() => showToast(`📤 Copy สรุปค่างวดแล้ว — วางใน LINE ได้เลย`, 'success'))
        .catch(() => showToast('คัดลอกไม่สำเร็จ — จดตัวเลขจากหน้าจอแทน', 'warning'))
      openModal({
        title: '📤 ส่งสรุปค่างวดให้ลูกค้า', size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:10px;font-size:0.8rem;white-space:pre-wrap;overflow-wrap:anywhere">${escHtml(summary)}</div>
          <div class="input-group"><label class="input-label">เบอร์ลูกค้า (ผูก LINE แล้ว = ส่งเข้า LINE ให้เลย · เว้นว่าง = คัดลอก)</label><input class="input" id="lc-phone" inputmode="tel" placeholder="08x-xxx-xxxx"></div>
        </div>`,
        confirmText: '📤 ส่ง / คัดลอก',
        async onConfirm() {
          const phone = document.getElementById('lc-phone')?.value?.trim() || ''
          if (phone) {
            try {
              const prefs = await loadContactPrefs()
              if (lineUidFor(phone, prefs)) {
                await sendToCustomer(phone, summary, prefs)
                showToast('💚 ส่งสรุปค่างวดเข้า LINE ลูกค้าแล้ว', 'success')
                return
              }
              showToast('📋 ลูกค้ายังไม่ได้ผูก LINE กับร้าน — คัดลอกให้แทน', 'warning')
            } catch (e) { showToast('❌ ส่ง LINE ไม่สำเร็จ: ' + (e?.message || e) + ' — คัดลอกให้แทน', 'error') }
          }
          copy()
        },
      })
    })
  }

  renderPage()
}
