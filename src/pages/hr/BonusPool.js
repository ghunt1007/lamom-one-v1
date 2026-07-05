/**
 * Staff Bonus Pool — คำนวณ Bonus รายปีตาม KPI
 * Route: /hr/bonus-pool
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

const POOL_BUDGET = 1200000

function calcBonus(s) {
  const rate = s.kpi >= 90 ? 1.0 : s.kpi >= 80 ? 0.8 : s.kpi >= 70 ? 0.6 : 0.4
  return Math.round(s.base * s.multiplier * rate)
}

function kpiColor(kpi) {
  return kpi >= 90 ? 'var(--success)' : kpi >= 75 ? 'var(--warning)' : 'var(--danger)'
}

function kpiGrade(kpi) {
  return kpi >= 90 ? 'A' : kpi >= 80 ? 'B' : kpi >= 70 ? 'C' : 'D'
}

export default async function BonusPoolPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staff = []
  let filter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { staff = await listDocs('bonus_pool_staff', [], 'name', 'asc', 200) } catch (e) { staff = [] }
    staff.forEach(s => s.bonus = calcBonus(s))
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const rows = filter === 'all' ? staff : staff.filter(s => s.dept === filter)
    const totalBonus = staff.reduce((sum, s) => sum + s.bonus, 0)
    const remaining  = POOL_BUDGET - totalBonus
    const paidCount  = staff.filter(s => s.paid).length
    const depts = [...new Set(staff.map(s => s.dept))]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎁 Staff Bonus Pool</div>
            <div class="page-subtitle">คำนวณ Bonus ตาม KPI · งบประมาณ ${formatCurrency(POOL_BUDGET)} · ${staff.length} คน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="recalc-btn">🔄 คำนวณใหม่</button>
            <button class="btn btn-primary" id="approve-all-btn">✅ อนุมัติทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('💰 งบ Bonus รวม', formatCurrency(POOL_BUDGET), 'var(--text)')}
          ${sc('🎁 Bonus ทั้งหมด', formatCurrency(totalBonus), 'var(--primary)')}
          ${sc('💵 งบคงเหลือ', formatCurrency(remaining), remaining>=0?'var(--success)':'var(--danger)')}
          ${sc('✅ จ่ายแล้ว', paidCount+'/'+staff.length+' คน', 'var(--success)')}
        </div>

        <!-- Budget bar -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:6px">
            <span style="color:var(--text-muted)">การใช้งบ Bonus</span>
            <span style="font-weight:700">${Math.round(totalBonus/POOL_BUDGET*100)}%</span>
          </div>
          <div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${Math.min(Math.round(totalBonus/POOL_BUDGET*100),100)}%;background:${totalBonus<=POOL_BUDGET?'var(--success)':'var(--danger)'};border-radius:5px;transition:width .3s"></div>
          </div>
        </div>

        <!-- Dept filter -->
        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-xs ${filter==='all'?'btn-primary':'btn-secondary'} dept-btn" data-d="all">ทั้งหมด</button>
          ${depts.map(d=>`<button class="btn btn-xs ${filter===d?'btn-primary':'btn-secondary'} dept-btn" data-d="${d}">${d}</button>`).join('')}
        </div>

        <!-- Staff cards -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(s => `
            <div class="card" style="padding:14px">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;font-weight:700;flex-shrink:0">
                  ${kpiGrade(s.kpi)}
                </div>
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:700;font-size:0.86rem">${s.name}</span>
                    <span style="font-size:0.68rem;color:var(--text-muted)">${s.role} · ${s.dept}</span>
                    ${s.paid?`<span style="font-size:0.6rem;background:var(--success);color:#fff;padding:1px 6px;border-radius:8px">✅ จ่ายแล้ว</span>`:''}
                  </div>
                  <div style="display:flex;gap:12px;margin-top:5px">
                    <div>
                      <div style="font-size:0.62rem;color:var(--text-muted)">KPI Score</div>
                      <div style="font-weight:700;color:${kpiColor(s.kpi)};font-size:0.86rem">${s.kpi}%</div>
                    </div>
                    <div>
                      <div style="font-size:0.62rem;color:var(--text-muted)">เงินเดือน</div>
                      <div style="font-size:0.82rem">${formatCurrency(s.base)}</div>
                    </div>
                    <div>
                      <div style="font-size:0.62rem;color:var(--text-muted)">Multiplier</div>
                      <div style="font-size:0.82rem">${s.multiplier}x</div>
                    </div>
                    <div>
                      <div style="font-size:0.62rem;color:var(--text-muted)">Bonus</div>
                      <div style="font-size:1rem;font-weight:900;color:var(--primary)">${formatCurrency(s.bonus)}</div>
                    </div>
                  </div>
                  <!-- KPI bar -->
                  <div style="height:4px;background:var(--surface-2);border-radius:2px;margin-top:6px;overflow:hidden">
                    <div style="height:100%;width:${s.kpi}%;background:${kpiColor(s.kpi)};border-radius:2px"></div>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  ${!s.paid?`<button class="btn btn-xs btn-primary pay-btn" data-id="${s.id}" style="font-size:0.7rem">💸 จ่าย</button>`:''}
                  <button class="btn btn-xs btn-secondary edit-btn" data-id="${s.id}" style="font-size:0.7rem">✏️ แก้ไข</button>
                </div>
              </div>
            </div>`).join('')}
          ${!rows.length ? `<div class="empty-state"><div class="empty-icon">🎁</div><div class="empty-title">ไม่มีรายการ</div></div>` : ''}
        </div>
      </div>`

    container.querySelectorAll('.dept-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.d; render() }))
    document.getElementById('recalc-btn')?.addEventListener('click', () => { staff.forEach(s => s.bonus = calcBonus(s)); render(); showToast('🔄 คำนวณ Bonus ใหม่แล้ว', 'success') })
    document.getElementById('approve-all-btn')?.addEventListener('click', () => {
      openModal({ title:'✅ อนุมัติ Bonus ทั้งหมด', size:'xs',
        body:`<div style="font-size:0.8rem">อนุมัติ Bonus รวม <b>${formatCurrency(totalBonus)}</b> สำหรับพนักงาน ${staff.length} คน ใช่ไหม?</div>`,
        confirmText:'✅ ยืนยันอนุมัติ',
        async onConfirm() {
          for (const s of staff) { if (!s.paid) await updateDocData('bonus_pool_staff', s.id, { paid: true }) }
          showToast('✅ อนุมัติ Bonus ทั้งหมดแล้ว', 'success'); await loadData()
        }
      })
    })
    container.querySelectorAll('.pay-btn').forEach(b => b.addEventListener('click', async () => {
      const s = staff.find(x => x.id === b.dataset.id)
      if (!s) return
      await updateDocData('bonus_pool_staff', s.id, { paid: true })
      showToast(`💸 จ่าย Bonus ${s.name} ${formatCurrency(s.bonus)} แล้ว`, 'success'); await loadData()
    }))
    container.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => {
      const s = staff.find(x => x.id === b.dataset.id)
      if (s) openEditModal(s)
    }))
  }

  function openEditModal(s) {
    openModal({
      title:`✏️ ปรับ Bonus — ${s.name}`, size:'xs',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">KPI Score (%)</label>
          <input class="input" id="kpi-val" type="number" value="${s.kpi}" min="0" max="100" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">Multiplier</label>
          <input class="input" id="mult-val" type="number" value="${s.multiplier}" min="0" max="5" step="0.5" style="width:100%;margin-top:4px"></div>
        <div style="font-size:0.72rem;color:var(--text-muted)">Bonus จะถูกคำนวณใหม่อัตโนมัติ</div>
      </div>`,
      confirmText:'💾 บันทึก',
      async onConfirm() {
        const kpi = Math.max(0, Math.min(100, parseInt(document.getElementById('kpi-val')?.value) || s.kpi))
        const multiplier = parseFloat(document.getElementById('mult-val')?.value) || s.multiplier
        const bonus = calcBonus({ ...s, kpi, multiplier })
        await updateDocData('bonus_pool_staff', s.id, { kpi, multiplier })
        showToast(`💾 ปรับ Bonus ${s.name} เป็น ${formatCurrency(bonus)} แล้ว`, 'success')
        await loadData()
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
