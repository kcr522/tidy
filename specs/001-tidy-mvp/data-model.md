# Data Model: Tidy 1차 MVP

원본 PDF의 ERD(Transactions, Todos, Bookmarks)를 그대로 따르되, 1차를 완성하는 데 필요한 필드를 보완했다. 코드에서는 camelCase를 쓰고, PDF의 이름은 괄호에 적었다.

## 관계도

```text
┌─────────────────────┐      ┌──────────────────────┐   1 : 0..1   ┌──────────────────────┐
│ transactions (가계부) │      │ todos (할 일)          │◀────────────▶│ bookmarks (스크랩)     │
├─────────────────────┤      ├──────────────────────┤  bookmarkId  ├──────────────────────┤
│ id          PK      │      │ id          PK       │              │ id          PK       │
│ type                │      │ title                │              │ url                  │
│ amount              │      │ isCompleted          │              │ title                │
│ category            │      │ completedAt   (추가)  │              │ memo                 │
│ date                │      │ dueDate              │              │ isRead               │
│ memo                │      │ priority             │              │ createdAt            │
│ createdAt   (추가)   │      │ bookmarkId  FK       │              │ updatedAt   (추가)    │
│ updatedAt   (추가)   │      │ createdAt   (추가)    │              └──────────────────────┘
└─────────────────────┘      │ updatedAt   (추가)    │
   (할 일과의 연동은 2차)        └──────────────────────┘
```

## 공통 규칙

- `id`는 자동 증가 정수다.
- 날짜만 필요한 값(`date`, `dueDate`)은 시간대 문제를 피하려고 `"YYYY-MM-DD"` 문자열로 저장한다.
- 시각 값(`createdAt`, `updatedAt`, `completedAt`)은 ISO 8601 문자열(예: `"2026-11-10T13:05:00.000Z"`)로 저장한다.
- 모든 테이블은 저장할 때 `createdAt`, 고칠 때 `updatedAt`을 자동으로 채운다.
- 불리언 값은 IndexedDB 인덱스에 쓸 수 없으므로 인덱스가 필요한 값은 `0`/`1` 숫자로 저장한다(`isCompleted`, `isRead`). 코드의 타입에서는 boolean으로 다룬다.

## Transaction (가계부 내역) — `transactions`

| 필드 | 타입 | 필수 | 규칙 |
|---|---|---|---|
| id | number | 자동 | PK |
| type | `'INCOME'` \| `'EXPENSE'` | ✅ | 기본값 `EXPENSE` |
| amount | number | ✅ | 정수, 1 ~ 999,999,999 |
| category | string | ✅ | type에 맞는 카테고리 목록 안의 값 |
| date | string | ✅ | `YYYY-MM-DD`, 기본값 오늘 |
| memo | string | | 0 ~ 200자 |
| createdAt | string | 자동 | |
| updatedAt | string | 자동 | |

**카테고리 (FR-013)**

- 지출(EXPENSE): 식비, 교통, 쇼핑, 문화/여가, 주거/통신, 의료/건강, 교육, 기타
- 수입(INCOME): 월급, 용돈, 부수입, 기타

**인덱스**: `date`, `[type+date]`, `category`

## Todo (할 일) — `todos`

| 필드 | 타입 | 필수 | 규칙 |
|---|---|---|---|
| id | number | 자동 | PK |
| title | string | ✅ | 1 ~ 100자, 앞뒤 공백 제거 |
| isCompleted (is_completed) | 0 \| 1 | ✅ | 기본값 0 |
| completedAt | string \| null | | 완료할 때 기록, 미완료로 되돌리면 null |
| dueDate (due_date) | string \| null | | `YYYY-MM-DD` 또는 없음 |
| priority | `'HIGH'` \| `'MEDIUM'` \| `'LOW'` | ✅ | 기본값 `MEDIUM` |
| bookmarkId (scrap_id) | number \| null | | 전환된 스크랩의 id. 스크랩 하나당 할 일 하나 |
| createdAt | string | 자동 | |
| updatedAt | string | 자동 | |

**인덱스**: `dueDate`, `isCompleted`, `&bookmarkId`(중복 불가, null은 제외)

**상태 변화**

```text
미완료(isCompleted=0) ──체크──▶ 완료(isCompleted=1, completedAt=지금)
        ▲                              │
        └────────────체크 해제──────────┘ (completedAt=null)

완료로 바뀔 때 bookmarkId가 있으면 → 해당 bookmark.isRead = 1 (FR-042)
```

## Bookmark (스크랩) — `bookmarks`

| 필드 | 타입 | 필수 | 규칙 |
|---|---|---|---|
| id | number | 자동 | PK |
| url | string | ✅ | `http://` 또는 `https://`로 시작하는 올바른 주소. 스킴이 없으면 `https://`를 붙임 |
| title | string | ✅ | 1 ~ 100자. 비어 있으면 URL의 도메인 |
| memo | string | | 0 ~ 200자 |
| isRead (is_read) | 0 \| 1 | ✅ | 기본값 0 |
| createdAt (created_at) | string | 자동 | |
| updatedAt | string | 자동 | |

**인덱스**: `url`(중복 확인용), `isRead`, `createdAt`

## 삭제 시 연결 처리 (FR-044)

| 삭제 대상 | 처리 |
|---|---|
| Bookmark | 그 id를 `bookmarkId`로 가진 Todo의 `bookmarkId`를 null로 바꾼다. 할 일은 남는다 |
| Todo | 아무것도 하지 않는다. 스크랩은 남고, 다시 할 일로 전환할 수 있다 |

## Dexie 스키마 (코드)

```ts
// src/db/database.ts
import Dexie, { type Table } from 'dexie';
import type { Transaction, Todo, Bookmark } from './types';

export class TidyDB extends Dexie {
  transactions!: Table<Transaction, number>;
  todos!: Table<Todo, number>;
  bookmarks!: Table<Bookmark, number>;

  constructor() {
    super('tidy');
    this.version(1).stores({
      transactions: '++id, date, [type+date], category',
      todos: '++id, dueDate, isCompleted, &bookmarkId',
      bookmarks: '++id, url, isRead, createdAt',
    });
  }
}

export const db = new TidyDB();
```

## 백업 파일 형식 (FR-060)

```json
{
  "app": "tidy",
  "appVersion": "0.1.0",
  "schemaVersion": 1,
  "exportedAt": "2026-11-10T13:05:00.000Z",
  "data": {
    "transactions": [ { "id": 1, "type": "EXPENSE", "amount": 15000, "category": "식비", "date": "2026-11-10", "memo": "점심", "createdAt": "...", "updatedAt": "..." } ],
    "todos": [ ],
    "bookmarks": [ ]
  }
}
```

가져오기 검사: `app === "tidy"`, `schemaVersion`이 현재 버전 이하, `data`에 세 배열이 모두 있을 것. 하나라도 틀리면 아무것도 바꾸지 않는다(FR-061).
