/**
 * Event Check-in — เช็คอินงานอีเวนต์ + เก็บ Lead
 * Route: /marketing/event-checkin
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

const INTEREST = {
  hot:    { label: 'Hot 🔥', color: 'danger' },
  warm:   { label: 'Warm ☀️', color: 'warning' },
  browse: { label: 'เดินดู 👀', color: 'secondary' },
}

const EVENT_INFO = { name: 'Motor Show บางนา 2569', booth: 'Booth A12', target: 150, staff: ['วิชัย', 'สุดา', 'ธนา'] }

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

export default async function EventCheckinPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let visitors = []
  let loading = true

  async function loadData() {
    loading = true
    try { visitors = await listDocs('event_visitors', [], 'time', 'asc', 500) } catch (e) { visitors = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const total = visitors.length
    const hot = visitors.filter(v => v.interest === 'hot').length
    const withPhone = visitors.filter(v => v.phone).length
    const tdCount = visitors.filter(v => v.testDrive).length
    const targetPct = Math.round(total / EVENT_INFO.target * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎪 Event Check-in</div>
            <div class="page-subtitle">${EVENT_INFO.name} — ${EVENT_INFO.booth}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="checkin-btn" style="font-size:1rem;padding:10px 20px">+ ลงทะเบียนผู้เยี่ยมชม</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🎪 ผู้เยี่ยมชม', total + '/' + EVENT_INFO.target + ' (' + targetPct + '%)', targetPct >= 50 ? 'success' : 'primary')}
          ${kpi('🔥 Hot Leads', hot, hot > 0 ? 'danger' : 'secondary')}
          ${kpi('📞 ได้เบอร์ติดต่อ', withPhone + ' (' + Math.round(withPhone/total*100) + '%)', 'warning')}
          ${kpi('🚗 จอง Test Drive', tdCount, 'success')}
        </div>

        <!-- Target progress -->
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:4px">
            <span style="color:var(--text-muted)">เป้า Lead ทั้งงาน</span><span>${total}/${EVENT_INFO.target}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:4px;height:10px">
            <div style="width:${Math.min(100,targetPct)}%;background:var(--primary);height:10px;border-radius:4px"></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${[...visitors].reverse().map(v => {
            const it = INTEREST[v.interest]
            return `<div class="card" style="padding:11px 14px;border-left:3px solid var(--${it?.color});display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:700;font-size:0.84rem">${esc(v.name)} ${v.phone ? `<span style="font-size:0.7rem;color:var(--text-muted)">📞 ${esc(v.phone)}</span>` : '<span style="font-size:0.68rem;color:var(--danger)">ไม่มีเบอร์</span>'}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">🚗 ${v.model} · 👤 ${v.staff} · ${timeAgo(v.time)}${v.gift?' · 🎁':''}${v.testDrive?' · 🚗 TD':''}</div>
              </div>
              <span class="badge badge-${it?.color}" style="font-size:0.65rem">${it?.label}</span>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('checkin-btn')?.addEventListener('click', () => {
      openModal({
        title: '🎪 ลงทะเบียนผู้เยี่ยมชมบูธ',
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ *</label><input class="input" id="ec-name" autofocus></div>
          <div class="input-group"><label class="input-label">เบอร์โทร (สำคัญ!)</label><input class="input" id="ec-phone" type="tel"></div>
          <div class="input-group"><label class="input-label">รุ่นที่สนใจ</label>
            <select class="input" id="ec-model"><option>BYD Dolphin</option><option>BYD Atto 3</option><option>BYD Seal AWD</option><option>MG4</option><option>BYD Han</option><option>ยังไม่แน่ใจ</option></select>
          </div>
          <div class="input-group"><label class="input-label">ระดับความสนใจ</label>
            <select class="input" id="ec-interest">${Object.entries(INTEREST).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เซลส์ที่คุย</label>
            <select class="input" id="ec-staff">${EVENT_INFO.staff.map(s=>`<option>${s}</option>`).join('')}</select>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;justify-content:flex-end">
            <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer"><input type="checkbox" id="ec-gift" checked style="accent-color:var(--primary)"> 🎁 รับของที่ระลึก</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer"><input type="checkbox" id="ec-td" style="accent-color:var(--primary)"> 🚗 จอง Test Drive ที่โชว์รูม</label>
          </div>
        </div>`,
        confirmText: '✅ ลงทะเบียน',
        async onConfirm() {
          const name = document.getElementById('ec-name')?.value?.trim()
          if (!name) { showToast('❗ กรอกชื่อ', 'error'); return false }
          try {
            await createDoc('event_visitors', { name, phone:document.getElementById('ec-phone')?.value||'', model:document.getElementById('ec-model')?.value||'—', interest:document.getElementById('ec-interest')?.value||'browse', staff:document.getElementById('ec-staff')?.value||'—', time:new Date().toISOString(), gift:document.getElementById('ec-gift')?.checked||false, testDrive:document.getElementById('ec-td')?.checked||false })
            showToast('✅ ลงทะเบียนแล้ว', 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
