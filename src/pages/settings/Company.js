import { showToast } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'
import { validateTaxId } from '../../utils/thaiId.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const COMPANY_DEFAULTS = {
  name: 'LAMOM ออโต้ จำกัด',
  nameTh: 'บริษัท ลาม่อม ออโต้ จำกัด',
  taxId: '0-1055-12345-67-1',
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

// เก็บใน Firestore collection เดียว doc เดียว ('company_profile') → sync ข้ามอุปกรณ์จริง
// (เดิมเก็บใน localStorage เครื่องเดียว ทำให้พนักงาน 2 เครื่องเห็นข้อมูลไม่ตรงกัน)
// นี่คือ "โปรไฟล์บริษัทเดี่ยว" (ชื่อ/ที่อยู่/โซเชียล/ส่วนหัวเอกสาร) — คนละแนวคิดกับ BranchSettings.js
// ซึ่งจัดการ "รายการหลายสาขา" — เดิมหน้านี้มีแท็บจัดการสาขาซ้ำซ้อนกับ BranchSettings.js (คนละ store กัน
// ทำให้ข้อมูลสาขาไม่ตรงกัน 2 ที่) จึงตัดแท็บสาขาออก เหลือเป็นลิงก์พาไปหน้าจัดการสาขาจริงแทน
let _docId = null

async function loadCompany() {
  try {
    const docs = await listDocs('company_profile', [], 'createdAt', 'asc', 10)
    if (docs.length > 0) {
      _docId = docs[0].id
      return { ...COMPANY_DEFAULTS, ...docs[0] }
    }
    _docId = await createDoc('company_profile', COMPANY_DEFAULTS)
    return { ...COMPANY_DEFAULTS }
  } catch (e) {
    return { ...COMPANY_DEFAULTS }
  }
}

// คืนค่า true/false ให้ผู้เรียกรู้จริงว่าบันทึกสำเร็จหรือไม่ — เดิม catch เงียบแล้วโชว์ "บันทึกแล้ว" เสมอ
async function saveCompany(d) {
  try {
    if (!_docId) { _docId = await createDoc('company_profile', d) } else { await updateDocData('company_profile', _docId, d) }
    return true
  } catch (e) { return false }
}

export default async function CompanyPage(container) {
  const myGen = container.__routerGen
  let activeTab = 'info'
  let data = await loadCompany()
  if (container.__routerGen !== myGen) return

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
    else if (activeTab === 'branches') renderBranchesRedirect(body)
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
    document.getElementById('save-info-btn').addEventListener('click', async () => {
      const taxId = document.getElementById('co-tax').value
      const taxCheck = validateTaxId(taxId)
      if (!taxCheck.valid) { showToast(taxCheck.error, 'error'); return }

      data = {
        ...data,
        name: document.getElementById('co-name').value,
        nameTh: document.getElementById('co-nameth').value,
        taxId,
        phone: document.getElementById('co-phone').value,
        email: document.getElementById('co-email').value,
        address: document.getElementById('co-addr').value,
        website: document.getElementById('co-web').value,
        lineOA: document.getElementById('co-line').value,
        facebook: document.getElementById('co-fb').value,
        brand: document.getElementById('co-brand').value,
      }
      const ok = await saveCompany(data)
      if (container.__routerGen !== myGen) return
      if (!ok) { showToast('บันทึกไม่สำเร็จ', 'error'); return }
      showToast('✅ บันทึกข้อมูลบริษัทแล้ว', 'success')
      renderPage()
    })
  }

  // จัดการรายชื่อหลายสาขาซ้ำซ้อนกับ BranchSettings.js (Firestore จริง /settings/branches)
  // เพื่อไม่ให้มีข้อมูลสาขา 2 ชุดที่ไม่ตรงกัน หน้านี้จึงพาไปหน้าจัดการสาขาจริงแทน
  function renderBranchesRedirect(el) {
    el.innerHTML = `
      <div style="max-width:520px">
        <div class="card hub-link-card" id="go-branches" style="padding:22px;cursor:pointer;transition:transform .15s">
          <div style="font-size:1.8rem;margin-bottom:8px">🏪</div>
          <div style="font-weight:700;margin-bottom:4px">จัดการสาขาทั้งหมด</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">การจัดการหลายสาขาย้ายไปอยู่ที่หน้า Multi-Branch Settings แล้ว (ข้อมูลจริงจาก Firestore) — กดเพื่อไปที่หน้านั้น</div>
        </div>
      </div>
    `
    const card = document.getElementById('go-branches')
    card.addEventListener('click', () => navigate('/settings/branches'))
    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)' })
    card.addEventListener('mouseleave', () => { card.style.transform = '' })
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

    document.getElementById('save-header-btn').addEventListener('click', async () => {
      data = { ...data,
        logoText: document.getElementById('logo-text').value.trim(),
        logoColor: document.getElementById('logo-color').value,
        footerNote: document.getElementById('doc-footer').value.trim(),
      }
      const ok = await saveCompany(data)
      if (container.__routerGen !== myGen) return
      if (!ok) { showToast('บันทึกไม่สำเร็จ', 'error'); return }
      showToast('✅ บันทึกการตั้งค่าเอกสารแล้ว', 'success')
    })
  }

  renderPage()
}
