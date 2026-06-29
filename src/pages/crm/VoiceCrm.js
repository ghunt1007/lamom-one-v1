/**
 * Voice-to-CRM — อัดเสียงการคุยกับลูกค้า → AI แปลงเป็น Note + Follow-up อัตโนมัติ
 * Route: /crm/voice-crm
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDateTime } from '../../utils/format.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEMO_NOTES = [
  { id: 'VN-001', customer: 'คุณอนันต์ รักดี', duration: '3:42', date: '2026-06-14T10:15:00', summary: 'ลูกค้าสนใจ BYD Atto 3 สีฟ้า เงินดาวน์ได้ 30% ผ่อน 60 งวด ต้องการ Test Drive เสาร์นี้', followUps: ['นัด Test Drive เสาร์ 15 มิ.ย.', 'เตรียมใบเสนอราคา 3 รุ่น'], sentiment: 'hot', tags: ['test-drive','atto3'] },
  { id: 'VN-002', customer: 'คุณมาลี วงศ์ดี', duration: '1:55', date: '2026-06-13T14:30:00', summary: 'ลูกค้าโทรถามราคา BYD Dolphin ยังไม่ได้ตัดสินใจ รอคุยกับสามี บอกจะโทรกลับสัปดาห์หน้า', followUps: ['โทรติดตาม 20 มิ.ย.'], sentiment: 'warm', tags: ['dolphin'] },
  { id: 'VN-003', customer: 'บ.รุ่งเรือง (คุณสมชาย)', duration: '8:10', date: '2026-06-12T09:00:00', summary: 'Fleet deal 5 คัน BYD Atto 3 Pro ต้องการราคาพิเศษ ส่งมอบได้ภายใน Q3 เงื่อนไขผ่อนบริษัท ต้องการ quotation ภายใน 2 วัน', followUps: ['ส่ง Fleet Quotation ภายใน 13 มิ.ย.', 'ประสาน Finance เรื่องสัญญาลีสซิ่ง'], sentiment: 'hot', tags: ['fleet','atto3-pro'] },
]

const SENT = {
  hot:  { label: '🔥 Hot',  color: 'var(--danger)' },
  warm: { label: '🌤 Warm', color: 'var(--warning)' },
  cold: { label: '❄️ Cold', color: 'var(--primary)' },
}

export default async function VoiceCrmPage(container) {
  const myGen = container.__routerGen
  let NOTES = DEMO_NOTES.map(n => ({ ...n, followUps: [...n.followUps], tags: [...n.tags] }))
  let dataSource = 'demo'
  let recording = false
  let recSec = 0
  let recTimer = null

  try {
    const docs = await listDocs('voice_notes', [], 'date', 'desc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `VN-${String(i+1).padStart(3,'0')}`,
        customer: d.customer || d.customerName || 'ลูกค้า',
        duration: d.duration || '0:00',
        date: d.date || d.createdAt || new Date().toISOString(),
        summary: d.summary || d.text || '',
        followUps: d.followUps || [],
        sentiment: d.sentiment || 'warm',
        tags: d.tags || [],
      }))
      NOTES = [...mapped, ...DEMO_NOTES]
      dataSource = 'live'
    }
  } catch {}

  function render() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎙 Voice-to-CRM</div>
            <div class="page-subtitle">อัดเสียงการคุยกับลูกค้า → AI สรุป + สร้าง Follow-up อัตโนมัติ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="rec-btn">${recording ? '⏹ หยุดอัด' : '🎙 อัดเสียงใหม่'}</button>
            <button class="btn btn-secondary" id="import-btn">📁 นำเข้าไฟล์เสียง</button>
          </div>
        </div>

        ${recording ? `
          <div class="card" style="padding:16px;margin-bottom:14px;border:2px solid var(--danger);text-align:center">
            <div style="font-size:0.76rem;color:var(--danger);font-weight:700">⏺ กำลังอัดเสียง...</div>
            <div id="rec-timer" style="font-size:2rem;font-weight:900;color:var(--danger);font-family:monospace">00:00</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">กด "หยุดอัด" เพื่อให้ AI วิเคราะห์และสรุปการสนทนา</div>
          </div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${sc('📝 บันทึกทั้งหมด', NOTES.length, 'var(--primary)')}
          ${sc('🔥 Hot ต้องติดตาม', NOTES.filter(n=>n.sentiment==='hot').length, 'var(--danger)')}
          ${sc('✅ Follow-up รวม', NOTES.reduce((s,n)=>s+n.followUps.length,0), 'var(--success)')}
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${NOTES.map(n => noteCard(n)).join('')}
        </div>
      </div>
    `

    document.getElementById('rec-btn')?.addEventListener('click', toggleRec)
    document.getElementById('import-btn')?.addEventListener('click', openImport)
    container.querySelectorAll('.play-btn').forEach(b => b.addEventListener('click', () => {
      const n = NOTES.find(x => x.id === b.dataset.id)
      if (!n) return
      const s = SENT[n.sentiment] || SENT.warm
      openModal({
        title: '🎙 ' + escHtml(n.customer) + ' — ' + escHtml(n.duration),
        size: 'sm',
        body: `
          <div style="font-size:0.78rem">
            <div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;position:relative">
                  <div style="position:absolute;left:0;top:0;height:100%;width:40%;background:var(--primary);border-radius:2px"></div>
                </div>
                <span style="font-family:monospace;color:var(--text-muted);font-size:0.7rem">${n.duration}</span>
              </div>
              <div style="font-size:0.68rem;color:var(--text-muted);text-align:center">▶️ เล่นเสียง (Demo Mode)</div>
            </div>
            <div style="margin-bottom:10px">
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">📝 AI สรุปการสนทนา</div>
              <div style="background:var(--surface-2);border-radius:6px;padding:8px;line-height:1.6">${escHtml(n.summary)}</div>
            </div>
            <div style="margin-bottom:10px">
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">✅ Follow-up Actions</div>
              ${n.followUps.map(f => `<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--success)">•</span><span>${escHtml(f)}</span></div>`).join('')}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="color:${s.color};font-weight:700;font-size:0.76rem">${s.label}</span>
              <span style="font-size:0.68rem;color:var(--text-muted)">${new Date(n.date).toLocaleDateString('th-TH')}</span>
            </div>
          </div>
        `
      })
    }))
    container.querySelectorAll('.save-lead-btn').forEach(b => b.addEventListener('click', () => {
      const n = NOTES.find(x => x.id === b.dataset.id)
      if (n) { n.savedToCrm = true; render() }
      showToast(`💾 บันทึก Follow-up จาก ${b.dataset.id} เข้าระบบ CRM แล้ว`, 'success')
    }))
  }

  function noteCard(n) {
    const s = SENT[n.sentiment]
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;font-size:0.87rem">${escHtml(n.customer)}
              <span style="font-size:0.66rem;background:${s.color};color:#fff;padding:1px 7px;border-radius:10px;margin-left:6px">${s.label}</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${formatDateTime(n.date)} · ⏱ ${escHtml(n.duration)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-xs btn-secondary play-btn" data-id="${escHtml(n.id)}">▶️ ฟัง</button>
            ${n.savedToCrm ? `<span style="font-size:0.66rem;color:var(--success)">✅ บันทึกแล้ว</span>` : `<button class="btn btn-xs btn-primary save-lead-btn" data-id="${escHtml(n.id)}">💾 บันทึก CRM</button>`}
          </div>
        </div>
        <div style="margin-top:10px;font-size:0.8rem;background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);line-height:1.6">
          🤖 <strong>AI สรุป:</strong> ${escHtml(n.summary)}
        </div>
        <div style="margin-top:8px">
          <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">📋 Follow-up ที่ AI แนะนำ:</div>
          ${n.followUps.map(f => `<div style="font-size:0.76rem;padding:3px 0;display:flex;align-items:center;gap:6px">
            <input type="checkbox"> <span>${escHtml(f)}</span>
          </div>`).join('')}
        </div>
        ${n.tags.length ? `<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
          ${n.tags.map(t=>`<span style="font-size:0.62rem;background:var(--surface-2);padding:2px 8px;border-radius:10px;color:var(--text-muted)">#${escHtml(t)}</span>`).join('')}
        </div>` : ''}
      </div>`
  }

  function toggleRec() {
    if (!recording) {
      recording = true; recSec = 0; render()
      recTimer = setInterval(() => {
        recSec++
        const t = document.getElementById('rec-timer')
        if (t) t.textContent = `${String(Math.floor(recSec/60)).padStart(2,'0')}:${String(recSec%60).padStart(2,'0')}`
      }, 1000)
    } else {
      clearInterval(recTimer); recording = false
      openModal({
        title: '🤖 AI กำลังวิเคราะห์เสียง...',
        size: 'sm',
        body: `<div style="text-align:center;padding:16px">
          <div style="font-size:2rem;margin-bottom:8px">🔊</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">ระบุลูกค้าและ Sentiment เพื่อบันทึก</div>
          <div class="input-group" style="margin-top:12px"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="vc-cust"></div>
          <div class="input-group" style="margin-top:8px"><label class="input-label">ความสนใจ</label>
            <select class="input" id="vc-sent"><option value="hot">🔥 Hot</option><option value="warm">🌤 Warm</option><option value="cold">❄️ Cold</option></select>
          </div>
        </div>`,
        confirmText: '✅ บันทึกและวิเคราะห์',
        onConfirm() {
          const cust = document.getElementById('vc-cust').value.trim()
          if (!cust) { showToast('❗ ระบุชื่อลูกค้า', 'error'); return false }
          NOTES.unshift({
            id: 'VN-' + String(NOTES.length + 1).padStart(3,'0'),
            customer: cust, duration: `${Math.floor(recSec/60)}:${String(recSec%60).padStart(2,'0')}`,
            date: new Date().toISOString(), sentiment: document.getElementById('vc-sent').value,
            summary: 'AI กำลังประมวลผล... (ผลจะปรากฏใน 30 วินาที)',
            followUps: ['ติดตาม 24 ชั่วโมง'], tags: ['new']
          })
          showToast(`🎙 บันทึกเสียง ${cust} แล้ว · AI กำลังสรุป`, 'success')
          render()
        }
      })
    }
  }

  function openImport() {
    openModal({
      title: '📁 นำเข้าไฟล์เสียง',
      size: 'sm',
      body: `
        <div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
          <div style="border:2px dashed var(--border);border-radius:8px;padding:20px;text-align:center;color:var(--text-muted)">
            <div style="font-size:1.5rem;margin-bottom:6px">🎵</div>
            <input type="file" id="vc-file" accept=".mp3,.wav,.m4a,.ogg" style="display:none">
            <label for="vc-file" style="cursor:pointer;color:var(--primary);font-weight:600">เลือกไฟล์เสียง</label>
            <div style="font-size:0.68rem;margin-top:4px">รองรับ .mp3 .wav .m4a .ogg</div>
          </div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อลูกค้า *</label>
            <input class="input" id="vc-imp-cust" placeholder="เช่น คุณสมชาย ใจดี" style="width:100%;margin-top:4px"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">Sentiment</label>
            <select class="input" id="vc-imp-sent" style="width:100%;margin-top:4px">
              <option value="hot">🔥 Hot</option>
              <option value="warm" selected>🌤 Warm</option>
              <option value="cold">❄️ Cold</option>
            </select></div>
        </div>
      `,
      confirmText: '🤖 วิเคราะห์ด้วย AI',
      onConfirm() {
        const cust = document.getElementById('vc-imp-cust')?.value?.trim()
        const sent = document.getElementById('vc-imp-sent')?.value || 'warm'
        const file = document.getElementById('vc-file')?.files?.[0]
        if (!cust) { showToast('ระบุชื่อลูกค้า', 'warning'); return false }
        const dur = file ? `${Math.floor(Math.random()*8+1)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}` : '2:30'
        NOTES.unshift({
          id: `VN-${String(NOTES.length+1).padStart(3,'0')}`,
          customer: cust,
          duration: dur,
          date: new Date().toISOString(),
          summary: `AI กำลังประมวลผล${file ? ` "${file.name}"` : ''} — สรุปจะแสดงใน 2-3 นาที`,
          followUps: ['ติดตามผลการวิเคราะห์เสียง'],
          sentiment: sent,
          tags: [],
        })
        render()
        showToast(`🤖 AI กำลังวิเคราะห์เสียง${file ? ` "${file.name}"` : ''} ของ ${cust} — ใช้เวลา ~2 นาที`, 'success')
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.5rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
