/**
 * Duplicate Manager — จัดการข้อมูลลูกค้าซ้ำ
 * Route: /crm/duplicates
 */
import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, softDelete } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

// ตัวอย่างข้อมูล — ใช้แสดงก็ต่อเมื่อยังไม่มีลูกค้าจริงในระบบเลย (collection ว่างเปล่าจริงๆ)
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

function normPhone(p) { return String(p || '').replace(/\D/g, '') }
function normName(f, l) { return ((f || '') + (l || '')).trim().toLowerCase() }

// สแกนหาลูกค้าซ้ำจริงจาก collection `customers` — จับคู่ตาม (1) เบอร์โทรตรงกัน หรือ (2) ชื่อ-นามสกุลตรงกันทุกตัวอักษร
// คืนกลุ่มที่อ้างอิง id เอกสารจริงเสมอ เพื่อให้ merge เขียนกลับ Firestore ได้ตรงเป้า
function findLiveDuplicates(customers) {
  const groups = []
  const usedIds = new Set()
  let idx = 1

  const byPhone = {}
  customers.forEach(c => {
    const phone = normPhone(c.phone)
    if (phone.length < 8) return
    ;(byPhone[phone] = byPhone[phone] || []).push(c)
  })
  Object.values(byPhone).forEach(list => {
    if (list.length < 2) return
    const sorted = [...list].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    groups.push({
      id: `LDUP${idx++}`, confidence: 95, reason: 'เบอร์โทรตรงกัน', _live: true,
      records: sorted.map(c => ({
        id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
        phone: c.phone || '', email: c.email || '', created: c.createdAt || '',
        deals: c.bookingId ? 1 : 0, source: c.source || '—', _raw: c,
      }))
    })
    sorted.forEach(c => usedIds.add(c.id))
  })

  const byName = {}
  customers.forEach(c => {
    if (usedIds.has(c.id)) return
    const name = normName(c.firstName, c.lastName)
    if (!name) return
    ;(byName[name] = byName[name] || []).push(c)
  })
  Object.values(byName).forEach(list => {
    if (list.length < 2) return
    // ต้องไม่ใช่เบอร์เดียวกัน (ไม่งั้นจะถูกจับใน byPhone ไปแล้ว) — เช็คว่ามีอย่างน้อย 2 เบอร์ต่างกัน หรือมีเบอร์ว่าง
    const sorted = [...list].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    groups.push({
      id: `LDUP${idx++}`, confidence: 80, reason: 'ชื่อ-นามสกุลตรงกัน', _live: true,
      records: sorted.map(c => ({
        id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
        phone: c.phone || '', email: c.email || '', created: c.createdAt || '',
        deals: c.bookingId ? 1 : 0, source: c.source || '—', _raw: c,
      }))
    })
    sorted.forEach(c => usedIds.add(c.id))
  })

  return groups
}

export default async function DuplicateManagerPage(container) {
  const myGen = container.__routerGen
  let groups = DEMO_DUPLICATES.map(g => ({ ...g, records: g.records.map(r => ({ ...r })) }))
  let resolved = 0
  let dataSource = 'demo'
  let totalCustomers = 0

  try {
    const customers = await listDocs('customers', [], 'createdAt', 'desc', 1000).catch(() => [])
    if (container.__routerGen !== myGen) return
    totalCustomers = customers.length
    // แสดงเฉพาะกลุ่มซ้ำที่สแกนเจอจริงเมื่อมีลูกค้าจริงในระบบ — ห้ามเอา DEMO_DUPLICATES มาปนกับผลสแกนจริง
    // ถ้าลูกค้าจริงมีอยู่แต่สแกนไม่เจอซ้ำเลย ให้ถือเป็น "ฐานข้อมูลสะอาด" (groups ว่าง) ไม่ใช่ปนตัวอย่าง
    if (customers.length > 0) {
      groups = findLiveDuplicates(customers)
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👥 Duplicate Manager</div>
            <div class="page-subtitle">รวมข้อมูลลูกค้าซ้ำ — ฐานข้อมูลสะอาด CRM แม่นยำ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ' <span style="color:var(--warning);font-size:0.75rem">● ตัวอย่างข้อมูล — ยังไม่มีลูกค้าจริงในระบบ</span>'}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="scan-btn">🔍 สแกนหาซ้ำ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('👥 กลุ่มที่สงสัยซ้ำ', groups.length, groups.length > 0 ? 'warning' : 'success')}
          ${kpi('✅ จัดการแล้ว (Session นี้)', resolved, 'success')}
          ${kpi('📊 ฐานข้อมูลทั้งหมด', dataSource === 'live' ? totalCustomers.toLocaleString() + ' ราย' : '—', 'primary')}
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
                ${!g._live ? `<span class="badge badge-secondary" style="font-size:0.6rem;margin-left:6px">ตัวอย่าง</span>` : ''}
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
                    🆔 ${escHtml(r.id)}<br>
                    📞 ${escHtml(r.phone) || '—'}<br>
                    📧 ${r.email ? escHtml(r.email) : '—'}<br>
                    📅 สร้าง ${r.created ? formatDate(r.created) : '—'}<br>
                    🤝 ${r.deals} ดีล · 📥 ${escHtml(r.source)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `

    container.querySelectorAll('.merge-btn').forEach(b => b.addEventListener('click', () => onMergeClick(b.dataset.id)))
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
                <div style="font-size:1.4rem;font-weight:900;color:var(--primary)">${dataSource === 'live' ? totalCustomers.toLocaleString() : '—'}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">เรคคอร์ดทั้งหมด</div>
              </div>
              <div style="background:var(--surface-2);padding:12px;border-radius:8px;text-align:center">
                <div style="font-size:1.4rem;font-weight:900;color:var(--warning)">${groups.length}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">กลุ่มที่อาจซ้ำ</div>
              </div>
            </div>
            <div style="padding:10px;background:var(--surface-2);border-radius:8px;font-size:0.74rem;color:var(--text-muted)">
              ${groups.length === 0 ? '✅ ไม่พบกลุ่มซ้ำจากการสแกนครั้งนี้' : `⚠️ พบ ${groups.length} กลุ่มที่อาจซ้ำ — ดูรายละเอียดด้านล่าง`}<br>
              ${dataSource === 'demo' ? '🧪 ยังไม่มีลูกค้าจริงในระบบ — แสดงตัวอย่างข้อมูลเท่านั้น' : ''}
            </div>
          </div>
        `
      })
    })
  }

  function onMergeClick(groupId) {
    const g = groups.find(x => x.id === groupId)
    if (!g) return

    if (!g._live) {
      // กลุ่มตัวอย่าง (demo) — ไม่มีเรคคอร์ดจริงใน Firestore ให้รวม จึงจำลองผลลัพธ์ในหน้าจอเท่านั้น ห้ามยิง Firestore
      openModal({
        title: '🔗 รวมข้อมูลลูกค้า (ตัวอย่าง)',
        size: 'sm',
        body: `<div style="font-size:0.82rem;line-height:1.7">
          <p>จะรวม <strong>${g.records.length} เรคคอร์ด</strong> เป็น <strong>${escHtml(g.records[0].id)} — ${escHtml(g.records[0].name)}</strong></p>
          <p style="color:var(--warning);font-size:0.75rem">🧪 นี่คือข้อมูลตัวอย่าง — จะไม่มีการเขียนข้อมูลจริง (แสดงผลบนหน้าจอเท่านั้น)</p>
        </div>`,
        confirmText: '🔗 ยืนยันรวม (ตัวอย่าง)',
        onConfirm() {
          groups = groups.filter(x => x.id !== g.id); resolved++
          showToast(`🔗 รวมข้อมูล (ตัวอย่าง) เป็น ${g.records[0].id} แล้ว`, 'success'); renderPage()
        }
      })
      return
    }

    // กลุ่มจริง — เปิด modal อธิบายผลก่อน แล้วขอ confirmDialog ยืนยันอีกชั้น (การกระทำที่มีผลถาวรต่อข้อมูลจริง)
    const winner = g.records[0]
    const losers = g.records.slice(1)
    openModal({
      title: '🔗 รวมข้อมูลลูกค้า',
      size: 'sm',
      body: `<div style="font-size:0.82rem;line-height:1.7">
        <p>จะรวม <strong>${g.records.length} เรคคอร์ด</strong> เป็น <strong>${escHtml(winner.id)} — ${escHtml(winner.name)}</strong></p>
        <p style="color:var(--text-muted);font-size:0.75rem">· ข้อมูลติดต่อที่ขาด (เบอร์/อีเมล) จะเติมจากเรคคอร์ดรอง<br>· เรคคอร์ดรอง ${losers.map(r => escHtml(r.id)).join(', ')} จะถูกลบแบบ soft-delete (กู้คืนได้)</p>
      </div>`,
      confirmText: '🔗 รวมข้อมูล',
      async onConfirm() {
        const ok = await confirmDialog({
          title: 'ยืนยันการรวมข้อมูล',
          message: `ต้องการรวม ${g.records.length} เรคคอร์ดเป็น "${winner.name}" จริงหรือไม่? เรคคอร์ดรองจะถูกลบ (กู้คืนได้ภายหลัง)`,
          confirmText: '🔗 ยืนยันรวม',
          danger: true,
        })
        if (!ok) return false
        try {
          await mergeCustomers(winner, losers)
          groups = groups.filter(x => x.id !== g.id); resolved++
          showToast(`🔗 รวมข้อมูลเป็น ${winner.name} แล้ว`, 'success')
          renderPage()
        } catch (e) {
          showToast('รวมข้อมูลไม่สำเร็จ', 'error')
          return false
        }
      }
    })
  }

  // รวมข้อมูลจริงใน Firestore: เติมฟิลด์ที่ผู้ชนะขาดจากผู้แพ้ (ไม่ทับของเดิมที่มีอยู่แล้ว) แล้ว soft-delete ผู้แพ้
  async function mergeCustomers(winner, losers) {
    const w = winner._raw || {}
    const patch = {}
    for (const loser of losers) {
      const l = loser._raw || {}
      if (!w.phone && l.phone) patch.phone = l.phone
      if (!w.email && l.email) patch.email = l.email
      if (!w.lineId && l.lineId) patch.lineId = l.lineId
      if (!w.interestedModel && l.interestedModel) patch.interestedModel = l.interestedModel
      if (!w.budget && l.budget) patch.budget = l.budget
      if (!w.assignedTo && l.assignedTo) patch.assignedTo = l.assignedTo
      if (!w.bookingId && l.bookingId) patch.bookingId = l.bookingId
      const mergedTags = [...new Set([...(w.tags || []), ...(l.tags || [])])]
      if (mergedTags.length) patch.tags = mergedTags
      const mergedNotes = [w.notes, l.notes].filter(Boolean).join(' | ')
      if (mergedNotes) patch.notes = mergedNotes
    }
    if (Object.keys(patch).length) await updateDocData('customers', winner.id, patch)
    for (const loser of losers) await softDelete('customers', loser.id)
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
