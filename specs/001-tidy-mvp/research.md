# Research: Tidy 1차 MVP 기술 선택

조건: 네 가지 환경(폰 앱, 컴퓨터 앱, 폰 웹, 컴퓨터 웹), 서버 없음, 혼자 7일.

## 1. 화면을 무엇으로 만들까

**Decision**: React + TypeScript + Vite

**Rationale**: 웹 기술로 만들면 결과물이 그대로 웹사이트가 되고, 같은 결과물을 앱으로 감쌀 수 있다. 네 환경을 코드 하나로 해결하는 가장 쉬운 길이다. React는 자료와 예제가 가장 많고, Vite는 설정 없이 빠르게 시작할 수 있다.

**Alternatives considered**:
- Flutter: 앱 품질은 좋지만 Dart를 새로 배워야 하고, 웹 버전의 첫 로딩이 무겁다.
- React Native + Expo: 앱은 좋지만 웹/데스크톱 지원이 상대적으로 약하고 설정이 복잡하다.

## 2. 데이터를 어디에 저장할까

**Decision**: IndexedDB + Dexie.js (모든 환경 공통)

**Rationale**: IndexedDB는 모든 브라우저와 Capacitor/Tauri 앱 안의 웹뷰에 기본으로 들어 있어서, 환경마다 다른 DB를 쓸 필요가 없다. Dexie는 IndexedDB를 쉽게 쓰게 해 주고, `useLiveQuery`로 데이터가 바뀌면 화면이 자동으로 갱신된다.

**Alternatives considered**:
- SQLite (앱) + IndexedDB (웹) 이중 구성: 앱에서 더 튼튼하지만 저장 코드를 두 벌 만들어야 해서 7일 안에 어렵다. 저장소 계층(`src/repositories/`)을 두었으므로 2차에서 앱만 SQLite로 바꿀 수 있다.
- localStorage: 용량이 5MB 정도로 작고, 검색/정렬이 어렵다.

**주의**: 브라우저에서 데이터 삭제를 하면 IndexedDB도 지워진다. 그래서 JSON 백업(FR-060)을 필수로 넣었다. PWA는 `navigator.storage.persist()`를 요청해 브라우저가 임의로 지우지 않게 한다.

## 3. 웹은 어떻게 배포할까

**Decision**: PWA(vite-plugin-pwa) + GitHub Pages 또는 Vercel 무료 배포

**Rationale**: PWA로 만들면 한 번 연 뒤 오프라인에서도 열리고(FR-005), 폰 홈 화면이나 컴퓨터에 "앱 설치"도 된다. 정적 파일이라 무료로 배포할 수 있다.

## 4. 폰 앱은 어떻게 만들까

**Decision**: Capacitor

**Rationale**: `npm run build`로 나온 웹 결과물을 Android/iOS 앱으로 감싸 준다. 코드 수정 없이 몇 개 명령어로 앱이 된다. 링크 열기는 `@capacitor/browser`, 백업 파일 저장은 `@capacitor/filesystem` + `@capacitor/share`를 쓴다.

**필요한 것**: Android는 Android Studio. iOS는 Mac + Xcode(없으면 1차에서는 Android만, iOS는 PWA 홈 화면 추가로 대신).

## 5. 컴퓨터 앱은 어떻게 만들까

**Decision**: Tauri 2

**Rationale**: 웹 결과물을 Windows/macOS 앱으로 감싼다. Electron보다 설치 파일이 훨씬 작다(수 MB vs 100MB 이상). 링크 열기는 `@tauri-apps/plugin-opener`, 파일 저장은 `plugin-dialog` + `plugin-fs`를 쓴다.

**필요한 것**: Rust 설치(설치 프로그램 한 번 실행). Rust 설치가 어려우면 대안으로 Electron을 쓸 수 있다. 또한 데스크톱에서 PWA "앱 설치"만으로도 창 형태의 앱처럼 쓸 수 있다.

**Alternatives considered**:
- Electron: 자료가 많고 Rust가 필요 없지만 앱 용량이 크다.

## 6. 스타일은?

**Decision**: Tailwind CSS

**Rationale**: 클래스 이름만으로 반응형(`md:` 접두사)을 쉽게 만들 수 있어 폰/컴퓨터 레이아웃(FR-002)을 빠르게 구현한다.
