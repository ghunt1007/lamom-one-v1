// LAMOM ONE — File Storage Utility
// ใช้ Cloudflare R2 (ถ้าตั้งค่า VITE_R2_WORKER_URL)
// Fallback: Firebase Storage (ถ้าไม่มี R2 Worker)
// Demo Mode: URL placeholder ไม่มีการอัปโหลดจริง

const R2_WORKER = import.meta.env.VITE_R2_WORKER_URL

export const STORAGE_ENABLED = !!R2_WORKER

/**
 * อัปโหลดไฟล์ขึ้น R2
 * @param {File} file - File object จาก input[type=file]
 * @param {string} folder - โฟลเดอร์ปลายทาง เช่น 'vehicles', 'contracts', 'staff'
 * @param {string} [idToken] - Firebase ID token (optional, สำหรับ auth)
 * @returns {Promise<{ok:boolean, url:string, key:string}>}
 */
export async function uploadFile(file, folder = 'uploads', idToken = '') {
  if (!R2_WORKER) {
    // Demo mode — return fake URL
    const fakeUrl = URL.createObjectURL(file)
    return { ok: true, url: fakeUrl, key: `demo/${folder}/${file.name}`, demo: true }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const headers = {}
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`

  const res = await fetch(`${R2_WORKER}/upload`, {
    method: 'POST',
    headers,
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
export async function deleteFile(key, idToken = '') {
  if (!R2_WORKER || key.startsWith('demo/')) return { ok: true }
  const headers = {}
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`
  const res = await fetch(`${R2_WORKER}/delete?key=${encodeURIComponent(key)}`, {
    method: 'DELETE', headers,
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
