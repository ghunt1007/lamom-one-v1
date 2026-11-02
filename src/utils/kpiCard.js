// การ์ดตัวเลขมาตรฐาน (.kpi-card) — ใช้ร่วมกันทุกหน้า (เดิมเขียนฟังก์ชันเดียวกันซ้ำ 158 ไฟล์)
// t = หัวข้อ (HTML ได้), v = ค่า (HTML ได้), c = ชื่อสีใน theme เช่น 'primary' 'success'
export function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
