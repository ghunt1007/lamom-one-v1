// ไฟแนนซ์ไม่ผ่าน → หน้าต่าง "💡 แผนผ่อนใหม่" (ใช้ทั้งหน้างานของฉันวันนี้ และรายละเอียดใบจอง)
import { openModal } from './modal.js'
import { showToast } from '../core/store.js'
import { replanOptions, replanText } from './installment.js'

const escHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ราคารวมของใบจอง (ราคา − ส่วนลด + อุปกรณ์เสริม)
export const bookingTotal = b => (Number(b.price) || 0) - (Number(b.discount) || 0) + (Number(b.accessories) || 0)

export function openReplan(b) {
  const total = bookingTotal(b), rate = Number(b.interestRate) || 2.79
  const rows = replanOptions(total, b.down, rate)
  const fmt = n => Number(n).toLocaleString('th-TH')
  const { el, close } = openModal({
    title: `💡 แผนผ่อนใหม่ — ${escHtml(b.custName || 'ลูกค้า')}`, size: 'sm',
    body: `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">ราคารวม ${fmt(total)} บาท · ดาวน์เดิม ${fmt(b.down || 0)} บาท. ดาวน์มากขึ้น = ยอดจัดน้อยลง มักช่วยให้ไฟแนนซ์พิจารณาง่ายขึ้น (หรือลองยื่นไฟแนนซ์เจ้าอื่น)</div>
      ${rows.length ? `<div class="table-wrap"><table style="font-size:0.8rem"><thead><tr><th>ดาวน์</th><th>เพิ่มจากเดิม</th><th>72 งวด</th><th>84 งวด</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><b>${r.pct}%</b><div style="font-size:0.7rem;color:var(--text-muted)">${fmt(r.down)}</div></td><td>+${fmt(r.more)}</td><td>${fmt(r.m72)}</td><td>${fmt(r.m84)}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px">ตัวเลขประมาณการ ดอกเบี้ย ${rate}% ต่อปีแบบคงที่ อัตราจริงขึ้นกับไฟแนนซ์</div>` : '<div>ดาวน์เดิมสูงอยู่แล้ว ลองยื่นไฟแนนซ์เจ้าอื่นหรือเพิ่มผู้ค้ำ</div>'}`,
    footer: `<button class="btn btn-secondary" id="rp-close">ปิด</button>${rows.length ? '<button class="btn btn-primary" id="rp-copy">📋 คัดลอกส่งลูกค้า</button>' : ''}`,
  })
  el.querySelector('#rp-close').addEventListener('click', close)
  el.querySelector('#rp-copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(replanText(rows, rate)); showToast('📋 คัดลอกแล้ว', 'success'); close() } catch { showToast('คัดลอกไม่สำเร็จ', 'warning') }
  })
}
