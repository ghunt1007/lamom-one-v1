/**
 * Trade-In — รับเทิร์นรถเก่า
 * Route: /dms/tradein
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const TRADEIN_STATUS = {
  appraisal: { label: 'รอประเมิน', color: 'secondary', icon: '🔍' },
  offered:   { label: 'เสนอราคาแล้ว', color: 'primary', icon: '💰' },
  accepted:  { label: 'ลูกค้าตกลง', color: 'success', icon: '✅' },
  received:  { label: 'รับรถแล้ว', color: 'warning', icon: '🚗' },
  sold:      { label: 'ขายต่อแล้ว', color: 'success', icon: '🏁' },
  declined:  { label: 'ลูกค้าปฏิเสธ', color: 'danger', icon: '❌' },
}

const CONDITION_GRADES = {
  A: { label: 'A — สภาพดีมาก', adj: 1.0 },
  B: { label: 'B — สภาพดี', adj: 0.92 },
  C: { label: 'C — พอใช้', adj: 0.82 },
  D: { label: 'D — ต้องซ่อมเยอะ', adj: 0.70 },
}

const DEMO_TRADEINS = [
  { id: 'TI001', customer: 'สมชาย ใจดี', oldCar: 'Toyota Camry 2018', plate: '1กข-1111', mileage: 85000, grade: 'B', marketPrice: 650000, offerPrice: 598000, status: 'accepted', newCar: 'BYD Seal AWD', date: addDays(-5) },
  { id: 'TI002', customer: 'มาลี สุขใจ', oldCar: 'Honda City 2020', plate: '2ขค-2222', mileage: 42000, grade: 'A', marketPrice: 420000, offerPrice: 420000, status: 'received', newCar: 'BYD Dolphin', date: addDays(-12) },
  { id: 'TI003', customer: 'ธนพล เที่ยงตรง', oldCar: 'Mazda 2 2017', plate: '3คง-3333', mileage: 120000, grade: 'C', marketPrice: 280000, offerPrice: 229600, status: 'offered', newCar: 'MG4 Electric', date: addDays(-2) },
  { id: 'TI004', customer: 'อรทัย ตั้งใจ', oldCar: 'Nissan Almera 2019', plate: '4งจ-4444', mileage: 65000, grade: 'B', marketPrice: 310000, offerPrice: 285200, status: 'appraisal', newCar: 'BYD Atto 3', date: addDays(0) },
  { id: 'TI005', customer: 'วิรัช เก่งมาก', oldCar: 'Toyota Vios 2015', plate: '5จฉ-5555', mileage: 180000, grade: 'D', marketPrice: 180000, offerPrice: 126000, status: 'declined', newCar: '—', date: addDays(-20) },
]

const NEXT = { appraisal: 'offered', offered: 'accepted', accepted: 'received', received: 'sold' }

export default async function TradeInPage(container) {
  const myGen = container.__routerGen
  let items = DEMO_TRADEINS.map(t => ({ ...t }))
  let dataSource = 'demo'
  let statusFilter = 'all'

  try {
    const docs = await listDocs('trade_ins', [], 'date', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `TI${String(i+1).padStart(3,'0')}`,
        customer: d.customer || d.customerName || 'ลูกค้า',
        oldCar: d.oldCar || d.vehicleName || '',
        plate: d.plate || d.licensePlate || '',
        mileage: d.mileage || 0,
        grade: d.grade || 'B',
        marketPrice: d.marketPrice || 0,
        offerPrice: d.offerPrice || 0,
        status: d.status || 'appraisal',
        newCar: d.newCar || '',
        date: d.date || d.createdAt?.slice(0, 10) || '',
      }))
      items = [...mapped, ...DEMO_TRADEINS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = items.filter(t => statusFilter === 'all' || t.status === statusFilter)
    const active = items.filter(t => !['sold','declined'].includes(t.status)).length
    const totalOffered = items.filter(t => ['accepted','received','sold'].includes(t.status)).reduce((a, t) => a + t.offerPrice, 0)
    const conversionRate = Math.round(items.filter(t => ['accepted','received','sold'].includes(t.status)).length / items.filter(t => t.status !== 'appraisal').length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔄 Trade-In</div>
            <div class="page-subtitle">รับเทิร์นรถเก่า — ประเมิน เสนอราคา รับรถ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-ti-btn">+ ประเมินรถเทิร์น</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔄 กำลังดำเนินการ', active, 'primary')}
          ${kpi('💰 มูลค่ารับเทิร์น', formatCurrency(totalOffered), 'warning')}
          ${kpi('📊 Conversion', conversionRate + '%', conversionRate >= 60 ? 'success' : 'warning')}
          ${kpi('📋 ทั้งหมด', items.length, 'secondary')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(TRADEIN_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(t => {
            const ts = TRADEIN_STATUS[t.status]
            const next = NEXT[t.status]
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${ts?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(t.oldCar)} <span style="font-size:0.7rem;color:var(--text-muted)">(${escHtml(t.plate)})</span></div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👤 ${escHtml(t.customer)} · 🛣 ${t.mileage.toLocaleString()} km · เกรด ${escHtml(t.grade)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🚗 เทิร์นเพื่อซื้อ: ${escHtml(t.newCar)} · ${formatDate(t.date)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ts?.color}" style="font-size:0.63rem">${ts?.icon} ${ts?.label}</span>
                  <div style="font-size:0.7rem;color:var(--text-muted)">ตลาด ${formatCurrency(t.marketPrice)}</div>
                  <div style="font-size:0.85rem;font-weight:700;color:var(--success)">เสนอ ${formatCurrency(t.offerPrice)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                ${next ? `<button class="btn btn-xs btn-${TRADEIN_STATUS[next]?.color} next-btn" data-id="${t.id}">${TRADEIN_STATUS[next]?.icon} → ${TRADEIN_STATUS[next]?.label}</button>` : ''}
                ${t.status === 'offered' ? `<button class="btn btn-xs btn-danger decline-btn" data-id="${t.id}">❌ ปฏิเสธ</button>` : ''}
                ${t.status === 'appraisal' ? `<button class="btn btn-xs btn-secondary regrade-btn" data-id="${t.id}">🔍 ประเมินใหม่</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', () => {
      const t = items.find(x => x.id === b.dataset.id)
      if (t) { t.status = NEXT[t.status]; showToast(`${TRADEIN_STATUS[t.status]?.icon} ${TRADEIN_STATUS[t.status]?.label}`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.decline-btn').forEach(b => b.addEventListener('click', () => {
      const t = items.find(x => x.id === b.dataset.id); if (t) { t.status = 'declined'; renderPage() }
    }))
    container.querySelectorAll('.regrade-btn').forEach(b => b.addEventListener('click', () => {
      const t = items.find(x => x.id === b.dataset.id); if (t) openAppraisalModal(t)
    }))
    document.getElementById('add-ti-btn')?.addEventListener('click', () => openAppraisalModal())
  }

  function openAppraisalModal(t = null) {
    openModal({
      title: t ? '🔍 ประเมินใหม่: ' + escHtml(t.oldCar) : '+ ประเมินรถเทิร์น',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="ti-name" value="${escHtml(t?.customer||'')}"></div>
        <div class="input-group"><label class="input-label">รถเก่า (ยี่ห้อ รุ่น ปี)</label><input class="input" id="ti-car" value="${escHtml(t?.oldCar||'')}" placeholder="Toyota Camry 2018"></div>
        <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="ti-plate" value="${escHtml(t?.plate||'')}"></div>
        <div class="input-group"><label class="input-label">เลขไมล์ (km)</label><input class="input" type="number" id="ti-mileage" value="${t?.mileage||0}"></div>
        <div class="input-group"><label class="input-label">ราคาตลาด (บาท)</label><input class="input" type="number" id="ti-market" value="${t?.marketPrice||0}"></div>
        <div class="input-group"><label class="input-label">เกรดสภาพ</label>
          <select class="input" id="ti-grade">${Object.entries(CONDITION_GRADES).map(([k,v])=>`<option value="${k}" ${t?.grade===k?'selected':''}>${v.label} (×${v.adj})</option>`).join('')}</select>
        </div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">รถใหม่ที่สนใจ</label><input class="input" id="ti-newcar" value="${escHtml(t?.newCar||'')}"></div>
      </div>
      <p style="font-size:0.72rem;color:var(--text-muted);margin-top:8px">💡 ราคาเสนอ = ราคาตลาด × ตัวคูณเกรด</p>`,
      onConfirm() {
        const name = document.getElementById('ti-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
        const market = parseInt(document.getElementById('ti-market')?.value) || 0
        const grade = document.getElementById('ti-grade')?.value || 'B'
        const offer = Math.round(market * CONDITION_GRADES[grade].adj)
        if (t) {
          t.grade = grade; t.marketPrice = market; t.offerPrice = offer; t.mileage = parseInt(document.getElementById('ti-mileage')?.value) || t.mileage
          t.status = 'offered'
        } else {
          items.unshift({ id:`TI${String(items.length+1).padStart(3,'0')}`, customer:name, oldCar:document.getElementById('ti-car')?.value||'—', plate:document.getElementById('ti-plate')?.value||'—', mileage:parseInt(document.getElementById('ti-mileage')?.value)||0, grade, marketPrice:market, offerPrice:offer, status:'appraisal', newCar:document.getElementById('ti-newcar')?.value||'—', date:addDays(0) })
        }
        showToast(`✅ ประเมินแล้ว — เสนอ ${formatCurrency(offer)}`, 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
