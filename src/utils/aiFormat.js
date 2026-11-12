import { escHtml as esc } from './escape.js'
// แปลงคำตอบ AI (ข้อความธรรมดา/Markdown บางส่วน) เป็น HTML ที่ปลอดภัย — ใช้ร่วมกันทุกหน้าที่แสดงคำตอบ LAMI

// คำตอบ AI: escape ก่อนเสมอ แล้วค่อยแปลง **ตัวหนา** กับขึ้นบรรทัดใหม่ให้อ่านง่าย (ไม่มี HTML จาก AI หลุดเข้ามา)
const EMOJI_START = /^\p{Extended_Pictographic}/u

export function formatAiText(t) {
  const bold = x => x.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => bold(c.trim()))
  // ตาราง Markdown (| a | b |) → ตารางจริง เลื่อนข้างได้ในกรอบตัวเอง อ่านง่ายบนมือถือ
  const out = [], lines = esc(t).split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\|.*\|\s*$/.test(lines[i]) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const head = cells(lines[i]); const body = []
      i += 2
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(cells(lines[i++]))
      i--
      out.push('<div class="ai-tbl"><table><thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>')
      continue
    }
    // (v1.0.1081) คำตอบอ่านง่ายขึ้น: บรรทัดหัวเรื่องที่ขึ้นต้นด้วยอีโมจิ (บรรทัดแรก หรือหัวข้อสั้นๆ หลังบรรทัดว่าง) เป็นตัวหนา
    // และรายการ "• ..." ที่ยาวจนขึ้นบรรทัดใหม่ เยื้องตรงกับข้อความ ไม่ไปชิดซ้ายใต้จุด
    const raw = lines[i]
    const prevBlank = i === 0 || !String(lines[i - 1] || '').trim()
    const isHead = !raw.includes('**') && EMOJI_START.test(raw.trim()) && (i === 0 ? raw.trim().length <= 90 : prevBlank && raw.trim().length <= 28 && !/\d{2}/.test(raw))
    let line = bold(raw).replace(/^\s*#{1,4}\s+(.+)$/, '<b>$1</b>').replace(/^\s*[*-]\s+/, '• ')
    if (isHead) line = `<b>${line.trim()}</b>`
    else if (/^• /.test(line)) line = `<span class="ai-li">${line}</span>`
    out.push(line + '\n')
  }
  return out.join('').replace(/\n+$/, '').replace(/\n/g, '<br>').replace(/(<\/div>)<br>/g, '$1')
}
