/**
 * Org Chart — แผนผังองค์กร
 * Route: /hr/orgchart
 */
import { openModal } from '../../utils/modal.js'
import { listDocs } from '../../core/db.js'
import { ROLES } from './Staff.js'

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

const DEPT_COLORS = {
  'ผู้บริหาร': '#8b5cf6',
  'ฝ่ายขาย': '#3b82f6',
  'ฝ่ายบริการ': '#f59e0b',
  'ฝ่ายการเงิน': '#10b981',
  'ฝ่าย HR': '#ec4899',
  'ฝ่าย IT': '#ef4444',
  'อื่นๆ': '#6b7280',
}
const ROLE_ICON = { owner: '👑', admin: '🛡', manager: '👔', sales: '🎯', service: '🔧', staff: '👤' }

// (v1.0.326) เดิมทั้งแผนผังเป็นคน 13 คนที่แต่งขึ้นตายตัว (ORG_DATA) ไม่เกี่ยวกับพนักงานจริงเลย — ดึงจำนวน
// พนักงานจริงมาโชว์แค่ badge "พนักงานจริง N คน" แต่ไม่ได้ใช้สร้างแผนผังจริง แก้ให้สร้างแผนผังจากพนักงานจริง
// ทั้งหมด โดยใช้ field ใหม่ managerId (เพิ่มไว้ที่ฟอร์มพนักงานใน Staff.js — เลือก "หัวหน้างาน" ได้) จับคู่
// สายบังคับบัญชาจริง คนที่ยังไม่ได้ตั้งหัวหน้างานไว้ (หรือ managerId ไม่ตรงกับใครในระบบ) จะถือเป็นระดับบนสุด
export default async function OrgChartPage(container) {
  const myGen = container.__routerGen
  let selectedDept = 'all'
  let selectedCompany = 'all' // 'all' = สายบังคับบัญชาหลัก (staff.managerId) — ไม่แยกตามบริษัท
  let viewMode = 'tree'
  let staff = []
  let companiesList = []
  // uid → users doc — เชื่อมกับ staff.uid (v1.0.430) เพื่ออ่าน companyMemberships[].managerId ต่อบริษัท
  // อ่าน collection users ทั้งหมดได้แค่ owner/admin/manager ตาม Firestore Rules — พลาดได้ (เช่นบัญชี sales/
  // service ทั่วไปเปิดหน้านี้) ไม่กระทบมุมมองหลัก แค่จะไม่มีตัวเลือกแยกตามบริษัทให้เลือกเท่านั้น
  let usersByUid = {}

  try {
    const docs = await listDocs('staff', [], 'firstName', 'asc', 500)
    if (container.__routerGen !== myGen) return
    staff = docs.filter(s => !s.deleted)
  } catch {}
  try { companiesList = await listDocs('org_companies', [], 'name', 'asc', 100) } catch {}
  try {
    const users = await listDocs('users', [], 'createdAt', 'desc', 500)
    usersByUid = Object.fromEntries(users.map(u => [u.id, u]))
  } catch {}

  // (v1.0.431) พนักงาน 1 คนทำงานหลายบริษัทได้ และมีหัวหน้าต่างกันในแต่ละบริษัท (companyMemberships[].managerId
  // ที่เพิ่มไว้ v1.0.430) — เดิมแผนผังใช้ staff.managerId เดียวตายตัวทั้งระบบเสมอ ไม่แยกตามบริษัทเลย ตอนนี้ถ้า
  // เลือกบริษัทใดบริษัทหนึ่ง จะกรองเฉพาะพนักงานที่สังกัดบริษัทนั้นจริง (ผ่าน companyMemberships หรือ staff.
  // companyId เดิม) แล้วต่อสายบังคับบัญชาตาม managerId เฉพาะของบริษัทนั้นก่อน — ถ้าคนนั้นไม่มีบัญชีเชื่อม/ไม่มี
  // ข้อมูลหัวหน้าเฉพาะบริษัท จะ fallback ไปใช้ staff.managerId เดิมแทน (ไม่ตัดข้อมูลที่มีอยู่แล้วทิ้ง)
  function membershipFor(s, companyId) {
    const u = s.uid ? usersByUid[s.uid] : null
    return u?.companyMemberships?.find(m => m.companyId === companyId) || null
  }

  function staffInCompany(s, companyId) {
    if (s.companyId === companyId) return true
    return !!membershipFor(s, companyId)
  }

  function buildTree() {
    const pool = selectedCompany === 'all' ? staff : staff.filter(s => staffInCompany(s, selectedCompany))
    const byId = {}
    pool.forEach(s => { byId[s.id] = { ...s, children: [] } })
    const roots = []
    Object.values(byId).forEach(node => {
      let managerId = node.managerId
      if (selectedCompany !== 'all') {
        const membership = membershipFor(node, selectedCompany)
        if (membership?.managerId) {
          // managerId ใน companyMemberships อ้างเป็น uid ของหัวหน้า ต้องแปลงเป็น staff doc id ก่อน (Org Chart
          // ต่อสายด้วย staff doc id เสมอ) — หาไม่เจอ (หัวหน้ายังไม่มี/ยังไม่เชื่อม staff doc) ถือเป็น root
          const managerStaff = pool.find(s => s.uid === membership.managerId)
          managerId = managerStaff ? managerStaff.id : null
        }
      }
      if (managerId && byId[managerId] && managerId !== node.id) byId[managerId].children.push(node)
      else roots.push(node)
    })
    return roots
  }

  function renderPage() {
    const pool = selectedCompany === 'all' ? staff : staff.filter(s => staffInCompany(s, selectedCompany))
    const roots = buildTree()
    const depts = [...new Set(pool.map(s => s.dept).filter(Boolean))]
    const managerIds = new Set(pool.map(s => s.managerId).filter(Boolean))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏛 Org Chart</div>
            <div class="page-subtitle">แผนผังองค์กร — จากข้อมูลพนักงานจริง ${staff.length} คน</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px">
              <button class="btn btn-xs ${viewMode==='tree'?'btn-primary':'btn-secondary'}" id="view-tree">🌳 Tree</button>
              <button class="btn btn-xs ${viewMode==='list'?'btn-primary':'btn-secondary'}" id="view-list">📋 List</button>
            </div>
          </div>
        </div>

        ${!staff.length ? `<div class="empty-state"><div class="empty-icon">🏛</div><div class="empty-title">ยังไม่มีข้อมูลพนักงาน</div></div>` : `
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 พนักงานทั้งหมด', pool.length + ' คน', 'primary')}
          ${kpi('🏢 แผนกทั้งหมด', depts.length, 'secondary')}
          ${kpi('👔 มีผู้ใต้บังคับบัญชา', managerIds.size + ' คน', 'warning')}
          ${kpi('🌱 ระดับบนสุด', roots.length + ' คน', 'success')}
        </div>

        ${companiesList.length ? `
        <!-- Company filter — สายบังคับบัญชาต่อบริษัท (v1.0.431) -->
        <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
          <span style="font-size:0.7rem;color:var(--text-muted);margin-right:4px">🏢 บริษัท:</span>
          <button class="btn btn-xs ${selectedCompany==='all'?'btn-primary':'btn-secondary'} company-btn" data-c="all">สายบังคับบัญชาหลัก</button>
          ${companiesList.map(c => `<button class="btn btn-xs ${selectedCompany===c.id?'btn-primary':'btn-secondary'} company-btn" data-c="${c.id}">${esc(c.name)}</button>`).join('')}
        </div>
        ` : ''}

        <!-- Dept filter -->
        <div style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">
          <button class="btn btn-xs ${selectedDept==='all'?'btn-primary':'btn-secondary'} dept-btn" data-d="all">ทั้งหมด</button>
          ${depts.map(d => `<button class="btn btn-xs ${selectedDept===d?'btn-primary':'btn-secondary'} dept-btn" data-d="${esc(d)}" style="color:${DEPT_COLORS[d]||'inherit'}">${esc(d)}</button>`).join('')}
        </div>

        <div style="overflow-x:auto">${viewMode === 'tree' ? renderTreeRoots(roots) : renderList(pool, depts)}</div>
        `}
      </div>
    `

    document.getElementById('view-tree')?.addEventListener('click', () => { viewMode = 'tree'; renderPage() })
    document.getElementById('view-list')?.addEventListener('click', () => { viewMode = 'list'; renderPage() })
    container.querySelectorAll('.company-btn').forEach(b => b.addEventListener('click', () => { selectedCompany = b.dataset.c; renderPage() }))
    container.querySelectorAll('.dept-btn').forEach(b => b.addEventListener('click', () => { selectedDept = b.dataset.d; renderPage() }))
    container.querySelectorAll('.node-card').forEach(el => el.addEventListener('click', () => {
      const s = staff.find(x => x.id === el.dataset.id); if (s) openNodeDetail(s)
    }))
  }

  function renderTreeRoots(roots) {
    const html = roots.map(r => renderTree(r)).filter(Boolean).join('')
    return html || `<div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-title">ไม่พบพนักงานในแผนกที่เลือก</div></div>`
  }

  function hasInDept(node, dept) {
    if (node.dept === dept) return true
    return node.children.some(c => hasInDept(c, dept))
  }

  function renderTree(node) {
    if (selectedDept !== 'all' && !hasInDept(node, selectedDept)) return ''
    const color = DEPT_COLORS[node.dept] || 'var(--text-muted)'
    const name = `${node.firstName || ''} ${node.lastName || ''}`.trim() || '—'
    return `
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="node-card card" data-id="${node.id}" style="padding:12px 16px;text-align:center;cursor:pointer;min-width:140px;max-width:160px;border-top:3px solid ${color}">
          <div style="font-size:1.6rem">${ROLE_ICON[node.role] || '👤'}</div>
          <div style="font-weight:700;font-size:0.8rem;margin-top:4px">${esc(name)}</div>
          <div style="font-size:0.7rem;color:${color}">${esc(ROLES[node.role] || node.role || '-')}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">${esc(node.dept || '-')}</div>
        </div>
        ${node.children.length ? `
          <div style="width:2px;height:20px;background:var(--border)"></div>
          <div style="display:flex;gap:16px;align-items:flex-start;position:relative">
            <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);height:1px;background:var(--border);width:calc(100% - 80px)"></div>
            ${node.children.map(child => renderTree(child)).join('')}
          </div>
        ` : ''}
      </div>
    `
  }

  function renderList(allStaff, depts) {
    const filtered = selectedDept === 'all' ? allStaff : allStaff.filter(s => s.dept === selectedDept)
    const grouped = {}
    filtered.forEach(s => { const d = s.dept || 'ไม่ระบุแผนก'; (grouped[d] = grouped[d] || []).push(s) })
    return `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${Object.entries(grouped).map(([dept, list]) => `
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:10px 14px;background:${DEPT_COLORS[dept]||'var(--primary)'};color:white;font-weight:700;font-size:0.85rem">${esc(dept)} (${list.length} คน)</div>
            <div>
              ${list.map(s => {
                const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || '—'
                const manager = staff.find(m => m.id === s.managerId)
                return `
                <div class="node-card" data-id="${s.id}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:12px">
                  <div style="font-size:1.4rem">${ROLE_ICON[s.role] || '👤'}</div>
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:0.85rem">${esc(name)}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${esc(ROLES[s.role] || s.role || '-')}${manager ? ' · รายงานต่อ ' + esc(`${manager.firstName||''} ${manager.lastName||''}`.trim()) : ''}</div>
                  </div>
                </div>`
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  function openNodeDetail(s) {
    const color = DEPT_COLORS[s.dept] || 'var(--primary)'
    const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || '—'
    const manager = staff.find(m => m.id === s.managerId)
    const reports = staff.filter(x => x.managerId === s.id)
    openModal({
      title: `${ROLE_ICON[s.role] || '👤'} ${esc(name)}`,
      size: 'sm',
      body: `
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:3rem">${ROLE_ICON[s.role] || '👤'}</div>
          <div style="font-size:1.1rem;font-weight:800;margin-top:6px">${esc(name)}</div>
          <div style="font-size:0.85rem;color:${color}">${esc(ROLES[s.role] || s.role || '-')}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${esc(s.dept || '-')}</div>
        </div>
        ${row('หัวหน้างาน', manager ? esc(`${manager.firstName||''} ${manager.lastName||''}`.trim()) : '-')}
        ${row('ผู้ใต้บังคับบัญชา', reports.length + ' คน')}
        ${row('แผนก', esc(s.dept || '-'))}
      `
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
