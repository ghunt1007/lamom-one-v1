/**
 * Org Chart — แผนผังองค์กร
 * Route: /hr/orgchart
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

const ORG_DATA = {
  id: 'R1', name: 'ทวีศักดิ์ สุขสมบัติเสถียร', role: 'เจ้าของ/CEO', dept: 'ผู้บริหาร', avatar: '👑', level: 0, children: [
    {
      id: 'M1', name: 'สมชาย ผู้จัดการ', role: 'ผู้จัดการทั่วไป', dept: 'ผู้บริหาร', avatar: '👔', level: 1, children: [
        {
          id: 'S1', name: 'วิชัย ยอดขาย', role: 'หัวหน้าฝ่ายขาย', dept: 'ฝ่ายขาย', avatar: '🎯', level: 2, children: [
            { id: 'E1', name: 'สุดา มาดี',    role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👩', level: 3, children: [] },
            { id: 'E2', name: 'ธนา เก่ง',    role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👨', level: 3, children: [] },
            { id: 'E3', name: 'อรวรรณ ขยัน', role: 'เซลส์', dept: 'ฝ่ายขาย', avatar: '👩', level: 3, children: [] },
          ]
        },
        {
          id: 'S2', name: 'วิทยา ช่างดี', role: 'หัวหน้าช่าง', dept: 'ศูนย์บริการ', avatar: '🔧', level: 2, children: [
            { id: 'E4', name: 'สมศักดิ์ มั่นใจ', role: 'ช่างซ่อม', dept: 'ศูนย์บริการ', avatar: '🧑', level: 3, children: [] },
            { id: 'E5', name: 'ชัยวัฒน์ พัฒนา', role: 'ช่าง EV',  dept: 'ศูนย์บริการ', avatar: '⚡', level: 3, children: [] },
          ]
        },
        {
          id: 'S3', name: 'ปทิตา การเงิน', role: 'ผู้จัดการการเงิน', dept: 'การเงิน', avatar: '💰', level: 2, children: [
            { id: 'E6', name: 'ณัฐพล บัญชี', role: 'นักบัญชี', dept: 'การเงิน', avatar: '📊', level: 3, children: [] },
          ]
        },
        {
          id: 'S4', name: 'สุภาพ HR', role: 'ผู้จัดการ HR', dept: 'ทรัพยากรบุคคล', avatar: '👥', level: 2, children: [
            { id: 'E7', name: 'มานี พัฒนาคน', role: 'HR Officer', dept: 'ทรัพยากรบุคคล', avatar: '👤', level: 3, children: [] },
          ]
        },
      ]
    }
  ]
}

const DEPT_COLORS = {
  'ผู้บริหาร': '#8b5cf6',
  'ฝ่ายขาย': '#3b82f6',
  'ศูนย์บริการ': '#f59e0b',
  'การเงิน': '#10b981',
  'ทรัพยากรบุคคล': '#ec4899',
}

export default async function OrgChartPage(container) {
  const myGen = container.__routerGen
  let selectedDept = 'all'
  let viewMode = 'tree'
  let liveStaffCount = null

  try {
    const staff = await listDocs('staff', [], 'name', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (staff.length >= 2) liveStaffCount = staff.length
  } catch {}

  function renderPage() {
    const allNodes = flattenOrg(ORG_DATA)
    const depts = [...new Set(allNodes.map(n => n.dept))]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏛 Org Chart</div>
            <div class="page-subtitle">แผนผังองค์กร — โครงสร้างการบริหาร${liveStaffCount ? ` <span style="color:var(--success);font-size:0.75rem">● พนักงานจริง ${liveStaffCount} คน</span>` : ''}</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:6px">
              <button class="btn btn-xs ${viewMode==='tree'?'btn-primary':'btn-secondary'}" id="view-tree">🌳 Tree</button>
              <button class="btn btn-xs ${viewMode==='list'?'btn-primary':'btn-secondary'}" id="view-list">📋 List</button>
            </div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 พนักงานทั้งหมด', allNodes.length + ' คน', 'primary')}
          ${kpi('🏢 แผนกทั้งหมด', depts.length, 'secondary')}
          ${kpi('👔 ระดับบริหาร', allNodes.filter(n=>n.level<=1).length + ' คน', 'warning')}
          ${kpi('⭐ ระดับหัวหน้า', allNodes.filter(n=>n.level===2).length + ' คน', 'success')}
        </div>

        <!-- Dept filter -->
        <div style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">
          <button class="btn btn-xs ${selectedDept==='all'?'btn-primary':'btn-secondary'} dept-btn" data-d="all">ทั้งหมด</button>
          ${depts.map(d => `<button class="btn btn-xs ${selectedDept===d?'btn-primary':'btn-secondary'} dept-btn" data-d="${d}" style="${selectedDept===d?'':''}color:${DEPT_COLORS[d]||'inherit'}">${d}</button>`).join('')}
        </div>

        <div style="overflow-x:auto">${viewMode === 'tree' ? renderTree(ORG_DATA) : renderList(allNodes, depts)}</div>
      </div>
    `

    document.getElementById('view-tree')?.addEventListener('click', () => { viewMode = 'tree'; renderPage() })
    document.getElementById('view-list')?.addEventListener('click', () => { viewMode = 'list'; renderPage() })
    container.querySelectorAll('.dept-btn').forEach(b => b.addEventListener('click', () => { selectedDept = b.dataset.d; renderPage() }))
    container.querySelectorAll('.node-card').forEach(el => el.addEventListener('click', () => {
      const node = findNode(ORG_DATA, el.dataset.id); if (node) openNodeDetail(node)
    }))
  }

  function renderTree(node) {
    if (selectedDept !== 'all' && !hasInDept(node, selectedDept)) return ''
    const color = DEPT_COLORS[node.dept] || 'var(--text-muted)'
    return `
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="node-card card" data-id="${node.id}" style="padding:12px 16px;text-align:center;cursor:pointer;min-width:140px;max-width:160px;border-top:3px solid ${color}">
          <div style="font-size:1.6rem">${node.avatar}</div>
          <div style="font-weight:700;font-size:0.8rem;margin-top:4px">${node.name}</div>
          <div style="font-size:0.7rem;color:${color}">${node.role}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">${node.dept}</div>
        </div>
        ${node.children && node.children.length ? `
          <div style="width:2px;height:20px;background:var(--border)"></div>
          <div style="display:flex;gap:16px;align-items:flex-start;position:relative">
            <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);height:1px;background:var(--border);width:calc(100% - 80px)"></div>
            ${node.children.map(child => renderTree(child)).join('')}
          </div>
        ` : ''}
      </div>
    `
  }

  function renderList(allNodes, depts) {
    const filtered = selectedDept === 'all' ? allNodes : allNodes.filter(n => n.dept === selectedDept)
    const grouped = {}
    filtered.forEach(n => { if (!grouped[n.dept]) grouped[n.dept] = []; grouped[n.dept].push(n) })
    return `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${Object.entries(grouped).map(([dept, nodes]) => `
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:10px 14px;background:${DEPT_COLORS[dept]||'var(--primary)'};color:white;font-weight:700;font-size:0.85rem">${dept} (${nodes.length} คน)</div>
            <div>
              ${nodes.map(n => `
                <div class="node-card" data-id="${n.id}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:12px">
                  <div style="font-size:1.4rem">${n.avatar}</div>
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:0.85rem">${n.name}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${n.role}</div>
                  </div>
                  <div style="font-size:0.72rem;padding:3px 8px;background:var(--surface-2);border-radius:10px">Lv.${n.level}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  function openNodeDetail(node) {
    const color = DEPT_COLORS[node.dept] || 'var(--primary)'
    openModal({
      title: `${node.avatar} ${node.name}`,
      size: 'sm',
      body: `
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:3rem">${node.avatar}</div>
          <div style="font-size:1.1rem;font-weight:800;margin-top:6px">${node.name}</div>
          <div style="font-size:0.85rem;color:${color}">${node.role}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${node.dept}</div>
        </div>
        ${row('ระดับ', 'Level ' + node.level)}
        ${node.children?.length ? row('ผู้ใต้บังคับบัญชา', node.children.length + ' คน') : ''}
        ${row('แผนก', node.dept)}
      `
    })
  }

  renderPage()
}

function flattenOrg(node) {
  const result = [node]
  if (node.children) node.children.forEach(c => result.push(...flattenOrg(c)))
  return result
}

function hasInDept(node, dept) {
  if (node.dept === dept) return true
  if (node.children) return node.children.some(c => hasInDept(c, dept))
  return false
}

function findNode(node, id) {
  if (node.id === id) return node
  if (node.children) { for (const c of node.children) { const found = findNode(c, id); if (found) return found } }
  return null
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
