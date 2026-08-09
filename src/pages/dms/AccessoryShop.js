/**
 * Accessory Shop — ขายอุปกรณ์เสริม
 * Route: /dms/accessories
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ACC_CATS = {
  charging: { label: 'ชาร์จ', color: 'success', icon: '⚡' },
  protect:  { label: 'ป้องกัน', color: 'primary', icon: '🛡' },
  comfort:  { label: 'ความสะดวก', color: 'warning', icon: '🪑' },
  exterior: { label: 'ภายนอก', color: 'secondary', icon: '✨' },
}

export default async function AccessoryShopPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let items = []
  let cart = []
  let catFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { items = (await listDocs('accessories', [], 'sold30', 'desc', 200)).filter(a => !a.deleted) } catch (e) { items = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = items.filter(a => catFilter === 'all' || a.cat === catFilter)
    const revenue30 = items.reduce((a, x) => a + x.sold30 * x.price, 0)
    const margin30 = items.reduce((a, x) => a + x.sold30 * (x.price - x.cost), 0)
    const cartTotal = cart.reduce((a, c) => a + c.price * c.qty, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛍 Accessory Shop</div>
            <div class="page-subtitle">ขายอุปกรณ์เสริม — Upsell ตอนส่งมอบรถ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="add-acc-btn">➕ เพิ่มสินค้า</button>
            <button class="btn btn-primary" id="cart-btn">🛒 ตะกร้า (${cart.length}) ${cartTotal > 0 ? '— ' + formatCurrency(cartTotal) : ''}</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 ยอดขาย 30 วัน', formatCurrency(revenue30), 'primary')}
          ${kpi('📊 กำไร 30 วัน', formatCurrency(margin30), 'success')}
          ${kpi('🛍 สินค้า', items.length + ' รายการ', 'secondary')}
          ${kpi('⚠️ ใกล้หมด', items.filter(a => a.stock <= 3 && a.stock < 99).length + ' รายการ', 'warning')}
        </div>

        <!-- Category filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
          ${Object.entries(ACC_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        ${list.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
          ${list.map(a => {
            const ac = ACC_CATS[a.cat]
            const marginPct = a.price ? Math.round((a.price - a.cost) / a.price * 100) : 0
            return `<div class="card" style="padding:14px;display:flex;flex-direction:column">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <span class="badge badge-${ac?.color}" style="font-size:0.6rem">${ac?.icon} ${ac?.label}</span>
                <div style="display:flex;gap:4px">
                  ${a.popular ? '<span class="badge badge-danger" style="font-size:0.58rem">🔥 ขายดี</span>' : ''}
                  <button class="btn btn-ghost btn-xs edit-acc-btn" data-id="${a.id}" title="แก้ไข">✏️</button>
                  <button class="btn btn-ghost btn-xs del-acc-btn" data-id="${a.id}" title="ลบ">🗑️</button>
                </div>
              </div>
              <div style="font-weight:700;font-size:0.85rem;flex:1;margin-bottom:8px">${escHtml(a.name)}</div>
              <div style="font-size:1rem;font-weight:900;color:var(--primary);margin-bottom:4px">${formatCurrency(a.price)}</div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:10px">
                margin ${marginPct}% · ขาย 30 วัน: ${a.sold30||0} · ${a.stock >= 99 ? 'สั่งตามออเดอร์' : 'สต็อก ' + (a.stock||0)}
              </div>
              <button class="btn btn-xs btn-primary add-cart-btn" data-id="${a.id}" ${!a.stock ? 'disabled' : ''}>+ ใส่ตะกร้า</button>
            </div>`
          }).join('')}
        </div>` : `<div class="empty-state" style="padding:48px"><div class="empty-icon">🛍</div><div class="empty-title">ยังไม่มีสินค้าอุปกรณ์เสริมในระบบ</div><div class="empty-desc">กดปุ่ม "➕ เพิ่มสินค้า" ด้านบนเพื่อเริ่มเพิ่มสินค้าเข้าคลัง</div></div>`}
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.add-cart-btn').forEach(b => b.addEventListener('click', () => {
      const a = items.find(x => x.id === b.dataset.id)
      if (a) {
        const existing = cart.find(c => c.id === a.id)
        if (existing) existing.qty++
        else cart.push({ id: a.id, name: a.name, price: a.price, qty: 1 })
        showToast('🛒 เพิ่ม ' + a.name, 'success'); renderPage()
      }
    }))
    container.querySelectorAll('.edit-acc-btn').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation()
      openForm(items.find(x => x.id === b.dataset.id))
    }))
    container.querySelectorAll('.del-acc-btn').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteItem(items.find(x => x.id === b.dataset.id))
    }))
    document.getElementById('cart-btn')?.addEventListener('click', openCart)
    document.getElementById('add-acc-btn')?.addEventListener('click', () => openForm())
  }

  async function deleteItem(a) {
    if (!a) return
    const ok = await confirmDialog({ title: '🗑️ ลบสินค้า', message: `ยืนยันลบ "${escHtml(a.name)}" ออกจากคลังสินค้าอุปกรณ์เสริม? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบถาวร', danger: true })
    if (!ok) return
    await softDelete('accessories', a.id)
    showToast('🗑️ ลบสินค้าแล้ว', 'success')
    await loadData()
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขสินค้า' : '➕ เพิ่มสินค้าอุปกรณ์เสริม', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อสินค้า *</label><input class="input" id="af-name" value="${escHtml(existing?.name||'')}"><span class="input-error" id="af-name-e"></span></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">หมวดหมู่</label>
              <select class="input" id="af-cat">
                ${Object.entries(ACC_CATS).map(([k,v]) => `<option value="${k}" ${existing?.cat===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">สต็อก (99 = สั่งตามออเดอร์)</label><input class="input" type="number" id="af-stock" value="${existing?.stock ?? 0}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ราคาทุน (บาท)</label><input class="input" type="number" id="af-cost" value="${existing?.cost||''}"></div>
            <div class="input-group"><label class="input-label">ราคาขาย (บาท) *</label><input class="input" type="number" id="af-price" value="${existing?.price||''}"><span class="input-error" id="af-price-e"></span></div>
          </div>
          <div class="input-group"><label class="input-label"><input type="checkbox" id="af-popular" ${existing?.popular?'checked':''}> ติดป้าย "🔥 ขายดี"</label></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="afc">ยกเลิก</button><button class="btn btn-primary" id="afs">💾 บันทึก</button>`
    })
    el.querySelector('#afc').addEventListener('click', close)
    el.querySelector('#afs').addEventListener('click', async () => {
      const name = el.querySelector('#af-name').value.trim()
      const price = Number(el.querySelector('#af-price').value) || 0
      if (!name) { el.querySelector('#af-name-e').textContent = 'กรุณาระบุ'; return }
      if (!price) { el.querySelector('#af-price-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#afs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        name, cat: el.querySelector('#af-cat').value,
        stock: Number(el.querySelector('#af-stock').value) || 0,
        cost: Number(el.querySelector('#af-cost').value) || 0,
        price, popular: el.querySelector('#af-popular').checked,
        sold30: existing?.sold30 || 0,
      }
      try {
        if (isEdit) await updateDocData('accessories', existing.id, data)
        else await createDoc('accessories', data)
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มสินค้าแล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openCart() {
    if (cart.length === 0) { showToast('🛒 ตะกร้าว่าง', 'secondary'); return }
    const total = cart.reduce((a, c) => a + c.price * c.qty, 0)
    openModal({
      title: '🛒 ตะกร้าสินค้า',
      size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:6px">
        ${cart.map(c => `
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:6px 0;border-bottom:1px solid var(--border)">
            <span>${escHtml(c.name)} ×${c.qty}</span>
            <strong>${formatCurrency(c.price * c.qty)}</strong>
          </div>
        `).join('')}
        <div style="display:flex;justify-content:space-between;font-weight:900;font-size:0.95rem;padding-top:8px">
          <span>รวม</span><span style="color:var(--success)">${formatCurrency(total)}</span>
        </div>
        <div class="input-group" style="margin-top:8px"><label class="input-label">ลูกค้า</label><input class="input" id="cart-customer" placeholder="ชื่อลูกค้า / ทะเบียนรถ"></div>
      </div>`,
      confirmText: '💳 ออกบิล',
      async onConfirm() {
        try {
          for (const c of cart) {
            const a = items.find(x => x.id === c.id)
            if (!a) continue
            await updateDocData('accessories', a.id, { stock: a.stock < 99 ? Math.max(0, a.stock - c.qty) : a.stock, sold30: a.sold30 + c.qty })
          }
          showToast(`✅ ออกบิล ${formatCurrency(total)} แล้ว!`, 'success')
          cart = []
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
