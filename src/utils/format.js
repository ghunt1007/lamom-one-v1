// Formatting utilities

function toDate(v) {
  if (!v) return null
  if (v?.toDate) return v.toDate()  // Firestore Timestamp
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const iso = typeof dateStr === 'string' && dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${+iso[3]} ${months[+iso[2]-1]} ${+iso[1] + 543}`
  const d = toDate(dateStr)
  if (!d) return '-'
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const d = toDate(dateStr)
  if (!d) return '-'
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function timeAgo(dateStr) {
  if (!dateStr) return '-'
  // Handle Firestore Timestamp objects (have .toDate()) and ISO strings
  const date = dateStr?.toDate ? dateStr.toDate() : new Date(dateStr)
  const diff = Date.now() - date.getTime()
  if (isNaN(diff)) return '-'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'เมื่อกี้'
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day} วันที่แล้ว`
  return formatDate(dateStr?.toDate ? dateStr.toDate().toISOString() : dateStr)
}

export function formatPhone(phone) {
  if (!phone) return '-'
  const p = phone.replace(/\D/g, '')
  if (p.length === 10) return `${p.slice(0,3)}-${p.slice(3,6)}-${p.slice(6)}`
  return phone
}

export function formatCurrency(num) {
  if (num == null || num === '') return '-'
  return '฿' + Number(num).toLocaleString('th-TH')
}

export function formatNumber(num, decimals) {
  if (num == null || num === '') return '-'
  const n = Number(num)
  return decimals != null ? n.toFixed(decimals) : n.toLocaleString('th-TH')
}

export function initials(firstName, lastName) {
  return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || 'U'
}

export function fullName(obj) {
  return [obj?.firstName, obj?.lastName].filter(Boolean).join(' ') || '-'
}

function pad(n) { return String(n).padStart(2, '0') }
