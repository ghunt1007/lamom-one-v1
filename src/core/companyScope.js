// ── Company data scoping (v1.0.453) ─────────────────────────────────────────
// กลไกกลางสำหรับ "พนักงานแต่ละคนเห็นแค่ข้อมูลของบริษัทที่ตัวเองทำงาน" — คู่กับ Firestore Rules
// helper canSeeCompanyDoc() ใน firestore.rules ทุกหน้าที่โหลดข้อมูล company-scoped ต้องใช้
// companyScopeFilters() แทนการกรองผลลัพธ์ด้วย JS เอง (เดิม fail-open: เอกสารไม่มี companyId
// หรือ filter ว่างเปล่า = เห็นหมด) — Firestore ปฏิเสธทั้ง query ถ้า where ไม่ตรงกับ rule ที่ประเมิน
// ฝั่ง server ดังนั้น query ต้องส่ง where('companyId','in',...) ตรงกับสิ่งที่ rule อนุญาตเป๊ะๆ
import { getState } from './store.js'
import { isProgramOwner } from './hierarchy.js'

// (v1.0.465) เห็นทุกบริษัทโดยไม่มีเงื่อนไข: เดิม role owner/admin ใครก็ได้เห็นหมด — ขัดกับนโยบายที่ยืนยันว่า
// "แอดมิน/เจ้าของบริษัทดูได้เฉพาะบริษัทที่ตัวเองสังกัดเท่านั้น ยกเว้นเจ้าของโปรแกรม" เปลี่ยนเป็นผูกกับอีเมล
// บัญชีเจ้าของโปรแกรมเท่านั้น (isProgramOwner()) หรือถูกตั้ง flag groupWide เป็นรายบุคคล (สำหรับ HR/การตลาด/
// PDI/ตรวจสอบ/หัวหน้าบัญชีที่ต้องดูแลทุกบริษัทจริงตามผังองค์กร) — ตรงกับ canSeeCompanyDoc() ใน firestore.rules
export function isCompanyScopeUnrestricted() {
  if (isProgramOwner()) return true
  const user = getState('user')
  if (!user) return false
  return user.groupWide === true
}

// null = ไม่จำกัด (เห็นทุกบริษัท), มิฉะนั้น array companyId ที่ตัวเองสังกัดจริง (อาจว่างเปล่าถ้ายังไม่ได้ตั้งบริษัท)
export function myCompanyIds() {
  return isCompanyScopeUnrestricted() ? null : (getState('user')?.companyIds || [])
}

// คืน filters array ให้ listDocs()/watchDocs() ใช้ตรง (compatible กับ signature เดิม filters=[[field,op,value],...])
// รวมตัวกรอง Topbar (activeCompanyFilter) เข้าด้วยสำหรับทุก role — สำหรับคนถูก scope จะตัดตัวเลือกที่ตัวเองไม่มี
// สิทธิ์เห็นออกก่อนเสมอ (ป้องกัน UI ส่ง where ที่ rule จะปฏิเสธทั้ง query)
export function companyScopeFilters() {
  const allowedIds = myCompanyIds()
  const uiFilter = getState('activeCompanyFilter') || []
  if (allowedIds === null) {
    return uiFilter.length ? [['companyId', 'in', uiFilter]] : []
  }
  if (!allowedIds.length) return [['companyId', 'in', ['__none__']]] // ยังไม่สังกัดบริษัทไหนเลย = ไม่เห็นอะไร
  const effective = uiFilter.length ? uiFilter.filter(id => allowedIds.includes(id)) : allowedIds
  return [['companyId', 'in', effective.length ? effective : allowedIds]]
}

// companyId ที่จะ stamp ตอนสร้างเอกสารใหม่ — ถ้าหน้ามี company-selector ของตัวเอง ส่ง selected เข้ามาแทน
export function myEffectiveCompanyId(selected) {
  return selected || getState('user')?.primaryCompanyId || null
}
