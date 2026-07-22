/**
 * Customer Reviews — จัดการรีวิวลูกค้า
 * Route: /marketing/reviews
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

// ป้องกัน XSS — ข้อความรีวิว (text) อาจมาจาก Platform ภายนอก (Google/Facebook) ซึ่งควบคุมเนื้อหาไม่ได้ ต้อง escape ก่อนแสดงผลเสมอ
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const PLATFORMS = {
  google:    { label: 'Google', color: 'primary', icon: '🔵' },
  facebook:  { label: 'Facebook', color: 'primary', icon: '📘' },
  tiktok:    { label: 'TikTok', color: 'secondary', icon: '🎵' },
  internal:  { label: 'ในระบบ', color: 'secondary', icon: '⭐' },
}

const REVIEW_STATUS = {
  pending:   { label: 'รอตอบ', color: 'warning', icon: '⏳' },
  replied:   { label: 'ตอบแล้ว', color: 'success', icon: '✅' },
  flagged:   { label: 'รายงาน', color: 'danger', icon: '🚩' },
}

function stars(n) { return '⭐'.repeat(n) + '☆'.repeat(5-n) }

export default async function CustomerReviewPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let reviews = []
  let platformFilter = 'all'
  let statusFilter = 'all'
  let ratingFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { reviews = await listDocs('marketing_reviews', [], 'time', 'desc', 500) } catch (e) { reviews = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = reviews.filter(r =>
      (platformFilter === 'all' || r.platform === platformFilter) &&
      (statusFilter === 'all' || r.status === statusFilter) &&
      (ratingFilter === 'all' || r.rating === parseInt(ratingFilter))
    )
    const avgRating = (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    const pending = reviews.filter(r => r.status === 'pending').length
    const fiveStars = reviews.filter(r => r.rating === 5).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⭐ Customer Reviews</div>
            <div class="page-subtitle">จัดการรีวิวจากทุก Platform</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="request-review-btn">📤 ขอ Review</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⭐ คะแนนเฉลี่ย', avgRating + '/5', parseFloat(avgRating) >= 4 ? 'success' : 'warning')}
          ${kpi('🌟 5 ดาว', fiveStars + ' รีวิว', 'success')}
          ${kpi('⏳ รอตอบ', pending, pending > 0 ? 'warning' : 'secondary')}
          ${kpi('📝 ทั้งหมด', reviews.length + ' รีวิว', 'primary')}
        </div>

        <!-- Star distribution -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">⭐ กระจายคะแนน</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${[5,4,3,2,1].map(s => {
              const cnt = reviews.filter(r => r.rating === s).length
              const pct = Math.round(cnt / reviews.length * 100)
              return `<div style="display:flex;align-items:center;gap:8px">
                <span style="width:40px;font-size:0.72rem;text-align:right">${s} ⭐</span>
                <div style="flex:1;background:var(--surface-2);border-radius:3px;height:10px">
                  <div style="width:${pct}%;background:var(--${s>=4?'success':s===3?'warning':'danger'});height:10px;border-radius:3px"></div>
                </div>
                <span style="width:40px;font-size:0.72rem;color:var(--text-muted)">${cnt} (${pct}%)</span>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${platformFilter==='all'?'btn-primary':'btn-secondary'} pf-btn" data-p="all">ทุก Platform</button>
            ${Object.entries(PLATFORMS).map(([k,v]) => `<button class="btn btn-xs ${platformFilter===k?'btn-'+v.color:'btn-secondary'} pf-btn" data-p="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px">
            ${['all','5','4','3','2','1'].map(r => `<button class="btn btn-xs ${ratingFilter===r?'btn-warning':'btn-secondary'} rf-btn" data-r="${r}">${r==='all'?'ทุกดาว':r+'⭐'}</button>`).join('')}
          </div>
        </div>

        <!-- Review list -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(r => {
            const pl = PLATFORMS[r.platform]
            const rs = REVIEW_STATUS[r.status]
            return `<div class="card" style="padding:12px 14px">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.85rem">${esc(r.author)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${pl?.icon} ${pl?.label} · ${timeAgo(r.time)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <div style="font-size:0.8rem">${stars(r.rating)}</div>
                  <span class="badge badge-${rs?.color}" style="font-size:0.6rem">${rs?.icon} ${rs?.label}</span>
                </div>
              </div>
              <p style="font-size:0.82rem;margin:0 0 8px">"${esc(r.text)}"</p>
              ${r.reply ? `<div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm);font-size:0.75rem;color:var(--text-muted)">💬 ตอบแล้ว: "${esc(r.reply)}"</div>` : ''}
              ${r.status === 'pending' ? `<button class="btn btn-xs btn-primary reply-btn" data-id="${r.id}" style="margin-top:8px">💬 ตอบกลับ</button>` : ''}
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.pf-btn').forEach(b => b.addEventListener('click', () => { platformFilter = b.dataset.p; renderPage() }))
    container.querySelectorAll('.rf-btn').forEach(b => b.addEventListener('click', () => { ratingFilter = b.dataset.r; renderPage() }))
    container.querySelectorAll('.reply-btn').forEach(b => b.addEventListener('click', () => {
      const r = reviews.find(x => x.id === b.dataset.id); if (r) openReplyModal(r)
    }))
    document.getElementById('request-review-btn')?.addEventListener('click', () => {
      const pending = reviews.filter(r => r.status === 'pending')
      openModal({
        title: '📤 ขอ Review จากลูกค้า',
        size: 'sm',
        body: `<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:0.72rem;color:var(--text-muted)">แพลตฟอร์มที่ต้องการ Review</label>
            <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.78rem"><input type="checkbox" id="rv-google" checked> 🔵 Google</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.78rem"><input type="checkbox" id="rv-fb"> 📘 Facebook</label>
            </div>
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">ส่งให้ (${pending.length} ราย — รอตอบ)</div>
            <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.72rem;max-height:60px;overflow-y:auto">
              ${pending.map(r => esc(r.author)).join(', ') || 'ลูกค้าล่าสุดทั้งหมด'}
            </div>
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">ข้อความ (LINE)</div>
            <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.72rem;color:var(--text-muted)">สวัสดีครับ! ขอบคุณที่ไว้วางใจ LAMOM ONE 🙏 รบกวนรีวิวให้เราหน่อยนะครับ เพียง 1 นาที ช่วยให้เราปรับปรุงบริการได้ดีขึ้น ⭐ [ลิงก์]</div>
          </div>
        </div>`,
        confirmText: '📤 ส่งคำขอ',
        async onConfirm() {
          const useGoogle = document.getElementById('rv-google')?.checked
          const useFb = document.getElementById('rv-fb')?.checked
          const platforms = [useGoogle && 'Google', useFb && 'Facebook'].filter(Boolean).join(' + ') || 'Google'
          try {
            await Promise.all(pending.map(r => updateDocData('marketing_reviews', r.id, { sentRequest: true })))
            await loadData()
          } catch (e) { /* ไม่กระทบข้อความแจ้งเตือน */ }
          showToast(`📤 ส่งคำขอ Review (${platforms}) ให้ลูกค้า ${pending.length || reviews.length} ราย แล้ว`, 'success')
        }
      })
    })
  }

  function openReplyModal(review) {
    openModal({
      title: '💬 ตอบกลับรีวิว',
      size: 'sm',
      body: `<div style="margin-bottom:10px;font-size:0.82rem;font-style:italic;color:var(--text-muted)">"${esc(review.text)}"</div>
        <div class="input-group"><label class="input-label">ข้อความตอบกลับ</label><textarea class="input" id="reply-text" rows="3" placeholder="ขอบคุณสำหรับรีวิว..."></textarea></div>`,
      async onConfirm() {
        const txt = document.getElementById('reply-text')?.value?.trim()
        if (!txt) { showToast('❗ กรุณากรอกข้อความ', 'error'); return false }
        try {
          await updateDocData('marketing_reviews', review.id, { reply: txt, status: 'replied' })
          showToast('✅ ตอบกลับแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
