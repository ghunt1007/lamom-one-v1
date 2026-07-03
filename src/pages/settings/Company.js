import { showToast } from '../../core/store.js'
import { openModal, confirmDialog } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const COMPANY_DEFAULTS = {
  name: 'LAMOM ออโต้ จำกัด',
  nameTh: 'บริษัท ลาม่อม ออโต้ จำกัด',
  taxId: '0-1055-12345-67-8',
  phone: '02-123-4567',
  email: 'info@lamom.co.th',
  address: '123 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310',
  website: 'www.lamom.co.th',
  lineOA: '@lamomauto',
  facebook: 'LamoMAuto',
  brand: 'BYD, MG, DEEPAL, NETA',
  logoText: 'LAMOM',
  logoColor: '#2563eb',
  footerNote: 'ขอบคุณที่ไว้วางใจ LAMOM AUTO — บริการด้วยใจ',
}

const BRANCH_DEFAULTS = [
  { id:'b1', name:'สาขาหลัก (กรุงเทพ)', phone:'02-123-4567', address:'123 ถนนพระราม 9 กรุงเทพฯ', manager:'ทวีศักดิ์ สุขสมบัติเสถียร', isMain:true },
  { id:'b2', name:'สาขาเชียงใหม่', phone:'053-111-222', address:'456 ถ.นิมมานเหมินท์ เชียงใหม่', manager:'สมชาย ใจดี', isMain:false },
  { id:'b3', name:'สาขาขอนแก่น', phone:'043-333-444', address:'789 ถ.มิตรภาพ ขอนแก่น', manager:'วิชัย รักงาน', isMain:false },
]

function loadCompany() {
  let saved; try { saved = JSON.parse(localStorage.getItem('lamom-company') || '{}') } catch { saved = {} }
  return { ...COMPANY_DEFAULTS, ...saved }
}
function saveCompany(d) {
  try { localStorage.setItem('lamom-company', JSON.stringify(d)) } catch {}
}
function loadBranches() {
  try {
    const raw = localStorage.getItem('lamom-branches')
    return raw ? JSON.parse(raw) : [...BRANCH_DEFAULTS]
  } catch { return [...BRANCH_DEFAULTS] }
}
function saveBranches(b) {
  try { localStorage.setItem('lamom-branches', JSON.stringify(b)) } catch {}
}

export default function CompanyPage(container) {
  const myGen = container.__routerGen
  let activeTab = 'info'
  let data = loadCompany()
  let branches = loadBranches()

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏢 ตั้งค่าบริษัท</div>
            <div class="page-subtitle">ข้อมูลบริษัท สาขา และส่วนหัวเอกสาร</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:8px">
          ${[['info','📋 ข้อมูลบริษัท'],['branches','🏪 สาขา'],['docheader','📄 ส่วนหัวเอกสาร']].map(([k,l]) =>
            `<button class="btn btn-sm co-tab ${activeTab===k?'btn-primary':'btn-secondary'}" data-tab="${k}">${l}</button>`
          ).join('')}
        </div>

        <div id="co-body"></div>
      </div>
    `
    container.querySelectorAll('.co-tab').forEach(b => b.addEventListener('click', () => {
      activeTab = b.dataset.tab; renderPage()
    }))

    const body = document.getElementById('co-body')
    if (activeTab === 'info') renderInfo(body)
    else if (activeTab === 'branches') renderBranches(body)
    else renderDocHeader(body)
  }

  function renderInfo(el) {
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:860px">
        <!-- Left column -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card" style="padding:18px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📝 ชื่อและทะเบียน</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="input-group"><label class="input-label">ชื่อบริษัท (ไทย)</label><input class="input" id="co-nameth" value="${data.nameTh}"></div>
              <div class="input-group"><label class="input-label">ชื่อบริษัท (อังกฤษ)</label><input class="input" id="co-name" value="${data.name}"></div>
              <div class="input-group"><label class="input-label">เลขทะเบียนภาษี 13 หลัก</label><input class="input" id="co-tax" value="${data.taxId}" placeholder="x-xxxx-xxxxx-xx-x"></div>
              <div class="input-group"><label class="input-label">ยี่ห้อรถที่จำหน่าย</label><input class="input" id="co-brand" value="${data.brand}"></div>
            </div>
          </div>
          <div class="card" style="padding:18px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📍 ที่อยู่และติดต่อ</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="input-group"><label class="input-label">ที่อยู่</label><textarea class="input" id="co-addr" rows="2">${escHtml(data.address || '')}</textarea></div>
              <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="co-phone" value="${data.phone}"></div>
              <div class="input-group"><label class="input-label">อีเมล</label><input class="input" type="email" id="co-email" value="${data.email}"></div>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card" style="padding:18px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🌐 ออนไลน์ & โซเชียล</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="input-group"><label class="input-label">Website</label><input class="input" id="co-web" value="${data.website}"></div>
              <div class="input-group"><label class="input-label">LINE OA</label><input class="input" id="co-line" value="${data.lineOA}"></div>
              <div class="input-group"><label class="input-label">Facebook Page</label><input class="input" id="co-fb" value="${data.facebook}"></div>
            </div>
          </div>
          <!-- Summary card -->
          <div class="card" style="padding:18px;border-left:3px solid var(--primary)">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 สรุป</div>
            <div style="font-size:0.84rem;font-weight:700">${escHtml(data.nameTh)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin:3px 0">${escHtml(data.taxId)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(data.address)}</div>
            <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
              ${data.brand.split(',').map(b => `<span class="badge badge-primary" style="font-size:0.65rem">${escHtml(b.trim())}</span>`).join('')}
            </div>
            <div style="margin-top:12px">
              <button class="btn btn-primary" id="save-info-btn" style="width:100%">💾 บันทึกข้อมูลบริษัท</button>
            </div>
          </div>
        </div>
      </div>
    `
    document.getElementById('save-info-btn').addEventListener('click', () => {
      data = {
        ...data,
        name: document.getElementById('co-name').value,
        nameTh: document.getElementById('co-nameth').value,
        taxId: document.getElementById('co-tax').value,
        phone: document.getElementById('co-phone').value,
        email: document.getElementById('co-email').value,
        address: document.getElementById('co-addr').value,
        website: document.getElementById('co-web').value,
        lineOA: document.getElementById('co-line').value,
        facebook: document.getElementById('co-fb').value,
        brand: document.getElementById('co-brand').value,
      }
      saveCompany(data)
      showToast('✅ บันทึกข้อมูลบริษัทแล้ว', 'success')
      renderPage()
    })
  }

  function renderBranches(el) {
    el.innerHTML = `
      <div style="max-width:780px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:0.85rem;color:var(--text-muted)">${branches.length} สาขา</div>
          <button class="btn btn-primary btn-sm" id="add-branch-btn">➕ เพิ่มสาขา</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px" id="branch-list">
          ${branches.map(b => `
            <div class="card card-lift" style="padding:14px 18px;border-left:3px solid var(--${b.isMain?'warning':'primary'})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${b.isMain?'⭐ ':'🏪 '}${b.name}</div>
                  <div style="font-size:0.74rem;color:var(--text-muted);margin-top:4px">📞 ${b.phone} · 👤 ${b.manager}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted);margin-top:2px">📍 ${b.address}</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm edit-branch" data-id="${b.id}">✏️</button>
                  ${!b.isMain ? `<button class="btn btn-danger btn-sm del-branch" data-id="${b.id}">🗑</button>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    document.getElementById('add-branch-btn').addEventListener('click', () => openBranchModal(null))
    el.querySelectorAll('.edit-branch').forEach(b => b.addEventListener('click', () => {
      const br = branches.find(x => x.id === b.dataset.id)
      if (br) openBranchModal(br)
    }))
    el.querySelectorAll('.del-branch').forEach(b => b.addEventListener('click', async () => {
      const br = branches.find(x => x.id === b.dataset.id)
      const ok = await confirmDialog({ title:'🗑 ลบสาขา', message:`ลบ "${br.name}" ออกจากระบบ?`, confirmText:'ลบ', danger:true })
      if (!ok) return
      branches = branches.filter(x => x.id !== b.dataset.id)
      saveBranches(branches); showToast('🗑 ลบสาขาแล้ว', 'warning')
      if (container.__routerGen !== myGen) return
      renderPage()
    }))
  }

  function openBranchModal(br) {
    const isEdit = !!br
    openModal({
      title: isEdit ? '✏️ แก้ไขสาขา' : '➕ เพิ่มสาขาใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อสาขา</label><input class="input" id="br-name" value="${br?.name||''}" placeholder="เช่น สาขากรุงเทพ"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="br-phone" value="${br?.phone||''}"></div>
          <div class="input-group"><label class="input-label">ที่อยู่</label><textarea class="input" id="br-addr" rows="2">${escHtml(br?.address||'')}</textarea></div>
          <div class="input-group"><label class="input-label">ผู้จัดการสาขา</label><input class="input" id="br-mgr" value="${br?.manager||''}"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">ยกเลิก</button>
               <button class="btn btn-primary" id="br-save">💾 บันทึก</button>`
    })
    document.getElementById('br-save').addEventListener('click', () => {
      const name = document.getElementById('br-name').value.trim()
      if (!name) { showToast('⚠️ กรุณากรอกชื่อสาขา', 'warning'); return }
      const updated = {
        id: br?.id || 'b'+Date.now(),
        name,
        phone: document.getElementById('br-phone').value.trim(),
        address: document.getElementById('br-addr').value.trim(),
        manager: document.getElementById('br-mgr').value.trim(),
        isMain: br?.isMain || false
      }
      if (isEdit) branches = branches.map(x => x.id === updated.id ? updated : x)
      else branches.push(updated)
      saveBranches(branches)
      document.querySelector('.modal-overlay')?.remove()
      showToast(isEdit ? '✅ แก้ไขสาขาแล้ว' : '✅ เพิ่มสาขาแล้ว', 'success')
      renderPage()
    })
  }

  function renderDocHeader(el) {
    el.innerHTML = `
      <div style="max-width:700px;display:flex;flex-direction:column;gap:16px">
        <!-- Editor card -->
        <div class="card" style="padding:18px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⚙️ ตั้งค่าส่วนหัวเอกสาร</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="input-group"><label class="input-label">ข้อความโลโก้ (ถ้าไม่มีไฟล์โลโก้)</label><input class="input" id="logo-text" value="${data.logoText||'LAMOM'}" maxlength="10"></div>
            <div class="input-group">
              <label class="input-label">สีโลโก้</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" id="logo-color" value="${data.logoColor||'#2563eb'}" style="width:44px;height:36px;border:1px solid var(--border);border-radius:8px;padding:2px;background:var(--surface-2);cursor:pointer">
                <input class="input" id="logo-color-hex" value="${data.logoColor||'#2563eb'}" style="flex:1;font-family:monospace">
              </div>
            </div>
            <div class="input-group"><label class="input-label">ข้อความท้ายเอกสาร (Footer Note)</label><input class="input" id="doc-footer" value="${data.footerNote||''}"></div>
          </div>
          <button class="btn btn-primary" id="save-header-btn" style="margin-top:14px">💾 บันทึกการตั้งค่า</button>
        </div>

        <!-- Preview card -->
        <div class="card" style="padding:18px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">👁 ตัวอย่างส่วนหัวเอกสาร</div>
          <div id="doc-preview" style="border:1px solid var(--border);border-radius:8px;padding:16px 20px;background:#fff;color:#111">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-weight:900;font-size:1.4rem;color:${data.logoColor||'#2563eb'};letter-spacing:0.04em">${escHtml(data.logoText||'LAMOM')}</div>
                <div style="font-size:0.9rem;font-weight:700;color:#111">${escHtml(data.nameTh)}</div>
                <div style="font-size:0.72rem;color:#666;margin-top:2px">${escHtml(data.name)}</div>
              </div>
              <div style="text-align:right;font-size:0.72rem;color:#444;line-height:1.7">
                <div>เลขทะเบียน: ${escHtml(data.taxId)}</div>
                <div>☎️ ${escHtml(data.phone)}</div>
                <div>✉️ ${escHtml(data.email)}</div>
              </div>
            </div>
            <div style="margin-top:8px;font-size:0.7rem;color:#666;border-top:1px solid #ddd;padding-top:6px">${escHtml(data.address)}</div>
            <div style="margin-top:6px;font-size:0.68rem;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:6px">${escHtml(data.footerNote||'')}</div>
          </div>
        </div>
      </div>
    `

    const colorPicker = document.getElementById('logo-color')
    const colorHex = document.getElementById('logo-color-hex')
    function syncPreview() {
      const logo = document.getElementById('logo-text').value
      const color = colorPicker.value
      colorHex.value = color
      const prev = document.getElementById('doc-preview')
      if (prev) {
        prev.querySelector('div > div > div:first-child').style.color = color
        prev.querySelector('div > div > div:first-child').textContent = logo
      }
    }
    colorPicker.addEventListener('input', syncPreview)
    document.getElementById('logo-text').addEventListener('input', syncPreview)
    colorHex.addEventListener('change', () => { colorPicker.value = colorHex.value; syncPreview() })

    document.getElementById('save-header-btn').addEventListener('click', () => {
      data = { ...data,
        logoText: document.getElementById('logo-text').value.trim(),
        logoColor: document.getElementById('logo-color').value,
        footerNote: document.getElementById('doc-footer').value.trim(),
      }
      saveCompany(data)
      showToast('✅ บันทึกการตั้งค่าเอกสารแล้ว', 'success')
    })
  }

  renderPage()
}
