/**
 * 구글 계정 로그인 상태 + 동기화 시작/끝을 한곳에서 관리한다 (화면은 useAccount 로 읽는다).
 */
import type { User } from 'firebase/auth'
import { firebaseReady } from '../firebaseConfig'
import { loadFirebase, onUserChange, signInWithEmail, signInWithGoogle, signOutGoogle } from '../../platform/firebase'
import { planFirstSync, startSync, stopSync, stopSyncAndForget } from './engine'
import { loadSync, setLoginSkipped } from './state'

export interface AccountUser {
  uid: string
  email: string
  name: string
  photo?: string
}

export interface AccountState {
  /** Firebase 설정이 들어 있다 (없으면 로그인 기능을 숨긴다) */
  available: boolean
  /** 저장된 로그인을 확인하는 중 */
  checking: boolean
  user: AccountUser | null
  /** 이 기기에도, 클라우드에도 데이터가 있어서 어느 쪽을 쓸지 물어봐야 한다 */
  needsChoice: boolean
  /** 동기화하던 계정인데 로그인이 풀렸다 */
  signedOutUnexpectedly: boolean
}

const REDIRECT_KEY = 'tidy-login-redirect'

let state: AccountState = {
  available: firebaseReady(),
  checking: firebaseReady() && (loadSync() != null || hasFlag(REDIRECT_KEY)),
  user: null,
  needsChoice: false,
  signedOutUnexpectedly: false,
}
const listeners = new Set<() => void>()
function set(patch: Partial<AccountState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const accountState = () => state
export function subscribeAccount(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function hasFlag(k: string) {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}
function setFlag(k: string, v: boolean) {
  try {
    if (v) localStorage.setItem(k, '1')
    else localStorage.removeItem(k)
  } catch {
    /* 무시 */
  }
}

const toUser = (u: User): AccountUser => ({ uid: u.uid, email: u.email ?? '', name: u.displayName ?? u.email ?? '', photo: u.photoURL ?? undefined })

let watching: Promise<void> | null = null
let lastUid: string | null = null

/** 로그인 상태를 지켜보기 시작한다. 로그인한 적 있는 기기만 앱을 켤 때 부른다 */
function watch(): Promise<void> {
  watching ??= onUserChange((u) => void handleUser(u)).then(() => undefined)
  watching.catch(() => {
    watching = null
    set({ checking: false })
  })
  return watching
}

async function handleUser(u: User | null) {
  setFlag(REDIRECT_KEY, false)
  if (!u) {
    lastUid = null
    stopSync()
    const s = loadSync()
    set({ user: null, checking: false, needsChoice: false, signedOutUnexpectedly: s != null })
    return
  }
  if (lastUid === u.uid) return
  lastUid = u.uid
  setLoginSkipped(false)
  set({ user: toUser(u), checking: false, signedOutUnexpectedly: false })
  const { db } = await loadFirebase()
  const plan = await planFirstSync(db, u.uid).catch(() => 'resume' as const)
  if (plan === 'choose') {
    set({ needsChoice: true })
    return
  }
  // 클라우드를 못 읽었는데(인터넷 없음) 처음 로그인이면 이 기기 것을 올린다
  await startSync(db, u.uid, u.email ?? undefined, plan === 'resume' && loadSync()?.uid !== u.uid ? 'upload' : plan)
}

/** 앱을 켤 때: 전에 로그인했으면 이어서 동기화한다 */
export function initAccount() {
  if (state.checking) void watch()
}

/** 구글로 로그인 (버튼) */
export async function login(): Promise<void> {
  await watch()
  setFlag(REDIRECT_KEY, true)
  try {
    await signInWithGoogle()
  } catch (err) {
    // 웹에서 페이지를 옮겨 로그인하러 가면 표시를 남겨 둔다 (돌아와서 이어서)
    if (!(err instanceof Error && err.message.includes('이동'))) setFlag(REDIRECT_KEY, false)
    throw err
  }
}

/** 이메일 + 비밀번호로 로그인 (테스트 계정) */
export async function loginWithEmail(email: string, password: string): Promise<void> {
  await watch()
  await signInWithEmail(email, password)
}

/** 이 기기와 클라우드 둘 다 데이터가 있을 때 고른 쪽으로 시작 */
export async function chooseFirstSync(mode: 'upload' | 'download') {
  const u = state.user
  if (!u) return
  const { db } = await loadFirebase()
  set({ needsChoice: false })
  await startSync(db, u.uid, u.email, mode)
}

/** 로그아웃. keepLocal=false 면 이 기기의 데이터도 지운다 (클라우드에는 남는다) */
export async function logout(keepLocal: boolean) {
  await stopSyncAndForget(keepLocal)
  lastUid = null
  await signOutGoogle().catch(() => undefined)
  set({ user: null, needsChoice: false, signedOutUnexpectedly: false })
}

/** 로그인 없이 쓰기 */
export function skipLogin() {
  setLoginSkipped(true)
}

/** 잠금 비밀번호를 잊어 이 기기를 초기화할 때: 클라우드는 지우지 않게 먼저 끊고 로그아웃한다 */
export async function forgetSyncBeforeWipe() {
  if (!loadSync()) return
  await logout(true).catch(() => undefined)
}
