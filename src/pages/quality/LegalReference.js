/**
 * Legal Reference — คลังกฎหมายที่เกี่ยวข้องกับธุรกิจยานยนต์ และกฎหมายแรงงาน
 * Route: /quality/legal-reference
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const DOMAINS = {
  automotive: { label: 'ธุรกิจยานยนต์', icon: '🚗', color: 'primary' },
  labor:      { label: 'แรงงาน', icon: '👥', color: 'warning' },
}

const CATEGORIES = {
  vehicle_reg:  { label: 'ทะเบียน/พ.ร.บ.รถยนต์', domain: 'automotive', icon: '📋' },
  transport:    { label: 'ขนส่งทางบก', domain: 'automotive', icon: '🚚' },
  consumer:     { label: 'คุ้มครองผู้บริโภค/เช่าซื้อ', domain: 'automotive', icon: '🤝' },
  tax_excise:   { label: 'ภาษีสรรพสามิต/ภาษีรถ', domain: 'automotive', icon: '🧾' },
  insurance:    { label: 'ประกันภัยรถยนต์ (พ.ร.บ.)', domain: 'automotive', icon: '🛡' },
  environment:  { label: 'สิ่งแวดล้อม/มาตรฐานไอเสีย', domain: 'automotive', icon: '🌱' },
  dealer_biz:   { label: 'ธุรกิจตัวแทนจำหน่าย', domain: 'automotive', icon: '🏪' },
  labor_protect:{ label: 'คุ้มครองแรงงาน', domain: 'labor', icon: '⏰' },
  social_sec:   { label: 'ประกันสังคม', domain: 'labor', icon: '💳' },
  compensation: { label: 'เงินทดแทน', domain: 'labor', icon: '🏥' },
  safety_health:{ label: 'ความปลอดภัย/อาชีวอนามัย', domain: 'labor', icon: '⛑' },
  labor_relation:{ label: 'แรงงานสัมพันธ์', domain: 'labor', icon: '⚖️' },
}

export default async function LegalReferencePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let articles = []
  let domainFilter = 'all'
  let catFilter = 'all'
  let search = ''
  let loading = true

  async function loadData() {
    loading = true
    try { articles = await listDocs('legal_references', [], 'title', 'asc', 500) } catch (e) { articles = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = articles.filter(a =>
      (domainFilter === 'all' || a.domain === domainFilter) &&
      (catFilter === 'all' || a.category === catFilter) &&
      (search === '' || a.title.toLowerCase().includes(search) || (a.lawName||'').toLowerCase().includes(search))
    )
    const catOptions = domainFilter === 'all' ? Object.entries(CATEGORIES) : Object.entries(CATEGORIES).filter(([,v]) => v.domain === domainFilter)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚖️ กฎหมายที่เกี่ยวข้อง</div>
            <div class="page-subtitle">คลังอ้างอิงกฎหมายธุรกิจยานยนต์ + กฎหมายแรงงาน สำหรับผู้ประกอบการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-law-btn">+ เพิ่มรายการกฎหมาย</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('⚖️ ทั้งหมด', articles.length, 'primary')}
          ${kpi('🚗 ธุรกิจยานยนต์', articles.filter(a=>a.domain==='automotive').length, 'primary')}
          ${kpi('👥 แรงงาน', articles.filter(a=>a.domain==='labor').length, 'warning')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-input" placeholder="🔍 ค้นหากฎหมาย..." value="${esc(search)}" style="width:220px">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${domainFilter==='all'?'btn-primary':'btn-secondary'} df-btn" data-d="all">ทั้งหมด</button>
            ${Object.entries(DOMAINS).map(([k,v]) => `<button class="btn btn-xs ${domainFilter===k?'btn-'+v.color:'btn-secondary'} df-btn" data-d="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทุกหมวด</button>
          ${catOptions.map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-primary':'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(a => {
            const dm = DOMAINS[a.domain]; const cat = CATEGORIES[a.category]
            return `<div class="card law-card" data-id="${a.id}" style="padding:14px;cursor:pointer;border-left:3px solid var(--${dm?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${esc(a.title)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${esc(a.lawName)}</div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                  <span class="badge badge-${dm?.color}" style="font-size:0.6rem">${dm?.icon} ${dm?.label}</span>
                </div>
              </div>
              <div style="font-size:0.62rem;color:var(--text-muted);background:var(--surface-2);display:inline-block;padding:2px 8px;border-radius:8px;margin-bottom:6px">${cat?.icon} ${cat?.label}</div>
              <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5">${esc(a.summary)}</div>
              <div style="font-size:0.66rem;color:var(--text-muted);margin-top:6px">อัปเดตล่าสุด ${timeAgo(a.updatedAt || a.createdAt)}</div>
            </div>`
          }).join('')}
          ${!list.length ? '<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:0.85rem">🔍 ไม่พบรายการ — ลองคำค้นอื่น</div>' : ''}
        </div>
      </div>
    `

    document.getElementById('search-input')?.addEventListener('input', e => { search = e.target.value.toLowerCase(); render() })
    container.querySelectorAll('.df-btn').forEach(b => b.addEventListener('click', () => { domainFilter = b.dataset.d; catFilter = 'all'; render() }))
    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; render() }))
    document.getElementById('add-law-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.law-card').forEach(c => c.addEventListener('click', () => {
      const a = articles.find(x => x.id === c.dataset.id); if (a) openDetail(a)
    }))
  }

  function openDetail(a) {
    const dm = DOMAINS[a.domain]; const cat = CATEGORIES[a.category]
    openModal({
      title: `${dm?.icon} ${a.title}`,
      size: 'lg',
      body: `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <span class="badge badge-${dm?.color}">${dm?.label}</span>
          <span class="badge badge-secondary">${cat?.icon} ${cat?.label}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px"><strong>อ้างอิง:</strong> ${esc(a.lawName)}</div>
        <div style="font-size:0.85rem;line-height:1.7;margin-bottom:14px">${esc(a.summary)}</div>
        ${(a.keyPoints||[]).length ? `
          <div style="font-size:0.8rem;font-weight:700;margin-bottom:6px">📌 ประเด็นสำคัญที่ต้องปฏิบัติ</div>
          <ul style="margin:0 0 14px 0;padding-left:20px">${a.keyPoints.map(p => `<li style="font-size:0.82rem;line-height:1.7;margin-bottom:3px">${esc(p)}</li>`).join('')}</ul>
        ` : ''}
        ${a.penalty ? `<div style="padding:10px 12px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius-sm);font-size:0.8rem"><strong>⚠️ บทลงโทษ/ผลกระทบหากไม่ปฏิบัติตาม:</strong><br>${esc(a.penalty)}</div>` : ''}
        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:12px">อัปเดตล่าสุด: ${formatDate(a.updatedAt || a.createdAt)}</div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button><button class="btn btn-primary edit-law-btn">✏️ แก้ไข</button>`
    })
    setTimeout(() => {
      document.querySelector('.modal .edit-law-btn')?.addEventListener('click', () => {
        document.querySelector('.modal-overlay')?.remove()
        openAddForm(a)
      })
    }, 50)
  }

  function openAddForm(edit = null) {
    openModal({
      title: edit ? '✏️ แก้ไขรายการกฎหมาย' : '+ เพิ่มรายการกฎหมาย',
      size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="input-group"><label class="input-label">หัวข้อ *</label><input class="input" id="lg-title" value="${esc(edit?.title||'')}" placeholder="เช่น การต่อภาษีรถยนต์ประจำปี"></div>
          <div class="input-group"><label class="input-label">ชื่อกฎหมาย/พ.ร.บ. อ้างอิง</label><input class="input" id="lg-lawname" value="${esc(edit?.lawName||'')}" placeholder="เช่น พ.ร.บ.รถยนต์ พ.ศ. 2522"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="input-group"><label class="input-label">หมวดหมู่</label>
              <select class="input" id="lg-cat">${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}" ${edit?.category===k?'selected':''}>${v.icon} ${v.label} (${DOMAINS[v.domain].label})</option>`).join('')}</select>
            </div>
            <div class="input-group"><label class="input-label">หมวดใหญ่</label>
              <select class="input" id="lg-domain" disabled><option>อัตโนมัติตามหมวดหมู่</option></select>
            </div>
          </div>
          <div class="input-group"><label class="input-label">สรุปใจความสำคัญ *</label><textarea class="input" id="lg-summary" rows="3">${esc(edit?.summary||'')}</textarea></div>
          <div class="input-group"><label class="input-label">ประเด็นสำคัญที่ต้องปฏิบัติ (แยกบรรทัด)</label><textarea class="input" id="lg-points" rows="3">${(edit?.keyPoints||[]).join('\n')}</textarea></div>
          <div class="input-group"><label class="input-label">บทลงโทษ/ผลกระทบหากไม่ปฏิบัติตาม</label><textarea class="input" id="lg-penalty" rows="2">${esc(edit?.penalty||'')}</textarea></div>
        </div>
      `,
      async onConfirm() {
        const title = document.getElementById('lg-title')?.value?.trim()
        const summary = document.getElementById('lg-summary')?.value?.trim()
        if (!title || !summary) { showToast('❗ กรุณากรอกหัวข้อและสรุปใจความสำคัญ', 'error'); return false }
        const category = document.getElementById('lg-cat')?.value || 'dealer_biz'
        const domain = CATEGORIES[category].domain
        const pointsRaw = document.getElementById('lg-points')?.value?.trim() || ''
        const keyPoints = pointsRaw ? pointsRaw.split('\n').map(s => s.trim()).filter(Boolean) : []
        try {
          const payload = {
            title, lawName: document.getElementById('lg-lawname')?.value?.trim() || '',
            category, domain, summary, keyPoints,
            penalty: document.getElementById('lg-penalty')?.value?.trim() || '',
          }
          if (edit) await updateDocData('legal_references', edit.id, payload)
          else await createDoc('legal_references', payload)
          showToast(edit ? '✅ แก้ไขแล้ว' : '✅ เพิ่มรายการกฎหมายแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
