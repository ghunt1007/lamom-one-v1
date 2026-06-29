/**
 * No-Claim Bonus (NCB) Tracking — ติดตามส่วนลดไม่เคยเคลม
 * Route: /insurance/ncb
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// NCB schedule ตามมาตรฐาน คปภ.
const NCB_TABLE = [
  { year: 0, pct: 0,  label: '0% (ปีแรก)' },
  { year: 1, pct: 20, label: '20% (1 ปีไม่เคลม)' },
  { year: 2, pct: 30, label: '30% (2 ปี)' },
  { year: 3, pct: 40, label: '40% (3 ปี)' },
  { year: 4, pct: 50, label: '50% (4 ปี)' },
  { year: 5, pct: 50, label: '50% (5 ปี+)' },
]

let POLICIES = [
  { id: 'POL-001', customer: 'คุณอนันต์ รักดี', plate: 'กข-1234', model: 'BYD Atto 3', insurer: 'กรุงเทพประกันภัย', renewDate: '2026-08-01', ncbYears: 3, basePremium: 18500, claimed: false },
  { id: 'POL-002', customer: 'คุณมาลี วงศ์ดี', plate: '1กก-5678', model: 'MG ZS EV', insurer: 'เมืองไทยประกันภัย', renewDate: '2026-07-15', ncbYears: 0, basePremium: 14200, claimed: true },
  { id: 'POL-003', customer: 'คุณวีระ สมบัติ', plate: '2ขข-9999', model: 'BYD Seal AWD', insurer: 'วิริยะประกันภัย', renewDate: '2026-09-30', ncbYears: 5, basePremium: 22000, claimed: false },
  { id: 'POL-004', customer: 'คุณสุดา ใจดี', plate: '3กค-1111', model: 'BYD Dolphin', insurer: 'อาคเนย์ประกันภัย', renewDate: '2026-06-25', ncbYears: 2, basePremium: 12800, claimed: false },
]

function ncbOf(p) {
  const yrs = p.claimed ? 0 : Math.min(p.ncbYears + (p.claimed ? 0 : 0), 5)
  return NCB_TABLE.find(r => r.year === yrs) || NCB_TABLE[0]
}
function daysUntil(d) { return Math.ceil((new Date(d) - Date.now()) / 86400000) }
function effectivePremium(p) {
  const ncb = ncbOf(p)
  return Math.round(p.basePremium * (1 - ncb.pct / 100))
}

export default async function NoClaimPage(container) {
  function render() {
    const expiringSoon = POLICIES.filter(p => daysUntil(p.renewDate) <= 30 && daysUntil(p.renewDate) > 0)
    const totalSaving = POLICIES.reduce((s, p) => s + (p.basePremium - effectivePremium(p)), 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏅 No-Claim Bonus (NCB)</div>
            <div class="page-subtitle">ติดตามส่วนลดไม่เคยเคลม · แจ้งลูกค้าก่อนต่ออายุ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-btn">➕ เพิ่มกรมธรรม์</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('📋 กรมธรรม์ทั้งหมด', POLICIES.length, 'var(--primary)')}
          ${sc('⚠️ ต่อใน 30 วัน', expiringSoon.length, expiringSoon.length > 0 ? 'var(--danger)' : 'var(--success)')}
          ${sc('🏅 NCB 50% (สูงสุด)', POLICIES.filter(p=>ncbOf(p).pct===50).length, 'var(--success)')}
          ${sc('💰 ส่วนลด NCB รวม', formatCurrency(totalSaving), 'var(--success)')}
        </div>

        ${expiringSoon.length ? `
          <div class="card" style="padding:12px 14px;margin-bottom:12px;border-left:4px solid var(--danger)">
            <div style="font-size:0.76rem;font-weight:700;color:var(--danger);margin-bottom:4px">⚠️ ใกล้ต่ออายุ — ต้องดำเนินการด่วน</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${expiringSoon.map(p=>`${escHtml(p.customer)} (${escHtml(p.plate)}) · ต่อภายใน ${daysUntil(p.renewDate)} วัน`).join(' · ')}</div>
          </div>` : ''}

        <!-- NCB Reference Table -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <div class="card" style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:720px">
              <thead><tr style="border-bottom:2px solid var(--border);font-size:0.72rem;color:var(--text-muted);text-align:left">
                <th style="padding:10px 12px">ลูกค้า / รถ</th><th>ประกัน</th>
                <th style="text-align:center">NCB</th><th style="text-align:right">เบี้ยพื้นฐาน</th>
                <th style="text-align:right">เบี้ยหลัง NCB</th><th style="text-align:center">ต่ออายุ</th><th></th>
              </tr></thead>
              <tbody>
                ${POLICIES.map(p => {
                  const ncb = ncbOf(p); const eff = effectivePremium(p); const days = daysUntil(p.renewDate)
                  const urgent = days <= 30 && days > 0
                  return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                    <td style="padding:9px 12px">${escHtml(p.customer)}<div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(p.model)} · ${escHtml(p.plate)}</div></td>
                    <td style="font-size:0.74rem">${escHtml(p.insurer)}</td>
                    <td style="text-align:center">
                      <span style="font-size:0.72rem;background:${ncb.pct>=50?'var(--success)':ncb.pct>0?'var(--primary)':'var(--text-muted)'};color:#fff;padding:2px 8px;border-radius:10px">${ncb.pct}%</span>
                      ${p.claimed?'<div style="font-size:0.65rem;color:var(--danger)">มีเคลม→รีเซ็ต</div>':''}
                    </td>
                    <td style="text-align:right">${formatCurrency(p.basePremium)}</td>
                    <td style="text-align:right;font-weight:700;color:var(--success)">${formatCurrency(eff)}<div style="font-size:0.65rem;font-weight:400;color:var(--text-muted)">ประหยัด ${formatCurrency(p.basePremium-eff)}</div></td>
                    <td style="text-align:center;font-size:0.74rem;${urgent?'color:var(--danger);font-weight:700':''}">${formatDate(p.renewDate)}<div style="font-size:0.64rem">${days>0?`${days} วัน`:'หมดแล้ว!'}</div></td>
                    <td style="padding-right:10px">${urgent?`<button class="btn btn-xs btn-primary notify-btn" data-id="${p.id}">แจ้งลูกค้า</button>`:''}</td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="card" style="padding:14px;height:fit-content">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📊 ตาราง NCB ตาม คปภ.</div>
            ${NCB_TABLE.map(r => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                <span style="color:var(--text-muted)">${r.label.split('(')[1]?.replace(')','') || 'ปีแรก'}</span>
                <strong style="color:${r.pct>=50?'var(--success)':r.pct>0?'var(--primary)':'var(--text-muted)'}">${r.pct}%</strong>
              </div>`).join('')}
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:8px">💡 หากมีการเคลม NCB รีเซ็ตเป็น 0% ปีถัดไป</div>
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.notify-btn').forEach(b => b.addEventListener('click', () => {
      const p = POLICIES.find(x => x.id === b.dataset.id)
      showToast(`📱 แจ้ง ${p.customer} ผ่าน LINE ว่าประกัน ${p.plate} จะหมดใน ${daysUntil(p.renewDate)} วัน · NCB ${ncbOf(p).pct}% แล้ว`, 'success')
    }))
    document.getElementById('add-btn')?.addEventListener('click', () => {
      openModal({
        title: '➕ เพิ่มกรมธรรม์ใหม่',
        size: 'sm',
        body: `
          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.8rem">
            <div><label style="font-size:0.72rem;color:var(--text-muted)">ชื่อลูกค้า</label>
              <input class="input" id="nc-customer" placeholder="เช่น คุณอนันต์ รักดี" style="width:100%;margin-top:4px"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div><label style="font-size:0.72rem;color:var(--text-muted)">ทะเบียนรถ</label>
                <input class="input" id="nc-plate" placeholder="กข-1234" style="width:100%;margin-top:4px"></div>
              <div><label style="font-size:0.72rem;color:var(--text-muted)">รุ่นรถ</label>
                <input class="input" id="nc-model" placeholder="BYD Atto 3" style="width:100%;margin-top:4px"></div>
            </div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">บริษัทประกัน</label>
              <input class="input" id="nc-insurer" placeholder="กรุงเทพประกันภัย" style="width:100%;margin-top:4px"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div><label style="font-size:0.72rem;color:var(--text-muted)">วันต่ออายุ</label>
                <input class="input" id="nc-renew" type="date" value="2026-12-31" style="width:100%;margin-top:4px"></div>
              <div><label style="font-size:0.72rem;color:var(--text-muted)">ปีไม่เคลม (0-5)</label>
                <input class="input" id="nc-ncb" type="number" min="0" max="5" value="0" style="width:100%;margin-top:4px"></div>
            </div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">เบี้ยประกันก่อนลด (บาท)</label>
              <input class="input" id="nc-premium" type="number" placeholder="18500" style="width:100%;margin-top:4px"></div>
            <label style="display:flex;align-items:center;gap:8px;font-size:0.78rem;cursor:pointer">
              <input type="checkbox" id="nc-claimed"> มีการเคลมในปีนี้ (NCB รีเซ็ต)
            </label>
          </div>
        `,
        confirmText: '💾 บันทึกกรมธรรม์',
        onConfirm() {
          const customer  = document.getElementById('nc-customer')?.value?.trim()
          const plate     = document.getElementById('nc-plate')?.value?.trim()
          const model     = document.getElementById('nc-model')?.value?.trim()
          const insurer   = document.getElementById('nc-insurer')?.value?.trim()
          const renewDate = document.getElementById('nc-renew')?.value
          const ncbYears  = parseInt(document.getElementById('nc-ncb')?.value) || 0
          const basePremium = parseInt(document.getElementById('nc-premium')?.value) || 0
          const claimed   = document.getElementById('nc-claimed')?.checked || false
          if (!customer || !plate || !basePremium) { showToast('กรอกข้อมูลให้ครบ', 'warning'); return false }
          POLICIES.push({ id: 'POL-'+Date.now(), customer, plate, model: model||'ไม่ระบุ', insurer: insurer||'ไม่ระบุ', renewDate, ncbYears, basePremium, claimed })
          render()
          showToast(`✅ เพิ่มกรมธรรม์ ${plate} (${customer}) แล้ว`, 'success')
        }
      })
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
