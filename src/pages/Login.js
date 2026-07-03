import { login, register } from '../core/auth.js'
import { getState, on } from '../core/store.js'
import { verifyLogin, requestReset, changeOwnPassword, ROLES } from '../core/userDb.js'
import { openModal } from '../utils/modal.js'

export default function LoginPage(container) {
  container.style.cssText = 'min-height:100vh;width:100%;display:flex;'
  container.innerHTML = `
    <div class="login-page" style="flex:1">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">L</div>
          <div>
            <div class="login-logo-name">LAMOM ONE</div>
            <div class="login-logo-sub">ระบบปฏิบัติการธุรกิจยานยนต์</div>
          </div>
        </div>

        <form class="login-form" id="login-form" novalidate>
          <div class="input-group">
            <label class="input-label">อีเมล <span class="required">*</span></label>
            <input type="email" class="input" id="login-email" placeholder="example@email.com" autocomplete="email">
            <span class="input-error" id="email-error"></span>
          </div>

          <div class="input-group">
            <label class="input-label">รหัสผ่าน <span class="required">*</span></label>
            <div style="position:relative">
              <input type="password" class="input" id="login-password" placeholder="รหัสผ่าน" autocomplete="current-password" style="padding-right:44px">
              <button type="button" id="toggle-pw" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem">👁</button>
            </div>
            <span class="input-error" id="pw-error"></span>
          </div>

          <button type="submit" class="btn btn-primary" id="login-btn" style="width:100%;justify-content:center;padding:11px">
            <span id="login-btn-text">เข้าสู่ระบบ</span>
          </button>

          <div style="text-align:right;margin-top:-8px">
            <a href="#" id="forgot-pw" style="font-size:0.75rem;color:var(--primary);text-decoration:none">ลืมรหัสผ่าน?</a>
          </div>

          <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
            <div style="flex:1;height:1px;background:var(--border)"></div>
            <span style="font-size:0.75rem;color:var(--text-muted)">หรือ</span>
            <div style="flex:1;height:1px;background:var(--border)"></div>
          </div>

          <button type="button" id="demo-btn" class="btn btn-secondary" style="width:100%;justify-content:center;padding:11px">
            🎮 ทดลองใช้ Demo (ไม่ต้อง Login)
          </button>
        </form>

        <div style="text-align:center;margin-top:16px">
          <span style="font-size:0.8rem;color:var(--text-muted)">LAMOM ONE V1 © 2569 · </span>
          <a href="#" id="show-register" style="font-size:0.8rem;color:var(--primary);text-decoration:none">สร้างบัญชีใหม่</a>
        </div>
      </div>

      <div class="login-card" id="register-card" style="display:none;margin-top:16px">
        <div style="font-size:1rem;font-weight:700;margin-bottom:18px">สร้างบัญชีผู้ใช้ใหม่</div>
        <form id="register-form" novalidate>
          <div class="input-group">
            <label class="input-label">อีเมล <span class="required">*</span></label>
            <input type="email" class="input" id="reg-email" placeholder="example@email.com">
            <span class="input-error" id="reg-email-error"></span>
          </div>
          <div class="input-group" style="margin-top:12px">
            <label class="input-label">รหัสผ่าน (อย่างน้อย 8 ตัว) <span class="required">*</span></label>
            <input type="password" class="input" id="reg-pw" placeholder="รหัสผ่าน">
          </div>
          <div class="input-group" style="margin-top:12px">
            <label class="input-label">ยืนยันรหัสผ่าน <span class="required">*</span></label>
            <input type="password" class="input" id="reg-pw2" placeholder="รหัสผ่านอีกครั้ง">
            <span class="input-error" id="reg-pw-error"></span>
          </div>
          <button type="submit" class="btn btn-primary" id="reg-btn" style="width:100%;justify-content:center;padding:11px;margin-top:16px">
            <span id="reg-btn-text">สร้างบัญชี</span>
          </button>
        </form>
      </div>
    </div>
  `

  // Styles injected once
  if (!document.getElementById('login-style')) {
    const s = document.createElement('style')
    s.id = 'login-style'
    s.textContent = `
      .login-page {
        min-height: 100vh; display: flex; align-items: center; justify-content: center;
        background: var(--bg);
        background-image: radial-gradient(ellipse at 20% 50%, var(--primary-dim) 0%, transparent 60%),
                          radial-gradient(ellipse at 80% 20%, var(--accent-dim) 0%, transparent 50%);
      }
      .login-card {
        width: 100%; max-width: 400px;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius-xl); padding: 36px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.4);
        animation: slideUp 300ms ease;
      }
      .login-logo {
        display: flex; align-items: center; gap: 14px; margin-bottom: 32px;
      }
      .login-logo-icon {
        width: 48px; height: 48px; border-radius: var(--radius-lg);
        background: var(--primary); display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem; font-weight: 900; color: #fff;
        box-shadow: 0 0 20px var(--primary-glow);
      }
      .login-logo-name {
        font-size: 1.3rem; font-weight: 700;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .login-logo-sub { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
      .login-form { display: flex; flex-direction: column; gap: 18px; }
    `
    document.head.appendChild(s)
  }

  const form = document.getElementById('login-form')
  const emailEl = document.getElementById('login-email')
  const pwEl = document.getElementById('login-password')
  const btn = document.getElementById('login-btn')
  const btnText = document.getElementById('login-btn-text')

  // Demo Mode — bypass Firebase
  document.getElementById('demo-btn').addEventListener('click', () => {
    const { setUser, setCompany } = window.__store || {}
    import('../core/store.js').then(m => {
      m.setUser({
        uid: 'demo-user',
        email: 'demo@lamom.one',
        displayName: 'ทวีศักดิ์ สุขสมบัติเสถียร',
        role: 'owner',
        permissions: ['*'],
      })
      m.setCompany({ id: 'demo-co', name: 'LAMOM AUTO GROUP', branch: 'สำนักงานใหญ่' })
      m.showToast('ยินดีต้อนรับสู่ Demo Mode! 🎉', 'success')
    })
    import('../core/router.js').then(m => m.navigate('/'))
  })

  document.getElementById('toggle-pw').addEventListener('click', () => {
    pwEl.type = pwEl.type === 'password' ? 'text' : 'password'
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = emailEl.value.trim()
    const pw = pwEl.value

    document.getElementById('email-error').textContent = ''
    document.getElementById('pw-error').textContent = ''

    let valid = true
    if (!email) { document.getElementById('email-error').textContent = 'กรุณาระบุอีเมล'; valid = false }
    if (!pw) { document.getElementById('pw-error').textContent = 'กรุณาระบุรหัสผ่าน'; valid = false }
    if (!valid) return

    btn.disabled = true
    btnText.innerHTML = '<span class="spinner spinner-sm"></span> กำลังเข้าสู่ระบบ...'

    // 1) เช็คผู้ใช้ภายใน (สร้างจาก User Management) ก่อน
    const internal = await verifyLogin(email, pw)
    if (internal.ok) {
      const u = internal.user
      const enter = async () => {
        const storeM = await import('../core/store.js')
        storeM.setUser({
          uid: u.id, email: u.email, displayName: u.name,
          role: u.role, permissions: [],
          supervisorEmail: u.supervisorEmail,
        })
        storeM.setCompany({ id: 'lamom-co', name: 'LAMOM AUTO GROUP', branch: 'สำนักงานใหญ่' })
        storeM.showToast(`ยินดีต้อนรับ ${u.name} (${ROLES[u.role]?.label || u.role})`, 'success')
        const routerM = await import('../core/router.js')
        routerM.navigate('/')
      }
      // รหัสชั่วคราว — บังคับตั้งรหัสใหม่ก่อนเข้าระบบ
      if (u.mustChangePw) {
        btn.disabled = false
        btnText.textContent = 'เข้าสู่ระบบ'
        openModal({
          title: '🔑 ตั้งรหัสผ่านใหม่ (บังคับ)',
          size: 'sm',
          body: `
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">รหัสที่ใช้เป็นรหัสชั่วคราว — ตั้งรหัสใหม่ของคุณเองก่อนเข้าระบบ</p>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว) *</label>
              <input class="input" type="password" id="fc-pw1">
            </div>
            <div class="input-group">
              <label class="input-label">ยืนยันรหัสผ่านใหม่ *</label>
              <input class="input" type="password" id="fc-pw2">
            </div>
            <span class="input-error" id="fc-error"></span>
          `,
          confirmText: '🔑 ตั้งรหัส + เข้าสู่ระบบ',
          async onConfirm() {
            const p1 = document.getElementById('fc-pw1')?.value || ''
            const p2 = document.getElementById('fc-pw2')?.value || ''
            const err = document.getElementById('fc-error')
            if (p1.length < 8) { if (err) err.textContent = 'รหัสผ่านอย่างน้อย 8 ตัว'; return false }
            if (p1 !== p2) { if (err) err.textContent = 'รหัสผ่านไม่ตรงกัน'; return false }
            const r = await changeOwnPassword(u.email, p1)
            if (!r.ok) { if (err) err.textContent = r.error; return false }
            enter()
          }
        })
        return
      }
      await enter()
      return
    }
    if (internal.error && internal.error !== 'not_found') {
      // เจอ user ภายในแต่รหัสผิด/ถูกระงับ — ไม่ต้องไปลอง Firebase
      document.getElementById('pw-error').textContent = internal.error
      btn.disabled = false
      btnText.textContent = 'เข้าสู่ระบบ'
      return
    }

    // 2) ไม่ใช่ user ภายใน — ลอง Firebase Auth
    try {
      await login(email, pw)
    } catch {
      btn.disabled = false
      btnText.textContent = 'เข้าสู่ระบบ'
    }
  })

  // สลับแสดง register card
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault()
    const card = document.getElementById('register-card')
    card.style.display = card.style.display === 'none' ? 'block' : 'none'
  })

  // Register form
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('reg-email').value.trim()
    const pw = document.getElementById('reg-pw').value
    const pw2 = document.getElementById('reg-pw2').value
    const emailErr = document.getElementById('reg-email-error')
    const pwErr = document.getElementById('reg-pw-error')
    const regBtn = document.getElementById('reg-btn')
    const regBtnText = document.getElementById('reg-btn-text')
    emailErr.textContent = ''
    pwErr.textContent = ''
    if (!email) { emailErr.textContent = 'กรุณาระบุอีเมล'; return }
    if (pw.length < 8) { pwErr.textContent = 'รหัสผ่านอย่างน้อย 8 ตัว'; return }
    if (pw !== pw2) { pwErr.textContent = 'รหัสผ่านไม่ตรงกัน'; return }
    regBtn.disabled = true
    regBtnText.innerHTML = '<span class="spinner spinner-sm"></span> กำลังสร้างบัญชี...'
    try {
      await register(email, pw)
    } catch {
      regBtn.disabled = false
      regBtnText.textContent = 'สร้างบัญชี'
    }
  })

  // ลืมรหัสผ่าน — ส่งคำขอถึงผู้บังคับบัญชา / แอดมินโชว์รูม
  document.getElementById('forgot-pw').addEventListener('click', (e) => {
    e.preventDefault()
    const email = (emailEl.value || '').trim()
    if (!email) {
      document.getElementById('email-error').textContent = 'กรอกอีเมลของคุณก่อน แล้วกด "ลืมรหัสผ่าน?" อีกครั้ง'
      emailEl.focus()
      return
    }
    const r = requestReset(email)
    import('../core/store.js').then(m => {
      if (r.dup) {
        m.showToast('⏳ มีคำขอค้างอยู่แล้ว — ผู้บังคับบัญชากำลังดำเนินการ', 'warning')
      } else {
        const to = r.supervisor ? `ผู้บังคับบัญชาของคุณ (${r.supervisor})` : 'แอดมินโชว์รูม'
        m.showToast(`📨 ส่งคำขอรีเซ็ตรหัสผ่านถึง ${to} แล้ว — รอการตั้งรหัสใหม่และติดต่อกลับ`, 'success')
      }
    })
  })
}
