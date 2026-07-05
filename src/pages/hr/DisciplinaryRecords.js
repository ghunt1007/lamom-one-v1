/**
 * Disciplinary Records — บันทึกตักเตือน / ใบเตือนพนักงาน
 * Route: /hr/disciplinary
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const LEVELS = {
  verbal:  { label: 'ตักเตือนวาจา', color: 'var(--text-muted)', score: 1 },
  written: { label: 'ใบเตือนครั้งที่ 1', color: 'var(--warning)', score: 2 },
  written2:{ label: 'ใบเตือนครั้งที่ 2', color: 'var(--warning)', score: 3 },
  final:   { label: 'ใบเตือนสุดท้าย', color: 'var(--danger)', score: 4 },
  suspend: { label: 'พักงาน', color: 'var(--danger)', score: 5 },
}

export default async function DisciplinaryRecordsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let records = []
  let loading = true

  async function loadData() {
    loading = true
    try { records = await listDocs('disciplinary_records', [], 'date', 'desc', 300) } catch (e) { records = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    // นับสะสมรายคน
    const byStaff = {}
    records.forEach(r => { byStaff[r.staff] = (byStaff[r.staff] || 0) + LEVELS[r.level].score })
    const watchlist = Object.entries(byStaff).filter(([, s]) => s >= 4)
    const pendingAck = records.filter(r => !r.ack).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚠️ Disciplinary Records</div>
            <div class="page-subtitle">บันทึกตักเตือน / ใบเตือน · เก็บเป็นหลักฐานตามกฎหมายแรงงาน</div>
          </div>
          <div class="page-actions"><button class="btn btn-primary" id="add-btn">➕ ออกใบเตือน</button></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${stat('📋 บันทึกทั้งหมด', records.length, 'var(--primary)')}
          ${stat('✍️ รอลงนามรับทราบ', pendingAck, pendingAck>0?'var(--warning)':'var(--success)')}
          ${stat('🚩 Watchlist', watchlist.length + ' คน', watchlist.length>0?'var(--danger)':'var(--success)')}
        </div>

        ${watchlist.length ? `
          <div class="card" style="padding:12px 14px;margin-bottom:14px;border-left:4px solid var(--danger)">
            <div style="font-size:0.78rem;font-weight:700;color:var(--danger);margin-bottom:4px">🚩 พนักงานที่ต้องจับตา (คะแนนสะสม ≥ 4)</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${watchlist.map(([n, s]) => escHtml(n) + ' (' + s + ' แต้ม)').join(' · ')} — พิจารณาเข้าสู่กระบวนการ PIP หรือเลิกจ้างตามขั้นตอน</div>
          </div>` : ''}

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:820px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
              <th style="padding:10px 12px">เลขที่</th><th>พนักงาน</th><th style="text-align:center">ระดับ</th>
              <th>สาเหตุ</th><th>ผู้ออก</th><th style="text-align:center">วันที่</th><th style="text-align:center">รับทราบ</th>
            </tr></thead>
            <tbody>
              ${records.map(r => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:9px 12px;font-weight:600">${escHtml(r.caseNo || r.id)}</td>
                  <td>${escHtml(r.staff)}<div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(r.dept)}</div></td>
                  <td style="text-align:center"><span style="font-size:0.66rem;background:${LEVELS[r.level].color};color:#fff;padding:2px 8px;border-radius:10px">${LEVELS[r.level].label}</span></td>
                  <td style="font-size:0.76rem;max-width:240px">${escHtml(r.reason)}</td>
                  <td style="font-size:0.74rem;color:var(--text-muted)">${escHtml(r.by)}</td>
                  <td style="text-align:center;font-size:0.74rem">${formatDate(r.date)}</td>
                  <td style="text-align:center">${r.ack
                    ? '<span style="color:var(--success);font-size:0.74rem">✓ แล้ว</span>'
                    : `<button class="btn btn-xs btn-secondary ack-btn" data-id="${r.id}">ให้ลงนาม</button>`}</td>
                </tr>`).join('')}
              ${!records.length ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">ไม่มีบันทึก</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 ใบเตือนควรให้พนักงานลงนามรับทราบทุกครั้ง เพื่อใช้เป็นหลักฐานตาม พ.ร.บ.คุ้มครองแรงงาน</p>
      </div>
    `

    container.querySelectorAll('.ack-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('disciplinary_records', b.dataset.id, { ack: true })
      const r = records.find(x => x.id === b.dataset.id)
      showToast(`บันทึกการลงนามรับทราบของ ${r?.staff} แล้ว`, 'success')
      await loadData()
    }))
    document.getElementById('add-btn')?.addEventListener('click', openAdd)
  }

  function openAdd() {
    openModal({
      title: '➕ ออกใบเตือนพนักงาน',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อพนักงาน *</label><input class="input" id="dr-staff"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">แผนก</label><input class="input" id="dr-dept"></div>
          <div class="input-group" style="flex:1"><label class="input-label">ระดับ *</label><select class="input" id="dr-level">${Object.entries(LEVELS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select></div>
        </div>
        <div class="input-group"><label class="input-label">สาเหตุ *</label><textarea class="input" id="dr-reason" rows="2"></textarea></div>
        <div class="input-group"><label class="input-label">ผู้ออกใบเตือน</label><input class="input" id="dr-by" placeholder="ตำแหน่ง/ชื่อ"></div>
      </div>`,
      confirmText: '📄 ออกใบเตือน',
      async onConfirm() {
        const staff = document.getElementById('dr-staff').value.trim()
        const reason = document.getElementById('dr-reason').value.trim()
        if (!staff || !reason) { showToast('❗ กรอกชื่อพนักงานและสาเหตุ', 'error'); return false }
        await createDoc('disciplinary_records', {
          caseNo: 'DR-' + Date.now(), staff, dept: document.getElementById('dr-dept').value.trim() || '-',
          level: document.getElementById('dr-level').value, reason,
          by: document.getElementById('dr-by').value.trim() || 'หัวหน้างาน',
          date: new Date().toISOString().slice(0,10), ack: false,
        })
        showToast(`ออกใบเตือน ให้ ${staff} แล้ว — รอลงนามรับทราบ`, 'success')
        await loadData()
      }
    })
  }

  function stat(label, value, color) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${label}</div><div style="font-size:1.5rem;font-weight:900;color:${color};margin-top:2px">${value}</div></div>`
  }

  await loadData()
}
