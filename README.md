<div align="center">

<img src="public/icons/icon-192.png" width="96" alt="Tidy 로고">

# TIDY:

**돈, 할 일, 읽을거리, 하루 기록을 한곳에서 깔끔하게.**

가계부 · 할 일 · 스크랩 · 캘린더 · 일기를 하나로 묶은 개인용 생활 정리 앱

[🌐 웹에서 바로 열기](https://tidy-gules.vercel.app) &nbsp;·&nbsp; [📱 안드로이드 앱 받기](https://github.com/kcr522/tidy/releases/latest) &nbsp;·&nbsp; [📄 개발 기록](docs/개발-기록.md)

`1차 MVP 완성` · `2차 완성` · `3차 완성` · `계속 다듬는 중`

</div>

---

## 소개

> **TIDY** (타이디 / TidyUp): '정돈된, 깔끔한'이라는 뜻이에요. 흩어진 일상을 한곳에 깔끔하게 정리해 준다는 마음을 담았어요.

돈 관리는 가계부 앱, 할 일은 투두 앱, 나중에 볼 링크는 메모장이나 인스타 저장, 일정은 캘린더, 하루 기록은 일기장. 이렇게 앱을 여러 개 오가다 보면 정작 **"이번 달 얼마 썼지? 오늘 뭐 해야 하지? 저장해 둔 그 글 어디 있지?"** 를 한 번에 알기 어려워요.

**Tidy**는 매일 쓰는 이 기록들을 **앱 하나**에 모은 개인용 생활 정리 앱이에요. 앱을 열면 첫 화면에서 이번 달 돈 흐름, 오늘 할 일, 다가오는 월급날, 오늘 습관, 아직 안 읽은 스크랩을 한눈에 볼 수 있어요. 그리고 기록끼리 서로 이어져요. 스크랩한 글은 버튼 하나로 "읽기" 할 일이 되고, 적금은 습관과 연결되고, 일기 사진과 일정과 지출은 한 달력에 모여요.

### Tidy가 지키는 것

| | 원칙 | 이렇게 했어요 |
|:---:|:---|---|
| 🧩 | **한 앱, 네 곳** | 하나의 코드로 안드로이드 앱 · 컴퓨터 앱(PWA 설치) · 폰 웹 · 컴퓨터 웹에서 똑같이 돌아가요 |
| 📴 | **내 기기가 먼저** | 모든 기록은 먼저 기기 안 DB(IndexedDB)에 저장돼서 인터넷이 없어도 써요. 구글 로그인을 하면 내 계정 공간에만 동기화돼요 (로그인 없이도 쓸 수 있어요) |
| 🆓 | **AI는 무료로만** | 유료 AI는 쓰지 않아요. Gemini 무료 → Groq 무료 → 인터넷 없는 기본 모드 순서로 넘어가고, 일정 · 지출 같은 질문은 AI 없이 내 기록에서 바로 답해요 |
| 🪶 | **앱은 가볍게** | AI 모델을 앱에 넣지 않고, 글자 인식 · 아이폰 사진 변환은 쓸 때만 불러와요 |
| ✍️ | **입력은 최소로** | 은행 캡처 → 가계부, 포스터 사진 → 일정, 공유 버튼 → 스크랩. 찍거나 공유만 하면 기록돼요 |
| 🔒 | **내 기록은 나만** | 앱 잠금(PIN · 비밀번호 · 지문), 사용자별 Firestore 규칙, 위험한 링크 차단 |

<div align="center">
<img src="docs/screenshots/tidy-ai-1-dashboard.png" width="230"> &nbsp; <img src="docs/screenshots/design-desktop.png" width="560">
</div>

## 주요 기능

### 💳 가계부
- 수입 · 지출을 금액, 날짜, 시간, 카테고리, 결제 수단, 메모와 함께 기록하고 **목록 / 달력**으로 보기
- 이번 달 수입 · 지출 · 잔액, **한 달 예산**(전체 + 카테고리별), **월간 리포트**
- **은행 · 카드 캡처로 입력**: 기기 안 글자 인식(무료)으로 날짜 · 금액 · 가게를 읽고 확인 후 저장
- 정기 내역 자동 기록 + **월급 D-day**, 금액이 일정하지 않은 월급은 월급날마다 물어보기
- 다이소 · 올리브영 같은 **가게 로고**, KCP · NICE 같은 결제 대행사 이름은 "어디서 쓴 거예요?" 묻고 기억
- ≡ 메뉴: 직접 그린 차트, 통계, 고정 금액 / **적금**: 만기 금액(세전 · 세후), 자동 납입, 납입일 알림
- **AI 소비 한마디**: 피드백 · 절약 잔소리 · 무조건 칭찬 세 가지 말투

### ✅ 할 일 · 🔥 습관
- 할 일 추가 · 수정 · 완료 체크, 마감일과 중요도, **오늘 / 나중 / 전체** 탭
- **반복 할 일**(매일 · 매주 · 매달)과 정한 시간 **알림**, 끝낸 만큼 차오르는 **할 일 캘린더**
- **습관 트래커**: 날짜별 체크, 연속 일수 🔥, 이모티콘 200개 넘게 중에서 고르기

### 🔖 스크랩
- 링크를 저장하면 제목 · 썸네일 · 출처(Instagram, X, YouTube, 네이버 등)가 자동으로 채워지는 **미리보기 카드**
- 인스타 · X 앱의 **"공유 → Tidy에 스크랩"** 으로 바로 저장, 게시물 **캡션 · 본문도 1만 자까지** 같이 저장
- 저장하면 **서버가 사이트 화면을 자동 캡처** → "편집" 또는 "그냥 올리기". 게시물이 지워져도 캡처로 남아요
- **AI 요약**: 제목만이 아니라 사이트 안의 글과 사진까지 읽고 정리
- 카테고리, 인스타 릴스 · X 영상 앱 안에서 보기, **스크랩 → 할 일** 전환(완료하면 스크랩도 읽음 처리)

### 📅 캘린더 · 📔 일기
- 여러 날 일정 막대, 날짜를 누르면 그날 일정 · 할 일 · 지출을 바로 보기, **한국 공휴일**(음력 · 대체공휴일 계산)
- 일정 색 21가지, 날짜 칸 **이모티콘 스티커**, 일정 메모에 사진 · 파일 첨부
- **구글 캘린더 연동**: 내 구글 캘린더를 최대 5개까지 색별로 불러오고, Tidy 일정을 구글로 보내기
- **일기**: 하루 글 + 사진 10장 타임라인(찍은 시간 · 한 줄 메모), 자동 저장, 일기 달력과 대표 사진, 아이폰 사진(HEIC)

### 🗒️ 메모
- 제목 · 글에 **사진 · 영상 · 파일**(하나 50MB까지)을 같이 넣고, 쓰는 대로 자동 저장
- **쓴 시각이 그대로 기록**되고 날짜별 · 시간순으로 보여요. 중요한 건 맨 위에 고정
- 비슷한 메모를 모으는 **파일집**(12가지 색), 메모 안에서 검색 + 전체 검색
- **손글씨**: 손가락 · 펜으로 쓰면 AI가 글자로 읽어서 손글씨 내용으로도 검색돼요
- **메모 위젯**: 홈 화면에서 최근 메모를 보고, 누르면 바로 그 메모 · + 로 새 메모

### ✨ AI 비서 (무료)
- 오른쪽 아래 동그라미 버튼: **포스터 사진 → 일정, 결제 내역 캡처 → 가계부, 오늘 이야기 → 일기**
- **물어보기**: 예금 · 적금 · 청년 상품 · 돈 관리 질문을 구글 검색 출처와 함께 답해요
- **내 기록에서 바로 답하기**: "이번 주 일정 뭐야?", "이번 달 식비 얼마야?"는 AI 없이 바로
- **Tidy AI**: 키를 넣지 않아도 서버의 무료 Gemini로 하루 한도 안에서 쓰고, 남은 횟수를 보여 줘요

### 🎨 화면 · 꾸미기
- 토스처럼 둥근 카드와 **켤 때마다 바뀌는 3색 그라데이션**, 다크 / 라이트 / 자동
- 구역마다 **꾸미기 사진** 10장(투명도 · 맞춤), 체크 색, 메뉴 색, 시작 화면 사진
- **전체 검색**으로 가계부 · 할 일 · 스크랩 · 일기 · 메모 · 일정을 한 번에 찾기

### 🔐 계정 · 보안 · 앱
- **구글 로그인 + 기기 동기화**(일기 사진 포함), 로그인 없이 이 기기에서만 쓰기도 가능
- **앱 잠금**: 4자리 PIN 또는 8자리 이상 비밀번호, 안드로이드는 지문
- **백업**: JSON 내보내기 / 가져오기, 자동 백업(정해진 때 · 열 때마다)
- **갤럭시 홈 화면 위젯**, 앱 안에서 바로 업데이트(새 버전 알림 → 설치)

> 기능별 PR 번호와 상태는 [개발 기록 · 4. 기능 목록](docs/개발-기록.md#4-기능-목록)에 모두 정리되어 있어요.

## 화면 미리보기

> 만들면서 찍은 실제 화면이에요. 새 기능이 생길 때마다 [docs/screenshots](docs/screenshots)에 더해요.

**메모** (쓴 시각 기록 · 사진 · 영상 · 파일 · 색깔 파일집 · 검색)

| 메모 목록 | 파일집 | 메모 쓰기 | 파일집 색 고르기 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/memo-1-list-phone.png" width="200"> | <img src="docs/screenshots/memo-2-folder-phone.png" width="200"> | <img src="docs/screenshots/memo-3-editor-phone.png" width="200"> | <img src="docs/screenshots/memo-4-new-folder-phone.png" width="200"> |

**3차 · 편의 기능** (앱 잠금 · 위젯 · 예산 · 월간 리포트 · 전체 검색 · 구글 캘린더)

| 홈 화면 위젯 | 한 달 예산 | 월간 리포트 | 전체 검색 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/widget-4-home.png" width="200"> | <img src="docs/screenshots/budget-1-money.png" width="200"> | <img src="docs/screenshots/report-1-top.png" width="200"> | <img src="docs/screenshots/search-results.png" width="200"> |

| 구글 캘린더 불러오기 | 할 일 캘린더 | 일기 달력 | 앱 안에서 업데이트 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/gcal-3-calendar.png" width="200"> | <img src="docs/screenshots/todo-cal-month.png" width="200"> | <img src="docs/screenshots/diary-cal-2-diary-calendar.png" width="200"> | <img src="docs/screenshots/update-1-popup.png" width="200"> |

**스크랩 자동 캡처 · 공유로 저장**: 링크를 저장하면 서버가 사이트 화면을 찍어 오고, 인스타 · X의 "공유 → Tidy에 스크랩"으로 바로 저장해요. 캡션은 1만 자까지 같이 저장돼요.

| 자동 캡처 중 | 캡처 확인 (편집 / 그냥 올리기) | 공유로 저장 | 캡션 전체 보기 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/scrap-auto-phone-1-capturing.png" width="200"> | <img src="docs/screenshots/scrap-auto-phone-2-shot.png" width="200"> | <img src="docs/screenshots/share-1-form.png" width="200"> | <img src="docs/screenshots/caption-3-full.png" width="200"> |

**습관 아이콘 고르기**: 아이콘 줄 끝의 "+"를 누르면 주제별 이모티콘 200개 넘게 중에서 고르고, 없으면 키보드로 직접 넣어요. 고른 건 다음부터 앞줄에 나와요.

| "+" 고르기 창 | 주제 바꾸기 | 고른 아이콘 | 분할 화면 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/habit-emoji-2-picker.png" width="200"> | <img src="docs/screenshots/habit-emoji-3-tab.png" width="200"> | <img src="docs/screenshots/habit-emoji-4-picked.png" width="200"> | <img src="docs/screenshots/habit-emoji-5-split.png" width="200"> |

| 폰 (대시보드) | 폰 (가계부) | 폰 (할 일) | 폰 (스크랩) |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/design-dashboard.png" width="200"> | <img src="docs/screenshots/design-money-all.png" width="200"> | <img src="docs/screenshots/design-todos.png" width="200"> | <img src="docs/screenshots/design-scraps.png" width="200"> |

**구글 로그인 + 기기 동기화** (켜는 방법: [docs/구글-로그인-설정.md](docs/구글-로그인-설정.md))

| 첫 화면 로그인 | 설정 → 계정 | 고르기 | 다른 기기에 온 일기 사진 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/login-1-login.png" width="200"> | <img src="docs/screenshots/login-2-settings-account.png" width="200"> | <img src="docs/screenshots/login-6-choose.png" width="200"> | <img src="docs/screenshots/login-7-diary-photo-synced.png" width="200"> |

**Tidy AI** (키 없이 바로 쓰는 AI): 서버에 미리 넣어 둔 무료 Gemini 키로 묻고, 쓸 때마다 오늘 남은 횟수와 토큰을 보여 줘요. 켜는 방법: [docs/Tidy-AI-설정.md](docs/Tidy-AI-설정.md)

| 쓸 때마다 남은 횟수 | AI 비서 | 설정 → AI 연결 |
|:---:|:---:|:---:|
| <img src="docs/screenshots/tidy-ai-1-dashboard.png" width="200"> | <img src="docs/screenshots/tidy-ai-2-assistant.png" width="200"> | <img src="docs/screenshots/tidy-ai-3-settings.png" width="200"> |

**앱 잠금** (설정): 숫자 4자리 또는 8자리 이상 비밀번호 중에 고르고, 안드로이드 앱에서는 지문으로도 풀기

| 잠금 방식 고르기 | 비밀번호 정하기 | 비밀번호 잠금 화면 | 지문으로 풀기 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/lock2-2-kind.png" width="200"> | <img src="docs/screenshots/lock2-4-password-set.png" width="200"> | <img src="docs/screenshots/lock2-6-lockscreen-password.png" width="200"> | <img src="docs/screenshots/lock2-8-lockscreen-bio.png" width="200"> |

**AI 비서** (첫 화면 오른쪽 아래 동그라미): 포스터 → 캘린더, 결제 내역 캡처 → 가계부, 오늘 이야기 → 일기

| 포스터 사진 | 결제 내역 캡처 | 오늘 있었던 일 | 내가 등록할게 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/ai-3-poster.png" width="200"> | <img src="docs/screenshots/ai-5-payment.png" width="200"> | <img src="docs/screenshots/ai-7-diary.png" width="200"> | <img src="docs/screenshots/ai-4-calendar-form.png" width="200"> |

**스크랩 바로 캡처** (안드로이드 앱): 저장 → "캡처할래요?" → 앱 안에서 사이트 열기 → 캡처 → 자르기

| 캡처할래요? | 앱 안 사이트 (모형) | 자르기 | 저장된 캡처 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/capture-1-ask.png" width="200"> | <img src="docs/screenshots/capture-2-inapp.png" width="200"> | <img src="docs/screenshots/capture-3-crop.png" width="200"> | <img src="docs/screenshots/capture-4-detail.png" width="200"> |

**2차 새 화면**

| 일기 타임라인 | 습관 | 적금 | 꾸미기 사진 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/diary-timeline.png" width="200"> | <img src="docs/screenshots/habit-list.png" width="200"> | <img src="docs/screenshots/savings-detail.png" width="200"> | <img src="docs/screenshots/customize-multi-photos.png" width="200"> |

| 캘린더 | 가계부 달력 | 캡처로 입력 | AI 연결 (Groq 예비) |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/p2-cal-month.png" width="200"> | <img src="docs/screenshots/p2-money-calendar.png" width="200"> | <img src="docs/screenshots/ocr-review-dialog.png" width="200"> | <img src="docs/screenshots/ai-groq-backup.png" width="200"> |

<img src="docs/screenshots/design-desktop.png" width="720">

**디자인**: 토스처럼 둥글고 깔끔한 카드, 글씨체는 Pretendard. 색은 **앱을 켤 때마다 랜덤**이에요. 대시보드, 가계부, 할 일, 스크랩이 각자 세 가지 색 그라데이션을 하나씩 받아요. 견본 18개(파스텔, 쨍한 색, 무채색) 중에서 고르거나 어울리는 세 색을 새로 만들고, 밝은 색이면 글자를 검정으로 바꿔요.

**켤 때마다 바뀌는 색** (같은 데이터로 새로고침 여섯 번)

<img src="docs/screenshots/design-launch-grid.png" width="720">

<details>
<summary>날짜별 화면 전체 보기</summary>

**Day 1 · 기본 화면과 메뉴**

<img src="docs/screenshots/day1-mobile.png" width="240"> <img src="docs/screenshots/day1-desktop.png" width="420">

**Day 2 · 가계부**

<img src="docs/screenshots/day2-list.png" width="240"> <img src="docs/screenshots/day2-validate.png" width="240"> <img src="docs/screenshots/day2-desktop.png" width="420">

**Day 3 · 할 일**

<img src="docs/screenshots/day3-today.png" width="240"> <img src="docs/screenshots/day3-all.png" width="240">

**Day 4 · 스크랩**

<img src="docs/screenshots/day4-list.png" width="240"> <img src="docs/screenshots/day4-desktop.png" width="420">

**Day 5 · 대시보드와 스크랩 → 할 일**

<img src="docs/screenshots/day5-dashboard.png" width="240"> <img src="docs/screenshots/day5-empty.png" width="240"> <img src="docs/screenshots/day5-convert.png" width="240"> <img src="docs/screenshots/day5-scraps.png" width="240"> <img src="docs/screenshots/day5-todos.png" width="240"> <img src="docs/screenshots/day5-desktop.png" width="420">

**Day 6 · 카테고리 필터와 예외 처리**

<img src="docs/screenshots/day6-money-all.png" width="240"> <img src="docs/screenshots/day6-filter.png" width="240"> <img src="docs/screenshots/day6-save-fail.png" width="240"> <img src="docs/screenshots/day6-midnight.png" width="240">

**디자인 새로 입히기 (Day 6 뒤)**

<img src="docs/screenshots/design-dashboard.png" width="240"> <img src="docs/screenshots/design-filter.png" width="240"> <img src="docs/screenshots/design-convert.png" width="240"> <img src="docs/screenshots/design-desktop.png" width="420">

<img src="docs/screenshots/design-launch-grid.png" width="720">

**Day 7 · 백업과 앱 준비**

<img src="docs/screenshots/day7-settings.png" width="240"> <img src="docs/screenshots/day7-import.png" width="240"> <img src="docs/screenshots/day7-clear.png" width="240"> <img src="docs/screenshots/day7-app-icon.png" width="120">

**2차 · 캘린더**

<img src="docs/screenshots/p2-calendar-calendar.png" width="240"> <img src="docs/screenshots/p2-calendar-day.png" width="240"> <img src="docs/screenshots/p2-calendar-add.png" width="240"> <img src="docs/screenshots/p2-calendar-desktop.png" width="420">

**2차 · 가게 로고**

<img src="docs/screenshots/p2-logos-list.png" width="240"> <img src="docs/screenshots/p2-logos-form.png" width="240">

**2차 · 시간, 결제 수단, 자세히 보기**

<img src="docs/screenshots/p2-money-list.png" width="240"> <img src="docs/screenshots/p2-money-detail.png" width="240"> <img src="docs/screenshots/p2-money-account.png" width="240"> <img src="docs/screenshots/p2-money-form.png" width="240">

**2차 · 정기 내역, 월급 D-day**

<img src="docs/screenshots/p2-recurring-dashboard.png" width="240"> <img src="docs/screenshots/p2-recurring-list.png" width="240"> <img src="docs/screenshots/p2-recurring-form.png" width="240">

**2차 · 모르는 결제처 물어보기**

<img src="docs/screenshots/p2-ask-list.png" width="240"> <img src="docs/screenshots/p2-ask-ask.png" width="240"> <img src="docs/screenshots/p2-ask-settings.png" width="320">

**2차 · 가계부 메뉴 (≡): 차트, 통계, 고정 금액**

<img src="docs/screenshots/p2-insights-menu.png" width="240"> <img src="docs/screenshots/p2-insights-chart.png" width="240"> <img src="docs/screenshots/p2-insights-stats.png" width="240"> <img src="docs/screenshots/p2-insights-income.png" width="240">

**2차 · 음식 사진으로 기록 (📷): 사진 위치·시간 → 가게·메뉴 → "이 가격 맞아요?"**

<img src="docs/screenshots/p2-meal-pick.png" width="240"> <img src="docs/screenshots/p2-meal-working.png" width="240"> <img src="docs/screenshots/p2-meal-confirm.png" width="240"> <img src="docs/screenshots/p2-meal-edit.png" width="240"> <img src="docs/screenshots/p2-meal-saved.png" width="240">

**2차 · 다크 / 라이트 / 자동 화면 밝기**

<img src="docs/screenshots/p2-theme-menu.png" width="240"> <img src="docs/screenshots/p2-theme-dark-menu.png" width="240"> <img src="docs/screenshots/p2-theme-dark-money.png" width="240"> <img src="docs/screenshots/p2-theme-desktop-auto.png" width="420">

**2차 · 꾸미기 (설정): 배경·구역마다 사진, 투명도, 랜덤 색 / 고정 색**

<img src="docs/screenshots/p2-custom-background.png" width="240"> <img src="docs/screenshots/p2-custom-fixed.png" width="240"> <img src="docs/screenshots/p2-custom-dashboard.png" width="240"> <img src="docs/screenshots/p2-custom-dark.png" width="240">

<img src="docs/screenshots/p2-custom-check.png" width="240"> <img src="docs/screenshots/p2-custom-preview.png" width="240"> <img src="docs/screenshots/p2-custom-check-todos.png" width="240">

**캡처로 가계부 입력 (AI 없이, 기기 안 글자 인식)**

<img src="docs/screenshots/ocr-menu.png" width="220"> <img src="docs/screenshots/ocr-sample-bank.png" width="220"> <img src="docs/screenshots/ocr-review-dialog.png" width="220"> <img src="docs/screenshots/ocr-saved.png" width="220">

**2차 · 적금 (만기 금액 세전/세후, 습관, 알림)**

<img src="docs/screenshots/savings-ai.png" width="240"> <img src="docs/screenshots/savings-form.png" width="240"> <img src="docs/screenshots/savings-detail.png" width="240"> <img src="docs/screenshots/savings-list.png" width="240"> <img src="docs/screenshots/savings-habit.png" width="240">

**2차 · 습관 트래커**

<img src="docs/screenshots/habit-dashboard.png" width="240"> <img src="docs/screenshots/habit-list.png" width="240"> <img src="docs/screenshots/habit-add.png" width="240"> <img src="docs/screenshots/habit-detail.png" width="240">

**2차 · 스크랩 (카테고리, 공유, 캡처, 편집)**

<img src="docs/screenshots/p2-scrap-list.png" width="240"> <img src="docs/screenshots/p2-scrap-capture-ask.png" width="240"> <img src="docs/screenshots/p2-scrap-detail.png" width="240"> <img src="docs/screenshots/p2-scrap-editor-text.png" width="240">

**2차 · AI 비서 (무료 Gemini, 예비 Groq)**

<img src="docs/screenshots/ai-11-gemini-chat.png" width="240"> <img src="docs/screenshots/ai-10-gemini-settings.png" width="240"> <img src="docs/screenshots/ai-groq-backup.png" width="240"> <img src="docs/screenshots/ai-feedback.png" width="240">

**2차 · 캘린더 (일정 이름 줄바꿈, 누르면 바로 보기, 공휴일, 색 21가지, 스티커)**

<img src="docs/screenshots/cal-1-month.png" width="240"> <img src="docs/screenshots/cal-5-popup.png" width="240"> <img src="docs/screenshots/cal-3-sticker-panel.png" width="240"> <img src="docs/screenshots/cal-6-colors.png" width="240">

**2차 · 꾸미기 사진 여러 장, 사진 맞춤**

<img src="docs/screenshots/customize-multi-photos.png" width="240"> <img src="docs/screenshots/customize-fit.png" width="240"> <img src="docs/screenshots/customize-fit-dashboard.png" width="240">

**2차 · 일기 (아이폰 사진, 사진 타임라인)**

<img src="docs/screenshots/diary-heic.png" width="240"> <img src="docs/screenshots/diary-timeline.png" width="240">

**2차 · 화면 정돈 (컴퓨터 대시보드 칸 크기, 작은 폰 가계부 머리)**

<img src="docs/screenshots/dash-equal-desktop.png" width="420"> <img src="docs/screenshots/money-header-360.png" width="240">

**3차 · 금액이 일정하지 않은 월급 (월급날마다 금액 입력)**

<img src="docs/screenshots/irregular-pay-2-on.png" width="240"> <img src="docs/screenshots/irregular-pay-3-prompt.png" width="240"> <img src="docs/screenshots/irregular-pay-4-recorded.png" width="240">

**결제 알림으로 가계부 자동 기록 (갤럭시 앱: 안내 → 알림 접근 허용 → 모인 알림 → 확인하고 저장 → 기록하지 않을 알림 거르기)**

<img src="docs/screenshots/pay-notify-2-guide.png" width="240"> <img src="docs/screenshots/pay-notify-5-banner.png" width="240"> <img src="docs/screenshots/pay-notify-6-review.png" width="240"> <img src="docs/screenshots/pay-notify-4-settings-on.png" width="240"> <img src="docs/screenshots/pay-filter-2-review-muted.png" width="240"> <img src="docs/screenshots/pay-filter-3-settings.png" width="240">

**어떤 카드 · 계좌로 썼는지 구분 (카드 · 계좌별 보기 → 내 카드 · 계좌 관리 → 입력할 때 고르기 → 적금이 나가는 계좌)**

<img src="docs/screenshots/pay-method-list.png" width="240"> <img src="docs/screenshots/pay-method-manager.png" width="240"> <img src="docs/screenshots/pay-method-edit.png" width="240"> <img src="docs/screenshots/pay-method-form.png" width="240"> <img src="docs/screenshots/savings-from-list.png" width="240"> <img src="docs/screenshots/savings-from-detail.png" width="240">

<details><summary>예전 디자인 (Day 5까지)</summary>

<img src="docs/screenshots/day5-dashboard.png" width="240"> <img src="docs/screenshots/day5-desktop.png" width="420">

</details>

</details>

## 어디서 쓸 수 있나요?

| 환경 | 방법 | 상태 |
|---|---|:---:|
| 📱 안드로이드 앱 | [Releases](https://github.com/kcr522/tidy/releases/latest)에서 `tidy.apk` 받아 설치. 이후에는 앱 안에서 업데이트 알림 → 설치 | ✅ |
| 📱 폰 웹 | [tidy-gules.vercel.app](https://tidy-gules.vercel.app) 접속 → "홈 화면에 추가" | ✅ |
| 💻 컴퓨터 웹 | [tidy-gules.vercel.app](https://tidy-gules.vercel.app) | ✅ |
| 💻 컴퓨터 앱 | Chrome · Edge에서 "앱 설치"로 따로 창 앱 (Windows · macOS) | ✅ |
| 🍎 아이폰 앱 | Mac + Xcode로 빌드 가능 (`npm run app:ios`), 앱스토어 출시는 계획 없음 | 선택 |

> 안드로이드에서 처음 설치할 때 "확인되지 않은 앱" 경고가 나올 수 있어요. 스토어에 올리기 전까지는 "무시하고 설치"를 눌러 주세요.

## 구조

```text
            ┌──────────────── 하나의 코드 (React + TypeScript) ────────────────┐
            │                                                                  │
   📱 안드로이드 앱 (Capacitor)     💻📱 웹 · PWA (Vercel)                      │
            │                                                                  │
            ▼                                                                  │
   기기 안 DB (IndexedDB · Dexie) ── 먼저 저장, 인터넷 없어도 동작 ─────────────┘
            │  구글 로그인했을 때만
            ▼
   Firebase (Auth + Firestore, 무료 요금제) ── 내 계정 공간에만 동기화

   Vercel 서버 함수 (api/)
     ├─ ai        무료 Gemini → Groq 대신 불러 주기 (키는 서버에만, 하루 한도)
     ├─ preview   링크 미리보기 · 본문 읽기 · 사이트 자동 캡처
     ├─ ical      구글 캘린더 iCal 가져오기
     ├─ meal      음식 사진 위치 → 근처 가게 (카카오)
     └─ app-update  새 APK 버전 알려 주기
```

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| 언어 · 화면 | TypeScript · React 19 · Vite 8 · Tailwind CSS 4 |
| 디자인 | Pretendard 글씨체 · Lucide 아이콘 · 직접 그린 SVG 차트 (차트 라이브러리 없음) |
| 저장 | IndexedDB (Dexie.js 4), 백업은 JSON |
| 로그인 · 동기화 | Firebase Authentication (Google) · Cloud Firestore (Spark 무료 요금제) |
| 서버 | Vercel 서버 함수 (Hobby 무료 요금제) |
| 웹 · 컴퓨터 앱 | PWA (오프라인, 홈 화면 · 앱 설치) |
| 폰 앱 | Capacitor 8 + 직접 만든 안드로이드 플러그인(지문, 위젯, 공유받기, 앱 안 캡처, 업데이트) |
| AI (무료) | Gemini 무료 → Groq 무료(예비) → 기본 모드(규칙). 글자 인식은 기기 안 Tesseract.js, 아이폰 사진은 heic-to |
| 테스트 | Vitest (단위 테스트 430개 넘게), Playwright (화면 확인 · 스크린샷) |
| 배포 | GitHub Actions가 APK를 만들어 Releases에 올림, Vercel이 웹을 자동 배포 ([자세히](#배포--업데이트--도메인)) |
| 기획 | [GitHub Spec Kit](https://github.com/github/spec-kit) (스펙 주도 개발) |

## 배포 · 업데이트 · 도메인

### 한눈에 보기

| 항목 | 내용 |
|---|---|
| 프레임워크 | **React 19 + TypeScript**, 빌드 도구 **Vite 8**, 스타일 **Tailwind CSS 4**. 폰 앱은 같은 웹 코드를 **Capacitor 8**로 감싼 것, 컴퓨터 앱은 **PWA**, 바탕화면 달력 위젯만 **Tauri** |
| 홈페이지를 만든 곳 | **[Vercel](https://vercel.com)** (Hobby 무료 요금제). GitHub 저장소를 Vercel에 연결해 두면 Vercel이 코드를 받아 빌드하고 사이트로 올려 줌 |
| 도메인 | **[tidy-gules.vercel.app](https://tidy-gules.vercel.app)**: Vercel이 무료로 주는 주소 (`*.vercel.app`). 도메인을 따로 사지 않았고, HTTPS 인증서도 Vercel이 자동으로 붙여 줌 |
| 서버 | 따로 서버 컴퓨터 없이 **Vercel 서버 함수**(`api/` 폴더, 서버리스)와 **Firebase**(로그인 · Firestore, 서울 리전 `asia-northeast3`, Spark 무료 요금제) |
| 배포 방식 | **Git 기반 자동 배포(CI/CD)**: PR을 `preview/all-features` 브랜치에 합치면 웹 · 안드로이드 앱이 자동으로 새 버전이 됨 |
| 웹 교체 방식 | **원자적 교체(Atomic deploy)**: 새 버전을 다 만든 뒤 주소를 한 번에 새 버전으로 바꿈. 일부 서버부터 차례로 바꾸는 **롤링 배포가 아니고**, 중간에 반쯤 바뀐 상태가 없음. 예전 버전이 그대로 남아 있어 Vercel에서 **바로 되돌리기(Instant Rollback)** 가능 |
| 미리 보기 배포 | PR마다 Vercel이 **Preview 배포**(따로 된 임시 주소)를 만들어서, 실제 사이트에 넣기 전에 확인 가능 |

### PR을 합치면 일어나는 일

```text
  PR 합치기 (→ preview/all-features)
        │
        ├─▶ Vercel ─ npm run build ─ 새 버전 완성되면 tidy-gules.vercel.app 을 한 번에 교체
        │              └─ 웹 · PWA: 서비스 워커가 새 버전을 받아 다시 열면 적용 (열려 있어도 10분마다 확인)
        │
        ├─▶ GitHub Actions "Web deploy" ─ 사이트의 /version.json 커밋이 방금 합친 커밋과 같아질 때까지 확인 (15분 넘으면 ❌)
        │
        ├─▶ GitHub Actions "Android APK" ─ 웹 빌드 → Capacitor로 앱에 넣기 → APK 만들기
        │              └─ 같은 서명 키 + 버전 번호 자동 증가(1.0.<실행 번호>) → GitHub Releases(latest)에 올림
        │                  └─ 폰 앱이 /api/app-update 로 새 버전 확인 → "업데이트" 누르면 받아서 설치
        │
        ├─▶ GitHub Actions "Desktop widget" ─ desktop-widget/ 이 바뀐 때만 맥 · 윈도우 위젯 앱 다시 빌드
        │
        └─▶ GitHub Actions "Dev record" ─ docs/개발-기록-조각/ 을 개발 기록에 넣고 PDF 다시 만들기
```

- 문서(`docs/`, `*.md`)만 바뀐 커밋은 Vercel이 다시 빌드하지 않아요 (`vercel.json`의 `ignoreCommand`).
- 사이트 비밀값(`GEMINI_API_KEY`, `GROQ_API_KEY`, `GITHUB_RELEASE_TOKEN` 등)은 코드에 넣지 않고 Vercel 환경 변수에만 둬요.
- 안드로이드 앱은 스토어가 아니라 GitHub Releases로 나눠 줘요. 서명 키가 항상 같아서 새 APK가 예전 앱 위에 덮어 설치돼요.

### 보고서용 한 문단 요약

> Tidy는 React 19와 TypeScript로 만든 웹 앱을 Vite로 빌드하고, 같은 코드를 PWA(웹 · 컴퓨터)와 Capacitor(안드로이드 앱)로 함께 배포한다. 홈페이지는 GitHub 저장소를 Vercel(무료 Hobby 요금제)에 연결해 만들었고, 도메인은 따로 사지 않고 Vercel이 주는 무료 주소 tidy-gules.vercel.app을 쓴다. 배포는 Git 기반 CI/CD로, PR을 배포 브랜치(preview/all-features)에 합치면 Vercel이 웹을 자동으로 빌드해 원자적(Atomic) 방식으로 한 번에 교체하고, 문제가 생기면 이전 배포로 바로 되돌릴 수 있다(롤링 배포는 쓰지 않음). 동시에 GitHub Actions가 서명된 안드로이드 APK를 만들어 GitHub Releases에 올리고, 앱은 실행할 때 새 버전을 확인해 앱 안에서 업데이트한다. 로그인과 동기화는 Firebase, AI 같은 서버 기능은 Vercel 서버리스 함수로 처리해 별도 서버 비용이 없다.

## 언어 · 앱 · 위젯 · 데이터 · 보안

### 쓴 언어

| 언어 | 대략 비율 (코드 크기 기준) | 어디에 |
|---|:---:|---|
| **TypeScript** (TSX 포함) | 약 93% | 화면(React), 데이터 처리, 동기화, AI, Vercel 서버 함수(`api/`), 테스트 |
| **Java** | 약 6% | 안드로이드 전용 기능: 홈 화면 위젯, 지문 잠금, 구글 캘린더 인증, 앱 업데이트, 공유받기, 결제 알림 읽기 |
| CSS · HTML | 1% 미만 | Tailwind 설정, 시작 페이지 |
| Rust | 1% 미만 | 컴퓨터 바탕화면 위젯 앱(Tauri)의 창 설정 |
| JavaScript (`.mjs`) | 1% 미만 | 빌드 · 문서 스크립트 |

### 앱 · 위젯을 만든 기술

| 무엇 | 기술 | 방법 |
|---|---|---|
| 📱 안드로이드 앱 | **Capacitor 8** (+ Java 플러그인) | 웹으로 만든 화면(`dist`)을 그대로 앱 안에 넣고, 폰만 되는 기능은 Java로 직접 만든 플러그인으로 연결 |
| 💻 컴퓨터 앱 | **PWA** (vite-plugin-pwa, 서비스 워커) | Chrome · Edge에서 "앱 설치"하면 따로 창으로 뜨고, 인터넷이 없어도 열림 |
| 🏠 폰 홈 화면 위젯 6가지 (할 일 · 가계부 · 습관 · 일정 · 달력 · 메모) | **Android App Widget** (Java, `RemoteViews`) | 앱이 위젯에 보일 내용을 기기 안(SharedPreferences)에 써 두면, 위젯이 그걸 읽어 그림. 누르면 앱의 해당 화면으로 바로 이동 |
| 🖥 바탕화면 달력 위젯 (맥 · 윈도우) | **Tauri 2** (Rust + 웹 화면) | 투명한 작은 창에 웹의 `/widget` 화면을 띄움. 웹이 배포되면 위젯도 같이 새 버전. GitHub Actions가 `.dmg` · `.exe`로 만들어 Releases에 올림 |
| 🍎 아이폰 앱 | Capacitor iOS | 빌드는 가능, 앱스토어 출시는 안 함 |

### 데이터 저장

| 단계 | 어디에 | 설명 |
|---|---|---|
| 1. 기기 안 (기본) | **IndexedDB** (Dexie.js 4, 지금 DB 버전 12) | 모든 기록은 먼저 기기 안에 저장 → 인터넷이 없어도 쓰고, 로그인 없이도 씀 (오프라인 우선) |
| 2. 동기화 (선택) | **Cloud Firestore** (서울 리전) | 구글 로그인하면 `users/내 uid/…` 자리에만 올라가서 폰 · 컴퓨터가 같은 기록을 봄. 사진 · 파일은 data URL로 함께 동기화 (Firestore 문서 한도 1MB 때문에 약 650KB 넘는 파일은 기기에만) |
| 3. 백업 | JSON 파일 | 설정에서 내보내기 · 가져오기, 자동 백업(매일 · 매주 · 열 때마다). 폰은 0.5MB씩 나눠 저장 |
| 작은 설정 | localStorage | 대시보드 배치, 최근 이모지, 잠금 설정(암호화된 값) 같은 기기별 설정 |

첨부 파일은 일기 · 일정 · 할 일에 10MB까지, 메모 파일집은 50MB까지 붙일 수 있어요.

### 보안

| 항목 | 어떻게 |
|---|---|
| 로그인 | **Firebase Authentication** 구글 로그인만 사용 (비밀번호를 Tidy가 받지 않음) |
| 내 기록만 보기 | **Firestore 보안 규칙**: `request.auth.uid == uid` 인 사람만 `users/{uid}` 아래를 읽고 쓸 수 있음 → 다른 사람 기록은 서버가 막음 ([firestore.rules](firestore.rules)) |
| 앱 잠금 | 4자리 PIN 또는 8자 이상 비밀번호. 비밀번호를 그대로 저장하지 않고 **PBKDF2(SHA-256, 10만 번, 솔트)** 로 바꾼 값만 저장. 5번 틀리면 30초부터 최대 5분까지 기다리게 함. 안드로이드는 **지문 잠금**(androidx.biometric) |
| API 키 숨기기 | Gemini · Groq · 카카오 · GitHub 키는 앱 코드에 없고 **Vercel 환경 변수**에만 둠. 앱은 Vercel 서버 함수에 부탁만 함 |
| AI 서버 사용 제한 | 서버가 Firebase 로그인 토큰을 확인하고(로그인한 사람만), 한 사람당 하루 횟수 제한 (`AI_DAILY_LIMIT`) |
| 관리자 페이지 | `/admin`은 로그인 토큰 확인 + `ADMIN_EMAILS`에 있는 메일만 열림. 전체 조회용 서비스 계정 키도 서버에만 둠 |
| 웹 보안 헤더 | HTTPS 강제(HSTS), 다른 사이트 안에 못 띄우게(`X-Frame-Options: DENY`), `nosniff`, 카메라 · 위치는 Tidy 자신만 쓰게(`Permissions-Policy`) — [vercel.json](vercel.json) |
| 앱 서명 | 안드로이드 APK는 항상 같은 키로 서명 → 다른 사람이 만든 가짜 APK로는 덮어 설치가 안 됨 |

## 문서

| 문서 | 내용 |
|---|---|
| [📄 개발 기록](docs/개발-기록.md) · [PDF](docs/개발-기록.pdf) | 만든 과정, 기술을 고른 이유, 전체 기능 목록, 진행 상황, 변경 기록 (계속 갱신) |
| [1차 요구사항 분석서](specs/001-tidy-mvp/requirements.md) · [PDF](docs/1차-요구사항-분석서.pdf) | 1차 MVP 기능 명세표, **ERD**, 테이블 정의, 7일 일정 |
| [2차 요구사항 분석서](specs/002-tidy-phase2/requirements.md) · [PDF](docs/2차-요구사항-분석서.pdf) | 2차 기능 명세표, DB 설계, 무료 AI 구조 |
| [헌법 (constitution)](.specify/memory/constitution.md) | 프로젝트가 지키는 원칙 |
| [1차 상세 요구사항 (spec)](specs/001-tidy-mvp/spec.md) · [구현 계획](specs/001-tidy-mvp/plan.md) · [기술 선택 이유](specs/001-tidy-mvp/research.md) · [데이터 모델](specs/001-tidy-mvp/data-model.md) · [작업 목록](specs/001-tidy-mvp/tasks.md) | Spec Kit 방식 1차 기획 ("무엇을 → 어떻게 → 할 일") |
| [2차 처음 기획](specs/002-tidy-phase2/spec.md) | 캘린더, 구글 로그인 + 동기화, AI 캡처 입력 |
| [처음 요구사항 PDF](docs/MVP-요구사항-분석서.pdf) | 맨 처음 작성한 MVP 요구사항 분석서 |
| [구글 로그인 설정](docs/구글-로그인-설정.md) · [Tidy AI 설정](docs/Tidy-AI-설정.md) · [스크랩 공유 · 미리보기](docs/scrap-share-and-preview.md) | 직접 배포할 때 필요한 설정 |

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|:---:|
| 기획 | 요구사항 분석, Spec Kit 문서 (11월 10일) | ✅ |
| 1차 MVP | 가계부 · 할 일 · 스크랩 · 대시보드 · 백업 (7일 스프린트, PR #3 ~ #11) | ✅ |
| 2차 | 캘린더 · 일기 · 습관 · 적금 · 캡처 입력 · AI 비서 · 꾸미기 · 구글 로그인과 동기화 · 웹 배포 | ✅ |
| 3차 | 앱 잠금 · 홈 화면 위젯 · 반복 할 일 · 월 예산 · 자동 백업 · 월간 리포트 · 구글 캘린더 | ✅ |
| 다듬기 | 캘린더 개편, 스크랩 자동 캡처 · 공유 · 캡션, 일기 자동 저장, 분할 화면, 메뉴 색 등 | 진행 중 |

**다음에 할 수 있는 것**

- 🗓 Tidy → 구글 캘린더 보내기 마무리 (다시 동의 후 확인)
- 🏪 플레이 스토어 내부 테스트 또는 갤럭시 스토어로 "확인되지 않은 앱" 경고 없애기
- 🖼 스크랩 사진 · X 동영상 저장 (검토 중)
- 🍎 아이폰 공유로 스크랩 (iOS 공유 확장 필요)

## 직접 실행하기

```bash
git clone https://github.com/kcr522/tidy.git
cd tidy
npm install
npm run dev          # http://localhost:5173
npm test             # 단위 테스트
npm run build        # 웹 빌드
npm run app:android  # 안드로이드 앱 (Android Studio)
npm run app:ios      # 아이폰 앱 (Mac + Xcode)
```

로그인 없이도 바로 쓸 수 있어요. 구글 로그인 · Tidy AI · 링크 미리보기를 직접 배포한 곳에서 쓰려면 Vercel 환경 변수(`GEMINI_API_KEY`, `GROQ_API_KEY` 등)와 Firebase 설정이 필요해요. 자세한 방법은 [quickstart.md](specs/001-tidy-mvp/quickstart.md), [Tidy AI 설정](docs/Tidy-AI-설정.md), [구글 로그인 설정](docs/구글-로그인-설정.md)을 보세요.

---

<div align="center">
Made for my everyday life · 2026
</div>
