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

// (v1.0.456) ผังองค์กรแบบ "ตามโครงสร้างบริษัทจริง" ตามภาพตัวอย่างที่เจ้าของระบบส่งมา — ต่างจาก Tree/List เดิม
// (ไล่ตาม staff.managerId ล้วนๆ) ตรงที่จัดกลุ่มตาม "ตำแหน่งงานจริง" (staff.position ตรงกับ getPositions()
// ใน src/data/masterData.js) เข้าโซนตามผังองค์กรจริงของกลุ่ม เอส.เค. ที่เจ้าของให้รายละเอียดไว้ก่อนหน้านี้ —
// แผนที่นี้ต้องตรงกับ 34 ตำแหน่งใน DEFAULTS.positions เป๊ะ ถ้าเพิ่มตำแหน่งใหม่ใน masterData.js ต้องเพิ่มที่นี่
// ด้วยไม่งั้นคนตำแหน่งใหม่จะตกไปกอง "อื่นๆ" ท้ายผัง
const COMPANY_SECTION_MAP = {
  'กรรมการผู้จัดการ/เจ้าของ': 'owner',
  'ผู้ช่วยเจ้าของกิจการ': 'assistant',
  'ผู้จัดการทีมขายหน้าร้าน': 'sales-floor', 'พนักงานขายหน้าร้าน': 'sales-floor',
  'ผู้จัดการฝ่ายขายออนไลน์': 'sales-online', 'ผู้จัดการทีมขายออนไลน์': 'sales-online', 'พนักงานขายออนไลน์': 'sales-online',
  'ผู้จัดการฝ่ายเซอร์วิส': 'service', 'ผู้จัดการ SA': 'service', 'เจ้าหน้าที่ลูกค้าสัมพันธ์': 'service',
  'เจ้าหน้าที่ BP และประกันภัย': 'service', 'หัวหน้าช่าง': 'service', 'ช่างเทคนิค': 'service',
  'เจ้าหน้าที่ธุรการ': 'admin', 'เจ้าหน้าที่สต็อกรถ': 'stock', 'เจ้าหน้าที่บัญชี': 'accounting',
  'หัวหน้าฝ่ายบัญชี': 'shared', 'เจ้าหน้าที่บุคคล (HR)': 'shared', 'ผู้จัดการฝ่ายบุคคล (HR)': 'shared',
  'เจ้าหน้าที่ PDI และแต่งรถ': 'shared', 'เจ้าหน้าที่ทะเบียนและประกันภัยรถใหม่': 'shared', 'เจ้าหน้าที่ตรวจสอบ': 'shared',
  'เจ้าหน้าที่การตลาด': 'shared', 'ผู้จัดการฝ่ายการตลาด': 'shared', 'นักออกแบบกราฟฟิก': 'shared',
}
const SERVICE_ROLE_LABEL = {
  'ผู้จัดการฝ่ายเซอร์วิส': 'ผู้จัดการฝ่ายเซอร์วิส', 'ผู้จัดการ SA': 'ผู้จัดการ SA',
  'เจ้าหน้าที่ลูกค้าสัมพันธ์': 'ลูกค้าสัมพันธ์ (SA)', 'เจ้าหน้าที่ BP และประกันภัย': 'BP และประกันภัย',
  'หัวหน้าช่าง': 'หัวหน้าช่าง', 'ช่างเทคนิค': 'ช่าง',
}
const BRAND_COLORS = ['#1e3a5f', '#0d9488', '#15803d', '#7c3aed', '#b45309', '#be123c']
function brandColor(i) { return BRAND_COLORS[i % BRAND_COLORS.length] }

// (v1.0.326) เดิมทั้งแผนผังเป็นคน 13 คนที่แต่งขึ้นตายตัว (ORG_DATA) ไม่เกี่ยวกับพนักงานจริงเลย — ดึงจำนวน
// พนักงานจริงมาโชว์แค่ badge "พนักงานจริง N คน" แต่ไม่ได้ใช้สร้างแผนผังจริง แก้ให้สร้างแผนผังจากพนักงานจริง
// ทั้งหมด โดยใช้ field ใหม่ managerId (เพิ่มไว้ที่ฟอร์มพนักงานใน Staff.js — เลือก "หัวหน้างาน" ได้) จับคู่
// สายบังคับบัญชาจริง คนที่ยังไม่ได้ตั้งหัวหน้างานไว้ (หรือ managerId ไม่ตรงกับใครในระบบ) จะถือเป็นระดับบนสุด
export default async function OrgChartPage(container) {
  const myGen = container.__routerGen
  let selectedDept = 'all'
  let selectedCompany = 'all' // 'all' = สายบังคับบัญชาหลัก (staff.managerId) — ไม่แยกตามบริษัท
  let viewMode = 'company'
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
              <button class="btn btn-xs ${viewMode==='company'?'btn-primary':'btn-secondary'}" id="view-company">🏢 บริษัท</button>
              <button class="btn btn-xs ${viewMode==='tree'?'btn-primary':'btn-secondary'}" id="view-tree">🌳 Tree</button>
              <button class="btn btn-xs ${viewMode==='list'?'btn-primary':'btn-secondary'}" id="view-list">📋 List</button>
            </div>
          </div>
        </div>

        ${!staff.length ? `<div class="empty-state"><div class="empty-icon">🏛</div><div class="empty-title">ยังไม่มีข้อมูลพนักงาน</div></div>` : viewMode === 'company' ? `
        <div style="overflow-x:auto">${renderCompanyView(staff, companiesList)}</div>
        ` : `
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

    document.getElementById('view-company')?.addEventListener('click', () => { viewMode = 'company'; renderPage() })
    document.getElementById('view-tree')?.addEventListener('click', () => { viewMode = 'tree'; renderPage() })
    document.getElementById('view-list')?.addEventListener('click', () => { viewMode = 'list'; renderPage() })
    container.querySelectorAll('.company-btn').forEach(b => b.addEventListener('click', () => { selectedCompany = b.dataset.c; renderPage() }))
    container.querySelectorAll('.dept-btn').forEach(b => b.addEventListener('click', () => { selectedDept = b.dataset.d; renderPage() }))
    container.querySelectorAll('.co-box').forEach(el => el.addEventListener('click', () => {
      const ids = (el.dataset.ids || '').split(',').filter(Boolean)
      if (ids.length) openGroupDetail(el.dataset.label || '', staff.filter(s => ids.includes(s.id)))
    }))
    container.querySelectorAll('.node-card').forEach(el => el.addEventListener('click', () => {
      const s = staff.find(x => x.id === el.dataset.id); if (s) openNodeDetail(s)
    }))
  }

  // (v1.0.456) ผังองค์กรตามโครงสร้างบริษัทจริง — ดูคอมเมนต์ที่ COMPANY_SECTION_MAP ด้านบน จัดกลุ่มพนักงานจริง
  // ตาม staff.position เข้าโซนต่างๆ แล้ววาดเป็นบล็อกตามภาพผังองค์กรจริงที่เจ้าของระบบส่งมา — กล่องที่ยังไม่มี
  // คนจริงในตำแหน่งนั้นแสดง "ยังไม่มีข้อมูล" ไม่ใช่ปั้นชื่อปลอมมาเติม กดกล่องเพื่อดูรายชื่อคนจริงในกล่องนั้น
  function nameOf(s) { return `${s.firstName || ''} ${s.lastName || ''}`.trim() || '—' }
  function inSection(list, sec) { return list.filter(s => COMPANY_SECTION_MAP[s.position] === sec) }
  function box(label, icon, people, opts = {}) {
    const ids = people.map(s => s.id).join(',')
    const color = opts.color || 'var(--primary)'
    return `
      <div class="card co-box" data-ids="${ids}" data-label="${esc(label)}" style="padding:10px 12px;cursor:${people.length?'pointer':'default'};border-top:3px solid ${color};min-width:${opts.minWidth||'128px'};text-align:center;opacity:${people.length?'1':'0.55'}">
        <div style="font-size:1.2rem">${icon}</div>
        <div style="font-weight:700;font-size:0.72rem;margin-top:4px;line-height:1.3">${esc(label)}</div>
        <div style="font-size:0.68rem;color:${color};margin-top:2px">${people.length ? people.length + ' คน' : 'ยังไม่มีข้อมูล'}</div>
        ${opts.note ? `<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px">${esc(opts.note)}</div>` : ''}
      </div>
    `
  }
  function renderCompanyView(allStaff, companies) {
    const pool = allStaff
    const owners = inSection(pool, 'owner')
    const assistants = inSection(pool, 'assistant')
    const onlineMgr = inSection(pool, 'sales-online').filter(s => s.position === 'ผู้จัดการฝ่ายขายออนไลน์')
    const onlineTeamMgr = inSection(pool, 'sales-online').filter(s => s.position === 'ผู้จัดการทีมขายออนไลน์')
    const onlineStaff = inSection(pool, 'sales-online').filter(s => s.position === 'พนักงานขายออนไลน์')
    const sharedPositions = [
      ['เจ้าหน้าที่บุคคล (HR) / ผู้จัดการฝ่ายบุคคล (HR)', '👥', s => ['เจ้าหน้าที่บุคคล (HR)', 'ผู้จัดการฝ่ายบุคคล (HR)'].includes(s.position)],
      ['PDI และแต่งรถ', '🚙', s => s.position === 'เจ้าหน้าที่ PDI และแต่งรถ'],
      ['ทะเบียนและประกันภัยรถใหม่', '🛡️', s => s.position === 'เจ้าหน้าที่ทะเบียนและประกันภัยรถใหม่'],
      ['ตรวจสอบ', '🔍', s => s.position === 'เจ้าหน้าที่ตรวจสอบ'],
      ['หัวหน้าฝ่ายบัญชี', '🧮', s => s.position === 'หัวหน้าฝ่ายบัญชี'],
      ['การตลาด', '📣', s => ['เจ้าหน้าที่การตลาด', 'ผู้จัดการฝ่ายการตลาด'].includes(s.position)],
      ['กราฟฟิก', '🎨', s => s.position === 'นักออกแบบกราฟฟิก'],
    ]

    return `
    <div style="min-width:${Math.max(900, companies.length * 300)}px">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:1.1rem;font-weight:800">แผนผังองค์กร${companies.length ? ' — ' + esc(companies[0]?.name?.split(' ').slice(0,2).join(' ') || '') + ' และเครือ' : ''}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">จากข้อมูลพนักงานจริง — กล่องที่ยังไม่มีคนจริงจะแสดง "ยังไม่มีข้อมูล"</div>
      </div>

      <!-- แถวเจ้าของ -->
      <div style="display:flex;justify-content:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
        ${owners.length ? owners.map(o => `
          <div class="card co-box" data-ids="${o.id}" data-label="${esc(nameOf(o))}" style="padding:10px 16px;cursor:pointer;background:#1e293b;color:white;text-align:center;min-width:140px">
            <div style="font-size:1.3rem">👑</div>
            <div style="font-weight:700;font-size:0.78rem;margin-top:4px">${esc(nameOf(o))}</div>
            <div style="font-size:0.65rem;opacity:0.8">เจ้าของบริษัท</div>
          </div>`).join('') : box('เจ้าของบริษัท', '👑', [])}
        ${assistants.length ? assistants.map(a => `
          <div class="card co-box" data-ids="${a.id}" data-label="${esc(nameOf(a))}" style="padding:10px 16px;cursor:pointer;text-align:center;min-width:130px;border:1px dashed var(--border)">
            <div style="font-size:1.1rem">🧑‍💼</div>
            <div style="font-weight:700;font-size:0.72rem;margin-top:4px">${esc(nameOf(a))}</div>
            <div style="font-size:0.62rem;color:var(--text-muted)">ผู้ช่วยเจ้าของกิจการ</div>
          </div>`).join('') : box('ผู้ช่วยเจ้าของกิจการ', '🧑‍💼', [])}
      </div>
      <div style="display:flex;justify-content:center"><div style="width:2px;height:16px;background:var(--border)"></div></div>

      <!-- แถวบริษัท/แบรนด์ -->
      <div style="display:grid;grid-template-columns:repeat(${Math.max(companies.length,1)},1fr);gap:12px;margin-bottom:16px">
        ${companies.length ? companies.map((c, i) => `
          <div class="card" style="padding:10px 14px;text-align:center;border-top:4px solid ${brandColor(i)}">
            <div style="font-weight:800;font-size:0.85rem;color:${brandColor(i)}">${esc(c.brand || c.name)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">${esc(c.name)}</div>
          </div>`).join('') : `<div class="card" style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.78rem">ยังไม่มีข้อมูลบริษัท — เพิ่มได้ที่ Settings &gt; บริษัทในเครือ</div>`}
      </div>

      <!-- ฝ่ายขาย + ฝ่ายเซอร์วิส -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:8px 12px;background:#6366f1;color:white;font-weight:700;font-size:0.8rem">🎯 ฝ่ายขาย</div>
          <div style="padding:12px">
            <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:6px">หน้าร้าน (แยกแต่ละยี่ห้อ)</div>
            <div style="display:grid;grid-template-columns:repeat(${Math.max(companies.length,1)},1fr);gap:8px;margin-bottom:12px">
              ${(companies.length ? companies : [null]).map((c, i) => {
                const floorStaff = c ? pool.filter(s => COMPANY_SECTION_MAP[s.position] === 'sales-floor' && s.companyId === c.id) : []
                return `<div style="text-align:center">
                  ${c ? `<div style="font-size:0.65rem;font-weight:700;color:${brandColor(i)};margin-bottom:4px">${esc(c.brand||c.name)}</div>` : ''}
                  ${box('ผู้จัดการทีม+ลูกทีม', '👔', floorStaff, { minWidth: '100%', color: brandColor(i) })}
                </div>`
              }).join('')}
            </div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:6px">ออนไลน์ (ทุกยี่ห้อ)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
              ${box('ผู้จัดการฝ่ายขายออนไลน์', '👔', onlineMgr, { color: '#6366f1' })}
              ${box('ผู้จัดการทีมขายออนไลน์', '🧑‍💼', onlineTeamMgr, { color: '#6366f1' })}
              ${box('พนักงานขายออนไลน์', '👤', onlineStaff, { color: '#6366f1' })}
            </div>
          </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:8px 12px;background:#f59e0b;color:white;font-weight:700;font-size:0.8rem">🔧 ฝ่ายเซอร์วิส (แยกแต่ละยี่ห้อ)</div>
          <div style="padding:12px;display:grid;grid-template-columns:repeat(${Math.max(companies.length,1)},1fr);gap:8px">
            ${(companies.length ? companies : [null]).map((c, i) => {
              const svcStaff = c ? pool.filter(s => COMPANY_SECTION_MAP[s.position] === 'service' && s.companyId === c.id) : []
              return `<div style="text-align:center">
                ${c ? `<div style="font-size:0.65rem;font-weight:700;color:${brandColor(i)};margin-bottom:4px">${esc(c.brand||c.name)}</div>` : ''}
                ${Object.keys(SERVICE_ROLE_LABEL).map(pos => box(SERVICE_ROLE_LABEL[pos], '🔧', svcStaff.filter(s => s.position === pos), { minWidth: '100%', color: brandColor(i) })).join('<div style="height:4px"></div>')}
              </div>`
            }).join('')}
          </div>
        </div>
      </div>

      <!-- ธุรการ/สต๊อค/บัญชี แยกตามบริษัท -->
      <div style="display:grid;grid-template-columns:repeat(${Math.max(companies.length,1)},1fr);gap:12px;margin-bottom:16px">
        ${(companies.length ? companies : [null]).map((c, i) => `
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:6px 10px;background:${brandColor(i)};color:white;font-weight:700;font-size:0.75rem;text-align:center">${c ? esc(c.brand||c.name) : 'ยังไม่มีบริษัท'}</div>
            <div style="padding:8px;display:flex;flex-direction:column;gap:6px">
              ${box('ฝ่ายธุรการ', '📋', c ? pool.filter(s => COMPANY_SECTION_MAP[s.position]==='admin' && s.companyId===c.id) : [], { minWidth: '100%', color: brandColor(i) })}
              ${box('ฝ่ายสต๊อค', '📦', c ? pool.filter(s => COMPANY_SECTION_MAP[s.position]==='stock' && s.companyId===c.id) : [], { minWidth: '100%', color: brandColor(i) })}
              ${box('ฝ่ายบัญชี', '💰', c ? pool.filter(s => COMPANY_SECTION_MAP[s.position]==='accounting' && s.companyId===c.id) : [], { minWidth: '100%', color: brandColor(i) })}
            </div>
          </div>`).join('')}
      </div>

      <!-- ฝ่ายสนับสนุน ดูแลทุกบริษัท -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:8px 12px;background:var(--secondary);color:white;font-weight:700;font-size:0.8rem;text-align:center">🤝 ฝ่ายสนับสนุน (ดูแลทุกบริษัท)</div>
        <div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
          ${sharedPositions.map(([label, icon, match]) => box(label, icon, pool.filter(match), { color: 'var(--secondary)' })).join('')}
        </div>
      </div>

      <div style="font-size:0.62rem;color:var(--text-muted);text-align:center;margin-top:10px">
        * โครงสร้างองค์กรอาจมีการปรับเปลี่ยนตามความเหมาะสม · ทุกฝ่ายทำงานร่วมกันเพื่อให้บรรลุเป้าหมายขององค์กร
      </div>
    </div>
    `
  }

  function openGroupDetail(label, people) {
    openModal({
      title: `👥 ${esc(label)} (${people.length} คน)`,
      size: 'sm',
      body: people.map(s => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:1.3rem">${ROLE_ICON[s.role] || '👤'}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.85rem">${esc(nameOf(s))}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${esc(s.position || s.dept || '-')}</div>
          </div>
        </div>
      `).join(''),
    })
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
