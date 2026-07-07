import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData, listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const EVENT_TYPES = {
  launch:     { label: 'Launch Event', icon: '🚀', color: 'primary' },
  testdrive:  { label: 'Test Drive Day', icon: '🚗', color: 'warning' },
  expo:       { label: 'Motor Expo', icon: '🏟', color: 'success' },
  workshop:   { label: 'Workshop', icon: '🔧', color: 'accent' },
  vip:        { label: 'VIP Event', icon: '👑', color: 'accent' },
  online:     { label: 'Online Event', icon: '💻', color: 'secondary' },
  community:  { label: 'Community', icon: '🤝', color: 'success' },
}

const EVENT_STATUS = {
  planning:  { label: 'วางแผน', color: 'secondary' },
  confirmed: { label: 'ยืนยัน', color: 'primary' },
  ongoing:   { label: 'กำลังจัด', color: 'warning' },
  done:      { label: 'เสร็จแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

const AVG_DEAL_SIZE = 1100000  // ราคาเฉลี่ยต่อคัน (ใช้คำนวณ ROI)

// คำนวณ metrics ของ event
function calcEventMetrics(e, avgDeal) {
  const dealSize = avgDeal || AVG_DEAL_SIZE
  const costPerLead = e.leads > 0 ? Math.round(e.spent / e.leads) : 0
  const costPerSale = e.sales > 0 ? Math.round(e.spent / e.sales) : 0
  const leadConversion = e.leads > 0 ? ((e.sales / e.leads) * 100).toFixed(1) : '0'
  const attendeeToLead = e.attendees > 0 ? ((e.leads / e.attendees) * 100).toFixed(1) : '0'
  const revenueEst = e.sales * dealSize
  const roi = e.spent > 0 && e.sales > 0 ? Math.round(revenueEst / e.spent) : 0
  const roiPct = e.spent > 0 && e.sales > 0 ? Math.round((revenueEst - e.spent) / e.spent * 100) : 0
  return { costPerLead, costPerSale, leadConversion, attendeeToLead, revenueEst, roi, roiPct }
}

export default async function EventManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let typeFilter = 'all'
  let statusFilter = 'all'
  let viewMode = 'cards'
  let events = []
  let liveAvgDeal = AVG_DEAL_SIZE
  let dataSource = 'demo'
  let loading = true

  const today = new Date().toISOString().slice(0, 10)

  async function loadData() {
    loading = true
    try { events = await listDocs('marketing_events', [], 'startDate', 'asc', 500) } catch (e) { events = [] }
    try {
      const sales = await getSalesData()
      if (container.__routerGen !== myGen) return
      if (sales.length >= 2) {
        const totalRev = sales.reduce((a, s) => a + (s.salePrice || 0), 0)
        liveAvgDeal = totalRev > 0 ? Math.round(totalRev / sales.length) : AVG_DEAL_SIZE
        events.forEach(e => {
          if (e.status !== 'done') return
          const cnt = sales.filter(s => {
            const d = s.date || s.bookingDate || ''
            return d >= e.startDate && d <= (e.endDate || e.startDate)
          }).length
          if (cnt > 0) e.sales = cnt
        })
        dataSource = 'live'
      }
    } catch {}
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function isUpcoming(e) { return e.startDate >= today && e.status !== 'cancelled' }

  function filtered() {
    return events.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      return true
    }).sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = '<div class="page-content"><div class="empty-state"><div class="empty-state-icon">⏳</div><div>กำลังโหลด...</div></div></div>'
      return
    }
    const list = filtered()
    const upcoming = events.filter(isUpcoming).length
    const totalBudget = events.reduce((a, e) => a + e.budget, 0)
    const totalSpent = events.reduce((a, e) => a + e.spent, 0)
    const totalLeads = events.reduce((a, e) => a + e.leads, 0)
    const totalSales = events.reduce((a, e) => a + e.sales, 0)
    const totalRevenueEst = totalSales * liveAvgDeal
    const overallRoi = totalSpent > 0 ? Math.round(totalRevenueEst / totalSpent) : 0

    container.innerHTML =
      '<div class="page-content animate-slide">' +
        '<div class="page-header"><div>' +
          '<div class="page-title">🎪 Event Management</div>' +
          '<div class="page-subtitle">จัดการงาน Event — ติดตาม ROI และ Conversion' + (dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : '') + '</div>' +
        '</div><div class="page-actions">' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-sm ' + (viewMode==='cards'?'btn-primary':'btn-secondary') + '" id="view-cards">🗂 Card</button>' +
            '<button class="btn btn-sm ' + (viewMode==='calendar'?'btn-primary':'btn-secondary') + '" id="view-cal">📅 Timeline</button>' +
          '</div>' +
          '<button class="btn btn-secondary" id="export-btn">📥 Export</button>' +
          '<button class="btn btn-primary" id="add-ev-btn">+ สร้าง Event</button>' +
        '</div></div>' +

        // KPIs
        '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px">' +
          kpi('🎪 Events', events.length + '', 'primary') +
          kpi('📆 กำลังจะมา', upcoming + '', 'warning') +
          kpi('💰 Budget รวม', formatCurrency(totalBudget), 'primary') +
          kpi('🧲 Leads รวม', totalLeads + '', 'success') +
          kpi('🚗 ยอดขายจาก Event', totalSales + ' คัน', 'success') +
          kpi('📈 ROI รวม', (overallRoi > 0 ? overallRoi + 'x' : '-'), overallRoi >= 5 ? 'success' : 'accent') +
        '</div>' +

        // Filters
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center">' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
            '<button class="btn btn-xs ' + (typeFilter==='all'?'btn-primary':'btn-secondary') + ' type-btn" data-t="all">ทั้งหมด</button>' +
            Object.entries(EVENT_TYPES).map(([k,v]) => '<button class="btn btn-xs ' + (typeFilter===k?'btn-primary':'btn-secondary') + ' type-btn" data-t="' + k + '">' + v.icon + ' ' + v.label + '</button>').join('') +
          '</div>' +
          '<select class="input" id="status-filter" style="width:130px;height:28px;font-size:0.8rem">' +
            '<option value="all">สถานะทั้งหมด</option>' +
            Object.entries(EVENT_STATUS).map(([k,v]) => '<option value="' + k + '" ' + (statusFilter===k?'selected':'') + '>' + v.label + '</option>').join('') +
          '</select>' +
        '</div>' +

        (viewMode === 'cards' ? renderCards(list) : renderTimeline(list)) +
      '</div>'

    container.querySelector('#view-cards').addEventListener('click', () => { viewMode = 'cards'; renderPage() })
    container.querySelector('#view-cal').addEventListener('click', () => { viewMode = 'calendar'; renderPage() })
    container.querySelector('#add-ev-btn').addEventListener('click', () => openEventForm(null))
    container.querySelector('#export-btn').addEventListener('click', () => {
      exportToExcel(list.map(e => {
        const m = calcEventMetrics(e, liveAvgDeal)
        return { ID: e.id, Event: e.title, ประเภท: EVENT_TYPES[e.type]?.label, วันเริ่ม: e.startDate, วันสิ้นสุด: e.endDate, สถานที่: e.venue, Budget: e.budget, ใช้ไป: e.spent, ผู้เข้าร่วม: e.attendees, Leads: e.leads, ยอดขาย: e.sales, ROI: m.roi + 'x', 'Cost/Lead': m.costPerLead, 'Cost/Sale': m.costPerSale, สถานะ: EVENT_STATUS[e.status]?.label }
      }), 'events')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelector('#status-filter').addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    container.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    container.querySelectorAll('.open-ev-btn').forEach(b => b.addEventListener('click', () => {
      const ev = events.find(x => x.id === b.dataset.id); if (ev) openEventDetail(ev)
    }))
    container.querySelectorAll('.edit-ev-btn').forEach(b => b.addEventListener('click', () => {
      const ev = events.find(x => x.id === b.dataset.id); if (ev) openEventForm(ev)
    }))
  }

  function renderCards(list) {
    if (!list.length) return '<div class="empty-state"><div class="empty-state-icon">🎪</div><div>ไม่พบ Event</div></div>'
    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">' +
      list.map(e => {
        const tp = EVENT_TYPES[e.type]
        const st = EVENT_STATUS[e.status]
        const budgetPct = e.budget ? Math.min(100, Math.round(e.spent / e.budget * 100)) : 0
        const isMultiDay = e.startDate !== e.endDate
        const m = calcEventMetrics(e, liveAvgDeal)
        return '<div class="card" style="padding:0;overflow:hidden">' +
          '<div style="height:4px;background:var(--' + tp.color + ')"></div>' +
          '<div style="padding:14px 16px">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
              '<div>' +
                '<div style="font-size:1.3rem">' + tp.icon + '</div>' +
                '<div style="font-weight:700;font-size:0.88rem;margin-top:4px">' + esc(e.title) + '</div>' +
              '</div>' +
              '<span class="badge badge-' + st.color + '">' + st.label + '</span>' +
            '</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">📍 ' + esc(e.venue) + '</div>' +
            '<div style="font-size:0.8rem;margin-bottom:8px">📅 ' + formatDate(e.startDate) + (isMultiDay ? ' – ' + formatDate(e.endDate) : '') + '</div>' +
            // Budget bar
            '<div style="margin-bottom:8px">' +
              '<div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">' +
                '<span style="color:var(--text-muted)">Budget</span>' +
                '<span>' + formatCurrency(e.spent) + ' / ' + formatCurrency(e.budget) + ' (' + budgetPct + '%)</span>' +
              '</div>' +
              '<div style="height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">' +
                '<div style="height:100%;width:' + budgetPct + '%;background:' + (budgetPct>90?'var(--danger)':budgetPct>70?'var(--warning)':'var(--primary)') + ';border-radius:3px"></div>' +
              '</div>' +
            '</div>' +
            // Metrics
            (e.attendees || e.leads || e.sales ? '<div style="display:flex;gap:10px;font-size:0.78rem;margin-bottom:8px;flex-wrap:wrap">' +
              (e.attendees ? '<span>👥 ' + e.attendees + '</span>' : '') +
              (e.leads ? '<span>🧲 ' + e.leads + ' Leads</span>' : '') +
              (e.sales ? '<span>🚗 ' + e.sales + ' คัน</span>' : '') +
              (m.roi > 0 ? '<span style="color:var(--' + (m.roi>=5?'success':'warning') + ');font-weight:700">📈 ROI ' + m.roi + 'x</span>' : '') +
            '</div>' : '') +
            '<div style="display:flex;gap:6px">' +
              '<button class="btn btn-sm btn-secondary open-ev-btn" data-id="' + e.id + '" style="flex:1">ดูรายละเอียด</button>' +
              '<button class="btn btn-sm btn-secondary edit-ev-btn" data-id="' + e.id + '">✏️</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      }).join('') +
    '</div>'
  }

  function renderTimeline(list) {
    const grouped = {}
    list.forEach(e => {
      const mo = e.startDate.slice(0, 7)
      if (!grouped[mo]) grouped[mo] = []
      grouped[mo].push(e)
    })
    if (!Object.keys(grouped).length) return '<div class="empty-state"><div class="empty-state-icon">📅</div><div>ไม่พบ Event</div></div>'
    const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    return '<div style="display:flex;flex-direction:column;gap:20px">' +
      Object.entries(grouped).map(([mo, evs]) => {
        const [y, m] = mo.split('-')
        return '<div>' +
          '<div style="font-weight:800;font-size:0.9rem;margin-bottom:10px;color:var(--primary)">' + MONTHS_TH[+m-1] + ' ' + y + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
            evs.map(e => {
              const tp = EVENT_TYPES[e.type]
              const st = EVENT_STATUS[e.status]
              const met = calcEventMetrics(e, liveAvgDeal)
              return '<div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;' +
                (e.status === 'done' ? 'opacity:0.85' : '') + '" data-id="' + e.id + '">' +
                '<div style="font-size:1.2rem">' + tp.icon + '</div>' +
                '<div style="flex:1">' +
                  '<div style="font-weight:600;font-size:0.85rem">' + esc(e.title) + '</div>' +
                  '<div style="font-size:0.75rem;color:var(--text-muted)">' + formatDate(e.startDate) + (e.startDate!==e.endDate?' – '+formatDate(e.endDate):'') + ' · ' + esc(e.venue) + '</div>' +
                '</div>' +
                (e.sales > 0 ? '<span style="font-size:0.75rem;color:var(--success);font-weight:700">🚗 ' + e.sales + ' คัน</span>' : '') +
                (met.roi > 0 ? '<span style="font-size:0.75rem;color:var(--success);font-weight:700">ROI ' + met.roi + 'x</span>' : '') +
                '<span class="badge badge-' + st.color + '">' + st.label + '</span>' +
              '</div>'
            }).join('') +
          '</div>' +
        '</div>'
      }).join('') +
    '</div>'
  }

  function openEventDetail(e) {
    const tp = EVENT_TYPES[e.type]
    const st = EVENT_STATUS[e.status]
    const budgetPct = e.budget ? Math.round(e.spent / e.budget * 100) : 0
    const m = calcEventMetrics(e, liveAvgDeal)

    const roiColor = m.roi >= 10 ? 'success' : m.roi >= 5 ? 'warning' : m.roi >= 1 ? 'accent' : 'muted'

    openModal({
      title: tp.icon + ' ' + e.title,
      size: 'lg',
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">' +
          '<div>' +
            row('ประเภท', tp.icon + ' ' + tp.label) +
            row('สถานะ', '<span class="badge badge-' + st.color + '">' + st.label + '</span>') +
            row('วันที่', formatDate(e.startDate) + (e.startDate!==e.endDate?' – '+formatDate(e.endDate):'')) +
            row('สถานที่', esc(e.venue)) +
          '</div>' +
          '<div>' +
            row('Budget', formatCurrency(e.budget)) +
            row('ใช้ไป', formatCurrency(e.spent) + ' (' + budgetPct + '%)') +
            (e.attendees ? row('ผู้เข้าร่วม', e.attendees + ' คน') : '') +
            (e.leads ? row('Leads ได้รับ', e.leads + ' ราย') : '') +
            (e.sales ? row('ยอดขาย', e.sales + ' คัน') : '') +
          '</div>' +
        '</div>' +

        (e.description ? '<div style="font-size:0.82rem;line-height:1.6;margin-bottom:14px;color:var(--text-muted)">' + esc(e.description) + '</div>' : '') +

        // ROI Section (แสดงเฉพาะเมื่อมีข้อมูล)
        (e.status === 'done' || e.sales > 0 || e.leads > 0 ? '' +
          '<div style="background:var(--surface-2);border-radius:var(--radius);padding:12px;margin-bottom:14px">' +
            '<div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">📈 วิเคราะห์ผลลัพธ์และ ROI</div>' +
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">' +
              miniKpi('💸 Cost/Lead', m.costPerLead > 0 ? formatCurrency(m.costPerLead) : '-', 'warning') +
              miniKpi('💰 Cost/Sale', m.costPerSale > 0 ? formatCurrency(m.costPerSale) : '-', 'warning') +
              miniKpi('📈 ROI', m.roi > 0 ? m.roi + 'x' : '-', roiColor) +
              miniKpi('💎 Revenue', m.revenueEst > 0 ? formatCurrency(m.revenueEst) : '-', 'success') +
            '</div>' +
            // Funnel
            (e.attendees || e.leads || e.sales ?
              '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">Conversion Funnel</div>' +
              '<div style="display:flex;gap:6px;align-items:center;font-size:0.78rem;flex-wrap:wrap">' +
                (e.attendees ? '<span style="background:var(--primary);color:#fff;padding:4px 10px;border-radius:12px">👥 ' + e.attendees + ' เข้าร่วม</span>' : '') +
                (e.attendees && e.leads ? '<span style="color:var(--text-muted)">→ ' + m.attendeeToLead + '%</span>' : '') +
                (e.leads ? '<span style="background:var(--warning);color:#fff;padding:4px 10px;border-radius:12px">🧲 ' + e.leads + ' Leads</span>' : '') +
                (e.leads && e.sales ? '<span style="color:var(--text-muted)">→ ' + m.leadConversion + '%</span>' : '') +
                (e.sales ? '<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:12px">🚗 ' + e.sales + ' ขาย</span>' : '') +
              '</div>'
            : '<div style="font-size:0.75rem;color:var(--text-muted)">ยังไม่มีข้อมูล Attendees / Leads / Sales</div>') +
          '</div>'
        : '') +

        // Checklist
        '<div>' +
          '<div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">✅ Checklist งาน</div>' +
          '<div style="display:flex;flex-direction:column;gap:5px">' +
            e.tasks.map(t => '<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;padding:5px 8px;background:var(--surface-2);border-radius:var(--radius-sm)">' +
              '<span>' + (t.includes('✅') ? '✅' : '⬜') + '</span>' +
              '<span>' + esc(t.replace('✅', '').trim()) + '</span>' +
            '</div>').join('') +
          '</div>' +
        '</div>' +

        // Budget progress
        '<div style="margin-top:14px">' +
          '<div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">' +
            '<span>งบประมาณที่ใช้</span><span>' + formatCurrency(e.spent) + ' / ' + formatCurrency(e.budget) + '</span>' +
          '</div>' +
          '<div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">' +
            '<div style="height:100%;width:' + budgetPct + '%;background:' + (budgetPct>90?'var(--danger)':budgetPct>70?'var(--warning)':'var(--success)') + ';border-radius:4px"></div>' +
          '</div>' +
        '</div>',
      footer: '<button class="btn btn-secondary edit-modal-btn">✏️ แก้ไข</button>'
    })
    setTimeout(() => {
      document.querySelector('.modal .edit-modal-btn')?.addEventListener('click', () => {
        document.querySelector('.modal-close-btn')?.click()
        openEventForm(e)
      })
    }, 50)
  }

  function openEventForm(e) {
    const { el, close } = openModal({
      title: e ? '✏️ แก้ไข — ' + e.title : '+ สร้าง Event ใหม่',
      size: 'lg',
      body: '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อ Event *</label><input class="input" id="ef-title" value="' + esc(e?.title||'') + '"></div>' +
        '<div class="input-group"><label class="input-label">ประเภท</label>' +
          '<select class="input" id="ef-type">' + Object.entries(EVENT_TYPES).map(([k,v]) => '<option value="' + k + '" ' + (e?.type===k?'selected':'') + '>' + v.icon + ' ' + v.label + '</option>').join('') + '</select>' +
        '</div>' +
        '<div class="input-group"><label class="input-label">สถานะ</label>' +
          '<select class="input" id="ef-status">' + Object.entries(EVENT_STATUS).map(([k,v]) => '<option value="' + k + '" ' + (e?.status===k?'selected':'') + '>' + v.label + '</option>').join('') + '</select>' +
        '</div>' +
        '<div class="input-group"><label class="input-label">วันเริ่ม</label><input type="date" class="input" id="ef-start" value="' + (e?.startDate||today) + '"></div>' +
        '<div class="input-group"><label class="input-label">วันสิ้นสุด</label><input type="date" class="input" id="ef-end" value="' + (e?.endDate||today) + '"></div>' +
        '<div class="input-group" style="grid-column:1/-1"><label class="input-label">สถานที่</label><input class="input" id="ef-venue" value="' + esc(e?.venue||'') + '"></div>' +
        '<div class="input-group"><label class="input-label">Budget (บาท)</label><input type="number" class="input" id="ef-budget" value="' + (e?.budget||50000) + '"></div>' +
        '<div class="input-group"><label class="input-label">ค่าใช้จ่ายจริง</label><input type="number" class="input" id="ef-spent" value="' + (e?.spent||0) + '"></div>' +
        '<div class="input-group"><label class="input-label">ผู้เข้าร่วม (คน)</label><input type="number" class="input" id="ef-att" value="' + (e?.attendees||0) + '"></div>' +
        '<div class="input-group"><label class="input-label">Leads ที่ได้</label><input type="number" class="input" id="ef-leads" value="' + (e?.leads||0) + '"></div>' +
        '<div class="input-group"><label class="input-label">ยอดขาย (คัน)</label><input type="number" class="input" id="ef-sales" value="' + (e?.sales||0) + '"></div>' +
        '<div class="input-group"><label class="input-label">รุ่นที่ขายได้</label><input class="input" id="ef-models" value="' + esc(e?.modelsStr||'') + '" placeholder="เช่น BYD Seal, MG ZS EV"></div>' +
        '<div class="input-group" style="grid-column:1/-1"><label class="input-label">รายละเอียด</label><textarea class="input" id="ef-desc" rows="2">' + esc(e?.description||'') + '</textarea></div>' +
      '</div>',
      footer: '<button class="btn btn-secondary" id="ef-cancel">ยกเลิก</button><button class="btn btn-primary" id="ef-save">💾 บันทึก</button>'
    })

    el.querySelector('#ef-cancel').addEventListener('click', close)
    el.querySelector('#ef-save').addEventListener('click', async () => {
      const title = el.querySelector('#ef-title').value.trim()
      if (!title) { showToast('❗ กรุณากรอกชื่อ Event', 'error'); return }
      const data = {
        title, type: el.querySelector('#ef-type').value, status: el.querySelector('#ef-status').value,
        startDate: el.querySelector('#ef-start').value, endDate: el.querySelector('#ef-end').value,
        venue: el.querySelector('#ef-venue').value, budget: +el.querySelector('#ef-budget').value,
        spent: +el.querySelector('#ef-spent').value, attendees: +el.querySelector('#ef-att').value,
        leads: +el.querySelector('#ef-leads').value, sales: +el.querySelector('#ef-sales').value,
        modelsStr: el.querySelector('#ef-models').value, description: el.querySelector('#ef-desc').value,
      }
      try {
        if (e) await updateDocData('marketing_events', e.id, data)
        else await createDoc('marketing_events', { tasks: [], ...data })
        showToast('✅ บันทึก Event แล้ว!', 'success')
        close()
        await loadData()
      } catch (err) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return '<div class="card" style="padding:12px 14px;border-left:3px solid var(--' + color + ')">' +
    '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px">' + title + '</div>' +
    '<div style="font-size:1.1rem;font-weight:800;color:var(--' + color + ')">' + value + '</div></div>'
}

function miniKpi(label, value, color) {
  return '<div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--radius-sm)">' +
    '<div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">' + label + '</div>' +
    '<div style="font-weight:700;color:var(--' + color + ');font-size:0.88rem">' + value + '</div></div>'
}

function row(label, value) {
  return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">' + label + '</span><span>' + value + '</span></div>'
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
