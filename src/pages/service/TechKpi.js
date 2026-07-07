/**
 * Technician KPI — KPI ช่างรายบุคคล / รายเดือน
 * Route: /service/tech-kpi
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

const TECHS = [
  { id:'T01', name:'สมศักดิ์ มีฝีมือ', level:'Master Tech', exp:8,  avatar:'🔧' },
  { id:'T02', name:'วิชัย ช่างเก่ง',   level:'Senior Tech', exp:5,  avatar:'⚡' },
  { id:'T03', name:'นพดล ซ่อมดี',     level:'Senior Tech', exp:4,  avatar:'🔩' },
  { id:'T04', name:'ประสิทธิ์ รวดเร็ว',level:'Tech',        exp:2,  avatar:'🛠' },
  { id:'T05', name:'อนันต์ ตั้งใจ',    level:'Tech',        exp:1,  avatar:'🔋' },
]

const MONTHLY_DATA = {
  T01: [{jobs:42,csat:96,comeback:1,hrs:168,revenue:128000},{jobs:45,csat:97,comeback:0,hrs:172,revenue:138000},{jobs:40,csat:95,comeback:2,hrs:160,revenue:122000},{jobs:48,csat:98,comeback:0,hrs:176,revenue:145000},{jobs:52,csat:99,comeback:0,hrs:180,revenue:158000},{jobs:49,csat:97,comeback:1,hrs:174,revenue:149000}],
  T02: [{jobs:38,csat:91,comeback:2,hrs:168,revenue:112000},{jobs:41,csat:93,comeback:1,hrs:170,revenue:121000},{jobs:36,csat:90,comeback:3,hrs:162,revenue:108000},{jobs:43,csat:92,comeback:2,hrs:172,revenue:128000},{jobs:47,csat:94,comeback:1,hrs:178,revenue:139000},{jobs:44,csat:93,comeback:1,hrs:175,revenue:132000}],
  T03: [{jobs:35,csat:88,comeback:3,hrs:162,revenue:98000},{jobs:37,csat:90,comeback:2,hrs:165,revenue:104000},{jobs:33,csat:87,comeback:4,hrs:158,revenue:94000},{jobs:40,csat:91,comeback:2,hrs:168,revenue:112000},{jobs:44,csat:92,comeback:1,hrs:172,revenue:122000},{jobs:41,csat:90,comeback:2,hrs:170,revenue:116000}],
  T04: [{jobs:28,csat:84,comeback:4,hrs:156,revenue:78000},{jobs:30,csat:86,comeback:3,hrs:160,revenue:84000},{jobs:26,csat:83,comeback:5,hrs:152,revenue:74000},{jobs:33,csat:87,comeback:3,hrs:164,revenue:91000},{jobs:36,csat:88,comeback:2,hrs:168,revenue:99000},{jobs:34,csat:86,comeback:3,hrs:165,revenue:94000}],
  T05: [{jobs:22,csat:80,comeback:5,hrs:148,revenue:58000},{jobs:24,csat:82,comeback:4,hrs:152,revenue:64000},{jobs:20,csat:79,comeback:6,hrs:144,revenue:54000},{jobs:27,csat:84,comeback:4,hrs:156,revenue:72000},{jobs:30,csat:85,comeback:3,hrs:160,revenue:79000},{jobs:28,csat:83,comeback:4,hrs:158,revenue:74000}],
}

function kpiScore(d) {
  const jobsScore = Math.min(d.jobs/50*40, 40)
  const csatScore = (d.csat-70)/30*35
  const cbScore   = Math.max(0, (5-d.comeback)/5*25)
  return Math.round(jobsScore+csatScore+cbScore)
}

function grade(score) {
  if(score>=90) return {g:'A+',c:'var(--success)'}
  if(score>=80) return {g:'A', c:'var(--success)'}
  if(score>=70) return {g:'B', c:'var(--primary)'}
  if(score>=60) return {g:'C', c:'var(--warning)'}
  return {g:'D',c:'var(--danger)'}
}

export default async function TechKpiPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let selMonth = 5
  let selTech  = null
  let approvedBonusMonths = new Set()
  let loading = true

  async function loadData() {
    loading = true
    try {
      const rows = await listDocs('tech_kpi_bonus_approvals', [], 'month', 'asc', 200)
      approvedBonusMonths = new Set(rows.map(r => r.month))
    } catch (e) { approvedBonusMonths = new Set() }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const techStats = TECHS.map(t => {
      const d = MONTHLY_DATA[t.id][selMonth]
      const score = kpiScore(d)
      const g = grade(score)
      return { ...t, ...d, score, grade:g }
    }).sort((a,b) => b.score-a.score)

    const sel = selTech ? techStats.find(t=>t.id===selTech) : null
    const totalJobs    = techStats.reduce((s,t)=>s+t.jobs,0)
    const totalRevenue = techStats.reduce((s,t)=>s+t.revenue,0)
    const avgCsat      = Math.round(techStats.reduce((s,t)=>s+t.csat,0)/techStats.length)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔧 Technician KPI</div>
            <div class="page-subtitle">ผลงานช่างรายบุคคล · CSAT · Come-back Rate · Revenue</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              ${MONTHS.map((m,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${m}</button>`).join('')}
            </div>
            ${approvedBonusMonths.has(selMonth) ? `<span style="font-size:0.74rem;color:var(--success);margin-left:8px">✅ Bonus อนุมัติแล้ว</span>` : `<button class="btn btn-primary" id="bonus-btn" style="margin-left:8px">🎁 คำนวณ Bonus</button>`}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🔧 Job รวม', totalJobs+' งาน', 'var(--primary)')}
          ${sc('💰 Revenue รวม', formatCurrency(totalRevenue), 'var(--success)')}
          ${sc('⭐ CSAT เฉลี่ย', avgCsat+'%', 'var(--warning)')}
          ${sc('🏆 Top Tech', techStats[0].avatar+' '+techStats[0].name.split(' ')[0], 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:${sel?'1fr 280px':'1fr'};gap:16px">
          <!-- Leaderboard -->
          <div style="display:flex;flex-direction:column;gap:8px">
            ${techStats.map((t,rank) => `
              <div class="card tech-card" data-id="${t.id}" style="padding:14px;cursor:pointer;border:2px solid ${selTech===t.id?'var(--primary)':'transparent'};transition:border .2s">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="font-size:1.5rem;width:36px;text-align:center">${rank===0?'🥇':rank===1?'🥈':rank===2?'🥉':t.avatar}</div>
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span style="font-weight:700;font-size:0.86rem">${t.name}</span>
                      <span style="font-size:0.64rem;color:var(--text-muted)">${t.level} · ${t.exp} ปี</span>
                      <span style="font-size:0.7rem;font-weight:900;color:${t.grade.c};background:${t.grade.c}22;padding:1px 8px;border-radius:8px">${t.grade.g}</span>
                    </div>
                    <div style="display:flex;gap:12px;font-size:0.72rem;color:var(--text-muted)">
                      <span>📋 ${t.jobs} งาน</span>
                      <span>⭐ ${t.csat}%</span>
                      <span>🔄 Come-back ${t.comeback}</span>
                      <span>💰 ${formatCurrency(t.revenue)}</span>
                    </div>
                    <!-- KPI bar -->
                    <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
                      <div style="flex:1;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${t.score}%;background:${t.grade.c};border-radius:3px"></div>
                      </div>
                      <span style="font-size:0.72rem;font-weight:700;color:${t.grade.c};flex-shrink:0">${t.score}/100</span>
                    </div>
                  </div>
                </div>
              </div>`).join('')}
          </div>

          <!-- Detail panel -->
          ${sel ? `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="card" style="padding:14px">
              <div style="text-align:center;padding-bottom:10px;border-bottom:1px solid var(--border)">
                <div style="font-size:2rem">${sel.avatar}</div>
                <div style="font-weight:700;margin-top:4px">${sel.name}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">${sel.level}</div>
                <div style="font-size:2rem;font-weight:900;color:${sel.grade.c};margin-top:6px">${sel.grade.g}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">${sel.score}/100 คะแนน</div>
              </div>
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;font-size:0.76rem">
                ${[
                  ['📋 Jobs',sel.jobs+' งาน'],
                  ['⭐ CSAT',sel.csat+'%'],
                  ['🔄 Come-back',sel.comeback+' ครั้ง'],
                  ['⏱ ชั่วโมงทำงาน',sel.hrs+' ชม.'],
                  ['💰 Revenue',formatCurrency(sel.revenue)],
                  ['⚙️ Rev/Hour',formatCurrency(Math.round(sel.revenue/sel.hrs))+'/ชม.'],
                ].map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${k}</span><b>${v}</b></div>`).join('')}
              </div>
            </div>
            <!-- Monthly trend for selected tech -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">📈 Jobs Trend</div>
              <div style="display:flex;align-items:flex-end;gap:4px;height:48px">
                ${MONTHS.map((m,i) => {
                  const d = MONTHLY_DATA[sel.id][i]
                  const maxJ = Math.max(...MONTHLY_DATA[sel.id].map(x=>x.jobs))
                  const h = Math.round(d.jobs/maxJ*44)+4
                  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                    <div style="font-size:0.54rem;color:var(--text-muted)">${d.jobs}</div>
                    <div style="width:100%;height:${h}px;background:${i===selMonth?'var(--primary)':'var(--primary)55'};border-radius:2px 2px 0 0"></div>
                    <div style="font-size:0.54rem;color:var(--text-muted)">${m}</div>
                  </div>`
                }).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b=>b.addEventListener('click',()=>{selMonth=parseInt(b.dataset.i);render()}))
    container.querySelectorAll('.tech-card').forEach(el=>el.addEventListener('click',()=>{selTech=selTech===el.dataset.id?null:el.dataset.id;render()}))
    document.getElementById('bonus-btn')?.addEventListener('click',()=>{
      const BONUS = { 'A+':3000, A:2000, B:1000, C:500, D:0 }
      const bonusRows = techStats.map(t => ({ tech:t, bonus: BONUS[t.grade.g] || 0 }))
      const totalBonus = bonusRows.reduce((s,r)=>s+r.bonus,0)
      openModal({
        title:`🎁 Bonus Pool — ${MONTHS[selMonth]}`,
        size:'sm',
        body:`<div style="font-size:0.8rem">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead><tr style="border-bottom:2px solid var(--border);text-align:left">
              <th style="padding:8px 10px">ช่าง</th>
              <th style="text-align:center;padding:8px">เกรด</th>
              <th style="text-align:center;padding:8px">KPI</th>
              <th style="text-align:right;padding:8px 10px">Bonus</th>
            </tr></thead>
            <tbody>
              ${bonusRows.map(r=>`
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 10px">${r.tech.avatar} ${r.tech.name}</td>
                  <td style="text-align:center;padding:8px;font-weight:700;color:${r.tech.grade.c}">${r.tech.grade.g}</td>
                  <td style="text-align:center;padding:8px">${r.tech.score}</td>
                  <td style="text-align:right;padding:8px 10px;font-weight:700;color:${r.bonus>0?'var(--success)':'var(--text-muted)'}">฿${r.bonus.toLocaleString()}</td>
                </tr>`).join('')}
              <tr style="border-top:2px solid var(--border);font-weight:700">
                <td colspan="3" style="padding:8px 10px;font-size:0.82rem">รวมทั้งหมด</td>
                <td style="text-align:right;padding:8px 10px;color:var(--success)">฿${totalBonus.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <div style="font-size:0.68rem;color:var(--text-muted);margin-top:8px">เกณฑ์: A+ ฿3,000 · A ฿2,000 · B ฿1,000 · C ฿500 · D ฿0</div>
        </div>`,
        confirmText:'✅ อนุมัติ Bonus',
        async onConfirm(){
          try {
            await createDoc('tech_kpi_bonus_approvals', { month: selMonth, monthLabel: MONTHS[selMonth], totalBonus, approvedCount: bonusRows.length })
            showToast(`✅ อนุมัติ Bonus Pool ฿${totalBonus.toLocaleString()} — ${bonusRows.length} คน (${MONTHS[selMonth]})`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
