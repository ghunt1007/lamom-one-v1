/**
 * Leasing Management — Operational Lease สัญญาเช่ารถระยะยาว
 * Route: /b2b/leasing
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_LEASES = [
  { id:'LS001', company:'บริษัท เทคไทย จก.', model:'BYD Atto 3 Extended', qty:3, monthlyRate:28500, term:36, startDate:'2025-01-01', endDate:'2027-12-31', paid:18, status:'active', contact:'คุณอภิชาต 089-111-2222' },
  { id:'LS002', company:'โรงพยาบาล เซนต์หลุยส์', model:'BYD Dolphin Boost', qty:5, monthlyRate:19800, term:24, startDate:'2025-06-01', endDate:'2027-05-31', paid:13, status:'active', contact:'คุณนันทิดา 02-333-4444' },
  { id:'LS003', company:'บริษัท ลอจิสติกส์ไทย จก.', model:'MG ZS EV Luxury', qty:8, monthlyRate:24000, term:48, startDate:'2024-03-01', endDate:'2028-02-28', paid:28, status:'active', contact:'คุณสมชาย 081-555-6666' },
  { id:'LS004', company:'สำนักงาน ก.พ.', model:'BYD Han EV', qty:2, monthlyRate:45000, term:36, startDate:'2025-09-01', endDate:'2028-08-31', paid:10, status:'active', contact:'คุณพิชัย 02-777-8888' },
  { id:'LS005', company:'บริษัท กรีนเนอร์จี จก.', model:'BYD Seal AWD', qty:4, monthlyRate:38000, term:36, startDate:'2023-01-01', endDate:'2025-12-31', paid:36, status:'expired', contact:'คุณวีรชัย 084-999-0000' },
]

export default async function LeasingManagementPage(container) {
  const myGen = container.__routerGen
  let leases = DEMO_LEASES.map(l => ({ ...l }))
  let dataSource = 'demo'
  let filterStatus = 'all'

  try {
    const docs = await listDocs('leasing_contracts', [], 'startDate', 'desc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `LS${i+1}`,
        company: d.company || d.companyName || 'บริษัท',
        model: d.model || d.vehicleModel || '',
        qty: d.qty || d.quantity || 1,
        monthlyRate: d.monthlyRate || d.rate || 0,
        term: d.term || 36,
        startDate: d.startDate || '',
        endDate: d.endDate || '',
        paid: d.paid || d.paidMonths || 0,
        status: d.status || 'active',
        contact: d.contact || d.contactName || '',
      }))
      leases = [...mapped, ...DEMO_LEASES]
      dataSource = 'live'
    }
  } catch {}

  function progress(paid, term) {
    const pct = Math.round(paid/term*100)
    const color = pct>=80?'var(--success)':pct>=50?'var(--primary)':'var(--warning)'
    return '<div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;margin-top:4px">' +
      '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:3px;transition:width .4s"></div>' +
    '</div>' +
    '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px">'+paid+'/'+term+' เดือน ('+pct+'%)</div>'
  }

  function leaseCard(l) {
    const monthly = l.qty * l.monthlyRate
    const totalValue = monthly * l.term
    const remaining = l.term - l.paid
    const statusColor = l.status==='active'?'var(--success)':'var(--surface-2)'
    const statusLabel = l.status==='active'?'ดำเนินการ':'หมดสัญญา'
    return '<div class="card" style="padding:14px;margin-bottom:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.84rem;margin-bottom:2px">'+escHtml(l.company)+'</div>' +
          '<div style="font-size:0.7rem;color:var(--text-muted)">'+escHtml(l.model)+' × '+l.qty+' คัน</div>' +
        '</div>' +
        '<span style="font-size:0.62rem;background:'+statusColor+';color:#fff;padding:2px 8px;border-radius:8px">'+statusLabel+'</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;font-size:0.72rem">' +
        '<div><div style="color:var(--text-muted);font-size:0.62rem">ค่าเช่า/เดือน</div><div style="font-weight:700;color:var(--primary)">฿'+monthly.toLocaleString()+'</div></div>' +
        '<div><div style="color:var(--text-muted);font-size:0.62rem">มูลค่าสัญญา</div><div style="font-weight:700">฿'+Math.round(totalValue/1000000*10)/10+'M</div></div>' +
        '<div><div style="color:var(--text-muted);font-size:0.62rem">เหลือ</div><div style="font-weight:700;color:'+(remaining<=6?'var(--danger)':'var(--text-muted)')+'">'+remaining+' เดือน</div></div>' +
      '</div>' +
      progress(l.paid, l.term) +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">' +
        '<div style="font-size:0.68rem;color:var(--text-muted)">'+escHtml(l.contact)+'</div>' +
        '<button class="btn btn-sm btn-secondary detail-btn" data-id="'+l.id+'">รายละเอียด</button>' +
      '</div>' +
    '</div>'
  }

  function render() {
    let list = filterStatus==='all' ? leases : leases.filter(l=>l.status===filterStatus)
    const active = leases.filter(l=>l.status==='active')
    const totalMonthly = active.reduce((s,l)=>s+l.qty*l.monthlyRate,0)
    const totalVehicles = active.reduce((s,l)=>s+l.qty,0)
    const expiringSoon = active.filter(l=>l.term-l.paid<=6).length

    const filterBtns = ['all','active','expired'].map(s=>'<button class="btn btn-sm '+(filterStatus===s?'btn-primary':'btn-secondary')+' sf-btn" data-s="'+s+'">'+( s==='all'?'ทั้งหมด':s==='active'?'ดำเนินการ':'หมดสัญญา')+'</button>').join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚙 Leasing Management</div>
            <div class="page-subtitle">Operational Lease สัญญาเช่ารถระยะยาว · ${leases.length} สัญญา${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-lease-btn">+ สัญญาใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('📋 สัญญาดำเนินการ', active.length+' สัญญา', 'var(--primary)')}
          ${sc('🚗 รถในระบบ Lease', totalVehicles+' คัน', 'var(--success)')}
          ${sc('💰 รายรับ/เดือน', '฿'+totalMonthly.toLocaleString(), 'var(--warning)')}
          ${sc('⚠️ ใกล้หมดสัญญา', expiringSoon+' สัญญา', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${filterBtns}</div>
        <div>${list.map(l=>leaseCard(l)).join('')}</div>
      </div>`

    container.querySelectorAll('.sf-btn').forEach(b=>b.addEventListener('click',()=>{filterStatus=b.dataset.s;render()}))
    container.querySelectorAll('.detail-btn').forEach(b=>b.addEventListener('click',()=>{
      const l = leases.find(x=>x.id===b.dataset.id)
      if(!l) return
      openModal({ title:'🚙 '+escHtml(l.company), size:'sm',
        body:'<div style="font-size:0.84rem;line-height:2">' +
          '<div><b>รุ่น:</b> '+escHtml(l.model)+' × '+l.qty+' คัน</div>' +
          '<div><b>ค่าเช่า:</b> ฿'+(l.qty*l.monthlyRate).toLocaleString()+'/เดือน</div>' +
          '<div><b>ระยะสัญญา:</b> '+l.term+' เดือน</div>' +
          '<div><b>วันเริ่ม:</b> '+l.startDate+'</div>' +
          '<div><b>วันสิ้นสุด:</b> '+l.endDate+'</div>' +
          '<div><b>ผู้ติดต่อ:</b> '+escHtml(l.contact)+'</div>' +
        '</div>',
        confirmText:'ต่อสัญญา', onConfirm:()=>{
          const endD = new Date(l.endDate)
          endD.setMonth(endD.getMonth() + l.term)
          l.endDate = endD.toISOString().slice(0,10)
          l.paid = 0
          l.status = 'active'
          showToast(`✅ ต่อสัญญา ${l.company} อีก ${l.term} เดือน — สิ้นสุด ${l.endDate}`, 'success')
          renderPage()
          return true
        }
      })
    }))
    document.getElementById('new-lease-btn')?.addEventListener('click', openNewLeaseModal)
  }

  function openNewLeaseModal() {
    const today = new Date().toISOString().slice(0, 10)
    openModal({
      title: '🚙 สัญญา Lease ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">บริษัท/องค์กร *</label>
            <input id="ls-co" class="input" placeholder="บริษัท... / โรงพยาบาล... / ราชการ..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่นรถ *</label>
              <input id="ls-model" class="input" placeholder="BYD Atto 3 Extended..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">จำนวนคัน</label>
              <input id="ls-qty" type="number" class="input" value="1" min="1"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ค่าเช่า/คัน/เดือน (฿)</label>
              <input id="ls-rate" type="number" class="input" placeholder="0"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ระยะสัญญา (เดือน)</label>
              <select id="ls-term" class="input">
                ${[12,24,36,48,60].map(t=>`<option value="${t}">${t} เดือน</option>`).join('')}
              </select>
            </div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">วันเริ่มสัญญา</label>
            <input id="ls-start" type="date" class="input" value="${today}"></div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ผู้ติดต่อ</label>
            <input id="ls-contact" class="input" placeholder="คุณ... 08x-xxx-xxxx"></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="ls-save">💾 สร้างสัญญา</button>
        </div>
      `
    })
    document.getElementById('ls-save')?.addEventListener('click', () => {
      const company = document.getElementById('ls-co')?.value.trim()
      const model   = document.getElementById('ls-model')?.value.trim()
      if (!company || !model) { showToast('⚠️ กรุณากรอกบริษัทและรุ่นรถ', 'warning'); return }
      const term      = parseInt(document.getElementById('ls-term')?.value) || 36
      const startDate = document.getElementById('ls-start')?.value || today
      const endD      = new Date(startDate)
      endD.setMonth(endD.getMonth() + term)
      leases.push({
        id: 'LS' + String(leases.length + 1).padStart(3,'0'),
        company, model,
        qty: parseInt(document.getElementById('ls-qty')?.value) || 1,
        monthlyRate: parseFloat(document.getElementById('ls-rate')?.value) || 0,
        term, startDate,
        endDate: endD.toISOString().slice(0,10),
        paid: 0,
        status: 'active',
        contact: document.getElementById('ls-contact')?.value.trim() || '-',
      })
      document.querySelector('.modal-overlay')?.remove()
      showToast('✅ สร้างสัญญา Lease ให้ ' + company + ' แล้ว', 'success')
      render()
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
