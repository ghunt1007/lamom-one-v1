import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default async function BranchSettingsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let branches = []
  let companies = []
  let tab = 'branches'
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [b, c] = await Promise.all([
        listDocs('branches', [], 'name', 'asc', 200),
        listDocs('companies', [], 'name', 'asc', 20),
      ])
      branches = b; companies = c
    } catch (e) { branches = []; companies = [] }
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
            <div class="page-title">🏢 Multi-Branch Settings</div>
            <div class="page-subtitle">จัดการสาขาและบริษัท</div>
          </div>
          <div class="page-actions">
            ${tab === 'branches' ? `<button class="btn btn-primary" id="new-branch-btn">➕ เพิ่มสาขา</button>` : ''}
            ${tab === 'company' ? `<button class="btn btn-primary" id="edit-company-btn">✏️ แก้ไขข้อมูล</button>` : ''}
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <button class="btn btn-sm ${tab==='branches'?'btn-primary':'btn-secondary'} tab-btn" data-t="branches">🏪 สาขาทั้งหมด</button>
          <button class="btn btn-sm ${tab==='company'?'btn-primary':'btn-secondary'} tab-btn" data-t="company">🏢 ข้อมูลบริษัท</button>
          <button class="btn btn-sm ${tab==='pdpa'?'btn-primary':'btn-secondary'} tab-btn" data-t="pdpa">🔒 PDPA</button>
        </div>

        ${tab === 'branches' ? renderBranches() : tab === 'company' ? renderCompany() : renderPdpa()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('new-branch-btn')?.addEventListener('click', () => openBranchForm())
    document.getElementById('edit-company-btn')?.addEventListener('click', () => openCompanyForm(companies[0]))
    document.querySelectorAll('.edit-branch-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); const b = branches.find(x => x.id === btn.dataset.id); if (b) openBranchForm(b) })
    })
    document.querySelectorAll('.del-branch-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const b = branches.find(x => x.id === btn.dataset.id)
        if (b?.isMain) return showToast('❗ ไม่สามารถลบสาขาหลักได้', 'warning')
        const ok = await confirmDialog({ title:'🗑 ลบสาขา', message:`ลบ "${b?.name}" ออกจากระบบ?`, confirmText:'ลบ', danger:true })
        if (!ok) return
        try { await softDelete('branches', btn.dataset.id) } catch (e) { showToast('ลบไม่สำเร็จ', 'error'); return }
        showToast('🗑 ลบแล้ว', 'success')
        if (container.__routerGen !== myGen) return
        await loadData()
      })
    })
  }

  function renderBranches() {
    const activeBranches = branches.filter(b => b.status === 'active').length
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
        ${branches.map(b => `
          <div class="card" style="padding:16px;position:relative;${b.isMain?'border:1px solid var(--primary);':b.status==='planned'?'opacity:0.7':''}">
            ${b.isMain ? `<span class="badge badge-primary" style="position:absolute;top:12px;right:12px;font-size:0.65rem">สาขาหลัก</span>` : ''}
            ${b.status === 'planned' ? `<span class="badge badge-primary" style="position:absolute;top:12px;right:12px;font-size:0.65rem">วางแผน</span>` : ''}
            <div style="margin-bottom:10px">
              <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px">${b.name}</div>
              <div style="font-size:0.72rem;font-family:monospace;color:var(--text-muted)">[${b.code}]</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">
              <div>📍 ${b.address}</div>
              <div>📞 ${b.phone}</div>
              <div>📧 ${b.email}</div>
              ${b.manager ? `<div>👤 ผู้จัดการ: ${b.manager}</div>` : ''}
              <div>👥 พนักงาน: ${b.staff} คน</div>
              <div>🚗 แบรนด์: ${b.brands.join(', ')}</div>
            </div>
            <div style="display:flex;gap:6px;padding-top:10px;border-top:1px solid var(--border)">
              <button class="btn btn-xs btn-secondary edit-branch-btn" data-id="${b.id}">✏️ แก้ไข</button>
              ${!b.isMain ? `<button class="btn btn-xs btn-danger del-branch-btn" data-id="${b.id}">🗑</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  function renderCompany() {
    const c = companies[0] || {}
    return `
      <div class="card" style="padding:20px;max-width:600px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
          <div style="width:64px;height:64px;border-radius:var(--radius-md);background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-size:2rem">🏢</div>
          <div>
            <div style="font-size:1.1rem;font-weight:700">${c.name||'-'}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">เลขที่ผู้เสียภาษี: ${c.taxId||'-'}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:0.85rem">
          <div><span style="color:var(--text-muted)">📍 ที่อยู่:</span> ${c.address||'-'}</div>
          <div><span style="color:var(--text-muted)">📞 โทรศัพท์:</span> ${c.phone||'-'}</div>
          <div><span style="color:var(--text-muted)">📧 อีเมล:</span> ${c.email||'-'}</div>
        </div>
      </div>
    `
  }

  function renderPdpa() {
    return `
      <div style="max-width:600px;display:flex;flex-direction:column;gap:12px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:10px">🔒 PDPA Settings</div>
          ${[
            ['เก็บข้อมูลลูกค้าพร้อมคำยินยอม', true],
            ['แสดง Privacy Policy ก่อนลงทะเบียน', true],
            ['ให้สิทธิ์ลูกค้าลบข้อมูลตนเอง', true],
            ['บันทึก Log การเข้าถึงข้อมูล', true],
            ['เข้ารหัสข้อมูลส่วนบุคคล', true],
            ['ส่งข้อมูลให้บุคคลที่สาม', false],
          ].map(([label, active]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:0.85rem">${label}</span>
              <span style="font-size:0.85rem;color:var(--${active?'success':'danger'})">${active?'✅ เปิดใช้':'❌ ปิด'}</span>
            </div>
          `).join('')}
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:10px">📋 Data Retention Policy</div>
          ${[['ข้อมูลลูกค้า','7 ปี'],['Log ระบบ','90 วัน'],['ข้อมูลการเงิน','10 ปี'],['ภาพถ่าย/เอกสาร','5 ปี']].map(([k,v]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem">
              <span style="color:var(--text-muted)">${k}</span><span style="font-weight:600">${v}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function openBranchForm(branch = null) {
    const { el, close } = openModal({
      title: branch ? '✏️ แก้ไขสาขา' : '🏪 เพิ่มสาขาใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ชื่อสาขา *</label><input class="input" id="br-name" value="${branch?.name||''}" placeholder="ชื่อสาขา"></div>
          <div class="input-group"><label class="input-label">รหัสสาขา</label><input class="input" id="br-code" value="${branch?.code||''}" placeholder="BKK-001"></div>
        </div>
        <div class="input-group"><label class="input-label">ที่อยู่</label><textarea class="input" id="br-addr" rows="2">${escHtml(branch?.address||'')}</textarea></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="br-phone" value="${branch?.phone||''}" placeholder="0x-xxx-xxxx"></div>
          <div class="input-group"><label class="input-label">อีเมล</label><input class="input" id="br-email" value="${branch?.email||''}" placeholder="branch@email.com"></div>
        </div>
        <div class="input-group"><label class="input-label">ผู้จัดการสาขา</label><input class="input" id="br-mgr" value="${branch?.manager||''}" placeholder="ชื่อผู้จัดการ"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="br-c">ยกเลิก</button><button class="btn btn-primary" id="br-s">💾 บันทึก</button>`
    })
    el.querySelector('#br-c').addEventListener('click', close)
    el.querySelector('#br-s').addEventListener('click', async () => {
      const name = el.querySelector('#br-name').value.trim()
      if (!name) return showToast('❗ กรุณาใส่ชื่อสาขา', 'warning')
      const data = { name, code: el.querySelector('#br-code').value, address: el.querySelector('#br-addr').value, phone: el.querySelector('#br-phone').value, email: el.querySelector('#br-email').value, manager: el.querySelector('#br-mgr').value }
      try {
        if (branch) await updateDocData('branches', branch.id, data)
        else await createDoc('branches', { ...data, brands:[], status:'active', staff:0, isMain:false })
        showToast('💾 บันทึกแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openCompanyForm(c) {
    const { el, close } = openModal({
      title: '🏢 แก้ไขข้อมูลบริษัท', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อบริษัท *</label><input class="input" id="co-name" value="${c?.name||''}"></div>
        <div class="input-group"><label class="input-label">เลขที่ผู้เสียภาษี</label><input class="input" id="co-tax" value="${c?.taxId||''}"></div>
        <div class="input-group"><label class="input-label">ที่อยู่</label><textarea class="input" id="co-addr" rows="2">${escHtml(c?.address||'')}</textarea></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="co-phone" value="${c?.phone||''}"></div>
          <div class="input-group"><label class="input-label">อีเมล</label><input class="input" id="co-email" value="${c?.email||''}"></div>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="co-c">ยกเลิก</button><button class="btn btn-primary" id="co-s">💾 บันทึก</button>`
    })
    el.querySelector('#co-c').addEventListener('click', close)
    el.querySelector('#co-s').addEventListener('click', async () => {
      if (!c) { close(); return }
      const data = { name: el.querySelector('#co-name').value, taxId: el.querySelector('#co-tax').value, address: el.querySelector('#co-addr').value, phone: el.querySelector('#co-phone').value, email: el.querySelector('#co-email').value }
      try {
        await updateDocData('companies', c.id, data)
        showToast('💾 บันทึกแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}
