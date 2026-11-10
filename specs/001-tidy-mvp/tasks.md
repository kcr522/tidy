---

description: "Tidy 1차 MVP 7일 작업 목록"
---

# Tasks: Tidy 1차 MVP (가계부 · 할 일 · 스크랩)

**Input**: Design documents from `/specs/001-tidy-mvp/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: 계산과 검사 로직(`src/lib/`, `src/repositories/`)만 Vitest 단위 테스트를 쓴다. 화면은 spec.md의 Acceptance Scenarios로 직접 확인한다.

**Organization**: User Story(US) 단위로 나누고, 원본 PDF의 7일 일정에 맞춰 Day를 붙였다. 각 Day가 끝나면 커밋 & 푸시한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 동시에 해도 되는 작업(서로 다른 파일, 의존 없음)
- **[Story]**: 해당 User Story (US1~US7)

## 일정 한눈에 보기

| Day | 단계 | User Story | 끝나면 되는 것 |
|---|---|---|---|
| 1 | Setup + Foundational | - | 빈 화면 5개 사이를 메뉴로 이동, DB 테이블 생성 |
| 2 | 가계부 | US1 (P1) | 수입/지출 기록, 월별 조회, 합계 |
| 3 | 할 일 | US2 (P1) | 할 일 추가/수정/삭제/완료 |
| 4 | 스크랩 | US3 (P1) | 링크 저장, 카드 목록, 열기 |
| 5 | 대시보드 + 연동 | US4 (P1), US5 (P2) | 첫 화면 요약, 스크랩 → 할 일 |
| 6 | 필터 + 다듬기 | US6 (P2) | 카테고리/탭/필터, 예외 처리, 디자인 |
| 7 | 백업 + 4개 환경 | US7 (P3) | 백업, PWA, 폰 앱, 컴퓨터 앱 |

---

## Phase 1: Setup — Day 1 오전

**Purpose**: 프로젝트 뼈대 만들기

- [x] T001 Vite + React + TypeScript 프로젝트 생성 (`quickstart.md` 2번)
- [x] T002 의존성 설치: dexie, dexie-react-hooks, react-router-dom, date-fns, tailwindcss, vite-plugin-pwa, vitest, fake-indexeddb
- [x] T003 [P] Tailwind 설정 (`@tailwindcss/vite`, `src/index.css`)
- [x] T004 [P] Vitest 설정 `vite.config.ts`의 `test` 항목, `npm run test` 스크립트 추가
- [x] T005 [P] `.gitignore`에 `node_modules`, `dist`, `android/app/build` 확인

---

## Phase 2: Foundational — Day 1 오후

**Purpose**: 모든 기능이 함께 쓰는 기반

**⚠️ CRITICAL**: 이 단계가 끝나야 US 작업을 시작할 수 있다

- [x] T006 타입 정의 `src/db/types.ts` (Transaction, Todo, Bookmark — data-model.md)
- [x] T007 Dexie 스키마 `src/db/database.ts` (data-model.md의 코드)
- [x] T008 [P] 금액/날짜 표시 함수 `src/lib/format.ts` (`15000` → `15,000원`, `2026-11-10` → `11월 10일 (화)`)
- [x] T009 [P] 입력 검사 함수 `src/lib/validate.ts` (금액 범위, 글자 수, URL 정규화와 검사)
- [x] T010 [P] 기본 카테고리 `src/lib/categories.ts` (FR-013)
- [x] T011 [P] `format`, `validate` 단위 테스트 `tests/unit/format.test.ts`, `tests/unit/validate.test.ts`
- [x] T012 공통 레이아웃 `src/components/layout/AppLayout.tsx`: 폭 768px 미만 BottomTabBar, 이상 SideNav (FR-002)
- [x] T013 라우터 `src/App.tsx`: `/`, `/money`, `/todos`, `/scraps`, `/settings` 빈 페이지 연결
- [x] T014 [P] 공통 컴포넌트 `src/components/common/`: Button, Modal(폰에서는 아래 시트), ConfirmDialog, EmptyState, Toast
- [x] T015 앱 이름 "Tidy", 로고 문구 "TIDY:", 기본 색상 정하기
- [x] T016 💾 커밋 & 푸시: `chore: 프로젝트 세팅과 레이아웃`

**Checkpoint**: 폰 폭/컴퓨터 폭에서 메뉴로 빈 화면 5개를 오갈 수 있다

---

## Phase 3: US1 — 수입/지출 기록하고 이번 달 내역 보기 (P1) 🎯 MVP — Day 2

**Goal**: 가계부 입력, 월별 목록, 합계

**Independent Test**: spec.md US1의 Acceptance Scenarios 1~6

- [x] T017 [US1] 저장소 `src/repositories/transactionRepo.ts`: add, update, remove, listByMonth(year, month)
- [x] T018 [P] [US1] 월 합계 계산 `src/lib/summary.ts`의 `monthSummary()` (수입, 지출, 잔액) + 테스트 `tests/unit/summary.test.ts`
- [x] T019 [US1] 입력 폼 `src/components/transactions/TransactionForm.tsx`: 구분 토글(기본 지출), 금액(쉼표 자동), 날짜(기본 오늘), 카테고리, 메모, 검사 안내 (FR-010~013)
- [x] T020 [US1] 월 요약 `src/components/transactions/MonthSummary.tsx`: 이전/다음 달 버튼, 총 수입/지출/잔액 (FR-015, FR-016)
- [x] T021 [US1] 목록 `src/components/transactions/TransactionList.tsx`: 날짜별 묶음, 그날 지출 합계, 수입 파랑/지출 빨강 (FR-014)
- [x] T022 [US1] 내역 눌러 수정, 삭제(확인 창) (FR-017, FR-007)
- [x] T023 [US1] 페이지 조립 `src/pages/TransactionsPage.tsx` + 빈 화면 안내 + 추가(+) 버튼
- [x] T024 [US1] US1 시나리오 1~6을 폰 폭/컴퓨터 폭에서 확인
- [x] T025 💾 커밋 & 푸시: `feat: 가계부 입력과 월별 내역`

**Checkpoint**: 가계부만으로 매일 기록할 수 있다

---

## Phase 4: US2 — 할 일 등록하고 완료 체크하기 (P1) — Day 3

**Goal**: 할 일 CRUD와 완료 체크, 오늘/전체 기본 목록

**Independent Test**: spec.md US2의 Acceptance Scenarios 1~5

- [x] T026 [US2] 저장소 `src/repositories/todoRepo.ts`: add, update, remove, toggleComplete(completedAt 기록), listAll, listToday
- [x] T027 [P] [US2] 오늘 할 일/정렬 계산 `src/lib/summary.ts`의 `todayTodos()`, `sortTodos()` + 테스트 (FR-023, FR-024)
- [x] T028 [US2] 입력 폼 `src/components/todos/TodoForm.tsx`: 제목, 마감일(선택), 중요도(기본 보통) (FR-020)
- [x] T029 [US2] 항목 `src/components/todos/TodoItem.tsx`: 체크박스, 취소선, 중요도 색, "기한 지남" 표시 (FR-021, FR-025)
- [x] T030 [US2] 페이지 `src/pages/TodosPage.tsx`: 오늘/전체 탭, 미완료 위 완료 아래, 빈 화면 안내
- [x] T031 [US2] 항목 눌러 수정, 삭제(확인 창) (FR-022)
- [x] T032 [US2] US2 시나리오 1~5 확인
- [x] T033 💾 커밋 & 푸시: `feat: 할 일 CRUD와 완료 체크`

**Checkpoint**: 할 일만으로 하루 일정을 관리할 수 있다

---

## Phase 5: US3 — 링크 스크랩하고 읽음 관리하기 (P1) — Day 4

**Goal**: 스크랩 저장, 카드 목록, 외부 링크 열기, 읽음 처리

**Independent Test**: spec.md US3의 Acceptance Scenarios 1~6

- [x] T034 [US3] 저장소 `src/repositories/bookmarkRepo.ts`: add, update, remove(연결된 todo의 bookmarkId 해제), toggleRead, findByUrl, list(filter)
- [x] T035 [P] [US3] 링크 열기 `src/platform/openUrl.ts`: 지금은 웹(`window.open(url, '_blank', 'noopener')`)만, Day 7에 앱 분기 추가
- [x] T036 [US3] 입력 폼 `src/components/bookmarks/BookmarkForm.tsx`: URL 자동 `https://`, 제목 비면 도메인, 중복 URL 확인 (FR-030~033)
- [x] T037 [US3] 카드 `src/components/bookmarks/BookmarkCard.tsx`: 제목, 도메인, 메모, 저장일, 읽음 토글, 열기(열면 읽음) (FR-034~036)
- [x] T038 [US3] 페이지 `src/pages/BookmarksPage.tsx`: 최근 순 카드 목록, 빈 화면 안내, 수정/삭제 (FR-038)
- [x] T039 [US3] US3 시나리오 1~6 확인
- [x] T040 💾 커밋 & 푸시: `feat: 스크랩 저장과 링크 열기`

**Checkpoint**: 세 가지 핵심 기능이 각각 동작한다

---

## Phase 6: US4 — 대시보드 (P1) + US5 — 스크랩 → 할 일 (P2) — Day 5

**Goal**: 첫 화면 요약과 기능 간 연동

**Independent Test**: spec.md US4 시나리오 1~5, US5 시나리오 1~5

### US4 대시보드

- [x] T041 [P] [US4] 대시보드 계산 `src/lib/summary.ts`의 `usageRate()`(수입 0이면 null), `todayExpense()` + 테스트
- [x] T042 [US4] 가계부 카드 `src/components/dashboard/MoneyCard.tsx`: 수입, 지출, 오늘 지출, 사용률 막대 (FR-051)
- [x] T043 [US4] 할 일 카드 `src/components/dashboard/TodayTodoCard.tsx`: "(3/5)", 최대 5개, 바로 체크 (FR-052)
- [x] T044 [US4] 스크랩 카드 `src/components/dashboard/UnreadScrapCard.tsx`: "(2)", 최대 3개 (FR-053)
- [x] T045 [US4] `src/pages/DashboardPage.tsx`: 폰 세로 3단, 컴퓨터 가로 3칸, 카드 제목 누르면 이동, 빠른 추가(+) (FR-050, FR-054, FR-055)
- [x] T046 [US4] 각 카드의 빈 상태 안내

### US5 스크랩 → 할 일

- [x] T047 [US5] `todoRepo.createFromBookmark(bookmarkId, dueDate)`: 제목 "읽기: {제목}", 중복 전환 막기 (FR-040, FR-041)
- [x] T048 [US5] `todoRepo.toggleComplete()`에서 완료 시 연결 스크랩 읽음 처리, 같은 Dexie 트랜잭션 (FR-042) + 테스트
- [x] T049 [US5] 날짜 선택 창 `src/components/bookmarks/ConvertToTodoDialog.tsx` (기본 오늘)
- [x] T050 [US5] 스크랩 카드와 대시보드 스크랩 카드에 [할 일로 전환] / "할 일 등록됨 · 할 일 보기" 표시
- [x] T051 [US5] TodoItem에 링크 아이콘 → `openUrl` (FR-043)
- [x] T052 [US4][US5] US4, US5 시나리오 확인
- [x] T053 💾 커밋 & 푸시: `feat: 대시보드와 스크랩→할 일 연동`

**Checkpoint**: P1 전부 + 핵심 연동 완료. 여기까지가 "쓸 수 있는 MVP"

---

## Phase 7: US6 — 카테고리와 필터 (P2) + 다듬기 — Day 6

**Goal**: 편의 기능과 예외 처리, 디자인 정돈

- [x] T054 [US6] 가계부 카테고리 필터, 필터 시 합계도 해당 카테고리 기준 (FR-018)
- [x] T055 [US6] 할 일 '오늘' 탭에 기한 지난 미완료 맨 위, 오늘 완료한 것은 아래 (FR-023)
- [x] T056 [US6] 스크랩 '전체'/'안 읽음' 필터 (FR-037)
- [x] T057 [P] 저장 실패 시 입력 유지 + "저장하지 못했어요" 토스트 (Edge Cases)
- [x] T058 [P] 긴 텍스트 말줄임, 글자 수 제한 표시 (Edge Cases)
- [x] T059 [P] 자정/월 변경 시 '오늘', '이번 달' 다시 계산 (앱이 다시 보일 때 `visibilitychange`로 갱신)
- [x] T060 디자인 정돈: 여백, 글자 크기, 버튼 크기(폰에서 최소 44px), 색상 통일
- [x] T061 spec.md 전체 Acceptance Scenarios 재확인 + 버그 수정
- [x] T062 💾 커밋 & 푸시: `feat: 필터와 예외 처리, UI 정돈`

---

## Phase 8: US7 — 백업과 네 가지 환경 (P3) — Day 7

**Goal**: 데이터 보호와 배포

**Independent Test**: spec.md US7 시나리오 1~6

### 백업

- [x] T063 [US7] `src/repositories/backupRepo.ts`: export(), import()(형식 검사 + 한 트랜잭션), clearAll() + 테스트 (FR-060~062)
- [x] T064 [US7] `src/platform/saveFile.ts`: 웹은 다운로드, 앱은 Capacitor Filesystem + Share
- [x] T065 [US7] `src/pages/SettingsPage.tsx`: 내보내기, 가져오기(덮어쓰기 확인), 전체 삭제("삭제" 입력), 앱 버전, 백업 안내 (FR-063)

### 웹 (폰 웹 + 컴퓨터 웹)

- [x] T066 [US7] vite-plugin-pwa 설정: 앱 이름, 아이콘 192/512px, 오프라인 캐시, `navigator.storage.persist()` 요청
- [ ] T067 [US7] GitHub Pages 또는 Vercel에 배포하고 폰/컴퓨터 브라우저에서 확인, 오프라인 확인 (FR-005)

### 폰 앱

- [x] T068 [US7] Capacitor 추가, `openUrl`에 `@capacitor/browser` 분기 (`quickstart.md` 4번)
- [ ] T069 [US7] Android 앱 빌드 후 실제 폰에 설치해 확인 (iOS는 Mac이 있으면 진행)

### 컴퓨터 앱

- [ ] T070 [US7] 컴퓨터 Chrome/Edge에서 PWA "앱 설치" 후 별도 창으로 열리는지 확인 (`quickstart.md` 5번)
- [ ] T071 [US7] 설치한 PWA에서 오프라인 실행, 링크 열기, 백업 확인

### 마무리

- [ ] T072 네 환경에서 백업 내보내기 → 다른 환경에서 가져오기 확인 (SC-006)
- [ ] T073 README의 "진행 상황"과 스크린샷 업데이트
- [ ] T074 💾 커밋 & 푸시 + 태그: `git tag v0.1.0 && git push --tags`

**Checkpoint**: 1차 MVP 완성 🎉

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: 반드시 순서대로
- **US1, US2, US3**: Phase 2 이후 서로 독립. 어떤 순서로 해도 된다(일정상 Day 2 → 3 → 4)
- **US4 대시보드**: US1, US2, US3의 저장소가 있어야 한다
- **US5 연동**: US2, US3가 끝나야 한다
- **US6**: 각 화면이 있어야 한다
- **US7**: 모든 기능이 끝난 뒤

## 일정이 밀릴 때

1. 먼저 미룰 것: T069 iOS (아이폰은 Safari "홈 화면에 추가"로 대신 가능)
2. 그다음: T054 카테고리 필터, T056 스크랩 필터
3. 절대 미루지 않을 것: US1~US4, 백업(T063~T065)
