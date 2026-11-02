// (v1.0.912) แก้ "พิมพ์ได้ตัวเดียวแล้วเด้ง ต้องคลิกช่องใหม่"
//
// สาเหตุ: หลายหน้าพอพิมพ์ในช่องค้นหา จะวาดหน้าใหม่ทั้งหน้า (container.innerHTML = ...)
// ช่องที่กำลังพิมพ์จึงถูกลบทิ้งแล้วสร้างใหม่ → เคอร์เซอร์หลุด คีย์บอร์ดมือถือปิด ตัวอักษรถัดไปหายไป
//
// แก้ 2 ชั้น:
// 1) renderKeepFocus(el, html) — ใช้แทน el.innerHTML = html ในหน้าที่วาดใหม่ตอนพิมพ์
//    วาดทุกอย่างใหม่เหมือนเดิม ยกเว้น "ช่องที่กำลังพิมพ์" (และกล่องที่ห่อมันอยู่) ซึ่งเก็บตัวเดิมไว้
//    ช่องจึงไม่เคยหลุดโฟกัส ตัวอักษรที่พิมพ์ (รวมเว้นวรรค/ตัวใหญ่) อยู่ครบ และคำแนะนำคีย์บอร์ดไม่ขาด
// 2) initFocusGuard() — ตาข่ายกันพลาดทั้งแอป: ถ้าช่องที่เพิ่งพิมพ์ถูกลบแล้วมีช่องใหม่ id เดียวกันขึ้นมาแทน
//    (เช่นในหน้าต่าง/หน้าที่ยังไม่ได้แก้) จะย้ายเคอร์เซอร์กลับไปที่ช่องใหม่ตำแหน่งเดิมให้ทันที

const TEXTY = /^(text|search|tel|email|url|number|password|)$/

export function isTextField(el) {
  if (!el || !el.tagName) return false
  if (el.tagName === 'TEXTAREA') return true
  return el.tagName === 'INPUT' && TEXTY.test((el.getAttribute('type') || '').toLowerCase())
}

function caretOf(el) {
  try { return [el.selectionStart, el.selectionEnd] } catch { return null }
}
function setCaret(el, c) {
  if (!c || c[0] == null) return
  try { el.setSelectionRange(c[0], c[1]) } catch { /* number inputs ไม่มี selection */ }
}

// ชื่อประจำช่อง ใช้จับคู่ช่องเก่ากับช่องใหม่: id → name → data-* ทั้งหมด
export function fieldKey(el) {
  if (!isTextField(el)) return ''
  if (el.id) return '#' + el.id
  const name = el.getAttribute('name')
  if (name) return el.tagName + '[name=' + name + ']'
  const data = [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).sort().join('&')
  return data ? el.tagName + '[' + data + ']' : ''
}
function findField(root, key) {
  if (!key) return null
  for (const el of root.querySelectorAll('input,textarea')) if (fieldKey(el) === key) return el
  return null
}

function copyAttrs(from, to, skip) {
  for (const a of [...to.attributes]) if (!from.hasAttribute(a.name) && !skip.has(a.name)) to.removeAttribute(a.name)
  for (const a of from.attributes) if (!skip.has(a.name) && to.getAttribute(a.name) !== a.value) to.setAttribute(a.name, a.value)
}

// ระหว่างที่หน้ากำลังผูกปุ่ม/ช่องใหม่หลังวาด ตัวที่เก็บไว้ (ช่องที่พิมพ์ + กล่องห่อ) มีตัวรับเหตุการณ์ชุดเดิมอยู่แล้ว
// จึงข้ามการผูกซ้ำจนจบรอบนี้ ไม่งั้นทุกตัวอักษรจะเพิ่มตัวรับซ้อนขึ้นเรื่อยๆ
function muteListeners(nodes) {
  for (const n of nodes) n.addEventListener = function () {}
  const undo = () => { for (const n of nodes) delete n.addEventListener }
  if (typeof queueMicrotask === 'function') queueMicrotask(undo); else Promise.resolve().then(undo)
}

/**
 * ใช้แทน el.innerHTML = html — เหมือนเดิมทุกอย่าง แต่ถ้ากำลังพิมพ์อยู่ในช่องใน el
 * และหน้าใหม่ยังมีช่อง id เดียวกัน ช่องนั้นจะไม่ถูกลบ (ไม่หลุดโฟกัส)
 * คืนค่า true ถ้าเก็บช่องเดิมไว้ได้
 */
export function renderKeepFocus(el, html) {
  const doc = el && el.ownerDocument
  const active = doc && doc.activeElement
  const key = active && active !== el && el.contains(active) ? fieldKey(active) : ''
  if (!key) {
    el.innerHTML = html
    return false
  }
  const tpl = doc.createElement(el.tagName === 'TBODY' || el.tagName === 'TABLE' ? 'div' : el.tagName)
  tpl.innerHTML = html
  const next = findField(tpl, key)
  // ทางเดินจาก el ลงไปถึงช่องที่พิมพ์ ต้องลึกเท่ากันและเป็นแท็กเดียวกัน ไม่งั้นวาดใหม่ธรรมดา
  const pathLive = []; for (let n = active; n && n !== el; n = n.parentNode) pathLive.unshift(n)
  const pathNew = []; for (let n = next; n && n !== tpl; n = n.parentNode) pathNew.unshift(n)
  const sameShape = next && isTextField(next) && pathLive.length === pathNew.length &&
    pathLive.every((n, i) => n.tagName === pathNew[i].tagName)
  if (!sameShape) {
    const caret = caretOf(active), val = active.value
    el.innerHTML = html
    // ช่องหน้าตาเปลี่ยนไปมาก — อย่างน้อยย้ายเคอร์เซอร์ไปช่องใหม่
    const again = findField(el, key)
    if (again && isTextField(again)) { if (again.value !== val && sameish(again.value, val)) again.value = val; again.focus(); setCaret(again, caret) }
    return false
  }
  // ไล่ทีละชั้น: แทนพี่น้องทั้งหมดด้วยของใหม่ เก็บไว้เฉพาะตัวที่อยู่บนทางเดิน
  let liveParent = el, newParent = tpl
  for (let i = 0; i < pathLive.length; i++) {
    const keep = pathLive[i], counterpart = pathNew[i]
    const before = [], after = []
    let seen = false
    for (const c of [...newParent.childNodes]) { if (c === counterpart) seen = true; else (seen ? after : before).push(c) }
    for (const c of [...liveParent.childNodes]) if (c !== keep) liveParent.removeChild(c)
    for (const c of before) liveParent.insertBefore(c, keep)
    for (const c of after) liveParent.appendChild(c)
    if (i < pathLive.length - 1) {
      copyAttrs(counterpart, keep, new Set())
      liveParent = keep; newParent = counterpart
    } else {
      // ตัวช่องเอง: อัปเดตหน้าตา (class/placeholder) แต่ไม่แตะค่าที่ผู้ใช้กำลังพิมพ์
      copyAttrs(counterpart, keep, new Set(['value']))
    }
  }
  muteListeners(pathLive)
  return true
}

// ค่าเดียวกันแค่ต่างตัวพิมพ์เล็ก/ใหญ่หรือช่องว่างหัวท้าย (หลายหน้าเก็บคำค้นแบบ trim().toLowerCase())
function sameish(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
}

let guardOn = false
/**
 * ตาข่ายกันพลาดทั้งแอป — เรียกครั้งเดียวตอนเปิดแอป
 * ถ้าช่องที่ผู้ใช้กำลังใช้อยู่ถูกลบออกจากหน้า (หน้าวาดใหม่ / ข้อมูลอัปเดตสด) แล้วมีช่องชื่อเดียวกันขึ้นมาแทน
 * จะย้ายเคอร์เซอร์ไปช่องใหม่ ตำแหน่งเดิม พร้อมคืนตัวอักษรที่พิมพ์ไว้ (ถ้าหน้าเผลอตัดเว้นวรรค/เปลี่ยนตัวพิมพ์)
 * ถ้าผู้ใช้คลิกออกไปเอง หรือย้ายไปช่องอื่น จะไม่ยุ่ง
 */
export function initFocusGuard(root = typeof document !== 'undefined' ? document : null) {
  if (guardOn || !root || typeof MutationObserver === 'undefined') return
  guardOn = true
  let rec = null // ช่องที่กำลังใช้อยู่ { el, key, value, caret, inModal }
  const track = e => {
    const el = e.target
    const key = fieldKey(el)
    if (!key) return
    if (rec && rec.el === el) { rec.value = el.value; rec.caret = caretOf(el); return }
    rec = { el, key, value: el.value, caret: caretOf(el), inModal: !!(el.closest && el.closest('.modal-overlay')) }
  }
  const later = fn => (typeof queueMicrotask === 'function' ? queueMicrotask(fn) : Promise.resolve().then(fn))
  const rescue = () => {
    const r = rec
    if (!r || r.el.isConnected) return
    rec = null
    const a = root.activeElement
    if (a && a !== root.body && a !== root.documentElement) return // โฟกัสไปอยู่ที่อื่นแล้ว
    let fresh = null
    for (const el of root.querySelectorAll('input,textarea')) {
      if (fieldKey(el) !== r.key || el.disabled || el.readOnly) continue
      if (!!el.closest('.modal-overlay') !== r.inModal) continue
      fresh = el; break
    }
    if (!fresh) return
    if (fresh.value !== r.value && sameish(fresh.value, r.value)) fresh.value = r.value
    fresh.focus({ preventScroll: true })
    setCaret(fresh, r.caret)
  }
  root.addEventListener('focusin', track, true)
  root.addEventListener('input', track, true)
  root.addEventListener('keyup', track, true)
  root.addEventListener('compositionend', track, true)
  root.addEventListener('focusout', e => {
    const el = e.target
    if (!rec || rec.el !== el) return
    // ยังอยู่ในหน้า = ผู้ใช้คลิกออกไปเอง → เลิกติดตาม / ถูกลบทิ้ง = หน้าวาดใหม่ → พากลับ
    later(() => { if (rec && rec.el === el) { if (el.isConnected) rec = null; else rescue() } })
  }, true)
  new MutationObserver(() => { if (rec && !rec.el.isConnected) rescue() })
    .observe(root.documentElement || root, { childList: true, subtree: true })
}
