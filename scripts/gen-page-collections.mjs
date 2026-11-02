// สร้าง src/data/pageCollections.js — แต่ละหน้า (path) ใช้ข้อมูลจาก collection ไหนบ้าง
// อ่านจาก router.js (path → ไฟล์หน้า) แล้วหาชื่อ collection ที่เขียนเป็นข้อความในไฟล์นั้น
// ใช้กับหน้า "หน้าไหนมีข้อมูลจริง" (settings/PageUsage.js) · รันใหม่เมื่อเพิ่มหน้า: node scripts/gen-page-collections.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function buildPageCollections() {
  const router = readFileSync(resolve(root, 'src/core/router.js'), 'utf8')
  const re = /'([^']+)':\s*\(\)\s*=>\s*import\('\.\.\/pages\/([^']+)'\)/g
  // อ่านรายชื่อ collection จาก src/core/backup.js (ALL_COLLECTIONS) เป็นข้อความ — ไม่ต้อง import firebase
  const backup = readFileSync(resolve(root, 'src/core/backup.js'), 'utf8')
  const list = backup.slice(backup.indexOf('export const ALL_COLLECTIONS'), backup.indexOf('].filter', backup.indexOf('export const ALL_COLLECTIONS')))
  const known = new Set([...list.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]))
  const out = {}
  for (const [, path, file] of router.matchAll(re)) {
    const src = readFileSync(resolve(root, 'src/pages', file), 'utf8')
    const cols = [...new Set([...src.matchAll(/['"`]([a-z][a-z0-9_]+)['"`]/g)].map(m => m[1]).filter(n => known.has(n)))].sort()
    out[path] = cols
  }
  return out
}
export function renderFile(map) {
  return `// สร้างอัตโนมัติจาก scripts/gen-page-collections.mjs — ห้ามแก้มือ\nexport const PAGE_COLLECTIONS = ${JSON.stringify(map, null, 1)}\n`
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  writeFileSync(resolve(root, 'src/data/pageCollections.js'), renderFile(buildPageCollections()))
  console.log('wrote src/data/pageCollections.js')
}
