/**
 * AI Content Factory — สร้าง Post/Caption/Hashtag อัตโนมัติด้วย AI
 * Route: /marketing/ai-content
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'
import { generateSocialContent } from '../../utils/ai.js'
import { todayBangkok } from '../../utils/format.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const TEMPLATES = [
  { id:'T1', name:'โปรโมชั่นรถใหม่', icon:'🚗', fields:['รุ่นรถ','ราคา','โปรโมชั่น'] },
  { id:'T2', name:'ราคาพิเศษวันนี้', icon:'🔥', fields:['รุ่นรถ','ราคาลด','วันหมดเขต'] },
  { id:'T3', name:'Test Drive Invite', icon:'🏎', fields:['รุ่นรถ','วันที่','สถานที่'] },
  { id:'T4', name:'รีวิวลูกค้า', icon:'⭐', fields:['ชื่อลูกค้า','รุ่นที่ซื้อ','ความรู้สึก'] },
  { id:'T5', name:'After Sales แจ้งเตือน', icon:'🔧', fields:['ชื่อลูกค้า','วันนัด','บริการ'] },
  { id:'T6', name:'Event Launch', icon:'🎉', fields:['ชื่องาน','วันที่','สถานที่'] },
]

const PLATFORMS = ['Facebook','Instagram','LINE','TikTok']

// (v1.0.331) เดิม EXAMPLES ด้านนี้เป็นข้อความสำเร็จรูป 6 ชุดตายตัว ปุ่ม "สร้าง Content ด้วย AI" แค่หยิบ
// ตัวอย่างชุดที่ตรงกับ template มาโชว์ ไม่อ่านค่าที่พิมพ์กรอกในช่อง รุ่นรถ/ราคา/โปรโมชั่น ฯลฯ เลยแม้แต่ตัว
// เดียว (ทั้งที่ label บอกว่า "สร้าง Content ด้วย AI") แก้ให้เรียก AI จริงผ่าน generateSocialContent()
// (utils/ai.js) ส่งข้อมูลที่กรอกจริงไปให้ AI เขียนเนื้อหาจริง

function templateBtn(t, sel) {
  return '<button class="btn btn-sm ' + (sel ? 'btn-primary' : 'btn-secondary') + ' tmpl-btn" data-id="' + t.id + '" style="text-align:left;width:100%;margin-bottom:6px;justify-content:flex-start">' +
    t.icon + ' ' + t.name +
  '</button>'
}

function platformChip(p, sel) {
  const colors = { Facebook:'#1877f2', Instagram:'#e1306c', LINE:'#00b900', TikTok:'#333' }
  const c = colors[p] || 'var(--primary)'
  return '<span class="plat-chip" data-p="' + p + '" style="cursor:pointer;display:inline-flex;align-items:center;padding:4px 12px;border-radius:8px;font-size:0.72rem;font-weight:600;margin:3px;background:' + (sel ? c : 'var(--surface-2)') + ';color:' + (sel ? '#fff' : 'var(--text-muted)') + ';border:1px solid ' + (sel ? c : 'var(--border)') + '">' + p + '</span>'
}

export default async function AiContentFactoryPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let selectedTemplate = TEMPLATES[0]
  let selectedPlatforms = ['Facebook']
  let generated = null
  let contentHistory = []

  async function loadHistory() {
    try { contentHistory = await listDocs('content_history', [], 'createdAt', 'desc', 200) } catch (e) { contentHistory = [] }
  }

  function render() {
    const fieldInputs = selectedTemplate.fields.map(f =>
      '<div style="margin-bottom:8px">' +
        '<label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:3px">' + esc(f) + '</label>' +
        '<input class="form-input ai-field-input" data-field="' + esc(f) + '" style="width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:16px" placeholder="กรอก ' + esc(f) + '..." />' +
      '</div>'
    ).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">✨ AI Content Factory</div>
            <div class="page-subtitle">สร้าง Post / Caption / Hashtag อัตโนมัติด้วย AI</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="history-btn">📋 ประวัติ Content</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:260px 1fr;gap:14px">
          <div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">📋 เลือก Template</div>
              ${TEMPLATES.map(t => templateBtn(t, selectedTemplate.id === t.id)).join('')}
            </div>
            <div class="card" style="padding:14px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">📱 Platform</div>
              <div>${PLATFORMS.map(p => platformChip(p, selectedPlatforms.includes(p))).join('')}</div>
            </div>
          </div>

          <div>
            <div class="card" style="padding:14px;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px">✏️ ข้อมูลตั้งต้น — ${selectedTemplate.icon} ${selectedTemplate.name}</div>
              ${fieldInputs}
              <button class="btn btn-primary" id="gen-btn" style="width:100%;margin-top:6px">✨ สร้าง Content ด้วย AI</button>
            </div>

            <div class="card" style="padding:14px">
              <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px">📤 Content ที่สร้างได้</div>
              ${!generated ? `<div class="empty-state" style="padding:24px"><div class="empty-icon">✨</div><div class="empty-title">ยังไม่ได้สร้าง Content</div><div class="empty-desc">กรอกข้อมูลด้านซ้ายแล้วกด "✨ สร้าง Content ด้วย AI"</div></div>` : `
              <div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:10px">
                <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">📝 Caption</div>
                <div style="font-size:0.78rem;line-height:1.6;white-space:pre-line">${esc(generated.caption)}</div>
              </div>
              <div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:10px">
                <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px"># Hashtags</div>
                <div style="font-size:0.72rem;color:var(--primary)">${esc(generated.hashtags)}</div>
              </div>
              <div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:12px">
                <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">🖼 Alt Text (สำหรับ SEO)</div>
                <div style="font-size:0.72rem">${esc(generated.alt)}</div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" id="copy-btn" style="flex:1">📋 Copy ทั้งหมด</button>
                <button class="btn btn-primary" id="schedule-btn" style="flex:1">📅 Schedule Post</button>
              </div>
              `}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.tmpl-btn').forEach(b => b.addEventListener('click', () => {
      selectedTemplate = TEMPLATES.find(t => t.id === b.dataset.id) || TEMPLATES[0]
      generated = null
      render()
    }))
    container.querySelectorAll('.plat-chip').forEach(c => c.addEventListener('click', () => {
      const p = c.dataset.p
      if (selectedPlatforms.includes(p)) selectedPlatforms = selectedPlatforms.filter(x => x !== p)
      else selectedPlatforms.push(p)
      render()
    }))
    document.getElementById('gen-btn')?.addEventListener('click', async () => {
      const fields = {}
      container.querySelectorAll('.ai-field-input').forEach(inp => { fields[inp.dataset.field] = inp.value.trim() })
      const btn = document.getElementById('gen-btn'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> AI กำลังสร้าง Content...'
      try {
        const result = await generateSocialContent(selectedTemplate.name, fields, selectedPlatforms)
        generated = { caption: result.caption, hashtags: result.hashtags, alt: result.alt }
        render()
        if (result.demo) showToast('🤖 Demo mode — ล็อกอินด้วยบัญชีจริงเพื่อสร้าง Content จริง', 'info')
        else showToast('✅ สร้าง Content สำเร็จ!', 'success')
        try {
          await createDoc('content_history', {
            template: selectedTemplate.name,
            icon: selectedTemplate.icon,
            platforms: [...selectedPlatforms],
            content: generated,
            displayTime: new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }),
          })
          await loadHistory()
        } catch (e) { /* ประวัติบันทึกไม่สำเร็จ ไม่กระทบการสร้าง content */ }
      } catch (err) {
        showToast(`❗ สร้าง Content ไม่สำเร็จ: ${err.message || 'ไม่ทราบสาเหตุ'}`, 'error')
        btn.disabled = false; btn.textContent = '✨ สร้าง Content ด้วย AI'
      }
    })
    document.getElementById('copy-btn')?.addEventListener('click', () => {
      if (!generated) { showToast('สร้าง Content ก่อนแล้วค่อย Copy', 'warning'); return }
      const text = typeof generated === 'object'
        ? Object.values(generated).flat().join('\n\n')
        : String(generated)
      navigator.clipboard?.writeText(text)
        .then(() => showToast('📋 Copy Content แล้ว!', 'success'))
        .catch(() => showToast('📋 Copy ไม่ได้ — กรุณา Ctrl+C เอง', 'warning'))
    })
    document.getElementById('schedule-btn')?.addEventListener('click', () => {
      if (!generated) { showToast('สร้าง Content ก่อนแล้วค่อย Schedule', 'warning'); return }
      const preview = typeof generated === 'object'
        ? Object.values(generated).flat().join(' · ').slice(0, 100) + '...'
        : String(generated).slice(0, 100) + '...'
      openModal({
        title: '📅 กำหนดเวลาโพสต์',
        size: 'sm',
        body: `<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:0.72rem;color:var(--text-muted)">แพลตฟอร์ม</label>
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
              ${selectedPlatforms.map(p => `<span style="background:var(--primary);color:#fff;padding:3px 10px;border-radius:12px;font-size:0.72rem">${p}</span>`).join('')}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่</label><input class="input" id="sch-date" type="date" value="${todayBangkok()}" style="width:100%;margin-top:3px"></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">เวลา</label><input class="input" id="sch-time" type="time" value="09:00" style="width:100%;margin-top:3px"></div>
          </div>
          <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.7rem;color:var(--text-muted)">${preview}</div>
        </div>`,
        confirmText: '📅 ยืนยัน Schedule',
        async onConfirm() {
          const dt = document.getElementById('sch-date')?.value
          const tm = document.getElementById('sch-time')?.value
          try {
            await createDoc('content_history', {
              template: selectedTemplate.name, icon: selectedTemplate.icon,
              platforms: [...selectedPlatforms], content: generated,
              scheduledAt: `${dt} ${tm}`,
              displayTime: new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }),
            })
            await loadHistory()
            showToast(`📅 Schedule โพสต์ ${dt} ${tm} (${selectedPlatforms.join('+')}) แล้ว`, 'success')
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    })
    document.getElementById('history-btn')?.addEventListener('click', () => openHistoryModal())
  }

  function openHistoryModal() {
    if (contentHistory.length === 0) {
      showToast('ยังไม่มีประวัติ — กด "สร้าง Content" ก่อน', 'warning')
      return
    }
    openModal({
      title: '📋 ประวัติ Content ที่สร้าง',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">
          ${contentHistory.map(h => `
            <div class="card" style="padding:12px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <span style="font-weight:700;font-size:0.82rem">${h.icon} ${h.template}</span>
                <span style="font-size:0.68rem;color:var(--text-muted)">${h.displayTime || ''}</span>
              </div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:6px">
                📱 ${h.platforms.join(' · ')}
              </div>
              <div style="font-size:0.74rem;background:var(--surface-2);border-radius:6px;padding:8px;white-space:pre-line;max-height:80px;overflow:hidden;text-overflow:ellipsis">
                ${esc((h.content?.caption || '').substring(0, 120))}${(h.content?.caption || '').length > 120 ? '...' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `
    })
  }

  await loadHistory()
  render()
}
