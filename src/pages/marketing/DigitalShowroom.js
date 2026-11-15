/**
 * Digital Showroom — QR ประจำรุ่นรถ (v1.0.1180)
 * Route: /marketing/digital-showroom
 * ติดป้าย QR ที่รถโชว์/โบรชัวร์ ลูกค้าสแกน → ฟอร์มฝากชื่อ-เบอร์ (เลือกรุ่นไว้ให้) → ลีด walk-in ของรุ่นนั้น แจ้งเซลส์ทันที
 * นับลีดจากลูกค้าจริงที่เข้าผ่านลิงก์ของรุ่นนั้น (เดิมแสดงยอดเข้าชม/Conversion ที่ไม่มีที่มา — เอาออกแล้ว)
 */
import { posterFooter, prefetchCompanyLine } from '../../utils/companyFooter.js'
import { openModal } from '../../utils/modal.js'
import { showroomUrl, showroomKey, utmLeadCounts, soldModelsMissing } from '../../utils/publicLinks.js'
import { showToast } from '../../core/store.js'
import { todayBangkok } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { escHtml as esc } from '../../utils/escape.js'
import { copyText } from '../../utils/copyText.js'
import { qrSvg, qrDownloadLink } from '../../utils/qr.js'

const BADGES = ['EV', 'PHEV', 'HEV', 'NEW']
const safeColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c || '').trim()) ? String(c).trim() : ''

export default async function DigitalShowroomPage(container) {
  prefetchCompanyLine()
  const myGen = container.__routerGen
  let CARS = []
  let counts = null
  let filterBadge = 'all'
  let loading = true
  let missing = []

  async function loadData() {
    loading = true
    const [cars, customers, bookings] = await Promise.all([
      listDocs('digital_showroom', [], 'model', 'asc', 500).catch(() => []),
      listDocs('customers', [...companyScopeFilters(), ['autoLead', '==', true]], 'createdAt', 'desc', 2000).catch(() => null),
      listDocs('bookings', companyScopeFilters(), 'bookingDate', 'desc', 3000).catch(() => []),
    ])
    counts = customers ? utmLeadCounts(customers) : null
    CARS = cars.filter(c => !c.deleted && c.model).map(c => ({ ...c, link: showroomUrl(c.model), leads: counts ? (counts[showroomKey(c.model)] || 0) : null }))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || String(a.model).localeCompare(String(b.model), 'th'))
    missing = soldModelsMissing(bookings, CARS.map(c => c.model), { today: todayBangkok() })
    loading = false
    if (container.__routerGen === myGen) render()
  }

  const dots = (colors, px = 14) => (Array.isArray(colors) ? colors : []).map(safeColor).filter(Boolean)
    .map(c => `<span style="width:${px}px;height:${px}px;border-radius:50%;background:${c};border:1.5px solid var(--border);display:inline-block"></span>`).join('')

  function carCard(car) {
    return `<div class="card" style="padding:14px">
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="font-size:2rem;line-height:1">🚗</div>
        <div style="flex:1 1 160px;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:0.9rem;overflow-wrap:anywhere">${esc(car.model)}</span>
            ${car.badge ? `<span style="font-size:0.62rem;background:var(--success);color:#fff;padding:1px 7px;border-radius:8px">${esc(car.badge)}</span>` : ''}
            ${car.featured ? '<span style="font-size:0.62rem;background:var(--warning);color:#000;padding:1px 7px;border-radius:8px;font-weight:700">⭐ แนะนำ</span>' : ''}
          </div>
          <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">${dots(car.colors)}</div>
          <div style="font-size:0.76rem">🎯 ${car.leads == null ? '—' : car.leads + ' ลีดจาก QR'}</div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:100%">
          <button class="btn btn-xs btn-primary qr-btn" data-id="${esc(car.id)}" style="font-size:0.68rem">🔳 QR ติดรถ</button>
          <button class="btn btn-xs btn-secondary feat-btn" data-id="${esc(car.id)}" style="font-size:0.68rem">${car.featured ? '⭐ เลิกแนะนำ' : '⭐ แนะนำ'}</button>
        </div>
      </div>
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const rows = filterBadge === 'all' ? CARS : CARS.filter(c => c.badge === filterBadge)
    const totLeads = counts ? CARS.reduce((s, c) => s + (c.leads || 0), 0) : null
    const usedBadges = BADGES.filter(b => CARS.some(c => c.badge === b))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚗 QR ประจำรุ่นรถ</div>
            <div class="page-subtitle">ติดป้าย QR ที่รถโชว์/โบรชัวร์ · ${CARS.length} รุ่น</div>
          </div>
          <div class="page-actions">${missing.length ? `<button class="btn btn-success" id="add-sold-btn" title="${esc(missing.map(m => m.model).join(', '))}">⚡ เพิ่มรุ่นที่ขายจริง ${missing.length} รุ่น</button>` : ''}<button class="btn btn-primary" id="add-car-btn">+ เพิ่มรุ่น</button></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:12px;margin-bottom:12px">
          ${sc('🚗 รุ่นที่มี QR', CARS.length + ' รุ่น', 'var(--primary)')}
          ${sc('🎯 ลีดจาก QR รวม', totLeads == null ? '—' : totLeads + ' ราย', 'var(--success)')}
          ${sc('⭐ รุ่นแนะนำ', CARS.filter(c => c.featured).length + ' รุ่น', 'var(--warning)')}
        </div>
        <div style="font-size:0.74rem;color:var(--text-muted);line-height:1.6;margin-bottom:12px">ลูกค้าสแกน QR ที่รถ → เจอฟอร์มฝากชื่อ-เบอร์ที่เลือกรุ่นนี้ไว้ให้ → เข้าเป็นลีด Walk-in ในโปรแกรมและแจ้งเซลส์ทันที (ฟอร์มต้องเปิดรับอยู่ ตั้งค่าที่ 🔗 ช่องทางโซเชียล › 🤖 ตอบอัตโนมัติ)</div>

        ${usedBadges.length > 1 ? `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${['all', ...usedBadges].map(b => `<button class="btn btn-xs ${filterBadge === b ? 'btn-primary' : 'btn-secondary'} badge-btn" data-b="${b}">${b === 'all' ? 'ทั้งหมด' : b}</button>`).join('')}</div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:10px">
          ${rows.map(carCard).join('')}
          ${rows.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--text-muted);grid-column:1/-1">ยังไม่มีรุ่น — กด ${missing.length ? '“⚡ เพิ่มรุ่นที่ขายจริง” หรือ ' : ''}“+ เพิ่มรุ่น” เพื่อสร้าง QR ติดรถคันแรก</div>` : ''}
        </div>
      </div>`

    container.querySelectorAll('.badge-btn').forEach(b => b.addEventListener('click', () => { filterBadge = b.dataset.b; render() }))
    container.querySelectorAll('.qr-btn').forEach(b => b.addEventListener('click', () => {
      const car = CARS.find(c => c.id === b.dataset.id)
      if (car) openQrModal(car)
    }))
    container.querySelectorAll('.feat-btn').forEach(b => b.addEventListener('click', async () => {
      const car = CARS.find(c => c.id === b.dataset.id)
      if (!car) return
      const next = !car.featured
      try {
        await updateDocData('digital_showroom', car.id, { featured: next })
        car.featured = next
        showToast((next ? '⭐ แนะนำ: ' : 'เลิกแนะนำ: ') + car.model, 'success')
        render()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('add-car-btn')?.addEventListener('click', openAddCarModal)
    document.getElementById('add-sold-btn')?.addEventListener('click', async e => {
      const btn = e.currentTarget
      if (btn.disabled) return
      btn.disabled = true; btn.textContent = '⏳ กำลังเพิ่ม…'
      let ok = 0
      for (const m of missing) { try { await createDoc('digital_showroom', { model: m.model, badge: '', colors: [], featured: false }); ok++ } catch { /* ข้ามรุ่นที่บันทึกไม่ได้ */ } }
      showToast(ok ? `✅ เพิ่ม ${ok} รุ่นจากใบจองแล้ว กด 🔳 QR ติดรถ เพื่อพิมพ์ป้าย` : 'บันทึกไม่สำเร็จ', ok ? 'success' : 'error')
      await loadData()
    })
  }

  function openQrModal(car) {
    const { el } = openModal({
      title: '🔳 QR ติดรถ — ' + esc(car.model), size: 'sm',
      body: `<div style="text-align:center">
        <div style="width:min(240px,100%);margin:0 auto 8px;background:#fff;border-radius:8px;line-height:0">${qrSvg(car.link, { size: '100%' })}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);overflow-wrap:anywhere;margin-bottom:10px">${esc(car.link)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
          <button type="button" class="btn btn-primary btn-sm" id="sq-print">🖨 พิมพ์ป้ายติดรถ</button>
          ${qrDownloadLink(car.link, 'QR-' + car.model, '💾 บันทึกรูป QR', 'btn btn-secondary btn-sm')}
          <button type="button" class="btn btn-secondary btn-sm" id="sq-copy">📋 คัดลอกลิงก์</button>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:10px">🎯 ลีดจาก QR นี้: ${car.leads == null ? '—' : car.leads + ' ราย'}</div>
      </div>`,
    })
    el.querySelector('#sq-copy').addEventListener('click', () => copyText(car.link, '📋 คัดลอกลิงก์ของรุ่นนี้แล้ว'))
    el.querySelector('#sq-print').addEventListener('click', () => {
      const w = window.open('', '_blank', 'width=600,height=800')
      if (!w) { showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — อนุญาต pop-up แล้วลองใหม่', 'warning'); return }
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR ${esc(car.model)}</title><style>body{font-family:sans-serif;text-align:center;padding:40px 24px}h1{font-size:40px;margin:0 0 4px}p{font-size:20px;color:#333;margin:6px 0}.qr{margin:24px auto}</style></head><body><h1>${esc(car.model)}</h1><p>สนใจรุ่นนี้? สแกนฝากชื่อ-เบอร์</p><p>เจ้าหน้าที่จะติดต่อกลับพร้อมราคาและโปรโมชั่น</p><div class="qr">${qrSvg(car.link, { size: 380 })}</div>${posterFooter()}<script>window.print()<\/script></body></html>`)
      w.document.close()
    })
  }

  function openAddCarModal() {
    const { el, close } = openModal({
      title: '📝 เพิ่มรุ่นสำหรับ QR ติดรถ', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อรุ่น *</label>
              <input id="ds-model" class="input" maxlength="80" placeholder="เช่น Deepal S07"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภท</label>
              <select id="ds-badge" class="input">${BADGES.map(b => `<option value="${b}">${b}</option>`).join('')}</select></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">สีที่มีจำหน่าย (รหัสสี HEX คั่นด้วยจุลภาค ไม่ใส่ก็ได้)</label>
            <input id="ds-colors" class="input" placeholder="#1565c0, #212121, #f5f5f5"></div>
          <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ds-feat"> ⭐ รุ่นแนะนำ (ขึ้นก่อน)</label>
        </div>`,
      footer: `<button class="btn btn-secondary btn-sm" id="ds-cancel">ยกเลิก</button><button class="btn btn-primary btn-sm" id="ds-save">💾 เพิ่มรุ่น</button>`,
    })
    el.querySelector('#ds-cancel').addEventListener('click', close)
    el.querySelector('#ds-save').addEventListener('click', async () => {
      const model = el.querySelector('#ds-model').value.trim()
      if (!model) { showToast('⚠️ กรุณากรอกชื่อรุ่น', 'warning'); return }
      if (CARS.some(c => String(c.model).trim().toLowerCase() === model.toLowerCase())) { showToast('มีรุ่นนี้อยู่แล้ว', 'warning'); return }
      const colors = el.querySelector('#ds-colors').value.split(',').map(safeColor).filter(Boolean)
      try {
        await createDoc('digital_showroom', { model, badge: el.querySelector('#ds-badge').value, colors, featured: el.querySelector('#ds-feat').checked })
        close()
        showToast('✅ เพิ่ม ' + model + ' แล้ว กด 🔳 QR ติดรถ เพื่อพิมพ์ป้าย', 'success')
        await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
  await loadData()
}
