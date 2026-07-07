/**
 * Waiting Lounge — จัดการลูกค้านั่งรอ + จอแสดงคิว
 * Route: /service/lounge
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const JOB_STAGES = {
  received:   { label: 'รับรถแล้ว', pct: 10, icon: '📥' },
  diagnosing: { label: 'กำลังตรวจ', pct: 30, icon: '🔍' },
  working:    { label: 'กำลังซ่อม', pct: 60, icon: '🔧' },
  qc:         { label: 'ตรวจ QC', pct: 85, icon: '✔️' },
  washing:    { label: 'ล้างรถ', pct: 95, icon: '🚿' },
  ready:      { label: 'พร้อมรับรถ!', pct: 100, icon: '🎉' },
}

const STAGE_ORDER = ['received', 'diagnosing', 'working', 'qc', 'washing', 'ready']

export default async function WaitingLoungePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let queue = []
  let loading = true

  async function loadData() {
    loading = true
    try { queue = await listDocs('waiting_lounge_queue', [], 'checkin', 'asc', 500) } catch (e) { queue = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const waiting = queue.filter(q => q.stage !== 'ready').length
    const ready = queue.filter(q => q.stage === 'ready' && !q.notified).length
    const avgWait = Math.round(queue.reduce((a, q) => a + (Date.now() - new Date(q.checkin)) / 60000, 0) / queue.length)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛋 Waiting Lounge</div>
            <div class="page-subtitle">ลูกค้านั่งรอ — แจ้งสถานะแบบ real-time (เหมือนจอสนามบิน)</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="tv-btn">📺 เปิดจอแสดงคิว</button>
            <button class="btn btn-primary" id="checkin-btn">+ Check-in ลูกค้า</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🛋 นั่งรออยู่', waiting + ' คน', 'primary')}
          ${kpi('🎉 พร้อมรับรถ (ยังไม่แจ้ง)', ready, ready > 0 ? 'danger' : 'success')}
          ${kpi('⏱ รอเฉลี่ย', avgWait + ' นาที', avgWait > 90 ? 'warning' : 'success')}
          ${kpi('☕ เครื่องดื่มเสิร์ฟ', queue.reduce((a,q)=>a+q.drinks,0) + ' แก้ว', 'secondary')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${queue.map(q => {
            const st = JOB_STAGES[q.stage]
            const waitMins = Math.round((Date.now() - new Date(q.checkin)) / 60000)
            const overdue = waitMins > q.estMins && q.stage !== 'ready'
            const stageIdx = STAGE_ORDER.indexOf(q.stage)
            const next = STAGE_ORDER[stageIdx + 1]
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${q.stage==='ready'?'success':overdue?'danger':'primary'})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(q.plate)} — ${escHtml(q.customer)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🔧 ${escHtml(q.service)} · รอมา ${waitMins} นาที (ประเมิน ${q.estMins})${overdue?' <span style="color:var(--danger)">⚠️ เกินเวลา</span>':''}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${q.stage==='ready'?'success':'primary'}" style="font-size:0.65rem">${st?.icon} ${st?.label}</span>
                  ${q.notified ? '<span style="font-size:0.62rem;color:var(--success)">📱 แจ้งลูกค้าแล้ว</span>' : ''}
                </div>
              </div>

              <!-- Progress -->
              <div style="display:flex;align-items:center;gap:4px;margin-bottom:10px">
                ${STAGE_ORDER.map((s, i) => {
                  const done = i <= stageIdx
                  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="${JOB_STAGES[s].label}">
                    <div style="width:100%;height:6px;border-radius:3px;background:${done?'var(--success)':'var(--surface-2)'}"></div>
                    <span style="font-size:0.55rem;color:var(--${done?'success':'text-muted'})">${JOB_STAGES[s].icon}</span>
                  </div>`
                }).join('')}
              </div>

              <div style="display:flex;gap:6px">
                ${next ? `<button class="btn btn-xs btn-primary next-btn" data-id="${q.id}">${JOB_STAGES[next].icon} → ${JOB_STAGES[next].label}</button>` : ''}
                ${q.stage === 'ready' && !q.notified ? `<button class="btn btn-xs btn-success notify-btn" data-id="${q.id}">📱 แจ้งลูกค้า + ประกาศจอ</button>` : ''}
                ${q.stage === 'ready' && q.notified ? `<button class="btn btn-xs btn-secondary done-btn" data-id="${q.id}">🏁 รับรถแล้ว (ปิดคิว)</button>` : ''}
                <button class="btn btn-xs btn-secondary drink-btn" data-id="${q.id}">☕ +เครื่องดื่ม</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', async () => {
      const q = queue.find(x => x.id === b.dataset.id)
      if (!q) return
      const stage = STAGE_ORDER[STAGE_ORDER.indexOf(q.stage) + 1]
      try {
        await updateDocData('waiting_lounge_queue', q.id, { stage })
        if (stage === 'ready') showToast('🎉 งานเสร็จ — อย่าลืมแจ้งลูกค้า!', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.notify-btn').forEach(b => b.addEventListener('click', async () => {
      const q = queue.find(x => x.id === b.dataset.id)
      if (!q) return
      try {
        await updateDocData('waiting_lounge_queue', q.id, { notified: true })
        showToast(`📱 แจ้ง ${q.customer} + ขึ้นจอ "${q.plate} พร้อมรับรถ"`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.done-btn').forEach(b => b.addEventListener('click', async () => {
      try {
        await softDelete('waiting_lounge_queue', b.dataset.id)
        showToast('🏁 ปิดคิวแล้ว', 'primary')
        await loadData()
      } catch (e) { showToast('ปิดคิวไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.drink-btn').forEach(b => b.addEventListener('click', async () => {
      const q = queue.find(x => x.id === b.dataset.id)
      if (!q) return
      try {
        await updateDocData('waiting_lounge_queue', q.id, { drinks: q.drinks + 1 })
        showToast('☕ เสิร์ฟเครื่องดื่มแล้ว', 'secondary')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('tv-btn')?.addEventListener('click', () => {
      openModal({
        title: '📺 จอแสดงคิว (Lounge TV)',
        size: 'md',
        body: `<div style="background:#0a0a14;border-radius:8px;padding:20px;font-family:monospace">
          <div style="text-align:center;color:#fbbf24;font-size:0.9rem;font-weight:900;margin-bottom:14px">🚗 LAMOM SERVICE — สถานะรถของท่าน</div>
          ${queue.map(q => {
            const st = JOB_STAGES[q.stage]
            return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f2937;font-size:0.85rem">
              <span style="color:white;font-weight:700">${escHtml(q.plate)}</span>
              <span style="color:${q.stage==='ready'?'#10b981':'#60a5fa'};font-weight:700">${st?.icon} ${st?.label}${q.stage==='ready'?' — เชิญที่เคาน์เตอร์':''}</span>
            </div>`
          }).join('')}
        </div>`,
        onConfirm() {}
      })
    })
    document.getElementById('checkin-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ Check-in ลูกค้านั่งรอ',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ทะเบียน *</label><input class="input" id="lg-plate"></div>
          <div class="input-group"><label class="input-label">ชื่อลูกค้า</label><input class="input" id="lg-name"></div>
          <div class="input-group"><label class="input-label">งานบริการ</label><input class="input" id="lg-service"></div>
          <div class="input-group"><label class="input-label">เวลาประเมิน (นาที)</label><input class="input" type="number" id="lg-est" value="60"></div>
        </div>`,
        async onConfirm() {
          const plate = document.getElementById('lg-plate')?.value?.trim()
          if (!plate) { showToast('❗ กรอกทะเบียน', 'error'); return false }
          try {
            await createDoc('waiting_lounge_queue', { customer:document.getElementById('lg-name')?.value||'—', plate, service:document.getElementById('lg-service')?.value||'—', stage:'received', checkin:new Date().toISOString(), estMins:parseInt(document.getElementById('lg-est')?.value)||60, drinks:0, notified:false })
            showToast('✅ Check-in แล้ว — เชิญนั่งรอ เสิร์ฟเครื่องดื่ม', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
