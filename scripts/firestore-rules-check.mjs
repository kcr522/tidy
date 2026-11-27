// Firestore 보안 규칙(firestore.rules) 확인 (보안 강화 2026-11-27)
// 내 자리는 읽고 쓰기 OK, 남의 자리 · 로그인 안 함 · aiUsage(하루 AI 횟수) 고치기는 거부되는지 에뮬레이터에서 본다.
// 돌리기: npm run test:rules   (firebase-tools 와 Java 가 필요해요)
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
const mk = (name, uid) => { const app = initializeApp({ projectId: 'demo-tidy', apiKey: 'x' }, name); const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080, uid ? { mockUserToken: { user_id: uid } } : undefined); return db }
const me = mk('me', 'u1'), other = mk('other', 'u2'), anon = mk('anon')
const cases = [
  ['내 rows 쓰기', () => setDoc(doc(me, 'users/u1/rows/todos~1'), { t: 'todos' }), true],
  ['내 rows 읽기', () => getDoc(doc(me, 'users/u1/rows/todos~1')), true],
  ['내 files 쓰기', () => setDoc(doc(me, 'users/u1/files/abc'), { d: 1 }), true],
  ['내 meta/devices 쓰기', () => setDoc(doc(me, 'users/u1/meta/devices'), { n: 1 }), true],
  ['내 route 날짜 쓰기', () => setDoc(doc(me, 'users/u1/route/2026-11-27'), { p: [] }), true],
  ['내 users 문서 쓰기', () => setDoc(doc(me, 'users/u1'), { a: 1 }), true],
  ['내 aiUsage 읽기', () => getDoc(doc(me, 'users/u1/aiUsage/2026-11-27')), true],
  ['내 aiUsage 쓰기(횟수 0으로)', () => setDoc(doc(me, 'users/u1/aiUsage/2026-11-27'), { count: 0 }), false],
  ['내 aiUsage 지우기', () => deleteDoc(doc(me, 'users/u1/aiUsage/2026-11-27')), false],
  ['남의 rows 읽기', () => getDoc(doc(other, 'users/u1/rows/todos~1')), false],
  ['남의 rows 쓰기', () => setDoc(doc(other, 'users/u1/rows/x'), { a: 1 }), false],
  ['로그인 안 하고 읽기', () => getDoc(doc(anon, 'users/u1/rows/todos~1')), false],
  ['users 밖 쓰기', () => setDoc(doc(me, 'public/x'), { a: 1 }), false],
]
let bad = 0
for (const [name, fn, want] of cases) {
  let ok = true
  try { await fn() } catch { ok = false }
  const pass = ok === want; if (!pass) bad++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: ${ok ? '허용' : '거부'} (기대 ${want ? '허용' : '거부'})`)
}
console.log(bad ? `실패 ${bad}` : `모두 통과 ${cases.length}개`)
process.exit(bad ? 1 : 0)
