// (v1.0.1127) กู้คืนข้อมูลให้ "วันที่/เวลา" กลับเป็นชนิดวันที่ของ Firestore จริง
// เดิมไฟล์สำรองเก็บวันที่เป็นตัวเลข {seconds, nanoseconds} (ปุ่มสำรองในแอป) หรือข้อความ (สำรองอัตโนมัติทุกคืน)
// พอกู้คืน วันที่จะกลายเป็นก้อนตัวเลข/ข้อความ → เรียงตามวันที่ไม่ได้ รายงานรายเดือนนับไม่ครบ
// ไฟล์นี้แปลงก้อนวันที่ทุกแบบที่ไฟล์สำรองใช้กลับเป็น Timestamp ก่อนเขียนลงฐานข้อมูล
import { Timestamp } from 'firebase/firestore'

export const TS_TYPE = 'firestore/timestamp/1.0'

export function isTimestampLike(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const keys = Object.keys(v)
  if (typeof v.seconds !== 'number' || typeof v.nanoseconds !== 'number') return false
  // {seconds, nanoseconds} ล้วน หรือมี type ของ Firestore (SDK v9+ ใส่ type มาด้วยตอนแปลงเป็น JSON)
  if (keys.length === 2) return true
  return keys.length === 3 && typeof v.type === 'string' && v.type.startsWith('firestore/timestamp')
}

export function reviveBackupValue(v) {
  if (Array.isArray(v)) return v.map(reviveBackupValue)
  if (isTimestampLike(v)) return new Timestamp(v.seconds, v.nanoseconds)
  if (v && typeof v === 'object' && !(v instanceof Timestamp)) {
    const out = {}
    for (const [k, x] of Object.entries(v)) out[k] = reviveBackupValue(x)
    return out
  }
  return v
}

export function reviveBackupDoc(fields = {}) {
  return reviveBackupValue(fields)
}
