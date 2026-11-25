// Tidy ERD 만들기
// 기기 안 DB(src/db/database.ts · src/db/types.ts)의 테이블을 여기 한 곳에 적어 두고,
//   docs/erd.svg       핵심 칸(키 · 연결 칸)만 그린 ERD
//   docs/erd-full.svg  모든 칸을 그린 ERD
//   README.md          <!-- ERD:START --> ~ <!-- ERD:END --> 사이의 표 (물리명 · 논리명 · 타입 · 키 · 설명)
// 를 한 번에 만든다. DB 버전을 올리거나 칸을 더하면 여기도 고치고 `node scripts/erd.mjs` 를 돌린다.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DB_VERSION = 12

const TIME = ['createdAt', '만든 시각', 'string', '', 'ISO 8601 시각']
const UPD = ['updatedAt', '고친 시각', 'string', '', 'ISO 8601 시각 (동기화할 때 더 새것이 이긴다)']

/** 도메인(그룹) */
const GROUPS = {
  money: { name: '가계부', color: '#4F9DFF' },
  todo: { name: '할 일', color: '#8B7CFF' },
  habit: { name: '습관', color: '#FF8A5B' },
  scrap: { name: '스크랩', color: '#FF7EB3' },
  memo: { name: '메모', color: '#2BB673' },
  cal: { name: '캘린더 · 일기', color: '#F5A524' },
}

/**
 * 칸: [물리명, 논리명, 타입, 키, 설명, 연결]
 * 키: PK 기본 키 · FK 다른 표 id · UK 중복 불가 인덱스 · IX 인덱스 · LK 이름(값)으로 이어지는 칸 · '' 없음
 * 타입 끝의 ? 는 없을 수 있는 칸
 */
export const TABLES = [
  {
    name: 'transactions', label: '가계부 내역', group: 'money', since: 1, pk: '`id` 자동 번호',
    index: ['date', '[type+date]', 'category', 'savingsId'],
    desc: '수입 · 지출 한 건. 정기 내역 · 적금이 자동으로 만든 내역도 여기에 들어간다',
    cols: [
      ['id', '내역 번호', 'number', 'PK', '자동 증가'],
      ['type', '수입/지출', "'INCOME' | 'EXPENSE'", 'IX', '[type+date] 묶음 인덱스'],
      ['amount', '금액', 'number', '', '원, 정수 1 ~ 999,999,999'],
      ['category', '카테고리', 'string', 'LK', '식비 · 교통 · 저축 등. 인덱스도 있다. 예산과 이름으로 이어진다', 'budgets.category'],
      ['date', '날짜', 'string', 'IX', 'YYYY-MM-DD'],
      ['time', '시각', 'string?', '', 'HH:mm'],
      ['memo', '메모 (가게 이름)', 'string', '', '0 ~ 200자'],
      ['account', '결제 수단', 'string?', 'LK', '내 카드 · 계좌의 이름', 'payMethods.name'],
      ['recurringId', '정기 내역 번호', 'number?', 'FK', '정기 내역이 자동 기록했을 때', 'recurring.id'],
      ['savingsId', '적금 번호', 'number?', 'FK', '적금 납입으로 기록했을 때', 'savings.id'],
      ['originalMemo', '원래 가게 이름', 'string?', 'LK', '가게를 알려 주기 전 카드사 이름 (예: KCP*결제)', 'merchantAliases.raw'],
      TIME, UPD,
    ],
  },
  {
    name: 'payMethods', label: '내 카드 · 계좌', group: 'money', since: 12, pk: '`id` 자동 번호',
    index: ['order'],
    desc: '어떤 카드 · 계좌로 썼는지 구분한다. 내역에는 id가 아니라 이름으로 들어간다',
    cols: [
      ['id', '결제 수단 번호', 'number', 'PK', '자동 증가'],
      ['name', '이름', 'string', 'LK', '예: 신한 체크, 국민 월급통장. 내역 · 정기 내역 · 적금의 결제 수단 칸 값'],
      ['kind', '종류', "'card' | 'account' | 'pay' | 'cash'", '', '카드 / 계좌 / 간편결제 / 현금'],
      ['last4', '끝 4자리', 'string?', '', '결제 알림에서 찾을 때 쓴다'],
      ['order', '순서', 'number', 'IX', '작을수록 앞'],
      TIME, UPD,
    ],
  },
  {
    name: 'merchantAliases', label: '가게 이름 기억', group: 'money', since: 3, pk: '`raw` (정리한 원래 이름)',
    index: [],
    desc: '카드사에 찍힌 이름(KCP · NICE 등)을 실제 가게 이름으로 바꿔 보여 준다',
    cols: [
      ['raw', '정리한 원래 이름', 'string', 'PK', '원래 이름을 normalizeName 한 값'],
      ['original', '원래 이름', 'string', '', '화면 표시용'],
      ['name', '실제 가게 이름', 'string', '', '사용자가 알려 준 이름'],
      TIME,
    ],
  },
  {
    name: 'recurring', label: '정기 내역 규칙', group: 'money', since: 2, pk: '`id` 자동 번호',
    index: ['type', 'isActive'],
    desc: '월급 · 구독료처럼 매달 같은 날 자동으로 내역을 만든다',
    cols: [
      ['id', '규칙 번호', 'number', 'PK', '자동 증가'],
      ['type', '수입/지출', "'INCOME' | 'EXPENSE'", 'IX', ''],
      ['amount', '금액', 'number', '', '금액을 매번 물으면 0'],
      ['category', '카테고리', 'string', '', ''],
      ['memo', '이름', 'string', '', '예: 넷플릭스, 월급'],
      ['account', '결제 수단', 'string?', 'LK', '내 카드 · 계좌의 이름', 'payMethods.name'],
      ['askAmount', '금액 매번 묻기', '0 | 1 ?', '', '1이면 그날마다 금액을 물어본다'],
      ['day', '매달 며칠', 'number', '', '1 ~ 31 (없는 날이면 말일)'],
      ['startDate', '시작일', 'string', '', 'YYYY-MM-DD'],
      ['lastDate', '마지막 기록일', 'string | null', '', 'YYYY-MM-DD'],
      ['isActive', '사용 중', '0 | 1', 'IX', ''],
      TIME, UPD,
    ],
  },
  {
    name: 'budgets', label: '한 달 예산', group: 'money', since: 9, pk: '`category`',
    index: [],
    desc: '매달 똑같이 적용되는 예산 (전체 + 카테고리별)',
    cols: [
      ['category', '카테고리', 'string', 'PK', "지출 카테고리 이름. '' 이면 한 달 전체 예산"],
      ['amount', '예산', 'number', '', '원, 1 이상'],
      UPD,
    ],
  },
  {
    name: 'savings', label: '적금', group: 'money', since: 7, pk: '`id` 자동 번호',
    index: [],
    desc: '만기 금액 계산 · 자동 납입 · 납입일 알림. 만들 때 습관 하나를 같이 만든다',
    cols: [
      ['id', '적금 번호', 'number', 'PK', '자동 증가'],
      ['name', '이름', 'string', '', '예: 청년도약계좌'],
      ['bank', '은행', 'string?', '', ''],
      ['fromAccount', '나가는 계좌', 'string?', 'LK', '내 카드 · 계좌의 이름. 납입 내역의 결제 수단', 'payMethods.name'],
      ['amount', '한 번에 넣는 돈', 'number', '', '원'],
      ['startDate', '가입일', 'string', '', 'YYYY-MM-DD, 첫 납입일'],
      ['endDate', '만기일', 'string', '', 'YYYY-MM-DD'],
      ['rate', '연 이율', 'number', '', '% (우대금리 포함)'],
      ['interestType', '이자 방식', "'simple' | 'compound'", '', '단리 / 월복리'],
      ['taxType', '이자 세금', "'normal' | 'preferential' | 'free'", '', '일반 15.4% / 세금우대 9.5% / 비과세'],
      ['schedule', '넣는 날', 'Schedule', '', '매일 · 매주 요일 · 매달 날짜 (아래 묶음 참고)'],
      ['autoDeposit', '자동이체', '0 | 1', '', '1이면 넣는 날 가계부에 자동 기록, 0이면 습관 체크로 기록'],
      ['alarmOn', '알림 켜짐', '0 | 1', '', ''],
      ['alarmTime', '알림 시각', 'string', '', 'HH:mm'],
      ['habitId', '습관 번호', 'number?', 'FK', '같이 만든 습관', 'habits.id'],
      ['lastDate', '마지막 자동 기록', 'string | null', '', 'YYYY-MM-DD'],
      ['memo', '메모', 'string', '', ''],
      TIME, UPD,
    ],
  },
  {
    name: 'todoCategories', label: '할 일 카테고리', group: 'todo', since: 8, pk: '`id` 자동 번호',
    index: ['order'],
    desc: '할 일 캘린더 아래 묶음',
    cols: [
      ['id', '카테고리 번호', 'number', 'PK', '자동 증가'],
      ['name', '이름', 'string', '', ''],
      ['color', '색', "'peach' | 'sky' | 'mint' | 'lilac' | 'lemon' | 'rose'", '', ''],
      ['order', '순서', 'number', 'IX', ''],
      TIME,
    ],
  },
  {
    name: 'todos', label: '할 일', group: 'todo', since: 1, pk: '`id` 자동 번호',
    index: ['dueDate', 'isCompleted', '&bookmarkId', 'categoryId'],
    desc: '마감일 · 중요도 · 알림 · 반복이 있는 할 일. 스크랩에서 바꾼 할 일은 그 스크랩과 1:1',
    cols: [
      ['id', '할 일 번호', 'number', 'PK', '자동 증가'],
      ['title', '제목', 'string', '', '1 ~ 100자'],
      ['isCompleted', '완료', '0 | 1', 'IX', '인덱스 때문에 불리언 대신 숫자'],
      ['completedAt', '완료 시각', 'string | null', '', '되돌리면 null'],
      ['dueDate', '마감일', 'string | null', 'IX', 'YYYY-MM-DD'],
      ['priority', '중요도', "'HIGH' | 'MEDIUM' | 'LOW'", '', '기본 MEDIUM'],
      ['bookmarkId', '스크랩 번호', 'number?', 'FK', '스크랩 → 할 일로 바꿨을 때. 중복 불가 (&bookmarkId)', 'bookmarks.id'],
      ['categoryId', '카테고리 번호', 'number?', 'FK', '없으면 기본', 'todoCategories.id'],
      ['remindAt', '알림 시각', 'string?', '', 'HH:mm, 마감일 그날'],
      ['repeat', '반복', 'TodoRepeat?', '', '매일 · 매주 요일 · 매달 날짜'],
      ['repeatNextId', '다음 반복 번호', 'number?', 'FK', '끝내서 생긴 다음 할 일 (같은 표)', 'todos.id'],
      ['memo', '메모', 'string?', '', '제목 아래 작게'],
      ['attachments', '참고 사진 · 파일', 'Attachment[]?', '', 'data URL로 기록 안에 들어간다'],
      TIME, UPD,
    ],
  },
  {
    name: 'habits', label: '습관', group: 'habit', since: 6, pk: '`id` 자동 번호',
    index: ['order'],
    desc: '매일(또는 정한 날) 체크하는 반복 목표',
    cols: [
      ['id', '습관 번호', 'number', 'PK', '자동 증가'],
      ['title', '이름', 'string', '', '예: 물 2L 마시기'],
      ['emoji', '아이콘', 'string', '', '이모지 하나'],
      ['order', '순서', 'number', 'IX', ''],
      ['savingsId', '적금 번호', 'number?', 'FK', '적금이 만든 습관일 때', 'savings.id'],
      ['schedule', '주기', 'Schedule?', '', '없으면 매일'],
      TIME, UPD,
    ],
  },
  {
    name: 'habitChecks', label: '습관 체크', group: 'habit', since: 6, pk: '`[habitId+date]` 묶음 키',
    index: ['habitId', 'date'],
    desc: '그날 그 습관을 했다는 기록. 기록이 없으면 안 한 날',
    cols: [
      ['habitId', '습관 번호', 'number', 'PK', '묶음 키 앞쪽', 'habits.id'],
      ['date', '날짜', 'string', 'PK', 'YYYY-MM-DD, 묶음 키 뒤쪽'],
      TIME,
    ],
  },
  {
    name: 'scrapCategories', label: '스크랩 카테고리', group: 'scrap', since: 5, pk: '`id` 자동 번호',
    index: ['&name', 'order'],
    desc: '처음엔 맛집·카페 · 여행 · 쇼핑 · 공부 · 꿀팁 5개가 들어 있다',
    cols: [
      ['id', '카테고리 번호', 'number', 'PK', '자동 증가'],
      ['name', '이름', 'string', 'UK', '중복 불가'],
      ['order', '순서', 'number', 'IX', ''],
      TIME,
    ],
  },
  {
    name: 'bookmarks', label: '스크랩', group: 'scrap', since: 1, pk: '`id` 자동 번호',
    index: ['url', 'isRead', 'createdAt', 'categoryId'],
    desc: '나중에 볼 링크 + 미리보기 · 요약',
    cols: [
      ['id', '스크랩 번호', 'number', 'PK', '자동 증가'],
      ['url', '주소', 'string', 'IX', 'http/https만. 중복 확인에 쓴다'],
      ['title', '제목', 'string', '', '비우면 도메인'],
      ['memo', '메모', 'string', '', ''],
      ['isRead', '읽음', '0 | 1', 'IX', ''],
      ['categoryId', '카테고리 번호', 'number?', 'FK', '없으면 미분류', 'scrapCategories.id'],
      ['source', '출처', 'string?', '', 'instagram · naver · x · youtube · web'],
      ['description', '설명', 'string?', '', '링크 미리보기 설명 · 캡션 (1만 자까지)'],
      ['siteName', '사이트 이름', 'string?', '', ''],
      ['isVideo', '동영상 게시물', '0 | 1 ?', '', ''],
      ['summary', '요약', 'string?', '', 'AI 또는 기본 요약'],
      ['summaryAt', '요약한 시각', 'string?', '', ''],
      ['createdAt', '만든 시각', 'string', 'IX', 'ISO 8601 시각'],
      UPD,
    ],
  },
  {
    name: 'scrapMedia', label: '스크랩 사진 · 영상', group: 'scrap', since: 5, pk: '`id` 자동 번호',
    index: ['bookmarkId', '[bookmarkId+kind]'],
    desc: '미리보기 썸네일과 캡처 · 화면 녹화. 파일(Blob) 그대로 저장한다',
    cols: [
      ['id', '사진 번호', 'number', 'PK', '자동 증가'],
      ['bookmarkId', '스크랩 번호', 'number', 'FK', '', 'bookmarks.id'],
      ['kind', '종류', "'thumb' | 'capture'", 'IX', '썸네일 / 캡처 · 녹화'],
      ['blob', '파일', 'Blob', '', '보여 줄 파일 (편집했으면 편집본)'],
      ['original', '원본 파일', 'Blob?', '', '편집하기 전 원본'],
      TIME, UPD,
    ],
  },
  {
    name: 'memoFolders', label: '메모 파일집', group: 'memo', since: 11, pk: '`id` 자동 번호',
    index: ['order'],
    desc: '비슷한 메모끼리 모아 두는 폴더 (12가지 색)',
    cols: [
      ['id', '파일집 번호', 'number', 'PK', '자동 증가'],
      ['name', '이름', 'string', '', ''],
      ['color', '색', 'string', '', '#rrggbb'],
      ['order', '순서', 'number', 'IX', ''],
      TIME,
    ],
  },
  {
    name: 'memos', label: '메모', group: 'memo', since: 11, pk: '`id` 자동 번호',
    index: ['folderId', 'createdAt', 'updatedAt'],
    desc: '글 + 사진 · 영상 · 파일 · 손글씨. 쓴 시각 순서로 보인다',
    cols: [
      ['id', '메모 번호', 'number', 'PK', '자동 증가'],
      ['title', '제목', 'string', '', ''],
      ['text', '본문 글자', 'string', '', '꾸밈을 뺀 글자 (검색용)'],
      ['folderId', '파일집 번호', 'number?', 'FK', '없으면 파일집 밖', 'memoFolders.id'],
      ['html', '꾸민 글', 'string?', '', '굵게 · 형광펜 · 글 사이 사진'],
      ['pics', '글 사이 사진', 'MemoPic[]?', '', 'html 의 <img data-pic> 자리'],
      ['ink', '손글씨', 'MemoInk[]?', '', '최대 10장, AI가 읽은 글자 포함'],
      ['attachments', '사진 · 영상 · 파일', 'Attachment[]?', '', '최대 10개, 하나 50MB'],
      ['pinned', '맨 위 고정', '0 | 1 ?', '', ''],
      ['createdAt', '쓴 시각', 'string', 'IX', 'ISO 8601 시각'],
      ['updatedAt', '고친 시각', 'string', 'IX', 'ISO 8601 시각'],
    ],
  },
  {
    name: 'events', label: '캘린더 일정', group: 'cal', since: 4, pk: '`id` 자동 번호',
    index: ['startDate', 'endDate'],
    desc: '하루짜리 또는 여러 날 기간. 구글 · 폰 캘린더에서 가져온 일정도 같이 들어간다',
    cols: [
      ['id', '일정 번호', 'number', 'PK', '자동 증가'],
      ['title', '제목', 'string', '', ''],
      ['startDate', '시작일', 'string', 'IX', 'YYYY-MM-DD'],
      ['endDate', '끝나는 날', 'string', 'IX', 'YYYY-MM-DD (하루짜리면 시작일과 같다)'],
      ['color', '색', 'string', '', '이름 있는 색 21가지 또는 #rrggbb'],
      ['memo', '메모', 'string', '', ''],
      ['source', '가져온 곳', "'google' | 'device' ?", '', '없으면 Tidy에서 만든 일정'],
      ['calId', '가져온 캘린더', 'string?', '', '구글 캘린더 번호 또는 d:기기:캘린더'],
      ['uid', '원래 일정 id', 'string?', '', '가져온 일정의 원래 id'],
      ['attachments', '사진 · 파일', 'Attachment[]?', '', '최대 10개'],
      TIME, UPD,
    ],
  },
  {
    name: 'diaries', label: '일기', group: 'cal', since: 4, pk: '`date` (하루 하나)',
    index: [],
    desc: '하루에 하나. 날짜가 곧 키라서 달력 · 스티커 · 일정과 날짜로 만난다',
    cols: [
      ['date', '날짜', 'string', 'PK', 'YYYY-MM-DD'],
      ['text', '본문', 'string', '', ''],
      ['photo', '대표 사진', 'string?', '', 'JPEG data URL (photos 의 첫 장)'],
      ['photos', '사진', 'DiaryPhoto[]?', '', '최대 10장, 찍은 시간 순서'],
      ['hours', '시간별 기록', 'DiaryHour[]?', '', '0 ~ 23시 한 칸씩'],
      ['attachments', '파일', 'Attachment[]?', '', '최대 10개'],
      ['color', '색', 'string', '', '사진이 없을 때 달력에 칠할 색'],
      TIME, UPD,
    ],
  },
  {
    name: 'stickers', label: '날짜 스티커', group: 'cal', since: 10, pk: '`date` (하루 하나)',
    index: [],
    desc: '달력 날짜 칸에 붙이는 이모티콘',
    cols: [
      ['date', '날짜', 'string', 'PK', 'YYYY-MM-DD'],
      ['emoji', '이모티콘', 'string', '', ''],
      UPD,
    ],
  },
]

/** 관계: [자식 표.칸, 부모 표.칸, 종류] 종류: 'n1' 여러:하나, '11' 하나:하나, 'lk' 이름(값)으로 이어짐 */
export const RELATIONS = [
  ['transactions.recurringId', 'recurring.id', 'n1', '정기 내역이 만든 내역'],
  ['transactions.savingsId', 'savings.id', 'n1', '적금 납입 내역'],
  ['transactions.account', 'payMethods.name', 'lk', '어떤 카드 · 계좌로 썼는지 (이름으로)'],
  ['transactions.originalMemo', 'merchantAliases.raw', 'lk', '카드사 이름 → 실제 가게 이름 (정리한 이름으로)'],
  ['transactions.category', 'budgets.category', 'lk', '카테고리별 예산 (이름으로)'],
  ['recurring.account', 'payMethods.name', 'lk', '정기 내역의 결제 수단 (이름으로)'],
  ['savings.fromAccount', 'payMethods.name', 'lk', '적금이 나가는 계좌 (이름으로)'],
  ['savings.habitId', 'habits.id', '11', '적금 하나에 습관 하나'],
  ['habits.savingsId', 'savings.id', '11', '습관 쪽에서 적금을 가리킴'],
  ['habitChecks.habitId', 'habits.id', 'n1', '습관 하나에 날짜별 체크 여러 개'],
  ['todos.categoryId', 'todoCategories.id', 'n1', '카테고리 하나에 할 일 여러 개'],
  ['todos.bookmarkId', 'bookmarks.id', '11', '스크랩 → 할 일 전환 (1 : 0..1)'],
  ['todos.repeatNextId', 'todos.id', '11', '반복 할 일을 끝내서 생긴 다음 할 일'],
  ['bookmarks.categoryId', 'scrapCategories.id', 'n1', '카테고리 하나에 스크랩 여러 개'],
  ['scrapMedia.bookmarkId', 'bookmarks.id', 'n1', '스크랩 하나에 썸네일 · 캡처 여러 개'],
  ['memos.folderId', 'memoFolders.id', 'n1', '파일집 하나에 메모 여러 개'],
]

/** 기록 안에 JSON으로 들어가는 묶음 (따로 표가 아님) */
export const EMBEDDED = [
  ['Attachment', '첨부 파일', 'todos · events · diaries · memos', '`name` 파일 이름 · `type` MIME 종류 · `size` 바이트 · `src` data URL'],
  ['DiaryPhoto', '일기 사진', 'diaries.photos', '`src` JPEG data URL · `time?` 찍은 시각 HH:mm · `note?` 한 줄 메모'],
  ['DiaryHour', '시간별 일기 칸', 'diaries.hours', '`hour` 0~23 · `text` 글자 · `html?` 꾸민 글 · `pics?` 글 사이 사진(MemoPic[])'],
  ['MemoPic', '글 사이 사진', 'memos.pics · DiaryHour.pics', '`id` 자리 이름 · `src` 사진 data URL'],
  ['MemoInk', '손글씨 한 장', 'memos.ink', '`src` PNG data URL · `text?` AI가 읽은 글자 · `at` 쓴 시각'],
  ['Schedule', '반복 주기', 'savings.schedule · habits.schedule', "`freq` 'daily' · 'weekly' · 'monthly' · `weekday?` 0(일)~6(토) · `day?` 1~31"],
  ['TodoRepeat', '할 일 반복', 'todos.repeat', "`every` 'day' · 'week'(+`days` 요일들) · 'month'(+`day` 날짜)"],
]

// ───────────────────────── 그림 (SVG) ─────────────────────────

const byName = Object.fromEntries(TABLES.map((t) => [t.name, t]))
/** 열(왼쪽 → 오른쪽)마다 위에서 아래로 놓을 표 */
const LAYOUT = [
  ['payMethods', 'transactions', 'merchantAliases'],
  ['recurring', 'budgets', 'savings'],
  ['todoCategories', 'todos', 'habits', 'habitChecks'],
  ['scrapCategories', 'bookmarks', 'scrapMedia', 'memoFolders', 'memos'],
  ['events', 'diaries', 'stickers'],
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const shortType = (t) => {
  const opt = /\?\s*$/.test(t)
  let s = t.replace(/\?\s*$/, '').trim()
  if (s.includes("'")) s = 'enum'
  else if (s === 'string | null') s = 'string'
  else if (s === '0 | 1') s = 'flag'
  else if (s.endsWith('[]')) s = 'json[]'
  else if (/^[A-Z]/.test(s) && s !== 'Blob') s = 'json'
  return s + (opt || t.includes('null') ? '?' : '')
}
const KEY_COLOR = { PK: '#B45309', FK: '#7C3AED', UK: '#0E7490', IX: '#9CA3AF', LK: '#DB2777' }

function svg(full) {
  const W = 300, ROW = 21, HEAD = 50, PADB = 10, COLGAP = 90, TOP = 120, LEFT = 50, VGAP = 34
  const boxes = {}
  let maxY = 0
  LAYOUT.forEach((col, ci) => {
    let y = TOP
    col.forEach((name) => {
      const t = byName[name]
      const rows = full ? t.cols : t.cols.filter((c) => c[3] && c[3] !== 'IX')
      const hidden = t.cols.length - rows.length
      const h = HEAD + 8 + rows.length * ROW + (hidden ? ROW : 0) + PADB
      const x = LEFT + ci * (W + COLGAP)
      boxes[name] = { t, x, y, h, rows, hidden, rowY: {} }
      rows.forEach((c, i) => (boxes[name].rowY[c[0]] = y + HEAD + 8 + i * ROW + ROW / 2))
      y += h + VGAP
    })
    maxY = Math.max(maxY, y)
  })
  const width = LEFT * 2 + LAYOUT.length * W + (LAYOUT.length - 1) * COLGAP
  const height = maxY + 110
  const colOf = (name) => LAYOUT.findIndex((c) => c.includes(name))

  // 선: 열 사이 빈 칸(통로)에서만 세로로 움직인다
  const laneUse = {}
  const lane = (gapKey) => (laneUse[gapKey] = (laneUse[gapKey] || 0) + 1)
  const lines = []
  for (const [from, to, kind] of RELATIONS) {
    if (from === 'habits.savingsId') continue // savings.habitId 와 같은 선
    const [ft, fc] = from.split('.'), [tt, tc] = to.split('.')
    const a = boxes[ft], b = boxes[tt]
    const ay = a.rowY[fc], by = b.rowY[tc]
    const ca = colOf(ft), cb = colOf(tt)
    let d, sx, ex, sdir, edir
    if (ca === cb) {
      // 같은 열: 왼쪽 통로로 돌아간다 (자기 자신이면 오른쪽 작은 고리)
      if (ft === tt) {
        const n = lane('self' + ft)
        const lx = a.x + W + 18 + n * 8
        sx = a.x + W; ex = a.x + W; sdir = 1; edir = 1
        d = `M${sx} ${ay} H${lx} V${by} H${ex}`
      } else {
        const n = lane('g' + ca)
        const lx = a.x - 14 - n * 9
        sx = a.x; ex = b.x; sdir = -1; edir = -1
        d = `M${sx} ${ay} H${lx} V${by} H${ex}`
      }
    } else {
      const right = cb > ca
      const gap = right ? cb : ca // 통로 번호 = 오른쪽 열 번호
      const n = lane('g' + gap)
      const gx = LEFT + gap * (W + COLGAP) - COLGAP / 2 + (n - 2) * 10
      sx = right ? a.x + W : a.x; ex = right ? b.x : b.x + W
      sdir = right ? 1 : -1; edir = right ? -1 : 1
      d = `M${sx} ${ay} H${gx} V${by} H${ex}`
    }
    const color = kind === 'lk' ? '#DB2777' : '#7C3AED'
    const dash = kind === 'lk' ? ' stroke-dasharray="6 5"' : ''
    lines.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8"${dash} opacity=".85"/>`)
    // 부모 쪽 표시: || (하나)
    const bar = (x, y, dir) => `<path d="M${x + dir * 7} ${y - 6}V${y + 6}M${x + dir * 11} ${y - 6}V${y + 6}" stroke="${color}" stroke-width="1.8"/>`
    // 자식 쪽 표시: 까마귀 발 (여럿) 또는 | (하나)
    const crow = (x, y, dir) => `<path d="M${x} ${y - 7}L${x + dir * 12} ${y}L${x} ${y + 7}M${x + dir * 15} ${y - 6}V${y + 6}" fill="none" stroke="${color}" stroke-width="1.8"/>`
    const one = (x, y, dir) => `<path d="M${x + dir * 9} ${y - 6}V${y + 6}" stroke="${color}" stroke-width="1.8"/>`
    if (kind === 'lk') {
      lines.push(`<circle cx="${ex + edir * 5}" cy="${by}" r="3.5" fill="${color}"/>`)
    } else {
      lines.push(bar(ex, by, edir))
      lines.push(kind === 'n1' ? crow(sx, ay, sdir) : one(sx, ay, sdir))
    }
  }

  const parts = []
  // 그룹 배경 (같은 열 안에서 이어지는 같은 그룹을 한 판으로)
  LAYOUT.forEach((col) => {
    let i = 0
    while (i < col.length) {
      const g = byName[col[i]].group
      let j = i
      while (j + 1 < col.length && byName[col[j + 1]].group === g) j++
      const first = boxes[col[i]], last = boxes[col[j]]
      const gc = GROUPS[g].color
      parts.push(`<rect x="${first.x - 10}" y="${first.y - 28}" width="${W + 20}" height="${last.y + last.h - first.y + 38}" rx="18" fill="${gc}" fill-opacity=".07" stroke="${gc}" stroke-opacity=".35" stroke-dasharray="4 4"/>`)
      parts.push(`<text x="${first.x + 4}" y="${first.y - 10}" class="grp" fill="${gc}">● ${GROUPS[g].name}</text>`)
      i = j + 1
    }
  })
  parts.push(...lines)
  for (const b of Object.values(boxes)) {
    const { t, x, y, h } = b
    const gc = GROUPS[t.group].color
    parts.push(`<g transform="translate(${x},${y})">`)
    parts.push(`<rect width="${W}" height="${h}" rx="14" fill="#fff" stroke="${gc}" stroke-opacity=".6" stroke-width="1.5" filter="url(#sh)"/>`)
    parts.push(`<path d="M0 14a14 14 0 0 1 14-14h${W - 28}a14 14 0 0 1 14 14v${HEAD - 14}H0z" fill="url(#g-${t.group})"/>`)
    parts.push(`<text x="14" y="22" class="tn">${esc(t.name)}</text>`)
    parts.push(`<text x="14" y="40" class="tl">${esc(t.label)}</text>`)
    parts.push(`<text x="${W - 12}" y="40" class="tv" text-anchor="end">v${t.since}</text>`)
    b.rows.forEach((c, i) => {
      const ry = HEAD + 8 + i * ROW + 15
      if (i % 2 === 1) parts.push(`<rect x="1" y="${ry - 15}" width="${W - 2}" height="${ROW}" fill="#F7F5FF"/>`)
      if (c[3]) parts.push(`<text x="12" y="${ry}" class="k" fill="${KEY_COLOR[c[3]]}">${c[3]}</text>`)
      parts.push(`<text x="40" y="${ry}" class="f">${esc(c[0])}</text>`)
      parts.push(`<text x="150" y="${ry}" class="l">${esc(c[1])}</text>`)
      parts.push(`<text x="${W - 12}" y="${ry}" class="t" text-anchor="end">${esc(shortType(c[2]))}</text>`)
    })
    if (b.hidden) parts.push(`<text x="40" y="${HEAD + 8 + b.rows.length * ROW + 15}" class="more">+ 그 밖의 칸 ${b.hidden}개</text>`)
    parts.push('</g>')
  }

  const grads = Object.entries(GROUPS).map(([k, g]) => `<linearGradient id="g-${k}" x1="0" x2="1"><stop offset="0" stop-color="${g.color}"/><stop offset="1" stop-color="${g.color}" stop-opacity=".72"/></linearGradient>`).join('')
  const ly = height - 88
  const legend = `
  <g transform="translate(${LEFT},${ly})">
    <rect width="${width - LEFT * 2}" height="68" rx="14" fill="#FAFAFF" stroke="#E5E7EB"/>
    ${[['PK', '기본 키', 18], ['FK', '다른 표의 번호', 120], ['UK', '중복 불가', 262], ['LK', '이름(값)으로 이어지는 칸', 378], ['IX', '인덱스', 578]].map(([k, t, x]) => `<text x="${x}" y="27" class="lg"><tspan class="k" fill="${KEY_COLOR[k]}">${k}</tspan><tspan dx="6">${t}</tspan></text>`).join('')}
    <text x="680" y="27" class="lg"><tspan font-weight="800">v12</tspan><tspan dx="6">처음 생긴 DB 버전</tspan></text><text x="850" y="27" class="lg"><tspan font-weight="800">?</tspan><tspan dx="6">없을 수 있음</tspan></text><text x="970" y="27" class="lg"><tspan font-weight="800">flag</tspan><tspan dx="6">0 또는 1 숫자 (불리언)</tspan></text>
    <path d="M18 50H58" stroke="#7C3AED" stroke-width="1.8"/><path d="M51 44V56M47 44V56" stroke="#7C3AED" stroke-width="1.8"/><path d="M18 43L30 50L18 57M33 44V56" fill="none" stroke="#7C3AED" stroke-width="1.8"/>
    <text x="68" y="54" class="lg">여러 : 하나</text>
    <path d="M168 50H208" stroke="#7C3AED" stroke-width="1.8"/><path d="M201 44V56M197 44V56M177 44V56" stroke="#7C3AED" stroke-width="1.8"/>
    <text x="218" y="54" class="lg">하나 : 하나</text>
    <path d="M318 50H358" stroke="#DB2777" stroke-width="1.8" stroke-dasharray="6 5"/><circle cx="361" cy="50" r="3.5" fill="#DB2777"/>
    <text x="374" y="54" class="lg">id 대신 이름 · 값으로 이어짐 (DB가 강제하지 않음)</text>
    <text x="${width - LEFT * 2 - 18}" y="54" class="lg" text-anchor="end">IndexedDB에는 외래 키 제약이 없어서 관계는 앱 코드가 지켜요</text>
  </g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Pretendard, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif">
  <defs>
    <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#4FD1FF"/><stop offset="0.5" stop-color="#8B7CFF"/><stop offset="1" stop-color="#FF7EB3"/></linearGradient>
    ${grads}
    <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#6D28D9" flood-opacity=".10"/></filter>
    <style>
      .tn { fill: #fff; font-size: 15px; font-weight: 800; }
      .tl { fill: #fff; font-size: 12px; font-weight: 600; opacity: .95; }
      .tv { fill: #fff; font-size: 11px; font-weight: 700; opacity: .9; }
      .f { fill: #111827; font-size: 12.5px; font-weight: 600; }
      .l { fill: #4B5563; font-size: 12px; }
      .t { fill: #9CA3AF; font-size: 11px; font-family: ui-monospace, Menlo, Consolas, monospace; }
      .k { font-size: 10.5px; font-weight: 800; }
      .more { fill: #9CA3AF; font-size: 11.5px; }
      .grp { font-size: 13px; font-weight: 800; }
      .lg { fill: #4B5563; font-size: 12.5px; }
      .h1 { fill: url(#g); font-size: 30px; font-weight: 900; }
      .h2 { fill: #6B7280; font-size: 14px; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="#fff"/>
  <text x="${LEFT}" y="56" class="h1">TIDY: ERD</text>
  <text x="${LEFT}" y="82" class="h2">기기 안 DB (IndexedDB · Dexie) · DB 버전 ${DB_VERSION} · 표 ${TABLES.length}개 · ${full ? '모든 칸' : '키 · 연결 칸만 (모든 칸은 erd-full.svg)'}</text>
  ${parts.join('\n  ')}
  ${legend}
</svg>
`
}

// ───────────────────────── README 표 ─────────────────────────

const cell = (s) => String(s).replace(/\|/g, '\\|')
const code = (s) => '`' + String(s).replace(/\|/g, '\\|') + '`'
const KEY_LABEL = { PK: '**PK**', FK: '**FK**', UK: '**UK**', IX: 'IX', LK: '**LK**', '': '' }

function readme() {
  const out = []
  out.push('<!-- ERD:START — 이 사이는 `node scripts/erd.mjs`가 만든다. 직접 고치지 말고 scripts/erd.mjs를 고친다 -->')
  out.push('')
  out.push(`Tidy의 모든 기록은 먼저 **기기 안 IndexedDB**(Dexie, DB 버전 ${DB_VERSION})에 저장돼요. 표 ${TABLES.length}개를 6개 묶음으로 나눴고, 이름은 코드에 쓰는 **물리명**(영어)과 화면에서 부르는 **논리명**(한국어)을 같이 적었어요.`)
  out.push('')
  out.push('<a href="docs/erd-full.svg"><img src="docs/erd-full.svg" alt="Tidy ERD (모든 칸)" width="100%"></a>')
  out.push('')
  out.push('> 표 18개의 모든 칸이 들어간 ERD예요 (누르면 크게 보여요). 키 · 연결 칸만 추린 요약 그림은 [docs/erd.svg](docs/erd.svg)')
  out.push('')
  out.push('#### 표 한눈에 보기')
  out.push('')
  out.push('| 묶음 | 물리명 (표) | 논리명 | 기본 키 | 처음 생긴 버전 | 무엇을 담나 |')
  out.push('|---|---|---|---|:---:|---|')
  for (const g of Object.keys(GROUPS)) {
    for (const t of TABLES.filter((x) => x.group === g)) {
      out.push(`| ${GROUPS[g].name} | ${code(t.name)} | ${t.label} | ${t.pk} | v${t.since} | ${cell(t.desc)} |`)
    }
  }
  out.push('')
  out.push('#### 관계')
  out.push('')
  out.push('| 자식 칸 | 부모 칸 | 종류 | 내용 |')
  out.push('|---|---|:---:|---|')
  const KIND = { n1: 'N : 1', 11: '1 : 1', lk: '이름으로' }
  for (const [f, t, k, d] of RELATIONS) out.push(`| ${code(f)} | ${code(t)} | ${KIND[k]} | ${d} |`)
  out.push('')
  out.push('- IndexedDB에는 외래 키 제약이 없어서, 관계는 앱 코드(`src/repositories`)가 지켜요. 예: 스크랩을 지우면 붙은 사진(`scrapMedia`)도 같이 지워요.')
  out.push('- `diaries` · `stickers` · `events`는 id 대신 **날짜**(`YYYY-MM-DD`)로 한 달력에 모여요. 가계부 · 할 일도 날짜 칸으로 같은 달력에 보여요.')
  out.push('- 불리언은 인덱스를 쓰려고 `0 | 1` 숫자로 저장해요 (그림에서 `flag`).')
  out.push('')
  out.push('#### 표 정의 (물리명 · 논리명 · 타입)')
  out.push('')
  out.push('키: **PK** 기본 키 · **FK** 다른 표의 번호 · **UK** 중복 불가 인덱스 · **LK** 이름(값)으로 이어지는 칸 · IX 인덱스. 타입 끝의 `?`는 없을 수 있는 칸이에요.')
  out.push('')
  for (const g of Object.keys(GROUPS)) {
    const ts = TABLES.filter((x) => x.group === g)
    out.push(`<details>`)
    out.push(`<summary><b>${GROUPS[g].name}</b> · ${ts.map((t) => `${t.name} (${t.label})`).join(' · ')}</summary>`)
    out.push('')
    for (const t of ts) {
      const idx = t.index.length ? t.index.map((i) => code(i)).join(', ') : '없음'
      out.push(`**${code(t.name)} · ${t.label}** — 기본 키 ${t.pk} · 인덱스 ${idx} · v${t.since}부터`)
      out.push('')
      out.push('| 물리명 | 논리명 | 타입 | 키 | 설명 |')
      out.push('|---|---|---|:---:|---|')
      for (const [p, l, ty, k, d, link] of t.cols) {
        const desc = [d, link ? `→ ${code(link)}` : ''].filter(Boolean).join(' ')
        out.push(`| ${code(p)} | ${l} | ${code(ty)} | ${KEY_LABEL[k]} | ${cell(desc)} |`)
      }
      out.push('')
    }
    out.push('</details>')
    out.push('')
  }
  out.push('<details>')
  out.push('<summary><b>기록 안에 들어가는 묶음 (JSON)</b> · 따로 표가 아니라 칸 하나에 통째로 저장</summary>')
  out.push('')
  out.push('| 물리명 (타입) | 논리명 | 들어가는 곳 | 칸 |')
  out.push('|---|---|---|---|')
  for (const [p, l, w, c] of EMBEDDED) out.push(`| ${code(p)} | ${l} | ${w} | ${c} |`)
  out.push('')
  out.push('</details>')
  out.push('')
  out.push('<details>')
  out.push('<summary><b>동기화 (Cloud Firestore)</b> · 구글 로그인했을 때 올라가는 모양</summary>')
  out.push('')
  out.push('기기 안 표를 그대로 옮기지 않고, 모든 표의 기록을 **한 줄 = 문서 하나**로 담아요. 내 uid 아래만 읽고 쓸 수 있어요 ([firestore.rules](firestore.rules)).')
  out.push('')
  out.push('| 경로 (물리명) | 논리명 | 칸 |')
  out.push('|---|---|---|')
  out.push('| `users/{uid}/rows/{표~키}` | 기록 한 줄 | `t` 표 이름 · `j` 기록 JSON (지웠으면 null) · `u` 서버 시각 · `d` 올린 기기 번호 |')
  out.push('| `users/{uid}/files/{해시}` | 사진 · 파일 | `v` data URL (같은 사진은 한 번만, 약 650KB 넘으면 기기에만) |')
  out.push('| `users/{uid}/meta/devices` | 기기 번호 | `next` 다음 기기 번호 |')
  out.push('')
  out.push('</details>')
  out.push('')
  out.push('<!-- ERD:END -->')
  return out.join('\n')
}

writeFileSync(join(root, 'docs/erd.svg'), svg(false))
writeFileSync(join(root, 'docs/erd-full.svg'), svg(true))
const readmePath = join(root, 'README.md')
const md = readFileSync(readmePath, 'utf8')
const start = md.indexOf('<!-- ERD:START')
const end = md.indexOf('<!-- ERD:END -->')
if (start < 0 || end < 0) throw new Error('README.md 에 <!-- ERD:START --> / <!-- ERD:END --> 자리가 없어요')
writeFileSync(readmePath, md.slice(0, start) + readme() + md.slice(end + '<!-- ERD:END -->'.length))
console.log(`docs/erd.svg · docs/erd-full.svg · README.md (표 ${TABLES.length}개, 관계 ${RELATIONS.length}개)`)
