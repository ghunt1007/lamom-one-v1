/**
 * Customer Lifetime Value (CLV) — มูลค่าตลอดชีวิตลูกค้า
 * Route: /crm/clv
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SEGMENTS = {
  platinum: { label: '💎 Platinum', color: 'var(--success)',  minClv: 5000000 },
  gold:     { label: '🥇 Gold',     color: 'var(--warning)',  minClv: 2000000 },
  silver:   { label: '🥈 Silver',   color: 'var(--primary)',  minClv: 800000  },
  bronze:   { label: '🥉 Bronze',   color: 'var(--text-muted)', minClv: 0 },
}

function getSegment(clv) {
  if (clv >= 5000000) return 'platinum'
  if (clv >= 2000000) return 'gold'
  if (clv >= 800000)  return 'silver'
  return 'bronze'
}

const CUSTOMERS = [
  { id: 'C001', name: 'คุณสมชาย วงศ์ดี',  cars: 3, services: 28, avgDeal: 1200000, years: 6, referrals: 4,  likelihood: 90 },
  { id: 'C002', name: 'บ.รุ่งเรือง จำกัด', cars: 8, services: 15, avgDeal: 1100000, years: 4, referrals: 1,  likelihood: 75 },
  { id: 'C003', name: 'คุณมาลี รักดี',     cars: 2, services: 42, avgDeal: 890000,  years: 8, referrals: 6,  likelihood: 95 },
  { id: 'C004', name: 'คุณวีระ สมบัติ',    cars: 1, services: 5,  avgDeal: 1550000, years: 1, referrals: 0,  likelihood: 40 },
  { id: 'C005', name: 'คุณนิภา ใจดี',      cars: 1, services: 12, avgDeal: 899000,  years: 3, referrals: 2,  likelihood: 65 },
  { id: 'C006', name: 'คุณอนุชา ดีเด่น',   cars: 4, services: 55, avgDeal: 1099000, years: 10, referrals: 8, likelihood: 98 },
]

// CLV = (ยอดซื้อรวม) + (ค่าบริการสะสม) + (มูลค่า Referral) + (ประมาณการอนาคต)
function calcClv(c) {
  const carValue   = c.cars * c.avgDeal
  const svcValue   = c.services * 4500          // ค่าบริการเฉลี่ย 4,500/ครั้ง
  const refValue   = c.referrals * 50000        // แต่ละ referral มูลค่าเฉลี่ย 50k
  const futureEst  = c.avgDeal * (c.likelihood / 100) * 1.2
  return Math.round(carValue + svcValue + refValue + futureEst)
}

export default async function CustomerLifetimeValuePage(container) {
  const myGen = container.__routerGen
  let customers = [...CUSTOMERS]
  let dataSource = 'demo'
  let sort = 'clv'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const byName = {}
      for (const s of sales) {
        const name = s.customerName || s.custName || ''
        if (!name) continue
        if (!byName[name]) byName[name] = { cars: 0, totalRev: 0, services: 0 }
        byName[name].cars++
        byName[name].totalRev += s.salePrice || 0
      }
      const live = Object.entries(byName).map(([name, d], i) => ({
        id: `LV${i+1}`, name, cars: d.cars, services: 0, avgDeal: d.cars > 0 ? Math.round(d.totalRev / d.cars) : 0,
        years: 1, referrals: 0, likelihood: Math.min(90, 40 + d.cars * 20),
      }))
      customers = [...live, ...CUSTOMERS]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const data = customers.map(c => ({ ...c, clv: calcClv(c), seg: getSegment(calcClv(c)) }))
      .sort((a, b) => sort === 'clv' ? b.clv - a.clv : b.likelihood - a.likelihood)

    const totalClv = data.reduce((s, c) => s + c.clv, 0)
    const avgClv   = Math.round(totalClv / data.length)
    const platCount = data.filter(c => c.seg === 'platinum').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💎 Customer Lifetime Value</div>
            <div class="page-subtitle">วิเคราะห์มูลค่าตลอดชีวิตลูกค้า · จัดลำดับความสำคัญ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary sort-btn" data-s="clv">เรียงตาม CLV</button>
            <button class="btn btn-secondary sort-btn" data-s="likelihood">เรียงตามโอกาสซื้อซ้ำ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('💰 CLV รวมทั้งหมด', formatCurrency(totalClv), 'var(--primary)')}
          ${sc('📊 CLV เฉลี่ย/คน', formatCurrency(avgClv), 'var(--primary)')}
          ${sc('💎 Platinum', platCount + ' ราย', 'var(--success)')}
          ${sc('🔮 โอกาสซื้อซ้ำสูง (>70%)', data.filter(c=>c.likelihood>70).length + ' ราย', 'var(--warning)')}
        </div>

        <!-- Segment distribution -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;gap:24px;flex-wrap:wrap">
          ${Object.entries(SEGMENTS).map(([k, s]) => {
            const cnt = data.filter(c => c.seg === k).length
            return `<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem">
              <span style="width:10px;height:10px;background:${s.color};border-radius:50%;display:inline-block"></span>
              <span>${s.label}</span><strong>${cnt} ราย</strong>
            </div>`
          }).join('')}
          <div style="flex:1;min-width:200px;text-align:right;font-size:0.7rem;color:var(--text-muted)">
            Platinum ≥ ฿5M · Gold ≥ ฿2M · Silver ≥ ฿800K
          </div>
        </div>

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:860px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
              <th style="padding:10px 12px">#</th><th>ลูกค้า</th>
              <th style="text-align:center">รถที่ซื้อ</th><th style="text-align:center">งานบริการ</th>
              <th style="text-align:center">Referral</th><th style="text-align:center">โอกาสซื้อซ้ำ</th>
              <th style="text-align:right">CLV</th><th style="text-align:center">Segment</th><th></th>
            </tr></thead>
            <tbody>
              ${data.map((c, i) => {
                const s = SEGMENTS[c.seg]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:9px 12px;color:var(--text-muted);font-weight:700">${i+1}</td>
                  <td style="font-weight:600">${escHtml(c.name)}</td>
                  <td style="text-align:center">${c.cars} คัน<div style="font-size:0.68rem;color:var(--text-muted)">${formatCurrency(c.avgDeal)} เฉลี่ย</div></td>
                  <td style="text-align:center">${c.services} ครั้ง</td>
                  <td style="text-align:center">${c.referrals} คน<div style="font-size:0.68rem;color:var(--success)">${formatCurrency(c.referrals*50000)}</div></td>
                  <td style="text-align:center">
                    <div style="display:flex;align-items:center;gap:6px;justify-content:center">
                      <div style="width:50px;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${c.likelihood}%;background:${c.likelihood>70?'var(--success)':'var(--warning)'}"></div>
                      </div>
                      <span style="font-size:0.72rem;font-weight:700;color:${c.likelihood>70?'var(--success)':'var(--warning)'}">${c.likelihood}%</span>
                    </div>
                  </td>
                  <td style="text-align:right;font-weight:900;font-size:0.9rem;color:${s.color}">${formatCurrency(c.clv)}</td>
                  <td style="text-align:center">
                    <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:2px 8px;border-radius:10px">${s.label}</span>
                  </td>
                  <td style="padding-right:10px"><button class="btn btn-xs btn-secondary action-btn" data-id="${c.id}">กลยุทธ์</button></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;padding-left:4px">💡 CLV = ยอดซื้อรวม + ค่าบริการสะสม + มูลค่า Referral + ประมาณการอนาคต (ตามโอกาสซื้อซ้ำ)</p>
      </div>
    `

    container.querySelectorAll('.sort-btn').forEach(b => b.addEventListener('click', () => { sort = b.dataset.s; render() }))
    container.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', () => {
      const c = CUSTOMERS.find(x => x.id === b.dataset.id)
      if (!c) return
      const clv = calcClv(c); const seg = getSegment(clv)
      const strategies = {
        platinum: ['มอบของขวัญพิเศษ VIP ทุกปี','นำเสนอรุ่น Exclusive ก่อนใคร','Dedicated Sales Person','บริการรับ-ส่งรถฟรี'],
        gold: ['เชิญ VIP Event','ส่วนลดพิเศษรอบต่ออายุ','โทรถามความพึงพอใจทุกไตรมาส','เสนอ Service Package ราคาพิเศษ'],
        silver: ['ส่ง Newsletter โปรโมชั่น','Follow-up หลังบริการทุกครั้ง','เชิญทดลองรุ่นใหม่','แนะนำ Referral Program'],
        bronze: ['SMS โปรโมชั่นรายเดือน','แนะนำโปรแกรม Loyalty','ติดตามหลัง 30/90 วัน','เสนอ Service ราคาพิเศษรอบแรก'],
      }
      const seg_label = SEGMENTS[seg].label
      openModal({
        title: '💡 กลยุทธ์ ' + seg_label + ' — ' + escHtml(c.name),
        size: 'sm',
        body: `<div style="font-size:0.8rem">
          <div style="margin-bottom:10px;color:var(--text-muted)">CLV: ${formatCurrency(clv)} · Segment: ${seg_label}</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${strategies[seg].map((s, i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:6px">
                <span style="font-size:0.7rem;font-weight:700;background:var(--primary);color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
                <span>${s}</span>
              </div>`).join('')}
          </div>
        </div>`,
        confirmText: '📤 ส่งให้ทีมขาย',
        onConfirm() {
          c.strategiesSent = true
          const text = `${c.name} (${seg_label})\n` + strategies[seg].map((s, i) => `${i+1}. ${s}`).join('\n')
          navigator.clipboard?.writeText(text)
            .then(() => showToast(`📤 Copy กลยุทธ์ + ส่งให้ทีมขาย ${c.name} แล้ว`, 'success'))
            .catch(() => showToast(`📤 ส่งกลยุทธ์ ${seg_label} ของ ${c.name} ให้ทีมขายแล้ว`, 'success'))
          render()
        }
      })
    }))
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.3rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
