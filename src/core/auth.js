import { auth, db, getSecondaryAuth } from './firebase.js'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { setUser, setCompany, setState, showToast, getState } from './store.js'
import { navigate } from './router.js'

export async function register(email, password) {
  try {
    setState('loading', true)
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await loadUserProfile(cred.user)
    showToast('สร้างบัญชีสำเร็จ!', 'success')
    navigate('/')
  } catch (e) {
    setState('loading', false)
    const msg = authErrorMessage(e.code)
    showToast(msg, 'error', 6000)
    throw e
  }
}

export async function login(email, password) {
  try {
    setState('loading', true)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await loadUserProfile(cred.user)
    showToast('เข้าสู่ระบบสำเร็จ', 'success')
    navigate('/')
  } catch (e) {
    setState('loading', false)
    const msg = authErrorMessage(e.code)
    showToast(msg, 'error', 6000)
    throw e
  }
}

export async function logout() {
  await signOut(auth)
  setUser(null)
  setCompany(null)
  setState('permissions', [])
  navigate('/login')
}

export function initAuth(onReady) {
  let initialized = false
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      await loadUserProfile(firebaseUser)
    } else {
      setUser(null)
    }
    if (!initialized) {
      initialized = true
      onReady()
    }
  })
}

async function loadUserProfile(firebaseUser) {
  try {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
    if (snap.exists()) {
      const profile = { uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() }
      if (profile.active === false) {
        await signOut(auth)
        setUser(null)
        showToast('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 'error', 8000)
        navigate('/login')
        return
      }
      setUser(profile)
      setState('role', profile.role || 'staff')
      setState('permissions', profile.permissions || [])
      if (profile.companyId) {
        const compSnap = await getDoc(doc(db, 'companies', profile.companyId))
        if (compSnap.exists()) setCompany({ id: compSnap.id, ...compSnap.data() })
      }
    } else {
      // สร้าง profile ใหม่ — ใช้ meta/init เช็คว่าระบบถูก initialize ไปแล้วหรือยัง
      // (หลีกเลี่ยง collection query ที่ Firestore rules บล็อก)
      let isFirstUser = false
      try {
        const metaSnap = await getDoc(doc(db, 'meta', 'init'))
        isFirstUser = !metaSnap.exists()
      } catch {
        // meta read failed — default to staff
      }
      const role = isFirstUser ? 'owner' : 'staff'
      const permissions = isFirstUser ? ['*'] : []
      const newProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email,
        role,
        permissions,
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)
      if (isFirstUser) {
        await setDoc(doc(db, 'meta', 'init'), {
          ownerUid: firebaseUser.uid,
          ownerEmail: firebaseUser.email,
          createdAt: serverTimestamp(),
        })
      }
      setUser(newProfile)
      setState('role', role)
      setState('permissions', permissions)
    }
  } catch (e) {
    console.error('loadUserProfile error:', e)
  }
}

export function hasPermission(perm) {
  const permissions = getState('permissions') || []
  return permissions.includes('*') || permissions.includes(perm)
}

// ── Admin: manage staff accounts ────────────────────────────────────────────
// Uses a secondary Firebase Auth app instance so creating a new account doesn't
// sign the admin out of their own session (the client SDK signs in as whichever
// user was just created via createUserWithEmailAndPassword).
export async function createStaffAccount({ name, email, password, role }) {
  const secondaryAuth = getSecondaryAuth()
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid = cred.user.uid
    await setDoc(doc(db, 'users', uid), {
      uid, email, displayName: name || email,
      role: role || 'staff',
      permissions: [],
      active: true,
      createdBy: getState('user')?.uid || null,
      createdAt: serverTimestamp(),
    })
    await signOut(secondaryAuth)
    return { ok: true, uid }
  } catch (e) {
    try { await signOut(secondaryAuth) } catch {}
    return { ok: false, error: authErrorMessage(e.code) }
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: authErrorMessage(e.code) }
  }
}

// alias — เรียกจากหน้า User Management (แอดมินรีเซ็ตให้พนักงาน), ใช้ฟังก์ชันเดียวกับ resetPassword
export const sendStaffPasswordReset = resetPassword

// เปลี่ยนรหัสผ่านของตัวเอง — ต้อง reauthenticate ด้วยรหัสเดิมก่อน (ข้อกำหนดของ Firebase Auth)
export async function changeOwnPassword(currentPassword, newPassword) {
  const user = auth.currentUser
  if (!user || !user.email) return { ok: false, error: 'ไม่พบผู้ใช้ที่ login อยู่' }
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, cred)
    await updatePassword(user, newPassword)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: authErrorMessage(e.code) }
  }
}

function authErrorMessage(code) {
  const map = {
    'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้นี้',
    'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
    'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
    'auth/too-many-requests': 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่',
    'auth/network-request-failed': 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้',
    'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  }
  return map[code] || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}
