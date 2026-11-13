// (v1.0.1128) แท็บ "🤖 ตอบอัตโนมัติ" ในหน้าเชื่อมช่องทาง — เปิด/ปิด AI ตอบลูกค้า + สร้างลีดเองจากแชต
// ค่าเก็บที่ system_integrations/inbox_auto (เจ้าของโปรแกรมแก้ได้คนเดียว) worker อ่านค่านี้ทุก 1 นาที (workers/inboxAuto.js)
import { readDoc, setDocData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { escHtml as esc } from '../../utils/escape.js'
import { isProgramOwner } from '../../core/hierarchy.js'

export const AUTO_DEFAULTS = { autoLead: false, autoAssign: false, aiReply: false, aiMode: 'always', aiStart: '08:30', aiEnd: '18:00', aiChannels: 'all', aiName: 'น้องลามิ', aiInfo: '' }

export function autoChannelList(status) {
  const extra = status?.line?.extra || []
  return [{ id: 'main', name: 'LINE OA หลัก' }, ...extra.map(c => ({ id: c.id, name: `LINE ${c.name}` })), { id: 'fb', name: 'Facebook Messenger' }, { id: 'ig', name: 'Instagram' }]
}
export function chosenChannels(v = 'all', list = []) {
  if (!v || v === 'all') return new Set(list.map(c => c.id))
  return new Set(String(v).split(',').map(x => x.trim().toLowerCase()).filter(Boolean))
}
export function channelsValue(ids = [], list = []) {
  const all = list.map(c => c.id)
  return all.length && all.every(id => ids.includes(id)) ? 'all' : ids.join(',')
}

export function createAutoTab({ getStatus, rerender }) {
  let cfg = null
  let loading = false
  let saving = false
  const owner = isProgramOwner()

  async function load() {
    if (loading || cfg) return
    loading = true
    try { cfg = { ...AUTO_DEFAULTS, ...((await readDoc('system_integrations', 'inbox_auto')) || {}) } } catch { cfg = { ...AUTO_DEFAULTS, _noAccess: true } }
    loading = false
    rerender()
  }

  function sw(id, on, label, help) {
    return `<label class="ch-sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${owner ? '' : 'disabled'}><span class="ch-sw-ui" aria-hidden="true"></span><span><b>${label}</b><small>${help}</small></span></label>`
  }

  function html() {
    if (!cfg) { load(); return '<div class="ch-empty">⏳ กำลังโหลด…</div>' }
    const raw = getStatus()
    const st = raw || {}
    const list = autoChannelList(st)
    const chosen = chosenChannels(cfg.aiChannels, list)
    const aiKey = st.ai?.configured
    return `
      <div class="ch-grid2">
        <div class="ch-card">
          <div class="ch-card-h">🤖 AI ตอบลูกค้าอัตโนมัติ ${cfg.aiReply ? '<span class="ch-st on">เปิดอยู่</span>' : '<span class="ch-st">ปิดอยู่</span>'}</div>
          ${!owner ? '<div class="ch-note">เจ้าของโปรแกรมเป็นคนเปิด/ปิดได้ — หน้านี้แสดงสถานะให้ทีมดู</div>' : ''}
          ${raw && !aiKey ? '<div class="ch-note bad">⚠️ ยังไม่ได้ใส่กุญแจ AI ให้ตัวรับแชต — ใส่ GEMINI_API_KEY ใน Cloudflare (worker lamom-daily-report) ครั้งเดียว ดูแท็บ 🧭 วิธีเชื่อม</div>' : ''}
          ${sw('au-ai', cfg.aiReply, 'ให้ AI ตอบแชตลูกค้า', 'ตอบคำถามเบื้องต้น โปร และขอชื่อ-เบอร์ให้เซลส์โทรกลับ · พนักงานตอบเองเมื่อไหร่ AI หยุด 30 นาที')}
          <div class="ch-auto-row">
            <label class="ch-radio"><input type="radio" name="au-mode" value="always" ${cfg.aiMode !== 'offhours' ? 'checked' : ''} ${owner ? '' : 'disabled'}> ตอบทุกเวลา</label>
            <label class="ch-radio"><input type="radio" name="au-mode" value="offhours" ${cfg.aiMode === 'offhours' ? 'checked' : ''} ${owner ? '' : 'disabled'}> ตอบเฉพาะนอกเวลาทำการ</label>
          </div>
          <div class="ch-auto-row">
            <label class="ch-tlabel">เวลาทำการ <input class="input ch-time" id="au-start" value="${esc(cfg.aiStart)}" inputmode="numeric" maxlength="5" ${owner ? '' : 'disabled'}></label>
            <label class="ch-tlabel">ถึง <input class="input ch-time" id="au-end" value="${esc(cfg.aiEnd)}" inputmode="numeric" maxlength="5" ${owner ? '' : 'disabled'}></label>
          </div>
          <div class="ch-muted">ช่องทางที่ให้ AI ตอบ</div>
          <div class="ch-auto-row">${list.map(c => `<label class="ch-radio"><input type="checkbox" data-au-ch="${esc(c.id)}" ${chosen.has(c.id) ? 'checked' : ''} ${owner ? '' : 'disabled'}> ${esc(c.name)}</label>`).join('')}</div>
          <label class="input-label" for="au-name">ชื่อผู้ช่วย</label>
          <input class="input" id="au-name" maxlength="40" value="${esc(cfg.aiName)}" ${owner ? '' : 'disabled'}>
          <label class="input-label" for="au-info">ข้อมูลโชว์รูมที่ให้ AI ใช้ตอบ</label>
          <textarea class="input" id="au-info" rows="6" maxlength="3000" placeholder="เช่น ที่อยู่โชว์รูม เวลาเปิด 08:30–18:00 ทุกวัน เบอร์ 0x-xxx-xxxx รุ่นที่ขาย จุดเด่น ทดลองขับได้ทุกวัน" ${owner ? '' : 'disabled'}>${esc(cfg.aiInfo)}</textarea>
          <small class="ch-muted">AI ใช้โปรจากหน้า "แคมเปญ & ดอกเบี้ยเดือนนี้" ให้อัตโนมัติ (เฉพาะโปรที่ลูกค้าเห็นได้) และไม่เคยแต่งราคาเอง</small>
        </div>
        <div class="ch-card">
          <div class="ch-card-h">📥 รับลีดจากแชตอัตโนมัติ</div>
          ${sw('au-lead', cfg.autoLead, 'ลูกค้าใหม่ที่ทักมา → สร้างเป็นลูกค้าให้เลย', 'ใช้กับ LINE OA ทุกบัญชี (และ Facebook/IG เมื่อเชื่อมแล้ว) ไม่ต้องกด "เป็น Lead" เอง (ลูกค้าเดิมที่ผูก LINE แล้วไม่สร้างซ้ำ)')}
          ${sw('au-assign', cfg.autoAssign, 'แจกลีดใหม่ให้เซลส์แบบวนคิว', 'เซลส์ที่ลงทะเบียน LINE กับ OA หลักจะได้ลีดคนละราย พร้อมนัดติดตาม 3 ครั้ง และแจ้งเตือนทาง LINE')}
          <div class="ch-note">💡 แชตที่ต้องการพนักงานจะขึ้นป้าย 🙋 ในแชตรวม · ในแต่ละแชตกด "⏸ หยุด AI" ได้ถ้าอยากคุยเอง</div>
          ${owner ? `<button type="button" class="btn btn-primary" id="au-save" ${saving ? 'disabled' : ''}>${saving ? '⏳ กำลังบันทึก…' : '💾 บันทึก'}</button>` : ''}
        </div>
      </div>`
  }

  function read(root) {
    const $ = s => root.querySelector(s)
    const list = autoChannelList(getStatus())
    const ids = [...root.querySelectorAll('[data-au-ch]')].filter(x => x.checked).map(x => x.dataset.auCh)
    const hm = v => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '').trim()) ? String(v).trim() : null)
    return {
      aiReply: !!$('#au-ai')?.checked, autoLead: !!$('#au-lead')?.checked, autoAssign: !!$('#au-assign')?.checked,
      aiMode: root.querySelector('[name="au-mode"]:checked')?.value === 'offhours' ? 'offhours' : 'always',
      aiStart: hm($('#au-start')?.value), aiEnd: hm($('#au-end')?.value),
      aiChannels: channelsValue(ids, list),
      aiName: ($('#au-name')?.value || '').trim().slice(0, 40) || AUTO_DEFAULTS.aiName,
      aiInfo: ($('#au-info')?.value || '').slice(0, 3000),
    }
  }

  async function save(root) {
    const v = read(root)
    if (!v.aiStart || !v.aiEnd) { showToast('ใส่เวลาแบบ 24 ชั่วโมง เช่น 08:30 และ 18:00', 'error'); return }
    if (v.aiChannels === '') { showToast('เลือกอย่างน้อย 1 ช่องทางให้ AI ตอบ', 'error'); return }
    saving = true; rerender()
    try {
      await setDocData('system_integrations', 'inbox_auto', v)
      cfg = { ...cfg, ...v }
      showToast(v.aiReply ? '✅ บันทึกแล้ว — AI เริ่มตอบภายใน 1 นาที' : '✅ บันทึกแล้ว', 'success')
    } catch (e) { showToast(e.message || 'บันทึกไม่สำเร็จ', 'error') }
    saving = false; rerender()
  }

  return { html, save, read }
}
