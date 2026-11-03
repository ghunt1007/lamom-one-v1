// (v1.0.958) "จอมือถือ" = จอแคบ หรือ มือถือที่หมุนเป็นแนวนอน (เตี้ยกว่า 500px และใช้นิ้วแตะ)
// เดิมดูแค่ความกว้าง พอหมุนมือถือแนวนอน (กว้าง 844px) โปรแกรมคิดว่าเป็นคอม เมนูข้างโผล่กินครึ่งจอ ดูไม่ได้
// CSS ใช้เงื่อนไขเดียวกัน: @media (max-width: 640px), (max-height: 500px) and (pointer: coarse)
export const PHONE_MQ = '(max-width: 640px), (max-height: 500px) and (pointer: coarse)'
export const NARROW_MQ = '(max-width: 768px), (max-height: 500px) and (pointer: coarse)'

function mq(q) {
  try { return !!globalThis.matchMedia?.(q).matches } catch { return false }
}
export function isPhoneLayout() { return mq(PHONE_MQ) }
export function isNarrowLayout() { return mq(NARROW_MQ) || (globalThis.innerWidth || 1024) <= 768 }
