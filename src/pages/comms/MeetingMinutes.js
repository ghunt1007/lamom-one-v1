/**
 * Meeting Minutes — บันทึกประชุม มติ Action Items
 * Route: /comms/meetings
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_MEETINGS = [
  {
    id:'M001', title:'ประชุมรายสัปดาห์ทีมขาย', date:'2026-06-13', time:'09:00', dept:'ขาย',
    attendees:['ทวีศักดิ์','กิตติ','ปิยะ','สมพงษ์'],
    agenda:['ทบทวนยอดขายสัปดาห์ที่แล้ว','วางแผนโปรโมชั่นใหม่','ติดตาม Pipeline'],
    minutes:'ยอดขายสัปดาห์ที่แล้ว 12 คัน ต่ำกว่าเป้า 3 คัน ต้องเร่ง Follow-up ลูกค้าที่ทดลองขับ',
    actions:[
      { task:'ติดต่อลูกค้า Test Drive ทุกราย', owner:'กิตติ', due:'2026-06-15', done:false },
      { task:'อัปเดตราคาโปรโมชั่น Q3', owner:'ปิยะ', due:'2026-06-17', done:true },
    ],
    status:'completed',
  },
  {
    id:'M002', title:'ประชุมบอร์ดบริหาร Q2 Review', date:'2026-06-10', time:'14:00', dept:'บริหาร',
    attendees:['ทวีศักดิ์','ผู้จัดการทั่วไป','CFO','หัวหน้าฝ่ายขาย'],
    agenda:['สรุป P&L Q2','แผนการตลาด H2','HR Update'],
    minutes:'Q2 กำไรสุทธิ ฿4.2M ต่ำกว่าเป้า 8% สาเหตุหลักจากต้นทุนค่าแรงเพิ่มขึ้น',
    actions:[
      { task:'จัดทำแผนลดต้นทุน Q3', owner:'CFO', due:'2026-06-20', done:false },
      { task:'เพิ่มทีม Outbound 2 คน', owner:'หัวหน้าฝ่ายขาย', due:'2026-06-30', done:false },
    ],
    status:'completed',
  },
  {
    id:'M003', title:'Stand-up รายวันทีม Service', date:'2026-06-15', time:'08:00', dept:'บริการ',
    attendees:['หัวหน้าช่าง','ช่างเพ็ชร','ช่างแดน','ช่างโอ'],
    agenda:['สถานะงานประจำวัน','งานเร่งด่วน','ปัญหาอะไหล่'],
    minutes:'งานค้างอยู่ 8 ใบ มีอะไหล่ 2 ชิ้นที่ยังรอจากซัพพลายเออร์',
    actions:[
      { task:'ติดตามอะไหล่จาก LAMOM Parts', owner:'ช่างเพ็ชร', due:'2026-06-15', done:false },
    ],
    status:'in_progress',
  },
  {
    id:'M004', title:'ประชุมทีม Marketing ประจำเดือน', date:'2026-06-20', time:'10:00', dept:'การตลาด',
    attendees:['หัวหน้าการตลาด','ทีม Digital','ทีม Event'],
    agenda:['Campaign H2 2569','Event Motor Expo','Budget Review'],
    minutes:'',
    actions:[],
    status:'upcoming',
  },
]

function statusBadge(s) {
  const m = { upcoming:{l:'กำหนดการ',c:'var(--primary)'}, in_progress:{l:'กำลังประชุม',c:'var(--warning)'}, completed:{l:'เสร็จแล้ว',c:'var(--success)'} }
  const x = m[s] || { l: escHtml(s), c: 'var(--text-muted)' }
  return '<span style="font-size:0.62rem;padding:2px 8px;border-radius:6px;background:' + x.c + '22;color:' + x.c + ';font-weight:700">' + x.l + '</span>'
}

function meetingCard(m) {
  const doneCount = m.actions.filter(a => a.done).length
  return '<div class="card" style="padding:14px;margin-bottom:8px">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
      '<div>' +
        '<div style="font-weight:700;font-size:0.82rem">' + escHtml(m.title) + '</div>' +
        '<div style="font-size:0.68rem;color:var(--text-muted)">📅 ' + escHtml(m.date) + ' ' + escHtml(m.time) + ' · 🏢 ' + escHtml(m.dept) + '</div>' +
      '</div>' +
      statusBadge(m.status) +
    '</div>' +
    '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px">👥 ' + m.attendees.map(a => escHtml(a)).join(', ') + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<div style="font-size:0.7rem"><span style="color:var(--text-muted)">Action Items</span> <span style="font-weight:700">' + doneCount + '/' + m.actions.length + '</span></div>' +
      '<button class="btn btn-sm btn-secondary view-btn" data-id="' + m.id + '">รายละเอียด</button>' +
    '</div>' +
  '</div>'
}

function actionRow(a) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border-subtle)">' +
    '<div>' +
      '<div style="font-size:0.76rem;font-weight:600;' + (a.done ? 'text-decoration:line-through;color:var(--text-muted)' : '') + '">' + escHtml(a.task) + '</div>' +
      '<div style="font-size:0.64rem;color:var(--text-muted)">👤 ' + escHtml(a.owner) + ' · 📅 ' + escHtml(a.due) + '</div>' +
    '</div>' +
    (a.done ? '<span style="color:var(--success)">✅</span>' : '<span style="color:var(--warning)">⏳</span>') +
  '</div>'
}

export default async function MeetingMinutesPage(container) {
  const myGen = container.__routerGen
  let meetings = DEMO_MEETINGS.map(m => ({ ...m, actions: m.actions.map(a => ({ ...a })) }))
  let dataSource = 'demo'
  let filter = 'all'

  try {
    const docs = await listDocs('meeting_minutes', [], 'date', 'desc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `M${i+1}`,
        title: d.title || d.name || 'การประชุม',
        date: d.date || '',
        time: d.time || '09:00',
        dept: d.dept || d.department || '',
        attendees: d.attendees || [],
        agenda: d.agenda || [],
        minutes: d.minutes || d.summary || '',
        actions: (d.actions || []).map(a => ({ task: a.task || '', owner: a.owner || '', due: a.due || '', done: a.done || false })),
        status: d.status || 'completed',
      }))
      meetings = [...mapped, ...DEMO_MEETINGS]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const filtered = filter === 'all' ? meetings : meetings.filter(m => m.status === filter)
    const upcoming = meetings.filter(m => m.status === 'upcoming').length
    const completed = meetings.filter(m => m.status === 'completed').length
    const pendingActions = meetings.flatMap(m => m.actions).filter(a => !a.done).length

    const filterBtns = [['all','ทั้งหมด'],['upcoming','กำหนดการ'],['in_progress','กำลังประชุม'],['completed','เสร็จแล้ว']].map(([k, l]) =>
      '<button class="btn btn-sm ' + (filter === k ? 'btn-primary' : 'btn-secondary') + ' filter-btn" data-f="' + k + '">' + l + '</button>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Meeting Minutes</div>
            <div class="page-subtitle">บันทึกประชุม มติ และ Action Items${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-meeting-btn">+ สร้างการประชุม</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('📅 การประชุมทั้งหมด', meetings.length + ' รายการ', 'var(--primary)')}
          ${sc('🔜 กำหนดการ', upcoming + ' รายการ', 'var(--warning)')}
          ${sc('✅ เสร็จสิ้น', completed + ' รายการ', 'var(--success)')}
          ${sc('⚠️ Action รอทำ', pendingActions + ' รายการ', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        ${filtered.map(m => meetingCard(m)).join('')}
      </div>`

    container.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render() }))
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const m = meetings.find(x => x.id === b.dataset.id)
      if (!m) return
      const agendaList = m.agenda.map(a => '<li style="font-size:0.76rem;margin-bottom:3px">' + escHtml(a) + '</li>').join('')
      const actionsHtml = m.actions.length === 0
        ? '<div style="color:var(--text-muted);font-size:0.74rem;padding:8px 0">ยังไม่มี Action Items</div>'
        : m.actions.map(a => actionRow(a)).join('')
      const body = '<div style="font-size:0.82rem">' +
        '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:10px">📅 ' + escHtml(m.date) + ' ' + escHtml(m.time) + ' · 🏢 ' + escHtml(m.dept) + ' · 👥 ' + m.attendees.map(a => escHtml(a)).join(', ') + '</div>' +
        '<div style="margin-bottom:10px"><div style="font-size:0.76rem;font-weight:700;margin-bottom:4px">📌 วาระการประชุม</div><ul style="padding-left:16px;margin:0">' + agendaList + '</ul></div>' +
        (m.minutes ? '<div style="background:var(--surface-2);padding:10px;border-radius:8px;margin-bottom:10px"><div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">📝 บันทึกการประชุม</div><div style="font-size:0.76rem;line-height:1.6">' + escHtml(m.minutes) + '</div></div>' : '') +
        '<div><div style="font-size:0.76rem;font-weight:700;margin-bottom:4px">🎯 Action Items</div>' + actionsHtml + '</div>' +
      '</div>'
      openModal({ title: '📋 ' + escHtml(m.title), size: 'md', body, confirmText: 'ปิด', onConfirm: () => {} })
    }))
    document.getElementById('new-meeting-btn')?.addEventListener('click', openNewMeetingModal)
  }

  function openNewMeetingModal() {
    const today = new Date().toISOString().slice(0, 10)
    openModal({
      title: '📋 สร้างการประชุมใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อการประชุม *</label>
            <input id="mt-title" class="input" placeholder="ประชุมทีมขาย / บอร์ดบริหาร..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">วันที่</label><input id="mt-date" type="date" class="input" value="${today}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">เวลา</label><input id="mt-time" type="time" class="input" value="09:00"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ฝ่าย/หน่วยงาน</label><input id="mt-dept" class="input" placeholder="ขาย / บริหาร..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">สถานะ</label>
              <select id="mt-status" class="input">
                <option value="upcoming">กำหนดการ</option>
                <option value="in_progress">กำลังประชุม</option>
                <option value="completed">เสร็จแล้ว</option>
              </select>
            </div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ผู้เข้าร่วม (คั่นด้วยจุลภาค)</label>
            <input id="mt-attendees" class="input" placeholder="ทวีศักดิ์, กิตติ, ปิยะ..."></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">วาระการประชุม (แยกบรรทัด)</label>
            <textarea id="mt-agenda" class="input" rows="3" placeholder="1. ทบทวนยอดขาย&#10;2. วางแผนโปรโมชั่น..."></textarea></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="mt-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('mt-save')?.addEventListener('click', () => {
      const title = document.getElementById('mt-title')?.value.trim()
      if (!title) { showToast('⚠️ กรุณากรอกชื่อการประชุม', 'warning'); return }
      const agendaRaw = document.getElementById('mt-agenda')?.value.trim()
      const attendeesRaw = document.getElementById('mt-attendees')?.value.trim()
      meetings.push({
        id: 'M' + String(meetings.length + 1).padStart(3,'0'),
        title,
        date: document.getElementById('mt-date')?.value || today,
        time: document.getElementById('mt-time')?.value || '09:00',
        dept: document.getElementById('mt-dept')?.value.trim() || '-',
        attendees: attendeesRaw ? attendeesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
        agenda: agendaRaw ? agendaRaw.split('\n').filter(Boolean) : [],
        minutes: '',
        actions: [],
        status: document.getElementById('mt-status')?.value || 'upcoming',
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ สร้างการประชุมแล้ว', 'success')
      render()
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
