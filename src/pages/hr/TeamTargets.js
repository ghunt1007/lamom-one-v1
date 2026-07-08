/**
 * Team & Department Targets — มอบหมายเป้าหมายรายเดือนต่อทีม/ฝ่าย พร้อมสรุปเป็น KPI
 * Route: /hr/targets
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function addMonths(n) { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7) }

const DEPARTMENTS = ['ฝ่ายขาย','ฝ่ายบริการ','ฝ่ายการเงิน','ฝ่าย HR','ฝ่าย IT','ผู้บริหาร','อื่นๆ']

const METRICS = {
  units:    { label: 'ยอดขาย (คัน)', unit: 'คัน', fmt: v => v.toLocaleString() },
  revenue:  { label: 'รายได้ (บาท)', unit: 'บาท', fmt: v => formatCurrency(v) },
  service:  { label: 'งานบริการ (งาน)', unit: 'งาน', fmt: v => v.toLocaleString() },
  leads:    { label: 'ลูกค้าใหม่ (ราย)', unit: 'ราย', fmt: v => v.toLocaleString() },
  csat:     { label: 'ความพึงพอใจลูกค้า (%)', unit: '%', fmt: v => v + '%' },
  other:    { label: 'อื่นๆ', unit: '', fmt: v => v.toLocaleString() },
}

function achievement(t) { return t.target > 0 ? Math.round(t.actual / t.target * 100) : 0 }
function achToken(pct) { return pct >= 100 ? 'success' : pct >= 70 ? 'warning' : 'danger' }
function achColor(pct) { return 'var(--' + achToken(pct) + ')' }

export default async function TeamTargetsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let targets = []
  let currentMonth = addMonths(0)
  let loading = true

  async function loadData() {
    loading = true
    try { targets = await listDocs('team_targets', [], 'department', 'asc', 500) } catch (e) { targets = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const monthTargets = targets.filter(t => t.period === currentMonth)
    const overallAch = monthTargets.length ? Math.round(monthTargets.reduce((a,t)=>a+achievement(t),0) / monthTargets.length) : 0
    const onTrack = monthTargets.filter(t => achievement(t) >= 100).length
    const behind = monthTargets.filter(t => achievement(t) < 70).length

    const byDept = {}
    monthTargets.forEach(t => { (byDept[t.department] ||= []).push(t) })
    const deptRollup = Object.entries(byDept).map(([dept, items]) => ({
      dept, avgAch: Math.round(items.reduce((a,t)=>a+achievement(t),0) / items.length), count: items.length
    })).sort((a,b) => b.avgAch - a.avgAch)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 เป้าหมายทีม/ฝ่าย & KPI</div>
            <div class="page-subtitle">มอบหมายเป้าหมายรายเดือน สรุปผลเป็น KPI รายทีม/ฝ่าย</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="prev-month-btn">◀ เดือนก่อน</button>
            <button class="btn btn-secondary btn-xs" id="curr-month-btn">เดือนนี้</button>
            <button class="btn btn-primary" id="add-target-btn">+ มอบหมายเป้าหมาย</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📅 เดือน', currentMonth, 'secondary')}
          ${kpi('📊 KPI เฉลี่ยรวม', overallAch + '%', achToken(overallAch))}
          ${kpi('✅ ทำได้ตามเป้า', onTrack + '/' + monthTargets.length, 'success')}
          ${kpi('⚠️ ต่ำกว่าเป้ามาก', behind, behind>0?'danger':'secondary')}
        </div>

        ${deptRollup.length ? `
        <div class="card" style="padding:14px;margin-bottom:16px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px">📊 สรุป KPI รายฝ่าย</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
            ${deptRollup.map(d => `
              <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="font-size:0.78rem;font-weight:700;margin-bottom:4px">${esc(d.dept)}</div>
                <div style="font-size:1.2rem;font-weight:900;color:${achColor(d.avgAch)}">${d.avgAch}%</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">${d.count} เป้าหมาย</div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <div style="display:flex;flex-direction:column;gap:14px">
          ${DEPARTMENTS.filter(d => byDept[d]).map(dept => `
            <div class="card" style="padding:0;overflow:hidden">
              <div style="padding:10px 14px;background:var(--surface-2);font-size:0.82rem;font-weight:700;border-bottom:1px solid var(--border)">${esc(dept)}</div>
              <div style="padding:10px 14px;display:flex;flex-direction:column;gap:10px">
                ${byDept[dept].map(t => {
                  const m = METRICS[t.metric]
                  const pct = achievement(t)
                  return `<div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                      <div style="font-size:0.82rem;font-weight:600">${t.team ? '👥 '+esc(t.team)+' — ' : ''}${m?.label}</div>
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:0.78rem;color:${achColor(pct)};font-weight:700">${pct}%</span>
                        <button class="btn btn-xs btn-secondary update-actual-btn" data-id="${t.id}">📊 อัปเดตผลจริง</button>
                      </div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);margin-bottom:3px">
                      <span>ผลจริง: ${m?.fmt(t.actual)}</span><span>เป้า: ${m?.fmt(t.target)}</span>
                    </div>
                    <div style="background:var(--surface-2);border-radius:4px;height:8px">
                      <div style="width:${Math.min(pct,100)}%;background:${achColor(pct)};height:8px;border-radius:4px;transition:width .4s"></div>
                    </div>
                  </div>`
                }).join('')}
              </div>
            </div>
          `).join('')}
          ${!monthTargets.length ? '<div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">ยังไม่มีเป้าหมายในเดือนนี้ — กด "+ มอบหมายเป้าหมาย" เพื่อเริ่มต้น</div>' : ''}
        </div>
      </div>
    `

    document.getElementById('prev-month-btn')?.addEventListener('click', () => { const d = new Date(currentMonth + '-01'); d.setMonth(d.getMonth()-1); currentMonth = d.toISOString().slice(0,7); render() })
    document.getElementById('curr-month-btn')?.addEventListener('click', () => { currentMonth = addMonths(0); render() })
    document.getElementById('add-target-btn')?.addEventListener('click', openAddModal)
    container.querySelectorAll('.update-actual-btn').forEach(b => b.addEventListener('click', () => {
      const t = targets.find(x => x.id === b.dataset.id); if (t) openUpdateActualModal(t)
    }))
  }

  function openAddModal() {
    openModal({
      title: '+ มอบหมายเป้าหมายรายเดือน',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="input-group"><label class="input-label">ฝ่าย *</label>
            <select class="input" id="tt-dept">${DEPARTMENTS.map(d => `<option>${d}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ทีม (ถ้ามี — เว้นว่างได้ = เป้าระดับฝ่าย)</label><input class="input" id="tt-team" placeholder="เช่น ทีม A"></div>
          <div class="input-group"><label class="input-label">ตัวชี้วัด (Metric)</label>
            <select class="input" id="tt-metric">${Object.entries(METRICS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เดือน</label><input type="month" class="input" id="tt-period" value="${currentMonth}"></div>
          <div class="input-group"><label class="input-label">เป้าหมาย *</label><input type="number" class="input" id="tt-target"></div>
          <div class="input-group"><label class="input-label">ผลจริง (เริ่มต้น)</label><input type="number" class="input" id="tt-actual" value="0"></div>
        </div>
      `,
      async onConfirm() {
        const department = document.getElementById('tt-dept')?.value
        const target = +document.getElementById('tt-target')?.value || 0
        if (!department || target <= 0) { showToast('❗ กรุณาเลือกฝ่ายและระบุเป้าหมาย', 'error'); return false }
        try {
          await createDoc('team_targets', {
            department, team: document.getElementById('tt-team')?.value?.trim() || '',
            metric: document.getElementById('tt-metric')?.value || 'other',
            period: document.getElementById('tt-period')?.value || currentMonth,
            target, actual: +document.getElementById('tt-actual')?.value || 0,
          })
          showToast('✅ มอบหมายเป้าหมายแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openUpdateActualModal(t) {
    const m = METRICS[t.metric]
    openModal({
      title: '📊 อัปเดตผลจริง — ' + esc(t.department) + (t.team ? ' / ' + esc(t.team) : ''),
      size: 'sm',
      body: `
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">${m?.label} — เป้าหมาย ${m?.fmt(t.target)}</div>
        <div class="input-group"><label class="input-label">ผลจริงล่าสุด</label><input type="number" class="input" id="ua-actual" value="${t.actual}"></div>
      `,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const actual = +document.getElementById('ua-actual')?.value || 0
        try {
          await updateDocData('team_targets', t.id, { actual })
          showToast('✅ อัปเดตผลจริงแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
