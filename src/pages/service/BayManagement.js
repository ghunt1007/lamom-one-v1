/**
 * Bay Management — บริหารช่องซ่อม ไม่ให้งานล้น
 * Route: /service/bay
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS = {
  free:     { label: 'ว่าง',       color: 'var(--success)' },
  busy:     { label: 'กำลังซ่อม',  color: 'var(--primary)' },
  waiting:  { label: 'รออะไหล่',   color: 'var(--warning)' },
  cleaning: { label: 'ทำความสะอาด', color: 'var(--text-muted)' },
}

let BAYS = [
  { id: 'B1', type: 'ทั่วไป',   status: 'busy',     job: 'JC-2401', car: 'BYD Atto 3 · กข-1234', tech: 'สมชาย', etaMin: 45 },
  { id: 'B2', type: 'ทั่วไป',   status: 'busy',     job: 'JC-2398', car: 'MG ZS · 1กก-5678',     tech: 'วิชัย',  etaMin: 90 },
  { id: 'B3', type: 'ทั่วไป',   status: 'free',     job: '', car: '', tech: '', etaMin: 0 },
  { id: 'B4', type: 'ช่วงล่าง', status: 'waiting',  job: 'JC-2390', car: 'BYD Seal · ขข-9999',   tech: 'ประเสริฐ', etaMin: 0 },
  { id: 'B5', type: 'ช่วงล่าง', status: 'free',     job: '', car: '', tech: '', etaMin: 0 },
  { id: 'B6', type: 'BP/สี',    status: 'busy',     job: 'BP-1102', car: 'BYD Dolphin · 2กข-3456', tech: 'อนุชา',  etaMin: 240 },
  { id: 'B7', type: 'BP/สี',    status: 'cleaning', job: '', car: '', tech: 'ทีมล้าง', etaMin: 15 },
  { id: 'B8', type: 'EV',       status: 'busy',     job: 'JC-2405', car: 'BYD Han · 3ขค-7788',    tech: 'ธนพล',  etaMin: 60 },
]

const QUEUE = [
  { job: 'JC-2410', car: 'MG4 · 4กค-1100', service: 'เช็คระยะ 20,000', need: 'ทั่วไป' },
  { job: 'JC-2411', car: 'BYD Atto 3 · 5ขข-2200', service: 'เปลี่ยนยาง+ตั้งศูนย์', need: 'ช่วงล่าง' },
  { job: 'JC-2412', car: 'BYD Seal · 6กก-3300', service: 'อัปเดตซอฟต์แวร์', need: 'EV' },
]

export default async function BayManagementPage(container) {
  function render() {
    const free = BAYS.filter(b => b.status === 'free').length
    const busy = BAYS.filter(b => b.status === 'busy').length
    const util = Math.round(busy / BAYS.length * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏗 Bay Management</div>
            <div class="page-subtitle">บริหารช่องซ่อม ${BAYS.length} ช่อง · จัดคิวงานไม่ให้ล้น</div>
          </div>
          <div class="page-actions">
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
                  <div style="font-weight:700;font-size:0.8rem">${q.job} <span style="font-weight:400;color:var(--text-muted)">· ${q.need}</span></div>
                  <div style="font-size:0.74rem;color:var(--text-muted)">${q.car}</div>
                  <div style="font-size:0.72rem;color:var(--primary)">${q.service}</div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.bay-card').forEach(c => c.addEventListener('click', () => openBay(c.dataset.id)))
    document.getElementById('assign-btn')?.addEventListener('click', openAssign)
  }

  function bayCard(b) {
    const s = STATUS[b.status]
    return `
      <div class="bay-card" data-id="${b.id}" style="border:2px solid ${s.color};border-radius:var(--radius-sm);padding:11px;cursor:pointer;background:var(--surface)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:0.95rem">${b.id}</strong>
          <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:1px 7px;border-radius:10px">${s.label}</span>
        </div>
        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">${b.type}</div>
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
    openModal({
      title: `🏗 ช่อง ${b.id} · ${b.type}`,
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
        </div>` : '<div style="color:var(--text-muted);font-size:0.8rem">ช่องนี้ว่าง</div>'}`,
      confirmText: '💾 บันทึก',
      onConfirm() {
        const ns = document.getElementById('bm-status').value
        b.status = ns
        if (ns === 'free') { b.job = ''; b.car = ''; b.tech = ''; b.etaMin = 0 }
        showToast(`อัปเดตช่อง ${b.id} → ${STATUS[ns].label}`, 'success')
        render()
      }
    })
  }

  function openAssign() {
    openModal({
      title: '➕ จ่ายงานเข้าช่องซ่อม',
      size: 'sm',
      body: `
        <div class="input-group" style="margin-bottom:10px">
          <label class="input-label">งานในคิว</label>
          <select class="input" id="bm-job">${QUEUE.map((q, i) => `<option value="${i}">${q.job} · ${q.car} (${q.need})</option>`).join('')}</select>
        </div>
        <div class="input-group" style="margin-bottom:10px">
          <label class="input-label">ช่องว่าง</label>
          <select class="input" id="bm-bay">${BAYS.filter(b => b.status==='free').map(b => `<option value="${b.id}">${b.id} · ${b.type}</option>`).join('')}</select>
        </div>
        <div class="input-group">
          <label class="input-label">ช่างผู้รับผิดชอบ</label>
          <input class="input" id="bm-tech" placeholder="ชื่อช่าง">
        </div>`,
      confirmText: '✅ จ่ายงาน',
      onConfirm() {
        const qi = parseInt(document.getElementById('bm-job').value)
        const bid = document.getElementById('bm-bay').value
        const tech = document.getElementById('bm-tech').value.trim()
        if (!tech) { showToast('❗ ระบุชื่อช่าง', 'error'); return false }
        const q = QUEUE[qi]; const b = BAYS.find(x => x.id === bid)
        if (!q || !b) { showToast('❗ ไม่พบข้อมูลงานหรือช่อง', 'error'); return false }
        b.status = 'busy'; b.job = q.job; b.car = q.car; b.tech = tech; b.etaMin = 60
        QUEUE.splice(qi, 1)
        showToast(`จ่าย ${q.job} เข้าช่อง ${bid} (${tech}) แล้ว`, 'success')
        render()
      }
    })
  }

  function statCard(label, value, color) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${label}</div>
      <div style="font-size:1.5rem;font-weight:900;color:${color};margin-top:2px">${value}</div>
    </div>`
  }

  render()
}
