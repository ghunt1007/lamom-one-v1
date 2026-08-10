/**
 * Daily Missions — ภารกิจประจำวัน/สัปดาห์ + XP Rewards
 * Route: /gamification/missions
 */
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { getCurrentUser, getMyTotalPoints } from './gamificationData.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const SPECIAL = [
  { id:'S1', title:'🔥 Hot Streak! ปิด 3 ดีลติดกัน', xp:1000, icon:'🔥', unlocked:false, desc:'ปิดดีล 3 ดีลติดต่อกันโดยไม่มี Lost Deal' },
  { id:'S2', title:'💎 VIP Whisperer', xp:800, icon:'💎', unlocked:true, desc:'ปิดดีลลูกค้า VIP สำเร็จ' },
  { id:'S3', title:'⚡ Speed Closer', xp:600, icon:'⚡', unlocked:false, desc:'ปิดดีลภายใน 24 ชม. หลัง Test Drive' },
]

// หา level จาก XP จริง — คงสูตร level เดิมไว้เพื่อความต่อเนื่องของ UI
function levelFromXp(xp) { return Math.max(1, Math.floor(xp / 600) + 1) }
function xpNextFromLevel(level) { return level * 600 }

// (แก้ไข) เดิม PLAYER.streak = PLAYER.streak || 1 มีบั๊ก falsy-zero (0 ก็ถูกดันเป็น 1 เสมอ) และไม่มีการนับ
// วันติดต่อกันจริงเลย ค่าคงที่ตลอด — ตอนนี้คำนวณ streak จริงจาก gamification_events (ledger เดียวกับที่
// awardGamePoints ใน core/db.js เขียนทุกครั้งที่มีกิจกรรมจริงของพนักงานคนนั้น) นับจำนวนวันติดต่อกันล่าสุด
// (นับจากวันนี้ถอยหลัง) ที่มีเหตุการณ์จริงเกิดขึ้นอย่างน้อย 1 ครั้ง
function eventDateStr(ts) {
  if (!ts) return ''
  if (typeof ts === 'string') return ts.slice(0, 10)
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10)
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10)
  return ''
}

async function computeRealStreak(myName) {
  try {
    const events = await listDocs('gamification_events', [['userName', '==', myName]], 'createdAt', 'desc', 500)
    const days = new Set(events.map(e => eventDateStr(e.createdAt)).filter(Boolean))
    let streak = 0
    const d = new Date()
    while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1) }
    return streak
  } catch { return 0 }
}

export default async function DailyMissionsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let tab = 'daily'
  let missions = { daily: [], weekly: [] }
  let loading = true
  const { name: myName } = getCurrentUser()
  let PLAYER = { name: myName, level: 1, xp: 0, xpNext: 600, todayXp: 0, streak: 0 }

  async function loadData() {
    loading = true
    try {
      const all = (await listDocs('daily_missions', [], 'title', 'asc', 500)).filter(m => !m.deleted)
      missions = { daily: all.filter(m => m.period === 'daily'), weekly: all.filter(m => m.period === 'weekly') }
    } catch (e) { missions = { daily: [], weekly: [] } }
    try {
      const [xp, streak] = await Promise.all([getMyTotalPoints(), computeRealStreak(myName)])
      const level = levelFromXp(xp)
      PLAYER = { name: myName, level, xp, xpNext: xpNextFromLevel(level), todayXp: PLAYER.todayXp, streak }
    } catch {}
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
            '<div style="font-weight:700;font-size:0.82rem;'+(m.done?'text-decoration:line-through;color:var(--text-muted)':'')+'">'+escHtml(m.title)+'</div>' +
            '<div style="font-size:0.68rem;color:var(--warning);font-weight:700">+'+m.xp+' XP</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;align-items:center">' +
        (m.done ?
          '<span style="font-size:1.2rem">✅</span>' :
          '<button class="btn btn-sm btn-primary complete-btn" data-id="'+m.id+'" data-type="'+tab+'">ทำเสร็จ</button>'
        ) +
        '<button class="btn btn-sm btn-ghost del-mission-btn" data-id="'+m.id+'" title="ลบ">🗑️</button>' +
        '</div>' +
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
          <div class="page-actions">
            ${tab !== 'special' ? '<button class="btn btn-primary" id="add-mission-btn">➕ สร้างภารกิจ</button>' : ''}
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

        ${tab==='special' ? SPECIAL.map(s=>specialCard(s)).join('') : (list.length ? list.map(m=>missionCard(m)).join('') : '<div class="empty-state" style="padding:40px"><div class="empty-icon">🎯</div><div class="empty-title">ยังไม่มีภารกิจ'+(tab==='daily'?'วันนี้':'สัปดาห์นี้')+'</div><div class="empty-desc">กดปุ่ม "➕ สร้างภารกิจ" ด้านบนเพื่อเริ่มตั้งภารกิจแรก</div></div>')}
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
    container.querySelectorAll('.del-mission-btn').forEach(b=>b.addEventListener('click', () => {
      deleteMission(missions[tab].find(x=>x.id===b.dataset.id))
    }))
    document.getElementById('add-mission-btn')?.addEventListener('click', () => openAddMissionForm())
  }

  async function deleteMission(m) {
    if (!m) return
    const ok = await confirmDialog({ title: '🗑️ ลบภารกิจ', message: `ยืนยันลบภารกิจ "${escHtml(m.title)}"? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบถาวร', danger: true })
    if (!ok) return
    await softDelete('daily_missions', m.id)
    showToast('🗑️ ลบภารกิจแล้ว', 'success')
    await loadData()
  }

  function openAddMissionForm() {
    const { el, close } = openModal({
      title: '➕ สร้างภารกิจ', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อภารกิจ *</label><input class="input" id="mf-title" placeholder="เช่น ปิดดีลให้ได้ 1 คันวันนี้"><span class="input-error" id="mf-title-e"></span></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="mf-period"><option value="${tab==='weekly'?'weekly':'daily'}" selected>${tab==='weekly'?'รายสัปดาห์':'รายวัน'}</option><option value="${tab==='weekly'?'daily':'weekly'}">${tab==='weekly'?'รายวัน':'รายสัปดาห์'}</option></select>
          </div>
          <div class="input-group"><label class="input-label">XP ที่ได้</label><input class="input" type="number" id="mf-xp" value="50"></div>
        </div>
        <div class="input-group"><label class="input-label">เป้าหมาย (จำนวนครั้ง/คัน)</label><input class="input" type="number" id="mf-target" value="1"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="mfc">ยกเลิก</button><button class="btn btn-primary" id="mfs">💾 บันทึก</button>`
    })
    el.querySelector('#mfc').addEventListener('click', close)
    el.querySelector('#mfs').addEventListener('click', async () => {
      const title = el.querySelector('#mf-title').value.trim()
      if (!title) { el.querySelector('#mf-title-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#mfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        await createDoc('daily_missions', {
          title, icon: '🎯', period: el.querySelector('#mf-period').value,
          xp: Number(el.querySelector('#mf-xp').value) || 0,
          target: Number(el.querySelector('#mf-target').value) || 1,
          progress: 0, done: false,
        })
        showToast('✅ สร้างภารกิจแล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
