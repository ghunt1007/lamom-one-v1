/**
 * PDPA Consent — จัดการความยินยอมข้อมูลส่วนบุคคล
 * Route: /quality/pdpa
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const CONSENT_TYPES = {
  marketing: { label: 'การตลาด/โปรโมชั่น', icon: '📣' },
  analytics: { label: 'วิเคราะห์พฤติกรรม', icon: '📊' },
  third_party: { label: 'แชร์ให้พาร์ทเนอร์ (ประกัน/ไฟแนนซ์)', icon: '🤝' },
  service: { label: 'แจ้งเตือนบริการ (จำเป็น)', icon: '🔧' },
}

const DEMO_CONSENTS = [
  { id: 'PD001', customer: 'สมชาย ใจดี', phone: '085-111', consents: { marketing: true, analytics: true, third_party: true, service: true }, updatedAt: addDays(-30), channel: 'เซ็นเอกสาร' },
  { id: 'PD002', customer: 'มาลี สุขใจ', phone: '086-222', consents: { marketing: true, analytics: false, third_party: false, service: true }, updatedAt: addDays(-60), channel: 'LINE' },
  { id: 'PD003', customer: 'ธนพล เที่ยงตรง', phone: '087-333', consents: { marketing: false, analytics: false, third_party: false, service: true }, updatedAt: addDays(-10), channel: 'เว็บไซต์' },
  { id: 'PD004', customer: 'อรทัย ตั้งใจ', phone: '088-444', consents: { marketing: true, analytics: true, third_party: false, service: true }, updatedAt: addDays(-90), channel: 'เซ็นเอกสาร' },
]

const DSR_REQUESTS = [
  { id: 'DSR01', customer: 'วิรัช เก่งมาก', type: 'ขอสำเนาข้อมูล', status: 'pending', received: addDays(-2), deadline: addDays(28) },
  { id: 'DSR02', customer: 'ชาตรี เข้มแข็ง', type: 'ขอลบข้อมูล', status: 'processing', received: addDays(-10), deadline: addDays(20) },
  { id: 'DSR03', customer: 'นภา ห่างหาย', type: 'ถอนความยินยอมการตลาด', status: 'done', received: addDays(-40), deadline: addDays(-10) },
]

const DSR_STATUS = {
  pending:    { label: 'รอดำเนินการ', color: 'warning', icon: '⏳' },
  processing: { label: 'กำลังทำ', color: 'primary', icon: '🔄' },
  done:       { label: 'เสร็จแล้ว', color: 'success', icon: '✅' },
}

export default async function PdpaConsentPage(container) {
  let consents = DEMO_CONSENTS.map(c => ({ ...c, consents: { ...c.consents } }))
  let requests = DSR_REQUESTS.map(r => ({ ...r }))
  let search = ''

  function renderPage() {
    const list = consents.filter(c => search === '' || c.customer.toLowerCase().includes(search))
    const marketingOk = consents.filter(c => c.consents.marketing).length
    const pendingDsr = requests.filter(r => r.status !== 'done').length
    const urgentDsr = requests.filter(r => r.status !== 'done' && r.deadline <= addDays(7))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔒 PDPA Consent</div>
            <div class="page-subtitle">ความยินยอมข้อมูลส่วนบุคคล + คำขอใช้สิทธิ (DSR)</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ลูกค้าในระบบ', consents.length, 'primary')}
          ${kpi('📣 ยินยอมการตลาด', marketingOk + '/' + consents.length, 'success')}
          ${kpi('📨 DSR ค้าง', pendingDsr, pendingDsr > 0 ? 'warning' : 'success')}
          ${kpi('⏰ ใกล้ครบ 30 วัน', urgentDsr.length, urgentDsr.length > 0 ? 'danger' : 'success')}
        </div>

        ${urgentDsr.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⏰ <strong>กฎหมายกำหนดตอบใน 30 วัน:</strong> ${urgentDsr.map(r => `${r.customer} (${r.type}) ครบกำหนด ${formatDate(r.deadline)}`).join(' · ')}
          </div>
        ` : ''}

        <!-- DSR Requests -->
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📨 คำขอใช้สิทธิของเจ้าของข้อมูล (DSR)</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${requests.map(r => {
            const rs = DSR_STATUS[r.status]
            return `<div class="card" style="padding:11px 14px;display:flex;justify-content:space-between;align-items:center;border-left:3px solid var(--${rs?.color})">
              <div>
                <div style="font-weight:600;font-size:0.83rem">${r.customer} — ${r.type}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">รับเรื่อง ${formatDate(r.received)} · ครบกำหนด ${formatDate(r.deadline)}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span class="badge badge-${rs?.color}" style="font-size:0.62rem">${rs?.icon} ${rs?.label}</span>
                ${r.status === 'pending' ? `<button class="btn btn-xs btn-primary start-dsr-btn" data-id="${r.id}">🔄 เริ่มทำ</button>` : ''}
                ${r.status === 'processing' ? `<button class="btn btn-xs btn-success done-dsr-btn" data-id="${r.id}">✅ เสร็จ</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>

        <!-- Consent matrix -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">✅ ทะเบียนความยินยอม</div>
          <input class="input" id="search-input" placeholder="ค้นหาลูกค้า..." value="${search}" style="width:180px;padding:5px 10px;font-size:0.78rem">
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
                    <div style="font-weight:600">${c.customer}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">📞 ${c.phone} · ผ่าน ${c.channel}</div>
                  </td>
                  ${Object.keys(CONSENT_TYPES).map(k => `
                    <td style="padding:8px 6px;text-align:center">
                      <button class="consent-toggle" data-id="${c.id}" data-k="${k}" ${k==='service'?'disabled title="จำเป็นต่อการให้บริการ"':''} style="background:none;border:none;cursor:${k==='service'?'not-allowed':'pointer'};font-size:0.9rem">
                        ${c.consents[k] ? '✅' : '❌'}
                      </button>
                    </td>
                  `).join('')}
                  <td style="padding:8px 10px;font-size:0.68rem;color:var(--text-muted);text-align:center">${timeAgo(c.updatedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;padding-left:4px">💡 คลิก ✅/❌ เพื่อบันทึกการเปลี่ยนความยินยอม (ต้องมีหลักฐานจากลูกค้า) · "แจ้งเตือนบริการ" เป็นฐานสัญญา ถอนไม่ได้</p>
      </div>
    `

    document.getElementById('search-input')?.addEventListener('input', e => { search = e.target.value.toLowerCase(); renderPage() })
    container.querySelectorAll('.consent-toggle:not([disabled])').forEach(b => b.addEventListener('click', () => {
      const c = consents.find(x => x.id === b.dataset.id)
      if (c) {
        c.consents[b.dataset.k] = !c.consents[b.dataset.k]
        c.updatedAt = new Date().toISOString()
        showToast('🔒 บันทึกการเปลี่ยนความยินยอม (เก็บ log ตามกฎหมาย)', 'primary'); renderPage()
      }
    }))
    container.querySelectorAll('.start-dsr-btn').forEach(b => b.addEventListener('click', () => {
      const r = requests.find(x => x.id === b.dataset.id); if (r) { r.status = 'processing'; renderPage() }
    }))
    container.querySelectorAll('.done-dsr-btn').forEach(b => b.addEventListener('click', () => {
      const r = requests.find(x => x.id === b.dataset.id); if (r) { r.status = 'done'; showToast('✅ ปิดคำขอ DSR แล้ว — แจ้งลูกค้าทางอีเมล', 'success'); renderPage() }
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
