/**
 * Staff Mood Survey — สำรวจความรู้สึกพนักงานรายวัน / รายสัปดาห์
 * Route: /hr/mood-survey
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

const MOODS = [
  { score:5, emoji:'😄', label:'ดีมาก',  color:'#00C853' },
  { score:4, emoji:'🙂', label:'ดี',      color:'#64DD17' },
  { score:3, emoji:'😐', label:'ปานกลาง',color:'#FFD600' },
  { score:2, emoji:'😟', label:'ไม่ดี',  color:'#FF6D00' },
  { score:1, emoji:'😢', label:'แย่มาก', color:'#D50000' },
]

const DEPT = ['ฝ่ายขาย','ฝ่ายบริการ','ฝ่ายการตลาด','ฝ่าย HR','ฝ่ายการเงิน']

const QUESTIONS = [
  'วันนี้คุณรู้สึกอย่างไรกับการทำงาน?',
  'ทีมงานช่วยเหลือคุณเพียงพอไหม?',
  'มีอะไรที่ทำให้คุณเครียดเป็นพิเศษไหม?',
]

export default async function MoodSurveyPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let responses = []
  let filterDept = 'all'
  let filterDate = new Date().toISOString().slice(0, 10)
  let surveySentAt = null
  let loading = true

  async function loadData() {
    loading = true
    try { responses = await listDocs('mood_responses', [], 'date', 'desc', 500) } catch (e) { responses = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const todayRows = responses.filter(r => r.date === filterDate && (filterDept==='all'||r.dept===filterDept))
    const avgScore  = todayRows.length ? (todayRows.reduce((s,r)=>s+r.score,0)/todayRows.length).toFixed(1) : '—'
    const avgMood   = MOODS.find(m=>m.score===Math.round(parseFloat(avgScore)))||MOODS[2]
    const low       = responses.filter(r=>r.date===filterDate&&r.score<=2)
    const deptAvg   = DEPT.map(d => {
      const dr = responses.filter(r=>r.date===filterDate&&r.dept===d)
      return { dept:d, avg:dr.length?(dr.reduce((s,r)=>s+r.score,0)/dr.length).toFixed(1):'—', count:dr.length }
    })

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">😊 Staff Mood Survey</div>
            <div class="page-subtitle">วัด Mood พนักงานรายวัน · ตรวจจับความเครียด · HR Dashboard</div>
          </div>
          <div class="page-actions">
            ${surveySentAt ? `<span style="font-size:0.74rem;color:var(--success)">✅ ส่งแบบสำรวจแล้ว</span>` : `<button class="btn btn-secondary" id="send-survey-btn">📤 ส่งแบบสำรวจ</button>`}
            <button class="btn btn-primary" id="fill-btn">✏️ กรอกของฉัน</button>
          </div>
        </div>

        <!-- Today mood average -->
        <div style="display:grid;grid-template-columns:auto 1fr;gap:16px;margin-bottom:16px;align-items:center">
          <div class="card" style="padding:20px;text-align:center;min-width:140px">
            <div style="font-size:3rem;margin-bottom:4px">${avgMood.emoji}</div>
            <div style="font-size:2rem;font-weight:900;color:${avgMood.color}">${avgScore}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${avgMood.label} · ${todayRows.length} คนตอบ</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
            ${MOODS.map(m => {
              const cnt = todayRows.filter(r=>r.score===m.score).length
              return `<div class="card" style="padding:10px;text-align:center;border-top:3px solid ${m.color}">
                <div style="font-size:1.5rem">${m.emoji}</div>
                <div style="font-size:1.1rem;font-weight:700;color:${m.color}">${cnt}</div>
                <div style="font-size:0.62rem;color:var(--text-muted)">${m.label}</div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <input class="input" id="date-pick" type="date" value="${filterDate}" style="width:160px">
          <select class="input" id="dept-sel" style="min-width:160px">
            <option value="all">ทุกแผนก</option>
            ${DEPT.map(d=>`<option value="${d}" ${filterDept===d?'selected':''}>${d}</option>`).join('')}
          </select>
          ${low.length>0?`<span style="background:var(--danger);color:#fff;padding:4px 12px;border-radius:10px;font-size:0.74rem;display:flex;align-items:center">⚠️ ${low.length} คนรู้สึกแย่ — ควรพูดคุย</span>`:''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Response list -->
          <div>
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📋 การตอบวันนี้ (${todayRows.length})</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${todayRows.map(r => {
                const m = MOODS.find(x=>x.score===r.score)||MOODS[2]
                return `<div class="card" style="padding:10px 12px;border-left:3px solid ${m.color}">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:1.4rem">${m.emoji}</span>
                    <div style="flex:1">
                      <div style="font-weight:700;font-size:0.8rem">${r.staff} <span style="font-size:0.65rem;color:var(--text-muted)">· ${r.dept}</span></div>
                      ${r.note?`<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">"${r.note}"</div>`:''}
                    </div>
                    <div style="font-size:1.1rem;font-weight:900;color:${m.color}">${r.score}</div>
                  </div>
                </div>`
              }).join('')}
              ${todayRows.length === 0 ? '<div style="font-size:0.8rem;color:var(--text-muted);padding:20px;text-align:center">ยังไม่มีการตอบแบบสำรวจ</div>' : ''}
            </div>
          </div>

          <!-- Dept average -->
          <div>
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🏢 ค่าเฉลี่ยตามแผนก</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${deptAvg.map(d => {
                const avg = parseFloat(d.avg) || 0
                const m = MOODS.find(x=>x.score===Math.round(avg))||MOODS[2]
                const barW = avg>0 ? Math.round(avg/5*100) : 0
                return `<div class="card" style="padding:10px 12px">
                  <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <div style="font-size:0.78rem;font-weight:600">${d.dept}</div>
                    <div style="font-size:0.78rem;font-weight:700;color:${m.color}">${m.emoji} ${d.avg} (${d.count} คน)</div>
                  </div>
                  <div style="height:6px;background:var(--surface-2);border-radius:3px">
                    <div style="height:100%;width:${barW}%;background:${m.color};border-radius:3px;transition:width .3s"></div>
                  </div>
                </div>`
              }).join('')}
            </div>
          </div>
        </div>
      </div>`

    document.getElementById('date-pick')?.addEventListener('change', e => { filterDate=e.target.value; render() })
    document.getElementById('dept-sel')?.addEventListener('change', e => { filterDept=e.target.value; render() })
    document.getElementById('send-survey-btn')?.addEventListener('click', () => {
      const uniqueStaff = [...new Set(responses.map(r => r.staff))]
      openModal({
        title: '📤 ส่งแบบสำรวจ Mood',
        size: 'sm',
        body: `<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">ช่องทาง: 🔔 แจ้งเตือนในระบบ</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">พนักงาน ${uniqueStaff.length} คน (${DEPT.join(', ')})</div>
            <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.72rem;max-height:70px;overflow-y:auto">
              ${uniqueStaff.join(', ')}
            </div>
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">ตัวอย่างข้อความ</div>
            <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.72rem;color:var(--text-muted)">🌟 สวัสดี! กรุณากรอกแบบสำรวจ Mood วันนี้ เพื่อช่วยให้ HR ดูแลคุณได้ดีขึ้น ✏️ ใช้เวลาแค่ 1 นาที</div>
          </div>
        </div>`,
        confirmText: '📤 ส่งแจ้งเตือน',
        async onConfirm() {
          try {
            await createDoc('notifications', {
              type: 'system', title: '😊 กรุณากรอกแบบสำรวจ Mood วันนี้',
              body: 'ใช้เวลาแค่ 1 นาที เพื่อช่วยให้ HR ดูแลทีมได้ดีขึ้น', read: false, link: '/hr/mood-survey', createdAt: new Date().toISOString(),
            })
          } catch { /* แจ้งเตือนพลาดได้ */ }
          surveySentAt = new Date().toISOString()
          render()
          showToast(`📤 ส่งแบบสำรวจให้พนักงาน ${uniqueStaff.length} คน แล้ว`, 'success')
        }
      })
    })
    document.getElementById('fill-btn')?.addEventListener('click', () => openFillModal())
  }

  function openFillModal() {
    let picked = 0
    openModal({
      title:'✏️ กรอก Mood วันนี้', size:'sm',
      body:`<div style="font-size:0.8rem">
        <div style="font-size:0.78rem;font-weight:700;margin-bottom:12px">${QUESTIONS[0]}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">
          ${MOODS.map(m=>`
            <button class="mood-pick" data-score="${m.score}" style="font-size:2rem;background:none;border:3px solid transparent;border-radius:12px;padding:8px;cursor:pointer;transition:all .15s" title="${m.label}">${m.emoji}</button>`).join('')}
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">บอกเพิ่มเติม (optional)</label>
          <input class="input" id="mood-note" placeholder="รู้สึกอย่างไร..." style="width:100%;margin-top:4px"></div>
      </div>`,
      confirmText:'✅ ส่งแบบสำรวจ',
      async onConfirm() {
        if (!picked) { showToast('เลือก Mood ก่อน', 'warning'); return false }
        await createDoc('mood_responses', {
          staff: 'ผู้ใช้ปัจจุบัน', dept: 'ฝ่ายขาย',
          date: new Date().toISOString().slice(0, 10),
          score: picked, note: document.getElementById('mood-note')?.value || '',
        })
        filterDate = new Date().toISOString().slice(0, 10)
        showToast('✅ ส่ง Mood Survey แล้ว ขอบคุณ!', 'success')
        await loadData()
      }
    })
    setTimeout(() => {
      document.querySelectorAll('.mood-pick').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.mood-pick').forEach(x => x.style.border='3px solid transparent')
        b.style.border='3px solid var(--primary)'
        picked = parseInt(b.dataset.score)
      }))
    }, 100)
  }

  await loadData()
}
