// (v1.0.1439) หน้าตา "ศูนย์คาดการณ์" — การ์ดทุกเรื่องจาก forecastCards() ในกริดเดียว · ฟังก์ชันล้วน คืน HTML
import { escHtml } from './escape.js'
import { baht } from './forecastOverview.js'

export const FH_CSS = `
  .fh-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr)); gap:12px; margin-bottom:18px; }
  .fh-card { position:relative; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px 16px 12px; min-width:0;
    display:flex; flex-direction:column; gap:6px; cursor:pointer; transition:border-color .15s, transform .15s; overflow:hidden; }
  .fh-card::before { content:''; position:absolute; inset:0 0 auto 0; height:3px; background:linear-gradient(90deg,var(--primary),var(--accent,var(--info))); opacity:.85; }
  .fh-card:hover { border-color:var(--primary); transform:translateY(-1px); }
  .fh-card.off { cursor:default; opacity:.62; }
  .fh-card.off::before { background:var(--border); }
  .fh-card.off:hover { transform:none; border-color:var(--border); }
  .fh-t { font-size:0.78rem; font-weight:700; color:var(--text-2); display:flex; gap:6px; align-items:center; }
  .fh-v { font-size:1.9rem; font-weight:800; line-height:1.1; font-variant-numeric:tabular-nums; letter-spacing:-.5px; overflow-wrap:anywhere; }
  .fh-v small { font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-left:4px; letter-spacing:0; }
  .fh-r { font-size:0.72rem; color:var(--text-muted); }
  .fh-bar { position:relative; height:8px; border-radius:99px; background:var(--surface-2); overflow:hidden; margin-top:2px; }
  .fh-bar i { position:absolute; inset:0 auto 0 0; border-radius:99px; background:var(--success); }
  .fh-bar b { position:absolute; top:0; bottom:0; border-radius:99px; background:color-mix(in srgb, var(--primary) 35%, transparent); }
  .fh-bar u { position:absolute; top:-2px; bottom:-2px; width:2px; background:var(--warning); }
  .fh-n { font-size:0.74rem; color:var(--text-2); line-height:1.45; }
  .fh-why { font-size:0.76rem; color:var(--text-muted); line-height:1.5; }
  .fh-go { margin-top:auto; font-size:0.72rem; color:var(--primary); font-weight:600; }
  .fh-ready { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px 16px; margin-bottom:18px; display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:12px 20px; }
  .fh-ready-h { grid-column:1/-1; font-weight:700; font-size:0.9rem; }
  .fh-ready-h span { font-size:0.72rem; font-weight:400; color:var(--text-muted); margin-left:4px; }
  .fh-ready-row { display:flex; flex-direction:column; gap:4px; min-width:0; }
  .fh-ready-t { display:flex; justify-content:space-between; gap:8px; font-size:0.8rem; font-weight:600; }
  .fh-ready-t span { min-width:0; overflow-wrap:anywhere; }
`

const fmt = (c, v) => c.money ? baht(v) : Math.round(v).toLocaleString('en-US')

// แถบ: เขียว = ได้แล้ว · ฟ้าอ่อน = ช่วงที่คาด (ต่ำสุด–สูงสุด) · เส้นเหลือง = เป้า
function bar(c) {
  if (c.soFar == null) return ''
  const top = Math.max(c.hi ?? c.value, c.value, c.target || 0, c.soFar, 1)
  const pct = v => Math.max(0, Math.min(100, v / top * 100)).toFixed(1)
  const lo = c.lo ?? c.value, hi = c.hi ?? c.value
  return `<div class="fh-bar" role="img" aria-label="${escHtml(c.soFarText || '')} จากที่คาด ${fmt(c, c.value)}">
    <b style="left:${pct(lo)}%;width:${(pct(hi) - pct(lo)).toFixed(1)}%"></b><i style="width:${pct(c.soFar)}%"></i>${c.target ? `<u style="left:calc(${pct(c.target)}% - 1px)" title="เป้า"></u>` : ''}</div>`
}

export function forecastHubHtml(cards = []) {
  return `<div class="fh-grid">${cards.map(c => c.ok ? `
    <div class="fh-card" data-nav="${escHtml(c.path)}" title="กดเพื่อดูรายละเอียด">
      <div class="fh-t"><span>${c.icon}</span><span>${escHtml(c.title)}</span></div>
      <div class="fh-v">${c.display != null ? `<span style="font-size:${String(c.display).length > 9 ? '1.25rem' : '1.7rem'}">${escHtml(c.display)}</span>` : `≈ ${fmt(c, c.value)}${c.unit ? `<small>${escHtml(c.unit)}</small>` : ''}`}</div>
      ${c.lo != null && c.hi != null && c.hi > c.lo ? `<div class="fh-r">ช่วงที่เป็นไปได้ ${fmt(c, c.lo)}–${fmt(c, c.hi)}${c.unit ? ' ' + escHtml(c.unit) : ''}</div>` : ''}
      ${bar(c)}
      ${c.soFarText ? `<div class="fh-n"><b>${escHtml(c.soFarText)}</b></div>` : ''}
      ${c.note ? `<div class="fh-n">${escHtml(c.note)}</div>` : ''}
      <div class="fh-go">ดูรายละเอียด →</div>
    </div>` : `
    <div class="fh-card off">
      <div class="fh-t"><span>${c.icon}</span><span>${escHtml(c.title)}</span></div>
      <div class="fh-v" style="font-size:1.3rem">—</div>
      <div class="fh-why">ยังคาดไม่ได้: ${escHtml(c.why)}</div>
    </div>`).join('')}</div>`
}

// (v1.0.1449) กล่อง "ข้อมูลที่ช่วยให้แม่นขึ้น" — แถบ % กรอกครบ + บอกว่าช่วยการ์ดไหน และทำยังไง (ต่ำสุดขึ้นก่อน)
export function readinessHtml(items = []) {
  if (!items.length) return ''
  const col = r => r >= 0.8 ? 'var(--success)' : r >= 0.5 ? 'var(--warning)' : 'var(--danger)'
  return `<div class="fh-ready">
    <div class="fh-ready-h">🧩 ข้อมูลที่ช่วยให้คาดการณ์แม่นขึ้น <span>90 วันล่าสุด · กรอกครบเกิน 80% ดีมาก</span></div>
    ${items.map(i => `<div class="fh-ready-row">
      <div class="fh-ready-t"><span>${escHtml(i.label)}</span><b style="color:${col(i.rate)}">${Math.round(i.rate * 100)}%</b></div>
      <div class="fh-bar" role="img" aria-label="${Math.round(i.rate * 100)}%"><i style="width:${(i.rate * 100).toFixed(1)}%;background:${col(i.rate)}"></i></div>
      <div class="fh-why">${i.done}/${i.n} · ช่วย: ${escHtml(i.helps)}${i.rate < 0.8 ? ` · วิธี: ${escHtml(i.how)}` : ''}</div>
    </div>`).join('')}
  </div>`
}
