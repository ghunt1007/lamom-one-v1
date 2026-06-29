/**
 * Reward Store — ร้านแลกของรางวัล (แต้มพนักงาน)
 * Route: /gamification/rewards
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const REWARD_CATS = {
  cash:    { label: 'เงิน/บัตรกำนัล', icon: '💰' },
  time:    { label: 'วันหยุด/เวลา', icon: '🏖' },
  item:    { label: 'ของรางวัล', icon: '🎁' },
  perk:    { label: 'สิทธิพิเศษ', icon: '✨' },
}

const DEMO_REWARDS = [
  { id: 'RW001', name: 'บัตรกำนัล Central 1,000 บาท', cat: 'cash', points: 1000, stock: 10, redeemed30: 6, popular: true },
  { id: 'RW002', name: 'ลาพิเศษ 1 วัน (ไม่หักโควต้า)', cat: 'time', points: 2000, stock: 99, redeemed30: 4, popular: true },
  { id: 'RW003', name: 'หูฟัง Bluetooth', cat: 'item', points: 1500, stock: 5, redeemed30: 2, popular: false },
  { id: 'RW004', name: 'เลือกที่จอดรถ VIP 1 เดือน', cat: 'perk', points: 800, stock: 2, redeemed30: 2, popular: true },
  { id: 'RW005', name: 'บัตรน้ำมัน 500 บาท', cat: 'cash', points: 500, stock: 20, redeemed30: 8, popular: true },
  { id: 'RW006', name: 'Voucher ร้านอาหาร 2 ที่นั่ง', cat: 'item', points: 1200, stock: 6, redeemed30: 3, popular: false },
  { id: 'RW007', name: 'ออกก่อนเวลา 2 ชม. (ศุกร์)', cat: 'time', points: 600, stock: 99, redeemed30: 9, popular: true },
  { id: 'RW008', name: 'มื้อกลางวันกับ MD', cat: 'perk', points: 3000, stock: 1, redeemed30: 0, popular: false },
]

const STAFF_POINTS = [
  { name: 'วิชัย ยอดขาย', points: 3450 },
  { name: 'สุดา มาดี', points: 2890 },
  { name: 'วิทยา ช่างใหญ่', points: 2640 },
  { name: 'ธนา เก่ง', points: 1820 },
  { name: 'มานะ ขยัน', points: 1100 },
]

const RECENT_REDEMPTIONS = [
  { staff: 'สุดา มาดี', reward: 'บัตรน้ำมัน 500 บาท', points: 500, when: 'วันนี้' },
  { staff: 'วิชัย ยอดขาย', reward: 'ลาพิเศษ 1 วัน', points: 2000, when: 'เมื่อวาน' },
  { staff: 'มานะ ขยัน', reward: 'ออกก่อนเวลา 2 ชม.', points: 600, when: '3 วันก่อน' },
]

export default async function RewardStorePage(container) {
  let rewards = DEMO_REWARDS.map(r => ({ ...r }))
  let staffPoints = STAFF_POINTS.map(s => ({ ...s }))
  let catFilter = 'all'

  function renderPage() {
    const list = rewards.filter(r => catFilter === 'all' || r.cat === catFilter)
    const totalRedeemed = rewards.reduce((a, r) => a + r.redeemed30, 0)
    const totalPoints = staffPoints.reduce((a, s) => a + s.points, 0)

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
                  <div style="font-size:0.95rem;font-weight:900;color:var(--warning);margin-bottom:4px">⭐ ${r.points.toLocaleString()}</div>
                  <div style="font-size:0.63rem;color:var(--text-muted);margin-bottom:8px">${r.stock >= 99 ? 'ไม่จำกัด' : 'เหลือ ' + r.stock} · แลกแล้ว ${r.redeemed30}/เดือน</div>
                  <button class="btn btn-xs btn-primary redeem-btn" data-id="${r.id}" ${out?'disabled':''}>${out?'หมด':'🎁 แลก'}</button>
                </div>`
              }).join('')}
            </div>
          </div>

          <div>
            <!-- Staff points -->
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⭐ แต้มสะสมพนักงาน</div>
              ${staffPoints.sort((a,b)=>b.points-a.points).map((s, i) => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
                  <span>${['🥇','🥈','🥉','4.','5.'][i]} ${s.name}</span>
                  <strong style="color:var(--warning)">⭐ ${s.points.toLocaleString()}</strong>
                </div>
              `).join('')}
            </div>

            <!-- Recent redemptions -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔄 แลกล่าสุด</div>
              ${RECENT_REDEMPTIONS.map(r => `
                <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.73rem">
                  <div><strong>${r.staff}</strong> แลก ${r.reward}</div>
                  <div style="color:var(--text-muted);font-size:0.65rem">−${r.points} แต้ม · ${r.when}</div>
                </div>
              `).join('')}
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
            <select class="input" id="rd-staff">${staffPoints.map(s=>`<option value="${s.name}" ${s.points<r.points?'disabled':''}>${s.name} (⭐ ${s.points.toLocaleString()})${s.points<r.points?' — แต้มไม่พอ':''}</option>`).join('')}</select>
          </div>
        </div>`,
        confirmText: '🎁 ยืนยันแลก',
        onConfirm() {
          const name = document.getElementById('rd-staff')?.value
          const s = staffPoints.find(x => x.name === name)
          if (!s || s.points < r.points) { showToast('❗ แต้มไม่พอ', 'error'); return }
          s.points -= r.points
          if (r.stock < 99) r.stock--
          r.redeemed30++
          showToast(`🎉 ${s.name} แลก "${r.name}" สำเร็จ!`, 'success'); renderPage()
        }
      })
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
