/**
 * Model Configuration — ตัวเลือก Spec / Option ของแต่ละรุ่น
 * Route: /dms/model-config
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DEMO_MODELS_CFG = [
  {
    id:'MC001', brand:'BYD', model:'Atto 3', variants:[
      { name:'Standard Range', battery:'49.92 kWh', range:'345 km', price:1099900, active:false },
      { name:'Extended Range', battery:'60.48 kWh', range:'420 km', price:1199900, active:true  },
    ],
    options:['NFC Key Card','Solar Roof','Premium Sound System (Dynaudio)','Wireless Charger'],
    colors:['Arctic Blue','Cosmos Black','Ski White','Flame Red'],
  },
  {
    id:'MC002', brand:'BYD', model:'Seal AWD', variants:[
      { name:'Dynamic AWD',   battery:'82.56 kWh', range:'520 km', price:1799900, active:false },
      { name:'Performance',   battery:'82.56 kWh', range:'510 km', price:1999900, active:true  },
    ],
    options:['Carbon Fiber Trim','ADAS Pro Pack','Head-Up Display','Air Suspension'],
    colors:['Cosmos Black','Aurora Silver','Jade Green'],
  },
  {
    id:'MC003', brand:'BYD', model:'Dolphin', variants:[
      { name:'Standard',  battery:'44.9 kWh', range:'340 km', price:699900,  active:false },
      { name:'Boost',     battery:'44.9 kWh', range:'340 km', price:799900,  active:true  },
    ],
    options:['Apple CarPlay','Android Auto','Dash Cam','EV Charger Cable Type 2'],
    colors:['Pearl White','Ocean Blue','Sakura Pink'],
  },
  {
    id:'MC004', brand:'MG', model:'ZS EV', variants:[
      { name:'Luxury',       battery:'50.3 kWh', range:'357 km', price:899900,  active:false },
      { name:'Luxury Plus',  battery:'50.3 kWh', range:'357 km', price:999900,  active:true  },
    ],
    options:['MG iSmart App','360 Camera','Panoramic Sunroof','Premium Leather'],
    colors:['Pearl White','Passion Red','Sterling Grey'],
  },
]

export default async function ModelConfigPage(container) {
  const myGen = container.__routerGen
  let modelsCfg = DEMO_MODELS_CFG.map(m => ({ ...m, variants: m.variants.map(v => ({ ...v })), options: [...m.options], colors: [...m.colors] }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('model_configs', [], 'model', 'asc', 50).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `MC${String(i+1).padStart(3,'0')}`,
        brand: d.brand || '',
        model: d.model || '',
        variants: Array.isArray(d.variants) && d.variants.length ? d.variants.map(v => ({ ...v })) : [{
          name: d.variant || 'Standard', battery: d.batteryWarranty || '-', range: d.range ? d.range + ' km' : '-', price: d.basePrice || 0, active: true,
        }],
        options: Array.isArray(d.options) ? [...d.options] : (Array.isArray(d.accessories) ? [...d.accessories] : []),
        colors: Array.isArray(d.colors) ? [...d.colors] : [],
      }))
      modelsCfg = [...mapped, ...DEMO_MODELS_CFG]
      dataSource = 'live'
    }
  } catch {}

  let selModelId = null

  function modelCard(m) {
    const isSelected = m.id===selModelId
    const activeVariant = m.variants.find(v=>v.active)||m.variants[0]||{ price: 0 }
    const colorDots = m.colors.map(c=>'<span style="font-size:0.68rem;background:var(--surface-2);padding:2px 6px;border-radius:6px">'+escHtml(c)+'</span>').join('')
    return '<div class="card model-cfg-card" data-id="'+m.id+'" style="padding:14px;cursor:pointer;border:2px solid '+(isSelected?'var(--primary)':'transparent')+'">' +
      '<div style="display:flex;align-items:flex-start;gap:10px">' +
        '<div style="font-size:1.6rem">🚗</div>' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:0.88rem;margin-bottom:3px">' + escHtml(m.brand) + ' ' + escHtml(m.model) + '</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">' + m.variants.length + ' variant · ' + m.options.length + ' options · ' + m.colors.length + ' สี</div>' +
          '<div style="font-size:0.72rem;color:var(--success);font-weight:700;margin-bottom:6px">ราคาเริ่ม ฿' + activeVariant.price.toLocaleString() + '</div>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap">' + colorDots + '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  }

  function renderDetail(m) {
    const variantsHtml = m.variants.map(v=>{
      const tag = v.active ? '<span style="font-size:0.62rem;background:var(--success);color:#fff;padding:1px 7px;border-radius:8px">มีจำหน่าย</span>' : '<span style="font-size:0.62rem;background:var(--surface-2);padding:1px 7px;border-radius:8px;color:var(--text-muted)">หยุดจำหน่าย</span>'
      return '<div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-weight:700;font-size:0.8rem">' + escHtml(v.name) + '</span>' + tag +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:0.72rem">' +
          '<div><div style="color:var(--text-muted);font-size:0.64rem">แบตเตอรี่</div><div style="font-weight:600">' + escHtml(v.battery) + '</div></div>' +
          '<div><div style="color:var(--text-muted);font-size:0.64rem">พิสัย</div><div style="font-weight:600">' + escHtml(v.range) + '</div></div>' +
          '<div><div style="color:var(--text-muted);font-size:0.64rem">ราคา</div><div style="font-weight:600;color:var(--success)">฿' + v.price.toLocaleString() + '</div></div>' +
        '</div>' +
      '</div>'
    }).join('')

    const optsHtml = m.options.map(o=>'<div style="display:flex;align-items:center;gap:6px;font-size:0.74rem;padding:5px 0;border-bottom:1px solid var(--border-subtle)"><span>⚙️</span><span>' + escHtml(o) + '</span></div>').join('')

    return '<div class="card" style="padding:16px">' +
      '<div style="font-weight:700;font-size:0.88rem;margin-bottom:12px">🚗 ' + escHtml(m.brand) + ' ' + escHtml(m.model) + '</div>' +
      '<div style="font-size:0.76rem;font-weight:700;margin-bottom:8px;color:var(--text-muted)">VARIANTS</div>' +
      variantsHtml +
      '<div style="font-size:0.76rem;font-weight:700;margin:12px 0 8px;color:var(--text-muted)">OPTIONS</div>' +
      optsHtml +
      '<div style="font-size:0.76rem;font-weight:700;margin:12px 0 8px;color:var(--text-muted)">สีที่มีจำหน่าย (' + m.colors.length + ' สี)</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' + m.colors.map(c=>'<span style="font-size:0.72rem;background:var(--surface-2);padding:3px 10px;border-radius:8px">'+escHtml(c)+'</span>').join('') + '</div>' +
      '<button class="btn btn-sm btn-primary" id="edit-model-btn" style="margin-top:14px;width:100%">✏️ แก้ไขข้อมูลรุ่น</button>' +
    '</div>'
  }

  function render() {
    const totalVariants = modelsCfg.reduce((s,m)=>s+m.variants.length,0)
    const totalColors   = modelsCfg.reduce((s,m)=>s+m.colors.length,0)
    const activeVariants = modelsCfg.reduce((s,m)=>s+m.variants.filter(v=>v.active).length,0)

    const detailPanel = selModelId ? renderDetail(modelsCfg.find(m=>m.id===selModelId)) : '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem">👈</div><div style="font-size:0.82rem;margin-top:8px">เลือกรุ่นรถเพื่อดู Config</div></div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚙️ Model Configuration</div>
            <div class="page-subtitle">ตัวเลือก Spec / Option ทุกรุ่น · ${modelsCfg.length} รุ่น${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-model-btn">+ เพิ่มรุ่น</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🚗 รุ่นทั้งหมด', modelsCfg.length+' รุ่น', 'var(--primary)')}
          ${sc('📋 Variants', totalVariants+' variant', 'var(--text-muted)')}
          ${sc('✅ มีจำหน่าย', activeVariants+' variant', 'var(--success)')}
          ${sc('🎨 รวมสีทั้งหมด', totalColors+' สี', 'var(--warning)')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="display:flex;flex-direction:column;gap:8px">
            ${modelsCfg.map(m=>modelCard(m)).join('')}
          </div>
          <div>${detailPanel}</div>
        </div>
      </div>`

    container.querySelectorAll('.model-cfg-card').forEach(c=>c.addEventListener('click',()=>{selModelId=c.dataset.id;render()}))
    document.getElementById('add-model-btn')?.addEventListener('click', openAddModelModal)
    document.getElementById('edit-model-btn')?.addEventListener('click',()=>{
      const m=modelsCfg.find(x=>x.id===selModelId)
      if(m) openEditModelModal(m)
    })
  }

  function openAddModelModal() {
    openModal({
      title: '⚙️ เพิ่มรุ่นรถใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แบรนด์ *</label>
              <input id="mc-brand" class="input" placeholder="BYD / MG / Tesla..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่น *</label>
              <input id="mc-model" class="input" placeholder="Atto 3 / Seal..."></div>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px">
            <div style="font-size:0.76rem;font-weight:700;margin-bottom:8px">Variant หลัก</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อ Variant</label>
                <input id="mc-vname" class="input" placeholder="Standard / Extended..."></div>
              <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคา (฿)</label>
                <input id="mc-price" type="number" class="input" placeholder="0"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
              <div><label style="font-size:0.74rem;color:var(--text-muted)">แบตเตอรี่</label>
                <input id="mc-bat" class="input" placeholder="60.5 kWh"></div>
              <div><label style="font-size:0.74rem;color:var(--text-muted)">พิสัย</label>
                <input id="mc-range" class="input" placeholder="420 km"></div>
            </div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">สีที่มีจำหน่าย (คั่นด้วยจุลภาค)</label>
            <input id="mc-colors" class="input" placeholder="Arctic Blue, Cosmos Black, Ski White..."></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">Options (คั่นด้วยจุลภาค)</label>
            <input id="mc-opts" class="input" placeholder="NFC Key Card, Solar Roof..."></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="mc-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('mc-save')?.addEventListener('click', () => {
      const brand = document.getElementById('mc-brand')?.value.trim()
      const model = document.getElementById('mc-model')?.value.trim()
      if (!brand || !model) { showToast('⚠️ กรุณากรอกแบรนด์และรุ่น', 'warning'); return }
      const colorsRaw = document.getElementById('mc-colors')?.value.trim()
      const optsRaw   = document.getElementById('mc-opts')?.value.trim()
      modelsCfg.push({
        id: 'MC' + String(modelsCfg.length + 1).padStart(3,'0'),
        brand, model,
        variants: [{
          name: document.getElementById('mc-vname')?.value.trim() || 'Standard',
          battery: document.getElementById('mc-bat')?.value.trim() || '-',
          range: document.getElementById('mc-range')?.value.trim() || '-',
          price: parseFloat(document.getElementById('mc-price')?.value) || 0,
          active: true,
        }],
        options: optsRaw ? optsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [],
        colors: colorsRaw ? colorsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [],
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ เพิ่ม ' + brand + ' ' + model + ' แล้ว', 'success')
      render()
    })
  }

  function openEditModelModal(m) {
    openModal({
      title: '✏️ แก้ไข: ' + escHtml(m.brand) + ' ' + escHtml(m.model), size: 'sm',
      body: `<div style="font-size:0.82rem;display:flex;flex-direction:column;gap:10px">
        <div><label style="font-size:0.74rem;color:var(--text-muted)">สีที่มีจำหน่าย (คั่นจุลภาค)</label>
          <input id="em-colors" class="input" value="${escHtml(m.colors.join(', '))}"></div>
        <div><label style="font-size:0.74rem;color:var(--text-muted)">Options (คั่นจุลภาค)</label>
          <input id="em-opts" class="input" value="${escHtml(m.options.join(', '))}"></div>
      </div>`,
      confirmText: '💾 บันทึก',
      onConfirm: () => {
        const c = document.getElementById('em-colors')?.value.trim()
        const o = document.getElementById('em-opts')?.value.trim()
        if (c) m.colors = c.split(',').map(s=>s.trim()).filter(Boolean)
        if (o) m.options = o.split(',').map(s=>s.trim()).filter(Boolean)
        showToast('✅ อัปเดต ' + m.brand + ' ' + m.model, 'success')
        render()
      }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
