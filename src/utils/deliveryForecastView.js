// (v1.0.1381) หน้าตาของ "คาดการณ์ส่งมอบเดือนนี้" — ใช้ทั้งการ์ดบนหน้าภาพรวมและหน้า /analytics/delivery-forecast
// คืนเป็น HTML string ล้วน (ไม่แตะ DOM) · ตัวเลขทุกตัวมาจาก deliveryForecast() ไม่มีตัวเลขสมมติ
import { escHtml } from './escape.js'

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function ymThai(ym) { const [y, m] = String(ym).split('-').map(Number); return m ? `${TH_M[m - 1]} ${y + 543}` : '' }

export const TIER_META = {
  sure:     { label: 'ค่อนข้างแน่', dot: '🟢', color: 'success' },
  likely:   { label: 'น่าจะได้', dot: '🔵', color: 'info' },
  maybe:    { label: 'ลุ้น', dot: '🟡', color: 'warning' },
  unlikely: { label: 'น่าจะไม่ทัน', dot: '⚪', color: 'secondary' },
}

export const DFC_CSS = `
  .dfc { position:relative; overflow:hidden; border-radius:var(--radius-xl); border:1px solid var(--border); background:
      radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--primary) 22%, transparent) 0%, transparent 55%),
      radial-gradient(90% 120% at 100% 100%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 60%), var(--surface);
    padding:18px; margin-bottom:16px; }
  .dfc-top { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; align-items:center; }
  .dfc-eyebrow { font-size:0.74rem; font-weight:700; color:var(--primary); letter-spacing:.02em; display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  .dfc-big { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-top:4px; }
  .dfc-big b { font-size:clamp(2.1rem, 7vw, 3.1rem); line-height:1; font-weight:800; font-variant-numeric:tabular-nums; background:var(--grad-primary); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .dfc-big span { font-size:0.95rem; color:var(--text-2); font-weight:600; }
  .dfc-range { font-size:0.8rem; color:var(--text-muted); margin-top:4px; }
  .dfc-range b { color:var(--text-2); font-variant-numeric:tabular-nums; }
  .dfc-ring { width:118px; height:118px; flex-shrink:0; }
  .dfc-ring text { font-family:inherit; }
  .dfc-bar { position:relative; display:flex; height:16px; border-radius:999px; overflow:visible; background:var(--surface-2); margin:16px 0 6px; }
  .dfc-bar > i { display:block; height:100%; min-width:0; }
  .dfc-bar > i:first-child { border-radius:999px 0 0 999px; }
  .dfc-bar .dfc-tgt { position:absolute; top:-5px; bottom:-5px; width:2px; background:var(--text); border-radius:2px; }
  .dfc-bar .dfc-tgt::after { content:attr(data-l); position:absolute; top:-16px; left:50%; transform:translateX(-50%); font-size:0.6rem; font-weight:700; color:var(--text-2); white-space:nowrap; }
  .dfc-legend { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:0.7rem; color:var(--text-muted); }
  .dfc-legend span { display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
  .dfc-legend i { width:9px; height:9px; border-radius:3px; display:inline-block; }
  .dfc-tiles { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:14px; }
  .dfc-tile { background:color-mix(in srgb, var(--surface-2) 80%, transparent); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:10px 12px; min-width:0; }
  .dfc-tile-l { font-size:0.68rem; color:var(--text-muted); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dfc-tile-v { font-size:1.25rem; font-weight:800; font-variant-numeric:tabular-nums; margin-top:2px; white-space:nowrap; }
  .dfc-tile-v small { font-size:0.7rem; font-weight:600; color:var(--text-muted); margin-left:3px; }
  .dfc-tile-s { font-size:0.66rem; color:var(--text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dfc-narrow { display:none; }
  .dfc-foot { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-top:12px; font-size:0.68rem; color:var(--text-muted); }
  @media (max-width: 640px) {
    .dfc { padding:14px; }
    .dfc-top { grid-template-columns:minmax(0,1fr) 92px; gap:10px; }
    .dfc-ring { width:92px; height:92px; }
    .dfc-tiles { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .dfc-tile-v { font-size:1.08rem; }
    .dfc-wide { display:none; } .dfc-narrow { display:block; }
  }
`

// วงแหวน: % ของเป้า (ถ้ามีเป้า) ไม่งั้น = ส่งมอบแล้ว / คาดการณ์
export function ringSvg(fc) {
  const hasT = !!fc.target
  const pct = hasT ? fc.targetPct : (fc.expected ? Math.round(fc.delivered / fc.expected * 100) : 0)
  const shown = Math.max(0, Math.min(100, pct || 0))
  const color = hasT ? (pct >= 100 ? 'success' : pct >= 85 ? 'primary' : pct >= 60 ? 'warning' : 'danger') : 'success'
  const r = 46, c = 2 * Math.PI * r
  const dash = (shown / 100) * c
  const delivFrac = hasT ? Math.min(1, fc.delivered / fc.target) : 0
  return `<svg class="dfc-ring" viewBox="0 0 120 120" role="img" aria-label="${hasT ? `คาดว่าได้ ${pct}% ของเป้า` : `ส่งมอบแล้ว ${pct}% ของที่คาด`}">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="11"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--${color})" stroke-opacity="${hasT ? 0.45 : 1}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
    ${hasT ? `<circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--${color})" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(delivFrac * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>` : ''}
    <text x="60" y="58" text-anchor="middle" font-size="24" font-weight="800" fill="var(--text)">${pct || 0}%</text>
    <text x="60" y="76" text-anchor="middle" font-size="10" fill="var(--text-muted)">${hasT ? 'ของเป้า' : 'ส่งแล้ว'}</text>
  </svg>`
}

// แถบซ้อน: ส่งแล้ว | ค่อนข้างแน่ | น่าจะได้ | ลุ้น (ความยาวตามจำนวนคาด) + เส้นเป้า
export function stackBar(fc) {
  const sum = t => fc.items.filter(i => i.tier === t).reduce((s, i) => s + i.p, 0)
  const parts = [
    ['ส่งมอบแล้ว', fc.delivered, 'var(--success)'],
    ['ค่อนข้างแน่', sum('sure'), 'color-mix(in srgb, var(--success) 55%, transparent)'],
    ['น่าจะได้', sum('likely'), 'var(--info)'],
    ['ลุ้น', sum('maybe') + sum('unlikely'), 'color-mix(in srgb, var(--warning) 70%, transparent)'],
  ]
  const scale = Math.max(fc.best, fc.target || 0, fc.expectedRaw, 1)
  const w = v => (v / scale * 100).toFixed(2) + '%'
  return `<div class="dfc-bar">${parts.map(([l, v, c]) => v > 0 ? `<i style="width:${w(v)};background:${c}" title="${l} ≈ ${Math.round(v * 10) / 10} คัน"></i>` : '').join('')}
    ${fc.target ? `<span class="dfc-tgt" style="left:calc(${w(fc.target)} - 1px)" data-l="เป้า ${fc.target}"></span>` : ''}</div>
    <div class="dfc-legend">${parts.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l} ${Math.round(v * 10) / 10}</span>`).join('')}</div>`
}

function tile(label, val, unit, sub, color = 'text') {
  return `<div class="dfc-tile"><div class="dfc-tile-l">${label}</div><div class="dfc-tile-v" style="color:var(--${color})">${val}${unit ? `<small>${unit}</small>` : ''}</div>${sub ? `<div class="dfc-tile-s">${sub}</div>` : ''}</div>`
}

// การ์ดหลัก — opts.link = แสดงปุ่มไปหน้ารายละเอียด
export function heroHtml(fc, { link = false } = {}) {
  const tgtTile = fc.target
    ? tile('🎯 เป้าส่งมอบ', fc.target, 'คัน', fc.expected >= fc.target ? 'คาดว่าทันเป้า 🎉' : `ต้องส่งวันละ ${(fc.needPerDay || 0).toFixed(1)} คัน`, fc.expected >= fc.target ? 'success' : 'warning')
    : tile('🎯 เป้าส่งมอบ', '—', '', 'ยังไม่ได้ตั้งเป้า', 'text-muted')
  return `<div class="dfc"${link ? ' data-nav="/analytics/delivery-forecast" style="cursor:pointer" title="กดเพื่อดูรายละเอียด"' : ''}>
    <div class="dfc-top">
      <div style="min-width:0">
        <div class="dfc-eyebrow">🚚 คาดการณ์ส่งมอบ ${escHtml(ymThai(fc.ym))}<span style="color:var(--text-muted);font-weight:500">· เหลือ ${fc.daysLeft} วัน</span></div>
        <div class="dfc-big"><b>${fc.expected}</b><span>คัน (คาดการณ์)</span></div>
        <div class="dfc-range">ช่วงที่เป็นไปได้ แย่สุด <b>${fc.worst}</b> · ดีสุด <b>${fc.best}</b> คัน</div>
      </div>
      ${ringSvg(fc)}
    </div>
    ${stackBar(fc)}
    <div class="dfc-tiles">
      ${tile('✅ ส่งมอบแล้ว', fc.delivered, 'คัน', `ถึงวันที่ ${fc.day}`, 'success')}
      ${tile('📦 ใบจองที่ลุ้นได้', fc.tiers.sure + fc.tiers.likely + fc.tiers.maybe, 'ใบ', `จากที่ค้าง ${fc.open} ใบ`, 'info')}
      ${tgtTile}
      ${tile('⚠️ เสี่ยงหลุด', fc.atRisk.length, 'ใบ', fc.atRisk.length ? 'กดดูรายชื่อ' : 'ไม่มี', fc.atRisk.length ? 'danger' : 'success')}
    </div>
    <div class="dfc-foot">
      <span>คิดจากขั้นงาน วันนัดส่งมอบ ${fc.usedSupply ? 'รถในสต็อก/ใบสั่งรถ ' : ''}และประวัติจริงของร้าน${fc.history.samples ? ` (${fc.history.samples} คัน)` : ''}</span>
      ${link ? '<button type="button" class="btn btn-xs btn-primary" data-nav="/analytics/delivery-forecast">ดูรายละเอียด →</button>' : ''}
    </div>
  </div>`
}

// กราฟสะสมรายวัน: เส้นจริง (ทึบ) + เส้นคาด (ประ) + แถบแย่–ดี + เส้นเป้า
export function cumulativeSvg(fc, { W = 640, H = 220 } = {}) {
  const L = 34, R = 12, T = 14, B = 26
  const dim = fc.dim
  const perDay = Array(dim + 1).fill(0)
  fc.deliveredRows.forEach(b => { const d = Number(String(b.cutDate || b.actualDeliveryDate || '').slice(8, 10)); if (d >= 1 && d <= dim) perDay[d]++ })
  const cum = []; let s = 0
  for (let d = 1; d <= dim; d++) { s += perDay[d]; cum[d] = s }
  const lastActual = Math.max(0, fc.day - 1)
  const maxY = Math.max(fc.best, fc.target || 0, fc.delivered, 1)
  const niceMax = Math.ceil(maxY * 1.1)
  const x = d => L + (d - 0) / dim * (W - L - R)
  const y = v => T + (1 - v / niceMax) * (H - T - B)
  const startV = lastActual ? cum[lastActual] : 0
  const startX = x(lastActual)
  let actual = `M${x(0)},${y(0)}`
  for (let d = 1; d <= lastActual; d++) actual += ` L${x(d).toFixed(1)},${y(cum[d]).toFixed(1)}`
  // วันนี้: นับใบที่ตัดวันนี้ไปแล้วด้วย
  const todayV = fc.delivered
  const band = `M${startX.toFixed(1)},${y(startV).toFixed(1)} L${x(dim).toFixed(1)},${y(fc.best).toFixed(1)} L${x(dim).toFixed(1)},${y(fc.worst).toFixed(1)} Z`
  const ticks = []
  const step = niceMax <= 6 ? 1 : Math.ceil(niceMax / 5)
  for (let v = 0; v <= niceMax; v += step) ticks.push(v)
  const xt = (W < 500 ? [1, 10, 20, dim] : [1, 5, 10, 15, 20, 25, dim]).filter((d, i, a) => a.indexOf(d) === i && d <= dim)
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="กราฟยอดส่งมอบสะสมรายวัน">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border-subtle)"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end" font-size="10" fill="var(--text-muted)">${v}</text>`).join('')}
    ${xt.map(d => `<text x="${x(d)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${d}</text>`).join('')}
    <path d="${band}" fill="var(--primary)" fill-opacity="0.13"/>
    ${fc.target ? `<line x1="${L}" x2="${W - R}" y1="${y(fc.target)}" y2="${y(fc.target)}" stroke="var(--warning)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${L + 6}" y="${y(fc.target) - 5}" text-anchor="start" font-size="10.5" font-weight="700" fill="var(--warning)">เป้า ${fc.target}</text>` : ''}
    <path d="${actual}" fill="none" stroke="var(--success)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${startX.toFixed(1)}" y1="${y(startV).toFixed(1)}" x2="${x(dim).toFixed(1)}" y2="${y(fc.expectedRaw).toFixed(1)}" stroke="var(--primary)" stroke-width="2.5" stroke-dasharray="6 5"/>
    <line x1="${startX.toFixed(1)}" x2="${startX.toFixed(1)}" y1="${T}" y2="${H - B}" stroke="var(--border-light)" stroke-dasharray="2 3"/>
    <text x="${startX.toFixed(1)}" y="${T + 8}" text-anchor="${fc.day > dim * 0.8 ? 'end' : 'start'}" dx="${fc.day > dim * 0.8 ? -4 : 4}" font-size="10" fill="var(--text-muted)">วันนี้ · ส่งแล้ว ${todayV}</text>
    <circle cx="${x(dim).toFixed(1)}" cy="${y(fc.expectedRaw).toFixed(1)}" r="4.5" fill="var(--primary)"/>
    <text x="${x(dim) - 8}" y="${y(fc.expectedRaw) + (y(fc.expectedRaw) < T + 20 ? 16 : -9)}" text-anchor="end" font-size="11" font-weight="800" fill="var(--primary)">≈ ${fc.expected}</text>
  </svg>`
}

// แท่งแนวนอน (รุ่น/เซลส์): ส่งแล้ว (ทึบ) + คาดเพิ่ม (จาง)
export function splitBars(rows, { max = 8, empty = 'ยังไม่มีข้อมูล' } = {}) {
  const list = rows.slice(0, max)
  if (!list.length) return `<div style="font-size:0.78rem;color:var(--text-muted);padding:12px 0;text-align:center">${empty}</div>`
  const top = Math.max(...list.map(r => r.expected), 1)
  return list.map(r => {
    const more = Math.max(0, r.expected - r.delivered)
    return `<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:0.78rem;margin-bottom:3px">
        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${escHtml(r.key)}</span>
        <span style="flex-shrink:0;font-variant-numeric:tabular-nums;color:var(--text-2)"><b style="color:var(--success)">${r.delivered}</b> + ${Math.round(more * 10) / 10} ≈ <b>${Math.round(r.expected)}</b></span>
      </div>
      <div style="display:flex;height:8px;border-radius:999px;background:var(--surface-2);overflow:hidden">
        <i style="display:block;width:${(r.delivered / top * 100).toFixed(1)}%;background:var(--success)"></i>
        <i style="display:block;width:${(more / top * 100).toFixed(1)}%;background:var(--info);opacity:.55"></i>
      </div>
    </div>`
  }).join('')
}
