// Per-user AI memory — Firestore subcollections under users/{uid}
import { db } from '../core/firebase.js'
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { getState } from '../core/store.js'
import { deepSanitize } from '../core/db.js'

function userCol(sub) {
  const uid = getState('user')?.uid
  if (!uid) return null
  return collection(db, 'users', uid, sub)
}

export async function loadMemories(max = 40) {
  const col = userCol('ai_memories')
  if (!col) return []
  try {
    const snap = await getDocs(query(col, orderBy('importance', 'desc'), limit(max)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}

export async function addMemory(content, importance = 5) {
  if (!content?.trim()) return
  const col = userCol('ai_memories')
  if (!col) return
  try {
    // content เป็นข้อความที่ AI สรุปจากบทสนทนาผู้ใช้เอง — เขียนตรงผ่าน addDoc ที่นี่ ไม่ผ่าน
    // createDoc/updateDocData ที่กรอง XSS ให้อยู่แล้วปกติ จึงต้องกรองเองตรงนี้
    await addDoc(col, { content: deepSanitize(content.trim()), importance, createdAt: serverTimestamp() })
  } catch {}
}

export async function deleteMemory(memId) {
  if (!memId) return
  const uid = getState('user')?.uid
  if (!uid) return
  try { await deleteDoc(doc(db, 'users', uid, 'ai_memories', memId)) } catch {}
}

export async function saveMessage(role, content) {
  const col = userCol('ai_conversations')
  if (!col) return
  // content คือข้อความแชทของผู้ใช้เอง — เขียนตรงผ่าน addDoc ที่นี่ ไม่ผ่าน createDoc/updateDocData ที่กรอง
  // XSS ให้อยู่แล้วปกติ จึงต้องกรองเองตรงนี้
  try { await addDoc(col, { role, content: deepSanitize(content), createdAt: serverTimestamp() }) } catch {}
}

export async function loadRecentMessages(count = 16) {
  const col = userCol('ai_conversations')
  if (!col) return []
  try {
    const snap = await getDocs(query(col, orderBy('createdAt', 'desc'), limit(count)))
    return snap.docs.map(d => d.data()).reverse()
  } catch { return [] }
}

export function memoriesToContext(memories) {
  if (!memories?.length) return ''
  return '\n\n[สิ่งที่คุณรู้เกี่ยวกับผู้ใช้]\n' + memories.map(m => `• ${m.content}`).join('\n')
}
