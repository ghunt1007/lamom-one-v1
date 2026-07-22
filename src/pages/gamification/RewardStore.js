/**
 * Reward Store — ร้านแลกของรางวัล (แต้มพนักงาน)
 * Route: /gamification/rewards
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { timeAgo } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const REWARD_CATS = {
  cash:    { label: 'เงิน/บัตรกำนัล', icon: '💰' },
  time:    { label: 'วันหยุด/เวลา', icon: '🏖' },
  item:    { label: 'ของรางวัล', icon: '🎁' },
  perk:    { label: 'สิทธิพิเศษ', icon: '✨' },
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

export default async function RewardStorePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let rewards = []
  let staffPoints = []
  let redemptions = []
  let catFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      rewards = await listDocs('gamification_rewards', [], 'points', 'asc', 100)
      staffPoints = await listDocs('staff_points', [], 'points', 'desc', 100)
      redemptions = await listDocs('reward_redemptions', [], 'createdAt', 'desc', 10)
    } catch (e) { /* keep whatever loaded */ }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = rewards.filter(r => catFilter === 'all' || r.cat === catFilter)
    const totalRedeemed = rewards.reduce((a, r) => a + (r.redeemed30||0), 0)
    const totalPoints = staffPoints.reduce((a, s) => a + (s.points||0), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎁 Reward Store</div>
            <div class="page-subtitle">แลกแต้มสะสมเป็นของรางวัล — สร้างแรงจูงใจทีม</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🎁 ของรางวัล', rewards.length + ' รายการ', 'primary')}
          ${kpi('🔄 แลกแล้ว (30 วัน)', totalRedeemed + ' ครั้ง', 'success')}
          ${kpi('⭐ แต้มหมุนเวียน', totalPoints.toLocaleString(), 'warning')}
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <div>
            <!-- Category filter -->
            <div style="display:flex;gap:4px;margin-bottom:12px">
              <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
              ${Object.entries(REWARD_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-primary':'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
              ${list.map(r => {
                const rc = REWARD_CATS[r.cat]
                const out = r.stock === 0
                return `<div class="card" style="padding:12px;display:flex;flex-direction:column${out?';opacity:0.5':''}">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span style="font-size:1.2rem">${rc?.icon}</span>
                    ${r.popular ? '<span class="badge badge-danger" style="font-size:0.55rem">🔥 ฮิต</span>' : ''}
                  </div>
                  <div style="font-weight:700;font-size:0.8rem;flex:1;margin-bottom:6px">${r.name}</div>
                  <div style="font-size:0.95rem;font-weight:900;color:var(--warning);margin-bottom:4px">⭐ ${(r.points||0).toLocaleString()}</div>
                  <div style="font-size:0.63rem;color:var(--text-muted);margin-bottom:8px">${r.stock >= 99 ? 'ไม่จำกัด' : 'เหลือ ' + r.stock} · แลกแล้ว ${r.redeemed30||0}/เดือน</div>
                  <button class="btn btn-xs btn-primary redeem-btn" data-id="${r.id}" ${out?'disabled':''}>${out?'หมด':'🎁 แลก'}</button>
                </div>`
              }).join('')}
              ${!list.length ? `<div class="empty-state"><div class="empty-icon">🎁</div><div class="empty-title">ไม่มีของรางวัล</div></div>` : ''}
            </div>
          </div>

          <div>
            <!-- Staff points -->
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⭐ แต้มสะสมพนักงาน</div>
              ${staffPoints.map((s, i) => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
                  <span>${['🥇','🥈','🥉'][i] || (i+1)+'.'} ${esc(s.name)}</span>
                  <strong style="color:var(--warning)">⭐ ${(s.points||0).toLocaleString()}</strong>
                </div>
              `).join('')}
            </div>

            <!-- Recent redemptions -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔄 แลกล่าสุด</div>
              ${redemptions.map(r => `
                <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.73rem">
                  <div><strong>${esc(r.staff)}</strong> แลก ${esc(r.reward)}</div>
                  <div style="color:var(--text-muted);font-size:0.65rem">−${r.points} แต้ม · ${timeAgo(r.createdAt)}</div>
                </div>
              `).join('')}
              ${!redemptions.length ? `<div style="font-size:0.73rem;color:var(--text-muted)">ยังไม่มีการแลกของรางวัล</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.redeem-btn').forEach(b => b.addEventListener('click', () => {
      const r = rewards.find(x => x.id === b.dataset.id)
      if (r) openModal({
        title: '🎁 แลกรางวัล: ' + r.name,
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="font-size:0.85rem">ใช้ <strong style="color:var(--warning)">⭐ ${r.points.toLocaleString()}</strong> แต้ม</div>
          <div class="input-group"><label class="input-label">พนักงานที่แลก</label>
            <select class="input" id="rd-staff">${staffPoints.map(s=>`<option value="${s.id}" ${s.points<r.points?'disabled':''}>${esc(s.name)} (⭐ ${s.points.toLocaleString()})${s.points<r.points?' — แต้มไม่พอ':''}</option>`).join('')}</select>
          </div>
        </div>`,
        confirmText: '🎁 ยืนยันแลก',
        async onConfirm() {
          const staffId = document.getElementById('rd-staff')?.value
          const s = staffPoints.find(x => x.id === staffId)
          if (!s || s.points < r.points) { showToast('❗ แต้มไม่พอ', 'error'); return false }
          await updateDocData('staff_points', s.id, { points: s.points - r.points })
          await updateDocData('gamification_rewards', r.id, { stock: r.stock < 99 ? r.stock - 1 : r.stock, redeemed30: (r.redeemed30||0) + 1 })
          await createDoc('reward_redemptions', { staff: s.name, reward: r.name, points: r.points })
          showToast(`🎉 ${s.name} แลก "${r.name}" สำเร็จ!`, 'success'); await loadData()
        }
      })
    }))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
