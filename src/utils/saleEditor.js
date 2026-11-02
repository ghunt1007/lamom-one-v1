// (2026-11-02) ✏️ ข้อมูลเอกสารขาย — กรอกครั้งเดียว ใช้ได้ทุกแบบฟอร์ม (Job Order, สัญญา, แนบท้าย, แจ้งค่าใช้จ่าย,
// ใบส่งมอบ, แจ้งจดทะเบียน, ใบค่าคอม, ใบขอยกเลิกจอง) — ข้อมูลลูกค้า/รถ/ราคา/ไฟแนนซ์ ดึงจากใบจองเดิม ไม่ต้องกรอกซ้ำ
import { openModal } from './modal.js'
import { showToast } from '../core/store.js'
import { updateDocData } from '../core/db.js'
import { esc, money } from './print.js'
import { saleOf, saleTotals } from './saleDoc.js'

const ADDR = [['houseNo', 'บ้านเลขที่'], ['moo', 'หมู่'], ['soi', 'ซอย'], ['road', 'ถนน'], ['subdistrict', 'ตำบล/แขวง'], ['district', 'อำเภอ/เขต'], ['province', 'จังหวัด']]
const MONEY = [
  ['cashBack', 'Cash Back (หักจากราคารถ)'], ['discount', 'ส่วนลด'], ['activityDiscount', 'ส่วนลดกิจกรรม'],
  ['redPlateDeposit', 'มัดจำป้ายแดง'], ['regFee', 'ค่าจดทะเบียน'], ['deliveryFee', 'ค่าขนส่ง/ส่งมอบ'],
  ['giftBudget', 'งบของแถม (ใบค่าคอม)'], ['accessoryCommission', 'คอมอุปกรณ์เสริม'],
]
const REG = [['now', 'จดทะเบียนทันที'], ['lot', 'จดตามรอบ'], ['self', 'ลูกค้าจดเอง'], ['other', 'อื่นๆ']]
const grid = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:8px'
const inp = (id, label, v, type = 'text') => `<div class="input-group" style="margin:0"><label class="input-label">${label}</label><input class="input" ${type === 'number' ? 'type="number" inputmode="decimal"' : ''} data-k="${id}" value="${esc(v ?? '')}"></div>`

export function openSaleEditor(b, { onSaved } = {}) {
  if (!b) return
  const s = saleOf(b)
  const { el, close } = openModal({
    title: `✏️ ข้อมูลเอกสารขาย · ${esc(b.bookingNo || b.custName || '')}`,
    size: 'lg',
    body: `<div id="se-body"></div>`,
    footer: `<button class="btn btn-secondary" id="se-c">ยกเลิก</button><button class="btn btn-primary" id="se-s">💾 บันทึก</button>`,
  })
  const body = el.querySelector('#se-body')
  const extra = { colorIn: b.colorIn || '', motorNo: b.motorNo || b.engineNo || '' }

  function itemRow(it, i) {
    return `<tr data-i="${i}">
      <td><input class="input" data-it="name" value="${esc(it.name)}" style="min-width:110px"></td>
      <td><input class="input" data-it="detail" value="${esc(it.detail)}" style="min-width:90px"></td>
      <td><input class="input" type="number" inputmode="decimal" data-it="cost" value="${esc(it.cost)}" style="width:86px"></td>
      <td><input class="input" type="number" inputmode="decimal" data-it="giftValue" value="${esc(it.giftValue)}" style="width:86px"></td>
      <td><input class="input" type="number" inputmode="decimal" data-it="salePrice" value="${esc(it.salePrice)}" style="width:86px"></td>
      <td style="text-align:center"><input type="checkbox" data-it="campaign" ${it.campaign ? 'checked' : ''}></td>
      <td><button class="btn btn-ghost btn-sm" data-del="${i}" title="ลบแถว">✕</button></td>
    </tr>`
  }

  function render() {
    body.innerHTML = `
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">ชื่อ บัตร โทร รุ่น สี เลขถัง ราคา ไฟแนนซ์ ดึงจากใบจองให้แล้ว กรอกเฉพาะส่วนที่ขาด แล้วพิมพ์ได้ทุกแผ่น</div>
      <div style="font-weight:700;margin:4px 0 6px">🚗 รถ / ลูกค้า</div>
      <div style="${grid}">
        ${inp('carNo', 'คันที่', s.carNo)}${inp('year', 'ปีรถ', s.year)}
        ${inp('x.colorIn', 'สีภายใน', extra.colorIn)}${inp('x.motorNo', 'เลขมอเตอร์/เครื่อง', extra.motorNo)}
        ${inp('phoneHome', 'โทรบ้าน', s.phoneHome)}
      </div>
      <div style="font-weight:700;margin:12px 0 6px">🏠 ที่อยู่ (แยกช่องตามแบบฟอร์ม)</div>
      <div style="${grid}">${ADDR.map(([k, l]) => inp('addr.' + k, l, s.addr[k])).join('')}</div>
      <div style="font-weight:700;margin:12px 0 6px">🎁 รายการแถม / ขาย (Job Order)</div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table class="table" style="font-size:0.8rem;min-width:560px"><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>ทุน</th><th>มูลค่าแถม</th><th>ราคาขาย</th><th>แคมเปญ</th><th></th></tr></thead>
        <tbody>${s.items.map(itemRow).join('')}</tbody></table>
      </div>
      <button class="btn btn-secondary btn-sm" id="se-add" style="margin-top:6px">➕ เพิ่มแถว</button>
      <div style="font-weight:700;margin:12px 0 6px">💰 ส่วนลด / ค่าใช้จ่าย</div>
      <div style="${grid}">${MONEY.map(([k, l]) => inp(k, l, s[k], 'number')).join('')}</div>
      <div style="${grid};margin-top:8px">${inp('insuranceText', 'ประกันภัย (บริษัท/ชั้น)', s.insuranceText)}</div>
      <div style="font-weight:700;margin:12px 0 6px">🪪 การจดทะเบียน</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center">
        ${REG.map(([k, l]) => `<label style="display:flex;gap:4px;align-items:center;cursor:pointer"><input type="radio" name="se-reg" value="${k}" ${s.regOption === k ? 'checked' : ''}>${l}</label>`).join('')}
        <input class="input" data-k="regOther" value="${esc(s.regOther)}" placeholder="ระบุ (ถ้าเลือกอื่นๆ)" style="flex:1 1 140px">
      </div>
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px;cursor:pointer"><input type="checkbox" data-k="insuranceConsent" ${s.insuranceConsent ? 'checked' : ''}>ลูกค้ายินยอมให้ส่งข้อมูลให้บริษัทประกัน</label>
      <div class="input-group" style="margin-top:8px"><label class="input-label">หมายเหตุ</label><textarea class="input" data-k="note" rows="2">${esc(s.note)}</textarea></div>
      <div id="se-tot" class="card" style="padding:10px 12px;margin-top:10px;font-size:0.82rem"></div>`
    bind()
    totals()
  }

  function collect() {
    body.querySelectorAll('[data-k]').forEach(i => {
      const k = i.dataset.k, v = i.type === 'checkbox' ? i.checked : i.value.trim()
      if (k.startsWith('addr.')) s.addr[k.slice(5)] = v
      else if (k.startsWith('x.')) extra[k.slice(2)] = v
      else s[k] = v
    })
    s.regOption = body.querySelector('[name="se-reg"]:checked')?.value || 'now'
    s.items = [...body.querySelectorAll('tbody tr[data-i]')].map(tr => {
      const o = {}
      tr.querySelectorAll('[data-it]').forEach(i => { o[i.dataset.it] = i.type === 'checkbox' ? i.checked : i.value.trim() })
      return o
    })
  }

  function totals() {
    collect()
    const t = saleTotals(b, s)
    body.querySelector('#se-tot').innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:4px 16px">
        <span>${t.cash ? 'ราคารถ (สด)' : 'ดาวน์'} <b>${money(t.cash ? t.carPrice : t.down)}</b></span>
        <span>ยอดรวม <b>${money(t.gross)}</b></span><span>หักส่วนลด <b>${money(t.discounts)}</b></span>
        <span>หักเงินจอง <b>${money(t.deposit)}</b></span><span>คงเหลือชำระ <b style="color:var(--primary)">${money(t.balance)}</b></span>
        <span>ใช้ของแถม <b>${money(t.giftUsed)}</b> / งบ ${money(t.giftBudget)}</span>
      </div>`
  }

  function bind() {
    body.querySelectorAll('input,textarea').forEach(i => i.addEventListener('input', totals))
    body.querySelectorAll('input[type=radio],input[type=checkbox]').forEach(i => i.addEventListener('change', totals))
    body.querySelector('#se-add').addEventListener('click', () => { collect(); s.items.push({ name: '', detail: '', cost: '', giftValue: '', salePrice: '', campaign: false }); render() })
    body.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => { collect(); s.items.splice(Number(btn.dataset.del), 1); render() }))
  }

  el.querySelector('#se-c').addEventListener('click', close)
  el.querySelector('#se-s').addEventListener('click', async () => {
    collect()
    const sale = { ...s, items: s.items.filter(it => it.name || it.detail || it.salePrice || it.giftValue || it.cost) }
    const data = { sale, colorIn: extra.colorIn, motorNo: extra.motorNo }
    try {
      await updateDocData('bookings', b.id, data)
      Object.assign(b, data)
      showToast('💾 บันทึกข้อมูลเอกสารแล้ว', 'success')
      close()
      onSaved?.(b)
    } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error') }
  })
  render()
}
