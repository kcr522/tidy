/**
 * Firebase (구글 로그인 + Firestore) 를 필요할 때만 불러온다.
 * 로그인하지 않고 쓰는 사람은 이 파일들을 받지 않아서 앱 시작이 느려지지 않는다.
 */
import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { firebaseConfig, firebaseReady, nativeSignInClientId } from '../lib/firebaseConfig'
import { GoogleAuthError, NativeAuth } from './googleAuth'
import { isNativeApp } from './native'

export interface Firebase {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let loading: Promise<Firebase> | null = null

export function loadFirebase(): Promise<Firebase> {
  if (!firebaseReady()) return Promise.reject(new Error('Firebase 설정이 아직 없어요'))
  loading ??= (async () => {
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    const app = initializeApp(firebaseConfig)
    // 폰 앱 안의 웹 화면에서는 팝업용 숨은 창을 쓰지 않는다 (로그인은 안드로이드 쪽에서 한다)
    const auth = isNativeApp() ? authMod.initializeAuth(app, { persistence: authMod.indexedDBLocalPersistence }) : authMod.getAuth(app)
    const db = fsMod.getFirestore(app)
    // 개발할 때만: 내 컴퓨터의 Firebase 에뮬레이터에 붙는다 (VITE_FIREBASE_EMULATOR=1)
    if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR === '1') {
      authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
      fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080)
    }
    return { app, auth, db }
  })()
  loading.catch(() => (loading = null))
  return loading
}

/** 지금 로그인한 사람 (처음 불러올 때는 저장된 로그인을 읽을 때까지 기다린다) */
export async function currentUser(): Promise<User | null> {
  const { auth } = await loadFirebase()
  await auth.authStateReady()
  return auth.currentUser
}

export async function onUserChange(fn: (u: User | null) => void): Promise<() => void> {
  const { auth } = await loadFirebase()
  const { onAuthStateChanged } = await import('firebase/auth')
  return onAuthStateChanged(auth, fn)
}

/** 구글 계정으로 로그인. 취소하면 GoogleAuthError(cancelled) */
export async function signInWithGoogle(): Promise<User> {
  const { auth } = await loadFirebase()
  const { GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect } = await import('firebase/auth')
  if (isNativeApp()) {
    if (!nativeSignInClientId) throw new GoogleAuthError('구글 로그인 설정(웹 클라이언트 ID)이 아직 없어요')
    let r
    try {
      r = await NativeAuth.signIn({ webClientId: nativeSignInClientId })
    } catch (err) {
      throw new GoogleAuthError(err instanceof Error ? err.message : '구글 로그인 오류')
    }
    if (r.cancelled || !r.idToken) throw new GoogleAuthError('구글 로그인을 취소했어요', true)
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(r.idToken))
    return cred.user
  }
  // 개발할 때만: 에뮬레이터에 가짜 구글 계정으로 들어간다 (구글 팝업은 에뮬레이터에서 못 띄운다)
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR === '1') {
    const fake = JSON.stringify({ sub: 'tester', email: 'tidy.tester@gmail.com', email_verified: true, name: '김채림' })
    return (await signInWithCredential(auth, GoogleAuthProvider.credential(fake))).user
  }
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    return (await signInWithPopup(auth, provider)).user
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw new GoogleAuthError('구글 로그인을 취소했어요', true)
    // 팝업이 막히면 페이지를 옮겨서 로그인한다 (돌아오면 저절로 로그인돼 있다)
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
      throw new GoogleAuthError('구글 로그인 화면으로 이동해요', true)
    }
    if (code === 'auth/unauthorized-domain') throw new GoogleAuthError('이 주소가 Firebase 로그인 허용 도메인에 없어요')
    if (code === 'auth/network-request-failed') throw new GoogleAuthError('인터넷 연결을 확인해 주세요')
    throw new GoogleAuthError('구글 로그인 오류' + (code ? ` (${code})` : ''))
  }
}

export async function signOutGoogle(): Promise<void> {
  const { auth } = await loadFirebase()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
  if (isNativeApp()) await NativeAuth.signOut().catch(() => undefined)
}
