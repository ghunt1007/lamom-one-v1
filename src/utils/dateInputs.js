// (v1.0.1029) ช่องกรอกวันที่/เวลาทั้งโปรแกรมแสดงเป็น DD/MM/YYYY และเวลา 24 ชม. เสมอ
// เดิมใช้ <input type="date|time"> ของเบราว์เซอร์ ซึ่งแสดงตามภาษาของเครื่อง — เครื่องที่ตั้งภาษาอังกฤษ (US)
// เห็นเป็น MM/DD/YYYY และเวลาเป็น AM/PM · ตัวนี้แปลงทุกช่องให้อัตโนมัติ (ไม่ต้องแก้ 160 จุดทีละหน้า):
//   - ช่องกลายเป็นช่องข้อความที่โชว์ "10/11/2569" / "14:30" แต่ .value ที่โค้ดอ่าน/เขียนยังเป็น '2026-11-10' / '14:30'
//     เหมือนเดิมทุกอย่าง (หน้าไหนเคยใช้ได้ ก็ยังใช้ได้)
//   - พิมพ์ได้เลย (ใส่ / ให้เอง) หรือกดที่ช่องเพื่อเลือกจากปฏิทิน / ตารางเวลา 00–23 น.
import { getDateEra } from './format.js'

const KINDS = ['date', 'time', 'datetime-local', 'month']
const PH = { date: 'วว/ดด/ปปปป', time: 'ชช:นน', 'datetime-local': 'วว/ดด/ปปปป ชช:นน', month: 'ดด/ปปปป' }
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const pad = n => String(n).padStart(2, '0')
const yOut = y => (getDateEra() === 'ce' ? y : y + 543)
// ปีที่พิมพ์มา → ค.ศ. (รับได้ทั้ง พ.ศ./ค.ศ. และเลข 2 หลัก)
export function yearIn(y) {
  y = Number(y)
  if (!y && y !== 0) return NaN
  if (y < 100) return getDateEra() === 'ce' ? 2000 + y : (y >= 40 ? 2500 + y - 543 : 2000 + y)
  return y > 2400 ? y - 543 : y
}
const validYmd = (y, m, d) => {
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1)) return false
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// ---- แปลงค่า (ใช้ทดสอบได้โดยไม่ต้องมีหน้าจอ) ----
export function toDisplay(kind, v) {
  v = String(v ?? '').trim()
  if (!v) return ''
  if (kind === 'time') { const m = v.match(/^(\d{1,2}):(\d{2})/); return m ? `${pad(m[1])}:${m[2]}` : v }
  if (kind === 'month') { const m = v.match(/^(\d{4})-(\d{2})$/); return m ? `${m[2]}/${yOut(+m[1])}` : v }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return v
  const d = `${m[3]}/${m[2]}/${yOut(+m[1])}`
  return kind === 'datetime-local' ? `${d} ${m[4] || '00'}:${m[5] || '00'}` : d
}

export function parseTime(s) {
  s = String(s || '').trim()
  let m = s.match(/^(\d{1,2})[:.\s](\d{1,2})$/) || s.match(/^(\d{2})(\d{2})$/)
  if (!m && /^\d{1,2}$/.test(s)) m = [s, s, '0']
  if (!m) return ''
  const h = +m[1], mi = +m[2]
  return h <= 23 && mi <= 59 ? `${pad(h)}:${pad(mi)}` : ''
}
export function parseDate(s) {
  s = String(s || '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return validYmd(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : ''
  m = s.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/) || s.match(/^(\d{2})(\d{2})(\d{4}|\d{2})$/)
  if (!m) return ''
  const y = yearIn(m[3]), mo = +m[2], d = +m[1]
  return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : ''
}
export function fromDisplay(kind, s) {
  s = String(s || '').trim()
  if (!s) return ''
  if (kind === 'time') return parseTime(s)
  if (kind === 'month') {
    let m = s.match(/^(\d{4})-(\d{1,2})$/)
    if (m) return +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${pad(m[2])}` : ''
    m = s.match(/^(\d{1,2})[/.\-\s](\d{2}|\d{4})$/)
    if (!m) return ''
    const y = yearIn(m[2])
    return +m[1] >= 1 && +m[1] <= 12 && y >= 1900 ? `${y}-${pad(m[1])}` : ''
  }
  if (kind === 'datetime-local') {
    const m = s.match(/^(.+?)(?:[ T]+(\d{1,2}[:.]\d{1,2}))?$/)
    const d = m && parseDate(m[1])
    if (!d) return ''
    const t = m[2] ? parseTime(m[2]) : '00:00'
    return t ? `${d}T${t}` : ''
  }
  return parseDate(s)
}

// ใส่ / และ : ให้ระหว่างพิมพ์ตัวเลข (พิมพ์ 10112569 → 10/11/2569)
export function autoMask(kind, s) {
  if (kind === 'time') {
    const d = s.replace(/\D/g, '')
    if (/^\d{3,4}$/.test(d) && !s.includes(':')) return d.length === 3 && +d.slice(0, 2) > 23 ? `0${d[0]}:${d.slice(1)}` : `${d.slice(0, 2)}:${d.slice(2)}`
    return s
  }
  if (kind === 'month') {
    const d = s.replace(/\D/g, '')
    if (!/[/]/.test(s) && d.length > 2) return `${d.slice(0, 2)}/${d.slice(2, 6)}`
    return s
  }
  const [datePart, ...rest] = s.split(' ')
  if (!/^[\d/]*$/.test(datePart)) return s
  // ส่วนวัน/เดือนที่ยาวเกิน 2 หลักโดยยังไม่มี / → ตัดใส่ / ให้ (รองรับทั้งพิมพ์รวด 10112569 และ 10/112569)
  const seg = datePart.split('/')
  while (seg.length < 3 && seg[seg.length - 1].length > 2) {
    const last = seg.pop()
    seg.push(last.slice(0, 2), last.slice(2))
  }
  seg[2] = seg[2]?.slice(0, 4)
  return [seg.filter((x, i) => i < 3 && (x !== undefined)).join('/'), ...rest].join(' ')
}

// ---- เปลี่ยนช่องบนหน้าจอ ----
const NATIVE = typeof HTMLInputElement !== 'undefined' ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') : null
const rawGet = el => NATIVE.get.call(el)
const rawSet = (el, v) => NATIVE.set.call(el, v)

function fire(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el._dtFired = el.value
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export function enhanceInput(inp) {
  const kind = inp.getAttribute('type')
  if (!KINDS.includes(kind) || inp._dtKind) return
  const iso = rawGet(inp)
  inp._dtKind = kind
  inp.type = 'text'
  inp.dataset.dt = kind
  inp.classList.add('dt-input')
  inp.autocomplete = 'off'
  inp.spellcheck = false
  inp.inputMode = 'numeric'
  if (!inp.placeholder) inp.placeholder = PH[kind]
  if (!inp.title) inp.title = kind === 'time' ? 'เวลา 24 ชม. (เช่น 14:30)' : 'วัน/เดือน/ปี — พิมพ์ได้เลย หรือกดเพื่อเลือกจากปฏิทิน'
  Object.defineProperty(inp, 'value', {
    configurable: true,
    get() { return fromDisplay(kind, rawGet(this)) },
    set(v) { rawSet(this, toDisplay(kind, v)); this.classList.remove('dt-bad') },
  })
  rawSet(inp, toDisplay(kind, iso))
  inp.defaultValue = toDisplay(kind, inp.defaultValue)
  inp._dtFired = inp.value

  inp.addEventListener('input', e => {
    if (e.isTrusted && e.inputType && e.inputType.startsWith('insert')) {
      const cur = rawGet(inp)
      const next = autoMask(kind, cur)
      if (next !== cur && inp.selectionStart === cur.length) rawSet(inp, next)
    }
    inp.classList.remove('dt-bad')
    inp.setCustomValidity?.('')
    // พิมพ์ครบเป็นวันที่ที่ถูกต้องแล้ว → แจ้ง change ทันที (เหมือนช่องวันที่เดิมของเบราว์เซอร์)
    if (e.isTrusted && inp.value && inp.value !== inp._dtFired) {
      inp._dtFired = inp.value
      inp.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, true)
  // change ของเบราว์เซอร์ตอนออกจากช่อง — ถ้าแจ้งค่านี้ไปแล้วไม่ต้องแจ้งซ้ำ
  inp.addEventListener('change', e => {
    if (!e.isTrusted) return
    if (inp.value === inp._dtFired) { e.stopImmediatePropagation(); return }
    inp._dtFired = inp.value
  }, true)
  inp.addEventListener('blur', () => {
    const txt = rawGet(inp).trim()
    if (!txt) return
    const v = fromDisplay(kind, txt)
    if (v) rawSet(inp, toDisplay(kind, v))
    else { inp.classList.add('dt-bad'); inp.setCustomValidity?.(`รูปแบบ ${PH[kind]}`) }
  })
  inp.addEventListener('click', () => { if (!inp.disabled && !inp.readOnly) openPicker(inp) })
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop) closePicker()
    else if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); openPicker(inp) }
  })
}

// ---- ปฏิทิน / ตารางเวลา ----
let pop = null, popFor = null, view = null
function closePicker() {
  pop?.remove(); pop = null; popFor = null
  document.removeEventListener('pointerdown', outside, true)
  window.removeEventListener('resize', closePicker)
  window.removeEventListener('scroll', place, true)
}
function outside(e) { if (pop && !pop.contains(e.target) && e.target !== popFor) closePicker() }

function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function openPicker(inp) {
  if (popFor === inp) return
  closePicker()
  const kind = inp._dtKind
  const v = inp.value
  const base = (kind === 'time' ? '' : kind === 'month' ? (v ? v + '-01' : '') : v.slice(0, 10)) || todayYmd()
  view = { y: +base.slice(0, 4), m: +base.slice(5, 7), mode: kind === 'month' ? 'months' : 'days', hour: (kind === 'time' ? v : v.slice(11, 16)).slice(0, 2) }
  pop = document.createElement('div')
  pop.className = 'dt-pop'
  pop.setAttribute('role', 'dialog')
  // กดในปฏิทินแล้วช่องยังโฟกัสอยู่ (ตาราง Sheet ที่บันทึกตอนออกจากช่องจะไม่ปิดก่อนเลือกเสร็จ)
  pop.addEventListener('pointerdown', e => e.preventDefault())
  pop.addEventListener('mousedown', e => e.preventDefault())
  pop.addEventListener('click', e => onPick(e, inp))
  document.body.appendChild(pop)
  popFor = inp
  render(inp)
  place()
  document.addEventListener('pointerdown', outside, true)
  window.addEventListener('resize', closePicker)
  window.addEventListener('scroll', place, true)
}

function place() {
  if (!pop || !popFor) return
  if (!popFor.isConnected) { closePicker(); return }
  const r = popFor.getBoundingClientRect()
  const vw = window.innerWidth, vh = window.innerHeight
  const w = Math.min(pop.offsetWidth || 300, vw - 16)
  const h = pop.offsetHeight || 320
  let left = Math.min(Math.max(8, r.left), vw - w - 8)
  let top = r.bottom + 4
  if (top + h > vh - 8 && r.top - h - 4 > 8) top = r.top - h - 4
  if (top + h > vh - 8) top = Math.max(8, vh - h - 8)
  pop.style.left = left + 'px'
  pop.style.top = top + 'px'
}

function render(inp) {
  const kind = inp._dtKind
  const cur = inp.value
  const curDay = kind === 'time' ? '' : kind === 'month' ? '' : cur.slice(0, 10)
  const curTime = kind === 'time' ? cur : cur.slice(11, 16)
  const today = todayYmd()
  let html = ''
  if (kind !== 'time') {
    if (view.mode === 'months') {
      html += `<div class="dt-head"><button type="button" class="dt-nav" data-a="py">‹</button><b>${yOut(view.y)}</b><button type="button" class="dt-nav" data-a="ny">›</button></div>
        <div class="dt-months">${MON_S.map((n, i) => {
          const on = kind === 'month' ? cur === `${view.y}-${pad(i + 1)}` : view.m === i + 1
          return `<button type="button" class="dt-mo${on ? ' on' : ''}" data-mo="${i + 1}">${n}</button>`
        }).join('')}</div>`
    } else {
      const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay()
      const days = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate()
      const cells = []
      for (let i = 0; i < first; i++) cells.push('<span></span>')
      for (let d = 1; d <= days; d++) {
        const ymd = `${view.y}-${pad(view.m)}-${pad(d)}`
        const cls = ['dt-d', ymd === curDay && 'on', ymd === today && 'today', (inp.min && ymd < inp.getAttribute('min')) || (inp.max && ymd > inp.getAttribute('max')) ? 'off' : ''].filter(Boolean).join(' ')
        cells.push(`<button type="button" class="${cls}" data-d="${ymd}">${d}</button>`)
      }
      html += `<div class="dt-head"><button type="button" class="dt-nav" data-a="pm" aria-label="เดือนก่อน">‹</button><button type="button" class="dt-title" data-a="months">${MONTHS[view.m - 1]} ${yOut(view.y)}</button><button type="button" class="dt-nav" data-a="nm" aria-label="เดือนหน้า">›</button></div>
        <div class="dt-week">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(w => `<span>${w}</span>`).join('')}</div>
        <div class="dt-days">${cells.join('')}</div>`
    }
  }
  if (kind === 'time' || kind === 'datetime-local') {
    const hh = view.hour || curTime.slice(0, 2)
    html += `<div class="dt-tlabel">ชั่วโมง (24 ชม.)</div><div class="dt-hours">${Array.from({ length: 24 }, (_, h) => `<button type="button" class="dt-h${pad(h) === hh ? ' on' : ''}" data-h="${pad(h)}">${pad(h)}</button>`).join('')}</div>
      <div class="dt-tlabel">นาที</div><div class="dt-mins">${Array.from({ length: 12 }, (_, i) => { const m = pad(i * 5); return `<button type="button" class="dt-m${curTime.slice(3, 5) === m && curTime.slice(0, 2) === hh ? ' on' : ''}" data-m="${m}">:${m}</button>` }).join('')}</div>`
  }
  const quick = kind === 'time' ? `<button type="button" data-a="now">ตอนนี้</button>` : kind === 'month' ? `<button type="button" data-a="thism">เดือนนี้</button>` : `<button type="button" data-a="today">วันนี้</button>`
  html += `<div class="dt-foot">${quick}<button type="button" data-a="clear">ล้าง</button><button type="button" data-a="close">ปิด</button></div>`
  pop.innerHTML = html
  pop.dataset.kind = kind
}

function nowHm() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
}

function setVal(inp, v, close = true) {
  inp.value = v
  fire(inp)
  if (close) closePicker(); else render(inp)
}

function onPick(e, inp) {
  const b = e.target.closest('button')
  if (!b || !pop) return
  const kind = inp._dtKind
  const a = b.dataset.a
  const curT = kind === 'datetime-local' ? (inp.value.slice(11, 16) || '') : ''
  if (a === 'pm' || a === 'nm') { const t = view.y * 12 + view.m - 1 + (a === 'pm' ? -1 : 1); view.y = Math.floor(t / 12); view.m = t % 12 + 1; render(inp); return }
  if (a === 'py' || a === 'ny') { view.y += a === 'py' ? -1 : 1; render(inp); return }
  if (a === 'months') { view.mode = 'months'; render(inp); return }
  if (a === 'close') { closePicker(); return }
  if (a === 'clear') { setVal(inp, ''); return }
  if (a === 'today') { const t = todayYmd(); setVal(inp, kind === 'datetime-local' ? `${t}T${curT || nowHm()}` : t, kind !== 'datetime-local'); return }
  if (a === 'thism') { setVal(inp, todayYmd().slice(0, 7)); return }
  if (a === 'now') { setVal(inp, nowHm()); return }
  if (b.dataset.mo) {
    view.m = +b.dataset.mo
    if (kind === 'month') { setVal(inp, `${view.y}-${pad(view.m)}`); return }
    view.mode = 'days'; render(inp); return
  }
  if (b.dataset.d) {
    if (b.classList.contains('off')) return
    if (kind === 'datetime-local') { setVal(inp, `${b.dataset.d}T${curT || '09:00'}`, false); return }
    setVal(inp, b.dataset.d); return
  }
  if (b.dataset.h) {
    view.hour = b.dataset.h
    const mm = (kind === 'time' ? inp.value : curT).slice(3, 5) || '00'
    if (kind === 'time') setVal(inp, `${view.hour}:${mm}`, false)
    else setVal(inp, `${inp.value.slice(0, 10) || todayYmd()}T${view.hour}:${mm}`, false)
    return
  }
  if (b.dataset.m) {
    const hh = view.hour || (kind === 'time' ? inp.value : curT).slice(0, 2) || '09'
    if (kind === 'time') setVal(inp, `${hh}:${b.dataset.m}`)
    else setVal(inp, `${inp.value.slice(0, 10) || todayYmd()}T${hh}:${b.dataset.m}`)
  }
}

function scan(root) {
  if (root.nodeType !== 1) return
  if (root.tagName === 'INPUT') { enhanceInput(root); return }
  if (!root.firstElementChild) return
  root.querySelectorAll('input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"]').forEach(enhanceInput)
}

let started = false
export function initDateInputs() {
  if (started || typeof MutationObserver === 'undefined' || !NATIVE) return
  started = true
  scan(document.body)
  // MutationObserver ทำงานก่อนเบราว์เซอร์วาดจอ → ไม่เห็นช่องแบบเดิมแวบขึ้นมา
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') { if (m.target.tagName === 'INPUT') enhanceInput(m.target); continue }
      m.addedNodes.forEach(scan)
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] })
}
