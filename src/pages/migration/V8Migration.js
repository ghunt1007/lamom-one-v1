import { createDoc, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { confirmDialog } from '../../utils/modal.js'

// (v1.0.324) เดิมทั้งหน้านี้เป็นการจำลอง UI ล้วนๆ — "เชื่อมต่อ" แค่รอ 1.5 วิแล้วบอกว่าเชื่อมต่อสำเร็จ,
// progress bar และจำนวนเรคคอร์ดที่ "migrate" ล้วนสุ่มด้วย Math.random(), ไม่มีการเขียน Firestore แม้แต่
// บรรทัดเดียว (import createDoc มาแต่ไม่เคยเรียกใช้เลย) ปัญหาจริงคือระบบนี้ไม่มีทางเชื่อมต่อฐานข้อมูล V8
// จริงได้จากโค้ดฝั่ง client เลย (ต้องมี Service Account/Firebase Admin ของ V8 ซึ่งไม่มีในระบบนี้ และการ
// เชื่อมต่อข้าม Firebase project แบบ live ต้องทำผ่าน backend เท่านั้น) แก้ให้เป็นเครื่องมือ "นำเข้าจากไฟล์
// Export จริง" แทน — อัปโหลดไฟล์ JSON ที่ export มาจาก V8 จริง แล้วเขียนแต่ละเรคคอร์ดลง Firestore จริง
// พร้อมนับผลสำเร็จ/พลาดจริงต่อ collection (ไม่ใช่เลขสุ่ม) รูปแบบไฟล์ที่รองรับ: JSON object คีย์เป็นชื่อ
// ตาราง V8 (เช่น tbl_customer) หรือชื่อ collection ปลายทาง (เช่น customers) ค่าเป็น array ของเรคคอร์ด
// ตัดโหมด "Overwrite" ออก (เขียนทับข้ามหลาย collection แบบทั่วไปเสี่ยงเกินไปสำหรับปุ่มเดียว) — โหมดเดียว
// ที่รองรับคือ "เพิ่มข้อมูลใหม่" (append, createDoc ต่อเรคคอร์ด) การแปลงชื่อ field ระหว่างสคีมา V8/V1 เป็น
// คนละเรื่องกับหน้านี้ (อยู่ในความรับผิดชอบของ DataMapping.js) หน้านี้ทำหน้าที่แค่ "อัปโหลด → เขียนจริง"

const COLLECTIONS = [
  { id: 'customers', label: 'ลูกค้า', icon: '👥', v8table: 'tbl_customer' },
  { id: 'vehicles', label: 'สต็อกรถ', icon: '🚗', v8table: 'tbl_vehicle' },
  { id: 'leads', label: 'Leads', icon: '🧲', v8table: 'tbl_lead' },
  { id: 'bookings', label: 'จองรถ', icon: '📝', v8table: 'tbl_booking' },
  { id: 'job_cards', label: 'Job Cards', icon: '🔧', v8table: 'tbl_jobcard' },
  { id: 'parts', label: 'อะไหล่', icon: '🔩', v8table: 'tbl_parts' },
  { id: 'sales', label: 'ยอดขาย', icon: '💰', v8table: 'tbl_sales' },
  { id: 'staff', label: 'พนักงาน', icon: '👤', v8table: 'tbl_staff' },
  { id: 'commissions', label: 'Commission', icon: '🏆', v8table: 'tbl_commission' },
  { id: 'insurance_policies', label: 'ประกัน', icon: '🛡', v8table: 'tbl_insurance' },
]
const COL_BY_KEY = {}
COLLECTIONS.forEach(c => { COL_BY_KEY[c.id.toLowerCase()] = c; COL_BY_KEY[c.v8table.toLowerCase()] = c })

const STEPS = [
  { id: 'upload', label: 'อัปโหลดไฟล์ V8', icon: '📤' },
  { id: 'select', label: 'เลือก Collection', icon: '📋' },
  { id: 'preview', label: 'ตรวจสอบข้อมูล', icon: '🔍' },
  { id: 'migrate', label: 'นำเข้า', icon: '🚀' },
  { id: 'done', label: 'เสร็จสิ้น', icon: '✅' },
]

export default async function V8MigrationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let currentStep = 0
  let parsedCollections = {} // { [collectionId]: { meta, records: [...] } } — จากไฟล์ที่อัปโหลดจริงเท่านั้น
  let unknownKeys = []
  let uploadError = ''
  let selectedCols = new Set()
  let migrationResults = {} // { [collectionId]: { ok, failed, total } }

  if (container.__routerGen !== myGen) return

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔄 V8 Data Import Tool</div>
            <div class="page-subtitle">นำเข้าข้อมูลจากไฟล์ Export ของ LAMOM CRM V8 → LAMOM ONE V1</div>
          </div>
        </div>

        <!-- Stepper -->
        <div style="display:flex;align-items:center;gap:0;margin-bottom:28px;overflow-x:auto">
          ${STEPS.map((s, i) => `
            <div style="display:flex;align-items:center;flex-shrink:0">
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;
                  background:${i < currentStep ? 'var(--success)' : i === currentStep ? 'var(--primary)' : 'var(--surface-3)'};
                  color:${i <= currentStep ? '#fff' : 'var(--text-muted)'}"
                >${i < currentStep ? '✓' : s.icon}</div>
                <div style="font-size:0.72rem;color:${i === currentStep ? 'var(--primary)' : 'var(--text-muted)'};white-space:nowrap">${s.label}</div>
              </div>
              ${i < STEPS.length - 1 ? `<div style="width:60px;height:2px;background:${i < currentStep ? 'var(--success)' : 'var(--border)'};margin:0 4px;margin-bottom:18px"></div>` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Step Content -->
        <div id="step-content">
          ${renderStep()}
        </div>
      </div>
    `
    bindStepEvents()
  }

  function renderStep() {
    switch (currentStep) {
      case 0: return renderUpload()
      case 1: return renderSelect()
      case 2: return renderPreview()
      case 3: return renderMigrate()
      case 4: return renderDone()
      default: return ''
    }
  }

  function renderUpload() {
    return `
      <div class="card" style="padding:24px;max-width:560px;margin:0 auto">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:3rem;margin-bottom:8px">📤</div>
          <div style="font-size:1.1rem;font-weight:700">อัปโหลดไฟล์ Export จาก V8</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">ไฟล์ JSON ที่มีคีย์เป็นชื่อตาราง V8 (เช่น tbl_customer) หรือชื่อ collection ปลายทาง (เช่น customers) ค่าเป็น array ของเรคคอร์ด</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="input-group">
            <label class="input-label">ไฟล์ Export (.json)</label>
            <input class="input" type="file" id="v8-file" accept=".json,application/json">
          </div>
          <span class="input-error" id="v8-err">${uploadError ? '⚠️ ' + uploadError : ''}</span>
          ${Object.keys(parsedCollections).length ? `<div style="background:var(--success-dim);color:var(--success);padding:12px;border-radius:var(--radius-md);font-size:0.85rem">✅ อ่านไฟล์สำเร็จ — พบ ${Object.keys(parsedCollections).length} collection ที่รู้จัก (${Object.values(parsedCollections).reduce((a,c)=>a+c.records.length,0)} เรคคอร์ดจริง)${unknownKeys.length ? `<br><span style="color:var(--text-muted)">ไม่รู้จักคีย์: ${unknownKeys.join(', ')}</span>` : ''}</div>` : ''}
          <button class="btn btn-primary" id="upload-next-btn" style="width:100%" ${Object.keys(parsedCollections).length ? '' : 'disabled'}>
            ไปต่อ ➡
          </button>
        </div>
      </div>
    `
  }

  function renderSelect() {
    const ids = Object.keys(parsedCollections)
    const allChecked = selectedCols.size === ids.length
    return `
      <div class="card" style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:700">📋 เลือก Collection ที่ต้องการนำเข้า</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" id="sel-all">${allChecked ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</button>
            <button class="btn btn-primary btn-sm" id="sel-next" ${selectedCols.size === 0 ? 'disabled' : ''}>ถัดไป ➡</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
          ${ids.map(id => {
            const { meta, records } = parsedCollections[id]
            return `
            <label style="cursor:pointer;display:block">
              <div class="card" style="padding:14px;border:2px solid ${selectedCols.has(id) ? 'var(--primary)' : 'var(--border)'};background:${selectedCols.has(id) ? 'var(--primary-dim)' : 'var(--surface)'}">
                <div style="display:flex;align-items:center;gap:10px">
                  <input type="checkbox" class="col-check" data-id="${id}" ${selectedCols.has(id) ? 'checked' : ''} style="width:16px;height:16px">
                  <span style="font-size:1.3rem">${meta.icon}</span>
                  <div>
                    <div style="font-weight:600;font-size:0.88rem">${meta.label}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted)">${meta.v8table} • ${records.length} เรคคอร์ดจริง</div>
                  </div>
                </div>
              </div>
            </label>
          `}).join('')}
        </div>
        <div style="margin-top:16px;font-size:0.82rem;color:var(--text-muted)">เลือกแล้ว ${selectedCols.size} Collection</div>
      </div>
    `
  }

  function renderPreview() {
    const selected = Object.keys(parsedCollections).filter(id => selectedCols.has(id))
    const totalRecords = selected.reduce((a, id) => a + parsedCollections[id].records.length, 0)
    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card" style="padding:20px">
          <div style="font-weight:700;margin-bottom:14px">🔍 ตรวจสอบข้อมูลก่อนนำเข้า</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">
            <div style="background:var(--surface-2);padding:12px;border-radius:var(--radius-md);text-align:center">
              <div style="font-size:1.6rem;font-weight:700;color:var(--primary)">${selected.length}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">Collections</div>
            </div>
            <div style="background:var(--surface-2);padding:12px;border-radius:var(--radius-md);text-align:center">
              <div style="font-size:1.6rem;font-weight:700;color:var(--success)">${totalRecords}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">เรคคอร์ดจริงจากไฟล์</div>
            </div>
          </div>
          <table class="table" style="font-size:0.83rem">
            <thead><tr><th>Collection</th><th>V8 Table</th><th class="text-right">เรคคอร์ด</th></tr></thead>
            <tbody>
              ${selected.map(id => `<tr>
                <td>${parsedCollections[id].meta.icon} ${parsedCollections[id].meta.label}</td>
                <td style="color:var(--text-muted);font-family:monospace">${parsedCollections[id].meta.v8table}</td>
                <td class="text-right">${parsedCollections[id].records.length}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="card" style="padding:16px;background:var(--warning-dim);border:1px solid var(--warning)">
          <div style="font-weight:700;color:var(--warning);margin-bottom:6px">⚠️ ข้อควรระวัง</div>
          <ul style="font-size:0.83rem;color:var(--text);padding-left:20px;margin:0;line-height:1.8">
            <li>โหมดนี้คือ "เพิ่มข้อมูลใหม่" (append) เท่านั้น — จะสร้างเอกสารใหม่ ไม่แก้ไข/ลบข้อมูลเดิม</li>
            <li>ชื่อ field ในไฟล์จะถูกเขียนลง Firestore ตรงตามที่มีในไฟล์ — ถ้าชื่อ field ไม่ตรงกับที่ V1 ใช้ ต้องแปลงในไฟล์ก่อนอัปโหลด</li>
            <li>แนะนำให้ทดสอบกับไฟล์ย่อยก่อน แล้วตรวจสอบผลลัพธ์ในหน้าที่เกี่ยวข้องก่อนนำเข้าไฟล์เต็ม</li>
          </ul>
        </div>

        <div style="display:flex;justify-content:space-between">
          <button class="btn btn-secondary" id="prev-btn">◀ ย้อนกลับ</button>
          <button class="btn btn-primary" id="start-migrate-btn">🚀 เริ่มนำเข้า</button>
        </div>
      </div>
    `
  }

  function renderMigrate() {
    const selected = Object.keys(parsedCollections).filter(id => selectedCols.has(id))
    return `
      <div class="card" style="padding:24px">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:2.5rem;margin-bottom:8px" id="mig-icon">🚀</div>
          <div style="font-weight:700;font-size:1.1rem" id="mig-title">กำลังนำเข้าข้อมูล...</div>
          <div style="font-size:0.83rem;color:var(--text-muted);margin-top:4px" id="mig-sub">กรุณารอสักครู่ — กำลังเขียนลง Firestore จริง</div>
        </div>

        <div style="margin-bottom:20px">
          ${selected.map(id => `
            <div style="margin-bottom:10px" id="prog-${id}">
              <div style="display:flex;justify-content:space-between;font-size:0.83rem;margin-bottom:4px">
                <span>${parsedCollections[id].meta.icon} ${parsedCollections[id].meta.label}</span>
                <span id="prog-label-${id}" style="color:var(--text-muted)">รอ...</span>
              </div>
              <div style="background:var(--surface-3);border-radius:99px;height:8px;overflow:hidden">
                <div id="prog-bar-${id}" style="height:100%;width:0%;background:var(--primary);border-radius:99px;transition:width 0.3s"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:12px;height:150px;overflow-y:auto;font-family:monospace;font-size:0.75rem" id="mig-log">
          <div style="color:var(--text-muted)">Import Log:</div>
        </div>
      </div>
    `
  }

  function renderDone() {
    const selected = Object.keys(parsedCollections).filter(id => selectedCols.has(id))
    const totalOk = selected.reduce((a, id) => a + (migrationResults[id]?.ok || 0), 0)
    const totalFailed = selected.reduce((a, id) => a + (migrationResults[id]?.failed || 0), 0)
    return `
      <div class="card" style="padding:32px;text-align:center;max-width:500px;margin:0 auto">
        <div style="font-size:4rem;margin-bottom:12px">${totalFailed ? '⚠️' : '🎉'}</div>
        <div style="font-size:1.3rem;font-weight:700;color:var(--${totalFailed ? 'warning' : 'success'});margin-bottom:8px">นำเข้าข้อมูลเสร็จแล้ว</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:24px">สำเร็จ ${totalOk} เรคคอร์ด${totalFailed ? ` · พลาด ${totalFailed} เรคคอร์ด` : ''}</div>

        <div style="background:var(--surface-2);border-radius:var(--radius-lg);padding:16px;margin-bottom:20px">
          ${selected.map(id => {
            const r = migrationResults[id] || { ok: 0, failed: 0 }
            return `
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.85rem;border-bottom:1px solid var(--border)">
              <span>${parsedCollections[id].meta.icon} ${parsedCollections[id].meta.label}</span>
              <span style="color:var(--${r.failed ? 'warning' : 'success'})">✅ ${r.ok}${r.failed ? ` · ❌ ${r.failed}` : ''}</span>
            </div>
          `}).join('')}
          <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-weight:700">
            <span>ทั้งหมด</span>
            <span style="color:var(--${totalFailed ? 'warning' : 'success'})">${totalOk}/${totalOk + totalFailed} เรคคอร์ด</span>
          </div>
        </div>

        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn btn-secondary" id="restart-mig">🔄 นำเข้าไฟล์ใหม่</button>
          <button class="btn btn-primary" onclick="navigate('/')">🏠 กลับ Dashboard</button>
        </div>
      </div>
    `
  }

  function bindStepEvents() {
    // Step 0 — Upload
    document.getElementById('v8-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      uploadError = ''
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('ไฟล์ต้องเป็น JSON object (คีย์=ชื่อตาราง/collection, ค่า=array ของเรคคอร์ด)')
        parsedCollections = {}
        unknownKeys = []
        Object.entries(json).forEach(([key, val]) => {
          if (!Array.isArray(val)) return
          const meta = COL_BY_KEY[key.toLowerCase()]
          if (!meta) { unknownKeys.push(key); return }
          parsedCollections[meta.id] = { meta, records: val.filter(r => r && typeof r === 'object') }
        })
        if (!Object.keys(parsedCollections).length) uploadError = 'ไม่พบ collection ที่รู้จักในไฟล์นี้'
      } catch (err) {
        uploadError = 'อ่านไฟล์ไม่สำเร็จ: ' + (err.message || 'รูปแบบไฟล์ไม่ถูกต้อง')
        parsedCollections = {}
      }
      renderPage()
    })
    document.getElementById('upload-next-btn')?.addEventListener('click', () => {
      if (!Object.keys(parsedCollections).length) return
      selectedCols = new Set(Object.keys(parsedCollections))
      currentStep = 1; renderPage()
    })

    // Step 1 — Select
    document.getElementById('sel-all')?.addEventListener('click', () => {
      const ids = Object.keys(parsedCollections)
      if (selectedCols.size === ids.length) selectedCols.clear()
      else ids.forEach(id => selectedCols.add(id))
      renderPage()
    })
    document.querySelectorAll('.col-check').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedCols.add(cb.dataset.id)
        else selectedCols.delete(cb.dataset.id)
        renderPage()
      })
    })
    document.getElementById('sel-next')?.addEventListener('click', () => {
      if (!selectedCols.size) return
      currentStep = 2; renderPage()
    })

    // Step 2 — Preview
    document.getElementById('prev-btn')?.addEventListener('click', () => { currentStep = 1; renderPage() })
    document.getElementById('start-migrate-btn')?.addEventListener('click', async () => {
      const totalRecords = [...selectedCols].reduce((a, id) => a + parsedCollections[id].records.length, 0)
      const ok = await confirmDialog({ title: '🚀 เริ่มนำเข้าข้อมูล', message: `ยืนยันนำเข้า ${totalRecords} เรคคอร์ด จาก ${selectedCols.size} Collections เข้า Firestore จริง?`, confirmText: 'เริ่ม', danger: false })
      if (!ok) return
      currentStep = 3
      if (container.__routerGen !== myGen) return
      renderPage()
      startMigration()
    })

    // Step 4 — restart
    document.getElementById('restart-mig')?.addEventListener('click', () => {
      currentStep = 0; parsedCollections = {}; unknownKeys = []; uploadError = ''; selectedCols.clear(); migrationResults = {}; renderPage()
    })
  }

  function addLog(msg, color = 'var(--text-muted)') {
    const log = document.getElementById('mig-log')
    if (!log) return
    const line = document.createElement('div')
    line.style.color = color
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`
    log.appendChild(line)
    log.scrollTop = log.scrollHeight
  }

  // เขียนแต่ละเรคคอร์ดลง Firestore จริงทีละรายการ นับผลสำเร็จ/พลาดจริง (ไม่ใช่ Math.random() แบบเดิม)
  async function startMigration() {
    const selected = Object.keys(parsedCollections).filter(id => selectedCols.has(id))
    addLog('เริ่มนำเข้าข้อมูล...', 'var(--primary)')

    for (const id of selected) {
      if (container.__routerGen !== myGen) return
      const { meta, records } = parsedCollections[id]
      const bar = document.getElementById(`prog-bar-${id}`)
      const label = document.getElementById(`prog-label-${id}`)
      addLog(`กำลังนำเข้า ${meta.label} (${meta.v8table}) — ${records.length} เรคคอร์ด...`)

      let ok = 0, failed = 0
      for (let i = 0; i < records.length; i++) {
        if (container.__routerGen !== myGen) return
        try {
          await createDoc(id, records[i])
          ok++
        } catch (e) {
          failed++
        }
        const pct = Math.round(((i + 1) / records.length) * 100)
        if (bar) bar.style.width = pct + '%'
        if (label) label.textContent = `${i + 1}/${records.length}`
      }
      migrationResults[id] = { ok, failed, total: records.length }
      if (label) { label.textContent = failed ? `✅ ${ok} · ❌ ${failed}` : `✅ เสร็จ (${ok})`; label.style.color = failed ? 'var(--warning)' : 'var(--success)' }
      if (bar) bar.style.background = failed ? 'var(--warning)' : 'var(--success)'
      addLog(`✅ ${meta.label}: สำเร็จ ${ok}${failed ? `, พลาด ${failed}` : ''} จาก ${records.length}`, failed ? 'var(--warning)' : 'var(--success)')
    }

    if (container.__routerGen !== myGen) return
    const title = document.getElementById('mig-title')
    const sub = document.getElementById('mig-sub')
    const icon = document.getElementById('mig-icon')
    const totalOk = selected.reduce((a, id) => a + migrationResults[id].ok, 0)
    const totalFailed = selected.reduce((a, id) => a + migrationResults[id].failed, 0)
    if (title) title.textContent = totalFailed ? 'นำเข้าเสร็จ (มีบางรายการพลาด)' : 'นำเข้าสำเร็จ!'
    if (sub) sub.textContent = `สำเร็จ ${totalOk} เรคคอร์ด${totalFailed ? ` · พลาด ${totalFailed} เรคคอร์ด` : ''}`
    if (icon) icon.textContent = totalFailed ? '⚠️' : '🎉'
    addLog('เสร็จสมบูรณ์', totalFailed ? 'var(--warning)' : 'var(--success)')
    showToast(totalFailed ? `⚠️ นำเข้าเสร็จ — พลาด ${totalFailed} เรคคอร์ด` : '🎉 นำเข้าข้อมูลสำเร็จ!', totalFailed ? 'error' : 'success')
    setTimeout(() => {
      if (container.__routerGen !== myGen) return
      currentStep = 4; renderPage()
    }, 800)
  }

  renderPage()
}
