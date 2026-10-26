// ปุ่ม 🎤 พูดแทนพิมพ์ สำหรับช่องข้อความใดก็ได้ (Chrome/Android/Edge รองรับภาษาไทย)
// เครื่องที่ไม่รองรับ → ซ่อนปุ่มเอง ไม่ต้องเช็กที่หน้าเพจ
export function hasSpeechInput() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// ต่อข้อความที่พูดเข้ากับของเดิม (มีอยู่แล้วเว้นวรรคให้)
export function appendSpoken(prev, spoken) {
  return [String(prev || '').trim(), String(spoken || '').trim()].filter(Boolean).join(' ')
}

export function micButtonHtml(id, label = '🎤') {
  return hasSpeechInput() ? `<button type="button" class="btn btn-secondary btn-xs mic-btn" id="${id}" title="กดแล้วพูด">${label}</button>` : ''
}

// btn = ปุ่ม, input = textarea/input ที่จะเติมข้อความ, onFinal = เรียกหลังพูดจบ (ถ้าต้องการทำต่อ)
// replace = แทนที่ข้อความเดิม (เช่น ช่องค้นหา) แทนการต่อท้าย
export function bindMic(btn, input, { onFinal, replace = false } = {}) {
  if (!btn || !input) return
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { btn.style.display = 'none'; return }
  const label = btn.textContent
  let rec = null
  const reset = () => { rec = null; btn.textContent = label; btn.classList.remove('btn-danger') }
  btn.addEventListener('click', () => {
    if (rec) { try { rec.stop() } catch {} return }
    rec = new SR()
    rec.lang = 'th-TH'; rec.continuous = false; rec.interimResults = false
    rec.onresult = e => {
      const t = [...e.results].filter(r => r.isFinal).map(r => r[0].transcript).join(' ')
      if (!t) return
      input.value = replace ? String(t).trim() : appendSpoken(input.value, t)
      input.dispatchEvent(new Event('input'))
      onFinal?.(t)
    }
    rec.onend = reset
    rec.onerror = reset
    btn.textContent = '⏹'; btn.classList.add('btn-danger')
    try { rec.start() } catch { reset() }
  })
}

// ช่องพิมพ์ยาว (textarea) ในหน้าต่าง → เติมปุ่ม 🎤 ใต้ช่องให้อัตโนมัติ (openModal เรียกให้ทุกหน้าต่าง)
// ไม่เติมให้ช่องอ่านอย่างเดียว/ปิดใช้งาน หรือช่องที่ใส่ data-no-mic (เช่น ข้อความที่ AI ร่างไว้ให้คัดลอก)
export function enhanceMics(root) {
  if (!root || !hasSpeechInput()) return
  root.querySelectorAll('textarea:not([data-mic-ready]):not([readonly]):not([disabled]):not([data-no-mic])').forEach(ta => {
    ta.setAttribute('data-mic-ready', '1')
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;justify-content:flex-end;margin-top:4px'
    const btn = document.createElement('button')
    btn.type = 'button'; btn.className = 'btn btn-secondary btn-xs mic-btn'; btn.textContent = '🎤 พูดแทนพิมพ์'
    wrap.appendChild(btn)
    ta.insertAdjacentElement('afterend', wrap)
    bindMic(btn, ta)
  })
}
