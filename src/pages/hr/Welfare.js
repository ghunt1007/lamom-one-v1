import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

const CATEGORIES = ['ประกัน','กองทุน','สุขภาพ','สิทธิพิเศษ']
const CAT_ICONS = { 'ประกัน':'🛡','กองทุน':'🏦','สุขภาพ':'🏥','สิทธิพิเศษ':'⭐' }
const CAT_COLORS = { 'ประกัน':'danger','กองทุน':'primary','สุขภาพ':'success','สิทธิพิเศษ':'warning' }

export default async function WelfarePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let items = []
  let filterCat = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { items = await listDocs('welfare_items', [], 'name', 'asc', 200) } catch (e) { items = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function welfareCard(w) {
    const enrollPct = Math.round(w.enrolled / w.eligible * 100)
    const pctColor = enrollPct >= 90 ? 'var(--success)' : enrollPct >= 70 ? 'var(--warning)' : 'var(--danger)'
    const catIcon = CAT_ICONS[w.category] || '📋'
    const catColor = CAT_COLORS[w.category] || 'primary'
    const costStr = w.cost > 0 ? '฿' + w.cost.toLocaleString() + '/' + w.period : 'ไม่มีค่าใช้จ่าย'
    return `<div class="card card-lift" style="padding:14px;border-top:3px solid var(--${catColor});cursor:pointer" data-wid="${w.id}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:1.6rem;flex-shrink:0">${catIcon}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:0.86rem">${w.name}</span>
            <span class="badge badge-${catColor}" style="font-size:0.6rem">${w.category}</span>
            ${w.active
              ? '<span style="font-size:0.62rem;background:var(--success);color:#fff;padding:1px 7px;border-radius:8px">เปิดใช้</span>'
              : '<span style="font-size:0.62rem;background:var(--surface-2);padding:1px 7px;border-radius:8px;color:var(--text-muted)">ปิด</span>'}
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">
            ${w.provider} · ความคุ้มครอง: <strong>${w.coverage}</strong> · ${costStr}
          </div>
          <div style="margin-bottom:4px">
            <div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-bottom:3px">
              <span style="color:var(--text-muted)">ลงทะเบียน ${w.enrolled}/${w.eligible} คน</span>
              <span style="color:${pctColor};font-weight:700">${enrollPct}%</span>
            </div>
            <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${enrollPct}%;background:${pctColor};border-radius:3px;transition:width .4s"></div>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
          <button class="btn btn-xs btn-secondary edit-welfare" data-wid="${w.id}" title="แก้ไข" onclick="event.stopPropagation()">✏️</button>
          <button class="btn btn-xs btn-danger del-welfare" data-wid="${w.id}" title="ลบ" onclick="event.stopPropagation()">🗑</button>
        </div>
      </div>
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const rows = filterCat === 'all' ? items : items.filter(w => w.category === filterCat)
    const totalItems    = items.filter(w => w.active).length
    const totalCostYear = items.filter(w => w.active && w.cost > 0).reduce((s, w) => s + w.cost * w.enrolled, 0)
    const avgEnroll     = items.length ? Math.round(items.reduce((s, w) => s + (w.enrolled / w.eligible * 100), 0) / items.length) : 0

    const catBtns = ['all', ...CATEGORIES].map(c => {
      const lbl = c === 'all' ? 'ทั้งหมด' : (CAT_ICONS[c] || '') + ' ' + c
      return `<button class="btn btn-xs ${filterCat === c ? 'btn-primary' : 'btn-secondary'} cat-btn" data-c="${c}">${lbl}</button>`
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎁 Employee Welfare</div>
            <div class="page-subtitle">สวัสดิการพนักงาน · ${items.length} รายการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-welfare-btn">➕ เพิ่มสวัสดิการ</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🎁 สวัสดิการทั้งหมด', totalItems + ' รายการ', 'var(--primary)')}
          ${sc('💰 ค่าใช้จ่ายรวม/ปี', '฿' + totalCostYear.toLocaleString(), 'var(--warning)')}
          ${sc('📊 Avg ลงทะเบียน', avgEnroll + '%', avgEnroll >= 80 ? 'var(--success)' : 'var(--warning)')}
          ${sc('👥 พนักงาน', '28 คน', 'var(--primary)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${catBtns}</div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map(w => welfareCard(w)).join('')}
          ${rows.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--text-muted)">ไม่พบรายการ</div>' : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => { filterCat = b.dataset.c; render() }))

    container.querySelectorAll('[data-wid]').forEach(card => {
      if (!card.classList.contains('btn')) card.addEventListener('click', () => openDetailModal(card.dataset.wid))
    })

    container.querySelectorAll('.edit-welfare').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation()
      openWelfareModal(items.find(w => w.id === b.dataset.wid))
    }))

    container.querySelectorAll('.del-welfare').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation()
      const w = items.find(x => x.id === b.dataset.wid)
      const ok = await confirmDialog({ title: '🗑 ลบสวัสดิการ', message: `ลบ "${w.name}" ออกจากระบบ?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      await softDelete('welfare_items', b.dataset.wid)
      showToast('🗑 ลบแล้ว', 'warning')
      await loadData()
    }))

    document.getElementById('add-welfare-btn')?.addEventListener('click', () => openWelfareModal(null))
  }

  function openDetailModal(id) {
    const w = items.find(x => x.id === id)
    if (!w) return
    const catColor = CAT_COLORS[w.category] || 'primary'
    const enrollPct = Math.round(w.enrolled / w.eligible * 100)
    const costYear = w.cost > 0 ? w.cost * w.enrolled : 0

    openModal({
      title: `${CAT_ICONS[w.category] || '📋'} ${w.name}`,
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge badge-${catColor}">${w.category}</span>
            ${w.active ? '<span class="badge badge-success">เปิดใช้งาน</span>' : '<span class="badge badge-secondary">ปิดใช้งาน</span>'}
          </div>

          <div class="card" style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${drow('🏢 ผู้ให้บริการ', w.provider)}
            ${drow('💎 ความคุ้มครอง', w.coverage)}
            ${drow('💰 ค่าใช้จ่าย', w.cost > 0 ? '฿' + w.cost.toLocaleString() + '/' + w.period : 'ไม่มีค่าใช้จ่าย')}
            ${drow('📅 รอบชำระ', w.period)}
            ${drow('💸 ต้นทุนรวม/ปี', costYear > 0 ? '฿' + costYear.toLocaleString() : 'ไม่มี')}
            ${drow('🔖 รหัส', w.id)}
          </div>

          <div>
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">👥 การลงทะเบียน</div>
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
              <span>${w.enrolled} / ${w.eligible} คน ลงทะเบียนแล้ว</span>
              <strong style="color:${enrollPct>=90?'var(--success)':enrollPct>=70?'var(--warning)':'var(--danger)'}">${enrollPct}%</strong>
            </div>
            <div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">
              <div style="height:100%;width:${enrollPct}%;background:var(--${enrollPct>=90?'success':enrollPct>=70?'warning':'danger'});border-radius:5px"></div>
            </div>
            ${enrollPct < 100 ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">⚠️ ยังมีพนักงานอีก ${w.eligible - w.enrolled} คนที่ยังไม่ลงทะเบียน</div>` : ''}
          </div>

          ${!w.active ? `<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.76rem;color:var(--text-muted);text-align:center">🔴 สวัสดิการนี้ถูกปิดใช้งาน</div>` : ''}
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay')?.remove()">ปิด</button>
        <button class="btn btn-primary" id="detail-edit-btn">✏️ แก้ไข</button>
      `
    })
    document.getElementById('detail-edit-btn')?.addEventListener('click', () => {
      document.querySelector('.modal-overlay')?.remove()
      openWelfareModal(w)
    })
  }

  function openWelfareModal(w) {
    const isEdit = !!w
    openModal({
      title: isEdit ? `✏️ แก้ไข: ${w.name}` : '➕ เพิ่มสวัสดิการใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อสวัสดิการ *</label><input class="input" id="wf-name" value="${w?.name || ''}"></div>
          <div class="input-group">
            <label class="input-label">หมวดหมู่</label>
            <select class="input" id="wf-cat">${CATEGORIES.map(c => `<option ${w?.category===c?'selected':''}>${c}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ผู้ให้บริการ</label><input class="input" id="wf-provider" value="${w?.provider || ''}"></div>
          <div class="input-group"><label class="input-label">ความคุ้มครอง / สิทธิ์</label><input class="input" id="wf-coverage" value="${w?.coverage || ''}"></div>
          <div class="input-group">
            <label class="input-label">รอบชำระ</label>
            <select class="input" id="wf-period">${['รายปี','รายเดือน','รายไตรมาส','ครั้งเดียว'].map(p=>`<option ${w?.period===p?'selected':''}>${p}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ค่าใช้จ่าย/คน (บาท) — 0 = ฟรี</label><input class="input" type="number" id="wf-cost" value="${w?.cost ?? 0}" min="0"></div>
          <div class="input-group"><label class="input-label">สิทธิ์ (พนักงาน)</label><input class="input" type="number" id="wf-eligible" value="${w?.eligible ?? 28}" min="1"></div>
          <div class="input-group"><label class="input-label">ลงทะเบียนแล้ว</label><input class="input" type="number" id="wf-enrolled" value="${w?.enrolled ?? 0}" min="0"></div>
          <div class="input-group" style="grid-column:1/-1;display:flex;align-items:center;gap:10px">
            <input type="checkbox" id="wf-active" ${(!isEdit || w?.active) ? 'checked' : ''} style="accent-color:var(--primary);width:16px;height:16px">
            <label for="wf-active" style="font-size:0.84rem;cursor:pointer">เปิดใช้งาน</label>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay')?.remove()">ยกเลิก</button>
               <button class="btn btn-primary" id="wf-save">💾 บันทึก</button>`
    })
    document.getElementById('wf-save')?.addEventListener('click', async () => {
      const name = document.getElementById('wf-name').value.trim()
      if (!name) { showToast('⚠️ กรุณากรอกชื่อสวัสดิการ', 'warning'); return }
      const data = {
        name,
        category: document.getElementById('wf-cat').value,
        provider:  document.getElementById('wf-provider').value.trim(),
        coverage:  document.getElementById('wf-coverage').value.trim(),
        period:    document.getElementById('wf-period').value,
        cost:      parseFloat(document.getElementById('wf-cost').value) || 0,
        eligible:  parseInt(document.getElementById('wf-eligible').value) || 1,
        enrolled:  parseInt(document.getElementById('wf-enrolled').value) || 0,
        active:    document.getElementById('wf-active').checked,
      }
      if (isEdit) await updateDocData('welfare_items', w.id, data)
      else await createDoc('welfare_items', data)
      document.querySelector('.modal-overlay')?.remove()
      showToast(isEdit ? '✅ แก้ไขสวัสดิการแล้ว' : '✅ เพิ่มสวัสดิการแล้ว', 'success')
      await loadData()
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  function drow(l, v) {
    return `<div><div style="font-size:0.68rem;color:var(--text-muted)">${l}</div><div style="font-size:0.8rem;font-weight:600">${v}</div></div>`
  }

  await loadData()
}
