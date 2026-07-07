/**
 * Content Calendar — ปฏิทินเนื้อหา
 * Route: /marketing/content
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const CONTENT_TYPES = {
  post:    { label: 'Post', color: 'primary', icon: '📝' },
  story:   { label: 'Story', color: 'warning', icon: '📸' },
  reel:    { label: 'Reel/TikTok', color: 'danger', icon: '🎬' },
  email:   { label: 'Email', color: 'secondary', icon: '📧' },
  blog:    { label: 'Blog', color: 'success', icon: '📖' },
  ads:     { label: 'Paid Ads', color: 'primary', icon: '📣' },
}

const PLATFORMS = {
  facebook: { label: 'Facebook', icon: '📘', color: '#3b82f6' },
  instagram:{ label: 'Instagram', icon: '📷', color: '#ec4899' },
  tiktok:   { label: 'TikTok', icon: '🎵', color: '#000' },
  line:     { label: 'LINE', icon: '💬', color: '#06b6d4' },
  youtube:  { label: 'YouTube', icon: '▶️', color: '#ef4444' },
  website:  { label: 'Website', icon: '🌐', color: '#8b5cf6' },
}

const CONTENT_STATUS = {
  idea:      { label: 'ไอเดีย', color: 'secondary' },
  planned:   { label: 'วางแผน', color: 'primary' },
  in_progress: { label: 'กำลังทำ', color: 'warning' },
  review:    { label: 'รอตรวจ', color: 'warning' },
  scheduled: { label: 'รอเผยแพร่', color: 'primary' },
  published: { label: 'เผยแพร่แล้ว', color: 'success' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function ContentCalendarPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let content = []
  let typeFilter = 'all'
  let statusFilter = 'all'
  let viewMode = 'list'
  let loading = true

  async function loadData() {
    loading = true
    try { content = await listDocs('content_calendar', [], 'publishDate', 'desc', 500) } catch (e) { content = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = content.filter(c => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
    const published = content.filter(c => c.status === 'published').length
    const scheduled = content.filter(c => c.status === 'scheduled').length
    const inProd = content.filter(c => ['in_progress', 'review', 'planned'].includes(c.status)).length
    const totalViews = content.filter(c => c.views > 0).reduce((a, c) => a + c.views, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📅 Content Calendar</div>
            <div class="page-subtitle">วางแผนและติดตามเนื้อหา Social Media</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-content-btn">+ สร้าง Content</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📝 Content ทั้งหมด', content.length, 'primary')}
          ${kpi('✅ เผยแพร่แล้ว', published, 'success')}
          ${kpi('⏰ รอเผยแพร่', scheduled, scheduled > 0 ? 'warning' : 'secondary')}
          ${kpi('👁 Views รวม', totalViews.toLocaleString(), 'primary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
            ${Object.entries(CONTENT_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
          <select class="input" id="status-sel" style="max-width:150px;font-size:0.82rem">
            <option value="all">ทุกสถานะ</option>
            ${Object.entries(CONTENT_STATUS).map(([k,v])=>`<option value="${k}" ${statusFilter===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
          ${list.map(c => {
            const ct = CONTENT_TYPES[c.type]
            const cs = CONTENT_STATUS[c.status]
            const isPast = new Date(c.publishDate) < new Date()
            return `<div class="card" style="padding:14px;border-top:3px solid var(--${ct?.color})">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <div style="font-size:1.2rem">${ct?.icon}</div>
                <span class="badge badge-${cs?.color}" style="font-size:0.65rem">${cs?.label}</span>
              </div>
              <div style="font-weight:700;font-size:0.87rem;margin-bottom:4px">${c.title}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">${c.author}</div>

              <!-- Platforms -->
              <div style="display:flex;gap:4px;margin-bottom:8px">
                ${c.platforms.map(p => `<span style="font-size:0.75rem;color:${PLATFORMS[p]?.color}">${PLATFORMS[p]?.icon}</span>`).join('')}
              </div>

              <!-- Publish date -->
              <div style="font-size:0.75rem;margin-bottom:8px;color:${isPast&&c.status==='scheduled'?'var(--danger)':'var(--text-muted)'}">
                📅 ${isPast?'เผยแพร่เมื่อ':'กำหนด'} ${formatDate(c.publishDate)}
              </div>

              <!-- Metrics if published -->
              ${c.views > 0 ? `
                <div style="display:flex;gap:12px;font-size:0.78rem;margin-bottom:8px">
                  <span>👁 ${c.views.toLocaleString()}</span>
                  <span>❤️ ${c.likes.toLocaleString()}</span>
                  <span>🔗 ${c.shares.toLocaleString()}</span>
                </div>
              ` : ''}

              <!-- Tags -->
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
                ${c.tags.map(t => `<span style="font-size:0.62rem;padding:2px 6px;background:var(--surface-2);border-radius:10px;color:var(--text-muted)">#${t}</span>`).join('')}
              </div>

              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-ct-btn" data-id="${c.id}" style="flex:1">ดูรายละเอียด</button>
                ${c.status !== 'published' ? `<button class="btn btn-xs btn-success pub-ct-btn" data-id="${c.id}">เผยแพร่</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('status-sel')?.addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    document.getElementById('add-content-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-ct-btn').forEach(b => b.addEventListener('click', () => {
      const c = content.find(x => x.id === b.dataset.id); if (c) openDetail(c)
    }))
    container.querySelectorAll('.pub-ct-btn').forEach(b => b.addEventListener('click', async () => {
      const c = content.find(x => x.id === b.dataset.id)
      if (!c) return
      const newDate = addDays(0)
      c.status = 'published'; c.publishDate = newDate
      renderPage()
      showToast(`✅ เผยแพร่ "${c.title}" แล้ว!`, 'success')
      try { await updateDocData('content_calendar', c.id, { status: 'published', publishDate: newDate }) } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openDetail(c) {
    const ct = CONTENT_TYPES[c.type]
    const cs = CONTENT_STATUS[c.status]
    openModal({
      title: `${ct?.icon} ${c.title}`,
      size: 'md',
      body: `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <span class="badge badge-${ct?.color}">${ct?.icon} ${ct?.label}</span>
          <span class="badge badge-${cs?.color}">${cs?.label}</span>
        </div>
        ${row('ผู้สร้าง', c.author)}
        ${row('วันเผยแพร่', formatDate(c.publishDate))}
        ${row('แพลตฟอร์ม', c.platforms.map(p => PLATFORMS[p]?.icon + ' ' + PLATFORMS[p]?.label).join(', '))}
        ${c.views > 0 ? row('Views', c.views.toLocaleString()) : ''}
        ${c.likes > 0 ? row('Likes', c.likes.toLocaleString()) : ''}
        ${c.shares > 0 ? row('Shares', c.shares.toLocaleString()) : ''}
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
          ${c.tags.map(t => `<span style="font-size:0.72rem;padding:3px 8px;background:var(--surface-2);border-radius:10px;color:var(--text-muted)">#${t}</span>`).join('')}
        </div>
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ สร้าง Content ใหม่',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อ Content *</label><input class="input" id="cc-title" placeholder="หัวข้อ Content..."></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="cc-type">${Object.entries(CONTENT_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">วันเผยแพร่</label><input type="date" class="input" id="cc-date" value="${addDays(7)}"></div>
          <div class="input-group"><label class="input-label">แพลตฟอร์ม</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px">
              ${Object.entries(PLATFORMS).map(([k,v]) => `<label style="display:flex;gap:4px;font-size:0.82rem;cursor:pointer"><input type="checkbox" name="plat" value="${k}"> ${v.icon} ${v.label}</label>`).join('')}
            </div>
          </div>
          <div class="input-group"><label class="input-label">ผู้รับผิดชอบ</label><input class="input" id="cc-author" placeholder="ชื่อผู้สร้าง"></div>
        </div>
      `,
      async onConfirm() {
        const title = document.getElementById('cc-title')?.value?.trim()
        if (!title) { showToast('❗ กรุณากรอกชื่อ Content', 'error'); return false }
        const plats = [...document.querySelectorAll('input[name="plat"]:checked')].map(el => el.value)
        try {
          await createDoc('content_calendar', {
            title,
            type: document.getElementById('cc-type')?.value||'post',
            platforms: plats.length ? plats : ['facebook'],
            status: 'planned', publishDate: document.getElementById('cc-date')?.value||addDays(7),
            author: document.getElementById('cc-author')?.value||'ทีมการตลาด',
            tags: [], views: 0, likes: 0, shares: 0
          })
          showToast('✅ สร้าง Content แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
