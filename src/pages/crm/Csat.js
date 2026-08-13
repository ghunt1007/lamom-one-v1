/**
 * CSAT / NPS Dashboard — คะแนนความพึงพอใจลูกค้า
 * Route: /crm/csat
 */
import { formatDate, toDateStr } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { sendSms } from '../../utils/comms.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MONTH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// Fallback ตัวอย่างล้วน — ใช้แสดงเฉพาะตอนยังไม่มีข้อมูลจริงใน collection csat เลย (liveRecent ว่าง)
const MONTHLY_CSAT_DEMO = [
  { month:'ม.ค.', csat:87, nps:42, responses:48 },
  { month:'ก.พ.', csat:89, nps:45, responses:55 },
  { month:'มี.ค.', csat:84, nps:38, responses:62 },
  { month:'เม.ย.', csat:91, nps:51, responses:58 },
  { month:'พ.ค.', csat:93, nps:55, responses:71 },
  { month:'มิ.ย.', csat:90, nps:49, responses:43 },
]

// (v1.0.xxx) csat collection ไม่มี field แยกคะแนนรายหมวด (มีแค่ csat/nps รวมเดียว) จึงไม่มีข้อมูลจริงพอจะ
// คำนวณกราฟนี้ได้ — คงไว้เป็นตัวอย่างล้วน (ต่างจาก "CSAT รายเดือน" ด้านล่างที่คำนวณจากข้อมูลจริงได้แล้ว)
// และติดป้าย "(ตัวอย่าง)" ให้ตรงกับความจริงที่ UI แทนการแสดงเหมือนเป็นข้อมูลจริง
const CATEGORIES_DEMO = [
  { cat:'ความสะอาด',       score:94 },
  { cat:'ความรวดเร็ว',     score:82 },
  { cat:'ความเป็นมืออาชีพ', score:91 },
  { cat:'ราคาคุ้มค่า',     score:78 },
  { cat:'การสื่อสาร',      score:88 },
  { cat:'คุณภาพงาน',       score:93 },
]

export function npsType(score) {
  if (score >= 9) return { label:'Promoter', c:'var(--success)' }
  if (score >= 7) return { label:'Passive',  c:'var(--warning)' }
  return { label:'Detractor', c:'var(--danger)' }
}

export function starStr(score, max=5) {
  return '★'.repeat(score)+'☆'.repeat(max-score)
}

export default async function CsatPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let liveRecent = []
  let selMonth = 5
  let loading = true

  async function loadData() {
    loading = true
    try {
      const feedback = await listDocs('csat', [], 'createdAt', 'desc', 200)
      liveRecent = feedback.filter(f => !f.deleted).map(f => ({
        id: f.id,
        customer: f.customer || f.customerName || f.custName || 'ลูกค้า',
        phone: f.phone || f.custPhone || '',
        model: f.model || '',
        date: f.date || toDateStr(f.createdAt),
        csat: f.csat || f.csatScore || 4,
        nps: f.nps ?? f.npsScore ?? 7,
        comment: f.comment || f.feedback || '',
        surveyed: f.surveyed || false,
      }))
    } catch (e) { liveRecent = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  // (v1.0.xxx) เดิม "CSAT รายเดือน" เป็นเลขปั้น (MONTHLY_CSAT) ตายตัวเสมอ ไม่ขยับตามข้อมูลจริงใน collection
  // csat ที่หน้านี้โหลดมาอยู่แล้ว (liveRecent) — คำนวณจริงจาก liveRecent เมื่อมีข้อมูลจริงอย่างน้อย 1 รายการ
  // (จัดกลุ่มตามเดือนจาก r.date, csat% = คะแนนเฉลี่ย/5*100) ถ้ายังไม่มีข้อมูลจริงเลยค่อย fallback เป็นตัวอย่าง
  function computeMonthlyTrend() {
    if (!liveRecent.length) return { data: MONTHLY_CSAT_DEMO, isReal: false }
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), month: MONTH_ABBR[d.getMonth()] })
    }
    const byMonth = {}
    liveRecent.forEach(r => {
      const key = (r.date || '').slice(0, 7)
      if (!key) return
      if (!byMonth[key]) byMonth[key] = { csatSum: 0, npsSum: 0, count: 0 }
      byMonth[key].csatSum += r.csat
      byMonth[key].npsSum += r.nps
      byMonth[key].count++
    })
    const data = months.map(mo => {
      const b = byMonth[mo.key]
      return { month: mo.month, csat: b ? Math.round(b.csatSum / b.count / 5 * 100) : 0, nps: b ? Math.round(b.npsSum / b.count) : 0, responses: b ? b.count : 0 }
    })
    return { data, isReal: true }
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const { data: MONTHLY_CSAT, isReal: monthlyIsReal } = computeMonthlyTrend()
    const m = MONTHLY_CSAT[selMonth] || MONTHLY_CSAT[MONTHLY_CSAT.length - 1]
    const promoters  = liveRecent.filter(r => r.nps >= 9).length
    const detractors = liveRecent.filter(r => r.nps <= 6).length
    const maxCsat = Math.max(...MONTHLY_CSAT.map(x => x.csat), 1)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⭐ CSAT / NPS Dashboard</div>
            <div class="page-subtitle">ความพึงพอใจลูกค้า · Net Promoter Score · ปรับปรุงบริการ</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              ${MONTHLY_CSAT.map((mo,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${mo.month}</button>`).join('')}
            </div>
            <button class="btn btn-secondary" id="add-csat-btn" style="margin-left:8px">➕ บันทึกผลสำรวจ</button>
            <button class="btn btn-primary" id="send-survey-btn" style="margin-left:8px">📤 ส่งแบบสำรวจ</button>
          </div>
        </div>

        <!-- Hero KPIs -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('⭐ CSAT', m.csat+'%', m.csat>=90?'var(--success)':m.csat>=75?'var(--warning)':'var(--danger)')}
          ${sc('📊 NPS', m.nps, m.nps>=50?'var(--success)':m.nps>=30?'var(--warning)':'var(--danger)')}
          ${sc('📋 Responses', m.responses+' คน', 'var(--primary)')}
          ${sc('😊 Promoters', promoters+' คน', 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Left: charts -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- CSAT trend -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 CSAT รายเดือน (%)${monthlyIsReal ? '' : ' <span style="font-size:0.62rem;color:var(--text-muted);font-weight:400">(ตัวอย่าง — ยังไม่มีข้อมูลจริงใน CSAT)</span>'}</div>
              <div style="display:flex;align-items:flex-end;gap:6px;height:90px">
                ${MONTHLY_CSAT.map((mo,i) => {
                  const h = Math.max(4, Math.min(90, Math.round((mo.csat - 70) / 30 * 80 + 10)))
                  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                    <div style="font-size:0.6rem;color:${i===selMonth?'var(--primary)':'var(--text-muted)'};font-weight:${i===selMonth?700:400}">${mo.csat}%</div>
                    <div style="width:100%;height:${h}px;background:${i===selMonth?'var(--primary)':'var(--primary)55'};border-radius:4px 4px 0 0"></div>
                    <div style="font-size:0.58rem;color:var(--text-muted)">${mo.month}</div>
                  </div>`
                }).join('')}
              </div>
            </div>

            <!-- Category scores -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 คะแนนรายหมวด <span style="font-size:0.62rem;color:var(--text-muted);font-weight:400">(ตัวอย่าง — ยังไม่มี field คะแนนรายหมวดใน collection csat)</span></div>
              ${CATEGORIES_DEMO.map(cat => `
                <div style="margin-bottom:8px">
                  <div style="display:flex;justify-content:space-between;font-size:0.74rem;margin-bottom:3px">
                    <span>${cat.cat}</span>
                    <span style="font-weight:700;color:${cat.score>=90?'var(--success)':cat.score>=75?'var(--warning)':'var(--danger)'}">${cat.score}%</span>
                  </div>
                  <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${cat.score}%;background:${cat.score>=90?'var(--success)':cat.score>=75?'var(--warning)':'var(--danger)'};border-radius:3px"></div>
                  </div>
                </div>`).join('')}
            </div>
          </div>

          <!-- Right: recent reviews -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- NPS breakdown -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🎯 NPS Breakdown</div>
              <div style="display:flex;gap:0;height:16px;border-radius:8px;overflow:hidden;margin-bottom:10px">
                <div style="flex:${promoters};background:var(--success)" title="Promoters"></div>
                <div style="flex:${liveRecent.filter(r=>r.nps>=7&&r.nps<=8).length};background:var(--warning)" title="Passive"></div>
                <div style="flex:${detractors};background:var(--danger)" title="Detractors"></div>
              </div>
              <div style="display:flex;gap:12px;font-size:0.72rem">
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:var(--success);border-radius:50%"></span>Promoter ${promoters}</span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:var(--warning);border-radius:50%"></span>Passive ${liveRecent.filter(r=>r.nps>=7&&r.nps<=8).length}</span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:var(--danger);border-radius:50%"></span>Detractor ${detractors}</span>
              </div>
            </div>

            <!-- Recent reviews -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">💬 รีวิวล่าสุด</div>
              ${liveRecent.map(r => {
                const npt = npsType(r.nps)
                return `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                    <div>
                      <span style="font-weight:700">${escHtml(r.customer)}</span>
                      <span style="font-size:0.68rem;color:var(--text-muted)"> · ${escHtml(r.model)}</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                      <span style="color:#f59e0b;font-size:0.8rem">${starStr(r.csat)}</span>
                      <span style="font-size:0.6rem;background:${npt.c};color:#fff;padding:1px 6px;border-radius:8px">NPS ${r.nps} ${npt.label}</span>
                      <button class="btn btn-xs btn-secondary del-csat-btn" data-id="${r.id}" title="ลบ" style="color:var(--danger)">🗑</button>
                    </div>
                  </div>
                  ${r.comment?`<div style="font-size:0.68rem;color:var(--text-muted);font-style:italic">"${escHtml(r.comment)}"</div>`:''}
                  <div style="font-size:0.62rem;color:var(--text-muted);margin-top:2px">${formatDate(r.date)}</div>
                </div>`
              }).join('')}
              ${!liveRecent.length ? `<div style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:14px">ยังไม่มีผลสำรวจ — กด "➕ บันทึกผลสำรวจ"</div>` : ''}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selMonth = parseInt(b.dataset.i); render() }))
    document.getElementById('add-csat-btn')?.addEventListener('click', openAddCsatModal)
    container.querySelectorAll('.del-csat-btn').forEach(b => b.addEventListener('click', async () => {
      const r = liveRecent.find(x => x.id === b.dataset.id)
      if (!r) return
      const ok = await confirmDialog({ title: 'ลบผลสำรวจ', message: `ยืนยันลบผลสำรวจของ "${escHtml(r.customer)}" หรือไม่?`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('csat', r.id)
        showToast('🗑 ลบผลสำรวจแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
    document.getElementById('send-survey-btn')?.addEventListener('click', () => {
      const recipients = liveRecent.slice(0, 5).map(r => r.customer)
      openModal({
        title: '📤 ส่งแบบสำรวจ CSAT',
        size: 'sm',
        body: `<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:0.72rem;color:var(--text-muted)">ช่องทางส่ง</label>
            <div style="display:flex;gap:12px;margin-top:6px">
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.78rem"><input type="radio" name="csat-ch" value="sms" checked> 📱 SMS</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.78rem"><input type="radio" name="csat-ch" value="line"> 💚 LINE</label>
            </div>
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">ผู้รับ (${liveRecent.length} ราย)</div>
            <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.72rem;max-height:70px;overflow-y:auto">
              ${recipients.map(n => escHtml(n)).join(', ')}${liveRecent.length > 5 ? ` + อีก ${liveRecent.length - 5} ราย` : ''}
            </div>
          </div>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">ตัวอย่างข้อความ</div>
            <div style="background:var(--surface-2);border-radius:6px;padding:8px;font-size:0.72rem;color:var(--text-muted)">สวัสดีครับ! ขอบคุณที่ใช้บริการ LAMOM ONE รบกวนให้คะแนนบริการของเรา (1-5 ⭐) เพียง 30 วินาที 🙏 [ลิงก์แบบสำรวจ]</div>
          </div>
        </div>`,
        confirmText: '📤 ส่งแบบสำรวจ',
        async onConfirm() {
          // (v1.0.xxx) เดิมแค่ set surveyed:true ใน Firestore แต่ toast อ้างว่า "ส่งทาง SMS/LINE แล้ว" ทั้งที่
          // ไม่มีการเรียกช่องทางส่งจริงเลยสักครั้ง — ตอนนี้ SMS เรียก sendSms() จริง (utils/comms.js) เฉพาะ
          // ลูกค้าที่มีเบอร์โทรในเรคคอร์ดจริง ส่วน LINE ยังไม่มีการเชื่อม DM รายบุคคลจริงในระบบนี้ (เชื่อมแบบ
          // Broadcast ทั้งฐานเท่านั้น เหมือน CommInbox.js) จึงแจ้งตรงไปตรงมาแทนอ้างว่าส่งแล้ว
          const ch = document.querySelector('input[name="csat-ch"]:checked')?.value || 'sms'
          const withPhone = liveRecent.filter(r => r.phone)
          try {
            let msg = ''
            if (ch === 'sms') {
              if (withPhone.length) {
                await sendSms(withPhone.map(r => r.phone), 'สวัสดีครับ! ขอบคุณที่ใช้บริการ LAMOM ONE รบกวนให้คะแนนบริการของเรา (1-5 ⭐) เพียง 30 วินาที 🙏 [ลิงก์แบบสำรวจ]')
                msg = `✅ ส่ง SMS จริงถึงลูกค้า ${withPhone.length} ราย`
                if (withPhone.length < liveRecent.length) msg += ` (อีก ${liveRecent.length - withPhone.length} ราย ไม่มีเบอร์โทรในระบบ — ยังส่งไม่ได้)`
              } else {
                msg = '⚠️ ไม่มีเบอร์โทรลูกค้ารายใดในระบบ — ส่ง SMS จริงไม่ได้'
              }
            } else {
              msg = '📝 LINE: ยังไม่มีระบบส่งเจาะรายบุคคล (เชื่อมแบบ Broadcast ทั้งฐานลูกค้าเท่านั้น) — บันทึกสถานะไว้แล้ว กรุณาส่งเอง'
            }
            await Promise.all(liveRecent.map(r => updateDocData('csat', r.id, { surveyed: true })))
            showToast(msg, ch === 'sms' && withPhone.length ? 'success' : 'warning')
            await loadData()
          } catch (e) { showToast('ส่งไม่สำเร็จ: ' + e.message, 'error') }
        }
      })
    })
  }

  function openAddCsatModal() {
    openModal({
      title: '➕ บันทึกผลสำรวจ CSAT',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="nc-customer"></div>
        <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="nc-phone" placeholder="08xxxxxxxx"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="nc-model"></div>
        <div class="input-group"><label class="input-label">คะแนน CSAT (1-5 ดาว)</label>
          <select class="input" id="nc-csat">${[5,4,3,2,1].map(n => `<option value="${n}" ${n===5?'selected':''}>${starStr(n)} (${n})</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">NPS (0-10)</label><input class="input" type="number" id="nc-nps" min="0" max="10" value="7"></div>
        <div class="input-group"><label class="input-label">ความเห็นเพิ่มเติม</label><textarea class="input" id="nc-comment" rows="3"></textarea></div>
      </div>`,
      async onConfirm() {
        const customer = document.getElementById('nc-customer')?.value?.trim()
        if (!customer) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return false }
        const nps = Math.max(0, Math.min(10, parseInt(document.getElementById('nc-nps')?.value) || 0))
        try {
          await createDoc('csat', {
            customer,
            phone: document.getElementById('nc-phone')?.value?.trim() || '',
            model: document.getElementById('nc-model')?.value?.trim() || '',
            date: new Date().toISOString(),
            csat: parseInt(document.getElementById('nc-csat')?.value) || 5,
            nps,
            comment: document.getElementById('nc-comment')?.value?.trim() || '',
            surveyed: true,
          })
          showToast('✅ บันทึกผลสำรวจแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
