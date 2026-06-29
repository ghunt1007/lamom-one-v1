/**
 * SMS OTP Settings — ตั้งค่า OTP Login + 2FA ทาง SMS
 * Route: /settings/sms-otp
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const PROVIDERS = [
  { id:'twilio', name:'Twilio', logo:'📱', status:'active', price:'฿1.50/SMS', latency:'< 5 วิ', coverage:'190+ ประเทศ' },
  { id:'dtac', name:'DTAC Business SMS', logo:'📡', status:'inactive', price:'฿0.65/SMS', latency:'< 3 วิ', coverage:'ไทย' },
  { id:'ais', name:'AIS SMS Gateway', logo:'📶', status:'inactive', price:'฿0.60/SMS', latency:'< 3 วิ', coverage:'ไทย' },
]

let OTP_SETTINGS = {
  enabled2fa:   true,
  otpLength:    6,
  expireMin:    5,
  maxAttempts:  3,
  cooldownMin:  1,
  requireOnLogin: true,
  requireOnPayment: true,
  requireOnExport: false,
  senderName:   'LAMOM',
  template:     'รหัส OTP LAMOM ของคุณคือ {otp} หมดอายุใน {exp} นาที ห้ามบอกผู้อื่น',
}

const LOGS = [
  { time:'11:42:05', phone:'08x-xxx-1234', event:'Login OTP', status:'success', latency:'2.3s' },
  { time:'11:38:22', phone:'09x-xxx-5678', event:'Payment OTP', status:'success', latency:'1.8s' },
  { time:'11:25:10', phone:'08x-xxx-9999', event:'Login OTP', status:'failed', latency:'—', reason:'หมดอายุ' },
  { time:'10:55:44', phone:'06x-xxx-0001', event:'Login OTP', status:'success', latency:'3.1s' },
  { time:'10:31:18', phone:'09x-xxx-3344', event:'Export OTP', status:'blocked', latency:'—', reason:'เกิน maxAttempts' },
]

export default async function SmsOtpPage(container) {
  function render() {
    const active = PROVIDERS.find(p => p.status === 'active')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📱 SMS OTP / 2FA</div>
            <div class="page-subtitle">ตั้งค่า One-Time Password ทาง SMS · ป้องกัน Login + ธุรกรรมสำคัญ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="test-otp-btn">🧪 ทดสอบส่ง OTP</button>
            <button class="btn btn-primary" id="save-btn">💾 บันทึก</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Left col -->
          <div style="display:flex;flex-direction:column;gap:12px">

            <!-- Master toggle -->
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">🔐 เปิดใช้ 2FA (SMS OTP)</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">ผู้ใช้ทุกคนต้องยืนยัน OTP ตามเงื่อนไขด้านล่าง</div>
                </div>
                <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer">
                  <input type="checkbox" id="2fa-toggle" ${OTP_SETTINGS.enabled2fa?'checked':''} style="opacity:0;width:0;height:0">
                  <span style="position:absolute;inset:0;background:${OTP_SETTINGS.enabled2fa?'var(--primary)':'var(--surface-2)'};border-radius:12px;transition:.3s"></span>
                  <span style="position:absolute;top:3px;left:${OTP_SETTINGS.enabled2fa?'23':'3'}px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.3s"></span>
                </label>
              </div>
            </div>

            <!-- OTP config -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⚙️ ตั้งค่า OTP</div>
              <div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
                ${cfgRow('ความยาว OTP', `<select class="input" id="otp-len" style="width:80px"><option ${OTP_SETTINGS.otpLength===4?'selected':''}>4</option><option ${OTP_SETTINGS.otpLength===6?'selected':''}>6</option></select> หลัก`)}
                ${cfgRow('หมดอายุใน', `<input class="input" id="otp-exp" type="number" value="${OTP_SETTINGS.expireMin}" style="width:60px"> นาที`)}
                ${cfgRow('พยายามสูงสุด', `<input class="input" id="otp-max" type="number" value="${OTP_SETTINGS.maxAttempts}" style="width:60px"> ครั้ง`)}
                ${cfgRow('Cooldown', `<input class="input" id="otp-cool" type="number" value="${OTP_SETTINGS.cooldownMin}" style="width:60px"> นาที`)}
                ${cfgRow('ชื่อผู้ส่ง (Sender ID)', `<input class="input" id="otp-sender" value="${OTP_SETTINGS.senderName}" style="width:120px">`)}
              </div>
            </div>

            <!-- Triggers -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🎯 บังคับ OTP เมื่อ</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${[['require-login','🔐 Login ครั้งใหม่',OTP_SETTINGS.requireOnLogin],['require-payment','💳 ทำธุรกรรม > 10,000 บาท',OTP_SETTINGS.requireOnPayment],['require-export','📤 Export ข้อมูลลูกค้า',OTP_SETTINGS.requireOnExport]].map(([id,label,checked])=>`
                  <label style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;cursor:pointer">
                    <span>${label}</span>
                    <input type="checkbox" class="req-chk" id="${id}" ${checked?'checked':''}>
                  </label>`).join('')}
              </div>
            </div>

            <!-- Template -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📝 SMS Template</div>
              <textarea class="input" id="otp-tmpl" style="width:100%;height:70px;font-size:0.76rem;resize:none">${OTP_SETTINGS.template}</textarea>
              <div style="font-size:0.64rem;color:var(--text-muted);margin-top:4px">ตัวแปร: {otp} = รหัส OTP · {exp} = เวลาหมดอายุ</div>
            </div>
          </div>

          <!-- Right col -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- Providers -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📡 SMS Provider</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${PROVIDERS.map(p=>`
                  <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--radius-sm);border:2px solid ${p.status==='active'?'var(--primary)':'var(--border)'};background:${p.status==='active'?'var(--primary)11':'var(--surface-2)'}">
                    <span style="font-size:1.3rem">${p.logo}</span>
                    <div style="flex:1">
                      <div style="font-weight:700;font-size:0.82rem">${p.name}</div>
                      <div style="font-size:0.68rem;color:var(--text-muted)">${p.price} · ${p.latency} · ${p.coverage}</div>
                    </div>
                    ${p.status==='active'
                      ? `<span style="font-size:0.62rem;background:var(--success);color:#fff;padding:2px 8px;border-radius:10px">✅ ใช้งาน</span>`
                      : `<button class="btn btn-xs btn-secondary switch-btn" data-id="${p.id}" style="font-size:0.7rem">ใช้งาน</button>`}
                  </div>`).join('')}
            </div>

            <!-- Stats -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 สถิติวันนี้</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
                ${[['📤 ส่งแล้ว','47 SMS'],['✅ สำเร็จ','44 (93.6%)'],['❌ ล้มเหลว','3']].map(([k,v])=>`
                  <div style="background:var(--surface-2);padding:8px;border-radius:var(--radius-sm);text-align:center">
                    <div style="font-size:0.62rem;color:var(--text-muted)">${k}</div>
                    <div style="font-size:0.84rem;font-weight:700">${v}</div>
                  </div>`).join('')}
              </div>
            </div>

            <!-- Logs -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📋 Log ล่าสุด</div>
              <div style="display:flex;flex-direction:column;gap:0">
                ${LOGS.map(l=>`
                  <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.72rem">
                    <span style="color:var(--text-muted);flex-shrink:0">${l.time}</span>
                    <span style="flex:1">${l.event} · ${l.phone}</span>
                    <span style="font-size:0.62rem;background:${l.status==='success'?'var(--success)':l.status==='failed'?'var(--warning)':'var(--danger)'};color:#fff;padding:1px 6px;border-radius:8px">${l.status}</span>
                  </div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`

    document.getElementById('save-btn')?.addEventListener('click', () => {
      OTP_SETTINGS.enabled2fa       = document.getElementById('2fa-toggle')?.checked ?? OTP_SETTINGS.enabled2fa
      OTP_SETTINGS.otpLength        = parseInt(document.getElementById('otp-len')?.value) || OTP_SETTINGS.otpLength
      OTP_SETTINGS.expireMin        = parseInt(document.getElementById('otp-exp')?.value) || OTP_SETTINGS.expireMin
      OTP_SETTINGS.maxAttempts      = parseInt(document.getElementById('otp-max')?.value) || OTP_SETTINGS.maxAttempts
      OTP_SETTINGS.cooldownMin      = parseInt(document.getElementById('otp-cool')?.value) || OTP_SETTINGS.cooldownMin
      OTP_SETTINGS.senderName       = document.getElementById('otp-sender')?.value?.trim() || OTP_SETTINGS.senderName
      OTP_SETTINGS.requireOnLogin   = document.getElementById('require-login')?.checked ?? OTP_SETTINGS.requireOnLogin
      OTP_SETTINGS.requireOnPayment = document.getElementById('require-payment')?.checked ?? OTP_SETTINGS.requireOnPayment
      OTP_SETTINGS.requireOnExport  = document.getElementById('require-export')?.checked ?? OTP_SETTINGS.requireOnExport
      OTP_SETTINGS.template         = document.getElementById('otp-tmpl')?.value || OTP_SETTINGS.template
      render()
      showToast('💾 บันทึกการตั้งค่า OTP แล้ว', 'success')
    })
    document.getElementById('test-otp-btn')?.addEventListener('click', () => {
      openModal({ title:'🧪 ทดสอบส่ง OTP', size:'xs',
        body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">เบอร์โทร</label>
          <input class="input" id="test-phone" placeholder="08x-xxx-xxxx" style="width:100%;margin-top:4px"></div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Provider: ${active?.name || 'ไม่มี'}</div>
        </div>`,
        confirmText:'📤 ส่ง OTP ทดสอบ',
        onConfirm() {
          const phone = document.getElementById('test-phone')?.value
          if (!phone) { showToast('ใส่เบอร์โทร', 'warning'); return false }
          showToast(`📤 ส่ง OTP ทดสอบ → ${phone} · รอ 2-3 วินาที`, 'success')
        }
      })
    })
    document.getElementById('2fa-toggle')?.addEventListener('change', e => { OTP_SETTINGS.enabled2fa=e.target.checked; render() })
    container.querySelectorAll('.switch-btn').forEach(b => b.addEventListener('click', () => {
      PROVIDERS.forEach(p => p.status = p.id===b.dataset.id ? 'active' : 'inactive')
      render(); showToast(`📡 เปลี่ยน Provider เป็น ${PROVIDERS.find(p=>p.id===b.dataset.id)?.name} แล้ว`, 'success')
    }))
  }

  function cfgRow(label, input) {
    return `<div style="display:flex;justify-content:space-between;align-items:center">
      <label style="font-size:0.76rem">${label}</label>
      <div style="display:flex;align-items:center;gap:6px">${input}</div>
    </div>`
  }

  render()
}
