// (v1.0.921) ตัวฟังข้อมูลสด (watchDocs) ของแต่ละหน้า — ปิดให้เองทุกครั้งที่เปลี่ยนหน้า
// เดิมหน้าส่วนใหญ่ปิดตัวฟังก็ต่อเมื่อข้อมูลเปลี่ยนครั้งถัดไป ทำให้เปิดหลายหน้าแล้วตัวฟังค้างสะสม (กินแรมและอ่านฐานข้อมูลเกินจำเป็น)
const active = new Set()

export function trackPageWatcher(unsub) {
  let done = false
  const stop = () => { if (done) return; done = true; active.delete(stop); try { unsub() } catch {} }
  active.add(stop)
  return stop
}

export function stopPageWatchers() {
  for (const stop of [...active]) stop()
}

export function activePageWatcherCount() { return active.size }
