/**
 * Competitor Intelligence — วิเคราะห์คู่แข่ง เปรียบเทียบอัตโนมัติ
 * Route: /training/competitor
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

const BRANDS = ['BYD','MG','GWM (ORA/HAVAL)','Neta','AION','CHERY','Tesla']

const MODELS_DATA = [
  // ---- BYD (ของเรา) ----
  { brand: 'BYD', model: 'Dolphin', segment: 'B-Segment EV', price: 899000, range: 410, power: 70,  accel: 12.3, battery: 44.9, warranty: '8ปี/160k', charge: 'CCS2+AC', strengths: ['ราคาดี','แบตฯ Blade','ประหยัดสุด'],      weaknesses: ['เร็วน้อยสุด','ช่วงล่างเบา'],    ours: true },
  { brand: 'BYD', model: 'Atto 3',  segment: 'C-SUV EV',     price: 1099000,range: 480, power: 150, accel: 7.3,  battery: 60.5, warranty: '8ปี/160k', charge: 'CCS2+AC', strengths: ['Interior ดี','360 Camera','แบตฯ Blade'], weaknesses: ['ราคาสูงกว่า MG ZS'],            ours: true },
  { brand: 'BYD', model: 'Seal',    segment: 'D-Sedan EV',    price: 1550000,range: 520, power: 390, accel: 3.8,  battery: 82.6, warranty: '8ปี/160k', charge: 'CCS2+AC', strengths: ['สมรรถนะสูง','ดีไซน์','AWD'],           weaknesses: ['ราคาสูง'],                       ours: true },
  { brand: 'BYD', model: 'Han',     segment: 'E-Sedan EV',    price: 2099000,range: 521, power: 380, accel: 3.9,  battery: 85.4, warranty: '8ปี/160k', charge: 'CCS2+AC', strengths: ['Luxury','ระยะวิ่งสูง','V2L'],           weaknesses: ['ราคาสูงมาก'],                    ours: true },
  // ---- คู่แข่ง ----
  { brand: 'MG',  model: 'ZS EV',   segment: 'C-SUV EV',     price: 799000, range: 440, power: 130, accel: 8.5,  battery: 51,   warranty: '5ปี/150k', charge: 'CCS2+AC', strengths: ['ราคาถูกสุด C-SUV','ศูนย์มาก'],       weaknesses: ['แบตฯ NMC','Warranty น้อยกว่า'], ours: false },
  { brand: 'MG',  model: 'MG4',     segment: 'C-Hatch EV',   price: 949000, range: 425, power: 125, accel: 7.7,  battery: 51,   warranty: '5ปี/150k', charge: 'CCS2+AC', strengths: ['ดีไซน์สปอร์ต','ราคาดี'],             weaknesses: ['Warranty สั้นกว่า BYD'],         ours: false },
  { brand: 'Neta',model: 'V-II',    segment: 'B-Segment EV', price: 599000, range: 380, power: 70,  accel: 11.9, battery: 38.5, warranty: '5ปี/100k', charge: 'AC Only', strengths: ['ราคาต่ำสุดตลาด'],                   weaknesses: ['ชาร์จช้า','ระยะน้อยกว่า'],       ours: false },
  { brand: 'Tesla',model: 'Model 3', segment: 'D-Sedan EV',   price: 1849000,range: 576, power: 283, accel: 6.1,  battery: 60,   warranty: '4ปี/80k',  charge: 'Tesla+CCS', strengths: ['Autopilot','Supercharger','Brand'],  weaknesses: ['Warranty น้อยกว่า','ศูนย์น้อย'], ours: false },
]

export default async function CompetitorIntelPage(container) {
  let filterSeg = 'all'
  let compareA = 'BYD Atto 3'
  let compareB = 'MG ZS EV'

  function render() {
    const segs = [...new Set(MODELS_DATA.map(m => m.segment))].sort()
    const filtered = filterSeg === 'all' ? MODELS_DATA : MODELS_DATA.filter(m => m.segment === filterSeg)
    const mA = MODELS_DATA.find(m => m.model === compareA)
    const mB = MODELS_DATA.find(m => m.model === compareB)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🕵️ Competitor Intelligence</div>
            <div class="page-subtitle">วิเคราะห์คู่แข่ง ${MODELS_DATA.filter(m=>!m.ours).length} รุ่น · เปรียบเทียบ Spec + จุดขาย</div>
          </div>
          <div class="page-actions"><button class="btn btn-primary" id="dl-btn">📥 ส่งให้ทีมขาย</button></div>
        </div>

        <!-- Quick Compare -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">⚖️ Quick Compare</div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <select class="input" id="cmpA" style="flex:1;min-width:140px">${MODELS_DATA.map(m=>`<option ${m.model===compareA?'selected':''}>${m.model}</option>`).join('')}</select>
            <span style="color:var(--text-muted);font-weight:700">VS</span>
            <select class="input" id="cmpB" style="flex:1;min-width:140px">${MODELS_DATA.map(m=>`<option ${m.model===compareB?'selected':''}>${m.model}</option>`).join('')}</select>
          </div>
          ${mA && mB ? `
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;margin-top:12px;font-size:0.78rem">
              ${cmpRow('ราคา', formatCurrency(mA.price), formatCurrency(mB.price), mA.price < mB.price)}
              ${cmpRow('ระยะวิ่ง', mA.range+'km', mB.range+'km', mA.range > mB.range)}
              ${cmpRow('กำลัง', mA.power+'kW', mB.power+'kW', mA.power > mB.power)}
              ${cmpRow('0-100', mA.accel+'วิ', mB.accel+'วิ', mA.accel < mB.accel)}
              ${cmpRow('แบตเตอรี่', mA.battery+'kWh', mB.battery+'kWh', mA.battery > mB.battery)}
              ${cmpRow('Warranty', mA.warranty, mB.warranty, false)}
            </div>` : ''}
        </div>

        <!-- Filter -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn btn-xs ${filterSeg==='all'?'btn-primary':'btn-secondary'} seg-btn" data-s="all">ทุก Segment</button>
          ${segs.map(s=>`<button class="btn btn-xs ${filterSeg===s?'btn-primary':'btn-secondary'} seg-btn" data-s="${s}">${s}</button>`).join('')}
        </div>

        <!-- Table -->
        <div class="card" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:920px">
            <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
              <th style="padding:10px 12px">แบรนด์ / รุ่น</th><th>Segment</th>
              <th style="text-align:right">ราคา</th><th style="text-align:center">ระยะ</th>
              <th style="text-align:center">กำลัง</th><th style="text-align:center">0-100</th>
              <th>Warranty</th><th>จุดเด่น</th>
            </tr></thead>
            <tbody>
              ${filtered.map(m => `
                <tr style="border-bottom:1px solid var(--border);font-size:0.78rem;${m.ours?'background:var(--primary)10':''}">
                  <td style="padding:9px 12px;font-weight:700">${m.ours?'⭐ ':''}${m.brand} ${m.model}${m.ours?'<span style="font-size:0.62rem;background:var(--primary);color:#fff;padding:1px 6px;border-radius:8px;margin-left:5px">ของเรา</span>':''}</td>
                  <td style="font-size:0.72rem;color:var(--text-muted)">${m.segment}</td>
                  <td style="text-align:right;font-weight:700">${formatCurrency(m.price)}</td>
                  <td style="text-align:center">${m.range} km</td>
                  <td style="text-align:center">${m.power} kW</td>
                  <td style="text-align:center">${m.accel} วิ</td>
                  <td style="font-size:0.72rem">${m.warranty}</td>
                  <td style="font-size:0.7rem">${m.strengths.map(s=>`<span style="background:var(--success)22;color:var(--success);padding:1px 5px;border-radius:6px;margin:1px;display:inline-block">${s}</span>`).join('')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('cmpA')?.addEventListener('change', e => { compareA = e.target.value; render() })
    document.getElementById('cmpB')?.addEventListener('change', e => { compareB = e.target.value; render() })
    container.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => { filterSeg = b.dataset.s; render() }))
    document.getElementById('dl-btn')?.addEventListener('click', () => {
      exportToExcel(
        MODELS_DATA.map(m => ({
          'แบรนด์': m.brand,
          'รุ่น': m.model,
          'กลุ่ม': m.segment,
          'ราคา (บาท)': m.price,
          'ระยะวิ่ง (km)': m.range,
          'กำลัง (kW)': m.power,
          '0-100 (วิ)': m.accel,
          'แบตฯ (kWh)': m.battery,
          'ประกัน': m.warranty,
          'ชาร์จ': m.charge,
          'จุดแข็ง': m.strengths.join(' · '),
          'จุดอ่อน': m.weaknesses.join(' · '),
          'รถเรา': m.ours ? 'ใช่' : 'ไม่',
        })),
        'Competitor_Intel.xlsx',
        'Competitor'
      )
      showToast('📥 Export ข้อมูลคู่แข่งแล้ว', 'success')
    })
  }

  function cmpRow(label, a, b, aWins) {
    return `
      <div style="text-align:right;padding:4px 6px;background:${aWins?'var(--success)22':'var(--surface-2)'};border-radius:var(--radius-sm);font-weight:${aWins?'700':'400'}">${a}</div>
      <div style="text-align:center;color:var(--text-muted);padding:4px 0;font-size:0.7rem">${label}</div>
      <div style="text-align:left;padding:4px 6px;background:${!aWins?'var(--success)22':'var(--surface-2)'};border-radius:var(--radius-sm);font-weight:${!aWins?'700':'400'}">${b}</div>`
  }

  render()
}
