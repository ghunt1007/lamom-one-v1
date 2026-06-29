/**
 * 5S Audit — ตรวจ 5ส ประจำสัปดาห์
 * Route: /quality/5s
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const FIVE_S = [
  { key: 's1', label: 'สะสาง', icon: '🗑', desc: 'แยกของจำเป็น/ไม่จำเป็น ทิ้งของไม่ใช้' },
  { key: 's2', label: 'สะดวก', icon: '📐', desc: 'จัดวางเป็นระเบียบ หยิบง่าย มีป้ายชัด' },
  { key: 's3', label: 'สะอาด', icon: '🧹', desc: 'ทำความสะอาด ตรวจหาสิ่งผิดปกติ' },
  { key: 's4', label: 'สุขลักษณะ', icon: '✨', desc: 'รักษามาตรฐาน 3ส แรกต่อเนื่อง' },
  { key: 's5', label: 'สร้างนิสัย', icon: '🔄', desc: 'ทำจนเป็นนิสัย มีวินัยในตนเอง' },
]

const AREAS = [
  { id: 'A1', name: 'โชว์รูม', owner: 'ทีมขาย', scores: { s1: 5, s2: 4, s3: 5, s4: 4, s5: 4 }, lastAudit: addDays(-3), photos: 4 },
  { id: 'A2', name: 'ศูนย์บริการ (Bay 1-4)', owner: 'ทีมช่าง', scores: { s1: 4, s2: 3, s3: 3, s4: 3, s5: 4 }, lastAudit: addDays(-3), photos: 6 },
  { id: 'A3', name: 'คลังอะไหล่', owner: 'ฝ่ายอะไหล่', scores: { s1: 3, s2: 3, s3: 4, s4: 3, s5: 3 }, lastAudit: addDays(-10), photos: 3 },
  { id: 'A4', name: 'ห้องรับรองลูกค้า', owner: 'แอดมิน', scores: { s1: 5, s2: 5, s3: 5, s4: 5, s5: 4 }, lastAudit: addDays(-3), photos: 2 },
  { id: 'A5', name: 'ออฟฟิศหลังบ้าน', owner: 'ทุกฝ่าย', scores: { s1: 2, s2: 3, s3: 3, s4: 2, s5: 3 }, lastAudit: addDays(-17), photos: 0 },
]

function avgScore(scores) { return Math.round(Object.values(scores).reduce((a, v) => a + v, 0) / 5 * 10) / 10 }

export default async function FiveSPage(container) {
  let areas = AREAS.map(a => ({ ...a, scores: { ...a.scores } }))

  function renderPage() {
    const overallAvg = Math.round(areas.reduce((a, x) => a + avgScore(x.scores), 0) / areas.length * 10) / 10
    const needAttention = areas.filter(a => avgScore(a.scores) < 3.5)
    const overdueAudit = areas.filter(a => a.lastAudit <= addDays(-14))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧹 5S Audit</div>
            <div class="page-subtitle">ตรวจ 5ส — สะสาง สะดวก สะอาด สุขลักษณะ สร้างนิสัย</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('📊 คะแนนเฉลี่ยรวม', overallAvg + '/5', overallAvg >= 4 ? 'success' : overallAvg >= 3 ? 'warning' : 'danger')}
          ${kpi('⚠️ ต้องปรับปรุง', needAttention.length + ' พื้นที่', needAttention.length > 0 ? 'danger' : 'success')}
          ${kpi('📅 ไม่ได้ตรวจ 14+ วัน', overdueAudit.length, overdueAudit.length > 0 ? 'warning' : 'success')}
        </div>

        <!-- 5S legend -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
            ${FIVE_S.map(s => `
              <div style="text-align:center">
                <div style="font-size:1.2rem">${s.icon}</div>
                <div style="font-weight:700;font-size:0.75rem">${s.label}</div>
                <div style="font-size:0.6rem;color:var(--text-muted)">${s.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Areas -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${areas.map(a => {
            const avg = avgScore(a.scores)
            const color = avg >= 4 ? 'success' : avg >= 3 ? 'warning' : 'danger'
            const isOverdue = a.lastAudit <= addDays(-14)
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${a.name}</div>
                  <div style="font-size:0.7rem;color:var(--${isOverdue?'danger':'text-muted'})">👥 ${a.owner} · ตรวจล่าสุด ${formatDate(a.lastAudit)}${isOverdue?' ⚠️ เกินกำหนด':''} · 📷 ${a.photos} รูป</div>
                </div>
                <div style="font-size:1.3rem;font-weight:900;color:var(--${color})">${avg}</div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px">
                ${FIVE_S.map(s => {
                  const sc = a.scores[s.key]
                  const scColor = sc >= 4 ? 'success' : sc >= 3 ? 'warning' : 'danger'
                  return `<div style="text-align:center;background:var(--surface-2);padding:6px;border-radius:var(--radius-sm)">
                    <div style="font-size:0.62rem;color:var(--text-muted)">${s.icon} ${s.label}</div>
                    <div style="font-weight:900;font-size:0.9rem;color:var(--${scColor})">${sc}</div>
                  </div>`
                }).join('')}
              </div>
              <button class="btn btn-xs btn-primary audit-btn" data-id="${a.id}">📋 ตรวจรอบใหม่</button>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.audit-btn').forEach(b => b.addEventListener('click', () => {
      const a = areas.find(x => x.id === b.dataset.id)
      if (a) openModal({
        title: '📋 ตรวจ 5ส: ' + a.name,
        size: 'md',
        body: `<div style="display:grid;gap:12px">
          ${FIVE_S.map(s => `
            <div>
              <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px">${s.icon} ${s.label} <span style="font-size:0.65rem;color:var(--text-muted)">— ${s.desc}</span></div>
              <div style="display:flex;gap:4px">
                ${[1,2,3,4,5].map(n => `<button class="btn btn-xs score-pick ${a.scores[s.key]===n?'btn-primary':'btn-secondary'}" data-s="${s.key}" data-n="${n}" style="flex:1">${n}</button>`).join('')}
              </div>
            </div>
          `).join('')}
          <div class="input-group"><label class="input-label">หมายเหตุ/จุดที่ต้องแก้</label><input class="input" id="fs-note"></div>
        </div>`,
        confirmText: '💾 บันทึกผลตรวจ',
        onConfirm() {
          a.lastAudit = addDays(0); a.photos += 2
          showToast(`✅ บันทึกผลตรวจ ${a.name} แล้ว — คะแนน ${avgScore(a.scores)}/5`, 'success'); renderPage()
        }
      })
      // wire score buttons after modal renders
      setTimeout(() => {
        document.querySelectorAll('.score-pick').forEach(sb => sb.addEventListener('click', () => {
          a.scores[sb.dataset.s] = parseInt(sb.dataset.n)
          document.querySelectorAll(`.score-pick[data-s="${sb.dataset.s}"]`).forEach(x => x.classList.replace('btn-primary','btn-secondary'))
          sb.classList.replace('btn-secondary','btn-primary')
        }))
      }, 100)
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
