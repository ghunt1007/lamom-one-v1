/**
 * Loyalty Tier Auto-upgrade — ระบบ Tier อัตโนมัติตามคะแนนสะสม
 * Route: /crm/loyalty-tiers
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const TIERS = [
  { name:'Bronze', icon:'🥉', color:'#CD7F32', minPts:0,    maxPts:4999,  discount:2, freeService:0, birthdayBonus:500,   priority:'ปกติ' },
  { name:'Silver', icon:'🥈', color:'#A8A9AD', minPts:5000, maxPts:14999, discount:5, freeService:1, birthdayBonus:1000,  priority:'Medium' },
  { name:'Gold',   icon:'🥇', color:'#FFD700', minPts:15000,maxPts:39999, discount:8, freeService:2, birthdayBonus:2000,  priority:'High' },
  { name:'Platinum',icon:'💎',color:'#E5E4E2', minPts:40000,maxPts:999999,discount:12,freeService:3, birthdayBonus:5000,  priority:'VIP' },
]

const MEMBERS = [
  { id:'M001', name:'นภา มีสุข', pts:18200, tier:'Gold', history:[{date:'2026-06-01',pts:1500,desc:'ซื้อ BYD Atto 3'},{date:'2026-05-10',pts:200,desc:'เช็คระยะ'},{date:'2026-04-01',pts:500,desc:'ต่อประกัน'}] },
  { id:'M002', name:'สมชาย วิเศษ', pts:42800, tier:'Platinum', history:[{date:'2026-06-10',pts:2000,desc:'ซื้อ BYD Han'},{date:'2026-05-20',pts:300,desc:'Service Pack'}] },
  { id:'M003', name:'มาลี จันทร์ดี', pts:4200, tier:'Bronze', history:[{date:'2026-06-05',pts:800,desc:'ซื้อ MG ZS EV'},{date:'2026-05-30',pts:100,desc:'เช็คระยะ'}] },
  { id:'M004', name:'วิชัย รุ่งเรือง', pts:13500, tier:'Silver', history:[{date:'2026-05-15',pts:1200,desc:'ซื้อรถ'},{date:'2026-04-20',pts:150,desc:'เช็คระยะ'}] },
  { id:'M005', name:'รัชนี สุขใจ', pts:6800, tier:'Silver', history:[{date:'2026-06-12',pts:400,desc:'ต่อประกัน'},{date:'2026-05-01',pts:600,desc:'อุปกรณ์เสริม'}] },
]

function getTier(pts) { return TIERS.slice().reverse().find(t => pts >= t.minPts) || TIERS[0] }
function getNext(pts) { return TIERS.find(t => pts < t.maxPts && pts >= t.minPts) }

export default async function LoyaltyTiersPage(container) {
  const myGen = container.__routerGen
  let liveMembers = [...MEMBERS].map(m => ({ ...m }))
  let dataSource = 'demo'
  let filterTier = 'all'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const byName = {}
      for (const s of sales) {
        const name = s.customerName || s.custName || ''
        if (!name) continue
        if (!byName[name]) byName[name] = { pts: 0, history: [] }
        const spend = s.salePrice || 0
        byName[name].pts += Math.round(spend / 100)
        byName[name].history.push({ date: s.bookingDate || s.deliveryDate || '', pts: Math.round(spend/100), desc: `ซื้อ ${s.model || 'รถ'}` })
      }
      const live = Object.entries(byName).map(([name, d], i) => {
        const tier = d.pts >= 40000 ? 'Platinum' : d.pts >= 15000 ? 'Gold' : d.pts >= 5000 ? 'Silver' : 'Bronze'
        return { id: `LV${i+1}`, name, pts: d.pts, tier, history: d.history.slice(0,3) }
      })
      if (live.length >= 2) { liveMembers = [...live, ...MEMBERS]; dataSource = 'live' }
    }
  } catch {}

  function render() {
    const members = filterTier === 'all' ? liveMembers : liveMembers.filter(m => m.tier === filterTier)
    const counts = TIERS.map(t => ({ ...t, count: liveMembers.filter(m => m.tier === t.name).length }))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏆 Loyalty Tier System</div>
            <div class="page-subtitle">อัปเกรด Tier อัตโนมัติตามคะแนน · ${liveMembers.length} สมาชิก · ${liveMembers.reduce((s,m)=>s+m.pts,0).toLocaleString()} คะแนนรวม${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="notify-btn">📢 แจ้ง Upgrade</button>
          </div>
        </div>

        <!-- Tier overview -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${counts.map(t => `
            <div class="card" style="padding:14px;border-top:4px solid ${t.color}">
              <div style="font-size:1.4rem;margin-bottom:4px">${t.icon}</div>
              <div style="font-weight:700;font-size:0.88rem">${t.name}</div>
              <div style="font-size:1.4rem;font-weight:900;color:${t.color};margin:4px 0">${t.count} คน</div>
              <div style="font-size:0.66rem;color:var(--text-muted)">${t.minPts.toLocaleString()}–${t.maxPts===999999?'∞':t.maxPts.toLocaleString()} pts</div>
              <div style="font-size:0.7rem;margin-top:6px;color:var(--text-muted)">
                ลด ${t.discount}% · เช็คฟรี ${t.freeService} ครั้ง/ปี<br>
                Birthday +${formatCurrency(t.birthdayBonus)}
              </div>
            </div>`).join('')}
        </div>

        <!-- Filter -->
        <div style="display:flex;gap:6px;margin-bottom:12px">
          <button class="btn btn-xs ${filterTier==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${TIERS.map(t=>`<button class="btn btn-xs ${filterTier===t.name?'btn-primary':'btn-secondary'} tf-btn" data-t="${t.name}">${t.icon} ${t.name}</button>`).join('')}
        </div>

        <!-- Members table -->
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:700px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
              <th style="padding:10px 12px;text-align:left">สมาชิก</th>
              <th style="text-align:center">Tier ปัจจุบัน</th>
              <th style="text-align:right">คะแนน</th>
              <th>Progress → Tier ถัดไป</th>
              <th style="text-align:center">สิทธิ์</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${members.map(m => {
                const tier = getTier(m.pts)
                const nextTier = TIERS[TIERS.findIndex(t => t.name === tier.name) + 1]
                const pct = nextTier ? Math.round(((m.pts - tier.minPts) / (nextTier.minPts - tier.minPts)) * 100) : 100
                const ptsToNext = nextTier ? (nextTier.minPts - m.pts).toLocaleString() : '—'
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.78rem">
                  <td style="padding:9px 12px;font-weight:700">${escHtml(m.name)}</td>
                  <td style="text-align:center"><span style="font-size:0.8rem">${tier.icon}</span> <span style="font-size:0.72rem;font-weight:700;color:${tier.color}">${tier.name}</span></td>
                  <td style="text-align:right;font-weight:700">${m.pts.toLocaleString()}</td>
                  <td style="min-width:180px;padding:0 12px">
                    <div style="height:6px;background:var(--surface-2);border-radius:3px;margin-bottom:3px">
                      <div style="height:100%;width:${Math.min(pct,100)}%;background:${tier.color};border-radius:3px;transition:width .3s"></div>
                    </div>
                    <div style="font-size:0.62rem;color:var(--text-muted)">${nextTier?`อีก ${ptsToNext} pts → ${nextTier.name}`:'Max Tier ✅'}</div>
                  </td>
                  <td style="text-align:center;font-size:0.7rem">ลด ${tier.discount}% · ฟรี ${tier.freeService}ครั้ง</td>
                  <td><button class="btn btn-xs btn-secondary hist-btn" data-id="${m.id}" style="font-size:0.7rem">ประวัติ</button></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Tier rules -->
        <div class="card" style="padding:14px;margin-top:14px">
          <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">⚙️ กฎการได้รับคะแนน (Auto)</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:0.74rem">
            ${[['🚗 ซื้อรถ','ทุก 100 บาท = 1 pt'],['🔧 เข้าศูนย์บริการ','ทุก 100 บาท = 0.5 pt'],['🛡 ต่อประกัน','ทุก 100 บาท = 1 pt'],['👥 แนะนำเพื่อน','500 pts/คน'],['🎂 วันเกิด','Bonus ตาม Tier'],['⭐ รีวิว 5 ดาว','50 pts']].map(([k,v])=>`
              <div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm)">
                <div style="font-weight:600">${k}</div>
                <div style="color:var(--text-muted);font-size:0.68rem">${v}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>`

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { filterTier = b.dataset.t; render() }))
    document.getElementById('notify-btn')?.addEventListener('click', () => {
      const upgradable = liveMembers.filter(m => {
        const tier = getTier(m.pts)
        const next = TIERS[TIERS.findIndex(t => t.name === tier.name) + 1]
        return next && (next.minPts - m.pts) < 1000
      })
      showToast(`📢 แจ้ง ${upgradable.length} คน ที่ใกล้ Upgrade ทาง LINE แล้ว`, 'success')
    })
    container.querySelectorAll('.hist-btn').forEach(b => b.addEventListener('click', () => {
      const m = liveMembers.find(x => x.id === b.dataset.id)
      if (!m) return
      const tier = getTier(m.pts)
      openModal({
        title: tier.icon + ' ' + escHtml(m.name) + ' · ' + m.pts.toLocaleString() + ' pts',
        size: 'sm',
        body: `
          <div style="font-size:0.78rem;margin-bottom:10px">
            <span style="background:${tier.color};color:#fff;padding:2px 10px;border-radius:10px;font-size:0.72rem">${tier.name}</span>
          </div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">📖 ประวัติคะแนน</div>
          ${m.history.map(h=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
            <span>${h.date} · ${escHtml(h.desc)}</span>
            <span style="font-weight:700;color:var(--success)">+${h.pts} pts</span>
          </div>`).join('')}
          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 2fr;gap:8px">
            <div><label style="font-size:0.72rem;color:var(--text-muted)">คะแนน</label>
              <input class="input" id="man-pts" type="number" min="1" placeholder="500" style="width:100%;margin-top:4px"></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">เหตุผล</label>
              <input class="input" id="man-desc" placeholder="เช่น โบนัสพิเศษ" style="width:100%;margin-top:4px"></div>
          </div>`,
        confirmText: '🎁 เพิ่มคะแนน Manual',
        onConfirm() {
          const pts = parseInt(document.getElementById('man-pts')?.value)
          const desc = document.getElementById('man-desc')?.value.trim() || 'Manual Bonus'
          if (!pts || pts < 1) { showToast('ใส่จำนวนคะแนน', 'warning'); return false }
          m.pts += pts
          m.history.unshift({ date: new Date().toISOString().slice(0, 10), pts, desc })
          render()
          showToast(`✅ เพิ่ม ${pts} pts ให้ ${m.name} (รวม ${m.pts.toLocaleString()} pts)`, 'success')
        }
      })
    }))
  }

  render()
}
