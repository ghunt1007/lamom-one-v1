/**
 * Digital Signage — จัดการจอโชว์รูม แสดงโปรโมชั่น ราคา คิว
 * Route: /settings/digital-signage
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatCurrency } from '../../utils/format.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

export default async function DigitalSignagePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let slides = []
  let screens = []
  let previewSlide = 0
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [sl, sc] = await Promise.all([
        listDocs('signage_slides', [], 'title', 'asc', 200),
        listDocs('signage_screens', [], 'name', 'asc', 200),
      ])
      slides = sl; screens = sc
    } catch (e) { slides = []; screens = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const activeSl = slides.filter(s => s.active)
    const cur = activeSl[previewSlide % Math.max(activeSl.length,1)]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📺 Digital Signage</div>
            <div class="page-subtitle">จัดการจอโชว์รูม ${screens.length} จอ · ${slides.length} Slides · ${screens.filter(s=>s.status==='online').length} Online</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="push-all-btn">📡 Push ทุกจอ</button>
            <button class="btn btn-primary" id="add-slide-btn">+ สร้าง Slide</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Preview -->
          <div>
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🎞 Preview ออกอากาศ (Auto-Rotate)</div>
            <div id="preview-box" style="aspect-ratio:16/9;background:${cur?cur.bg:'#222'};border-radius:var(--radius);display:flex;flex-direction:column;align-items:center;justify-content:center;color:${cur?cur.textColor:'#fff'};padding:20px;text-align:center;transition:background .5s;position:relative;overflow:hidden">
              ${cur ? `
                <div style="font-size:0.64rem;opacity:0.6;margin-bottom:8px;letter-spacing:2px">${cur.type.toUpperCase()}</div>
                <div style="font-size:1.4rem;font-weight:900;margin-bottom:6px">${cur.title}</div>
                <div style="font-size:0.82rem;opacity:0.85;margin-bottom:10px">${cur.desc}</div>
                ${cur.price ? `<div style="font-size:1.1rem;font-weight:700;background:rgba(255,255,255,0.2);padding:6px 16px;border-radius:20px">${formatCurrency(cur.price)}</div>` : ''}
                <div style="position:absolute;bottom:8px;display:flex;gap:4px">
                  ${activeSl.map((_,i)=>`<div style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,${i===previewSlide%activeSl.length?'1':'0.4'})"></div>`).join('')}
                </div>` : '<div style="opacity:0.4">ไม่มี Slide ที่ Active</div>'}
            </div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-secondary" id="prev-slide-btn" style="flex:1">◀</button>
              <button class="btn btn-secondary" id="next-slide-btn" style="flex:1">▶</button>
            </div>
          </div>

          <!-- Screens -->
          <div>
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📺 จอที่เชื่อมต่อ</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${screens.map(sc => `
                <div class="card" style="padding:12px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-weight:700;font-size:0.84rem">${sc.name}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">${sc.location} · ${sc.resolution}</div>
                    </div>
                    <div style="text-align:right">
                      <span style="font-size:0.64rem;background:${sc.status==='online'?'var(--success)':'var(--danger)'};color:#fff;padding:2px 8px;border-radius:10px">${sc.status==='online'?'● Online':'○ Offline'}</span>
                      ${sc.status==='online'?`<div style="font-size:0.64rem;color:var(--text-muted);margin-top:2px">แสดง: ${slides.find(s=>s.id===sc.currentSlide)?.title||'-'}</div>`:''}
                    </div>
                  </div>
                  ${sc.status==='online'?`<button class="btn btn-xs btn-secondary push-sc-btn" data-id="${sc.id}" style="margin-top:8px;font-size:0.72rem">📡 Push Playlist</button>`:''}
                </div>`).join('')}
            </div>
          </div>
        </div>

        <!-- Slides list -->
        <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🎞 Slides (${slides.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
          ${slides.map((s,i) => slideCard(s,i)).join('')}
        </div>
      </div>`

    document.getElementById('add-slide-btn')?.addEventListener('click', () => openAddModal())
    document.getElementById('push-all-btn')?.addEventListener('click', async () => {
      const onlineScreens = screens.filter(s => s.status === 'online')
      try {
        await Promise.all(onlineScreens.map(s => updateDocData('signage_screens', s.id, { currentSlide: activeSl[0]?.id || s.currentSlide })))
        showToast(`📡 Push Playlist ${activeSl.length} slides ไปยัง ${onlineScreens.length} จอ Online แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('Push ไม่สำเร็จ', 'error') }
    })
    document.getElementById('prev-slide-btn')?.addEventListener('click', () => { previewSlide = Math.max(0, previewSlide-1); render() })
    document.getElementById('next-slide-btn')?.addEventListener('click', () => { previewSlide = (previewSlide+1) % Math.max(activeSl.length,1); render() })
    container.querySelectorAll('.toggle-slide-btn').forEach(b => b.addEventListener('click', async () => {
      const s = slides.find(x => x.id === b.dataset.id)
      if (!s) return
      const active = !s.active
      try {
        await updateDocData('signage_slides', s.id, { active })
        previewSlide = 0
        showToast(`${active?'✅':'⏸'} "${s.title}" แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.del-slide-btn').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบ Slide', message: 'ต้องการลบ Slide นี้หรือไม่?', confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('signage_slides', b.dataset.id)
        previewSlide = 0
        showToast('🗑 ลบ Slide แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.push-sc-btn').forEach(b => b.addEventListener('click', async () => {
      const sc = screens.find(s => s.id === b.dataset.id)
      if (!sc) return
      try {
        await updateDocData('signage_screens', sc.id, { currentSlide: activeSl[0]?.id || sc.currentSlide })
        showToast(`📡 Push Playlist ${activeSl.length} slides ไปยัง ${sc.name} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('Push ไม่สำเร็จ', 'error') }
    }))
  }

  function slideCard(s, i) {
    return `
      <div style="border-radius:var(--radius-sm);overflow:hidden;border:2px solid ${s.active?s.bg:'var(--border)'}">
        <div style="background:${s.bg};color:${s.textColor};padding:12px;aspect-ratio:16/9;display:flex;flex-direction:column;justify-content:center;font-size:0.74rem;text-align:center">
          <div style="font-weight:700">${s.title}</div>
          <div style="font-size:0.66rem;opacity:0.8;margin-top:4px">${s.desc.slice(0,40)}${s.desc.length>40?'...':''}</div>
        </div>
        <div style="background:var(--surface-2);padding:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:0.64rem;color:var(--text-muted)">${s.duration}s · ${s.type}</span>
            <span style="width:7px;height:7px;border-radius:50%;background:${s.active?'var(--success)':'var(--text-muted)'}"></span>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs btn-secondary toggle-slide-btn" data-id="${s.id}" style="flex:1;font-size:0.66rem">${s.active?'⏸':'▶'}</button>
            <button class="btn btn-xs btn-secondary del-slide-btn" data-id="${s.id}" style="font-size:0.66rem;color:var(--danger)">✕</button>
          </div>
        </div>
      </div>`
  }

  function openAddModal() {
    const BG_OPTS = ['#1565C0','#00897B','#FF8F00','#4A148C','#B71C1C','#1B5E20','#212121','#880E4F']
    openModal({
      title: '+ สร้าง Slide ใหม่', size:'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ประเภท</label>
          <select class="input" id="sl-type" style="width:100%;margin-top:4px">
            <option value="promo">Promotion</option><option value="model">Model Showcase</option>
            <option value="service">Service</option><option value="queue">Queue Display</option>
          </select></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">หัวข้อ</label><input class="input" id="sl-title" placeholder="เช่น BYD Seal" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">คำอธิบาย</label><input class="input" id="sl-desc" placeholder="รายละเอียด..." style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">ราคา (ถ้ามี)</label><input class="input" id="sl-price" type="number" placeholder="0" style="width:100%;margin-top:4px"></div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">สีพื้นหลัง</label>
          <div style="display:flex;gap:6px;margin-top:6px">${BG_OPTS.map(c=>`<div class="bg-pick" data-c="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent"></div>`).join('')}</div>
          <input id="sl-bg" type="hidden" value="${BG_OPTS[0]}">
        </div>
        <div><label style="font-size:0.72rem;color:var(--text-muted)">แสดง (วินาที)</label><input class="input" id="sl-dur" type="number" value="8" style="width:80px;margin-top:4px"></div>
      </div>`,
      confirmText: 'สร้าง Slide',
      async onConfirm() {
        const title = document.getElementById('sl-title')?.value.trim()
        if (!title) { showToast('ใส่หัวข้อ Slide', 'warning'); return false }
        try {
          await createDoc('signage_slides', {
            type: document.getElementById('sl-type')?.value||'promo',
            title,
            desc: document.getElementById('sl-desc')?.value||'',
            price: parseFloat(document.getElementById('sl-price')?.value||0),
            bg: document.getElementById('sl-bg')?.value||'#1565C0',
            textColor:'#fff',
            duration: parseInt(document.getElementById('sl-dur')?.value||8),
            active: true
          })
          showToast(`✅ สร้าง Slide "${title}" แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      document.querySelectorAll('.bg-pick').forEach(el => el.addEventListener('click', () => {
        document.querySelectorAll('.bg-pick').forEach(e => e.style.border='3px solid transparent')
        el.style.border='3px solid var(--primary)'
        const inp = document.getElementById('sl-bg'); if (inp) inp.value = el.dataset.c
      }))
    }, 100)
  }

  await loadData()
}
