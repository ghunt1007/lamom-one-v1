/**
 * Manage Companies — จัดการรายชื่อบริษัทในเครือ (รองรับ 1 user ทำงานหลายบริษัท)
 * Route: /settings/org-companies
 * คนละแนวคิดกับ "companies" (ลูกค้าองค์กร B2B) และ "company_profile" (โปรไฟล์บริษัทเดี่ยวเดิม)
 * — นี่คือรายชื่อนิติบุคคลจริงของเจ้าของระบบเอง ใช้ผูกกับ companyMemberships ของ user แต่ละคน
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default async function OrgCompaniesPage(container) {
  const myGen = container.__routerGen
  let companies = []
  let loading = true

  async function loadData() {
    loading = true
    try { companies = (await listDocs('org_companies', [], 'name', 'asc', 50)).filter(c => !c.deleted) } catch (e) { companies = [] }
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
            <div class="page-title">🏢 Manage Companies</div>
            <div class="page-subtitle">จัดการรายชื่อบริษัทในเครือ — ใช้ผูกกับพนักงานที่หน้า User Management (รองรับ 1 คนทำงานหลายบริษัท)</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-co-btn">➕ เพิ่มบริษัท</button>
          </div>
        </div>

        ${!companies.length ? `
          <div class="empty-state">
            <div class="empty-icon">🏢</div>
            <div class="empty-title">ยังไม่มีบริษัทในระบบ</div>
            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:6px">กด "+ เพิ่มบริษัท" เพื่อเริ่มต้น เช่น แต่ละแบรนด์ที่แยกเป็นนิติบุคคล หรือบริษัทศูนย์สีที่แยกต่างหาก</div>
          </div>
        ` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${companies.map(c => `
            <div class="card" style="padding:16px;${c.active===false?'opacity:0.6':''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.95rem">${escHtml(c.name)}</div>
                  ${c.brand ? `<div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(c.brand)}</div>` : ''}
                </div>
                <span class="badge badge-${c.active===false?'secondary':'success'}" style="font-size:0.62rem">${c.active===false?'ปิดใช้งาน':'ใช้งานอยู่'}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">
                ${c.taxId ? `<div>🧾 เลขผู้เสียภาษี: ${escHtml(c.taxId)}</div>` : ''}
                ${c.address ? `<div>📍 ${escHtml(c.address)}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px;padding-top:10px;border-top:1px solid var(--border)">
                <button class="btn btn-xs btn-secondary edit-co-btn" data-id="${c.id}">✏️ แก้ไข</button>
                <button class="btn btn-xs btn-danger del-co-btn" data-id="${c.id}">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>`}
      </div>
    `

    document.getElementById('new-co-btn')?.addEventListener('click', () => openCoForm())
    document.querySelectorAll('.edit-co-btn').forEach(btn => {
      btn.addEventListener('click', () => { const c = companies.find(x => x.id === btn.dataset.id); if (c) openCoForm(c) })
    })
    document.querySelectorAll('.del-co-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const c = companies.find(x => x.id === btn.dataset.id)
        const ok = await confirmDialog({ title: '🗑 ลบบริษัท', message: `ลบ "${c?.name}" ออกจากระบบ? พนักงานที่ผูกกับบริษัทนี้อยู่จะยังคงมี reference ค้างอยู่ ต้องไปแก้ไขที่ User Management เอง`, confirmText: 'ลบ', danger: true })
        if (!ok) return
        try { await softDelete('org_companies', btn.dataset.id); showToast('🗑 ลบแล้ว', 'success'); await loadData() }
        catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
      })
    })
  }

  function openCoForm(c) {
    const { el, close } = openModal({
      title: c ? '✏️ แก้ไขบริษัท' : '➕ เพิ่มบริษัทใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อบริษัท *</label><input class="input" id="co-name" value="${escHtml(c?.name||'')}" placeholder="เช่น BYD Bangna Co., Ltd."></div>
        <div class="input-group"><label class="input-label">แบรนด์/ธุรกิจ</label><input class="input" id="co-brand" value="${escHtml(c?.brand||'')}" placeholder="เช่น BYD, ศูนย์สี"></div>
        <div class="input-group"><label class="input-label">เลขที่ผู้เสียภาษี</label><input class="input" id="co-tax" value="${escHtml(c?.taxId||'')}"></div>
        <div class="input-group"><label class="input-label">ที่อยู่</label><textarea class="input" id="co-addr" rows="2">${escHtml(c?.address||'')}</textarea></div>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer">
          <input type="checkbox" id="co-active" ${c?.active === false ? '' : 'checked'} style="accent-color:var(--primary)"> ใช้งานอยู่
        </label>
      </div>`,
      footer: `<button class="btn btn-secondary" id="co-c">ยกเลิก</button><button class="btn btn-primary" id="co-s">💾 บันทึก</button>`
    })
    el.querySelector('#co-c').addEventListener('click', close)
    el.querySelector('#co-s').addEventListener('click', async () => {
      const name = el.querySelector('#co-name').value.trim()
      if (!name) { showToast('❗ กรุณาใส่ชื่อบริษัท', 'warning'); return }
      const data = {
        name,
        brand: el.querySelector('#co-brand').value.trim(),
        taxId: el.querySelector('#co-tax').value.trim(),
        address: el.querySelector('#co-addr').value.trim(),
        active: el.querySelector('#co-active').checked,
      }
      try {
        if (c) await updateDocData('org_companies', c.id, data)
        else await createDoc('org_companies', data)
        showToast('💾 บันทึกแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}
