/**
 * Accessory Shop — ขายอุปกรณ์เสริม
 * Route: /dms/accessories
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ACC_CATS = {
  charging: { label: 'ชาร์จ', color: 'success', icon: '⚡' },
  protect:  { label: 'ป้องกัน', color: 'primary', icon: '🛡' },
  comfort:  { label: 'ความสะดวก', color: 'warning', icon: '🪑' },
  exterior: { label: 'ภายนอก', color: 'secondary', icon: '✨' },
}

const DEMO_ACCESSORIES = [
  { id: 'AC001', name: 'Wallbox Charger 7kW + ติดตั้ง', cat: 'charging', price: 35000, cost: 24000, stock: 6, sold30: 8, popular: true },
  { id: 'AC002', name: 'สายชาร์จพกพา Type 2 (5m)', cat: 'charging', price: 8500, cost: 5200, stock: 12, sold30: 5, popular: false },
  { id: 'AC003', name: 'ฟิล์มกันรอย PPF เต็มคัน', cat: 'protect', price: 45000, cost: 28000, stock: 99, sold30: 4, popular: true },
  { id: 'AC004', name: 'ฟิล์มกรองแสง Ceramic เต็มคัน', cat: 'protect', price: 12000, cost: 6500, stock: 99, sold30: 11, popular: true },
  { id: 'AC005', name: 'พรมปูพื้น 5D เข้ารูป', cat: 'comfort', price: 3500, cost: 1800, stock: 24, sold30: 15, popular: true },
  { id: 'AC006', name: 'กล้องติดรถหน้า-หลัง 4K', cat: 'comfort', price: 6900, cost: 4100, stock: 9, sold30: 7, popular: false },
  { id: 'AC007', name: 'สปอยเลอร์หลัง Carbon', cat: 'exterior', price: 15000, cost: 9000, stock: 3, sold30: 2, popular: false },
  { id: 'AC008', name: 'ล้อแม็กซ์ 19" ชุด 4 วง', cat: 'exterior', price: 48000, cost: 32000, stock: 2, sold30: 1, popular: false },
]

export default async function AccessoryShopPage(container) {
  const myGen = container.__routerGen
  let items = DEMO_ACCESSORIES.map(a => ({ ...a }))
  let cart = []
  let catFilter = 'all'
  let dataSource = 'demo'

  try {
    const docs = await listDocs('accessories', [], 'sold30', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `AC${String(i+1).padStart(3,'0')}`,
        name: d.name || d.productName || 'อุปกรณ์',
        cat: d.cat || d.category || 'comfort',
        price: d.price || 0,
        cost: d.cost || 0,
        stock: d.stock || 0,
        sold30: d.sold30 || d.salesCount || 0,
        popular: d.popular || false,
      }))
      items = [...mapped, ...DEMO_ACCESSORIES]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = items.filter(a => catFilter === 'all' || a.cat === catFilter)
    const revenue30 = items.reduce((a, x) => a + x.sold30 * x.price, 0)
    const margin30 = items.reduce((a, x) => a + x.sold30 * (x.price - x.cost), 0)
    const cartTotal = cart.reduce((a, c) => a + c.price * c.qty, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛍 Accessory Shop</div>
            <div class="page-subtitle">ขายอุปกรณ์เสริม — Upsell ตอนส่งมอบรถ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
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

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
          ${list.map(a => {
            const ac = ACC_CATS[a.cat]
            const marginPct = Math.round((a.price - a.cost) / a.price * 100)
            return `<div class="card" style="padding:14px;display:flex;flex-direction:column">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <span class="badge badge-${ac?.color}" style="font-size:0.6rem">${ac?.icon} ${ac?.label}</span>
                ${a.popular ? '<span class="badge badge-danger" style="font-size:0.58rem">🔥 ขายดี</span>' : ''}
              </div>
              <div style="font-weight:700;font-size:0.85rem;flex:1;margin-bottom:8px">${escHtml(a.name)}</div>
              <div style="font-size:1rem;font-weight:900;color:var(--primary);margin-bottom:4px">${formatCurrency(a.price)}</div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:10px">
                margin ${marginPct}% · ขาย 30 วัน: ${a.sold30} · ${a.stock >= 99 ? 'สั่งตามออเดอร์' : 'สต็อก ' + a.stock}
              </div>
              <button class="btn btn-xs btn-primary add-cart-btn" data-id="${a.id}" ${a.stock === 0 ? 'disabled' : ''}>+ ใส่ตะกร้า</button>
            </div>`
          }).join('')}
        </div>
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
    document.getElementById('cart-btn')?.addEventListener('click', openCart)
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
      onConfirm() {
        cart.forEach(c => { const a = items.find(x => x.id === c.id); if (a && a.stock < 99) a.stock = Math.max(0, a.stock - c.qty); if (a) a.sold30 += c.qty })
        showToast(`✅ ออกบิล ${formatCurrency(total)} แล้ว!`, 'success')
        cart = []; renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
