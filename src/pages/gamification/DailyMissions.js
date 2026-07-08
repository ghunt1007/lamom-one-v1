/**
 * Daily Missions — ภารกิจประจำวัน/สัปดาห์ + XP Rewards
 * Route: /gamification/missions
 */
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

const SPECIAL = [
  { id:'S1', title:'🔥 Hot Streak! ปิด 3 ดีลติดกัน', xp:1000, icon:'🔥', unlocked:false, desc:'ปิดดีล 3 ดีลติดต่อกันโดยไม่มี Lost Deal' },
  { id:'S2', title:'💎 VIP Whisperer', xp:800, icon:'💎', unlocked:true, desc:'ปิดดีลลูกค้า VIP สำเร็จ' },
  { id:'S3', title:'⚡ Speed Closer', xp:600, icon:'⚡', unlocked:false, desc:'ปิดดีลภายใน 24 ชม. หลัง Test Drive' },
]

const PLAYER = { name:'กิตติ สุขใจ', level:14, xp:8450, xpNext:10000, todayXp:130, streak:5 }

export default async function DailyMissionsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let tab = 'daily'
  let missions = { daily: [], weekly: [] }
  let loading = true

  async function loadData() {
    loading = true
    try {
      const all = await listDocs('daily_missions', [], 'title', 'asc', 500)
      missions = { daily: all.filter(m => m.period === 'daily'), weekly: all.filter(m => m.period === 'weekly') }
    } catch (e) { missions = { daily: [], weekly: [] } }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function xpBar(current, max) {
    const pct = Math.round(current/max*100)
    return '<div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">' +
      '<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--primary),var(--warning));border-radius:5px;transition:width .5s"></div>' +
    '</div>'
  }

  function missionCard(m) {
    const pct = Math.round(m.progress/m.target*100)
    const color = m.done?'var(--success)':pct>=60?'var(--warning)':'var(--primary)'
    return '<div class="card" style="padding:14px;margin-bottom:8px;border:1px solid '+(m.done?'var(--success)':'transparent')+';opacity:'+(m.done?'0.85':'1')+'">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<div style="display:flex;gap:10px;align-items:center">' +
          '<span style="font-size:1.4rem">'+m.icon+'</span>' +
          '<div>' +
            '<div style="font-weight:700;font-size:0.82rem;'+(m.done?'text-decoration:line-through;color:var(--text-muted)':'')+'">'+m.title+'</div>' +
            '<div style="font-size:0.68rem;color:var(--warning);font-weight:700">+'+m.xp+' XP</div>' +
          '</div>' +
        '</div>' +
        (m.done ?
          '<span style="font-size:1.2rem">✅</span>' :
          '<button class="btn btn-sm btn-primary complete-btn" data-id="'+m.id+'" data-type="'+tab+'">ทำเสร็จ</button>'
        ) +
      '</div>' +
      (m.done ? '' :
        '<div>' +
          '<div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-bottom:3px">' +
            '<span>'+m.progress+'/'+m.target+'</span><span>'+pct+'%</span>' +
          '</div>' +
          '<div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">' +
            '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:3px;transition:width .4s"></div>' +
          '</div>' +
        '</div>'
      ) +
    '</div>'
  }

  function specialCard(s) {
    return '<div class="card" style="padding:14px;margin-bottom:8px;border:1px solid '+(s.unlocked?'var(--warning)':'transparent')+';opacity:'+(s.unlocked?'1':'0.7')+'">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div style="display:flex;gap:10px;align-items:center">' +
          '<span style="font-size:1.6rem">'+s.icon+'</span>' +
          '<div>' +
            '<div style="font-weight:700;font-size:0.8rem">'+s.title.split('!')[1]||s.title+'</div>' +
            '<div style="font-size:0.68rem;color:var(--text-muted)">'+s.desc+'</div>' +
            '<div style="font-size:0.68rem;color:var(--warning);font-weight:700;margin-top:2px">+'+s.xp+' XP</div>' +
          '</div>' +
        '</div>' +
        (s.unlocked ? '<span style="font-size:1.2rem">🏅</span>' : '<span style="font-size:1rem;color:var(--text-muted)">🔒</span>') +
      '</div>' +
    '</div>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = tab==='special' ? [] : missions[tab]
    const doneTodayCount = missions.daily.filter(m=>m.done).length
    const todayXpEarned = missions.daily.filter(m=>m.done).reduce((s,m)=>s+m.xp,0)

    const tabBtns = [['daily','📅 วันนี้'],['weekly','📆 สัปดาห์นี้'],['special','🏅 พิเศษ']].map(([k,l])=>'<button class="btn btn-sm '+(tab===k?'btn-primary':'btn-secondary')+' tab-btn" data-t="'+k+'">'+l+'</button>').join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Daily Missions</div>
            <div class="page-subtitle">ภารกิจและ XP Rewards · สาย Streak ${PLAYER.streak} วัน 🔥</div>
          </div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div>
              <div style="font-weight:700;font-size:0.9rem">${PLAYER.name} · Level ${PLAYER.level}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${PLAYER.xp.toLocaleString()} / ${PLAYER.xpNext.toLocaleString()} XP</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:0.78rem;color:var(--warning);font-weight:700">+${todayXpEarned} XP วันนี้</div>
              <div style="font-size:0.68rem;color:var(--text-muted)">${doneTodayCount}/${missions.daily.length} ภารกิจ</div>
            </div>
          </div>
          ${xpBar(PLAYER.xp, PLAYER.xpNext)}
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">
          ${sc('🎯 ภารกิจวันนี้', doneTodayCount+'/'+missions.daily.length, 'var(--primary)')}
          ${sc('⚡ XP วันนี้', '+'+todayXpEarned+' XP', 'var(--warning)')}
          ${sc('🔥 Streak', PLAYER.streak+' วัน', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${tabBtns}</div>

        ${tab==='special' ? SPECIAL.map(s=>specialCard(s)).join('') : list.map(m=>missionCard(m)).join('')}
      </div>`

    container.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.t;render()}))
    container.querySelectorAll('.complete-btn').forEach(b=>b.addEventListener('click', async ()=>{
      const type = b.dataset.type
      const m = missions[type].find(x=>x.id===b.dataset.id)
      if(!m) return
      try {
        await updateDocData('daily_missions', m.id, { done: true, progress: m.target })
        showToast('✅ +'+m.xp+' XP! ภารกิจสำเร็จ','success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
