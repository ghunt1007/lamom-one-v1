// LAMOM ONE — RAG (Retrieval-Augmented Generation) สำหรับ AI Officers
// เก็บ embedding ของ "ความรู้ภายในบริษัท" (SOP/คู่มือ/Product Knowledge/กฎหมาย) ไว้ใน Firestore
// แบบตัวเลขธรรมดา (ไม่ใช่ vector index จริง) เพราะ Web SDK ของ Firestore ไม่รองรับ findNearest()
// (มีแค่ฝั่ง Node.js/Python) — ด้วยจำนวนเอกสารความรู้ภายในที่มีจริง (หลักสิบ-ร้อย ไม่ใช่ล้าน)
// การให้ Worker/เบราว์เซอร์คำนวณ cosine similarity ตรงๆ เร็วพอและไม่ต้องพึ่ง infra เพิ่มเลย
// อัปเกรดเป็น vector search จริงได้ทีหลังถ้าคลังความรู้โตขึ้นมากจนวิธีนี้ช้า
import { auth, db } from '../core/firebase.js'
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || 'https://lamom-ai-proxy.ghunt1007.workers.dev'

// collection → ฟังก์ชันประกอบข้อความสำหรับทำ embedding (คืน '' หรือ falsy ถ้าไม่มีอะไรจะ index)
const RAG_TEXT_BUILDERS = {
  sop_documents: d => [d.title, ...(Array.isArray(d.steps) ? d.steps : [])].filter(Boolean).join('\n'),
  kb_articles: d => [d.title, d.content || d.excerpt].filter(Boolean).join('\n'),
  product_knowledge: d => [
    `${d.brand || ''} ${d.model || ''}`.trim(),
    d.specs ? `แบตเตอรี่ ${d.specs.battery || '-'} ระยะทาง ${d.specs.range || '-'} กำลัง ${d.specs.power || '-'}` : '',
    ...(Array.isArray(d.selling) ? d.selling : []),
  ].filter(Boolean).join('\n'),
  legal_references: d => [d.title, d.lawName, d.summary, ...(Array.isArray(d.keyPoints) ? d.keyPoints : []), d.penalty].filter(Boolean).join('\n'),
}

export const RAG_SOURCE_COLLECTIONS = Object.keys(RAG_TEXT_BUILDERS)

async function authHeader() {
  const u = auth.currentUser
  if (!u) return null
  const token = await u.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function embedText(text, taskType) {
  const auth_ = await authHeader()
  if (!auth_ || !text) return null
  try {
    const res = await fetch(`${PROXY_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth_ },
      body: JSON.stringify({ text: text.slice(0, 8000), taskType }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.embedding?.values || null
  } catch { return null }
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return -1
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  if (!na || !nb) return -1
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// เรียกจาก core/db.js หลัง createDoc/updateDocData สำเร็จ (fire-and-forget — ห้าม throw ออกไปกระทบ CRUD จริง)
// ลบ (deleted:true) → เอา chunk ทิ้งไปด้วย ไม่งั้น AI จะยังอ้างอิงข้อมูลที่ถูกลบไปแล้วอยู่
export async function syncRagChunk(colName, id, data) {
  const build = RAG_TEXT_BUILDERS[colName]
  if (!build) return
  try {
    if (data?.deleted) { await deleteDoc(doc(db, 'rag_chunks', `${colName}_${id}`)); return }
    const text = build(data || {})
    if (!text || !text.trim()) return
    const embedding = await embedText(text, 'RETRIEVAL_DOCUMENT')
    if (!embedding) return
    await setDoc(doc(db, 'rag_chunks', `${colName}_${id}`), {
      sourceCollection: colName, sourceId: id, text: text.slice(0, 2000), embedding, updatedAt: serverTimestamp(),
    })
  } catch { /* indexing พลาดได้ ไม่กระทบการบันทึกข้อมูลหลัก */ }
}

// คืน array ของข้อความ chunk ที่เกี่ยวข้องที่สุด (มากสุด topK รายการ) — [] ถ้าไม่มีอะไรเกี่ยวข้องพอ/ยังไม่ล็อกอิน
export async function retrieveRagContext(queryText, sourceCollections = RAG_SOURCE_COLLECTIONS, topK = 5) {
  if (!sourceCollections.length) return []
  const qEmbed = await embedText(queryText, 'RETRIEVAL_QUERY')
  if (!qEmbed) return []
  let snap
  try {
    snap = await getDocs(query(collection(db, 'rag_chunks'), where('sourceCollection', 'in', sourceCollections)))
  } catch { return [] }
  const scored = snap.docs
    .map(d => d.data())
    .map(c => ({ text: c.text, score: cosineSimilarity(qEmbed, c.embedding) }))
    .filter(c => c.score > 0.3) // ตัดทิ้งที่ไม่เกี่ยวข้องจริง กันไม่ให้ AI ได้ context สุ่มๆที่ทำให้ตอบสับสน
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK).map(c => c.text)
}
