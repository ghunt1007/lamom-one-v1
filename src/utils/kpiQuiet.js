// แถวการ์ดตัวเลข (.kpi-grid) ที่ทุกช่องเป็น 0 / ฿0 / 0% (หน้าที่ยังไม่มีข้อมูล) กินพื้นที่ครึ่งจอบนมือถือโดยไม่บอกอะไร
// ใส่คลาส kpi-quiet ให้ย่อเป็นแถบเล็กๆ จางลง (ยังเห็นครบทุกช่อง) — พอมีตัวเลขจริงสักช่องก็กลับเป็นการ์ดเต็มเหมือนเดิม
// (ส่วนช่องที่เป็น 0 ในแถวนั้นได้คลาส kpi-zero)
export function isZeroKpiText(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim()
  return s === '' || s === '—' || s === '-' || /^(฿\s?)?0(\.0+)?\s*(%|[ก-๙]+(\/[ก-๙]+)?)?$/.test(s)
}

function scan() {
  document.querySelectorAll('#main-content .kpi-grid').forEach(g => {
    const vals = [...g.querySelectorAll('.kpi-value')]
    const quiet = vals.length >= 2 && vals.every(v => isZeroKpiText(v.textContent))
    g.classList.toggle('kpi-quiet', quiet)
    // แถวที่มีตัวเลขจริงปนอยู่: ช่องที่เป็น 0 จางลง (สีเทา) ให้ช่องที่มีเรื่องเด่นขึ้นมาเอง
    vals.forEach(v => v.closest('.kpi-card')?.classList.toggle('kpi-zero', !quiet && vals.length >= 2 && isZeroKpiText(v.textContent)))
  })
}

let started = false
export function initKpiQuiet() {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  let t = null
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 150) })
    .observe(document.body, { childList: true, subtree: true, characterData: true })
}
