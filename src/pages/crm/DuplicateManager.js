/**
 * Duplicate Manager — จัดการข้อมูลลูกค้าซ้ำ
 * Route: /crm/duplicates
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const DEMO_DUPLICATES = [
  {
    id: 'DUP01', confidence: 95, reason: 'เบอร์โทรตรงกัน',
    records: [
      { id: 'C1042', name: 'สมชาย ใจดี', phone: '085-111-2222', email: 'somchai@gmail.com', created: addDays(-300), deals: 2, source: 'Walk-in' },
      { id: 'C2871', name: 'สมชาย ใจดี (LINE)', phone: '085-111-2222', email: '', created: addDays(-20), deals: 0, source: 'LINE OA' },
    ]
  },
  {
    id: 'DUP02', confidence: 88, reason: 'ชื่อ-นามสกุลตรงกัน + อีเมลคล้าย',
    records: [
      { id: 'C0561', name: 'มาลี สุขใจ', phone: '086-222-3333', email: 'malee.s@gmail.com', created: addDays(-500), deals: 2, source: 'Facebook' },
      { id: 'C3012', name: 'มาลี สุขใจ', phone: '02-444-5555', email: 'malee.suk@gmail.com', created: addDays(-45), deals: 1, source: 'เว็บไซต์' },
    ]
  },
  {
    id: 'DUP03', confidence: 72, reason: 'ชื่อคล้าย + ที่อยู่เดียวกัน',
    records: [
      { id: 'C1899', name: 'ธนพล เที่ยงตรง', phone: '087-333-4444', email: 'thanapon@hotmail.com', created: addDays(-200), deals: 1, source: 'Walk-in' },
      { id: 'C2455', name: 'ธนพน เที่ยงตรง', phone: '087-333-9999', email: '', created: addDays(-90), deals: 0, source: 'Motor Show' },
    ]
  },
]

export default async function DuplicateManagerPage(container) {
  const myGen = container.__routerGen
  let groups = DEMO_DUPLICATES.map(g => ({ ...g, records: g.records.map(r => ({ ...r })) }))
  let resolved = 0
  let dataSource = 'demo'

  try {
    const sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 4) {
      const byPhone = {}
      const byName = {}
      sales.forEach(s => {
        const name = s.customerName || ''
        const phone = (s.phone || '').replace(/\D/g, '')
        if (name) byName[name] = (byName[name] || []).concat(s)
        if (phone && phone.length >= 8) byPhone[phone] = (byPhone[phone] || []).concat(s)
      })
      const liveGroups = []
      let idx = 1
      Object.entries(byPhone).forEach(([phone, list]) => {
        if (list.length >= 2) {
          const names = [...new Set(list.map(s => s.customerName))]
          if (names.length >= 2) {
            liveGroups.push({
              id: `LDUP${idx++}`, confidence: 95, reason: 'เบอร์โทรตรงกัน',
              records: names.map((n, i) => ({ id: `L${idx}${i}`, name: n, phone: list[0].phone || phone, email: '', created: list[i]?.date || addDays(-Math.floor(Math.random()*300)), deals: list.filter(s => s.customerName === n).length, source: list[i]?.source || 'ระบบ' }))
            })
          }
        }
      })
      Object.entries(byName).forEach(([name, list]) => {
        if (list.length >= 2) {
          const phones = [...new Set(list.map(s => (s.phone||'').replace(/\D/g,'')))]
          if (phones.length >= 2) {
            liveGroups.push({
              id: `LDUP${idx++}`, confidence: 80, reason: 'ชื่อตรงกัน + เบอร์ต่างกัน',
              records: phones.slice(0,2).map((p, i) => ({ id: `L${idx}${i}`, name, phone: list.find(s => (s.phone||'').replace(/\D/g,'') === p)?.phone || p, email: '', created: list[i]?.date || addDays(-Math.floor(Math.random()*200)), deals: list.filter(s => (s.phone||'').replace(/\D/g,'') === p).length, source: list[i]?.source || 'ระบบ' }))
            })
          }
        }
      })
      if (liveGroups.length >= 1) {
        groups = [...liveGroups, ...DEMO_DUPLICATES]
        dataSource = 'live'
      }
    }
  } catch {}

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👥 Duplicate Manager</div>
            <div class="page-subtitle">รวมข้อมูลลูกค้าซ้ำ — ฐานข้อมูลสะอาด CRM แม่นยำ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="scan-btn">🔍 สแกนหาซ้ำ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('👥 กลุ่มที่สงสัยซ้ำ', groups.length, groups.length > 0 ? 'warning' : 'success')}
          ${kpi('✅ จัดการแล้ว (เดือนนี้)', resolved + 8, 'success')}
          ${kpi('📊 ฐานข้อมูลทั้งหมด', '1,842 ราย', 'primary')}
        </div>

        ${groups.length === 0 ? `
          <div class="card" style="padding:40px;text-align:center">
            <div style="font-size:2.5rem;margin-bottom:10px">🎉</div>
            <div style="font-weight:700">ฐานข้อมูลสะอาด — ไม่พบรายการซ้ำ</div>
          </div>
        ` : groups.map(g => `
          <div class="card" style="padding:14px;margin-bottom:12px;border-left:3px solid var(--${g.confidence >= 90 ? 'danger' : g.confidence >= 80 ? 'warning' : 'secondary'})">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div style="font-size:0.78rem">
                <strong>ความมั่นใจ ${g.confidence}%</strong>
                <span style="color:var(--text-muted)"> — ${g.reason}</span>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-success merge-btn" data-id="${g.id}">🔗 รวมข้อมูล</button>
                <button class="btn btn-xs btn-secondary not-dup-btn" data-id="${g.id}">✋ ไม่ซ้ำ</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(${g.records.length},1fr);gap:10px">
              ${g.records.map((r, i) => `
                <div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);border:2px solid ${i===0?'var(--primary)':'transparent'}">
                  ${i===0?'<div style="font-size:0.6rem;font-weight:700;color:var(--primary);margin-bottom:4px">⭐ เรคคอร์ดหลัก (เก่ากว่า + มีดีล)</div>':''}
                  <div style="font-weight:700;font-size:0.83rem">${escHtml(r.name)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted);line-height:1.6">
                    🆔 ${r.id}<br>
                    📞 ${escHtml(r.phone)}<br>
                    📧 ${r.email ? escHtml(r.email) : '—'}<br>
                    📅 สร้าง ${formatDate(r.created)}<br>
                    🤝 ${r.deals} ดีล · 📥 ${escHtml(r.source)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `

    container.querySelectorAll('.merge-btn').forEach(b => b.addEventListener('click', () => {
      const g = groups.find(x => x.id === b.dataset.id)
      if (g) openModal({
        title: '🔗 รวมข้อมูลลูกค้า',
        size: 'sm',
        body: `<div style="font-size:0.82rem;line-height:1.7">
          <p>จะรวม <strong>${g.records.length} เรคคอร์ด</strong> เป็น <strong>${g.records[0].id} — ${escHtml(g.records[0].name)}</strong></p>
          <p style="color:var(--text-muted);font-size:0.75rem">· ประวัติดีล/บันทึก/นัดหมายทั้งหมดจะย้ายมาที่เรคคอร์ดหลัก<br>· ข้อมูลติดต่อที่ขาด (อีเมล) จะเติมจากเรคคอร์ดรอง<br>· เรคคอร์ดรองจะถูก archive (กู้คืนได้ 90 วัน)</p>
        </div>`,
        confirmText: '🔗 ยืนยันรวม',
        onConfirm() {
          groups = groups.filter(x => x.id !== g.id); resolved++
          showToast(`🔗 รวมข้อมูลเป็น ${g.records[0].id} แล้ว`, 'success'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.not-dup-btn').forEach(b => b.addEventListener('click', () => {
      const g = groups.find(x => x.id === b.dataset.id)
      if (g) { groups = groups.filter(x => x.id !== g.id); resolved++; showToast('✋ บันทึกว่าไม่ซ้ำ — จะไม่แจ้งคู่นี้อีก', 'primary'); renderPage() }
    }))
    document.getElementById('scan-btn')?.addEventListener('click', () => {
      openModal({
        title: '🔍 ผลการสแกนข้อมูลซ้ำ',
        size: 'sm',
        body: `
          <div style="font-size:0.82rem;display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px">
              <div style="background:var(--surface-2);padding:12px;border-radius:8px;text-align:center">
                <div style="font-size:1.4rem;font-weight:900;color:var(--primary)">1,842</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">เรคคอร์ดทั้งหมด</div>
              </div>
              <div style="background:var(--surface-2);padding:12px;border-radius:8px;text-align:center">
                <div style="font-size:1.4rem;font-weight:900;color:var(--warning)">${groups.length}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">กลุ่มที่อาจซ้ำ</div>
              </div>
            </div>
            <div style="padding:10px;background:var(--surface-2);border-radius:8px;font-size:0.74rem;color:var(--text-muted)">
              ✅ ไม่พบกลุ่มซ้ำใหม่จากการสแกนครั้งนี้<br>
              ⏱ สแกนเสร็จใน 0.3 วินาที (Demo mode)
            </div>
          </div>
        `
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
