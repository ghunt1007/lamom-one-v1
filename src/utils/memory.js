// Per-user AI memory — Firestore subcollections under users/{uid}
import { db } from '../core/firebase.js'
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { getState } from '../core/store.js'

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
  const col = userCol('ai_memories')
  if (!col || !content?.trim()) return
  try {
    await addDoc(col, { content: content.trim(), importance, createdAt: serverTimestamp() })
  } catch {}
}

export async function deleteMemory(memId) {
  const uid = getState('user')?.uid
  if (!uid || !memId) return
  try { await deleteDoc(doc(db, 'users', uid, 'ai_memories', memId)) } catch {}
}

export async function saveMessage(role, content) {
  const col = userCol('ai_conversations')
  if (!col) return
  try { await addDoc(col, { role, content, createdAt: serverTimestamp() }) } catch {}
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
