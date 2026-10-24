// วินัยการติดตามลูกค้ารายเซลส์ในเดือนหนึ่ง — นับนัด (followups) ที่ครบกำหนดในเดือนนั้นถึงวันนี้:
// ทำแล้ว (done) / ข้าม (skipped) / ยังค้าง (pending ที่เลยกำหนดแล้ว) → % ที่ทำแล้ว = ทำแล้ว ÷ (ทำแล้ว + ค้าง)
// นัดที่ระบบปิดเองเพราะลูกค้าจองแล้ว/เสียดีล (skipped) ไม่นับเป็นความผิดของเซลส์
export function followupDiscipline(followups, month, today) {
  const rows = {}
  const row = name => {
    const key = (name || '').trim() || '(ไม่ระบุเซลส์)'
    return (rows[key] ||= { name: key, due: 0, done: 0, skipped: 0, overdue: 0 })
  }
  ;(followups || []).forEach(f => {
    if (!f || f.deleted) return
    const d = String(f.dueDate || '').slice(0, 10)
    if (!d.startsWith(month) || d > today) return
    const r = row(f.salesperson)
    r.due++
    if (f.status === 'done') r.done++
    else if (f.status === 'pending' && d < today) r.overdue++
    else if (f.status !== 'pending') r.skipped++
  })
  const list = Object.values(rows).map(r => ({ ...r, rate: r.done + r.overdue ? Math.round(r.done / (r.done + r.overdue) * 100) : null }))
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || b.overdue - a.overdue || a.name.localeCompare(b.name))
  return list
}

// ช่วงวันของเดือน 'YYYY-MM' → ['YYYY-MM-01', 'YYYY-MM-ปลายเดือน']
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  return [`${month}-01`, new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)]
}
