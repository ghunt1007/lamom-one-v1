import { showToast } from '../../core/store.js'

const MODULES = [
  { icon:'👥', name:'CRM & การขาย', pages:37, color:'primary' },
  { icon:'🚗', name:'DMS / โชว์รูม', pages:40, color:'accent' },
  { icon:'🔧', name:'ศูนย์บริการ', pages:34, color:'warning' },
  { icon:'💰', name:'การเงิน', pages:40, color:'success' },
  { icon:'📣', name:'การตลาด', pages:18, color:'primary' },
  { icon:'👤', name:'HR & องค์กร', pages:28, color:'accent' },
  { icon:'📈', name:'Analytics', pages:23, color:'success' },
  { icon:'🤖', name:'AI Officers', pages:9, color:'warning' },
  { icon:'🛡', name:'ประกัน', pages:6, color:'danger' },
  { icon:'🎓', name:'Training', pages:9, color:'primary' },
  { icon:'🎮', name:'Gamification', pages:6, color:'accent' },
  { icon:'💬', name:'สื่อสาร', pages:8, color:'success' },
  { icon:'📋', name:'Quality & PDPA', pages:9, color:'warning' },
  { icon:'🤝', name:'B2B & Partner', pages:9, color:'primary' },
  { icon:'📄', name:'เอกสาร', pages:5, color:'accent' },
  { icon:'⚙️', name:'ระบบ & ตั้งค่า', pages:21, color:'primary' },
]

const TECH_STACK = [
  { icon:'⚡', name:'Vite 8', desc:'Build < 1 วินาที, HMR instant' },
  { icon:'🟨', name:'Vanilla JS ES6+', desc:'ไม่มี framework, เบา & เร็ว' },
  { icon:'🔥', name:'Firebase 12', desc:'Firestore + Auth + Cloudflare R2' },
  { icon:'🎨', name:'CSS Custom Properties', desc:'Dark mode + 6 ธีมสี' },
  { icon:'🎮', name:'Demo Mode', desc:'ทดลองโดยไม่ต้องสมัคร' },
  { icon:'📦', name:'Modular Architecture', desc:'300+ หน้า, 16 โมดูล' },
]

const RECENT_CHANGELOG_COUNT = 8

export default function AboutPage(container) {
  const totalPages = MODULES.reduce((a, m) => a + m.pages, 0)
  const maxPages = Math.max(...MODULES.map(m => m.pages))

  const lsKeys = Object.keys(localStorage).filter(k => k.startsWith('lamom-'))
  const storedMB = lsKeys.reduce((t, k) => t + (localStorage.getItem(k)||'').length, 0)

  // Changelog (250+ เวอร์ชันและยาวขึ้นเรื่อยๆ) แยกเป็นไฟล์ changelogData.js ต่างหากแล้ว โหลดแบบ
  // dynamic import() เฉพาะตอนเปิดหน้านี้จริง — เดิมฝังทั้งหมดตรงในไฟล์นี้ทำให้หน้า About หนักถึง 300+ KB
  // ทั้งที่คนส่วนใหญ่แค่อยากรู้เวอร์ชันปัจจุบัน แสดงแค่ 8 รายการล่าสุดก่อนโดย default พร้อมปุ่มดูทั้งหมด
  let changelog = null
  let showAllChangelog = false

  function renderChangelogSection() {
    if (!changelog) {
      return `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.78rem">⏳ กำลังโหลดประวัติเวอร์ชัน...</div>`
    }
    const list = showAllChangelog ? changelog : changelog.slice(0, RECENT_CHANGELOG_COUNT)
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${list.map(c => `
          <div style="border-left:2px solid var(--${c.label?'primary':'border'});padding-left:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-size:0.8rem;font-weight:700">v${c.ver}</span>
              <span style="font-size:0.68rem;color:var(--text-muted)">${c.date}</span>
              ${c.label ? `<span class="badge badge-primary" style="font-size:0.6rem">${c.label}</span>` : ''}
            </div>
            <ul style="margin:0;padding-left:16px;font-size:0.72rem;color:var(--text-muted);line-height:1.8">
              ${c.changes.map(ch => `<li>${ch}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
      ${!showAllChangelog && changelog.length > RECENT_CHANGELOG_COUNT ? `<button class="btn btn-secondary btn-sm" id="ab-showall" style="margin-top:12px;width:100%">🔽 แสดงประวัติทั้งหมด (${changelog.length} เวอร์ชัน)</button>` : ''}
    `
  }

  function render() {
    const latestVer = changelog?.[0]?.ver || '…'
    container.innerHTML = `
    <div class="page-content animate-slide">
      <div style="max-width:720px;margin:0 auto">

        <!-- Hero -->
        <div class="card" style="padding:28px;text-align:center;margin-bottom:14px;background:linear-gradient(135deg,var(--surface),var(--surface-2))">
          <div style="width:68px;height:68px;border-radius:18px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:900;color:white;margin:0 auto 12px;box-shadow:0 4px 16px var(--primary-dim)">L</div>
          <div style="font-size:1.5rem;font-weight:900;letter-spacing:-0.02em">LAMOM ONE</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin:4px 0 12px">ระบบปฏิบัติการธุรกิจยานยนต์ครบวงจร</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <span class="badge badge-primary">Version ${latestVer}</span>
            <span class="badge badge-success">${totalPages}+ ระบบย่อย</span>
            <span class="badge badge-accent">${MODULES.length} โมดูล</span>
            <span class="badge badge-warning">Vite 8 + ES6 + Firebase 12</span>
          </div>
        </div>

        <!-- Owner -->
        <div class="card" style="padding:16px;margin-bottom:14px;border-left:3px solid var(--warning)">
          <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">👑 เจ้าของระบบ (ตลอดไป)</div>
          <div style="font-weight:900;font-size:1.05rem">ทวีศักดิ์ สุขสมบัติเสถียร</div>
          <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px">Thaweesak Sooksombatisatian — LAMOM ONE เป็นทรัพย์สินทางปัญญาของเจ้าของแท้จริงตลอดไป</div>
        </div>

        <!-- System Stats -->
        <div class="grid-4 mb-4">
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--primary)">
            <div style="font-size:1.8rem;font-weight:900;color:var(--primary)">${MODULES.length}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">โมดูล</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--success)">
            <div style="font-size:1.8rem;font-weight:900;color:var(--success)">${totalPages}+</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">ระบบย่อย</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--accent)">
            <div style="font-size:1.8rem;font-weight:900;color:var(--accent)">9</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">AI Officers</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;border-top:3px solid var(--warning)">
            <div style="font-size:1.3rem;font-weight:900;color:var(--warning)">${(storedMB/1024).toFixed(1)}KB</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">Local Storage</div>
          </div>
        </div>

        <!-- Modules with bar chart -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📦 โมดูลและจำนวนระบบย่อย</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${MODULES.map(m => `
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:160px;font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.icon} ${m.name}</div>
                <div style="flex:1;height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${Math.round((m.pages/maxPages)*100)}%;background:var(--${m.color});border-radius:4px;transition:width 0.4s ease"></div>
                </div>
                <div style="width:28px;text-align:right;font-size:0.72rem;font-weight:700;color:var(--text-muted)">${m.pages}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:10px;font-size:0.72rem;color:var(--text-muted);text-align:right">รวม ${totalPages} ระบบย่อย</div>
        </div>

        <!-- Tech Stack -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🛠 เทคโนโลยีหลัก</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${TECH_STACK.map(t => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                <div style="font-size:1.3rem">${t.icon}</div>
                <div>
                  <div style="font-size:0.78rem;font-weight:700">${t.name}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${t.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Changelog -->
        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📋 Changelog</div>
          <div id="ab-changelog-body">${renderChangelogSection()}</div>
        </div>

        <!-- Footer -->
        <div style="text-align:center;font-size:0.7rem;color:var(--text-muted);padding:12px 0 24px">
          LAMOM ONE V1 © 2569 — พัฒนาด้วย ❤️ เพื่อธุรกิจยานยนต์ไทย
        </div>
      </div>
    </div>
  `
    document.getElementById('ab-showall')?.addEventListener('click', () => { showAllChangelog = true; render() })
  }

  render()
  import('./changelogData.js').then(mod => { changelog = mod.CHANGELOG; render() }).catch(() => {})
}
