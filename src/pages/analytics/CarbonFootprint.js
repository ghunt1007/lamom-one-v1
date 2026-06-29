/**
 * Carbon Footprint Tracker — ติดตาม CO2 EV vs ICE
 * Route: /analytics/carbon
 */
import { showToast } from '../../core/store.js'
import { openModal } from '../../utils/modal.js'
import { getSalesData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

const DATA = {
  evFleet: [2.1, 2.4, 2.8, 2.3, 3.1, 3.6],     // ton CO2 จากไฟฟ้า (grid emission)
  iceEqv:  [14.2,16.2,18.9,15.5,20.9,24.3],     // ton CO2 ถ้าใช้รถน้ำมันเทียบเท่า
  carsSold:[28,  32,  35,  30,  38,  42],
  kmDriven:[142000,161000,187000,152000,205000,241000],
}

const CERT_OFFSET = [
  { project:'ป่าโกงกางเขาใหญ่', tons:50, cost:25000, cert:'VCS-2025-0812' },
  { project:'Solar Farm สุพรรณบุรี', tons:30, cost:18000, cert:'GS-2025-0341' },
]

export default async function CarbonFootprintPage(container) {
  const myGen = container.__routerGen
  let liveData = { evFleet: [...DATA.evFleet], iceEqv: [...DATA.iceEqv], carsSold: [...DATA.carsSold], kmDriven: [...DATA.kmDriven] }
  let dataSource = 'demo'
  let selMonth = 5

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const now = new Date()
      const byMonth = Array(6).fill(0)
      for (const s of sales) {
        const d = s.bookingDate || s.deliveryDate || ''
        if (!d) continue
        const yr = parseInt(d.slice(0,4)), mo = parseInt(d.slice(5,7))-1
        for (let i = 0; i < 6; i++) {
          const tgt = new Date(now); tgt.setMonth(tgt.getMonth()-(5-i))
          if (yr === tgt.getFullYear() && mo === tgt.getMonth()) { byMonth[i]++; break }
        }
      }
      if (byMonth.some(v => v > 0)) {
        liveData = {
          carsSold: byMonth,
          kmDriven: byMonth.map(n => n * 15000),
          evFleet: byMonth.map(n => parseFloat((n * 0.075).toFixed(1))),
          iceEqv: byMonth.map(n => parseFloat((n * 0.5).toFixed(1))),
        }
        dataSource = 'live'
      }
    }
  } catch {}

  function render() {
    const evTon = liveData.evFleet[selMonth]
    const iceTon = liveData.iceEqv[selMonth]
    const saved = iceTon - evTon
    const pct = Math.round((saved / iceTon) * 100)
    const ytdSaved = liveData.iceEqv.slice(0,selMonth+1).reduce((s,v,i)=>s+(v-liveData.evFleet[i]),0)
    const totalOffset = CERT_OFFSET.reduce((s,c)=>s+c.tons,0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🌿 Carbon Footprint Tracker</div>
            <div class="page-subtitle">เปรียบ CO₂ รถ EV vs ICE · ติดตาม Carbon Credit · รายงาน ESG${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px">
              ${MONTHS.map((m,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${m}</button>`).join('')}
            </div>
            <button class="btn btn-primary" id="esg-btn" style="margin-left:8px">📄 ESG Report</button>
          </div>
        </div>

        <!-- Hero stats -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🌿 CO₂ ลดได้', saved.toFixed(1)+' ton', 'var(--success)')}
          ${sc('⚡ EV emission', evTon.toFixed(1)+' ton', 'var(--primary)')}
          ${sc('🚗 ICE เทียบเท่า', iceTon.toFixed(1)+' ton', 'var(--danger)')}
          ${sc('📉 ลดลง', pct+'%', 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Monthly chart -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 CO₂ รายเดือน (ton)</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${MONTHS.map((m,i) => {
                const ev = liveData.evFleet[i]; const ice = liveData.iceEqv[i]
                const maxVal = Math.max(...liveData.iceEqv)
                return `<div>
                  <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
                    <span style="color:${i===selMonth?'var(--primary)':'var(--text-muted)'};font-weight:${i===selMonth?700:400}">${m}</span>
                    <span style="font-size:0.68rem;color:var(--text-muted)">EV ${ev}t · ICE ${ice}t · <span style="color:var(--success)">-${(ice-ev).toFixed(1)}t</span></span>
                  </div>
                  <div style="position:relative;height:10px;background:var(--danger)22;border-radius:5px;overflow:hidden">
                    <div style="height:100%;width:${Math.round(ice/maxVal*100)}%;background:var(--danger)44;border-radius:5px"></div>
                    <div style="position:absolute;top:0;height:100%;width:${Math.round(ev/maxVal*100)}%;background:${i===selMonth?'var(--primary)':'var(--success)'};border-radius:5px"></div>
                  </div>
                </div>`
              }).join('')}
            </div>
            <div style="display:flex;gap:10px;margin-top:10px;font-size:0.68rem">
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--success);border-radius:2px"></span>EV Emission</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--danger)44;border-radius:2px"></span>ICE Equivalent</span>
            </div>
          </div>

          <!-- Savings detail -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="card" style="padding:14px">
              <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🌳 ผลกระทบสะสม YTD</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                ${[
                  ['CO₂ ลดทั้งปี', ytdSaved.toFixed(1)+' ton', 'var(--success)'],
                  ['🌳 ต้นไม้เทียบเท่า', Math.round(ytdSaved*45)+' ต้น', 'var(--success)'],
                  ['⛽ น้ำมันประหยัด', Math.round(ytdSaved/2.31*1000)+' ลิตร', 'var(--primary)'],
                  ['🚗 รถขายแล้ว', liveData.carsSold.slice(0,selMonth+1).reduce((s,v)=>s+v,0)+' คัน', 'var(--text)'],
                ].map(([k,v,c])=>`
                  <div style="background:var(--surface-2);padding:8px 10px;border-radius:var(--radius-sm)">
                    <div style="font-size:0.62rem;color:var(--text-muted)">${k}</div>
                    <div style="font-size:0.88rem;font-weight:900;color:${c}">${v}</div>
                  </div>`).join('')}
              </div>
            </div>

            <!-- Carbon offset certs -->
            <div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted)">🏅 Carbon Credit</div>
                <button class="btn btn-xs btn-primary" id="buy-btn">+ ซื้อ Credit</button>
              </div>
              ${CERT_OFFSET.map(c=>`
                <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                  <div style="font-weight:600">${c.project}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${c.tons} ton · ฿${c.cost.toLocaleString()} · ${c.cert}</div>
                </div>`).join('')}
              <div style="font-size:0.76rem;margin-top:8px;font-weight:700;color:var(--success)">รวม Offset: ${totalOffset} ton CO₂</div>
            </div>

            <!-- Net position -->
            <div class="card" style="padding:14px;background:${ytdSaved+totalOffset>0?'var(--success)':'var(--danger)'}11;border:2px solid ${ytdSaved+totalOffset>0?'var(--success)':'var(--danger)'}">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">🌍 Net Carbon Position YTD</div>
              <div style="font-size:1.6rem;font-weight:900;color:${ytdSaved+totalOffset>0?'var(--success)':'var(--danger)'}">${(ytdSaved+totalOffset).toFixed(1)} ton saved</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">ลดได้จากรถ EV ${ytdSaved.toFixed(1)}t + Offset ${totalOffset}t</div>
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selMonth = parseInt(b.dataset.i); render() }))
    document.getElementById('esg-btn')?.addEventListener('click', () => {
      const rows = MONTHS.map((m, i) => ({
        'เดือน': m,
        'รถขาย (คัน)': liveData.carsSold[i] || 0,
        'ระยะทาง (km)': liveData.kmDriven[i] || 0,
        'CO₂ EV (ton)': liveData.evFleet[i] || 0,
        'CO₂ เทียบ ICE (ton)': liveData.iceEqv[i] || 0,
        'CO₂ ประหยัดได้ (ton)': parseFloat(((liveData.iceEqv[i] || 0) - (liveData.evFleet[i] || 0)).toFixed(1)),
      }))
      const offsetRows = CERT_OFFSET.map(c => ({
        'เดือน': 'Carbon Offset',
        'รถขาย (คัน)': 0,
        'ระยะทาง (km)': 0,
        'CO₂ EV (ton)': 0,
        'CO₂ เทียบ ICE (ton)': 0,
        'CO₂ ประหยัดได้ (ton)': c.tons,
        'โครงการ / Cert': `${c.project} · ${c.cert} · ฿${c.cost.toLocaleString()}`,
      }))
      exportToExcel([...rows, ...offsetRows], 'ESG_Carbon_Report.xlsx', 'ESG')
      showToast('📄 Export ESG Report แล้ว', 'success')
    })
    document.getElementById('buy-btn')?.addEventListener('click', () => {
      const PROGRAMS = [
        { id:'gs',  name:'Gold Standard (GS)',  price: 850, cert: 'GS-2026' },
        { id:'vcs', name:'VCS Verra',            price: 500, cert: 'VCS-2026' },
        { id:'tgo', name:'Thailand Carbon (TGO)',price: 350, cert: 'TGO-2026' },
      ]
      openModal({
        title: '🏅 ซื้อ Carbon Credit',
        size: 'sm',
        body: `
          <div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
            <div><label style="font-size:0.72rem;color:var(--text-muted)">โปรแกรม Carbon Credit</label>
              <select class="input" id="cc-prog" style="width:100%;margin-top:4px">
                ${PROGRAMS.map(p => `<option value="${p.id}" data-price="${p.price}" data-cert="${p.cert}">${p.name} — ฿${p.price}/ton</option>`).join('')}
              </select></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">จำนวน (ton CO₂)</label>
              <input class="input" id="cc-tons" type="number" min="1" value="10" style="width:100%;margin-top:4px"></div>
            <div style="background:var(--surface-2);border-radius:6px;padding:8px 10px;font-size:0.76rem">
              ต้นทุนประมาณ: <strong id="cc-cost-preview" style="color:var(--success)">฿8,500</strong>
            </div>
            <div style="font-size:0.68rem;color:var(--text-muted)">* ใช้ราคาอ้างอิง ณ มิ.ย. 2026 ต้องชำระผ่านองค์กรที่รับรอง</div>
          </div>
        `,
        confirmText: '💳 ยืนยันซื้อ Credit',
        onConfirm() {
          const sel = document.getElementById('cc-prog')
          const prog = PROGRAMS.find(p => p.id === sel?.value) || PROGRAMS[0]
          const tons = parseInt(document.getElementById('cc-tons')?.value) || 0
          if (tons < 1) { showToast('ระบุจำนวน ton', 'warning'); return false }
          const cost = tons * prog.price
          const certId = `${prog.cert}-${String(CERT_OFFSET.length + 1).padStart(3,'0')}`
          CERT_OFFSET.push({ project: prog.name, tons, cost, cert: certId })
          render()
          showToast(`✅ ซื้อ Carbon Credit ${tons} ton (${prog.name}) ฿${cost.toLocaleString()} แล้ว`, 'success')
        }
      })
      setTimeout(() => {
        const prog = document.getElementById('cc-prog')
        const tons = document.getElementById('cc-tons')
        const preview = document.getElementById('cc-cost-preview')
        function updatePreview() {
          const p = PROGRAMS.find(x => x.id === prog?.value) || PROGRAMS[0]
          const t = parseInt(tons?.value) || 0
          if (preview) preview.textContent = `฿${(t * p.price).toLocaleString()}`
        }
        prog?.addEventListener('change', updatePreview)
        tons?.addEventListener('input', updatePreview)
      }, 50)
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.3rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
