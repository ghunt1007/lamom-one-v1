import { MASTER_LISTS, getList, addItem, removeItem, resetMaster, getSalesChannel, setSalesChannel } from '../../data/masterData.js'
import { showToast } from '../../core/store.js'
import { confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'

export default async function MasterDataPage(container) {
  const myGen = container.__routerGen
  let active = MASTER_LISTS[0].key
  let search = ''

  function meta() { return MASTER_LISTS.find(l => l.key === active) }

  function tabs() {
    return MASTER_LISTS.map(l => {
      const count = getList(l.key).length
      return `<button class="btn btn-sm ${l.key===active?'btn-primary':'btn-secondary'} md-tab" data-k="${l.key}">
        ${l.label} <span style="font-size:0.65rem;opacity:0.8">(${count})</span>
      </button>`
    }).join('')
  }

  function filteredItems() {
    const items = getList(active)
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(it => {
      const label = typeof it === 'string' ? it : it.name || ''
      return label.toLowerCase().includes(q)
    })
  }

  function itemsHtml() {
    const m = meta()
    const items = filteredItems()
    const allItems = getList(active)

    if (!allItems.length) return `<div style="padding:32px;text-align:center;color:var(--text-muted)">
      <div style="font-size:2rem;margin-bottom:8px">📭</div>
      <div>ยังไม่มีข้อมูลในหมวดนี้</div>
    </div>`

    if (!items.length) return `<div style="padding:32px;text-align:center;color:var(--text-muted)">
      <div style="font-size:2rem;margin-bottom:8px">🔍</div>
      <div>ไม่พบ "<strong>${search}</strong>"</div>
    </div>`

    return items.map((it, i) => {
      const realIdx = allItems.indexOf(it)
      const label = m.type === 'priced'
        ? `<span style="font-weight:600">${it.name}</span> <span style="color:var(--text-muted);font-size:0.76rem">฿${(it.price||0).toLocaleString()}</span>`
        : `<span>${it}</span>`
      const channelToggle = active === 'salesStaff' ? (() => {
        const ch = getSalesChannel(it)
        const isShowroom = ch === 'showroom'
        return `<button class="btn btn-xs channel-toggle" data-name="${it}" style="margin-right:8px;background:${isShowroom?'var(--primary-dim)':'var(--success-dim)'};color:${isShowroom?'var(--primary)':'var(--success)'};border:1px solid ${isShowroom?'var(--primary)':'var(--success)'}">
          ${isShowroom ? '🏢 หน้าร้าน' : '💻 ออนไลน์'}
        </button>`
      })() : ''
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border-subtle)">
        <div style="font-size:0.82rem">${label}</div>
        <div style="display:flex;align-items:center">
          ${channelToggle}
          <button class="btn btn-sm btn-danger md-del" data-i="${realIdx}" title="ลบ">🗑</button>
        </div>
      </div>`
    }).join('')
  }

  function addRow() {
    const m = meta()
    if (m.type === 'priced') {
      return `<input id="md-name" placeholder="ชื่อรายการ" class="input" style="flex:2;font-size:0.82rem">
              <input id="md-price" type="number" placeholder="ราคา (บาท)" class="input" style="flex:1;font-size:0.82rem">
              <button class="btn btn-primary btn-sm" id="md-add">➕ เพิ่ม</button>`
    }
    return `<input id="md-name" placeholder="พิมพ์รายการใหม่..." class="input" style="flex:1;font-size:0.82rem">
            <button class="btn btn-primary btn-sm" id="md-add">➕ เพิ่ม</button>`
  }

  function render() {
    const m = meta()
    const allItems = getList(active)
    const shown = filteredItems()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🗂 Master Data</div>
            <div class="page-subtitle">ข้อมูลอ้างอิงกลาง — แก้ที่นี่ที่เดียว มีผลทั้งระบบ</div>
          </div>
          <div class="page-actions" style="gap:6px">
            <button class="btn btn-secondary btn-sm" id="md-export">📥 Export</button>
            <button class="btn btn-secondary btn-sm" id="md-reset">↩️ รีเซ็ต</button>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${tabs()}</div>

        <div class="card" style="padding:14px">
          <!-- Header row -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-weight:700;font-size:0.86rem">${m.icon||''} ${m.label}
              <span style="font-size:0.72rem;font-weight:400;color:var(--text-muted);margin-left:6px">${allItems.length} รายการ${search?' · แสดง '+shown.length:''}</span>
            </div>
            <input id="md-search" class="input" placeholder="🔍 ค้นหา..." value="${search}" style="width:180px;font-size:0.78rem;padding:5px 10px">
          </div>

          <!-- Add row -->
          <div style="display:flex;gap:6px;margin-bottom:12px">${addRow()}</div>

          <!-- List -->
          <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-sm);max-height:52vh;overflow-y:auto" id="md-list">
            ${itemsHtml()}
          </div>

          ${allItems.length > 0 ? `
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-sm btn-danger" id="md-clear">🗑 ล้างหมวดนี้ทั้งหมด</button>
          </div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.md-tab').forEach(b => b.addEventListener('click', () => {
      active = b.dataset.k; search = ''; render()
    }))

    document.getElementById('md-search')?.addEventListener('input', e => {
      search = e.target.value; relistOnly()
    })

    container.querySelectorAll('.md-del').forEach(b => b.addEventListener('click', () => {
      removeItem(active, parseInt(b.dataset.i))
      showToast('🗑 ลบแล้ว', 'warning')
      render()
    }))

    container.querySelectorAll('.channel-toggle').forEach(b => b.addEventListener('click', () => {
      const name = b.dataset.name
      const next = getSalesChannel(name) === 'showroom' ? 'online' : 'showroom'
      setSalesChannel(name, next)
      showToast(`${next === 'showroom' ? '🏢' : '💻'} ${name} → ${next === 'showroom' ? 'ทีมหน้าร้าน' : 'ทีมออนไลน์'}`, 'success')
      relistOnly()
    }))

    document.getElementById('md-add')?.addEventListener('click', () => {
      const m2 = meta()
      const name = document.getElementById('md-name')?.value?.trim()
      if (!name) { showToast('⚠️ กรุณากรอกข้อมูล', 'warning'); return }
      if (m2.type === 'priced') {
        const price = parseFloat(document.getElementById('md-price')?.value) || 0
        addItem(active, { id:'X'+Date.now(), name, price })
      } else {
        addItem(active, name)
      }
      showToast('➕ เพิ่มแล้ว', 'success')
      render()
    })

    document.getElementById('md-add')?.previousElementSibling?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('md-add').click()
    })

    document.getElementById('md-export')?.addEventListener('click', () => {
      const items = getList(active)
      const m2 = meta()
      if (!items.length) { showToast('⚠️ ไม่มีข้อมูล', 'warning'); return }
      const rows = m2.type === 'priced'
        ? items.map(it => ({ ชื่อ: it.name, ราคา: it.price }))
        : items.map(it => ({ รายการ: it }))
      exportToExcel(rows, `masterdata-${active}-${new Date().toISOString().slice(0,10)}.xlsx`, m2.label)
      showToast('📥 Export แล้ว', 'success')
    })

    document.getElementById('md-reset')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title:'↩️ รีเซ็ต Master Data', message:'คืนค่า Master Data ทั้งหมดกลับค่าเริ่มต้น?', confirmText:'รีเซ็ต', danger:true })
      if (!ok) return
      resetMaster(); showToast('↩️ คืนค่าแล้ว', 'warning')
      if (container.__routerGen !== myGen) return
      render()
    })

    document.getElementById('md-clear')?.addEventListener('click', async () => {
      const m3 = meta()
      const ok = await confirmDialog({ title:`🗑 ล้างหมวด ${m3.label}`, message:`ลบข้อมูลในหมวด "${m3.label}" ทั้งหมด (${getList(active).length} รายการ)?`, confirmText:'ล้าง', danger:true })
      if (!ok) return
      const items = getList(active)
      for (let i = items.length - 1; i >= 0; i--) removeItem(active, i)
      showToast(`🗑 ล้างหมวด ${m3.label} แล้ว`, 'warning')
      if (container.__routerGen !== myGen) return
      render()
    })
  }

  function relistOnly() {
    const listEl = document.getElementById('md-list')
    if (listEl) listEl.innerHTML = itemsHtml()
  }

  render()
}
