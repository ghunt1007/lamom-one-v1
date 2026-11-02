// escape ข้อความก่อนใส่ลงใน HTML (ทั้งเนื้อหาและค่าใน attribute "...") — ใช้กับทุกข้อมูลที่มาจากผู้ใช้/ฐานข้อมูล
export function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
