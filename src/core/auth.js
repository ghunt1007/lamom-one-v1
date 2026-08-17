import { auth, db, getSecondaryAuth, deleteSecondaryApp } from './firebase.js'
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
import { setUser, setCompany, setCompanies, setActiveCompanyFilter, setState, showToast, getState } from './store.js'
import { navigate } from './router.js'
import { deepSanitize, createDoc, listDocs } from './db.js'
import { getClientIp } from '../utils/comms.js'
import { todayBangkok } from '../utils/format.js'

// (v1.0.350) IP Whitelist (เตือนเท่านั้น ไม่บล็อกจริง — Firestore Rules มองไม่เห็น IP ผู้เรียกได้เลย การ
// "บล็อกจริง" ต้องมี edge middleware ใหม่ทั้งชุดซึ่งเสี่ยงทำให้เจ้าของ/พนักงานเข้าระบบตัวเองไม่ได้ถ้าตั้งค่า
// ผิด — เลือกทำแค่บันทึก/เตือนแทน) — บันทึก session จริง + เทียบ IP กับ whitelist ทุกครั้งที่ login สำเร็จ
// เป็น best-effort เท่านั้น ห้ามทำให้ login ล้มเหลวไม่ว่า Worker/Firestore จะพังแบบไหนก็ตาม
function deviceLabel() {
  const ua = navigator.userAgent || ''
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'ไม่ทราบอุปกรณ์'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'ไม่ทราบเบราว์เซอร์'
  return `${os} · ${browser}`
}

async function registerSecuritySession(profile) {
  try {
    const ip = await getClientIp()
    const sessionId = await createDoc('security_sessions', {
      uid: profile.uid, user: profile.displayName || profile.email, device: deviceLabel(), ip: ip || 'ไม่พบ IP',
      lastActive: new Date().toISOString(),
    })
    localStorage.setItem('lamom_session_id', sessionId)
    if (ip) {
      const whitelist = (await listDocs('ip_whitelist', [], 'createdAt', 'desc', 200).catch(() => [])).filter(w => !w.deleted)
      if (whitelist.length && !whitelist.some(w => w.ip === ip)) {
        await createDoc('security_alerts', {
          level: 'warning', uid: profile.uid,
          msg: `เข้าสู่ระบบจาก IP ที่ไม่อยู่ใน Whitelist — ${profile.displayName || profile.email} จาก ${ip}`,
        })
      }
    }
  } catch (e) {
    console.error('registerSecuritySession error (non-blocking):', e)
  }
}

export async function register(email, password) {
  try {
    setState('loading', true)
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await loadUserProfile(cred.user)
    const profile = getState('user')
    if (profile) registerSecuritySession(profile)
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
    const profile = getState('user')
    if (profile) registerSecuritySession(profile)
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
  // เดิมไม่เคลียร์ role/companies/activeCompanyFilter เลย — บนอุปกรณ์ที่มีคนต่อกันใช้ (เช่นแท็บเล็ตที่ใครๆ
  // ก็ล็อกอินออกแล้วให้คนถัดไปล็อกอินใหม่) ค่าของบัญชีก่อนหน้าจะยังค้างอยู่ใน state/localStorage จนกว่า
  // loadUserProfile ของบัญชีถัดไปจะเขียนทับ ซึ่งปกติจะเขียนทับได้เร็วอยู่แล้ว แต่เคลียร์ตรงนี้เพื่อไม่ให้มีช่วง
  // สั้นๆที่ role/บริษัทของบัญชีเก่ายังค้างอยู่ในหน่วยความจำหลัง logout
  setState('role', null)
  setCompanies([])
  setActiveCompanyFilter([])
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
      // สิทธิ์แบบจำกัดเวลา — เช็คตอน login เท่านั้น (เหมือน active===false ด้านบน) ไม่ได้เช็คระหว่างใช้งาน
      // อยู่กลางหน้า ถ้าหมดอายุตอนกำลังใช้งาน จะบล็อกจริงตอน login ครั้งถัดไป (Firestore rules บังคับจริงเสมอ
      // ไม่ว่า client จะเช็คตรงนี้ทันเวลาหรือไม่)
      const expiresAt = profile.accessExpiresAt?.toDate ? profile.accessExpiresAt.toDate() : (profile.accessExpiresAt ? new Date(profile.accessExpiresAt) : null)
      if (expiresAt && expiresAt.getTime() < Date.now()) {
        await signOut(auth)
        setUser(null)
        showToast('สิทธิ์การใช้งานของคุณหมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อขอต่ออายุ', 'error', 8000)
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
      // รองรับ 1 user ทำงานหลายบริษัท — resolve companyMemberships เป็น org_companies doc จริง
      // ค่าเริ่มต้นของตัวกรอง = "ทั้งหมด" เสมอ (เห็นข้อมูลทุกบริษัทพร้อมกันก่อน) ยกเว้นมีตัวกรองเดิมจาก session ก่อนที่ยังใช้ได้อยู่
      const memberships = profile.companyMemberships || []
      if (memberships.length) {
        const companyDocs = await Promise.all(
          memberships.map(m => getDoc(doc(db, 'org_companies', m.companyId)).catch(() => null))
        )
        const companies = companyDocs.filter(s => s && s.exists()).map(s => ({ id: s.id, ...s.data() }))
        setCompanies(companies)
        const validIds = companies.map(c => c.id)
        const currentFilter = getState('activeCompanyFilter') || []
        const filterStillValid = currentFilter.length && currentFilter.every(id => validIds.includes(id))
        setActiveCompanyFilter(filterStillValid ? currentFilter : validIds)
      } else {
        setCompanies([])
        setActiveCompanyFilter([])
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
      // ผู้ใช้คนแรกของระบบ (ยังไม่มี meta/init) ได้เป็น owner โดยอัตโนมัติเพื่อ bootstrap
      // ส่วนคนที่สมัครถัดมาทุกคนต้องรอแอดมินอนุมัติสิทธิ์ก่อน (role: 'pending')
      // ป้องกันคนแปลกหน้าสมัครแล้วได้สิทธิ์ staff เข้าถึงข้อมูลลูกค้า/การเงินทันที
      const role = isFirstUser ? 'owner' : 'pending'
      const permissions = isFirstUser ? ['*'] : []
      const newProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        // displayName มาจาก provider (เช่น Google) ซึ่งผู้สมัครควบคุมได้เอง (ตั้งชื่อบัญชี Google ของตัวเอง
        // เป็นอะไรก็ได้) — เขียนตรงผ่าน setDoc ที่นี่ ไม่ผ่าน createDoc/updateDocData ที่กรอง XSS ให้อยู่แล้ว
        // ปกติ จึงต้องกรองเองตรงนี้
        displayName: deepSanitize(firebaseUser.displayName || firebaseUser.email),
        role,
        permissions,
        active: isFirstUser ? true : false,
        companyMemberships: [],
        primaryCompanyId: null,
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)
      if (isFirstUser) {
        await setDoc(doc(db, 'meta', 'init'), {
          ownerUid: firebaseUser.uid,
          ownerEmail: firebaseUser.email,
          createdAt: serverTimestamp(),
        })
        setUser(newProfile)
        setState('role', role)
        setState('permissions', permissions)
      } else {
        await signOut(auth)
        setUser(null)
        showToast('สร้างบัญชีสำเร็จ — กรุณารอผู้ดูแลระบบอนุมัติสิทธิ์ก่อนเข้าใช้งาน', 'warning', 8000)
        navigate('/login')
      }
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
export async function createStaffAccount({ name, email, password, role, accessExpiresAt, companyId, department, position }) {
  const secondaryAuth = getSecondaryAuth()
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid = cred.user.uid
    // ชื่อ/แผนก/ตำแหน่งพิมพ์เองโดยแอดมิน — เขียนตรงผ่าน setDoc ที่นี่ ไม่ผ่าน createDoc/updateDocData
    // ที่กรอง XSS ให้อยู่แล้วปกติ จึงต้องกรองเองตรงนี้
    const companyMemberships = companyId ? [{ companyId, role: role || 'staff', department: deepSanitize(department || ''), position: deepSanitize(position || ''), managerId: null }] : []
    await setDoc(doc(db, 'users', uid), {
      uid, email, displayName: deepSanitize(name || email),
      role: role || 'staff',
      permissions: [],
      active: true,
      accessExpiresAt: accessExpiresAt || null,
      companyMemberships,
      primaryCompanyId: companyId || null,
      createdBy: getState('user')?.uid || null,
      createdAt: serverTimestamp(),
    })
    // (v1.0.449) เดิมเรียกแค่ signOut(secondaryAuth) — ไม่ได้ทำลาย app instance จริง ตัวจับเวลา refresh token
    // อัตโนมัติที่เริ่มทำงานตอน createUserWithEmailAndPassword() ยังค้างอยู่เบื้องหลังต่อไปได้ พอทำงานอีกครั้ง
    // หลัง sign out ไปแล้วจะ throw แบบจับไม่ได้เลย (เจอจริงใน Error Log — ผูกกับหน้าที่แอดมินบังเอิญเปิดอยู่
    // ตอนนั้น ไม่ใช่หน้าที่เป็นสาเหตุจริง) deleteSecondaryApp() ทำลาย instance ทั้งตัว เคลียร์ timer จริง
    await deleteSecondaryApp()
    // (v1.0.430) เดิมสร้างบัญชี login (users) กับข้อมูลพนักงาน HR (staff) แยกกันคนละหน้าโดยสิ้นเชิง ไม่มี
    // field เชื่อมกันเลย — HR ต้องมากรอกซ้ำเองอีกรอบที่หน้า Staff แถมพิมพ์ชื่อ/แผนกไม่ตรงกับที่กรอกตอนสร้าง
    // บัญชีได้ ตอนนี้สร้างเอกสารพนักงาน HR ให้พร้อมกันเลยโดยผูก uid ไว้ตั้งแต่ต้น ข้อมูลจะตรงกันเสมอเพราะมา
    // จากฟอร์มเดียวกัน — พลาดได้ (เช่น Firestore Rules บล็อกเพราะสิทธิ์ไม่พอ) ไม่ทำให้การสร้างบัญชี login ล้ม
    // เพราะบัญชี login คือสิ่งที่ต้องมีแน่ๆ ส่วน staff doc ที่ขาดไปยังเชื่อมย้อนหลังได้ทีหลังจากหน้า Staff
    try {
      const nameParts = (name || '').trim().split(/\s+/)
      await createDoc('staff', {
        uid, firstName: nameParts[0] || name || email, lastName: nameParts.slice(1).join(' '),
        nickname: '', role: role || 'staff', position: position || '', dept: department || '', phone: '', email,
        startDate: todayBangkok(), status: 'active', companyId: companyId || null, managerId: null,
      })
    } catch (e) {}
    return { ok: true, uid }
  } catch (e) {
    try { await deleteSecondaryApp() } catch {}
    return { ok: false, error: authErrorMessage(e.code) }
  }
}

// อัปเดต companyMemberships ของ user ที่มีอยู่แล้ว (เช่น พนักงาน shared-service ที่ต้องดูแลหลายบริษัท)
export async function updateCompanyMemberships(uid, companyMemberships) {
  try {
    await setDoc(doc(db, 'users', uid), {
      // department/position เป็นข้อความพิมพ์เอง — เขียนตรงผ่าน setDoc ที่นี่ ไม่ผ่าน createDoc/updateDocData
      // ที่กรอง XSS ให้อยู่แล้วปกติ จึงต้องกรองเองตรงนี้
      companyMemberships: deepSanitize(companyMemberships || []),
      primaryCompanyId: companyMemberships?.[0]?.companyId || null,
    }, { merge: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'บันทึกไม่สำเร็จ' }
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email)
    return { ok: true }
  } catch (e) {
    // v1.0.314: ไม่บอกว่าอีเมลนี้มีบัญชีอยู่ในระบบหรือไม่ (email enumeration) — เดิม auth/user-not-found
    // แสดงข้อความ "ไม่พบบัญชีผู้ใช้นี้" ต่างจากกรณีสำเร็จอย่างชัดเจน ทำให้คนนอกลองพิมพ์อีเมลใครก็ได้แล้ว
    // ดูข้อความตอบกลับเพื่อเช็คว่าอีเมลนั้นมีบัญชีในระบบเราหรือไม่ — ตอบเหมือนสำเร็จเสมอสำหรับกรณีนี้
    // (Firebase เองก็ไม่ส่งอีเมลจริงถ้าไม่มีบัญชีอยู่แล้ว ผลลัพธ์จริงต่อผู้ใช้เหมือนกันทุกกรณี)
    if (e.code === 'auth/user-not-found') return { ok: true }
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
    'auth/email-already-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว — ถ้าเป็นบัญชีของคุณเอง กด "ลืมรหัสผ่าน?" เพื่อตั้งรหัสผ่านใหม่ แทนการสมัครซ้ำ',
    'auth/weak-password': 'รหัสผ่านไม่ปลอดภัยพอ กรุณาตั้งรหัสผ่านที่ซับซ้อนขึ้น',
    'auth/user-disabled': 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
    'auth/requires-recent-login': 'ต้องเข้าสู่ระบบใหม่อีกครั้งก่อนทำรายการนี้ (เพื่อความปลอดภัย)',
  }
  return map[code] || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}
