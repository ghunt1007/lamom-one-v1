/**
 * ช่องทางโซเชียล — /marketing/channels (v1.0.974)
 * แชตรวม (LINE OA + Messenger + IG) · โพสต์ลงเพจ/IG · โฆษณา Meta · บัญชีของทีม/โชว์รูม/เซลส์ · วิธีเชื่อม
 * token ทุกตัวอยู่ฝั่งเซิร์ฟเวอร์ (workers/social.js) — หน้านี้ไม่เห็นและไม่เก็บ token เลย
 */
import './channels.css'
import { watchDocs, createDoc, updateDocData, softDelete, listDocs } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { escHtml as esc } from '../../utils/escape.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { timeAgo, formatCurrency, todayBangkok } from '../../utils/format.js'
import { copyText } from '../../utils/copyText.js'
import { myName } from '../../utils/myName.js'
import { isManagerRole } from '../../utils/managerRole.js'
import { myEffectiveCompanyId, companyScopeFilters } from '../../core/companyScope.js'
import { accountResults } from '../../utils/socialAccounts.js'
import { getSalesStaff } from '../../data/masterData.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { suggestCustomerReply, generateSocialContent, aiErrorText } from '../../utils/ai.js'
import { catalogContext } from '../../utils/salesAi.js'
import { openQuickLead } from '../../utils/quickLead.js'
import { socialStatus, metaInbox, metaReply, metaPost, metaAds, metaAdsUpdate, lineReply, shareLinks, googlePlaces } from '../../utils/socialApi.js'
import { PLATFORM_GUIDE, SECRET_STEPS, LEVELS, ACCOUNT_PLATFORMS } from '../../utils/socialGuide.js'

const TABS = { inbox: '💬 แชตรวม', post: '📝 โพสต์', ads: '📣 โฆษณา', maps: '📍 Google Maps', accounts: '👥 บัญชี', guide: '🧭 วิธีเชื่อม' }
const KIND = { line: { icon: '💚', label: 'LINE' }, messenger: { icon: '📘', label: 'Messenger' }, instagram: { icon: '📸', label: 'IG' } }
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
const ms = v => { if (!v) return 0; const d = v?.toDate ? v.toDate() : new Date(v); return isNaN(d) ? 0 : d.getTime() }
const iso = v => { const t = ms(v); return t ? new Date(t).toISOString() : '' }

export default async function SocialChannelsPage(container) {
  const myGen = container.__routerGen
  const alive = () => container.__routerGen === myGen && container.isConnected
  const manager = isManagerRole()

  const urlTab = new URLSearchParams(location.search || '').get('tab')
  let tab = TABS[urlTab] ? urlTab : TABS[lsGet('ch-tab', '')] ? lsGet('ch-tab', 'inbox') : 'inbox'
  let status = null, statusErr = '', statusLoading = true
  let lineThreads = [], metaConvs = [], metaLoaded = false, metaLoading = false, metaErr = ''
  let filter = 'all', q = ''
  let openKey = '', lineMsgs = [], stopMsgs = null, replyDraft = ''
  let accounts = []
  // (v1.0.988) ผล Lead/จอง ต่อบัญชี (ลูกค้าที่เพิ่มแบบเลือก "จากบัญชีไหน")
  let accRes = null
  const thisMonth = todayBangkok().slice(0, 7)
  function loadAccRes() {
    if (accRes) return
    accRes = {}
    listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000).then(r => { accRes = accountResults(r, thisMonth); if (alive() && tab === 'accounts') render() }).catch(() => {})
  }
  let ads = null, adsErr = '', adsLoading = false
  const postDraft = { message: '', imageUrl: '', link: '', pages: new Set(), toIg: false }

  container.innerHTML = `
    <div class="page-content ch-page">
      <div class="page-header ch-head">
        <div><h1 class="page-title">🔗 ช่องทางโซเชียล</h1>
          <p class="page-subtitle">แชตลูกค้าจากทุกช่องทางในที่เดียว · โพสต์ลงเพจ · ดูและคุมงบโฆษณา · บัญชีของทีม โชว์รูม และเซลส์</p></div>
        <button class="btn btn-secondary btn-sm" id="ch-refresh">🔄 ตรวจสถานะ</button>
      </div>
      <div class="ch-status" id="ch-status"></div>
      <div class="ch-tabs" role="tablist">${Object.entries(TABS).map(([k, v]) => `<button type="button" data-tab="${k}">${v}</button>`).join('')}</div>
      <div id="ch-body"></div>
    </div>`
  const $ = s => container.querySelector(s)
  const body = () => $('#ch-body')

  // ── ข้อมูล ──
  async function loadStatus() {
    statusLoading = true; statusErr = ''; renderStatus()
    try { status = await socialStatus() } catch (e) { statusErr = e.message; status = null }
    statusLoading = false
    if (!alive()) return
    renderStatus()
    if (tab === 'inbox' && status?.meta?.pages?.length && !metaLoaded) loadMeta()
    else render()
  }
  async function loadMeta() {
    const pages = status?.meta?.pages || []
    if (!pages.length || metaLoading) return
    metaLoading = true; metaErr = ''; render()
    const out = [], errs = []
    await Promise.all(pages.flatMap(p => ['messenger', ...(p.ig ? ['instagram'] : [])].map(async plat => {
      try {
        const r = await metaInbox(p.id, plat)
        ;(r.conversations || []).forEach(c => out.push({ ...c, kind: plat, pageId: p.id, pageName: plat === 'instagram' ? `@${p.ig.username || p.name}` : p.name }))
      } catch (e) { errs.push(`${p.name}: ${e.message}`) }
    })))
    metaConvs = out; metaErr = errs.join(' · '); metaLoaded = true; metaLoading = false
    if (alive()) render()
  }
  watchDocs('social_threads', [], 'lastAt', 'desc', 300, rows => {
    if (!alive()) return
    lineThreads = rows.filter(r => !r.deleted)
    if (tab === 'inbox') render()
  })
  watchDocs('social_channels', [], 'createdAt', 'desc', 500, rows => {
    if (!alive()) return
    accounts = rows.filter(r => !r.deleted)
    if (tab === 'accounts') render()
  })

  // ── สถานะเชื่อมต่อ ──
  function renderStatus() {
    const el = $('#ch-status'); if (!el) return
    if (statusLoading && !status) { el.innerHTML = '<span class="ch-pill">⏳ กำลังตรวจการเชื่อมต่อ…</span>'; return }
    if (statusErr) { el.innerHTML = `<span class="ch-pill bad">⚠️ ตรวจสถานะไม่ได้: ${esc(/failed to fetch|network|load failed/i.test(statusErr) ? 'ต่อเซิร์ฟเวอร์ไม่ได้ (เน็ตหลุดหรือช้า) กด 🔄 ตรวจสถานะ อีกครั้ง' : statusErr)}</span>`; return }
    const s = status || {}
    const pages = s.meta?.pages || []
    const pill = (ok, label, extra = '') => `<span class="ch-pill ${ok ? 'ok' : ''}">${ok ? '✅' : '⚪'} ${label}${extra}</span>`
    el.innerHTML = [
      pill(s.line?.configured, '💚 LINE OA', s.line?.extra?.length ? ` + อีก ${s.line.extra.length} บัญชี` : ''),
      pill(s.meta?.configured && pages.length, '📘 Facebook', pages.length ? ` · ${pages.length} เพจ` : ''),
      pill(pages.some(p => p.ig), '📸 Instagram', pages.filter(p => p.ig).length ? ` · ${pages.filter(p => p.ig).length} บัญชี` : ''),
      pill(s.metaAds?.configured, '📣 โฆษณา Meta'),
      pill(false, '🎵 TikTok'),
      pill(s.google?.configured, '📍 Google Maps'),
      s.meta?.error ? `<span class="ch-pill bad">⚠️ ${esc(s.meta.error)}</span>` : '',
    ].join('')
  }

  // ── แท็บ ──
  function render() {
    if (!alive()) return
    // เก็บข้อความที่กำลังพิมพ์ + ตำแหน่งเคอร์เซอร์ไว้ (ข้อมูลใหม่เข้ามาระหว่างพิมพ์จะไม่ทำให้ข้อความหาย)
    const act = document.activeElement
    const focusId = act && container.contains(act) ? act.id : ''
    const caret = focusId ? act.selectionStart : null
    if ($('#ch-text')) replyDraft = $('#ch-text').value
    if ($('#ps-msg')) readPost()
    container.querySelectorAll('.ch-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab))
    const el = body()
    if (tab === 'inbox') el.innerHTML = inboxHtml()
    else if (tab === 'post') el.innerHTML = postHtml()
    else if (tab === 'ads') el.innerHTML = adsHtml()
    else if (tab === 'accounts') { loadAccRes(); el.innerHTML = accountsHtml() }
    else if (tab === 'maps') el.innerHTML = mapsHtml()
    else el.innerHTML = guideHtml()
    if (tab === 'inbox') { const t = el.querySelector('.ch-msgs'); if (t) t.scrollTop = t.scrollHeight }
    if (focusId) { const f = container.querySelector('#' + focusId); if (f) { f.focus(); try { if (caret != null) f.setSelectionRange(caret, caret) } catch {} } }
  }
  const notConnected = (what, k = 'facebook') => `<div class="ch-note">⚪ ยังไม่ได้เชื่อม ${what} — <button type="button" class="ch-linkbtn" data-goto-guide="${k}">ดูวิธีเชื่อม (ทำครั้งเดียว)</button></div>`

  // ── แชตรวม ──
  function items() {
    const line = lineThreads.map(t => ({ key: `line:${t.id}`, kind: 'line', id: t.id, name: t.name || 'ลูกค้า LINE', snippet: t.lastText || '', at: ms(t.lastAt), unread: !!t.unread, needsReply: t.lastDirection === 'in', sub: t.channelName || 'LINE OA', chan: t.channel || 'main' }))
    const meta = metaConvs.map(c => {
      const last = c.messages[c.messages.length - 1]
      return { key: `${c.kind}:${c.id}`, kind: c.kind, id: c.id, name: c.withName, snippet: last?.text || '', at: ms(c.at), unread: c.unread > 0, needsReply: last ? !last.mine : false, sub: c.pageName, conv: c }
    })
    let all = [...line, ...meta].sort((a, b) => b.at - a.at)
    if (filter === 'reply') all = all.filter(i => i.needsReply)
    else if (filter.startsWith('oa:')) all = all.filter(i => i.kind === 'line' && i.chan === filter.slice(3))
    else if (filter !== 'all') all = all.filter(i => i.kind === filter)
    const qq = q.trim().toLowerCase()
    if (qq) all = all.filter(i => `${i.name} ${i.snippet} ${i.sub}`.toLowerCase().includes(qq))
    return all
  }
  function inboxHtml() {
    const list = items()
    const cur = list.find(i => i.key === openKey) || (openKey ? findItem(openKey) : null)
    const counts = { all: lineThreads.length + metaConvs.length, reply: [...lineThreads.filter(t => t.lastDirection === 'in'), ...metaConvs.filter(c => { const l = c.messages[c.messages.length - 1]; return l && !l.mine })].length }
    const extraOA = status?.line?.extra || []
    const chips = [['all', `ทั้งหมด ${counts.all}`], ['reply', `🔴 รอตอบ ${counts.reply}`], ['line', '💚 LINE'],
      ...(extraOA.length ? [['oa:main', '💚 OA หลัก'], ...extraOA.map(c => ['oa:' + c.id, '💚 ' + c.name])] : []),
      ['messenger', '📘 Messenger'], ['instagram', '📸 IG']]
    const metaOk = status?.meta?.pages?.length
    return `
      <div class="ch-inbox ${cur ? 'has-open' : ''}">
        <div class="ch-list">
          <div class="ch-filters">${chips.map(([k, l]) => `<button type="button" class="ch-chip ${filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
          <input class="input ch-search" id="ch-q" placeholder="🔎 ค้นหาชื่อหรือข้อความ" value="${esc(q)}">
          ${status && !metaOk && !statusLoading ? notConnected('Facebook/IG') : ''}
          ${metaLoading ? '<div class="ch-note">⏳ กำลังโหลดแชต Facebook/IG…</div>' : ''}
          ${metaErr ? `<div class="ch-note bad">⚠️ ${esc(metaErr)}</div>` : ''}
          ${metaOk && metaLoaded ? '<button type="button" class="ch-linkbtn" id="ch-reload-meta">🔄 โหลดแชต Facebook/IG ใหม่</button>' : ''}
          ${list.length ? list.map(i => `
            <button type="button" class="ch-item ${i.key === openKey ? 'on' : ''}" data-open="${esc(i.key)}">
              <span class="ch-av">${KIND[i.kind].icon}</span>
              <span class="ch-item-main"><b>${esc(i.name)}</b><small>${esc(i.snippet.slice(0, 70)) || '—'}</small><em>${esc(i.sub)} · ${i.at ? esc(timeAgo(new Date(i.at).toISOString())) : ''}</em></span>
              ${i.needsReply ? '<span class="ch-dot" title="รอตอบ"></span>' : ''}
            </button>`).join('') : `<div class="ch-empty">${counts.all ? 'ไม่พบแชตที่ตรงกับตัวกรอง' : 'ยังไม่มีแชตเข้ามา<br><small>ข้อความลูกค้าที่ทัก LINE OA จะเข้ามาที่นี่อัตโนมัติ</small>'}</div>`}
        </div>
        <div class="ch-thread">${cur ? threadHtml(cur) : '<div class="ch-empty">เลือกแชตทางซ้ายเพื่ออ่านและตอบ</div>'}</div>
      </div>`
  }
  function findItem(key) {
    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    if (kind === 'line') { const t = lineThreads.find(x => x.id === id); return t ? { key, kind, id, name: t.name || 'ลูกค้า LINE', sub: t.channelName || 'LINE OA' } : null }
    const c = metaConvs.find(x => x.id === id && x.kind === kind)
    return c ? { key, kind, id, name: c.withName, sub: c.pageName, conv: c } : null
  }
  function threadHtml(i) {
    const msgs = i.kind === 'line'
      ? lineMsgs.map(m => ({ text: m.text, mine: m.direction === 'out', at: iso(m.at), by: m.by }))
      : (i.conv?.messages || []).map(m => ({ text: m.text, mine: m.mine, at: m.at, by: m.mine ? '' : '' }))
    const hint = i.kind === 'line' ? 'ตอบจากแอปนับโควตา LINE OA' : 'ตอบได้ภายใน 24 ชม. หลังลูกค้าทักล่าสุด'
    return `
      <div class="ch-th-head">
        <button type="button" class="btn btn-ghost btn-sm ch-back" id="ch-back">‹ กลับ</button>
        <div class="ch-th-name"><b>${KIND[i.kind].icon} ${esc(i.name)}</b><small>${esc(i.sub)}</small></div>
        <button type="button" class="btn btn-secondary btn-sm" id="ch-lead">➕ เป็น Lead</button>
      </div>
      <div class="ch-msgs">${msgs.length ? msgs.map(m => `<div class="ch-msg ${m.mine ? 'mine' : ''}"><div>${esc(m.text)}</div><small>${m.at ? esc(timeAgo(m.at)) : ''}${m.by && m.mine ? ` · ${esc(m.by)}` : ''}</small></div>`).join('') : '<div class="ch-empty">ยังไม่มีข้อความ</div>'}</div>
      <div class="ch-reply">
        <textarea class="input" id="ch-text" rows="2" placeholder="พิมพ์ตอบลูกค้า…">${esc(replyDraft)}</textarea>
        <div class="ch-reply-bar">
          <small>${hint}</small>
          <span><button type="button" class="btn btn-secondary btn-sm" id="ch-ai">✨ AI ร่างคำตอบ</button>
          <button type="button" class="btn btn-primary btn-sm" id="ch-send">📤 ส่ง</button></span>
        </div>
      </div>`
  }
  function openThread(key) {
    openKey = key; replyDraft = ''
    stopMsgs?.(); stopMsgs = null; lineMsgs = []
    const i = findItem(key)
    if (i?.kind === 'line') {
      stopMsgs = watchDocs('social_messages', [['threadId', '==', i.id]], 'at', 'asc', 300, rows => {
        if (!alive() || openKey !== key) return
        lineMsgs = rows
        renderThreadOnly()
      })
      const t = lineThreads.find(x => x.id === i.id)
      if (t?.unread) updateDocData('social_threads', i.id, { unread: false }).catch(() => {})
    }
    render()
  }
  // วาดเฉพาะส่วนข้อความ (ไม่ล้างช่องที่กำลังพิมพ์)
  function renderThreadOnly() {
    const i = findItem(openKey); const box = container.querySelector('.ch-msgs')
    if (!i || !box) return render()
    const tmp = document.createElement('div'); tmp.innerHTML = threadHtml(i)
    box.innerHTML = tmp.querySelector('.ch-msgs').innerHTML
    box.scrollTop = box.scrollHeight
  }
  async function sendReply() {
    const i = findItem(openKey); const ta = $('#ch-text'); const btn = $('#ch-send')
    const text = ta?.value.trim()
    if (!i || !text) { ta?.focus(); return }
    btn.disabled = true; btn.textContent = '⏳ กำลังส่ง…'
    try {
      if (i.kind === 'line') await lineReply(i.id, text)
      else {
        await metaReply(i.conv.pageId, i.conv.withId, text)
        i.conv.messages.push({ text, mine: true, at: new Date().toISOString() })
      }
      ta.value = ''; replyDraft = ''
      showToast('📤 ส่งแล้ว', 'success')
      if (i.kind !== 'line') render()
    } catch (e) { showToast(e.message, 'error') }
    finally { const b = $('#ch-send'); if (b) { b.disabled = false; b.textContent = '📤 ส่ง' } }
  }
  async function aiDraft() {
    const i = findItem(openKey); const btn = $('#ch-ai'); if (!i) return
    const msgs = i.kind === 'line' ? lineMsgs.filter(m => m.direction !== 'out').map(m => m.text) : (i.conv?.messages || []).filter(m => !m.mine).map(m => m.text)
    const last = msgs.slice(-3).join('\n')
    if (!last) { showToast('ยังไม่มีข้อความลูกค้าให้ AI ตอบ', 'info'); return }
    btn.disabled = true; btn.textContent = '⏳ กำลังคิด…'
    try {
      const draft = await suggestCustomerReply(last, { channel: KIND[i.kind].label, sender: i.name, catalog: catalogContext(last, getVehicles()) })
      if (draft && $('#ch-text')) { $('#ch-text').value = String(draft).trim(); $('#ch-text').focus() }
      else showToast('AI ยังตอบไม่ได้ตอนนี้', 'error')
    } catch (e) { showToast(aiErrorText(e), 'error') }
    finally { const b = $('#ch-ai'); if (b) { b.disabled = false; b.textContent = '✨ AI ร่างคำตอบ' } }
  }
  function toLead() {
    const i = findItem(openKey); if (!i) return
    const msgs = i.kind === 'line' ? lineMsgs.filter(m => m.direction !== 'out').map(m => m.text) : (i.conv?.messages || []).filter(m => !m.mine).map(m => m.text)
    const source = i.kind === 'line' ? 'line' : i.kind === 'instagram' ? 'other' : 'facebook'
    openQuickLead({ name: i.name, pasteText: `${i.name}\n${msgs.slice(-5).join('\n')}`.slice(0, 1500), source })
  }

  // ── โพสต์ ──
  function postHtml() {
    const pages = status?.meta?.pages || []
    const igOk = pages.some(p => p.ig && postDraft.pages.has(p.id))
    return `
      <div class="ch-grid2">
        <div class="ch-card">
          <div class="ch-card-h">📝 เขียนโพสต์</div>
          <textarea class="input" id="ps-msg" rows="7" placeholder="เช่น 🔥 DEEPAL S07 ดอกเบี้ย 0% ผ่อนเริ่ม 9,9xx บาท นัดทดลองขับได้ทุกวัน">${esc(postDraft.message)}</textarea>
          <div class="ch-row">
            <button type="button" class="btn btn-secondary btn-sm" id="ps-ai">✨ ให้ AI ช่วยเขียน/ขัดเกลา</button>
            <small id="ps-count">${postDraft.message.length} ตัวอักษร</small>
          </div>
          <label class="input-label">ลิงก์รูป (https) — ใส่ถ้าต้องการโพสต์รูป / ลง IG</label>
          <input class="input" id="ps-img" placeholder="https://…jpg" value="${esc(postDraft.imageUrl)}">
          <label class="input-label">ลิงก์แนบ (ไม่บังคับ)</label>
          <input class="input" id="ps-link" placeholder="https://lamom-one.pages.dev/…" value="${esc(postDraft.link)}">
        </div>
        <div class="ch-card">
          <div class="ch-card-h">📘 โพสต์ลงเพจ (อัตโนมัติ)</div>
          ${pages.length ? `
            <div class="ch-pages">${pages.map(p => `<label class="ch-pagepick"><input type="checkbox" data-page="${esc(p.id)}" ${postDraft.pages.has(p.id) ? 'checked' : ''}><span><b>${esc(p.name)}</b><small>${p.fans != null ? `${Number(p.fans).toLocaleString()} ถูกใจ` : ''}${p.ig ? ` · 📸 @${esc(p.ig.username || '')}` : ''}</small></span></label>`).join('')}</div>
            <label class="ch-check"><input type="checkbox" id="ps-ig" ${postDraft.toIg ? 'checked' : ''} ${igOk ? '' : 'disabled'}> ลง Instagram ด้วย ${igOk ? '(ต้องมีลิงก์รูป)' : '(เลือกเพจที่ผูก IG ก่อน)'}</label>
            <button type="button" class="btn btn-primary" id="ps-go">🚀 โพสต์เลย</button>
            <div id="ps-result"></div>`
          : (statusLoading ? '<div class="ch-note">⏳ กำลังตรวจ…</div>' : notConnected('Facebook เพจ'))}
          <div class="ch-card-h" style="margin-top:14px">📤 แชร์ด้วยบัญชีส่วนตัว (เซลส์ทุกคนทำได้)</div>
          <div class="ch-share">
            <button type="button" class="btn btn-secondary btn-sm" data-share="line">💚 แชร์ทาง LINE</button>
            <button type="button" class="btn btn-secondary btn-sm" data-share="facebook">📘 แชร์ Facebook ส่วนตัว</button>
            <button type="button" class="btn btn-secondary btn-sm" data-share="copy">📋 คัดลอกไปโพสต์ TikTok/IG</button>
          </div>
          <small class="ch-muted">Facebook/LINE ส่วนตัวไม่มี API ให้โพสต์อัตโนมัติ — ปุ่มนี้เปิดหน้าแชร์ให้กดยืนยันเอง</small>
        </div>
      </div>`
  }
  function readPost() {
    postDraft.message = $('#ps-msg')?.value || ''
    postDraft.imageUrl = ($('#ps-img')?.value || '').trim()
    postDraft.link = ($('#ps-link')?.value || '').trim()
    postDraft.toIg = !!$('#ps-ig')?.checked
  }
  async function doPost() {
    readPost()
    const pageIds = [...postDraft.pages]
    if (!pageIds.length) { showToast('เลือกเพจก่อน', 'error'); return }
    if (!postDraft.message.trim() && !postDraft.imageUrl) { showToast('พิมพ์ข้อความก่อน', 'error'); return }
    if (postDraft.toIg && !postDraft.imageUrl) { showToast('Instagram ต้องมีลิงก์รูป', 'error'); return }
    const names = (status?.meta?.pages || []).filter(p => postDraft.pages.has(p.id)).map(p => p.name).join(', ')
    if (!(await confirmDialog({ title: 'โพสต์จริงเลยไหม?', message: `จะโพสต์ลง: ${names}${postDraft.toIg ? ' + Instagram' : ''} — ลูกค้าเห็นทันที`, confirmText: '🚀 โพสต์' }))) return
    const btn = $('#ps-go'); btn.disabled = true; btn.textContent = '⏳ กำลังโพสต์…'
    try {
      const r = await metaPost({ pageIds, message: postDraft.message, imageUrl: postDraft.imageUrl || undefined, link: postDraft.link || undefined, toInstagram: postDraft.toIg })
      const rows = r.results || []
      $('#ps-result').innerHTML = rows.map(x => `<div class="ch-res">${x.facebook?.ok ? '✅' : '❌'} ${esc(x.name || x.pageId)} ${x.facebook?.ok ? '' : `— ${esc(x.facebook?.error || '')}`}${x.instagram ? ` · IG ${x.instagram.ok ? '✅' : `❌ ${esc(x.instagram.error || '')}`}` : ''}</div>`).join('')
      const okN = rows.filter(x => x.facebook?.ok).length
      if (okN) {
        showToast(`โพสต์สำเร็จ ${okN} เพจ`, 'success')
        // บันทึกลงประวัติโพสต์ (หน้าโซเชียล & คอนเทนต์ใช้ข้อมูลชุดเดียวกัน)
        createDoc('social_posts', { platform: 'facebook', content: postDraft.message, status: 'published', publishedAt: new Date().toISOString(), pageIds, imageUrl: postDraft.imageUrl || '', toInstagram: postDraft.toIg, reach: 0, likes: 0, shares: 0, postedBy: myName(), companyId: myEffectiveCompanyId() }).catch(() => {})
      }
    } catch (e) { showToast(e.message, 'error') }
    finally { const b = $('#ps-go'); if (b) { b.disabled = false; b.textContent = '🚀 โพสต์เลย' } }
  }
  async function aiPost() {
    readPost()
    const btn = $('#ps-ai'); btn.disabled = true; btn.textContent = '⏳ AI กำลังเขียน…'
    try {
      const r = await generateSocialContent('โพสต์ขายรถของโชว์รูม', { 'สิ่งที่อยากสื่อ': postDraft.message || 'ชวนลูกค้าเข้าโชว์รูมและทดลองขับ' }, ['Facebook', 'Instagram'])
      if (r.demo) { showToast('ต้องล็อกอินด้วยบัญชีจริงก่อน', 'error'); return }
      postDraft.message = [r.caption, r.hashtags].filter(Boolean).join('\n\n')
      if ($('#ps-msg')) { $('#ps-msg').value = postDraft.message; $('#ps-count').textContent = `${postDraft.message.length} ตัวอักษร` }
    } catch (e) { showToast(aiErrorText(e), 'error') }
    finally { const b = $('#ps-ai'); if (b) { b.disabled = false; b.textContent = '✨ ให้ AI ช่วยเขียน/ขัดเกลา' } }
  }
  async function share(kind) {
    readPost()
    const text = postDraft.message.trim()
    if (!text) { showToast('พิมพ์ข้อความก่อน', 'error'); return }
    const links = shareLinks(text, postDraft.link)
    if (kind === 'copy') { await copyText(text, '📋 คัดลอกแล้ว ไปวางในแอป TikTok/IG ได้เลย'); return }
    if (kind === 'facebook') await copyText(text, '📋 คัดลอกข้อความแล้ว — วางในช่องโพสต์ของ Facebook')
    window.open(links[kind], '_blank', 'noopener')
  }

  // ── โฆษณา ──
  function adsHtml() {
    if (!status && statusLoading) return '<div class="ch-note">⏳ กำลังตรวจ…</div>'
    if (!status?.metaAds?.configured) return notConnected('โฆษณา Facebook/IG', 'metaAds')
    if (adsLoading) return '<div class="ch-note">⏳ กำลังดึงข้อมูลโฆษณา…</div>'
    if (adsErr) return `<div class="ch-note bad">⚠️ ${esc(adsErr)}</div><button class="btn btn-secondary btn-sm" id="ads-reload">🔄 ลองใหม่</button>`
    if (!ads) return '<button class="btn btn-primary" id="ads-reload">📣 ดึงข้อมูลโฆษณา</button>'
    const accs = ads.accounts || []
    if (!accs.length) return '<div class="ch-note">token นี้ยังไม่เห็นบัญชีโฆษณา — กำหนดบัญชีโฆษณาให้ System User ก่อน</div>'
    const total = accs.reduce((s, a) => s + (a.spend || 0), 0)
    const leads = accs.reduce((s, a) => s + (a.campaigns || []).reduce((x, c) => x + c.leads, 0), 0)
    return `
      <div class="ch-tiles">
        <div class="ch-tile"><small>ใช้ไปเดือนนี้</small><b>${formatCurrency(total)}</b></div>
        <div class="ch-tile"><small>Lead จากโฆษณา</small><b>${leads.toLocaleString()}</b></div>
        <div class="ch-tile"><small>ต้นทุนต่อ Lead</small><b>${leads ? formatCurrency(Math.round(total / leads)) : '—'}</b></div>
        <div class="ch-tile"><small>แคมเปญที่เปิดอยู่</small><b>${accs.reduce((s, a) => s + (a.campaigns || []).filter(c => c.effective === 'ACTIVE').length, 0)}</b></div>
      </div>
      ${accs.map(a => `
        <div class="ch-card">
          <div class="ch-card-h">${esc(a.name || a.id)} <small class="ch-muted">${esc(a.id)} · ใช้ไป ${formatCurrency(a.spend || 0)}</small></div>
          ${a.error ? `<div class="ch-note bad">⚠️ ${esc(a.error)}</div>` : ''}
          <div class="ch-camps">${(a.campaigns || []).slice().sort((x, y) => (y.effective === 'ACTIVE') - (x.effective === 'ACTIVE') || y.spend - x.spend).map(c => `
            <div class="ch-camp">
              <div class="ch-camp-n"><b>${esc(c.name)}</b><span class="ch-st ${c.effective === 'ACTIVE' ? 'on' : ''}">${c.effective === 'ACTIVE' ? '● กำลังวิ่ง' : c.status === 'PAUSED' ? '⏸ หยุดอยู่' : esc(c.effective || c.status)}</span></div>
              <div class="ch-camp-k">
                <span><small>งบ/วัน</small><b>${c.dailyBudget != null ? formatCurrency(c.dailyBudget) : c.lifetimeBudget != null ? `รวม ${formatCurrency(c.lifetimeBudget)}` : 'ตั้งที่ชุดโฆษณา'}</b></span>
                <span><small>ใช้ไป</small><b>${formatCurrency(c.spend)}</b></span>
                <span><small>Lead</small><b>${c.leads}</b></span>
                <span><small>ต่อ Lead</small><b>${c.costPerLead != null ? formatCurrency(c.costPerLead) : '—'}</b></span>
              </div>
              ${manager ? `<div class="ch-camp-a">
                ${c.status === 'ACTIVE' ? `<button class="btn btn-secondary btn-sm" data-ad-status="PAUSED" data-camp="${esc(c.id)}">⏸ หยุด</button>` : `<button class="btn btn-secondary btn-sm" data-ad-status="ACTIVE" data-camp="${esc(c.id)}">▶️ เปิด</button>`}
                ${c.dailyBudget != null ? `<button class="btn btn-secondary btn-sm" data-ad-budget="${esc(c.id)}" data-cur="${c.dailyBudget}">💰 ปรับงบ</button>` : ''}
              </div>` : ''}
            </div>`).join('') || '<div class="ch-muted">ไม่มีแคมเปญ</div>'}</div>
        </div>`).join('')}
      ${manager ? '' : '<small class="ch-muted">เฉพาะผู้จัดการ/เจ้าของที่หยุด เปิด หรือปรับงบได้</small>'}
      <button class="btn btn-ghost btn-sm" id="ads-reload">🔄 ดึงใหม่</button>`
  }
  async function loadAds() {
    adsLoading = true; adsErr = ''; render()
    try { ads = await metaAds() } catch (e) { adsErr = e.message }
    adsLoading = false
    if (alive() && tab === 'ads') render()
  }
  async function adUpdate(payload, label) {
    if (!(await confirmDialog({ title: 'ยืนยันเปลี่ยนโฆษณา', message: `${label} — มีผลกับโฆษณาจริงทันที`, confirmText: 'ยืนยัน' }))) return
    try { await metaAdsUpdate(payload); showToast('✅ เปลี่ยนแล้ว', 'success'); loadAds() } catch (e) { showToast(e.message, 'error') }
  }

  // ── บัญชีของทีม/โชว์รูม/เซลส์ ──
  function connectedPage(a) {
    const pages = status?.meta?.pages || []
    if (a.platform === 'facebook') return pages.find(p => (a.pageId && p.id === String(a.pageId)) || (a.name && p.name === a.name))
    if (a.platform === 'instagram') return pages.find(p => p.ig && (a.handle || a.name || '').replace('@', '').toLowerCase() === (p.ig.username || '').toLowerCase())
    if (a.platform === 'line') return a.level !== 'sales' && status?.line?.configured ? { id: 'line' } : null
    return null
  }
  function accountsHtml() {
    const pages = status?.meta?.pages || []
    const missing = pages.filter(p => !accounts.some(a => a.platform === 'facebook' && String(a.pageId) === p.id))
    return `
      <div class="ch-row" style="margin-bottom:10px">
        <button class="btn btn-primary btn-sm" id="acc-add">➕ เพิ่มบัญชี</button>
        ${missing.length ? `<button class="btn btn-secondary btn-sm" id="acc-import">⬇️ เพิ่มเพจที่เชื่อมแล้ว ${missing.length} เพจ</button>` : ''}
      </div>
      <small class="ch-muted" style="display:block;margin-bottom:4px">🧲 = Lead ที่เข้ามาเดือนนี้ · 📝 = ในนั้นจองแล้ว — นับจากลูกค้าที่กด “➕ Lead” แล้วเลือก “จากบัญชีไหน”</small>
      <small class="ch-muted">รวมบัญชีโซเชียลของทีม โชว์รูม และเซลส์แต่ละคนไว้ที่เดียว (ไม่เก็บรหัสผ่าน/โทเค็น) — ✅ = เชื่อมกับแอปแล้ว แชต/โพสต์จากแอปได้</small>
      ${Object.entries(LEVELS).map(([lv, label]) => {
        const rows = accounts.filter(a => (a.level || 'team') === lv)
        return `<div class="ch-sec"><div class="ch-card-h">${label} <small class="ch-muted">${rows.length} บัญชี</small></div>
          ${rows.length ? `<div class="ch-accs">${rows.map(a => { const c = connectedPage(a); return `
            <div class="ch-acc">
              <div class="ch-acc-main"><b>${esc(ACCOUNT_PLATFORMS[a.platform] || a.platform)} · ${esc(a.name || '')}</b>
                <small>${[a.owner ? `ผู้ดูแล ${esc(a.owner)}` : '', a.handle ? esc(a.handle) : ''].filter(Boolean).join(' · ')}</small></div>
              ${(() => { const r = accRes?.[a.id]; return r ? `<span class="ch-acc-res" title="Lead ที่เข้ามาเดือนนี้ · ในนั้นจองแล้ว (รวมทั้งหมด ${r.allLeads} Lead / จอง ${r.allBooked})">🧲 ${r.leads} · 📝 ${r.booked}</span>` : '' })()}
              <span class="ch-st ${c ? 'on' : ''}">${c ? '✅ เชื่อมแล้ว' : '⚪ บันทึกไว้'}</span>
              <span class="ch-acc-a">${a.url ? `<a class="btn btn-ghost btn-sm" href="${esc(a.url)}" target="_blank" rel="noopener">เปิด ↗</a>` : ''}<button class="btn btn-ghost btn-sm" data-acc-edit="${esc(a.id)}">แก้ไข</button></span>
            </div>` }).join('')}</div>` : '<div class="ch-muted">— ยังไม่มี —</div>'}</div>`
      }).join('')}`
  }
  function accountForm(a = {}) {
    const sales = getSalesStaff()
    const { el, close } = openModal({
      title: a.id ? 'แก้ไขบัญชี' : '➕ เพิ่มบัญชีโซเชียล', size: 'sm',
      body: `<div class="ch-form">
        <label class="input-label">ช่องทาง</label><select class="input" id="af-pf">${Object.entries(ACCOUNT_PLATFORMS).map(([k, v]) => `<option value="${k}" ${a.platform === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <label class="input-label">ของใคร</label><select class="input" id="af-lv">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}" ${(a.level || 'team') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <label class="input-label">ชื่อบัญชี/เพจ <span class="required">*</span></label><input class="input" id="af-name" value="${esc(a.name || '')}" placeholder="เช่น DEEPAL บางบัวทอง">
        <label class="input-label">ผู้ดูแล</label><input class="input" id="af-owner" list="af-sales" value="${esc(a.owner || '')}" placeholder="ชื่อเซลส์/แอดมิน"><datalist id="af-sales">${sales.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
        <label class="input-label">@ชื่อผู้ใช้ / LINE ID</label><input class="input" id="af-handle" value="${esc(a.handle || '')}" placeholder="@lamom">
        <label class="input-label">ลิงก์</label><input class="input" id="af-url" value="${esc(a.url || '')}" placeholder="https://…">
        <label class="input-label">หมายเหตุ</label><input class="input" id="af-note" value="${esc(a.note || '')}">
        <small class="ch-muted">ห้ามใส่รหัสผ่านหรือโทเค็นที่นี่</small>
      </div>`,
      footer: `${a.id ? '<button class="btn btn-ghost" id="af-del" style="color:var(--danger)">ลบ</button>' : ''}<button class="btn btn-secondary" id="af-cancel">ยกเลิก</button><button class="btn btn-primary" id="af-save">💾 บันทึก</button>`,
    })
    const v = id => el.querySelector('#' + id).value.trim()
    el.querySelector('#af-cancel').addEventListener('click', close)
    el.querySelector('#af-del')?.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'ลบบัญชีนี้?', message: a.name || '', danger: true, confirmText: 'ลบ' }))) return
      await softDelete('social_channels', a.id).catch(e => showToast(e.message, 'error')); close()
    })
    el.querySelector('#af-save').addEventListener('click', async () => {
      const url = v('af-url')
      if (!v('af-name')) { showToast('ใส่ชื่อบัญชีก่อน', 'error'); return }
      if (url && !/^https?:\/\//.test(url)) { showToast('ลิงก์ต้องขึ้นต้นด้วย https://', 'error'); return }
      const doc = { platform: v('af-pf'), level: v('af-lv'), name: v('af-name'), owner: v('af-owner'), handle: v('af-handle'), url, note: v('af-note') }
      try {
        if (a.id) await updateDocData('social_channels', a.id, doc)
        else await createDoc('social_channels', { ...doc, companyId: myEffectiveCompanyId(), createdBy: myName() })
        showToast('💾 บันทึกแล้ว', 'success'); close()
      } catch (e) { showToast(e.message, 'error') }
    })
  }
  async function importPages() {
    const pages = (status?.meta?.pages || []).filter(p => !accounts.some(a => a.platform === 'facebook' && String(a.pageId) === p.id))
    for (const p of pages) {
      await createDoc('social_channels', { platform: 'facebook', level: 'team', name: p.name, pageId: p.id, url: p.link || '', owner: '', handle: '', note: '', companyId: myEffectiveCompanyId(), createdBy: myName() }).catch(() => {})
      if (p.ig && !accounts.some(a => a.platform === 'instagram' && (a.handle || '').replace('@', '') === p.ig.username)) {
        await createDoc('social_channels', { platform: 'instagram', level: 'team', name: p.ig.username || p.name, handle: p.ig.username ? `@${p.ig.username}` : '', url: p.ig.username ? `https://instagram.com/${p.ig.username}` : '', owner: '', note: '', companyId: myEffectiveCompanyId(), createdBy: myName() }).catch(() => {})
      }
    }
    showToast(`เพิ่ม ${pages.length} เพจแล้ว — แก้ "ของใคร" ให้เพจของเซลส์ได้`, 'success')
  }

  // ── วิธีเชื่อม ──
  // ── Google Maps: คะแนน/รีวิวของเราและคู่แข่ง ──
  let mapsQ = lsGet('ch-maps-q', ''), maps = null, mapsLoading = false, mapsErr = ''
  const stars = r => r == null ? '—' : '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r))
  function mapsHtml() {
    if (status && !status.google?.configured) return `<div class="ch-card">${notConnected('Google Maps', 'google')}<small class="ch-muted">ใส่คีย์ครั้งเดียว แล้วค้นหาโชว์รูมเรา/คู่แข่งได้ทันที เห็นดาว จำนวนรีวิว และรีวิวล่าสุด</small></div>`
    return `<div class="ch-maps">
      <div class="ch-card ch-maps-bar"><input class="input" id="mp-q" placeholder="ชื่อโชว์รูม เช่น DEEPAL บางบัวทอง" value="${esc(mapsQ)}"><button type="button" class="btn btn-primary" id="mp-go">🔎 ค้นหา</button></div>
      <div class="ch-maps-chips">${['โชว์รูมรถ บางบัวทอง', 'DEEPAL นนทบุรี', 'BYD บางบัวทอง'].map(x => `<button type="button" class="ch-chip" data-mpq="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      ${mapsLoading ? '<div class="ch-note">⏳ กำลังค้นหา…</div>' : ''}
      ${mapsErr ? `<div class="ch-note bad">⚠️ ${esc(mapsErr)}</div>` : ''}
      ${maps ? (maps.length ? maps.map((p, i) => `<div class="ch-card ch-place">
        <div class="ch-place-h"><div><b>${esc(p.name)}</b><small>${esc(p.address)}</small></div>
          <div class="ch-place-r"><b>${p.rating ?? '—'}</b><span class="ch-stars">${stars(p.rating)}</span><small>${p.reviews.toLocaleString('en-US')} รีวิว</small></div></div>
        ${p.latest.length ? `<div class="ch-revs">${p.latest.map((r, j) => `<div class="ch-rev ${r.rating <= 3 ? 'low' : ''}"><div class="ch-rev-h"><span class="ch-stars">${stars(r.rating)}</span><small>${esc(r.author)} · ${esc(r.when)}</small></div><div>${esc(r.text) || '<span class="ch-muted">(ไม่มีข้อความ)</span>'}</div>
          ${r.text ? `<button type="button" class="ch-linkbtn" data-rev="${i}:${j}">✨ AI ร่างคำตอบ</button>` : ''}</div>`).join('')}</div>` : '<small class="ch-muted">ยังไม่มีรีวิวที่ Google ส่งมาให้</small>'}
        ${p.url ? `<a class="btn btn-secondary btn-sm" href="${esc(p.url)}" target="_blank" rel="noopener">🗺 เปิดใน Google Maps / ตอบรีวิว</a>` : ''}
      </div>`).join('') : '<div class="ch-empty">ไม่พบสถานที่ ลองพิมพ์ชื่อให้ละเอียดขึ้น</div>') : '<div class="ch-empty">พิมพ์ชื่อโชว์รูมเราหรือคู่แข่ง แล้วกดค้นหา</div>'}
    </div>`
  }
  async function searchMaps(qv) {
    mapsQ = String(qv || '').trim(); lsSet('ch-maps-q', mapsQ)
    if (mapsQ.length < 2) { showToast('พิมพ์ชื่อสถานที่ก่อน', 'info'); return }
    mapsLoading = true; mapsErr = ''; render()
    try { maps = (await googlePlaces(mapsQ)).places || [] } catch (e) { mapsErr = e.message; maps = null }
    mapsLoading = false; if (alive() && tab === 'maps') render()
  }
  async function draftReview(ref, btn) {
    const [i, j] = ref.split(':').map(Number)
    const p = maps?.[i], r = p?.latest?.[j]; if (!r) return
    btn.disabled = true; btn.textContent = '⏳ กำลังคิด…'
    try {
      const draft = await suggestCustomerReply(`รีวิว ${r.rating} ดาวบน Google Maps: ${r.text}`, { channel: 'ตอบรีวิว Google Maps ในนามโชว์รูม (สุภาพ ขอบคุณ ถ้ารีวิวไม่ดีให้ขอโทษและชวนติดต่อกลับ ไม่ต้องขายของ)', sender: r.author })
      if (!draft) { showToast('AI ยังตอบไม่ได้ตอนนี้', 'error'); return }
      const { el, close } = openModal({ title: '✨ ร่างคำตอบรีวิว', size: 'md', body: `<textarea class="input" id="rv-t" rows="6">${esc(String(draft).trim())}</textarea><small class="ch-muted">กดคัดลอก แล้วเปิด Google Maps ไปวางตอบรีวิวนี้</small>`, footer: `<button class="btn btn-secondary" id="rv-c">ปิด</button>${p.url ? `<a class="btn btn-secondary" href="${esc(p.url)}" target="_blank" rel="noopener">🗺 เปิด Google Maps</a>` : ''}<button class="btn btn-primary" id="rv-cp">📋 คัดลอก</button>` })
      el.querySelector('#rv-c').addEventListener('click', close)
      el.querySelector('#rv-cp').addEventListener('click', () => copyText(el.querySelector('#rv-t').value).then(() => showToast('📋 คัดลอกแล้ว', 'success')))
    } catch (e) { showToast(aiErrorText(e), 'error') }
    finally { btn.disabled = false; btn.textContent = '✨ AI ร่างคำตอบ' }
  }

  function guideHtml() {
    const s = status || {}
    const ok = { line: s.line?.configured, meta: s.meta?.configured && (s.meta.pages || []).length, metaAds: s.metaAds?.configured, tiktok: false, google: s.google?.configured }
    return `
      <div class="ch-guide">
        ${PLATFORM_GUIDE.map(g => `
          <details class="ch-card ch-g" id="g-${g.key}" ${!ok[g.statusKey] ? '' : ''}>
            <summary><span>${g.icon} <b>${esc(g.name)}</b></span><span class="ch-st ${ok[g.statusKey] ? 'on' : ''}">${ok[g.statusKey] ? '✅ ใช้ได้แล้ว' : '⚪ ยังไม่เชื่อม'}</span></summary>
            <div class="ch-g-b">
              <div class="ch-g-h">✅ ทำอะไรได้ในแอป</div><ul>${g.can.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
              <div class="ch-g-h">🛠 ต้องตั้งค่า (ทำครั้งเดียว)</div><ol>${g.setup.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
              <div class="ch-g-h">⛔ แพลตฟอร์มไม่อนุญาต</div><ul class="no">${g.cannot.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
            </div>
          </details>`).join('')}
        <div class="ch-card"><div class="ch-card-h">🔐 วิธีใส่โทเค็นอย่างปลอดภัย (Secret)</div><ol>${SECRET_STEPS.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
          <small class="ch-muted">โทเค็นอยู่ที่ Cloudflare เท่านั้น ไม่อยู่ในโค้ด ไม่อยู่ในฐานข้อมูล และหน้าเว็บมองไม่เห็น</small></div>
      </div>`
  }

  // ── events (delegated) ──
  container.addEventListener('click', e => {
    const t = e.target
    const tabBtn = t.closest('.ch-tabs [data-tab]')
    if (tabBtn) {
      tab = tabBtn.dataset.tab; lsSet('ch-tab', tab); render()
      if (tab === 'ads' && status?.metaAds?.configured && !ads && !adsLoading) loadAds()
      if (tab === 'inbox' && status?.meta?.pages?.length && !metaLoaded) loadMeta()
      if (tab === 'maps' && status?.google?.configured && !maps && !mapsLoading && mapsQ) searchMaps(mapsQ)
      return
    }
    if (t.closest('#ch-refresh')) { metaLoaded = false; loadStatus(); return }
    const g = t.closest('[data-goto-guide]')
    if (g) { tab = 'guide'; lsSet('ch-tab', tab); render(); const d = container.querySelector(`#g-${g.dataset.gotoGuide}`); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }) } return }
    const f = t.closest('[data-filter]'); if (f) { filter = f.dataset.filter; render(); return }
    const o = t.closest('[data-open]'); if (o) { openThread(o.dataset.open); return }
    if (t.closest('#ch-back')) { openKey = ''; stopMsgs?.(); stopMsgs = null; render(); return }
    if (t.closest('#ch-send')) { sendReply(); return }
    if (t.closest('#ch-ai')) { aiDraft(); return }
    if (t.closest('#ch-lead')) { toLead(); return }
    if (t.closest('#ch-reload-meta')) { metaLoaded = false; loadMeta(); return }
    if (t.closest('#ps-go')) { doPost(); return }
    if (t.closest('#ps-ai')) { aiPost(); return }
    const sh = t.closest('[data-share]'); if (sh) { share(sh.dataset.share); return }
    if (t.closest('#ads-reload')) { loadAds(); return }
    const st = t.closest('[data-ad-status]')
    if (st) { adUpdate({ campaignId: st.dataset.camp, status: st.dataset.adStatus }, st.dataset.adStatus === 'PAUSED' ? 'หยุดแคมเปญนี้' : 'เปิดแคมเปญนี้'); return }
    const bd = t.closest('[data-ad-budget]')
    if (bd) {
      const { el, close } = openModal({ title: '💰 ปรับงบรายวัน', size: 'sm', body: `<label class="input-label">งบต่อวัน (บาท)</label><input class="input" id="bd-v" type="number" inputmode="numeric" min="50" value="${esc(bd.dataset.cur)}">`, footer: '<button class="btn btn-secondary" id="bd-c">ยกเลิก</button><button class="btn btn-primary" id="bd-s">บันทึก</button>' })
      el.querySelector('#bd-c').addEventListener('click', close)
      el.querySelector('#bd-s').addEventListener('click', () => { const n = Number(el.querySelector('#bd-v').value); close(); adUpdate({ campaignId: bd.dataset.adBudget, dailyBudget: n }, `ตั้งงบรายวันเป็น ${formatCurrency(n)}`) })
      return
    }
    if (t.closest('#mp-go')) { searchMaps($('#mp-q')?.value); return }
    const mq = t.closest('[data-mpq]'); if (mq) { searchMaps(mq.dataset.mpq); return }
    const rv = t.closest('[data-rev]'); if (rv) { draftReview(rv.dataset.rev, rv); return }
    if (t.closest('#acc-add')) { accountForm(); return }
    if (t.closest('#acc-import')) { importPages(); return }
    const ae = t.closest('[data-acc-edit]'); if (ae) { accountForm(accounts.find(a => a.id === ae.dataset.accEdit)); return }
  })
  container.addEventListener('change', e => {
    const p = e.target.closest('[data-page]')
    if (p) { readPost(); p.checked ? postDraft.pages.add(p.dataset.page) : postDraft.pages.delete(p.dataset.page); if (!postDraft.pages.size) postDraft.toIg = false; render() }
  })
  container.addEventListener('input', e => {
    if (e.target.id === 'ch-q') {
      q = e.target.value
      render()
    }
    if (e.target.id === 'ps-msg') { const c = $('#ps-count'); if (c) c.textContent = `${e.target.value.length} ตัวอักษร` }
  })
  container.addEventListener('keydown', e => {
    if (e.target.id === 'ch-text' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendReply() }
    if (e.target.id === 'mp-q' && e.key === 'Enter') { e.preventDefault(); searchMaps(e.target.value) }
  })

  render()
  loadStatus()
}
