// Per-user AI memory — Firestore subcollections under users/{uid}
import { db } from '../core/firebase.js'
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { getState } from '../core/store.js'
import { demoStore, isDemoMode } from '../core/db.js'

function demoCol(col) {
  if (!demoStore[col]) demoStore[col] = {}
  return demoStore[col]
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function userCol(sub) {
  const uid = getState('user')?.uid
  if (!uid) return null
  return collection(db, 'users', uid, sub)
}

export async function loadMemories(max = 40) {
  if (isDemoMode()) {
    const rows = Object.values(demoCol('ai_memories')).filter(r => !r.deleted)
    rows.sort((a, b) => (b.importance || 0) - (a.importance || 0))
    return rows.slice(0, max)
  }
  const col = userCol('ai_memories')
  if (!col) return []
  try {
    const snap = await getDocs(query(col, orderBy('importance', 'desc'), limit(max)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}

export async function addMemory(content, importance = 5) {
  if (!content?.trim()) return
  if (isDemoMode()) {
    const id = genId()
    demoCol('ai_memories')[id] = { id, content: content.trim(), importance, createdAt: new Date().toISOString() }
    return
  }
  const col = userCol('ai_memories')
  if (!col) return
  try {
    await addDoc(col, { content: content.trim(), importance, createdAt: serverTimestamp() })
  } catch {}
}

export async function deleteMemory(memId) {
  if (!memId) return
  if (isDemoMode()) {
    const col = demoCol('ai_memories')
    if (col[memId]) col[memId].deleted = true
    return
  }
  const uid = getState('user')?.uid
  if (!uid) return
  try { await deleteDoc(doc(db, 'users', uid, 'ai_memories', memId)) } catch {}
}

export async function saveMessage(role, content) {
  if (isDemoMode()) {
    const id = genId()
    demoCol('ai_conversations')[id] = { id, role, content, createdAt: new Date().toISOString() }
    return
  }
  const col = userCol('ai_conversations')
  if (!col) return
  try { await addDoc(col, { role, content, createdAt: serverTimestamp() }) } catch {}
}

export async function loadRecentMessages(count = 16) {
  if (isDemoMode()) {
    const rows = Object.values(demoCol('ai_conversations')).filter(r => !r.deleted)
    rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    return rows.slice(-count)
  }
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
