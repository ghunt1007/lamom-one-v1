/**
 * Badges — ตราสัญลักษณ์ความสำเร็จ
 * Route: /gamification/badges
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const BADGE_CATEGORIES = {
  sales:    { label: 'การขาย', color: 'primary' },
  service:  { label: 'บริการ', color: 'warning' },
  kpi:      { label: 'KPI', color: 'success' },
  team:     { label: 'ทีมงาน', color: 'secondary' },
  special:  { label: 'พิเศษ', color: 'danger' },
}

const BADGE_RARITY = {
  common:   { label: 'Common', color: '#94a3b8', star: '⭐' },
  rare:     { label: 'Rare', color: '#3b82f6', star: '💙' },
  epic:     { label: 'Epic', color: '#8b5cf6', star: '💜' },
  legendary:{ label: 'Legendary', color: '#f59e0b', star: '🌟' },
}

const ALL_BADGES = [
  { id: 'B001', name: 'First Sale', icon: '🎯', cat: 'sales', rarity: 'common', desc: 'ปิดดีลได้เป็นครั้งแรก', requirement: 'ขายรถได้ 1 คัน', points: 50, holders: 12 },
  { id: 'B002', name: 'Sales Rookie', icon: '🚀', cat: 'sales', rarity: 'common', desc: 'ขายรถได้ 5 คัน', requirement: '5 คันสะสม', points: 100, holders: 9 },
  { id: 'B003', name: 'Sales Pro', icon: '⭐', cat: 'sales', rarity: 'rare', desc: 'ขายรถได้ 20 คัน', requirement: '20 คันสะสม', points: 300, holders: 4 },
  { id: 'B004', name: 'EV Expert', icon: '⚡', cat: 'sales', rarity: 'epic', desc: 'ขาย EV ได้ 50 คัน', requirement: 'EV 50 คัน', points: 800, holders: 1 },
  { id: 'B005', name: 'Speed Closer', icon: '⚡', cat: 'sales', rarity: 'rare', desc: 'ปิดดีลภายใน 3 วัน', requirement: 'ปิด 3 ดีลใน 1 สัปดาห์', points: 250, holders: 3 },
  { id: 'B006', name: 'Customer Whisperer', icon: '💬', cat: 'service', rarity: 'epic', desc: 'ได้ CSAT 5 ดาวติดต่อ 10 ครั้ง', requirement: 'CSAT 5★ × 10', points: 500, holders: 2 },
  { id: 'B007', name: 'Problem Solver', icon: '🔧', cat: 'service', rarity: 'common', desc: 'แก้ปัญหาลูกค้าสำเร็จ 10 ราย', requirement: 'Resolve 10 cases', points: 150, holders: 8 },
  { id: 'B008', name: 'KPI Champion', icon: '🏆', cat: 'kpi', rarity: 'epic', desc: 'ทำ KPI ได้ 100% 3 เดือนติดกัน', requirement: 'KPI 100% × 3 months', points: 600, holders: 2 },
  { id: 'B009', name: 'Team Player', icon: '🤝', cat: 'team', rarity: 'common', desc: 'ช่วยเพื่อนร่วมทีม 5 ครั้ง', requirement: 'Help 5 teammates', points: 80, holders: 11 },
  { id: 'B010', name: 'Legendary Seller', icon: '👑', cat: 'sales', rarity: 'legendary', desc: 'ขายรถได้ 100 คัน — สุดยอดเซลส์', requirement: '100 คันสะสม', points: 5000, holders: 0 },
  { id: 'B011', name: 'Perfect Attendance', icon: '📅', cat: 'kpi', rarity: 'rare', desc: 'ไม่ขาดงาน 6 เดือน', requirement: 'Attendance 100% × 6 months', points: 400, holders: 5 },
  { id: 'B012', name: 'Top Revenue Q1', icon: '💰', cat: 'special', rarity: 'legendary', desc: 'รายได้สูงสุดประจำไตรมาส 1', requirement: 'Special Achievement', points: 2000, holders: 1 },
]

const MY_BADGES = ['B001', 'B002', 'B007', 'B009', 'B011']

export default async function BadgesPage(container) {
  let catFilter = 'all'
  let rarityFilter = 'all'
  let showMineOnly = false

  function renderPage() {
    const list = ALL_BADGES.filter(b => {
      if (catFilter !== 'all' && b.cat !== catFilter) return false
      if (rarityFilter !== 'all' && b.rarity !== rarityFilter) return false
      if (showMineOnly && !MY_BADGES.includes(b.id)) return false
      return true
    })
    const myCount = MY_BADGES.length
    const myPoints = ALL_BADGES.filter(b => MY_BADGES.includes(b.id)).reduce((a, b) => a + b.points, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏅 Badges</div>
            <div class="page-subtitle">ตราสัญลักษณ์ความสำเร็จ — สะสมและปลดล็อก</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🏅 Badges ทั้งหมด', ALL_BADGES.length, 'primary')}
          ${kpi('✅ ของฉัน', myCount, 'success')}
          ${kpi('⭐ คะแนนรวม', myPoints.toLocaleString(), 'warning')}
          ${kpi('🔒 ยังไม่ได้', ALL_BADGES.length - myCount, 'secondary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
            ${Object.entries(BADGE_CATEGORIES).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.label}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-left:auto">
            ${Object.entries(BADGE_RARITY).map(([k,v]) => `<button class="btn btn-xs ${rarityFilter===k?'btn-primary':'btn-secondary'} rf-btn" data-r="${k}" style="color:${v.color}">${v.star} ${v.label}</button>`).join('')}
            <button class="btn btn-xs ${showMineOnly?'btn-success':'btn-secondary'}" id="mine-only-btn">🎖 ของฉัน</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
          ${list.map(b => {
            const cat = BADGE_CATEGORIES[b.cat]
            const rar = BADGE_RARITY[b.rarity]
            const owned = MY_BADGES.includes(b.id)
            return `<div class="card badge-card" data-id="${b.id}" style="padding:16px;text-align:center;cursor:pointer;${!owned?'opacity:0.5;filter:grayscale(0.7)':''}border-top:3px solid ${rar.color}">
              <div style="font-size:2.5rem;margin-bottom:6px">${b.icon}</div>
              <div style="font-weight:700;font-size:0.87rem;margin-bottom:2px">${b.name}</div>
              <div style="font-size:0.7rem;color:${rar.color};margin-bottom:6px">${rar.star} ${rar.label}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">${b.desc}</div>
              <div style="font-size:0.75rem;font-weight:700;color:var(--warning)">+${b.points} pts</div>
              ${owned ? '<div style="font-size:0.65rem;color:var(--success);margin-top:4px">✅ ปลดล็อกแล้ว</div>' : `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px">👥 ${b.holders} คนได้แล้ว</div>`}
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.rf-btn').forEach(b => b.addEventListener('click', () => { rarityFilter = rarityFilter === b.dataset.r ? 'all' : b.dataset.r; renderPage() }))
    document.getElementById('mine-only-btn')?.addEventListener('click', () => { showMineOnly = !showMineOnly; renderPage() })
    container.querySelectorAll('.badge-card').forEach(el => el.addEventListener('click', () => {
      const b = ALL_BADGES.find(x => x.id === el.dataset.id); if (b) openBadgeDetail(b)
    }))
  }

  function openBadgeDetail(b) {
    const cat = BADGE_CATEGORIES[b.cat]
    const rar = BADGE_RARITY[b.rarity]
    const owned = MY_BADGES.includes(b.id)
    openModal({
      title: `${b.icon} ${b.name}`,
      size: 'sm',
      body: `
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:4rem;margin-bottom:8px;${!owned?'filter:grayscale(1)':''}">${b.icon}</div>
          <div style="font-size:0.85rem;color:${rar.color};font-weight:700">${rar.star} ${rar.label}</div>
          <span class="badge badge-${cat?.color}" style="margin-top:6px;display:inline-block">${cat?.label}</span>
        </div>
        <div style="font-size:0.88rem;text-align:center;margin-bottom:14px">${b.desc}</div>
        ${row('เงื่อนไข', b.requirement)}
        ${row('คะแนนที่ได้', '+' + b.points + ' pts')}
        ${row('มีผู้ได้แล้ว', b.holders + ' คน')}
        <div style="margin-top:12px;text-align:center;padding:10px;background:${owned?'rgba(34,197,94,.1)':'var(--surface-2)'};border-radius:var(--radius-sm)">
          ${owned ? '<span style="color:var(--success);font-weight:700">✅ คุณได้รับ Badge นี้แล้ว!</span>' : '<span style="color:var(--text-muted)">🔒 ยังไม่ได้ปลดล็อก</span>'}
        </div>
      `
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
