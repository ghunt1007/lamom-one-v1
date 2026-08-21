/**
 * Technician KPI — KPI ช่างรายบุคคล / รายเดือน
 * Route: /service/tech-kpi
 */
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { listAllDocs, seedDemoData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// (v1.0.534) เจ้าของระบบยืนยันให้เริ่มจาก Jobs/Revenue จริงก่อน — เดิม TECHS/MONTHLY_DATA เป็นข้อมูลตัวอย่าง
// (mock) ล้วนๆ ทั้งชื่อช่าง 5 คนและตัวเลขผลงานทุกเดือน ตอนนี้ดึงรายชื่อช่างจริง (จาก techName ที่กรอกจริงใน
// job_cards เดือนนั้นๆ — ไม่ hardcode รายชื่อ เพราะ techName เป็นช่องพิมพ์เองไม่ได้ผูกกับ staff record) พร้อม
// จำนวนงาน/รายได้จริง (แพทเทิร์นเดียวกับ JobCards.js: รายได้นับเฉพาะงานที่ status done/delivered)
// CSAT และ Come-back ยังไม่มีข้อมูลผูกกับช่างรายคนจริงในระบบ (ไม่มี field เชื่อม CSAT เข้ากับช่างที่ทำงานนั้น
// เลย) จึงยังแสดงเป็น "ไม่มีข้อมูล" ตรงๆ ไม่ปลอมตัวเลข — คะแนน KPI รอบนี้จึงคำนวณจากจำนวนงานอย่างเดียว
// (100% ของน้ำหนักที่มีข้อมูลจริง) ปุ่มอนุมัติ Bonus ยังคงปิดไว้เหมือนเดิมจนกว่าจะมี CSAT/comeback จริงด้วย

function kpiScore(jobs, maxJobs) {
  if (!maxJobs) return 0
  return Math.round(Math.min(jobs / maxJobs, 1) * 100)
}

function grade(score) {
  if (score >= 90) return { g: 'A+', c: 'var(--success)' }
  if (score >= 80) return { g: 'A', c: 'var(--success)' }
  if (score >= 70) return { g: 'B', c: 'var(--primary)' }
  if (score >= 60) return { g: 'C', c: 'var(--warning)' }
  return { g: 'D', c: 'var(--danger)' }
}

export default async function TechKpiPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  const now = todayBangkok().split('-').map(Number)
  let selMonth = now[1] - 1 // 0-indexed, เดือนปัจจุบันตามเวลาไทยจริง
  const selYear = now[0]
  let selTech = null
  let loading = true
  let allJobs = []

  async function loadData() {
    loading = true
    try { allJobs = await listAllDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc') } catch { allJobs = [] }
    allJobs = allJobs.filter(j => !j.deleted)
    loading = false
    if (container.__routerGen === myGen) render()
  }

  // สรุปผลงานจริงต่อช่างสำหรับเดือนที่เลือก จากชื่อช่างที่กรอกจริงใน job_cards (ไม่ hardcode รายชื่อ)
  function techStatsForMonth(monthIdx) {
    const period = `${selYear}-${String(monthIdx + 1).padStart(2, '0')}`
    const monthJobs = allJobs.filter(j => (j.createdAt || '').slice(0, 7) === period && (j.techName || '').trim())
    const byTech = {}
    monthJobs.forEach(j => {
      const name = j.techName.trim()
      if (!byTech[name]) byTech[name] = { name, jobs: 0, revenue: 0 }
      byTech[name].jobs++
      if (j.status === 'done' || j.status === 'delivered') byTech[name].revenue += (j.labor || 0)
    })
    return Object.values(byTech)
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const rows = techStatsForMonth(selMonth)
    const maxJobs = Math.max(1, ...rows.map(r => r.jobs))
    const techStats = rows
      .map(t => { const score = kpiScore(t.jobs, maxJobs); return { ...t, score, grade: grade(score) } })
      .sort((a, b) => b.jobs - a.jobs)

    const sel = selTech ? techStats.find(t => t.name === selTech) : null
    const totalJobs = techStats.reduce((s, t) => s + t.jobs, 0)
    const totalRevenue = techStats.reduce((s, t) => s + t.revenue, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔧 Technician KPI</div>
            <div class="page-subtitle">ผลงานช่างรายบุคคล — จำนวนงาน · รายได้ (จาก Job Card จริง)</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              ${MONTHS.map((m,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${m}</button>`).join('')}
            </div>
            <button class="btn btn-secondary" id="bonus-btn" style="margin-left:8px" disabled title="ยังไม่มีข้อมูล CSAT/Come-back ผูกกับช่างรายคนจริง — ปิดปุ่มนี้ไว้ก่อนเพื่อกันอนุมัติโบนัสจริงจากข้อมูลไม่ครบ">🎁 คำนวณ Bonus (ปิดใช้งาน)</button>
          </div>
        </div>

        <div class="card" style="padding:10px 14px;margin-bottom:14px;background:rgba(245,158,11,.1);border:1px solid var(--warning);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--warning)">
          ⚠️ จำนวนงาน/รายได้เป็นข้อมูลจริงจาก Job Card แล้ว (รายชื่อช่างดึงจากที่กรอกจริงในแต่ละงาน) ส่วน CSAT และ Come-back Rate ยังไม่มีข้อมูลผูกกับช่างรายคนจริงในระบบ (แสดง "ไม่มีข้อมูล") คะแนน KPI ด้านล่างจึงคำนวณจากจำนวนงานอย่างเดียว — ปุ่มอนุมัติ Bonus ปิดไว้จนกว่าจะมีข้อมูล CSAT/Come-back จริงด้วย
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${sc('🔧 Job รวม', totalJobs+' งาน', 'var(--primary)')}
          ${sc('💰 Revenue รวม', formatCurrency(totalRevenue), 'var(--success)')}
          ${sc('🏆 Top Tech', techStats[0] ? techStats[0].name.split(' ')[0] : '—', 'var(--success)')}
        </div>

        ${!techStats.length ? `<div class="empty-state" style="padding:40px 20px"><div class="empty-icon">🔧</div><div class="empty-title">ยังไม่มี Job Card ในเดือนนี้เลย</div><div class="empty-desc">เปิด Job Card พร้อมกรอกชื่อช่างรับผิดชอบที่หน้า "ใบสั่งซ่อม" เพื่อให้ข้อมูลแสดงที่นี่</div></div>` : `
        <div style="display:grid;grid-template-columns:${sel?'1fr 280px':'1fr'};gap:16px">
          <!-- Leaderboard -->
          <div style="display:flex;flex-direction:column;gap:8px">
            ${techStats.map((t,rank) => `
              <div class="card tech-card" data-name="${escAttr(t.name)}" style="padding:14px;cursor:pointer;border:2px solid ${selTech===t.name?'var(--primary)':'transparent'};transition:border .2s">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="font-size:1.5rem;width:36px;text-align:center">${rank===0?'🥇':rank===1?'🥈':rank===2?'🥉':'🔧'}</div>
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span style="font-weight:700;font-size:0.86rem">${escHtml(t.name)}</span>
                      <span style="font-size:0.7rem;font-weight:900;color:${t.grade.c};background:${t.grade.c}22;padding:1px 8px;border-radius:8px">${t.grade.g}</span>
                    </div>
                    <div style="display:flex;gap:12px;font-size:0.72rem;color:var(--text-muted)">
                      <span>📋 ${t.jobs} งาน</span>
                      <span>⭐ CSAT: ไม่มีข้อมูล</span>
                      <span>🔄 Come-back: ไม่มีข้อมูล</span>
                      <span>💰 ${formatCurrency(t.revenue)}</span>
                    </div>
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
                <div style="font-size:2rem">🔧</div>
                <div style="font-weight:700;margin-top:4px">${escHtml(sel.name)}</div>
                <div style="font-size:2rem;font-weight:900;color:${sel.grade.c};margin-top:6px">${sel.grade.g}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">${sel.score}/100 คะแนน (จากจำนวนงาน)</div>
              </div>
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;font-size:0.76rem">
                ${[
                  ['📋 Jobs', sel.jobs+' งาน'],
                  ['⭐ CSAT', 'ไม่มีข้อมูล'],
                  ['🔄 Come-back', 'ไม่มีข้อมูล'],
                  ['💰 Revenue', formatCurrency(sel.revenue)],
                ].map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${k}</span><b>${v}</b></div>`).join('')}
              </div>
            </div>
            <!-- Monthly jobs trend for selected tech -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px">📈 Jobs Trend (ปี ${selYear})</div>
              <div style="display:flex;align-items:flex-end;gap:4px;height:48px">
                ${MONTHS.map((m,i) => {
                  const monthRows = techStatsForMonth(i)
                  const jobs = monthRows.find(r => r.name === sel.name)?.jobs || 0
                  const maxJ = Math.max(1, ...MONTHS.map((_,ii) => techStatsForMonth(ii).find(r => r.name === sel.name)?.jobs || 0))
                  const h = Math.round(jobs/maxJ*44)+4
                  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                    <div style="font-size:0.54rem;color:var(--text-muted)">${jobs}</div>
                    <div style="width:100%;height:${h}px;background:${i===selMonth?'var(--primary)':'var(--primary)55'};border-radius:2px 2px 0 0"></div>
                    <div style="font-size:0.54rem;color:var(--text-muted)">${m}</div>
                  </div>`
                }).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>`}
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b=>b.addEventListener('click',()=>{selMonth=parseInt(b.dataset.i);render()}))
    container.querySelectorAll('.tech-card').forEach(el=>el.addEventListener('click',()=>{selTech=selTech===el.dataset.name?null:el.dataset.name;render()}))
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function escAttr(s) { return escHtml(s).replace(/"/g,'&quot;') }
