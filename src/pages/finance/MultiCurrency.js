/**
 * Multi-Currency Pricing — ราคาหลายสกุลเงิน
 * Route: /finance/multi-currency
 *
 * อัตราแลกเปลี่ยนเก็บใน Firestore (exchange_rates) และแก้ไขได้เองโดยทีมงาน/แอดมิน
 * — ไม่ใช่การดึงข้อมูล real-time จากภายนอก (แอปนี้ไม่มี integration กับ BOT หรือ FX API ใดๆ)
 */
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'

// ค่าเริ่มต้นตอนยังไม่มีใครตั้งอัตราไว้ใน Firestore — seed ครั้งแรกเท่านั้น จากนั้นทีมงานแก้ไขเองได้
const DEFAULT_RATES = [
  { code:'USD', name:'ดอลลาร์สหรัฐ', flag:'🇺🇸', rate:0.0278,  symbol:'$' },
  { code:'EUR', name:'ยูโร',          flag:'🇪🇺', rate:0.0258,  symbol:'€' },
  { code:'CNY', name:'หยวนจีน',       flag:'🇨🇳', rate:0.201,   symbol:'¥' },
  { code:'JPY', name:'เยนญี่ปุ่น',    flag:'🇯🇵', rate:4.18,    symbol:'¥' },
  { code:'SGD', name:'ดอลลาร์สิงคโปร์',flag:'🇸🇬', rate:0.0374, symbol:'S$' },
  { code:'AUD', name:'ดอลลาร์ออสเตรเลีย',flag:'🇦🇺',rate:0.0436,symbol:'A$' },
  { code:'GBP', name:'ปอนด์สเตอร์ลิง',flag:'🇬🇧', rate:0.0221, symbol:'£' },
]
const THB_ROW = { code:'THB', name:'บาทไทย', flag:'🇹🇭', rate:1, symbol:'฿' }
const CODE_ORDER = DEFAULT_RATES.map(r => r.code)

const MODELS = [
  { model:'BYD Atto 3',  baseTHB:1099000 },
  { model:'BYD Seal AWD',baseTHB:1699000 },
  { model:'BYD Han',     baseTHB:2099000 },
  { model:'BYD Dolphin', baseTHB:899000  },
  { model:'MG ZS EV',    baseTHB:799000  },
]

export default async function MultiCurrencyPage(container) {
  let baseCur = 'THB'
  let selModel = MODELS[0]
  let customAmt = selModel.baseTHB
  let currencies = [THB_ROW]
  let loaded = false

  async function loadRates() {
    let docs = []
    try { docs = await listDocs('exchange_rates', [], 'code', 'asc', 50) } catch (e) {}
    if (!docs.length) {
      // ยังไม่เคยตั้งค่า — seed ค่าเริ่มต้นให้ครั้งแรก (ทีมงานแก้ไขได้ภายหลังทุกเมื่อ)
      for (const r of DEFAULT_RATES) {
        try { await createDoc('exchange_rates', r) } catch (e) {}
      }
      try { docs = await listDocs('exchange_rates', [], 'code', 'asc', 50) } catch (e) {}
    }
    docs.sort((a, b) => CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code))
    currencies = [THB_ROW, ...docs]
    loaded = true
  }

  function convert(amtTHB, toCur) {
    const c = currencies.find(x => x.code === toCur)
    if (!c) return amtTHB
    if (toCur === 'THB') return amtTHB
    return amtTHB * c.rate
  }

  function fmt(val, code) {
    const c = currencies.find(x => x.code === code)
    if (!c) return val.toFixed(2)
    if (code === 'THB') return '฿'+val.toLocaleString('th-TH', {minimumFractionDigits:0, maximumFractionDigits:0})
    if (code === 'JPY') return c.symbol+Math.round(val).toLocaleString()
    return c.symbol+val.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})
  }

  // หา currency ที่ถูกแก้ไขล่าสุดโดยคน (ไม่นับค่าที่ seed อัตโนมัติซึ่งไม่มี updatedByName)
  function latestManualUpdate() {
    const edited = currencies.filter(c => c.code !== 'THB' && c.updatedByName)
    if (!edited.length) return null
    return edited.reduce((a, b) => (new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b))
  }

  function render() {
    if (!loaded) {
      container.innerHTML = `<div class="page-content"><div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">⏳ กำลังโหลดอัตราแลกเปลี่ยน...</div></div>`
      return
    }

    const amtTHB = customAmt || selModel.baseTHB
    const latest = latestManualUpdate()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💱 Multi-Currency Pricing</div>
            <div class="page-subtitle">แปลงราคารถ ${MODELS.length} รุ่น เป็น ${currencies.length} สกุลเงิน · อัตราแลกเปลี่ยนตั้งค่าโดยทีมงาน (ไม่ใช่ real-time)</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="edit-rate-btn">✏️ แก้ไขอัตราแลกเปลี่ยน</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Left: converter -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Model selector -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🚗 เลือกรุ่นรถ</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${MODELS.map(m => `
                  <div class="model-sel" data-model="${m.model}" style="padding:8px 12px;border-radius:var(--radius-sm);background:${selModel.model===m.model?'var(--primary)':'var(--surface-2)'};color:${selModel.model===m.model?'#fff':'var(--text)'};cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;transition:all .15s">
                    <span style="font-weight:600">${m.model}</span>
                    <span>${formatCurrency(m.baseTHB)}</span>
                  </div>`).join('')}
              </div>
            </div>

            <!-- Custom amount -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">✏️ ระบุราคาเอง (บาท)</div>
              <input class="input" id="custom-amt" type="number" value="${amtTHB}" style="width:100%;font-size:1rem;font-weight:700">
            </div>

            <!-- Rate status -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 สถานะอัตราแลกเปลี่ยน</div>
              <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:8px">
                ${latest
                  ? `อัปเดตล่าสุดโดย <b style="color:var(--text)">${latest.updatedByName}</b> เมื่อ ${formatDateTime(latest.updatedAt)}`
                  : `ยังไม่มีใครแก้ไขอัตรา — แสดงค่าเริ่มต้นของระบบ`}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                ${currencies.filter(c => c.code !== 'THB').slice(0, 3).map(c => `
                  <div style="display:flex;justify-content:space-between;font-size:0.76rem"><span>1 ${c.code}</span><span style="font-weight:700">฿${(1/c.rate).toFixed(2)}</span></div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Right: converted prices -->
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted)">💱 ราคา ${selModel.model} (${formatCurrency(amtTHB)}) ในทุกสกุลเงิน</div>
            ${currencies.map(c => {
              const val = convert(amtTHB, c.code)
              return `
              <div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:12px">
                <div style="font-size:1.6rem">${c.flag}</div>
                <div style="flex:1">
                  <div style="font-size:0.72rem;color:var(--text-muted)">${c.name} (${c.code})</div>
                  <div style="font-size:1.1rem;font-weight:900;color:${c.code==='THB'?'var(--primary)':'var(--text)'}">${fmt(val, c.code)}</div>
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted)">1฿ = ${c.rate.toFixed(4)} ${c.code}</div>
              </div>`
            }).join('')}

            <!-- All models comparison -->
            <div class="card" style="padding:14px;margin-top:4px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 เปรียบราคาทุกรุ่น (USD)</div>
              ${MODELS.map(m => `
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                  <span>${m.model}</span>
                  <div style="text-align:right">
                    <div style="font-weight:700">${fmt(convert(m.baseTHB,'USD'),'USD')}</div>
                    <div style="font-size:0.64rem;color:var(--text-muted)">${formatCurrency(m.baseTHB)}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.model-sel').forEach(el => el.addEventListener('click', () => {
      selModel = MODELS.find(m => m.model === el.dataset.model) || selModel
      customAmt = selModel.baseTHB
      render()
    }))
    document.getElementById('custom-amt')?.addEventListener('input', e => {
      customAmt = parseInt(e.target.value) || 0
      render()
    })
    document.getElementById('edit-rate-btn')?.addEventListener('click', openEditRatesModal)
  }

  function openEditRatesModal() {
    const editable = currencies.filter(c => c.code !== 'THB')
    const body = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-size:0.76rem;color:var(--text-muted)">แก้ไขอัตราแลกเปลี่ยนด้วยตนเอง (1 บาท = กี่หน่วยเงินต่างประเทศ) — ระบบจะบันทึกชื่อผู้แก้ไขและเวลาไว้ทุกครั้ง</div>
        ${editable.map(c => `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:76px;font-size:0.8rem;font-weight:700">${c.flag} ${c.code}</div>
            <input class="input rate-input" data-id="${c.id}" type="number" step="0.0001" min="0" value="${c.rate}" style="flex:1">
          </div>
        `).join('')}
      </div>
    `
    openModal({
      title: '✏️ แก้ไขอัตราแลกเปลี่ยน',
      body,
      confirmText: '💾 บันทึก',
      onConfirm: async () => {
        const inputs = [...document.querySelectorAll('.rate-input')]
        const user = getState('user')
        const updatedByName = user?.displayName || user?.email || 'ผู้ใช้งาน'
        let changed = 0
        for (const inp of inputs) {
          const newRate = parseFloat(inp.value)
          if (!newRate || newRate <= 0) continue
          const cur = editable.find(c => c.id === inp.dataset.id)
          if (!cur || cur.rate === newRate) continue
          await updateDocData('exchange_rates', inp.dataset.id, { rate: newRate, updatedByName })
          changed++
        }
        if (changed) {
          await loadRates()
          render()
          showToast(`💾 บันทึกอัตราแลกเปลี่ยน ${changed} สกุลเงิน โดย ${updatedByName}`, 'success')
        } else {
          showToast('ไม่มีการเปลี่ยนแปลงอัตรา', 'info')
        }
      }
    })
  }

  await loadRates()
  render()
}
