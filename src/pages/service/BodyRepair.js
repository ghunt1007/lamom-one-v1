/**
 * Body & Paint (BP) — ระบบตัวถัง ประเมินความเสียหาย ติดตามซ่อม
 * Route: /service/bp
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ST = {
  estimate:    { label:'รอประเมิน', color:'var(--warning)' },
  approved:    { label:'อนุมัติแล้ว', color:'var(--primary)' },
  in_progress: { label:'กำลังซ่อม', color:'var(--success)' },
  ready:       { label:'ซ่อมเสร็จแล้ว', color:'var(--success)' },
  completed:   { label:'ส่งมอบแล้ว', color:'var(--text-muted)' },
}

export default async function BodyRepairPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let filter = 'all'
  let jobs = []
  let loading = true

  async function loadData() {
    loading = true
    try { jobs = await listDocs('body_repair_jobs', [], 'daysIn', 'desc', 500) } catch (e) { jobs = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function badge(s) {
    const m = ST[s] || { label: s, color: 'var(--text-muted)' }
    return '<span style="font-size:0.62rem;padding:2px 8px;border-radius:6px;background:' + m.color + '22;color:' + m.color + ';font-weight:700">' + m.label + '</span>'
  }

  function jobCard(j) {
    return '<div class="card" style="padding:14px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.82rem">' + escHtml(j.plate) + ' · ' + escHtml(j.model) + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted)">' + escHtml(j.customer) + ' · ' + escHtml(j.insurer) + '</div>' +
        '</div>' +
        badge(j.status) +
      '</div>' +
      '<div style="font-size:0.74rem;color:var(--text-secondary,var(--text-muted));margin-bottom:8px">🔧 ' + escHtml(j.damage) + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div style="display:flex;gap:16px">' +
          '<div style="font-size:0.7rem"><span style="color:var(--text-muted)">ประเมิน</span> <span style="font-weight:700;color:var(--success)">฿' + j.estimate.toLocaleString() + '</span></div>' +
          '<div style="font-size:0.7rem"><span style="color:var(--text-muted)">ช่าง</span> <span style="font-weight:600">' + escHtml(j.tech) + '</span></div>' +
          '<div style="font-size:0.7rem"><span style="color:var(--text-muted)">วันในสต็อก</span> <span>' + j.daysIn + ' วัน</span></div>' +
        '</div>' +
        '<button class="btn btn-sm btn-secondary view-btn" data-id="' + j.id + '">รายละเอียด</button>' +
      '</div>' +
    '</div>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)
    const total = jobs.length
    const inProg = jobs.filter(j => j.status === 'in_progress').length
    const ready = jobs.filter(j => j.status === 'ready').length
    const totalEst = jobs.reduce((s, j) => s + j.estimate, 0)

    const filterBtns = [['all','ทั้งหมด'],['estimate','รอประเมิน'],['approved','อนุมัติแล้ว'],['in_progress','กำลังซ่อม'],['ready','ซ่อมเสร็จ']].map(([k,l]) =>
      '<button class="btn btn-sm ' + (filter === k ? 'btn-primary' : 'btn-secondary') + ' filter-btn" data-f="' + k + '">' + l + '</button>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 Body & Paint (BP)</div>
            <div class="page-subtitle">ระบบตัวถัง ประเมินความเสียหาย ติดตามซ่อม · ${total} งาน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-bp-btn">+ รับงานใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('🔧 งานทั้งหมด', total + ' งาน', 'var(--primary)')}
          ${sc('⚙️ กำลังซ่อม', inProg + ' งาน', 'var(--warning)')}
          ${sc('✅ ซ่อมเสร็จ', ready + ' งาน', 'var(--success)')}
          ${sc('💰 ประเมินรวม', '฿' + totalEst.toLocaleString(), 'var(--success)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${filterBtns}</div>

        <div id="jobs-list">${filtered.map(j => jobCard(j)).join('')}</div>
      </div>`

    container.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const j = jobs.find(x => x.id === b.dataset.id)
      if (!j) return
      const body = '<div style="font-size:0.82rem">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">' +
          '<div><div style="color:var(--text-muted);font-size:0.68rem">ลูกค้า</div><div style="font-weight:600">' + escHtml(j.customer) + '</div></div>' +
          '<div><div style="color:var(--text-muted);font-size:0.68rem">รถ</div><div style="font-weight:600">' + escHtml(j.model) + '</div></div>' +
          '<div><div style="color:var(--text-muted);font-size:0.68rem">ป้ายทะเบียน</div><div style="font-weight:600">' + escHtml(j.plate) + '</div></div>' +
          '<div><div style="color:var(--text-muted);font-size:0.68rem">ช่าง</div><div style="font-weight:600">' + escHtml(j.tech) + '</div></div>' +
          '<div><div style="color:var(--text-muted);font-size:0.68rem">บริษัทประกัน</div><div style="font-weight:600">' + escHtml(j.insurer) + '</div></div>' +
          '<div><div style="color:var(--text-muted);font-size:0.68rem">เลขเคลม</div><div style="font-weight:600">' + escHtml(j.claim) + '</div></div>' +
        '</div>' +
        '<div style="background:var(--surface-2);padding:10px;border-radius:8px;margin-bottom:12px">' +
          '<div style="font-size:0.68rem;color:var(--text-muted)">ความเสียหาย</div>' +
          '<div style="font-weight:600;margin-top:2px">' + escHtml(j.damage) + '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="color:var(--text-muted);font-size:0.68rem">ราคาประเมิน</div><div style="font-size:1.1rem;font-weight:900;color:var(--success)">฿' + j.estimate.toLocaleString() + '</div></div>' +
          badge(j.status) +
        '</div>' +
      '</div>'
      const confirmText = j.status === 'estimate' ? 'อนุมัติซ่อม' : j.status === 'ready' ? 'ส่งมอบ' : 'ปิด'
      openModal({
        title: '🚗 BP ' + escHtml(j.id) + ' — ' + escHtml(j.plate),
        size: 'md',
        body,
        confirmText,
        onConfirm: async () => {
          const next = j.status === 'estimate' ? 'approved' : j.status === 'ready' ? 'completed' : null
          if (!next) return
          try {
            await updateDocData('body_repair_jobs', j.id, { status: next })
            showToast(next === 'approved' ? '✅ อนุมัติซ่อม BP ' + j.id : '🚗 ส่งมอบรถ BP ' + j.id, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    document.getElementById('new-bp-btn')?.addEventListener('click', openNewJobModal)
  }

  function openNewJobModal() {
    openModal({
      title: '🚗 รับงาน Body & Paint ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ทะเบียนรถ *</label><input id="bp-plate" class="input" placeholder="กก 1234 กทม"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่นรถ</label><input id="bp-model" class="input" placeholder="BYD Atto 3"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อลูกค้า *</label><input id="bp-customer" class="input" placeholder="คุณ..."></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ความเสียหาย/รายละเอียดงาน *</label>
            <textarea id="bp-damage" class="input" rows="2" placeholder="เช่น ชนหน้า ไฟหน้าแตก กันชนยุบ..."></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาประเมิน (฿)</label><input id="bp-estimate" type="number" class="input" placeholder="0"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ช่างผู้รับผิดชอบ</label>
              <select id="bp-tech" class="input">
                ${['ช่างเพ็ชร','ช่างแดน','ช่างโอ'].map(t=>`<option>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">บริษัทประกัน</label><input id="bp-insurer" class="input" placeholder="วิริยะประกัน..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">เลขที่เคลม</label><input id="bp-claim" class="input" placeholder="VIR-2026-..."></div>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="bp-save">✅ รับงาน</button>
        </div>
      `
    })
    document.getElementById('bp-save')?.addEventListener('click', async () => {
      const plate = document.getElementById('bp-plate')?.value.trim()
      const customer = document.getElementById('bp-customer')?.value.trim()
      const damage = document.getElementById('bp-damage')?.value.trim()
      if (!plate || !customer || !damage) { showToast('⚠️ กรุณากรอกข้อมูลที่จำเป็น', 'warning'); return }
      try {
        await createDoc('body_repair_jobs', {
          plate, customer, damage,
          model: document.getElementById('bp-model')?.value.trim() || 'EV',
          estimate: parseFloat(document.getElementById('bp-estimate')?.value) || 0,
          status: 'estimate',
          tech: document.getElementById('bp-tech')?.value || 'ช่างเพ็ชร',
          daysIn: 0,
          insurer: document.getElementById('bp-insurer')?.value.trim() || '-',
          claim: document.getElementById('bp-claim')?.value.trim() || '-',
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ รับงานแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
