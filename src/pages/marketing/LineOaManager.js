/**
 * LINE OA Manager — จัดการ LINE Official Account
 * Route: /marketing/line-oa
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MSG_TYPES = {
  broadcast: { label: 'Broadcast', color: 'primary', icon: '📢' },
  rich:      { label: 'Rich Message', color: 'success', icon: '🖼' },
  coupon:    { label: 'คูปอง', color: 'warning', icon: '🎟' },
  auto:      { label: 'ตอบอัตโนมัติ', color: 'secondary', icon: '🤖' },
}

const OA_STATS = { followers: 4820, blocked: 312, monthlyGrowth: 156, replyRate: 92 }

export default async function LineOaManagerPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let broadcasts = []
  let autoReplies = []
  let activeTab = 'broadcast'
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [b, a] = await Promise.all([
        listDocs('line_oa_broadcasts', [], 'time', 'desc', 200),
        listDocs('line_oa_auto_replies', [], 'keyword', 'asc', 200),
      ])
      broadcasts = b; autoReplies = a
    } catch (e) { broadcasts = []; autoReplies = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💚 LINE OA Manager</div>
            <div class="page-subtitle">จัดการ LINE Official Account — @lamom</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-broadcast-btn">+ Broadcast ใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💚 Followers', OA_STATS.followers.toLocaleString(), 'success')}
          ${kpi('📈 เพิ่มเดือนนี้', '+' + OA_STATS.monthlyGrowth, 'primary')}
          ${kpi('🚫 Block', OA_STATS.blocked, 'warning')}
          ${kpi('💬 Reply Rate', OA_STATS.replyRate + '%', OA_STATS.replyRate >= 90 ? 'success' : 'warning')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:14px">
          <button class="btn btn-xs ${activeTab==='broadcast'?'btn-primary':'btn-secondary'} tab-btn" data-t="broadcast">📢 Broadcasts</button>
          <button class="btn btn-xs ${activeTab==='auto'?'btn-primary':'btn-secondary'} tab-btn" data-t="auto">🤖 ตอบอัตโนมัติ (${autoReplies.filter(a=>a.active).length})</button>
        </div>

        ${activeTab === 'broadcast' ? `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${broadcasts.map(b => {
              const mt = MSG_TYPES[b.type]
              const openRate = b.sent > 0 ? Math.round(b.opened / b.sent * 100) : 0
              const ctr = b.opened > 0 ? Math.round(b.clicked / b.opened * 100) : 0
              return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${mt?.color})">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                  <div>
                    <div style="font-weight:700;font-size:0.87rem">${b.name}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${b.status === 'scheduled' ? '⏰ กำหนดส่ง ' + formatDate(b.time) : 'ส่งแล้ว ' + timeAgo(b.time)}</div>
                  </div>
                  <span class="badge badge-${mt?.color}" style="font-size:0.62rem">${mt?.icon} ${mt?.label}</span>
                </div>
                ${b.status === 'sent' ? `
                  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
                    ${mini('📤 ส่ง', b.sent.toLocaleString())}
                    ${mini('👁 เปิดอ่าน', b.opened.toLocaleString() + ' (' + openRate + '%)')}
                    ${mini('👆 คลิก', b.clicked.toLocaleString())}
                    ${mini('📊 CTR', ctr + '%')}
                  </div>
                ` : `<button class="btn btn-xs btn-warning cancel-bc-btn" data-id="${b.id}">🚫 ยกเลิกกำหนดส่ง</button>`}
              </div>`
            }).join('')}
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${autoReplies.map(a => `
              <div class="card" style="padding:12px 14px${a.active?'':';opacity:0.55'}">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                  <div style="flex:1">
                    <div style="font-size:0.75rem;color:var(--text-muted)">Keywords: <strong style="color:var(--primary)">${a.keyword}</strong></div>
                    <div style="font-size:0.8rem;margin-top:4px;background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm)">🤖 ${a.reply}</div>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
                  <span style="font-size:0.67rem;color:var(--text-muted)">ทำงาน ${a.triggers30d} ครั้ง/30 วัน</span>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-xs btn-secondary edit-ar-btn" data-id="${a.id}">✏️</button>
                    <button class="btn btn-xs ${a.active?'btn-success':'btn-secondary'} toggle-ar-btn" data-id="${a.id}">${a.active?'✅ เปิด':'⏸ ปิด'}</button>
                  </div>
                </div>
              </div>
            `).join('')}
            <button class="btn btn-secondary" id="add-ar-btn">+ เพิ่มกฎตอบอัตโนมัติ</button>
          </div>
        `}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.t; renderPage() }))
    container.querySelectorAll('.toggle-ar-btn').forEach(b => b.addEventListener('click', async () => {
      const a = autoReplies.find(x => x.id === b.dataset.id)
      if (!a) return
      a.active = !a.active
      renderPage()
      try { await updateDocData('line_oa_auto_replies', a.id, { active: a.active }) } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.edit-ar-btn').forEach(b => b.addEventListener('click', () => {
      const a = autoReplies.find(x => x.id === b.dataset.id); if (a) openArForm(a)
    }))
    container.querySelectorAll('.cancel-bc-btn').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ยกเลิก Broadcast', message: 'ต้องการยกเลิก Broadcast นี้หรือไม่?', confirmText: 'ยกเลิก Broadcast', danger: true })
      if (!ok) return
      try {
        await softDelete('line_oa_broadcasts', b.dataset.id)
        showToast('🚫 ยกเลิกแล้ว', 'secondary')
        await loadData()
      } catch (e) { showToast('ยกเลิกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('add-ar-btn')?.addEventListener('click', () => openArForm())
    document.getElementById('new-broadcast-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ สร้าง Broadcast',
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อ Campaign *</label><input class="input" id="bc-name"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="bc-type">${Object.entries(MSG_TYPES).filter(([k])=>k!=='auto').map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">กำหนดส่ง</label><input class="input" type="date" id="bc-date" value="${addDays(1).slice(0,10)}"></div>
          <div style="font-size:0.7rem;color:var(--text-muted)">💚 จะส่งถึง followers ทั้งหมด ~${(OA_STATS.followers - OA_STATS.blocked).toLocaleString()} คน</div>
        </div>`,
        async onConfirm() {
          const name = document.getElementById('bc-name')?.value?.trim()
          if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
          try {
            await createDoc('line_oa_broadcasts', { name, type:document.getElementById('bc-type')?.value||'broadcast', sent:0, opened:0, clicked:0, status:'scheduled', time:document.getElementById('bc-date')?.value||addDays(1) })
            showToast('📢 สร้าง Broadcast แล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  function openArForm(a = null) {
    openModal({
      title: a ? '✏️ แก้ไขกฎ' : '+ กฎตอบอัตโนมัติ',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">Keywords (คั่นด้วย ,) *</label><input class="input" id="ar-kw" value="${a?.keyword||''}"></div>
        <div class="input-group"><label class="input-label">ข้อความตอบ *</label><textarea class="input" id="ar-reply" rows="3">${escHtml(a?.reply||'')}</textarea></div>
      </div>`,
      async onConfirm() {
        const kw = document.getElementById('ar-kw')?.value?.trim()
        const reply = document.getElementById('ar-reply')?.value?.trim()
        if (!kw || !reply) { showToast('❗ กรอกให้ครบ', 'error'); return false }
        try {
          if (a) await updateDocData('line_oa_auto_replies', a.id, { keyword: kw, reply })
          else await createDoc('line_oa_auto_replies', { keyword: kw, reply, active: true, triggers30d: 0 })
          showToast('✅ บันทึกกฎแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function mini(l, v) { return `<div style="background:var(--surface-2);padding:6px 8px;border-radius:var(--radius-sm)"><div style="color:var(--text-muted);font-size:0.63rem">${l}</div><div style="font-weight:700;font-size:0.78rem">${v}</div></div>` }
