/**
 * Certification — ใบรับรองและสอบ
 * Route: /training/certification
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const CERT_STATUS = {
  active:  { label: 'ใช้งาน', color: 'success' },
  expired: { label: 'หมดอายุ', color: 'danger' },
  pending: { label: 'รอสอบ', color: 'warning' },
}

const CERTS = [
  { id: 'C001', name: 'BYD Product Expert', issuer: 'BYD Thailand', level: 'Gold', icon: '🥇', validMonths: 12 },
  { id: 'C002', name: 'EV Technology Specialist', issuer: 'LAMOM Academy', level: 'Silver', icon: '⚡', validMonths: 24 },
  { id: 'C003', name: 'Sales Excellence Level 2', issuer: 'LAMOM Academy', level: 'Certified', icon: '📈', validMonths: 18 },
  { id: 'C004', name: 'Customer Service Pro', issuer: 'Thailand Automotive', level: 'Certified', icon: '🤝', validMonths: 12 },
]

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function CertificationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staffCerts = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { staffCerts = await listDocs('staff_certifications', [], 'expDate', 'asc', 300) } catch (e) { staffCerts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = staffCerts.filter(c => statusFilter === 'all' || c.status === statusFilter)
    const active = staffCerts.filter(c => c.status === 'active').length
    const expired = staffCerts.filter(c => c.status === 'expired').length
    const pending = staffCerts.filter(c => c.status === 'pending').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏆 Certification</div>
            <div class="page-subtitle">ใบรับรองและการสอบ — ติดตามความสำเร็จ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="issue-cert-btn">+ ออกใบรับรอง</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📜 ทั้งหมด', staffCerts.length, 'primary')}
          ${kpi('✅ ใช้งาน', active, 'success')}
          ${kpi('⚠️ หมดอายุ', expired, expired > 0 ? 'danger' : 'secondary')}
          ${kpi('⏳ รอสอบ', pending, pending > 0 ? 'warning' : 'secondary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(CERT_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div class="card" style="overflow:hidden;margin-bottom:14px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">พนักงาน</th>
                <th style="padding:10px 14px;text-align:left">ใบรับรอง</th>
                <th style="padding:10px 10px;text-align:center">คะแนน</th>
                <th style="padding:10px 10px;text-align:center">หมดอายุ</th>
                <th style="padding:10px 14px;text-align:center">สถานะ</th>
                <th style="padding:10px 14px;text-align:center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(sc => {
                const cert = CERTS.find(c => c.id === sc.certId)
                const st = CERT_STATUS[sc.status]
                const daysLeft = sc.expDate ? Math.ceil((new Date(sc.expDate) - new Date()) / 86400000) : null
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 14px;font-weight:600;font-size:0.85rem">${sc.staff}</td>
                  <td style="padding:10px 14px;font-size:0.83rem">
                    <span style="font-size:1.1rem">${cert?.icon}</span> ${cert?.name}
                    <div style="font-size:0.68rem;color:var(--text-muted)">${cert?.issuer} · ${cert?.level}</div>
                  </td>
                  <td style="padding:10px 10px;text-align:center;font-weight:700;color:${sc.score >= 90 ? 'var(--success)' : sc.score >= 80 ? 'var(--primary)' : 'var(--warning)'}">${sc.score !== null ? sc.score + '%' : '-'}</td>
                  <td style="padding:10px 10px;text-align:center;font-size:0.75rem">
                    ${sc.expDate ? `${formatDate(sc.expDate)}<br><span style="color:${daysLeft < 0 ? 'var(--danger)' : daysLeft < 60 ? 'var(--warning)' : 'var(--text-muted)'}">${daysLeft < 0 ? `หมดแล้ว ${Math.abs(daysLeft)} วัน` : `เหลือ ${daysLeft} วัน`}</span>` : '-'}
                  </td>
                  <td style="padding:10px 14px;text-align:center"><span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span></td>
                  <td style="padding:10px 14px;text-align:center">
                    ${sc.status === 'expired' ? `<button class="btn btn-xs btn-warning renew-btn" data-id="${sc.id}">🔄 ต่ออายุ</button>` : ''}
                    ${sc.status === 'pending' ? `<button class="btn btn-xs btn-primary exam-btn" data-id="${sc.id}">📝 บันทึกผล</button>` : ''}
                    ${sc.status === 'active' ? `<button class="btn btn-xs btn-secondary view-btn" data-id="${sc.id}">ดู</button>` : ''}
                  </td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่มีรายการ</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- Available Certs -->
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📚 ใบรับรองที่รองรับ</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
          ${CERTS.map(c => `
            <div class="card" style="padding:12px 14px">
              <div style="font-size:1.4rem">${c.icon}</div>
              <div style="font-weight:700;font-size:0.85rem;margin:4px 0">${c.name}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">${c.issuer} · ${c.level} · ${c.validMonths} เดือน</div>
            </div>
          `).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('issue-cert-btn')?.addEventListener('click', openIssueCert)
    container.querySelectorAll('.renew-btn').forEach(b => b.addEventListener('click', async () => {
      await updateDocData('staff_certifications', b.dataset.id, { status: 'pending', issueDate: null, expDate: null, score: null })
      showToast('✅ ส่งแจ้งเตือนต่ออายุแล้ว', 'success'); await loadData()
    }))
    container.querySelectorAll('.exam-btn').forEach(b => b.addEventListener('click', () => {
      const sc = staffCerts.find(x => x.id === b.dataset.id)
      if (!sc) return
      openModal({
        title: '📝 บันทึกผลสอบ',
        size: 'sm',
        body: `<div class="input-group"><label class="input-label">คะแนน (0-100) *</label><input type="number" class="input" id="exam-score" min="0" max="100" value="85"></div>`,
        async onConfirm() {
          const score = +document.getElementById('exam-score')?.value
          if (score < 0 || score > 100) { showToast('❗ คะแนน 0-100', 'error'); return false }
          if (score >= 70) {
            const cert = CERTS.find(c => c.id === sc.certId)
            await updateDocData('staff_certifications', sc.id, {
              score, status: 'active', issueDate: addDays(0), expDate: addDays((cert?.validMonths || 12) * 30),
            })
            showToast(`🎉 ผ่าน! ${sc.staff} ได้รับใบรับรองแล้ว`, 'success')
          } else {
            showToast(`❌ ไม่ผ่าน คะแนน ${score}% (ต้องการ 70%+)`, 'error')
          }
          await loadData()
        }
      })
    }))
  }

  function openIssueCert() {
    openModal({
      title: '+ ออกใบรับรอง',
      size: 'sm',
      body: `
        <div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">พนักงาน</label>
            <select class="input" id="ic-staff">
              <option value="S001">วิชัย ยอดขาย</option>
              <option value="S002">สุดา มาดี</option>
              <option value="S003">ธนา เก่ง</option>
              <option value="S004">วิทยา ช่าง</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">ใบรับรอง</label>
            <select class="input" id="ic-cert">${CERTS.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">คะแนน (%)</label><input type="number" class="input" id="ic-score" value="85" min="0" max="100"></div>
        </div>
      `,
      async onConfirm() {
        const staffId = document.getElementById('ic-staff')?.value
        const certId = document.getElementById('ic-cert')?.value
        const score = +document.getElementById('ic-score')?.value || 0
        const cert = CERTS.find(c => c.id === certId)
        const existing = staffCerts.find(sc => sc.staffId === staffId && sc.certId === certId)
        if (existing) { showToast('⚠️ มีใบรับรองนี้แล้ว', 'warning'); return false }
        const staffName = document.getElementById('ic-staff')?.selectedOptions[0]?.text || ''
        await createDoc('staff_certifications', {
          staffId, staff: staffName, certId, issueDate: addDays(0),
          expDate: addDays((cert?.validMonths||12)*30), score, status: 'active'
        })
        showToast('✅ ออกใบรับรองแล้ว!', 'success'); await loadData()
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
