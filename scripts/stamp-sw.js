// Stamp package.json version into dist/sw.js CACHE_NAME (รันหลัง vite build)
// เพื่อให้ service worker re-install + ล้าง cache เก่าอัตโนมัติทุกครั้งที่ deploy เวอร์ชันใหม่
import { readFileSync, writeFileSync } from 'node:fs'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const swPath = 'dist/sw.js'
const src = readFileSync(swPath, 'utf8')

if (!src.includes('__SW_VERSION__')) {
  console.error('[stamp-sw] ไม่พบ __SW_VERSION__ ใน dist/sw.js — placeholder หาย? build อาจเสิร์ฟ SW ที่ cache ไม่หมุนตามเวอร์ชัน')
  process.exit(1)
}
writeFileSync(swPath, src.replaceAll('__SW_VERSION__', 'v' + version))
console.log(`[stamp-sw] CACHE_NAME → lamom-one-v${version}`)
