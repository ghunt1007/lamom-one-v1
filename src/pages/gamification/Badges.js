/**
 * Badges — ตราสัญลักษณ์ความสำเร็จ
 * Route: /gamification/badges
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { BADGE_CATEGORIES, BADGE_RARITY, computeMyBadges } from './gamificationData.js'

export default async function BadgesPage(container) {
  const myGen = container.__routerGen
  let catFilter = 'all'
  let rarityFilter = 'all'
  let showMineOnly = false
  let ALL_BADGES = []
  let loading = true

  async function loadData() {
    loading = true
    try { ALL_BADGES = await computeMyBadges() } catch { ALL_BADGES = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const MY_BADGES = ALL_BADGES.filter(b => b.unlocked).map(b => b.id)
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
              ${owned ? '<div style="font-size:0.65rem;color:var(--success);margin-top:4px">✅ ปลดล็อกแล้ว</div>' : `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px">🔒 ${b.requirement}</div>`}
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
    const owned = !!b.unlocked
    const trackable = typeof b.check === 'function'
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
        <div style="margin-top:12px;text-align:center;padding:10px;background:${owned?'rgba(34,197,94,.1)':'var(--surface-2)'};border-radius:var(--radius-sm)">
          ${owned ? '<span style="color:var(--success);font-weight:700">✅ คุณได้รับ Badge นี้แล้ว! (คำนวณจากข้อมูลจริง)</span>' : trackable ? '<span style="color:var(--text-muted)">🔒 ยังไม่ถึงเงื่อนไข</span>' : '<span style="color:var(--text-muted)">🔒 รอข้อมูลระบบ (ยังไม่รองรับติดตามอัตโนมัติ)</span>'}
        </div>
      `
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
