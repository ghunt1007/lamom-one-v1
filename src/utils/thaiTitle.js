// (v1.0.947) หัวข้อหน้ากว่า 250 หน้ายังเป็นภาษาอังกฤษ (เช่น "🚛 Vehicle Transfer") ทั้งที่เมนูซ้าย/แถบบนเป็นไทย ("โอนรถ")
// ผู้ใช้ภาษาไทยเห็นชื่อไม่ตรงกันและอ่านยาก — แทนที่จะแก้ทีละไฟล์ ใช้ชื่อไทยจากเมนูชุดเดียวกับแถบซ้าย (data/navMenu.js)
// แทนหัวข้อที่ไม่มีอักษรไทยเลย (เก็บอีโมจินำหน้าไว้ ชื่ออังกฤษเดิมเหลือเป็น title ตอนชี้เมาส์) · ภาษาอื่นไม่แตะ
const THAI = /[฀-๿]/

export function thaiPageTitle(text, label) {
  const t = String(text || '').trim()
  if (!t || !label || THAI.test(t) || !/[A-Za-z]/.test(t) || !THAI.test(label)) return ''
  const prefix = (t.match(/^[^A-Za-z0-9]*/) || [''])[0].trim()
  return (prefix ? prefix + ' ' : '') + label
}

function fix(getLabel) {
  const el = document.querySelector('#main-content .page-title')
  if (!el || el.children.length || el.dataset.thTitle === el.textContent) return
  const next = thaiPageTitle(el.textContent, getLabel())
  if (!next) return
  if (!el.title) el.title = el.textContent.trim()
  el.textContent = next
  el.dataset.thTitle = next
}

let started = false
export function initThaiTitles(getLabel) {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  // MutationObserver ทำงานก่อนเบราว์เซอร์วาดจอ → ไม่เห็นชื่ออังกฤษแวบขึ้นมา · งานเบา (หา .page-title ตัวเดียว)
  new MutationObserver(() => fix(getLabel)).observe(document.body, { childList: true, subtree: true })
}
