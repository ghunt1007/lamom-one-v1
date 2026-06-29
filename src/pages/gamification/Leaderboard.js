/**
 * Gamification Leaderboard — กระดานผู้นำ
 * Route: /gamification/leaderboard
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getCommissionData } from '../../core/db.js'

const RANKS = [
  { min: 3000, label: 'Diamond', color: '#60a5fa', icon: '💎' },
  { min: 1500, label: 'Platinum', color: '#c084fc', icon: '🏆' },
  { min: 800,  label: 'Gold',    color: '#fbbf24', icon: '🥇' },
  { min: 400,  label: 'Silver',  color: '#94a3b8', icon: '🥈' },
  { min: 0,    label: 'Bronze',  color: '#f97316', icon: '🥉' },
]

function getRank(pts) { return RANKS.find(r => pts >= r.min) || RANKS[4] }

const DEMO_PLAYERS = [
  { id: 'P01', name: 'วิชัย ยอดขาย', role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👨', points: 4280, monthPoints: 580, streak: 12, badges: 18, salesUnits: 24, revenue: 7200000 },
  { id: 'P02', name: 'สุดา มาดี',    role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👩', points: 3520, monthPoints: 420, streak: 7,  badges: 14, salesUnits: 19, revenue: 5700000 },
  { id: 'P03', name: 'ธนา เก่งกว่า', role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👨', points: 2900, monthPoints: 350, streak: 5,  badges: 11, salesUnits: 16, revenue: 4800000 },
  { id: 'P04', name: 'อรวรรณ ดีมาก', role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👩', points: 2100, monthPoints: 280, streak: 8,  badges: 9,  salesUnits: 12, revenue: 3600000 },
  { id: 'P05', name: 'วิทยา ช่างดี',  role: 'ช่าง',  dept: 'ศูนย์บริการ', avatar: '🧑', points: 1800, monthPoints: 220, streak: 15, badges: 12, salesUnits: 0, revenue: 0 },
  { id: 'P06', name: 'สมศักดิ์ มั่นใจ', role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👨', points: 1400, monthPoints: 180, streak: 3,  badges: 7,  salesUnits: 8,  revenue: 2400000 },
  { id: 'P07', name: 'ปทิตา สวัสดี', role: 'ที่ปรึกษา', dept: 'ฝ่ายขาย', avatar: '👩', points: 1100, monthPoints: 160, streak: 6,  badges: 6,  salesUnits: 7,  revenue: 2100000 },
  { id: 'P08', name: 'ชัยวัฒน์ พัฒนา', role: 'ช่าง', dept: 'ศูนย์บริการ', avatar: '🧑', points: 750, monthPoints: 120, streak: 4,  badges: 5,  salesUnits: 0, revenue: 0 },
]

export default async function LeaderboardPage(container) {
  const myGen = container.__routerGen
  let period = 'month'
  let deptFilter = 'all'
  let players = DEMO_PLAYERS.map(p => ({ ...p }))
  let dataSource = 'demo'

  try {
    const coms = await getCommissionData()
    if (container.__routerGen !== myGen) return

    if (coms.length >= 2) {
      const byName = {}
      coms.forEach(c => {
        if (!c.salesName) return
        if (!byName[c.salesName]) byName[c.salesName] = { name: c.salesName, carsSold: 0, incomeTotal: 0 }
        byName[c.salesName].carsSold += c.carsSold || 0
        byName[c.salesName].incomeTotal += c.incomeTotal || 0
      })
      const AVATARS = ['👨', '👩', '🧑']
      players = Object.values(byName).map((p, i) => ({
        id: 'LP' + String(i + 1).padStart(2, '0'),
        name: p.name, role: 'เซลส์', dept: 'ฝ่ายขาย',
        avatar: AVATARS[i % 3],
        points: 500 + p.carsSold * 400 + Math.round(p.incomeTotal / 1000),
        monthPoints: 100 + p.carsSold * 80 + Math.round(p.incomeTotal / 5000),
        streak: 1 + (i % 10),
        badges: Math.max(1, p.carsSold),
        salesUnits: p.carsSold,
        revenue: p.incomeTotal,
      })).sort((a, b) => b.points - a.points)
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const sorted = [...players]
      .filter(p => deptFilter === 'all' || p.dept === deptFilter)
      .sort((a, b) => (period === 'month' ? b.monthPoints - a.monthPoints : b.points - a.points))

    const top3 = sorted.slice(0, 3)
    const rest = sorted.slice(3)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏆 Leaderboard</div>
            <div class="page-subtitle">กระดานผู้นำ — อันดับพนักงานยอดเยี่ยม
              ${dataSource === 'live' ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:8px">Demo</span>'}
            </div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:8px">
              <button class="btn btn-xs ${period==='month'?'btn-primary':'btn-secondary'}" id="period-month">เดือนนี้</button>
              <button class="btn btn-xs ${period==='all'?'btn-primary':'btn-secondary'}" id="period-all">ตลอดกาล</button>
              <select class="input" id="dept-filter" style="font-size:0.8rem;padding:4px 8px">
                <option value="all">ทุกแผนก</option>
                <option value="ฝ่ายขาย" ${deptFilter==='ฝ่ายขาย'?'selected':''}>ฝ่ายขาย</option>
                <option value="ศูนย์บริการ" ${deptFilter==='ศูนย์บริการ'?'selected':''}>ศูนย์บริการ</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Podium Top 3 -->
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:16px;margin-bottom:24px;padding:20px 0">
          ${podiumCard(top3[1], 2, '170px')}
          ${podiumCard(top3[0], 1, '210px')}
          ${podiumCard(top3[2], 3, '150px')}
        </div>

        <!-- Rest of leaderboard -->
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">#</th>
                <th style="padding:10px 14px;text-align:left">ชื่อ</th>
                <th style="padding:10px 14px;text-align:center">แรงค์</th>
                <th style="padding:10px 14px;text-align:right">คะแนน</th>
                <th style="padding:10px 14px;text-align:center">Streak</th>
                <th style="padding:10px 14px;text-align:center">Badges</th>
                <th style="padding:10px 14px;text-align:right">ยอดขาย</th>
              </tr>
            </thead>
            <tbody>
              ${rest.map((p, i) => {
                const rank = getRank(p.points)
                const pts = period === 'month' ? p.monthPoints : p.points
                return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" class="lb-row" data-id="${p.id}">
                  <td style="padding:10px 14px;font-weight:700;color:var(--text-muted)">${i+4}</td>
                  <td style="padding:10px 14px">
                    <div style="display:flex;align-items:center;gap:10px">
                      <div style="width:34px;height:34px;border-radius:50%;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:1.2rem">${p.avatar}</div>
                      <div>
                        <div style="font-weight:600;font-size:0.85rem">${p.name}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted)">${p.role}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:10px 14px;text-align:center"><span style="font-size:0.75rem;color:${rank.color};font-weight:700">${rank.icon} ${rank.label}</span></td>
                  <td style="padding:10px 14px;text-align:right;font-weight:700">${pts.toLocaleString()}</td>
                  <td style="padding:10px 14px;text-align:center;color:var(--warning)">🔥 ${p.streak}d</td>
                  <td style="padding:10px 14px;text-align:center">🏅 ${p.badges}</td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.8rem">${p.salesUnits > 0 ? p.salesUnits + ' คัน' : '—'}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('period-month')?.addEventListener('click', () => { period = 'month'; renderPage() })
    document.getElementById('period-all')?.addEventListener('click', () => { period = 'all'; renderPage() })
    document.getElementById('dept-filter')?.addEventListener('change', e => { deptFilter = e.target.value; renderPage() })
    container.querySelectorAll('.lb-row').forEach(r => r.addEventListener('click', () => {
      const p = DEMO_PLAYERS.find(x => x.id === r.dataset.id); if (p) openPlayerDetail(p)
    }))
  }

  function podiumCard(p, pos, height) {
    if (!p) return '<div></div>'
    const rank = getRank(p.points)
    const pts = period === 'month' ? p.monthPoints : p.points
    const posLabel = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'
    return `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" class="lb-row" data-id="${p.id}">
        <div style="text-align:center;margin-bottom:6px">
          <div style="font-size:1.8rem">${p.avatar}</div>
          <div style="font-weight:700;font-size:0.83rem;margin-top:4px">${p.name}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${p.role}</div>
          <div style="font-weight:800;font-size:1.1rem;color:${rank.color};margin-top:4px">${pts.toLocaleString()} pts</div>
        </div>
        <div style="width:100px;height:${height};background:var(--surface-2);border-radius:var(--radius) var(--radius) 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:12px;font-size:2rem">${posLabel}</div>
      </div>
    `
  }

  function openPlayerDetail(p) {
    const rank = getRank(p.points)
    openModal({
      title: `${p.avatar} ${p.name} — โปรไฟล์`,
      size: 'md',
      body: `
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:3rem">${p.avatar}</div>
          <div style="font-size:1.1rem;font-weight:800;margin-top:4px">${p.name}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${p.role} · ${p.dept}</div>
          <div style="margin-top:8px"><span style="font-size:0.9rem;font-weight:700;color:${rank.color}">${rank.icon} ${rank.label}</span></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
          ${kpi('⭐ คะแนนรวม', p.points.toLocaleString(), 'primary')}
          ${kpi('📅 เดือนนี้', p.monthPoints.toLocaleString(), 'success')}
          ${kpi('🔥 Streak', p.streak + ' วัน', 'warning')}
          ${kpi('🏅 Badges', p.badges, 'secondary')}
          ${kpi('🚗 ยอดขาย', p.salesUnits + ' คัน', 'primary')}
          ${kpi('💰 รายได้', formatCurrency(p.revenue), 'success')}
        </div>
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;text-align:center">
          🚀 อยู่ใน Top ${DEMO_PLAYERS.sort((a,b)=>b.points-a.points).findIndex(x=>x.id===p.id)+1} จาก ${DEMO_PLAYERS.length} คน
        </div>
      `
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
