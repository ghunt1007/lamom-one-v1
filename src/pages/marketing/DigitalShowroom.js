/**
 * Digital Showroom 360° — โชว์รถออนไลน์ด้วย 360° / Video / Color Picker
 * Route: /marketing/digital-showroom
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

let SHOWROOM_CARS = [
  { id:'DS001', model:'BYD Atto 3', badge:'EV', colors:['#1565c0','#212121','#f5f5f5','#c62828'], views360:true, video:true,  views:4820, leads:142, conv:2.9, featured:true  },
  { id:'DS002', model:'BYD Seal AWD', badge:'EV', colors:['#212121','#b0bec5','#1b5e20'],       views360:true, video:true,  views:3210, leads:98,  conv:3.1, featured:true  },
  { id:'DS003', model:'BYD Dolphin', badge:'EV', colors:['#f5f5f5','#1565c0','#e91e63'],        views360:true, video:false, views:2880, leads:76,  conv:2.6, featured:false },
  { id:'DS004', model:'BYD Han', badge:'EV', colors:['#212121','#1b5e20'],                      views360:false,video:true,  views:1640, leads:44,  conv:2.7, featured:false },
  { id:'DS005', model:'MG ZS EV', badge:'EV', colors:['#f5f5f5','#c62828','#9e9e9e'],           views360:true, video:true,  views:2100, leads:58,  conv:2.8, featured:false },
  { id:'DS006', model:'BYD Atto 3 Pro', badge:'NEW', colors:['#1565c0','#212121','#ffd600'],    views360:true, video:false, views:980,  leads:31,  conv:3.2, featured:true  },
]

export default async function DigitalShowroomPage(container) {
  let filterBadge = 'all'

  function colorDots(colors) {
    return colors.map(c => {
      const border = c === '#f5f5f5' ? 'border:1.5px solid var(--border)' : 'border:1.5px solid transparent'
      return '<div style="width:14px;height:14px;border-radius:50%;background:' + c + ';' + border + ';display:inline-block;margin-right:3px"></div>'
    }).join('')
  }

  function carCard(car) {
    const v360  = car.views360 ? '<span style="font-size:0.62rem;background:#1976d2;color:#fff;padding:1px 7px;border-radius:8px">360°</span>' : ''
    const vVid  = car.video    ? '<span style="font-size:0.62rem;background:#e53935;color:#fff;padding:1px 7px;border-radius:8px">VIDEO</span>' : ''
    const featR = car.featured ? '<div style="position:absolute;top:8px;right:8px;font-size:0.62rem;background:var(--warning);color:#000;padding:1px 8px;border-radius:8px;font-weight:700">⭐ Featured</div>' : ''
    const badge = '<span style="font-size:0.62rem;background:var(--success);color:#fff;padding:1px 7px;border-radius:8px">' + car.badge + '</span>'
    const dots  = colorDots(car.colors)
    return '<div class="card" style="padding:14px;position:relative">' +
      featR +
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<div style="font-size:2rem;flex-shrink:0">🚗</div>' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">' +
            '<span style="font-weight:700;font-size:0.9rem">' + car.model + '</span>' +
            badge + v360 + vVid +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:4px;margin-bottom:8px">' + dots + '</div>' +
          '<div style="display:flex;gap:14px;font-size:0.74rem">' +
            '<span>👁 ' + car.views.toLocaleString() + ' views</span>' +
            '<span>🎯 ' + car.leads + ' leads</span>' +
            '<span style="color:var(--success);font-weight:700">🔄 ' + car.conv + '%</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">' +
          '<button class="btn btn-xs btn-primary view-btn" data-id="' + car.id + '" style="font-size:0.68rem">👁 Preview</button>' +
          '<button class="btn btn-xs btn-secondary feat-btn" data-id="' + car.id + '" style="font-size:0.68rem">' + (car.featured ? '⭐ Unfeature' : '⭐ Feature') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  }

  function render() {
    let rows = filterBadge === 'all' ? SHOWROOM_CARS : SHOWROOM_CARS.filter(c=>c.badge===filterBadge)

    const totViews  = SHOWROOM_CARS.reduce((s,c)=>s+c.views,0)
    const totLeads  = SHOWROOM_CARS.reduce((s,c)=>s+c.leads,0)
    const feat      = SHOWROOM_CARS.filter(c=>c.featured).length
    const avgConv   = (totLeads/totViews*100).toFixed(1)

    const badges = ['all','EV','NEW']
    const filterBtns = badges.map(b=>{
      const lbl = b==='all'?'ทั้งหมด':b
      return '<button class="btn btn-xs ' + (filterBadge===b?'btn-primary':'btn-secondary') + ' badge-btn" data-b="' + b + '">' + lbl + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🌐 Digital Showroom 360°</div>
            <div class="page-subtitle">โชว์รถออนไลน์ · ${SHOWROOM_CARS.length} รุ่น</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-car-btn">+ เพิ่มรุ่น</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('👁 รวม Views', totViews.toLocaleString(), 'var(--primary)')}
          ${sc('🎯 รวม Leads', totLeads+' ราย', 'var(--success)')}
          ${sc('⭐ Featured', feat+' รุ่น', 'var(--warning)')}
          ${sc('🔄 Avg Conv.', avgConv+'%', 'var(--success)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px">
          ${rows.map(c=>carCard(c)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted);grid-column:1/-1">ไม่พบรายการ</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.badge-btn').forEach(b=>b.addEventListener('click',()=>{filterBadge=b.dataset.b;render()}))
    container.querySelectorAll('.view-btn').forEach(b=>b.addEventListener('click',()=>{
      const car=SHOWROOM_CARS.find(c=>c.id===b.dataset.id)
      if(car) openDetailModal(car)
    }))
    container.querySelectorAll('.feat-btn').forEach(b=>b.addEventListener('click',()=>{
      const car=SHOWROOM_CARS.find(c=>c.id===b.dataset.id)
      if(car){car.featured=!car.featured;render();showToast((car.featured?'⭐ Featured: ':'⭐ Unfeatured: ')+car.model,'success')}
    }))
    document.getElementById('add-car-btn')?.addEventListener('click', openAddCarModal)
  }

  function openAddCarModal() {
    openModal({
      title: '📝 เพิ่มรุ่นใหม่ใน Digital Showroom',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อรุ่น *</label>
              <input id="ds-model" class="input" placeholder="BYD Atto 3 Pro..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Badge</label>
              <select id="ds-badge" class="input"><option value="EV">EV</option><option value="NEW">NEW</option><option value="PHEV">PHEV</option></select></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">มี 360° View</label>
              <select id="ds-360" class="input"><option value="true">ใช่</option><option value="false">ไม่มี</option></select></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">มี Video</label>
              <select id="ds-vid" class="input"><option value="true">ใช่</option><option value="false">ไม่มี</option></select></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">สีที่มีจำหน่าย (HEX คั่นจุลภาค)</label>
            <input id="ds-colors" class="input" placeholder="#1565c0, #212121, #f5f5f5..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Featured</label>
              <select id="ds-feat" class="input"><option value="false">ปกติ</option><option value="true">⭐ Featured</option></select></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Conversion % เริ่มต้น</label>
              <input id="ds-conv" type="number" step="0.1" class="input" value="2.5"></div>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="ds-save">💾 เพิ่มรุ่น</button>
        </div>
      `
    })
    document.getElementById('ds-save')?.addEventListener('click', () => {
      const model = document.getElementById('ds-model')?.value.trim()
      if (!model) { showToast('⚠️ กรุณากรอกชื่อรุ่น', 'warning'); return }
      const colorsRaw = document.getElementById('ds-colors')?.value.trim()
      SHOWROOM_CARS.push({
        id: 'DS' + String(SHOWROOM_CARS.length + 1).padStart(3,'0'),
        model,
        badge:    document.getElementById('ds-badge')?.value || 'EV',
        colors:   colorsRaw ? colorsRaw.split(',').map(s=>s.trim()).filter(Boolean) : ['#212121'],
        views360: document.getElementById('ds-360')?.value === 'true',
        video:    document.getElementById('ds-vid')?.value === 'true',
        views: 0, leads: 0,
        conv:     parseFloat(document.getElementById('ds-conv')?.value) || 2.5,
        featured: document.getElementById('ds-feat')?.value === 'true',
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ เพิ่ม ' + model + ' ใน Showroom แล้ว', 'success')
      render()
    })
  }

  function openDetailModal(car) {
    const dots = car.colors.map(c=>{
      const border = c==='#f5f5f5'?'border:2px solid var(--border)':'border:2px solid transparent'
      return '<div style="width:32px;height:32px;border-radius:50%;background:' + c + ';' + border + ';cursor:pointer;transition:transform .15s" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'scale(1)\'"></div>'
    }).join('')
    openModal({
      title: '🌐 ' + car.model + ' — Digital Showroom', size:'sm',
      body: `<div style="font-size:0.8rem">
        <div style="text-align:center;font-size:3rem;margin-bottom:12px">🚗</div>
        <div style="display:flex;justify-content:center;gap:10px;margin-bottom:14px">${dots}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div style="text-align:center;background:var(--surface-2);border-radius:8px;padding:10px">
            <div style="font-size:1.2rem;font-weight:900;color:var(--primary)">${car.views.toLocaleString()}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">Total Views</div>
          </div>
          <div style="text-align:center;background:var(--surface-2);border-radius:8px;padding:10px">
            <div style="font-size:1.2rem;font-weight:900;color:var(--success)">${car.leads}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">Total Leads</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:center">
          ${car.views360?'<span style="background:#1976d2;color:#fff;padding:4px 12px;border-radius:8px;font-size:0.74rem">✅ 360° View</span>':'<span style="background:var(--surface-2);padding:4px 12px;border-radius:8px;font-size:0.74rem;color:var(--text-muted)">❌ ไม่มี 360°</span>'}
          ${car.video?'<span style="background:#e53935;color:#fff;padding:4px 12px;border-radius:8px;font-size:0.74rem">✅ Video</span>':'<span style="background:var(--surface-2);padding:4px 12px;border-radius:8px;font-size:0.74rem;color:var(--text-muted)">❌ ไม่มี Video</span>'}
        </div>
      </div>`,
      confirmText: '🔗 Copy Showroom Link',
      onConfirm() {
        const url = 'https://lamom.app/showroom/' + car.id
        navigator.clipboard?.writeText(url)
          .then(() => showToast('🔗 Copy Link แล้ว · ' + url, 'success'))
          .catch(() => showToast('🔗 Link: ' + url, 'success'))
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
