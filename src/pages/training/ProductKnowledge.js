/**
 * Product Knowledge DB — ฐานข้อมูลความรู้รถ Spec / จุดขาย / คู่แข่ง
 * Route: /training/product-knowledge
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

export default async function ProductKnowledgePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let PRODUCTS = []
  let filterBrand = 'all'
  let selectedId  = null
  let loading = true

  async function loadData() {
    loading = true
    try { PRODUCTS = await listDocs('product_knowledge', [], 'model', 'asc', 500) } catch (e) { PRODUCTS = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function masteredColor(pct) {
    return pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)'
  }

  function pkCard(p) {
    const pctColor = masteredColor(p.mastered)
    const badge = '<span style="font-size:0.62rem;background:' + (p.badge==='NEW'?'var(--warning)':'var(--success)') + ';color:' + (p.badge==='NEW'?'#000':'#fff') + ';padding:1px 7px;border-radius:8px">' + p.badge + '</span>'
    const isSelected = p.id === selectedId
    return '<div class="card pk-card" data-id="' + p.id + '" style="padding:14px;cursor:pointer;border:2px solid ' + (isSelected?'var(--primary)':'transparent') + '">' +
      '<div style="display:flex;align-items:flex-start;gap:10px">' +
        '<div style="font-size:1.6rem">🚗</div>' +
        '<div style="flex:1">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
            '<span style="font-weight:700;font-size:0.86rem">' + p.brand + ' ' + p.model + '</span>' +
            badge +
          '</div>' +
          '<div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:8px">ปี ' + p.year + ' · ฿' + p.specs.price + '</div>' +
          '<div style="margin-bottom:4px">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-bottom:3px">' +
              '<span style="color:var(--text-muted)">Mastered by Staff</span>' +
              '<span style="color:' + pctColor + ';font-weight:700">' + p.mastered + '%</span>' +
            '</div>' +
            '<div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">' +
              '<div style="height:100%;width:' + p.mastered + '%;background:' + pctColor + ';border-radius:3px;transition:width .4s"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  }

  function renderDetail(p) {
    const specsRows = Object.entries(p.specs).map(([k,v])=>{
      const label = {battery:'แบตเตอรี่',range:'พิสัย',power:'กำลัง',torque:'แรงบิด',charge:'ชาร์จ DC',price:'ราคา'}[k]||k
      return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
        '<td style="padding:5px 8px;color:var(--text-muted);font-size:0.72rem">' + label + '</td>' +
        '<td style="padding:5px 8px;font-weight:700;font-size:0.74rem">' + v + (k==='price'?'฿':'') + '</td>' +
      '</tr>'
    }).join('')

    const points = p.selling.map(s=>'<li style="font-size:0.74rem;margin-bottom:4px">✅ '+s+'</li>').join('')

    const competitors = p.competitors.map(c=>{
      return '<div style="background:var(--surface-2);border-radius:6px;padding:8px;margin-bottom:6px;font-size:0.74rem">' +
        '<div style="font-weight:700;margin-bottom:4px">⚔️ ' + c.name + '</div>' +
        '<div style="color:var(--success);font-size:0.68rem">👍 เหนือกว่าเรา: ' + c.pro + '</div>' +
        '<div style="color:var(--danger);font-size:0.68rem;margin-top:2px">👎 ด้อยกว่าเรา: ' + c.con + '</div>' +
      '</div>'
    }).join('')

    return '<div class="card" style="padding:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<div style="font-weight:700;font-size:0.9rem">📋 ' + p.brand + ' ' + p.model + '</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn btn-xs btn-primary" id="quiz-btn-' + p.id + '" style="font-size:0.7rem">🎯 ทำ Quiz</button>' +
          '<button class="btn btn-xs btn-secondary" id="edit-btn-' + p.id + '" style="font-size:0.7rem">✏️ แก้ไข</button>' +
          '<button class="btn btn-xs btn-danger" id="del-btn-' + p.id + '" style="font-size:0.7rem">🗑 ลบ</button>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:0.76rem;font-weight:700;margin-bottom:6px;color:var(--text-muted)">SPEC</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">' + specsRows + '</table>' +
      '<div style="font-size:0.76rem;font-weight:700;margin-bottom:6px;color:var(--text-muted)">จุดขาย</div>' +
      '<ul style="list-style:none;padding:0;margin:0 0 12px 0">' + points + '</ul>' +
      '<div style="font-size:0.76rem;font-weight:700;margin-bottom:6px;color:var(--text-muted)">คู่แข่ง</div>' +
      competitors +
    '</div>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    let rows = filterBrand === 'all' ? PRODUCTS : PRODUCTS.filter(p=>p.brand===filterBrand)
    const brands = [...new Set(PRODUCTS.map(p=>p.brand))]
    const avgMastered = Math.round(PRODUCTS.reduce((s,p)=>s+p.mastered,0)/PRODUCTS.length)
    const highCount = PRODUCTS.filter(p=>p.mastered>=80).length
    const lowCount  = PRODUCTS.filter(p=>p.mastered<60).length

    const brandBtns = ['all',...brands].map(b=>{
      const lbl = b==='all'?'ทั้งหมด':b
      return '<button class="btn btn-xs ' + (filterBrand===b?'btn-primary':'btn-secondary') + ' brand-btn" data-b="' + b + '">' + lbl + '</button>'
    }).join('')

    const detailPanel = selectedId ? renderDetail(PRODUCTS.find(p=>p.id===selectedId)||PRODUCTS[0]) : '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem">👈</div><div style="font-size:0.82rem;margin-top:8px">เลือกรุ่นรถเพื่อดูรายละเอียด</div></div>'

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📚 Product Knowledge DB</div>
            <div class="page-subtitle">ฐานข้อมูลความรู้รถ · ${PRODUCTS.length} รุ่น</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-prod-btn">+ เพิ่มรุ่น</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📚 รุ่นรถทั้งหมด', PRODUCTS.length+' รุ่น', 'var(--primary)')}
          ${sc('🏆 Avg Mastered', avgMastered+'%', masteredColor(avgMastered))}
          ${sc('✅ Mastered ≥80%', highCount+' รุ่น', 'var(--success)')}
          ${sc('⚠️ ต้องฝึกเพิ่ม', lowCount+' รุ่น', 'var(--danger)')}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:14px">${brandBtns}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="display:flex;flex-direction:column;gap:8px">
            ${rows.map(p=>pkCard(p)).join('')}
          </div>
          <div>${detailPanel}</div>
        </div>
      </div>`

    container.querySelectorAll('.brand-btn').forEach(b=>b.addEventListener('click',()=>{filterBrand=b.dataset.b;render()}))
    container.querySelectorAll('.pk-card').forEach(c=>c.addEventListener('click',()=>{selectedId=c.dataset.id;render()}))
    document.getElementById('add-prod-btn')?.addEventListener('click', openAddProductModal)
    PRODUCTS.forEach(p=>{
      document.getElementById('quiz-btn-'+p.id)?.addEventListener('click',()=>openQuizModal(p))
      document.getElementById('edit-btn-'+p.id)?.addEventListener('click',()=>openEditProductModal(p))
      document.getElementById('del-btn-'+p.id)?.addEventListener('click', async ()=>{
        const ok = await confirmDialog({ title: '🗑 ลบรุ่นรถ', message: `ต้องการลบ "${p.brand} ${p.model}" ออกจาก Knowledge DB ใช่หรือไม่?`, confirmText: 'ลบ', danger: true })
        if (!ok) return
        try {
          await softDelete('product_knowledge', p.id)
          showToast('🗑 ลบ ' + p.brand + ' ' + p.model + ' แล้ว', 'success')
          if (selectedId === p.id) selectedId = null
          await loadData()
        } catch (e) { showToast('ลบไม่สำเร็จ', 'error') }
      })
    })
  }

  function openQuizModal(p) {
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
    const wrong3 = (correct, pool) => shuffle(pool.filter(x => x !== correct)).slice(0, 3)

    const rangePool  = ['280 km','340 km','420 km','460 km','520 km','605 km']
    const battPool   = ['38.5 kWh','44.9 kWh','60.5 kWh','82.5 kWh','100 kWh']
    const pricePool  = ['799,900','999,900','1,199,900','1,299,900','1,999,900','2,599,900']

    const questions = [
      {
        q: `${p.brand} ${p.model} มีระยะทางวิ่งสูงสุดเท่าไหร่?`,
        opts: shuffle([p.specs.range, ...wrong3(p.specs.range, rangePool)]),
        ans: p.specs.range,
      },
      {
        q: `ความจุแบตเตอรี่ของ ${p.brand} ${p.model} คือเท่าไหร่?`,
        opts: shuffle([p.specs.battery, ...wrong3(p.specs.battery, battPool)]),
        ans: p.specs.battery,
      },
      {
        q: `ราคาเริ่มต้นของ ${p.brand} ${p.model} คือ?`,
        opts: shuffle([p.specs.price + '฿', ...wrong3(p.specs.price, pricePool).map(x => x + '฿')]),
        ans: p.specs.price + '฿',
      },
      {
        q: `ข้อใดคือจุดขายของ ${p.brand} ${p.model}?`,
        opts: shuffle([
          p.selling[0],
          ...PRODUCTS.filter(x => x.id !== p.id).slice(0, 3).map(x => x.selling[0])
        ]).slice(0, 4),
        ans: p.selling[0],
      },
    ]

    let idx = 0
    let score = 0
    let answered = false

    function renderQ() {
      const q = questions[idx]
      const optHtml = q.opts.map((opt, i) =>
        `<button class="btn btn-secondary qz-opt" data-opt="${i}" style="text-align:left;padding:10px 14px;font-size:0.82rem;width:100%">${String.fromCharCode(65+i)}. ${opt}</button>`
      ).join('')
      return `
        <div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:10px">ข้อ ${idx+1}/${questions.length} · คะแนน ${score}</div>
        <div style="font-weight:700;font-size:0.88rem;line-height:1.5;margin-bottom:14px">${q.q}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${optHtml}</div>
      `
    }

    openModal({
      title: `🎯 Quiz — ${p.brand} ${p.model}`,
      size: 'sm',
      body: `<div id="qz-body">${renderQ()}</div>`
    })

    function attachHandlers() {
      document.querySelectorAll('.qz-opt').forEach(btn => btn.addEventListener('click', () => {
        if (answered) return
        answered = true
        const chosen = btn.dataset.opt
        const correct = questions[idx].ans
        const isCorrect = questions[idx].opts[parseInt(chosen)] === correct
        if (isCorrect) {
          score++
          btn.style.background = 'var(--success)'
          btn.style.color = '#fff'
          showToast('✅ ถูกต้อง!', 'success')
        } else {
          btn.style.background = 'var(--danger)'
          btn.style.color = '#fff'
          document.querySelectorAll('.qz-opt').forEach(b => {
            if (questions[idx].opts[parseInt(b.dataset.opt)] === correct) {
              b.style.background = 'var(--success)'; b.style.color = '#fff'
            }
          })
          showToast('❌ ไม่ถูก — ' + correct, 'warning')
        }

        setTimeout(() => {
          idx++
          answered = false
          const body = document.getElementById('qz-body')
          if (!body) return
          if (idx < questions.length) {
            body.innerHTML = renderQ()
            attachHandlers()
          } else {
            const pct = Math.round(score / questions.length * 100)
            const grade = pct === 100 ? '🏆 เยี่ยม!' : pct >= 75 ? '👍 ดีมาก' : pct >= 50 ? '📚 ต้องฝึกเพิ่ม' : '⚠️ ต้องทบทวน'
            body.innerHTML = `
              <div style="text-align:center;padding:20px 0">
                <div style="font-size:2.5rem;margin-bottom:10px">${grade.split(' ')[0]}</div>
                <div style="font-size:1.2rem;font-weight:700;margin-bottom:4px">คะแนน ${score}/${questions.length}</div>
                <div style="font-size:0.84rem;color:var(--text-muted);margin-bottom:16px">${grade.split(' ').slice(1).join(' ')} (${pct}%)</div>
                <div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden;margin-bottom:16px">
                  <div style="height:100%;width:${pct}%;background:${pct>=75?'var(--success)':'var(--warning)'};transition:width .5s"></div>
                </div>
              </div>
            `
            const newMastered = Math.min(100, Math.round((p.mastered + pct) / 2))
            updateDocData('product_knowledge', p.id, { mastered: newMastered }).then(loadData).catch(() => showToast('บันทึกไม่สำเร็จ', 'error'))
            showToast(`🎯 Quiz เสร็จ! ${score}/${questions.length} คะแนน`, pct >= 75 ? 'success' : 'warning')
          }
        }, 900)
      }))
    }

    setTimeout(attachHandlers, 50)
  }

  function openAddProductModal() {
    openModal({
      title: '📚 เพิ่มรุ่นรถใหม่ใน Knowledge DB',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แบรนด์ *</label>
              <input id="pk-brand" class="input" placeholder="BYD / MG / Tesla..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่น *</label>
              <input id="pk-model" class="input" placeholder="Seal AWD / Han..."></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ปีรุ่น</label>
              <input id="pk-year" type="number" class="input" value="2025"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Badge</label>
              <select id="pk-badge" class="input"><option value="EV">EV</option><option value="NEW">NEW</option><option value="PHEV">PHEV</option></select></div>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.76rem;font-weight:700">Specs</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แบตเตอรี่</label><input id="pk-bat" class="input" placeholder="82.5 kWh"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">พิสัย</label><input id="pk-range" class="input" placeholder="520 km"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">กำลัง</label><input id="pk-power" class="input" placeholder="204 hp"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาเริ่มต้น (฿)</label><input id="pk-price" class="input" placeholder="1,199,900"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">จุดขายหลัก (แยกบรรทัด)</label>
            <textarea id="pk-selling" class="input" rows="2" placeholder="ระบบ Blade Battery ปลอดภัยสูง&#10;การันตีแบต 8 ปี..."></textarea></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="pk-save">💾 เพิ่มรุ่น</button>
        </div>
      `
    })
    document.getElementById('pk-save')?.addEventListener('click', async () => {
      const brand = document.getElementById('pk-brand')?.value.trim()
      const model = document.getElementById('pk-model')?.value.trim()
      if (!brand || !model) { showToast('⚠️ กรุณากรอกแบรนด์และรุ่น', 'warning'); return }
      const sellingRaw = document.getElementById('pk-selling')?.value.trim()
      try {
        await createDoc('product_knowledge', {
          brand, model,
          badge: document.getElementById('pk-badge')?.value || 'EV',
          year: parseInt(document.getElementById('pk-year')?.value) || 2025,
          mastered: 0,
          staffTotal: 12,
          specs: {
            battery: document.getElementById('pk-bat')?.value.trim() || '-',
            range:   document.getElementById('pk-range')?.value.trim() || '-',
            power:   document.getElementById('pk-power')?.value.trim() || '-',
            torque: '-', charge: '-',
            price:   document.getElementById('pk-price')?.value.trim() || '0',
          },
          selling: sellingRaw ? sellingRaw.split('\n').filter(Boolean) : [],
          competitors: [],
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ เพิ่ม ' + brand + ' ' + model + ' แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openEditProductModal(p) {
    openModal({
      title: '✏️ แก้ไข ' + p.brand + ' ' + p.model,
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แบรนด์ *</label>
              <input id="pke-brand" class="input" value="${escHtml(p.brand)}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">รุ่น *</label>
              <input id="pke-model" class="input" value="${escHtml(p.model)}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ปีรุ่น</label>
              <input id="pke-year" type="number" class="input" value="${p.year}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Badge</label>
              <select id="pke-badge" class="input">
                <option value="EV" ${p.badge==='EV'?'selected':''}>EV</option>
                <option value="NEW" ${p.badge==='NEW'?'selected':''}>NEW</option>
                <option value="PHEV" ${p.badge==='PHEV'?'selected':''}>PHEV</option>
              </select></div>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.76rem;font-weight:700">Specs</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แบตเตอรี่</label><input id="pke-bat" class="input" value="${escHtml(p.specs.battery)}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">พิสัย</label><input id="pke-range" class="input" value="${escHtml(p.specs.range)}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">กำลัง</label><input id="pke-power" class="input" value="${escHtml(p.specs.power)}"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาเริ่มต้น (฿)</label><input id="pke-price" class="input" value="${escHtml(p.specs.price)}"></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">จุดขายหลัก (แยกบรรทัด)</label>
            <textarea id="pke-selling" class="input" rows="3">${escHtml((p.selling||[]).join('\n'))}</textarea></div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="pke-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('pke-save')?.addEventListener('click', async () => {
      const brand = document.getElementById('pke-brand')?.value.trim()
      const model = document.getElementById('pke-model')?.value.trim()
      if (!brand || !model) { showToast('⚠️ กรุณากรอกแบรนด์และรุ่น', 'warning'); return }
      const sellingRaw = document.getElementById('pke-selling')?.value.trim()
      try {
        await updateDocData('product_knowledge', p.id, {
          brand, model,
          badge: document.getElementById('pke-badge')?.value || p.badge,
          year: parseInt(document.getElementById('pke-year')?.value) || p.year,
          specs: {
            ...p.specs,
            battery: document.getElementById('pke-bat')?.value.trim() || p.specs.battery,
            range:   document.getElementById('pke-range')?.value.trim() || p.specs.range,
            power:   document.getElementById('pke-power')?.value.trim() || p.specs.power,
            price:   document.getElementById('pke-price')?.value.trim() || p.specs.price,
          },
          selling: sellingRaw ? sellingRaw.split('\n').filter(Boolean) : p.selling,
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ บันทึกการแก้ไขแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l,v,c) {
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
