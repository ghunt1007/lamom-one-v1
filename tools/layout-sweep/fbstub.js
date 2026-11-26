// Firebase stub for layout sweep — collection fixtures from window.__FIX
const FIX = () => (globalThis.__FIX || {})
const ref = (path, extra = {}) => ({ __path: path, path, id: String(path).split('/').pop(), ...extra })
export const initializeApp = () => ({}); export const getApps = () => []; export const deleteApp = async () => {}
export const initializeAppCheck = () => ({}); export class ReCaptchaV3Provider { constructor() {} }
export const getAuth = () => ({ currentUser: { uid: 'u1', email: 'owner@example.com' } }); export const connectAuthEmulator = () => {}
export const getFirestore = () => ({}); export const connectFirestoreEmulator = () => {}
export const signInWithEmailAndPassword = async () => ({}); export const signOut = async () => {}
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb({ uid: 'u1', email: 'owner@example.com' }), 0); return () => {} }
export const createUserWithEmailAndPassword = async () => ({ user: { uid: 'x' } }); export const sendPasswordResetEmail = async () => {}
export const reauthenticateWithCredential = async () => {}; export const updatePassword = async () => {}; export const verifyBeforeUpdateEmail = async () => {}
export const EmailAuthProvider = { credential: () => ({}) }
export const collection = (db, ...p) => ref(p.join('/'))
export const doc = (a, ...p) => ref(a && a.__path && !p.length ? a.__path + '/auto' : [a && a.__path, ...p].filter(Boolean).join('/'))
export const query = (r) => r; export const where = () => ({}); export const orderBy = () => ({}); export const limit = () => ({}); export const startAfter = () => ({}); export const documentId = () => '__id'
const snapOf = d => ({ id: d.id, ref: ref('x/' + d.id), exists: () => true, data: () => ({ ...d }), get: k => d[k] })
const docsFor = r => { const col = String(r.__path || '').split('/').filter((_, i) => i % 2 === 0).pop(); return (FIX()[col] || []) }
export const getDocs = async r => { const docs = docsFor(r).map(snapOf); return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) } }
export const getDoc = async r => { const parts = String(r.__path).split('/'); const d = (FIX()[parts[0]] || []).find(x => x.id === parts[1]); return d ? snapOf(d) : { id: parts[1], exists: () => false, data: () => undefined } }
export const onSnapshot = (r, cb) => { (async () => { if (String(r.__path).split('/').length % 2 === 0) cb(await getDoc(r)); else cb(await getDocs(r)) })(); return () => {} }
export const getCountFromServer = async r => ({ data: () => ({ count: docsFor(r).length }) })
export const addDoc = async () => ref('x/new'); export const setDoc = async () => {}; export const updateDoc = async () => {}; export const deleteDoc = async () => {}
export const serverTimestamp = () => new Date().toISOString(); export const increment = n => n; export const deleteField = () => null; export const arrayUnion = (...a) => a
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} })
export class Timestamp { constructor(s) { this.seconds = s } toDate() { return new Date(this.seconds * 1000) } static now() { return new Timestamp(Date.now() / 1000) } static fromDate(d) { return new Timestamp(d.getTime() / 1000) } }
