# Quickstart: Tidy 개발 환경 세팅

## 1. 준비물

| 도구 | 용도 | 확인 명령어 |
|---|---|---|
| Node.js 20 LTS 이상 | 웹 개발 | `node -v` |
| Git | 버전 기록 | `git --version` |
| VS Code (추천) | 코드 편집 | |
| Android Studio | 폰 앱 (Day 7) | |
| Rust | 컴퓨터 앱, Tauri (Day 7) | `rustc --version` |
| Mac + Xcode | iOS 앱 (선택) | |

## 2. 프로젝트 만들기 (Day 1)

```bash
# 저장소를 내려받은 폴더 안에서
npm create vite@latest . -- --template react-ts
npm install
npm install dexie dexie-react-hooks react-router-dom date-fns
npm install -D tailwindcss@3 postcss autoprefixer vite-plugin-pwa vitest fake-indexeddb
npx tailwindcss init -p
```

## 3. 실행

```bash
npm run dev          # 개발 서버 → http://localhost:5173
npm run dev -- --host  # 같은 와이파이의 폰에서 http://<컴퓨터IP>:5173 로 확인
npm run test         # 단위 테스트
npm run build        # 배포용 결과물 → dist/
```

## 4. 폰 앱 (Day 7)

```bash
npm install @capacitor/core @capacitor/browser @capacitor/filesystem @capacitor/share
npm install -D @capacitor/cli @capacitor/android
npx cap init Tidy com.tidy.app --web-dir dist
npx cap add android
npm run build && npx cap sync
npx cap open android   # Android Studio에서 ▶ 실행
```

iOS (Mac만): `npm install -D @capacitor/ios && npx cap add ios && npx cap open ios`

## 5. 컴퓨터 앱 (Day 7)

```bash
npm install -D @tauri-apps/cli
npm install @tauri-apps/plugin-opener @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
npx tauri init        # dev URL: http://localhost:5173, dist 경로: ../dist
npx tauri dev         # 창으로 실행
npx tauri build       # 설치 파일 생성
```

## 6. 확인 순서

1. 컴퓨터 브라우저(폭 1280px)에서 spec.md의 Acceptance Scenarios 확인
2. 개발자 도구의 기기 모드(폭 375px)에서 같은 시나리오 확인
3. 개발자 도구 → Network → Offline으로 오프라인 확인
4. 빌드한 폰 앱, 컴퓨터 앱에서 링크 열기와 백업 확인
