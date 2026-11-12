// (v1.0.1074) ซิงก์อีเมล login ลงเอกสาร users + ผูกสิทธิ์เจ้าของโปรแกรมกับรหัสบัญชี — ใช้ใน core/auth.js
// แยกไฟล์ไว้เป็นฟังก์ชันล้วน (ไม่แตะ Firebase) จะได้ทดสอบได้ง่าย
// ต้องตรงกับ firestore.rules isProgramOwner() และ workers/nightly-backup.js
export const PROGRAM_OWNER_EMAIL = 'ghunt1007@gmail.com'

// คืน field ที่ต้องอัปเดตในเอกสาร users ({} = ไม่ต้องทำอะไร)
//  - email: อีเมลในเอกสารไม่ตรงกับอีเมล login จริง (เพิ่งเปลี่ยนอีเมล)
//  - programOwner: เจ้าของโปรแกรมที่ยังล็อกอินด้วยอีเมลเดิม → ผูกสิทธิ์กับรหัสบัญชีไว้ก่อน เปลี่ยนอีเมลทีหลังได้
export function identityPatch(authEmail, stored) {
  const patch = {}
  if (!authEmail) return patch
  if ((stored?.email || '') !== authEmail) patch.email = authEmail
  if (authEmail.toLowerCase() === PROGRAM_OWNER_EMAIL.toLowerCase() && stored?.programOwner !== true) patch.programOwner = true
  return patch
}
