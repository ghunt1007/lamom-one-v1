/**
 * Dealer License Tracking — ต่ออายุใบอนุญาตตัวแทนจำหน่าย
 * Route: /dms/licenses
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function daysLeft(expiry) { return Math.ceil((new Date(expiry) - Date.now()) / 86400000) }
function calcStatus(l) {
  const d = daysLeft(l.expiry)
  if (d < 0) return 'expired'
  if (d <= l.renewDays) return 'expiring'
  return 'ok'
}

const SMAP = {
  ok:       { label: 'ปกติ',         color: 'var(--success)' },
  expiring: { label: 'ใกล้หมดอายุ',  color: 'var(--warning)' },
  expired:  { label: 'หมดอายุแล้ว!', color: 'var(--danger)' },
}

export default async function DealerLicensePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let licenses = []
  let loading = true

  async function loadData() {
    loading = true
    try { licenses = await listDocs('licenses', [], 'expiry', 'asc', 100) } catch (e) { licenses = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    // คำนวณสถานะจริงทุก render
    licenses.forEach(l => { l.status = calcStatus(l) })
    const expiring = licenses.filter(l => l.status === 'expiring')
    const expired  = licenses.filter(l => l.status === 'expired')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Dealer License Tracking</div>
            <div class="page-subtitle">ติดตามใบอนุญาตทั้งหมด · แจ้งเตือนล่วงหน้าก่อนหมดอายุ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-btn">➕ เพิ่มใบอนุญาต</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📋 ใบอนุญาตทั้งหมด', licenses.length, 'var(--primary)')}
          ${sc('✅ ปกติ', licenses.filter(l=>l.status==='ok').length, 'var(--success)')}
          ${sc('⚠️ ใกล้หมดอายุ', expiring.length, expiring.length > 0 ? 'var(--warning)' : 'var(--success)')}
          ${sc('🚨 หมดอายุแล้ว', expired.length, expired.length > 0 ? 'var(--danger)' : 'var(--success)')}
        </div>

        ${expired.length > 0 ? `
          <div class="card" style="padding:12px 14px;margin-bottom:12px;border-left:4px solid var(--danger)">
            <div style="font-size:0.76rem;font-weight:700;color:var(--danger);margin-bottom:4px">🚨 หมดอายุแล้ว — ดำเนินการด่วน!</div>
            <div style="font-size:0.78rem">${expired.map(l=>`${escHtml(l.name)} (${escHtml(l.no)})`).join(' · ')}</div>
          </div>` : ''}

        ${expiring.length > 0 ? `
          <div class="card" style="padding:12px 14px;margin-bottom:12px;border-left:4px solid var(--warning)">
            <div style="font-size:0.76rem;font-weight:700;color:var(--warning);margin-bottom:4px">⚠️ ใกล้หมดอายุ — ควรเริ่มต่ออายุ</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${expiring.map(l=>`${escHtml(l.name)} · เหลือ ${daysLeft(l.expiry)} วัน`).join(' · ')}</div>
          </div>` : ''}

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:820px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
              <th style="padding:10px 12px">ใบอนุญาต</th><th>หน่วยงานออก</th><th>เลขที่</th>
              <th style="text-align:center">วันออก</th><th style="text-align:center">หมดอายุ</th>
              <th style="text-align:center">เหลือ</th><th style="text-align:center">สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              ${licenses.map(l => {
                const d = daysLeft(l.expiry); const s = SMAP[l.status]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:9px 12px;font-weight:600;max-width:240px">${escHtml(l.name)}<div style="font-size:0.66rem;color:var(--text-muted)">${escHtml(l.dept)}</div></td>
                  <td style="font-size:0.74rem">${escHtml(l.issuer)}</td>
                  <td style="font-family:monospace;font-size:0.72rem">${escHtml(l.no)}</td>
                  <td style="text-align:center;font-size:0.74rem">${formatDate(l.issue)}</td>
                  <td style="text-align:center;font-size:0.74rem;${l.status!=='ok'?'font-weight:700;color:'+s.color:''}">${formatDate(l.expiry)}</td>
                  <td style="text-align:center;font-weight:700;color:${s.color}">${d < 0 ? 'เกิน ' + Math.abs(d) + ' วัน' : d + ' วัน'}</td>
                  <td style="text-align:center"><span style="font-size:0.66rem;background:${s.color};color:#fff;padding:2px 8px;border-radius:10px">${s.label}</span></td>
                  <td style="padding-right:10px">${l.status !== 'ok' ? `<button class="btn btn-xs btn-primary renew-btn" data-id="${l.id}">ต่ออายุ</button>` : `<button class="btn btn-xs btn-secondary remind-btn" data-id="${l.id}">แจ้งเตือน</button>`}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 แถบสีส้ม = ใกล้หมดภายใน ${Math.max(...licenses.map(l=>l.renewDays))} วัน ตามที่กำหนดในแต่ละใบ</p>
      </div>
    `

    container.querySelectorAll('.renew-btn').forEach(b => b.addEventListener('click', () => renewLic(b.dataset.id)))
    container.querySelectorAll('.remind-btn').forEach(b => b.addEventListener('click', () => {
      const l = licenses.find(x => x.id === b.dataset.id)
      showToast(`🔔 ตั้งแจ้งเตือนล่วงหน้า ${l.renewDays} วัน สำหรับ "${l.name}" แล้ว`, 'success')
    }))
    document.getElementById('add-btn')?.addEventListener('click', addLic)
  }

  function renewLic(id) {
    const l = licenses.find(x => x.id === id)
    openModal({
      title: '🔄 ต่ออายุ — ' + escHtml(l.name),
      size: 'sm',
      body: `<div style="font-size:0.8rem;margin-bottom:10px">หน่วยงาน: <strong>${escHtml(l.issuer)}</strong><br>วันหมดอายุ: ${formatDate(l.expiry)}</div>
        <div class="input-group"><label class="input-label">วันที่ต่ออายุ (ออกใหม่)</label><input class="input" type="date" id="lic-new" value="${l.expiry ? new Date(new Date(l.expiry).setFullYear(new Date(l.expiry).getFullYear()+3)).toISOString().slice(0,10) : ''}"></div>
        <div class="input-group" style="margin-top:8px"><label class="input-label">เลขที่ใบใหม่</label><input class="input" id="lic-no" value="${escHtml(l.no)}"></div>`,
      confirmText: '✅ บันทึกการต่ออายุ',
      async onConfirm() {
        const newDate = document.getElementById('lic-new').value
        if (!newDate) { showToast('❗ ระบุวันที่หมดอายุใหม่', 'error'); return false }
        const no = document.getElementById('lic-no').value.trim()
        try {
          await updateDocData('licenses', l.id, { expiry: newDate, no, issue: new Date().toISOString().slice(0,10) })
          showToast(`✅ ต่ออายุ "${l.name}" ถึง ${formatDate(newDate)} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function addLic() {
    openModal({
      title: '➕ เพิ่มใบอนุญาต',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อใบอนุญาต *</label><input class="input" id="nl-name"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">หน่วยงาน</label><input class="input" id="nl-issuer"></div>
          <div class="input-group" style="width:90px"><label class="input-label">แผนก</label><input class="input" id="nl-dept"></div>
        </div>
        <div class="input-group"><label class="input-label">เลขที่ใบอนุญาต</label><input class="input" id="nl-no"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">วันออก</label><input class="input" type="date" id="nl-issue"></div>
          <div class="input-group" style="flex:1"><label class="input-label">วันหมดอายุ *</label><input class="input" type="date" id="nl-expiry"></div>
        </div>
      </div>`,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const name = document.getElementById('nl-name').value.trim()
        const expiry = document.getElementById('nl-expiry').value
        if (!name || !expiry) { showToast('❗ กรอกชื่อและวันหมดอายุ', 'error'); return false }
        try {
          await createDoc('licenses', { name, issuer: document.getElementById('nl-issuer').value.trim(), no: document.getElementById('nl-no').value.trim(),
            issue: document.getElementById('nl-issue').value || new Date().toISOString().slice(0,10),
            expiry, renewDays: 60, status: 'ok', dept: document.getElementById('nl-dept').value.trim() || '-' })
          showToast(`เพิ่มใบอนุญาต "${name}" แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
