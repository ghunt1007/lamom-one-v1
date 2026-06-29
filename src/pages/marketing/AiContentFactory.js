/**
 * AI Content Factory — สร้าง Post/Caption/Hashtag อัตโนมัติด้วย AI
 * Route: /marketing/ai-content
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const TEMPLATES = [
  { id:'T1', name:'โปรโมชั่นรถใหม่', icon:'🚗', fields:['รุ่นรถ','ราคา','โปรโมชั่น'] },
  { id:'T2', name:'ราคาพิเศษวันนี้', icon:'🔥', fields:['รุ่นรถ','ราคาลด','วันหมดเขต'] },
  { id:'T3', name:'Test Drive Invite', icon:'🏎', fields:['รุ่นรถ','วันที่','สถานที่'] },
  { id:'T4', name:'รีวิวลูกค้า', icon:'⭐', fields:['ชื่อลูกค้า','รุ่นที่ซื้อ','ความรู้สึก'] },
  { id:'T5', name:'After Sales แจ้งเตือน', icon:'🔧', fields:['ชื่อลูกค้า','วันนัด','บริการ'] },
  { id:'T6', name:'Event Launch', icon:'🎉', fields:['ชื่องาน','วันที่','สถานที่'] },
]

const PLATFORMS = ['Facebook','Instagram','LINE','TikTok']

const EXAMPLES = {
  T1: {
    caption: '🚗 BYD Atto 3 Extended Range — ฟรีดาวน์! ผ่อนเพียง ฿12,900/เดือน\n\n✅ แบตเตอรี่ 84.9 kWh วิ่งได้ 600 กม.\n✅ ฟรีประกันชั้น 1 ปีแรก\n✅ บริการชาร์จฟรี 3 ปี\n\n📞 สนใจติดต่อ LAMOM ONE วันนี้!',
    hashtags: '#BYD #BYDAtto3 #รถไฟฟ้า #EV #ผ่อนถูก #LAOMONE #ฟรีดาวน์ #รถใหม่2569',
    alt: 'ภาพรถ BYD Atto 3 สีขาวมุก จอดหน้าโชว์รูม พร้อม banner โปรโมชั่น',
  },
  T2: {
    caption: '🔥 FLASH SALE วันนี้เท่านั้น!\nMG ZS EV ลดทันที ฿50,000\nจาก ฿1,099,000 เหลือ ฿1,049,000\n\n⚡ สต็อกมีจำกัด 5 คันสุดท้าย\n⏰ หมดเขต 30 มิ.ย. 2569',
    hashtags: '#MGZSEV #FlashSale #รถไฟฟ้าราคาถูก #EV #ลดราคา #LAOMONE',
    alt: 'รถ MG ZS EV สีขาว พร้อม price tag สีแดงแสดงส่วนลด',
  },
  T3: {
    caption: '🏎 มาลอง Test Drive BYD Atto 3 ฟรี!\nวันเสาร์ที่ 20 มิ.ย. 2569 เวลา 09:00–17:00\n📍 LAMOM ONE โชว์รูม กรุงเทพ\n\n🎁 รับของขวัญฟรีสำหรับผู้ทดลองขับ 30 ท่านแรก!',
    hashtags: '#TestDrive #BYD #BYDAtto3 #รถไฟฟ้า #EV #TestDriveDay #LAOMONE',
    alt: 'รถ BYD Atto 3 กำลังแล่นบนถนน นักขับยิ้มพอใจ',
  },
  T4: {
    caption: '⭐ คุณนภา แชร์ประสบการณ์หลังขับ BYD Seal AWD 3 เดือน\n\n"ประหยัดมากจริงๆ ชาร์จครั้งเดียววิ่งได้เกือบ 600 กม. ไม่ต้องแวะปั๊มน้ำมันเลย ประหยัดเดือนละ 8,000 บาท!" 🤩\n\n#ลูกค้าจริง #รีวิวจริง',
    hashtags: '#BYDSeal #รีวิว #EV #รถไฟฟ้า #ประหยัดน้ำมัน #LAOMONE',
    alt: 'ลูกค้ายืนข้างรถ BYD Seal สีดำ ยิ้มให้กล้อง',
  },
  T5: {
    caption: '🔧 แจ้งเตือน! คุณสมชาย\nรถ BYD Dolphin ของคุณถึงกำหนดเข้าศูนย์บริการแล้ว\n\n📅 วันจันทร์ที่ 22 มิ.ย. 2569 เวลา 10:00\n🏢 LAMOM ONE Service Center\n\n📞 โทรยืนยัน 02-xxx-xxxx',
    hashtags: '#AfterSales #BYD #บริการหลังการขาย #LAOMONE',
    alt: 'ช่างกำลังเช็กระยะรถไฟฟ้าในศูนย์บริการสะอาด',
  },
  T6: {
    caption: '🎉 LAMOM ONE Launch Event!\nพบกับ BYD รุ่นใหม่ล่าสุด และ MG ทุกรุ่นปี 2570\n\n📅 7–8 ก.ค. 2569\n📍 Central World Hall A\n⏰ 10:00–21:00\n\n🎁 ราคา Pre-order พิเศษเฉพาะงานเท่านั้น!',
    hashtags: '#LAMOMONELaunch #BYD #MG #EV #รถไฟฟ้า #MotorShow2570',
    alt: 'บูธ LAMOM ONE ตกแต่งสวยงาม มีรถไฟฟ้าจัดแสดงหลายรุ่น',
  },
}

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
  let selectedTemplate = TEMPLATES[0]
  let selectedPlatforms = ['Facebook']
  let generated = null
  let contentHistory = []

  function render() {
    const ex = generated || EXAMPLES[selectedTemplate.id] || EXAMPLES['T1']

    const fieldInputs = selectedTemplate.fields.map(f =>
      '<div style="margin-bottom:8px">' +
        '<label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:3px">' + f + '</label>' +
        '<input class="form-input" style="width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:0.8rem" placeholder="กรอก ' + f + '..." />' +
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
              <div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:10px">
                <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">📝 Caption</div>
                <div style="font-size:0.78rem;line-height:1.6;white-space:pre-line">${ex.caption}</div>
              </div>
              <div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:10px">
                <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px"># Hashtags</div>
                <div style="font-size:0.72rem;color:var(--primary)">${ex.hashtags}</div>
              </div>
              <div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:12px">
                <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">🖼 Alt Text (สำหรับ SEO)</div>
                <div style="font-size:0.72rem">${ex.alt}</div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" id="copy-btn" style="flex:1">📋 Copy ทั้งหมด</button>
                <button class="btn btn-primary" id="schedule-btn" style="flex:1">📅 Schedule Post</button>
              </div>
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
    document.getElementById('gen-btn')?.addEventListener('click', () => {
      showToast('✨ AI กำลังสร้าง Content...', 'success')
      setTimeout(() => {
        generated = EXAMPLES[selectedTemplate.id] || EXAMPLES['T1']
        contentHistory.unshift({
          id: 'H' + (contentHistory.length + 1),
          template: selectedTemplate.name,
          icon: selectedTemplate.icon,
          platforms: [...selectedPlatforms],
          content: generated,
          createdAt: new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }),
        })
        render()
        showToast('✅ สร้าง Content สำเร็จ!', 'success')
      }, 1000)
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
            <div><label style="font-size:0.72rem;color:var(--text-muted)">วันที่</label><input class="input" id="sch-date" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;margin-top:3px"></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">เวลา</label><input class="input" id="sch-time" type="time" value="09:00" style="width:100%;margin-top:3px"></div>
          </div>
          <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.7rem;color:var(--text-muted)">${preview}</div>
        </div>`,
        confirmText: '📅 ยืนยัน Schedule',
        onConfirm() {
          const dt = document.getElementById('sch-date')?.value
          const tm = document.getElementById('sch-time')?.value
          contentHistory.unshift({ template: selectedTemplate.name, platforms: [...selectedPlatforms], generated, scheduledAt: `${dt} ${tm}`, createdAt: new Date().toISOString() })
          render()
          showToast(`📅 Schedule โพสต์ ${dt} ${tm} (${selectedPlatforms.join('+')}) แล้ว`, 'success')
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
                <span style="font-size:0.68rem;color:var(--text-muted)">${h.createdAt}</span>
              </div>
              <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:6px">
                📱 ${h.platforms.join(' · ')}
              </div>
              <div style="font-size:0.74rem;background:var(--surface-2);border-radius:6px;padding:8px;white-space:pre-line;max-height:80px;overflow:hidden;text-overflow:ellipsis">
                ${h.content.caption.substring(0, 120)}${h.content.caption.length > 120 ? '...' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `
    })
  }

  render()
}
