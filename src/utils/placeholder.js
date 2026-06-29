export function placeholderPage(icon, title, subtitle, path) {
  return function(container) {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">${icon} ${title}</div>
            <div class="page-subtitle">${subtitle}</div>
          </div>
        </div>
        <div class="card" style="text-align:center;padding:64px">
          <div style="font-size:4rem;margin-bottom:16px">${icon}</div>
          <h2 style="margin-bottom:8px">${title}</h2>
          <p style="color:var(--text-muted);max-width:400px;margin:0 auto 24px">
            ระบบ ${title} กำลังพัฒนาอยู่ จะพร้อมใช้งานเร็วๆ นี้
          </p>
          <button class="btn btn-primary" onclick="navigate('/')">← กลับ Dashboard</button>
        </div>
      </div>
    `
  }
}
