// (v1.0.1183) หน้าต่าง QR ใช้ร่วมกัน: QR + ลิงก์ + บันทึกรูป + คัดลอก + (ถ้าส่ง poster) พิมพ์ป้าย
import { posterFooter, prefetchCompanyLine } from './companyFooter.js'
import { openModal } from './modal.js'
import { escHtml as esc } from './escape.js'
import { copyText } from './copyText.js'
import { qrSvg, qrDownloadLink } from './qr.js'

export function openQrModal({ title = 'QR', url = '', filename = 'QR', note = '', poster = null } = {}) {
  if (!url) return null
  if (poster) prefetchCompanyLine()
  const { el, close } = openModal({
    title: '🔳 ' + esc(title), size: 'sm',
    body: `<div style="text-align:center">
      <div style="width:min(240px,100%);margin:0 auto 8px;background:#fff;border-radius:8px;line-height:0">${qrSvg(url, { size: '100%' })}</div>
      <div style="font-size:0.68rem;color:var(--text-muted);overflow-wrap:anywhere;margin-bottom:10px">${esc(url)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
        ${poster ? '<button type="button" class="btn btn-primary btn-sm" data-qr-print>🖨 พิมพ์ป้าย</button>' : ''}
        ${qrDownloadLink(url, filename, '💾 บันทึกรูป QR', 'btn btn-secondary btn-sm')}
        <button type="button" class="btn btn-secondary btn-sm" data-qr-copy>📋 คัดลอกลิงก์</button>
      </div>
      ${note ? `<div style="font-size:0.68rem;color:var(--text-muted);margin-top:10px;line-height:1.5">${esc(note)}</div>` : ''}
    </div>`,
  })
  el.querySelector('[data-qr-copy]').addEventListener('click', () => copyText(url, '📋 คัดลอกลิงก์แล้ว'))
  el.querySelector('[data-qr-print]')?.addEventListener('click', () => {
    const w = window.open('', '_blank', 'width=600,height=800')
    if (!w) return
    const lines = (poster.lines || []).map(l => `<p>${esc(l)}</p>`).join('')
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(poster.heading || title)}</title><style>body{font-family:sans-serif;text-align:center;padding:40px 24px}h1{font-size:36px;margin:0 0 6px}p{font-size:20px;color:#333;margin:6px 0}.qr{margin:24px auto}</style></head><body><h1>${esc(poster.heading || title)}</h1>${lines}<div class="qr">${qrSvg(url, { size: 380 })}</div>${posterFooter()}<script>window.print()<\/script></body></html>`)
    w.document.close()
  })
  return { el, close }
}
