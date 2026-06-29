/**
 * Walk-In Traffic — บันทึกลูกค้าเดินเข้า
 * Route: /crm/walkin
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const INTEREST_LEVEL = {
  hot:    { label: 'Hot', color: 'danger', icon: '🔥' },
  warm:   { label: 'Warm', color: 'warning', icon: '☀️' },
  cold:   { label: 'Cold', color: 'secondary', icon: '❄️' },
  browse: { label: 'แค่ดู', color: 'secondary', icon: '👀' },
}

const VISIT_OUTCOMES = {
  test_drive: { label: 'ทดลองขับ', color: 'success' },
  quotation:  { label: 'รับใบเสนอราคา', color: 'primary' },
  book:       { label: 'จอง', color: 'success' },
  follow_up:  { label: 'นัด Follow-up', color: 'warning' },
  leave:      { label: 'กลับโดยไม่ตัดสินใจ', color: 'secondary' },
}

function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const MODELS = ['BYD Dolphin', 'BYD Atto 3', 'BYD Seal AWD', 'MG ZS EV', 'BYD Han', 'ยังไม่แน่ใจ']

const DEMO_WALKINS = [
  { id: 'W001', name: 'สมชาย ใจดี', phone: '085-xxx', interestedIn: 'BYD Atto 3', interest: 'hot', staff: 'วิชัย ยอดขาย', outcome: 'test_drive', visitTime: addHours(1), notes: 'มาแล้ว 2 ครั้ง สนใจมาก' },
  { id: 'W002', name: 'มาลี สุขใจ', phone: '086-xxx', interestedIn: 'BYD Dolphin', interest: 'warm', staff: 'สุดา มาดี', outcome: 'quotation', visitTime: addHours(2), notes: '' },
  { id: 'W003', name: 'ธนพล เที่ยงตรง', phone: '087-xxx', interestedIn: 'ยังไม่แน่ใจ', interest: 'browse', staff: 'ธนา เก่ง', outcome: 'leave', visitTime: addHours(3), notes: 'สนใจ EV ทั่วไป' },
  { id: 'W004', name: 'อรทัย ตั้งใจ', phone: '088-xxx', interestedIn: 'MG ZS EV', interest: 'hot', staff: 'วิชัย ยอดขาย', outcome: 'book', visitTime: addHours(4), notes: 'วางมัดจำ 10,000 บาทแล้ว' },
  { id: 'W005', name: 'ชัยชนะ ดีเสมอ', phone: '089-xxx', interestedIn: 'BYD Seal AWD', interest: 'warm', staff: 'สุดา มาดี', outcome: 'follow_up', visitTime: addHours(6), notes: 'นัดอีกครั้งพรุ่งนี้' },
]

const HOURLY_TRAFFIC = [2, 3, 8, 12, 15, 18, 14, 10, 7, 3] // 9-18

export default async function WalkInPage(container) {
  const myGen = container.__routerGen
  let walkins = DEMO_WALKINS.map(w => ({ ...w }))
  let interestFilter = 'all'
  let dataSource = 'demo'

  try {
    const live = await listDocs('walk_ins', [], 'visitTime', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (live.length >= 2) {
      const mapped = live.map(w => ({
        id: w.id || w.docId,
        name: w.name || w.custName || 'ลูกค้า',
        phone: w.phone || '',
        interestedIn: w.interestedIn || w.model || 'ยังไม่แน่ใจ',
        interest: w.interest || w.interestLevel || 'browse',
        staff: w.staff || w.salesName || '',
        outcome: w.outcome || 'leave',
        visitTime: w.visitTime?.toDate?.()?.toISOString() || w.visitTime || new Date().toISOString(),
        notes: w.notes || w.note || '',
      }))
      walkins = [...mapped, ...DEMO_WALKINS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const list = walkins.filter(w => interestFilter === 'all' || w.interest === interestFilter)
    const hot = walkins.filter(w => w.interest === 'hot').length
    const booked = walkins.filter(w => w.outcome === 'book').length
    const convRate = Math.round((walkins.filter(w => ['book','test_drive'].includes(w.outcome)).length / walkins.length) * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚶 Walk-In Traffic</div>
            <div class="page-subtitle">บันทึกลูกค้าเดินเข้าโชว์รูม — วันนี้${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-walkin-btn">+ บันทึกลูกค้า</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚶 Walk-In วันนี้', walkins.length + ' คน', 'primary')}
          ${kpi('🔥 Hot Lead', hot, hot > 0 ? 'danger' : 'secondary')}
          ${kpi('🎯 จองแล้ว', booked, 'success')}
          ${kpi('📊 Conv Rate', convRate + '%', convRate >= 30 ? 'success' : 'warning')}
        </div>

        <!-- Hourly traffic mini chart -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 Traffic รายชั่วโมง</div>
          <div style="display:flex;gap:4px;align-items:flex-end;height:50px">
            ${HOURLY_TRAFFIC.map((v, i) => {
              const maxV = Math.max(...HOURLY_TRAFFIC)
              const pct = Math.round(v / maxV * 100)
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                <div style="width:100%;background:var(--primary);border-radius:2px 2px 0 0;height:${pct/2}px;min-height:4px"></div>
                <div style="font-size:0.6rem;color:var(--text-muted)">${9+i}</div>
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${interestFilter==='all'?'btn-primary':'btn-secondary'} if-btn" data-i="all">ทั้งหมด</button>
          ${Object.entries(INTEREST_LEVEL).map(([k,v]) => `<button class="btn btn-xs ${interestFilter===k?'btn-'+v.color:'btn-secondary'} if-btn" data-i="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Walk-in list -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(w => {
            const il = INTEREST_LEVEL[w.interest]
            const vo = VISIT_OUTCOMES[w.outcome]
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${il?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${escHtml(w.name)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">📞 ${escHtml(w.phone)} · ${escHtml(w.staff)} · ${timeAgo(w.visitTime)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">🚗 สนใจ: ${escHtml(w.interestedIn)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${il?.color}" style="font-size:0.62rem">${il?.icon} ${il?.label}</span>
                  <span class="badge badge-${vo?.color}" style="font-size:0.6rem">${vo?.label}</span>
                </div>
              </div>
              ${w.notes ? `<div style="font-size:0.72rem;color:var(--text-muted);font-style:italic">📌 ${escHtml(w.notes)}</div>` : ''}
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.if-btn').forEach(b => b.addEventListener('click', () => { interestFilter = b.dataset.i; renderPage() }))
    document.getElementById('add-walkin-btn')?.addEventListener('click', openAddForm)
  }

  function openAddForm() {
    openModal({
      title: '🚶 บันทึกลูกค้า Walk-In',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="wi-name"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="wi-phone"></div>
          <div class="input-group"><label class="input-label">รุ่นที่สนใจ</label>
            <select class="input" id="wi-model">${MODELS.map(m=>`<option>${m}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ความสนใจ</label>
            <select class="input" id="wi-interest">${Object.entries(INTEREST_LEVEL).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ผลการเยี่ยม</label>
            <select class="input" id="wi-outcome">${Object.entries(VISIT_OUTCOMES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เซลส์ที่ดูแล</label>
            <select class="input" id="wi-staff">
              <option>วิชัย ยอดขาย</option><option>สุดา มาดี</option><option>ธนา เก่ง</option>
            </select>
          </div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><input class="input" id="wi-notes"></div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('wi-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return }
        walkins.unshift({
          id: `W${String(walkins.length+1).padStart(3,'0')}`, name,
          phone: document.getElementById('wi-phone')?.value||'',
          interestedIn: document.getElementById('wi-model')?.value||'ยังไม่แน่ใจ',
          interest: document.getElementById('wi-interest')?.value||'warm',
          staff: document.getElementById('wi-staff')?.value||'',
          outcome: document.getElementById('wi-outcome')?.value||'leave',
          visitTime: new Date().toISOString(),
          notes: document.getElementById('wi-notes')?.value||''
        })
        showToast('✅ บันทึกลูกค้า Walk-In แล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
