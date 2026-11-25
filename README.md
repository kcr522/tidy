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
- **오늘 이동 기록**: 갤럭시 앱에서 켜 두면 다닌 길을 지도에 그리고, 10분 넘게 머문 곳과 시간 · 움직인 거리를 보여 줘요 (위치는 이 폰에만 30일)

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

**오늘 이동 기록** (대시보드 위젯 → 크게 보기 → 머문 곳 누르기 → 일기에서 그날 경로)

| 대시보드 위젯 | 이동 기록 | 머문 곳 | 일기 |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/route-1-widget.png" width="200"> | <img src="docs/screenshots/route-2-page.png" width="200"> | <img src="docs/screenshots/route-3-focus.png" width="200"> | <img src="docs/screenshots/route-4-diary.png" width="200"> |

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
| 디자인 | Pretendard 글씨체 · Lucide 아이콘 · 직접 그린 SVG 차트 (차트 라이브러리 없음) · 지도는 Leaflet + OpenStreetMap (Tidy 서버가 받아 캐시) |
| 저장 | IndexedDB (Dexie.js 4), 백업은 JSON |
| 로그인 · 동기화 | Firebase Authentication (Google) · Cloud Firestore (Spark 무료 요금제) |
| 서버 | Vercel 서버 함수 (Hobby 무료 요금제) |
| 웹 · 컴퓨터 앱 | PWA (오프라인, 홈 화면 · 앱 설치) |
| 폰 앱 | Capacitor 8 + 직접 만든 안드로이드 플러그인(지문, 위젯, 공유받기, 앱 안 캡처, 업데이트, 이동 기록) |
| AI (무료) | Gemini 무료 → Groq 무료(예비) → 기본 모드(규칙). 글자 인식은 기기 안 Tesseract.js, 아이폰 사진은 heic-to |
| 테스트 | Vitest (단위 테스트 430개 넘게), Playwright (화면 확인 · 스크린샷) |
| 배포 | GitHub Actions가 APK를 만들어 Releases에 올림, Vercel이 웹을 자동 배포 ([자세히](#배포--업데이트--도메인)) |
| 기획 | [GitHub Spec Kit](https://github.com/github/spec-kit) (스펙 주도 개발) |

## 배포 · 업데이트 · 도메인

### 처음 보는 말 풀이 (용어 사전)

아래 표에 나오는 기술 이름을 쉽게 풀어 둔 거예요. 집 짓기에 비유하면 이해하기 쉬워요.

| 말 | 한 줄 풀이 | 비유 |
|---|---|---|
| **JavaScript** | 웹 브라우저가 알아듣는 프로그래밍 언어. 버튼을 누르면 뭔가 일어나게 만듦 | 집을 움직이는 전기 배선 |
| **TypeScript** | JavaScript에 "이 칸엔 숫자만, 이 칸엔 글자만" 같은 규칙(타입)을 더한 언어. 실수를 미리 잡아 줌. 실행할 땐 JavaScript로 바뀜 | 배선 도면에 규격을 적어 둔 것 |
| **React** | 화면을 "부품(컴포넌트)" 단위로 만들게 해 주는 도구(라이브러리). 버튼 · 카드 · 목록을 한 번 만들어 여러 곳에 다시 씀. 데이터가 바뀌면 그 부분 화면만 알아서 다시 그려 줌. Meta(페이스북)가 만듦 | 레고 블록: 블록(부품)을 만들어 끼워 맞춰 화면 완성 |
| **프레임워크 · 라이브러리** | 자주 쓰는 기능을 미리 만들어 둔 코드 묶음. 처음부터 다 만들지 않고 가져다 씀 | 조립식 가구 키트 |
| **Vite** | 내가 쓴 코드를 브라우저가 빨리 읽을 수 있는 파일로 묶어 주는 빌드 도구. 개발할 땐 저장하자마자 화면에 바로 보여 줌 | 재료를 포장해서 배달 상자로 만드는 공장 |
| **Tailwind CSS** | 색 · 여백 · 글자 크기 같은 꾸밈을 `p-4`, `rounded-xl`처럼 짧은 이름으로 바로 붙이는 꾸미기 도구 | 미리 만들어 둔 페인트 · 스티커 세트 |
| **PWA** | 웹사이트를 앱처럼 설치하게 해 주는 기술. 홈 화면 아이콘, 인터넷 없이 열기 가능 | 웹사이트에 앱 옷을 입힌 것 |
| **서비스 워커** | PWA가 인터넷 없이도 열리도록 파일을 미리 저장해 두고, 새 버전을 받아 오는 브라우저 안 도우미 | 집 앞 택배 보관함 |
| **Capacitor** | 웹으로 만든 화면을 그대로 안드로이드 · 아이폰 앱으로 포장해 주는 도구. 폰 기능(알림, 지문 등)도 연결해 줌 | 웹 화면을 담는 앱 상자 |
| **Tauri** | 웹 화면을 맥 · 윈도우 프로그램으로 만들어 주는 도구. 가볍고 작음 (Rust 언어 기반) | 컴퓨터용 앱 상자 |
| **IndexedDB · Dexie** | IndexedDB는 브라우저 · 앱 안에 있는 저장 공간(데이터베이스). Dexie는 그걸 쉽게 쓰게 해 주는 도구 | 내 폰 안 서랍장 + 서랍 정리 도우미 |
| **JSON** | 데이터를 `{"금액": 5000}`처럼 글자로 적어 두는 형식. 백업 파일이 이 형식 | 정리된 메모장 양식 |
| **Firebase · Firestore** | 구글이 주는 서버 서비스. Firebase Auth는 로그인, Firestore는 인터넷 위의 저장 공간 | 은행 금고(내 계좌 칸만 열 수 있음) |
| **Vercel** | 코드를 올리면 웹사이트로 만들어 인터넷에 띄워 주는 호스팅 서비스 | 건물을 세워 주는 땅 + 건설사 |
| **서버리스 함수** | 서버 컴퓨터를 직접 켜 두지 않고, 요청이 올 때만 잠깐 실행되는 작은 서버 코드 (`api/` 폴더) | 필요할 때만 부르는 출장 기사 |
| **도메인** | 사이트 주소 (예: `tidy-gules.vercel.app`) | 집 주소 |
| **GitHub · PR** | GitHub은 코드를 저장하고 기록하는 곳. PR(풀 리퀘스트)은 "이렇게 바꿨으니 합쳐 주세요" 요청 | 공유 설계도 보관소 + 수정 요청서 |
| **CI/CD · GitHub Actions** | 코드를 합치면 자동으로 검사 · 빌드 · 배포까지 해 주는 방식. GitHub Actions가 그 자동 작업을 돌림 | 자동 생산 라인 |
| **배포** | 만든 새 버전을 실제 사용자가 쓰는 곳(사이트 · 앱)에 올리는 것 | 새 상품을 매장에 진열 |
| **원자적 배포 · 롤링 배포** | 원자적: 새 버전을 다 만든 뒤 한 번에 바꿈. 롤링: 서버 여러 대를 조금씩 차례로 바꿈 | 간판을 한 번에 교체 vs 한 칸씩 교체 |
| **APK** | 안드로이드 앱 설치 파일 | 앱 설치 상자 |
| **PBKDF2 · SHA-256** | 비밀번호를 거꾸로 되돌릴 수 없는 긴 값으로 바꾸는 방법(해시). 10만 번 반복해서 알아내기 어렵게 함 | 비밀번호를 갈아서 모양을 바꾼 가루 — 가루로는 원래 비밀번호를 못 만듦 |
| **API 키 · 환경 변수** | API 키는 외부 서비스(Gemini 등)를 쓸 수 있는 비밀 열쇠. 환경 변수는 그 열쇠를 코드 밖 서버 설정에 숨겨 두는 곳 | 금고 열쇠를 집 밖 경비실에 맡김 |

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
| 1. 기기 안 (기본) | **IndexedDB** (Dexie.js 4, 지금 DB 버전 12) | 모든 기록은 먼저 기기 안에 저장 → 인터넷이 없어도 쓰고, 로그인 없이도 씀 (오프라인 우선). 표 구조는 [데이터 구조 (ERD)](#데이터-구조-erd) |
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

## 데이터 구조 (ERD)

<!-- ERD:START — 이 사이는 `node scripts/erd.mjs`가 만든다. 직접 고치지 말고 scripts/erd.mjs를 고친다 -->

Tidy의 모든 기록은 먼저 **기기 안 IndexedDB**(Dexie, DB 버전 12)에 저장돼요. 표 18개를 6개 묶음으로 나눴고, 이름은 코드에 쓰는 **물리명**(영어)과 화면에서 부르는 **논리명**(한국어)을 같이 적었어요.

<a href="docs/erd.svg"><img src="docs/erd.svg" alt="Tidy ERD (키 · 연결 칸)" width="100%"></a>

> 그림은 키 · 연결 칸만 보여 줘요. **모든 칸이 다 들어간 ERD**는 [docs/erd-full.svg](docs/erd-full.svg) (누르면 크게 보여요)

#### 표 한눈에 보기

| 묶음 | 물리명 (표) | 논리명 | 기본 키 | 처음 생긴 버전 | 무엇을 담나 |
|---|---|---|---|:---:|---|
| 가계부 | `transactions` | 가계부 내역 | `id` 자동 번호 | v1 | 수입 · 지출 한 건. 정기 내역 · 적금이 자동으로 만든 내역도 여기에 들어간다 |
| 가계부 | `payMethods` | 내 카드 · 계좌 | `id` 자동 번호 | v12 | 어떤 카드 · 계좌로 썼는지 구분한다. 내역에는 id가 아니라 이름으로 들어간다 |
| 가계부 | `merchantAliases` | 가게 이름 기억 | `raw` (정리한 원래 이름) | v3 | 카드사에 찍힌 이름(KCP · NICE 등)을 실제 가게 이름으로 바꿔 보여 준다 |
| 가계부 | `recurring` | 정기 내역 규칙 | `id` 자동 번호 | v2 | 월급 · 구독료처럼 매달 같은 날 자동으로 내역을 만든다 |
| 가계부 | `budgets` | 한 달 예산 | `category` | v9 | 매달 똑같이 적용되는 예산 (전체 + 카테고리별) |
| 가계부 | `savings` | 적금 | `id` 자동 번호 | v7 | 만기 금액 계산 · 자동 납입 · 납입일 알림. 만들 때 습관 하나를 같이 만든다 |
| 할 일 | `todoCategories` | 할 일 카테고리 | `id` 자동 번호 | v8 | 할 일 캘린더 아래 묶음 |
| 할 일 | `todos` | 할 일 | `id` 자동 번호 | v1 | 마감일 · 중요도 · 알림 · 반복이 있는 할 일. 스크랩에서 바꾼 할 일은 그 스크랩과 1:1 |
| 습관 | `habits` | 습관 | `id` 자동 번호 | v6 | 매일(또는 정한 날) 체크하는 반복 목표 |
| 습관 | `habitChecks` | 습관 체크 | `[habitId+date]` 묶음 키 | v6 | 그날 그 습관을 했다는 기록. 기록이 없으면 안 한 날 |
| 스크랩 | `scrapCategories` | 스크랩 카테고리 | `id` 자동 번호 | v5 | 처음엔 맛집·카페 · 여행 · 쇼핑 · 공부 · 꿀팁 5개가 들어 있다 |
| 스크랩 | `bookmarks` | 스크랩 | `id` 자동 번호 | v1 | 나중에 볼 링크 + 미리보기 · 요약 |
| 스크랩 | `scrapMedia` | 스크랩 사진 · 영상 | `id` 자동 번호 | v5 | 미리보기 썸네일과 캡처 · 화면 녹화. 파일(Blob) 그대로 저장한다 |
| 메모 | `memoFolders` | 메모 파일집 | `id` 자동 번호 | v11 | 비슷한 메모끼리 모아 두는 폴더 (12가지 색) |
| 메모 | `memos` | 메모 | `id` 자동 번호 | v11 | 글 + 사진 · 영상 · 파일 · 손글씨. 쓴 시각 순서로 보인다 |
| 캘린더 · 일기 | `events` | 캘린더 일정 | `id` 자동 번호 | v4 | 하루짜리 또는 여러 날 기간. 구글 · 폰 캘린더에서 가져온 일정도 같이 들어간다 |
| 캘린더 · 일기 | `diaries` | 일기 | `date` (하루 하나) | v4 | 하루에 하나. 날짜가 곧 키라서 달력 · 스티커 · 일정과 날짜로 만난다 |
| 캘린더 · 일기 | `stickers` | 날짜 스티커 | `date` (하루 하나) | v10 | 달력 날짜 칸에 붙이는 이모티콘 |

#### 관계

| 자식 칸 | 부모 칸 | 종류 | 내용 |
|---|---|:---:|---|
| `transactions.recurringId` | `recurring.id` | N : 1 | 정기 내역이 만든 내역 |
| `transactions.savingsId` | `savings.id` | N : 1 | 적금 납입 내역 |
| `transactions.account` | `payMethods.name` | 이름으로 | 어떤 카드 · 계좌로 썼는지 (이름으로) |
| `transactions.originalMemo` | `merchantAliases.raw` | 이름으로 | 카드사 이름 → 실제 가게 이름 (정리한 이름으로) |
| `transactions.category` | `budgets.category` | 이름으로 | 카테고리별 예산 (이름으로) |
| `recurring.account` | `payMethods.name` | 이름으로 | 정기 내역의 결제 수단 (이름으로) |
| `savings.fromAccount` | `payMethods.name` | 이름으로 | 적금이 나가는 계좌 (이름으로) |
| `savings.habitId` | `habits.id` | 1 : 1 | 적금 하나에 습관 하나 |
| `habits.savingsId` | `savings.id` | 1 : 1 | 습관 쪽에서 적금을 가리킴 |
| `habitChecks.habitId` | `habits.id` | N : 1 | 습관 하나에 날짜별 체크 여러 개 |
| `todos.categoryId` | `todoCategories.id` | N : 1 | 카테고리 하나에 할 일 여러 개 |
| `todos.bookmarkId` | `bookmarks.id` | 1 : 1 | 스크랩 → 할 일 전환 (1 : 0..1) |
| `todos.repeatNextId` | `todos.id` | 1 : 1 | 반복 할 일을 끝내서 생긴 다음 할 일 |
| `bookmarks.categoryId` | `scrapCategories.id` | N : 1 | 카테고리 하나에 스크랩 여러 개 |
| `scrapMedia.bookmarkId` | `bookmarks.id` | N : 1 | 스크랩 하나에 썸네일 · 캡처 여러 개 |
| `memos.folderId` | `memoFolders.id` | N : 1 | 파일집 하나에 메모 여러 개 |

- IndexedDB에는 외래 키 제약이 없어서, 관계는 앱 코드(`src/repositories`)가 지켜요. 예: 스크랩을 지우면 붙은 사진(`scrapMedia`)도 같이 지워요.
- `diaries` · `stickers` · `events`는 id 대신 **날짜**(`YYYY-MM-DD`)로 한 달력에 모여요. 가계부 · 할 일도 날짜 칸으로 같은 달력에 보여요.
- 불리언은 인덱스를 쓰려고 `0 | 1` 숫자로 저장해요 (그림에서 `flag`).

#### 표 정의 (물리명 · 논리명 · 타입)

키: **PK** 기본 키 · **FK** 다른 표의 번호 · **UK** 중복 불가 인덱스 · **LK** 이름(값)으로 이어지는 칸 · IX 인덱스. 타입 끝의 `?`는 없을 수 있는 칸이에요.

<details>
<summary><b>가계부</b> · transactions (가계부 내역) · payMethods (내 카드 · 계좌) · merchantAliases (가게 이름 기억) · recurring (정기 내역 규칙) · budgets (한 달 예산) · savings (적금)</summary>

**`transactions` · 가계부 내역** — 기본 키 `id` 자동 번호 · 인덱스 `date`, `[type+date]`, `category`, `savingsId` · v1부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 내역 번호 | `number` | **PK** | 자동 증가 |
| `type` | 수입/지출 | `'INCOME' \| 'EXPENSE'` | IX | [type+date] 묶음 인덱스 |
| `amount` | 금액 | `number` |  | 원, 정수 1 ~ 999,999,999 |
| `category` | 카테고리 | `string` | **LK** | 식비 · 교통 · 저축 등. 인덱스도 있다. 예산과 이름으로 이어진다 → `budgets.category` |
| `date` | 날짜 | `string` | IX | YYYY-MM-DD |
| `time` | 시각 | `string?` |  | HH:mm |
| `memo` | 메모 (가게 이름) | `string` |  | 0 ~ 200자 |
| `account` | 결제 수단 | `string?` | **LK** | 내 카드 · 계좌의 이름 → `payMethods.name` |
| `recurringId` | 정기 내역 번호 | `number?` | **FK** | 정기 내역이 자동 기록했을 때 → `recurring.id` |
| `savingsId` | 적금 번호 | `number?` | **FK** | 적금 납입으로 기록했을 때 → `savings.id` |
| `originalMemo` | 원래 가게 이름 | `string?` | **LK** | 가게를 알려 주기 전 카드사 이름 (예: KCP*결제) → `merchantAliases.raw` |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`payMethods` · 내 카드 · 계좌** — 기본 키 `id` 자동 번호 · 인덱스 `order` · v12부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 결제 수단 번호 | `number` | **PK** | 자동 증가 |
| `name` | 이름 | `string` | **LK** | 예: 신한 체크, 국민 월급통장. 내역 · 정기 내역 · 적금의 결제 수단 칸 값 |
| `kind` | 종류 | `'card' \| 'account' \| 'pay' \| 'cash'` |  | 카드 / 계좌 / 간편결제 / 현금 |
| `last4` | 끝 4자리 | `string?` |  | 결제 알림에서 찾을 때 쓴다 |
| `order` | 순서 | `number` | IX | 작을수록 앞 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`merchantAliases` · 가게 이름 기억** — 기본 키 `raw` (정리한 원래 이름) · 인덱스 없음 · v3부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `raw` | 정리한 원래 이름 | `string` | **PK** | 원래 이름을 normalizeName 한 값 |
| `original` | 원래 이름 | `string` |  | 화면 표시용 |
| `name` | 실제 가게 이름 | `string` |  | 사용자가 알려 준 이름 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |

**`recurring` · 정기 내역 규칙** — 기본 키 `id` 자동 번호 · 인덱스 `type`, `isActive` · v2부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 규칙 번호 | `number` | **PK** | 자동 증가 |
| `type` | 수입/지출 | `'INCOME' \| 'EXPENSE'` | IX |  |
| `amount` | 금액 | `number` |  | 금액을 매번 물으면 0 |
| `category` | 카테고리 | `string` |  |  |
| `memo` | 이름 | `string` |  | 예: 넷플릭스, 월급 |
| `account` | 결제 수단 | `string?` | **LK** | 내 카드 · 계좌의 이름 → `payMethods.name` |
| `askAmount` | 금액 매번 묻기 | `0 \| 1 ?` |  | 1이면 그날마다 금액을 물어본다 |
| `day` | 매달 며칠 | `number` |  | 1 ~ 31 (없는 날이면 말일) |
| `startDate` | 시작일 | `string` |  | YYYY-MM-DD |
| `lastDate` | 마지막 기록일 | `string \| null` |  | YYYY-MM-DD |
| `isActive` | 사용 중 | `0 \| 1` | IX |  |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`budgets` · 한 달 예산** — 기본 키 `category` · 인덱스 없음 · v9부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `category` | 카테고리 | `string` | **PK** | 지출 카테고리 이름. '' 이면 한 달 전체 예산 |
| `amount` | 예산 | `number` |  | 원, 1 이상 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`savings` · 적금** — 기본 키 `id` 자동 번호 · 인덱스 없음 · v7부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 적금 번호 | `number` | **PK** | 자동 증가 |
| `name` | 이름 | `string` |  | 예: 청년도약계좌 |
| `bank` | 은행 | `string?` |  |  |
| `fromAccount` | 나가는 계좌 | `string?` | **LK** | 내 카드 · 계좌의 이름. 납입 내역의 결제 수단 → `payMethods.name` |
| `amount` | 한 번에 넣는 돈 | `number` |  | 원 |
| `startDate` | 가입일 | `string` |  | YYYY-MM-DD, 첫 납입일 |
| `endDate` | 만기일 | `string` |  | YYYY-MM-DD |
| `rate` | 연 이율 | `number` |  | % (우대금리 포함) |
| `interestType` | 이자 방식 | `'simple' \| 'compound'` |  | 단리 / 월복리 |
| `taxType` | 이자 세금 | `'normal' \| 'preferential' \| 'free'` |  | 일반 15.4% / 세금우대 9.5% / 비과세 |
| `schedule` | 넣는 날 | `Schedule` |  | 매일 · 매주 요일 · 매달 날짜 (아래 묶음 참고) |
| `autoDeposit` | 자동이체 | `0 \| 1` |  | 1이면 넣는 날 가계부에 자동 기록, 0이면 습관 체크로 기록 |
| `alarmOn` | 알림 켜짐 | `0 \| 1` |  |  |
| `alarmTime` | 알림 시각 | `string` |  | HH:mm |
| `habitId` | 습관 번호 | `number?` | **FK** | 같이 만든 습관 → `habits.id` |
| `lastDate` | 마지막 자동 기록 | `string \| null` |  | YYYY-MM-DD |
| `memo` | 메모 | `string` |  |  |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

</details>

<details>
<summary><b>할 일</b> · todoCategories (할 일 카테고리) · todos (할 일)</summary>

**`todoCategories` · 할 일 카테고리** — 기본 키 `id` 자동 번호 · 인덱스 `order` · v8부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 카테고리 번호 | `number` | **PK** | 자동 증가 |
| `name` | 이름 | `string` |  |  |
| `color` | 색 | `'peach' \| 'sky' \| 'mint' \| 'lilac' \| 'lemon' \| 'rose'` |  |  |
| `order` | 순서 | `number` | IX |  |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |

**`todos` · 할 일** — 기본 키 `id` 자동 번호 · 인덱스 `dueDate`, `isCompleted`, `&bookmarkId`, `categoryId` · v1부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 할 일 번호 | `number` | **PK** | 자동 증가 |
| `title` | 제목 | `string` |  | 1 ~ 100자 |
| `isCompleted` | 완료 | `0 \| 1` | IX | 인덱스 때문에 불리언 대신 숫자 |
| `completedAt` | 완료 시각 | `string \| null` |  | 되돌리면 null |
| `dueDate` | 마감일 | `string \| null` | IX | YYYY-MM-DD |
| `priority` | 중요도 | `'HIGH' \| 'MEDIUM' \| 'LOW'` |  | 기본 MEDIUM |
| `bookmarkId` | 스크랩 번호 | `number?` | **FK** | 스크랩 → 할 일로 바꿨을 때. 중복 불가 (&bookmarkId) → `bookmarks.id` |
| `categoryId` | 카테고리 번호 | `number?` | **FK** | 없으면 기본 → `todoCategories.id` |
| `remindAt` | 알림 시각 | `string?` |  | HH:mm, 마감일 그날 |
| `repeat` | 반복 | `TodoRepeat?` |  | 매일 · 매주 요일 · 매달 날짜 |
| `repeatNextId` | 다음 반복 번호 | `number?` | **FK** | 끝내서 생긴 다음 할 일 (같은 표) → `todos.id` |
| `memo` | 메모 | `string?` |  | 제목 아래 작게 |
| `attachments` | 참고 사진 · 파일 | `Attachment[]?` |  | data URL로 기록 안에 들어간다 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

</details>

<details>
<summary><b>습관</b> · habits (습관) · habitChecks (습관 체크)</summary>

**`habits` · 습관** — 기본 키 `id` 자동 번호 · 인덱스 `order` · v6부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 습관 번호 | `number` | **PK** | 자동 증가 |
| `title` | 이름 | `string` |  | 예: 물 2L 마시기 |
| `emoji` | 아이콘 | `string` |  | 이모지 하나 |
| `order` | 순서 | `number` | IX |  |
| `savingsId` | 적금 번호 | `number?` | **FK** | 적금이 만든 습관일 때 → `savings.id` |
| `schedule` | 주기 | `Schedule?` |  | 없으면 매일 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`habitChecks` · 습관 체크** — 기본 키 `[habitId+date]` 묶음 키 · 인덱스 `habitId`, `date` · v6부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `habitId` | 습관 번호 | `number` | **PK** | 묶음 키 앞쪽 → `habits.id` |
| `date` | 날짜 | `string` | **PK** | YYYY-MM-DD, 묶음 키 뒤쪽 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |

</details>

<details>
<summary><b>스크랩</b> · scrapCategories (스크랩 카테고리) · bookmarks (스크랩) · scrapMedia (스크랩 사진 · 영상)</summary>

**`scrapCategories` · 스크랩 카테고리** — 기본 키 `id` 자동 번호 · 인덱스 `&name`, `order` · v5부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 카테고리 번호 | `number` | **PK** | 자동 증가 |
| `name` | 이름 | `string` | **UK** | 중복 불가 |
| `order` | 순서 | `number` | IX |  |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |

**`bookmarks` · 스크랩** — 기본 키 `id` 자동 번호 · 인덱스 `url`, `isRead`, `createdAt`, `categoryId` · v1부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 스크랩 번호 | `number` | **PK** | 자동 증가 |
| `url` | 주소 | `string` | IX | http/https만. 중복 확인에 쓴다 |
| `title` | 제목 | `string` |  | 비우면 도메인 |
| `memo` | 메모 | `string` |  |  |
| `isRead` | 읽음 | `0 \| 1` | IX |  |
| `categoryId` | 카테고리 번호 | `number?` | **FK** | 없으면 미분류 → `scrapCategories.id` |
| `source` | 출처 | `string?` |  | instagram · naver · x · youtube · web |
| `description` | 설명 | `string?` |  | 링크 미리보기 설명 · 캡션 (1만 자까지) |
| `siteName` | 사이트 이름 | `string?` |  |  |
| `isVideo` | 동영상 게시물 | `0 \| 1 ?` |  |  |
| `summary` | 요약 | `string?` |  | AI 또는 기본 요약 |
| `summaryAt` | 요약한 시각 | `string?` |  |  |
| `createdAt` | 만든 시각 | `string` | IX | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`scrapMedia` · 스크랩 사진 · 영상** — 기본 키 `id` 자동 번호 · 인덱스 `bookmarkId`, `[bookmarkId+kind]` · v5부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 사진 번호 | `number` | **PK** | 자동 증가 |
| `bookmarkId` | 스크랩 번호 | `number` | **FK** | → `bookmarks.id` |
| `kind` | 종류 | `'thumb' \| 'capture'` | IX | 썸네일 / 캡처 · 녹화 |
| `blob` | 파일 | `Blob` |  | 보여 줄 파일 (편집했으면 편집본) |
| `original` | 원본 파일 | `Blob?` |  | 편집하기 전 원본 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

</details>

<details>
<summary><b>메모</b> · memoFolders (메모 파일집) · memos (메모)</summary>

**`memoFolders` · 메모 파일집** — 기본 키 `id` 자동 번호 · 인덱스 `order` · v11부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 파일집 번호 | `number` | **PK** | 자동 증가 |
| `name` | 이름 | `string` |  |  |
| `color` | 색 | `string` |  | #rrggbb |
| `order` | 순서 | `number` | IX |  |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |

**`memos` · 메모** — 기본 키 `id` 자동 번호 · 인덱스 `folderId`, `createdAt`, `updatedAt` · v11부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 메모 번호 | `number` | **PK** | 자동 증가 |
| `title` | 제목 | `string` |  |  |
| `text` | 본문 글자 | `string` |  | 꾸밈을 뺀 글자 (검색용) |
| `folderId` | 파일집 번호 | `number?` | **FK** | 없으면 파일집 밖 → `memoFolders.id` |
| `html` | 꾸민 글 | `string?` |  | 굵게 · 형광펜 · 글 사이 사진 |
| `pics` | 글 사이 사진 | `MemoPic[]?` |  | html 의 <img data-pic> 자리 |
| `ink` | 손글씨 | `MemoInk[]?` |  | 최대 10장, AI가 읽은 글자 포함 |
| `attachments` | 사진 · 영상 · 파일 | `Attachment[]?` |  | 최대 10개, 하나 50MB |
| `pinned` | 맨 위 고정 | `0 \| 1 ?` |  |  |
| `createdAt` | 쓴 시각 | `string` | IX | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` | IX | ISO 8601 시각 |

</details>

<details>
<summary><b>캘린더 · 일기</b> · events (캘린더 일정) · diaries (일기) · stickers (날짜 스티커)</summary>

**`events` · 캘린더 일정** — 기본 키 `id` 자동 번호 · 인덱스 `startDate`, `endDate` · v4부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `id` | 일정 번호 | `number` | **PK** | 자동 증가 |
| `title` | 제목 | `string` |  |  |
| `startDate` | 시작일 | `string` | IX | YYYY-MM-DD |
| `endDate` | 끝나는 날 | `string` | IX | YYYY-MM-DD (하루짜리면 시작일과 같다) |
| `color` | 색 | `string` |  | 이름 있는 색 21가지 또는 #rrggbb |
| `memo` | 메모 | `string` |  |  |
| `source` | 가져온 곳 | `'google' \| 'device' ?` |  | 없으면 Tidy에서 만든 일정 |
| `calId` | 가져온 캘린더 | `string?` |  | 구글 캘린더 번호 또는 d:기기:캘린더 |
| `uid` | 원래 일정 id | `string?` |  | 가져온 일정의 원래 id |
| `attachments` | 사진 · 파일 | `Attachment[]?` |  | 최대 10개 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`diaries` · 일기** — 기본 키 `date` (하루 하나) · 인덱스 없음 · v4부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `date` | 날짜 | `string` | **PK** | YYYY-MM-DD |
| `text` | 본문 | `string` |  |  |
| `photo` | 대표 사진 | `string?` |  | JPEG data URL (photos 의 첫 장) |
| `photos` | 사진 | `DiaryPhoto[]?` |  | 최대 10장, 찍은 시간 순서 |
| `hours` | 시간별 기록 | `DiaryHour[]?` |  | 0 ~ 23시 한 칸씩 |
| `attachments` | 파일 | `Attachment[]?` |  | 최대 10개 |
| `color` | 색 | `string` |  | 사진이 없을 때 달력에 칠할 색 |
| `createdAt` | 만든 시각 | `string` |  | ISO 8601 시각 |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

**`stickers` · 날짜 스티커** — 기본 키 `date` (하루 하나) · 인덱스 없음 · v10부터

| 물리명 | 논리명 | 타입 | 키 | 설명 |
|---|---|---|:---:|---|
| `date` | 날짜 | `string` | **PK** | YYYY-MM-DD |
| `emoji` | 이모티콘 | `string` |  |  |
| `updatedAt` | 고친 시각 | `string` |  | ISO 8601 시각 (동기화할 때 더 새것이 이긴다) |

</details>

<details>
<summary><b>기록 안에 들어가는 묶음 (JSON)</b> · 따로 표가 아니라 칸 하나에 통째로 저장</summary>

| 물리명 (타입) | 논리명 | 들어가는 곳 | 칸 |
|---|---|---|---|
| `Attachment` | 첨부 파일 | todos · events · diaries · memos | `name` 파일 이름 · `type` MIME 종류 · `size` 바이트 · `src` data URL |
| `DiaryPhoto` | 일기 사진 | diaries.photos | `src` JPEG data URL · `time?` 찍은 시각 HH:mm · `note?` 한 줄 메모 |
| `DiaryHour` | 시간별 일기 칸 | diaries.hours | `hour` 0~23 · `text` 글자 · `html?` 꾸민 글 · `pics?` 글 사이 사진(MemoPic[]) |
| `MemoPic` | 글 사이 사진 | memos.pics · DiaryHour.pics | `id` 자리 이름 · `src` 사진 data URL |
| `MemoInk` | 손글씨 한 장 | memos.ink | `src` PNG data URL · `text?` AI가 읽은 글자 · `at` 쓴 시각 |
| `Schedule` | 반복 주기 | savings.schedule · habits.schedule | `freq` 'daily' · 'weekly' · 'monthly' · `weekday?` 0(일)~6(토) · `day?` 1~31 |
| `TodoRepeat` | 할 일 반복 | todos.repeat | `every` 'day' · 'week'(+`days` 요일들) · 'month'(+`day` 날짜) |

</details>

<details>
<summary><b>동기화 (Cloud Firestore)</b> · 구글 로그인했을 때 올라가는 모양</summary>

기기 안 표를 그대로 옮기지 않고, 모든 표의 기록을 **한 줄 = 문서 하나**로 담아요. 내 uid 아래만 읽고 쓸 수 있어요 ([firestore.rules](firestore.rules)).

| 경로 (물리명) | 논리명 | 칸 |
|---|---|---|
| `users/{uid}/rows/{표~키}` | 기록 한 줄 | `t` 표 이름 · `j` 기록 JSON (지웠으면 null) · `u` 서버 시각 · `d` 올린 기기 번호 |
| `users/{uid}/files/{해시}` | 사진 · 파일 | `v` data URL (같은 사진은 한 번만, 약 650KB 넘으면 기기에만) |
| `users/{uid}/meta/devices` | 기기 번호 | `next` 다음 기기 번호 |

</details>

<!-- ERD:END -->

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
