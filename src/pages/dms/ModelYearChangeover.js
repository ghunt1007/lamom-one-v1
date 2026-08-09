/**
 * Model Year Changeover — บริหารการเปลี่ยน Model Year
 * Route: /dms/model-year
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, createDoc, seedDemoData } from '../../core/db.js'

const SALES_NOTIFY_ROLES = ['sales', 'manager', 'owner', 'admin']
async function notifySalesTeam(title, body, link) {
  const users = await listDocs('users', [], 'createdAt', 'desc', 500).catch(() => [])
  const targets = users.filter(u => u.uid && SALES_NOTIFY_ROLES.includes(u.role))
  await Promise.all(targets.map(u => createDoc('notifications', { type: 'system', title, body, userId: u.uid, read: false, link }).catch(() => {})))
  return targets.length
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ST = {
  upcoming:  { label: 'กำลังจะมา', color: 'var(--text-muted)' },
  announced: { label: 'ประกาศแล้ว', color: 'var(--warning)' },
  active:    { label: 'เปลี่ยนแล้ว', color: 'var(--success)' },
}

export default async function ModelYearChangeoverPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let changeovers = []
  let loading = true

  async function loadData() {
    loading = true
    try { changeovers = await listDocs('model_year_changeovers', [], 'effectiveDate', 'desc', 50) } catch (e) { changeovers = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const oldStockTotal = changeovers.reduce((s, c) => s + c.oldStockLeft, 0)
    const announced = changeovers.filter(c => c.status === 'announced')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔄 Model Year Changeover</div>
            <div class="page-subtitle">บริหารการเปลี่ยน MY · ระบายสต็อกเก่า · แจ้งลูกค้าและเซลส์</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="add-my-btn">➕ เพิ่ม MY Changeover</button>
            <button class="btn btn-primary" id="notify-btn">📣 แจ้งทีมขาย</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🔄 MY เปลี่ยนทั้งหมด', changeovers.length + ' รุ่น', 'var(--primary)')}
          ${sc('⚠️ ประกาศแล้ว/รอเปลี่ยน', announced.length + ' รุ่น', announced.length > 0 ? 'var(--warning)' : 'var(--success)')}
          ${sc('📦 สต็อกรุ่นเก่าคงเหลือ', oldStockTotal + ' คัน', oldStockTotal > 0 ? 'var(--danger)' : 'var(--success)')}
          ${sc('💸 มูลค่าสต็อกเก่า', formatCurrency(changeovers.reduce((s,c)=>s+c.oldStockLeft*c.oldPrice,0)), 'var(--text)')}
        </div>

        ${announced.length && oldStockTotal > 0 ? `
          <div class="card" style="padding:12px 14px;margin-bottom:14px;border-left:4px solid var(--warning)">
            <div style="font-size:0.76rem;font-weight:700;color:var(--warning);margin-bottom:4px">⚠️ สต็อก MY เก่าต้องระบายก่อน MY ใหม่มา</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${announced.map(c=>`${escHtml(c.model)} MY${c.oldYear} เหลือ ${c.oldStockLeft} คัน (ขาย MY${c.oldYear} ถูกกว่าใหม่ ${formatCurrency(c.newPrice-c.oldPrice)})`).join(' · ')}</div>
          </div>` : ''}

        ${changeovers.length ? `<div style="display:flex;flex-direction:column;gap:12px">
          ${changeovers.map(c => changeCard(c)).join('')}
        </div>` : `<div class="empty-state" style="padding:48px"><div class="empty-icon">🔄</div><div class="empty-title">ยังไม่มีรายการ Model Year Changeover</div><div class="empty-desc">กดปุ่ม "➕ เพิ่ม MY Changeover" ด้านบนเพื่อเริ่มบันทึกรุ่นที่กำลังเปลี่ยนปี</div></div>`}
      </div>
    `

    container.querySelectorAll('.clear-stock-btn').forEach(b => b.addEventListener('click', () => {
      const c = changeovers.find(x => x.model === b.dataset.model)
      openModal({
        title: '🏷 ระบายสต็อก ' + escHtml(c.model) + ' MY' + c.oldYear,
        size: 'sm',
        body: `<div style="font-size:0.82rem;margin-bottom:10px">เหลือ <strong>${c.oldStockLeft} คัน</strong> · ราคาปัจจุบัน <strong>${formatCurrency(c.oldPrice)}</strong></div>
          <div class="input-group"><label class="input-label">ราคาโปรโมชั่น (ลดจาก MY ใหม่)</label><input class="input" type="number" id="my-promo" value="${c.newPrice - 30000}"></div>
          <div class="input-group" style="margin-top:8px"><label class="input-label">แคมเปญ</label><input class="input" id="my-camp" value="Last Stock MY${c.oldYear} - ราคาพิเศษ"></div>`,
        confirmText: '🎁 สร้างแคมเปญระบาย',
        async onConfirm() {
          const promo = parseInt(document.getElementById('my-promo').value) || c.oldPrice
          const camp = document.getElementById('my-camp')?.value.trim() || `Last Stock MY${c.oldYear}`
          try {
            await updateDocData('model_year_changeovers', c.id, { oldPrice: promo, campaign: camp })
            showToast(`🎁 สร้างแคมเปญระบาย ${c.model} MY${c.oldYear} ที่ ${formatCurrency(promo)} (${c.oldStockLeft} คัน) แล้ว`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    document.getElementById('notify-btn')?.addEventListener('click', async () => {
      const targets = changeovers.filter(c => c.status === 'announced' || c.status === 'upcoming')
      try {
        await Promise.all(targets.map(c => updateDocData('model_year_changeovers', c.id, { notified: true })))
        // เดิมอ้างว่าส่งทาง LINE แต่ไม่มีการส่งจริง แก้ให้สร้างการแจ้งเตือนจริงในระบบให้ทีมขาย/ผู้จัดการ
        const count = await notifySalesTeam('🔄 สรุป Model Year Changeover', `มีรุ่นที่กำลังเปลี่ยน MY ${targets.length} รุ่น — ${targets.slice(0,5).map(c=>c.model).join(', ')}${targets.length>5?' และอื่นๆ':''}`, '/dms/model-year')
        showToast(`📣 ส่งการแจ้งเตือนสรุป MY Changeover ${targets.length} รุ่น ให้ทีมขาย/ผู้จัดการ ${count} คนแล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
    document.getElementById('add-my-btn')?.addEventListener('click', openAddForm)
  }

  function openAddForm() {
    const { el, close } = openModal({
      title: '➕ เพิ่ม Model Year Changeover', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">รุ่นรถ *</label><input class="input" id="my-model"><span class="input-error" id="my-model-e"></span></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ปี MY เดิม *</label><input class="input" type="number" id="my-oldyear" value="${new Date().getFullYear()+543-1}"></div>
          <div class="input-group"><label class="input-label">ปี MY ใหม่ *</label><input class="input" type="number" id="my-newyear" value="${new Date().getFullYear()+543}"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันประกาศ</label><input class="input" type="date" id="my-announced"></div>
          <div class="input-group"><label class="input-label">วันมีผล</label><input class="input" type="date" id="my-effective"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ราคา MY เดิม (บาท)</label><input class="input" type="number" id="my-oldprice"></div>
          <div class="input-group"><label class="input-label">ราคา MY ใหม่ (บาท)</label><input class="input" type="number" id="my-newprice"></div>
        </div>
        <div class="input-group"><label class="input-label">สต็อกรุ่นเก่าคงเหลือ (คัน)</label><input class="input" type="number" id="my-stockleft" value="0"></div>
        <div class="input-group"><label class="input-label">สิ่งที่เปลี่ยน (1 บรรทัดต่อ 1 ข้อ)</label><textarea class="input" id="my-changes" rows="3" placeholder="เช่น เพิ่มสีใหม่&#10;ปรับสเปคแบต"></textarea></div>
        <div class="input-group"><label class="input-label">สถานะ</label>
          <select class="input" id="my-status">
            ${Object.entries(ST).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="myc">ยกเลิก</button><button class="btn btn-primary" id="mys">💾 บันทึก</button>`
    })
    el.querySelector('#myc').addEventListener('click', close)
    el.querySelector('#mys').addEventListener('click', async () => {
      const model = el.querySelector('#my-model').value.trim()
      const oldYear = Number(el.querySelector('#my-oldyear').value)
      const newYear = Number(el.querySelector('#my-newyear').value)
      if (!model) { el.querySelector('#my-model-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#mys'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        model, oldYear, newYear,
        announcedDate: el.querySelector('#my-announced').value || new Date().toISOString().slice(0,10),
        effectiveDate: el.querySelector('#my-effective').value || new Date().toISOString().slice(0,10),
        oldPrice: Number(el.querySelector('#my-oldprice').value) || 0,
        newPrice: Number(el.querySelector('#my-newprice').value) || 0,
        oldStockLeft: Number(el.querySelector('#my-stockleft').value) || 0,
        changes: el.querySelector('#my-changes').value.split('\n').map(s => s.trim()).filter(Boolean),
        status: el.querySelector('#my-status').value,
        notified: false,
      }
      try {
        await createDoc('model_year_changeovers', data)
        showToast('✅ เพิ่ม Model Year Changeover แล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function changeCard(c) {
    const s = ST[c.status]
    const diff = c.newPrice - c.oldPrice
    return `
      <div class="card" style="padding:14px;border-left:4px solid ${s.color}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:0.92rem">${escHtml(c.model)}
              <span style="font-size:0.7rem;color:var(--text-muted);margin-left:6px">MY${c.oldYear} → MY${c.newYear}</span>
              <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:1px 8px;border-radius:10px;margin-left:6px">${s.label}</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted)">ประกาศ ${formatDate(c.announcedDate)} · มีผล ${formatDate(c.effectiveDate)}</div>
          </div>
          <div style="text-align:right;font-size:0.8rem">
            <div style="color:var(--text-muted)">ราคา MY${c.oldYear}: <del>${formatCurrency(c.oldPrice)}</del></div>
            <div style="font-weight:700;color:var(--primary)">ราคา MY${c.newYear}: ${formatCurrency(c.newPrice)} ${diff>0?`<span style="color:var(--danger)">(+${formatCurrency(diff)})</span>`:`<span style="color:var(--success)">(${formatCurrency(diff)})</span>`}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start">
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">✨ สิ่งที่เปลี่ยนใน MY${c.newYear}:</div>
            ${c.changes.map(ch => `<div style="font-size:0.76rem;padding:2px 0">• ${escHtml(ch)}</div>`).join('')}
          </div>
          <div style="text-align:right">
            ${c.oldStockLeft > 0 ? `
              <div style="font-size:0.8rem;font-weight:700;color:var(--danger)">📦 สต็อกเก่าเหลือ ${c.oldStockLeft} คัน</div>
              <button class="btn btn-xs btn-primary clear-stock-btn" data-model="${escHtml(c.model)}" style="margin-top:6px">🏷 จัดโปรระบาย</button>` :
              '<div style="font-size:0.76rem;color:var(--success)">✅ สต็อกเก่าหมดแล้ว</div>'}
          </div>
        </div>
      </div>`
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.3rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
