/**
 * Vendor Management — ซัพพลายเออร์ สัญญา ประวัติ
 * Route: /finance/vendor
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const CATEGORIES = ['อะไหล่','วัสดุซ่อมสี','สาธารณูปโภค','เครื่องมือ','น้ำมัน/สารหล่อลื่น','บริการ']
const PAY_TERMS = ['ทันที','15 วัน','30 วัน','45 วัน','60 วัน']

export default async function VendorManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let VENDORS = []
  let filterCat = 'all'
  let selVendorId = null
  let loading = true

  async function loadData() {
    loading = true
    try { VENDORS = await listDocs('vendors', [], 'name', 'asc', 500) } catch (e) { VENDORS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function stars(r) {
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r))
  }

  function openVendorModal(v) {
    const isEdit = !!v
    openModal({
      title: isEdit ? '✏️ แก้ไขผู้จัดจำหน่าย' : '🏭 เพิ่มผู้จัดจำหน่ายใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted)">ชื่อบริษัท/ร้านค้า *</label>
            <input id="vm-name" class="input" placeholder="ชื่อผู้จัดจำหน่าย..." value="${escHtml(v?.name || '')}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">หมวดหมู่</label>
              <select id="vm-cat" class="input">
                ${CATEGORIES.map(c=>`<option value="${c}" ${v?.category===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">เงื่อนไขชำระ</label>
              <select id="vm-terms" class="input">
                ${PAY_TERMS.map(t=>`<option value="${t}" ${v?.payTerms===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted)">ผู้ติดต่อ / เบอร์โทรศัพท์</label>
            <input id="vm-contact" class="input" placeholder="ชื่อ เบอร์โทร..." value="${escHtml(v?.contact || '')}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">ยอดซื้อ YTD (฿)</label>
              <input id="vm-spend" type="number" class="input" placeholder="0" value="${v?.ytdSpend ?? 0}">
            </div>
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">Rating (1–5)</label>
              <input id="vm-rating" type="number" class="input" min="1" max="5" step="0.1" value="${v?.rating ?? 5}">
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="vm-active" ${(!v || v.status==='active') ? 'checked' : ''}>
            <label for="vm-active" style="font-size:0.78rem;cursor:pointer">ใช้งานอยู่</label>
          </div>
        </div>
      `,
      footer: `
        <div>${isEdit ? `<button class="btn btn-sm btn-danger" id="vm-del">🗑 ลบ</button>` : ''}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="vm-save">💾 บันทึก</button>
        </div>
      `
    })

    document.getElementById('vm-save')?.addEventListener('click', async () => {
      const name = document.getElementById('vm-name')?.value.trim()
      if (!name) { showToast('⚠️ กรุณากรอกชื่อ', 'warning'); return }
      const data = {
        name,
        category: document.getElementById('vm-cat')?.value || CATEGORIES[0],
        contact: document.getElementById('vm-contact')?.value.trim() || '-',
        payTerms: document.getElementById('vm-terms')?.value || '30 วัน',
        ytdSpend: parseFloat(document.getElementById('vm-spend')?.value) || 0,
        rating: Math.min(5, Math.max(1, parseFloat(document.getElementById('vm-rating')?.value) || 5)),
        status: document.getElementById('vm-active')?.checked ? 'active' : 'inactive',
        lastOrder: v?.lastOrder || new Date().toISOString().slice(0, 10)
      }
      try {
        if (isEdit) {
          await updateDocData('vendors', v.id, data)
          showToast('✅ แก้ไขข้อมูลแล้ว', 'success')
          selVendorId = v.id
        } else {
          selVendorId = await createDoc('vendors', data)
          showToast('✅ เพิ่มผู้จัดจำหน่ายแล้ว', 'success')
        }
        document.querySelector('.modal-overlay')?.remove()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })

    if (isEdit) {
      document.getElementById('vm-del')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title:'🗑 ลบผู้จัดจำหน่าย', message:`ลบ "${v.name}" ออกจากระบบ?`, confirmText:'ลบ', danger:true })
        if (!ok) return
        try {
          await softDelete('vendors', v.id)
          document.querySelector('.modal-overlay')?.remove()
          selVendorId = null
          showToast('🗑 ลบแล้ว', 'warning')
          if (container.__routerGen !== myGen) return
          await loadData()
        } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
      })
    }
  }

  function openPOModal(v) {
    const poNo = `PO-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*900)+100)}`
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    openModal({
      title: `📄 สร้าง Purchase Order`,
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm)">
            <div style="font-size:0.7rem;color:var(--text-muted)">ผู้จัดจำหน่าย</div>
            <div style="font-weight:700">${escHtml(v.name)}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(v.category)} · ${escHtml(v.payTerms)} · ${stars(v.rating)}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">เลขที่ PO</label>
              <input id="po-no" class="input" value="${poNo}" readonly style="background:var(--surface-2)">
            </div>
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">วันที่ต้องการ</label>
              <input id="po-date" type="date" class="input" value="${dueDate}">
            </div>
          </div>
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted)">รายการสั่งซื้อ</label>
            <textarea id="po-items" class="input" rows="3" placeholder="เช่น: น้ำมันเครื่อง 5W-30 × 20 ชิ้น&#10;ไส้กรองอากาศ × 10 ชิ้น..."></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">มูลค่ารวม (฿) *</label>
              <input id="po-amount" type="number" class="input" placeholder="0">
            </div>
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted)">ผู้อนุมัติ</label>
              <input id="po-approver" class="input" value="ทวีศักดิ์ สุขสมบัติเสถียร">
            </div>
          </div>
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted)">หมายเหตุ</label>
            <input id="po-note" class="input" placeholder="หมายเหตุเพิ่มเติม...">
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="po-create">📄 ออก PO</button>
        </div>
      `
    })

    document.getElementById('po-create')?.addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('po-amount')?.value) || 0
      if (!amount) { showToast('⚠️ กรุณากรอกมูลค่า', 'warning'); return }
      const no = document.getElementById('po-no')?.value
      document.querySelector('.modal-overlay')?.remove()
      showToast(`📄 ออก ${no} มูลค่า ${formatCurrency(amount)} แล้ว`, 'success')
    })
  }

  function vendorCard(v) {
    const isSel = v.id === selVendorId
    return `<div class="card vendor-card" data-id="${escHtml(v.id)}" style="padding:14px;cursor:pointer;border:2px solid ${isSel?'var(--primary)':'transparent'};margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div style="font-weight:700;font-size:0.82rem;margin-bottom:2px">${escHtml(v.name)}</div>
          <div style="font-size:0.68rem;background:var(--surface-2);display:inline-block;padding:1px 7px;border-radius:6px;margin-bottom:4px">${escHtml(v.category)}</div>
        </div>
        ${v.status==='inactive'?'<span style="font-size:0.6rem;background:var(--surface-2);color:var(--text-muted);padding:2px 7px;border-radius:8px">ไม่ได้ใช้งาน</span>':''}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted)">
        <span style="color:var(--warning)">${stars(v.rating)}</span>
        <span>฿${v.ytdSpend.toLocaleString()} YTD</span>
      </div>
    </div>`
  }

  function renderDetail(v) {
    return `<div class="card" style="padding:16px">
      <div style="font-weight:700;font-size:0.9rem;margin-bottom:14px">🏭 ${escHtml(v.name)}</div>
      <table style="width:100%;font-size:0.76rem;border-collapse:collapse">
        ${[
          ['📂 หมวดหมู่', v.category],
          ['📞 ผู้ติดต่อ', v.contact],
          ['💳 เงื่อนไขชำระ', v.payTerms],
          ['💰 ยอดซื้อ YTD', formatCurrency(v.ytdSpend)],
          ['⭐ Rating', stars(v.rating)+' ('+v.rating+')'],
          ['📅 สั่งล่าสุด', v.lastOrder],
          ['🔄 สถานะ', v.status==='active'?'<span style="color:var(--success);font-weight:700">ใช้งาน</span>':'<span style="color:var(--text-muted)">ไม่ได้ใช้งาน</span>'],
        ].map(([k,val])=>`<tr style="border-bottom:1px solid var(--border-subtle)"><td style="padding:7px 0;color:var(--text-muted)">${k}</td><td style="padding:7px 0;font-weight:600;text-align:right">${val}</td></tr>`).join('')}
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
        <button class="btn btn-sm btn-secondary" id="po-btn">📄 สร้าง PO</button>
        <button class="btn btn-sm btn-primary" id="edit-vendor-btn">✏️ แก้ไข</button>
      </div>
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let list = filterCat === 'all' ? VENDORS : VENDORS.filter(v => v.category === filterCat)
    const totalSpend = VENDORS.reduce((s,v) => s + v.ytdSpend, 0)
    const active = VENDORS.filter(v => v.status === 'active').length
    const avgRating = (VENDORS.reduce((s,v) => s + v.rating, 0) / VENDORS.length).toFixed(1)
    const catBtns = ['all', ...CATEGORIES].map(c =>
      `<button class="btn btn-sm ${filterCat===c?'btn-primary':'btn-secondary'} cat-btn" data-c="${c}">${c==='all'?'ทั้งหมด':c}</button>`
    ).join('')
    const selVendor = selVendorId ? VENDORS.find(v => v.id === selVendorId) : null
    const detailPanel = selVendor
      ? renderDetail(selVendor)
      : '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem">🏭</div><div style="font-size:0.82rem;margin-top:8px">เลือกผู้จัดจำหน่ายเพื่อดูรายละเอียด</div></div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏭 Vendor Management</div>
            <div class="page-subtitle">ผู้จัดจำหน่ายและซัพพลายเออร์ · ${VENDORS.length} ราย</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-vendor-btn">+ เพิ่มผู้จัดจำหน่าย</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('🏭 ผู้จัดจำหน่ายทั้งหมด', VENDORS.length+' ราย', 'var(--primary)')}
          ${sc('✅ ใช้งานอยู่', active+' ราย', 'var(--success)')}
          ${sc('💰 ยอดจ่าย YTD', formatCurrency(totalSpend), 'var(--warning)')}
          ${sc('⭐ Rating เฉลี่ย', avgRating+'/5', 'var(--warning)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${catBtns}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="display:flex;flex-direction:column">
            ${list.length ? list.map(v => vendorCard(v)).join('') : '<div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">ไม่มีข้อมูลในหมวดนี้</div>'}
          </div>
          <div>${detailPanel}</div>
        </div>
      </div>`

    container.querySelectorAll('.vendor-card').forEach(c => c.addEventListener('click', () => { selVendorId = c.dataset.id; render() }))
    container.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => { filterCat = b.dataset.c; selVendorId = null; render() }))
    document.getElementById('add-vendor-btn')?.addEventListener('click', () => openVendorModal(null))
    if (selVendor) {
      document.getElementById('po-btn')?.addEventListener('click', () => openPOModal(selVendor))
      document.getElementById('edit-vendor-btn')?.addEventListener('click', () => openVendorModal(selVendor))
    }
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
