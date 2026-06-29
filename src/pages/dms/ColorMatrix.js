/**
 * Color & Option Matrix — สี/ออปชั่นที่มีสต็อก vs ต้องสั่ง
 * Route: /dms/color-matrix
 */
import { showToast } from '../../core/store.js'

const MODELS = ['BYD Atto 3', 'BYD Seal AWD', 'BYD Han', 'BYD Dolphin', 'MG ZS EV']

const COLORS = [
  { code:'#1565c0', name:'Arctic Blue',    model:'BYD Atto 3',   status:'stock',  qty:3, leadDays:0  },
  { code:'#212121', name:'Cosmos Black',   model:'BYD Atto 3',   status:'stock',  qty:2, leadDays:0  },
  { code:'#f5f5f5', name:'Ski White',      model:'BYD Atto 3',   status:'stock',  qty:1, leadDays:0  },
  { code:'#c62828', name:'Flame Red',      model:'BYD Atto 3',   status:'order',  qty:0, leadDays:21 },
  { code:'#212121', name:'Cosmos Black',   model:'BYD Seal AWD', status:'stock',  qty:4, leadDays:0  },
  { code:'#b0bec5', name:'Aurora Silver',  model:'BYD Seal AWD', status:'stock',  qty:2, leadDays:0  },
  { code:'#1b5e20', name:'Jade Green',     model:'BYD Seal AWD', status:'order',  qty:0, leadDays:30 },
  { code:'#ffd600', name:'Solar Yellow',   model:'BYD Seal AWD', status:'na',     qty:0, leadDays:0  },
  { code:'#212121', name:'Cosmos Black',   model:'BYD Han',      status:'stock',  qty:2, leadDays:0  },
  { code:'#1b5e20', name:'Jade Green',     model:'BYD Han',      status:'order',  qty:0, leadDays:45 },
  { code:'#f5f5f5', name:'Pearl White',    model:'BYD Dolphin',  status:'stock',  qty:5, leadDays:0  },
  { code:'#1565c0', name:'Ocean Blue',     model:'BYD Dolphin',  status:'stock',  qty:3, leadDays:0  },
  { code:'#e91e63', name:'Sakura Pink',    model:'BYD Dolphin',  status:'order',  qty:0, leadDays:14 },
  { code:'#f5f5f5', name:'Pearl White',    model:'MG ZS EV',     status:'stock',  qty:4, leadDays:0  },
  { code:'#c62828', name:'Passion Red',    model:'MG ZS EV',     status:'stock',  qty:2, leadDays:0  },
  { code:'#9e9e9e', name:'Sterling Grey',  model:'MG ZS EV',     status:'order',  qty:0, leadDays:18 },
]

export default async function ColorMatrixPage(container) {
  let filterModel  = 'all'
  let filterStatus = 'all'

  function colorChip(c) {
    const bg    = c.status==='stock'?'var(--success)':c.status==='order'?'var(--warning)':'var(--text-muted)'
    const label = c.status==='stock'?'สต็อก':c.status==='order'?'สั่ง':'N/A'
    const detail = c.status==='stock' ? c.qty+' คัน' : c.status==='order' ? c.leadDays+' วัน' : '-'
    const borderStyle = c.code==='#f5f5f5' ? 'border:2px solid var(--border)' : 'border:2px solid transparent'
    return `<div class="card" style="padding:12px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:50%;background:${c.code};${borderStyle};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:0.76rem;font-weight:700">${c.name}</div>
        <div style="font-size:0.66rem;color:var(--text-muted)">${c.model}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.62rem;background:${bg};color:#fff;padding:1px 8px;border-radius:8px;margin-bottom:2px">${label}</div>
        <div style="font-size:0.62rem;color:var(--text-muted)">${detail}</div>
      </div>
    </div>`
  }

  function render() {
    let rows = COLORS
    if (filterModel  !== 'all') rows = rows.filter(c=>c.model===filterModel)
    if (filterStatus !== 'all') rows = rows.filter(c=>c.status===filterStatus)

    const stockCount = COLORS.filter(c=>c.status==='stock').length
    const orderCount = COLORS.filter(c=>c.status==='order').length
    const naCount    = COLORS.filter(c=>c.status==='na').length
    const totalQty   = COLORS.filter(c=>c.status==='stock').reduce((s,c)=>s+c.qty,0)

    const modelOpts = MODELS.map(m=>'<option value="' + m + '"' + (filterModel===m?' selected':'') + '>' + m + '</option>').join('')

    const statusBtns = ['all','stock','order','na'].map(s=>{
      const label = s==='all'?'ทั้งหมด':s==='stock'?'✅ สต็อก':s==='order'?'📦 สั่ง':'⛔ N/A'
      return '<button class="btn btn-xs ' + (filterStatus===s?'btn-primary':'btn-secondary') + ' stat-btn" data-s="' + s + '">' + label + '</button>'
    }).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎨 Color & Option Matrix</div>
            <div class="page-subtitle">สี/ออปชั่น มีสต็อก vs ต้องสั่ง · ${MODELS.length} รุ่น ${COLORS.length} สี</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="order-btn">📦 สั่งสีที่ขาด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('✅ มีสต็อก', stockCount+' สี', 'var(--success)')}
          ${sc('📦 ต้องสั่ง', orderCount+' สี', 'var(--warning)')}
          ${sc('⛔ N/A', naCount+' สี', 'var(--text-muted)')}
          ${sc('🚗 คันในสต็อก', totalQty+' คัน', 'var(--primary)')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
          <select class="input" id="model-filter" style="min-width:160px">
            <option value="all">ทุกรุ่น</option>
            ${modelOpts}
          </select>
          ${statusBtns}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">
          ${rows.map(c=>colorChip(c)).join('')}
          ${rows.length===0?'<div style="text-align:center;padding:30px;color:var(--text-muted);grid-column:1/-1">ไม่พบข้อมูล</div>':''}
        </div>
      </div>`

    container.querySelectorAll('.stat-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    document.getElementById('model-filter')?.addEventListener('change',e=>{filterModel=e.target.value;render()})
    document.getElementById('order-btn')?.addEventListener('click',()=>{
      const toOrder = COLORS.filter(c=>c.status==='order')
      showToast('📦 ส่งใบสั่ง '+toOrder.length+' สีที่ขาดสต็อก ไปยังโรงงาน','success')
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
