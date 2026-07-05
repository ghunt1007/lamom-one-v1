import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const JOB_STATUS = {
  open:    { label: 'รับสมัคร', color: 'success' },
  closed:  { label: 'ปิด', color: 'secondary' },
  hold:    { label: 'Hold', color: 'warning' },
  filled:  { label: 'ได้คนแล้ว', color: 'primary' },
}

const APP_STATUS = {
  new:        { label: 'ใหม่', color: 'primary' },
  screening:  { label: 'คัดกรอง', color: 'accent' },
  interview1: { label: 'สัมภาษณ์รอบ 1', color: 'warning' },
  interview2: { label: 'สัมภาษณ์รอบ 2', color: 'warning' },
  offer:      { label: 'เสนอเงิน', color: 'success' },
  hired:      { label: 'รับเข้าทำงาน', color: 'success' },
  rejected:   { label: 'ปฏิเสธ', color: 'danger' },
  withdrew:   { label: 'ถอนใบสมัคร', color: 'secondary' },
}

const DEPARTMENTS = ['ฝ่ายขาย', 'ฝ่ายบริการ', 'ฝ่ายการตลาด', 'ฝ่ายการเงิน', 'ฝ่าย HR', 'ฝ่าย IT', 'ฝ่ายบริหาร']

export default async function RecruitmentPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let tab = 'jobs'
  let jobFilter = 'all'
  let jobs = []
  let applicants = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      jobs = await listDocs('recruitment_jobs', [], 'openDate', 'desc', 200)
      applicants = await listDocs('recruitment_applicants', [], 'appliedDate', 'desc', 500)
    } catch (e) { /* keep whatever loaded */ }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const openJobs = jobs.filter(j => j.status === 'open').length
    const totalApps = applicants.length
    const inProcess = applicants.filter(a => !['rejected','withdrew','hired'].includes(a.status)).length
    const hiredCount = applicants.filter(a => a.status === 'hired').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👔 Recruitment</div>
            <div class="page-subtitle">จัดการตำแหน่งงานว่างและใบสมัคร</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-job-btn">+ เปิดตำแหน่งงาน</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('📋 ตำแหน่งเปิด', openJobs, 'success')}
          ${kpi('👥 ใบสมัครทั้งหมด', totalApps, 'primary')}
          ${kpi('⏳ อยู่ระหว่างพิจารณา', inProcess, 'warning')}
          ${kpi('✅ รับเข้าทำงาน', hiredCount, 'success')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[['jobs','📋 ตำแหน่งงาน'],['applicants','👥 ใบสมัครทั้งหมด'],['pipeline','🔄 Pipeline']].map(([t,l]) => `<button class="btn btn-sm ${tab===t?'btn-primary':'btn-secondary'} tab-btn" data-t="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'jobs' ? renderJobs() : tab === 'applicants' ? renderApplicants() : renderPipeline()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('add-job-btn')?.addEventListener('click', () => openJobForm(null))
    document.getElementById('export-btn')?.addEventListener('click', () => { exportToExcel(applicants.map(a => ({ ID: a.id, ชื่อ: a.name, ตำแหน่ง: jobs.find(j=>j.id===a.jobId)?.title||'', วันที่สมัคร: a.appliedDate, สถานะ: APP_STATUS[a.status]?.label, คะแนน: a.score||'-' })), 'recruitment'); showToast('📥 Export แล้ว!', 'success') })
    document.getElementById('job-status-filter')?.addEventListener('change', e => { jobFilter = e.target.value; renderPage() })
    document.querySelectorAll('.open-job-btn').forEach(b => b.addEventListener('click', () => { const j = jobs.find(x => x.id === b.dataset.id); if (j) openJobDetail(j) }))
    document.querySelectorAll('.open-app-btn').forEach(b => b.addEventListener('click', () => { const a = applicants.find(x => x.id === b.dataset.id); if (a) openApplicantDetail(a) }))
    document.querySelectorAll('.app-status-btn').forEach(b => b.addEventListener('click', async () => {
      const a = applicants.find(x => x.id === b.dataset.id)
      if (!a) return
      await moveApplicant(a, b.dataset.status)
    }))
    document.querySelectorAll('.add-app-btn').forEach(b => b.addEventListener('click', () => { openApplicantForm(b.dataset.id) }))
  }

  async function moveApplicant(a, newStatus) {
    await updateDocData('recruitment_applicants', a.id, { status: newStatus })
    if (newStatus === 'hired') {
      const j = jobs.find(x => x.id === a.jobId)
      if (j) {
        const filled = (j.filled||0) + 1
        await updateDocData('recruitment_jobs', j.id, { filled, status: filled >= 1 ? 'filled' : j.status })
      }
    }
    showToast(`✅ อัปเดตสถานะ ${a.name} แล้ว`, 'success')
    await loadData()
  }

  function renderJobs() {
    const filtered = jobs.filter(j => jobFilter === 'all' || j.status === jobFilter)
    return `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <select class="input" id="job-status-filter" style="width:160px">
          <option value="all">สถานะทั้งหมด</option>
          ${Object.entries(JOB_STATUS).map(([k,v]) => `<option value="${k}" ${jobFilter===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${filtered.map(j => {
          const st = JOB_STATUS[j.status]
          const jApps = applicants.filter(a => a.jobId === j.id)
          return `<div class="card" style="padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span style="font-weight:700;font-size:0.95rem">${escHtml(j.title)}</span>
                  <span class="badge badge-${st.color}">${st.label}</span>
                </div>
                <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(j.dept)} · ${escHtml(j.location)} · ${j.type === 'fulltime' ? 'เต็มเวลา' : 'พาร์ทไทม์'}</div>
                <div style="font-size:0.82rem;margin-top:6px">💰 ${j.salaryMin.toLocaleString()} – ${j.salaryMax.toLocaleString()} บาท/เดือน</div>
                <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">ปิดรับ: ${formatDate(j.deadline)} · ผู้สมัคร: <strong>${jApps.length}</strong> คน</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn btn-sm btn-secondary open-job-btn" data-id="${j.id}">ดูรายละเอียด</button>
                ${j.status === 'open' ? `<button class="btn btn-sm btn-primary add-app-btn" data-id="${j.id}">+ รับสมัคร</button>` : ''}
              </div>
            </div>
            <!-- Mini progress bar: applicants by status -->
            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
              ${Object.entries(APP_STATUS).filter(([k]) => ['new','screening','interview1','offer','hired','rejected'].includes(k)).map(([k,v]) => {
                const count = jApps.filter(a => a.status === k).length
                if (!count) return ''
                return `<span class="badge badge-${v.color}" style="font-size:0.68rem">${v.label}: ${count}</span>`
              }).join('')}
            </div>
          </div>`
        }).join('')}
        ${!filtered.length ? `<div class="empty-state"><div class="empty-state-icon">📋</div><div>ไม่พบตำแหน่งงาน</div></div>` : ''}
      </div>
    `
  }

  function renderApplicants() {
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>ชื่อ</th><th>ตำแหน่งที่สมัคร</th><th>วันที่สมัคร</th><th>คะแนน</th><th>สถานะ</th><th>การจัดการ</th></tr></thead>
          <tbody>
            ${applicants.map(a => {
              const job = jobs.find(j => j.id === a.jobId)
              const st = APP_STATUS[a.status]
              return `<tr>
                <td>
                  <div style="font-weight:600;font-size:0.85rem">${escHtml(a.name)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(a.phone)}</div>
                </td>
                <td style="font-size:0.82rem">${escHtml(job?.title || '-')}</td>
                <td style="font-size:0.82rem">${formatDate(a.appliedDate)}</td>
                <td style="text-align:center">
                  ${a.score !== null ? `<span style="font-weight:700;color:${a.score>=80?'var(--success)':a.score>=60?'var(--warning)':'var(--danger)'}">${a.score}</span>` : '<span style="color:var(--text-muted)">-</span>'}
                </td>
                <td><span class="badge badge-${st.color}">${st.label}</span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-secondary open-app-btn" data-id="${a.id}">ดู</button>
                    ${nextStatus(a.status) ? `<button class="btn btn-xs btn-primary app-status-btn" data-id="${a.id}" data-status="${nextStatus(a.status)}">${nextLabel(a.status)}</button>` : ''}
                    ${!['rejected','hired','withdrew'].includes(a.status) ? `<button class="btn btn-xs btn-danger app-status-btn" data-id="${a.id}" data-status="rejected">✗</button>` : ''}
                  </div>
                </td>
              </tr>`
            }).join('')}
            ${!applicants.length ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">ไม่มีใบสมัคร</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `
  }

  function renderPipeline() {
    const stages = ['new','screening','interview1','interview2','offer','hired']
    return `
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px">
        ${stages.map(s => {
          const st = APP_STATUS[s]
          const stageApps = applicants.filter(a => a.status === s)
          return `<div style="min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <span class="badge badge-${st.color}">${st.label}</span>
              <span style="font-size:0.78rem;font-weight:700">${stageApps.length}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${stageApps.map(a => {
                const job = jobs.find(j => j.id === a.jobId)
                return `<div style="padding:8px;background:var(--surface-2);border-radius:var(--radius-sm);cursor:pointer" class="open-app-btn" data-id="${a.id}">
                  <div style="font-weight:600;font-size:0.82rem">${escHtml(a.name)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(job?.title?.slice(0,25)||'')}</div>
                  ${a.score ? `<div style="font-size:0.7rem;margin-top:4px;color:${a.score>=80?'var(--success)':a.score>=60?'var(--warning)':'var(--danger)'}">คะแนน: ${a.score}</div>` : ''}
                </div>`
              }).join('')}
              ${!stageApps.length ? `<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:12px">ว่าง</div>` : ''}
            </div>
          </div>`
        }).join('')}
        <div style="min-width:200px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;opacity:0.6">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span class="badge badge-danger">ปฏิเสธ</span>
            <span style="font-size:0.78rem;font-weight:700">${applicants.filter(a=>a.status==='rejected').length}</span>
          </div>
        </div>
      </div>
    `
  }

  function nextStatus(current) {
    const map = { new: 'screening', screening: 'interview1', interview1: 'interview2', interview2: 'offer', offer: 'hired' }
    return map[current] || null
  }

  function nextLabel(current) {
    const map = { new: '▶ คัดกรอง', screening: '▶ สัมภาษณ์ 1', interview1: '▶ สัมภาษณ์ 2', interview2: '▶ เสนอเงิน', offer: '✓ รับเข้า' }
    return map[current] || ''
  }

  function openJobDetail(j) {
    const jApps = applicants.filter(a => a.jobId === j.id)
    const st = JOB_STATUS[j.status]
    openModal({
      title: '📋 ' + escHtml(j.id) + ' — ' + escHtml(j.title),
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>${row('แผนก', escHtml(j.dept))}${row('ที่ตั้ง', escHtml(j.location))}${row('รูปแบบ', j.type==='fulltime'?'เต็มเวลา':'พาร์ทไทม์')}${row('เงินเดือน', `${j.salaryMin.toLocaleString()} – ${j.salaryMax.toLocaleString()} บาท`)}</div>
          <div>${row('เปิดรับ', formatDate(j.openDate))}${row('ปิดรับ', formatDate(j.deadline))}${row('สถานะ', `<span class="badge badge-${st.color}">${st.label}</span>`)}${row('ผู้สมัคร', `${jApps.length} คน`)}</div>
        </div>
        <div style="font-size:0.83rem;line-height:1.6;margin-bottom:10px">${escHtml(j.description)}</div>
        <div style="font-size:0.8rem"><strong>คุณสมบัติ:</strong><ul style="margin:6px 0 0 16px;color:var(--text-muted)">${(j.requirements||[]).map(r=>`<li>${escHtml(r)}</li>`).join('')}</ul></div>
      `,
      footer: `<button class="btn btn-primary add-app-job-btn">+ เพิ่มใบสมัคร</button>`
    })
    setTimeout(() => { document.querySelector('.modal .add-app-job-btn')?.addEventListener('click', () => { document.querySelector('.modal-close-btn')?.click(); openApplicantForm(j.id) }) }, 50)
  }

  function openApplicantDetail(a) {
    const job = jobs.find(j => j.id === a.jobId)
    const st = APP_STATUS[a.status]
    openModal({
      title: '👤 ' + escHtml(a.name),
      size: 'md',
      body: `
        ${row('ตำแหน่ง', escHtml(job?.title||'-'))}
        ${row('โทรศัพท์', escHtml(a.phone))}
        ${row('อีเมล', escHtml(a.email))}
        ${row('วันที่สมัคร', formatDate(a.appliedDate))}
        ${row('คะแนน', a.score !== null ? `<strong style="color:${a.score>=80?'var(--success)':a.score>=60?'var(--warning)':'var(--danger)'}">${a.score}/100</strong>` : 'ยังไม่ประเมิน')}
        ${row('สถานะ', `<span class="badge badge-${st.color}">${st.label}</span>`)}
        ${a.note ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">📌 ${escHtml(a.note)}</div>` : ''}

        <div style="margin-top:14px">
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px">ย้ายสถานะ</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${Object.entries(APP_STATUS).filter(([k])=>k!==a.status&&!['withdrew'].includes(k)).map(([k,v]) => `<button class="btn btn-xs btn-${v.color} move-btn" data-status="${k}">${v.label}</button>`).join('')}
          </div>
        </div>
      `,
      footer: ''
    })
    setTimeout(() => {
      document.querySelectorAll('.modal .move-btn').forEach(b => b.addEventListener('click', async () => {
        document.querySelector('.modal-close-btn')?.click()
        await moveApplicant(a, b.dataset.status)
      }))
    }, 50)
  }

  function openApplicantForm(jobId) {
    openModal({
      title: '+ เพิ่มใบสมัคร',
      size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        ${!jobId ? `<div class="input-group"><label class="input-label">ตำแหน่งที่สมัคร</label><select class="input" id="af-job">${jobs.filter(j=>j.status==='open').map(j=>`<option value="${j.id}">${j.title}</option>`).join('')}</select></div>` : `<div style="font-size:0.85rem;padding:8px;background:var(--surface-2);border-radius:var(--radius-sm)">${jobs.find(j=>j.id===jobId)?.title||''}</div>`}
        <div class="input-group"><label class="input-label">ชื่อ-นามสกุล *</label><input class="input" id="af-name" placeholder="ชื่อ-นามสกุล"></div>
        <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="af-phone" placeholder="08x-xxx-xxxx"></div>
        <div class="input-group"><label class="input-label">อีเมล</label><input class="input" id="af-email" placeholder="email@example.com"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ / ประวัติย่อ</label><textarea class="input" id="af-note" rows="2" placeholder="สรุปประวัติ..."></textarea></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('af-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        const jid = jobId || document.getElementById('af-job')?.value
        await createDoc('recruitment_applicants', {
          jobId: jid, name, phone: document.getElementById('af-phone')?.value||'', email: document.getElementById('af-email')?.value||'',
          appliedDate: new Date().toISOString().slice(0,10), status: 'new', score: null,
          note: document.getElementById('af-note')?.value||'', resumeUrl: '#',
        })
        showToast('✅ เพิ่มใบสมัครแล้ว', 'success')
        await loadData()
      }
    })
  }

  function openJobForm(j) {
    openModal({
      title: j ? `✏️ แก้ไขตำแหน่ง` : '+ เปิดตำแหน่งงานใหม่',
      size: 'lg',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อตำแหน่ง *</label><input class="input" id="jf-title" value="${escHtml(j?.title||'')}"></div>
        <div class="input-group"><label class="input-label">แผนก</label><select class="input" id="jf-dept">${DEPARTMENTS.map(d=>`<option ${j?.dept===d?'selected':''}>${escHtml(d)}</option>`).join('')}</select></div>
        <div class="input-group"><label class="input-label">ที่ตั้ง</label><input class="input" id="jf-loc" value="${escHtml(j?.location||'กรุงเทพฯ')}"></div>
        <div class="input-group"><label class="input-label">เงินเดือนต่ำสุด</label><input type="number" class="input" id="jf-min" value="${j?.salaryMin||20000}"></div>
        <div class="input-group"><label class="input-label">เงินเดือนสูงสุด</label><input type="number" class="input" id="jf-max" value="${j?.salaryMax||40000}"></div>
        <div class="input-group"><label class="input-label">ปิดรับสมัคร</label><input type="date" class="input" id="jf-dead" value="${j?.deadline||''}"></div>
        <div class="input-group"><label class="input-label">สถานะ</label><select class="input" id="jf-status">${Object.entries(JOB_STATUS).map(([k,v])=>`<option value="${k}" ${j?.status===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">รายละเอียดงาน</label><textarea class="input" id="jf-desc" rows="3">${escHtml(j?.description||'')}</textarea></div>
      </div>`,
      async onConfirm() {
        const title = document.getElementById('jf-title')?.value?.trim()
        if (!title) { showToast('❗ กรุณากรอกชื่อตำแหน่ง', 'error'); return false }
        const data = { title, dept: document.getElementById('jf-dept').value, location: document.getElementById('jf-loc').value, salaryMin: +document.getElementById('jf-min').value, salaryMax: +document.getElementById('jf-max').value, deadline: document.getElementById('jf-dead').value, status: document.getElementById('jf-status').value, description: document.getElementById('jf-desc').value }
        if (j) {
          await updateDocData('recruitment_jobs', j.id, data)
        } else {
          await createDoc('recruitment_jobs', { ...data, type: 'fulltime', openDate: new Date().toISOString().slice(0,10), filled: 0, requirements: [] })
        }
        showToast('✅ บันทึกตำแหน่งงานแล้ว', 'success')
        await loadData()
      }
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}

function row(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${label}</span><span>${value}</span></div>`
}
