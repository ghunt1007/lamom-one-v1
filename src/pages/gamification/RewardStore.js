/**
 * Reward Store — ร้านแลกของรางวัล (แต้มพนักงาน)
 * Route: /gamification/rewards
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { timeAgo } from '../../utils/format.js'
import { listDocs, createDoc, softDelete, incrementField, seedDemoData } from '../../core/db.js'

const REWARD_CATS = {
  cash:    { label: 'เงิน/บัตรกำนัล', icon: '💰' },
  time:    { label: 'วันหยุด/เวลา', icon: '🏖' },
  item:    { label: 'ของรางวัล', icon: '🎁' },
  perk:    { label: 'สิทธิพิเศษ', icon: '✨' },
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

export default async function RewardStorePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let rewards = []
  let staffPoints = []
  let redemptions = []
  let catFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      rewards = (await listDocs('gamification_rewards', [], 'points', 'asc', 100)).filter(r => !r.deleted)
      staffPoints = await listDocs('staff_points', [], 'points', 'desc', 100)
      redemptions = await listDocs('reward_redemptions', [], 'createdAt', 'desc', 10)
    } catch (e) { /* keep whatever loaded */ }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = rewards.filter(r => catFilter === 'all' || r.cat === catFilter)
    const totalRedeemed = rewards.reduce((a, r) => a + (r.redeemed30||0), 0)
    const totalPoints = staffPoints.reduce((a, s) => a + (s.points||0), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎁 Reward Store</div>
            <div class="page-subtitle">แลกแต้มสะสมเป็นของรางวัล — สร้างแรงจูงใจทีม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-reward-btn">➕ เพิ่มของรางวัล</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🎁 ของรางวัล', rewards.length + ' รายการ', 'primary')}
          ${kpi('🔄 แลกแล้ว (30 วัน)', totalRedeemed + ' ครั้ง', 'success')}
          ${kpi('⭐ แต้มหมุนเวียน', totalPoints.toLocaleString(), 'warning')}
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <div>
            <!-- Category filter -->
            <div style="display:flex;gap:4px;margin-bottom:12px">
              <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
              ${Object.entries(REWARD_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-primary':'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
              ${list.map(r => {
                const rc = REWARD_CATS[r.cat]
                const out = r.stock === 0
                return `<div class="card" style="padding:12px;display:flex;flex-direction:column${out?';opacity:0.5':''}">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span style="font-size:1.2rem">${rc?.icon}</span>
                    ${r.popular ? '<span class="badge badge-danger" style="font-size:0.55rem">🔥 ฮิต</span>' : ''}
                  </div>
                  <div style="font-weight:700;font-size:0.8rem;flex:1;margin-bottom:6px">${esc(r.name)}</div>
                  <div style="font-size:0.95rem;font-weight:900;color:var(--warning);margin-bottom:4px">⭐ ${(r.points||0).toLocaleString()}</div>
                  <div style="font-size:0.63rem;color:var(--text-muted);margin-bottom:8px">${r.stock >= 99 ? 'ไม่จำกัด' : 'เหลือ ' + r.stock} · แลกแล้ว ${r.redeemed30||0}/เดือน</div>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-primary redeem-btn" data-id="${r.id}" ${out?'disabled':''} style="flex:1">${out?'หมด':'🎁 แลก'}</button>
                    <button class="btn btn-xs btn-ghost del-reward-btn" data-id="${r.id}">🗑️</button>
                  </div>
                </div>`
              }).join('')}
              ${!list.length ? `<div class="empty-state"><div class="empty-icon">🎁</div><div class="empty-title">ไม่มีของรางวัล</div>${!rewards.length ? '<div class="empty-desc">กดปุ่ม "➕ เพิ่มของรางวัล" ด้านบนเพื่อเริ่มเพิ่มของรางวัลแรก</div>' : ''}</div>` : ''}
            </div>
          </div>

          <div>
            <!-- Staff points -->
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⭐ แต้มสะสมพนักงาน</div>
              ${staffPoints.map((s, i) => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
                  <span>${['🥇','🥈','🥉'][i] || (i+1)+'.'} ${esc(s.name)}</span>
                  <strong style="color:var(--warning)">⭐ ${(s.points||0).toLocaleString()}</strong>
                </div>
              `).join('')}
            </div>

            <!-- Recent redemptions -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔄 แลกล่าสุด</div>
              ${redemptions.map(r => `
                <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.73rem">
                  <div><strong>${esc(r.staff)}</strong> แลก ${esc(r.reward)}</div>
                  <div style="color:var(--text-muted);font-size:0.65rem">−${r.points} แต้ม · ${timeAgo(r.createdAt)}</div>
                </div>
              `).join('')}
              ${!redemptions.length ? `<div style="font-size:0.73rem;color:var(--text-muted)">ยังไม่มีการแลกของรางวัล</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.del-reward-btn').forEach(b => b.addEventListener('click', () => {
      deleteReward(rewards.find(x => x.id === b.dataset.id))
    }))
    document.getElementById('add-reward-btn')?.addEventListener('click', openAddRewardForm)
    container.querySelectorAll('.redeem-btn').forEach(b => b.addEventListener('click', () => {
      const r = rewards.find(x => x.id === b.dataset.id)
      if (r) openModal({
        title: '🎁 แลกรางวัล: ' + esc(r.name),
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          <div style="font-size:0.85rem">ใช้ <strong style="color:var(--warning)">⭐ ${r.points.toLocaleString()}</strong> แต้ม</div>
          <div class="input-group"><label class="input-label">พนักงานที่แลก</label>
            <select class="input" id="rd-staff">${staffPoints.map(s=>`<option value="${s.id}" ${s.points<r.points?'disabled':''}>${esc(s.name)} (⭐ ${s.points.toLocaleString()})${s.points<r.points?' — แต้มไม่พอ':''}</option>`).join('')}</select>
          </div>
        </div>`,
        confirmText: '🎁 ยืนยันแลก',
        async onConfirm() {
          const staffId = document.getElementById('rd-staff')?.value
          const s = staffPoints.find(x => x.id === staffId)
          if (!s || s.points < r.points) { showToast('❗ แต้มไม่พอ', 'error'); return false }
          if (r.stock <= 0) { showToast('❗ ของรางวัลหมดสต็อกแล้ว', 'error'); return false }
          // (แก้ไข) เดิมหักสต็อก/แต้มด้วย read-then-write ธรรมดา (อ่านค่า r.stock/s.points ที่โหลดไว้ก่อนหน้า
          // มาลบเองแล้วเขียนกลับ) ถ้ามี 2 คนแลกพร้อมกันจะเกิด stale read แต้ม/สต็อกไม่ตรงจริงได้ — เปลี่ยนเป็น
          // incrementField (Firestore increment() แบบอะตอมมิก, มีอยู่แล้วใน core/db.js) กันแข่งกัน
          try {
            await incrementField('staff_points', s.id, 'points', -r.points)
            if (r.stock < 99) await incrementField('gamification_rewards', r.id, 'stock', -1) // 99 = สต็อกไม่จำกัด (sentinel)
            await incrementField('gamification_rewards', r.id, 'redeemed30', 1)
            await createDoc('reward_redemptions', { staff: s.name, reward: r.name, points: r.points })
            showToast(`🎉 ${s.name} แลก "${r.name}" สำเร็จ!`, 'success'); await loadData()
          } catch (e) { showToast('แลกของรางวัลไม่สำเร็จ', 'error') }
        }
      })
    }))
  }

  async function deleteReward(r) {
    if (!r) return
    const ok = await confirmDialog({ title: '🗑️ ลบของรางวัล', message: `ยืนยันลบ "${esc(r.name)}"? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบถาวร', danger: true })
    if (!ok) return
    await softDelete('gamification_rewards', r.id)
    showToast('🗑️ ลบของรางวัลแล้ว', 'success')
    await loadData()
  }

  function openAddRewardForm() {
    const { el, close } = openModal({
      title: '➕ เพิ่มของรางวัล', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อของรางวัล *</label><input class="input" id="rf-name"><span class="input-error" id="rf-name-e"></span></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">หมวดหมู่</label>
            <select class="input" id="rf-cat">${Object.entries(REWARD_CATS).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ใช้แต้ม *</label><input class="input" type="number" id="rf-points"><span class="input-error" id="rf-points-e"></span></div>
        </div>
        <div class="input-group"><label class="input-label">สต็อก (99 = ไม่จำกัด)</label><input class="input" type="number" id="rf-stock" value="99"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="rfc">ยกเลิก</button><button class="btn btn-primary" id="rfs">💾 บันทึก</button>`
    })
    el.querySelector('#rfc').addEventListener('click', close)
    el.querySelector('#rfs').addEventListener('click', async () => {
      const name = el.querySelector('#rf-name').value.trim()
      const points = Number(el.querySelector('#rf-points').value) || 0
      if (!name) { el.querySelector('#rf-name-e').textContent = 'กรุณาระบุ'; return }
      if (!points) { el.querySelector('#rf-points-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#rfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        await createDoc('gamification_rewards', {
          name, cat: el.querySelector('#rf-cat').value, points,
          stock: Number(el.querySelector('#rf-stock').value) || 0,
          redeemed30: 0, popular: false,
        })
        showToast('✅ เพิ่มของรางวัลแล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
