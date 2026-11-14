// (v1.0.1141) การ์ด "🔑 กุญแจเชื่อมต่อ" ในแท็บ 🧭 วิธีเชื่อม — เจ้าของโปรแกรมวางกุญแจจากในแอปได้เลย ไม่ต้องเข้า Cloudflare
// ค่าถูกส่งไปที่ตัวรับ (worker) ซึ่งเข้ารหัสก่อนเก็บ — หน้าเว็บไม่มีทางอ่านค่ากลับมา เห็นแค่ว่า "ใส่แล้ว/ยังไม่ใส่"
import { showToast } from '../../core/store.js'
import { escHtml as esc } from '../../utils/escape.js'
import { isProgramOwner } from '../../core/hierarchy.js'
import { secretsCall, WORKER_URL } from '../../utils/socialApi.js'
import { copyText } from '../../utils/copyText.js'
import { confirmDialog } from '../../utils/modal.js'

// ลำดับ = ลำดับที่ควรทำ · gen = รหัสที่ตั้งเอง (มีปุ่มสร้างให้) · get = ไปเอากุญแจจากไหน
export const KEY_FIELDS = [
  { key: 'GEMINI_API_KEY', icon: '🤖', name: 'กุญแจ AI (ให้ AI ตอบลูกค้า)', get: 'เปิด aistudio.google.com/apikey → Create API key → คัดลอกมาวาง', url: 'https://aistudio.google.com/apikey' },
  { key: 'META_SYSTEM_USER_TOKEN', icon: '📘', name: 'โทเค็น Facebook / Instagram', get: 'business.facebook.com → ตั้งค่าธุรกิจ → ผู้ใช้ระบบ → สร้างโทเค็น (ขั้นตอนเต็มอยู่ในหัวข้อ Facebook ด้านล่าง)', url: 'https://business.facebook.com/settings/system-users' },
  { key: 'META_APP_SECRET', icon: '📘', name: 'App secret ของแอป Meta', get: 'developers.facebook.com → แอปของคุณ → App settings → Basic → App secret → Show', url: 'https://developers.facebook.com/apps/' },
  { key: 'META_VERIFY_TOKEN', icon: '📘', name: 'คำลับยืนยัน Webhook ของ Meta', gen: true, get: 'กด 🎲 สร้างให้ แล้วนำคำลับกับลิงก์ที่ขึ้นมาไปวางในแอป Meta → Webhooks' },
  { key: 'LEAD_WEBHOOK_KEY', icon: '📮', name: 'รหัสช่องรับลีดกลาง (TikTok · อีเมล · Google Form ผ่าน Zapier/Make)', gen: true, get: 'กด 🎲 สร้างให้ แล้วคัดลอกลิงก์ที่ขึ้นมาไปวางใน Zapier / Make' },
  { key: 'GOOGLE_MAPS_API_KEY', icon: '📍', name: 'กุญแจ Google Maps (ค้นร้าน/ดูรีวิว)', get: 'console.cloud.google.com → Credentials → API key (เปิด Places API (New))', url: 'https://console.cloud.google.com/apis/credentials' },
]

export function randomCode(len = 28, rnd = n => crypto.getRandomValues(new Uint8Array(n))) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return [...rnd(len)].map(b => abc[b % abc.length]).join('')
}
// ลิงก์ที่ต้องนำไปวางที่ปลายทางหลังสร้างรหัส (โชว์ครั้งเดียวตอนสร้าง เพราะอ่านรหัสกลับมาไม่ได้)
export function hookUrls(key, value, base = WORKER_URL) {
  if (key === 'LEAD_WEBHOOK_KEY') return [['ลิงก์สำหรับ TikTok (วางใน Zapier/Make)', `${base}/lead/webhook?key=${value}&source=tiktok`], ['ลิงก์สำหรับอีเมล', `${base}/lead/webhook?key=${value}&source=email`], ['ลิงก์สำหรับฟอร์ม/เว็บ', `${base}/lead/webhook?key=${value}&source=website`]]
  if (key === 'META_VERIFY_TOKEN') return [['Callback URL (วางในแอป Meta → Webhooks)', `${base}/meta/webhook`], ['Verify token', value]]
  return []
}

// (v1.0.1142) บอกเจ้าของว่า "ขั้นต่อไปทำอะไร" — กุญแจ AI ก่อน (ใช้ได้ทันทีไม่ต้องตั้งอะไรเพิ่ม) แล้วค่อยรหัสรับลีด และ Meta
export function nextStep(keys = {}) {
  const has = k => !!keys?.[k]?.set
  if (!has('GEMINI_API_KEY')) return { key: 'GEMINI_API_KEY', text: 'ขั้นต่อไป: คัดลอกกุญแจ AI จาก Google AI Studio แล้วกด "📋 วางแล้วบันทึก" ที่ช่องแรก' }
  if (!has('LEAD_WEBHOOK_KEY')) return { key: 'LEAD_WEBHOOK_KEY', text: 'ขั้นต่อไป: กด 🎲 สร้างให้ ที่ "รหัสช่องรับลีดกลาง" เพื่อเปิดรับลีดจาก TikTok / อีเมล / ฟอร์ม' }
  const meta = ['META_SYSTEM_USER_TOKEN', 'META_APP_SECRET', 'META_VERIFY_TOKEN'].filter(k => !has(k))
  if (meta.length === 3) return { key: 'META_VERIFY_TOKEN', text: 'ขั้นต่อไป (ถ้าต้องการรับแชต Facebook / Instagram): สร้างแอป Meta แล้วใส่ 3 ช่องที่มีรูป 📘 — ข้ามได้ถ้ายังไม่ใช้' }
  if (meta.length) return { key: meta[0], text: `ขั้นต่อไป: Facebook / Instagram ยังขาดอีก ${meta.length} ช่องที่มีรูป 📘` }
  return null
}
// ค่าที่วางมาดูเป็นกุญแจจริงไหม (กันกดวางตอนคลิปบอร์ดเป็นข้อความอื่น เช่น ประโยคยาว ๆ หรือหลายบรรทัด)
export function looksLikeKey(v) {
  const s = String(v || '').trim()
  return s.length >= 16 && s.length <= 600 && !/\s/.test(s)
}

export function createKeysCard({ rerender, onChanged }) {
  const owner = isProgramOwner()
  let st = null // { keys, lineExtra }
  let err = ''
  let loading = false
  let busy = ''
  let reveal = null // { key, rows:[[label,value]] } | { line:{id,name} }

  async function load() {
    if (loading || !owner) return
    loading = true
    try { st = await secretsCall({ op: 'status' }); err = '' } catch (e) { err = e.message || 'โหลดไม่สำเร็จ' }
    loading = false; rerender()
  }

  const chip = k => {
    const s = st?.keys?.[k]
    return s?.set ? `<span class="ch-st on">✅ ใส่แล้ว${s.from === 'cloudflare' ? ' (ใน Cloudflare)' : ''}</span>` : '<span class="ch-st">⚪ ยังไม่ใส่</span>'
  }
  const copyRows = rows => rows.map(([l, v]) => `<div class="ch-key-copy"><small>${esc(l)}</small><code>${esc(v)}</code><button type="button" class="btn btn-secondary btn-xs" data-key-copy="${esc(v)}">📋 คัดลอก</button></div>`).join('')

  function html() {
    if (!owner) return ''
    if (!st && !err) { load(); return '<div class="ch-card"><div class="ch-card-h">🔑 กุญแจเชื่อมต่อ</div><div class="ch-muted">⏳ กำลังโหลด…</div></div>' }
    if (err && !st) return `<div class="ch-card"><div class="ch-card-h">🔑 กุญแจเชื่อมต่อ</div><div class="ch-note bad">⚠️ ${esc(err)}</div><button type="button" class="btn btn-secondary btn-sm" id="key-reload">🔄 ลองใหม่</button></div>`
    return `
      <div class="ch-card ch-keys">
        <div class="ch-card-h">🔑 กุญแจเชื่อมต่อ — วางที่นี่ได้เลย</div>
        <small class="ch-muted">เฉพาะเจ้าของโปรแกรมเห็นการ์ดนี้ · กุญแจถูกเข้ารหัสก่อนเก็บ พนักงานและหน้าเว็บอ่านกลับไม่ได้ (เห็นแค่ว่าใส่แล้วหรือยัง) · มีผลภายใน 1 นาที</small>
        ${nextStep(st.keys) ? `<div class="ch-note ch-key-next">👉 ${esc(nextStep(st.keys).text)}</div>` : '<div class="ch-note ok">✅ ใส่กุญแจครบแล้ว — ไปเปิดสวิตช์ได้ที่แท็บ 🤖 ตอบอัตโนมัติ</div>'}
        ${KEY_FIELDS.map(f => `
          <div class="ch-key${nextStep(st.keys)?.key === f.key ? ' is-next' : ''}" data-key-row="${f.key}">
            <div class="ch-key-h"><b>${f.icon} ${esc(f.name)}</b>${chip(f.key)}</div>
            <small class="ch-muted">${esc(f.get)}${f.url ? ` · <a href="${esc(f.url)}" target="_blank" rel="noopener">เปิดหน้านั้น ↗</a>` : ''}</small>
            <div class="ch-key-in">
              <input class="input" type="password" autocomplete="off" spellcheck="false" data-key-input="${f.key}" placeholder="${st?.keys?.[f.key]?.set ? 'วางค่าใหม่เพื่อเปลี่ยน' : 'วางกุญแจที่นี่'}" aria-label="${esc(f.name)}">
              ${f.gen ? '' : `<button type="button" class="btn btn-secondary btn-sm" data-key-paste="${f.key}" ${busy ? 'disabled' : ''} title="อ่านค่าที่คัดลอกไว้แล้วบันทึกทันที">📋 วางแล้วบันทึก</button>`}
              ${f.gen ? `<button type="button" class="btn btn-secondary btn-sm" data-key-gen="${f.key}" ${busy ? 'disabled' : ''}>🎲 สร้างให้</button>` : ''}
              <button type="button" class="btn btn-primary btn-sm" data-key-save="${f.key}" ${busy ? 'disabled' : ''}>${busy === f.key ? '⏳' : '💾 บันทึก'}</button>
              ${st?.keys?.[f.key]?.from === 'app' ? `<button type="button" class="btn btn-ghost btn-sm" data-key-clear="${f.key}" ${busy ? 'disabled' : ''} title="ลบกุญแจนี้ออก">🗑</button>` : ''}
            </div>
            ${reveal?.key === f.key ? `<div class="ch-key-rev"><b>นำค่านี้ไปวางที่ปลายทาง (จะแสดงครั้งนี้ครั้งเดียว)</b>${copyRows(reveal.rows)}</div>` : ''}
          </div>`).join('')}
        <div class="ch-key" data-key-row="LINE">
          <div class="ch-key-h"><b>💚 LINE OA เพิ่ม (ของทีม / โชว์รูม / เซลส์)</b><span class="ch-st ${st.lineExtra?.length ? 'on' : ''}">${st.lineExtra?.length ? `✅ ${st.lineExtra.length} บัญชี` : '⚪ ยังไม่มี'}</span></div>
          <small class="ch-muted">OA หลักเชื่อมอยู่แล้ว · OA อื่นเอาค่าจาก developers.line.biz → เลือก Channel ของ OA นั้น · <a href="https://developers.line.biz/console/" target="_blank" rel="noopener">เปิดหน้านั้น ↗</a></small>
          ${(st.lineExtra || []).map(c => `<div class="ch-key-oa"><span>💚 ${esc(c.name)}</span><button type="button" class="btn btn-ghost btn-xs" data-key-copy="${esc(`${WORKER_URL}/line/webhook/${c.id}`)}">📋 ลิงก์ Webhook</button><button type="button" class="btn btn-ghost btn-xs" data-line-del="${esc(c.id)}" data-line-name="${esc(c.name)}" ${busy ? 'disabled' : ''}>🗑 ลบ</button></div>`).join('')}
          <div class="ch-key-line">
            <input class="input" id="kl-name" maxlength="60" placeholder="ชื่อ OA เช่น LINE เซลส์ เอ" aria-label="ชื่อ LINE OA">
            <input class="input" id="kl-secret" type="password" autocomplete="off" placeholder="Channel secret (แท็บ Basic settings)" aria-label="Channel secret">
            <input class="input" id="kl-token" type="password" autocomplete="off" placeholder="Channel access token (แท็บ Messaging API → Issue)" aria-label="Channel access token">
            <button type="button" class="btn btn-primary btn-sm" id="kl-add" ${busy ? 'disabled' : ''}>${busy === 'LINE' ? '⏳' : '➕ เพิ่ม LINE OA'}</button>
          </div>
          ${reveal?.line ? `<div class="ch-key-rev"><b>เพิ่ม "${esc(reveal.line.name)}" แล้ว — ขั้นสุดท้าย: วางลิงก์นี้ใน LINE Developers → Messaging API → Webhook URL แล้วเปิด Use webhook</b>${copyRows([['Webhook URL', `${WORKER_URL}/line/webhook/${reveal.line.id}`]])}</div>` : ''}
        </div>
        <small class="ch-muted">ทำจากในแอปไม่ได้ 1 อย่าง: การให้กฎความปลอดภัยของฐานข้อมูลอัปเดตเองตอน Merge (ต้องวางกุญแจที่ GitHub ครั้งเดียว) — ไม่กระทบการใช้งานข้างบน</small>
      </div>`
  }

  async function run(tag, body, after) {
    busy = tag; rerender()
    try {
      const r = await secretsCall(body)
      st = { keys: r.keys, lineExtra: r.lineExtra }
      after?.(r)
      onChanged?.()
    } catch (e) { showToast(e.message || 'บันทึกไม่สำเร็จ', 'error') }
    busy = ''; rerender()
  }

  // คืน true ถ้าคลิกนี้เป็นของการ์ดนี้
  function handleClick(t, root) {
    if (!owner) return false
    if (t.closest('#key-reload')) { err = ''; st = null; rerender(); return true }
    const cp = t.closest('[data-key-copy]'); if (cp) { copyText(cp.dataset.keyCopy); return true }
    const gen = t.closest('[data-key-gen]')
    if (gen) {
      const key = gen.dataset.keyGen, value = randomCode()
      run(key, { op: 'set', key, value }, () => { reveal = { key, rows: hookUrls(key, value) }; showToast('✅ สร้างและบันทึกแล้ว — คัดลอกค่าด้านล่างไปวางที่ปลายทาง', 'success') })
      return true
    }
    const saveKey = (key, value) => run(key, { op: 'set', key, value }, r => {
      const rows = hookUrls(key, value); reveal = rows.length ? { key, rows } : null
      showToast(r.test?.text || '✅ บันทึกแล้ว', r.test && !r.test.ok ? 'warning' : 'success', 6000)
    })
    const ps = t.closest('[data-key-paste]')
    if (ps) {
      const key = ps.dataset.keyPaste
      Promise.resolve().then(() => navigator.clipboard.readText()).then(txt => {
        const value = String(txt || '').trim()
        if (!looksLikeKey(value)) { showToast('สิ่งที่คัดลอกไว้ไม่ใช่กุญแจ — กลับไปกดคัดลอกกุญแจก่อน แล้วกดปุ่มนี้อีกครั้ง', 'error', 6000); return }
        saveKey(key, value)
      }).catch(() => showToast('เบราว์เซอร์ไม่ให้อ่านสิ่งที่คัดลอกไว้ — แตะในช่องแล้ววางเอง จากนั้นกด 💾 บันทึก', 'warning', 6000))
      return true
    }
    const sv = t.closest('[data-key-save]')
    if (sv) {
      const key = sv.dataset.keySave, value = (root.querySelector(`[data-key-input="${key}"]`)?.value || '').trim()
      if (!value) { showToast('วางกุญแจในช่องก่อนกดบันทึก', 'error'); return true }
      saveKey(key, value); return true
    }
    const cl = t.closest('[data-key-clear]')
    if (cl) {
      const key = cl.dataset.keyClear
      confirmDialog({ title: 'ลบกุญแจนี้?', message: 'ช่องทางที่ใช้กุญแจนี้จะหยุดทำงานจนกว่าจะใส่ใหม่', danger: true, confirmText: 'ลบ' }).then(ok => { if (ok) run(key, { op: 'clear', key }, () => { reveal = null; showToast('ลบกุญแจแล้ว', 'success') }) })
      return true
    }
    if (t.closest('#kl-add')) {
      const v = id => (root.querySelector('#' + id)?.value || '').trim()
      const body = { op: 'line-add', name: v('kl-name'), secret: v('kl-secret'), token: v('kl-token') }
      if (!body.name || !body.secret || !body.token) { showToast('ใส่ชื่อ, Channel secret และ Channel access token ให้ครบ', 'error'); return true }
      run('LINE', body, r => { reveal = r.added ? { line: r.added } : null; showToast('✅ เพิ่ม LINE OA แล้ว', 'success') })
      return true
    }
    const ld = t.closest('[data-line-del]')
    if (ld) {
      confirmDialog({ title: 'ลบ LINE OA นี้?', message: ld.dataset.lineName || '', danger: true, confirmText: 'ลบ' }).then(ok => { if (ok) run('LINE', { op: 'line-remove', id: ld.dataset.lineDel }, () => { reveal = null; showToast('ลบแล้ว', 'success') }) })
      return true
    }
    return false
  }

  return { html, handleClick }
}
