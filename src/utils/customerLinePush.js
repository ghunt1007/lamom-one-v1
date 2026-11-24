// (v1.0.1364) ส่งข้อความเข้า LINE ของลูกค้ารายนี้ตรงๆ จากหน้ารายละเอียดลูกค้า (พนักงานกดเองเท่านั้น)
// ส่งได้เฉพาะลูกค้าที่ผูก LINE กับ OA แล้ว และไม่ได้ขอเลิกรับ/บล็อก/ไม่ยินยอม — กฎเดียวกับ lineContacts() ใน marketingOptOut.js
export const isLineUid = v => /^U[0-9a-f]{10,40}$/i.test(String(v || ''))

export function canPushLine(c) {
  return !!c && !c.deleted && isLineUid(c.lineUserId) && !c.lineOptOut && !c.lineBlockedAt && c.marketingConsent !== 'no'
}

export const lineThreadOf = c => 'line_' + String(c?.lineUserId || '').replace(/[^A-Za-z0-9-]/g, '')

export async function pushLineToCustomer(c, text) {
  if (!canPushLine(c)) throw new Error('ลูกค้ายังไม่ได้ผูก LINE หรือขอเลิกรับ LINE แล้ว')
  const msg = String(text || '').trim()
  if (!msg) throw new Error('ไม่มีข้อความ')
  const { lineReply } = await import('./socialApi.js')
  await lineReply(lineThreadOf(c), msg)
  return true
}

// ปุ่ม "💚 ส่ง LINE" ข้างปุ่มคัดลอก — คืน '' ถ้าลูกค้าคนนี้รับ LINE ไม่ได้
export const lineSendBtnHtml = (c, id) => canPushLine(c) ? `<button type="button" class="btn btn-primary btn-xs" id="${id}" title="ส่งเข้าแชต LINE OA ของลูกค้าคนนี้ทันที">💚 ส่ง LINE</button>` : ''
