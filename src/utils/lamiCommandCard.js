// การ์ด "🪄 สั่งงาน" ใต้คำสั่งที่พิมพ์ให้ LAMI — กด ✅ ทำเลย ครั้งเดียวจบ (ใช้ทั้งหน้าแชท LAMI และแผง 🤖)
import { runLamiCommand } from './lamiCommands.js'
import { escHtml as esc } from './escape.js'

export function commandIntro(cmds) {
  return cmds.length === 1 ? '🪄 เข้าใจว่าให้ทำแบบนี้ครับ — กด ✅ ทำเลย เพื่อยืนยัน' : '🪄 เจอลูกค้าชื่อคล้ายกันหลายคน — เลือกคนที่ใช่ แล้วกด ✅ ทำเลย'
}

// ทำคำสั่งจริง (ใช้ร่วมกัน: การ์ด ✅ ทำเลย และ Enter ใน Ctrl K) — คืนข้อความผลลัพธ์
export async function executeCommand(cmd) {
  const [db, { myEffectiveCompanyId, companyScopeFilters }, { getState }, { followupWindowFilters }, { todayBangkok }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('../core/store.js'), import('./customerFollowups.js'), import('./format.js')])
  const me = getState('user')?.displayName || ''
  const today = todayBangkok()
  const msg = await runLamiCommand({ ...cmd, today }, { me, db, companyId: myEffectiveCompanyId(), followupFilters: [...companyScopeFilters(), ...followupWindowFilters(today)] })
  // ติดต่อแล้วแต่ยังไม่ได้บอกนัดถัดไป → เปิดฟอร์มนัดต่อที่เดาวันให้แล้ว (ลูกค้า Lead/Prospect เท่านั้น)
  if (cmd.kind === 'log' && !cmd.next) import('./addFollowupModal.js').then(m => m.offerNextFollowup(cmd.customer, cmd.contacted ? cmd.text : cmd.text + ' โทรใหม่พรุ่งนี้', { me })).catch(() => {})
  return msg
}

export function mountCommandCard(slot, cmds, { onDone } = {}) {
  if (!slot || !cmds?.length) return
  slot.innerHTML = `<div class="lami-cmds">${cmds.map((c, i) => `
    <div class="lami-cmd" data-i="${i}">
      <div class="lami-cmd-t"><b>${esc(c.label)}</b>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}</div>
      <button type="button" class="btn btn-primary btn-sm lami-cmd-go" data-i="${i}">${c.kind === 'tel' ? '📞 โทรเลย' : c.kind === 'td' ? '🚗 เปิดฟอร์ม' : c.kind === 'lead' ? '➕ เปิดฟอร์ม' : c.kind === 'book' ? '📝 เปิดฟอร์มจอง' : c.kind === 'open' ? '👤 เปิด' : '✅ ทำเลย'}</button>
    </div>`).join('')}</div>`
  slot.querySelectorAll('.lami-cmd-go').forEach(btn => btn.addEventListener('click', async () => {
    const cmd = cmds[+btn.dataset.i]
    if (!cmd) return
    if (cmd.kind === 'tel') {
      import('./callLogger.js').then(m => m.armCallLog?.(cmd.customer)).catch(() => {})
      location.href = 'tel:' + cmd.phone; return
    }
    if (cmd.kind === 'book' || cmd.kind === 'open') {
      const [{ navigate }, panel] = await Promise.all([import('../core/router.js'), import('./lamiPanel.js')])
      panel.closeLamiPanel?.()
      navigate(`/crm/customers?id=${encodeURIComponent(cmd.customer.id)}${cmd.kind === 'book' ? '&book=1' : ''}`); return
    }
    if (cmd.kind === 'lead') {
      const { openQuickLead } = await import('./quickLead.js')
      openQuickLead({ pasteText: cmd.text, name: cmd.name }); return
    }
    if (cmd.kind === 'td') {
      const { openTestDriveForm } = await import('./testDriveForm.js')
      openTestDriveForm(cmd.customer, { hint: cmd.hint || '' }); return
    }
    btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก…'
    try {
      const { showToast } = await import('../core/store.js')
      const msg = await executeCommand(cmd)
      const row = btn.closest('.lami-cmd')
      row.classList.add('done')
      btn.outerHTML = '<span class="lami-cmd-ok">✓ เรียบร้อย</span>'
      slot.querySelectorAll('.lami-cmd-go').forEach(b => { b.disabled = true })
      showToast(msg, 'success')
      onDone?.(msg, cmd)
    } catch (e) {
      btn.disabled = false; btn.textContent = '✅ ทำเลย'
      import('../core/store.js').then(m => m.showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 'error'))
    }
  }))
}

// (v1.0.1035) "วันนี้ควรโทรหาใคร" → รายชื่อพร้อมปุ่มโทร (ลูกค้าที่ผู้ใช้เห็นเท่านั้น)
export async function loadCallListCommands(customersPromise) {
  const [{ listDocs }, { companyScopeFilters }, { followupWindowFilters }, { todayBangkok }, { callList, callListCommands }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('./customerFollowups.js'), import('./format.js'), import('./callList.js')])
  const today = todayBangkok()
  const [customers, followups] = await Promise.all([
    customersPromise || visibleCustomersForCommands(),
    listDocs('followups', [...companyScopeFilters(), ...followupWindowFilters(today)], 'dueDate', 'asc', 2000).catch(() => []),
  ])
  return callListCommands(callList({ customers, followups, today }))
}
export function callListIntro(cmds) {
  return cmds.length ? `📞 วันนี้ควรโทร ${cmds.length} คนนี้ก่อน (เรียงจากเร่งด่วนที่สุด) — กดโทรได้เลย วางสายแล้วระบบถามผลให้บันทึก` : '🎉 วันนี้ไม่มีนัดค้างหรือลูกค้า Hot/Warm ที่เงียบนาน — ลองดูลูกค้าใหม่ในหน้า Lead'
}

// ลูกค้าที่ผู้ใช้คนนี้มองเห็น (ตามสิทธิ์เดียวกับหน้าแชท) — ใช้จับชื่อในคำสั่ง
export async function visibleCustomersForCommands() {
  const [{ listDocs }, { companyScopeFilters }, { getVisibilityScope, scopeIncludesRecord }] = await Promise.all([
    import('../core/db.js'), import('../core/companyScope.js'), import('../core/hierarchy.js')])
  const [rows, vis] = await Promise.all([
    listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
    getVisibilityScope().catch(() => null),
  ])
  return rows.filter(c => !c.deleted && !!vis && (vis.unrestricted || vis.companyOnly || scopeIncludesRecord(vis, c.assignedTo, c)))
}
