import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const FEEDBACK_TYPES = {
  csat:   { label: 'CSAT', color: 'primary', icon: '⭐' },
  nps:    { label: 'NPS', color: 'success', icon: '📊' },
  review: { label: 'Google Review', color: 'warning', icon: '🌟' },
  survey: { label: 'แบบสอบถาม', color: 'secondary', icon: '📋' },
  complaint: { label: 'ร้องเรียน', color: 'danger', icon: '❗' },
}

const DEPARTMENTS = { sales: 'ฝ่ายขาย', service: 'ศูนย์บริการ', delivery: 'ส่งมอบรถ', finance: 'ไฟแนนซ์', general: 'ทั่วไป' }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_FEEDBACK = [
  { id: 'FB001', type: 'csat', customerId: 'C001', customerName: 'วิชาญ มีโชค', phone: '081-234-5678',
    department: 'delivery', score: 5, maxScore: 5, comment: 'บริการดีมาก ส่งมอบรถตรงเวลา พนักงานสุภาพ', date: addDays(-2), salesperson: 'อรนุช สายใจ', responded: true, response: 'ขอบคุณมากครับ ยินดีให้บริการเสมอ' },
  { id: 'FB002', type: 'nps', customerId: 'C002', customerName: 'อรนุช สาวสวย', phone: '082-345-6789',
    department: 'service', score: 9, maxScore: 10, comment: 'ศูนย์บริการทำงานเร็ว แต่ที่จอดรถน้อยไปหน่อย', date: addDays(-5), salesperson: 'วิชาญ มีโชค', responded: false, response: '' },
  { id: 'FB003', type: 'review', customerId: 'C003', customerName: 'ธีรยุทธ เก่งกาจ', phone: '083-456-7890',
    department: 'sales', score: 4, maxScore: 5, comment: 'โชว์รูมสวย สต็อกเยอะ แต่รอรับรถนานหน่อย', date: addDays(-7), salesperson: 'อรนุช สายใจ', responded: true, response: 'ขออภัยที่ทำให้รอนาน เราจะปรับปรุงครับ' },
  { id: 'FB004', type: 'complaint', customerId: 'C004', customerName: 'สมใจ รักรถ', phone: '084-567-8901',
    department: 'service', score: 2, maxScore: 5, comment: 'นำรถเข้าซ่อมแล้วใช้เวลานานกว่าที่แจ้งไว้ 3 วัน ไม่มีการแจ้งล่วงหน้า', date: addDays(-1), salesperson: 'วิชาญ ช่างซ่อม', responded: false, response: '' },
  { id: 'FB005', type: 'csat', customerId: 'C005', customerName: 'ประยุทธ ดีใจ', phone: '085-678-9012',
    department: 'sales', score: 5, maxScore: 5, comment: 'เซลส์อธิบายดีมาก ทดลองขับรถสนุกมาก ซื้อเลย!', date: addDays(-10), salesperson: 'อรนุช สายใจ', responded: true, response: 'ขอบคุณมากครับ!' },
  { id: 'FB006', type: 'survey', customerId: 'C006', customerName: 'มาลี สุขสันต์', phone: '086-789-0123',
    department: 'finance', score: 4, maxScore: 5, comment: 'ดำเนินการไฟแนนซ์เร็วดี เอกสารชัดเจน', date: addDays(-14), salesperson: 'นิภา บัญชีดี', responded: false, response: '' },
]

export default async function CustomerFeedbackPage(container) {
  const myGen = container.__routerGen
  let tab = 'list'
  let typeFilter = 'all'
  let feedbacks = DEMO_FEEDBACK.map(f => ({ ...f }))
  let dataSource = 'demo'

  try {
    const bookings = await listDocs('bookings', [], 'createdAt', 'desc', 300).catch(() => [])
    if (container.__routerGen !== myGen) return
    const delivered = bookings.filter(b => b.status === 'ส่งมอบแล้ว')
    // แสดงเฉพาะ Feedback จริงเมื่อมีจริง — ห้ามเอา DEMO_FEEDBACK มาปนกับข้อมูลจริง
    // (ป้ายกำกับ "รวมจากใบจองจริง" ต้องเป็นจริงตามที่บอก — DEMO_FEEDBACK ใช้เป็นตัวอย่างก็ต่อเมื่อยังไม่มีใบจองที่ส่งมอบแล้วเลย)
    if (delivered.length) {
      feedbacks = delivered.map(b => ({
        id: 'FB-' + b.id, type: 'csat',
        customerId: b.id, customerName: b.custName || 'ลูกค้า',
        phone: b.custPhone || '', department: 'delivery',
        score: 0, maxScore: 5, comment: '',
        date: (b.actualDeliveryDate || b.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()).slice(0, 10),
        salesperson: b.salesName || '', responded: false, response: '', pending: true, _live: true,
      }))
      dataSource = 'live'
    }
  } catch {}

  function filtered() {
    return feedbacks.filter(f => typeFilter === 'all' || f.type === typeFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  function renderPage() {
    const list = filtered()
    const avgScore = feedbacks.length ? (feedbacks.reduce((a, f) => a + (f.score / f.maxScore) * 5, 0) / feedbacks.length).toFixed(1) : 0
    const promoters = feedbacks.filter(f => f.type === 'nps' && f.score >= 9).length
    const detractors = feedbacks.filter(f => f.type === 'nps' && f.score <= 6).length
    const npsTotal = feedbacks.filter(f => f.type === 'nps').length
    const nps = npsTotal ? Math.round(((promoters - detractors) / npsTotal) * 100) : 0
    const complaints = feedbacks.filter(f => f.type === 'complaint' && !f.responded).length
    const unresponded = feedbacks.filter(f => !f.responded).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💬 Customer Feedback</div>
            <div class="page-subtitle">CSAT / NPS / รีวิว / แบบสอบถาม${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง (รอให้คะแนนหลังส่งมอบ)</span>' : ' <span style="color:var(--warning);font-size:0.75rem">● ตัวอย่างข้อมูล — ยังไม่มีใบจองที่ส่งมอบแล้ว</span>'}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-fb-btn">+ บันทึก Feedback</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
          ${kpi('⭐ CSAT avg', `${avgScore}/5.0`, avgScore >= 4.5 ? 'success' : avgScore >= 3.5 ? 'warning' : 'danger')}
          ${kpi('📊 NPS Score', nps + '%', nps >= 50 ? 'success' : nps >= 0 ? 'warning' : 'danger')}
          ${kpi('💬 ทั้งหมด', feedbacks.length, 'primary')}
          ${kpi('❗ ร้องเรียนค้าง', complaints, complaints > 0 ? 'danger' : 'secondary')}
          ${kpi('📩 ยังไม่ตอบ', unresponded, unresponded > 0 ? 'warning' : 'secondary')}
        </div>

        <!-- Tabs -->
        <div class="tab-nav" style="margin-bottom:14px">
          ${[['list','📋 รายการ'],['analytics','📊 วิเคราะห์'],['send','📤 ส่ง Survey']].map(([t,l]) => `<button class="tab-btn ${tab===t?'active':''}" data-tab="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'list' ? renderList(list) : tab === 'analytics' ? renderAnalytics() : renderSend()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderPage() }))
    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('add-fb-btn')?.addEventListener('click', openFeedbackForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(feedbacks.map(f => ({ ID: f.id, ลูกค้า: f.customerName, ประเภท: FEEDBACK_TYPES[f.type]?.label, แผนก: DEPARTMENTS[f.department]||f.department, คะแนน: f.score, ความเห็น: f.comment, วันที่: f.date })), 'customer_feedback')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-fb-btn').forEach(b => b.addEventListener('click', () => {
      const f = feedbacks.find(x => x.id === b.dataset.id); if (f) openFeedbackDetail(f)
    }))
    container.querySelectorAll('.respond-btn').forEach(b => b.addEventListener('click', () => {
      const f = feedbacks.find(x => x.id === b.dataset.id); if (f) openResponseModal(f)
    }))
  }

  function renderList(list) {
    return `<div>
      <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-sm ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
        ${Object.entries(FEEDBACK_TYPES).map(([k,v]) => `<button class="btn btn-sm ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${list.map(f => {
          const ft = FEEDBACK_TYPES[f.type]
          const scoreColor = f.score / f.maxScore >= 0.8 ? 'success' : f.score / f.maxScore >= 0.6 ? 'warning' : 'danger'
          const stars = f.maxScore === 5 ? '⭐'.repeat(f.score) + '☆'.repeat(5 - f.score) : null
          return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${ft?.color})">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="font-size:1.5rem">${ft?.icon}</div>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span style="font-weight:700;font-size:0.88rem">${escHtml(f.customerName)}</span>
                  <span class="badge badge-${ft?.color}" style="font-size:0.68rem">${ft?.label}</span>
                  <span class="badge badge-secondary" style="font-size:0.68rem">${DEPARTMENTS[f.department]||f.department}</span>
                  ${!f.responded ? `<span class="badge badge-warning" style="font-size:0.65rem">รอตอบ</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  <span class="badge badge-${scoreColor}" style="font-size:0.75rem;font-weight:700">${f.score}/${f.maxScore}</span>
                  ${stars ? `<span style="font-size:0.85rem">${stars}</span>` : ''}
                  <span style="font-size:0.75rem;color:var(--text-muted)">${timeAgo(f.date)}</span>
                </div>
                ${f.comment ? `<div style="font-size:0.83rem;color:var(--text-muted);line-height:1.5;margin-bottom:8px">&quot;${escHtml(f.comment)}&quot;</div>` : ''}
                ${f.responded ? `<div style="font-size:0.78rem;padding:6px 10px;background:var(--surface-2);border-radius:var(--radius-sm);border-left:2px solid var(--success)">💬 ${escHtml(f.response)}</div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <button class="btn btn-xs btn-secondary open-fb-btn" data-id="${f.id}">ดู</button>
                ${!f.responded ? `<button class="btn btn-xs btn-primary respond-btn" data-id="${f.id}">ตอบ</button>` : ''}
              </div>
            </div>
          </div>`
        }).join('')}
        ${!list.length ? `<div class="empty-state"><div class="empty-state-icon">💬</div><div>ไม่พบ Feedback</div></div>` : ''}
      </div>
    </div>`
  }

  function renderAnalytics() {
    const byDept = Object.entries(DEPARTMENTS).map(([key, label]) => {
      const items = feedbacks.filter(f => f.department === key)
      const avg = items.length ? (items.reduce((a, f) => a + f.score / f.maxScore * 5, 0) / items.length).toFixed(1) : null
      return { key, label, count: items.length, avg }
    }).filter(d => d.count > 0)

    const byType = Object.entries(FEEDBACK_TYPES).map(([key, meta]) => {
      const items = feedbacks.filter(f => f.type === key)
      const avg = items.length ? (items.reduce((a, f) => a + f.score / f.maxScore * 5, 0) / items.length).toFixed(1) : null
      return { key, label: meta.label, icon: meta.icon, color: meta.color, count: items.length, avg }
    }).filter(d => d.count > 0)

    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card" style="padding:14px">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📊 คะแนนตามแผนก</div>
        ${byDept.map(d => {
          const pct = d.avg ? Math.round((+d.avg / 5) * 100) : 0
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px">
              <span>${d.label}</span>
              <span style="font-weight:700">${d.avg || '-'}/5.0 (${d.count} รีวิว)</span>
            </div>
            <div style="background:var(--surface-2);border-radius:4px;height:8px">
              <div style="background:var(--${pct>=80?'success':pct>=60?'warning':'danger'});width:${pct}%;height:8px;border-radius:4px;transition:width 0.3s"></div>
            </div>
          </div>`
        }).join('')}
      </div>
      <div class="card" style="padding:14px">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">💬 ตามประเภท</div>
        ${byType.map(d => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:0.83rem">${d.icon} ${d.label}</span>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:0.78rem;color:var(--text-muted)">${d.count} รายการ</span>
            ${d.avg ? `<span class="badge badge-${d.color}" style="font-size:0.73rem">${d.avg}/5.0</span>` : ''}
          </div>
        </div>`).join('')}
      </div>
      <div class="card" style="padding:14px;grid-column:1/-1">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📈 แนวโน้ม (ล่าสุด 30 วัน)</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">
          ${[['⭐ ดีมาก (5/5)',feedbacks.filter(f=>f.score/f.maxScore===1).length,'success'],
             ['✅ ดี (4/5)',feedbacks.filter(f=>f.score/f.maxScore>=0.8&&f.score/f.maxScore<1).length,'primary'],
             ['👍 ปานกลาง (3/5)',feedbacks.filter(f=>f.score/f.maxScore>=0.6&&f.score/f.maxScore<0.8).length,'warning'],
             ['👎 ต่ำกว่าเกณฑ์',feedbacks.filter(f=>f.score/f.maxScore<0.6).length,'danger'],
             ['❗ ยังไม่ตอบ',feedbacks.filter(f=>!f.responded).length,'warning']
          ].map(([l,v,c]) => kpi(l, v, c)).join('')}
        </div>
      </div>
    </div>`
  }

  function renderSend() {
    return `<div class="card" style="padding:20px;max-width:560px;margin:0 auto">
      <div style="font-weight:700;font-size:0.9rem;margin-bottom:16px">📤 ส่งแบบสอบถามให้ลูกค้า</div>
      <div class="input-group"><label class="input-label">ประเภท Survey</label>
        <select class="input" id="sv-type">
          <option value="csat">CSAT — วัดความพึงพอใจ (หลังส่งมอบ / บริการ)</option>
          <option value="nps">NPS — วัดโอกาสแนะนำ (0-10)</option>
          <option value="survey">แบบสอบถามทั่วไป</option>
        </select>
      </div>
      <div class="input-group" style="margin-top:12px"><label class="input-label">ช่องทาง</label>
        <div style="display:flex;gap:8px">
          ${[['📱 SMS','sms'],['💬 LINE','line'],['📧 Email','email']].map(([l,v]) => `<label style="display:flex;align-items:center;gap:6px;font-size:0.83rem;cursor:pointer"><input type="checkbox" value="${v}" class="sv-channel" ${v==='line'?'checked':''}> ${l}</label>`).join('')}
        </div>
      </div>
      <div class="input-group" style="margin-top:12px"><label class="input-label">กลุ่มเป้าหมาย</label>
        <select class="input" id="sv-target">
          <option>ลูกค้าที่รับรถใน 7 วันที่ผ่านมา</option>
          <option>ลูกค้าที่ใช้บริการศูนย์ใน 30 วัน</option>
          <option>ลูกค้า VIP ทั้งหมด</option>
          <option>กำหนดเอง</option>
        </select>
      </div>
      <div class="input-group" style="margin-top:12px"><label class="input-label">ข้อความนำ</label>
        <textarea class="input" id="sv-msg" rows="3" placeholder="สวัสดีครับ คุณ [ชื่อลูกค้า] ขอรบกวนให้คะแนนความพึงพอใจของเราได้ที่ลิงก์นี้ครับ...">สวัสดีครับ คุณ [ชื่อลูกค้า] เพื่อปรับปรุงบริการ LAMOM ONE ขอรบกวนให้คะแนนความพึงพอใจ 2 นาทีที่ลิงก์นี้ครับ ขอบคุณครับ 🙏</textarea>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px">
        <button class="btn btn-primary" id="send-survey-btn" style="flex:1">📤 ส่ง Survey ตอนนี้</button>
        <button class="btn btn-secondary">👁 Preview</button>
      </div>
    </div>`
  }

  function openFeedbackDetail(f) {
    const ft = FEEDBACK_TYPES[f.type]
    openModal({
      title: '💬 ' + escHtml(f.id) + ' — ' + escHtml(f.customerName),
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
          <div>
            ${row('ประเภท', `<span class="badge badge-${ft?.color}">${ft?.label}</span>`)}
            ${row('แผนก', DEPARTMENTS[f.department]||f.department)}
            ${row('เซลส์/ช่าง', escHtml(f.salesperson))}
            ${row('วันที่', formatDate(f.date))}
          </div>
          <div>
            ${row('คะแนน', `<span style="font-size:1.1rem;font-weight:800">${f.score}/${f.maxScore}</span>`)}
            ${f.maxScore === 5 ? `<div style="font-size:1.2rem;margin:6px 0">` + '⭐'.repeat(f.score) + '☆'.repeat(5-f.score) + `</div>` : ''}
          </div>
        </div>
        ${f.comment ? `<div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.85rem;line-height:1.6;margin-bottom:12px;border-left:3px solid var(--${ft?.color})">&quot;${escHtml(f.comment)}&quot;</div>` : ''}
        ${f.responded ? `<div style="padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;border-left:3px solid var(--success)"><div style="font-weight:700;margin-bottom:4px">💬 คำตอบ</div>${escHtml(f.response)}</div>` : ''}
      `,
      footer: !f.responded ? `<button class="btn btn-primary respond-modal-btn">💬 ตอบกลับ</button>` : ''
    })
    setTimeout(() => {
      document.querySelector('.modal .respond-modal-btn')?.addEventListener('click', () => {
        document.querySelector('.modal-close-btn')?.click()
        openResponseModal(f)
      })
    }, 50)
  }

  function openResponseModal(f) {
    openModal({
      title: '💬 ตอบกลับ — ' + escHtml(f.customerName),
      size: 'md',
      body: `
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;margin-bottom:12px;color:var(--text-muted)">&quot;${escHtml(f.comment || 'ไม่มีความเห็น')}&quot;</div>
        <div class="input-group"><label class="input-label">คำตอบ / ขอบคุณ</label>
          <textarea class="input" id="resp-text" rows="4" placeholder="พิมพ์ข้อความตอบกลับ...">${f.score >= 4 ? 'ขอบคุณมากครับสำหรับ Feedback ดีๆ ยินดีให้บริการเสมอครับ 😊' : 'ขออภัยในความไม่สะดวกครับ ทีมงานจะรีบดำเนินการแก้ไขและติดต่อกลับโดยเร็วครับ'}</textarea>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer"><input type="checkbox" id="resp-line" checked> ส่งผ่าน LINE</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer"><input type="checkbox" id="resp-sms"> SMS</label>
        </div>
      `,
      confirmLabel: '💬 ส่งคำตอบ',
      confirmClass: 'btn-primary',
      onConfirm() {
        const txt = document.getElementById('resp-text')?.value?.trim()
        if (!txt) { showToast('❗ กรุณากรอกข้อความ', 'error'); return }
        f.responded = true; f.response = txt
        showToast(`✅ ตอบกลับ ${f.customerName} แล้ว!`, 'success')
        renderPage()
      }
    })
  }

  function openFeedbackForm() {
    openModal({
      title: '+ บันทึก Customer Feedback',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="fbf-name" placeholder="ชื่อลูกค้า"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="fbf-phone" placeholder="08x-xxx-xxxx"></div>
          <div class="input-group">
            <label class="input-label">ประเภท</label>
            <select class="input" id="fbf-type">${Object.entries(FEEDBACK_TYPES).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group">
            <label class="input-label">แผนก</label>
            <select class="input" id="fbf-dept">${Object.entries(DEPARTMENTS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </div>
          <div class="input-group">
            <label class="input-label">คะแนน (1-5)</label>
            <input type="range" id="fbf-score" min="1" max="5" value="5" style="width:100%" oninput="document.getElementById('fbf-score-val').textContent=this.value">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted)"><span>1</span><span id="fbf-score-val" style="color:var(--success);font-weight:700">5</span><span>5</span></div>
          </div>
          <div class="input-group"><label class="input-label">เซลส์/ช่างผู้ดูแล</label><input class="input" id="fbf-sales" placeholder="ชื่อ"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ความเห็น</label><textarea class="input" id="fbf-comment" rows="3" placeholder="ความเห็นของลูกค้า..."></textarea></div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('fbf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return }
        feedbacks.unshift({
          id: `FB${String(feedbacks.length+1).padStart(3,'0')}`,
          type: document.getElementById('fbf-type')?.value || 'csat',
          customerId: '', customerName: name,
          phone: document.getElementById('fbf-phone')?.value || '',
          department: document.getElementById('fbf-dept')?.value || 'general',
          score: +document.getElementById('fbf-score')?.value || 5,
          maxScore: 5, comment: document.getElementById('fbf-comment')?.value || '',
          date: new Date().toISOString().slice(0, 10),
          salesperson: document.getElementById('fbf-sales')?.value || '',
          responded: false, response: ''
        })
        showToast('✅ บันทึก Feedback แล้ว!', 'success')
        renderPage()
      }
    })
  }

  container.addEventListener('click', e => {
    if (e.target.id === 'send-survey-btn') {
      showToast('📤 ส่ง Survey ให้ลูกค้าแล้ว! (Demo)', 'success')
    }
  })

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
