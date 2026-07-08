import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
// Firebase Storage ไม่ได้ใช้ — ใช้ Cloudflare R2 แทน (src/utils/storage.js)

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY        || 'AIzaSyPlaceholderKeyReplaceWithReal',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN    || 'lamom-one-v1.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID     || 'lamom-one-v1',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'lamom-one-v1.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID      || '000000000000',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID         || '1:000000000000:web:000000000000000000000000',
}

const app = initializeApp(firebaseConfig)

// P27 App Check — rate-limits Firebase API calls from legitimate app instances only.
// Activates when VITE_FIREBASE_APP_CHECK_KEY is set; skipped in dev/demo mode.
const appCheckKey = import.meta.env.VITE_FIREBASE_APP_CHECK_KEY
if (appCheckKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app

// Secondary app instance — used to create staff accounts from an admin session without
// signing the admin out (Firebase Auth client SDK signs in as whichever user was just created).
export function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === 'secondary')
  const secondaryApp = existing || initializeApp(firebaseConfig, 'secondary')
  return getAuth(secondaryApp)
}
