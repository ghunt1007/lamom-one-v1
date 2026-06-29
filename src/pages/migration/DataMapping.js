/**
 * Data Mapping — จับคู่ข้อมูล V8 → V1
 * Route: /migration/mapping
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const MODULE_STATUS = {
  pending:    { label: 'รอดำเนินการ', color: 'secondary' },
  mapping:    { label: 'กำลัง Map', color: 'warning' },
  ready:      { label: 'พร้อมนำเข้า', color: 'primary' },
  imported:   { label: 'นำเข้าแล้ว', color: 'success' },
  error:      { label: 'มีข้อผิดพลาด', color: 'danger' },
}

const V8_MODULES = [
  { id: 'MG01', v8Name: 'ลูกค้า (Customers)', v1Name: 'CRM Customers', records: 1842, mapped: 1842, issues: 0, status: 'imported', fields: 24, mappedFields: 24 },
  { id: 'MG02', v8Name: 'Lead (Prospects)', v1Name: 'CRM Leads', records: 584, mapped: 584, issues: 0, status: 'imported', fields: 18, mappedFields: 18 },
  { id: 'MG03', v8Name: 'สต็อกรถ (Vehicle Stock)', v1Name: 'DMS Stock', records: 47, mapped: 47, issues: 0, status: 'imported', fields: 32, mappedFields: 32 },
  { id: 'MG04', v8Name: 'Job Card (Service Jobs)', v1Name: 'Service Jobs', records: 3241, mapped: 3210, issues: 31, status: 'imported', fields: 28, mappedFields: 26 },
  { id: 'MG05', v8Name: 'Invoice', v1Name: 'Finance Invoice', records: 2180, mapped: 2180, issues: 0, status: 'imported', fields: 20, mappedFields: 20 },
  { id: 'MG06', v8Name: 'พนักงาน (Staff)', v1Name: 'HR Staff', records: 28, mapped: 28, issues: 0, status: 'imported', fields: 35, mappedFields: 35 },
  { id: 'MG07', v8Name: 'คอมมิชชั่น (Commission)', v1Name: 'Finance Commission', records: 456, mapped: 450, issues: 6, status: 'ready', fields: 12, mappedFields: 11 },
  { id: 'MG08', v8Name: 'ประกัน (Insurance)', v1Name: 'Insurance Policies', records: 892, mapped: 0, issues: 0, status: 'mapping', fields: 22, mappedFields: 15 },
  { id: 'MG09', v8Name: 'KPI เก่า', v1Name: 'Analytics KPI', records: 120, mapped: 0, issues: 0, status: 'pending', fields: 8, mappedFields: 0 },
  { id: 'MG10', v8Name: 'รายจ่าย (Expense)', v1Name: 'HR Expense Claims', records: 780, mapped: 0, issues: 0, status: 'pending', fields: 15, mappedFields: 0 },
]

export default async function DataMappingPage(container) {
  let modules = V8_MODULES.map(m => ({ ...m }))

  function renderPage() {
    const imported = modules.filter(m => m.status === 'imported').length
    const totalRecords = modules.reduce((a, m) => a + m.records, 0)
    const importedRecords = modules.filter(m => m.status === 'imported').reduce((a, m) => a + m.mapped, 0)
    const issues = modules.reduce((a, m) => a + m.issues, 0)
    const overallPct = Math.round(importedRecords / totalRecords * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗺️ Data Mapping</div>
            <div class="page-subtitle">จับคู่และนำเข้าข้อมูลจาก LAMOM CRM V8 → LAMOM ONE V1</div>
          </div>
        </div>

        <!-- Overall progress -->
        <div class="card" style="padding:20px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:24px">
            <div style="text-align:center;min-width:100px">
              <div style="font-size:2.5rem;font-weight:900;color:var(--primary)">${overallPct}%</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">ความคืบหน้า Migration</div>
            </div>
            <div style="flex:1">
              <div style="background:var(--surface-2);border-radius:6px;height:14px;margin-bottom:10px">
                <div style="width:${overallPct}%;background:linear-gradient(90deg,var(--primary),var(--success));height:14px;border-radius:6px"></div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
                <div style="text-align:center"><div style="font-size:0.68rem;color:var(--text-muted)">Modules ทั้งหมด</div><div style="font-weight:700">${modules.length}</div></div>
                <div style="text-align:center"><div style="font-size:0.68rem;color:var(--success)">นำเข้าแล้ว</div><div style="font-weight:700;color:var(--success)">${imported}</div></div>
                <div style="text-align:center"><div style="font-size:0.68rem;color:var(--text-muted)">Records รวม</div><div style="font-weight:700">${totalRecords.toLocaleString()}</div></div>
                <div style="text-align:center"><div style="font-size:0.68rem;color:var(--danger)">ปัญหา</div><div style="font-weight:700;color:${issues>0?'var(--danger)':'inherit'}">${issues}</div></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">Module V8</th>
                <th style="padding:10px 14px;text-align:left">Module V1</th>
                <th style="padding:10px 14px;text-align:center">สถานะ</th>
                <th style="padding:10px 14px;text-align:right">Records</th>
                <th style="padding:10px 14px;text-align:center">Fields</th>
                <th style="padding:10px 14px;text-align:center">ความคืบหน้า</th>
                <th style="padding:10px 14px;text-align:center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${modules.map(m => {
                const st = MODULE_STATUS[m.status]
                const pct = m.records > 0 ? Math.round(m.mapped / m.records * 100) : 0
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 14px;font-size:0.83rem;font-weight:600">${m.v8Name}</td>
                  <td style="padding:10px 14px;font-size:0.83rem;color:var(--text-muted)">→ ${m.v1Name}</td>
                  <td style="padding:10px 14px;text-align:center"><span class="badge badge-${st?.color}" style="font-size:0.65rem">${st?.label}</span></td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.8rem">
                    ${m.mapped.toLocaleString()} / ${m.records.toLocaleString()}
                    ${m.issues > 0 ? `<br><span style="color:var(--danger);font-size:0.68rem">⚠️ ${m.issues} issues</span>` : ''}
                  </td>
                  <td style="padding:10px 14px;text-align:center;font-size:0.8rem">${m.mappedFields}/${m.fields}</td>
                  <td style="padding:10px 14px;min-width:120px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="flex:1;background:var(--surface-2);border-radius:3px;height:6px">
                        <div style="width:${pct}%;background:${pct>=100?'var(--success)':pct>=50?'var(--primary)':'var(--warning)'};height:6px;border-radius:3px"></div>
                      </div>
                      <span style="font-size:0.7rem;min-width:30px;text-align:right">${pct}%</span>
                    </div>
                  </td>
                  <td style="padding:10px 14px;text-align:center">
                    <div style="display:flex;gap:4px;justify-content:center">
                      <button class="btn btn-xs btn-secondary view-map-btn" data-id="${m.id}">ดู</button>
                      ${m.status === 'pending' ? `<button class="btn btn-xs btn-primary start-btn" data-id="${m.id}">เริ่ม</button>` : ''}
                      ${m.status === 'ready' ? `<button class="btn btn-xs btn-success import-btn" data-id="${m.id}">Import</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.view-map-btn').forEach(b => b.addEventListener('click', () => {
      const m = modules.find(x => x.id === b.dataset.id); if (m) openDetail(m)
    }))
    container.querySelectorAll('.start-btn').forEach(b => b.addEventListener('click', () => {
      const m = modules.find(x => x.id === b.dataset.id)
      if (m) { m.status = 'mapping'; showToast(`🗺️ เริ่ม Mapping ${m.v8Name}`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.import-btn').forEach(b => b.addEventListener('click', () => {
      const m = modules.find(x => x.id === b.dataset.id)
      if (m) { m.status = 'imported'; m.mapped = m.records; showToast(`✅ Import ${m.v8Name} แล้ว!`, 'success'); renderPage() }
    }))
  }

  function openDetail(m) {
    const st = MODULE_STATUS[m.status]
    openModal({
      title: `🗺️ ${m.id} — ${m.v8Name}`,
      size: 'md',
      body: `
        <div style="margin-bottom:12px"><span class="badge badge-${st?.color}">${st?.label}</span></div>
        <div style="display:flex;gap:8px;margin-bottom:12px;font-size:0.85rem;font-weight:600">
          <span>V8: ${m.v8Name}</span> <span style="color:var(--text-muted)">→</span> <span>V1: ${m.v1Name}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          ${kpi('Records ทั้งหมด', m.records.toLocaleString(), 'primary')}
          ${kpi('นำเข้าแล้ว', m.mapped.toLocaleString(), 'success')}
          ${kpi('Fields V8', m.fields, 'secondary')}
          ${kpi('Fields Map', m.mappedFields, 'primary')}
        </div>
        ${m.issues > 0 ? `<div style="padding:10px;background:rgba(239,68,68,.1);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--danger)">⚠️ พบปัญหา ${m.issues} รายการ — ต้องตรวจสอบ Manual</div>` : ''}
      `
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
