import { showToast } from '../../core/store.js'
import { getCommissionData, listDocs, updateDocData } from '../../core/db.js'
import { getCurrentUser, getMyTotalPoints, getRealLeaderboard, computeMyBadges } from './gamificationData.js'

const LEVELS = [
  { min:0,    max:999,   name:'🌱 Rookie',     color:'primary' },
  { min:1000, max:2999,  name:'⭐ Rising Star', color:'accent'  },
  { min:3000, max:5999,  name:'🚀 Pro Seller',  color:'primary' },
  { min:6000, max:9999,  name:'💎 Diamond',     color:'accent'  },
  { min:10000,max:99999, name:'🏆 Legend',      color:'warning' },
]

// fallback demo — ใช้เฉพาะตอนยังไม่มีข้อมูลจริงในระบบเลย (ledger ว่างเปล่าจริงๆ)
const DEMO_LEADERBOARD = [
  { name:'อรนุช เซลส์ดี', xp:7850, sales:14, avatar:'อ', color:'primary' },
  { name:'วิชัย ขายเก่ง', xp:5200, sales:9, avatar:'ว', color:'accent' },
  { name:'สมชาย ช่างดี', xp:3100, sales:0, avatar:'ส', color:'success' },
  { name:'วิชาญ มีโชค', xp:1800, sales:4, avatar:'ว', color:'warning' },
]

const LAMI_STAGES = [
  { level:1, name:'🥚 ไข่', xp:0, desc:'LAMI ยังอยู่ในไข่... รอการฟักออกมา' },
  { level:2, name:'🐣 ลูกไก่', xp:1000, desc:'LAMI เพิ่งฟักออกมา กำลังเรียนรู้โลก' },
  { level:3, name:'🐥 ลูกนก', xp:3000, desc:'LAMI เติบโตขึ้นมาก ช่วยงานได้เยอะขึ้น' },
  { level:4, name:'🤖 Robot LAMI', xp:6000, desc:'LAMI กลายเป็น AI เต็มตัว พร้อมช่วยทุกอย่าง' },
  { level:5, name:'🦄 Super LAMI', xp:10000, desc:'LAMI บรรลุพลังสูงสุด ฉลาดเกินคน!' },
]

const MOODS = [
  { emoji:'😊', label:'ดีมาก', value:5, color:'success' },
  { emoji:'🙂', label:'ดี', value:4, color:'accent' },
  { emoji:'😐', label:'ปกติ', value:3, color:'primary' },
  { emoji:'😔', label:'เหนื่อย', value:2, color:'warning' },
  { emoji:'😫', label:'แย่มาก', value:1, color:'danger' },
]

function getLevel(xp) { return LEVELS.filter(l => xp >= l.min).pop() || LEVELS[0] }
function getLamiStage(xp) { return LAMI_STAGES.filter(s => xp >= s.xp).pop() || LAMI_STAGES[0] }

export default async function GamificationDashboard(container) {
  const myGen = container.__routerGen
  const { name: myName } = getCurrentUser()
  let xp = 0 // แต้มรวมจริงจาก staff_points ledger (awardGamePoints ใน core/db.js) — โหลดด้านล่าง
  let todayMood = localStorage.getItem('lamom-mood-today')
  let moodLog; try { moodLog = JSON.parse(localStorage.getItem('lamom-mood-log') || '[]') } catch { moodLog = [] }
  let missions = [] // จาก collection 'daily_missions' จริง (period: 'daily')
  let myBadges = [] // จาก computeMyBadges() — unlock จริงตามสถิติผู้ใช้
  let activeTab = 'me'
  let liveLeaderboard = null

  // โหลดแต้มรวมจริง + ภารกิจวันนี้ + badge ของฉัน (ขนาน)
  try {
    const [totalPoints, dailyMissionsAll, badges] = await Promise.all([
      getMyTotalPoints(),
      listDocs('daily_missions', [], 'title', 'asc', 500).catch(() => []),
      computeMyBadges().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    xp = totalPoints || 0
    missions = dailyMissionsAll.filter(m => m.period === 'daily')
    myBadges = badges
  } catch {}

  // เรียงลำดับ leaderboard จากแต้มจริง (gamification_events / staff_points) — ถ้าว่างจริงๆ ค่อย fallback ไป commission/demo
  try {
    const real = await getRealLeaderboard()
    if (container.__routerGen !== myGen) return
    if (real.length) {
      liveLeaderboard = real.slice(0, 10).map((p, i) => ({
        name: p.name,
        xp: p.points,
        sales: p.salesUnits,
        avatar: (p.name || '?').charAt(0),
        color: ['primary','accent','success','warning','danger'][i % 5],
      }))
    } else {
      const coms = await getCommissionData()
      if (container.__routerGen !== myGen) return
      if (coms.length) {
        const byName = {}
        coms.forEach(c => {
          if (!byName[c.salesName]) byName[c.salesName] = { name: c.salesName, sales: 0, income: 0 }
          byName[c.salesName].sales += c.carsSold
          byName[c.salesName].income += c.incomeTotal
        })
        liveLeaderboard = Object.values(byName)
          .filter(p => p.name)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 10)
          .map((p, i) => ({
            name: p.name,
            xp: 500 + p.sales * 400 + Math.round(p.income / 1000),
            sales: p.sales,
            avatar: (p.name || '?').charAt(0),
            color: ['primary','accent','success','warning','danger'][i % 5],
          }))
      }
    }
  } catch {}

  function saveMood(v) {
    const today = new Date().toISOString().slice(0, 10)
    moodLog = [{ date: today, value: v }, ...moodLog.filter(m => m.date !== today)].slice(0, 30)
    todayMood = today + ':' + v
    try { localStorage.setItem('lamom-mood-today', today + ':' + v); localStorage.setItem('lamom-mood-log', JSON.stringify(moodLog)) } catch {}
  }

  async function reloadMe() {
    try { xp = await getMyTotalPoints() } catch {}
  }

  function renderPage() {
    const topLevel = getLevel(xp)
    const nextLevel = LEVELS[LEVELS.indexOf(topLevel) + 1]
    const xpToNext = nextLevel ? nextLevel.min - xp : 0
    const pct = nextLevel ? Math.round(((xp - topLevel.min) / (nextLevel.min - topLevel.min)) * 100) : 100
    const lamiStage = getLamiStage(xp)
    const todayMoodVal = todayMood ? parseInt(todayMood.split(':')[1]) : null
    const todayMoodObj = MOODS.find(m => m.value === todayMoodVal)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎮 Gamification</div>
            <div class="page-subtitle">XP · Level · LAMI Pet · Mood · Leaderboard</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[['me','👤 ฉัน'],['missions','🎯 Daily'],['badges','🏅 Badges'],['lami','🤖 LAMI Pet'],['mood','😊 Mood'],['board','🏆 Leaderboard']].map(([t,l]) =>
            `<button class="btn btn-sm ${activeTab===t?'btn-primary':'btn-secondary'} gam-tab" data-t="${t}">${l}</button>`
          ).join('')}
        </div>

        <div id="gam-content">${renderGamTab()}</div>
      </div>
    `

    function renderGamTab() {
      if (activeTab === 'me') return renderMe()
      if (activeTab === 'missions') return renderMissions()
      if (activeTab === 'badges') return renderBadges()
      if (activeTab === 'lami') return renderLami()
      if (activeTab === 'mood') return renderMood()
      if (activeTab === 'board') return renderLeaderboard()
      return ''
    }

    function renderMe() {
      const myUnlocked = myBadges.filter(b => b.unlocked).length
      const myMissionsDone = missions.filter(m => m.done).length
      return `
        <div class="card" style="padding:24px;background:linear-gradient(135deg,var(--primary-dim),var(--surface));border:1px solid var(--primary)">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
            <div style="width:60px;height:60px;border-radius:50%;background:var(--${topLevel.color}-dim);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;color:var(--${topLevel.color})">${(myName||'?').charAt(0)}</div>
            <div>
              <div style="font-weight:700;font-size:1.1rem">${myName}</div>
              <div style="font-size:1rem;color:var(--${topLevel.color});font-weight:600">${topLevel.name}</div>
            </div>
            <div style="margin-left:auto;text-align:center">
              <div style="font-size:1.8rem;font-weight:700;color:var(--accent)">${xp.toLocaleString()}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">แต้มรวม (จริง)</div>
            </div>
          </div>
          ${nextLevel ? `
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-muted);margin-bottom:6px">
              <span>${topLevel.name}</span>
              <span>อีก ${xpToNext.toLocaleString()} XP → ${nextLevel.name}</span>
            </div>
            <div style="height:12px;background:var(--surface-2);border-radius:10px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:linear-gradient(to right,var(--primary),var(--accent));border-radius:10px"></div>
            </div>
          ` : '<div style="color:var(--warning);font-weight:600">🏆 บรรลุระดับสูงสุดแล้ว!</div>'}
          <div style="margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            ${[`🏅 ${myUnlocked} Badges`,`🎯 ${myMissionsDone}/${missions.length||0} Mission`,`⭐ ${xp.toLocaleString()} แต้ม`].map(t => `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-md);text-align:center;font-size:0.8rem">${t}</div>`).join('')}
          </div>
          <div style="margin-top:10px;font-size:0.7rem;color:var(--text-muted);text-align:center">แต้มคำนวณจากเหตุการณ์จริงในระบบ (ใบจอง/ลูกค้า/งาน/บันทึกติดต่อ) ผ่าน gamification_events ledger — ไม่ใช่ค่าจำลอง</div>
        </div>
      `
    }

    function renderMissions() {
      if (!missions.length) {
        return `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">วันนี้ยังไม่มีภารกิจ</div><div class="empty-desc">ไปที่หน้า Daily Missions เพื่อดูภารกิจทั้งหมด</div></div>`
      }
      const doneCount = missions.filter(m => m.done).length
      return `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-weight:700">🎯 Daily Missions (${doneCount}/${missions.length})</div>
            <span class="badge badge-${doneCount===missions.length?'success':'primary'}">${doneCount===missions.length?'✅ ครบแล้ว!':doneCount+' เสร็จ'}</span>
          </div>
          ${missions.map(m => `
            <div class="card" style="padding:14px;display:flex;align-items:center;gap:12px;${m.done?'opacity:0.7':''}">
              <div style="font-size:1.5rem">${m.icon||'🎯'}</div>
              <div style="flex:1">
                <div style="font-weight:600;${m.done?'text-decoration:line-through':''}">${m.title}</div>
                <div style="font-size:0.78rem;color:var(--accent)">+${m.xp} XP</div>
              </div>
              <button class="btn btn-sm ${m.done?'btn-success':'btn-primary'} mission-btn" data-mid="${m.id}" ${m.done?'disabled':''}>
                ${m.done ? '✅' : 'ทำเสร็จ'}
              </button>
            </div>
          `).join('')}
        </div>
      `
    }

    function renderBadges() {
      if (!myBadges.length) return `<div class="empty-state"><div class="empty-icon">🏅</div><div class="empty-title">กำลังโหลด Badge...</div></div>`
      return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
          ${myBadges.map(b => `
            <div class="card" style="padding:14px;text-align:center;${!b.unlocked?'opacity:0.4':'border:1px solid var(--success)'}">
              <div style="font-size:2.2rem;margin-bottom:6px">${b.icon}</div>
              <div style="font-weight:700;font-size:0.85rem">${b.name}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px">${b.desc}</div>
              <div style="font-size:0.72rem;color:var(--accent);margin-top:6px">+${b.points} XP</div>
              ${b.unlocked ? '<div style="font-size:0.7rem;color:var(--success);margin-top:4px">🔓 Unlocked</div>' : '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">🔒 ล็อค</div>'}
            </div>
          `).join('')}
        </div>
      `
    }

    function renderLami() {
      const stage = lamiStage
      const nextStage = LAMI_STAGES[LAMI_STAGES.indexOf(stage) + 1]
      const stagePct = nextStage ? Math.round(((xp - stage.xp) / (nextStage.xp - stage.xp)) * 100) : 100
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:20px">
          <div class="card" style="padding:32px;text-align:center;max-width:400px;width:100%">
            <div style="font-size:5rem;margin-bottom:12px;animation:pulse 2s infinite">${stage.name.split(' ')[0]}</div>
            <div style="font-size:1.4rem;font-weight:700;margin-bottom:6px">LAMI — ${stage.name.split(' ').slice(1).join(' ')}</div>
            <div style="font-size:0.88rem;color:var(--text-muted);margin-bottom:20px">${stage.desc}</div>
            <div style="font-size:2rem;font-weight:700;color:var(--primary)">${xp.toLocaleString()} XP</div>
            ${nextStage ? `
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-top:14px;margin-bottom:5px">
                <span>${stage.name.split(' ').slice(1).join(' ')}</span>
                <span>${nextStage.name.split(' ').slice(1).join(' ')}</span>
              </div>
              <div style="height:10px;background:var(--surface-2);border-radius:10px;overflow:hidden">
                <div style="height:100%;width:${stagePct}%;background:linear-gradient(to right,var(--primary),var(--accent));border-radius:10px"></div>
              </div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">อีก ${(nextStage.xp - xp).toLocaleString()} XP จะ evolve!</div>
            ` : '<div style="color:var(--warning);font-weight:700;margin-top:12px">🦄 LAMI บรรลุพลังสูงสุดแล้ว!</div>'}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
            ${LAMI_STAGES.map(s => `
              <div style="padding:8px 14px;border-radius:99px;background:${xp>=s.xp?'var(--primary-dim)':'var(--surface-2)'};font-size:0.8rem;color:${xp>=s.xp?'var(--primary)':'var(--text-muted)'};border:1px solid ${xp>=s.xp?'var(--primary)':'var(--border)'}">
                ${s.name}
              </div>
            `).join('')}
          </div>
          <button class="btn btn-primary" id="lami-interact">💬 คุยกับ LAMI</button>
        </div>
      `
    }

    function renderMood() {
      const avgMood = moodLog.length > 0
        ? (moodLog.reduce((a, m) => a + m.value, 0) / moodLog.length).toFixed(1)
        : null
      return `
        <div style="display:flex;flex-direction:column;gap:16px;max-width:600px">
          <div class="card" style="padding:24px;text-align:center">
            <div style="font-weight:700;font-size:1.1rem;margin-bottom:6px">😊 อารมณ์ของฉันวันนี้</div>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px">ติดตาม Wellbeing ของทีมทุกวัน</div>
            ${todayMoodObj ? `
              <div style="font-size:3rem;margin-bottom:8px">${todayMoodObj.emoji}</div>
              <div style="font-weight:600;color:var(--${todayMoodObj.color})">${todayMoodObj.label}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">บันทึกแล้ววันนี้</div>
            ` : `
              <div style="display:flex;justify-content:center;gap:12px;margin:8px 0">
                ${MOODS.map(m => `
                  <button class="mood-select-btn" data-v="${m.value}" style="font-size:2.5rem;background:none;border:none;cursor:pointer;border-radius:var(--radius-lg);padding:8px;transition:transform 0.15s">${m.emoji}</button>
                `).join('')}
              </div>
              <div style="display:flex;justify-content:center;gap:12px">
                ${MOODS.map(m => `<span style="font-size:0.7rem;color:var(--text-muted);width:52px;text-align:center">${m.label}</span>`).join('')}
              </div>
            `}
          </div>

          ${moodLog.length > 0 ? `
            <div class="card" style="padding:20px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <div style="font-weight:700">📊 Mood History (30 วัน)</div>
                ${avgMood ? `<span class="badge badge-accent">เฉลี่ย ${avgMood}/5</span>` : ''}
              </div>
              <div style="display:flex;align-items:flex-end;gap:3px;height:80px;overflow-x:auto">
                ${moodLog.slice(0, 30).reverse().map(m => {
                  const mo = MOODS.find(x => x.value === m.value) || MOODS[2]
                  const h = Math.round(m.value / 5 * 70)
                  return `<div style="flex:1;min-width:8px;display:flex;flex-direction:column;align-items:center">
                    <div style="width:100%;height:${h}px;background:var(--${mo.color});border-radius:2px 2px 0 0;opacity:0.8" title="${m.date}: ${mo.label}"></div>
                  </div>`
                }).join('')}
              </div>
              <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
                ${MOODS.map(m => `<span style="font-size:0.75rem;display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--${m.color});display:inline-block"></span>${m.label}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `
    }

    function renderLeaderboard() {
      const board = liveLeaderboard && liveLeaderboard.length ? liveLeaderboard : DEMO_LEADERBOARD
      const isLive = !!(liveLeaderboard && liveLeaderboard.length)
      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']
      return `
        <div class="card" style="overflow:hidden;padding:0">
          <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-weight:600;display:flex;justify-content:space-between;align-items:center">
            <span>🏆 Leaderboard (แต้มสะสมจริง)</span>
            ${isLive ? '<span style="font-size:0.72rem;color:var(--success)">● ข้อมูลจริง</span>' : '<span style="font-size:0.72rem;color:var(--text-muted)">Demo</span>'}
          </div>
          ${board.map((p, i) => {
            const lv = getLevel(p.xp)
            return `<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;${i===0?'background:var(--warning-dim)':''}">
              <div style="font-size:1.5rem;width:36px;text-align:center">${medals[i]||i+1}</div>
              <div style="width:38px;height:38px;border-radius:50%;background:var(--${p.color}-dim);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;color:var(--${p.color})">${p.avatar}</div>
              <div style="flex:1">
                <div style="font-weight:600">${p.name}</div>
                <div style="font-size:0.75rem;color:var(--${lv.color})">${lv.name}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--accent)">${p.xp.toLocaleString()} XP</div>
                ${p.sales ? `<div style="font-size:0.72rem;color:var(--text-muted)">${p.sales} คัน</div>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      `
    }

    document.querySelectorAll('.gam-tab').forEach(btn => { btn.addEventListener('click', () => { activeTab = btn.dataset.t; renderPage() }) })

    document.querySelectorAll('.mission-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        const m = missions.find(x => x.id === btn.dataset.mid)
        if (!m || m.done) return
        try {
          await updateDocData('daily_missions', m.id, { done: true, progress: m.target })
          m.done = true
          showToast(`🎯 Mission เสร็จ! +${m.xp} XP`, 'success')
          await reloadMe()
          renderPage()
        } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })

    document.querySelectorAll('.mood-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = parseInt(btn.dataset.v)
        saveMood(v)
        const mo = MOODS.find(m => m.value === v)
        showToast(`${mo.emoji} บันทึก Mood: ${mo.label}`, 'success')
        renderPage()
      })
    })

    document.getElementById('lami-interact')?.addEventListener('click', () => {
      const stage = getLamiStage(xp)
      showToast(`🤖 LAMI: "สวัสดี! ฉัน${stage.name.split(' ').slice(1).join(' ')} มี XP ${xp.toLocaleString()} แล้ว!"`, 'info')
    })
  }

  renderPage()
}
