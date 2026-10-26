// แผง "LAMI ช่วยเรื่องหน้านี้" — กด 🤖 ที่แถบบนจากหน้าไหนก็ได้ LAMI อ่านสิ่งที่เห็นบนจอ (ปิดเบอร์/LINE/เลขบัตรก่อน)
// แล้วสรุป บอกสิ่งที่ควรทำต่อ หรืออธิบายวิธีใช้หน้านั้น โดยไม่ต้องออกจากหน้าที่ทำงานอยู่ · คุยต่อแบบเต็มได้ที่ /ai/ask
import { pageAsksFor, pageContextFor } from './pageContext.js'
import { formatAiText } from './aiFormat.js'

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function readScreen() {
  const main = document.getElementById('main-content')
  const title = main?.querySelector('.page-title')?.textContent?.trim() || document.title
  // ไม่เอาข้อความจากแผงนี้เอง/หน้าต่างอื่นที่เปิดค้าง
  const text = main ? main.innerText : ''
  return { title, path: window.location.pathname, text }
}

export function closeLamiPanel() {
  document.getElementById('lami-panel')?.remove()
  document.getElementById('lami-panel-bg')?.remove()
}

export function openLamiPanel({ navigate } = {}) {
  if (document.getElementById('lami-panel')) { closeLamiPanel(); return }
  const screen = readScreen()
  const asks = pageAsksFor(screen.path)
  const history = []
  const bg = document.createElement('div')
  bg.id = 'lami-panel-bg'
  bg.className = 'lami-panel-bg'
  const el = document.createElement('aside')
  el.id = 'lami-panel'
  el.className = 'lami-panel'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', 'LAMI ช่วยเรื่องหน้านี้')
  el.innerHTML = `
    <div class="lp-head">
      <div class="lp-ava">🤖</div>
      <div class="lp-tt"><b>LAMI ช่วยเรื่องหน้านี้</b><span>${esc(screen.title)}</span></div>
      <button class="lp-x" type="button" aria-label="ปิด">✕</button>
    </div>
    <div class="lp-body" id="lp-body">
      <div class="lp-hint">LAMI อ่านสิ่งที่อยู่บนหน้าจอนี้ให้ (เบอร์โทร LINE เลขบัตร ถูกปิดไว้ก่อนส่ง) เลือกได้เลย</div>
      <div class="lp-asks">${asks.map(a => `<button class="lp-ask" type="button" data-q="${esc(a.q)}">${a.label}</button>`).join('')}</div>
    </div>
    <div class="lp-foot">
      <input class="input" id="lp-input" placeholder="ถามเรื่องหน้านี้…" autocomplete="off">
      <button class="btn btn-primary btn-sm" id="lp-send" type="button">ส่ง</button>
    </div>
    <button class="lp-full" type="button">💬 เปิดแชท LAMI เต็มหน้า →</button>`
  document.body.appendChild(bg)
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.classList.add('open'); bg.classList.add('open') })

  const body = el.querySelector('#lp-body')
  const input = el.querySelector('#lp-input')
  let busy = false
  const onKey = e => { if (e.key === 'Escape') { closeLamiPanel(); document.removeEventListener('keydown', onKey) } }
  document.addEventListener('keydown', onKey)
  bg.addEventListener('click', closeLamiPanel)
  el.querySelector('.lp-x').addEventListener('click', closeLamiPanel)
  el.querySelector('.lp-full').addEventListener('click', () => { closeLamiPanel(); navigate ? navigate('/ai/ask') : (location.href = '/ai/ask') })

  async function ask(q) {
    q = String(q || '').trim()
    if (!q || busy) return
    busy = true
    input.value = ''
    body.querySelector('.lp-hint')?.remove()
    body.insertAdjacentHTML('beforeend', `<div class="lp-q">${esc(asks.find(a => a.q === q)?.label || q)}</div><div class="lp-a lp-wait"><span></span><span></span><span></span></div>`)
    body.scrollTop = body.scrollHeight
    const wait = body.querySelector('.lp-wait')
    try {
      const { askLami } = await import('./ai.js')
      const ans = await askLami(q, history, pageContextFor(screen))
      history.push({ role: 'user', text: q }, { role: 'lami', text: ans })
      wait.outerHTML = `<div class="lp-a">${formatAiText(ans)}</div>`
    } catch (e) {
      const { aiErrorText } = await import('./ai.js').catch(() => ({ aiErrorText: () => 'LAMI ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง' }))
      wait.outerHTML = `<div class="lp-a lp-err">⚠️ ${esc(aiErrorText(e))}</div>`
    } finally {
      busy = false
      body.scrollTop = body.scrollHeight
    }
  }
  el.querySelectorAll('.lp-ask').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)))
  el.querySelector('#lp-send').addEventListener('click', () => ask(input.value))
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ask(input.value) } })
  return { close: closeLamiPanel, ask }
}
