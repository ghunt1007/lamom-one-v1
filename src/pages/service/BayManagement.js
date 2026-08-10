/**
 * Bay Management — บริหารช่องซ่อม ไม่ให้งานล้น
 * Route: /service/bay
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { watchDocs, createDoc, setDocData, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS = {
  free:     { label: 'ว่าง',       color: 'var(--success)' },
  busy:     { label: 'กำลังซ่อม',  color: 'var(--primary)' },
  waiting:  { label: 'รออะไหล่',   color: 'var(--warning)' },
  cleaning: { label: 'ทำความสะอาด', color: 'var(--text-muted)' },
}

export default async function BayManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let BAYS = []
  let QUEUE = []
  let baysReady = false, queueReady = false
  let loading = true

  // เดิมใช้ listDocs (โหลดครั้งเดียว) ทั้งที่หน้านี้เป็นหน้าที่ช่างหลายคนเปิดดูพร้อมกันจากหลายเครื่องเพื่อดูว่า
  // ช่องไหนว่าง — ถ้าช่างคนหนึ่งอัปเดตสถานะช่อง/จ่ายงานจากเครื่องตัวเอง เครื่องอื่นจะไม่เห็นการเปลี่ยนแปลงเลย
  // จนกว่าจะมีคนไปกดอะไรสักอย่างให้ re-render เปลี่ยนเป็น watchDocs ให้ทุกเครื่องเห็นสถานะช่องซ่อมสดตรงกัน
  const unsubBays = watchDocs('service_bays', [], 'id', 'asc', 200, rows => {
    if (container.__routerGen !== myGen) { unsubBays(); return }
    BAYS = rows.filter(b => !b.deleted); baysReady = true
    loading = !(baysReady && queueReady)
    render()
  })
  const unsubQueue = watchDocs('service_bay_queue', [], 'job', 'asc', 200, rows => {
    if (container.__routerGen !== myGen) { unsubQueue(); return }
    QUEUE = rows.filter(q => !q.deleted); queueReady = true
    loading = !(baysReady && queueReady)
    render()
  })

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const free = BAYS.filter(b => b.status === 'free').length
    const busy = BAYS.filter(b => b.status === 'busy').length
    const util = BAYS.length ? Math.round(busy / BAYS.length * 100) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏗 Bay Management</div>
            <div class="page-subtitle">บริหารช่องซ่อม ${BAYS.length} ช่อง · จัดคิวงานไม่ให้ล้น</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="add-bay-btn">➕ เพิ่มช่องซ่อม</button>
            <button class="btn btn-secondary" id="add-queue-btn">➕ เพิ่มงานเข้าคิว</button>
            <button class="btn btn-primary" id="assign-btn" ${free===0||QUEUE.length===0?'disabled':''}>➕ จ่ายงานเข้าช่อง</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${statCard('🟢 ว่าง', free, 'var(--success)')}
          ${statCard('🔵 กำลังซ่อม', busy, 'var(--primary)')}
          ${statCard('⏳ คิวรอ', QUEUE.length, 'var(--warning)')}
          ${statCard('📊 Utilization', util + '%', util > 80 ? 'var(--danger)' : 'var(--primary)')}
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🏗 ผังช่องซ่อม</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
              ${BAYS.map(b => bayCard(b)).join('')}
            </div>
          </div>
          <div class="card" style="padding:14px;height:fit-content">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⏳ คิวรอเข้าช่อง (${QUEUE.length})</div>
            ${QUEUE.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.8rem">ไม่มีคิวรอ 🎉</div>' :
              QUEUE.map(q => `
                <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 11px;margin-bottom:8px">
                  <div style="display:flex;justify-content:space-between;align-items:start;gap:6px">
                    <div style="font-weight:700;font-size:0.8rem">${escHtml(q.job)} <span style="font-weight:400;color:var(--text-muted)">· ${escHtml(q.need)}</span></div>
                    <button class="btn btn-xs btn-secondary del-queue-btn" data-id="${q.id}" title="ลบออกจากคิว" style="font-size:0.65rem;color:var(--danger);flex-shrink:0">🗑</button>
                  </div>
                  <div style="font-size:0.74rem;color:var(--text-muted)">${escHtml(q.car)}</div>
                  <div style="font-size:0.72rem;color:var(--primary)">${escHtml(q.service)}</div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.bay-card').forEach(c => c.addEventListener('click', () => openBay(c.dataset.id)))
    document.getElementById('assign-btn')?.addEventListener('click', openAssign)
    document.getElementById('add-bay-btn')?.addEventListener('click', openAddBay)
    document.getElementById('add-queue-btn')?.addEventListener('click', openAddQueue)
    container.querySelectorAll('.del-queue-btn').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation()
      const q = QUEUE.find(x => x.id === b.dataset.id)
      if (!q) return
      const ok = await confirmDialog({ title: '🗑 ลบงานออกจากคิว', message: `ยืนยันลบงาน "${escHtml(q.job)}" ออกจากคิวหรือไม่?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('service_bay_queue', q.id)
        showToast('🗑 ลบงานออกจากคิวแล้ว', 'success')
        // ไม่ต้องเรียก reload เอง — watchDocs ด้านบนจะ push ข้อมูลใหม่ + render() ให้อัตโนมัติทันทีที่ Firestore อัปเดต
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
  }

  // เดิม 'service_bays' และ 'service_bay_queue' อ่าน/แก้ไขสถานะได้เท่านั้น ไม่มีทางเพิ่มช่องซ่อมใหม่หรือเพิ่ม
  // งานเข้าคิวเลยจากในแอป (ต้องเข้า Firestore console ตรงหรือรอ seed data เก่า) ทำให้หน้านี้ใช้งานจริงไม่ได้เลย
  // ถ้าไม่มีข้อมูลมาก่อน — เพิ่มฟอร์มให้ทั้งสองอย่าง
  function openAddBay() {
    openModal({
      title: '➕ เพิ่มช่องซ่อม',
      size: 'sm',
      body: `
        <div class="input-group" style="margin-bottom:10px">
          <label class="input-label">ชื่อ/รหัสช่อง *</label>
          <input class="input" id="nb-id" placeholder="เช่น A1, ช่อง6">
        </div>
        <div class="input-group">
          <label class="input-label">ประเภทช่อง</label>
          <input class="input" id="nb-type" placeholder="เช่น ช่องเปลี่ยนน้ำมันเครื่อง">
        </div>`,
      confirmText: '➕ เพิ่ม',
      async onConfirm() {
        const bayId = document.getElementById('nb-id')?.value?.trim()
        if (!bayId) { showToast('❗ กรุณากรอกชื่อ/รหัสช่อง', 'error'); return false }
        if (BAYS.some(b => b.id === bayId)) { showToast('❗ มีช่องนี้อยู่แล้ว', 'error'); return false }
        const type = document.getElementById('nb-type')?.value?.trim() || 'ทั่วไป'
        try {
          // ใช้ setDocData (ไม่ใช่ createDoc) เพราะ query ของหน้านี้ทำ orderBy('id','asc') บน field 'id' จริง
          // (ไม่ใช่ doc key อัตโนมัติ) — ต้องกำหนด id เองให้ตรงกับ doc key เพื่อให้ query เจอเอกสารนี้
          await setDocData('service_bays', bayId, { id: bayId, type, status: 'free', job: '', car: '', tech: '', etaMin: 0 })
          showToast(`✅ เพิ่มช่อง ${bayId} แล้ว`, 'success')
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openAddQueue() {
    openModal({
      title: '➕ เพิ่มงานเข้าคิว',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่องาน *</label><input class="input" id="nq-job" placeholder="เช่น เปลี่ยนยาง"></div>
        <div class="input-group"><label class="input-label">รถ *</label><input class="input" id="nq-car" placeholder="ทะเบียน / รุ่นรถ"></div>
        <div class="input-group"><label class="input-label">ประเภทบริการ</label><input class="input" id="nq-service" placeholder="เช่น ซ่อมทั่วไป"></div>
        <div class="input-group"><label class="input-label">สิ่งที่ต้องใช้/รอ</label><input class="input" id="nq-need" placeholder="เช่น รออะไหล่"></div>
      </div>`,
      confirmText: '➕ เพิ่ม',
      async onConfirm() {
        const job = document.getElementById('nq-job')?.value?.trim()
        const car = document.getElementById('nq-car')?.value?.trim()
        if (!job || !car) { showToast('❗ กรุณากรอกชื่องานและรถ', 'error'); return false }
        try {
          await createDoc('service_bay_queue', {
            job, car,
            service: document.getElementById('nq-service')?.value?.trim() || '',
            need: document.getElementById('nq-need')?.value?.trim() || '',
          })
          showToast(`✅ เพิ่ม "${job}" เข้าคิวแล้ว`, 'success')
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function bayCard(b) {
    const s = STATUS[b.status]
    return `
      <div class="bay-card" data-id="${escHtml(b.id)}" style="border:2px solid ${s.color};border-radius:var(--radius-sm);padding:11px;cursor:pointer;background:var(--surface)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:0.95rem">${escHtml(b.id)}</strong>
          <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:1px 7px;border-radius:10px">${s.label}</span>
        </div>
        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">${escHtml(b.type)}</div>
        ${b.job ? `
          <div style="margin-top:7px;font-size:0.74rem">
            <div style="font-weight:600">${escHtml(b.job)}</div>
            <div style="color:var(--text-muted)">${escHtml(b.car)}</div>
            <div style="color:var(--text-muted)">👷 ${escHtml(b.tech)}${b.etaMin?` · เหลือ ~${b.etaMin} น.`:''}</div>
          </div>` : '<div style="margin-top:7px;font-size:0.74rem;color:var(--success)">พร้อมรับงาน</div>'}
      </div>`
  }

  function openBay(id) {
    const b = BAYS.find(x => x.id === id)
    if (!b) return
    const { el, close } = openModal({
      title: `🏗 ช่อง ${escHtml(b.id)} · ${escHtml(b.type)}`,
      size: 'sm',
      body: `
        <div class="input-group" style="margin-bottom:10px">
          <label class="input-label">สถานะ</label>
          <select class="input" id="bm-status">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${b.status===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
        ${b.job ? `<div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);font-size:0.78rem">
          <div>งาน: <strong>${escHtml(b.job)}</strong></div>
          <div>รถ: ${escHtml(b.car)}</div>
          <div>ช่าง: ${escHtml(b.tech)}</div>
        </div>` : '<div style="color:var(--text-muted);font-size:0.8rem">ช่องนี้ว่าง</div>'}
        <div style="margin-top:12px;text-align:right"><button class="btn btn-xs btn-secondary" id="bm-del" style="color:var(--danger)">🗑 ลบช่องนี้</button></div>`,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const ns = document.getElementById('bm-status').value
        const patch = { status: ns }
        if (ns === 'free') { patch.job = ''; patch.car = ''; patch.tech = ''; patch.etaMin = 0 }
        try {
          await updateDocData('service_bays', b.id, patch)
          showToast(`อัปเดตช่อง ${b.id} → ${STATUS[ns].label}`, 'success')
          // ไม่ต้องเรียก reload เอง — watchDocs ด้านบนจะ push ข้อมูลใหม่ + render() ให้อัตโนมัติทันทีที่ Firestore อัปเดต
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    // ปุ่มลบแยกจาก footer ปกติของ openModal (ไม่ใช้ onConfirm เพราะการลบไม่ควรผูกกับปุ่ม "บันทึก" สถานะ)
    el.querySelector('#bm-del')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: '🗑 ลบช่องซ่อม', message: `ยืนยันลบช่อง "${escHtml(b.id)}" ออกจากระบบหรือไม่?${b.job ? ' ⚠️ ช่องนี้มีงานอยู่ระหว่างซ่อม' : ''}`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('service_bays', b.id)
        showToast('🗑 ลบช่องซ่อมแล้ว', 'success')
        close()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    })
  }

  function openAssign() {
    openModal({
      title: '➕ จ่ายงานเข้าช่องซ่อม',
      size: 'sm',
      body: `
        <div class="input-group" style="margin-bottom:10px">
          <label class="input-label">งานในคิว</label>
          <select class="input" id="bm-job">${QUEUE.map((q, i) => `<option value="${i}">${escHtml(q.job)} · ${escHtml(q.car)} (${escHtml(q.need)})</option>`).join('')}</select>
        </div>
        <div class="input-group" style="margin-bottom:10px">
          <label class="input-label">ช่องว่าง</label>
          <select class="input" id="bm-bay">${BAYS.filter(b => b.status==='free').map(b => `<option value="${escHtml(b.id)}">${escHtml(b.id)} · ${escHtml(b.type)}</option>`).join('')}</select>
        </div>
        <div class="input-group">
          <label class="input-label">ช่างผู้รับผิดชอบ</label>
          <input class="input" id="bm-tech" placeholder="ชื่อช่าง">
        </div>`,
      confirmText: '✅ จ่ายงาน',
      async onConfirm() {
        const qi = parseInt(document.getElementById('bm-job').value)
        const bid = document.getElementById('bm-bay').value
        const tech = document.getElementById('bm-tech').value.trim()
        if (!tech) { showToast('❗ ระบุชื่อช่าง', 'error'); return false }
        const q = QUEUE[qi]; const b = BAYS.find(x => x.id === bid)
        if (!q || !b) { showToast('❗ ไม่พบข้อมูลงานหรือช่อง', 'error'); return false }
        try {
          await updateDocData('service_bays', b.id, { status: 'busy', job: q.job, car: q.car, tech, etaMin: 60 })
          await softDelete('service_bay_queue', q.id)
          showToast(`จ่าย ${q.job} เข้าช่อง ${bid} (${tech}) แล้ว`, 'success')
          // ไม่ต้องเรียก reload เอง — watchDocs ด้านบนจะ push ข้อมูลใหม่ + render() ให้อัตโนมัติทันทีที่ Firestore อัปเดต
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function statCard(label, value, color) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${label}</div>
      <div style="font-size:1.5rem;font-weight:900;color:${color};margin-top:2px">${value}</div>
    </div>`
  }

  render() // แสดง skeleton "กำลังโหลด..." ทันทีระหว่างรอ snapshot แรกจาก watchDocs (bays + queue)

  return function cleanupBayManagement() { unsubBays(); unsubQueue() }
}
