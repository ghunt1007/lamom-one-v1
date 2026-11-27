// (v1.0.1420) กันพลาดแบบ v1.0.1416: worker ไป import ไฟล์ของหน้าเว็บ (store/db/modal ใช้ localStorage/window)
// แล้ว Cloudflare ปฏิเสธตอน deploy (wrangler --dry-run และเทสอื่นจับไม่ได้) — ไล่ import ทุกชั้นจาก worker แล้วห้ามแตะ src/core หรือไฟล์ UI
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const ENTRIES = ['workers/daily-report.js', 'workers/ai-proxy.js', 'workers/comms-send.js', 'workers/r2-upload.js'].filter(f => fs.existsSync(path.join(ROOT, f)))
const BANNED = [/^src\/core\//, /^src\/pages\//, /^src\/components\//, /^src\/utils\/modal\.js$/, /^src\/utils\/deliveryIncome\.js$/]

function graph(entry) {
  const seen = new Map() // file → importer
  const stack = [[entry, null]]
  while (stack.length) {
    const [rel, from] = stack.pop()
    if (seen.has(rel)) continue
    seen.set(rel, from)
    let src = ''
    try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8') } catch { continue }
    const re = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g
    for (const m of src.matchAll(re)) {
      const spec = m[1] || m[2]
      const next = path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, rel)), spec)).split(path.sep).join('/')
      stack.push([next, rel])
    }
  }
  return seen
}

describe('worker bundles stay free of browser-only files', () => {
  for (const e of ENTRIES) {
    it(e, () => {
      const g = graph(e)
      const bad = [...g.keys()].filter(f => BANNED.some(r => r.test(f))).map(f => `${f} (imported by ${g.get(f)})`)
      expect(bad).toEqual([])
    })
  }
})
