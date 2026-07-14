/**
 * Sentiment Analysis — วิเคราะห์ความรู้สึกลูกค้าจากบันทึกการติดต่อจริง (comm_logs + customer_notes)
 * Route: /marketing/sentiment
 *
 * หมายเหตุ: การวิเคราะห์นี้เป็นแบบ Rule-based (ให้คะแนนจากคำสำคัญ) ไม่ใช่ AI จริง —
 * ทำงานคล้าย src/core/customerInsights.js (rules engine) แต่ให้คะแนน sentiment จากข้อความจริงแทน
 */
import { listDocs } from '../../core/db.js'
import { fullName } from '../../utils/format.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// comm_logs.type / customer_notes.type → ช่องทางที่แสดงผล
const CHANNEL_MAP = { call: 'โทรศัพท์', line: 'LINE', chat: 'LINE', email: 'Email', visit: 'เข้าโชว์รูม', note: 'อื่นๆ', internal: 'อื่นๆ' }

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// ── Rule-based keyword sentiment scoring (ภาษาไทย) ──────────────────────────
const POS_WORDS = ['ประทับใจ', 'ดีมาก', 'ดีเยี่ยม', 'ยอดเยี่ยม', 'พอใจ', 'ขอบคุณ', 'เยี่ยม', 'สวย', 'รวดเร็ว', 'ชอบ', 'ดูแลดี', 'ใส่ใจ', 'สบายใจ', 'เรียบร้อย', 'สุภาพ', 'แนะนำ']
const NEG_WORDS = ['ไม่พอใจ', 'แย่', 'ช้า', 'รอนาน', 'ผิดหวัง', 'ปัญหา', 'ร้องเรียน', 'โกรธ', 'เสียใจ', 'ไม่ดี', 'ไม่ใส่ใจ', 'ล่าช้า', 'เสีย', 'บ่น', 'หงุดหงิด', 'ยกเลิก']

function analyzeSentiment(text) {
  const t = String(text || '')
  let score = 50
  POS_WORDS.forEach(w => { if (t.includes(w)) score += 12 })
  NEG_WORDS.forEach(w => { if (t.includes(w)) score -= 14 })
  score = Math.max(2, Math.min(98, Math.round(score)))
  const sentiment = score >= 65 ? 'positive' : score <= 35 ? 'negative' : 'neutral'
  return { score, sentiment }
}

export default async function SentimentPage(container) {
  const myGen = container.__routerGen
  let filterCh = 'all'
  let filterSent = 'all'
  let interactions = []
  let loading = true

  async function loadData() {
    loading = true
    let customers = [], logs = [], notes = []
    try { customers = await listDocs('customers', [], 'createdAt', 'desc', 1000) } catch {}
    try { logs = await listDocs('comm_logs', [], 'createdAt', 'desc', 500) } catch {}
    try { notes = await listDocs('customer_notes', [], 'time', 'desc', 500) } catch {}

    const nameById = {}
    customers.forEach(c => { nameById[c.id] = fullName(c) })

    const fromLogs = logs
      .filter(l => l.note)
      .map(l => ({ id: 'log_' + l.id, customer: nameById[l.customerId] || 'ลูกค้า', channel: CHANNEL_MAP[l.type] || 'อื่นๆ', date: (l.createdAt || '').slice(0, 10), text: l.note }))
    const fromNotes = notes
      .filter(n => n.text)
      .map(n => ({ id: 'note_' + n.id, customer: n.customer || 'ลูกค้า', channel: CHANNEL_MAP[n.type] || 'อื่นๆ', date: (n.time || '').slice(0, 10), text: n.text }))

    interactions = [...fromLogs, ...fromNotes]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(it => ({ ...it, ...analyzeSentiment(it.text) }))

    loading = false
    if (container.__routerGen === myGen) render()
  }

  function chatRow(c) {
    const icon = c.sentiment === 'positive' ? '😊' : c.sentiment === 'negative' ? '😠' : '😐'
    const bg = c.sentiment === 'positive' ? 'var(--success)' : c.sentiment === 'negative' ? 'var(--danger)' : 'var(--warning)'
    const label = c.sentiment === 'positive' ? 'บวก' : c.sentiment === 'negative' ? 'ลบ' : 'กลางๆ'
    return `<div class="card" style="padding:12px;border-left:3px solid ${bg}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:1.4rem">${icon}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:0.84rem">${escHtml(c.customer)}</span>
            <span style="font-size:0.66rem;background:var(--surface-2);padding:1px 7px;border-radius:8px">${escHtml(c.channel)}</span>
            <span style="font-size:0.62rem;background:${bg};color:#fff;padding:1px 8px;border-radius:8px">${label} ${c.score}%</span>
            <span style="font-size:0.64rem;color:var(--text-muted);margin-left:auto">${escHtml(c.date || '-')}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted)">"${escHtml(c.text)}"</div>
        </div>
      </div>
    </div>`
  }

  function monthlyTrend() {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: THAI_MONTHS[d.getMonth()] })
    }
    return months.map(m => {
      const rows = interactions.filter(it => (it.date || '').startsWith(m.key))
      const pos = rows.length ? Math.round(rows.filter(r => r.sentiment === 'positive').length / rows.length * 100) : 0
      return { month: m.label, pos, count: rows.length }
    })
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="skeleton" style="height:400px;border-radius:8px"></div></div>`
      return
    }

    let rows = interactions
    if (filterCh !== 'all') rows = rows.filter(c => c.channel === filterCh)
    if (filterSent !== 'all') rows = rows.filter(c => c.sentiment === filterSent)

    const pos = interactions.filter(c => c.sentiment === 'positive').length
    const neg = interactions.filter(c => c.sentiment === 'negative').length
    const neu = interactions.filter(c => c.sentiment === 'neutral').length
    const total = interactions.length || 1
    const avgScore = interactions.length ? Math.round(interactions.reduce((s, c) => s + c.score, 0) / interactions.length) : 0

    const monthly = monthlyTrend()
    const barMax = Math.max(1, ...monthly.map(m => m.pos))
    const bars = monthly.map(m => {
      const h = Math.round(m.pos / barMax * 60)
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">'
        + '<div style="width:28px;background:var(--success);border-radius:3px 3px 0 0;height:' + h + 'px"></div>'
        + '<div style="font-size:0.6rem;color:var(--text-muted)">' + m.month + '</div>'
        + '<div style="font-size:0.58rem;color:var(--success)">' + (m.count ? m.pos + '%' : '-') + '</div>'
        + '</div>'
    }).join('')

    const channels = [...new Set(interactions.map(c => c.channel))]
    const chBreakdown = channels.length ? channels.map(ch => {
      const items = interactions.filter(c => c.channel === ch)
      const avg = items.length ? Math.round(items.reduce((s, c) => s + c.score, 0) / items.length) : 0
      const col = avg >= 70 ? 'var(--success)' : avg >= 50 ? 'var(--warning)' : 'var(--danger)'
      return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.74rem">'
        + '<span>' + escHtml(ch) + ' (' + items.length + ')</span>'
        + '<b style="color:' + col + '">' + avg + '%</b>'
        + '</div>'
    }).join('') : '<div style="font-size:0.76rem;color:var(--text-muted)">ยังไม่มีข้อมูล</div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧠 Sentiment Analysis</div>
            <div class="page-subtitle">วิเคราะห์ความรู้สึกลูกค้าแบบ Rule-based จากบันทึกการติดต่อจริง (comm_logs / customer_notes) · ${interactions.length} บันทึก</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="analyze-btn">🔄 วิเคราะห์ใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('😊 ความรู้สึกบวก', pos + ' (' + Math.round(pos / total * 100) + '%)', 'var(--success)')}
          ${sc('😐 กลางๆ', neu + ' (' + Math.round(neu / total * 100) + '%)', 'var(--warning)')}
          ${sc('😠 ความรู้สึกลบ', neg + ' (' + Math.round(neg / total * 100) + '%)', 'var(--danger)')}
          ${sc('⭐ คะแนนเฉลี่ย', avgScore + '%', avgScore >= 70 ? 'var(--success)' : avgScore >= 50 ? 'var(--warning)' : 'var(--danger)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;margin-bottom:16px">
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 แนวโน้ม Sentiment บวก รายเดือน (จากข้อมูลจริง)</div>
            <div style="display:flex;align-items:flex-end;gap:8px;height:80px">${bars}</div>
          </div>
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 แยกตามช่องทาง</div>
            ${chBreakdown}
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
          ${['all', ...channels].map(ch => `<button class="btn btn-xs ${filterCh === ch ? 'btn-primary' : 'btn-secondary'} ch-btn" data-ch="${escHtml(ch)}">${ch === 'all' ? 'ทุกช่องทาง' : escHtml(ch)}</button>`).join('')}
          <span style="width:1px;background:var(--border);margin:0 4px"></span>
          ${['all', 'positive', 'neutral', 'negative'].map(s => `<button class="btn btn-xs ${filterSent === s ? 'btn-primary' : 'btn-secondary'} sent-btn" data-s="${s}">${s === 'all' ? 'ทั้งหมด' : s === 'positive' ? '😊 บวก' : s === 'neutral' ? '😐 กลางๆ' : '😠 ลบ'}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(c => chatRow(c)).join('')}
          ${rows.length === 0 ? `<div style="text-align:center;padding:30px;color:var(--text-muted)">${interactions.length === 0 ? 'ยังไม่มีบันทึกการติดต่อลูกค้า (comm_logs / customer_notes) ในระบบ — ลองบันทึกการติดต่อจากหน้า CRM Customer Workspace หรือ Customer Notes ก่อน' : 'ไม่พบบทสนทนาตามตัวกรอง'}</div>` : ''}
        </div>
      </div>`

    container.querySelectorAll('.ch-btn').forEach(b => b.addEventListener('click', () => { filterCh = b.dataset.ch; render() }))
    container.querySelectorAll('.sent-btn').forEach(b => b.addEventListener('click', () => { filterSent = b.dataset.s; render() }))
    document.getElementById('analyze-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('analyze-btn')
      if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังวิเคราะห์...' }
      await loadData()
      const p = interactions.filter(c => c.sentiment === 'positive').length
      const n = interactions.filter(c => c.sentiment === 'negative').length
      showToast(`🔄 วิเคราะห์ใหม่เสร็จ (rule-based) — บวก ${p} · ลบ ${n} · กลาง ${interactions.length - p - n}`, 'success')
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
  await loadData()
}
