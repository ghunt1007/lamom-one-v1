import { showToast } from '../../core/store.js'
import { openModal } from '../../utils/modal.js'

const THEMES = [
  { id: 'default', name: 'LAMOM Purple', primary: '#6c63ff', accent: '#f857a6', bg: '#0f0f1a' },
  { id: 'ocean',   name: 'Ocean Blue',   primary: '#0ea5e9', accent: '#06b6d4', bg: '#0a0f1e' },
  { id: 'forest',  name: 'Forest Green', primary: '#22c55e', accent: '#86efac', bg: '#0a1a0f' },
  { id: 'sunset',  name: 'Sunset Orange',primary: '#f97316', accent: '#fbbf24', bg: '#1a0f0a' },
  { id: 'rose',    name: 'Rose Pink',    primary: '#f43f5e', accent: '#fb7185', bg: '#1a0a0f' },
  { id: 'slate',   name: 'Slate Gray',   primary: '#64748b', accent: '#94a3b8', bg: '#0f1117' },
]

const WL_KEY = 'lamom-whitelabel'

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(WL_KEY) || '{}') } catch { return {} }
}

function saveConfig(cfg) {
  try { localStorage.setItem(WL_KEY, JSON.stringify(cfg)) } catch {}
}

export default async function WhiteLabelPage(container) {
  let cfg = loadConfig()
  if (!cfg.brandName) cfg = { brandName: 'LAMOM ONE', tagline: 'Automotive Business OS', themeId: 'default', primaryColor: '#6c63ff', accentColor: '#f857a6', logoUrl: '', favicon: '', footerText: '© 2025 LAMOM ONE', showPoweredBy: true }

  let tab = 'brand'

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎨 White-label Settings</div>
            <div class="page-subtitle">ปรับแต่ง Brand และ Theme</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="wl-preview">👁 Preview</button>
            <button class="btn btn-primary" id="wl-save">💾 บันทึก</button>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:20px">
          ${[['brand','🏢 Brand'],['theme','🎨 Theme & Color'],['layout','📐 Layout'],['advanced','⚙️ Advanced']].map(([t,l]) => `<button class="btn btn-sm ${tab===t?'btn-primary':'btn-secondary'} tab-btn" data-t="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'brand' ? renderBrand() : tab === 'theme' ? renderTheme() : tab === 'layout' ? renderLayout() : renderAdvanced()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('wl-save')?.addEventListener('click', saveAll)
    document.getElementById('wl-preview')?.addEventListener('click', showPreview)

    // Theme selection
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const t = THEMES.find(x => x.id === card.dataset.tid)
        if (t) { cfg.themeId = t.id; cfg.primaryColor = t.primary; cfg.accentColor = t.accent; renderPage() }
      })
    })

    // Apply live color preview
    document.getElementById('primary-color')?.addEventListener('input', e => {
      cfg.primaryColor = e.target.value
      document.documentElement.style.setProperty('--primary', e.target.value)
    })
    document.getElementById('accent-color')?.addEventListener('input', e => {
      cfg.accentColor = e.target.value
      document.documentElement.style.setProperty('--accent', e.target.value)
    })
  }

  function renderBrand() {
    return `
      <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start">
        <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div class="input-group">
            <label class="input-label">ชื่อแบรนด์ / ชื่อระบบ</label>
            <input class="input" id="brand-name" value="${cfg.brandName}" placeholder="ชื่อแบรนด์">
          </div>
          <div class="input-group">
            <label class="input-label">Tagline / คำอธิบาย</label>
            <input class="input" id="brand-tagline" value="${cfg.tagline}" placeholder="คำอธิบายสั้นๆ">
          </div>
          <div class="input-group">
            <label class="input-label">Logo URL</label>
            <input class="input" id="brand-logo" value="${cfg.logoUrl}" placeholder="https://...">
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">ใส่ URL รูป Logo (แนะนำ PNG 200×60px)</div>
          </div>
          <div class="input-group">
            <label class="input-label">Favicon URL</label>
            <input class="input" id="brand-fav" value="${cfg.favicon}" placeholder="https://...">
          </div>
          <div class="input-group">
            <label class="input-label">Footer Text</label>
            <input class="input" id="brand-footer" value="${cfg.footerText}" placeholder="© 2025 Your Brand">
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem">
            <input type="checkbox" id="powered-by" ${cfg.showPoweredBy?'checked':''} style="width:16px;height:16px">
            แสดง "Powered by LAMOM ONE"
          </label>
        </div>

        <!-- Live preview card -->
        <div>
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Preview</div>
          <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden">
            <!-- Mock sidebar header -->
            <div style="background:var(--surface);padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
              <div style="width:32px;height:32px;border-radius:var(--radius-sm);background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:0.9rem">
                ${cfg.brandName.charAt(0)}
              </div>
              <div>
                <div style="font-weight:700;font-size:0.88rem">${cfg.brandName}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">${cfg.tagline}</div>
              </div>
            </div>
            <div style="padding:12px 16px;background:var(--surface-2);font-size:0.72rem;color:var(--text-muted);text-align:center">
              ${cfg.footerText}
              ${cfg.showPoweredBy ? '<br><span>Powered by LAMOM ONE</span>' : ''}
            </div>
          </div>
        </div>
      </div>
    `
  }

  function renderTheme() {
    return `
      <div style="display:flex;flex-direction:column;gap:20px">
        <!-- Theme presets -->
        <div>
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:12px">🎨 Theme Presets</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
            ${THEMES.map(t => `
              <div class="theme-card" data-tid="${t.id}" style="
                padding:14px;border-radius:var(--radius-md);cursor:pointer;
                border:2px solid ${cfg.themeId === t.id ? t.primary : 'var(--border)'};
                background:${t.bg};transition:border-color 0.15s;
              ">
                <div style="display:flex;gap:6px;margin-bottom:8px">
                  <div style="width:20px;height:20px;border-radius:50%;background:${t.primary}"></div>
                  <div style="width:20px;height:20px;border-radius:50%;background:${t.accent}"></div>
                  <div style="width:20px;height:20px;border-radius:50%;background:${t.bg};border:1px solid rgba(255,255,255,0.2)"></div>
                </div>
                <div style="font-size:0.8rem;font-weight:${cfg.themeId===t.id?700:400};color:white">${t.name}</div>
                ${cfg.themeId === t.id ? `<div style="font-size:0.65rem;color:${t.primary};margin-top:2px">✓ ใช้งานอยู่</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Custom colors -->
        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:14px">🖌 Custom Colors</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="input-group">
              <label class="input-label">Primary Color</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" id="primary-color" value="${cfg.primaryColor}" style="width:48px;height:36px;padding:2px;border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;background:var(--surface)">
                <input class="input" value="${cfg.primaryColor}" style="font-family:monospace;font-size:0.83rem" id="primary-hex" oninput="document.getElementById('primary-color').value=this.value">
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">Accent Color</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" id="accent-color" value="${cfg.accentColor}" style="width:48px;height:36px;padding:2px;border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;background:var(--surface)">
                <input class="input" value="${cfg.accentColor}" style="font-family:monospace;font-size:0.83rem" id="accent-hex" oninput="document.getElementById('accent-color').value=this.value">
              </div>
            </div>
          </div>
          <!-- Color preview bar -->
          <div style="margin-top:14px;height:32px;border-radius:var(--radius-sm);background:linear-gradient(90deg,${cfg.primaryColor},${cfg.accentColor});display:flex;align-items:center;justify-content:center">
            <span style="font-size:0.75rem;color:white;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.4)">Color Gradient Preview</span>
          </div>
        </div>
      </div>
    `
  }

  function renderLayout() {
    const layoutOpts = [
      { id: 'sidebar-compact', label: 'Sidebar แบบ Compact', desc: 'แสดงเฉพาะ icon ตลอดเวลา' },
      { id: 'sidebar-full', label: 'Sidebar แบบเต็ม', desc: 'แสดงชื่อเมนูเต็ม' },
      { id: 'topnav', label: 'Top Navigation', desc: 'เมนูอยู่ด้านบน (Coming Soon)' },
    ]
    return `
      <div style="display:flex;flex-direction:column;gap:14px;max-width:560px">
        <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">📐 Layout Options</div>
        ${layoutOpts.map(o => `
          <label style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;background:var(--surface)">
            <input type="radio" name="layout-opt" value="${o.id}" ${cfg.layoutId===o.id?'checked':''} style="width:16px;height:16px">
            <div>
              <div style="font-size:0.88rem;font-weight:600">${o.label}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${o.desc}</div>
            </div>
          </label>
        `).join('')}

        <div class="card" style="padding:16px;margin-top:6px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📄 หน้าแรก (Landing Page)</div>
          <div class="input-group">
            <label class="input-label">Default Route หลัง Login</label>
            <select class="input" id="default-route">
              ${[['/', 'Dashboard'],[ '/crm', 'CRM Dashboard'],['/service','Service Dashboard'],['/analytics','Analytics']].map(([v,l]) => `<option value="${v}" ${cfg.defaultRoute===v?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `
  }

  function renderAdvanced() {
    return `
      <div style="max-width:560px;display:flex;flex-direction:column;gap:12px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:12px">⚙️ Advanced Settings</div>
          ${[
            ['แสดงหน้า Login แบบ Custom', cfg.customLogin],
            ['ซ่อนเมนู V8 Migration', cfg.hideV8],
            ['เปิด Demo Mode Banner', cfg.showDemoBanner ?? true],
            ['บังคับ Dark Mode', cfg.forceDark ?? true],
            ['แสดง Version Number', cfg.showVersion ?? true],
          ].map(([label, active], i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:0.85rem">${label}</span>
              <button class="btn btn-xs btn-${active?'success':'secondary'} adv-toggle" data-i="${i}" style="min-width:60px">${active?'เปิด':'ปิด'}</button>
            </div>
          `).join('')}
        </div>

        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">🔑 License Info</div>
          <div style="font-size:0.82rem;display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">License Type</span><span class="badge badge-success">Enterprise</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Owner</span><span>ทวีศักดิ์ สุขสมบัติเสถียร</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Version</span><span>LAMOM ONE v1.0.0</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Build</span><span style="font-family:monospace">2025-06-09</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Modules</span><span>17 Modules / 25 Phases</span></div>
          </div>
        </div>
      </div>
    `
  }

  function saveAll() {
    // Collect values
    if (document.getElementById('brand-name')) {
      cfg.brandName = document.getElementById('brand-name').value
      cfg.tagline = document.getElementById('brand-tagline').value
      cfg.logoUrl = document.getElementById('brand-logo').value
      cfg.favicon = document.getElementById('brand-fav').value
      cfg.footerText = document.getElementById('brand-footer').value
      cfg.showPoweredBy = document.getElementById('powered-by')?.checked ?? true
    }
    if (document.getElementById('primary-color')) {
      cfg.primaryColor = document.getElementById('primary-color').value
      cfg.accentColor = document.getElementById('accent-color').value
    }
    const layout = document.querySelector('input[name="layout-opt"]:checked')?.value
    if (layout) cfg.layoutId = layout
    const dr = document.getElementById('default-route')?.value
    if (dr) cfg.defaultRoute = dr

    saveConfig(cfg)

    // Apply theme to document
    document.documentElement.style.setProperty('--primary', cfg.primaryColor)
    document.documentElement.style.setProperty('--accent', cfg.accentColor)

    // Update page title
    document.title = cfg.brandName

    showToast('💾 บันทึก White-label Settings แล้ว!', 'success')
    renderPage()
  }

  function showPreview() {
    openModal({
      title: '👁 Brand Preview', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <!-- Simulated header -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:var(--radius-sm);background:${cfg.primaryColor};display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:1rem">${cfg.brandName.charAt(0)}</div>
          <div>
            <div style="font-weight:800;font-size:1rem">${cfg.brandName}</div>
            <div style="font-size:0.73rem;color:var(--text-muted)">${cfg.tagline}</div>
          </div>
        </div>
        <!-- Color swatches -->
        <div style="display:flex;gap:8px">
          <div style="flex:1;height:48px;border-radius:var(--radius-sm);background:${cfg.primaryColor};display:flex;align-items:center;justify-content:center;color:white;font-size:0.78rem;font-weight:700">Primary ${cfg.primaryColor}</div>
          <div style="flex:1;height:48px;border-radius:var(--radius-sm);background:${cfg.accentColor};display:flex;align-items:center;justify-content:center;color:white;font-size:0.78rem;font-weight:700">Accent ${cfg.accentColor}</div>
        </div>
        <!-- Simulated button -->
        <div style="display:flex;gap:8px">
          <button style="background:${cfg.primaryColor};color:white;border:none;padding:8px 18px;border-radius:var(--radius-sm);font-weight:600;cursor:pointer">Primary Button</button>
          <button style="background:transparent;color:${cfg.primaryColor};border:1px solid ${cfg.primaryColor};padding:8px 18px;border-radius:var(--radius-sm);font-weight:600;cursor:pointer">Secondary</button>
        </div>
        <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);padding-top:8px;border-top:1px solid var(--border)">${cfg.footerText}${cfg.showPoweredBy?' · Powered by LAMOM ONE':''}</div>
      </div>`,
      footer: ''
    })
  }

  renderPage()
}
