import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

// ป้องกัน XSS — เนื้อหา Post เป็น textarea ที่ผู้ใช้พิมพ์ได้อิสระ ไม่จำกัด HTML ต้อง escape ก่อนแสดงผลเสมอ
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const PLATFORMS = {
  facebook: { label: 'Facebook', icon: '📘', color: 'primary' },
  instagram: { label: 'Instagram', icon: '📸', color: 'accent' },
  tiktok:   { label: 'TikTok', icon: '🎵', color: 'danger' },
  line:     { label: 'LINE OA', icon: '💚', color: 'success' },
  youtube:  { label: 'YouTube', icon: '▶️', color: 'danger' },
  twitter:  { label: 'X (Twitter)', icon: '🐦', color: 'primary' },
}

const POST_STATUS = {
  draft:     { label: 'Draft', color: 'primary' },
  scheduled: { label: 'Scheduled', color: 'primary' },
  published: { label: 'เผยแพร่แล้ว', color: 'success' },
  failed:    { label: 'ล้มเหลว', color: 'danger' },
}

const CONTENT_TEMPLATES = [
  { id:'T001', name:'📌 โปรโมชั่นรถใหม่', body:'🔥 [รุ่นรถ] ราคาพิเศษ [ราคา] บาท\n✅ ดอกเบี้ย [ดอกเบี้ย]%\n✅ ผ่อนสบาย [ผ่อน] บาท/เดือน\n📞 ติดต่อ: [เบอร์]\n#EV #ไฟฟ้า #LAMOMONE', type:'promotion' },
  { id:'T002', name:'🚗 Test Drive Invite', body:'🎯 ทดลองขับฟรี! [รุ่นรถ]\n📅 [วันที่] เวลา [เวลา]\n📍 [สถานที่]\n🔗 จองที่นั่ง: [ลิงก์]\n#TestDrive #EV', type:'event' },
  { id:'T003', name:'⭐ Customer Review', body:'💬 ขอบคุณรีวิวจาก คุณ[ชื่อลูกค้า]\n"[ข้อความรีวิว]"\n🚗 [รุ่นรถ]\n❤️ ขอบคุณที่ไว้วางใจ LAMOM ONE\n#CustomerReview #EV', type:'review' },
  { id:'T004', name:'🔧 Service Reminder', body:'📅 ถึงเวลาเช็กระยะแล้วนะครับ!\n🔧 บริการซ่อมมาตรฐาน\n⏱ รับรถได้ใน 1 ชั่วโมง\n📞 นัดหมาย: [เบอร์]\n#Service #CarMaintenance', type:'service' },
  { id:'T005', name:'🎉 Delivery Congratulations', body:'🥳 ยินดีต้อนรับสู่ครอบครัว EV!\nคุณ[ชื่อ] รับรถ [รุ่นรถ] สีสวยงาม 🚗✨\n#NewCarDay #EV #Congratulations #LAMOMONE', type:'delivery' },
]

export default async function SocialHubPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let posts = []
  let tab = 'calendar' // calendar | composer | templates | analytics
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { posts = await listDocs('social_posts', [], 'createdAt', 'desc', 500) } catch (e) { posts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getFiltered() {
    let list = posts
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter)
    return list.sort((a, b) => (b.scheduledAt || b.publishedAt || '').localeCompare(a.scheduledAt || a.publishedAt || ''))
  }

  function getOverallStats() {
    const pub = posts.filter(p => p.status === 'published')
    return {
      totalReach: pub.reduce((a, p) => a + p.reach, 0),
      totalLikes: pub.reduce((a, p) => a + p.likes, 0),
      totalShares: pub.reduce((a, p) => a + p.shares, 0),
      scheduled: posts.filter(p => p.status === 'scheduled').length,
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = getOverallStats()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📱 Social Hub</div>
            <div class="page-subtitle">จัดการ Content & Social Media</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="compose-btn">✍️ สร้าง Post</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('👁 Reach รวม', s.totalReach.toLocaleString(), 'primary')}
          ${kpi('❤️ Likes รวม', s.totalLikes.toLocaleString(), 'danger')}
          ${kpi('🔄 Shares', s.totalShares.toLocaleString(), 'success')}
          ${kpi('📅 Scheduled', s.scheduled, 'warning')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <button class="btn btn-sm ${tab==='calendar'?'btn-primary':'btn-secondary'} tab-btn" data-t="calendar">📅 Content Calendar</button>
          <button class="btn btn-sm ${tab==='composer'?'btn-primary':'btn-secondary'} tab-btn" data-t="composer">✍️ Composer</button>
          <button class="btn btn-sm ${tab==='templates'?'btn-primary':'btn-secondary'} tab-btn" data-t="templates">📋 Templates</button>
          <button class="btn btn-sm ${tab==='analytics'?'btn-primary':'btn-secondary'} tab-btn" data-t="analytics">📊 Analytics</button>
        </div>

        ${tab === 'calendar' ? renderCalendar() : tab === 'composer' ? renderComposer() : tab === 'templates' ? renderTemplates() : renderAnalytics()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('compose-btn')?.addEventListener('click', () => { tab = 'composer'; renderPage() })
    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.querySelectorAll('.use-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = CONTENT_TEMPLATES.find(x => x.id === btn.dataset.id)
        if (t) { tab = 'composer'; renderPage(); setTimeout(() => { const ta = document.getElementById('post-content'); if (ta) ta.value = t.body; updateCharCount() }, 50) }
      })
    })
    document.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click', () => { const p = posts.find(x => x.id === card.dataset.id); if (p) openPostDetail(p) })
    })

    // Composer logic
    setupComposer()
  }

  function renderCalendar() {
    const filtered = getFiltered()
    return `
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
        ${Object.entries(POST_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${filtered.map(p => {
          const st = POST_STATUS[p.status]
          return `<div class="post-card" data-id="${p.id}" style="
            display:flex;gap:12px;padding:14px 16px;background:var(--surface);
            border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;
          ">
            <!-- Platform icons -->
            <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;min-width:26px">
              ${p.platforms.map(pl => `<span title="${PLATFORMS[pl]?.label}">${PLATFORMS[pl]?.icon||'📱'}</span>`).join('')}
            </div>
            <!-- Content preview -->
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span class="badge badge-${st.color}" style="font-size:0.65rem">${st.label}</span>
                ${p.scheduledAt ? `<span style="font-size:0.72rem;color:var(--text-muted)">📅 ${p.scheduledAt}</span>` : ''}
              </div>
              <div style="font-size:0.83rem;white-space:pre-line;line-height:1.4;overflow:hidden;max-height:60px">${esc(p.content.slice(0, 120))}${p.content.length > 120 ? '...' : ''}</div>
            </div>
            <!-- Stats (published only) -->
            ${p.status === 'published' ? `
              <div style="display:flex;gap:12px;align-items:center;flex-shrink:0;font-size:0.78rem">
                <div style="text-align:center"><div style="font-weight:700">${p.reach.toLocaleString()}</div><div style="color:var(--text-muted)">reach</div></div>
                <div style="text-align:center"><div style="font-weight:700;color:var(--danger)">${p.likes}</div><div style="color:var(--text-muted)">❤️</div></div>
                <div style="text-align:center"><div style="font-weight:700">${p.shares}</div><div style="color:var(--text-muted)">🔄</div></div>
              </div>
            ` : ''}
          </div>`
        }).join('')}
        ${!filtered.length ? `<div class="empty-state"><div class="empty-icon">📱</div><div class="empty-title">ไม่มี Post</div></div>` : ''}
      </div>
    `
  }

  function renderComposer() {
    return `
      <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start">
        <!-- Editor -->
        <div class="card" style="padding:20px">
          <div style="font-weight:700;margin-bottom:12px">✍️ เขียน Post</div>
          <div class="input-group">
            <textarea class="input" id="post-content" rows="8" placeholder="เขียนเนื้อหา Post ของคุณที่นี่..." style="font-size:0.9rem;line-height:1.6;resize:vertical" oninput="if(window._updateCC)window._updateCC()"></textarea>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;margin-bottom:16px">
            <div style="font-size:0.75rem;color:var(--text-muted)" id="char-count">0 ตัวอักษร</div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-xs btn-secondary" id="add-emoji-btn">😊 Emoji</button>
              <button class="btn btn-xs btn-secondary" id="add-hashtag-btn"># Hashtag</button>
            </div>
          </div>

          <!-- Platform selector -->
          <div style="margin-bottom:14px">
            <div style="font-size:0.8rem;font-weight:600;margin-bottom:8px">เลือก Platform</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${Object.entries(PLATFORMS).map(([k,v]) => `
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.82rem;padding:5px 10px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                  <input type="checkbox" class="platform-cb" data-p="${k}" style="width:14px;height:14px"> ${v.icon} ${v.label}
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Schedule -->
          <div class="grid-2" style="margin-bottom:14px">
            <div class="input-group"><label class="input-label">วันเวลาเผยแพร่</label><input class="input" type="datetime-local" id="post-schedule"></div>
            <div class="input-group"><label class="input-label">ประเภท Content</label>
              <select class="input" id="post-type">
                <option value="promotion">โปรโมชั่น</option>
                <option value="event">Event</option>
                <option value="review">Review</option>
                <option value="delivery">ส่งมอบรถ</option>
                <option value="educational">ให้ความรู้</option>
                <option value="entertainment">ความบันเทิง</option>
              </select>
            </div>
          </div>

          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" id="save-draft-btn">💾 Save Draft</button>
            <button class="btn btn-primary" id="schedule-post-btn">📅 Schedule Post</button>
            <button class="btn btn-success" id="publish-now-btn">🚀 เผยแพร่เลย</button>
          </div>
        </div>

        <!-- Preview -->
        <div>
          <div class="card" style="padding:16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">👁 Preview</div>
            <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:12px;min-height:80px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-size:0.85rem;font-weight:700">L</div>
                <div>
                  <div style="font-size:0.82rem;font-weight:700">LAMOM ONE</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">เมื่อกี้</div>
                </div>
              </div>
              <div id="preview-content" style="font-size:0.83rem;white-space:pre-line;line-height:1.5;color:var(--text)">เขียนเนื้อหาด้านซ้าย...</div>
            </div>
          </div>

          <!-- Quick templates -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:8px">⚡ Quick Templates</div>
            ${CONTENT_TEMPLATES.slice(0, 3).map(t => `
              <div style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:0.78rem">${t.name}</span>
                <button class="btn btn-xs btn-secondary use-template-btn" data-id="${t.id}">ใช้</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `
  }

  function renderTemplates() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${CONTENT_TEMPLATES.map(t => `
          <div class="card" style="padding:16px">
            <div style="font-weight:700;margin-bottom:8px;font-size:0.9rem">${t.name}</div>
            <div style="font-size:0.78rem;white-space:pre-line;color:var(--text-muted);background:var(--surface-2);padding:10px;border-radius:var(--radius-sm);margin-bottom:12px;line-height:1.5;max-height:120px;overflow:hidden">${t.body}</div>
            <button class="btn btn-sm btn-primary use-template-btn" data-id="${t.id}" style="width:100%">✍️ ใช้ Template นี้</button>
          </div>
        `).join('')}
        <!-- Add template -->
        <div class="card" style="padding:16px;display:flex;align-items:center;justify-content:center;min-height:180px;border:2px dashed var(--border);background:transparent;cursor:pointer" id="add-template-btn">
          <div style="text-align:center;color:var(--text-muted)">
            <div style="font-size:2rem;margin-bottom:6px">➕</div>
            <div style="font-size:0.82rem">เพิ่ม Template ใหม่</div>
          </div>
        </div>
      </div>
    `
  }

  function renderAnalytics() {
    const pub = posts.filter(p => p.status === 'published')
    const byPlatform = {}
    pub.forEach(p => p.platforms.forEach(pl => {
      if (!byPlatform[pl]) byPlatform[pl] = { reach:0, likes:0, shares:0, posts:0 }
      byPlatform[pl].reach += p.reach; byPlatform[pl].likes += p.likes; byPlatform[pl].shares += p.shares; byPlatform[pl].posts++
    }))
    const totalReach = pub.reduce((a,p) => a+p.reach, 0) || 1

    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <!-- Platform breakdown -->
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:14px">📊 ประสิทธิภาพแต่ละ Platform</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${Object.entries(byPlatform).map(([pl, s]) => {
              const plInfo = PLATFORMS[pl]
              const pct = Math.round(s.reach / totalReach * 100)
              return `<div>
                <div style="display:flex;justify-content:space-between;font-size:0.83rem;margin-bottom:4px">
                  <span>${plInfo?.icon} ${plInfo?.label}</span>
                  <span>${s.reach.toLocaleString()} reach · ❤️${s.likes} · 🔄${s.shares} · ${s.posts} posts</span>
                </div>
                <div style="height:6px;background:var(--surface-3);border-radius:99px"><div style="height:100%;width:${pct}%;background:var(--primary);border-radius:99px"></div></div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Top posts -->
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">🏆 Top Posts</div>
          ${[...pub].sort((a,b) => b.reach - a.reach).slice(0,3).map((p, i) => `
            <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="font-size:1.3rem">${['🥇','🥈','🥉'][i]}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:0.8rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(p.content.slice(0,60))}...</div>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px">${p.platforms.map(pl=>PLATFORMS[pl]?.icon).join('')} · 👁${p.reach.toLocaleString()} · ❤️${p.likes} · 🔄${p.shares}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function setupComposer() {
    const ta = document.getElementById('post-content')
    const preview = document.getElementById('preview-content')
    if (!ta) return

    function updateCC() {
      const cc = document.getElementById('char-count')
      if (cc) cc.textContent = ta.value.length + ' ตัวอักษร'
      if (preview) preview.textContent = ta.value || 'เขียนเนื้อหาด้านซ้าย...'
    }
    window._updateCC = updateCC
    ta.addEventListener('input', updateCC)

    document.getElementById('add-emoji-btn')?.addEventListener('click', () => {
      const emojis = ['🔥','✅','🚗','💚','⭐','🎉','📞','📅','📍','💰']
      ta.value += emojis[Math.floor(Math.random() * emojis.length)]; updateCC()
    })

    document.getElementById('add-hashtag-btn')?.addEventListener('click', () => {
      ta.value += '\n#LAMOMONE #EV #ไฟฟ้า'; updateCC()
    })

    function getSelectedPlatforms() {
      return [...document.querySelectorAll('.platform-cb:checked')].map(cb => cb.dataset.p)
    }

    document.getElementById('save-draft-btn')?.addEventListener('click', async () => {
      const content = ta.value.trim()
      if (!content) return showToast('❗ กรุณาเขียนเนื้อหา', 'warning')
      try {
        await createDoc('social_posts', { content, platforms: getSelectedPlatforms(), status:'draft', scheduledAt:null, publishedAt:null, likes:0, comments:0, shares:0, reach:0 })
        showToast('💾 บันทึก Draft แล้ว', 'success'); tab = 'calendar'; await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })

    document.getElementById('schedule-post-btn')?.addEventListener('click', async () => {
      const content = ta.value.trim()
      const dt = document.getElementById('post-schedule')?.value
      if (!content) return showToast('❗ กรุณาเขียนเนื้อหา', 'warning')
      if (!dt) return showToast('❗ เลือกวันเวลาเผยแพร่', 'warning')
      try {
        await createDoc('social_posts', { content, platforms: getSelectedPlatforms(), status:'scheduled', scheduledAt:dt, publishedAt:null, likes:0, comments:0, shares:0, reach:0 })
        showToast('📅 Schedule Post แล้ว!', 'success'); tab = 'calendar'; await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })

    document.getElementById('publish-now-btn')?.addEventListener('click', async () => {
      const content = ta.value.trim()
      if (!content) return showToast('❗ กรุณาเขียนเนื้อหา', 'warning')
      const now = new Date().toISOString().slice(0,16).replace('T',' ')
      try {
        await createDoc('social_posts', { content, platforms: getSelectedPlatforms(), status:'published', scheduledAt:now, publishedAt:now, likes:0, comments:0, shares:0, reach:Math.floor(Math.random()*5000)+500 })
        showToast('🚀 เผยแพร่แล้ว!', 'success'); tab = 'calendar'; await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openPostDetail(p) {
    const st = POST_STATUS[p.status]
    openModal({
      title: '📱 Post Detail', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="badge badge-${st.color}">${st.label}</span>
          ${p.platforms.map(pl => `<span class="badge badge-primary" style="font-size:0.65rem">${PLATFORMS[pl]?.icon} ${PLATFORMS[pl]?.label}</span>`).join('')}
        </div>
        <div style="background:var(--surface-2);padding:14px;border-radius:var(--radius-md);white-space:pre-line;font-size:0.85rem;line-height:1.6">${esc(p.content)}</div>
        ${p.status === 'published' ? `
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
            ${[['👁','Reach',p.reach.toLocaleString()],['❤️','Likes',p.likes],['💬','Comments',p.comments],['🔄','Shares',p.shares]].map(([ic,lb,val]) => `
              <div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-sm)">
                <div style="font-size:1.2rem">${ic}</div>
                <div style="font-weight:700">${val}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${lb}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${p.scheduledAt ? `<div style="font-size:0.8rem;color:var(--text-muted)">📅 กำหนดเผยแพร่: ${p.scheduledAt}</div>` : ''}
      </div>`,
      footer: `${p.status !== 'published' ? `<button class="btn btn-danger" onclick="event.stopPropagation()">🗑 ลบ</button>` : ''}`
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
