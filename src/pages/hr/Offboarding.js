/**
 * Offboarding — พนักงานลาออก (Checklist)
 * Route: /hr/offboarding
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

// ป้องกัน XSS — เหตุผลลาออก (reason) เป็นข้อความที่ผู้ใช้พิมพ์เอง ต้อง escape ก่อนแสดงผลเสมอ
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const OFFBOARD_TASKS = [
  { id: 'T01', cat: '📄 เอกสาร', task: 'รับใบลาออก + อนุมัติ' },
  { id: 'T02', cat: '📄 เอกสาร', task: 'เคลียร์เงินเดือน/OT/คอมค้างจ่าย' },
  { id: 'T03', cat: '📄 เอกสาร', task: 'ออกหนังสือรับรองการทำงาน' },
  { id: 'T04', cat: '🔑 ทรัพย์สิน', task: 'คืนกุญแจ/บัตรพนักงาน' },
  { id: 'T05', cat: '🔑 ทรัพย์สิน', task: 'คืนคอมพิวเตอร์/โทรศัพท์บริษัท' },
  { id: 'T06', cat: '🔑 ทรัพย์สิน', task: 'คืนยูนิฟอร์ม' },
  { id: 'T07', cat: '💻 ระบบ', task: 'ปิด account LAMOM ONE + อีเมล' },
  { id: 'T08', cat: '💻 ระบบ', task: 'ถอดสิทธิ์ LINE OA / Social ทุกช่องทาง' },
  { id: 'T09', cat: '🤝 ส่งมอบงาน', task: 'โอนลูกค้า/ดีลค้างให้ผู้รับช่วง' },
  { id: 'T10', cat: '🤝 ส่งมอบงาน', task: 'Exit interview — เก็บ feedback' },
]

export default async function OffboardingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let list = []
  let selected = null
  let loading = true

  async function loadData() {
    loading = true
    try { list = await listDocs('offboarding_staff', [], 'lastDay', 'desc', 200) } catch (e) { list = [] }
    if (!selected || !list.find(x => x.id === selected)) selected = list[0]?.id
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const o = list.find(x => x.id === selected) || list[0]
    const done = o ? Object.values(o.tasks||{}).filter(Boolean).length : 0
    const total = OFFBOARD_TASKS.length
    const pct = total ? Math.round(done / total * 100) : 0
    const cats = [...new Set(OFFBOARD_TASKS.map(t => t.cat))]
    const active = list.filter(x => Object.values(x.tasks||{}).some(v => !v)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👋 Offboarding</div>
            <div class="page-subtitle">พนักงานลาออก — เคลียร์ครบ จบสวย</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-ob-btn">+ บันทึกลาออก</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('👋 กำลังดำเนินการ', active, active > 0 ? 'warning' : 'success')}
          ${kpi('📊 Turnover ปีนี้', '3 คน (18%)', 'secondary')}
          ${kpi('✅ เสร็จสมบูรณ์', list.length - active, 'success')}
        </div>

        <div style="display:grid;grid-template-columns:230px 1fr;gap:14px">
          <!-- Staff tabs -->
          <div style="display:flex;flex-direction:column;gap:6px">
            ${list.map(x => {
              const xDone = Object.values(x.tasks||{}).filter(Boolean).length
              const xPct = total ? Math.round(xDone / total * 100) : 0
              return `<div class="card ob-tab" data-id="${x.id}" style="padding:10px 12px;cursor:pointer;border:2px solid ${x.id===selected?'var(--primary)':'transparent'}">
                <div style="font-weight:600;font-size:0.82rem">${esc(x.name)}</div>
                <div style="font-size:0.66rem;color:var(--text-muted)">${esc(x.role)} · วันสุดท้าย ${formatDate(x.lastDay)}</div>
                <div style="margin-top:5px;background:var(--surface-2);border-radius:3px;height:5px">
                  <div style="width:${xPct}%;background:var(--${xPct===100?'success':'warning'});height:5px;border-radius:3px"></div>
                </div>
              </div>`
            }).join('')}
            ${!list.length ? `<div style="color:var(--text-muted);font-size:0.8rem;padding:10px">ยังไม่มีรายการ</div>` : ''}
          </div>

          <!-- Checklist -->
          ${o ? `<div class="card" style="padding:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <div>
                <div style="font-weight:700;font-size:1rem">${o.name}</div>
                <div style="font-size:0.73rem;color:var(--text-muted)">${esc(o.role)} · ${esc(o.dept)} · วันสุดท้าย ${formatDate(o.lastDay)}</div>
                <div style="font-size:0.73rem;color:var(--text-muted)">📌 เหตุผล: ${esc(o.reason)} · 🤝 ผู้รับช่วง: ${esc(o.successor)}</div>
              </div>
              <div style="font-size:1.5rem;font-weight:900;color:var(--${pct===100?'success':'warning'})">${pct}%</div>
            </div>
            ${cats.map(cat => `
              <div style="margin-bottom:10px">
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">${cat}</div>
                ${OFFBOARD_TASKS.filter(t => t.cat === cat).map(t => `
                  <label style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);cursor:pointer;font-size:0.8rem">
                    <input type="checkbox" class="ob-check" data-oid="${o.id}" data-t="${t.id}" ${o.tasks?.[t.id]?'checked':''} style="accent-color:var(--primary)">
                    <span style="${o.tasks?.[t.id]?'text-decoration:line-through;color:var(--text-muted)':''}">${t.task}</span>
                  </label>
                `).join('')}
              </div>
            `).join('')}
            ${pct === 100 ? '<div style="padding:10px;background:var(--success)11;border-radius:var(--radius-sm);font-size:0.78rem;color:var(--success);text-align:center">✅ Offboarding ครบถ้วน — ปิดเคสได้</div>' : ''}
          </div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.ob-tab').forEach(b => b.addEventListener('click', () => { selected = b.dataset.id; renderPage() }))
    container.querySelectorAll('.ob-check').forEach(cb => cb.addEventListener('change', async () => {
      const x = list.find(z => z.id === cb.dataset.oid)
      if (!x) return
      const tasks = { ...(x.tasks||{}), [cb.dataset.t]: cb.checked }
      await updateDocData('offboarding_staff', x.id, { tasks })
      await loadData()
    }))
    document.getElementById('add-ob-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ บันทึกพนักงานลาออก',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อพนักงาน *</label><input class="input" id="ob-name"></div>
          <div class="input-group"><label class="input-label">ตำแหน่ง</label><input class="input" id="ob-role"></div>
          <div class="input-group"><label class="input-label">วันทำงานสุดท้าย</label><input class="input" type="date" id="ob-lastday" value="${addDays(30)}"></div>
          <div class="input-group"><label class="input-label">เหตุผล</label><input class="input" id="ob-reason"></div>
          <div class="input-group"><label class="input-label">ผู้รับช่วงงาน</label><input class="input" id="ob-successor"></div>
        </div>`,
        async onConfirm() {
          const name = document.getElementById('ob-name')?.value?.trim()
          if (!name) { showToast('❗ กรอกชื่อ', 'error'); return false }
          const tasks = {}; OFFBOARD_TASKS.forEach(t => tasks[t.id] = false)
          const newId = await createDoc('offboarding_staff', {
            name, role: document.getElementById('ob-role')?.value||'—', dept: '—',
            lastDay: document.getElementById('ob-lastday')?.value||addDays(30),
            reason: document.getElementById('ob-reason')?.value||'—',
            successor: document.getElementById('ob-successor')?.value||'—', tasks,
          })
          selected = newId
          showToast('👋 เริ่ม Offboarding แล้ว', 'primary'); await loadData()
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
