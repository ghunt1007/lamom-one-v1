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

  async function save(keepOpen) {
    const name = $('ql-name').value.trim()
    if (!name) { $('ql-name-e').textContent = 'กรุณาใส่ชื่อ'; $('ql-name').focus(); return }
    const lead = buildQuickLead({ name, contact: $('ql-contact').value, model: $('ql-model').value, source, hot: $('ql-hot').checked }, { assignedTo: me.displayName || '' })
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
        ;['ql-name', 'ql-contact', 'ql-model'].forEach(i => { $(i).value = '' })
        $('ql-hot').checked = false
        $('ql-dup').textContent = ''; $('ql-name-e').textContent = ''
        $('ql-name').focus()
      } else close()
    } catch {
      showToast('บันทึกไม่สำเร็จ', 'error')
    } finally { btns.forEach(b => { b.disabled = false }) }
  }
  $('ql-save').addEventListener('click', () => save(false))
  $('ql-more').addEventListener('click', () => save(true))
  $('ql-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('ql-contact').focus() })
  setTimeout(() => $('ql-name')?.focus(), 50)
}
