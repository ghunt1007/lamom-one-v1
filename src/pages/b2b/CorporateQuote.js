/**
 * Corporate Quote — ใบเสนอราคา B2B
 * Route: /b2b/quotes
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const QUOTE_STATUS = {
  draft:    { label: 'ร่าง', color: 'secondary' },
  sent:     { label: 'ส่งแล้ว', color: 'primary' },
  reviewed: { label: 'อยู่ระหว่างพิจารณา', color: 'warning' },
  won:      { label: 'ได้งาน', color: 'success' },
  lost:     { label: 'เสียงาน', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function calcTotal(q) {
  const gross = q.qty * q.unitPrice
  const discountAmt = gross * q.discount / 100
  return gross - discountAmt
}

export default async function CorporateQuotePage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let quotes = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { quotes = await listDocs('corporate_quotes', [], 'createDate', 'desc', 200) } catch (e) { quotes = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = quotes.filter(q => statusFilter === 'all' || q.status === statusFilter)
    const totalValue = quotes.filter(q => q.status !== 'lost').reduce((a, q) => a + calcTotal(q), 0)
    const wonValue = quotes.filter(q => q.status === 'won').reduce((a, q) => a + calcTotal(q), 0)
    const wonRate = Math.round(quotes.filter(q => q.status === 'won').length / quotes.filter(q => ['won','lost'].includes(q.status)).length * 100) || 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📄 Corporate Quotes</div>
            <div class="page-subtitle">ใบเสนอราคา B2B — Fleet & Corporate</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="create-quote-btn">+ สร้าง Quote</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📄 Quote ทั้งหมด', quotes.length, 'primary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'primary')}
          ${kpi('✅ ได้งานรวม', formatCurrency(wonValue), 'success')}
          ${kpi('🎯 Win Rate', wonRate + '%', wonRate >= 50 ? 'success' : 'warning')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(QUOTE_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">บริษัท</th>
                <th style="padding:10px 10px;text-align:center">รุ่น/จำนวน</th>
                <th style="padding:10px 10px;text-align:right">ส่วนลด</th>
                <th style="padding:10px 10px;text-align:right">มูลค่ารวม</th>
                <th style="padding:10px 14px;text-align:center">สถานะ</th>
                <th style="padding:10px 14px;text-align:center">หมดอายุ</th>
                <th style="padding:10px 14px;text-align:center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(q => {
                const st = QUOTE_STATUS[q.status]
                const total = calcTotal(q)
                const expired = new Date(q.validUntil) < new Date()
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 14px">
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(q.company)}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${q.id} · ${escHtml(q.contact)}</div>
                  </td>
                  <td style="padding:10px 10px;text-align:center;font-size:0.8rem">🚗 ${q.model}<br><span style="font-size:0.72rem">${q.qty} คัน</span></td>
                  <td style="padding:10px 10px;text-align:right;font-size:0.82rem;color:var(--danger)">${q.discount > 0 ? '-' + q.discount + '%' : '-'}</td>
                  <td style="padding:10px 10px;text-align:right;font-weight:700;font-size:0.85rem;color:var(--success)">${formatCurrency(total)}</td>
                  <td style="padding:10px 14px;text-align:center"><span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span></td>
                  <td style="padding:10px 14px;text-align:center;font-size:0.75rem;color:${expired?'var(--danger)':'var(--text-muted)'}">${formatDate(q.validUntil)}${expired?' ⚠️':''}</td>
                  <td style="padding:10px 14px;text-align:center">
                    <div style="display:flex;gap:4px;justify-content:center">
                      <button class="btn btn-xs btn-secondary view-btn" data-id="${q.id}">ดู</button>
                      ${q.status === 'draft' ? `<button class="btn btn-xs btn-primary send-btn" data-id="${q.id}">ส่ง</button>` : ''}
                      ${q.status === 'sent' || q.status === 'reviewed' ? `<button class="btn btn-xs btn-success won-btn" data-id="${q.id}">ได้</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('create-quote-btn')?.addEventListener('click', openCreateForm)
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const q = quotes.find(x => x.id === b.dataset.id); if (q) openDetail(q)
    }))
    container.querySelectorAll('.send-btn').forEach(b => b.addEventListener('click', async () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      if (!q) return
      try {
        await updateDocData('corporate_quotes', q.id, { status: 'sent' })
        showToast(`📤 ส่ง Quote ${q.id} ถึง ${q.company} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.won-btn').forEach(b => b.addEventListener('click', async () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      if (!q) return
      try {
        await updateDocData('corporate_quotes', q.id, { status: 'won' })
        showToast(`🎉 ได้งาน ${q.company}! ${formatCurrency(calcTotal(q))}`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openDetail(q) {
    const st = QUOTE_STATUS[q.status]
    const total = calcTotal(q)
    openModal({
      title: `📄 ${q.id} — ${escHtml(q.company)}`,
      size: 'sm',
      body: `
        <span class="badge badge-${st?.color}" style="margin-bottom:12px">${st?.label}</span>
        ${row('ผู้ติดต่อ', escHtml(q.contact))}
        ${row('รุ่นรถ', '🚗 ' + q.model)}
        ${row('จำนวน', q.qty + ' คัน')}
        ${row('ราคาต่อคัน', formatCurrency(q.unitPrice))}
        ${row('ส่วนลด', q.discount + '%')}
        ${row('มูลค่ารวม', `<strong style="color:var(--success)">${formatCurrency(total)}</strong>`)}
        ${row('หมดอายุ', formatDate(q.validUntil))}
      `
    })
  }

  function openCreateForm() {
    openModal({
      title: '+ สร้าง Corporate Quote',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">บริษัท *</label><input class="input" id="cq-company"></div>
          <div class="input-group"><label class="input-label">ผู้ติดต่อ *</label><input class="input" id="cq-contact"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="cq-model" value="BYD Atto 3"></div>
          <div class="input-group"><label class="input-label">จำนวน (คัน)</label><input type="number" class="input" id="cq-qty" value="5"></div>
          <div class="input-group"><label class="input-label">ราคาต่อคัน (บาท)</label><input type="number" class="input" id="cq-price" value="1050000"></div>
          <div class="input-group"><label class="input-label">ส่วนลด (%)</label><input type="number" class="input" id="cq-disc" value="5" min="0" max="30"></div>
          <div class="input-group"><label class="input-label">วันหมดอายุ</label><input type="date" class="input" id="cq-valid" value="${addDays(30)}"></div>
        </div>
      `,
      async onConfirm() {
        const company = document.getElementById('cq-company')?.value?.trim()
        const contact = document.getElementById('cq-contact')?.value?.trim()
        if (!company || !contact) { showToast('❗ กรุณากรอกข้อมูล', 'error'); return false }
        try {
          await createDoc('corporate_quotes', {
            company, contact,
            model: document.getElementById('cq-model')?.value || 'BYD Atto 3',
            qty: +document.getElementById('cq-qty')?.value || 5,
            unitPrice: +document.getElementById('cq-price')?.value || 1000000,
            discount: +document.getElementById('cq-disc')?.value || 0,
            status: 'draft', createDate: new Date().toISOString(),
            validUntil: document.getElementById('cq-valid')?.value || addDays(30)
          })
          showToast('✅ สร้าง Quote แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
