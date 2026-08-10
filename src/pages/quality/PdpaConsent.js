/**
 * PDPA Consent — จัดการความยินยอมข้อมูลส่วนบุคคล
 * Route: /quality/pdpa
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
// createDoc นำเข้าไว้แล้วสำหรับ pdpa_dsr_requests เดิม — ใช้เพิ่มเติมกับ pdpa_consents ด้านล่าง (ดูปุ่ม "➕ เพิ่มลูกค้าในทะเบียน")

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// พบว่าหน้านี้ไม่มีการเช็คสิทธิ์เลย — ทุก role เห็น/แก้ไขความยินยอม PDPA + เบอร์โทรของลูกค้าทุกคนในระบบได้
// จำกัดให้เห็น/จัดการได้เฉพาะผู้บริหาร/ผู้จัดการ/แอดมินเท่านั้น (งาน compliance/PDPA ไม่ใช่งานพนักงานทั่วไป)
// (Firestore Rules บังคับจริงเช่นกัน — นี่แค่ป้องกันระดับ UI)
const PDPA_VIEW_ROLES = ['owner', 'admin', 'manager']

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const CONSENT_TYPES = {
  marketing: { label: 'การตลาด/โปรโมชั่น', icon: '📣' },
  analytics: { label: 'วิเคราะห์พฤติกรรม', icon: '📊' },
  third_party: { label: 'แชร์ให้พาร์ทเนอร์ (ประกัน/ไฟแนนซ์)', icon: '🤝' },
  service: { label: 'แจ้งเตือนบริการ (จำเป็น)', icon: '🔧' },
}

const DSR_STATUS = {
  pending:    { label: 'รอดำเนินการ', color: 'warning', icon: '⏳' },
  processing: { label: 'กำลังทำ', color: 'primary', icon: '🔄' },
  done:       { label: 'เสร็จแล้ว', color: 'success', icon: '✅' },
}

export default async function PdpaConsentPage(container) {
  const myGen = container.__routerGen
  const myRole = getState('role') || getState('user')?.role || 'staff'
  if (!PDPA_VIEW_ROLES.includes(myRole)) {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="empty-state" style="padding:60px 20px">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>
          <div class="empty-desc">ข้อมูลความยินยอม PDPA + เบอร์โทรลูกค้าเปิดให้เฉพาะผู้บริหาร/ผู้จัดการ/แอดมิน — ติดต่อผู้ดูแลระบบหากต้องการสิทธิ์เข้าถึง</div>
        </div>
      </div>`
    return
  }
  seedDemoData()

  let consents = []
  let requests = []
  let search = ''
  let loading = true

  async function loadData() {
    loading = true
    try {
      consents = (await listDocs('pdpa_consents', [], 'updatedAt', 'desc', 300)).filter(c => !c.deleted)
      requests = await listDocs('pdpa_dsr_requests', [], 'deadline', 'asc', 100)
    } catch (e) { /* keep whatever loaded */ }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = consents.filter(c => search === '' || c.customer.toLowerCase().includes(search))
    const marketingOk = consents.filter(c => c.consents?.marketing).length
    const pendingDsr = requests.filter(r => r.status !== 'done').length
    const urgentDsr = requests.filter(r => r.status !== 'done' && r.deadline <= addDays(7))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔒 PDPA Consent</div>
            <div class="page-subtitle">ความยินยอมข้อมูลส่วนบุคคล + คำขอใช้สิทธิ (DSR)</div>
          </div>
          <button class="btn btn-primary" id="add-consent-btn">➕ เพิ่มลูกค้าในทะเบียน</button>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าในระบบ', consents.length, 'primary')}
          ${kpi('📣 ยินยอมการตลาด', marketingOk + '/' + consents.length, 'success')}
          ${kpi('📨 DSR ค้าง', pendingDsr, pendingDsr > 0 ? 'warning' : 'success')}
          ${kpi('⏰ ใกล้ครบ 30 วัน', urgentDsr.length, urgentDsr.length > 0 ? 'danger' : 'success')}
        </div>

        ${urgentDsr.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⏰ <strong>กฎหมายกำหนดตอบใน 30 วัน:</strong> ${urgentDsr.map(r => `${escHtml(r.customer)} (${escHtml(r.type)}) ครบกำหนด ${formatDate(r.deadline)}`).join(' · ')}
          </div>
        ` : ''}

        <!-- DSR Requests -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">📨 คำขอใช้สิทธิของเจ้าของข้อมูล (DSR)</div>
          <button class="btn btn-xs btn-primary" id="add-dsr-btn">➕ บันทึกคำขอ DSR</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${requests.map(r => {
            const rs = DSR_STATUS[r.status]
            return `<div class="card" style="padding:11px 14px;display:flex;justify-content:space-between;align-items:center;border-left:3px solid var(--${rs?.color})">
              <div>
                <div style="font-weight:600;font-size:0.83rem">${escHtml(r.customer)} — ${escHtml(r.type)}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">รับเรื่อง ${formatDate(r.received)} · ครบกำหนด ${formatDate(r.deadline)}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span class="badge badge-${rs?.color}" style="font-size:0.62rem">${rs?.icon} ${rs?.label}</span>
                ${r.status === 'pending' ? `<button class="btn btn-xs btn-primary start-dsr-btn" data-id="${r.id}">🔄 เริ่มทำ</button>` : ''}
                ${r.status === 'processing' ? `<button class="btn btn-xs btn-success done-dsr-btn" data-id="${r.id}">✅ เสร็จ</button>` : ''}
              </div>
            </div>`
          }).join('')}
          ${!requests.length ? `<div style="font-size:0.78rem;color:var(--text-muted)">ไม่มีคำขอ DSR</div>` : ''}
        </div>

        <!-- Consent matrix -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">✅ ทะเบียนความยินยอม</div>
          <input class="input" id="search-input" placeholder="ค้นหาลูกค้า..." value="${escHtml(search)}" style="width:180px;padding:5px 10px;font-size:0.78rem">
        </div>
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.7rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">ลูกค้า</th>
                ${Object.values(CONSENT_TYPES).map(t => `<th style="padding:8px 6px;text-align:center" title="${t.label}">${t.icon}</th>`).join('')}
                <th style="padding:8px 10px">อัปเดต</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(c => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px">
                    <div style="font-weight:600">${escHtml(c.customer)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">📞 ${escHtml(c.phone)} · ผ่าน ${escHtml(c.channel)}</div>
                  </td>
                  ${Object.keys(CONSENT_TYPES).map(k => `
                    <td style="padding:8px 6px;text-align:center">
                      <button class="consent-toggle" data-id="${c.id}" data-k="${k}" ${k==='service'?'disabled title="จำเป็นต่อการให้บริการ"':''} style="background:none;border:none;cursor:${k==='service'?'not-allowed':'pointer'};font-size:0.9rem">
                        ${c.consents?.[k] ? '✅' : '❌'}
                      </button>
                    </td>
                  `).join('')}
                  <td style="padding:8px 10px;font-size:0.68rem;color:var(--text-muted);text-align:center">${timeAgo(c.updatedAt)}</td>
                </tr>
              `).join('')}
              ${!list.length ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">ไม่พบข้อมูล</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;padding-left:4px">💡 คลิก ✅/❌ เพื่อบันทึกการเปลี่ยนความยินยอม (ต้องมีหลักฐานจากลูกค้า) · "แจ้งเตือนบริการ" เป็นฐานสัญญา ถอนไม่ได้</p>
      </div>
    `

    document.getElementById('search-input')?.addEventListener('input', e => { search = e.target.value.toLowerCase(); renderPage() })
    container.querySelectorAll('.consent-toggle:not([disabled])').forEach(b => b.addEventListener('click', async () => {
      const c = consents.find(x => x.id === b.dataset.id)
      if (!c) return
      const consents_ = { ...c.consents, [b.dataset.k]: !c.consents?.[b.dataset.k] }
      await updateDocData('pdpa_consents', c.id, { consents: consents_, updatedAt: new Date().toISOString() })
      showToast('🔒 บันทึกการเปลี่ยนความยินยอม (เก็บ log ตามกฎหมาย)', 'primary'); await loadData()
    }))
    container.querySelectorAll('.start-dsr-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('pdpa_dsr_requests', b.dataset.id, { status: 'processing' })
      await loadData()
    }))
    container.querySelectorAll('.done-dsr-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('pdpa_dsr_requests', b.dataset.id, { status: 'done' })
      showToast('✅ ปิดคำขอ DSR แล้ว — แจ้งลูกค้าทางอีเมล', 'success'); await loadData()
    }))
    document.getElementById('add-dsr-btn')?.addEventListener('click', openAddDsrForm)
    document.getElementById('add-consent-btn')?.addEventListener('click', openAddConsentForm)
  }

  function openAddConsentForm() {
    const { el, close } = openModal({
      title: '➕ เพิ่มลูกค้าในทะเบียนความยินยอม', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="nc-customer"><span class="input-error" id="nc-customer-e"></span></div>
        <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="nc-phone" placeholder="08xxxxxxxx"></div>
        <div class="input-group"><label class="input-label">ช่องทางที่ได้รับความยินยอม</label>
          <select class="input" id="nc-channel"><option>หน้าร้าน</option><option>LINE</option><option>เว็บไซต์</option><option>โทรศัพท์</option></select>
        </div>
        <div class="input-group">
          <label class="input-label">ความยินยอมเริ่มต้น</label>
          <div style="display:flex;flex-direction:column;gap:6px;padding:8px;background:var(--surface-2);border-radius:var(--radius-sm)">
            ${Object.entries(CONSENT_TYPES).map(([k, v]) => `<label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;cursor:${k==='service'?'not-allowed':'pointer'}"><input type="checkbox" class="nc-consent" value="${k}" ${k==='service' ? 'checked disabled' : ''}> ${v.icon} ${v.label}</label>`).join('')}
          </div>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ncc">ยกเลิก</button><button class="btn btn-primary" id="ncs">💾 บันทึก</button>`
    })
    el.querySelector('#ncc').addEventListener('click', close)
    el.querySelector('#ncs').addEventListener('click', async () => {
      const customer = el.querySelector('#nc-customer').value.trim()
      if (!customer) { el.querySelector('#nc-customer-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#ncs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const consentsObj = { service: true }
      Object.keys(CONSENT_TYPES).forEach(k => { if (k !== 'service') consentsObj[k] = false })
      el.querySelectorAll('.nc-consent:checked').forEach(c => { consentsObj[c.value] = true })
      try {
        await createDoc('pdpa_consents', {
          customer,
          phone: el.querySelector('#nc-phone').value.trim(),
          channel: el.querySelector('#nc-channel').value,
          consents: consentsObj,
        })
        showToast('✅ เพิ่มลูกค้าในทะเบียนความยินยอมแล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error'); btn.disabled = false; btn.innerHTML = '💾 บันทึก' }
    })
  }

  function openAddDsrForm() {
    const { el, close } = openModal({
      title: '➕ บันทึกคำขอใช้สิทธิ (DSR)', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="dr-customer"><span class="input-error" id="dr-customer-e"></span></div>
        <div class="input-group"><label class="input-label">ประเภทคำขอ</label>
          <select class="input" id="dr-type"><option>ขอเข้าถึงข้อมูล</option><option>ขอลบข้อมูล</option><option>ขอแก้ไขข้อมูล</option><option>ขอถอนความยินยอม</option><option>ขอโอนย้ายข้อมูล</option></select>
        </div>
        <div class="input-group"><label class="input-label">วันที่รับเรื่อง</label><input class="input" type="date" id="dr-received" value="${addDays(0).slice(0,10)}"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="drc">ยกเลิก</button><button class="btn btn-primary" id="drs">💾 บันทึก</button>`
    })
    el.querySelector('#drc').addEventListener('click', close)
    el.querySelector('#drs').addEventListener('click', async () => {
      const customer = el.querySelector('#dr-customer').value.trim()
      if (!customer) { el.querySelector('#dr-customer-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#drs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const received = el.querySelector('#dr-received').value
      try {
        await createDoc('pdpa_dsr_requests', {
          customer, type: el.querySelector('#dr-type').value,
          received, deadline: addDays(30), status: 'pending',
        })
        showToast('✅ บันทึกคำขอ DSR แล้ว', 'success')
        close(); await loadData()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
