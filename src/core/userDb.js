/**
 * userDb — ฐานผู้ใช้ภายใน (สร้างจากในระบบเท่านั้น)
 * เก็บใน localStorage (Demo) — โปรดักชันจริงย้ายไป Firestore + Firebase Auth Admin
 */

// ลำดับสิทธิ์ — สร้างได้เฉพาะ role ที่ level ต่ำกว่าตัวเองเท่านั้น
export const ROLES = {
  admin:          { label: 'แอดมินระบบ', icon: '🛡', level: 100 },
  owner:          { label: 'เจ้าของโชว์รูม', icon: '👑', level: 90 },
  showroom_admin: { label: 'แอดมินโชว์รูม', icon: '🏢', level: 80 },
  management:     { label: 'ระดับบริหาร', icon: '💼', level: 70 },
  supervisor:     { label: 'หัวหน้างาน', icon: '👔', level: 60 },
  sales:          { label: 'เซลส์', icon: '🤝', level: 30 },
  technician:     { label: 'ช่างเทคนิค', icon: '🔧', level: 30 },
  staff:          { label: 'พนักงานทั่วไป', icon: '👤', level: 20 },
}

export const MIN_CREATE_LEVEL = 60 // ต่ำกว่าหัวหน้างานสร้าง user ไม่ได้

const USERS_KEY = 'lamom_users'
const RESET_KEY = 'lamom_pw_requests'
const LOG_KEY = 'lamom_auth_log'

function load(key) { try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] } }
function save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)) } catch {} }

// ---------- Password hashing (SHA-256 + per-user salt) ----------
// ไม่เก็บรหัสผ่าน plaintext อีกต่อไป — user เดิมที่ยังเป็น plaintext จะถูก
// อัปเกรดเป็น hash โดยอัตโนมัติเมื่อ login สำเร็จครั้งถัดไป (ดู verifyLogin)
async function hashPw(password, salt) {
  const data = new TextEncoder().encode(salt + ':' + password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
function newSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}
async function setUserPassword(u, password) {
  u.pwSalt = newSalt()
  u.pwHash = await hashPw(password, u.pwSalt)
  delete u.password // ลบ plaintext เดิมถ้ามี
}
// เทียบรหัสผ่านกับ record — รองรับทั้งแบบ hash ใหม่ และ plaintext เดิม (legacy)
async function matchesPassword(u, password) {
  if (u.pwHash) return (await hashPw(password, u.pwSalt || '')) === u.pwHash
  return u.password === password // legacy record ก่อนมีระบบ hash
}

// ---------- Audit log ----------
export function getAuthLog() { return load(LOG_KEY) }

function logEvent(type, detail) {
  const log = load(LOG_KEY)
  log.unshift({ id: 'L' + Date.now().toString(36), type, detail, at: new Date().toISOString() })
  if (log.length > 200) log.length = 200 // เก็บแค่ 200 รายการล่าสุด
  save(LOG_KEY, log)
}

// ---------- Users ----------
export function getUsers() { return load(USERS_KEY) }

export function findUser(email) {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
}

export function canCreate(creatorRole, targetRole) {
  const c = ROLES[creatorRole], t = ROLES[targetRole]
  if (!c || !t) return false
  if (c.level < MIN_CREATE_LEVEL) return false
  return t.level < c.level // สร้างได้เฉพาะระดับต่ำกว่าตัวเองเท่านั้น
}

export async function createUser({ name, email, password, role, supervisorEmail, createdBy }) {
  if (findUser(email)) return { ok: false, error: 'อีเมลนี้มีผู้ใช้แล้ว' }
  const users = getUsers()
  const u = {
    id: 'U' + Date.now().toString(36),
    name, email: email.toLowerCase(), role,
    supervisorEmail: (supervisorEmail || '').toLowerCase(),
    createdBy, createdAt: new Date().toISOString(),
    active: true, mustChangePw: true,
  }
  await setUserPassword(u, password)
  users.push(u)
  save(USERS_KEY, users)
  logEvent('create', `${createdBy} สร้างผู้ใช้ ${name} (${email}) ระดับ ${ROLES[role]?.label || role}`)
  return { ok: true }
}

export async function setPassword(email, newPassword, by) {
  const users = getUsers()
  const u = users.find(x => x.email === email.toLowerCase())
  if (!u) return { ok: false, error: 'ไม่พบผู้ใช้' }
  await setUserPassword(u, newPassword)
  u.mustChangePw = true
  u.pwResetBy = by
  u.pwResetAt = new Date().toISOString()
  save(USERS_KEY, users)
  // ปิดคำขอรีเซ็ตที่ค้างของ user นี้
  const reqs = load(RESET_KEY).map(r => r.email === u.email ? { ...r, status: 'done', resolvedBy: by } : r)
  save(RESET_KEY, reqs)
  logEvent('reset', `${by} รีเซ็ตรหัสผ่านให้ ${u.name} (${u.email})`)
  return { ok: true }
}

export function toggleActive(email, by) {
  const users = getUsers()
  const u = users.find(x => x.email === email.toLowerCase())
  if (u) {
    u.active = !u.active
    save(USERS_KEY, users)
    logEvent(u.active ? 'enable' : 'suspend', `${by || 'ระบบ'} ${u.active ? 'เปิดใช้งาน' : 'ระงับ'}บัญชี ${u.name} (${u.email})`)
  }
  return u?.active
}

export async function verifyLogin(email, password) {
  const u = findUser(email)
  if (!u) return { ok: false, error: 'not_found' }
  if (!u.active) {
    logEvent('login_blocked', `พยายาม login ด้วยบัญชีที่ถูกระงับ: ${u.email}`)
    return { ok: false, error: 'บัญชีถูกระงับ — ติดต่อผู้บังคับบัญชา' }
  }
  if (!(await matchesPassword(u, password))) {
    logEvent('login_fail', `login ผิดรหัสผ่าน: ${u.email}`)
    return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' }
  }
  // migration: record เก่าที่ยังเป็น plaintext → อัปเกรดเป็น hash ทันทีที่ login สำเร็จ
  if (!u.pwHash) {
    const users = getUsers()
    const stored = users.find(x => x.email === u.email)
    if (stored) {
      await setUserPassword(stored, password)
      save(USERS_KEY, users)
      logEvent('pw_migrate', `อัปเกรดรหัสผ่านเป็น hash: ${u.email}`)
    }
  }
  logEvent('login', `${u.name} (${u.email}) เข้าสู่ระบบ`)
  return { ok: true, user: u }
}

// เทียบรหัสผ่านปัจจุบัน (ใช้ตอนผู้ใช้เปลี่ยนรหัสเองจากหน้าบัญชี — ไม่ log เป็น login attempt)
export async function checkPassword(email, password) {
  const u = findUser(email)
  if (!u) return false
  return matchesPassword(u, password)
}

export async function changeOwnPassword(email, newPassword) {
  const users = getUsers()
  const u = users.find(x => x.email === email.toLowerCase())
  if (!u) return { ok: false, error: 'ไม่พบผู้ใช้' }
  if (newPassword.length < 8) return { ok: false, error: 'รหัสผ่านอย่างน้อย 8 ตัว' }
  if (await matchesPassword(u, newPassword)) return { ok: false, error: 'รหัสใหม่ต้องไม่ซ้ำรหัสเดิม' }
  await setUserPassword(u, newPassword)
  u.mustChangePw = false
  u.pwChangedAt = new Date().toISOString()
  save(USERS_KEY, users)
  logEvent('pw_change', `${u.name} (${u.email}) เปลี่ยนรหัสผ่านด้วยตัวเอง`)
  return { ok: true }
}

// ---------- Password reset requests ----------
export function getResetRequests() { return load(RESET_KEY) }

export function requestReset(email) {
  const u = findUser(email)
  const reqs = load(RESET_KEY)
  if (reqs.some(r => r.email === email.toLowerCase() && r.status === 'pending')) {
    return { ok: true, dup: true, supervisor: u?.supervisorEmail }
  }
  reqs.unshift({
    id: 'R' + Date.now().toString(36),
    email: email.toLowerCase(),
    name: u?.name || email,
    supervisorEmail: u?.supervisorEmail || '',
    requestedAt: new Date().toISOString(),
    status: 'pending',
  })
  save(RESET_KEY, reqs)
  logEvent('reset_request', `${u?.name || email} ขอรีเซ็ตรหัสผ่าน → ส่งถึง ${u?.supervisorEmail || 'แอดมินโชว์รูม'}`)
  return { ok: true, supervisor: u?.supervisorEmail, found: !!u }
}
