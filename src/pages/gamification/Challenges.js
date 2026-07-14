/**
 * Challenges — ภารกิจท้าทาย
 * Route: /gamification/challenges
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData, getSalesData } from '../../core/db.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const CHALLENGE_TYPES = {
  sales:   { label: 'ยอดขาย', color: 'success', icon: '💰' },
  lead:    { label: 'Lead', color: 'primary', icon: '🧲' },
  service: { label: 'บริการ', color: 'warning', icon: '🔧' },
  team:    { label: 'ทีม', color: 'secondary', icon: '🤝' },
}

export default async function ChallengesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let challenges = []
  let loading = true

  async function loadData() {
    loading = true
    try { challenges = await listDocs('gamification_challenges', [], 'endDate', 'asc', 100) } catch (e) { challenges = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const active = challenges.filter(c => c.status === 'active').length
    const completed = challenges.filter(c => c.status === 'completed').length
    const totalParticipants = new Set(challenges.flatMap(c => (c.participants||[]).map(p => p.name))).size

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Challenges</div>
            <div class="page-subtitle">ภารกิจท้าทาย — สร้างแรงจูงใจทีม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-ch-btn">+ สร้าง Challenge</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🎯 กำลังแข่ง', active, 'primary')}
          ${kpi('✅ จบแล้ว', completed, 'success')}
          ${kpi('👥 ผู้เข้าร่วม', totalParticipants, 'secondary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${challenges.map(c => {
            const ct = CHALLENGE_TYPES[c.type]
            const isDone = c.status === 'completed'
            const daysLeft = Math.ceil((new Date(c.endDate) - new Date()) / 86400000)
            const sorted = [...(c.participants||[])].sort((a, b) => b.progress - a.progress)
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${ct?.color})${isDone?';opacity:0.7':''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.92rem">${c.name}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🎁 ${c.reward}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ct?.color}" style="font-size:0.62rem">${ct?.icon} ${ct?.label}</span>
                  ${isDone
                    ? `<span class="badge badge-success" style="font-size:0.6rem">✅ จบแล้ว</span>`
                    : `<span style="font-size:0.72rem;color:var(--${daysLeft<=3?'danger':'text-muted'})">⏰ เหลือ ${daysLeft} วัน</span>`
                  }
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${sorted.map((p, i) => {
                  const pct = Math.min(100, Math.round(p.progress / c.target * 100))
                  const isLeader = i === 0 && !isDone
                  return `<div>
                    <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:2px">
                      <span>${isLeader?'👑 ':''}${i===0&&isDone?'🏆 ':''}${p.name}</span>
                      <span style="color:var(--${pct>=100?'success':'text-muted'})">${p.progress}/${c.target} (${pct}%)</span>
                    </div>
                    <div style="background:var(--surface-2);border-radius:3px;height:8px">
                      <div style="width:${pct}%;background:var(--${pct>=100?'success':ct?.color});height:8px;border-radius:3px"></div>
                    </div>
                  </div>`
                }).join('')}
              </div>
              ${!isDone ? `<button class="btn btn-xs btn-secondary update-btn" data-id="${c.id}" style="margin-top:10px">📊 อัปเดตคะแนน</button>` : ''}
            </div>`
          }).join('')}
          ${!challenges.length ? `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">ยังไม่มี Challenge</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.update-btn').forEach(b => b.addEventListener('click', () => {
      const c = challenges.find(x => x.id === b.dataset.id); if (c) openUpdateModal(c)
    }))
    document.getElementById('add-ch-btn')?.addEventListener('click', openAddForm)
  }

  function openUpdateModal(c) {
    const isSales = c.type === 'sales'
    const { el } = openModal({
      title: '📊 อัปเดตคะแนน: ' + c.name,
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        ${isSales ? `<button class="btn btn-xs btn-secondary" id="sync-real-btn" type="button">🔄 ซิงค์จากยอดขายจริง (ใบจองที่ส่งมอบแล้ว)</button>` : ''}
        ${(c.participants||[]).map((p, i) => `
          <div class="input-group"><label class="input-label">${p.name}</label>
            <input class="input" type="number" min="0" class="prog-input" id="prog-${i}" value="${p.progress}">
          </div>
        `).join('')}
      </div>`,
      async onConfirm() {
        const participants = (c.participants||[]).map((p, i) => {
          const v = parseInt(document.getElementById(`prog-${i}`)?.value)
          return { ...p, progress: isNaN(v) ? p.progress : v }
        })
        const status = participants.some(p => p.progress >= c.target) ? 'completed' : c.status
        await updateDocData('gamification_challenges', c.id, { participants, status })
        if (participants.some(p => p.progress >= c.target)) showToast('🎉 มีผู้พิชิต Challenge แล้ว!', 'success')
        else showToast('✅ อัปเดตคะแนนแล้ว', 'success')
        await loadData()
      }
    })
    if (isSales) {
      el.querySelector('#sync-real-btn')?.addEventListener('click', async () => {
        try {
          const sales = await getSalesData()
          const deliveredByName = {}
          sales.filter(s => s.delivered).forEach(s => { deliveredByName[s.salesName] = (deliveredByName[s.salesName] || 0) + 1 })
          ;(c.participants||[]).forEach((p, i) => {
            const inp = el.querySelector(`#prog-${i}`)
            if (inp && deliveredByName[p.name] != null) inp.value = deliveredByName[p.name]
          })
          showToast('🔄 ซิงค์จากยอดขายจริงแล้ว — ตรวจสอบแล้วกด "ยืนยัน"', 'info')
        } catch { showToast('ซิงค์ไม่สำเร็จ', 'error') }
      })
    }
  }

  function openAddForm() {
    openModal({
      title: '+ สร้าง Challenge ใหม่',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อ Challenge *</label><input class="input" id="ch-name"></div>
        <div class="input-group"><label class="input-label">ประเภท</label>
          <select class="input" id="ch-type">${Object.entries(CHALLENGE_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">เป้าหมาย (จำนวน)</label><input class="input" type="number" id="ch-target" value="5"></div>
        <div class="input-group"><label class="input-label">วันสิ้นสุด</label><input class="input" type="date" id="ch-end" value="${addDays(7)}"></div>
        <div class="input-group"><label class="input-label">รางวัล</label><input class="input" id="ch-reward" placeholder="🏆 โบนัส..."></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('ch-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        await createDoc('gamification_challenges', {
          name, type: document.getElementById('ch-type')?.value || 'sales',
          reward: document.getElementById('ch-reward')?.value || '🏆 รางวัล',
          target: parseInt(document.getElementById('ch-target')?.value) || 5,
          participants: [ {name:'วิชัย ยอดขาย',progress:0}, {name:'สุดา มาดี',progress:0}, {name:'ธนา เก่ง',progress:0} ],
          endDate: document.getElementById('ch-end')?.value || addDays(7), status: 'active',
        })
        showToast('🎯 สร้าง Challenge แล้ว!', 'success'); await loadData()
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
