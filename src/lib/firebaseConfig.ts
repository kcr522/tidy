/**
 * 구글 로그인 + 기기 동기화에 쓰는 Firebase 설정.
 *
 * Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) 에 나오는 값을 아래 FIREBASE 에 붙여 넣으면 된다.
 * 이 값들은 비밀번호가 아니라 "어느 Firebase 프로젝트인지" 알려 주는 공개 값이라 코드에 넣어도 괜찮다
 * (데이터는 Firestore 보안 규칙이 지켜 준다: 로그인한 본인 것만 읽고 쓸 수 있다).
 * Vercel 환경 변수(VITE_FIREBASE_…)로 넣어도 되고, 그쪽이 먼저다.
 *
 * WEB_CLIENT_ID: Firebase 콘솔 → Authentication → 로그인 방법 → Google → "웹 SDK 구성"의 웹 클라이언트 ID.
 * 갤럭시 앱에서 구글 로그인할 때 쓴다.
 */
const FIREBASE = {
  apiKey: 'AIzaSyAlkxWKQPttsDaUo4Obe_nX36mz1IsKM7o',
  authDomain: 'tidy-b0d8d.firebaseapp.com',
  projectId: 'tidy-b0d8d',
  appId: '1:735899105039:web:29279d0d19ab773512f07a',
}
const WEB_CLIENT_ID = '735899105039-5d43litd03sol3rs6f55fk5taevsemfh.apps.googleusercontent.com'

const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || FIREBASE.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || FIREBASE.projectId,
  appId: env.VITE_FIREBASE_APP_ID || FIREBASE.appId,
}

/** Firebase(TIDY) 프로젝트의 웹 클라이언트 ID (웹에서 구글 캘린더 연결에 쓴다) */
export const firebaseWebClientId: string = env.VITE_GOOGLE_WEB_CLIENT_ID || WEB_CLIENT_ID

/**
 * 갤럭시 앱 구글 로그인에 쓰는 웹 클라이언트 ID.
 * 갤럭시 앱(패키지 + SHA-1)은 구글 캘린더 때문에 먼저 만든 "Creat" 프로젝트에 등록돼 있고, 같은 앱은 한 프로젝트에만 등록할 수 있다.
 * 그래서 Creat 프로젝트의 웹 클라이언트로 ID 토큰을 받고, Firebase → Authentication → Google →
 * "외부 프로젝트의 클라이언트 ID 허용 목록"에 이 ID를 넣어 TIDY 가 받아 주게 한다.
 */
export const nativeSignInClientId: string = env.VITE_NATIVE_SIGNIN_CLIENT_ID || '191657953450-ibqv63uisrrcu0b07mbq9bkughh59mrv.apps.googleusercontent.com'

/** 설정이 들어 있어야 로그인 화면이 나온다 */
export const firebaseReady = (): boolean => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
