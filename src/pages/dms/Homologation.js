/**
 * Homologation Records — มาตรฐานรถยนต์ มอก. / UNECE / ECE ต่อรุ่น
 * Route: /dms/homologation
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_RECORDS = [
  { id:'HM001', model:'BYD Atto 3', vin_prefix:'LGXC4', standard:'มอก.2718 / ECE R100', category:'Battery Safety', status:'valid', issueDate:'2024-06-01', expDate:'2029-06-01', certNo:'TISI-2024-00412', agency:'สมอ.', note:'แบตฯ Blade LFP ผ่านทุกรายการ' },
  { id:'HM002', model:'BYD Atto 3', vin_prefix:'LGXC4', standard:'ECE R94 / R95', category:'Crash Test', status:'valid', issueDate:'2024-06-01', expDate:'2029-06-01', certNo:'ECE-R94-2024-0872', agency:'TUV SUD', note:'Frontal & Side Impact' },
  { id:'HM003', model:'BYD Seal AWD', vin_prefix:'LGXC5', standard:'มอก.2718 / ECE R100', category:'Battery Safety', status:'valid', issueDate:'2024-09-15', expDate:'2029-09-15', certNo:'TISI-2024-00631', agency:'สมอ.', note:'' },
  { id:'HM004', model:'BYD Seal AWD', vin_prefix:'LGXC5', standard:'ECE R48', category:'Lighting', status:'valid', issueDate:'2024-09-15', expDate:'2029-09-15', certNo:'ECE-R48-2024-0991', agency:'TUV Rheinland', note:'DRL + Matrix LED' },
  { id:'HM005', model:'MG ZS EV', vin_prefix:'LSGBC', standard:'มอก.2718 / ECE R100', category:'Battery Safety', status:'expiring', issueDate:'2021-01-10', expDate:'2026-07-10', certNo:'TISI-2021-00109', agency:'สมอ.', note:'ต้องต่ออายุภายใน 30 วัน' },
  { id:'HM006', model:'MG ZS EV', vin_prefix:'LSGBC', standard:'ECE R12', category:'Steering', status:'valid', issueDate:'2021-01-10', expDate:'2026-01-10', certNo:'ECE-R12-2021-0223', agency:'Bureau Veritas', note:'' },
  { id:'HM007', model:'BYD Han', vin_prefix:'LGXC7', standard:'ECE R100 Amend.3', category:'Battery Safety', status:'valid', issueDate:'2025-02-20', expDate:'2030-02-20', certNo:'TISI-2025-00041', agency:'สมอ.', note:'รุ่นใหม่ล่าสุด' },
]

const today = new Date('2026-06-14')
const daysLeft = (ds) => Math.ceil((new Date(ds)-today)/(1000*60*60*24))

const ST = {
  valid:    { label:'ใช้ได้', color:'var(--success)' },
  expiring: { label:'ใกล้หมด', color:'var(--warning)' },
  expired:  { label:'หมดอายุ', color:'var(--danger)' },
}

export default async function HomologationPage(container) {
  const myGen = container.__routerGen
  let records = [...DEMO_RECORDS].map(r => ({ ...r }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('homologations', [], 'expDate', 'asc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `HM${String(i+1).padStart(3,'0')}`,
        model: d.model || '',
        vin_prefix: d.vin_prefix || d.vinPrefix || '',
        standard: d.standard || '',
        category: d.category || '',
        status: d.status || 'valid',
        issueDate: d.issueDate || '',
        expDate: d.expDate || d.expiryDate || '',
        certNo: d.certNo || '',
        agency: d.agency || '',
        note: d.note || '',
      }))
      records = [...mapped, ...DEMO_RECORDS]
      dataSource = 'live'
    }
  } catch {}

  let filterModel = 'all'
  let filterCat = 'all'

  function render() {
    const models = [...new Set(records.map(r => r.model))]
    const cats   = [...new Set(records.map(r => r.category))]
    const rows   = records.filter(r =>
      (filterModel === 'all' || r.model === filterModel) &&
      (filterCat   === 'all' || r.category === filterCat)
    ).map(r => ({
      ...r,
      days: daysLeft(r.expDate),
      effectiveStatus: daysLeft(r.expDate) < 0 ? 'expired' : daysLeft(r.expDate) < 90 ? 'expiring' : 'valid'
    }))

    const expiring = records.filter(r => daysLeft(r.expDate) < 90 && daysLeft(r.expDate) > 0).length
    const expired  = records.filter(r => daysLeft(r.expDate) < 0).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Homologation Records</div>
            <div class="page-subtitle">มาตรฐานรถยนต์ มอก. / ECE / UNECE ต่อรุ่น · ติดตามวันหมดอายุ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-btn">+ เพิ่มใบรับรอง</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📋 ใบรับรองทั้งหมด', records.length+' ใบ', 'var(--primary)')}
          ${sc('✅ ใช้งานได้', (records.length-expiring-expired)+' ใบ', 'var(--success)')}
          ${sc('⚠️ ใกล้หมดอายุ', expiring+' ใบ (<90 วัน)', 'var(--warning)')}
          ${sc('❌ หมดอายุ', expired+' ใบ', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <select class="input" id="sel-model" style="min-width:160px">
            <option value="all">ทุกรุ่น</option>
            ${models.map(m=>`<option ${filterModel===m?'selected':''}>${escHtml(m)}</option>`).join('')}
          </select>
          <select class="input" id="sel-cat" style="min-width:160px">
            <option value="all">ทุกประเภท</option>
            ${cats.map(c=>`<option ${filterCat===c?'selected':''}>${escHtml(c)}</option>`).join('')}
          </select>
        </div>

        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:860px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
              <th style="padding:10px 12px;text-align:left">รุ่นรถ</th>
              <th>มาตรฐาน</th><th>ประเภท</th>
              <th>เลขที่ใบรับรอง</th><th>หน่วยงาน</th>
              <th>วันออก</th><th>วันหมด</th>
              <th style="text-align:center">สถานะ</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${rows.map(r => {
                const s = ST[r.effectiveStatus]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.78rem">
                  <td style="padding:9px 12px;font-weight:700">${escHtml(r.model)}</td>
                  <td style="font-size:0.72rem;color:var(--text-muted)">${escHtml(r.standard)}</td>
                  <td><span style="font-size:0.66rem;background:var(--surface-2);padding:2px 6px;border-radius:8px">${escHtml(r.category)}</span></td>
                  <td style="font-family:monospace;font-size:0.72rem">${escHtml(r.certNo)}</td>
                  <td style="font-size:0.72rem;color:var(--text-muted)">${escHtml(r.agency)}</td>
                  <td style="font-size:0.72rem">${formatDate(r.issueDate)}</td>
                  <td style="font-size:0.72rem;color:${r.days<90?'var(--danger)':'var(--text)'}">${formatDate(r.expDate)}${r.days<90?` <span style="font-size:0.64rem">(${r.days} วัน)</span>`:''}</td>
                  <td style="text-align:center"><span style="font-size:0.64rem;background:${s.color};color:#fff;padding:2px 8px;border-radius:10px">${s.label}</span></td>
                  <td><button class="btn btn-xs btn-secondary detail-btn" data-id="${r.id}" style="font-size:0.7rem">รายละเอียด</button></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('sel-model')?.addEventListener('change', e => { filterModel = e.target.value; render() })
    document.getElementById('sel-cat')?.addEventListener('change', e => { filterCat = e.target.value; render() })
    document.getElementById('add-btn')?.addEventListener('click', openAddCertModal)
    container.querySelectorAll('.detail-btn').forEach(b => b.addEventListener('click', () => {
      const r = records.find(x => x.id === b.dataset.id)
      if (!r) return
      const eff = daysLeft(r.expDate) < 0 ? 'expired' : daysLeft(r.expDate) < 90 ? 'expiring' : 'valid'
      openModal({
        title: '📋 ' + escHtml(r.certNo),
        size: 'sm',
        body: `
          <div style="font-size:0.78rem;margin-bottom:8px"><b>${escHtml(r.model)}</b> — ${escHtml(r.standard)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.76rem;margin-bottom:10px">
            ${[['ประเภท',escHtml(r.category)],['หน่วยงาน',escHtml(r.agency)],['วันออก',formatDate(r.issueDate)],['วันหมด',formatDate(r.expDate)],['VIN Prefix',escHtml(r.vin_prefix)],['สถานะ',ST[eff].label]].map(([k,v])=>`
              <div style="background:var(--surface-2);padding:6px 8px;border-radius:var(--radius-sm)">
                <div style="font-size:0.64rem;color:var(--text-muted)">${k}</div>
                <div style="font-weight:600">${v}</div>
              </div>`).join('')}
          </div>
          ${r.note ? `<div style="background:var(--warning)22;padding:8px 10px;border-radius:var(--radius-sm);font-size:0.76rem">⚠️ ${escHtml(r.note)}</div>` : ''}`,
        confirmText: '📥 Export ใบรับรอง',
        onConfirm() {
          exportToExcel([{
            certNo: r.certNo, model: r.model, standard: r.standard, category: r.category,
            agency: r.agency, issueDate: formatDate(r.issueDate), expDate: formatDate(r.expDate),
            status: ST[r.status]?.label || r.status, vin_prefix: r.vin_prefix, note: r.note || '',
          }], `Homologation_${r.certNo}.xlsx`, 'Certificate')
          showToast(`📥 Export ใบรับรอง ${r.certNo} แล้ว`, 'success')
        }
      })
    }))
  }

  function openAddCertModal() {
    const today = new Date().toISOString().slice(0, 10)
    const in5y  = new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().slice(0, 10)
    const CATS  = ['Battery Safety','Crash Test','Lighting','Steering','Brakes','EMC','ADAS']
    const STDS  = ['มอก.2718 / ECE R100','ECE R94 / R95','ECE R48','ECE R12','ECE R79','ECE R100 Amend.3']
    openModal({
      title: '📋 เพิ่มใบรับรองมาตรฐาน',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่นรถ *</label>
              <input id="hm-model" class="input" placeholder="BYD Atto 3 / MG ZS EV..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">VIN Prefix</label>
              <input id="hm-vin" class="input" placeholder="LGXC4..."></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">มาตรฐาน</label>
              <select id="hm-std" class="input">
                ${STDS.map(s=>`<option>${s}</option>`).join('')}
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภท</label>
              <select id="hm-cat" class="input">
                ${CATS.map(c=>`<option>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">เลขที่ใบรับรอง *</label>
              <input id="hm-cert" class="input" placeholder="TISI-2026-00XXX"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">หน่วยงาน</label>
              <input id="hm-agency" class="input" placeholder="สมอ. / TUV SUD..."></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันออกใบรับรอง</label>
              <input id="hm-issue" type="date" class="input" value="${today}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันหมดอายุ</label>
              <input id="hm-exp" type="date" class="input" value="${in5y}"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">หมายเหตุ</label>
            <input id="hm-note" class="input" placeholder="รายละเอียดเพิ่มเติม..."></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="hm-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('hm-save')?.addEventListener('click', () => {
      const model = document.getElementById('hm-model')?.value.trim()
      const certNo = document.getElementById('hm-cert')?.value.trim()
      if (!model || !certNo) { showToast('⚠️ กรุณากรอกรุ่นรถและเลขที่ใบรับรอง', 'warning'); return }
      records.push({
        id: 'HM' + String(records.length + 1).padStart(3,'0'),
        model, certNo,
        vin_prefix: document.getElementById('hm-vin')?.value.trim() || '-',
        standard:   document.getElementById('hm-std')?.value || STDS[0],
        category:   document.getElementById('hm-cat')?.value || CATS[0],
        status: 'valid',
        issueDate:  document.getElementById('hm-issue')?.value || today,
        expDate:    document.getElementById('hm-exp')?.value || in5y,
        agency:     document.getElementById('hm-agency')?.value.trim() || '-',
        note:       document.getElementById('hm-note')?.value.trim() || '',
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ เพิ่มใบรับรอง ' + certNo + ' แล้ว', 'success')
      render()
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.3rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
