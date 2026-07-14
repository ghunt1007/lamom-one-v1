/**
 * Social Media Analytics — วิเคราะห์ Engagement รายแพลตฟอร์มจาก Post จริง (real-data hub)
 * Route: /marketing/social-analytics
 * เดิมไฟล์นี้เป็นข้อมูล hardcoded ทั้งหมด (followers/engagement/leads ต่อแพลตฟอร์มเป็นตัวเลขปลอม) ซ้ำซ้อนกับ
 * SocialHub.js (/marketing/social) ที่มีแท็บ Analytics ดึงจาก social_posts จริงอยู่แล้ว
 * แก้ให้ดึง Post จริงมา group ตามแพลตฟอร์มแทนตัวเลขปลอม แล้วมีทางลัดไปหน้า Social Hub เต็มรูปแบบ
 */
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'
import { navigate } from '../../core/router.js'

const PLATFORMS = {
  facebook:  { label: 'Facebook', icon: '📘', color: '#1877F2' },
  instagram: { label: 'Instagram', icon: '📸', color: '#E1306C' },
  tiktok:    { label: 'TikTok', icon: '🎵', color: '#010101' },
  line:      { label: 'LINE OA', icon: '💚', color: '#06C755' },
  youtube:   { label: 'YouTube', icon: '▶️', color: '#FF0000' },
  twitter:   { label: 'X (Twitter)', icon: '🐦', color: '#1d9bf0' },
}

export default async function SocialAnalyticsPage(container) {
  let posts = []
  try {
    posts = await listDocs('social_posts', [], 'createdAt', 'desc', 500)
  } catch (e) {}

  function aggregate() {
    const pub = posts.filter(p => p.status === 'published')
    const byPlatform = {}
    pub.forEach(p => (p.platforms || []).forEach(pl => {
      if (!byPlatform[pl]) byPlatform[pl] = { platform: pl, reach: 0, likes: 0, shares: 0, posts: 0 }
      byPlatform[pl].reach += p.reach || 0
      byPlatform[pl].likes += p.likes || 0
      byPlatform[pl].shares += p.shares || 0
      byPlatform[pl].posts++
    }))
    const list = Object.values(byPlatform)
      .map(s => ({ ...s, info: PLATFORMS[s.platform] || { label: s.platform, icon: '📱', color: '#94a3b8' } }))
      .sort((a, b) => b.reach - a.reach)
    return { pub, list }
  }

  function render() {
    const { pub, list } = aggregate()
    const totalReach = list.reduce((s, x) => s + x.reach, 0)
    const totalLikes = list.reduce((s, x) => s + x.likes, 0)
    const totalShares = list.reduce((s, x) => s + x.shares, 0)
    const topPlatform = list[0] || null
    const topPosts = [...pub].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 5)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Social Media Analytics</div>
            <div class="page-subtitle">วิเคราะห์ผล ${pub.length} Post ที่เผยแพร่จริง — ข้อมูลจริงจาก Social Hub</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="goto-hub-btn">📱 ไป Social Hub</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
          ${sc('👁 Reach รวม', totalReach.toLocaleString(), 'var(--primary)')}
          ${sc('❤️ Likes รวม', totalLikes.toLocaleString(), 'var(--danger)')}
          ${sc('🔄 Shares รวม', totalShares.toLocaleString(), 'var(--success)')}
          ${sc('🏆 แพลตฟอร์มดีสุด', topPlatform ? topPlatform.info.icon + ' ' + topPlatform.info.label : '-', 'var(--primary)')}
        </div>

        ${!list.length ? `
          <div class="empty-state">
            <div class="empty-icon">📱</div>
            <div class="empty-title">ยังไม่มี Post ที่เผยแพร่</div>
            <div style="color:var(--text-muted);font-size:0.85rem">ไปสร้าง/เผยแพร่ Post ที่หน้า Social Hub ก่อน</div>
          </div>
        ` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">📊 ประสิทธิภาพแต่ละ Platform</div>
            ${list.map(s => {
              const pct = totalReach ? Math.round(s.reach / totalReach * 100) : 0
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:0.74rem;margin-bottom:3px">
                  <span>${s.info.icon} ${s.info.label}</span>
                  <span style="font-weight:700">${s.reach.toLocaleString()} reach (${pct}%)</span>
                </div>
                <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${s.info.color};border-radius:4px"></div>
                </div>
                <div style="display:flex;gap:10px;font-size:0.64rem;color:var(--text-muted);margin-top:2px">
                  <span>❤️ ${s.likes.toLocaleString()}</span>
                  <span>🔄 ${s.shares.toLocaleString()}</span>
                  <span>${s.posts} posts</span>
                </div>
              </div>`
            }).join('')}
          </div>
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🔥 Top Posts (ตาม Reach)</div>
            ${topPosts.map(p => `
              <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(p.content || '').slice(0, 60)}</div>
                <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">
                  ${(p.platforms || []).map(pl => PLATFORMS[pl]?.icon || '📱').join('')} · 👁 ${(p.reach || 0).toLocaleString()} · ❤️ ${(p.likes || 0).toLocaleString()} · 🔁 ${(p.shares || 0).toLocaleString()}
                </div>
              </div>`).join('')}
            ${!topPosts.length ? `<div style="color:var(--text-muted);font-size:0.8rem">ไม่มี Post</div>` : ''}
          </div>
        </div>
        `}
      </div>`

    document.getElementById('goto-hub-btn')?.addEventListener('click', () => navigate('/marketing/social'))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(list.map(s => ({
        'แพลตฟอร์ม': s.info.label,
        'Reach': s.reach,
        'Likes': s.likes,
        'Shares': s.shares,
        'Posts': s.posts,
      })), 'Social_Analytics_Report.xlsx', 'Social')
      showToast('📥 Export Social Analytics แล้ว', 'success')
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:10px 12px">
      <div style="font-size:0.64rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1rem;font-weight:900;color:${c};margin-top:1px">${v}</div>
    </div>`
  }

  render()
}
