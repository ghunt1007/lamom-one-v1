// Global State Store — Reactive without framework
const listeners = {}

function readJsonLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

const state = {
  user: null,
  company: null,
  role: null,
  permissions: [],
  theme: localStorage.getItem('lamom_theme') || 'midnight',
  sidebarCollapsed: localStorage.getItem('lamom_sidebar') === 'true',
  notifications: [],
  unreadCount: 0,
  lamiMood: 'happy',
  currentRoute: '/',
  loading: false,
  toast: null,
  // รองรับ 1 user ทำงานหลายบริษัท (org_companies docs ที่ user เป็นสมาชิกจริง)
  companies: [],
  // companyId ที่กรองอยู่ตอนนี้ — [] หมายถึง "ทั้งหมด" (ค่าเริ่มต้น ตามที่เจ้าของระบบต้องการให้เห็นข้อมูลทุกบริษัทพร้อมกันก่อน แล้วค่อยกรองทีหลัง)
  activeCompanyFilter: readJsonLS('lamom_company_filter', []),
}

export function getState(key) {
  return key ? state[key] : { ...state }
}

export function setState(key, value) {
  state[key] = value
  emit(key, value)
  emit('*', state)
}

export function on(key, fn) {
  if (!listeners[key]) listeners[key] = []
  listeners[key].push(fn)
  return () => off(key, fn)
}

export function off(key, fn) {
  if (!listeners[key]) return
  listeners[key] = listeners[key].filter(f => f !== fn)
}

function emit(key, value) {
  if (!listeners[key]) return
  listeners[key].forEach(fn => fn(value))
}

export function setTheme(theme) {
  setState('theme', theme)
  try { localStorage.setItem('lamom_theme', theme) } catch {}
  document.documentElement.setAttribute('data-theme', theme)
}

export function toggleSidebar() {
  const next = !state.sidebarCollapsed
  setState('sidebarCollapsed', next)
  try { localStorage.setItem('lamom_sidebar', next) } catch {}
}

export function showToast(message, type = 'success', duration = 4000) {
  const id = Date.now()
  const toast = { id, message, type }
  setState('toast', toast)
  setTimeout(() => {
    if (state.toast?.id === id) setState('toast', null)
  }, duration)
}

export function setUser(user) {
  setState('user', user)
}

export function setCompany(company) {
  setState('company', company)
}

export function setCompanies(list) {
  setState('companies', list || [])
}

export function setActiveCompanyFilter(companyIds) {
  const ids = companyIds || []
  setState('activeCompanyFilter', ids)
  try { localStorage.setItem('lamom_company_filter', JSON.stringify(ids)) } catch {}
}
