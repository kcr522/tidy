# Implementation Plan: Tidy 1차 MVP (가계부 · 할 일 · 스크랩)

**Branch**: `001-tidy-mvp` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-tidy-mvp/spec.md`

## Summary

가계부, 할 일, 스크랩을 하나로 묶은 개인용 앱을 7일 안에 만든다. **웹 기술(React + TypeScript) 하나로 화면과 기능을 만들고**, 같은 결과물을 ① 웹사이트(PWA)로 배포해 폰/컴퓨터 브라우저에서 쓰고, ② Capacitor로 감싸 폰 앱, ③ Tauri로 감싸 컴퓨터 앱으로 만든다. 데이터는 서버 없이 기기 안의 IndexedDB에 Dexie.js로 저장한다. 선택 이유는 [research.md](./research.md)에 있다.

```text
               ┌──────────────── 하나의 코드 (React + TypeScript) ────────────────┐
               │   화면(pages, components)  →  저장소 계층(repositories)  →  Dexie  │
               └──────────────────────────────────────────────────────────────────┘
                          │ npm run build → dist/ (정적 파일)
        ┌─────────────────┼─────────────────────┬──────────────────────┐
        ▼                 ▼                     ▼                      ▼
   폰 웹 (PWA)      컴퓨터 웹 (PWA)      폰 앱 (Capacitor)      컴퓨터 앱 (Tauri)
   브라우저/홈화면    브라우저/설치         Android · iOS          Windows · macOS
```

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS 이상

**Primary Dependencies**: React 18, Vite 5, React Router 6, Tailwind CSS 3, Dexie 4 + dexie-react-hooks, vite-plugin-pwa, date-fns(ko 로케일), Capacitor 6(@capacitor/browser, @capacitor/filesystem, @capacitor/share), Tauri 2(@tauri-apps/plugin-opener, plugin-dialog, plugin-fs)

**Storage**: IndexedDB (Dexie.js). 모든 환경 공통. 스키마는 [data-model.md](./data-model.md)

**Testing**: Vitest(저장소 계층과 계산 함수 단위 테스트) + fake-indexeddb, 화면은 수동 시나리오 테스트(spec.md의 Acceptance Scenarios)

**Target Platform**: 모바일 웹/데스크톱 웹(최신 Chrome, Safari, Edge, Samsung Internet), Android 8+, iOS 15+, Windows 10+, macOS 12+

**Project Type**: 크로스 플랫폼 클라이언트 앱 (서버 없음)

**Performance Goals**: 첫 화면 2초 이내, 동작 반영 0.5초 이내, 내역 1,000건에서도 끊김 없음

**Constraints**: 오프라인 동작, 외부 서버 통신 없음, 1인 7일 개발

**Scale/Scope**: 사용자 1명, 화면 6개(대시보드, 가계부, 할 일, 스크랩, 설정, 입력 폼), 테이블 3개

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 | 결과 |
|---|---|---|
| I. 하나의 코드로 네 가지 환경 | 화면/기능은 `src/` 하나, 환경별 코드는 `src/platform/`와 `android/`, `ios/`, `src-tauri/` 패키징에만 | ✅ |
| II. 서버 없이, 기기 안에서 | IndexedDB만 사용, 서버 코드 없음, JSON 백업 FR-060~062 | ✅ |
| III. MVP 먼저 | tasks.md에서 P1 → P2 → P3 순서, 범위 밖 목록 명시 | ✅ |
| IV. 단순하게 | 상태 관리 라이브러리 없이 Dexie의 `useLiveQuery`로 화면 갱신, 저장소 계층 하나 | ✅ |
| V. 매일 기록하기 | tasks.md 각 Day 끝에 커밋 작업 포함 | ✅ |

## Project Structure

### Documentation (this feature)

```text
specs/001-tidy-mvp/
├── spec.md          # 상세 요구사항 (무엇을)
├── plan.md          # 이 파일 (어떻게)
├── research.md      # 기술 선택 이유
├── data-model.md    # DB 테이블과 규칙
├── quickstart.md    # 개발 환경 세팅과 실행 방법
└── tasks.md         # 7일 작업 목록
```

### Source Code (repository root)

```text
tidy/
├── index.html
├── package.json
├── vite.config.ts                 # PWA 설정 포함
├── tailwind.config.js
├── capacitor.config.ts            # 폰 앱 설정 (Day 7)
├── public/
│   └── icons/                     # 앱 아이콘 (192, 512px)
├── src/
│   ├── main.tsx                   # 시작점
│   ├── App.tsx                    # 라우터 + 레이아웃
│   ├── db/
│   │   ├── database.ts            # Dexie 스키마 정의
│   │   └── types.ts               # Transaction, Todo, Bookmark 타입
│   ├── repositories/              # 데이터 읽기/쓰기는 여기서만
│   │   ├── transactionRepo.ts
│   │   ├── todoRepo.ts
│   │   ├── bookmarkRepo.ts
│   │   └── backupRepo.ts
│   ├── lib/
│   │   ├── format.ts              # 금액, 날짜 표시
│   │   ├── validate.ts            # 금액, URL, 글자 수 검사
│   │   ├── categories.ts          # 기본 카테고리
│   │   └── summary.ts             # 월 합계, 사용률, 오늘 할 일 계산
│   ├── platform/
│   │   ├── openUrl.ts             # 웹: window.open / 앱: Capacitor Browser / 데스크톱: Tauri opener
│   │   └── saveFile.ts            # 백업 파일 저장 (환경별)
│   ├── components/
│   │   ├── layout/                # BottomTabBar, SideNav, AppLayout
│   │   ├── common/                # Button, Modal, ConfirmDialog, EmptyState, Toast
│   │   ├── transactions/          # TransactionForm, TransactionList, MonthSummary
│   │   ├── todos/                 # TodoForm, TodoItem, TodoTabs
│   │   └── bookmarks/             # BookmarkForm, BookmarkCard, ConvertToTodoDialog
│   └── pages/
│       ├── DashboardPage.tsx
│       ├── TransactionsPage.tsx
│       ├── TodosPage.tsx
│       ├── BookmarksPage.tsx
│       └── SettingsPage.tsx
├── tests/
│   └── unit/                      # summary, validate, repositories 테스트
├── android/                       # Capacitor가 생성 (Day 7)
├── ios/                           # Capacitor가 생성 (Day 7, Mac 필요)
└── src-tauri/                     # Tauri가 생성 (Day 7)
```

**Structure Decision**: 서버가 없는 단일 클라이언트 프로젝트. 모든 기능 코드는 `src/`에 두고, 데이터 접근은 `src/repositories/`로만 한다. 환경마다 다르게 동작해야 하는 두 가지(링크 열기, 파일 저장)만 `src/platform/`에서 환경을 판별해 처리한다.

## 화면 구성

| 경로 | 화면 | 주요 요구사항 |
|---|---|---|
| `/` | 대시보드 | FR-050~055 |
| `/money` | 가계부 (월 이동, 합계, 날짜별 목록, 필터) | FR-010~018 |
| `/todos` | 할 일 (오늘/전체 탭) | FR-020~025 |
| `/scraps` | 스크랩 (전체/안 읽음 필터, 카드) | FR-030~038, FR-040~044 |
| `/settings` | 설정 (내보내기, 가져오기, 전체 삭제, 버전) | FR-060~063 |

입력 폼은 페이지 이동 없이 모달(폰에서는 아래에서 올라오는 시트)로 띄운다.

## 핵심 로직

- **화면 자동 갱신**: Dexie의 `useLiveQuery`를 쓰면 DB가 바뀔 때 대시보드와 목록이 자동으로 다시 그려진다. 그래서 대시보드 숫자와 각 화면이 항상 일치한다(SC-007).
- **월 합계**: `date`가 해당 달 1일 이상, 다음 달 1일 미만인 내역을 `date` 인덱스로 조회해 수입/지출을 더한다.
- **오늘 할 일**: `(dueDate == 오늘) OR (dueDate < 오늘 AND isCompleted == false)`. 진행률은 그중 완료 수 / 전체 수.
- **스크랩 → 할 일 완료 연동**: `todoRepo.toggleComplete()`에서 완료로 바꿀 때 `bookmarkId`가 있으면 같은 트랜잭션 안에서 스크랩의 `isRead`를 true로 바꾼다.
- **링크 열기**: `openUrl(url)` 하나로 호출하고, 안에서 Capacitor/Tauri/웹을 판별한다.
- **백업**: `backupRepo.export()`가 세 테이블을 JSON으로 만들고, `import()`는 형식 검사 후 Dexie 트랜잭션 하나로 전부 지우고 다시 넣는다(중간 실패 시 원래대로).

## Complexity Tracking

> 헌법 위반 사항 없음.
