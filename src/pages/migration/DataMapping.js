/**
 * Data Mapping — ตั้งค่าจับคู่ชื่อ field V8 → V1
 * Route: /migration/mapping
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, setDocData } from '../../core/db.js'
import { COLLECTIONS } from './V8Migration.js'
import { isProgramOwner } from '../../core/hierarchy.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// (v1.0.325) เดิมทั้งหน้านี้เป็นตารางสถานะ Migration ปลอมทั้งหมด — จำนวน records/mapped/issues ต่อ module
// (เช่น "ลูกค้า 1,842 รายการ นำเข้าแล้ว") เป็นตัวเลข hardcode ที่ไม่มีความเกี่ยวข้องกับความจริงเลย (V8
// migration ไม่มีทางเกิดขึ้นจริงในระบบนี้ตามที่คุยกับเจ้าของแล้วในหน้า V8Migration.js — ไม่มี credential
// เชื่อมต่อ V8 จริง) และปุ่ม "Import" แค่เปลี่ยนตัวแปรในหน่วยความจำ (m.status='imported') ไม่แตะข้อมูล
// จริงเลย — แก้ให้เป็นเครื่องมือตั้งค่า "field mapping" จริง: ผู้ใช้กำหนดว่า field ชื่ออะไรใน V8 ควร
// เขียนเป็น field ชื่ออะไรใน V1 (persist จริงลง Firestore collection v8_field_mappings) เพื่อใช้เตรียม
// ไฟล์ export ก่อนอัปโหลดเข้า V8Migration.js (ซึ่งเขียนข้อมูลลง Firestore แบบ pass-through ตามชื่อ field
// ที่มีในไฟล์ ไม่แปลงชื่อ field ให้อัตโนมัติ) ไม่มีตัวเลข records/issues ปลอมอีกต่อไปเพราะไม่มีทางรู้จำนวน
// จริงได้จนกว่าจะมีไฟล์ export มาอัปโหลดจริง (ดูจำนวนจริงได้ที่ V8Migration.js ตอนอัปโหลดไฟล์)

export default async function DataMappingPage(container) {
  if (!isProgramOwner()) {
    container.innerHTML = `<div class="page-content"><div class="empty-state" style="padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div><div class="empty-desc">การตั้งค่าจับคู่ field V8 → V1 กระทบการนำเข้าข้อมูลทั้งระบบ เปิดให้เฉพาะเจ้าของโปรแกรมเท่านั้น</div></div></div>`
    return
  }
  const myGen = container.__routerGen
  let mappings = {} // { [collectionId]: [{ v8Field, v1Field }, ...] }

  try {
    const docs = await listDocs('v8_field_mappings', [], 'updatedAt', 'desc', 100)
    if (container.__routerGen !== myGen) return
    docs.filter(d => !d.deleted).forEach(d => { mappings[d.id] = Array.isArray(d.pairs) ? d.pairs : [] })
  } catch {}

  function renderPage() {
    const configured = COLLECTIONS.filter(c => mappings[c.id]?.length).length
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗺️ Data Mapping</div>
            <div class="page-subtitle">ตั้งค่าจับคู่ชื่อ field จาก LAMOM CRM V8 → LAMOM ONE V1 (ใช้เตรียมไฟล์ก่อนนำเข้าที่หน้า V8 Data Import)</div>
          </div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:16px">
          <div style="display:flex;gap:24px;align-items:center">
            <div style="text-align:center;min-width:90px">
              <div style="font-size:2rem;font-weight:900;color:var(--primary)">${configured}/${COLLECTIONS.length}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">Collection ที่ตั้งค่าแล้ว</div>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted)">
              กำหนดว่า field ชื่ออะไรในไฟล์ export จาก V8 ควรถูกเขียนเป็น field ชื่ออะไรใน Firestore ของ V1 —
              เมื่อเตรียมไฟล์ตามการตั้งค่านี้แล้ว ให้อัปโหลดที่หน้า <a href="/migration" onclick="navigate('/migration');return false">🔄 V8 Data Import</a>
            </div>
          </div>
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">Collection ปลายทาง (V1)</th>
                <th style="padding:10px 14px;text-align:left">V8 Table</th>
                <th style="padding:10px 14px;text-align:center">สถานะ</th>
                <th style="padding:10px 14px;text-align:center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${COLLECTIONS.map(c => {
                const pairs = mappings[c.id] || []
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 14px;font-size:0.83rem;font-weight:600">${c.icon} ${c.label}</td>
                  <td style="padding:10px 14px;font-size:0.83rem;color:var(--text-muted);font-family:monospace">${c.v8table}</td>
                  <td style="padding:10px 14px;text-align:center">
                    <span class="badge badge-${pairs.length ? 'success' : 'secondary'}" style="font-size:0.65rem">${pairs.length ? `ตั้งค่าแล้ว ${pairs.length} field` : 'ยังไม่ตั้งค่า'}</span>
                  </td>
                  <td style="padding:10px 14px;text-align:center">
                    <button class="btn btn-xs btn-secondary map-btn" data-id="${c.id}">🗺️ ตั้งค่า Mapping</button>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.map-btn').forEach(b => b.addEventListener('click', () => {
      const c = COLLECTIONS.find(x => x.id === b.dataset.id); if (c) openMapModal(c)
    }))
  }

  function openMapModal(c) {
    let pairs = (mappings[c.id] || []).map(p => ({ ...p }))

    function renderRows() {
      return pairs.map((p, i) => `
        <div class="map-row" data-i="${i}" style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <input class="input map-v8" data-i="${i}" placeholder="field ใน V8 เช่น cust_name" value="${esc(p.v8Field)}" style="flex:1">
          <span style="color:var(--text-muted)">→</span>
          <input class="input map-v1" data-i="${i}" placeholder="field ใน V1 เช่น firstName" value="${esc(p.v1Field)}" style="flex:1">
          <button class="btn btn-xs btn-secondary map-row-del" data-i="${i}" style="color:var(--danger)">✕</button>
        </div>`).join('')
    }

    const { el, close } = openModal({
      title: `🗺️ ตั้งค่า Mapping — ${c.icon} ${c.label} (${c.v8table})`,
      size: 'md',
      body: `
        <div id="map-rows">${renderRows()}</div>
        <button class="btn btn-xs btn-secondary" id="map-add-row" style="margin-top:6px">+ เพิ่มแถว</button>
      `,
      footer: `<button class="btn btn-secondary" id="map-cancel">ยกเลิก</button><button class="btn btn-primary" id="map-save">💾 บันทึก</button>`
    })

    function syncFromInputs() {
      pairs = [...el.querySelectorAll('.map-row')].map(row => {
        const i = row.dataset.i
        return {
          v8Field: el.querySelector(`.map-v8[data-i="${i}"]`)?.value.trim() || '',
          v1Field: el.querySelector(`.map-v1[data-i="${i}"]`)?.value.trim() || '',
        }
      })
    }
    function rerenderRows() {
      syncFromInputs()
      el.querySelector('#map-rows').innerHTML = renderRows()
      bindRowEvents()
    }
    function bindRowEvents() {
      el.querySelectorAll('.map-row-del').forEach(b => b.addEventListener('click', () => {
        syncFromInputs()
        pairs.splice(+b.dataset.i, 1)
        el.querySelector('#map-rows').innerHTML = renderRows()
        bindRowEvents()
      }))
    }
    bindRowEvents()

    el.querySelector('#map-add-row').addEventListener('click', () => {
      syncFromInputs()
      pairs.push({ v8Field: '', v1Field: '' })
      rerenderRows()
    })
    el.querySelector('#map-cancel').addEventListener('click', close)
    el.querySelector('#map-save').addEventListener('click', async () => {
      syncFromInputs()
      const clean = pairs.filter(p => p.v8Field && p.v1Field)
      try {
        await setDocData('v8_field_mappings', c.id, { pairs: clean, v8table: c.v8table })
        mappings[c.id] = clean
        showToast(`✅ บันทึก Mapping ${c.label} แล้ว (${clean.length} field)`, 'success')
        close(); renderPage()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  renderPage()
}
