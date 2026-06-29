// เอกสารสลิปเงินเดือน / สลิปค่าคอมมิชชั่น — พิมพ์ผ่าน print.js
import { printDocument, docHeader, docFooter, money, bahtText, esc } from './print.js'

const PERIOD_CSS = '.slip-net{font-size:18px;font-weight:800}.col2{display:flex;gap:18px}.col2>div{flex:1}'

function line(label, val, opts = {}) {
  return '<tr><td style="padding:3px 6px;color:#475569">' + esc(label) + '</td>' +
    '<td class="num" style="padding:3px 6px;text-align:right;font-weight:600;' + (opts.danger ? 'color:#dc2626' : '') + '">' +
    (opts.danger ? '-' : '') + money(val) + '</td></tr>'
}

// ── สลิปเงินเดือน ─────────────────────────────────────────
export function printPayslip(s, period = '') {
  const base = s.base || 0, commission = s.commission || 0, bonus = s.bonus || 0, ot = s.ot || 0
  const tax = s.tax || 0, sso = s.sso || 0, other = s.deductions || 0
  const gross = base + commission + bonus + ot
  const totalDeduct = tax + sso + other
  const net = gross - totalDeduct

  const html =
    '<div class="doc">' +
    docHeader('สลิปเงินเดือน / Pay Slip', s.id || '', '') +
    '<table class="kv"><tbody>' +
      '<tr><td class="lbl">ชื่อพนักงาน</td><td class="val">' + esc(s.name) + '</td><td class="lbl">งวด</td><td class="val">' + esc(period || '-') + '</td></tr>' +
      '<tr><td class="lbl">แผนก</td><td class="val">' + esc(s.dept || '-') + '</td><td class="lbl">รหัสพนักงาน</td><td class="val">' + esc(s.id || '-') + '</td></tr>' +
    '</tbody></table>' +
    '<div class="col2" style="margin-top:12px">' +
      '<div>' +
        '<h3 class="sec">รายได้ (Earnings)</h3>' +
        '<table style="width:100%;border-collapse:collapse"><tbody>' +
          line('เงินเดือน', base) +
          (commission ? line('ค่าคอมมิชชั่น', commission) : '') +
          (bonus ? line('โบนัส', bonus) : '') +
          (ot ? line('ค่าล่วงเวลา (OT)', ot) : '') +
          '<tr style="border-top:1px solid #cbd5e1"><td style="padding:4px 6px;font-weight:700">รวมรายได้</td><td class="num" style="padding:4px 6px;text-align:right;font-weight:800">' + money(gross) + '</td></tr>' +
        '</tbody></table>' +
      '</div>' +
      '<div>' +
        '<h3 class="sec">รายการหัก (Deductions)</h3>' +
        '<table style="width:100%;border-collapse:collapse"><tbody>' +
          line('ภาษีหัก ณ ที่จ่าย', tax, { danger: true }) +
          line('ประกันสังคม', sso, { danger: true }) +
          (other ? line('หักอื่น ๆ', other, { danger: true }) : '') +
          '<tr style="border-top:1px solid #cbd5e1"><td style="padding:4px 6px;font-weight:700">รวมรายการหัก</td><td class="num" style="padding:4px 6px;text-align:right;font-weight:800;color:#dc2626">-' + money(totalDeduct) + '</td></tr>' +
        '</tbody></table>' +
      '</div>' +
    '</div>' +
    '<table class="grid" style="margin-top:14px"><tbody>' +
      '<tr class="total-row"><td>เงินได้สุทธิ (Net Pay)</td><td class="num slip-net">' + money(net) + ' บาท</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(net)) + '</div>' +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับเงิน</div><div class="sign-cap">(' + esc(s.name || '') + ')</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ฝ่ายบุคคล / การเงิน</div><div class="sign-cap">(..............................)</div></div>' +
    '</div>' +
    docFooter() +
    '</div>'

  printDocument(html, { title: 'สลิปเงินเดือน ' + (s.name || ''), extraCss: PERIOD_CSS })
}

// ── สลิปค่าคอมมิชชั่น ─────────────────────────────────────
// breakdown: [{label, base, rate, amount}] (rate/base optional), summary fields
export function printCommissionSlip(c) {
  const rows = c.breakdown || []
  const total = c.total != null ? c.total : rows.reduce((s, r) => s + (r.amount || 0), 0)

  const html =
    '<div class="doc">' +
    docHeader('สลิปค่าคอมมิชชั่น / Commission Slip', (c.salesName || '') + ' · ' + (c.month || ''), '') +
    '<table class="kv"><tbody>' +
      '<tr><td class="lbl">พนักงานขาย</td><td class="val">' + esc(c.salesName) + '</td><td class="lbl">เดือน</td><td class="val">' + esc(c.month || '-') + '</td></tr>' +
      '<tr><td class="lbl">จำนวนรถที่ขาย</td><td class="val">' + (c.carsSold || 0) + ' คัน</td><td class="lbl">สถานะ</td><td class="val">' + (c.status === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย') + '</td></tr>' +
    '</tbody></table>' +
    '<h3 class="sec">รายละเอียดค่าคอมมิชชั่น</h3>' +
    '<table class="grid"><thead><tr><th>รายการ</th><th class="num">ฐานคำนวณ</th><th class="num">อัตรา</th><th class="num">ค่าคอม</th></tr></thead><tbody>' +
      rows.map(r =>
        '<tr><td>' + esc(r.label) + '</td>' +
        '<td class="num">' + (r.base != null ? money(r.base) : '-') + '</td>' +
        '<td class="num">' + (r.rate != null ? (r.rate * 100).toFixed(2) + '%' : '-') + '</td>' +
        '<td class="num">' + money(r.amount) + '</td></tr>'
      ).join('') +
      '<tr class="total-row"><td colspan="3">รวมค่าคอมมิชชั่นสุทธิ</td><td class="num">' + money(total) + ' บาท</td></tr>' +
    '</tbody></table>' +
    '<div class="baht-text">จำนวนเงิน (ตัวอักษร): ' + esc(bahtText(total)) + '</div>' +
    (c.paidAt ? '<div style="font-size:12px;color:#475569;margin-top:6px">วันที่จ่าย: ' + esc(c.paidAt) + '</div>' : '') +
    '<div class="sign-row">' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้รับเงิน</div><div class="sign-cap">(' + esc(c.salesName || '') + ')</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div class="sign-cap">ผู้อนุมัติจ่าย</div><div class="sign-cap">(..............................)</div></div>' +
    '</div>' +
    docFooter() +
    '</div>'

  printDocument(html, { title: 'สลิปค่าคอม ' + (c.salesName || '') })
}
