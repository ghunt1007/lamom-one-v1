/**
 * Referral Program — โปรแกรมแนะนำเพื่อน
 * Route: /crm/referral
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const REF_STATUS = {
  pending:   { label: 'รอตรวจสอบ', color: 'warning' },
  qualified: { label: 'ผ่านเกณฑ์', color: 'primary' },
  paid:      { label: 'จ่ายแล้ว', color: 'success' },
  rejected:  { label: 'ไม่ผ่าน', color: 'danger' },
}

const REWARD_TIERS = [
  { tier: 'Bronze', minRef: 1, reward: 2000, icon: '🥉', color: '#cd7f32' },
  { tier: 'Silver', minRef: 3, reward: 5000, icon: '🥈', color: '#c0c0c0' },
  { tier: 'Gold', minRef: 5, reward: 10000, icon: '🥇', color: '#f59e0b' },
  { tier: 'Platinum', minRef: 10, reward: 25000, icon: '💎', color: '#8b5cf6' },
]

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const TOP_REFERRERS = [
  { name: 'วิชัย มีโชค', count: 5, earned: 12000, tier: 'Gold' },
  { name: 'สุดา อารมณ์ดี', count: 3, earned: 7500, tier: 'Silver' },
  { name: 'ธนา เก่งกว่า', count: 1, earned: 2500, tier: 'Bronze' },
]

export default async function ReferralProgramPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let referrals = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { referrals = await listDocs('referrals', [], 'submitDate', 'desc', 200) } catch (e) { referrals = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = referrals.filter(r => statusFilter === 'all' || r.status === statusFilter)
    const totalPaid = referrals.filter(r => r.status === 'paid').reduce((a,r) => a + r.reward, 0)
    const pending = referrals.filter(r => r.status === 'pending' || r.status === 'qualified').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤝 Referral Program</div>
            <div class="page-subtitle">โปรแกรมแนะนำเพื่อน — ติดตามและจ่ายรางวัล</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-ref-btn">+ บันทึกการแนะนำ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🤝 แนะนำทั้งหมด', referrals.length, 'primary')}
          ${kpi('⏳ รอดำเนินการ', pending, pending > 0 ? 'warning' : 'secondary')}
          ${kpi('💰 จ่ายรางวัลรวม', formatCurrency(totalPaid), 'success')}
          ${kpi('⭐ Top Referrer', TOP_REFERRERS[0]?.name?.split(' ')[0] || '-', 'warning')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 280px;gap:14px">
          <div>
            <!-- Filter -->
            <div style="display:flex;gap:4px;margin-bottom:12px">
              <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
              ${Object.entries(REF_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
            </div>

            <!-- Referral list -->
            <div style="display:flex;flex-direction:column;gap:8px">
              ${list.map(r => {
                const st = REF_STATUS[r.status]
                return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${st?.color})">
                  <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">ผู้แนะนำ → ผู้ถูกแนะนำ</div>
                      <div style="font-size:0.87rem;font-weight:700">${escHtml(r.referrer)} → ${escHtml(r.referee)}</div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${escHtml(r.model)} · ${timeAgo(r.submitDate)}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                      <span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span>
                      ${r.reward > 0 ? `<div style="font-weight:700;color:var(--success)">${formatCurrency(r.reward)}</div>` : ''}
                    </div>
                  </div>
                  ${r.status === 'qualified' ? `
                    <button class="btn btn-xs btn-success pay-btn" data-id="${r.id}" style="margin-top:8px">💰 จ่ายรางวัล</button>
                  ` : r.status === 'pending' ? `
                    <div style="display:flex;gap:6px;margin-top:8px">
                      <button class="btn btn-xs btn-primary qualify-btn" data-id="${r.id}" style="flex:1">✓ ผ่านเกณฑ์</button>
                      <button class="btn btn-xs btn-danger reject-btn" data-id="${r.id}" style="flex:1">✗ ไม่ผ่าน</button>
                    </div>
                  ` : ''}
                </div>`
              }).join('')}
              ${!list.length ? '<div class="empty-state"><div class="empty-state-icon">🤝</div><div>ไม่พบรายการ</div></div>' : ''}
            </div>
          </div>

          <!-- Sidebar: reward tiers + top referrers -->
          <div>
            <div class="card" style="padding:14px;margin-bottom:12px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🏆 Reward Tiers</div>
              ${REWARD_TIERS.map(t => `
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.8rem">
                  <span>${t.icon} ${t.tier} (${t.minRef}+ แนะนำ)</span>
                  <span style="font-weight:700;color:${t.color}">${formatCurrency(t.reward)}</span>
                </div>
              `).join('')}
            </div>

            <div class="card" style="padding:14px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⭐ Top Referrers</div>
              ${TOP_REFERRERS.map((r, i) => `
                <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="font-size:1.2rem">${['🥇','🥈','🥉'][i]}</div>
                  <div style="flex:1">
                    <div style="font-size:0.83rem;font-weight:600">${r.name}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${r.count} ครั้ง · ${r.tier}</div>
                  </div>
                  <div style="font-weight:700;font-size:0.82rem;color:var(--success)">${formatCurrency(r.earned)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-ref-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.qualify-btn').forEach(b => b.addEventListener('click', async () => {
      const r = referrals.find(x => x.id === b.dataset.id)
      if (!r) return
      try { await updateDocData('referrals', r.id, { status: 'qualified' }); showToast('✅ ผ่านเกณฑ์แล้ว', 'success'); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', async () => {
      const r = referrals.find(x => x.id === b.dataset.id)
      if (!r) return
      try { await updateDocData('referrals', r.id, { status: 'rejected' }); showToast('❌ ไม่ผ่านเกณฑ์', 'warning'); await loadData() }
      catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', async () => {
      const r = referrals.find(x => x.id === b.dataset.id)
      if (!r) return
      try {
        await updateDocData('referrals', r.id, { status: 'paid' })
        showToast(`💰 จ่ายรางวัล ${formatCurrency(r.reward)} ให้ ${r.referrer} แล้ว!`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openAddForm() {
    openModal({
      title: '+ บันทึกการแนะนำ',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ผู้แนะนำ *</label><input class="input" id="rf-referrer"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์ผู้แนะนำ</label><input class="input" id="rf-ref-phone"></div>
          <div class="input-group"><label class="input-label">ผู้ถูกแนะนำ *</label><input class="input" id="rf-referee"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์ผู้ถูกแนะนำ</label><input class="input" id="rf-ree-phone"></div>
          <div class="input-group"><label class="input-label">รุ่นรถที่ซื้อ</label><input class="input" id="rf-model" value="BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">รางวัล (บาท)</label><input type="number" class="input" id="rf-reward" value="3000"></div>
        </div>
      `,
      async onConfirm() {
        const referrer = document.getElementById('rf-referrer')?.value?.trim()
        const referee = document.getElementById('rf-referee')?.value?.trim()
        if (!referrer || !referee) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        try {
          await createDoc('referrals', {
            referrer, referrerPhone: document.getElementById('rf-ref-phone')?.value||'',
            referee, refereePhone: document.getElementById('rf-ree-phone')?.value||'',
            model: document.getElementById('rf-model')?.value||'BYD Seal AWD',
            status: 'pending', reward: +document.getElementById('rf-reward')?.value||3000,
            submitDate: new Date().toISOString()
          })
          showToast('✅ บันทึกการแนะนำแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
