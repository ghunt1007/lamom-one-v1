/**
 * Consignment Vehicle — รถฝากขาย (ผู้ฝากนำรถมาฝากโชว์รูมขาย รับค่าคอม)
 * Route: /dms/consignment
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_ITEMS = [
  { id: 'CS-001', owner: 'คุณสมศักดิ์', phone: '081-234-5678', model: 'BYD Atto 3 (2023)', plate: 'กข-1122', ask: 850000, floor: 800000, commPct: 5, start: '2026-05-10', status: 'selling' },
  { id: 'CS-002', owner: 'คุณวันดี', phone: '089-555-7788', model: 'MG ZS EV (2022)', plate: '1กก-3344', ask: 620000, floor: 590000, commPct: 5, start: '2026-04-22', status: 'selling' },
  { id: 'CS-003', owner: 'บ.รุ่งเรือง', phone: '02-111-2222', model: 'BYD Seal (2023)', plate: 'ขค-9090', ask: 1450000, floor: 1380000, commPct: 4, start: '2026-03-15', status: 'sold', soldAt: 1420000 },
]

const ST = {
  selling: { label: 'กำลังขาย', color: 'var(--primary)' },
  sold:    { label: 'ขายแล้ว', color: 'var(--success)' },
  returned:{ label: 'คืนผู้ฝาก', color: 'var(--text-muted)' },
}

export default async function ConsignmentVehiclePage(container) {
  const myGen = container.__routerGen
  let items = DEMO_ITEMS.map(i => ({ ...i }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('consignments', [], 'start', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `CS-${String(i+1).padStart(3,'0')}`,
        owner: d.owner || d.ownerName || '',
        phone: d.phone || '',
        model: d.model || '',
        plate: d.plate || '',
        ask: d.ask || d.askPrice || 0,
        floor: d.floor || d.floorPrice || 0,
        commPct: d.commPct || d.commissionPct || 5,
        start: d.start || d.startDate || new Date().toISOString().slice(0,10),
        status: d.status || 'selling',
        ...(d.soldAt ? { soldAt: d.soldAt } : {}),
      }))
      items = [...mapped, ...DEMO_ITEMS]
      dataSource = 'live'
    }
  } catch {}

  function daysOn(s) { return Math.floor((Date.now() - new Date(s).getTime()) / 86400000) }

  function render() {
    const selling = items.filter(i => i.status === 'selling')
    const totalAsk = selling.reduce((s, i) => s + i.ask, 0)
    const soldComm = items.filter(i => i.status === 'sold').reduce((s, i) => s + Math.round(i.soldAt * i.commPct / 100), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤝 รถฝากขาย (Consignment)</div>
            <div class="page-subtitle">รับรถจากผู้ฝากมาขาย รับค่าคอมมิชชั่นเมื่อปิดการขาย${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions"><button class="btn btn-primary" id="add-btn">➕ รับรถฝากขาย</button></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${stat('🚗 กำลังขาย', selling.length + ' คัน', 'var(--primary)')}
          ${stat('💰 มูลค่ารถในสต็อก', formatCurrency(totalAsk), 'var(--text)')}
          ${stat('🏆 ค่าคอมที่ได้แล้ว', formatCurrency(soldComm), 'var(--success)')}
        </div>

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:820px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
              <th style="padding:10px 12px">รหัส</th><th>ผู้ฝาก</th><th>รถ</th><th style="text-align:right">ราคาตั้งขาย</th>
              <th style="text-align:center">ค่าคอม</th><th style="text-align:center">ฝากมา</th><th style="text-align:center">สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              ${items.map(i => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:9px 12px;font-weight:600">${i.id}</td>
                  <td>${escHtml(i.owner)}<div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(i.phone)}</div></td>
                  <td>${escHtml(i.model)}<div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(i.plate)}</div></td>
                  <td style="text-align:right;font-weight:700">${formatCurrency(i.ask)}<div style="font-size:0.68rem;color:var(--text-muted);font-weight:400">ขั้นต่ำ ${formatCurrency(i.floor)}</div></td>
                  <td style="text-align:center">${i.commPct}%<div style="font-size:0.68rem;color:var(--success)">${formatCurrency(Math.round((i.status==='sold'?i.soldAt:i.ask)*i.commPct/100))}</div></td>
                  <td style="text-align:center;${daysOn(i.start)>60&&i.status==='selling'?'color:var(--danger);font-weight:700':''}">${daysOn(i.start)} วัน</td>
                  <td style="text-align:center"><span style="font-size:0.66rem;background:${ST[i.status].color};color:#fff;padding:2px 8px;border-radius:10px">${ST[i.status].label}</span></td>
                  <td style="text-align:right;padding-right:12px">${i.status==='selling'?`<button class="btn btn-xs btn-secondary sell-btn" data-id="${i.id}">ปิดการขาย</button>`:''}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 รถฝากเกิน 60 วันจะแสดงสีแดง — ควรเจรจาลดราคากับผู้ฝากหรือคืนรถ</p>
      </div>
    `

    container.querySelectorAll('.sell-btn').forEach(b => b.addEventListener('click', () => closeSale(b.dataset.id)))
    document.getElementById('add-btn')?.addEventListener('click', openAdd)
  }

  function closeSale(id) {
    const i = items.find(x => x.id === id)
    openModal({
      title: '💰 ปิดการขาย ' + escHtml(i.id),
      size: 'sm',
      body: `<div class="input-group" style="margin-bottom:10px"><label class="input-label">ราคาขายจริง</label><input class="input" type="number" id="cs-price" value="${i.ask}"></div>
        <div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);font-size:0.78rem">ค่าคอม ${i.commPct}% · ผู้ฝากได้รับ = ราคาขาย − ค่าคอม</div>`,
      confirmText: '✅ ปิดการขาย',
      onConfirm() {
        const price = parseInt(document.getElementById('cs-price').value)
        if (!price || price < i.floor) { showToast(`❗ ราคาต่ำกว่าขั้นต่ำ ${formatCurrency(i.floor)}`, 'error'); return false }
        i.status = 'sold'; i.soldAt = price
        const comm = Math.round(price * i.commPct / 100)
        showToast(`ขาย ${i.model} ที่ ${formatCurrency(price)} · ค่าคอม ${formatCurrency(comm)} · จ่ายผู้ฝาก ${formatCurrency(price-comm)}`, 'success')
        render()
      }
    })
  }

  function openAdd() {
    openModal({
      title: '➕ รับรถฝากขาย',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อผู้ฝาก *</label><input class="input" id="cs-owner"></div>
        <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="cs-phone"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ *</label><input class="input" id="cs-model" placeholder="เช่น BYD Atto 3 (2023)"></div>
        <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="cs-plate"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">ราคาตั้งขาย *</label><input class="input" type="number" id="cs-ask"></div>
          <div class="input-group" style="width:90px"><label class="input-label">ค่าคอม %</label><input class="input" type="number" id="cs-comm" value="5"></div>
        </div>
      </div>`,
      confirmText: '💾 บันทึก',
      onConfirm() {
        const owner = document.getElementById('cs-owner').value.trim()
        const model = document.getElementById('cs-model').value.trim()
        const ask = parseInt(document.getElementById('cs-ask').value)
        if (!owner || !model || !ask) { showToast('❗ กรอกข้อมูลที่จำเป็น', 'error'); return false }
        const id = 'CS-' + String(items.length + 1).padStart(3, '0')
        items.unshift({ id, owner, phone: document.getElementById('cs-phone').value.trim(), model,
          plate: document.getElementById('cs-plate').value.trim(), ask, floor: Math.round(ask*0.94),
          commPct: parseInt(document.getElementById('cs-comm').value) || 5,
          start: new Date().toISOString().slice(0,10), status: 'selling' })
        showToast(`รับรถฝากขาย ${model} จาก ${owner} แล้ว`, 'success')
        render()
      }
    })
  }

  function stat(label, value, color) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${label}</div><div style="font-size:1.4rem;font-weight:900;color:${color};margin-top:2px">${value}</div></div>`
  }

  render()
}
