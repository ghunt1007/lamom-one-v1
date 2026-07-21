/**
 * VIP Club — ดูแลลูกค้า VIP
 * Route: /crm/vip
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const VIP_TIERS = {
  platinum: { label: 'Platinum', color: 'primary', icon: '💎', minSpend: 3000000, benefits: ['ผู้จัดการดูแลส่วนตัว', 'รถสำรองฟรีทุกครั้ง', 'ส่วนลดบริการ 25%', 'เชิญงาน Exclusive ทุกงาน'] },
  gold:     { label: 'Gold', color: 'warning', icon: '🥇', minSpend: 1500000, benefits: ['Fast track ทุกบริการ', 'ส่วนลดบริการ 15%', 'รถรับ-ส่งฟรีไม่จำกัดระยะ'] },
  silver:   { label: 'Silver', color: 'secondary', icon: '🥈', minSpend: 800000, benefits: ['ส่วนลดบริการ 10%', 'ล้างรถฟรีทุกครั้งที่เข้าศูนย์'] },
}

const DEMO_VIPS = [
  { id: 'V001', name: 'สมชาย ใจดี', tier: 'platinum', totalSpend: 5196000, cars: 3, referrals: 2, manager: 'ผจก.วิชัย', lastContact: addDays(-5), birthday: '15 ส.ค.', perks_used: 8 },
  { id: 'V002', name: 'มาลี สุขใจ', tier: 'gold', totalSpend: 2598000, cars: 2, referrals: 1, manager: 'ผจก.วิชัย', lastContact: addDays(-12), birthday: '3 ม.ค.', perks_used: 5 },
  { id: 'V003', name: 'บริษัท ABC จำกัด', tier: 'platinum', totalSpend: 8500000, cars: 6, referrals: 0, manager: 'ผจก.สมศรี', lastContact: addDays(-2), birthday: '—', perks_used: 14 },
  { id: 'V004', name: 'วิรัช เก่งมาก', tier: 'gold', totalSpend: 2099000, cars: 1, referrals: 3, manager: 'ผจก.วิชัย', lastContact: addDays(-30), birthday: '22 พ.ย.', perks_used: 3 },
  { id: 'V005', name: 'ประพันธ์ มั่งมี', tier: 'silver', totalSpend: 949000, cars: 1, referrals: 0, manager: '—', lastContact: addDays(-45), birthday: '8 มี.ค.', perks_used: 1 },
]

export default async function VipClubPage(container) {
  const myGen = container.__routerGen
  let vips = DEMO_VIPS.map(v => ({ ...v }))
  let tierFilter = 'all'
  let dataSource = 'demo'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    const byName = {}
    for (const s of sales) {
      const name = s.customerName || s.custName || ''
      if (!name) continue
      if (!byName[name]) byName[name] = { totalSpend: 0, cars: 0 }
      byName[name].totalSpend += s.salePrice || 0
      byName[name].cars++
    }
    const topBuyers = Object.entries(byName)
      .map(([name, d]) => ({ ...d, name }))
      .filter(c => c.totalSpend >= 800000)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 20)
    // แสดงเฉพาะลูกค้า VIP จริงเมื่อมีจริง — ห้ามเอา DEMO_VIPS มาปนกับยอดใช้จ่ายจริง
    // DEMO_VIPS ใช้เป็นตัวอย่างก็ต่อเมื่อยังไม่มีลูกค้าที่เข้าเกณฑ์ VIP จริงเลยเท่านั้น
    if (topBuyers.length) {
      vips = topBuyers.map((c, i) => ({
        id: `LV${i+1}`, name: c.name,
        tier: c.totalSpend >= 3000000 ? 'platinum' : c.totalSpend >= 1500000 ? 'gold' : 'silver',
        totalSpend: c.totalSpend, cars: c.cars, referrals: 0,
        manager: '—', lastContact: addDays(-Math.floor(Math.random() * 30)), birthday: '—', perks_used: 0,
      }))
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = vips.filter(v => tierFilter === 'all' || v.tier === tierFilter)
      .sort((a, b) => b.totalSpend - a.totalSpend)
    const totalValue = vips.reduce((a, v) => a + v.totalSpend, 0)
    const needContact = vips.filter(v => v.lastContact <= addDays(-30)).length
    const totalReferrals = vips.reduce((a, v) => a + v.referrals, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👑 VIP Club</div>
            <div class="page-subtitle">ดูแลลูกค้าคนสำคัญ — Platinum / Gold / Silver${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ' <span style="color:var(--warning);font-size:0.75rem">● ตัวอย่างข้อมูล — ยังไม่มีลูกค้าเข้าเกณฑ์ VIP จริง</span>'}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-vip-btn">+ เพิ่ม VIP</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👑 สมาชิก VIP', vips.length + ' ราย', 'primary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'success')}
          ${kpi('🤝 Referrals จาก VIP', totalReferrals + ' ราย', 'warning')}
          ${kpi('📞 ไม่ได้ติดต่อ 30+ วัน', needContact, needContact > 0 ? 'danger' : 'success')}
        </div>

        <!-- Tier benefits -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          ${Object.entries(VIP_TIERS).map(([k, t]) => `
            <div class="card" style="padding:12px;border-top:3px solid var(--${t.color})">
              <div style="font-weight:700;font-size:0.85rem;margin-bottom:4px">${t.icon} ${t.label}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:6px">ยอดสะสม ${formatCurrency(t.minSpend)}+</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">${t.benefits.map(b => '· ' + b).join('<br>')}</div>
            </div>
          `).join('')}
        </div>

        <!-- Tier filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${tierFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(VIP_TIERS).map(([k,v]) => `<button class="btn btn-xs ${tierFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- VIP list -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(v => {
            const vt = VIP_TIERS[v.tier]
            const stale = v.lastContact <= addDays(-30)
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${vt?.color})${stale?';background:var(--danger)06':''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${vt?.icon} ${escHtml(v.name)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${v.cars} คัน · 🤝 แนะนำ ${v.referrals} ราย · 🎂 ${v.birthday} · ใช้สิทธิ์ ${v.perks_used} ครั้ง</div>
                  <div style="font-size:0.72rem;color:var(--${stale?'danger':'text-muted'})">👤 ${v.manager} · ติดต่อล่าสุด ${timeAgo(v.lastContact)}${stale?' ⚠️':''}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${vt?.color}" style="font-size:0.63rem">${vt?.icon} ${vt?.label}</span>
                  <div style="font-size:0.88rem;font-weight:700;color:var(--success)">${formatCurrency(v.totalSpend)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-primary contact-btn" data-id="${v.id}">📞 บันทึกติดต่อ</button>
                <button class="btn btn-xs btn-secondary perk-btn" data-id="${v.id}">🎁 มอบสิทธิพิเศษ</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { tierFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.contact-btn').forEach(b => b.addEventListener('click', () => {
      const v = vips.find(x => x.id === b.dataset.id)
      if (v) { v.lastContact = addDays(0); showToast(`📞 บันทึกการติดต่อ ${v.name}`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.perk-btn').forEach(b => b.addEventListener('click', () => {
      const v = vips.find(x => x.id === b.dataset.id)
      if (v) openModal({
        title: '🎁 มอบสิทธิพิเศษ: ' + escHtml(v.name),
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">สิทธิพิเศษ</label>
          <select class="input" id="pk-perk">
            <option>ล้างรถ + Detailing ฟรี</option>
            <option>เช็คระยะฟรี 1 ครั้ง</option>
            <option>ของขวัญวันเกิด (Gift Set)</option>
            <option>บัตรเชิญงาน Exclusive</option>
            <option>ส่วนลดพิเศษรถคันถัดไป 30,000</option>
          </select></div>`,
        confirmText: '🎁 มอบสิทธิ์',
        onConfirm() {
          v.perks_used++; v.lastContact = addDays(0)
          showToast(`🎁 มอบสิทธิ์ให้ ${v.name} แล้ว — แจ้งทาง LINE`, 'success'); renderPage()
        }
      })
    }))
    document.getElementById('add-vip-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่มสมาชิก VIP',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="vp-name"></div>
          <div class="input-group"><label class="input-label">ยอดสะสม (บาท)</label><input class="input" type="number" id="vp-spend" value="0"></div>
          <div class="input-group"><label class="input-label">ผู้ดูแล</label><input class="input" id="vp-manager"></div>
        </div>`,
        onConfirm() {
          const name = document.getElementById('vp-name')?.value?.trim()
          if (!name) { showToast('❗ กรอกชื่อ', 'error'); return }
          const spend = parseInt(document.getElementById('vp-spend')?.value) || 0
          const tier = spend >= 3000000 ? 'platinum' : spend >= 1500000 ? 'gold' : 'silver'
          vips.push({ id:`V${String(vips.length+1).padStart(3,'0')}`, name, tier, totalSpend:spend, cars:1, referrals:0, manager:document.getElementById('vp-manager')?.value||'—', lastContact:addDays(0), birthday:'—', perks_used:0 })
          showToast(`👑 เพิ่ม VIP ระดับ ${VIP_TIERS[tier].label}`, 'success'); renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
