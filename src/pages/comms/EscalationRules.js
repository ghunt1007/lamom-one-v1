/**
 * Escalation Rules — งานไม่เสร็จตาม SLA → แจ้งผู้จัดการอัตโนมัติ
 * Route: /comms/escalation
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default async function EscalationRulesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let rules = []
  let loading = true

  async function loadData() {
    loading = true
    try { rules = await listDocs('escalation_rules', [], 'name', 'asc', 100) } catch (e) { rules = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function ruleRow(r) {
    const channelColor = r.channel.includes('SMS')?'var(--danger)':r.channel.includes('LINE')?'var(--success)':'var(--primary)'
    return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
      '<td style="padding:9px 10px">' +
        '<div style="font-weight:600;font-size:0.78rem">'+escHtml(r.name)+'</div>' +
        '<div style="font-size:0.66rem;color:var(--text-muted)">'+escHtml(r.dept)+'</div>' +
      '</td>' +
      '<td style="padding:9px 10px;text-align:center;font-size:0.74rem;font-weight:700;color:var(--warning)">'+r.triggerHours+' ชม.</td>' +
      '<td style="padding:9px 10px;font-size:0.72rem">' +
        '<div>L1: '+escHtml(r.level1)+'</div>' +
        '<div style="color:var(--text-muted)">L2: '+escHtml(r.level2)+'</div>' +
      '</td>' +
      '<td style="padding:9px 10px;text-align:center"><span style="font-size:0.62rem;background:'+channelColor+';color:#fff;padding:2px 7px;border-radius:8px">'+escHtml(r.channel)+'</span></td>' +
      '<td style="padding:9px 10px;text-align:center;font-size:0.74rem;color:'+(r.triggered>0?'var(--danger)':'var(--text-muted)')+'">'+r.triggered+'x</td>' +
      '<td style="padding:9px 10px;text-align:center">' +
        '<label style="position:relative;display:inline-block;width:36px;height:20px;cursor:pointer">' +
          '<input type="checkbox" class="toggle-rule" data-id="'+r.id+'" '+(r.active?'checked':'')+' style="opacity:0;width:0;height:0">' +
          '<span style="position:absolute;inset:0;border-radius:10px;background:'+(r.active?'var(--success)':'var(--surface-2)')+';transition:.3s"></span>' +
          '<span style="position:absolute;top:2px;left:'+(r.active?'18':'2')+'px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.3s"></span>' +
        '</label>' +
      '</td>' +
      '<td style="padding:9px 10px">' +
        '<button class="btn btn-sm btn-secondary edit-btn" data-id="'+r.id+'">✏️</button>' +
      '</td>' +
    '</tr>'
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const active = rules.filter(r=>r.active).length
    const totalTriggered = rules.reduce((s,r)=>s+r.triggered,0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚡ Escalation Rules</div>
            <div class="page-subtitle">แจ้งเตือนอัตโนมัติเมื่องานเกิน SLA · ${rules.length} กฎ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-rule-btn">+ เพิ่มกฎใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
          ${sc('📋 กฎทั้งหมด', rules.length+' กฎ', 'var(--primary)')}
          ${sc('✅ เปิดใช้งาน', active+' กฎ', 'var(--success)')}
          ${sc('🔔 Triggered เดือนนี้', totalTriggered+' ครั้ง', 'var(--warning)')}
          ${sc('🏢 แผนกที่ครอบคลุม', [...new Set(rules.map(r=>r.dept))].length+' แผนก', 'var(--text-muted)')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead>
              <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">กฎ</th>
                <th style="text-align:center;padding:10px 10px;font-weight:600;color:var(--text-muted)">หน่วงเวลา</th>
                <th style="text-align:left;padding:10px 10px;font-weight:600;color:var(--text-muted)">Escalation Chain</th>
                <th style="text-align:center;padding:10px 10px;font-weight:600;color:var(--text-muted)">ช่องทาง</th>
                <th style="text-align:center;padding:10px 10px;font-weight:600;color:var(--text-muted)">Triggered</th>
                <th style="text-align:center;padding:10px 10px;font-weight:600;color:var(--text-muted)">เปิด/ปิด</th>
                <th style="padding:10px 10px"></th>
              </tr>
            </thead>
            <tbody>
              ${rules.map(r=>ruleRow(r)).join('')}
            </tbody>
          </table>
        </div>

        <div class="card" style="padding:14px;margin-top:12px;background:var(--surface-2);border:1px dashed var(--border)">
          <div style="font-size:0.76rem;font-weight:700;margin-bottom:6px">ℹ️ วิธีการทำงาน</div>
          <div style="font-size:0.72rem;color:var(--text-muted);line-height:1.8">
            เมื่องานเกินเวลา SLA ที่กำหนด → ระบบส่งแจ้งเตือน L1 อัตโนมัติ<br>
            หากไม่มีการตอบสนองใน 2 ชม. → ยกระดับไป L2<br>
            ทุก Escalation บันทึกใน Audit Trail ทันที
          </div>
        </div>
      </div>`

    container.querySelectorAll('.toggle-rule').forEach(cb=>cb.addEventListener('change', async ()=>{
      const r = rules.find(x=>x.id===cb.dataset.id)
      if (!r) return
      try {
        await updateDocData('escalation_rules', r.id, { active: cb.checked })
        showToast((cb.checked?'✅ เปิด':'⛔ ปิด')+' กฎ: '+r.name, cb.checked?'success':'info')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click',()=>{
      const r = rules.find(x=>x.id===b.dataset.id)
      if(r) openRuleModal(r)
    }))
    document.getElementById('add-rule-btn')?.addEventListener('click', ()=>openRuleModal(null))
  }

  function openRuleModal(r) {
    const isEdit = !!r
    const DEPTS = ['บริการ','ขาย','CRM','การเงิน','อะไหล่','HR']
    const CHANNELS = ['LINE','Email','SMS','LINE+Email','LINE+SMS']
    openModal({
      title: isEdit ? '✏️ แก้ไขกฎ: ' + escHtml(r.name) : '➕ เพิ่มกฎ Escalation ใหม่',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อกฎ *</label>
            <input id="esc-name" class="input" value="${escHtml(isEdit ? r.name : '')}" placeholder="เช่น Job Card เกิน SLA..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แผนก</label>
              <select id="esc-dept" class="input">
                ${DEPTS.map(d=>`<option ${isEdit&&r.dept===d?'selected':''}>${d}</option>`).join('')}
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Trigger หลัง (ชั่วโมง)</label>
              <input id="esc-hrs" type="number" class="input" value="${isEdit ? r.triggerHours : 24}" min="1"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Escalation L1</label>
              <input id="esc-l1" class="input" value="${escHtml(isEdit ? r.level1 : '')}" placeholder="หัวหน้าช่าง..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">Escalation L2</label>
              <input id="esc-l2" class="input" value="${escHtml(isEdit ? r.level2 : '')}" placeholder="ผู้จัดการ..."></div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ช่องทางแจ้งเตือน</label>
            <select id="esc-ch" class="input">
              ${CHANNELS.map(c=>`<option ${isEdit&&r.channel===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="esc-save">💾 บันทึก</button>
        </div>
      `
    })
    document.getElementById('esc-save')?.addEventListener('click', async () => {
      const name = document.getElementById('esc-name')?.value.trim()
      if (!name) { showToast('⚠️ กรุณากรอกชื่อกฎ', 'warning'); return }
      try {
        if (isEdit) {
          await updateDocData('escalation_rules', r.id, {
            name,
            dept:         document.getElementById('esc-dept')?.value,
            triggerHours: parseInt(document.getElementById('esc-hrs')?.value) || 24,
            level1:       document.getElementById('esc-l1')?.value.trim(),
            level2:       document.getElementById('esc-l2')?.value.trim(),
            channel:      document.getElementById('esc-ch')?.value,
          })
          showToast('✅ อัปเดตกฎ: ' + name, 'success')
        } else {
          await createDoc('escalation_rules', {
            name,
            dept:         document.getElementById('esc-dept')?.value || 'บริการ',
            triggerHours: parseInt(document.getElementById('esc-hrs')?.value) || 24,
            level1:       document.getElementById('esc-l1')?.value.trim() || '-',
            level2:       document.getElementById('esc-l2')?.value.trim() || '-',
            channel:      document.getElementById('esc-ch')?.value || 'LINE',
            active: true, triggered: 0,
          })
          showToast('✅ เพิ่มกฎ: ' + name, 'success')
        }
        document.querySelector('.modal-overlay')?.remove()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function sc(l,v,c){
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.1rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  await loadData()
}
