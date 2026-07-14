/**
 * Bank Finance Partners — รายชื่อธนาคาร / โปรสินเชื่อ / Approval Rate (scorecard ความสัมพันธ์กับธนาคาร)
 * Route: /finance/bank-partners
 *
 * ต่างจาก Finance Application (ที่ยื่น/ติดตามใบสมัครสินเชื่อรายลูกค้า) — หน้านี้คือมุมมอง
 * "ความสัมพันธ์กับธนาคารพันธมิตรแต่ละแห่ง" (ดอกเบี้ย/วงเงิน/Approval rate/ผู้ติดต่อ) ซึ่ง
 * Finance Application ไม่มี จึงเก็บไว้เป็นฟีเจอร์จริงแยกต่างหาก
 * เดิมหน้านี้มี BANKS + RECENT_APPS hardcoded (เลขปลอมที่ไม่มีวันตรงกับข้อมูลจริง) แก้ให้:
 *  - รายชื่อธนาคาร ดึงจาก getBanks() (master data จริง — เหมือน FinanceApplication.js ใช้)
 *  - ข้อมูลความสัมพันธ์ (ดอกเบี้ย/วงเงิน/Approval/ผู้ติดต่อ) เก็บใน Firestore 'bank_partner_info'
 *    แก้ไขได้จริงในหน้านี้ (CRUD จริง มี confirm ก่อนลบ)
 *  - ใบสมัครล่าสุด ดึงจาก 'finance_applications' จริง (ข้อมูลเดียวกับหน้า Finance Application)
 *  - ปุ่ม "ยื่น" พาไปหน้า Finance Application จริง (ไม่ทำซ้ำ logic การยื่นสินเชื่อ)
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { getBanks } from '../../data/masterData.js'
import { navigate } from '../../core/router.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const APP_STATUS_LABEL = {
  draft: 'Draft', submitted: 'ส่งแล้ว', pending: 'รอ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ', cancelled: 'ยกเลิก',
}
const APP_STATUS_COLOR = {
  draft:'var(--text-muted)', submitted:'var(--primary)', pending:'var(--warning)', approved:'var(--success)', rejected:'var(--danger)', cancelled:'var(--danger)',
}

export default async function BankPartnersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let selBank = null
  let partnerInfo = []   // bank_partner_info docs จริง
  let recentApps = []    // finance_applications จริง
  let loading = true

  async function loadData() {
    loading = true
    try {
      partnerInfo = await listDocs('bank_partner_info', [], 'bankName', 'asc', 200)
      recentApps = await listDocs('finance_applications', [], 'submittedDate', 'desc', 8)
    } catch (e) { partnerInfo = []; recentApps = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function infoFor(bankName) { return partnerInfo.find(p => p.bankName === bankName) || null }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const bankNames = getBanks()
    const sel = selBank ? infoFor(selBank) : null
    const configured = partnerInfo.filter(p => bankNames.includes(p.bankName))
    const totalQuota = configured.reduce((s,b)=>s+(b.quota||0),0)
    const totalUsed  = configured.reduce((s,b)=>s+(b.used||0),0)
    const avgApproval= configured.length ? Math.round(configured.reduce((s,b)=>s+(b.approval||0),0)/configured.length) : 0
    const rated = configured.filter(b => b.rate > 0)
    const bestRate = rated.length ? rated.reduce((a,b)=>a.rate<b.rate?a:b) : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Bank Finance Partners</div>
            <div class="page-subtitle">พันธมิตรธนาคาร ${bankNames.length} แห่ง · ${configured.length} แห่งตั้งค่าข้อมูลแล้ว${totalQuota ? ' · วงเงินรวม ' + totalQuota + ' ล้าน' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="compare-btn" ${rated.length < 2 ? 'disabled title="ต้องมีอย่างน้อย 2 ธนาคารที่ตั้งค่าดอกเบี้ยแล้ว"' : ''}>⚖️ เปรียบเทียบดอกเบี้ย</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🏦 ธนาคาร', bankNames.length+' แห่ง', 'var(--primary)')}
          ${sc('✅ Approval avg.', configured.length ? avgApproval+'%' : '—', 'var(--success)')}
          ${sc('💳 วงเงินใช้ไป', totalQuota ? totalUsed+'/'+totalQuota+' M' : '—', 'var(--warning)')}
          ${sc('💸 Rate ต่ำสุด', bestRate ? bestRate.rate+'%' : '—', 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:${sel?'1fr 300px':'1fr'};gap:16px">
          <!-- Bank cards -->
          <div style="display:flex;flex-direction:column;gap:8px">
            ${bankNames.map(name => {
              const b = infoFor(name)
              const quotaPct = b && b.quota ? Math.round((b.used||0)/b.quota*100) : 0
              return `
              <div class="card bank-card" data-name="${escHtml(name)}" style="padding:14px;cursor:pointer;border:2px solid ${selBank===name?'var(--primary)':'transparent'};transition:border .2s">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="font-size:1.6rem;width:40px;text-align:center">🏦</div>
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span style="font-weight:700;font-size:0.9rem">${escHtml(name)}</span>
                      ${!b ? '<span style="font-size:0.66rem;color:var(--text-muted)">ยังไม่ได้ตั้งค่าข้อมูลความสัมพันธ์</span>' : ''}
                    </div>
                    ${b ? `
                    <div style="display:flex;gap:14px;font-size:0.72rem;color:var(--text-muted);margin-bottom:5px;flex-wrap:wrap">
                      ${b.rate ? `<span>📊 ${b.rate}%/ปี</span>` : ''}
                      ${b.maxYr ? `<span>📅 สูงสุด ${b.maxYr} ปี</span>` : ''}
                      ${b.minDown != null ? `<span>💵 Down ${b.minDown}%</span>` : ''}
                      ${b.approval ? `<span>✅ Approval ${b.approval}%</span>` : ''}
                      ${b.avgDays ? `<span>⏱ ${b.avgDays} วัน</span>` : ''}
                    </div>
                    ${b.quota ? `
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="flex:1;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${quotaPct}%;background:${quotaPct>=90?'var(--danger)':quotaPct>=70?'var(--warning)':'var(--success)'};border-radius:3px"></div>
                      </div>
                      <span style="font-size:0.64rem;color:var(--text-muted)">${b.used||0}/${b.quota}M (${quotaPct}%)</span>
                    </div>` : ''}
                    ` : ''}
                  </div>
                  <button class="btn btn-xs btn-secondary edit-btn" data-name="${escHtml(name)}" style="font-size:0.7rem;flex-shrink:0">${b?'✏️ แก้ไข':'+ ตั้งค่า'}</button>
                  <button class="btn btn-xs btn-primary submit-btn" data-name="${escHtml(name)}" style="font-size:0.7rem;flex-shrink:0">📤 ยื่น</button>
                </div>
              </div>`
            }).join('')}
          </div>

          <!-- Detail panel / Recent apps -->
          <div style="display:flex;flex-direction:column;gap:10px">
            ${sel ? `
            <div class="card" style="padding:14px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
                <div><div style="font-weight:700">${escHtml(selBank)}</div></div>
                <button class="btn btn-xs btn-danger del-info-btn" data-name="${escHtml(selBank)}">🗑️ ลบ</button>
              </div>
              ${[
                ['📊 อัตราดอกเบี้ย',(sel.rate||0)+'%/ปี'],
                ['📅 ระยะเวลาสูงสุด',(sel.maxYr||0)+' ปี'],
                ['💵 เงินดาวน์ต่ำสุด',(sel.minDown||0)+'%'],
                ['✅ Approval Rate',(sel.approval||0)+'%'],
                ['⏱ เฉลี่ยวันอนุมัติ',(sel.avgDays||0)+' วัน'],
                ['💳 วงเงินใช้ไป',(sel.used||0)+'/'+(sel.quota||0)+' ล้าน'],
                ['📞 ติดต่อ',escHtml(sel.contact||'—')],
              ].map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.76rem"><span style="color:var(--text-muted)">${k}</span><b>${v}</b></div>`).join('')}
            </div>` : ''}

            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 ใบสมัครล่าสุด</div>
              ${recentApps.length === 0 ? '<div style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:14px">ยังไม่มีใบสมัคร</div>' : recentApps.map(a=>`
                <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.74rem">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="font-weight:600">${escHtml(a.custName)} · ${escHtml(a.vehicle)}</div>
                      <div style="font-size:0.66rem;color:var(--text-muted)">${escHtml(a.bank)} · ${formatCurrency(a.loanAmount||0)}</div>
                    </div>
                    <span style="font-size:0.6rem;background:${APP_STATUS_COLOR[a.status]||'var(--text-muted)'};color:#fff;padding:1px 8px;border-radius:8px">
                      ${APP_STATUS_LABEL[a.status] || a.status}
                    </span>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.bank-card').forEach(el=>el.addEventListener('click',(e)=>{
      if (e.target.closest('.edit-btn') || e.target.closest('.submit-btn')) return
      selBank = selBank===el.dataset.name ? null : el.dataset.name
      render()
    }))
    container.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation()
      openEditModal(b.dataset.name, infoFor(b.dataset.name))
    }))
    container.querySelectorAll('.submit-btn').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation()
      showToast(`📤 ไปหน้ายื่นไฟแนนซ์ — เลือกธนาคาร ${b.dataset.name}`, 'success')
      navigate('/finance/application')
    }))
    container.querySelector('.del-info-btn')?.addEventListener('click', async e => {
      const name = e.target.dataset.name
      const info = infoFor(name)
      if (!info) return
      const ok = await confirmDialog({ title: '🗑️ ลบข้อมูลความสัมพันธ์ธนาคาร', message: `ยืนยันลบข้อมูล "${escHtml(name)}"? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      await softDelete('bank_partner_info', info.id)
      showToast('🗑️ ลบข้อมูลแล้ว', 'success')
      selBank = null
      await loadData()
    })
    document.getElementById('compare-btn')?.addEventListener('click',()=>{
      if (rated.length < 2) return
      openModal({ title:'⚖️ เปรียบเทียบดอกเบี้ย', size:'sm',
        body:`<div style="font-size:0.8rem">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="color:var(--text-muted);font-size:0.7rem;border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:6px">ธนาคาร</th><th style="text-align:right">Rate</th><th style="text-align:right">ปี</th><th style="text-align:right">Approval</th>
            </tr></thead>
            <tbody>${[...rated].sort((a,b)=>a.rate-b.rate).map(b=>`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px">🏦 ${escHtml(b.bankName)}</td><td style="text-align:right;font-weight:700;color:var(--success)">${b.rate}%</td><td style="text-align:right">${b.maxYr||0}</td><td style="text-align:right">${b.approval||0}%</td></tr>`).join('')}</tbody>
          </table>
        </div>`,
        confirmText:'ปิด',
        onConfirm(){}
      })
    })
  }

  function openEditModal(bankName, info) {
    const { el, close } = openModal({
      title: (info ? '✏️ แก้ไข' : '+ ตั้งค่า') + ' — ' + bankName,
      size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">อัตราดอกเบี้ย (%/ปี)</label><input class="input" type="number" step="0.01" id="bp-rate" value="${info?.rate ?? ''}"></div>
          <div class="input-group"><label class="input-label">ระยะเวลาสูงสุด (ปี)</label><input class="input" type="number" id="bp-maxyr" value="${info?.maxYr ?? ''}"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">เงินดาวน์ต่ำสุด (%)</label><input class="input" type="number" id="bp-mindown" value="${info?.minDown ?? ''}"></div>
          <div class="input-group"><label class="input-label">Approval Rate (%)</label><input class="input" type="number" id="bp-approval" value="${info?.approval ?? ''}"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">เฉลี่ยวันอนุมัติ</label><input class="input" type="number" step="0.1" id="bp-avgdays" value="${info?.avgDays ?? ''}"></div>
          <div class="input-group"><label class="input-label">วงเงิน (ล้านบาท)</label><input class="input" type="number" id="bp-quota" value="${info?.quota ?? ''}"></div>
        </div>
        <div class="input-group"><label class="input-label">วงเงินใช้ไป (ล้านบาท)</label><input class="input" type="number" id="bp-used" value="${info?.used ?? ''}"></div>
        <div class="input-group"><label class="input-label">ผู้ติดต่อ</label><input class="input" id="bp-contact" placeholder="ชื่อ เบอร์โทร" value="${escHtml(info?.contact||'')}"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="bp-c">ยกเลิก</button><button class="btn btn-primary" id="bp-s">💾 บันทึก</button>`
    })
    el.querySelector('#bp-c').addEventListener('click', close)
    el.querySelector('#bp-s').addEventListener('click', async () => {
      const data = {
        bankName,
        rate: parseFloat(el.querySelector('#bp-rate').value) || 0,
        maxYr: parseInt(el.querySelector('#bp-maxyr').value) || 0,
        minDown: parseFloat(el.querySelector('#bp-mindown').value) || 0,
        approval: parseInt(el.querySelector('#bp-approval').value) || 0,
        avgDays: parseFloat(el.querySelector('#bp-avgdays').value) || 0,
        quota: parseInt(el.querySelector('#bp-quota').value) || 0,
        used: parseInt(el.querySelector('#bp-used').value) || 0,
        contact: el.querySelector('#bp-contact').value.trim(),
      }
      if (info) await updateDocData('bank_partner_info', info.id, data)
      else await createDoc('bank_partner_info', data)
      showToast('✅ บันทึกข้อมูลแล้ว', 'success')
      close()
      await loadData()
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px">
      <div style="font-size:0.72rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div>
    </div>`
  }

  await loadData()
}
