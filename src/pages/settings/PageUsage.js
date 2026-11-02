/**
 * หน้าไหนมีข้อมูลจริง (Page Usage) — 2026-11-02 · Route: /settings/page-usage · เฉพาะเจ้าของโปรแกรม
 *
 * นับจำนวนข้อมูลจริงของแต่ละเมนู (จาก collection ที่หน้านั้นใช้ — src/data/pageCollections.js สร้างจาก
 * scripts/gen-page-collections.mjs) + เวลาแก้ล่าสุดจาก audit_log เพื่อใช้ตัดสินใจว่าจะซ่อนเมนูไหน
 * อ่านอย่างเดียว ไม่แก้/ลบข้อมูลใดๆ
 */
import { db } from '../../core/firebase.js'
import { collection, query, orderBy, limit, getDocs, getCountFromServer } from 'firebase/firestore'
import { NAV } from '../../data/navMenu.js'
import { PAGE_COLLECTIONS } from '../../data/pageCollections.js'
import { isProgramOwner } from '../../core/hierarchy.js'
import { navigate } from '../../core/router.js'
import { classifyPages, collectionsToCount, lastActivityByCollection, USAGE } from '../../utils/pageUsage.js'

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function ago(ts) {
  if (!ts) return 'ไม่เคย'
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
  return d <= 0 ? 'วันนี้' : d < 31 ? `${d} วันก่อน` : d < 365 ? `${Math.floor(d / 30)} เดือนก่อน` : `${Math.floor(d / 365)} ปีก่อน`
}

async function countAll(cols, onProgress) {
  const counts = {}
  let done = 0
  const queue = [...cols]
  async function worker() {
    while (queue.length) {
      const c = queue.shift()
      try { counts[c] = (await getCountFromServer(collection(db, c))).data().count } catch { counts[c] = null }
      onProgress(++done, cols.length)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return counts
}

export default async function PageUsagePage(container) {
  if (!isProgramOwner()) {
    container.innerHTML = `<div class="page-content"><div class="empty-state" style="padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div><div class="empty-desc">เปิดให้เฉพาะเจ้าของโปรแกรมเท่านั้น</div></div></div>`
    return
  }
  const myGen = container.__routerGen
  const alive = () => container.__routerGen === myGen
  let filter = 'all'
  let groups = null

  container.innerHTML = `<div class="page-content"><div class="card" style="padding:20px;text-align:center" id="pu-progress">⏳ กำลังนับข้อมูลแต่ละหน้า...</div></div>`

  const cols = collectionsToCount(NAV, PAGE_COLLECTIONS)
  const [counts, logs] = await Promise.all([
    countAll(cols, (d, t) => { const el = alive() && document.getElementById('pu-progress'); if (el) el.textContent = `⏳ กำลังนับข้อมูล ${d}/${t} ชุด...` }),
    getDocs(query(collection(db, 'audit_log'), orderBy('ts', 'desc'), limit(3000))).then(s => s.docs.map(d => d.data())).catch(() => []),
  ])
  if (!alive()) return
  groups = classifyPages(NAV, PAGE_COLLECTIONS, counts, lastActivityByCollection(logs))
  const oldest = logs.length ? logs[logs.length - 1].ts : ''
  render()

  function render() {
    const all = groups.flatMap(g => g.items)
    const tot = k => all.filter(i => i.usage.key === k).length
    const chip = (k, label) => `<button class="btn btn-sm ${filter === k ? 'btn-primary' : 'btn-ghost'}" data-f="${k}">${label}</button>`
    container.innerHTML = `
      <div class="page-content" style="max-width:1100px">
        <div class="page-header" style="margin-bottom:12px">
          <h1 class="page-title">📊 หน้าไหนมีข้อมูลจริง</h1>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.6">นับข้อมูลจริงของทุกเมนู ใช้ตัดสินใจว่าจะซ่อนเมนูไหน (อ่านอย่างเดียว ไม่แก้ข้อมูล)<br>
          ${USAGE.own.icon} มีข้อมูลของหน้านั้นเอง · ${USAGE.core.icon} โชว์แค่ลูกค้า/ใบจอง/พนักงานที่มาจากหน้าอื่น · ${USAGE.empty.icon} ว่างเปล่า
          ${oldest ? `<br>"แก้ล่าสุด" ดูย้อนหลังได้ถึง ${esc(new Date(oldest).toLocaleDateString('th-TH'))}` : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
          ${chip('all', `ทั้งหมด ${all.length}`)}${chip('own', `${USAGE.own.icon} ${tot('own')}`)}${chip('core', `${USAGE.core.icon} ${tot('core')}`)}${chip('empty', `${USAGE.empty.icon} ${tot('empty')}`)}
        </div>
        ${groups.map(g => {
          const items = g.items.filter(i => filter === 'all' || i.usage.key === filter)
          if (!items.length) return ''
          const s = g.summary
          return `<details class="card" style="margin-bottom:10px;padding:0" ${s.own === 0 ? '' : 'open'}>
            <summary style="padding:12px 14px;cursor:pointer;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center">
              <b style="flex:1 1 160px">${esc(g.group)}</b>
              <span style="font-size:0.8rem;color:var(--text-muted)">${s.total} หน้า · ${USAGE.own.icon} ${s.own} · ${USAGE.core.icon} ${s.core} · ${USAGE.empty.icon} ${s.empty}</span>
            </summary>
            <div style="border-top:1px solid var(--border)">
              ${items.map(i => `<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline">
                <a href="${esc(i.path)}" data-go="${esc(i.path)}" style="flex:1 1 200px;min-width:0;overflow-wrap:anywhere">${i.usage.icon} ${esc(i.icon)} ${esc(i.label)}</a>
                <span style="font-size:0.8rem;white-space:nowrap">${i.own ? `${i.own.toLocaleString()} รายการ` : '-'}</span>
                <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap;min-width:90px;text-align:right">แก้ล่าสุด ${ago(i.last)}</span>
                ${i.cols.length ? `<div style="flex-basis:100%;font-size:0.72rem;color:var(--text-muted);overflow-wrap:anywhere">${i.cols.map(c => `${esc(c.name)} ${c.count == null ? '(อ่านไม่ได้)' : c.count}`).join(' · ')}</div>` : ''}
              </div>`).join('')}
            </div>
          </details>`
        }).join('')}
      </div>`
    container.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.go) }))
  }
}
