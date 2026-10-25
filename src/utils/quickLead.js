// เพิ่ม Lead ด่วน — ฟอร์มเต็มในหน้าลูกค้ามี 15 ช่อง (บังคับนามสกุลด้วย) เซลส์ที่ยืนคุยกับลูกค้าหน้าโชว์รูม/รับสาย
// เลยไม่ค่อยบันทึก ทำให้รายงานประจำวันขึ้น Lead 0 ตลอด — ตัวนี้เหลือ 4 ช่อง (ชื่อ, เบอร์หรือ LINE, รถที่สนใจ, ที่มา)
// เปิดได้จากปุ่ม 🧲 บน Topbar ทุกหน้า บันทึกลง collection `customers` แบบเดียวกับฟอร์มเต็ม (stage ตามกติกาเดิม:
// มีเบอร์/LINE = Prospect, ไม่มี = Lead) ผู้ดูแล = คนที่กรอก และเตือนก่อนถ้าเบอร์/LINE ซ้ำกับลูกค้าที่มีอยู่แล้ว
import { openModal } from './modal.js'
import { showToast, getState } from '../core/store.js'
import { listDocs, createDoc } from '../core/db.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../core/companyScope.js'
import { deriveInitialStage } from '../core/customerInsights.js'
import { scheduleLeadFollowups } from './leadFollowups.js'
import { parseLeadText, maskContacts, buildLeadNamePrompt, parseLeadNameReply } from './leadText.js'

export const QUICK_SOURCES = [
  ['walk-in', '🚶 Walk-in'], ['phone', '📱 โทรเข้า'], ['facebook', '📘 Facebook'], ['line', '💚 LINE'],
  ['tiktok', '🎵 TikTok'], ['referral', '🤝 แนะนำ'], ['other', '📌 อื่นๆ'],
]

export const digitsOnly = s => String(s ?? '').replace(/\D/g, '')
// เบอร์สำหรับเทียบซ้ำ: ตัวเลขล้วน และ +66xxxxxxxxx = 0xxxxxxxxx (คนละรูปแบบแต่เบอร์เดียวกัน)
export const phoneKey = s => { const d = digitsOnly(s); return d.startsWith('66') && d.length === 11 ? '0' + d.slice(2) : d }

// ช่อง "เบอร์หรือ LINE" ช่องเดียว: ถ้าเป็นตัวเลขล้วน 9–10 หลัก (หลังตัดขีด/ช่องว่าง, รับ +66 ด้วย) = เบอร์โทร
// นอกนั้นถือเป็น LINE ID
export function splitContact(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { phone: '', lineId: '' }
  let d = digitsOnly(s)
  if (/^\+?[\d\s\-().]+$/.test(s)) {
    if (d.startsWith('66') && d.length === 11) d = '0' + d.slice(2)
    if (d.length >= 9 && d.length <= 10) return { phone: d, lineId: '' }
  }
  return { phone: '', lineId: s }
}

// แปลงค่าจากฟอร์มเป็นเอกสารลูกค้า (ยังไม่มี companyId/เวลา — ใส่ตอนบันทึก)
export function buildQuickLead({ name = '', contact = '', model = '', source = 'walk-in', note = '', hot = false } = {}, { assignedTo = '' } = {}) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ')
  const { phone, lineId } = splitContact(contact)
  const fields = {
    firstName, lastName, phone, lineId, email: '',
    interestedModel: String(model).trim(), source: source || 'other',
    temperature: hot ? 'hot' : null, assignedTo, vip: false, notes: String(note).trim(),
    budget: 0, occupation: '', monthlyIncome: 0,
  }
  return { ...fields, stage: deriveInitialStage(fields), isLost: false, lostReason: '', lostAt: null, bookingId: null, tags: [] }
}

// หา ลูกค้าที่ซ้ำ: เบอร์ (เทียบเฉพาะตัวเลข) หรือ LINE ID (ไม่สนตัวพิมพ์เล็ก/ใหญ่และ @ นำหน้า)
export function findDuplicate(lead, customers) {
  const normLine = s => String(s ?? '').trim().toLowerCase().replace(/^@/, '')
  const phone = phoneKey(lead.phone)
  const line = normLine(lead.lineId)
  return (customers || []).find(c => !c.deleted && (
    (phone && phoneKey(c.phone) === phone) || (line && normLine(c.lineId) === line)
  )) || null
}

// รุ่นที่ถูกกรอกบ่อยสุด (ไม่สนตัวพิมพ์/ช่องว่าง) ใช้ตัวสะกดที่เจอบ่อยสุดของแต่ละรุ่น
export function topModels(customers, max = 30) {
  const count = new Map()
  ;(customers || []).forEach(c => {
    const m = String(c?.interestedModel || '').trim().replace(/\s+/g, ' ')
    if (!m || c.deleted) return
    const k = m.toLowerCase()
    const e = count.get(k) || { n: 0, spell: {} }
    e.n++; e.spell[m] = (e.spell[m] || 0) + 1
    count.set(k, e)
  })
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, max)
    .map(e => Object.entries(e.spell).sort((a, b) => b[1] - a[1])[0][0])
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// เพิ่ม Lead ที่มีเบอร์แล้ว → ชวนโทรทันที (โทรภายในไม่กี่นาทีโอกาสปิดสูงกว่ามาก) · กลับมาที่แอประบบถามผลการโทรให้
function offerCallNow(c) {
  const tel = String(c.phone).replace(/[^\d+]/g, '')
  if (!tel) return
  const { el, close } = openModal({
    title: `📞 โทรหา ${escHtml(c.firstName || 'ลูกค้า')} ตอนนี้เลยไหม?`, size: 'sm',
    body: `<div style="font-size:0.85rem;line-height:1.6">ยิ่งโทรเร็วตอนลูกค้ายังสนใจอยู่ โอกาสปิดการขายยิ่งสูง<br><span style="color:var(--text-muted);font-size:0.76rem">โทรเสร็จกลับมาที่แอป ระบบจะถามผลการโทรให้บันทึก</span></div>`,
    footer: `<button class="btn btn-secondary" id="qc-later">ไว้ทีหลัง</button><a class="btn btn-primary" id="qc-call" href="tel:${escHtml(tel)}">📞 โทรเลย ${escHtml(tel)}</a>`,
  })
  el.querySelector('#qc-later').addEventListener('click', close)
  el.querySelector('#qc-call').addEventListener('click', async () => {
    try { const { armCallLog } = await import('./callLogger.js'); armCallLog(c, { hasPending: () => true }) } catch {}
    setTimeout(close, 300)
  })
}

export function openQuickLead() {
  const me = getState('user') || {}
  let source = 'walk-in'
  let existing = null
  // โหลดลูกค้าล่าสุดไว้เช็คซ้ำ (ไม่บล็อกการเปิดฟอร์ม — ถ้าโหลดไม่ทันก็บันทึกได้ตามปกติ)
  listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 1000).then(r => {
    existing = r
    // รุ่นที่ลูกค้าสนใจบ่อยที่สุด → ตัวเลือกให้กดแทนพิมพ์เอง (พิมพ์รุ่นอื่นได้ตามเดิม)
    const dl = document.getElementById('ql-models')
    if (dl) dl.innerHTML = topModels(r).map(m => `<option value="${escHtml(m)}">`).join('')
  }).catch(() => {})

  const { el, close } = openModal({
    title: '🧲 เพิ่ม Lead ด่วน', size: 'sm',
    body: `
      <div style="display:flex;flex-direction:column;gap:12px">
        <details id="ql-paste-box" style="border:1px dashed var(--border);border-radius:10px;padding:8px 10px">
          <summary style="cursor:pointer;font-size:0.82rem;font-weight:600">📋 วางแชทลูกค้า หรือ 🎤 พูดบอก ให้ช่วยกรอกให้</summary>
          <textarea class="input" id="ql-paste" data-no-mic rows="3" style="margin-top:8px;width:100%;font-size:16px" placeholder="ก๊อปข้อความจาก Facebook / LINE / TikTok มาวาง หรือกด 🎤 แล้วพูด เช่น &quot;คุณสมชาย 0812345678 สนใจ S05 มาจากเฟซบุ๊ก&quot;"></textarea>
          <button type="button" class="btn btn-primary btn-sm" id="ql-fill" style="margin-top:6px;background:linear-gradient(135deg,#8B5CF6,#3B82F6);border:none">✨ กรอกให้</button>
          <button type="button" class="btn btn-secondary btn-sm" id="ql-mic" style="margin-top:6px" title="พูดแทนพิมพ์">🎤 พูด</button>
          <span id="ql-fill-msg" style="font-size:0.72rem;color:var(--text-muted);margin-left:6px"></span>
        </details>
        <div class="input-group"><label class="input-label">ชื่อลูกค้า <span class="required">*</span></label><input class="input" id="ql-name" placeholder="เช่น สมชาย ใจดี" autocomplete="off"><span class="input-error" id="ql-name-e"></span></div>
        <div class="input-group"><label class="input-label">เบอร์โทร หรือ LINE ID</label><input class="input" id="ql-contact" placeholder="0812345678 หรือ @lineid" autocomplete="off" inputmode="text"><span class="input-error" id="ql-dup" style="color:var(--warning)"></span></div>
        <div class="input-group"><label class="input-label">รถที่สนใจ</label><input class="input" id="ql-model" placeholder="เช่น BYD Seal" autocomplete="off" list="ql-models"><datalist id="ql-models"></datalist></div>
        <div class="input-group"><label class="input-label">มาจากไหน</label>
          <div id="ql-sources" style="display:flex;flex-wrap:wrap;gap:6px">${QUICK_SOURCES.map(([k, v]) => `<button type="button" class="btn btn-sm ql-src ${k === source ? 'btn-primary' : 'btn-secondary'}" data-k="${k}">${v}</button>`).join('')}</div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer"><input type="checkbox" id="ql-hot"> 🔴 สนใจมาก (Hot) — พร้อมซื้อเร็ว</label>
        <div style="font-size:0.7rem;color:var(--text-muted)">ผู้ดูแล: ${escHtml(me.displayName || me.email || '—')} · กรอกข้อมูลเพิ่มเติมทีหลังได้ในหน้าลูกค้า</div>
      </div>`,
    footer: `<button class="btn btn-secondary" id="ql-more">เพิ่มอีกคน</button><button class="btn btn-primary" id="ql-save">💾 บันทึก</button>`,
  })
  const $ = id => el.querySelector('#' + id)
  el.querySelectorAll('.ql-src').forEach(b => b.addEventListener('click', () => {
    source = b.dataset.k
    el.querySelectorAll('.ql-src').forEach(x => { x.className = `btn btn-sm ql-src ${x.dataset.k === source ? 'btn-primary' : 'btn-secondary'}` })
  }))
  $('ql-contact').addEventListener('input', () => {
    const dup = existing && findDuplicate(splitContact($('ql-contact').value), existing)
    $('ql-dup').textContent = dup ? `⚠️ เบอร์/LINE นี้มีในระบบแล้ว: ${[dup.firstName, dup.lastName].filter(Boolean).join(' ')}${dup.assignedTo ? ` (ผู้ดูแล ${dup.assignedTo})` : ''}` : ''
  })

  // 🎤 พูดข้อมูลลูกค้า (Chrome/Android รองรับภาษาไทย) — พูดจบแล้วกรอกให้ทันที; เครื่องที่ไม่รองรับซ่อนปุ่ม
  let rec = null
  $('ql-mic').addEventListener('click', async () => {
    if (rec) { try { rec.stop() } catch {} return }
    const { createSTT } = await import('./voice.js')
    rec = createSTT({
      onInterim: t => { $('ql-fill-msg').textContent = '🎙️ ' + t },
      onFinal: t => { $('ql-paste').value = [$('ql-paste').value.trim(), t].filter(Boolean).join(' '); $('ql-fill').click() },
      onEnd: () => { rec = null; $('ql-mic').textContent = '🎤 พูด' },
      onError: () => { rec = null; $('ql-mic').textContent = '🎤 พูด'; $('ql-fill-msg').textContent = 'ไม่ได้ยินเสียง ลองใหม่อีกครั้ง' },
    })
    if (!rec) { $('ql-mic').style.display = 'none'; $('ql-fill-msg').textContent = 'เครื่องนี้ยังพูดแทนพิมพ์ไม่ได้ ใช้วางข้อความแทนนะ'; return }
    $('ql-mic').textContent = '⏹ หยุด'; $('ql-fill-msg').textContent = '🎙️ กำลังฟัง...'
    try { rec.start() } catch { rec = null; $('ql-mic').textContent = '🎤 พูด' }
  })

  let pastedNote = ''
  $('ql-fill').addEventListener('click', async () => {
    const text = $('ql-paste').value.trim()
    if (!text) { $('ql-paste').focus(); return }
    const models = [...$('ql-models').options].map(o => o.value)
    const r = parseLeadText(text, models)
    if (r.contact && !$('ql-contact').value) { $('ql-contact').value = r.contact; $('ql-contact').dispatchEvent(new Event('input')) }
    if (r.model && !$('ql-model').value) $('ql-model').value = r.model
    if (r.source) el.querySelector(`.ql-src[data-k="${r.source}"]`)?.click()
    if (r.hot) $('ql-hot').checked = true
    if (r.name && !$('ql-name').value) $('ql-name').value = r.name
    pastedNote = text.slice(0, 500)
    const found = [r.name && 'ชื่อ', r.contact && 'เบอร์/LINE', r.model && 'รุ่นรถ', r.source && 'ที่มา', r.hot && 'สนใจมาก'].filter(Boolean)
    $('ql-fill-msg').textContent = found.length ? `เจอ: ${found.join(', ')}` : 'ไม่เจอเบอร์/รุ่นในข้อความ'
    if (!$('ql-name').value) $('ql-name').focus()
    // ชื่อลูกค้า/รุ่นที่สะกดแปลกๆ ให้ AI ช่วยอ่าน (ปิดเบอร์โทร/LINE ก่อนส่ง) — ไม่ได้ล็อกอินจริงก็ข้ามไป
    try {
      const ai = await import('./ai.js')
      if (!ai.isAiEnabled()) return
      $('ql-fill-msg').textContent += ' · ✨ AI กำลังอ่านชื่อ...'
      const g = parseLeadNameReply(await ai.askJsonPrompt(buildLeadNamePrompt(maskContacts(text)), 1500))
      if (g?.name && !$('ql-name').value) $('ql-name').value = g.name
      if (g?.model && !$('ql-model').value) $('ql-model').value = g.model
      if (g?.summary) pastedNote = `${g.summary}\n---\n${pastedNote}`
      $('ql-fill-msg').textContent = $('ql-fill-msg').textContent.replace(' · ✨ AI กำลังอ่านชื่อ...', g?.name ? ' · ✨ AI ใส่ชื่อให้แล้ว' : '')
    } catch { $('ql-fill-msg').textContent = $('ql-fill-msg').textContent.replace(' · ✨ AI กำลังอ่านชื่อ...', '') }
  })

  async function save(keepOpen) {
    const name = $('ql-name').value.trim()
    if (!name) { $('ql-name-e').textContent = 'กรุณาใส่ชื่อ'; $('ql-name').focus(); return }
    const lead = buildQuickLead({ name, contact: $('ql-contact').value, model: $('ql-model').value, source, hot: $('ql-hot').checked, note: pastedNote }, { assignedTo: me.displayName || '' })
    const dup = existing && findDuplicate(lead, existing)
    if (dup && !window.confirm(`ลูกค้าเบอร์/LINE นี้มีอยู่แล้ว (${[dup.firstName, dup.lastName].filter(Boolean).join(' ')}) ยังต้องการเพิ่มซ้ำอีกคนหรือไม่?`)) return
    const btns = [$('ql-save'), $('ql-more')]
    btns.forEach(b => { b.disabled = true })
    try {
      const doc = { ...lead, stageChangedAt: new Date().toISOString(), companyId: myEffectiveCompanyId() }
      const id = await createDoc('customers', doc)
      if (existing) existing.unshift({ ...doc, id })
      const fu = await scheduleLeadFollowups(doc, id)
      showToast(`✅ เพิ่ม ${name} แล้ว (${doc.stage === 'lead' ? 'Lead' : 'Prospect'})${fu ? ` · นัดติดตาม ${fu} ครั้ง` : ''}`, 'success')
      if (keepOpen) {
        ;['ql-name', 'ql-contact', 'ql-model', 'ql-paste'].forEach(i => { $(i).value = '' })
        pastedNote = ''; $('ql-fill-msg').textContent = ''
        $('ql-hot').checked = false
        $('ql-dup').textContent = ''; $('ql-name-e').textContent = ''
        $('ql-name').focus()
      } else {
        close()
        // ลูกค้า Walk-in อยู่ที่โชว์รูมแล้ว และคอมพิวเตอร์โทรออกไม่ได้ → ชวนโทรเฉพาะบนมือถือ
        if (doc.phone && doc.source !== 'walk-in' && window.matchMedia?.('(pointer: coarse)').matches) offerCallNow({ ...doc, id })
      }
    } catch {
      showToast('บันทึกไม่สำเร็จ', 'error')
    } finally { btns.forEach(b => { b.disabled = false }) }
  }
  $('ql-save').addEventListener('click', () => save(false))
  $('ql-more').addEventListener('click', () => save(true))
  $('ql-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('ql-contact').focus() })
  setTimeout(() => $('ql-name')?.focus(), 50)
}
