/**
 * สัดส่วนยอดขายแยกยี่ห้อ — Route: /analytics/market-share
 *
 * (v1.0.942) เดิมเป็น "ส่วนแบ่งตลาดเทียบคู่แข่ง" ที่ยอดคู่แข่งทั้งหมด (MG/Neta/Tesla ฯลฯ) เป็นตัวเลขสมมติ
 * แล้วเอายอดจริงของเราไปใส่แทนแถว "BYD (เรา)" ทั้งที่โชว์รูมไม่ได้ขาย BYD — ส่วนแบ่ง % และ "อันดับ #1" จึงไม่จริง
 * ระบบไม่มีข้อมูลยอดจดทะเบียนของตลาด เลยเปลี่ยนเป็นสิ่งที่คำนวณจากใบจองจริงได้: แต่ละยี่ห้อที่เราขาย
 * คิดเป็นกี่ % ของยอดจองเรา รายเดือน 6 เดือนล่าสุด (ไม่นับใบที่ถอน/ยกเลิก)
 */
import { listDocs } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { monthBangkok } from '../../utils/format.js'
import { escHtml } from '../../utils/escape.js'
import { isCancelled } from '../../utils/bookingStatus.js'

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const COLORS = ['#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#E53935', '#00ACC1', '#9E9E9E']

function pct(val, total) { return total > 0 ? Math.round(val / total * 1000) / 10 : 0 }

// ยี่ห้อของใบจอง: ช่องยี่ห้อ ถ้าว่างใช้คำแรกของรุ่น
export function bookingBrand(b) {
  const br = String(b?.brand || '').trim()
  if (br) return br.toUpperCase()
  const first = String(b?.model || '').trim().split(/\s+/)[0]
  return first ? first.toUpperCase() : 'ไม่ระบุ'
}

export default async function MarketSharePage(container) {
  const myGen = container.__routerGen
  const LAST6 = [5, 4, 3, 2, 1, 0].map(k => monthBangkok(-k))
  const MONTHS = LAST6.map(m => TH_M[Number(m.slice(5, 7)) - 1])
  let selectedMonth = 5
  let bookings = []

  try {
    bookings = (await listDocs('bookings', companyScopeFilters(), 'createdAt', 'desc', 2000).catch(() => []))
      .filter(b => !b.deleted && !isCancelled(b))
    if (container.__routerGen !== myGen) return
  } catch {}

  // ยี่ห้อ × เดือน
  const per = {}
  for (const b of bookings) {
    const i = LAST6.indexOf(String(b.bookingDate || '').slice(0, 7))
    if (i < 0) continue
    const k = bookingBrand(b)
    ;(per[k] ||= Array(6).fill(0))[i]++
  }
  const brands = Object.entries(per).map(([brand, data]) => ({ brand, data, sum: data.reduce((a, v) => a + v, 0) }))
    .sort((a, b) => b.sum - a.sum)
  brands.forEach((b, i) => { b.color = COLORS[Math.min(i, COLORS.length - 1)] })
  const totals = LAST6.map((_, i) => brands.reduce((a, b) => a + b.data[i], 0))
  // เริ่มที่เดือนล่าสุดที่มีใบจอง (ต้นเดือนยังไม่มี จะได้ไม่เห็นหน้าว่าง)
  for (let i = 5; i >= 0; i--) if (totals[i]) { selectedMonth = i; break }

  function render() {
    const total = totals[selectedMonth]
    const monthData = brands.map(b => ({ ...b, units: b.data[selectedMonth] })).filter(b => b.units).sort((a, b) => b.units - a.units)
    const top = monthData[0]
    const sum6 = totals.reduce((a, v) => a + v, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 สัดส่วนยอดขายแยกยี่ห้อ</div>
            <div class="page-subtitle">จากใบจองจริงของเรา (ไม่นับที่ถอน/ยกเลิก) · 6 เดือนล่าสุด</div>
          </div>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
          ${MONTHS.map((m, i) => `<button type="button" class="btn btn-xs ${i === selectedMonth ? 'btn-primary' : 'btn-secondary'} mo-btn" data-i="${i}">${m}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
          ${sc('📝 จองเดือน ' + MONTHS[selectedMonth], total + ' คัน', 'var(--primary)')}
          ${sc('🏆 ขายมากสุด', top ? escHtml(top.brand) : '—', 'var(--success)', top ? `${top.units} คัน · ${pct(top.units, total)}%` : '')}
          ${sc('🏷 จำนวนยี่ห้อที่ขาย', monthData.length + ' ยี่ห้อ', 'var(--text)')}
          ${sc('📅 รวม 6 เดือน', sum6 + ' คัน', 'var(--text)')}
        </div>

        ${!sum6 ? '<div class="card" style="padding:28px;text-align:center;color:var(--text-muted);font-size:0.85rem">ยังไม่มีใบจองใน 6 เดือนล่าสุด</div>' : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
          <div class="card" style="padding:14px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 สัดส่วนเดือน ${MONTHS[selectedMonth]}</div>
            ${total ? `<div style="height:20px;border-radius:10px;overflow:hidden;display:flex;margin-bottom:14px">
              ${monthData.map(b => `<div style="width:${pct(b.units, total)}%;background:${b.color}" title="${escHtml(b.brand)}: ${pct(b.units, total)}%"></div>`).join('')}
            </div>
            ${monthData.map(b => `
              <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
                <div style="width:10px;height:10px;border-radius:50%;background:${b.color};flex-shrink:0"></div>
                <div style="flex:1;min-width:0;font-size:0.78rem">${escHtml(b.brand)}</div>
                <div style="font-size:0.8rem;font-weight:700;text-align:right">${pct(b.units, total)}%</div>
                <div style="font-size:0.7rem;color:var(--text-muted);width:48px;text-align:right">${b.units} คัน</div>
              </div>`).join('')}` : '<div style="padding:14px;text-align:center;font-size:0.78rem;color:var(--text-muted)">ยังไม่มีใบจองเดือนนี้</div>'}
          </div>

          <div class="card" style="padding:14px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 ยอดจองแต่ละเดือน แยกยี่ห้อ</div>
            ${LAST6.map((_, i) => `<div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
                  <span style="color:${i === selectedMonth ? 'var(--primary)' : 'var(--text-muted)'};font-weight:${i === selectedMonth ? 700 : 400}">${MONTHS[i]}</span>
                  <span style="font-weight:700">${totals[i]} คัน</span>
                </div>
                <div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden;display:flex;width:${Math.round(totals[i] / Math.max(...totals, 1) * 100)}%">
                  ${brands.filter(b => b.data[i]).map(b => `<div style="width:${pct(b.data[i], totals[i])}%;background:${b.color}" title="${escHtml(b.brand)} ${b.data[i]} คัน"></div>`).join('')}
                </div>
              </div>`).join('')}
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;font-size:0.68rem;color:var(--text-muted)">
              ${brands.map(b => `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${b.color};margin-right:3px"></span>${escHtml(b.brand)}</span>`).join('')}
            </div>
          </div>
        </div>`}
      </div>
    `

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selectedMonth = parseInt(b.dataset.i); render() }))
  }

  function sc(l, v, c, sub) {
    return `<div class="card" style="padding:14px 16px;min-width:0">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.25rem;font-weight:900;color:${c};margin-top:2px;overflow-wrap:anywhere">${v}</div>
      ${sub ? `<div style="font-size:0.66rem;color:var(--text-muted)">${sub}</div>` : ''}
    </div>`
  }

  render()
}
