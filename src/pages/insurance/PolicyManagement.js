/**
 * Policy Management — ติดตามกรมธรรม์ประกันภัย แจ้งเตือนต่ออายุ
 * Route: /insurance/policy
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function daysLeft(endDate) {
  return Math.round((new Date(endDate) - new Date()) / 86400000)
}

function statusBadge(s) {
  const m = { active:{l:'มีผล',c:'var(--success)'}, expiring:{l:'ใกล้หมด',c:'var(--warning)'}, expired:{l:'หมดอายุ',c:'var(--danger)'} }
  const x = m[s] || { l: s, c: 'var(--text-muted)' }
  return '<span style="font-size:0.62rem;padding:2px 8px;border-radius:6px;background:' + x.c + '22;color:' + x.c + ';font-weight:700">' + x.l + '</span>'
}

function policyRow(p) {
  const days = daysLeft(p.endDate)
  const daysLabel = days < 0 ? 'หมดแล้ว ' + Math.abs(days) + ' วัน' : 'เหลือ ' + days + ' วัน'
  const daysColor = days <= 0 ? 'var(--danger)' : days <= 30 ? 'var(--warning)' : 'var(--success)'
  return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
    '<td style="padding:8px 10px">' +
      '<div style="font-size:0.76rem;font-weight:600">' + escHtml(p.plate) + '</div>' +
      '<div style="font-size:0.62rem;color:var(--text-muted)">' + escHtml(p.model) + '</div>' +
    '</td>' +
    '<td style="padding:8px 10px;font-size:0.74rem">' + escHtml(p.customer) + '</td>' +
    '<td style="padding:8px 10px">' +
      '<div style="font-size:0.74rem;font-weight:600">' + escHtml(p.insurer) + '</div>' +
      '<div style="font-size:0.62rem;color:var(--text-muted)">' + escHtml(p.type) + '</div>' +
    '</td>' +
    '<td style="padding:8px 10px;font-weight:700;font-size:0.8rem;color:var(--success)">฿' + (p.premium||0).toLocaleString() + '</td>' +
    '<td style="padding:8px 10px">' +
      '<div style="font-size:0.72rem">' + p.endDate + '</div>' +
      '<div style="font-size:0.64rem;font-weight:700;color:' + daysColor + '">' + daysLabel + '</div>' +
    '</td>' +
    '<td style="padding:8px 10px">' + statusBadge(p.status) + '</td>' +
    '<td style="padding:8px 10px;white-space:nowrap">' +
      '<button class="btn btn-sm btn-secondary renew-btn" data-id="' + p.id + '">ต่ออายุ</button> ' +
      '<button class="btn btn-sm btn-ghost del-btn" data-id="' + p.id + '" title="ลบ">🗑️</button>' +
    '</td>' +
  '</tr>'
}

export default async function PolicyManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let policies = []
  let filter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { policies = await listDocs('policy_renewals', [], 'endDate', 'asc', 500) } catch (e) { policies = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const filtered = filter === 'all' ? policies : policies.filter(p => p.status === filter)
    const active = policies.filter(p => p.status === 'active').length
    const expiring = policies.filter(p => p.status === 'expiring').length
    const expired = policies.filter(p => p.status === 'expired').length
    const totalPremium = policies.filter(p => p.status !== 'expired').reduce((s, p) => s + (p.premium||0), 0)

    const filterBtns = [['all','ทั้งหมด'],['active','มีผล'],['expiring','ใกล้หมด'],['expired','หมดอายุ']].map(([k, l]) =>
      '<button class="btn btn-sm ' + (filter === k ? 'btn-primary' : 'btn-secondary') + ' filter-btn" data-f="' + k + '">' + l + '</button>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Policy Management</div>
            <div class="page-subtitle">ติดตามกรมธรรม์ประกันภัยทุกกรมธรรม์ · แจ้งเตือนต่ออายุ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-policy-btn">+ เพิ่มกรมธรรม์</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('✅ กรมธรรม์มีผล', active + ' ฉบับ', 'var(--success)')}
          ${sc('⚠️ ใกล้หมดอายุ', expiring + ' ฉบับ', 'var(--warning)')}
          ${sc('❌ หมดอายุ', expired + ' ฉบับ', 'var(--danger)')}
          ${sc('💰 เบี้ยรวม/ปี', '฿' + totalPremium.toLocaleString(), 'var(--primary)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        <div class="card" style="padding:0;overflow:hidden">
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">ทะเบียน / รุ่น</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">เจ้าของ</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">บริษัทประกัน</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">เบี้ยประกัน</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">วันหมดอายุ</th>
                  <th style="text-align:left;padding:10px;font-weight:600;color:var(--text-muted)">สถานะ</th>
                  <th style="padding:10px"></th>
                </tr>
              </thead>
              <tbody>${filtered.map(p => policyRow(p)).join('')}</tbody>
            </table>
            ${!filtered.length ? '<div class="empty-state" style="padding:32px"><div class="empty-icon">📋</div><div class="empty-title">ไม่มีกรมธรรม์</div></div>' : ''}
          </div>
        </div>
      </div>`

    container.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('.renew-btn').forEach(b => b.addEventListener('click', () => {
      const p = policies.find(x => x.id === b.dataset.id)
      if (!p) return
      openModal({
        title: '🔄 ต่ออายุกรมธรรม์ — ' + escHtml(p.plate),
        size: 'sm',
        body: '<div style="font-size:0.82rem">' +
          '<div style="margin-bottom:8px"><span style="color:var(--text-muted)">ลูกค้า:</span> ' + escHtml(p.customer) + '</div>' +
          '<div style="margin-bottom:8px"><span style="color:var(--text-muted)">รุ่น:</span> ' + escHtml(p.model) + '</div>' +
          '<div style="margin-bottom:8px"><span style="color:var(--text-muted)">บริษัทประกัน:</span> ' + escHtml(p.insurer) + '</div>' +
          '<div style="margin-bottom:8px"><span style="color:var(--text-muted)">ประเภท:</span> ' + escHtml(p.type) + '</div>' +
          '<div style="margin-bottom:8px"><span style="color:var(--text-muted)">เบี้ยปีที่แล้ว:</span> <span style="font-weight:700;color:var(--success)">฿' + (p.premium||0).toLocaleString() + '</span></div>' +
        '</div>',
        confirmText: 'ยืนยันต่ออายุ',
        onConfirm: async () => {
          const newEnd = new Date(p.endDate)
          newEnd.setFullYear(newEnd.getFullYear() + 1)
          const patch = { status: 'active', startDate: p.endDate, endDate: newEnd.toISOString().slice(0, 10) }
          await updateDocData('policy_renewals', p.id, patch)
          Object.assign(p, patch)
          showToast('✅ ต่ออายุกรมธรรม์ ' + p.plate + ' เรียบร้อย', 'success')
          render()
        }
      })
    }))
    container.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', async () => {
      const p = policies.find(x => x.id === b.dataset.id)
      if (!p) return
      const ok = await confirmDialog({ title: '🗑️ ลบกรมธรรม์', message: `ยืนยันลบกรมธรรม์ทะเบียน "${escHtml(p.plate)}" — ${escHtml(p.customer)}?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      await softDelete('policy_renewals', p.id)
      showToast('🗑️ ลบแล้ว', 'success')
      await loadData()
    }))
    document.getElementById('add-policy-btn')?.addEventListener('click', openAddPolicyModal)
  }

  function openAddPolicyModal() {
    const today = new Date().toISOString().slice(0, 10)
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10)
    openModal({
      title: '📋 เพิ่มกรมธรรม์ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ทะเบียนรถ *</label><input id="p-plate" class="input" placeholder="กก 1234 กทม"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่นรถ</label><input id="p-model" class="input" placeholder="BYD Atto 3"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อลูกค้า/บริษัท *</label><input id="p-customer" class="input" placeholder="คุณ... / บริษัท..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">บริษัทประกัน *</label><input id="p-insurer" class="input" placeholder="วิริยะ / AXA..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภทประกัน</label>
              <select id="p-type" class="input">
                ${['ชั้น 1','ชั้น 2+','ชั้น 3+','ชั้น 3'].map(t=>`<option>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">เบี้ยประกัน (฿)</label><input id="p-premium" type="number" class="input" placeholder="0"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วงเงินคุ้มครอง (฿)</label><input id="p-sum" type="number" class="input" placeholder="0"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันเริ่มต้น</label><input id="p-start" type="date" class="input" value="${today}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันหมดอายุ</label><input id="p-end" type="date" class="input" value="${nextYear}"></div>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="p-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('p-save')?.addEventListener('click', async () => {
      const plate = document.getElementById('p-plate')?.value.trim()
      const customer = document.getElementById('p-customer')?.value.trim()
      const insurer = document.getElementById('p-insurer')?.value.trim()
      if (!plate || !customer || !insurer) { showToast('⚠️ กรุณากรอกข้อมูลที่จำเป็น', 'warning'); return }
      await createDoc('policy_renewals', {
        plate, customer, insurer,
        model: document.getElementById('p-model')?.value.trim() || 'EV',
        type: document.getElementById('p-type')?.value || 'ชั้น 1',
        premium: parseFloat(document.getElementById('p-premium')?.value) || 0,
        sum: parseFloat(document.getElementById('p-sum')?.value) || 0,
        startDate: document.getElementById('p-start')?.value || today,
        endDate: document.getElementById('p-end')?.value || nextYear,
        status: 'active',
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ เพิ่มกรมธรรม์แล้ว', 'success')
      await loadData()
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
