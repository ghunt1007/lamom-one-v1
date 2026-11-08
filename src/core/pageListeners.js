// (v1.0.975) ทุกหน้าใช้กล่องเดียวกัน (#main-content) ซ้ำ — หน้าที่ผูก container.addEventListener เอง (ปฏิทิน,
// แดชบอร์ด, ช่องทางโซเชียล ฯลฯ) พอเปิดหน้าเดิมหลายรอบ listener จะซ้อนกัน กดครั้งเดียวทำงานหลายครั้ง (เช่น ติ๊ก
// งานในปฏิทินแล้วสลับกลับ เปิดหน้าต่างซ้อน ส่งข้อความซ้ำ) — จดทุก listener ที่ผูกกับกล่องนี้ แล้วถอดออกทุกครั้งที่
// เปลี่ยน/วาดหน้าใหม่ (เหมือนเริ่มกล่องใหม่) โค้ดส่วนกลางไม่ได้ผูก listener กับกล่องนี้ จึงไม่กระทบอย่างอื่น
export function trackPageListeners(el) {
  if (!el || el.__pageListeners) return
  el.__pageListeners = []
  const add = el.addEventListener
  el.addEventListener = function (type, fn, opts) {
    el.__pageListeners.push([type, fn, opts])
    return add.call(this, type, fn, opts)
  }
}
export function dropPageListeners(el) {
  if (!el?.__pageListeners) return
  el.__pageListeners.splice(0).forEach(([t, f, o]) => el.removeEventListener(t, f, o))
}
