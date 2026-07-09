/**
 * Model Year Changeover — บริหารการเปลี่ยน Model Year
 * Route: /dms/model-year
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

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

        <div style="display:flex;flex-direction:column;gap:12px">
          ${changeovers.map(c => changeCard(c)).join('')}
        </div>
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
        showToast(`📣 ส่งสรุป MY Changeover ${targets.length} รุ่น ให้ทีมขายและผู้จัดการทาง LINE แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
