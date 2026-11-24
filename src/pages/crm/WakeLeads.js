/**
 * (v1.0.1231) ปลุกลีดเก่า — Lead/Prospect ที่เงียบเกิน 30 วัน
 * Route: /crm/wake-leads
 * ลูกค้าที่ผูก LINE แล้ว → ร่างข้อความรายคน (ตั้งต้น หรือให้ AI เขียน) แก้ได้ แล้วกด "✅ ส่งทั้งหมด" ครั้งเดียว
 * ลูกค้าที่มีแต่เบอร์ → รายชื่อให้โทร (แตะโทรได้เลย) พร้อมข้อความไว้คัดลอก
 * ทักคนละไม่เกิน 1 ครั้งต่อ 30 วัน (wakeSentAt) · ข้ามคนที่เลิกรับ/บล็อก/ไม่ยินยอมรับข่าวสาร (utils/wakeLeads.js)
 */
import { listAllDocs, listDocs, updateDocData, createDoc } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import { showToast, getState } from '../../core/store.js'
import { todayBangkok } from '../../utils/format.js'
import { confirmDialog } from '../../utils/modal.js'
import { escHtml } from '../../utils/escape.js'
import { callLink, smsHref } from '../../utils/callLink.js'
import { prepareLineLink, lineLinkInvite } from '../../utils/lineLink.js'
import { copyText } from '../../utils/copyText.js'
import { lineReply } from '../../utils/socialApi.js'
import { normalizeProgram } from '../../utils/salesPrograms.js'
import { customerPrograms, promoLines } from '../../utils/campaignLeads.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { modelMatches, parseBatchNudgeReply } from '../../utils/salesAi.js'
import { pickWakeLeads, wakeMessage, buildWakePrompt, WAKE_QUIET_DAYS, WAKE_COOLDOWN_DAYS } from '../../utils/wakeLeads.js'
import { navigate } from '../../core/router.js'

const SHOW_MAX = 60

export default async function WakeLeadsPage(container) {
  const myGen = container.__routerGen
  const me = getState('user') || {}
  const meName = String(me.displayName || '').trim().split(/\s+/)[0]
  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
  const scope = await getVisibilityScope()
  let rows = []
  const drafts = new Map() // id → ข้อความ
  const picked = new Set()
  const sent = new Set()
  let busy = false

  async function load() {
    const today = todayBangkok()
    const [customers, programs] = await Promise.all([
      listAllDocs('customers', companyScopeFilters(), 'createdAt', 'desc').catch(() => null),
      listDocs('sales_programs', [], 'dateFrom', 'desc', 1000).then(r => r.filter(x => !x.deleted).map(x => ({ ...normalizeProgram(x), id: x.id }))).catch(() => []),
    ])
    if (!customers) showToast('โหลดรายชื่อลูกค้าไม่สำเร็จ', 'error')
    const brandOf = m => modelMatches(m, getVehicles(), 1)[0]?.brand || ''
    rows = pickWakeLeads(customers || [], { today, mine: c => scopeIncludesRecord(scope, c.assignedTo, c) }).slice(0, SHOW_MAX)
      .map(r => ({ ...r, promo: promoLines(customerPrograms(programs, r.c.interestedModel, { brand: brandOf(r.c.interestedModel), today })) }))
    for (const r of rows) {
      if (!drafts.has(r.c.id)) drafts.set(r.c.id, wakeMessage(r.c, r.promo, meName))
      if (r.channel === 'line') picked.add(r.c.id)
    }
  }

  const rowCard = r => {
    const id = escHtml(r.c.id)
    const isLine = r.channel === 'line'
    const done = sent.has(r.c.id)
    return `<div class="card wk-row" style="padding:10px 12px;${done ? 'opacity:.55' : ''}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        ${isLine ? `<input type="checkbox" class="wk-pick" data-id="${id}" ${picked.has(r.c.id) && !done ? 'checked' : ''} ${done ? 'disabled' : ''} style="width:20px;height:20px;margin-top:2px;flex:none" aria-label="เลือกส่ง">` : ''}
        <div style="flex:1 1 180px;min-width:0">
          <a href="#" class="wk-open" data-id="${id}" style="font-weight:700;color:var(--text);overflow-wrap:anywhere">${escHtml(r.name)}</a>
          <div style="font-size:0.74rem;color:var(--text-muted);overflow-wrap:anywhere">${escHtml(r.c.interestedModel || 'ยังไม่ระบุรุ่น')} · เงียบ ${r.days} วัน${r.c.assignedTo ? ` · ${escHtml(r.c.assignedTo)}` : ''}${r.c.temperature === 'hot' ? ' · 🔴 Hot' : ''}</div>
          ${r.promo.length ? `<div style="font-size:0.72rem;color:var(--success);overflow-wrap:anywhere">🎁 ${escHtml(r.promo.slice(0, 2).join(' · '))}</div>` : ''}
        </div>
        <div style="flex:none;font-size:0.76rem">${done ? '✔ ส่งแล้ว' : isLine ? '💚 LINE' : callLink(r.c.phone, r.name)}</div>
      </div>
      <textarea class="input wk-msg" data-id="${id}" rows="4" data-no-mic style="width:100%;margin-top:6px;font-size:16px" ${done ? 'disabled' : ''}>${escHtml(drafts.get(r.c.id) || '')}</textarea>
      ${isLine || done ? '' : `<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-xs wk-copy" data-id="${id}">📋 คัดลอก</button>
        ${smsHref(r.c.phone) ? `<button class="btn btn-secondary btn-xs wk-sms" data-id="${id}" title="เปิดแอป SMS พร้อมข้อความ + ลิงก์ให้ลูกค้าผูก LINE">📱 SMS + ลิงก์ LINE</button>` : ''}
        <button class="btn btn-success btn-xs wk-done" data-id="${id}">✅ ทักแล้ว</button></div>`}
    </div>`
  }

  function render() {
    if (container.__routerGen !== myGen) return
    const line = rows.filter(r => r.channel === 'line')
    const phone = rows.filter(r => r.channel === 'phone')
    const nPick = line.filter(r => picked.has(r.c.id) && !sent.has(r.c.id)).length
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div style="min-width:0">
            <div class="page-title">😴 ปลุกลีดเก่า</div>
            <div class="page-subtitle">ลูกค้าที่ยังไม่จองและเงียบเกิน ${WAKE_QUIET_DAYS} วัน · ทักคนละไม่เกิน 1 ครั้งต่อ ${WAKE_COOLDOWN_DAYS} วัน · ข้ามคนที่ขอเลิกรับ</div>
          </div>
          <div class="page-actions"><button class="btn btn-secondary" id="wk-ai" ${rows.length && !busy ? '' : 'disabled'}>✨ ให้ AI เขียนใหม่ทั้งหมด</button></div>
        </div>
        ${!rows.length ? `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">ไม่มีลีดเงียบเกิน ${WAKE_QUIET_DAYS} วันที่ต้องทักตอนนี้</div></div>` : ''}
        ${line.length ? `<div class="card" style="padding:12px 14px;margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div style="flex:1 1 220px;min-width:0"><b>💚 ส่งทาง LINE ได้ ${line.length} คน</b><div style="font-size:0.74rem;color:var(--text-muted)">อ่าน/แก้ข้อความได้ก่อนส่ง · ส่งเป็นรายคน (ใช้โควตา LINE OA คนละ 1 ข้อความ)</div></div>
          <button class="btn btn-primary" id="wk-send" ${nPick && !busy ? '' : 'disabled'}>${busy ? '⏳ กำลังส่ง…' : `✅ ส่งทั้งหมด (${nPick})`}</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">${line.map(rowCard).join('')}</div>` : ''}
        ${phone.length ? `<div style="font-weight:700;margin:6px 0 8px">📞 ยังไม่ผูก LINE — โทรหรือทักเอง ${phone.length} คน</div>
        <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:8px">โทร หรือกด "📱 SMS + ลิงก์ LINE" (แนบลิงก์ให้ลูกค้าแตะผูก LINE เอง) — ผูกแล้วรอบหน้าส่งได้ในคลิกเดียว</div>
        <div style="display:flex;flex-direction:column;gap:8px">${phone.map(rowCard).join('')}</div>` : ''}
      </div>`
    bind()
  }

  function bind() {
    container.querySelectorAll('.wk-msg').forEach(t => t.addEventListener('input', () => drafts.set(t.dataset.id, t.value)))
    container.querySelectorAll('.wk-pick').forEach(c => c.addEventListener('change', () => {
      if (c.checked) picked.add(c.dataset.id); else picked.delete(c.dataset.id)
      const btn = container.querySelector('#wk-send')
      const n = rows.filter(r => r.channel === 'line' && picked.has(r.c.id) && !sent.has(r.c.id)).length
      if (btn) { btn.textContent = `✅ ส่งทั้งหมด (${n})`; btn.disabled = !n || busy }
    }))
    container.querySelectorAll('.wk-open').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(`/crm/customers?id=${encodeURIComponent(a.dataset.id)}`) }))
    container.querySelectorAll('.wk-copy').forEach(b => b.addEventListener('click', () => copyText(drafts.get(b.dataset.id) || '', '📋 คัดลอกแล้ว', 'คัดลอกไม่สำเร็จ')))
    // (v1.0.1235) ลูกค้าที่มีแต่เบอร์: SMS พร้อมลิงก์ผูก LINE — ลูกค้าแตะแล้ว รอบหน้าส่งทาง LINE ได้ในคลิกเดียว
    container.querySelectorAll('.wk-sms').forEach(b => b.addEventListener('click', async () => {
      const r = rows.find(x => x.c.id === b.dataset.id)
      if (!r) return
      b.disabled = true
      const link = await prepareLineLink([{ col: 'customers', id: r.c.id }])
      b.disabled = false
      const href = smsHref(r.c.phone, (drafts.get(r.c.id) || '') + lineLinkInvite(link?.url))
      if (href) window.location.href = href
    }))
    container.querySelectorAll('.wk-done').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true
      if (await markSent(rows.find(r => r.c.id === b.dataset.id), 'โทร/ทักเอง')) render(); else b.disabled = false
    }))
    container.querySelector('#wk-ai')?.addEventListener('click', aiRewrite)
    container.querySelector('#wk-send')?.addEventListener('click', sendAll)
  }

  async function markSent(r, how) {
    if (!r) return false
    const at = new Date().toISOString()
    try {
      await updateDocData('customers', r.c.id, { wakeSentAt: at, wakeSentBy: me.displayName || '', lastContactAt: at })
      await createDoc('customer_notes', { customerId: r.c.id, customer: r.name, type: 'internal', text: `😴 ปลุกลีดเก่า (${how}): ${(drafts.get(r.c.id) || '').slice(0, 500)}`, staff: me.displayName || '', time: at, pinned: false, companyId: r.c.companyId ?? null }).catch(() => null)
      r.c.wakeSentAt = at
      sent.add(r.c.id)
      return true
    } catch { showToast('บันทึกไม่สำเร็จ', 'error'); return false }
  }

  async function aiRewrite() {
    const ai = await import('../../utils/ai.js')
    if (!ai.isAiEnabled()) { showToast('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้ AI', 'warning'); return }
    const todo = rows.filter(r => !sent.has(r.c.id)).slice(0, 30)
    if (!todo.length) return
    busy = true; render()
    try {
      const out = parseBatchNudgeReply(await ai.askJsonPrompt(buildWakePrompt(todo), 6000), todo.length)
      out.forEach(({ i, msg }) => drafts.set(todo[i - 1].c.id, msg))
      showToast(out.length ? `✨ AI เขียนให้ ${out.length} คน` : 'AI เขียนไม่สำเร็จ ใช้ข้อความเดิมไปก่อน', out.length ? 'success' : 'warning')
    } catch { showToast('AI เขียนไม่สำเร็จ ใช้ข้อความเดิมไปก่อน', 'warning') }
    busy = false; render()
  }

  async function sendAll() {
    const list = rows.filter(r => r.channel === 'line' && picked.has(r.c.id) && !sent.has(r.c.id) && String(drafts.get(r.c.id) || '').trim())
    if (!list.length) return
    const ok = await confirmDialog({ title: '✅ ส่ง LINE ทักลูกค้า', message: `ส่งข้อความถึงลูกค้า ${list.length} คน คนละข้อความตามที่ร่างไว้ใช่ไหม?`, confirmText: `ส่ง ${list.length} คน` })
    if (!ok) return
    busy = true; render()
    let okN = 0, err = ''
    for (const r of list) {
      try {
        await lineReply('line_' + String(r.c.lineUserId).replace(/[^A-Za-z0-9-]/g, ''), drafts.get(r.c.id))
        okN++
        await markSent(r, 'LINE')
      } catch (e) { err = e?.message || 'ส่งไม่สำเร็จ'; if (/โควตา|quota|ตั้งค่า LINE OA/i.test(err)) break }
    }
    busy = false
    showToast(err ? `ส่งแล้ว ${okN}/${list.length} คน · ${err}` : `✅ ส่งแล้ว ${okN} คน`, err ? 'warning' : 'success')
    render()
  }

  await load()
  render()
}
