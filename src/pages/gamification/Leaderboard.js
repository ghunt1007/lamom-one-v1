/**
 * Gamification Leaderboard — กระดานผู้นำ
 * Route: /gamification/leaderboard
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getRealLeaderboard } from './gamificationData.js'
import { escHtml as esc } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'

const RANKS = [
  { min: 3000, label: 'Diamond', color: '#60a5fa', icon: '💎' },
  { min: 1500, label: 'Platinum', color: '#c084fc', icon: '🏆' },
  { min: 800,  label: 'Gold',    color: '#fbbf24', icon: '🥇' },
  { min: 400,  label: 'Silver',  color: '#94a3b8', icon: '🥈' },
  { min: 0,    label: 'Bronze',  color: '#f97316', icon: '🥉' },
]

function getRank(pts) { return RANKS.find(r => pts >= r.min) || RANKS[4] }

const DEMO_PLAYERS = [] // (2026-11-02) เอาข้อมูลสมมติออก — ไม่มีข้อมูลจริงให้โชว์ว่าง ไม่ใช่ตัวเลขปลอม

export default async function LeaderboardPage(container) {
  const myGen = container.__routerGen
  let period = 'month'
  let deptFilter = 'all'
  let players = DEMO_PLAYERS.map(p => ({ ...p }))
  let dataSource = 'demo'

  try {
    const real = await getRealLeaderboard()
    if (container.__routerGen !== myGen) return

    if (real.length >= 1) {
      const AVATARS = ['👨', '👩', '🧑']
      players = real.map((p, i) => ({
        id: p.id || 'LP' + String(i + 1).padStart(2, '0'),
        name: p.name, role: p.salesUnits ? 'เซลส์' : 'พนักงาน', dept: p.salesUnits ? 'ฝ่ายขาย' : 'ทั่วไป',
        avatar: AVATARS[i % 3],
        points: p.points, // แต้มรวมจริงจาก staff_points ledger — ไม่ใช่สูตรคำนวณจำลองอีกต่อไป
        monthPoints: p.monthPoints, // ผลรวมแต้มจาก gamification_events ของเดือนนี้จริง
        yearPoints: p.yearPoints, // ผลรวมแต้มจาก gamification_events ของปีนี้จริง
        // (แก้ไข) เดิม streak/badges ที่นี่เป็นสูตรปลอม (1+(i%10), points/300) ไม่มีความเกี่ยวข้องกับพฤติกรรม
        // จริงเลย ทั้งที่วางอยู่ข้างคอลัมน์คะแนน/ยอดขาย/รายได้ที่เป็นข้อมูลจริง — ไม่มี field streak/badge
        // ติดตามจริงในระบบให้ผูกได้ (ดู gamificationData.js) จึงตัดสองคอลัมน์นี้ออกแทนการโชว์เลขปลอมปนของจริง
        salesUnits: p.salesUnits,
        revenue: p.revenue,
      })).sort((a, b) => b.points - a.points)
      dataSource = 'live'
    }
  } catch {}

  function pointsFor(p) { return period === 'month' ? p.monthPoints : period === 'year' ? p.yearPoints : p.points }

  function renderPage() {
    const sorted = [...players]
      .filter(p => deptFilter === 'all' || p.dept === deptFilter)
      .sort((a, b) => pointsFor(b) - pointsFor(a))

    const top3 = sorted.slice(0, 3)
    const rest = sorted.slice(3)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏆 Leaderboard</div>
            <div class="page-subtitle">กระดานผู้นำ — อันดับพนักงานยอดเยี่ยม
              ${dataSource === 'live' ? '<span style="font-size:0.72rem;color:var(--success);margin-left:8px">● ข้อมูลจริง</span>' : ''}
            </div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:8px">
              <button class="btn btn-xs ${period==='month'?'btn-primary':'btn-secondary'}" id="period-month">เดือนนี้</button>
              <button class="btn btn-xs ${period==='year'?'btn-primary':'btn-secondary'}" id="period-year">รายปี</button>
              <button class="btn btn-xs ${period==='all'?'btn-primary':'btn-secondary'}" id="period-all">ตลอดกาล</button>
              <select class="input" id="dept-filter" style="font-size:16px;padding:4px 8px">
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
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">#</th>
                <th style="padding:10px 14px;text-align:left">ชื่อ</th>
                <th style="padding:10px 14px;text-align:center">แรงค์</th>
                <th style="padding:10px 14px;text-align:right">คะแนน</th>
                <th style="padding:10px 14px;text-align:right">ยอดขาย</th>
              </tr>
            </thead>
            <tbody>
              ${rest.map((p, i) => {
                const rank = getRank(p.points)
                const pts = pointsFor(p)
                return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" class="lb-row" data-id="${p.id}">
                  <td style="padding:10px 14px;font-weight:700;color:var(--text-muted)">${i+4}</td>
                  <td style="padding:10px 14px">
                    <div style="display:flex;align-items:center;gap:10px">
                      <div style="width:34px;height:34px;border-radius:50%;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:1.2rem">${p.avatar}</div>
                      <div>
                        <div style="font-weight:600;font-size:0.85rem">${esc(p.name)}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted)">${p.role}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:10px 14px;text-align:center"><span style="font-size:0.75rem;color:${rank.color};font-weight:700">${rank.icon} ${rank.label}</span></td>
                  <td style="padding:10px 14px;text-align:right;font-weight:700">${pts.toLocaleString()}</td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.8rem">${p.salesUnits > 0 ? p.salesUnits + ' คัน' : '—'}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('period-month')?.addEventListener('click', () => { period = 'month'; renderPage() })
    document.getElementById('period-year')?.addEventListener('click', () => { period = 'year'; renderPage() })
    document.getElementById('period-all')?.addEventListener('click', () => { period = 'all'; renderPage() })
    document.getElementById('dept-filter')?.addEventListener('change', e => { deptFilter = e.target.value; renderPage() })
    container.querySelectorAll('.lb-row').forEach(r => r.addEventListener('click', () => {
      const p = players.find(x => x.id === r.dataset.id); if (p) openPlayerDetail(p)
    }))
  }

  function podiumCard(p, pos, height) {
    if (!p) return '<div></div>'
    const rank = getRank(p.points)
    const pts = pointsFor(p)
    const posLabel = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'
    return `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" class="lb-row" data-id="${p.id}">
        <div style="text-align:center;margin-bottom:6px">
          <div style="font-size:1.8rem">${p.avatar}</div>
          <div style="font-weight:700;font-size:0.83rem;margin-top:4px">${esc(p.name)}</div>
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
      title: `${p.avatar} ${esc(p.name)} — โปรไฟล์`,
      size: 'md',
      body: `
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:3rem">${p.avatar}</div>
          <div style="font-size:1.1rem;font-weight:800;margin-top:4px">${esc(p.name)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${p.role} · ${p.dept}</div>
          <div style="margin-top:8px"><span style="font-size:0.9rem;font-weight:700;color:${rank.color}">${rank.icon} ${rank.label}</span></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
          ${kpi('⭐ คะแนนรวม', p.points.toLocaleString(), 'primary')}
          ${kpi('📅 เดือนนี้', p.monthPoints.toLocaleString(), 'success')}
          ${kpi('🗓 ปีนี้', p.yearPoints.toLocaleString(), 'success')}
          ${kpi('🚗 ยอดขาย', p.salesUnits + ' คัน', 'primary')}
          ${kpi('💰 รายได้', formatCurrency(p.revenue), 'success')}
        </div>
        <div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;text-align:center">
          🚀 อยู่ใน Top ${[...players].sort((a,b)=>b.points-a.points).findIndex(x=>x.id===p.id)+1} จาก ${players.length} คน
        </div>
      `
    })
  }

  renderPage()
}

