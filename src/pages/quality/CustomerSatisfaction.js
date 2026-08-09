/**
 * Customer Satisfaction — ความพึงพอใจลูกค้า
 * Route: /quality/satisfaction
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

function stars(score) {
  return Array.from({length:5}, (_,i) => `<span style="color:${i<score?'#f59e0b':'#334155'};font-size:1.1rem">★</span>`).join('')
}

// เดิม MONTHLY_SCORES เป็น array ตัวเลขคงที่ 6 เดือน (ม.ค.-มิ.ย.) ตายตัว ไม่เคยคำนวณจาก customer_reviews จริง
// ที่หน้านี้โหลดมาอยู่แล้วเลย — แก้ให้คำนวณคะแนนเฉลี่ยของ 6 เดือนล่าสุดจริง (นับถอยจากเดือนปัจจุบัน) จากรีวิวจริง
function computeMonthlyTrend(rvws) {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTHS_SHORT[d.getMonth()] })
  }
  return months.map(m => {
    const inMonth = rvws.filter(r => (r.date || '').slice(0, 7) === m.key)
    const avg = inMonth.length ? +(inMonth.reduce((a, r) => a + r.score, 0) / inMonth.length).toFixed(1) : 0
    return { label: m.label, avg, count: inMonth.length }
  })
}

export default async function CustomerSatisfactionPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let reviews = []
  let scoreFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { reviews = await listDocs('customer_reviews', [], 'date', 'desc', 300) } catch (e) { reviews = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = reviews.filter(r => scoreFilter === 'all' || +scoreFilter === r.score)
    const avgScore = reviews.length ? (reviews.reduce((a, r) => a + r.score, 0) / reviews.length).toFixed(1) : '0.0'
    const excellent = reviews.filter(r => r.score >= 4).length
    const poor = reviews.filter(r => r.score <= 2).length
    const unreplied = reviews.filter(r => !r.replied).length

    const scoreDist = [5,4,3,2,1].map(s => ({
      s, count: reviews.filter(r => r.score === s).length,
      pct: reviews.length ? Math.round(reviews.filter(r => r.score === s).length / reviews.length * 100) : 0
    }))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⭐ Customer Satisfaction</div>
            <div class="page-subtitle">ความพึงพอใจลูกค้า — ติดตามและตอบรีวิว</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="add-review-btn">➕ บันทึกรีวิว</button>
            <button class="btn btn-primary" id="request-review-btn">📩 ขอรีวิว</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⭐ คะแนนเฉลี่ย', avgScore + ' / 5', 'warning')}
          ${kpi('😊 พอใจมาก (4-5)', excellent, 'success')}
          ${kpi('😞 ไม่พอใจ (1-2)', poor, poor > 0 ? 'danger' : 'secondary')}
          ${kpi('📬 รอตอบ', unreplied, unreplied > 0 ? 'warning' : 'secondary')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 280px;gap:14px;margin-bottom:14px">
          <!-- Score distribution -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 การกระจายคะแนน</div>
            ${scoreDist.map(d => `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <div style="width:20px;font-size:0.8rem;text-align:right;color:#f59e0b">★${d.s}</div>
                <div style="flex:1;background:var(--surface-2);border-radius:3px;height:10px">
                  <div style="width:${d.pct}%;background:#f59e0b;height:10px;border-radius:3px"></div>
                </div>
                <div style="width:40px;font-size:0.75rem;text-align:right">${d.count} (${d.pct}%)</div>
              </div>
            `).join('')}
          </div>

          <!-- Monthly trend -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 Trend รายเดือน</div>
            ${computeMonthlyTrend(reviews).map(m => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:0.78rem">${m.label}</span>
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="background:var(--surface-2);border-radius:3px;height:6px;width:80px">
                    <div style="width:${(m.avg/5*100).toFixed(0)}%;background:#f59e0b;height:6px;border-radius:3px"></div>
                  </div>
                  <span style="font-size:0.78rem;font-weight:700;color:#f59e0b">${m.count ? m.avg : '—'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Filter & Reviews -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${scoreFilter==='all'?'btn-primary':'btn-secondary'} score-btn" data-s="all">ทั้งหมด</button>
          ${[5,4,3,2,1].map(s => `<button class="btn btn-xs ${scoreFilter==s?'btn-warning':'btn-secondary'} score-btn" data-s="${s}">${s}★</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(r => `
            <div class="card" style="padding:14px;border-left:3px solid ${r.score>=4?'var(--success)':r.score<=2?'var(--danger)':'var(--warning)'}">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${escHtml(r.customer)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">🚗 ${escHtml(r.model)} · ${escHtml(r.channel)} · ${timeAgo(r.date)}</div>
                </div>
                <div style="text-align:right">
                  <div>${stars(r.score)}</div>
                  ${r.replied ? '<span style="font-size:0.62rem;color:var(--success)">✓ ตอบแล้ว</span>' : '<span style="font-size:0.62rem;color:var(--warning)">⏳ รอตอบ</span>'}
                </div>
              </div>
              <div style="font-size:0.83rem;font-style:italic;color:var(--text-muted);margin-bottom:10px">"${escHtml(r.comment)}"</div>
              <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
                ${(r.tags||[]).map(t => `<span class="badge badge-secondary" style="font-size:0.62rem">${t}</span>`).join('')}
              </div>
              ${!r.replied ? `<button class="btn btn-xs btn-primary reply-btn" data-id="${r.id}">💬 ตอบรีวิว</button>` : ''}
            </div>
          `).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-title">ไม่มีรีวิว</div>${!reviews.length ? '<div class="empty-desc">กดปุ่ม "➕ บันทึกรีวิว" ด้านบนเพื่อลงรีวิวที่ลูกค้าให้ทางโทรศัพท์/โซเชียล</div>' : ''}</div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.score-btn').forEach(b => b.addEventListener('click', () => { scoreFilter = b.dataset.s; renderPage() }))
    document.getElementById('request-review-btn')?.addEventListener('click', () => {
      // เดิมอ้างว่าส่ง SMS ไปแล้ว 12 คน (ตัวเลขคงที่ ไม่ได้คำนวณจริง) และไม่มีการส่งจริงเลย ทั้งที่ไม่มีจุดใด
      // ในหน้านี้ผูกกับรายชื่อลูกค้าที่ยังไม่รีวิวจริง — แก้ให้บอกตรงว่ายังไม่เชื่อมระบบส่งอัตโนมัติ
      showToast('📩 ยังไม่เชื่อมระบบส่ง SMS ขอรีวิวอัตโนมัติ — กรุณาส่งลิงก์รีวิวให้ลูกค้าเองในระหว่างนี้', 'error')
    })
    container.querySelectorAll('.reply-btn').forEach(b => b.addEventListener('click', () => {
      const r = reviews.find(x => x.id === b.dataset.id); if (r) openReplyForm(r)
    }))
    document.getElementById('add-review-btn')?.addEventListener('click', openAddReviewForm)
  }

  function openAddReviewForm() {
    const { el, close } = openModal({
      title: '➕ บันทึกรีวิวลูกค้า', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="rv-customer"><span class="input-error" id="rv-customer-e"></span></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="rv-model"></div>
        <div class="input-group"><label class="input-label">ช่องทาง</label>
          <select class="input" id="rv-channel"><option>โทรศัพท์</option><option>Facebook</option><option>Google Review</option><option>LINE</option><option>ในร้าน</option></select>
        </div>
        <div class="input-group"><label class="input-label">คะแนน</label>
          <select class="input" id="rv-score">${[5,4,3,2,1].map(s=>`<option value="${s}">${s} ดาว</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">ความคิดเห็น</label><textarea class="input" id="rv-comment" rows="3"></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="rvc">ยกเลิก</button><button class="btn btn-primary" id="rvs">💾 บันทึก</button>`
    })
    el.querySelector('#rvc').addEventListener('click', close)
    el.querySelector('#rvs').addEventListener('click', async () => {
      const customer = el.querySelector('#rv-customer').value.trim()
      if (!customer) { el.querySelector('#rv-customer-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#rvs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        await createDoc('customer_reviews', {
          customer, model: el.querySelector('#rv-model').value.trim() || '-',
          channel: el.querySelector('#rv-channel').value,
          score: Number(el.querySelector('#rv-score').value),
          comment: el.querySelector('#rv-comment').value.trim(),
          date: new Date().toISOString(), replied: false, tags: [],
        })
        showToast('✅ บันทึกรีวิวแล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openReplyForm(r) {
    openModal({
      title: `💬 ตอบรีวิว — ${escHtml(r.customer)}`,
      size: 'sm',
      body: `
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.82rem;font-style:italic">"${escHtml(r.comment)}"</div>
        <div class="input-group"><label class="input-label">ข้อความตอบกลับ *</label>
          <textarea class="input" id="reply-text" rows="4" placeholder="ขอบคุณที่ใช้บริการ..."></textarea>
        </div>
      `,
      async onConfirm() {
        const text = document.getElementById('reply-text')?.value?.trim()
        if (!text) { showToast('❗ กรุณากรอกข้อความ', 'error'); return false }
        await updateDocData('customer_reviews', r.id, { replied: true, replyText: text })
        showToast(`✅ ตอบรีวิว ${r.customer} แล้ว!`, 'success'); await loadData()
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
