import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TIERS = {
  bronze:   { label: 'Bronze', icon: '🥉', color: '#cd7f32', minPoints: 0,     maxPoints: 999,   benefit: 'ลด 1% ค่าบริการ' },
  silver:   { label: 'Silver', icon: '🥈', color: '#c0c0c0', minPoints: 1000,  maxPoints: 4999,  benefit: 'ลด 3% ค่าบริการ + ฟรีตรวจสภาพ 1 ครั้ง/ปี' },
  gold:     { label: 'Gold',   icon: '🥇', color: '#ffd700', minPoints: 5000,  maxPoints: 14999, benefit: 'ลด 5% + บริการก่อน + ฟรีล้างรถ 4 ครั้ง/ปี' },
  platinum: { label: 'Platinum',icon: '💎', color: '#e5e4e2', minPoints: 15000, maxPoints: 99999, benefit: 'ลด 8% + VIP Lane + ฟรีรับ-ส่งรถ' },
}

function getTier(points) {
  if (points >= 15000) return 'platinum'
  if (points >= 5000) return 'gold'
  if (points >= 1000) return 'silver'
  return 'bronze'
}

function nextTier(current) {
  const map = { bronze: 'silver', silver: 'gold', gold: 'platinum', platinum: null }
  return map[current]
}

const EARN_RATES = [
  { label: 'ซื้อรถ', pointsPer: '1 คะแนน / 1,000 บาท', icon: '🚗' },
  { label: 'ซ่อมบำรุง', pointsPer: '2 คะแนน / 100 บาท', icon: '🔧' },
  { label: 'ซื้อประกัน', pointsPer: '100 คะแนน / กรมธรรม์', icon: '🛡' },
  { label: 'แนะนำลูกค้าใหม่', pointsPer: '500 คะแนน / ราย', icon: '👥' },
  { label: 'วันเกิด', pointsPer: '200 คะแนน', icon: '🎂' },
  { label: 'รีวิว Google', pointsPer: '50 คะแนน', icon: '⭐' },
]

const DEMO_MEMBERS = [
  { id: 'LM001', name: 'วิชาญ มีโชค', phone: '081-234-5678', email: 'wichan@mail.com', joinDate: '2023-01-15', points: 18500, vehicles: ['BYD Seal AWD', 'BYD Atto 3'], totalSpend: 2450000, lastActivity: '2025-06-08' },
  { id: 'LM002', name: 'อรนุช สายใจ', phone: '082-345-6789', email: 'ornuch@mail.com', joinDate: '2023-06-20', points: 6750, vehicles: ['MG ZS EV'], totalSpend: 1150000, lastActivity: '2025-05-20' },
  { id: 'LM003', name: 'ธีรยุทธ เก่งกาจ', phone: '083-456-7890', email: 'teerayut@mail.com', joinDate: '2024-01-10', points: 3200, vehicles: ['Neta V'], totalSpend: 680000, lastActivity: '2025-04-15' },
  { id: 'LM004', name: 'สมหญิง รักรถ', phone: '084-567-8901', email: 'somying@mail.com', joinDate: '2024-03-05', points: 850, vehicles: ['ORA Good Cat'], totalSpend: 320000, lastActivity: '2025-06-01' },
  { id: 'LM005', name: 'มานะ กล้าหาญ', phone: '085-678-9012', email: 'mana@mail.com', joinDate: '2022-09-15', points: 12400, vehicles: ['BYD Seal', 'BYD Tang EV'], totalSpend: 3200000, lastActivity: '2025-05-28' },
  { id: 'LM006', name: 'สาวิตรี มีเงิน', phone: '086-789-0123', email: 'sawit2@mail.com', joinDate: '2023-11-20', points: 4500, vehicles: ['MG ZS EV Grand Luxury'], totalSpend: 1059000, lastActivity: '2025-03-10' },
]

const DEMO_HISTORY = [
  { memberId: 'LM001', date: '2025-06-08', type: 'earn', points: 500, desc: 'ซ่อมบำรุงรายไตรมาส - BYD Seal', balance: 18500 },
  { memberId: 'LM001', date: '2025-04-20', type: 'earn', points: 1000, desc: 'แนะนำลูกค้าใหม่ - อรนุช สายใจ', balance: 18000 },
  { memberId: 'LM001', date: '2025-03-01', type: 'redeem', points: -500, desc: 'แลกรับ ฟรีล้างรถ 2 ครั้ง', balance: 17000 },
  { memberId: 'LM002', date: '2025-05-20', type: 'earn', points: 200, desc: 'ซ่อมบำรุง - MG ZS EV', balance: 6750 },
  { memberId: 'LM002', date: '2025-01-15', type: 'earn', points: 100, desc: 'ต่ออายุประกันภัย', balance: 6550 },
]

const REDEEM_CATALOG = [
  { id: 'R001', name: 'ฟรีล้างรถ (1 ครั้ง)', points: 200, icon: '🚿' },
  { id: 'R002', name: 'ฟรีตรวจสภาพรถ', points: 500, icon: '🔍' },
  { id: 'R003', name: 'ส่วนลดค่าซ่อม 500 บาท', points: 1000, icon: '🔧' },
  { id: 'R004', name: 'ส่วนลดค่าซ่อม 1,000 บาท', points: 1800, icon: '🔧' },
  { id: 'R005', name: 'ของขวัญ LAMOM Gift Set', points: 2000, icon: '🎁' },
  { id: 'R006', name: 'Upgrade ประกันชั้น 1 ฟรี 1 ปี', points: 10000, icon: '🛡' },
]

export default async function CustomerLoyaltyPage(container) {
  const myGen = container.__routerGen
  let tab = 'members'
  let tierFilter = 'all'
  let members = [...DEMO_MEMBERS]
  let history = [...DEMO_HISTORY]
  let dataSource = 'demo'

  try {
    const sales = await getSalesData()
    if (container.__routerGen !== myGen) return

    if (sales.length) {
      const byCustomer = {}
      let idx = 0
      sales.forEach(s => {
        const name = s.custName || 'ไม่ระบุ'
        if (!byCustomer[name]) {
          byCustomer[name] = {
            id: 'LM' + String(++idx).padStart(3, '0'),
            name, phone: s.custPhone || '', email: s.custEmail || '',
            joinDate: s.date ? s.date.slice(0, 10) : '',
            points: 0, vehicles: [], totalSpend: 0, lastActivity: '',
          }
        }
        const m = byCustomer[name]
        m.totalSpend += s.salePrice || 0
        m.points += Math.floor((s.salePrice || 0) / 1000)
        const veh = ((s.brand || '') + ' ' + (s.model || '')).trim()
        if (veh && !m.vehicles.includes(veh)) m.vehicles.push(veh)
        const d = s.date ? s.date.slice(0, 10) : ''
        if (d > m.lastActivity) m.lastActivity = d
      })
      const live = Object.values(byCustomer).filter(m => m.name !== 'ไม่ระบุ')
      if (live.length) { members = live; dataSource = 'live' }
    }
  } catch {}

  function filtered() {
    return members.filter(m => tierFilter === 'all' || getTier(m.points) === tierFilter)
      .sort((a, b) => b.points - a.points)
  }

  function tierStats() {
    const stats = {}
    Object.keys(TIERS).forEach(t => { stats[t] = members.filter(m => getTier(m.points) === t).length })
    return stats
  }

  function renderPage() {
    const list = filtered()
    const stats = tierStats()
    const totalPoints = members.reduce((a, m) => a + m.points, 0)
    const avgPoints = members.length ? Math.round(totalPoints / members.length) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👑 Customer Loyalty</div>
            <div class="page-subtitle">โปรแกรมสะสมคะแนนและสิทธิพิเศษลูกค้า
              ${dataSource === 'live' ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">Demo</span>'}
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-pts-btn">+ เพิ่มคะแนน</button>
          </div>
        </div>

        <!-- Tier KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${Object.entries(TIERS).map(([k,v]) => `
            <div class="kpi-card" style="border-left:3px solid ${v.color}">
              <div class="kpi-title">${v.icon} ${v.label}</div>
              <div class="kpi-value" style="color:${v.color}">${stats[k]}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${v.benefit.slice(0, 30)}...</div>
            </div>
          `).join('')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:14px">
          ${[['members','👥 สมาชิกทั้งหมด'],['history','📋 ประวัติคะแนน'],['redeem','🎁 Redeem Catalog'],['rules','📜 กติกา']].map(([t,l]) => `<button class="btn btn-sm ${tab===t?'btn-primary':'btn-secondary'} tab-btn" data-t="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'members' ? renderMembers(list, stats) : tab === 'history' ? renderHistory() : tab === 'redeem' ? renderRedeem() : renderRules()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('export-btn')?.addEventListener('click', () => { exportToExcel(list.map(m => { const tier = TIERS[getTier(m.points)]; return { ID: m.id, ชื่อ: m.name, โทร: m.phone, ระดับ: tier.label, คะแนน: m.points, ยอดซื้อรวม: m.totalSpend, สมัครวันที่: m.joinDate, กิจกรรมล่าสุด: m.lastActivity } }), 'loyalty_members'); showToast('📥 Export แล้ว!', 'success') })
    document.getElementById('add-pts-btn')?.addEventListener('click', () => openAddPoints())
    document.getElementById('tier-filter')?.addEventListener('change', e => { tierFilter = e.target.value; renderPage() })
    document.querySelectorAll('.open-member-btn').forEach(b => b.addEventListener('click', () => { const m = members.find(x => x.id === b.dataset.id); if (m) openMemberDetail(m) }))
    document.querySelectorAll('.redeem-btn').forEach(b => b.addEventListener('click', () => openRedeemModal(b.dataset.id)))
  }

  function renderMembers(list, stats) {
    return `
      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
        <select class="input" id="tier-filter" style="width:140px">
          <option value="all">ทุก Tier</option>
          ${Object.entries(TIERS).map(([k,v]) => `<option value="${k}" ${tierFilter===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
        <span style="font-size:0.82rem;color:var(--text-muted);margin-left:auto">${list.length} สมาชิก</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>สมาชิก</th><th>รถ</th><th>คะแนนสะสม</th><th>ระดับ</th><th>เป้าถัดไป</th><th>ยอดซื้อรวม</th><th>กิจกรรมล่าสุด</th><th></th></tr></thead>
          <tbody>
            ${list.map(m => {
              const tier = TIERS[getTier(m.points)]
              const nt = nextTier(getTier(m.points))
              const ntInfo = nt ? TIERS[nt] : null
              const toNext = ntInfo ? ntInfo.minPoints - m.points : 0
              return `<tr>
                <td>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(m.name)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(m.phone)} · ${m.id}</div>
                </td>
                <td style="font-size:0.8rem;max-width:150px">${m.vehicles.map(v => escHtml(v)).join(', ')}</td>
                <td>
                  <div style="font-weight:800;font-size:1rem;color:${tier.color}">${m.points.toLocaleString()}</div>
                </td>
                <td>
                  <span style="font-size:1rem">${tier.icon}</span>
                  <span style="font-size:0.82rem;font-weight:700;color:${tier.color};margin-left:4px">${tier.label}</span>
                </td>
                <td style="font-size:0.78rem;color:var(--text-muted)">
                  ${ntInfo ? `อีก ${toNext.toLocaleString()} คะแนน → ${ntInfo.icon} ${ntInfo.label}` : '<span style="color:var(--primary)">สูงสุดแล้ว 🏆</span>'}
                </td>
                <td class="text-right" style="font-size:0.83rem;color:var(--success)">${formatCurrency(m.totalSpend)}</td>
                <td style="font-size:0.8rem;color:var(--text-muted)">${formatDate(m.lastActivity)}</td>
                <td><button class="btn btn-xs btn-secondary open-member-btn" data-id="${m.id}">ดู</button></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderHistory() {
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>สมาชิก</th><th>วันที่</th><th>รายการ</th><th class="text-right">คะแนน</th><th class="text-right">ยอดคงเหลือ</th></tr></thead>
          <tbody>
            ${history.map(h => {
              const m = members.find(x => x.id === h.memberId)
              return `<tr>
                <td style="font-size:0.85rem;font-weight:600">${m ? escHtml(m.name) : h.memberId}</td>
                <td style="font-size:0.82rem">${formatDate(h.date)}</td>
                <td style="font-size:0.82rem">${escHtml(h.desc)}</td>
                <td class="text-right" style="font-weight:700;color:${h.points > 0 ? 'var(--success)' : 'var(--danger)'}">
                  ${h.points > 0 ? '+' : ''}${h.points.toLocaleString()}
                </td>
                <td class="text-right" style="font-size:0.82rem">${h.balance.toLocaleString()}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderRedeem() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
        ${REDEEM_CATALOG.map(item => `
          <div class="card" style="padding:16px;text-align:center">
            <div style="font-size:2rem;margin-bottom:8px">${item.icon}</div>
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:6px">${item.name}</div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--primary);margin-bottom:10px">${item.points.toLocaleString()} คะแนน</div>
            <button class="btn btn-sm btn-primary redeem-btn" data-id="${item.id}" style="width:100%">แลกรับ</button>
          </div>
        `).join('')}
      </div>
    `
  }

  function renderRules() {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:12px">📌 อัตราการสะสมคะแนน</div>
          ${EARN_RATES.map(r => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:1.2rem">${r.icon}</span>
            <div>
              <div style="font-size:0.84rem;font-weight:600">${r.label}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${r.pointsPer}</div>
            </div>
          </div>`).join('')}
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:12px">👑 สิทธิพิเศษตาม Tier</div>
          ${Object.entries(TIERS).map(([k,v]) => `<div style="padding:10px;border-radius:var(--radius-sm);margin-bottom:8px;border-left:3px solid ${v.color};background:var(--surface-2)">
            <div style="display:flex;align-items:center;gap:6px;font-weight:700;margin-bottom:3px">
              <span>${v.icon}</span><span style="color:${v.color}">${v.label}</span>
              <span style="font-size:0.72rem;color:var(--text-muted)">(${v.minPoints.toLocaleString()}+ คะแนน)</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${v.benefit}</div>
          </div>`).join('')}
        </div>
      </div>
    `
  }

  function openMemberDetail(m) {
    const tier = TIERS[getTier(m.points)]
    const nt = nextTier(getTier(m.points))
    const ntInfo = nt ? TIERS[nt] : null
    const toNext = ntInfo ? ntInfo.minPoints - m.points : 0
    const pct = ntInfo ? Math.round((m.points - tier.minPoints) / (ntInfo.minPoints - tier.minPoints) * 100) : 100
    const mHistory = history.filter(h => h.memberId === m.id)

    openModal({
      title: tier.icon + ' ' + escHtml(m.name) + ' — ' + tier.label,
      size: 'lg',
      body: `
        <!-- Tier progress -->
        <div style="padding:16px;background:var(--surface-2);border-radius:var(--radius-md);margin-bottom:16px;text-align:center">
          <div style="font-size:2.5rem;font-weight:900;color:${tier.color}">${m.points.toLocaleString()}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">คะแนนสะสม</div>
          <div style="height:8px;background:var(--surface);border-radius:4px;overflow:hidden;margin-bottom:6px">
            <div style="height:100%;width:${pct}%;background:${tier.color};border-radius:4px"></div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${ntInfo ? `อีก ${toNext.toLocaleString()} คะแนน → ${ntInfo.icon} ${ntInfo.label}` : '🏆 ถึงระดับสูงสุดแล้ว!'}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div>${['สมาชิกตั้งแต่ ' + formatDate(m.joinDate), 'โทร: ' + escHtml(m.phone), 'ยอดซื้อรวม: ' + formatCurrency(m.totalSpend), 'กิจกรรมล่าสุด: ' + formatDate(m.lastActivity)].map(t => `<div style="font-size:0.82rem;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text-muted)">${t}</div>`).join('')}</div>
          <div>
            <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">รถที่ลงทะเบียน</div>
            ${m.vehicles.map(v => `<div style="font-size:0.82rem;padding:4px 8px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:4px">🚗 ${escHtml(v)}</div>`).join('')}
          </div>
        </div>

        <!-- Benefit highlight -->
        <div style="padding:10px;background:rgba(99,102,241,.1);border-radius:var(--radius-sm);border-left:3px solid ${tier.color};margin-bottom:12px;font-size:0.82rem">
          <strong>สิทธิประโยชน์ปัจจุบัน:</strong> ${tier.benefit}
        </div>

        <!-- History -->
        ${mHistory.length ? `<div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">ประวัติล่าสุด</div>
        ${mHistory.slice(0, 5).map(h => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
          <span style="color:var(--text-muted)">${formatDate(h.date)} · ${escHtml(h.desc)}</span>
          <span style="font-weight:700;color:${h.points>0?'var(--success)':'var(--danger)'}">${h.points>0?'+':''}${h.points}</span>
        </div>`).join('')}` : ''}
      `,
      footer: `<button class="btn btn-primary add-pts-modal">+ เพิ่มคะแนน</button>`
    })
    setTimeout(() => { document.querySelector('.modal .add-pts-modal')?.addEventListener('click', () => { document.querySelector('.modal-close-btn')?.click(); openAddPoints(m) }) }, 50)
  }

  function openAddPoints(m) {
    openModal({
      title: '+ เพิ่มคะแนนสะสม',
      size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">สมาชิก *</label>
          <select class="input" id="ap-member">
            ${members.map(x => `<option value="${escHtml(x.id)}" ${m?.id===x.id?'selected':''}>${escHtml(x.name)} (${x.points.toLocaleString()} คะแนน)</option>`).join('')}
          </select>
        </div>
        <div class="input-group"><label class="input-label">รายการ</label>
          <select class="input" id="ap-type">
            ${EARN_RATES.map(r => `<option>${r.icon} ${r.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group"><label class="input-label">คะแนนที่เพิ่ม *</label><input type="number" class="input" id="ap-pts" placeholder="100" min="1"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="ap-note" placeholder="รายละเอียด..."></div>
      </div>`,
      onConfirm() {
        const memberId = document.getElementById('ap-member')?.value
        const pts = +document.getElementById('ap-pts')?.value
        const note = document.getElementById('ap-note')?.value || document.getElementById('ap-type')?.value || ''
        if (!pts || pts <= 0) { showToast('❗ กรุณากรอกคะแนน', 'error'); return }
        const member = members.find(x => x.id === memberId)
        if (!member) return
        member.points += pts
        history.unshift({ memberId, date: new Date().toISOString().slice(0,10), type: 'earn', points: pts, desc: note, balance: member.points })
        showToast(`✅ เพิ่ม ${pts} คะแนนให้ ${member.name} แล้ว`, 'success')
        renderPage()
      }
    })
  }

  function openRedeemModal(itemId) {
    const item = REDEEM_CATALOG.find(x => x.id === itemId)
    if (!item) return
    openModal({
      title: `🎁 แลกรับ — ${item.name}`,
      size: 'sm',
      body: `<div style="text-align:center;padding:10px 0">
        <div style="font-size:3rem;margin-bottom:8px">${item.icon}</div>
        <div style="font-size:1.2rem;font-weight:700;margin-bottom:4px">${item.name}</div>
        <div style="font-size:1.5rem;font-weight:900;color:var(--primary);margin-bottom:16px">${item.points.toLocaleString()} คะแนน</div>
        <div class="input-group"><label class="input-label">เลือกสมาชิก *</label>
          <select class="input" id="rd-member">
            ${members.filter(m => m.points >= item.points).map(m => `<option value="${escHtml(m.id)}">${escHtml(m.name)} (${m.points.toLocaleString()} คะแนน)</option>`).join('')}
          </select>
        </div>
        ${!members.filter(m => m.points >= item.points).length ? `<div style="color:var(--danger);font-size:0.82rem">ไม่มีสมาชิกที่มีคะแนนเพียงพอ</div>` : ''}
      </div>`,
      onConfirm() {
        const memberId = document.getElementById('rd-member')?.value
        if (!memberId) { showToast('❗ กรุณาเลือกสมาชิก', 'error'); return }
        const member = members.find(x => x.id === memberId)
        if (!member || member.points < item.points) { showToast('❗ คะแนนไม่เพียงพอ', 'error'); return }
        member.points -= item.points
        history.unshift({ memberId, date: new Date().toISOString().slice(0,10), type: 'redeem', points: -item.points, desc: `แลกรับ: ${item.name}`, balance: member.points })
        showToast(`🎁 แลกรับ ${item.name} ให้ ${member.name} แล้ว!`, 'success')
        renderPage()
      }
    })
  }

  renderPage()
}
