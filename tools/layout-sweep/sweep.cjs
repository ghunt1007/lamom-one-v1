// ตรวจทุกหน้าว่าล้นจอแนวนอนไหม (ข้อมูลทดสอบปลอมล้วน ไม่แตะ Firebase จริง)
// 1) npx vite --config tools/layout-sweep/vite.config.js   (พอร์ต 5198)
// 2) node tools/layout-sweep/sweep.cjs 320   → ผลที่ tools/layout-sweep/out-320.json
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const src = fs.readFileSync(path.resolve(__dirname, '../../src/core/router.js'), 'utf8')
const routes = [...new Set([...src.matchAll(/^  '(\/[^']*)'/gm)].map(m => m[1]))].filter(r => !r.includes(':') && r !== '/login')
const W = Number(process.argv[2] || 320)
;(async () => {
  const b = await chromium.launch()
  const out = []
  const N = 4
  const chunks = Array.from({ length: N }, (_, i) => routes.filter((_, j) => j % N === i))
  await Promise.all(chunks.map(async list => {
    const ctx = await b.newContext({ viewport: { width: W, height: 800 } })
    await ctx.addInitScript(() => { try { localStorage.setItem('lamom.whatsNewSeen', 'x') } catch {} })
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', e => errs.push(e.message))
    await p.goto('http://localhost:5198/', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(4000)
    for (const r of list) {
      errs.length = 0
      await p.evaluate(r => { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate')) }, r)
      await p.waitForTimeout(1600)
      const res = await p.evaluate(() => {
        const cw = document.documentElement.clientWidth
        const scrollAnc = el => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(e).overflowX)) return true } return false }
        const root = document.getElementById('main-content') || document.body
        const bad = [...root.querySelectorAll('*')].filter(e => { const rc = e.getBoundingClientRect(); return rc.width > 0 && rc.right > cw + 1 && !scrollAnc(e) })
          .slice(0, 4).map(e => `${e.tagName}.${String(e.className || '').split(' ')[0]} "${(e.textContent || '').trim().slice(0, 30)}" r=${Math.round(e.getBoundingClientRect().right)}`)
        return { sw: document.documentElement.scrollWidth, cw, bad }
      })
      if (res.sw > res.cw || res.bad.length || errs.length) out.push({ r, ...res, errs: errs.slice(0, 2) })
    }
    await ctx.close()
  }))
  fs.writeFileSync(path.resolve(__dirname, `out-${W}.json`), JSON.stringify(out, null, 1))
  console.log('pages', routes.length, 'issues', out.length)
  await b.close()
})()
