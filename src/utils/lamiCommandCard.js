// การ์ด "🪄 สั่งงาน" ใต้คำสั่งที่พิมพ์ให้ LAMI — กด ✅ ทำเลย ครั้งเดียวจบ (ใช้ทั้งหน้าแชท LAMI และแผง 🤖)
import { runLamiCommand } from './lamiCommands.js'
import { escHtml as esc } from './escape.js'

export function commandIntro(cmds) {
  return cmds.length === 1 ? '🪄 เข้าใจว่าให้ทำแบบนี้ครับ — กด ✅ ทำเลย เพื่อยืนยัน' : '🪄 เจอลูกค้าชื่อคล้ายกันหลายคน — เลือกคนที่ใช่ แล้วกด ✅ ทำเลย'
}

export function mountCommandCard(slot, cmds, { onDone } = {}) {
  if (!slot || !cmds?.length) return
  slot.innerHTML = `<div class="lami-cmds">${cmds.map((c, i) => `
    <div class="lami-cmd" data-i="${i}">
      <div class="lami-cmd-t"><b>${esc(c.label)}</b>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}</div>
      <button type="button" class="btn btn-primary btn-sm lami-cmd-go" data-i="${i}">${c.kind === 'tel' ? '📞 โทรเลย' : c.kind === 'td' ? '🚗 เปิดฟอร์ม' : c.kind === 'lead' ? '➕ เปิดฟอร์ม' : '✅ ทำเลย'}</button>
    </div>`).join('')}</div>`
  slot.querySelectorAll('.lami-cmd-go').forEach(btn => btn.addEventListener('click', async () => {
    const cmd = cmds[+btn.dataset.i]
    if (!cmd) return
    if (cmd.kind === 'tel') {
      import('./callLogger.js').then(m => m.armCallLog?.(cmd.customer)).catch(() => {})
      location.href = 'tel:' + cmd.phone; return
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
      const [db, { myEffectiveCompanyId }, { getState, showToast }] = await Promise.all([import('../core/db.js'), import('../core/companyScope.js'), import('../core/store.js')])
      const me = getState('user')?.displayName || ''
      const msg = await runLamiCommand(cmd, { me, db, companyId: myEffectiveCompanyId() })
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
