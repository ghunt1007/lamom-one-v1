/**
 * Trade-In — รับเทิร์นรถเก่า
 * Route: /dms/tradein
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addDays(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// (v1.0.522) ยอดสุทธิที่ร้านต้องจ่ายลูกค้าจริง = ราคาเสนอ - ยอดหนี้ค้างชำระที่ร้านต้องช่วยเคลียร์ให้ก่อน
// (ปกติร้านโอนตรงไปปิดยอดกับไฟแนนซ์เดิมของลูกค้า ไม่ใช่จ่ายเงินสดเต็มราคาเสนอให้ลูกค้าถือ)
function netPayout(t) { return Math.max((t.offerPrice || 0) - (t.outstandingLoan || 0), 0) }

// checklist เก็บ true = ผ่าน/ปกติ, false = มีปัญหา — คืนรายชื่อจุดที่ติ๊ก "มีปัญหา" ไว้แสดงเตือนบนการ์ด
function checklistIssues(t) {
  const cl = t.checklist || {}
  return CHECKLIST_ITEMS.filter(([k]) => cl[k] === false).map(([, label]) => label.replace(/^\S+\s/, ''))
}

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

const NEXT = { appraisal: 'offered', offered: 'accepted', accepted: 'received', received: 'sold' }

// (v1.0.522) เดิมประเมินสภาพรถแค่ตัวคูณเกรด A-D ตัวเดียว ไม่มี checklist จริง และไม่มีช่องยอดหนี้ค้างชำระ
// (ไฟแนนซ์/เช่าซื้อที่ยังผ่อนไม่หมด) ทั้งที่รถเทิร์นส่วนใหญ่ในไทยยังมีภาระผ่อนค้างอยู่จริง — ถ้าไม่เคลียร์ยอดนี้
// ก่อนขายต่อ ร้านมีความเสี่ยงทางการเงิน/กฎหมายจริง เพิ่ม checklist สภาพ 5 จุด + ช่องยอดหนี้ค้างชำระ
const CHECKLIST_ITEMS = [
  ['exterior', '🚗 ตัวถัง/สี'], ['interior', '💺 ภายใน'], ['mechanical', '🔧 เครื่องยนต์/ระบบ'],
  ['tires', '🛞 ยาง/ช่วงล่าง'], ['documents', '📄 เอกสาร/เล่มทะเบียนครบ'],
]

export default async function TradeInPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let items = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { items = await listDocs('trade_ins', companyScopeFilters(), 'date', 'desc', 200) } catch (e) { items = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = items.filter(t => statusFilter === 'all' || t.status === statusFilter)
    const active = items.filter(t => !['sold','declined'].includes(t.status)).length
    // (v1.0.522) เดิมรวมยอด "มูลค่ารับเทิร์น" จากราคาเสนอเต็ม (offerPrice) ไม่หักหนี้ค้างชำระ ทำให้ตัวเลขไม่ใช่
    // เงินสดที่ร้านต้องจ่ายจริง — เปลี่ยนเป็นยอดสุทธิ (netPayout = offerPrice - outstandingLoan) แทน
    const totalOffered = items.filter(t => ['accepted','received','sold'].includes(t.status)).reduce((a, t) => a + netPayout(t), 0)
    const totalLoans = items.filter(t => !['sold','declined'].includes(t.status)).reduce((a, t) => a + (t.outstandingLoan || 0), 0)
    const conversionRate = Math.round(items.filter(t => ['accepted','received','sold'].includes(t.status)).length / items.filter(t => t.status !== 'appraisal').length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔄 Trade-In</div>
            <div class="page-subtitle">รับเทิร์นรถเก่า — ประเมิน เสนอราคา รับรถ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-ti-btn">+ ประเมินรถเทิร์น</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
          ${kpi('🔄 กำลังดำเนินการ', active, 'primary')}
          ${kpi('💰 มูลค่ารับเทิร์นสุทธิ', formatCurrency(totalOffered), 'warning')}
          ${kpi('🏦 หนี้ค้างชำระรวม', formatCurrency(totalLoans), totalLoans > 0 ? 'danger' : 'secondary')}
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
                  ${t.accidentHistory ? `<div style="font-size:0.68rem;color:var(--danger);font-weight:700">⚠️ มีประวัติอุบัติเหตุ</div>` : ''}
                  ${checklistIssues(t).length ? `<div style="font-size:0.68rem;color:var(--warning)">🔍 มีปัญหา: ${checklistIssues(t).join(', ')}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${ts?.color}" style="font-size:0.63rem">${ts?.icon} ${ts?.label}</span>
                  <div style="font-size:0.7rem;color:var(--text-muted)">ตลาด ${formatCurrency(t.marketPrice)}</div>
                  <div style="font-size:0.85rem;font-weight:700;color:var(--success)">เสนอ ${formatCurrency(t.offerPrice)}</div>
                  ${t.outstandingLoan > 0 ? `<div style="font-size:0.68rem;color:var(--danger)">🏦 หนี้ค้าง ${formatCurrency(t.outstandingLoan)}</div><div style="font-size:0.78rem;font-weight:800;color:var(--accent)">สุทธิ ${formatCurrency(netPayout(t))}</div>` : ''}
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
    container.querySelectorAll('.next-btn').forEach(b => b.addEventListener('click', async () => {
      const t = items.find(x => x.id === b.dataset.id)
      if (!t) return
      const newStatus = NEXT[t.status]
      try {
        await updateDocData('trade_ins', t.id, { status: newStatus })
        showToast(`${TRADEIN_STATUS[newStatus]?.icon} ${TRADEIN_STATUS[newStatus]?.label}`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.decline-btn').forEach(b => b.addEventListener('click', async () => {
      const t = items.find(x => x.id === b.dataset.id)
      if (!t) return
      try { await updateDocData('trade_ins', t.id, { status: 'declined' }); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
        <div class="input-group"><label class="input-label">🏦 ยอดหนี้ค้างชำระ (บาท)</label><input class="input" type="number" id="ti-loan" value="${t?.outstandingLoan||0}" placeholder="0 ถ้าไม่มีภาระผ่อน"></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:0.8rem;cursor:pointer;align-self:end;padding-bottom:8px">
          <input type="checkbox" id="ti-accident" ${t?.accidentHistory?'checked':''} style="accent-color:var(--danger);width:15px;height:15px"> ⚠️ มีประวัติอุบัติเหตุ
        </label>
        <div style="grid-column:1/-1">
          <label class="input-label">🔍 ตรวจสภาพ (ติ๊ก = ปกติ, ไม่ติ๊ก = มีปัญหา)</label>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px">
            ${CHECKLIST_ITEMS.map(([k,l]) => `<label style="display:flex;align-items:center;gap:5px;font-size:0.78rem;cursor:pointer">
              <input type="checkbox" class="ti-check" data-k="${k}" ${(t?.checklist?.[k] ?? true) ? 'checked' : ''}> ${l}
            </label>`).join('')}
          </div>
        </div>
      </div>
      <p style="font-size:0.72rem;color:var(--text-muted);margin-top:8px">💡 ราคาเสนอ = ราคาตลาด × ตัวคูณเกรด · ยอดสุทธิที่จ่ายลูกค้า = ราคาเสนอ − หนี้ค้างชำระ (ร้านโอนปิดยอดไฟแนนซ์เดิมให้ลูกค้าโดยตรง)</p>`,
      async onConfirm() {
        const name = document.getElementById('ti-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        const market = parseInt(document.getElementById('ti-market')?.value) || 0
        const grade = document.getElementById('ti-grade')?.value || 'B'
        const offer = Math.round(market * CONDITION_GRADES[grade].adj)
        const mileage = parseInt(document.getElementById('ti-mileage')?.value) || (t?.mileage || 0)
        const outstandingLoan = parseInt(document.getElementById('ti-loan')?.value) || 0
        const accidentHistory = document.getElementById('ti-accident')?.checked || false
        const checklist = {}
        document.querySelectorAll('.ti-check').forEach(cb => { checklist[cb.dataset.k] = cb.checked })
        try {
          if (t) {
            await updateDocData('trade_ins', t.id, { grade, marketPrice: market, offerPrice: offer, mileage, outstandingLoan, accidentHistory, checklist, status: 'offered' })
          } else {
            await createDoc('trade_ins', {
              customer:name, oldCar:document.getElementById('ti-car')?.value||'—', plate:document.getElementById('ti-plate')?.value||'—',
              mileage, grade, marketPrice:market, offerPrice:offer, outstandingLoan, accidentHistory, checklist,
              status:'appraisal', newCar:document.getElementById('ti-newcar')?.value||'—', date:addDays(0),
              companyId: myEffectiveCompanyId(),
            })
          }
          showToast(`✅ ประเมินแล้ว — เสนอ ${formatCurrency(offer)}${outstandingLoan ? ` (สุทธิ ${formatCurrency(Math.max(offer-outstandingLoan,0))})` : ''}`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
