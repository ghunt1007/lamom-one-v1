// (v1.0.1382) หน้าตากระดานสถานะใบจอง (HTML string ล้วน) — ข้อมูลจาก statusBoard()
import { escHtml } from './escape.js'

const money = v => {
  const n = Number(v) || 0
  if (n >= 1e6) return '฿' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + ' ล้าน'
  if (n >= 1e3) return '฿' + Math.round(n / 1e3).toLocaleString('th-TH') + 'K'
  return '฿' + n.toLocaleString('th-TH')
}
const ageColor = a => a == null ? 'text-muted' : a >= 30 ? 'danger' : a >= 14 ? 'warning' : 'success'

export const SB_CSS = `
  .sb { margin-bottom:16px; }
  .sb-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
  .sb-title { font-weight:800; font-size:1rem; display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
  .sb-title small { font-size:0.74rem; font-weight:600; color:var(--primary); }
  .sb-seg { display:inline-flex; background:var(--surface-2); border:1px solid var(--border); border-radius:999px; padding:3px; gap:2px; }
  .sb-seg button { border:0; background:transparent; color:var(--text-muted); font:inherit; font-size:0.74rem; font-weight:600; padding:5px 12px; border-radius:999px; cursor:pointer; white-space:nowrap; }
  .sb-seg button.on { background:var(--primary); color:#fff; box-shadow:0 2px 8px var(--primary-glow); }
  .sb-sum { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:12px; }
  .sb-tile { position:relative; text-align:left; font:inherit; color:inherit; cursor:pointer; overflow:hidden; min-width:0;
    border:1px solid var(--border); border-radius:var(--radius-lg); padding:12px 14px;
    background:linear-gradient(135deg, color-mix(in srgb, var(--c) 16%, var(--surface)) 0%, var(--surface) 70%); transition:transform .15s, border-color .15s, box-shadow .15s; }
  .sb-tile:hover { transform:translateY(-2px); border-color:var(--c); box-shadow:0 8px 20px color-mix(in srgb, var(--c) 20%, transparent); }
  .sb-tile-l { font-size:0.74rem; font-weight:700; color:var(--text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sb-tile-v { font-size:clamp(1.5rem, 4.2vw, 2.1rem); font-weight:800; line-height:1.15; font-variant-numeric:tabular-nums; color:var(--c); margin-top:2px; }
  .sb-tile-v small { font-size:0.75rem; font-weight:600; color:var(--text-muted); margin-left:4px; }
  .sb-tile-s { font-size:0.68rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sb-flow { display:flex; height:12px; border-radius:999px; overflow:hidden; background:var(--surface-2); margin:4px 0 6px; }
  .sb-flow i { display:block; height:100%; }
  .sb-flow-l { display:flex; flex-wrap:wrap; gap:3px 12px; font-size:0.7rem; color:var(--text-muted); margin-bottom:12px; }
  .sb-flow-l span { display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
  .sb-flow-l i { width:9px; height:9px; border-radius:3px; }
  .sb-groups { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .sb-group { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; min-width:0; display:flex; flex-direction:column; }
  .sb-gh { display:flex; align-items:center; gap:10px; width:100%; text-align:left; font:inherit; color:inherit; cursor:pointer; border:0; padding:12px 14px;
    background:linear-gradient(120deg, color-mix(in srgb, var(--c) 22%, transparent), transparent 80%); border-bottom:1px solid var(--border-subtle); }
  .sb-gh-ic { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; font-size:1.05rem; background:color-mix(in srgb, var(--c) 22%, var(--surface)); flex-shrink:0; }
  .sb-gh-t { flex:1; min-width:0; }
  .sb-gh-t b { display:block; font-size:0.84rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sb-gh-t span { font-size:0.66rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
  .sb-gh-n { text-align:right; flex-shrink:0; }
  .sb-gh-n b { display:block; font-size:1.45rem; font-weight:800; line-height:1; color:var(--c); font-variant-numeric:tabular-nums; }
  .sb-gh-n span { font-size:0.64rem; color:var(--text-muted); white-space:nowrap; }
  .sb-st { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:2px 10px; align-items:center; width:100%; text-align:left; font:inherit; color:inherit; cursor:pointer;
    background:transparent; border:0; border-bottom:1px solid var(--border-subtle); padding:9px 14px; transition:background .12s; }
  .sb-st:last-child { border-bottom:0; }
  .sb-st:hover { background:var(--surface-2); }
  .sb-st.zero { opacity:.5; }
  .sb-st-n { font-size:0.82rem; font-weight:600; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sb-st-c { font-size:1.15rem; font-weight:800; font-variant-numeric:tabular-nums; text-align:right; grid-row:span 2; }
  .sb-st-c small { font-size:0.66rem; color:var(--text-muted); font-weight:600; margin-left:2px; }
  .sb-st-m { font-size:0.66rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sb-delta { display:block; font-size:0.64rem; font-weight:700; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .sb-cmp { font-size:0.7rem; color:var(--text-muted); margin:-4px 0 8px; }
  .sb-cmp .sb-delta { display:inline; }
  .sb-bar { grid-column:1 / -1; height:4px; border-radius:999px; background:var(--surface-2); overflow:hidden; margin-top:3px; }
  .sb-bar i { display:block; height:100%; background:var(--c); border-radius:999px; }
  @media (max-width: 1180px) { .sb-groups { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width: 640px) {
    .sb-sum { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .sb-tile { padding:10px 12px; }
    .sb-groups { grid-template-columns:minmax(0,1fr); gap:10px; }
  }
`

// (v1.0.1393) ▲/▼ เทียบกับภาพเก่า (prev = pickPrevCounts) — ค้างเพิ่ม = สีส้ม ลด = สีเขียว (หมวดรถมาแล้วรอส่งมอบ เป็นสีกลาง)
function deltaHtml(now, before, { neutral = false, label = '' } = {}) {
  if (before == null) return ''
  const d = now - before
  const color = d === 0 || neutral ? 'text-muted' : d > 0 ? 'warning' : 'success'
  return `<span class="sb-delta" style="color:var(--${color})" title="${escHtml(label)} มี ${before}">${d === 0 ? '= เท่าเดิม' : (d > 0 ? '▲' : '▼') + Math.abs(d)}</span>`
}
const dm = d => { const [, m, dd] = String(d || '').split('-'); return dd ? `${dd}/${m}` : '' }

export function statusBoardHtml(board, { periodLabel = '', scope = 'open', prev = null } = {}) {
  const pv = scope === 'open' && prev ? prev : null
  const pvLabel = pv ? (pv.weekAgo ? `สัปดาห์ก่อน (${dm(pv.date)})` : `วันที่ ${dm(pv.date)}`) : ''
  const s = board.summary
  const tile = (key, icon, label, val, sub, color) => `<button type="button" class="sb-tile" data-sb="${key}" style="--c:var(--${color})">
    <div class="sb-tile-l">${icon} ${label}</div><div class="sb-tile-v">${val}<small>${key === 'pending' ? 'ใบ' : 'คัน'}</small></div><div class="sb-tile-s">${sub}</div></button>`
  const total = Math.max(1, s.pending)
  const groupsWith = board.groups.filter(g => g.count)
  const maxStatus = Math.max(1, ...board.groups.flatMap(g => g.items.map(i => i.count)))
  return `<div class="sb">
    <div class="sb-head">
      <div class="sb-title">🗂 สถานะใบจอง <small>${escHtml(periodLabel)}</small></div>
      <div class="sb-seg" role="tablist" aria-label="ขอบเขตใบจองที่ค้าง">
        <button type="button" data-sbscope="open" class="${scope === 'open' ? 'on' : ''}">ค้างทั้งหมด</button>
        <button type="button" data-sbscope="period" class="${scope === 'period' ? 'on' : ''}">เฉพาะที่จองช่วงนี้</button>
      </div>
    </div>
    <div class="sb-sum">
      ${tile('booked', '📝', 'จองใหม่', s.booked, `ยังไม่ถอน ${s.active} คัน`, 'primary')}
      ${tile('delivered', '✅', 'ส่งมอบ/ตัดตัวเลข', s.delivered, `ส่งถึงมือ ${s.handedOver} · ตัดรอส่ง ${s.cutWaiting}`, 'success')}
      ${tile('withdrawn', '❌', 'ถอนจอง', s.withdrawn, s.booked ? `${Math.round(s.withdrawn / s.booked * 100)}% ของที่จอง` : 'ในช่วงที่เลือก', 'danger')}
      ${tile('pending', '⏳', scope === 'open' ? 'ค้างอยู่ตอนนี้' : 'ที่จองช่วงนี้ยังค้าง', s.pending, money(s.pendingValue), 'warning')}
    </div>
    ${pv ? `<div class="sb-cmp">เทียบกับ${escHtml(pvLabel)}: ใบค้างรวม ${deltaHtml(s.pending, pv.counts.pending, { label: pvLabel })}</div>` : ''}
    ${s.pending ? `<div class="sb-flow" aria-hidden="true">${groupsWith.map(g => `<i style="width:${(g.count / total * 100).toFixed(2)}%;background:var(--${g.color})"></i>`).join('')}</div>
    <div class="sb-flow-l">${groupsWith.map(g => `<span><i style="background:var(--${g.color})"></i>${g.icon} ${escHtml(g.label)} ${g.count}</span>`).join('')}</div>` : ''}
    <div class="sb-groups">
      ${board.groups.map(g => `<div class="sb-group" style="--c:var(--${g.color})">
        <button type="button" class="sb-gh" data-sbg="${escHtml(g.key)}" title="กดดูรายชื่อทั้งหมวด">
          <span class="sb-gh-ic">${g.icon}</span>
          <span class="sb-gh-t"><b>${escHtml(g.label)}</b><span>${escHtml(g.hint)}</span></span>
          <span class="sb-gh-n"><b>${g.count}</b><span>${money(g.value)}</span>${pv ? deltaHtml(g.count, pv.counts[g.key], { neutral: g.key === 'ready', label: pvLabel }) : ''}</span>
        </button>
        ${g.items.map(i => `<button type="button" class="sb-st${i.count ? '' : ' zero'}" data-sbs="${escHtml(i.status)}" title="กดดูรายชื่อ ${escHtml(i.status)}">
          <span class="sb-st-n">${escHtml(i.status)}</span>
          <span class="sb-st-c">${i.count}<small>ใบ</small></span>
          <span class="sb-st-m">${i.count ? `${money(i.value)}${i.avgAge != null ? ` · <span style="color:var(--${ageColor(i.avgAge)})">เฉลี่ย ${i.avgAge} วัน</span>` : ''}${i.maxAge >= 30 ? ` · นานสุด ${i.maxAge}` : ''}` : 'ไม่มี'}${i.note ? ` · ${escHtml(i.note)}` : ''}</span>
          <span class="sb-bar"><i style="width:${(i.count / maxStatus * 100).toFixed(1)}%"></i></span>
        </button>`).join('')}
      </div>`).join('')}
    </div>
  </div>`
}
