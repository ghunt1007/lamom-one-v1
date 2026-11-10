// แผง "LAMI ช่วยเรื่องหน้านี้" — กด 🤖 ที่แถบบนจากหน้าไหนก็ได้ LAMI อ่านสิ่งที่เห็นบนจอ (ปิดเบอร์/LINE/เลขบัตรก่อน)
// แล้วสรุป บอกสิ่งที่ควรทำต่อ หรืออธิบายวิธีใช้หน้านั้น โดยไม่ต้องออกจากหน้าที่ทำงานอยู่ · คุยต่อแบบเต็มได้ที่ /ai/ask
import { pageAsksFor, pageContextFor } from './pageContext.js'
import { formatAiText } from './aiFormat.js'
import { escHtml as esc } from './escape.js'
import { hasSpeechInput, bindMic } from './micInput.js'

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
      <input class="input" id="lp-input" placeholder="ถาม หรือสั่ง เช่น นัดสมชายพรุ่งนี้…" autocomplete="off">
      ${hasSpeechInput() ? '<button class="btn btn-secondary btn-sm" id="lp-mic" type="button" title="กดแล้วพูด">🎤</button>' : ''}
      <button class="btn btn-primary btn-sm" id="lp-send" type="button">ส่ง</button>
    </div>
    <button class="lp-full" type="button">💬 เปิดแชท LAMI เต็มหน้า →</button>`
  document.body.appendChild(bg)
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.classList.add('open'); bg.classList.add('open') })

  const body = el.querySelector('#lp-body')
  const input = el.querySelector('#lp-input')
  let busy = false
  let custPromise = null
  const onKey = e => { if (e.key === 'Escape') { closeLamiPanel(); document.removeEventListener('keydown', onKey) } }
  document.addEventListener('keydown', onKey)
  bg.addEventListener('click', closeLamiPanel)
  el.querySelector('.lp-x').addEventListener('click', closeLamiPanel)
  el.querySelector('.lp-full').addEventListener('click', () => { closeLamiPanel(); navigate ? navigate('/ai/ask') : (location.href = '/ai/ask') })

  async function ask(q, { ai = false } = {}) {
    q = String(q || '').trim()
    if (!q || busy) return
    busy = true
    input.value = ''
    body.querySelector('.lp-hint')?.remove()
    body.insertAdjacentHTML('beforeend', `<div class="lp-q">${esc(ai ? '✨ ช่วยคิดคำพูดเปิดการคุย' : (asks.find(a => a.q === q)?.label || q))}</div><div class="lp-a lp-wait"><span></span><span></span><span></span></div>`)
    body.scrollTop = body.scrollHeight
    const wait = body.querySelector('.lp-wait')
    try {
      // (v1.0.1034) "สั่งอะไรได้บ้าง" → ตัวอย่างคำสั่งจากชื่อลูกค้าจริง
      const lc = await import('./lamiCommands.js')
      if (lc.isCommandHelp(q)) {
        if (!custPromise) custPromise = import('./lamiCommandCard.js').then(m => m.visibleCustomersForCommands()).catch(() => [])
        const cs = await custPromise
        const ans = lc.commandHelpText(lc.exampleName(cs))
        history.push({ role: 'user', text: q }, { role: 'lami', text: ans })
        wait.outerHTML = `<div class="lp-a">${formatAiText(ans)}</div>`
        return
      }
      // (v1.0.1035) "วันนี้ควรโทรหาใคร" → รายชื่อจริงพร้อมปุ่มโทรทันที + ปุ่มให้ AI ช่วยคิดคำพูด (ถ้าต้องการ)
      if (!ai) {
        const { isCallListQuestion } = await import('./callList.js')
        if (isCallListQuestion(q)) {
          if (!custPromise) custPromise = import('./lamiCommandCard.js').then(m => m.visibleCustomersForCommands()).catch(() => [])
          const card = await import('./lamiCommandCard.js')
          const cmds = await card.loadCallListCommands(custPromise)
          const intro = card.callListIntro(cmds)
          history.push({ role: 'user', text: q }, { role: 'lami', text: intro + '\n' + cmds.map(c => `${c.label} — ${c.desc}`).join('\n') })
          wait.outerHTML = `<div class="lp-a">${esc(intro)}</div><div class="lp-cmdslot"></div>${cmds.length ? `<div class="lp-asks"><button class="lp-ask lp-ai" type="button">✨ ให้ LAMI ช่วยคิดคำพูดเปิดการคุย</button></div>` : ''}`
          const slots = body.querySelectorAll('.lp-cmdslot')
          card.mountCommandCard(slots[slots.length - 1], cmds)
          const aiBtn = [...body.querySelectorAll('.lp-ai')].pop()
          aiBtn?.addEventListener('click', () => { aiBtn.closest('.lp-asks')?.remove(); setTimeout(() => ask(`${q}\n(รายชื่อที่ระบบจัดลำดับไว้: ${cmds.map(c => c.label.replace(/^\S+\s/, '') + ' — ' + c.desc).join(' | ')}) ช่วยคิดประโยคเปิดการคุยสั้นๆ ให้แต่ละคน`, { ai: true }), 0) })
          return
        }
      }
      // (v1.0.981) "X อยู่ตรงไหน / หาไม่เจอ" → ตอบจากเมนูจริงทันที พร้อมปุ่มพาไปหน้านั้น
      const [{ isWhereQuestion, findPages, whereAnswer }, { NAV }] = await Promise.all([import('./whereIs.js'), import('../data/navMenu.js')])
      const where = isWhereQuestion(q) ? findPages(q, NAV) : []
      if (where.length) {
        const ans = whereAnswer(where)
        history.push({ role: 'user', text: q }, { role: 'lami', text: ans })
        wait.outerHTML = `<div class="lp-a">${formatAiText(ans)}</div><div class="lp-asks">${where.map(p => `<button class="lp-ask lp-go" type="button" data-path="${esc(p.path)}">${esc(p.label)} →</button>`).join('')}</div>`
        body.querySelectorAll('.lp-go').forEach(b => b.addEventListener('click', () => { closeLamiPanel(); navigate ? navigate(b.dataset.path) : (location.href = b.dataset.path) }))
        return
      }
      // (v1.0.1031) พิมพ์สั่งงาน ("นัดสมชายพรุ่งนี้ 10 โมง", "มานี hot") → การ์ด ✅ ทำเลย ไม่ต้องรอ AI
      if (!custPromise) custPromise = import('./lamiCommandCard.js').then(m => m.visibleCustomersForCommands()).catch(() => [])
      const [{ parseLamiCommand }, card, customers, { todayBangkok }] = await Promise.all([import('./lamiCommands.js'), import('./lamiCommandCard.js'), custPromise, import('./format.js')])
      const cmds = parseLamiCommand(q, customers, todayBangkok())
      if (cmds.length) {
        history.push({ role: 'user', text: q }, { role: 'lami', text: card.commandIntro(cmds) })
        wait.outerHTML = `<div class="lp-a">${esc(card.commandIntro(cmds))}</div><div class="lp-cmdslot"></div>`
        const slots = body.querySelectorAll('.lp-cmdslot')
        card.mountCommandCard(slots[slots.length - 1], cmds)
        return
      }
      const { askLami } = await import('./ai.js')
      const ans = await askLami(q, history, pageContextFor(screen))
      history.push({ role: 'user', text: q }, { role: 'lami', text: ans })
      // ถามต่อได้ด้วยปุ่มเดียว: โชว์คำถามของหน้านี้ที่ยังไม่ได้ถาม (สูงสุด 3) ใต้คำตอบ
      const asked = new Set(history.filter(h => h.role === 'user').map(h => h.text))
      const next = asks.filter(a => !asked.has(a.q)).slice(0, 3)
      body.querySelectorAll('.lp-asks').forEach(x => x.remove())
      wait.outerHTML = `<div class="lp-a">${formatAiText(ans)}</div>` + (next.length ? `<div class="lp-asks lp-next">${next.map(a => `<button class="lp-ask" type="button" data-q="${esc(a.q)}">${a.label}</button>`).join('')}</div>` : '')
      body.querySelectorAll('.lp-next .lp-ask').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)))
    } catch (e) {
      const { aiErrorText } = await import('./ai.js').catch(() => ({ aiErrorText: () => 'LAMI ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง' }))
      wait.outerHTML = `<div class="lp-a lp-err">⚠️ ${esc(aiErrorText(e))}</div>`
    } finally {
      busy = false
      body.scrollTop = body.scrollHeight
    }
  }
  el.querySelectorAll('.lp-ask').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)))
  // (v1.0.1031) ตัวอย่างคำสั่งจากชื่อลูกค้าจริงของผู้ใช้ — กดแล้วเติมในช่องให้แก้ต่อ/ส่งได้เลย
  custPromise = import('./lamiCommandCard.js').then(m => m.visibleCustomersForCommands()).catch(() => [])
  Promise.all([custPromise, import('./lamiCommands.js')]).then(([list, { exampleName }]) => {
    const n = exampleName(list)
    const hint = body.querySelector('.lp-hint')
    if (!hint || !list.some(x => x.firstName === n)) return
    const ex = [`นัด${n}พรุ่งนี้ 10 โมง`, `${n} hot`, `นัดลองขับ ${n} เสาร์บ่าย 2`, `จด ${n} รอโบนัสสิ้นปี`, `โทรหา${n}แล้ว สนใจผ่อน`]
    hint.insertAdjacentHTML('afterend', `<div class="lp-try"><span>🪄 สั่งงานได้ด้วย ลองกด:</span>${ex.map(x => `<button type="button" class="lp-ask lp-fill" data-fill="${esc(x)}">${esc(x)}</button>`).join('')}</div>`)
    body.querySelectorAll('.lp-fill').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.fill; input.focus() }))
  })
  el.querySelector('#lp-send').addEventListener('click', () => ask(input.value))
  bindMic(el.querySelector('#lp-mic'), input, { replace: true, onFinal: () => ask(input.value) })
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ask(input.value) } })
  return { close: closeLamiPanel, ask }
}
