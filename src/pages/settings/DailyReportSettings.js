/**
 * Daily Report Settings — ตั้งค่ารายงานประจำวันผ่าน Telegram/LINE
 * Route: /settings/daily-report
 * ตัว worker จริง (workers/daily-report.js) ทำงานเองทุกวันผ่าน Cloudflare Cron Trigger — หน้านี้ไว้ดูวิธี
 * ตั้งค่า credential ภายนอก (Telegram Bot/LINE Channel/Firebase Service Account ต้องตั้งเป็น secret ฝั่ง
 * Worker เท่านั้น หน้านี้ไม่มีทางบันทึก secret ให้ได้เลย) + ปุ่มทดสอบดูตัวอย่าง/ส่งจริงตอนนี้
 */
import { showToast } from '../../core/store.js'
import { previewDailyReport, sendDailyReportNow, getDailyReportWebhookUrl } from '../../utils/dailyReport.js'
import { openModal } from '../../utils/modal.js'

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

export default async function DailyReportSettingsPage(container) {
  const webhookUrl = getDailyReportWebhookUrl()

  function render() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📨 รายงานประจำวัน (Telegram/LINE)</div>
            <div class="page-subtitle">ส่งสรุปยอดจอง/ส่งมอบ/Job Card/ใบจองค้าง อัตโนมัติทุกวัน 18:00 น.</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="preview-btn">👁 ดูตัวอย่างข้อความ</button>
            <button class="btn btn-primary" id="test-send-btn">📤 ส่งทดสอบตอนนี้</button>
          </div>
        </div>

        <div style="padding:10px 14px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.75rem;color:var(--text-muted);margin-bottom:16px">
          ℹ️ หน้านี้ไว้ทดสอบ/ดูสถานะเท่านั้น — Bot Token/Channel Token/Service Account ต้องตั้งเป็น secret ฝั่ง Cloudflare Worker โดยตรง (ไม่มีช่องกรอกในแอปนี้ เพื่อไม่ให้ credential หลุดมาถึง browser เลย)
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-weight:700;margin-bottom:10px">1️⃣ Telegram Bot</div>
          <ol style="font-size:0.82rem;color:var(--text-muted);line-height:1.9;padding-left:20px;margin:0">
            <li>เปิด Telegram → ค้นหา <b>@BotFather</b> → พิมพ์ <code>/newbot</code> → ตั้งชื่อบอท</li>
            <li>จะได้ <b>Bot Token</b> (รูปแบบ <code>123456789:ABCdef...</code>)</li>
            <li>ทักแชทกับบอทที่สร้างสักข้อความ (กด Start)</li>
            <li>เปิด <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> ในเบราว์เซอร์ จะเห็น <code>"chat":{"id":...}</code> — เอาเลขนั้นเป็น <b>Chat ID</b></li>
            <li>ตั้ง secret บน Worker: <code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_CHAT_ID</code></li>
          </ol>
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-weight:700;margin-bottom:10px">2️⃣ LINE (ส่งเจาะจงถึงคุณเท่านั้น — ไม่ broadcast หาลูกค้า)</div>
          <ol style="font-size:0.82rem;color:var(--text-muted);line-height:1.9;padding-left:20px;margin:0">
            <li>เข้า <a href="https://developers.line.biz/console/" target="_blank" rel="noopener">LINE Developers Console</a> → เลือก Channel ของ LINE OA → แท็บ Messaging API → Issue <b>Channel Access Token</b></li>
            <li>คัดลอก <b>Channel Secret</b> จากแท็บ Basic settings ไว้ด้วย (คนละค่ากับ Access Token — ใช้ตรวจลายเซ็น webhook)</li>
            <li>ตั้ง Webhook URL ในหน้า Messaging API ของ LINE Console เป็นค่านี้ (กด Copy):
              <div style="display:flex;gap:6px;margin-top:6px">
                <input class="input" value="${escHtml(webhookUrl)}" readonly style="flex:1;font-size:0.76rem;font-family:monospace">
                <button class="btn btn-xs btn-secondary" id="copy-webhook-btn">📋 Copy</button>
              </div>
            </li>
            <li>เปิดใช้ Webhook ในหน้า LINE Console แล้วแอด LINE OA เป็นเพื่อน ทักไปสักข้อความ — ระบบจะจับ LINE User ID ของคุณเก็บไว้อัตโนมัติ ไม่ต้องหาเอง</li>
            <li>ตั้ง secret บน Worker: <code>LINE_CHANNEL_ACCESS_TOKEN</code>, <code>LINE_CHANNEL_SECRET</code></li>
          </ol>
        </div>

        <div class="card" style="padding:16px;margin-bottom:14px">
          <div style="font-weight:700;margin-bottom:10px">3️⃣ Firebase Service Account (ให้ Worker อ่านข้อมูลจริงตามตารางเวลาโดยไม่ต้องมีใครล็อกอิน)</div>
          <ol style="font-size:0.82rem;color:var(--text-muted);line-height:1.9;padding-left:20px;margin:0">
            <li>เข้า <a href="https://console.firebase.google.com/" target="_blank" rel="noopener">Firebase Console</a> → โปรเจกต์ lamom-one-v1 → ⚙️ Project Settings → Service Accounts → Generate new private key</li>
            <li>ตั้ง secret บน Worker จากเนื้อไฟล์ JSON ทั้งไฟล์: <code>FIRESTORE_SERVICE_ACCOUNT_JSON</code></li>
          </ol>
        </div>

        <div id="result-box"></div>
      </div>
    `

    document.getElementById('copy-webhook-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(webhookUrl)
      showToast('📋 คัดลอก Webhook URL แล้ว', 'success')
    })

    document.getElementById('preview-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('preview-btn')
      btn.disabled = true
      try {
        const { text } = await previewDailyReport()
        openModal({ title: '👁 ตัวอย่างข้อความรายงาน', size: 'sm', body: `<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.85rem;line-height:1.8">${escHtml(text)}</pre>` })
      } catch (e) { showToast(e.message || 'ดูตัวอย่างไม่สำเร็จ', 'error') }
      btn.disabled = false
    })

    document.getElementById('test-send-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('test-send-btn')
      btn.disabled = true
      const box = document.getElementById('result-box')
      box.innerHTML = `<div class="card" style="padding:14px">⏳ กำลังส่ง...</div>`
      try {
        const result = await sendDailyReportNow()
        box.innerHTML = renderResult(result)
      } catch (e) {
        box.innerHTML = `<div class="card" style="padding:14px;color:var(--danger)">❌ ${escHtml(e.message || 'ส่งไม่สำเร็จ')}</div>`
      }
      btn.disabled = false
    })
  }

  function renderResult(result) {
    if (result.error) return `<div class="card" style="padding:14px;color:var(--danger)">❌ ${escHtml(result.error)}</div>`
    const channel = (name, r) => {
      if (!r) return ''
      if (!r.configured) return `<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:8px;font-size:0.82rem;color:var(--text-muted)">${name}: ⚪ ${escHtml(r.error)}</div>`
      if (r.sent) return `<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:8px;font-size:0.82rem;color:var(--success)">${name}: ✅ ส่งสำเร็จ</div>`
      return `<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:8px;font-size:0.82rem;color:var(--danger)">${name}: ❌ ${escHtml(r.error)}</div>`
    }
    return `
      <div class="card" style="padding:16px">
        <div style="font-weight:700;margin-bottom:10px">ผลการทดสอบส่ง</div>
        ${channel('Telegram', result.telegram)}
        ${channel('LINE', result.line)}
        <details style="margin-top:8px"><summary style="cursor:pointer;font-size:0.78rem;color:var(--text-muted)">ดูข้อความที่ส่ง</summary>
          <pre style="white-space:pre-wrap;font-family:inherit;font-size:0.82rem;line-height:1.8;margin-top:8px">${escHtml(result.text || '')}</pre>
        </details>
      </div>
    `
  }

  render()
}
