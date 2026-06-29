/**
 * EV Diagnostic — วินิจฉัยระบบ EV
 * Route: /service/ev-diagnostic
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DIAG_STATUS = {
  normal:   { label: 'ปกติ', color: 'success', icon: '✅' },
  warning:  { label: 'ต้องดูแล', color: 'warning', icon: '⚠️' },
  critical: { label: 'วิกฤต', color: 'danger', icon: '❗' },
  unknown:  { label: 'ไม่ทราบ', color: 'secondary', icon: '❓' },
}

const FAULT_CODES = {
  'P0A80': { desc: 'Battery Pack Degradation', severity: 'warning' },
  'P0AFA': { desc: 'Battery System Voltage Low', severity: 'critical' },
  'P1A0D': { desc: 'OBC (On-Board Charger) Fault', severity: 'warning' },
  'P1C00': { desc: 'Motor Controller Fault', severity: 'critical' },
  'P0562': { desc: '12V System Voltage Low', severity: 'warning' },
  'C1A00': { desc: 'BMS Communication Error', severity: 'warning' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function addMins(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const DEMO_SCANS = [
  {
    id: 'EV001', vehiclePlate: 'กก 1234', vehicleModel: 'BYD Seal AWD', vin: 'LBWAB2EB7PD001002',
    mileage: 12500, customerId: 'C001', customerName: 'วิชาญ มีโชค', technicianName: 'วิทยา ช่างไฟ',
    scanDate: addMins(30), status: 'normal', faultCodes: [],
    data: { battSOC: 78, battSOH: 97, cellMinV: 3.26, cellMaxV: 3.28, battTemp: 28, range: 425, odometer: 12500, chargeCount: 48, dcFastCount: 8, motorTemp: 42, motorEfficiency: 96 },
    notes: 'แบตอยู่ในสภาพดีมาก'
  },
  {
    id: 'EV002', vehiclePlate: 'ขข 5678', vehicleModel: 'MG ZS EV', vin: 'LSJWSRAR7NE001008',
    mileage: 31200, customerId: 'C002', customerName: 'อรนุช สาวสวย', technicianName: 'วิทยา ช่างไฟ',
    scanDate: addMins(120), status: 'warning', faultCodes: ['P0A80', 'P0562'],
    data: { battSOC: 65, battSOH: 88, cellMinV: 3.18, cellMaxV: 3.31, battTemp: 35, range: 320, odometer: 31200, chargeCount: 142, dcFastCount: 45, motorTemp: 55, motorEfficiency: 91 },
    notes: 'SOH ต่ำลง — ควรตรวจเช็ก DC fast charge'
  },
  {
    id: 'EV003', vehiclePlate: 'คค 9012', vehicleModel: 'BYD Atto 3', vin: 'LBWAB2EB7PD001003',
    mileage: 3100, customerId: 'C003', customerName: 'ธีรยุทธ เก่งกาจ', technicianName: 'สมชาย ช่างฝีมือ',
    scanDate: addMins(60), status: 'critical', faultCodes: ['P1A0D'],
    data: { battSOC: 55, battSOH: 99, cellMinV: 3.22, cellMaxV: 3.24, battTemp: 29, range: 380, odometer: 3100, chargeCount: 12, dcFastCount: 2, motorTemp: 38, motorEfficiency: 97 },
    notes: 'OBC fault — ชาร์จไม่ได้ AC ต้องซ่อม'
  },
]

export default async function EVDiagnosticPage(container) {
  let scans = DEMO_SCANS.map(s => ({ ...s }))
  let statusFilter = 'all'

  function renderPage() {
    const list = scans.filter(s => statusFilter === 'all' || s.status === statusFilter)
    const critical = scans.filter(s => s.status === 'critical').length
    const warnings = scans.filter(s => s.status === 'warning').length
    const normals = scans.filter(s => s.status === 'normal').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ EV Diagnostic</div>
            <div class="page-subtitle">วินิจฉัยและตรวจสอบระบบ EV — Battery / Motor / Charging</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-scan-btn">+ สแกนรถใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📊 สแกนทั้งหมด', scans.length, 'primary')}
          ${kpi('✅ ปกติ', normals, 'success')}
          ${kpi('⚠️ ต้องดูแล', warnings, warnings > 0 ? 'warning' : 'secondary')}
          ${kpi('❗ วิกฤต', critical, critical > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(DIAG_STATUS).filter(([k]) => k !== 'unknown').map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">
          ${list.map(s => {
            const st = DIAG_STATUS[s.status]
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(s.vehicleModel)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(s.vehiclePlate)} · ${escHtml(s.customerName)}</div>
                </div>
                <div style="text-align:right">
                  <span class="badge badge-${st?.color}">${st?.icon} ${st?.label}</span>
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${timeAgo(s.scanDate)}</div>
                </div>
              </div>

              <!-- Key EV metrics -->
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">
                ${evMetric('🔋 SOC', s.data.battSOC + '%', s.data.battSOC >= 50 ? 'success' : 'warning')}
                ${evMetric('❤️ SOH', s.data.battSOH + '%', s.data.battSOH >= 90 ? 'success' : s.data.battSOH >= 80 ? 'warning' : 'danger')}
                ${evMetric('🛣 พิสัย', s.data.range + ' กม.', 'primary')}
              </div>

              <!-- SOH bar -->
              <div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:2px">
                  <span style="color:var(--text-muted)">Battery Health</span>
                  <span style="font-weight:700;color:${s.data.battSOH>=90?'var(--success)':s.data.battSOH>=80?'var(--warning)':'var(--danger)'}">${s.data.battSOH}%</span>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:6px">
                  <div style="width:${s.data.battSOH}%;background:${s.data.battSOH>=90?'var(--success)':s.data.battSOH>=80?'var(--warning)':'var(--danger)'};height:6px;border-radius:3px"></div>
                </div>
              </div>

              ${s.faultCodes.length ? `<div style="margin-bottom:8px">
                ${s.faultCodes.map(fc => {
                  const f = FAULT_CODES[fc]
                  return `<div style="padding:4px 8px;background:rgba(239,68,68,.1);border-radius:var(--radius-sm);font-size:0.75rem;color:var(--danger);margin-bottom:3px">${fc}: ${f?.desc||'Unknown fault'}</div>`
                }).join('')}
              </div>` : ''}

              <button class="btn btn-xs btn-secondary view-scan-btn" data-id="${s.id}" style="width:100%">ดูรายละเอียด</button>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('new-scan-btn')?.addEventListener('click', openNewScan)
    container.querySelectorAll('.view-scan-btn').forEach(b => b.addEventListener('click', () => {
      const s = scans.find(x => x.id === b.dataset.id); if (s) openScanDetail(s)
    }))
  }

  function openScanDetail(s) {
    const st = DIAG_STATUS[s.status]
    const d = s.data
    openModal({
      title: '⚡ ' + escHtml(s.id) + ' — ' + escHtml(s.vehicleModel) + ' ' + escHtml(s.vehiclePlate),
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          ${kpi('🔋 SOC', d.battSOC + '%', d.battSOC >= 50 ? 'success' : 'warning')}
          ${kpi('❤️ SOH', d.battSOH + '%', d.battSOH >= 90 ? 'success' : d.battSOH >= 80 ? 'warning' : 'danger')}
          ${kpi('🌡 แบตอุณหภูมิ', d.battTemp + '°C', d.battTemp <= 35 ? 'success' : 'warning')}
          ${kpi('🛣 พิสัย', d.range + ' กม.', 'primary')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">แบตเตอรี่</div>
            ${row('Cell Vmin', d.cellMinV + ' V')}${row('Cell Vmax', d.cellMaxV + ' V')}${row('จำนวนชาร์จ', d.chargeCount + ' ครั้ง')}${row('DC Fast Charge', d.dcFastCount + ' ครั้ง')}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">มอเตอร์</div>
            ${row('อุณหภูมิมอเตอร์', d.motorTemp + '°C')}${row('ประสิทธิภาพ', d.motorEfficiency + '%')}${row('ระยะทาง', d.odometer.toLocaleString() + ' กม.')}
          </div>
        </div>
        ${s.faultCodes.length ? `
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px;color:var(--danger)">❗ Fault Codes</div>
          ${s.faultCodes.map(fc => {
            const f = FAULT_CODES[fc]
            return `<div style="padding:8px 10px;background:rgba(239,68,68,.1);border-radius:var(--radius-sm);margin-bottom:6px">
              <div style="font-family:monospace;font-weight:700;color:var(--danger)">${fc}</div>
              <div style="font-size:0.8rem">${f?.desc||'Unknown fault'}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">ความรุนแรง: ${f?.severity}</div>
            </div>`
          }).join('')}
        ` : `<div style="padding:10px;background:rgba(34,197,94,.1);border-radius:var(--radius-sm);font-size:0.83rem;color:var(--success)">✅ ไม่พบ Fault Codes</div>`}
        ${s.notes ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📌 ${escHtml(s.notes)}</div>` : ''}
      `
    })
  }

  function openNewScan() {
    openModal({
      title: '+ สแกน EV ใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ทะเบียน *</label><input class="input" id="ef-plate" placeholder="กก 1234"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="ef-model" placeholder="BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">ชื่อลูกค้า</label><input class="input" id="ef-customer" placeholder="ชื่อลูกค้า"></div>
          <div class="input-group"><label class="input-label">ช่างผู้สแกน</label><input class="input" id="ef-tech" placeholder="ชื่อช่าง"></div>
          <div class="input-group"><label class="input-label">SOC (%)</label><input type="number" class="input" id="ef-soc" min="0" max="100" value="80"></div>
          <div class="input-group"><label class="input-label">SOH (%)</label><input type="number" class="input" id="ef-soh" min="0" max="100" value="98"></div>
          <div class="input-group"><label class="input-label">ระยะทาง (กม.)</label><input type="number" class="input" id="ef-odo" placeholder="12500"></div>
          <div class="input-group"><label class="input-label">พิสัยที่เหลือ (กม.)</label><input type="number" class="input" id="ef-range" placeholder="420"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">Fault Codes (คั่นด้วยเครื่องหมายจุลภาค)</label><input class="input" id="ef-faults" placeholder="P0A80, P0562 (ถ้าไม่มีให้เว้นว่าง)"></div>
        </div>
      `,
      onConfirm() {
        const plate = document.getElementById('ef-plate')?.value?.trim()
        if (!plate) { showToast('❗ กรุณากรอกทะเบียน', 'error'); return }
        const soc = +document.getElementById('ef-soc')?.value || 80
        const soh = +document.getElementById('ef-soh')?.value || 98
        const faults = (document.getElementById('ef-faults')?.value || '').split(',').map(f => f.trim()).filter(f => f && FAULT_CODES[f])
        const status = faults.some(f => FAULT_CODES[f]?.severity === 'critical') ? 'critical' : faults.length > 0 ? 'warning' : 'normal'
        scans.unshift({
          id: `EV${String(scans.length+1).padStart(3,'0')}`,
          vehiclePlate: plate, vehicleModel: document.getElementById('ef-model')?.value||'',
          vin: '', mileage: +document.getElementById('ef-odo')?.value||0,
          customerId: '', customerName: document.getElementById('ef-customer')?.value||'',
          technicianName: document.getElementById('ef-tech')?.value||'',
          scanDate: new Date().toISOString(), status, faultCodes: faults,
          data: { battSOC: soc, battSOH: soh, cellMinV: 3.24, cellMaxV: 3.26, battTemp: 29, range: +document.getElementById('ef-range')?.value||400, odometer: +document.getElementById('ef-odo')?.value||0, chargeCount: 0, dcFastCount: 0, motorTemp: 40, motorEfficiency: 95 },
          notes: ''
        })
        showToast('✅ สแกน EV เรียบร้อย!', status === 'critical' ? 'error' : status === 'warning' ? 'warning' : 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function evMetric(l, v, c) { return `<div style="text-align:center;padding:8px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.68rem;color:var(--text-muted)">${l}</div><div style="font-size:0.9rem;font-weight:800;color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
