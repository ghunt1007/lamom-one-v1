import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { navigate } from '../../core/router.js'
import { pickVehicle } from '../../utils/vehiclePicker.js'
import { getSalesStaff, getColors, getFinanceCompanies, getFinanceStatus, getCampaigns, getBookingStatus, getLeadSources } from '../../data/masterData.js'
import { printBooking, printCancellation } from '../../utils/bookingDocs.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// สถานะใบจอง (แบบ LAMOM V8)
const STATUS_BADGE = {
  'รอผลไฟแนนซ์': 'warning', 'รอรถ': 'primary', 'รอส่งมอบ': 'accent',
  'ส่งมอบแล้ว': 'success', 'ยอดจองคงค้าง': 'primary', 'ถอนจอง': 'danger',
}
function badge(status) { return STATUS_BADGE[status] || 'primary' }

const DEMO_BOOKINGS = [
  { id:'bk1', bookingNo:'SK2506001', custName:'ธีรพงศ์ แสงทอง', nid:'1234567890123', phone:'0812345678', address:'88 ถ.สุขุมวิท', province:'กรุงเทพฯ', source:'Walk-in',
    brand:'BYD', model:'Seal', variant:'AWD Performance', colorOut:'ขาว Pearl', colorIn:'ดำ', vin:'LGXCE4C10PA000001', motorNo:'', batNo:'',
    price:1299000, down:200000, financeCo:'BAY', financeAmount:1099000, finStatus:'ผ่าน', installments:60, interestRate:2.25, monthly:19800, campaign:'ดอกเบี้ยปกติ',
    bookingDate:'2025-06-01', submitDate:'2025-06-01', approveDate:'2025-06-03', signDate:'2025-06-05', deliveryDate:'2025-06-20', actualDeliveryDate:'',
    salesName:'อรนุช เซลส์ดี', cost:1274000, margin:25000, budgetUsed:5000, com70:8000, comFinance:6000, marginLeft:20000, totalIncome:34000, cutDate:'2025-06-18', status:'รอส่งมอบ', notes:'', createdAt:'2025-06-01' },
  { id:'bk2', bookingNo:'SK2506002', custName:'กิตติพงษ์ วรรณศิลป์', nid:'1209800112233', phone:'0876543210', address:'', province:'นนทบุรี', source:'Facebook',
    brand:'Deepal', model:'S07 (2026)', variant:'New Standard', colorOut:'ดำ', colorIn:'Rose-White', vin:'', motorNo:'', batNo:'',
    price:1099000, down:150000, financeCo:'TTB', financeAmount:949000, finStatus:'รอผล', installments:72, interestRate:2.49, monthly:15200, campaign:'ดอกเบี้ยพิเศษ',
    bookingDate:'2025-06-05', submitDate:'2025-06-06', approveDate:'', signDate:'', deliveryDate:'2025-07-01', actualDeliveryDate:'',
    salesName:'วิชัย ขายเก่ง', cost:1081000, margin:18000, budgetUsed:8000, com70:6000, comFinance:5000, marginLeft:10000, totalIncome:21000, cutDate:'', status:'รอผลไฟแนนซ์', notes:'รอเอกสารเพิ่ม', createdAt:'2025-06-05' },
  { id:'bk3', bookingNo:'SK2505018', custName:'สุภาพร ใจดี', nid:'3100502233445', phone:'0856789012', address:'12/3 หมู่บ้านสุขสันต์', province:'ปทุมธานี', source:'Referral',
    brand:'GWM', model:'ORA Good Cat', variant:'2026 Ultra', colorOut:'ฟ้า', colorIn:'น้ำตาล-เบจ', vin:'LZ0000000000001', motorNo:'M001', batNo:'B001',
    price:899000, down:0, financeCo:'ซื้อสด', financeAmount:0, finStatus:'ซื้อสด', installments:0, interestRate:0, monthly:0, campaign:'ซื้อสด',
    bookingDate:'2025-05-18', submitDate:'2025-05-18', approveDate:'2025-05-18', signDate:'2025-05-20', deliveryDate:'2025-05-28', actualDeliveryDate:'2025-05-28',
    salesName:'อรนุช เซลส์ดี', cost:867000, margin:32000, budgetUsed:3000, com70:10000, comFinance:0, marginLeft:29000, totalIncome:39000, cutDate:'2025-05-26', status:'ส่งมอบแล้ว', notes:'', createdAt:'2025-05-18' },
]

function calcMonthly(financeAmount, installments, ratePerYear) {
  if (!financeAmount || !installments) return 0
  const years = installments / 12
  const total = financeAmount * (1 + (ratePerYear / 100) * years)
  return Math.round(total / installments)
}

export default async function BookingsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let bookings = []
  let statusFilter = 'all'
  let search = ''

  async function loadData() {
    try { bookings = await listDocs('bookings', [], 'createdAt', 'desc', 500) } catch (e) {}
    // ใช้ demo ใหม่ถ้าข้อมูลเดิมเป็นโครงเก่า (ไม่มี field bookingDate)
    if (!bookings.length || !bookings.some(b => b.bookingDate || b.financeCo)) {
      bookings = DEMO_BOOKINGS.map(b => ({ ...b }))
    }
    updateStats(); applyFilter()
  }

  function updateStats() {
    getBookingStatus().forEach(s => {
      const el = document.getElementById('bkstat-' + s)
      if (el) el.textContent = bookings.filter(b => b.status === s).length
    })
    const totEl = document.getElementById('bk-total')
    if (totEl) totEl.textContent = bookings.length + ' ใบจอง'
    const active = bookings.filter(b => b.status !== 'ถอนจอง')
    const sumEl = document.getElementById('bk-sum')
    if (sumEl) sumEl.textContent = 'ยอดขายรวม: ' + formatCurrency(active.reduce((s, b) => s + (b.price || 0), 0)) + ' · กำไรรวม: ' + formatCurrency(active.reduce((s, b) => s + (b.margin || 0), 0))
  }

  function applyFilter() {
    const filtered = bookings.filter(b => {
      const ss = statusFilter === 'all' || b.status === statusFilter
      const qs = !search || (b.bookingNo + ' ' + b.custName + ' ' + b.brand + ' ' + b.model + ' ' + (b.salesName || '')).toLowerCase().includes(search)
      return ss && qs
    })
    renderTable(filtered)
  }

  function renderTable(filtered) {
    const wrap = document.getElementById('bk-content')
    if (!wrap) return
    if (!filtered.length) { wrap.innerHTML = '<div class="empty-state" style="padding:48px"><div class="empty-icon">📝</div><div class="empty-title">ไม่พบใบจอง</div></div>'; return }
    wrap.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
      '<th>เลขที่จอง</th><th>ลูกค้า</th><th>รถ / สี</th><th>ราคา</th><th>ไฟแนนซ์</th><th>ค่างวด</th><th>เซลส์</th><th>นัดส่งมอบ</th><th>สถานะ</th><th></th>' +
      '</tr></thead><tbody>' + filtered.map(b => tableRow(b)).join('') + '</tbody></table></div>'
    document.querySelectorAll('.bk-row').forEach(row => row.addEventListener('click', e => { if (e.target.closest('.edit-bk')) return; openDetail(bookings.find(b => b.id === row.dataset.id)) }))
    document.querySelectorAll('.edit-bk').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openForm(bookings.find(b => b.id === btn.dataset.id)) }))
  }

  function tableRow(b) {
    const isCash = b.finStatus === 'ซื้อสด' || b.financeCo === 'ซื้อสด'
    return '<tr class="bk-row" data-id="' + b.id + '" style="cursor:pointer">' +
      '<td><span style="font-weight:700;color:var(--primary)">' + escHtml(b.bookingNo) + '</span><div style="font-size:0.66rem;color:var(--text-muted)">' + formatDate(b.bookingDate) + '</div></td>' +
      '<td><div style="font-weight:600">' + escHtml(b.custName) + '</div><div style="font-size:0.72rem;color:var(--text-muted)">' + escHtml(b.phone || '') + ' · ' + escHtml(b.province || '') + '</div></td>' +
      '<td style="font-size:0.82rem">' + escHtml(b.brand) + ' ' + escHtml(b.model) + '<div style="font-size:0.7rem;color:var(--text-muted)">' + escHtml(b.variant || '') + ' · ' + escHtml(b.colorOut || '-') + '</div></td>' +
      '<td style="font-weight:600;color:var(--accent)">' + formatCurrency(b.price) + '</td>' +
      '<td style="font-size:0.78rem">' + (isCash ? '<span style="color:var(--success)">เงินสด</span>' : escHtml(b.financeCo || '-') + '<div style="font-size:0.66rem;color:var(--text-muted)">' + escHtml(b.finStatus || '') + '</div>') + '</td>' +
      '<td style="font-size:0.8rem">' + (b.monthly ? formatCurrency(b.monthly) + '<div style="font-size:0.64rem;color:var(--text-muted)">' + b.installments + ' งวด</div>' : '-') + '</td>' +
      '<td style="font-size:0.78rem;color:var(--text-muted)">' + escHtml(b.salesName || '-') + '</td>' +
      '<td style="font-size:0.76rem;color:var(--text-2)">' + formatDate(b.deliveryDate) + '</td>' +
      '<td><span class="badge badge-' + badge(b.status) + '">' + escHtml(b.status) + '</span></td>' +
      '<td><button class="btn btn-ghost btn-sm edit-bk" data-id="' + b.id + '">✏️</button></td>' +
    '</tr>'
  }

  function openDetail(b) {
    if (!b) return
    const isCash = b.finStatus === 'ซื้อสด'
    const sec = (t) => '<div style="font-weight:700;font-size:0.74rem;color:var(--primary);margin:10px 0 4px">' + t + '</div>'
    openModal({
      title: '📝 ใบจอง ' + escHtml(b.bookingNo), size: 'lg',
      body: '<div style="font-size:0.82rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span class="badge badge-' + badge(b.status) + '" style="font-size:0.9rem">' + escHtml(b.status) + '</span>' +
          '<span style="font-size:1.25rem;font-weight:800;color:var(--accent)">' + formatCurrency(b.price) + '</span>' +
        '</div>' +
        sec('👤 ลูกค้า') +
        dRow('ชื่อ', b.custName) + dRow('เลขบัตร ปชช.', b.nid || '-') + dRow('โทร', b.phone || '-') + dRow('ที่อยู่', (b.address || '-') + ' ' + (b.province || '')) + dRow('แหล่งที่มา', b.source || '-') +
        sec('🚗 รถ') +
        dRow('รุ่น', b.brand + ' ' + b.model + ' ' + (b.variant || '')) + dRow('สีนอก / ใน', (b.colorOut || '-') + ' / ' + (b.colorIn || '-')) + dRow('เลขตัวถัง (VIN)', b.vin || '-') + dRow('เลขมอเตอร์', b.motorNo || '-') + dRow('เลขแบต', b.batNo || '-') +
        sec('💰 การเงิน / ไฟแนนซ์') +
        dRow('ราคารถ', formatCurrency(b.price)) + dRow('เงินดาวน์', formatCurrency(b.down)) +
        (isCash ? dRow('การชำระ', 'ซื้อเงินสด') :
          dRow('ไฟแนนซ์', (b.financeCo || '-') + ' · ' + (b.finStatus || '')) + dRow('ยอดจัด', formatCurrency(b.financeAmount)) + dRow('งวด / ดอกเบี้ย', (b.installments || 0) + ' งวด · ' + (b.interestRate || 0) + '%') + dRow('ค่างวด/เดือน', formatCurrency(b.monthly))) +
        dRow('แคมเปญ', b.campaign || '-') +
        sec('💵 กำไร / คอมมิชชั่น') +
        dRow('ต้นทุนรถ', formatCurrency(b.cost)) + dRow('กำไรขั้นต้น (Margin)', formatCurrency(b.margin)) + dRow('งบการตลาดที่ใช้', formatCurrency(b.budgetUsed)) +
        '<div style="display:flex;gap:6px;padding:2px 0"><span style="color:var(--text-muted);min-width:110px;flex-shrink:0;font-size:0.82rem">กำไรคงเหลือ</span><span style="font-weight:700;color:var(--success);font-size:0.82rem">' + formatCurrency(b.marginLeft != null ? b.marginLeft : (b.margin || 0) - (b.budgetUsed || 0)) + '</span></div>' +
        dRow('คอมเซลส์', formatCurrency(b.com70)) + dRow('คอมไฟแนนซ์', formatCurrency(b.comFinance)) +
        '<div style="display:flex;gap:6px;padding:2px 0"><span style="color:var(--text-muted);min-width:110px;flex-shrink:0;font-size:0.82rem">💰 รายได้รวม</span><span style="font-weight:800;color:var(--accent);font-size:0.92rem">' + formatCurrency(b.totalIncome != null ? b.totalIncome : ((b.margin || 0) - (b.budgetUsed || 0)) + (b.com70 || 0) + (b.comFinance || 0)) + '</span></div>' +
        sec('📅 ไทม์ไลน์') +
        dRow('วันจอง', formatDate(b.bookingDate)) + dRow('ยื่นไฟแนนซ์', formatDate(b.submitDate)) + dRow('อนุมัติ', formatDate(b.approveDate)) + dRow('เซ็นสัญญา', formatDate(b.signDate)) + dRow('วันตัดรถ', formatDate(b.cutDate)) + dRow('นัดส่งมอบ', formatDate(b.deliveryDate)) + dRow('ส่งมอบจริง', formatDate(b.actualDeliveryDate)) +
        dRow('เซลส์', b.salesName || '-') +
        (b.notes ? '<div style="background:var(--surface-2);padding:10px;border-radius:8px;font-size:0.82rem;margin-top:8px">📝 ' + escHtml(b.notes) + '</div>' : '') +
      '</div>',
      footer: '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">ปิด</button>' +
              '<button class="btn btn-secondary" id="bk-edit2">✏️ แก้ไข</button>' +
              '<button class="btn btn-secondary" id="bk-print">🖨 พิมพ์ใบจอง</button>' +
              (b.status === 'ถอนจอง'
                ? '<button class="btn btn-danger" id="bk-print-cancel">🖨 พิมพ์ใบถอนจอง</button>'
                : '<button class="btn btn-primary" id="bk-to-doc">📄 สร้างเอกสาร</button>')
    })
    document.getElementById('bk-edit2')?.addEventListener('click', () => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); openForm(b) })
    document.getElementById('bk-print')?.addEventListener('click', () => printBooking(b))
    document.getElementById('bk-print-cancel')?.addEventListener('click', () => printCancellation(b))
    document.getElementById('bk-to-doc')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); navigate('/documents') })
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const e = existing || {}
    const bkNo = e.bookingNo || ('SK' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 900) + 100))
    const inp = (id, label, val, type) => '<div class="input-group"><label class="input-label">' + label + '</label><input class="input" id="' + id + '" ' + (type ? 'type="' + type + '"' : '') + ' value="' + (val == null ? '' : String(val).replace(/"/g, '&quot;')) + '"></div>'
    const selOf = (id, label, list, val) => '<div class="input-group"><label class="input-label">' + label + '</label><select class="input" id="' + id + '">' + list.map(o => '<option ' + (o === val ? 'selected' : '') + '>' + o + '</option>').join('') + '</select></div>'
    const datalist = (id, label, list, val) => '<div class="input-group"><label class="input-label">' + label + '</label><input class="input" id="' + id + '" list="' + id + '-l" value="' + (val || '') + '"><datalist id="' + id + '-l">' + list.map(o => '<option value="' + o + '">').join('') + '</datalist></div>'
    const sec = (t) => '<div style="font-weight:700;font-size:0.78rem;color:var(--primary);margin:6px 0 2px;border-bottom:1px solid var(--border-subtle);padding-bottom:3px">' + t + '</div>'

    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขใบจอง ' + escHtml(bkNo) : '➕ ใบจองใหม่', size: 'lg',
      body: '<div style="display:flex;flex-direction:column;gap:8px;max-height:66vh;overflow:auto;padding-right:4px">' +
        sec('👤 ข้อมูลลูกค้า') +
        '<div class="grid-2">' + inp('bf-cust', 'ชื่อลูกค้า *', e.custName) + inp('bf-nid', 'เลขบัตรประชาชน', e.nid) + '</div>' +
        '<div class="grid-2">' + inp('bf-phone', 'โทรศัพท์', e.phone) + datalist('bf-source', 'แหล่งที่มา', getLeadSources(), e.source) + '</div>' +
        '<div class="grid-2">' + inp('bf-address', 'ที่อยู่', e.address) + inp('bf-province', 'จังหวัด', e.province) + '</div>' +
        sec('🚗 ข้อมูลรถ') +
        '<button type="button" class="btn btn-secondary btn-sm" id="bf-pick" style="align-self:flex-start">🚘 เลือกรถจาก Catalog</button>' +
        '<div class="grid-2">' + inp('bf-brand', 'ยี่ห้อ', e.brand) + inp('bf-model', 'รุ่น', e.model) + '</div>' +
        '<div class="grid-2">' + inp('bf-variant', 'รุ่นย่อย', e.variant) + inp('bf-price', 'ราคารถ (บาท)', e.price, 'number') + '</div>' +
        '<div class="grid-2">' + datalist('bf-colorout', 'สีภายนอก', getColors(), e.colorOut) + datalist('bf-colorin', 'สีภายใน', getColors(), e.colorIn) + '</div>' +
        '<div class="grid-2">' + inp('bf-vin', 'เลขตัวถัง (VIN)', e.vin) + inp('bf-motor', 'เลขมอเตอร์', e.motorNo) + '</div>' +
        inp('bf-bat', 'เลขแบตเตอรี่', e.batNo) +
        sec('💰 การเงิน / ไฟแนนซ์') +
        '<div class="grid-2">' + selOf('bf-finco', 'บริษัทไฟแนนซ์', getFinanceCompanies(), e.financeCo) + selOf('bf-finstatus', 'สถานะไฟแนนซ์', getFinanceStatus(), e.finStatus) + '</div>' +
        '<div class="grid-2">' + inp('bf-down', 'เงินดาวน์', e.down, 'number') + inp('bf-finamount', 'ยอดจัดไฟแนนซ์', e.financeAmount, 'number') + '</div>' +
        '<div class="grid-2">' + inp('bf-install', 'จำนวนงวด', e.installments, 'number') + inp('bf-rate', 'ดอกเบี้ย (%/ปี)', e.interestRate, 'number') + '</div>' +
        '<div class="grid-2">' + selOf('bf-campaign', 'แคมเปญ', getCampaigns(), e.campaign) + inp('bf-cost', 'ต้นทุนรถ (บาท)', e.cost, 'number') + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted)">💡 ค่างวด/เดือน คำนวณอัตโนมัติจาก ยอดจัด × งวด × ดอกเบี้ย</div>' +
        sec('💵 กำไร / คอมมิชชั่น (แบบ V8)') +
        '<div class="grid-2">' + inp('bf-margin', 'กำไรขั้นต้น Margin (บาท)', e.margin, 'number') + inp('bf-budget', 'งบการตลาดที่ใช้ (บาท)', e.budgetUsed, 'number') + '</div>' +
        '<div class="grid-2">' + inp('bf-com70', 'คอมเซลส์ (บาท)', e.com70, 'number') + inp('bf-comfin', 'คอมไฟแนนซ์ (บาท)', e.comFinance, 'number') + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted)">💡 กำไรคงเหลือ = Margin − งบการตลาด · รายได้รวม = กำไรคงเหลือ + คอมเซลส์ + คอมไฟแนนซ์ (คำนวณอัตโนมัติ)</div>' +
        sec('📅 ไทม์ไลน์') +
        '<div class="grid-2">' + inp('bf-bdate', 'วันจอง', e.bookingDate || new Date().toISOString().slice(0, 10), 'date') + inp('bf-submit', 'วันยื่นไฟแนนซ์', e.submitDate, 'date') + '</div>' +
        '<div class="grid-2">' + inp('bf-approve', 'วันอนุมัติ', e.approveDate, 'date') + inp('bf-sign', 'วันเซ็นสัญญา', e.signDate, 'date') + '</div>' +
        '<div class="grid-2">' + inp('bf-cut', 'วันตัดรถ', e.cutDate, 'date') + inp('bf-delivery', 'วันนัดส่งมอบ', e.deliveryDate, 'date') + '</div>' +
        inp('bf-actual', 'วันส่งมอบจริง', e.actualDeliveryDate, 'date') +
        sec('📌 สรุป') +
        '<div class="grid-2">' + selOf('bf-sales', 'เซลส์', getSalesStaff(), e.salesName) + selOf('bf-status', 'สถานะใบจอง', getBookingStatus(), e.status || 'รอผลไฟแนนซ์') + '</div>' +
        inp('bf-notes', 'หมายเหตุ', e.notes) +
        '<span class="input-error" id="bf-cust-e"></span>' +
      '</div>',
      footer: '<button class="btn btn-secondary" id="bfc">ยกเลิก</button><button class="btn btn-primary" id="bfs">💾 บันทึก</button>'
    })

    el.querySelector('#bf-pick')?.addEventListener('click', () => pickVehicle(v => {
      el.querySelector('#bf-brand').value = v.brand
      el.querySelector('#bf-model').value = v.model
      el.querySelector('#bf-variant').value = v.variant
      if (!el.querySelector('#bf-price').value) el.querySelector('#bf-price').value = v.price || ''
    }))
    el.querySelector('#bfc').addEventListener('click', close)
    el.querySelector('#bfs').addEventListener('click', async () => {
      const cust = el.querySelector('#bf-cust').value.trim()
      if (!cust) { el.querySelector('#bf-cust-e').textContent = '⚠️ กรุณาระบุชื่อลูกค้า'; return }
      const g = id => el.querySelector('#' + id)
      const num = id => Number(g(id).value) || 0
      const financeAmount = num('bf-finamount'), installments = num('bf-install'), rate = num('bf-rate')
      const data = {
        bookingNo: bkNo,
        custName: cust, nid: g('bf-nid').value.trim(), phone: g('bf-phone').value.trim(), address: g('bf-address').value.trim(), province: g('bf-province').value.trim(), source: g('bf-source').value.trim(),
        brand: g('bf-brand').value.trim(), model: g('bf-model').value.trim(), variant: g('bf-variant').value.trim(),
        colorOut: g('bf-colorout').value.trim(), colorIn: g('bf-colorin').value.trim(), vin: g('bf-vin').value.trim(), motorNo: g('bf-motor').value.trim(), batNo: g('bf-bat').value.trim(),
        price: num('bf-price'), cost: num('bf-cost'), down: num('bf-down'), financeCo: g('bf-finco').value, financeAmount, finStatus: g('bf-finstatus').value,
        installments, interestRate: rate, monthly: calcMonthly(financeAmount, installments, rate), campaign: g('bf-campaign').value,
        margin: num('bf-margin'), budgetUsed: num('bf-budget'), com70: num('bf-com70'), comFinance: num('bf-comfin'),
        marginLeft: num('bf-margin') - num('bf-budget'),
        totalIncome: (num('bf-margin') - num('bf-budget')) + num('bf-com70') + num('bf-comfin'),
        bookingDate: g('bf-bdate').value, submitDate: g('bf-submit').value, approveDate: g('bf-approve').value, signDate: g('bf-sign').value, cutDate: g('bf-cut').value, deliveryDate: g('bf-delivery').value, actualDeliveryDate: g('bf-actual').value,
        salesName: g('bf-sales').value, status: g('bf-status').value, notes: g('bf-notes').value.trim(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      }
      const btn = g('bfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        if (isEdit) { await updateDocData('bookings', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('bookings', data); bookings.unshift({ ...data, id }) }
        showToast(isEdit ? '✏️ แก้ไขใบจองแล้ว' : '✅ สร้างใบจองแล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { btn.disabled = false; btn.textContent = 'บันทึก'; showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  container.innerHTML = '<div class="page-content animate-slide">' +
    '<div class="page-header"><div>' +
      '<div class="page-title">📝 ใบจองรถ</div>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="page-subtitle" id="bk-total">กำลังโหลด...</span><span style="font-size:0.78rem;color:var(--accent)" id="bk-sum"></span></div>' +
    '</div><div class="page-actions"><button class="btn btn-secondary btn-sm" id="bk-export">📥 Export</button><button class="btn btn-primary" id="add-bk-btn">➕ ใบจองใหม่</button></div></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">' +
      '<button class="btn btn-sm bk-f btn-primary" data-sf="all">ทั้งหมด</button>' +
      getBookingStatus().map(s => '<button class="btn btn-sm bk-f btn-secondary" data-sf="' + s + '" style="white-space:nowrap">' + s + ' <span id="bkstat-' + s + '" style="margin-left:4px;font-weight:700">0</span></button>').join('') +
    '</div>' +
    '<div class="card mb-4" style="padding:10px 16px"><div style="position:relative"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span><input class="input" id="bk-search" placeholder="ค้นหา เลขที่จอง ลูกค้า รถ เซลส์..." style="padding-left:32px"></div></div>' +
    '<div id="bk-content">' + [...Array(3)].map(() => '<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>').join('') + '</div>' +
  '</div>'

  document.getElementById('add-bk-btn').addEventListener('click', () => openForm())
  document.getElementById('bk-search').addEventListener('input', ev => { search = ev.target.value.toLowerCase(); applyFilter() })
  document.getElementById('bk-export').addEventListener('click', () => {
    exportToExcel(bookings.map(b => ({ เลขที่จอง: b.bookingNo, วันจอง: formatDate(b.bookingDate), ลูกค้า: b.custName, เลขบัตร: b.nid, โทร: b.phone, จังหวัด: b.province, รถ: b.brand + ' ' + b.model + ' ' + (b.variant || ''), สีนอก: b.colorOut, สีใน: b.colorIn, VIN: b.vin, ราคา: b.price, ดาวน์: b.down, ไฟแนนซ์: b.financeCo, ยอดจัด: b.financeAmount, สถานะไฟแนนซ์: b.finStatus, งวด: b.installments, ดอกเบี้ย: b.interestRate, ค่างวด: b.monthly, แคมเปญ: b.campaign, ต้นทุน: b.cost, กำไรขั้นต้น: b.margin, งบการตลาด: b.budgetUsed, กำไรคงเหลือ: b.marginLeft, คอมเซลส์: b.com70, คอมไฟแนนซ์: b.comFinance, รายได้รวม: b.totalIncome, วันตัดรถ: formatDate(b.cutDate), นัดส่งมอบ: formatDate(b.deliveryDate), ส่งมอบจริง: formatDate(b.actualDeliveryDate), เซลส์: b.salesName, สถานะ: b.status })), 'bookings-' + new Date().toISOString().slice(0, 10) + '.xlsx', 'ใบจอง')
    showToast('📥 Export แล้ว', 'success')
  })
  document.querySelectorAll('.bk-f').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.sf
    document.querySelectorAll('.bk-f').forEach(b => b.className = 'btn btn-sm bk-f ' + (b.dataset.sf === statusFilter ? 'btn-primary' : 'btn-secondary'))
    applyFilter()
  }))

  if (container.__routerGen === myGen) await loadData()
}

function dRow(label, value) {
  return '<div style="font-size:0.82rem;display:flex;gap:6px;padding:2px 0"><span style="color:var(--text-muted);min-width:110px;flex-shrink:0">' + label + '</span><span style="color:var(--text-2)">' + escHtml(String(value ?? '')) + '</span></div>'
}
