/**
 * CSAT / NPS Dashboard — คะแนนความพึงพอใจลูกค้า
 * Route: /crm/csat
 */
import { formatDate } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'
import { openModal } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

const MONTHLY_CSAT = [
  { month:'ม.ค.', csat:87, nps:42, responses:48 },
  { month:'ก.พ.', csat:89, nps:45, responses:55 },
  { month:'มี.ค.', csat:84, nps:38, responses:62 },
  { month:'เม.ย.', csat:91, nps:51, responses:58 },
  { month:'พ.ค.', csat:93, nps:55, responses:71 },
  { month:'มิ.ย.', csat:90, nps:49, responses:43 },
]

const CATEGORIES = [
  { cat:'ความสะอาด',       score:94 },
  { cat:'ความรวดเร็ว',     score:82 },
  { cat:'ความเป็นมืออาชีพ', score:91 },
  { cat:'ราคาคุ้มค่า',     score:78 },
  { cat:'การสื่อสาร',      score:88 },
  { cat:'คุณภาพงาน',       score:93 },
]

const RECENT = [
  { id:'CS001', customer:'สมชาย ใจดี',  model:'BYD Atto 3', date:'2026-06-13', csat:5, nps:9, comment:'บริการดีมาก ช่างอธิบายละเอียด' },
  { id:'CS002', customer:'นภา สุขใจ',   model:'MG ZS EV',   date:'2026-06-12', csat:4, nps:7, comment:'รอนานนิดหน่อย แต่งานเรียบร้อย' },
  { id:'CS003', customer:'วิชัย ดีมาก', model:'BYD Seal',   date:'2026-06-12', csat:2, nps:3, comment:'อะไหล่ไม่มีต้องรอนาน 3 วัน' },
  { id:'CS004', customer:'มาลี รุ่งเรือง',model:'BYD Han',   date:'2026-06-11', csat:5, nps:10,comment:'ประทับใจมากครับ จะแนะนำเพื่อน' },
  { id:'CS005', customer:'อรุณ วิชิต',  model:'BYD Dolphin',date:'2026-06-10', csat:3, nps:6, comment:'' },
]

function npsType(score) {
  if (score >= 9) return { label:'Promoter', c:'var(--success)' }
  if (score >= 7) return { label:'Passive',  c:'var(--warning)' }
  return { label:'Detractor', c:'var(--danger)' }
}

function starStr(score, max=5) {
  return '★'.repeat(score)+'☆'.repeat(max-score)
}

export default async function CsatPage(container) {
  const myGen = container.__routerGen
  let liveRecent = [...RECENT]
  let dataSource = 'demo'
  let selMonth = 5

  try {
    const feedback = await listDocs('csat', [], 'createdAt', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (feedback.length >= 2) {
      liveRecent = feedback.map(f => ({
        id: f.id || f.docId,
        customer: f.customerName || f.custName || 'ลูกค้า',
        model: f.model || '',
        date: (f.createdAt?.toDate?.()?.toISOString() || f.date || '').slice(0, 10),
        csat: f.csat || f.csatScore || 4,
        nps: f.nps || f.npsScore || 7,
        comment: f.comment || f.feedback || '',
      }))
      dataSource = 'live'
    }
  } catch {}

  function render() {
    const m = MONTHLY_CSAT[selMonth]
    const promoters  = liveRecent.filter(r => r.nps >= 9).length
    const detractors = liveRecent.filter(r => r.nps <= 6).length
    const maxCsat = Math.max(...MONTHLY_CSAT.map(x => x.csat))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⭐ CSAT / NPS Dashboard</div>
            <div class="page-subtitle">ความพึงพอใจลูกค้า · Net Promoter Score · ปรับปรุงบริการ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              ${MONTHS.map((mo,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${mo}</button>`).join('')}
            </div>
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
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📈 CSAT รายเดือน (%)</div>
              <div style="display:flex;align-items:flex-end;gap:6px;height:90px">
                ${MONTHLY_CSAT.map((mo,i) => {
                  const h = Math.round((mo.csat - 70) / 30 * 80 + 10)
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
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 คะแนนรายหมวด</div>
              ${CATEGORIES.map(cat => `
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
                    </div>
                  </div>
                  ${r.comment?`<div style="font-size:0.68rem;color:var(--text-muted);font-style:italic">"${escHtml(r.comment)}"</div>`:''}
                  <div style="font-size:0.62rem;color:var(--text-muted);margin-top:2px">${formatDate(r.date)}</div>
                </div>`
              }).join('')}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selMonth = parseInt(b.dataset.i); render() }))
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
        onConfirm() {
          const ch = document.querySelector('input[name="csat-ch"]:checked')?.value || 'sms'
          liveRecent.forEach(r => { r.surveyed = true })
          render()
          showToast(`📤 ส่งแบบสำรวจ CSAT ทาง ${ch === 'line' ? 'LINE' : 'SMS'} ให้ลูกค้า ${liveRecent.length} ราย แล้ว`, 'success')
        }
      })
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
