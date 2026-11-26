// (v1.0.1381) 🚚 คาดการณ์ส่งมอบเดือนนี้ — เดือนนี้จะส่งมอบ (ตัดตัวเลข) ได้กี่คัน ช่วงแย่–ดี เทียบเป้า
// ใบไหนเสี่ยงหลุด แยกตามรุ่น/เซลส์ · ตัวเลขมาจาก utils/deliveryForecast.js (ฟังก์ชันล้วน มีเทส)
import { navigate } from '../../core/router.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency, todayBangkok } from '../../utils/format.js'
import { escHtml } from '../../utils/escape.js'
import { loadDeliveryForecast } from '../../utils/deliveryForecastData.js'
import { deliveryForecastText, forecastAccuracy, targetPath } from '../../utils/deliveryForecast.js'
import { listDocs } from '../../core/db.js'
import { DFC_CSS, heroHtml, cumulativeSvg, splitBars, TIER_META, ymThai } from '../../utils/deliveryForecastView.js'
import { monthStats, shiftYm } from '../../utils/dashStats.js'
import { bookingNextStep } from '../../utils/bookingNext.js'

const CSS = `
  .dfp-grid { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:16px; margin-bottom:16px; }
  .dfp-grid2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:16px; }
  .dfp-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:16px; min-width:0; }
  .dfp-h { font-weight:700; font-size:0.92rem; margin-bottom:4px; display:flex; justify-content:space-between; gap:8px; align-items:center; flex-wrap:wrap; }
  .dfp-sub { font-size:0.7rem; color:var(--text-muted); margin-bottom:12px; }
  .dfp-months { display:flex; align-items:flex-end; gap:8px; height:150px; padding-top:18px; }
  .dfp-m { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:4px; }
  .dfp-m b { font-size:0.74rem; font-variant-numeric:tabular-nums; }
  .dfp-m i { display:block; width:100%; max-width:42px; border-radius:8px 8px 3px 3px; background:var(--success); }
  .dfp-m i.fc { background:repeating-linear-gradient(135deg, var(--primary) 0 6px, color-mix(in srgb, var(--primary) 55%, transparent) 6px 12px); }
  .dfp-m span { font-size:0.64rem; color:var(--text-muted); white-space:nowrap; }
  .dfp-groups { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; }
  .dfp-group { border:1px solid var(--border-subtle); background:var(--surface-2); border-radius:var(--radius-md); padding:10px 12px; }
  .dfp-group div:first-child { font-size:0.72rem; color:var(--text-muted); font-weight:600; }
  .dfp-group div:last-child { font-size:1.05rem; font-weight:800; font-variant-numeric:tabular-nums; margin-top:2px; }
  .dfp-tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; margin-bottom:10px; }
  .dfp-tabs button { flex-shrink:0; border-radius:999px; }
  .dfp-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:8px; cursor:pointer; background:var(--surface); transition:border-color .15s, transform .15s; }
  .dfp-row:hover { border-color:var(--primary); transform:translateY(-1px); }
  .dfp-pct { flex-shrink:0; width:52px; height:52px; border-radius:50%; display:grid; place-items:center; font-weight:800; font-size:0.86rem; font-variant-numeric:tabular-nums;
    background:conic-gradient(var(--c) calc(var(--p) * 1%), var(--surface-2) 0); position:relative; }
  .dfp-pct::before { content:''; position:absolute; inset:5px; border-radius:50%; background:var(--surface); }
  .dfp-pct span { position:relative; }
  .dfp-main { flex:1; min-width:0; }
  .dfp-name { font-weight:700; font-size:0.86rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dfp-meta { font-size:0.72rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dfp-why { font-size:0.68rem; color:var(--text-2); margin-top:2px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .dfp-next { font-size:0.68rem; margin-top:2px; overflow-wrap:anywhere; }
  .dfp-next.warning { color:var(--warning); } .dfp-next.danger { color:var(--danger); } .dfp-next.info { color:var(--text-muted); }
  .dfp-risk { font-size:0.68rem; color:var(--danger); font-weight:600; margin-top:2px; }
  .dfp-how { font-size:0.76rem; color:var(--text-2); line-height:1.7; }
  .dfp-how li { margin-bottom:2px; }
  @media (max-width: 900px) { .dfp-grid, .dfp-grid2 { grid-template-columns:minmax(0,1fr); } }
  @media (max-width: 640px) { .dfp-card { padding:13px; } .dfp-pct { width:44px; height:44px; font-size:0.76rem; } .dfp-months { gap:5px; } }
`

export default async function DeliveryForecastPage(container) {
  const myGen = container.__routerGen
  container.innerHTML = `<div class="page-content animate-slide"><style>${DFC_CSS}${CSS}</style>
    <div class="page-header"><div><div class="page-title">🚚 คาดการณ์ส่งมอบเดือนนี้</div><div class="page-subtitle">กำลังคำนวณจากใบจองจริง...</div></div></div>
    <div class="skeleton" style="height:260px;border-radius:var(--radius-xl);margin-bottom:16px"></div>
    <div class="skeleton" style="height:220px;border-radius:var(--radius-lg)"></div></div>`

  const today = todayBangkok()
  let data
  let logs = []
  try {
    // (v1.0.1386) ตัวเลขคาดการณ์ที่รายงาน 18:00 เก็บไว้ทุกวัน — ใช้ดูความแม่นยำ (ไม่มีก็ไม่เป็นไร)
    ;[data, logs] = await Promise.all([loadDeliveryForecast({ today, fmt: formatDate }), listDocs('delivery_forecast_log', [], 'date', 'desc', 400).catch(() => [])])
  } catch (e) { data = null }
  if (container.__routerGen !== myGen) return
  if (!data) { container.querySelector('.page-subtitle').textContent = 'โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง'; return }
  const { fc, bookings, next } = data
  let tab = 'all'
  // (v1.0.1390) กรองรายชื่อตามเซลส์ + บอกขั้นต่อไปของแต่ละใบ (ใช้ bookingNext เดียวกับหน้าใบจอง)
  let seller = ''
  const byId = new Map(bookings.map(b => [b.id, b]))
  const sellers = [...new Set(fc.items.filter(i => i.tier !== 'unlikely').map(i => i.sales))].sort((a, b) => a.localeCompare(b, 'th'))

  const months = Array.from({ length: 6 }, (_, i) => shiftYm(fc.ym, i - 6)).map(ym => ({ ym, n: monthStats(bookings, ym).delivered }))
  const avg3 = months.slice(-3).reduce((s, m) => s + m.n, 0) / 3

  function itemRow(i) {
    const meta = TIER_META[i.tier]
    const pct = Math.round(i.p * 100)
    return `<div class="dfp-row" data-id="${escHtml(i.id)}" role="button" tabindex="0">
      <div class="dfp-pct" style="--p:${pct};--c:var(--${meta.color})"><span>${pct}%</span></div>
      <div class="dfp-main">
        <div class="dfp-name">${escHtml(i.name)} · ${escHtml(i.car)}</div>
        <div class="dfp-meta">${escHtml(i.status)} · ${escHtml(i.sales)}${i.deliveryDate ? ` · นัด ${formatDate(i.deliveryDate)}` : ''}${i.price ? ` · ${formatCurrency(i.price)}` : ''}</div>
        ${i.risk ? `<div class="dfp-risk">⚠️ ${escHtml(i.risk)}</div>` : i.why.length ? `<div class="dfp-why">${escHtml(i.why.join(' · '))}</div>` : ''}
        ${(n => n ? `<div class="dfp-next ${n.tone}">🧭 ${escHtml(n.text)}</div>` : '')(bookingNextStep(byId.get(i.id), today))}
      </div>
    </div>`
  }

  function listHtml() {
    const rows = (tab === 'risk' ? fc.atRisk : tab === 'all' ? fc.items.filter(i => i.tier !== 'unlikely') : fc.items.filter(i => i.tier === tab)).filter(i => !seller || i.sales === seller)
    const sum = seller ? (r => `<div style="font-size:0.74rem;color:var(--text-2);margin-bottom:8px">👤 ${escHtml(seller)}: ส่งแล้ว ${r?.delivered || 0} · คาดรวมสิ้นเดือน ≈ ${Math.round((r?.expected || 0) * 10) / 10} คัน · ${rows.length} ใบในรายการนี้</div>`)(fc.bySales.find(r => r.key === seller)) : ''
    if (!rows.length) return sum + `<div style="text-align:center;padding:18px;color:var(--text-muted);font-size:0.8rem">${tab === 'risk' ? '✅ ไม่มีใบจองที่เสี่ยงหลุดเดือนนี้' : 'ไม่มีรายการ'}</div>`
    return sum + rows.slice(0, 60).map(itemRow).join('') + (rows.length > 60 ? `<div style="text-align:center;font-size:0.72rem;color:var(--text-muted)">แสดง 60 จาก ${rows.length} ใบ</div>` : '')
  }

  // (v1.0.1392) 🎯 ทางไปถึงเป้า: ต้องส่งอีกกี่คัน ใบไหนใกล้ที่สุด ใบไหนต้องเร่ง
  function pathHtml() {
    const tp = targetPath(fc)
    if (!tp || fc.daysLeft <= 0) return ''
    const head = tp.short
      ? `ใบจองที่ค้างมี ${fc.open} ใบ ยังขาดอีก ${tp.short} คันถึงจะพอเป้า — ต้องได้ใบจองใหม่ที่ส่งได้ทันเดือนนี้`
      : `ต้องส่งให้ได้ทุกใบใน ${tp.need} ใบนี้${tp.push.length ? ` · <b style="color:var(--warning)">${tp.push.length} ใบโอกาสยังต่ำ ต้องเร่งก่อน</b>` : ' · ทุกใบโอกาสดี'}`
    return `<div class="dfp-card" style="margin-bottom:16px">
      <div class="dfp-h">🎯 ทางไปถึงเป้า ${fc.target} คัน <span class="badge badge-${tp.short ? 'danger' : fc.expectedRaw >= fc.target && !tp.push.length ? 'success' : 'warning'}">ต้องส่งอีก ${tp.need} คัน</span></div>
      <div class="dfp-sub" style="font-size:0.74rem">${head}</div>
      ${tp.picks.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${tp.picks.map(i => `<button type="button" class="btn btn-xs ${i.p < 0.4 ? 'btn-warning' : 'btn-secondary'}" data-open="${escHtml(i.id)}" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Math.round(i.p * 100)}% · ${escHtml(i.name)} · ${escHtml(i.car)}</button>`).join('')}</div>` : ''}
    </div>`
  }

  // (v1.0.1386) ความแม่นยำ: ที่เคยคาดไว้ vs ยอดจริงตอนจบเดือน
  function accuracyHtml() {
    const acc = forecastAccuracy(logs, bookings, today)
    const cur = acc.current
    const curHtml = cur.length ? `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px">${cur.slice(-10).map(c => `<div style="flex-shrink:0;min-width:64px;text-align:center;border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:6px 8px;background:var(--surface-2)"><div style="font-size:0.64rem;color:var(--text-muted)">${formatDate(c.date).slice(0, 5)}</div><div style="font-weight:800;font-variant-numeric:tabular-nums">≈${Math.round(c.expected)}</div><div style="font-size:0.6rem;color:var(--text-muted)">${c.worst}–${c.best}</div></div>`).join('')}</div>` : ''
    const rows = acc.months.slice(0, 6)
    const table = rows.length ? `<div class="table-wrap"><table class="table" style="font-size:0.8rem">
        <thead><tr><th>เดือน</th><th>ที่คาดไว้</th><th class="text-right">ยอดจริง</th></tr></thead>
        <tbody>${rows.map(m => `<tr><td style="white-space:nowrap;font-weight:600">${escHtml(ymThai(m.ym))}</td>
          <td>${m.snaps.map(s => `<div>วันที่ ${s.day}: ≈ ${Math.round(s.expected)} <span style="color:var(--text-muted)">(${s.worst}–${s.best})</span> ${s.inRange ? '<span style="color:var(--success)">✓ อยู่ในช่วง</span>' : '<span style="color:var(--warning)">นอกช่วง</span>'}</div>`).join('')}</td>
          <td class="text-right" style="font-weight:800;font-variant-numeric:tabular-nums">${m.actual}</td></tr>`).join('')}</tbody></table></div>` : ''
    return `<div class="dfp-card" style="margin-bottom:16px">
      <div class="dfp-h">🎯 ความแม่นยำของการคาดการณ์${acc.mape != null ? ` <span class="badge badge-${acc.mape <= 10 ? 'success' : acc.mape <= 25 ? 'warning' : 'danger'}">คลาดเฉลี่ย ${acc.mape}%</span>` : ''}</div>
      <div class="dfp-sub">${acc.since ? `ระบบเก็บตัวเลขคาดการณ์ทุกวันตอนส่งรายงาน 18:00 (เริ่ม ${formatDate(acc.since)})` : 'ระบบจะเริ่มเก็บตัวเลขคาดการณ์ทุกวันตอนส่งรายงาน 18:00'} — จบเดือนจะเทียบกับยอดจริงให้เห็นว่าแม่นแค่ไหน</div>
      ${cur.length ? '<div style="font-size:0.72rem;font-weight:700;margin-bottom:6px">เดือนนี้ คาดไว้แต่ละวัน</div>' : ''}${curHtml}
      ${table || (cur.length ? '' : '<div style="font-size:0.78rem;color:var(--text-muted);padding:6px 0">ยังไม่มีข้อมูลย้อนหลัง</div>')}
    </div>`
  }

  function render() {
    const maxM = Math.max(...months.map(m => m.n), fc.best, 1)
    const tabs = [['all', `ลุ้นได้ทั้งหมด (${fc.tiers.sure + fc.tiers.likely + fc.tiers.maybe})`], ['risk', `⚠️ เสี่ยง (${fc.atRisk.length})`],
      ...['sure', 'likely', 'maybe', 'unlikely'].map(k => [k, `${TIER_META[k].dot} ${TIER_META[k].label} (${fc.tiers[k]})`])]
    container.innerHTML = `<div class="page-content animate-slide"><style>${DFC_CSS}${CSS}</style>
      <div class="page-header">
        <div>
          <div class="page-title">🚚 คาดการณ์ส่งมอบเดือนนี้</div>
          <div class="page-subtitle">${escHtml(ymThai(fc.ym))} · ข้อมูล ณ ${formatDate(today)} · ส่งมอบ = ตัดตัวเลข (นิยามเดียวกับรายงาน LINE)</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="dfp-copy">📋 คัดลอกสรุป</button>
          <button class="btn btn-secondary" data-nav="/crm/bookings">📄 ใบจอง</button>
        </div>
      </div>

      ${heroHtml(fc)}

      ${pathHtml()}

      <div class="dfp-grid">
        <div class="dfp-card">
          <div class="dfp-h">📈 ยอดส่งมอบสะสมรายวัน</div>
          <div class="dfp-sub">เส้นเขียว = ส่งจริง · เส้นประ = คาดการณ์ถึงสิ้นเดือน · แถบจาง = ช่วงแย่–ดี${fc.target ? ' · เส้นส้ม = เป้า' : ''}</div>
          <div class="dfc-wide">${cumulativeSvg(fc)}</div><div class="dfc-narrow">${cumulativeSvg(fc, { W: 340, H: 230 })}</div>
        </div>
        <div class="dfp-card">
          <div class="dfp-h">🗓 6 เดือนก่อน vs เดือนนี้</div>
          <div class="dfp-sub">เฉลี่ย 3 เดือนล่าสุด ${avg3.toFixed(1)} คัน/เดือน${fc.pace != null ? ` · จังหวะเดือนนี้ ≈ ${fc.pace} คัน` : ''}</div>
          <div class="dfp-months">
            ${months.map(m => `<div class="dfp-m"><b>${m.n}</b><i style="height:${Math.max(3, m.n / maxM * 100).toFixed(1)}%"></i><span>${escHtml(ymThai(m.ym).split(' ')[0])}</span></div>`).join('')}
            <div class="dfp-m"><b style="color:var(--primary)">≈${fc.expected}</b><i class="fc" style="height:${Math.max(3, fc.expectedRaw / maxM * 100).toFixed(1)}%"></i><span style="color:var(--primary);font-weight:700">เดือนนี้</span></div>
          </div>
        </div>
      </div>

      <div class="dfp-card" style="margin-bottom:16px">
        <div class="dfp-h">🧩 ใบจองค้างแยกตามขั้นงาน</div>
        <div class="dfp-sub">จำนวนใบ · ตัวเลขใหญ่ = คาดว่าส่งได้เดือนนี้ (คัน)</div>
        <div class="dfp-groups">${fc.byGroup.length ? fc.byGroup.map(g => `<div class="dfp-group"><div>${g.label} · ${g.count} ใบ</div><div>≈ ${g.expected}</div></div>`).join('') : '<div style="color:var(--text-muted);font-size:0.8rem">ไม่มีใบจองค้าง</div>'}</div>
      </div>

      <div class="dfp-grid2">
        <div class="dfp-card"><div class="dfp-h">🚗 แยกตามรุ่น</div><div class="dfp-sub">เขียว = ส่งแล้ว · ฟ้า = คาดเพิ่ม</div>${splitBars(fc.byCar)}</div>
        <div class="dfp-card"><div class="dfp-h">🧑‍💼 แยกตามเซลส์</div><div class="dfp-sub">เขียว = ส่งแล้ว · ฟ้า = คาดเพิ่ม</div>${splitBars(fc.bySales)}</div>
      </div>

      ${next && next.count ? `<div class="dfp-card" style="margin-bottom:16px">
        <div class="dfp-h">🗓 มองไปเดือนหน้า · ${escHtml(ymThai(next.ym))}</div>
        <div class="dfp-sub">จากใบจองที่มีอยู่ตอนนี้ ${next.count} ใบ (ยังไม่รวมใบจองใหม่ที่จะเข้ามา) — ใช้วางแผนเบิกรถ/สั่งรถ/นัดลูกค้า</div>
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <b style="font-size:1.9rem;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums">≈ ${next.expected}</b><span style="color:var(--text-2);font-weight:600">คัน</span>
          <span style="font-size:0.78rem;color:var(--text-muted)">แย่สุด ${next.worst} · ดีสุด ${next.best}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${next.byCar.slice(0, 8).map(r => `<span class="badge badge-secondary" style="font-size:0.72rem">${escHtml(r.key)} ≈ ${r.expected}</span>`).join('')}</div>
      </div>` : ''}

      <div class="dfp-card" style="margin-bottom:16px" id="dfp-list-card">
        <div class="dfp-h">📋 ใบจองที่จะส่งมอบได้เดือนนี้ <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400">กดเพื่อเปิดใบจอง</span></div>
        <div class="dfp-tabs" style="overflow-x:auto">${tabs.map(([k, l]) => `<button type="button" class="btn btn-xs ${tab === k ? 'btn-primary' : 'btn-secondary'}" data-tab="${k}">${l}</button>`).join('')}</div>
        ${sellers.length > 1 ? `<div style="margin-bottom:10px"><select id="dfp-seller" class="form-select" style="max-width:220px;width:100%" aria-label="กรองตามเซลส์"><option value="">👥 ทุกเซลส์</option>${sellers.map(s => `<option value="${escHtml(s)}"${s === seller ? ' selected' : ''}>${escHtml(s)}</option>`).join('')}</select></div>` : ''}
        <div id="dfp-list">${listHtml()}</div>
      </div>

      ${accuracyHtml()}

      <div class="dfp-card">
        <div class="dfp-h">🧠 คำนวณอย่างไร</div>
        <ul class="dfp-how" style="padding-left:18px;margin:6px 0 0">
          <li>ส่งมอบแล้ว = ใบจองสถานะ "ส่งมอบแล้ว" หรือ "ตัดตัวเลขรอส่งมอบ" ที่วันตัดตัวเลขอยู่ในเดือนนี้</li>
          <li>ใบจองที่ยังค้างทุกใบได้ % โอกาสส่งมอบทันสิ้นเดือน จากขั้นงาน วันนัดส่งมอบ${fc.usedSupply ? ' รถว่างในสต็อก/รถที่กำลังมา' : ''} และ${fc.history.samples >= 5 ? `ประวัติจริงของร้าน (${fc.history.samples} คันใน 12 เดือน${fc.history.medianDays != null ? ` · จอง→ตัดตัวเลขกลางๆ ${fc.history.medianDays} วัน` : ''})` : 'ค่าตั้งต้นตามขั้นงาน (ประวัติร้านยังน้อย)'}</li>
          <li>${fc.history.cancelRate != null ? `หักโอกาสถอนจองตามอัตราจริง 6 เดือน (${Math.round(fc.history.cancelRate * 100)}%)` : 'ยังไม่หักอัตราถอนจอง (ข้อมูลปิดงาน 6 เดือนยังไม่ถึง 5 ใบ)'}</li>
          <li>คาดการณ์ = ส่งแล้ว + ผลรวม % ทุกใบ · แย่สุด/ดีสุด = ช่วงที่เป็นไปได้ราว 8 ใน 10 ครั้ง</li>
          <li>เป้า: ${fc.target ? `${fc.target} คัน (${data.source === 'budget' ? 'จาก Sales Budget' : 'จากเป้าทีม'})` : 'ยังไม่ได้ตั้ง — ตั้งได้ที่ Sales Budget ช่อง "คัน" หรือเป้าทีม'}</li>
        </ul>
        ${fc.target ? '' : '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-secondary" data-nav="/finance/sales-budget">🎯 ตั้งเป้าใน Sales Budget</button><button class="btn btn-sm btn-ghost" data-nav="/hr/targets">เป้าทีม →</button></div>'}
      </div>
    </div>`
  }

  render()
  const onClick = e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) { navigate(nav.dataset.nav); return }
    const t = e.target.closest('[data-tab]')
    if (t) {
      tab = t.dataset.tab
      container.querySelectorAll('[data-tab]').forEach(b => { b.className = `btn btn-xs ${b.dataset.tab === tab ? 'btn-primary' : 'btn-secondary'}` })
      const l = container.querySelector('#dfp-list'); if (l) l.innerHTML = listHtml()
      return
    }
    if (e.target.closest('.dfc-tile') && e.target.closest('.dfc-tile').textContent.includes('เสี่ยงหลุด')) {
      tab = 'risk'; render(); container.querySelector('#dfp-list-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return
    }
    const op = e.target.closest('[data-open]')
    if (op?.dataset.open) { navigate('/crm/bookings?id=' + encodeURIComponent(op.dataset.open)); return }
    const row = e.target.closest('.dfp-row')
    if (row?.dataset.id) { navigate('/crm/bookings?id=' + encodeURIComponent(row.dataset.id)); return }
    if (e.target.closest('#dfp-copy')) {
      const txt = deliveryForecastText(fc, ymThai(fc.ym))
      navigator.clipboard?.writeText(txt).then(() => showToast('📋 คัดลอกสรุปแล้ว วางใน LINE ทีมได้เลย', 'success')).catch(() => showToast('คัดลอกไม่ได้', 'error'))
    }
  }
  const onChange = e => {
    if (e.target.id !== 'dfp-seller') return
    seller = e.target.value
    const l = container.querySelector('#dfp-list'); if (l) l.innerHTML = listHtml()
  }
  const onKey = e => { if (e.key === 'Enter' && e.target.classList?.contains('dfp-row')) e.target.click() }
  // container ใช้ร่วมทุกหน้า — คืนฟังก์ชันถอด listener ให้ router เรียกตอนออกจากหน้า
  container.addEventListener('click', onClick)
  container.addEventListener('keydown', onKey)
  container.addEventListener('change', onChange)
  return () => { container.removeEventListener('click', onClick); container.removeEventListener('keydown', onKey); container.removeEventListener('change', onChange) }
}
