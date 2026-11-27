# Tidy AI 켜기 (키를 서버에 한 번만 넣기)

사용자가 앱에서 키를 넣지 않아도 AI가 되도록, Vercel 서버에 무료 키를 한 번만 넣어 둬요.
키는 서버에만 있고 앱이나 휴대폰으로는 보내지 않아요. 구글 로그인한 사람만 쓸 수 있어요.

## 1. 무료 Gemini 키 만들기
1. https://aistudio.google.com/apikey 에 구글 계정으로 들어가요.
2. **Create API key**를 눌러요. 카드 등록은 필요 없어요.
3. `AIza…` 로 시작하는 키를 복사해요.

## 2. Vercel에 넣기
1. https://vercel.com → 팀 **tidy14** → 프로젝트 → **Settings** → **Environment Variables**
2. 아래를 넣고 Environment는 **Production, Preview** 둘 다 체크해요.

| 이름 | 값 | 꼭? |
|---|---|---|
| `GEMINI_API_KEY` | 1번에서 복사한 키 | 꼭 |
| `GROQ_API_KEY` | console.groq.com → API Keys 에서 만든 `gsk_…` 키 (Gemini 한도를 다 쓰면 대신 답해요) | 넣지 않아도 돼요 |
| `AI_DAILY_LIMIT` | 한 사람이 하루에 쓸 수 있는 횟수 (기본 50) | 넣지 않아도 돼요 |
| `AI_ALLOWED_EMAILS` | 쓸 수 있는 구글 메일 (쉼표로 구분). 비워 두면 로그인한 누구나. 인증된 메일만 통과해요 | 넣지 않아도 돼요 |
| `FIREBASE_SERVICE_ACCOUNT` | 관리자 페이지와 같은 서비스 계정 JSON ([관리자-페이지-설정.md](관리자-페이지-설정.md)). 하루 횟수를 서버만 셀 수 있게 해요 (2026-11-27 보안 강화부터) | 꼭 (새 Firestore 규칙을 넣은 뒤) |

3. **Deployments** → 맨 위 배포의 `⋯` → **Redeploy** 를 눌러야 새 값이 들어가요.

## 3. 확인
- 앱 → 설정 → AI 연결 → **Tidy AI (자동, 무료)** 아래에 "오늘 50번 남았어요"가 보이면 끝이에요.
- AI를 쓸 때마다 화면 위에 "Tidy AI · 오늘 N번 남았어요 · 이번 N토큰"이 잠깐 나와요.
- 쓴 횟수와 토큰은 각자의 Firestore 자리(`users/내 uid/aiUsage/날짜`)에 세요. 자정(한국 시간)에 다시 채워져요.

## 참고
- 모든 사람이 서버 키 하나를 같이 써요. 구글 무료 등급의 하루 한도(모델마다 다름)를 넘으면 예비 AI(Groq)로, 그것도 안 되면 기본(AI 없이)으로 답해요.
- 자기 Gemini 키를 넣은 사람은 계속 자기 키를 써요 (설정 → AI 연결 → Gemini (내 무료 키)).
- 로그인하지 않고 쓰는 사람은 기본(AI 없이)으로 답해요.
