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
        const ans = lc.isFullHelp(q) ? lc.commandHelpText(lc.exampleName(cs)) : lc.commandHelpBrief(lc.exampleName(cs)).text
        history.push({ role: 'user', text: q }, { role: 'lami', text: ans })
        wait.outerHTML = `<div class="lp-a">${formatAiText(ans)}</div>`
        return
      }
      // (v1.0.1035) "วันนี้ควรโทรหาใคร" → รายชื่อจริงพร้อมปุ่มโทรทันที + ปุ่มให้ AI ช่วยคิดคำพูด (ถ้าต้องการ)
      if (!ai) {
        // (v1.0.1039) คำสั่งกลุ่ม "นัดลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง" → รายชื่อ + ✅ ทำทั้งหมด
        {
          if (!custPromise) custPromise = import('./lamiCommandCard.js').then(m => m.visibleCustomersForCommands()).catch(() => [])
          const card = await import('./lamiCommandCard.js')
          const bulk = await card.loadBulkCommands(q, custPromise).catch(() => null)
          if (bulk) {
            history.push({ role: 'user', text: q }, { role: 'lami', text: bulk.intro })
            wait.outerHTML = `<div class="lp-a">${esc(bulk.intro)}</div><div class="lp-cmdslot"></div>`
            const slots = body.querySelectorAll('.lp-cmdslot')
            card.mountCommandCard(slots[slots.length - 1], bulk.cmds, { multi: true })
            return
          }
        }
        // (v1.0.1049) "วันนี้มีอะไรบ้าง / สรุปวันนี้" → สรุปงานวันนี้จากข้อมูลจริง + ปุ่มถามต่อเฉพาะหัวข้อที่มีงาน
        {
          const card = await import('./lamiCommandCard.js')
          const tb = await card.loadTodayBrief(q, custPromise).catch(() => null) || await card.loadAheadBrief(q, custPromise).catch(() => null) || await card.loadMonthBrief(q).catch(() => null) || await card.loadIncomeBrief(q).catch(() => null) || await card.loadTeamBrief(q, custPromise).catch(() => null) || await card.loadQuoteAnswer(q).catch(() => null) || await card.loadOpsAnswer(q, custPromise).catch(() => null) || await card.loadCarPick(q).catch(() => null) || await card.loadStockAnswer(q).catch(() => null) || await card.loadPayAnswer(q).catch(() => null) || await card.loadPromoAnswer(q).catch(() => null) || await card.loadModelAnswer(q).catch(() => null) // (v1.0.1051) + ยอดเดือนนี้ (v1.0.1053) + สต็อก
          if (tb) {
            history.push({ role: 'user', text: q }, { role: 'lami', text: tb.text })
            wait.outerHTML = `<div class="lp-a">${formatAiText(tb.text)}</div>${tb.next.length || tb.go || tb.copy ? `<div class="lp-asks lp-brief lp-today">${tb.copy ? '<button class="lp-ask lp-copy2" type="button">📋 คัดลอกส่งลูกค้า</button>' : ''}${tb.next.map(x => `<button class="lp-ask" type="button" data-q="${esc(x)}">${esc(x)}</button>`).join('')}${tb.go ? `<button class="lp-ask lp-go2" type="button" data-path="${esc(tb.go.path)}">${esc(tb.go.label)} →</button>` : ''}${tb.go2 ? `<button class="lp-ask lp-go2" type="button" data-path="${esc(tb.go2.path)}">${esc(tb.go2.label)} →</button>` : ''}</div>` : ''}`
            const wrap = [...body.querySelectorAll('.lp-today')].pop()
            wrap?.querySelector('.lp-copy2')?.addEventListener('click', () => import('./copyText.js').then(m => m.copyText(tb.copy, '📋 คัดลอกแล้ว — วางใน LINE ส่งลูกค้าได้เลย'))) // (v1.0.1057)
            wrap?.querySelectorAll('.lp-ask:not(.lp-go2):not(.lp-copy2)').forEach(b => b.addEventListener('click', () => setTimeout(() => ask(b.dataset.q), 0)))
            wrap?.querySelectorAll('.lp-go2').forEach(g => g.addEventListener('click', e => { const path = e.currentTarget.dataset.path; closeLamiPanel(); navigate ? navigate(path) : (location.href = path) }))
            return
          }
        }
        // (v1.0.1048) "สมชายถึงไหนแล้ว / สรุปมานี" → สรุปลูกค้าจากข้อมูลจริงทันที + ปุ่มทำต่อในแตะเดียว
        {
          const card = await import('./lamiCommandCard.js')
          const br = await card.loadCustomerBrief(q, custPromise).catch(() => null)
          if (br) {
            history.push({ role: 'user', text: q }, { role: 'lami', text: br.text })
            wait.outerHTML = `<div class="lp-a">${formatAiText(br.text)}</div><div class="lp-cmdslot"></div>${br.chips.length ? `<div class="lp-asks lp-brief">${br.chips.map(x => `<button class="lp-ask lp-chip" type="button" data-chip="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="lp-cmdslot lp-chipslot"></div>` : ''}`
            const slots = body.querySelectorAll('.lp-cmdslot:not(.lp-chipslot)')
            card.mountCommandCard(slots[slots.length - 1], br.cmds)
            const wrap = [...body.querySelectorAll('.lp-brief')].pop(), cslot = [...body.querySelectorAll('.lp-chipslot')].pop()
            wrap?.querySelectorAll('.lp-chip').forEach(b => b.addEventListener('click', async () => {
              const [{ scopedCommand }, { todayBangkok }] = await Promise.all([import('./lamiCommands.js'), import('./format.js')])
              const cmds = scopedCommand(b.dataset.chip, br.customer, todayBangkok())
              if (cmds.length && cslot) { card.mountCommandCard(cslot, cmds); body.scrollTop = body.scrollHeight }
            }))
            return
          }
        }
        // (v1.0.1046) "ใครรอไฟแนนซ์ / ใครยังไม่นัดส่งมอบ / ใบจองไหนค้างนานสุด" → รายการใบจองจริงพร้อมปุ่มเปิด
        {
          const card = await import('./lamiCommandCard.js')
          const bl = await card.loadBookingListCommands(q, custPromise).catch(() => null)
          if (bl) {
            history.push({ role: 'user', text: q }, { role: 'lami', text: bl.intro + '\n' + bl.cmds.map(c => `${c.label} — ${c.desc}`).join('\n') })
            wait.outerHTML = `<div class="lp-a">${esc(bl.intro)}</div><div class="lp-cmdslot"></div>`
            const slots = body.querySelectorAll('.lp-cmdslot')
            if (bl.cmds.length) card.mountCommandCard(slots[slots.length - 1], bl.cmds)
            return
          }
        }
        // (v1.0.1045) "ลูกค้า hot มีใครบ้าง / ใครเงียบเกิน 7 วัน / ใครยังไม่มีนัด" → รายชื่อจริงพร้อมปุ่มโทร + ปุ่มนัดทั้งกลุ่ม
        {
          const card = await import('./lamiCommandCard.js')
          const lst = await card.loadListCommands(q, custPromise).catch(() => null)
          if (lst) {
            history.push({ role: 'user', text: q }, { role: 'lami', text: lst.intro + '\n' + lst.cmds.map(c => `${c.label} — ${c.desc}`).join('\n') })
            wait.outerHTML = `<div class="lp-a">${esc(lst.intro)}</div><div class="lp-cmdslot"></div>${lst.next ? `<div class="lp-asks"><button class="lp-ask lp-listnext" type="button" data-q="${esc(lst.next)}">📅 ${esc(lst.next)}</button></div>` : ''}`
            const slots = body.querySelectorAll('.lp-cmdslot')
            if (lst.cmds.length) card.mountCommandCard(slots[slots.length - 1], lst.cmds)
            const nb = [...body.querySelectorAll('.lp-listnext')].pop()
            if (lst.next) nb?.addEventListener('click', () => { nb.closest('.lp-asks')?.remove(); setTimeout(() => ask(nb.dataset.q), 0) })
            return
          }
        }
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
  // (v1.0.1060) คำถามที่ LAMI ตอบจากข้อมูลจริงทันที — แตะครั้งเดียวได้คำตอบ (แสดงเสมอ แม้ยังไม่มีลูกค้า)
  import('./managerRole.js').then(({ isManagerRole }) => isManagerRole()).catch(() => false).then(mgr => {
    const hint = body.querySelector('.lp-hint')
    if (!hint) return
    const quick = ['วันนี้มีอะไรบ้าง', 'พรุ่งนี้มีอะไรบ้าง', 'ยอดเดือนนี้เป็นไง', 'ค่าคอมเดือนนี้เท่าไหร่', ...(mgr ? ['ทีมวันนี้เป็นไง'] : []), 'มีรถอะไรพร้อมขาย', 'โปรเดือนนี้มีอะไรบ้าง', 'รถไฟฟ้าไม่เกิน 1 ล้าน', 'ลูกค้า hot มีใครบ้าง']
    hint.insertAdjacentHTML('afterend', `<div class="lp-try lp-quick"><span>⚡ ถามได้ทันที แตะครั้งเดียว:</span>${quick.map(x => `<button type="button" class="lp-ask lp-now" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>`)
    body.querySelectorAll('.lp-now').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)))
  })
  Promise.all([custPromise, import('./lamiCommands.js')]).then(([list, { exampleName }]) => {
    const n = exampleName(list)
    const anchor = body.querySelector('.lp-quick') || body.querySelector('.lp-hint')
    if (!anchor || !body.querySelector('.lp-hint') || !list.some(x => x.firstName === n)) return
    const ex = [`นัด${n}พรุ่งนี้ 10 โมง`, `${n} hot`, `นัดลองขับ ${n} เสาร์บ่าย 2`, `จด ${n} รอโบนัสสิ้นปี`, `โทรหา${n}แล้ว สนใจผ่อน`]
    anchor.insertAdjacentHTML('afterend', `<div class="lp-try"><span>🪄 สั่งงานได้ด้วย กดแล้วแก้ชื่อ/เวลาได้:</span>${ex.map(x => `<button type="button" class="lp-ask lp-fill" data-fill="${esc(x)}">${esc(x)}</button>`).join('')}</div>`)
    body.querySelectorAll('.lp-fill').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.fill; input.focus() }))
  })
  el.querySelector('#lp-send').addEventListener('click', () => ask(input.value))
  bindMic(el.querySelector('#lp-mic'), input, { replace: true, onFinal: () => ask(input.value) })
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ask(input.value) } })
  return { close: closeLamiPanel, ask }
}
