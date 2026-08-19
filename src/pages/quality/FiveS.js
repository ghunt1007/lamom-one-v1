/**
 * 5S Audit — ตรวจ 5ส ประจำสัปดาห์
 * Route: /quality/5s
 */
import { formatDate, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// เดิม new Date().toISOString() คืนวันที่ตาม UTC เสมอ ผิดไป 1 วันทุกครั้งที่เวลาไทยยังไม่ถึง 07:00 น.
// (บั๊กคลาสเดียวกับที่แก้ใน TestDriveScheduler.js/Attendance.js — ยึดวันที่ไทยจริงจาก todayBangkok() เสมอ)
function addDays(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

const FIVE_S = [
  { key: 's1', label: 'สะสาง', icon: '🗑', desc: 'แยกของจำเป็น/ไม่จำเป็น ทิ้งของไม่ใช้' },
  { key: 's2', label: 'สะดวก', icon: '📐', desc: 'จัดวางเป็นระเบียบ หยิบง่าย มีป้ายชัด' },
  { key: 's3', label: 'สะอาด', icon: '🧹', desc: 'ทำความสะอาด ตรวจหาสิ่งผิดปกติ' },
  { key: 's4', label: 'สุขลักษณะ', icon: '✨', desc: 'รักษามาตรฐาน 3ส แรกต่อเนื่อง' },
  { key: 's5', label: 'สร้างนิสัย', icon: '🔄', desc: 'ทำจนเป็นนิสัย มีวินัยในตนเอง' },
]

function avgScore(scores) { return Math.round(Object.values(scores).reduce((a, v) => a + v, 0) / 5 * 10) / 10 }

export default async function FiveSPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let areas = []
  let loading = true

  async function loadData() {
    loading = true
    try { areas = (await listDocs('five_s_areas', [], 'name', 'asc', 100)).filter(a => !a.deleted) } catch (e) { areas = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const overallAvg = areas.length ? Math.round(areas.reduce((a, x) => a + avgScore(x.scores), 0) / areas.length * 10) / 10 : 0
    const needAttention = areas.filter(a => avgScore(a.scores) < 3.5)
    const overdueAudit = areas.filter(a => a.lastAudit <= addDays(-14))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧹 5S Audit</div>
            <div class="page-subtitle">ตรวจ 5ส — สะสาง สะดวก สะอาด สุขลักษณะ สร้างนิสัย</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-area-btn">➕ เพิ่มพื้นที่ตรวจ</button>
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
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(a.name)}</div>
                  <div style="font-size:0.7rem;color:var(--${isOverdue?'danger':'text-muted'})">👥 ${escHtml(a.owner)} · ตรวจล่าสุด ${formatDate(a.lastAudit)}${isOverdue?' ⚠️ เกินกำหนด':''} · 📷 ${a.photos} รูป</div>
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
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-primary audit-btn" data-id="${a.id}">📋 ตรวจรอบใหม่</button>
                <button class="btn btn-xs btn-ghost del-area-btn" data-id="${a.id}">🗑️ ลบ</button>
              </div>
            </div>`
          }).join('')}
          ${!areas.length ? `<div class="empty-state"><div class="empty-icon">🧹</div><div class="empty-title">ไม่มีพื้นที่ตรวจ</div><div class="empty-desc">กดปุ่ม "➕ เพิ่มพื้นที่ตรวจ" ด้านบนเพื่อเริ่มตั้งพื้นที่แรก</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.audit-btn').forEach(b => b.addEventListener('click', () => {
      const a = areas.find(x => x.id === b.dataset.id)
      if (!a) return
      const scores = { ...a.scores }
      openModal({
        title: '📋 ตรวจ 5ส: ' + escHtml(a.name),
        size: 'md',
        body: `<div style="display:grid;gap:12px">
          ${FIVE_S.map(s => `
            <div>
              <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px">${s.icon} ${s.label} <span style="font-size:0.65rem;color:var(--text-muted)">— ${s.desc}</span></div>
              <div style="display:flex;gap:4px">
                ${[1,2,3,4,5].map(n => `<button class="btn btn-xs score-pick ${scores[s.key]===n?'btn-primary':'btn-secondary'}" data-s="${s.key}" data-n="${n}" style="flex:1">${n}</button>`).join('')}
              </div>
            </div>
          `).join('')}
          <div class="input-group"><label class="input-label">หมายเหตุ/จุดที่ต้องแก้</label><input class="input" id="fs-note"></div>
        </div>`,
        confirmText: '💾 บันทึกผลตรวจ',
        async onConfirm() {
          const note = document.getElementById('fs-note')?.value.trim() || ''
          try {
            await updateDocData('five_s_areas', a.id, { scores, note, lastAudit: addDays(0), photos: (a.photos||0) + 2 })
            showToast(`✅ บันทึกผลตรวจ ${a.name} แล้ว — คะแนน ${avgScore(scores)}/5`, 'success'); await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
      // wire score buttons after modal renders
      setTimeout(() => {
        document.querySelectorAll('.score-pick').forEach(sb => sb.addEventListener('click', () => {
          scores[sb.dataset.s] = parseInt(sb.dataset.n)
          document.querySelectorAll(`.score-pick[data-s="${sb.dataset.s}"]`).forEach(x => x.classList.replace('btn-primary','btn-secondary'))
          sb.classList.replace('btn-secondary','btn-primary')
        }))
      }, 100)
    }))
    container.querySelectorAll('.del-area-btn').forEach(b => b.addEventListener('click', () => {
      deleteArea(areas.find(x => x.id === b.dataset.id))
    }))
    document.getElementById('add-area-btn')?.addEventListener('click', openAddForm)
  }

  async function deleteArea(a) {
    if (!a) return
    const ok = await confirmDialog({ title: '🗑️ ลบพื้นที่ตรวจ', message: `ยืนยันลบพื้นที่ "${escHtml(a.name)}"? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบถาวร', danger: true })
    if (!ok) return
    await softDelete('five_s_areas', a.id)
    showToast('🗑️ ลบพื้นที่ตรวจแล้ว', 'success')
    await loadData()
  }

  function openAddForm() {
    const { el, close } = openModal({
      title: '➕ เพิ่มพื้นที่ตรวจ 5ส', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อพื้นที่ *</label><input class="input" id="fa-name" placeholder="เช่น โชว์รูมหลัก, ห้อง PDI, คลังอะไหล่"><span class="input-error" id="fa-name-e"></span></div>
        <div class="input-group"><label class="input-label">ผู้รับผิดชอบ</label><input class="input" id="fa-owner"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="fac">ยกเลิก</button><button class="btn btn-primary" id="fas">💾 บันทึก</button>`
    })
    el.querySelector('#fac').addEventListener('click', close)
    el.querySelector('#fas').addEventListener('click', async () => {
      const name = el.querySelector('#fa-name').value.trim()
      if (!name) { el.querySelector('#fa-name-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#fas'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        await createDoc('five_s_areas', {
          name, owner: el.querySelector('#fa-owner').value.trim() || '-',
          scores: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 },
          lastAudit: addDays(0), photos: 0,
        })
        showToast('✅ เพิ่มพื้นที่ตรวจแล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
