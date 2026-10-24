// ตั้งค่าลับ (secret) ของ worker รายงานประจำวัน LAMOM ONE ครั้งเดียว — รันผ่าน setup-daily-report.bat
// 1) FIRESTORE_SERVICE_ACCOUNT_JSON: ไฟล์ key ที่โหลดจาก Firebase Console (หาไฟล์ *firebase-adminsdk*.json ล่าสุดใน Downloads ให้เอง)
// 2) LINE_CHANNEL_ACCESS_TOKEN / LINE_TARGET_ID: ใช้ LINE OA และผู้รับเดียวกับรายงานของ LAMOM CRM เดิม
// ค่าลับส่งเข้า wrangler ทาง stdin ตรงๆ ไม่พิมพ์ออกหน้าจอ และไม่เขียนลงไฟล์ใด
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'

const CRM_WORKER = 'D:/AI/LAMOM_CRM_V8/cloudflare-workers/daily-summary-worker.js'
const CONFIG = 'wrangler-daily-report.toml'

function findKeyFile() {
  if (process.argv[2]) return process.argv[2]
  const dir = join(homedir(), 'Downloads')
  const files = readdirSync(dir)
    .filter(f => f.includes('firebase-adminsdk') && f.endsWith('.json'))
    .map(f => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  return files[0]
}

function putSecret(name, value) {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', name, '--config', CONFIG], { input: value, shell: true, encoding: 'utf8' })
  const ok = r.status === 0
  console.log(ok ? `✅ ตั้งค่า ${name} แล้ว` : `❌ ตั้งค่า ${name} ไม่สำเร็จ\n${r.stderr || r.stdout}`)
  return ok
}

const keyFile = findKeyFile()
if (!keyFile) {
  console.log('❌ ไม่พบไฟล์ key ในโฟลเดอร์ Downloads — โหลดจาก Firebase Console > Project settings > Service accounts > Generate new private key ก่อน')
  process.exit(1)
}
const sa = JSON.parse(readFileSync(keyFile, 'utf8'))
if (sa.project_id !== 'lamom-one-v1' || !sa.private_key) {
  console.log(`❌ ไฟล์ ${keyFile} ไม่ใช่ key ของโปรเจกต์ lamom-one-v1`)
  process.exit(1)
}
console.log(`ใช้ไฟล์ key: ${keyFile}`)

const crm = readFileSync(CRM_WORKER, 'utf8')
const lineToken = crm.match(/const LINE_CHANNEL_TOKEN\s*=\s*'([^']+)'/)?.[1]
const lineTo = crm.match(/const LINE_DEFAULT_TO\s*=\s*'([^']+)'/)?.[1]

const results = [
  putSecret('FIRESTORE_SERVICE_ACCOUNT_JSON', JSON.stringify(sa)),
  lineToken ? putSecret('LINE_CHANNEL_ACCESS_TOKEN', lineToken) : (console.log('❌ ไม่พบ LINE token ในไฟล์ CRM เดิม'), false),
  lineTo ? putSecret('LINE_TARGET_ID', lineTo) : (console.log('❌ ไม่พบผู้รับ LINE ในไฟล์ CRM เดิม'), false),
]
console.log(results.every(Boolean) ? '\n🎉 เสร็จแล้ว กลับไปพิมพ์บอก Claude ว่า "ตั้งค่าแล้ว" ได้เลย' : '\nมีบางอย่างไม่สำเร็จ ถ่ายรูปหน้าจอนี้ส่งให้ Claude')
