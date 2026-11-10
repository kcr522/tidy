# Quickstart: Tidy 개발 환경 세팅

## 1. 준비물

| 도구 | 용도 | 확인 명령어 |
|---|---|---|
| Node.js 22 LTS 이상 | 웹 개발 | `node -v` |
| Git | 버전 기록 | `git --version` |
| VS Code (추천) | 코드 편집 | |
| Android Studio | 폰 앱 (Day 7) | |
| Mac + Xcode | iOS 앱 (선택) | |

## 2. 내려받기 (처음 한 번)

Day 1 세팅은 저장소에 이미 들어 있다.

```bash
git clone https://github.com/kcr522/tidy.git
cd tidy
npm install
```

이미 내려받았다면 `git pull` 후 `npm install`.

## 3. 실행

```bash
npm run dev          # 개발 서버 → http://localhost:5173
npm run dev -- --host  # 같은 와이파이의 폰에서 http://<컴퓨터IP>:5173 로 확인
npm run test         # 단위 테스트
npm run build        # 배포용 결과물 → dist/
```

## 4. 웹 배포 (Vercel, 무료)

저장소에 `vercel.json`이 들어 있어서 설정할 것이 거의 없다.

1. https://vercel.com 에서 **Continue with GitHub**로 가입한다.
2. **Add New… → Project** → `kcr522/tidy` 옆 **Import**를 누른다. (저장소가 안 보이면 "Adjust GitHub App Permissions"에서 tidy를 허용)
3. 설정은 그대로 두고 **Deploy**. 1~2분 뒤 `https://tidy-xxxx.vercel.app` 주소가 생긴다.
4. 이후 main에 합쳐질 때마다 자동으로 다시 배포된다. 앱을 다시 열면 새 버전으로 바뀐다(PWA 자동 업데이트).

폰에서 홈 화면에 추가하기:
- **아이폰 Safari**: 공유 버튼 → "홈 화면에 추가"
- **안드로이드 Chrome**: 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"

## 5. 폰 앱 (Capacitor)

`android/`, `ios/` 폴더와 앱 아이콘은 이미 만들어져 있다. 컴퓨터에 개발 도구만 설치하면 된다.

```bash
npm install
npm run app:ios       # 아이폰: 빌드 → Xcode 열림 (Mac + Xcode 필요)
npm run app:android   # 안드로이드: 빌드 → Android Studio 열림
```

- **아이폰**: App Store에서 Xcode 설치 → `npm run app:ios` → Xcode 위쪽에서 내 아이폰 선택 → ▶ 실행. 처음에는 Signing & Capabilities에서 Team에 내 Apple ID를 넣는다(무료 계정은 7일마다 다시 설치). 아이폰 설정 → 일반 → VPN 및 기기 관리에서 개발자를 신뢰해야 열린다.
- **안드로이드**: Android Studio 설치 → `npm run app:android` → 폰을 USB로 연결(개발자 옵션 → USB 디버깅 켜기) → ▶ 실행.
- 코드를 고친 뒤에는 `npm run app:sync`로 앱 안의 웹 파일을 다시 넣는다.
- 앱 아이콘을 바꾸려면 `assets/icon-only.png`(1024px)를 바꾸고 `npx @capacitor/assets generate`를 실행한다.

## 6. 컴퓨터 앱

따로 빌드하지 않는다. PWA로 배포한 웹 주소를 컴퓨터에서 연 뒤:

- **Chrome / Edge**: 주소창 오른쪽의 "앱 설치" 아이콘(모니터에 ↓ 모양) → 설치
- **macOS Safari**: 메뉴 "파일" → "Dock에 추가"

바탕화면(또는 Dock) 아이콘으로 별도 창에서 열린다.

## 7. 확인 순서

1. 컴퓨터 브라우저(폭 1280px)에서 spec.md의 Acceptance Scenarios 확인
2. 개발자 도구의 기기 모드(폭 375px)에서 같은 시나리오 확인
3. 개발자 도구 → Network → Offline으로 오프라인 확인
4. 빌드한 폰 앱과 컴퓨터에 설치한 PWA에서 링크 열기와 백업 확인
