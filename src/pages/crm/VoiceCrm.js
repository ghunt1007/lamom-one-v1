/**
 * Voice-to-CRM — อัดเสียงการคุยกับลูกค้า → AI แปลงเป็น Note + Follow-up อัตโนมัติ
 * Route: /crm/voice-crm
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDateTime } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { uploadFile } from '../../utils/storage.js'
import { analyzeVoiceNote } from '../../utils/ai.js'
import { startMicRecording, stopMicRecording, blobToWavBase64, extFromMime } from '../../utils/audio.js'

// วิเคราะห์เสียงด้วย AI จริงแบบ "ปลอดภัย" — แปลงเป็น WAV ก่อนส่งเสมอ (Gemini ไม่รับ audio/webm)
// ถ้าแปลงไม่ได้/ไฟล์ยาวเกินงบ 20MB inline ของ Gemini หรือ AI พัง คืน null ให้ผู้เรียก fallback เอง
// (ไฟล์เสียงจริงยังอัปโหลด+เล่นได้ปกติเสมอ ไม่ขึ้นกับผลตรงนี้)
async function analyzeVoiceNoteSafe(blob) {
  try {
    const wav = await blobToWavBase64(blob)
    if (wav.tooLarge || wav.unsupported || !wav.base64) return null
    return await analyzeVoiceNote(wav.base64, wav.mimeType)
  } catch (e) { return null }
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// อ่านความยาวไฟล์เสียงจริงผ่าน HTML5 Audio API — เดิมสุ่มตัวเลขด้วย Math.random() ทั้งที่มีไฟล์จริงอยู่ในมือ
function getAudioDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    const done = sec => { URL.revokeObjectURL(url); resolve(sec != null && isFinite(sec) ? `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}` : null) }
    audio.addEventListener('loadedmetadata', () => done(audio.duration))
    audio.addEventListener('error', () => done(null))
  })
}

const SENT = {
  hot:  { label: '🔥 Hot',  color: 'var(--danger)' },
  warm: { label: '🌤 Warm', color: 'var(--warning)' },
  cold: { label: '❄️ Cold', color: 'var(--primary)' },
}

export default async function VoiceCrmPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let NOTES = []
  let recording = false
  let recSec = 0
  let recTimer = null
  let micSession = null
  let loading = true

  async function loadData() {
    loading = true
    try { NOTES = await listDocs('voice_notes', [], 'date', 'desc', 100) } catch (e) { NOTES = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎙 Voice-to-CRM</div>
            <div class="page-subtitle">อัดเสียงการคุยกับลูกค้า → AI สรุป + สร้าง Follow-up อัตโนมัติ</div>
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
            ${n.audioUrl
              ? `<audio controls preload="none" style="width:100%;margin-bottom:12px" src="${escHtml(n.audioUrl)}"></audio>`
              : `<div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:12px;text-align:center;color:var(--text-muted);font-size:0.72rem">⚠️ ไม่มีไฟล์เสียง (บันทึกไว้ก่อนเชื่อมต่อระบบอัดเสียงจริง)</div>`}
            <div style="margin-bottom:10px">
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">📝 AI สรุปการสนทนา${n.aiAnalyzed ? '' : ' <span style="color:var(--warning)">(ยังไม่ผ่าน AI จริง)</span>'}</div>
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
    container.querySelectorAll('.save-lead-btn').forEach(b => b.addEventListener('click', async () => {
      const n = NOTES.find(x => x.id === b.dataset.id)
      if (!n) return
      try {
        await updateDocData('voice_notes', n.id, { savedToCrm: true })
        showToast(`💾 บันทึก Follow-up จาก ${b.dataset.id} เข้าระบบ CRM แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
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
          🤖 <strong>AI สรุป:</strong> ${escHtml(n.summary)}${n.aiAnalyzed ? '' : ' <span style="color:var(--warning);font-size:0.68rem">(ยังไม่ผ่าน AI จริง)</span>'}
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

  async function toggleRec() {
    if (!recording) {
      try {
        micSession = await startMicRecording()
      } catch (e) {
        showToast('❌ ไม่สามารถเข้าถึงไมโครโฟนได้ — ตรวจสอบว่าอนุญาตสิทธิ์ไมค์ให้เบราว์เซอร์แล้ว', 'error')
        return
      }
      recording = true; recSec = 0; render()
      recTimer = setInterval(() => {
        recSec++
        const t = document.getElementById('rec-timer')
        if (t) t.textContent = `${String(Math.floor(recSec/60)).padStart(2,'0')}:${String(recSec%60).padStart(2,'0')}`
      }, 1000)
    } else {
      clearInterval(recTimer); recording = false
      const session = micSession; micSession = null
      const durSec = recSec
      render()
      const blob = await stopMicRecording(session)
      openRecordModal(blob, durSec)
    }
  }

  function openRecordModal(blob, durSec) {
    openModal({
      title: '🎙 บันทึกเสียงสำเร็จ',
      size: 'sm',
      body: `<div style="text-align:center;padding:16px">
        <div style="font-size:2rem;margin-bottom:8px">🔊</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">ระบุลูกค้าเพื่อบันทึก — กด "บันทึก" แล้ว AI จะฟังและวิเคราะห์เสียงจริงให้</div>
        <div class="input-group" style="margin-top:12px"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="vc-cust"></div>
        <div class="input-group" style="margin-top:8px"><label class="input-label">ความสนใจ (AI จะปรับให้ถ้าวิเคราะห์สำเร็จ)</label>
          <select class="input" id="vc-sent"><option value="hot">🔥 Hot</option><option value="warm" selected>🌤 Warm</option><option value="cold">❄️ Cold</option></select>
        </div>
      </div>`,
      confirmText: '✅ บันทึกและวิเคราะห์ด้วย AI',
      async onConfirm() {
        const cust = document.getElementById('vc-cust').value.trim()
        if (!cust) { showToast('❗ ระบุชื่อลูกค้า', 'error'); return false }
        const durLabel = `${String(Math.floor(durSec/60)).padStart(2,'0')}:${String(durSec%60).padStart(2,'0')}`
        try {
          const file = new File([blob], `voice-${Date.now()}.${extFromMime(blob.type)}`, { type: blob.type || 'audio/webm' })
          const upload = await uploadFile(file, 'voice-notes')
          const ai = await analyzeVoiceNoteSafe(blob)
          await createDoc('voice_notes', {
            customer: cust, duration: durLabel, date: new Date().toISOString(),
            sentiment: (ai && ai.sentiment) || document.getElementById('vc-sent').value,
            summary: (ai && ai.summary) || 'บันทึกเสียงสำเร็จแล้ว แต่ AI วิเคราะห์อัตโนมัติไม่สำเร็จ (ไฟล์ยาวเกินไปหรือรูปแบบไม่รองรับ) กรุณาสรุปเอง',
            followUps: (ai && ai.followUps.length) ? ai.followUps : ['ติดตามลูกค้าภายใน 24 ชั่วโมง'],
            tags: (ai && ai.tags) || [],
            audioUrl: upload.url, audioKey: upload.key, aiAnalyzed: !!(ai && !ai.demo),
          })
          showToast(`🎙 บันทึกเสียง ${cust} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e.message || ''), 'error') }
      }
    })
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
      async onConfirm() {
        const cust = document.getElementById('vc-imp-cust')?.value?.trim()
        const sent = document.getElementById('vc-imp-sent')?.value || 'warm'
        const file = document.getElementById('vc-file')?.files?.[0]
        if (!cust) { showToast('ระบุชื่อลูกค้า', 'warning'); return false }
        if (!file) { showToast('เลือกไฟล์เสียง', 'warning'); return false }
        const dur = await getAudioDuration(file)
        try {
          const upload = await uploadFile(file, 'voice-notes')
          const ai = await analyzeVoiceNoteSafe(file)
          await createDoc('voice_notes', {
            customer: cust,
            duration: dur ?? '-',
            date: new Date().toISOString(),
            summary: (ai && ai.summary) || `บันทึกไฟล์เสียง "${file.name}" สำเร็จแล้ว แต่ AI วิเคราะห์อัตโนมัติไม่สำเร็จ (ไฟล์ยาวเกินไปหรือรูปแบบไม่รองรับ) กรุณาสรุปเอง`,
            followUps: (ai && ai.followUps.length) ? ai.followUps : ['ติดตามผลการวิเคราะห์เสียง'],
            sentiment: (ai && ai.sentiment) || sent,
            tags: (ai && ai.tags) || [],
            audioUrl: upload.url, audioKey: upload.key, aiAnalyzed: !!(ai && !ai.demo),
          })
          showToast(`✅ บันทึกไฟล์เสียง "${file.name}" ของ ${cust} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e.message || ''), 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.5rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()

  // ถ้าออกจากหน้านี้ระหว่างกำลังอัดเสียงอยู่ (ไม่ได้กด "หยุดอัด" เอง) เดิมไม่มี cleanup เลย ทำให้
  // ไมโครโฟนค้างเปิดอัดต่อไปเรื่อยๆ เบื้องหลังแม้ออกจากหน้าไปแล้ว (ไฟไมค์ในเบราว์เซอร์ค้างติด สิ้นเปลือง
  // แบตเตอรี่ และเสียงที่อัดต่อจากตรงนี้ไม่มีที่ไปเลยเพราะไม่มีใครกด "หยุดอัด" ให้ประมวลผลต่อ)
  return function cleanupVoiceCrm() {
    if (recTimer) clearInterval(recTimer)
    if (micSession?.stream) micSession.stream.getTracks().forEach(t => t.stop())
  }
}
