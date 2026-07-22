// LAMOM ONE — File Storage Utility
// ใช้ Cloudflare R2 (ถ้าตั้งค่า VITE_R2_WORKER_URL)
// Fallback: Firebase Storage (ถ้าไม่มี R2 Worker)
// Demo Mode (ไม่มี Firebase session จริง): URL placeholder ไม่มีการอัปโหลดจริง — เดิมเช็คแค่ว่า
// ตั้งค่า R2_WORKER หรือไม่ ทำให้ demo mode ในโปรดักชันอัปโหลดไฟล์จริงขึ้น R2 บัคเก็ตจริงโดยไม่มี
// auth token เลย (Worker เดิมก็ไม่ได้บังคับตรวจสอบอยู่แล้ว) ตอนนี้เช็คว่ามี Firebase session จริง
// หรือไม่แทน ถ้าไม่มี (demo mode) จะไม่แตะเครือข่ายจริงเลย
import { auth } from '../core/firebase.js'

const R2_WORKER = import.meta.env.VITE_R2_WORKER_URL

export const STORAGE_ENABLED = !!R2_WORKER

async function authHeader() {
  const u = auth.currentUser
  if (!u) return null
  const token = await u.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

/**
 * อัปโหลดไฟล์ขึ้น R2
 * @param {File} file - File object จาก input[type=file]
 * @param {string} folder - โฟลเดอร์ปลายทาง เช่น 'vehicles', 'contracts', 'staff'
 * @returns {Promise<{ok:boolean, url:string, key:string}>}
 */
export async function uploadFile(file, folder = 'uploads') {
  const auth_ = R2_WORKER ? await authHeader() : null
  if (!R2_WORKER || !auth_) {
    // Demo mode (ไม่มี Firebase session จริง) หรือยังไม่ตั้งค่า R2 — return fake URL ไม่แตะเครือข่ายจริง
    const fakeUrl = URL.createObjectURL(file)
    return { ok: true, url: fakeUrl, key: `demo/${folder}/${file.name}`, demo: true }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const res = await fetch(`${R2_WORKER}/upload`, {
    method: 'POST',
    headers: auth_,
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Upload failed: ${res.status}`)
  }
  return res.json()
}

/**
 * ลบไฟล์จาก R2
 * @param {string} key - key ของไฟล์จาก uploadFile()
 */
export async function deleteFile(key) {
  if (!R2_WORKER || key.startsWith('demo/')) return { ok: true }
  const auth_ = await authHeader()
  if (!auth_) return { ok: true }  // demo mode — ไม่มีไฟล์จริงให้ลบ
  const res = await fetch(`${R2_WORKER}/delete?key=${encodeURIComponent(key)}`, {
    method: 'DELETE', headers: auth_,
  })
  return res.json()
}

/**
 * สร้าง UI สำหรับเลือกและ preview ไฟล์
 * ใช้งาน: renderFileUpload(container, { folder:'vehicles', onUpload: (result)=>{} })
 */
export function renderFileUploadBtn(opts = {}) {
  const { label = '📎 แนบไฟล์', accept = '*', folder = 'uploads', onUpload, multiple = false } = opts
  const id = 'fu-' + Math.random().toString(36).slice(2)
  const html = `
    <label class="btn btn-secondary btn-sm" style="cursor:pointer">
      ${label}
      <input type="file" id="${id}" accept="${accept}" ${multiple ? 'multiple' : ''} style="display:none">
    </label>
    <span id="${id}-status" style="font-size:0.78rem;color:var(--text-muted);margin-left:6px"></span>
  `
  setTimeout(() => {
    document.getElementById(id)?.addEventListener('change', async e => {
      const files = Array.from(e.target.files || [])
      if (!files.length) return
      const statusEl = document.getElementById(`${id}-status`)
      if (statusEl) statusEl.textContent = '⏳ กำลังอัปโหลด...'
      try {
        const results = await Promise.all(files.map(f => uploadFile(f, folder)))
        if (statusEl) statusEl.textContent = `✓ อัปโหลด ${results.length} ไฟล์สำเร็จ`
        if (onUpload) onUpload(multiple ? results : results[0])
      } catch (err) {
        if (statusEl) statusEl.textContent = `⚠️ ${err.message}`
      }
    })
  }, 0)
  return html
}
