// เซลล์ตรวจรถก่อนส่งมอบ — Sales Pre-Delivery Check (ผูกกับใบจอง)
// ต่างจาก PDI ของช่าง: เป็นเช็คลิสต์ฝั่งเซลส์ก่อนส่งมอบให้ลูกค้า + พิมพ์ใบตรวจรับมอบ
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { printDocument, docHeader, docFooter, esc } from '../../utils/print.js'

// เช็คลิสต์ฝั่งเซลส์ (กลุ่ม) — แต่ละข้อ pass/fail/na
const CHECKLIST = {
  clean: { label: '🧽 ความสะอาด & สภาพ', items: ['ล้างรถ/เคลือบเงาเรียบร้อย', 'ภายในสะอาด ดูดฝุ่นแล้ว', 'ไม่มีรอยขีดข่วน/บุบ', 'กระจกใส ไม่มีคราบ'] },
  energy: { label: '🔋 พลังงาน & ยาง', items: ['ชาร์จแบต ≥ 80% / น้ำมันเต็ม', 'ลมยางครบ 4 ล้อ + อะไหล่', 'ยางสภาพดี ไม่มีตำหนิ'] },
  equip: { label: '🧰 อุปกรณ์ & ของแถม', items: ['กุญแจหลัก + สำรองครบ', 'สายชาร์จ / อแดปเตอร์', 'คู่มือรถ + สมุดรับประกัน', 'ยางอะไหล่ + ชุดเครื่องมือ', 'ของแถมตามโปรโมชั่นติดตั้งครบ', 'ฟิล์มกรองแสง (ถ้ามี)'] },
  docs: { label: '📄 เอกสาร', items: ['ป้ายแดง / เล่มทะเบียน', 'กรมธรรม์ประกันภัย', 'สัญญา / ใบส่งมอบรถ', 'ใบกำกับภาษี / ใบเสร็จ'] },
  customer: { label: '🙋 ส่งมอบลูกค้า', items: ['อธิบายฟีเจอร์ + แอปพลิเคชัน', 'สอนวิธีชาร์จ / เติมพลังงาน', 'แนะนำทีมบริการ + นัดเช็คระยะแรก', 'ลูกค้าตรวจรับสภาพรถแล้ว'] },
}
const ITEM_LABEL = { pass: '✅ ผ่าน', fail: '❌ แก้ไข', na: '⬜ ไม่เกี่ยว' }

// สถานะใบจองที่ "รอส่งมอบ" → ต้องตรวจก่อนส่ง
const PENDING_STATUSES = ['รอส่งมอบ', 'รอรถ', 'ยอดจองคงค้าง', 'รอผลไฟแนนซ์']

function buildItems() {
  const o = {}
  Object.entries(CHECKLIST).forEach(([k, v]) => { o[k] = v.items.map(text => ({ text, status: 'na' })) })
  return o
}
function flat(items) { return Object.values(items || {}).flat() }

export default async function PreDeliveryPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let bookings = []
  let filter = 'pending'  // pending | ready | all

  async function loadData() {
    try { bookings = await listDocs('bookings', [], 'createdAt', 'desc', 500) } catch {}
    bookings = bookings.filter(b => b.status !== 'ถอนจอง')
    bookings.forEach(b => { if (!b.pdItems) b.pdItems = buildItems() })
    render()
  }

  function readiness(b) {
    const all = flat(b.pdItems)
    const checked = all.filter(i => i.status !== 'na').length
    const failed = all.filter(i => i.status === 'fail').length
    const pass = all.filter(i => i.status === 'pass').length
    return { total: all.length, checked, failed, pass, pct: all.length ? Math.round(checked / all.length * 100) : 0 }
  }
  function isReady(b) { const r = readiness(b); return r.failed === 0 && r.checked === r.total }

  function getList() {
    return bookings.filter(b => {
      if (filter === 'all') return true
      if (filter === 'ready') return b.pdReady
      return !b.pdReady  // pending
    })
  }

  function render() {
    const pending = bookings.filter(b => !b.pdReady).length
    const ready = bookings.filter(b => b.pdReady).length

    container.innerHTML =
      '<div class="page-content animate-slide">' +
        '<div class="page-header"><div>' +
          '<div class="page-title">✅ เซลล์ตรวจรถก่อนส่งมอบ</div>' +
          '<div class="page-subtitle">Sales Pre-Delivery Check — ตรวจความพร้อมก่อนส่งมอบลูกค้า (อิงใบจอง)</div>' +
        '</div></div>' +
        '<div class="grid-4 mb-6">' +
          card('🚗 ใบจองทั้งหมด', bookings.length + ' คัน', 'primary') +
          card('⏳ รอตรวจ/ส่งมอบ', pending + ' คัน', pending ? 'warning' : 'secondary') +
          card('✅ พร้อมส่งมอบ', ready + ' คัน', 'success') +
          card('📋 รายการตรวจ', flat(buildItems()).length + ' ข้อ/คัน', 'accent') +
        '</div>' +
        '<div class="card mb-4" style="padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
          '<span style="font-size:0.82rem;color:var(--text-muted)">แสดง:</span>' +
          tab('pending', '⏳ รอตรวจ') + tab('ready', '✅ พร้อมส่งมอบ') + tab('all', 'ทั้งหมด') +
        '</div>' +
        '<div id="pd-list" style="display:flex;flex-direction:column;gap:8px"></div>' +
      '</div>'

    renderList()
    container.querySelectorAll('.pd-tab').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f
      container.querySelectorAll('.pd-tab').forEach(x => x.className = 'btn btn-sm pd-tab ' + (x.dataset.f === filter ? 'btn-primary' : 'btn-secondary'))
      renderList()
    }))
  }

  function tab(f, label) { return '<button class="btn btn-sm pd-tab ' + (f === filter ? 'btn-primary' : 'btn-secondary') + '" data-f="' + f + '">' + label + '</button>' }

  function renderList() {
    const wrap = container.querySelector('#pd-list')
    if (!wrap) return
    const list = getList()
    if (!list.length) { wrap.innerHTML = '<div class="empty-state" style="padding:48px"><div class="empty-icon">✅</div><div class="empty-title">ไม่มีรายการ</div></div>'; return }
    wrap.innerHTML = list.map(b => {
      const r = readiness(b)
      const car = [b.brand, b.model, b.variant].filter(Boolean).join(' ')
      const barColor = b.pdReady ? 'var(--success)' : r.failed ? 'var(--danger)' : 'var(--primary)'
      return '<div class="card" style="padding:14px 16px;border-left:3px solid ' + (b.pdReady ? 'var(--success)' : 'var(--warning)') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<span style="font-weight:700">' + esc(b.bookingNo || '') + '</span>' +
              '<span style="font-weight:600">' + esc(b.custName || '') + '</span>' +
              (b.pdReady ? '<span class="badge badge-success">✅ พร้อมส่งมอบ</span>' : '<span class="badge badge-warning">⏳ ' + esc(b.status || '') + '</span>') +
            '</div>' +
            '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">' + esc(car) + ' · ' + esc(b.colorOut || '') + ' · นัดส่งมอบ ' + formatDate(b.deliveryDate) + '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
              '<div style="flex:1;max-width:280px;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + r.pct + '%;background:' + barColor + '"></div></div>' +
              '<span style="font-size:0.74rem;color:var(--text-muted)">ตรวจ ' + r.checked + '/' + r.total + (r.failed ? ' · <span style="color:var(--danger)">ต้องแก้ ' + r.failed + '</span>' : '') + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-shrink:0">' +
            '<button class="btn btn-primary btn-sm pd-open" data-id="' + b.id + '">📝 ตรวจรถ</button>' +
            (b.pdReady ? '<button class="btn btn-secondary btn-sm pd-print" data-id="' + b.id + '">🖨 ใบตรวจรับมอบ</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>'
    }).join('')

    wrap.querySelectorAll('.pd-open').forEach(btn => btn.addEventListener('click', () => openChecklist(bookings.find(b => b.id === btn.dataset.id))))
    wrap.querySelectorAll('.pd-print').forEach(btn => btn.addEventListener('click', () => printHandover(bookings.find(b => b.id === btn.dataset.id))))
  }

  function openChecklist(b) {
    if (!b) return
    const car = [b.brand, b.model, b.variant].filter(Boolean).join(' ')
    const build = () => Object.entries(CHECKLIST).map(([key, sec]) =>
      '<div style="margin-bottom:14px">' +
        '<div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;color:var(--primary)">' + sec.label + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px">' +
        b.pdItems[key].map((it, i) =>
          '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface-2);border-radius:6px">' +
            '<div style="display:flex;gap:3px">' +
              '<button class="btn btn-xs pd-i ' + (it.status === 'pass' ? 'btn-success' : 'btn-secondary') + '" data-k="' + key + '" data-i="' + i + '" data-v="pass">✅</button>' +
              '<button class="btn btn-xs pd-i ' + (it.status === 'fail' ? 'btn-danger' : 'btn-secondary') + '" data-k="' + key + '" data-i="' + i + '" data-v="fail">❌</button>' +
              '<button class="btn btn-xs pd-i ' + (it.status === 'na' ? 'btn-primary' : 'btn-secondary') + '" data-k="' + key + '" data-i="' + i + '" data-v="na">⬜</button>' +
            '</div>' +
            '<span style="flex:1;font-size:0.82rem;' + (it.status === 'fail' ? 'color:var(--danger);font-weight:600' : '') + '">' + esc(it.text) + '</span>' +
          '</div>'
        ).join('') +
        '</div>' +
      '</div>'
    ).join('')

    const { el, close } = openModal({
      title: '📝 ตรวจก่อนส่งมอบ — ' + esc(b.bookingNo || '') + ' · ' + esc(car), size: 'lg',
      body: '<div id="pd-body">' + build() + '</div>' +
        '<div class="input-group" style="margin-top:10px"><label class="input-label">หมายเหตุ / สิ่งที่ต้องแก้ไข</label><textarea class="input" id="pd-note" rows="2">' + esc(b.pdNote || '') + '</textarea></div>',
      footer: '<button class="btn btn-secondary" id="pd-save">💾 บันทึกร่าง</button>' +
              '<button class="btn btn-success" id="pd-ready">✅ ยืนยันพร้อมส่งมอบ</button>'
    })

    function bind() {
      el.querySelectorAll('.pd-i').forEach(btn => btn.addEventListener('click', () => {
        b.pdItems[btn.dataset.k][+btn.dataset.i].status = btn.dataset.v
        el.querySelector('#pd-body').innerHTML = build(); bind()
      }))
    }
    bind()

    el.querySelector('#pd-save').addEventListener('click', async () => {
      b.pdNote = el.querySelector('#pd-note').value
      await updateDocData('bookings', b.id, { pdItems: b.pdItems, pdNote: b.pdNote }).catch(() => {})
      showToast('💾 บันทึกแล้ว', 'success'); close(); render()
    })
    el.querySelector('#pd-ready').addEventListener('click', async () => {
      b.pdNote = el.querySelector('#pd-note').value
      const r = readiness(b)
      if (r.failed > 0) { showToast('⚠️ ยังมี ' + r.failed + ' รายการต้องแก้ไข', 'warning'); return }
      if (r.checked < r.total) { showToast('⚠️ ตรวจยังไม่ครบทุกข้อ', 'warning'); return }
      b.pdReady = true; b.pdReadyDate = new Date().toISOString().slice(0, 10)
      await updateDocData('bookings', b.id, { pdItems: b.pdItems, pdNote: b.pdNote, pdReady: true, pdReadyDate: b.pdReadyDate }).catch(() => {})
      showToast('✅ ยืนยันพร้อมส่งมอบแล้ว!', 'success'); close(); render()
    })
  }

  function printHandover(b) {
    if (!b) return
    const car = [b.brand, b.model, b.variant].filter(Boolean).join(' ')
    const rows = Object.entries(CHECKLIST).map(([key, sec]) =>
      '<tr><td colspan="2" style="background:#f1f5f9;font-weight:700">' + esc(sec.label) + '</td></tr>' +
      b.pdItems[key].map(it => '<tr><td>' + esc(it.text) + '</td><td class="num" style="text-align:center;width:90px">' + (ITEM_LABEL[it.status] || '') + '</td></tr>').join('')
    ).join('')

    const html =
      '<div class="doc">' +
      docHeader('ใบตรวจรับมอบรถ / Pre-Delivery Check', b.bookingNo, formatDate(b.pdReadyDate)) +
      '<table class="kv"><tbody>' +
        '<tr><td class="lbl">ลูกค้า</td><td class="val">' + esc(b.custName) + '</td><td class="lbl">รถ</td><td class="val">' + esc(car) + '</td></tr>' +
        '<tr><td class="lbl">VIN</td><td class="val">' + esc(b.vin || '-') + '</td><td class="lbl">สี</td><td class="val">' + esc(b.colorOut || '-') + '</td></tr>' +
        '<tr><td class="lbl">เซลส์</td><td class="val">' + esc(b.salesName || '-') + '</td><td class="lbl">นัดส่งมอบ</td><td class="val">' + formatDate(b.deliveryDate) + '</td></tr>' +
      '</tbody></table>' +
      '<table class="grid" style="margin-top:12px"><thead><tr><th>รายการตรวจ</th><th class="num" style="text-align:center">ผล</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (b.pdNote ? '<div class="note-box">📝 หมายเหตุ: ' + esc(b.pdNote) + '</div>' : '') +
      '<div class="sign-row">' +
        '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้ตรวจ (เซลส์)</div><div class="sign-cap">(' + esc(b.salesName || '') + ')</div></div>' +
        '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ลูกค้าผู้รับมอบ</div><div class="sign-cap">(' + esc(b.custName || '') + ')</div></div>' +
      '</div>' +
      docFooter() +
      '</div>'

    printDocument(html, { title: 'ใบตรวจรับมอบ ' + (b.bookingNo || '') })
  }

  if (container.__routerGen === myGen) await loadData()
}

function card(label, value, color) {
  return '<div class="card" style="padding:16px 18px;border-left:3px solid var(--' + color + ')">' +
    '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">' + label + '</div>' +
    '<div style="font-size:1.3rem;font-weight:800;color:var(--' + color + ')">' + value + '</div></div>'
}
