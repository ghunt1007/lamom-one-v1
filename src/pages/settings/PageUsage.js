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
import { getState, showToast } from '../../core/store.js'
import { createDoc, updateDocData } from '../../core/db.js'
import { applyBrand } from '../../core/whiteLabel.js'
import { cleanHiddenMenus, hiddenMenuSet, NEVER_HIDE } from '../../utils/hiddenMenus.js'
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
  let saving = false

  // บันทึกรายการเมนูที่ซ่อน → แถบเมนูซ้ายของทุกคนเปลี่ยนทันที (ของคนอื่นเปลี่ยนตอนเปิดแอปครั้งถัดไป)
  async function saveHidden(list) {
    if (saving) return
    saving = true
    const brand = getState('brand') || {}
    const hiddenMenus = cleanHiddenMenus(list)
    try {
      let id = brand.__docId
      if (id) await updateDocData('whitelabel_settings', id, { hiddenMenus })
      else id = await createDoc('whitelabel_settings', { hiddenMenus })
      applyBrand({ ...brand, id, hiddenMenus })
    } catch (e) {
      showToast('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error')
    }
    saving = false
    render()
  }

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
    const hidden = hiddenMenuSet()
    const emptyShown = all.filter(i => i.usage.key === 'empty' && !hidden.has(i.path.split('?')[0]) && !NEVER_HIDE.includes(i.path.split('?')[0]))
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
          ${chip('all', `ทั้งหมด ${all.length}`)}${chip('own', `${USAGE.own.icon} ${tot('own')}`)}${chip('core', `${USAGE.core.icon} ${tot('core')}`)}${chip('empty', `${USAGE.empty.icon} ${tot('empty')}`)}${chip('hidden', `🙈 ซ่อนอยู่ ${hidden.size}`)}
        </div>
        <div class="card" style="padding:12px 14px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <div style="flex:1 1 220px;font-size:0.8rem;color:var(--text-muted);line-height:1.6">ติ๊ก "ซ่อน" เพื่อเอาเมนูออกจากแถบซ้ายของทุกคน หน้าและข้อมูลยังอยู่ครบ ค้นหา Ctrl+K ยังเจอ และเลิกซ่อนได้ทุกเมื่อ</div>
          <button class="btn btn-primary btn-sm" id="pu-hide-empty" ${emptyShown.length ? '' : 'disabled'}>🙈 ซ่อนทุกหน้าที่ว่าง (${emptyShown.length})</button>
          ${hidden.size ? `<button class="btn btn-ghost btn-sm" id="pu-unhide-all">↩️ เลิกซ่อนทั้งหมด</button>` : ''}
        </div>
        ${groups.map(g => {
          const items = g.items.filter(i => filter === 'all' || (filter === 'hidden' ? hidden.has(i.path.split('?')[0]) : i.usage.key === filter))
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
                ${NEVER_HIDE.includes(i.path.split('?')[0]) ? '' : `<label style="font-size:0.78rem;white-space:nowrap;cursor:pointer;display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-hide="${esc(i.path.split('?')[0])}" ${hidden.has(i.path.split('?')[0]) ? 'checked' : ''}> ซ่อน</label>`}
                ${i.cols.length ? `<div style="flex-basis:100%;font-size:0.72rem;color:var(--text-muted);overflow-wrap:anywhere">${i.cols.map(c => `${esc(c.name)} ${c.count == null ? '(อ่านไม่ได้)' : c.count}`).join(' · ')}</div>` : ''}
              </div>`).join('')}
            </div>
          </details>`
        }).join('')}
      </div>`
    container.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('[data-hide]').forEach(cb => cb.addEventListener('change', () => {
      const next = new Set(hiddenMenuSet())
      cb.checked ? next.add(cb.dataset.hide) : next.delete(cb.dataset.hide)
      saveHidden([...next])
    }))
    container.querySelector('#pu-hide-empty')?.addEventListener('click', () => {
      if (!confirm(`ซ่อน ${emptyShown.length} เมนูที่ไม่มีข้อมูลเลย ออกจากแถบเมนูของทุกคน?\n(หน้าและข้อมูลยังอยู่ เลิกซ่อนได้ทุกเมื่อ)`)) return
      saveHidden([...hidden, ...emptyShown.map(i => i.path.split('?')[0])])
    })
    container.querySelector('#pu-unhide-all')?.addEventListener('click', () => { if (confirm('แสดงเมนูที่ซ่อนไว้ทั้งหมดกลับมา?')) saveHidden([]) })
    container.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.go) }))
  }
}
