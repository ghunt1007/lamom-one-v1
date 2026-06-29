/**
 * Vehicle Picker — ตัวเลือกรถจากฐานข้อมูลกลาง (reusable ทุกโมดูล)
 * ใช้งาน: import { pickVehicle } from '../../utils/vehiclePicker.js'
 *         pickVehicle(v => { ...ทำอะไรกับรถที่เลือก... })
 * ข้อมูลดึงจาก getVehicles() = ฐาน + ที่เพิ่ม − ที่ลบ + override (sync ทั้งระบบ)
 */
import { openModal } from './modal.js'
import { getVehicles, getBrands } from '../data/vehicleDatabase.js'

const FUEL_LABELS = { Petrol: 'เบนซิน', Diesel: 'ดีเซล', Hybrid: 'ไฮบริด', PHEV: 'PHEV', BEV: 'ไฟฟ้า' }

function priceStr(p) {
  if (!p) return '-'
  return p >= 1000000 ? (p / 1000000).toFixed(2) + ' ล.' : (p / 1000).toFixed(0) + 'K'
}

export function pickVehicle(onPick) {
  let q = '', brand = ''

  function filtered() {
    return getVehicles().filter(v => {
      if (brand && v.brand !== brand) return false
      if (q) { const s = q.toLowerCase(); return (v.brand + ' ' + v.model + ' ' + v.variant).toLowerCase().includes(s) }
      return true
    })
  }

  function rows() {
    const items = filtered()
    if (!items.length) return '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.78rem">ไม่พบรถที่ค้นหา</div>'
    return items.slice(0, 300).map(v =>
      '<div class="vp-item" data-id="' + v.id + '" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-bottom:1px solid var(--border-subtle);cursor:pointer">' +
        '<div style="min-width:0">' +
          '<div style="font-size:0.78rem;font-weight:700">' + v.brand + ' ' + v.model + '</div>' +
          '<div style="font-size:0.66rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + v.variant + ' · ' + (FUEL_LABELS[v.fuel] || v.fuel) + ' · ปี ' + v.year + '</div>' +
        '</div>' +
        '<div style="font-size:0.8rem;font-weight:800;color:var(--primary);white-space:nowrap;margin-left:10px">฿' + priceStr(v.price) + '</div>' +
      '</div>'
    ).join('')
  }

  function brandOpts() {
    return '<option value="">ทุกยี่ห้อ</option>' + getBrands().map(b => '<option value="' + b + '">' + b + '</option>').join('')
  }

  const body = '<div style="font-size:0.82rem">' +
    '<div style="display:flex;gap:6px;margin-bottom:8px">' +
      '<input id="vp-q" placeholder="ค้นหา ยี่ห้อ / รุ่น / รุ่นย่อย..." style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text-primary);font-size:0.78rem">' +
      '<select id="vp-brand" style="padding:7px 8px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text-primary);font-size:0.74rem">' + brandOpts() + '</select>' +
    '</div>' +
    '<div style="font-size:0.66rem;color:var(--text-muted);margin-bottom:6px">คลิกที่รถเพื่อเลือก</div>' +
    '<div id="vp-list" style="max-height:52vh;overflow:auto;border:1px solid var(--border-subtle);border-radius:8px">' + rows() + '</div>' +
  '</div>'

  const m = openModal({ title: '🚘 เลือกรถจากฐานข้อมูล', size: 'md', body })
  const el = m.el

  function bind() {
    el.querySelectorAll('.vp-item').forEach(it => it.addEventListener('click', () => {
      const v = getVehicles().find(x => x.id === it.dataset.id)
      m.close()
      if (onPick && v) onPick(v)
    }))
  }
  function refresh() { const lst = el.querySelector('#vp-list'); if (lst) lst.innerHTML = rows(); bind() }

  setTimeout(() => {
    const qi = el.querySelector('#vp-q'); qi && qi.focus()
    qi && qi.addEventListener('input', e => { q = e.target.value; refresh() })
    el.querySelector('#vp-brand')?.addEventListener('change', e => { brand = e.target.value; refresh() })
    bind()
  }, 50)
}
