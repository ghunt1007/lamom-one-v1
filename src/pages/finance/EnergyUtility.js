/**
 * Energy & Utility Tracking — ติดตามค่าไฟ ค่าน้ำ ค่าอินเทอร์เน็ตรายเดือน
 * Route: /finance/energy
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

const READINGS = [
  { month:'ม.ค.', elec:42800, water:3200, net:2900, zone:{showroom:18000,service:14000,office:7200,parking:3600} },
  { month:'ก.พ.', elec:39600, water:2900, net:2900, zone:{showroom:16500,service:13200,office:6800,parking:3100} },
  { month:'มี.ค.', elec:44200, water:3400, net:2900, zone:{showroom:18800,service:14500,office:7100,parking:3800} },
  { month:'เม.ย.', elec:51000, water:3800, net:2900, zone:{showroom:21200,service:16800,office:8200,parking:4800} },
  { month:'พ.ค.', elec:53400, water:3900, net:3200, zone:{showroom:22100,service:17600,office:8700,parking:5000} },
  { month:'มิ.ย.', elec:49800, water:3600, net:3200, zone:{showroom:20500,service:16200,office:8100,parking:5000} },
]

const ZONES = ['showroom','service','office','parking']
const ZONE_LABELS = { showroom:'โชว์รูม', service:'ศูนย์บริการ', office:'สำนักงาน', parking:'ลานจอด' }
const ZONE_ICONS  = { showroom:'🚗', service:'🔧', office:'🏢', parking:'🅿️' }

export default async function EnergyUtilityPage(container) {
  let selMonth = 'มิ.ย.'

  function barW(val, max) { return Math.round(val/max*100) }

  function monthBar(m) {
    const maxElec = Math.max(...READINGS.map(r=>r.elec))
    const pct = barW(m.elec, maxElec)
    const isSelected = m.month === selMonth
    const bg = isSelected ? 'var(--primary)' : 'var(--surface-2)'
    const textCol = isSelected ? 'var(--primary)' : 'var(--text-muted)'
    return '<div class="month-bar-item" data-month="' + m.month + '" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:6px 4px;border-radius:6px;background:' + (isSelected?'var(--surface-2)':'transparent') + '">' +
      '<div style="font-size:0.64rem;color:' + textCol + ';font-weight:' + (isSelected?'700':'400') + '">' + m.month + '</div>' +
      '<div style="width:28px;height:60px;background:var(--surface-2);border-radius:4px;display:flex;align-items:flex-end;overflow:hidden">' +
        '<div style="width:100%;height:' + pct + '%;background:' + bg + ';border-radius:4px;transition:height .3s"></div>' +
      '</div>' +
      '<div style="font-size:0.58rem;color:' + textCol + '">' + (m.elec/1000).toFixed(0) + 'k</div>' +
    '</div>'
  }

  function zoneBar(zone, val, total) {
    const pct = Math.round(val/total*100)
    return '<div style="margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">' +
        '<span>' + ZONE_ICONS[zone] + ' ' + ZONE_LABELS[zone] + '</span>' +
        '<span style="color:var(--text-muted)">฿' + val.toLocaleString() + ' (' + pct + '%)</span>' +
      '</div>' +
      '<div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:var(--primary);border-radius:4px;transition:width .4s"></div>' +
      '</div>' +
    '</div>'
  }

  function render() {
    const cur = READINGS.find(r=>r.month===selMonth) || READINGS[READINGS.length-1]
    const prev = READINGS[READINGS.indexOf(cur)-1]
    const totalUtil = cur.elec + cur.water + cur.net
    const elecChg = prev ? Math.round((cur.elec-prev.elec)/prev.elec*100) : 0
    const elecChgColor = elecChg > 0 ? 'var(--danger)' : 'var(--success)'
    const elecChgStr = (elecChg>0?'+':'')+elecChg+'%'

    const monthBars = READINGS.map(m=>monthBar(m)).join('')
    const zoneBars = ZONES.map(z=>zoneBar(z, cur.zone[z], cur.elec)).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ Energy & Utility</div>
            <div class="page-subtitle">ค่าไฟ น้ำ เน็ต · เดือน ${selMonth}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-reading-btn">+ บันทึกมิเตอร์</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('⚡ ค่าไฟ', '฿'+cur.elec.toLocaleString(), 'var(--warning)')}
          ${sc('💧 ค่าน้ำ', '฿'+cur.water.toLocaleString(), 'var(--primary)')}
          ${sc('📡 ค่าเน็ต', '฿'+cur.net.toLocaleString(), 'var(--success)')}
          ${sc('💰 รวมทั้งหมด', '฿'+totalUtil.toLocaleString(), 'var(--text)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">📊 ค่าไฟรายเดือน (6 เดือน)
              <span style="font-size:0.68rem;font-weight:400;color:${elecChgColor};margin-left:6px">${elecChgStr} vs เดือนก่อน</span>
            </div>
            <div style="display:flex;justify-content:space-around;align-items:flex-end;height:100px;padding-bottom:4px">
              ${monthBars}
            </div>
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:12px">🏢 แบ่งตามโซน (ค่าไฟ)</div>
            ${zoneBars}
          </div>
        </div>

        <div class="card" style="margin-top:12px;padding:16px">
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:10px">📋 ข้อมูลรายเดือนทั้งหมด</div>
          <table style="width:100%;font-size:0.76rem;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">เดือน</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-weight:600">⚡ ไฟฟ้า</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-weight:600">💧 น้ำ</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-weight:600">📡 เน็ต</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-weight:600">รวม</th>
              </tr>
            </thead>
            <tbody>
              ${READINGS.map(r=>'<tr style="border-bottom:1px solid var(--border-subtle);' + (r.month===selMonth?'background:var(--surface-2)':'') + '">' +
                '<td style="padding:6px 8px;font-weight:' + (r.month===selMonth?'700':'400') + '">' + r.month + '</td>' +
                '<td style="padding:6px 8px;text-align:right">฿' + r.elec.toLocaleString() + '</td>' +
                '<td style="padding:6px 8px;text-align:right">฿' + r.water.toLocaleString() + '</td>' +
                '<td style="padding:6px 8px;text-align:right">฿' + r.net.toLocaleString() + '</td>' +
                '<td style="padding:6px 8px;text-align:right;font-weight:700">฿' + (r.elec+r.water+r.net).toLocaleString() + '</td>' +
              '</tr>').join('')}
            </tbody>
          </table>
        </div>
      </div>`

    container.querySelectorAll('.month-bar-item').forEach(b=>b.addEventListener('click',()=>{selMonth=b.dataset.month;render()}))
    document.getElementById('add-reading-btn')?.addEventListener('click',()=>openAddModal())
  }

  function openAddModal() {
    openModal({
      title:'⚡ บันทึกมิเตอร์', size:'sm',
      body:`<div style="font-size:0.8rem;display:flex;flex-direction:column;gap:8px">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">เดือน</label>
          <select class="input" id="em-month" style="width:100%;margin-top:3px">
            ${MONTHS.map(m=>'<option>'+m+'</option>').join('')}
          </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div><label style="font-size:0.72rem;color:var(--text-muted)">⚡ ค่าไฟ (บ.)</label><input class="input" id="em-elec" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">💧 ค่าน้ำ (บ.)</label><input class="input" id="em-water" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
          <div><label style="font-size:0.72rem;color:var(--text-muted)">📡 ค่าเน็ต (บ.)</label><input class="input" id="em-net" type="number" style="width:100%;margin-top:3px" placeholder="0"></div>
        </div>
      </div>`,
      confirmText:'💾 บันทึก',
      onConfirm() {
        const month = document.getElementById('em-month')?.value
        const elec  = parseInt(document.getElementById('em-elec')?.value)||0
        const water = parseInt(document.getElementById('em-water')?.value)||0
        const net   = parseInt(document.getElementById('em-net')?.value)||0
        if(!elec){showToast('กรอกค่าไฟด้วย','warning');return false}
        const exist = READINGS.find(r=>r.month===month)
        if(exist){ exist.elec=elec;exist.water=water;exist.net=net }
        else { READINGS.push({month,elec,water,net,zone:{showroom:0,service:0,office:0,parking:0}}) }
        selMonth=month; render(); showToast('⚡ บันทึกมิเตอร์เดือน '+month+' แล้ว','success')
      }
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  render()
}
